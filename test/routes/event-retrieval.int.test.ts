import assert from 'node:assert';
import { describe, test } from 'node:test';

import { eventCreateSchema, EventsGetResponse } from '../../src/db/schema';
import { createNewEvent, typedInject, UNKNOWN_UUID } from '../helpers';

describe('Events API Integration Tests', () => {
    test('GET /api/events returns populated event list', async () => {
        const get = await typedInject<EventsGetResponse>({
            method: 'GET',
            url: '/api/events',
        });

        assert.strictEqual(get.statusCode, 200);

        const response = get.json;
        assert.ok(Array.isArray(response));

        const event = response[0]!;
        assert.ok(event.id);
        assert.ok(event.title);
        assert.ok(event.createdAt);

        assert.deepStrictEqual(
            eventCreateSchema.parse(event),
            eventCreateSchema.parse(createNewEvent)
        );
    });

    test('GET /api/events/:id returns 404 if resource Not Found', async () => {
        const get = await typedInject<EventsGetResponse>({
            method: 'GET',
            url: `/api/events/${UNKNOWN_UUID}`,
        });

        assert.strictEqual(get.statusCode, 404);
        assert.strictEqual(get.statusMessage, 'Not Found');
    });
});
