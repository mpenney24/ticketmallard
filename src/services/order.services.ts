import { eq } from 'drizzle-orm';

import { db } from '../db';
import {
    ORDER_STATUS,
    OrderCreateRequest,
    OrderExpireRequest,
    OrderGetRequest,
    OrderItem,
    OrderItemsReservedByEvent,
    OrderTicketCreateRequest,
    OrderUpdateRequest,
    OrderUpdateResponse,
    orderUpdateResponseSchema,
    tableOrders,
    tableOrderTickets,
} from '../db/schema';
import { NotFoundError } from '../errors/domain.errors';
import { getQstash } from '../utils/qstash';
import * as redis from '../utils/redis';

const appUrl = process.env.APP_URL || 'http://127.0.0.1:3000';

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

export async function createOrder(request: OrderCreateRequest, idempotencyKey?: string) {
    const orderItems: OrderItemsReservedByEvent[] = await reserveOrderItemsViaRedis(
        request.orderItems
    );

    const order = await db.transaction(async (tx) => {
        const [newOrder] = await tx
            .insert(tableOrders)
            .values({
                customerId: request.customerId,
                status: ORDER_STATUS.PENDING,
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

    const expireOrderPayload: OrderExpireRequest = {
        id: order.id,
        status: ORDER_STATUS.EXPIRED,
        orderItems,
    };

    try {
        console.log('Attempting to publish to QStash...');
        const res = await getQstash().publishJSON({
            url: `${process.env.APP_URL}/api/orders/expire`,
            body: expireOrderPayload,
            delay: 1,
        });
        console.log('Successfully published to QStash:', res);
    } catch (error) {
        console.error('FAILED TO PUBLISH TO QSTASH:', error);
    }

    if (idempotencyKey) {
        await redis.setIdempotency(idempotencyKey, { statusCode: 201, body: order });
    }

    return order;
}

export async function updateOrder(request: OrderUpdateRequest, idempotencyKey?: string) {
    const { id, status } = request;

    const updatedOrder: OrderUpdateResponse = await db.transaction(async (tx) => {
        const [updated] = await tx
            .update(tableOrders)
            .set({ status, updatedAt: new Date() })
            .where(eq(tableOrders.id, id))
            .returning();

        return orderUpdateResponseSchema.parse(updated);
    });

    if (idempotencyKey) {
        await redis.setIdempotency(idempotencyKey, {
            statusCode: 201,
            body: updatedOrder,
        });
    }

    return updatedOrder;
}

export async function expireOrder(request: OrderExpireRequest) {
    const { id, status, orderItems } = request;

    const updatedOrder = await updateOrder({ id, status });

    await db
        .delete(tableOrderTickets)
        .where(eq(tableOrderTickets.orderId, updatedOrder.id));

    await releaseOrderItemsViaRedis(orderItems);

    return updatedOrder;
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
        } catch (error: any) {
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
