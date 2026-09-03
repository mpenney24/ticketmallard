import assert from 'node:assert';
import { describe, test } from 'node:test';

import { eq } from 'drizzle-orm';

import { db } from '../../src/db';
import {
    Order,
    OrderCreateRequest,
    OrderGetResponse,
} from '../../src/db/schemas/order/schemas.db';
import { OrderTicket } from '../../src/db/schemas/order-ticket/schemas.db';
import { tableOrderTickets } from '../../src/db/schemas/order-ticket/table.db';
import { TICKET_TYPE } from '../../src/db/schemas/ticket/table.db';
import { SoldOutError } from '../../src/errors/domain.errors';
import * as redis from '../../src/utils/redis';
import {
    createTestEvent,
    createTestTicket,
    getTestCustomer,
    typedInject,
} from '../helpers';

describe('Orders API Integration Tests', () => {
    test('POST /api/orders creates ONE order and 9 SoldOutErrors when 10 concurrent orders compete for the last available GA pool ticket from Redis', async () => {
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
                    gaTicketQuantity: 1,
                    seatedTicketIds: [],
                },
            ],
        };

        const requestCount = 10;
        const requests = Array.from({ length: requestCount }, () =>
            typedInject<Order>({
                method: 'POST',
                url: '/api/orders',
                payload: postPayload,
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

        failures.forEach((fail) => {
            assert.strictEqual(fail.statusCode, 409);

            const error = fail.json as unknown as SoldOutError;
            assert.strictEqual(
                error.message,
                `General admission pool for ${event.id} sold out`
            );
        });

        const orderTickets: OrderTicket[] = await db
            .select()
            .from(tableOrderTickets)
            .where(eq(tableOrderTickets.orderId, successes[0].json.id));

        assert.ok(orderTickets);
        assert.strictEqual(orderTickets.length, 1);
        assert.strictEqual(orderTickets[0].ticketId, ticket.id);

        const orderTicket = orderTickets[0];
        assert.deepStrictEqual(orderTicket, {
            orderId: successes[0].json.id,
            ticketId: ticket.id,
        });

        const order = successes[0].json;
        assert.ok(order.customerId);
        assert.ok(order.status);
        assert.ok(order.createdAt);

        const get = await typedInject<OrderGetResponse>({
            method: 'GET',
            url: `/api/orders/${order.id}`,
        });
        assert.strictEqual(get.statusCode, 200);

        assert.deepStrictEqual(order, get.json);

        const redisStockCount = await redis.getPoolByKey(inventoryKey);
        assert.strictEqual(redisStockCount, 0);
    });
});
