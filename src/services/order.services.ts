import { and, eq, SQL } from 'drizzle-orm';

import { db } from '../db';
import { buildConditions } from '../db/buildConditions';
import {
    OrderCompleteWebhookRequest,
    OrderCompleteWebhookResponse,
    OrderCreateRequest,
    OrderCreateResponse,
    OrderExpireWebhookRequest,
    OrderExpireWebhookResponse,
    OrderGetRequest,
    OrderItem,
    OrderItemsReservedByEvent,
    OrderPayRequest,
    OrderPayResponse,
    OrdersGetRequest,
    OrderUpdateRequest,
    OrderUpdateResponse,
    orderUpdateResponseSchema,
} from '../db/schemas/order/schemas.db';
import { ORDER_STATUS, tableOrders } from '../db/schemas/order/table.db';
import { OrderTicketCreateRequest } from '../db/schemas/order-ticket/schemas.db';
import { tableOrderTickets } from '../db/schemas/order-ticket/table.db';
import { tableTickets } from '../db/schemas/ticket/table.db';
import { NotFoundError } from '../errors/domain.errors';
import { getQstash } from '../utils/qstash';
import * as redis from '../utils/redis';

interface OrderOptions {
    idempotencyKey?: string;
    extraConditions?: SQL[];
    extraInsertions?: [{}];
}

export async function getOrder(request: OrderGetRequest) {
    const { id } = request;

    const [order] = await db
        .select()
        .from(tableOrders)
        .where(eq(tableOrders.id, id))
        .limit(1);

    if (!order) {
        throw new NotFoundError('Order');
    }

    return order;
}

export async function getOrders(request: OrdersGetRequest) {
    const conditions = buildConditions(tableOrders, request);

    const rows = await db
        .select({
            order: tableOrders,
            ticketId: tableOrderTickets.ticketId,
        })
        .from(tableOrders)
        .leftJoin(tableOrderTickets, eq(tableOrders.id, tableOrderTickets.orderId))
        .where(conditions.length ? and(...conditions) : undefined);

    const map = new Map<
        string,
        typeof tableOrders.$inferSelect & { orderTicketIds: string[] }
    >();

    for (const row of rows) {
        let entry = map.get(row.order.id);
        if (!entry) {
            entry = { ...row.order, orderTicketIds: [] };
            map.set(row.order.id, entry);
        }
        if (row.ticketId) {
            entry.orderTicketIds.push(row.ticketId);
        }
    }

    return Array.from(map.values());
}

export async function createOrder(
    request: OrderCreateRequest,
    opts?: OrderOptions
): Promise<OrderCreateResponse> {
    const { customerId } = request;
    const orderItems: OrderItemsReservedByEvent[] = await reserveOrderItemsViaRedis(
        request.orderItems
    );

    const order = await db.transaction(async (tx) => {
        const [newOrder] = await tx
            .insert(tableOrders)
            .values({
                customerId,
                ...opts?.extraInsertions,
            })
            .returning();

        const tickets: OrderTicketCreateRequest[] = orderItems
            .flatMap((orderItem) => orderItem.orderTicketIds)
            .map((ticketId) => ({
                orderId: newOrder.id,
                ticketId,
            }));

        await tx.insert(tableOrderTickets).values(tickets);

        return newOrder;
    });

    const expireOrderPayload: OrderExpireWebhookRequest = {
        id: order.id,
        status: ORDER_STATUS.EXPIRED,
        orderItems,
    };

    await getQstash().publishJSON({
        url: `${process.env.APP_URL}/api/orders/expire`,
        body: expireOrderPayload,
        delay: 1,
    });

    if (opts?.idempotencyKey) {
        await redis.setIdempotency(opts.idempotencyKey, { statusCode: 201, body: order });
    }

    return order;
}

