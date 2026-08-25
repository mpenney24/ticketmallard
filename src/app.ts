import fastify from 'fastify';
import {
    serializerCompiler,
    validatorCompiler,
    ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { db } from './db/index';
import eventRoutes from './routes/events';
import ticketRoutes from './routes/tickets';

async function buildServer() {
    const server = fastify({ logger: true });

    server.setValidatorCompiler(validatorCompiler);
    server.setSerializerCompiler(serializerCompiler);

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

async function buildApp() {
    const app = await buildServer();
    app.withTypeProvider<ZodTypeProvider>();
    return app;
}

export default buildApp;
