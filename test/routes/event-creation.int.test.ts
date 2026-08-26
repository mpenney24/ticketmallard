import assert from 'node:assert';
import { describe, test } from 'node:test';

import {
    EventCreateResponse,
    eventCreateSchema,
    EventGetRequest,
    EventGetResponse,
} from '../../src/db/schema';
import { createNewEvent, typedInject } from '../helpers';

describe('Events API Integration Tests', () => {
    test('POST /api/events creates an event and can retrieve the same event', async () => {
        const post = await typedInject<EventCreateResponse>({
            method: 'POST',
            url: '/api/events',
            payload: createNewEvent,
        });
        assert.strictEqual(post.statusCode, 201);

        const event = post.json;
        assert.deepStrictEqual(
            eventCreateSchema.parse(event),
            eventCreateSchema.parse(createNewEvent)
        );

        const getPayload: EventGetRequest = {
            id: event.id,
        };

        const get = await typedInject<EventGetResponse>({
            method: 'GET',
            url: `/api/events/${getPayload.id}`,
        });
        assert.strictEqual(get.statusCode, 200);

        assert.deepStrictEqual(event, get.json);
    });
});
