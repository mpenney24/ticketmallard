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
} from '../../src/db/schema';
import { ReservationError } from '../../src/errors/domain.errors';
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
    });

    test('POST /api/orders fails to create an order for an existing event because no available seated ticket from Redis', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({ eventId: event.id });
        const customer = await getTestCustomer(0);

        const inventoryKey = redis.CacheKeys.seatedTicket(event.id, ticket.id);
        await redis.setByKey(inventoryKey, TICKET_STATUS.RESERVED);

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
            customerId,
            orderItems: [
                {
                    eventId: event.id,
                    seatedTicketIds: [ticket.id],
                    gaTicketQuantity: 0,
                },
            ],
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

        const order = successes[0].json;
        assert.ok(order.customerId);
        assert.ok(order.status);
        assert.ok(order.createdAt);
        assert.ok(order.updatedAt);

        const get = await typedInject<OrderGetResponse>({
            method: 'GET',
            url: `/api/orders/${order.id}`,
        });
        assert.strictEqual(get.statusCode, 200);

        assert.deepStrictEqual(order, get.json);

        const redisStock = await redis.getByKey(inventoryKey);
        assert.strictEqual(redisStock, TICKET_STATUS.RESERVED);
    });
});
