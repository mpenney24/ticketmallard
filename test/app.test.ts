import assert from 'node:assert';
import { before, describe, test } from 'node:test';

import buildApp from '../src/app';

describe('Node API App', () => {
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
        });
    });
});
