import { describe, test } from 'node:test';

import { createTestEvent, createTestTicket } from '../helpers';

describe('Orders API Integration Tests', () => {
    test('POST /api/orders creates an order for an existing event and an available ticket', async () => {
        const event = await createTestEvent();
        const ticket = await createTestTicket({ event });

        // Mitch - write order tests here!
    });
});
