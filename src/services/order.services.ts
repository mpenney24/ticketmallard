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
    OrderGetResponse,
    orderGetResponseSchema,
    OrderItem,
    OrderItemsReservedByEvent,
    OrderPayRequest,
    OrderPayResponse,
    OrdersGetRequest,
    OrdersGetResponse,
    OrderTimestamped,
    orderTimestampedObjectSchema,
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
    extraConditions?: SQL[];
    extraInsertions?: [{}];
}

interface OrderIdempotency {
    idempotencyKey: string;
}

export async function getOrder(request: OrderGetRequest): Promise<OrderGetResponse> {
    const { id } = request;

    const [order] = await db
        .select()
        .from(tableOrders)
        .where(eq(tableOrders.id, id))
        .limit(1);

    if (!order) {
        throw new NotFoundError('Order');
    }

    return orderGetResponseSchema.parse(order);
}

export async function getOrders(request: OrdersGetRequest): Promise<OrdersGetResponse> {
    const conditions = buildConditions(tableOrders, request);

    const rows = await db
        .select({
            order: tableOrders,
            ticketId: tableOrderTickets.ticketId,
        })
        .from(tableOrders)
        .leftJoin(tableOrderTickets, eq(tableOrders.id, tableOrderTickets.orderId))
        .where(conditions.length ? and(...conditions) : undefined);

    const map = new Map<string, OrderGetResponse & { orderTicketIds: string[] }>();

    for (const row of rows) {
        let entry = map.get(row.order.id);
        if (!entry) {
            entry = {
                ...orderTimestampedObjectSchema.parse(row.order),
                orderTicketIds: [],
            };
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
    cacheKeys: OrderIdempotency,
    opts?: OrderOptions
): Promise<OrderCreateResponse> {
    const { customerId } = request;
    const orderItemsByEvent: OrderItemsReservedByEvent[] =
        await reserveOrderItemsViaRedis(request.orderItems);

    let order: OrderTimestamped;

    try {
        order = await db.transaction(async (tx) => {
            const [newOrder] = await tx
                .insert(tableOrders)
                .values({
                    customerId,
                    ...opts?.extraInsertions,
                })
                .returning();

            const tickets: OrderTicketCreateRequest[] = orderItemsByEvent
                .flatMap((orderItem) => orderItem.orderTicketIds)
                .map((ticketId) => ({
                    orderId: newOrder.id,
                    ticketId,
                }));

            await tx.insert(tableOrderTickets).values(tickets);

            return orderUpdateResponseSchema.parse(newOrder);
        });
    } catch (error) {
        await releaseOrderItemsViaRedis(orderItemsByEvent);
        throw error;
    }

    const expireOrderPayload: OrderExpireWebhookRequest = {
        id: order.id,
        status: ORDER_STATUS.EXPIRED,
        orderItems: orderItemsByEvent,
    };

    await getQstash().publishJSON({
        url: `${process.env.APP_URL}/api/orders/expire`,
        body: expireOrderPayload,
        headers: {
            'x-idempotency-key': cacheKeys.idempotencyKey,
        },
        delay: 1,
    });

    return order;
}

export async function updateOrder(
    request: OrderUpdateRequest,
    opts?: OrderOptions
): Promise<OrderUpdateResponse | null> {
    const { id, status } = request;
    const conditions: SQL[] = [eq(tableOrders.id, id), ...(opts?.extraConditions || [])];

    const updatedOrder: OrderUpdateResponse | null = await db.transaction(async (tx) => {
        const [updated] = await tx
            .update(tableOrders)
            .set({ status })
            .where(and(...conditions))
            .returning();

        if (!updated) {
            return null;
        }

        return orderUpdateResponseSchema.parse(updated);
    });

    return updatedOrder;
}

export async function expireOrder(
    request: OrderExpireWebhookRequest
): Promise<OrderExpireWebhookResponse> {
    const { id, status, orderItems } = request;

    const extraConditions: SQL[] = [eq(tableOrders.status, ORDER_STATUS.PENDING)];

    const updatedOrder = await updateOrder({ id, status }, { extraConditions });
    if (!updatedOrder) {
        return {
            success: false,
            message: `Could not expire order id ${id}. This may be due to race conditions. Investigate the order and orderTickets tables to confirm`,
        };
    }

    await db.delete(tableOrderTickets).where(eq(tableOrderTickets.orderId, id));

    const { released, notReleased } = await releaseOrderItemsViaRedis(orderItems);
    if (notReleased.length > 1) {
        return {
            success: false,
            message: `Not all tickets were released for an order expiry request, order id ${id}. This may be due to race conditions. 
                Investigate the following tickets: released:[${released.join(', ')}], notReleased:[${notReleased.join(', ')}]`,
        };
    }

    return {
        success: true,
    };
}

export async function payOrder(request: OrderPayRequest): Promise<OrderPayResponse> {
    const { id, status } = request;

    const extraConditions: SQL[] = [eq(tableOrders.status, ORDER_STATUS.PENDING)];

    const updatedOrder = await updateOrder({ id, status }, { extraConditions });

    if (!updatedOrder) {
        return {
            success: false,
            message: `Could not pay order id ${id}. The order may have expired. Please try placing the order again before trying to pay`,
        };
    }

    await getQstash().publishJSON({
        url: `${process.env.APP_URL}/api/orders/complete`,
        body: { id: updatedOrder.id },
    });

    return { success: true };
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
    const released = [],
        notReleased = [];
    for (const item of orderItemsByEvent) {
        const result = await redis.releaseMixedCart(item.eventId, item.orderTicketIds);

        released.push(...result.released);
        notReleased.push(...result.notReleased);
    }

    return { released, notReleased };
}

async function markOrderItemsAsSoldViaRedis(ticketIdsByEvent: Map<string, string[]>) {
    await Promise.all(
        Array.from(ticketIdsByEvent.entries()).map(([eventId, ticketIds]) =>
            redis.markTicketsAsSold(eventId, ticketIds)
        )
    );
}
