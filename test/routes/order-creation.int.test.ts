import assert from 'node:assert';
import { describe, test } from 'node:test';

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../../src/db';
import {
    Order,
    OrderCreateRequest,
    OrderGetRequest,
    OrderGetResponse,
    OrderTicket,
    tableOrderTickets,
    TICKET_STATUS,
    TICKET_TYPE,
} from '../../src/db/schema';
import { ReservationError, SoldOutError } from '../../src/errors/domain.errors';
import * as redis from '../../src/utils/redis';
import {
    createTestEvent,
    createTestTicket,
    getTestCustomer,
    typedInject,
} from '../helpers';

describe('Orders API Integration Tests', () => {
    test('POST /api/orders creates an order for an existing event by securing an available seated ticket from Redis', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({ eventId: event.id });
        const customer = await getTestCustomer(0);

        const inventoryKey = redis.CacheKeys.seatedTicket(event.id, ticket.id);
        await redis.setByKey(inventoryKey, TICKET_STATUS.AVAILABLE);

        const postPayload: OrderCreateRequest = {
            eventId: event.id,
            ticketIds: [ticket.id],
            customerId: customer.id,
            gaQuantity: 0,
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
    });

    test('POST /api/orders fails to create an order for an existing event because no available seated ticket from Redis', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({ eventId: event.id });
        const customer = await getTestCustomer(0);

        const inventoryKey = redis.CacheKeys.seatedTicket(event.id, ticket.id);
        await redis.setByKey(inventoryKey, TICKET_STATUS.RESERVED);

        const postPayload: OrderCreateRequest = {
            eventId: event.id,
            ticketIds: [ticket.id],
            customerId: customer.id,
            gaQuantity: 0,
        };

        const post = await typedInject<Order>({
            method: 'POST',
            url: '/api/orders',
            payload: postPayload,
        });
        assert.strictEqual(post.statusCode, 409);

        const error = post.json as unknown as ReservationError;
        assert.strictEqual(error.message, `Seated ticket id ${ticket.id} is taken`);

        const redisStock = await redis.getByKey(inventoryKey);
        assert.strictEqual(redisStock, TICKET_STATUS.RESERVED);
    });

    test('POST /api/orders creates ONE order and ONE ReservationError for an existing event when multiple customers select the last available seated ticket from Redis', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({ eventId: event.id });
        const customer1 = await getTestCustomer(0);
        const customer2 = await getTestCustomer(1);

        const inventoryKey = redis.CacheKeys.seatedTicket(event.id, ticket.id);
        await redis.setByKey(inventoryKey, TICKET_STATUS.AVAILABLE);

        const createPostPayload: (customerId: string) => OrderCreateRequest = (
            customerId
        ) => ({
            eventId: event.id,
            ticketIds: [ticket.id],
            customerId,
            gaQuantity: 0,
        });

        const [responseA, responseB] = await Promise.all([
            typedInject<Order>({
                method: 'POST',
                url: '/api/orders',
                payload: createPostPayload(customer1.id),
            }),
            typedInject<Order>({
                method: 'POST',
                url: '/api/orders',
                payload: createPostPayload(customer2.id),
            }),
        ]);

        const responses = [responseA, responseB];

        const successes = responses.filter((r) => r.statusCode === 201);
        const failures = responses.filter((r) => r.statusCode !== 201);

        assert.strictEqual(
            successes.length,
            1,
            'Exactly one OrderCreateRequest should succeed'
        );
        assert.strictEqual(
            failures.length,
            1,
            'Exactly one OrderCreateRequest should be rejected'
        );

        const get = await typedInject<OrderGetResponse>({
            method: 'GET',
            url: `/api/orders/${successes[0].json.id}`,
        });
        assert.strictEqual(get.statusCode, 200);

        assert.deepStrictEqual(successes[0].json, get.json);

        const orderTickets: OrderTicket[] = await db
            .select()
            .from(tableOrderTickets)
            .where(and(eq(tableOrderTickets.orderId, successes[0].json.id)));

        assert.ok(orderTickets);
        assert.strictEqual(orderTickets.length, 1);
        assert.strictEqual(orderTickets[0].ticketId, ticket.id);

        const orderTicket = orderTickets[0];
        assert.deepStrictEqual(orderTicket, {
            orderId: successes[0].json.id,
            ticketId: ticket.id,
        });

        assert.strictEqual(failures[0].statusCode, 409);

        const error = failures[0].json as unknown as ReservationError;
        assert.strictEqual(error.message, `Seated ticket id ${ticket.id} is taken`);

        const redisStock = await redis.getByKey(inventoryKey);
        assert.strictEqual(redisStock, TICKET_STATUS.RESERVED);
    });

    test('POST /api/orders creates ONE order and 9 SoldOutErrors when 10 concurrent orders compete for the last available GA pool ticket from Redis', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({
            eventId: event.id,
            type: TICKET_TYPE.GA,
        });
        const customer = await getTestCustomer(0);

        const inventoryKey = redis.CacheKeys.gaPool(event.id);
        await redis.setPoolByKey(inventoryKey, [ticket.id]);

        const requestCount = 10;
        const requests = Array.from({ length: requestCount }, () =>
            typedInject<Order>({
                method: 'POST',
                url: '/api/orders',
                payload: {
                    eventId: event.id,
                    ticketIds: [],
                    customerId: customer.id,
                    gaQuantity: 1,
                },
            })
        );

        const responses = await Promise.all(requests);

        const successes = responses.filter((r) => r.statusCode === 201);
        const failures = responses.filter((r) => r.statusCode !== 201);

        assert.strictEqual(
            successes.length,
            1,
            'Exactly one OrderCreateRequest should succeed'
        );
        assert.strictEqual(
            failures.length,
            requestCount - 1,
            'All other competing OrderCreateRequests should be rejected'
        );

        const get = await typedInject<OrderGetResponse>({
            method: 'GET',
            url: `/api/orders/${successes[0].json.id}`,
        });
        assert.strictEqual(get.statusCode, 200);

        assert.deepStrictEqual(successes[0].json, get.json);

        const orderTickets: OrderTicket[] = await db
            .select()
            .from(tableOrderTickets)
            .where(and(eq(tableOrderTickets.orderId, successes[0].json.id)));

        assert.ok(orderTickets);
        assert.strictEqual(orderTickets.length, 1);
        assert.strictEqual(orderTickets[0].ticketId, ticket.id);

        const orderTicket = orderTickets[0];
        assert.deepStrictEqual(orderTicket, {
            orderId: successes[0].json.id,
            ticketId: ticket.id,
        });

        failures.forEach((fail) => {
            assert.strictEqual(fail.statusCode, 409);

            const error = fail.json as unknown as SoldOutError;
            assert.strictEqual(error.message, 'General admission pool sold out');
        });

        const redisStockCount = await redis.getPoolByKey(inventoryKey);
        assert.strictEqual(redisStockCount, 0);
    });
});
