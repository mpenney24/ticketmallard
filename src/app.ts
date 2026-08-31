import sensible from '@fastify/sensible';
import fastify from 'fastify';
import {
    serializerCompiler,
    validatorCompiler,
    ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { db } from './db/index';
import { DomainError } from './errors/domain.errors';
import customerRoutes from './routes/customers';
import eventRoutes from './routes/events';
import orderRoutes from './routes/orders';
import orderExpireRoutes from './routes/orders.expire';
import ticketRoutes from './routes/tickets';

async function buildServer() {
    const server = fastify({
        logger: {
            level: 'info',
            serializers: {
                req(request) {
                    return {
                        method: request.method,
                        url: request.url,
                    };
                },
                res(reply) {
                    return {
                        statusCode: reply.statusCode,
                    };
                },
            },
            transport: {
                target: 'pino-pretty',
                options: {
                    translateTime: 'SYS:HH:MM:ss',
                    ignore: 'pid,hostname,reqId',
                    singleLine: true,
                },
            },
        },
    });
    await server.register(sensible);

    server.setValidatorCompiler(validatorCompiler);
    server.setSerializerCompiler(serializerCompiler);

    server.addHook('onSend', async (request, reply, payload) => {
        if (request.method === 'POST' && reply.statusCode === 200) {
            reply.code(201);
        }
        return payload;
    });

    // FOR DEBUGGING
    // server.addHook('onResponse', (request, reply, done) => {
    //     console.log(
    //         `[Response] ${request.method} ${request.url} -> Status: ${reply.statusCode}`
    //     );
    //     done();
    // });

    server.addHook('onClose', async () => {
        await db.$client.end();
    });

    server.setErrorHandler((error, request, reply) => {
        if (error instanceof DomainError) {
            return reply.code(error.statusCode).send({
                error: error.name,
                message: error.message,
            });
        }

        request.log.error(error);
        throw error;
    });

    server.get('/health', async () => {
        return { status: 'Ok 🦆' };
    });

    await server.register(customerRoutes, { prefix: '/api/customers' });
    await server.register(eventRoutes, { prefix: '/api/events' });
    await server.register(ticketRoutes, { prefix: '/api/tickets' });
    await server.register(orderRoutes, { prefix: '/api/orders' });
    await server.register(orderExpireRoutes, { prefix: '/api/orders/expire' });

    return server;
}

async function buildApp() {
    const app = await buildServer();
    app.withTypeProvider<ZodTypeProvider>();
    return app;
}

export default buildApp;
