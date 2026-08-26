import sensible from '@fastify/sensible';
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

    server.get('/health', async () => {
        return { status: 'Ok 🦆' };
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