export async function updateOrder(
    request: OrderUpdateRequest,
    opts?: OrderOptions
): Promise<OrderUpdateResponse> {
    const { id, status } = request;
    const conditions: SQL[] = [eq(tableOrders.id, id), ...(opts?.extraConditions || [])];

    const updatedOrder: OrderUpdateResponse = await db.transaction(async (tx) => {
        const [updated] = await tx
            .update(tableOrders)
            .set({ status, updatedAt: new Date() })
            .where(and(...conditions))
            .returning();

        return orderUpdateResponseSchema.parse(updated);
    });

    if (opts?.idempotencyKey) {
        await redis.setIdempotency(opts.idempotencyKey, {
            statusCode: 201,
            body: updatedOrder,
        });
    }

    return updatedOrder;
}

export async function expireOrder(
    request: OrderExpireWebhookRequest
): Promise<OrderExpireWebhookResponse> {
    const { id, status, orderItems } = request;

    const extraConditions: SQL[] = [eq(tableOrders.status, ORDER_STATUS.PENDING)];

    try {
        const updatedOrder = await updateOrder({ id, status }, { extraConditions });

        await db
            .delete(tableOrderTickets)
            .where(eq(tableOrderTickets.orderId, updatedOrder.id));

        await releaseOrderItemsViaRedis(orderItems);

        return { ...updatedOrder, success: true };
    } catch (error) {
        return {
            success: false,
            message: `Could not expire order id ${id}. This may be due to race conditions. Investigate the order and orderTickets tables to confirm`,
        };
    }
}

export async function payOrder(
    request: OrderPayRequest,
    opts: OrderOptions
): Promise<OrderPayResponse> {
    const { id, status } = request;

    const extraConditions: SQL[] = [eq(tableOrders.status, ORDER_STATUS.PENDING)];

    try {
        const updatedOrder = await updateOrder(
            { id, status },
            { ...opts, extraConditions }
        );

        await getQstash().publishJSON({
            url: `${process.env.APP_URL}/api/orders/complete`,
            body: { id: updatedOrder.id },
        });

        return { ...updatedOrder, success: true };
    } catch (error) {
        return {
            success: false,
            message: `Could not pay order id ${id}. The order may have expired. Investigate the order table to confirm`,
        };
    }
}

export async function completeOrder(
    request: OrderCompleteWebhookRequest
): Promise<OrderCompleteWebhookResponse> {
    const { id } = request;

    const orderTickets = await db
        .select({
            ticketId: tableOrderTickets.ticketId,
            eventId: tableTickets.eventId,
        })
        .from(tableOrderTickets)
        .innerJoin(tableTickets, eq(tableOrderTickets.ticketId, tableTickets.id))
        .where(eq(tableOrderTickets.orderId, id));

    const ticketIdsByEvent = new Map<string, string[]>();
    for (const item of orderTickets) {
        const list = ticketIdsByEvent.get(item.eventId) || [];
        list.push(item.ticketId);
        ticketIdsByEvent.set(item.eventId, list);
    }

    await markOrderItemsAsSoldViaRedis(ticketIdsByEvent);

    return { success: true };
}

async function reserveOrderItemsViaRedis(orderItems: OrderItem[]) {
    const orderItemsByEvent: OrderItemsReservedByEvent[] = [];

    for (const item of orderItems) {
        try {
            const result = await redis.reserveMixedCart(
                item.eventId,
                item.gaTicketQuantity,
                item.seatedTicketIds
            );

            const orderTicketIds: string[] = result.data;

            orderItemsByEvent.push({
                eventId: item.eventId,
                orderTicketIds,
            });
        } catch (error) {
            await releaseOrderItemsViaRedis(orderItemsByEvent);
            throw error;
        }
    }

    return orderItemsByEvent;
}

async function releaseOrderItemsViaRedis(orderItemsByEvent: OrderItemsReservedByEvent[]) {
    for (const item of orderItemsByEvent) {
        await redis.releaseMixedCart(item.eventId, item.orderTicketIds);
    }
}

async function markOrderItemsAsSoldViaRedis(ticketIdsByEvent: Map<string, string[]>) {
    await Promise.all(
        Array.from(ticketIdsByEvent.entries()).map(([eventId, ticketIds]) =>
            redis.markTicketsAsSold(eventId, ticketIds)
        )
    );
}
