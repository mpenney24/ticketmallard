import { after, before, describe, test } from 'node:test';
import assert from 'node:assert';
import { buildApp } from './app';

describe('Node API Healthcheck', () => {
    let app: Awaited<ReturnType<typeof buildApp>>;

    before(async () => {
        app = await buildApp();
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

    after(async () => {
        await app.close();
    });
});

describe('Events API Integration Tests', () => {
    let app: Awaited<ReturnType<typeof buildApp>>;

    before(async () => {
        app = await buildApp();
    });

    test('GET /api/events returns event list', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/events',
        });

        assert.strictEqual(response.statusCode, 200);

        const payload = response.json();
        assert.ok(Array.isArray(payload.events));
        assert.strictEqual(payload.events[0].title, 'Duck Concert 2026');
    });

    test('POST /api/events creates an event', async () => {
        const newEvent = { title: 'Pond Party', date: '2026-08-30' };

        const response = await app.inject({
            method: 'POST',
            url: '/api/events',
            payload: newEvent,
        });

        assert.strictEqual(response.statusCode, 201);

        const payload = response.json();
        assert.strictEqual(payload.message, 'Event created successfully 🦆');
        assert.deepStrictEqual(payload.event, newEvent);
    });

    after(async () => {
        await app.close();
    });
});
