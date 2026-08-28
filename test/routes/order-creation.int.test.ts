import assert, { fail } from 'node:assert';
import { describe, test } from 'node:test';

import { redis } from '../../src/db/redis';
import {
    OrderCreateRequest,
    OrderGetRequest,
    OrderGetResponse,
    OrderObject,
} from '../../src/db/schema';
import {
    createTestEvent,
    createTestTicket,
    getTestCustomer,
    typedInject,
} from '../helpers';

describe('Orders API Integration Tests', () => {
    test('POST /api/orders creates an order for an existing event and secures an available ticket from Redis', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({ event });
        const customer = await getTestCustomer(0);

        const inventoryKey = `inventory:ticket:${ticket.id}`;
        await redis.set(inventoryKey, 1);

        const postPayload: OrderCreateRequest = {
            customerId: customer.id,
            ticketId: ticket.id,
        };

        const post = await typedInject<OrderObject>({
            method: 'POST',
            url: '/api/orders',
            payload: postPayload,
        });
        assert.strictEqual(post.statusCode, 201);

        const order = post.json;
        assert.ok(order.customerId);
        assert.ok(order.ticketId);
        assert.ok(order.status);

        const getPayload: OrderGetRequest = {
            id: order.id,
        };

        const get = await typedInject<OrderGetResponse>({
            method: 'GET',
            url: `/api/orders/${getPayload.id}`,
        });
        assert.strictEqual(get.statusCode, 200);

        assert.deepStrictEqual(order, get.json);

        const redisStock = await redis.get(inventoryKey);
        assert.strictEqual(Number(redisStock), 0);
    });

    test('POST /api/orders fails to create an order for an existing event because no available ticket from Redis', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({ event });
        const customer = await getTestCustomer(0);

        const inventoryKey = `inventory:ticket:${ticket.id}`;
        await redis.set(inventoryKey, 0);

        const postPayload: OrderCreateRequest = {
            customerId: customer.id,
            ticketId: ticket.id,
        };

        const post = await typedInject<OrderObject>({
            method: 'POST',
            url: '/api/orders',
            payload: postPayload,
        });
        assert.strictEqual(post.statusCode, 409);
        if ('message' in post.json) {
            assert.strictEqual(post.json.message, 'Sold Out');
        } else {
            fail();
        }

        const redisStock = await redis.get(inventoryKey);
        assert.strictEqual(Number(redisStock), 0);
    });

    test('POST /api/orders creates ONE order for an existing event despite multiple customers selecting the last available ticket from Redis', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({ event });
        const customer1 = await getTestCustomer(0);
        const customer2 = await getTestCustomer(1);

        const inventoryKey = `inventory:ticket:${ticket.id}`;
        await redis.set(inventoryKey, 1);

        const postCustomer1Payload: OrderCreateRequest = {
            customerId: customer1.id,
            ticketId: ticket.id,
        };

        const postCustomer2Payload: OrderCreateRequest = {
            customerId: customer2.id,
            ticketId: ticket.id,
        };

        const [responseA, responseB] = await Promise.all([
            typedInject<OrderObject>({
                method: 'POST',
                url: '/api/orders',
                payload: postCustomer1Payload,
            }),
            typedInject<OrderObject>({
                method: 'POST',
                url: '/api/orders',
                payload: postCustomer2Payload,
            }),
        ]);

        const responses = [responseA, responseB];

        const successes = responses.filter((r) => r.statusCode === 201);
        const conflicts = responses.filter((r) => r.statusCode === 409);

        assert.strictEqual(
            successes.length,
            1,
            'Exactly one order request should succeed'
        );
        assert.strictEqual(
            conflicts.length,
            1,
            'Exactly one order request should be rejected as "Sold Out"'
        );

        assert.strictEqual(conflicts[0].statusCode, 409);
        if ('message' in conflicts[0].json) {
            assert.strictEqual(conflicts[0].json.message, 'Sold Out');
        } else {
            fail();
        }

        const redisStock = await redis.get(inventoryKey);
        assert.strictEqual(Number(redisStock), 0);
    });
});
