import assert from 'node:assert';
import { describe, test } from 'node:test';

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../../src/db';
import {
    Order,
    ORDER_STATUS,
    OrderCreateRequest,
    OrderGetRequest,
    OrderGetResponse,
    OrderTicket,
    tableOrders,
    tableOrderTickets,
    TICKET_STATUS,
} from '../../src/db/schema';
import * as redis from '../../src/utils/redis';
import {
    createTestEvent,
    createTestTicket,
    getTestCustomer,
    typedInject,
} from '../helpers';

async function waitUntil(
    condition: () => Promise<boolean>,
    timeoutMs = 5000,
    intervalMs = 1000
): Promise<void> {
    const start = performance.now();
    console.log('Starting wait for /expire callback:');

    while (performance.now() - start < timeoutMs) {
        if (await condition()) return;
        console.log('Waiting...');
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Condition timed out');
}

describe('Orders API Integration Tests', () => {
    test('POST /api/orders/expire expires an order for an existing event and returns the selected seated ticket to Redis', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({ eventId: event.id });
        const customer = await getTestCustomer(0);

        const inventoryKey = redis.CacheKeys.seatedTicket(event.id, ticket.id);
        await redis.setByKey(inventoryKey, TICKET_STATUS.AVAILABLE);

        const postPayload: OrderCreateRequest = {
            customerId: customer.id,
            orderItems: [
                {
                    eventId: event.id,
                    seatedTicketIds: [ticket.id],
                    gaTicketQuantity: 0,
                },
            ],
        };

        const post = await typedInject<Order>({
            method: 'POST',
            url: '/api/orders',
            payload: postPayload,
        });
        assert.strictEqual(post.statusCode, 201);

        const order = post.json;
        assert.ok(order.customerId);
        assert.ok(order.status);
        assert.ok(order.createdAt);

        const orderTickets: OrderTicket[] = await db
            .select()
            .from(tableOrderTickets)
            .where(
                and(
                    eq(tableOrderTickets.orderId, order.id),
                    inArray(tableOrderTickets.ticketId, [ticket.id])
                )
            );

        assert.ok(orderTickets);
        assert.strictEqual(orderTickets.length, 1);

        const orderTicket = orderTickets[0];
        assert.deepStrictEqual(orderTicket, { orderId: order.id, ticketId: ticket.id });

        const getPayload: OrderGetRequest = {
            id: order.id,
        };

        const get = await typedInject<OrderGetResponse>({
            method: 'GET',
            url: `/api/orders/${getPayload.id}`,
        });
        assert.strictEqual(get.statusCode, 200);

        assert.deepStrictEqual(order, get.json);

        const redisStock = await redis.getByKey(inventoryKey);
        assert.strictEqual(redisStock, TICKET_STATUS.RESERVED);

        await waitUntil(async () => {
            const [orderToExpire] = await db
                .select()
                .from(tableOrders)
                .where(eq(tableOrders.id, order.id))
                .limit(1);
            return orderToExpire?.status === ORDER_STATUS.EXPIRED;
        });

        const getExpiredOrder = await typedInject<OrderGetResponse>({
            method: 'GET',
            url: `/api/orders/${getPayload.id}`,
        });
        assert.strictEqual(get.statusCode, 200);

        const expiredOrder = getExpiredOrder.json;
        assert.ok(expiredOrder.customerId);
        assert.ok(expiredOrder.status);
        assert.ok(expiredOrder.createdAt);
        assert.ok(expiredOrder.updatedAt);

        assert.equal(expiredOrder.status, ORDER_STATUS.EXPIRED);

        const emptyOrderTickets: OrderTicket[] = await db
            .select()
            .from(tableOrderTickets)
            .where(
                and(
                    eq(tableOrderTickets.orderId, order.id),
                    inArray(tableOrderTickets.ticketId, [ticket.id])
                )
            );

        assert.ok(emptyOrderTickets);
        assert.strictEqual(emptyOrderTickets.length, 0);

        const returnedRedisStock = await redis.getByKey(inventoryKey);
        assert.strictEqual(returnedRedisStock, TICKET_STATUS.AVAILABLE);
    });
});
