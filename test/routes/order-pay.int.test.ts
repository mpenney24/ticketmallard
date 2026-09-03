import assert from 'node:assert';
import { describe, mock, test } from 'node:test';

import {
    Order,
    OrderCreateRequest,
    OrderExpireWebhookRequest,
    OrderExpireWebhookResponse,
    OrderGetRequest,
    OrderGetResponse,
    OrderItemsReservedByEvent,
    OrderPayRequest,
    OrderPayResponse,
} from '../../src/db/schemas/order/schemas.db';
import { ORDER_STATUS } from '../../src/db/schemas/order/table.db';
import { TICKET_STATUS } from '../../src/db/schemas/ticket/table.db';
import * as qstashModule from '../../src/utils/qstash';
import * as redis from '../../src/utils/redis';
import {
    createTestEvent,
    createTestTicket,
    getTestCustomer,
    typedInject,
    UNKNOWN_UUID,
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

    test('POST /api/orders/expire webhook generated from /pay fails to process if missing the "upstash-signature" header', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({ eventId: event.id });

        const orderItems: OrderItemsReservedByEvent[] = [
            {
                eventId: event.id,
                orderTicketIds: [ticket.id],
            },
        ];
        const payload: OrderExpireWebhookRequest = {
            id: UNKNOWN_UUID,
            status: ORDER_STATUS.EXPIRED,
            orderItems,
        };
        const post = await typedInject<OrderExpireWebhookResponse>({
            method: 'POST',
            url: '/api/orders/expire',
            payload,
        });
        assert.strictEqual(post.statusCode, 401);
        assert.strictEqual(post.json.success, false);
        assert.strictEqual(post.json.message, 'Missing upstash-signature HTTP Signature');
    });

    test('POST /api/orders/expire webhook generated from /pay fails to process an already paid order but passes through', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({ eventId: event.id });

        const orderItems: OrderItemsReservedByEvent[] = [
            {
                eventId: event.id,
                orderTicketIds: [ticket.id],
            },
        ];
        const payload: OrderExpireWebhookRequest = {
            id: UNKNOWN_UUID,
            status: ORDER_STATUS.EXPIRED,
            orderItems,
        };

        mock.method(qstashModule.receiver, 'verify', async () => true);
        const post = await typedInject<OrderExpireWebhookResponse>({
            method: 'POST',
            url: '/api/orders/expire',
            headers: {
                'upstash-signature': 'dummy',
            },
            payload,
        });
        // pass-through 200 even though failed, to prevent qstash retry/DLQ
        assert.strictEqual(post.statusCode, 200);
        assert.strictEqual(post.json.success, false);
        assert.strictEqual(
            post.json.message,
            `Could not expire order id ${UNKNOWN_UUID}. This may be due to race conditions. Investigate the order and orderTickets tables to confirm`
        );
    });

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

        // waiting until order has already expired before trying to pay
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const postUpdatePayload: OrderPayRequest = {
            id: order.id,
            status: ORDER_STATUS.PAID,
        };

        const postUpdate = await typedInject<OrderPayResponse>({
            method: 'PATCH',
            url: '/api/orders/pay',
            payload: postUpdatePayload,
        });
        assert.strictEqual(postUpdate.statusCode, 401);
        assert.strictEqual(postUpdate.json.success, false);
        assert.strictEqual(
            postUpdate.json.message,
            `Could not pay order id ${order.id}. The order may have expired. Investigate the order table to confirm`
        );
    });
});
