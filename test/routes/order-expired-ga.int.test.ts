import assert from 'node:assert';
import { describe, test } from 'node:test';

import { and, eq } from 'drizzle-orm';

import { db } from '../../src/db';
import {
    Order,
    OrderCreateRequest,
    OrderGetRequest,
    OrderGetResponse,
} from '../../src/db/schemas/order/schemas.db';
import { ORDER_STATUS, tableOrders } from '../../src/db/schemas/order/table.db';
import { OrderTicket } from '../../src/db/schemas/order-ticket/schemas.db';
import { tableOrderTickets } from '../../src/db/schemas/order-ticket/table.db';
import { TICKET_TYPE } from '../../src/db/schemas/ticket/table.db';
import * as redis from '../../src/utils/redis';
import {
    createTestEvent,
    createTestTicket,
    getTestCustomer,
    typedInject,
    waitUntil,
} from '../helpers';

describe('Orders API Integration Tests', () => {
    test('POST /api/orders/expire expires an order for an existing event and returns the randomly assigned ga ticket to Redis', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({
            eventId: event.id,
            type: TICKET_TYPE.GA,
        });
        const customer = await getTestCustomer(0);

        const inventoryKey = redis.CacheKeys.gaPool(event.id);
        await redis.setPoolByKey(inventoryKey, [ticket.id]);

        const postPayload: OrderCreateRequest = {
            customerId: customer.id,
            orderItems: [
                {
                    eventId: event.id,
                    seatedTicketIds: [],
                    gaTicketQuantity: 1,
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
            .where(and(eq(tableOrderTickets.orderId, order.id)));

        assert.ok(orderTickets);
        assert.strictEqual(orderTickets.length, 1);
        assert.strictEqual(orderTickets[0].ticketId, ticket.id);

        const orderTicket = orderTickets[0];
        assert.deepStrictEqual(orderTicket, {
            orderId: order.id,
            ticketId: ticket.id,
        });

        const getPayload: OrderGetRequest = {
            id: order.id,
        };

        const get = await typedInject<OrderGetResponse>({
            method: 'GET',
            url: `/api/orders/${getPayload.id}`,
        });
        assert.strictEqual(get.statusCode, 200);

        assert.deepStrictEqual(order, get.json);

        const redisStockCount = await redis.getPoolByKey(inventoryKey);
        assert.strictEqual(redisStockCount, 0);

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
            .where(eq(tableOrderTickets.orderId, order.id));

        assert.ok(emptyOrderTickets);
        assert.strictEqual(emptyOrderTickets.length, 0);

        const newRedisStockCount = await redis.getPoolByKey(inventoryKey);
        assert.strictEqual(newRedisStockCount, 1);
    });
});
