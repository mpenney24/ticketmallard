import assert from 'node:assert';
import { describe, test } from 'node:test';

import { eq } from 'drizzle-orm';

import { db } from '../../src/db';
import {
    Order,
    OrderCompleteWebhookRequest,
    OrderCompleteWebhookResponse,
    OrderCreateRequest,
    OrderGetRequest,
    OrderGetResponse,
} from '../../src/db/schemas/order/schemas.db';
import { OrderTicket } from '../../src/db/schemas/order-ticket/schemas.db';
import { tableOrderTickets } from '../../src/db/schemas/order-ticket/table.db';
import { TICKET_STATUS, TICKET_TYPE } from '../../src/db/schemas/ticket/table.db';
import * as redis from '../../src/utils/redis';
import {
    createTestEvent,
    createTestTicket,
    getTestCustomer,
    typedInject,
    UNKNOWN_UUID,
} from '../helpers';

describe('Orders API Integration Tests', () => {
    test('POST /api/orders creates an order for an existing event by securing an available seated AND ga ticket from Redis', async () => {
        const event = await createTestEvent();
        const seatedTicket = await createTestTicket({ eventId: event.id });
        const gaTicket = await createTestTicket({
            eventId: event.id,
            type: TICKET_TYPE.GA,
        });
        const customer = await getTestCustomer(0);

        const seatedInventoryKey = redis.CacheKeys.seatedTicket(
            event.id,
            seatedTicket.id
        );
        await redis.setByKey(seatedInventoryKey, TICKET_STATUS.AVAILABLE);
        const gaInventoryKey = redis.CacheKeys.gaPool(event.id);
        await redis.setPoolByKey(gaInventoryKey, [gaTicket.id]);

        const postPayload: OrderCreateRequest = {
            customerId: customer.id,
            orderItems: [
                {
                    eventId: event.id,
                    seatedTicketIds: [seatedTicket.id],
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
            .where(eq(tableOrderTickets.orderId, order.id));

        assert.ok(orderTickets);
        assert.strictEqual(orderTickets.length, 2);
        [
            { orderId: order.id, ticketId: seatedTicket.id },
            { orderId: order.id, ticketId: gaTicket.id },
        ].forEach((orderTicket) => {
            assert.ok(orderTickets.find((t) => t.ticketId === orderTicket.ticketId));
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

        const redisSeatedStock = await redis.getByKey(seatedInventoryKey);
        assert.strictEqual(redisSeatedStock, TICKET_STATUS.RESERVED);
        const redisGaStockCount = await redis.getPoolByKey(gaInventoryKey);
        assert.strictEqual(redisGaStockCount, 0);
    });

    test('POST /api/orders/complete webhook generated from /pay fails to process if missing the "upstash-signature" header', async () => {
        const payload: OrderCompleteWebhookRequest = {
            id: UNKNOWN_UUID,
        };

        const post = await typedInject<OrderCompleteWebhookResponse>({
            method: 'POST',
            url: '/api/orders/complete',
            payload,
        });
        assert.strictEqual(post.statusCode, 401);
        assert.strictEqual(post.json.message, 'Missing upstash-signature HTTP Signature');
    });
});
