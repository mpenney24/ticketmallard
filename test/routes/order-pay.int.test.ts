import assert from 'node:assert';
import { describe, test } from 'node:test';

import {
    Order,
    ORDER_STATUS,
    OrderCreateRequest,
    OrderGetRequest,
    OrderGetResponse,
    OrderPayRequest,
} from '../../src/db/schemas/order-schema.db';
import { TICKET_STATUS } from '../../src/db/schemas/ticket-schema.db';
import * as redis from '../../src/utils/redis';
import {
    createTestEvent,
    createTestTicket,
    getTestCustomer,
    typedInject,
    waitUntil,
} from '../helpers';

describe('Orders API Integration Tests', () => {
    test('POST /api/orders/pay finalises an order and prevents qstash expiration', async () => {
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

        const redisStock = await redis.getByKey(inventoryKey);
        assert.strictEqual(redisStock, TICKET_STATUS.RESERVED);

        const postUpdatePayload: OrderPayRequest = {
            id: order.id,
            status: ORDER_STATUS.PAID,
        };

        const postUpdate = await typedInject<Order>({
            method: 'PATCH',
            url: '/api/orders/pay',
            payload: postUpdatePayload,
        });
        assert.strictEqual(post.statusCode, 201);

        const updatedOrder = postUpdate.json;
        assert.ok(updatedOrder.customerId);
        assert.ok(updatedOrder.status);
        assert.ok(updatedOrder.createdAt);

        let newRedisStock;

        await waitUntil(async () => {
            newRedisStock = await redis.getByKey(inventoryKey);
            return newRedisStock === TICKET_STATUS.SOLD;
        });
        assert.strictEqual(newRedisStock, TICKET_STATUS.SOLD);

        const getPayload: OrderGetRequest = {
            id: order.id,
        };

        const get = await typedInject<OrderGetResponse>({
            method: 'GET',
            url: `/api/orders/${getPayload.id}`,
        });
        assert.strictEqual(get.statusCode, 200);

        const completedOrder = get.json;
        assert.ok(completedOrder.customerId);
        assert.ok(completedOrder.status);
        assert.ok(completedOrder.createdAt);
        assert.ok(completedOrder.updatedAt);
        assert.strictEqual(completedOrder.status, ORDER_STATUS.PAID);
    });
});
