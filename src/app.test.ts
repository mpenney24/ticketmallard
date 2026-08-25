import assert from 'node:assert';
import { after, before, describe, test } from 'node:test';

import sinon from 'sinon';

import { FIXED_DATE, getJsonResponse, testEvent } from '../test/helpers';
import buildApp from './app';
import {
    EventCreateRequest,
    EventCreateResponse,
    eventCreateSchema,
    EventsGetResponse,
} from './db/schema';

describe('Node API App', () => {
    let app: Awaited<ReturnType<typeof buildApp>>;

    let clock: sinon.SinonFakeTimers;

    before(async () => {
        clock = sinon.useFakeTimers({
            now: FIXED_DATE,
            toFake: ['Date'],
        });
        app = await buildApp();
    });

    after(async () => {
        await app.close();
        clock.restore();
    });

    test('GET /health returns Ok status', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/health',
        });

        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(JSON.parse(response.payload), {
            status: 'Ok 🦆',
            pond: 'active',
        });
    });

    describe('Events API Integration Tests', () => {
        test('GET /api/events returns event list', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/events',
            });

            assert.strictEqual(response.statusCode, 200);

            const payload = getJsonResponse<EventsGetResponse>(response);
            assert.ok(Array.isArray(payload.events));
            assert.equal(payload.events.length, 1);

            const event = payload.events[0]!;
            assert.ok(event.id);
            assert.ok(event.createdAt);

            assert.deepStrictEqual(eventCreateSchema.parse(event), testEvent);
        });

        test('POST /api/events creates an event', async () => {
            const newEvent: EventCreateRequest = eventCreateSchema.parse({
                title: 'Duck Concert 2026',
                startTime: new Date('2026-08-30'),
            });

            const response = await app.inject({
                method: 'POST',
                url: '/api/events',
                payload: newEvent,
            });

            assert.strictEqual(response.statusCode, 201);

            const payload = getJsonResponse<EventCreateResponse>(response);
            assert.strictEqual(payload.message, 'Event created successfully 🦆');

            const event = payload.event;
            assert.ok(event.id);
            assert.ok(event.createdAt);

            assert.deepStrictEqual(
                eventCreateSchema.parse(event),
                eventCreateSchema.parse(newEvent)
            );
        });
    });
});
