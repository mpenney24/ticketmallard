import fastify from 'fastify';
import { db } from './db/index';

import ticketRoutes from './routes/tickets';
import eventRoutes from './routes/events';

export async function buildApp() {
    const server = fastify({ logger: true });

    server.addHook('onClose', async () => {
        await db.$client.end();
    });

    server.get('/health', async () => {
        return { status: 'Ok 🦆', pond: 'active' };
    });

    await server.register(ticketRoutes, { prefix: '/api/tickets' });
    await server.register(eventRoutes, { prefix: '/api/events' });

    return server;
}
