import assert from 'node:assert';
import { describe, test } from 'node:test';

import {
    TicketCreateResponse,
    TicketGetRequest,
    TicketGetResponse,
} from '../../src/db/schema';
import { createNewTicket, createTestEvent, typedInject } from '../helpers';

describe('Tickets API Integration Tests', () => {
    test('POST /api/tickets creates a ticket for an existing event and can retrieve the same ticket', async () => {
        const event = await createTestEvent();

        const post = await typedInject<TicketCreateResponse>({
            method: 'POST',
            url: '/api/tickets',
            payload: createNewTicket(event),
        });

        assert.strictEqual(post.statusCode, 201);

        const ticket = post.json;
        assert.ok(ticket.id);
        assert.ok(ticket.eventId);
        assert.ok(ticket.createdAt);

        const getPayload: TicketGetRequest = {
            id: ticket.id,
        };

        const get = await typedInject<TicketGetResponse>({
            method: 'GET',
            url: `/api/tickets/${getPayload.id}`,
        });

        assert.strictEqual(get.statusCode, 200);

        assert.deepStrictEqual(ticket, get.json);
    });
});
