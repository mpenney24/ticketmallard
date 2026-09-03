import rateLimit from '@fastify/rate-limit';
import sensible, { HttpError } from '@fastify/sensible';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastify from 'fastify';
import {
    createJsonSchemaTransform,
    serializerCompiler,
    validatorCompiler,
    ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { db } from './db/index';
import { mapDatabaseError } from './db/mapDatabaseErrors';
import { DomainError } from './errors/domain.errors';
import customerRoutes from './routes/customers';
import eventRoutes from './routes/events';
import orderRoutes from './routes/orders';
import orderCompleteRoutes from './routes/orders.complete';
import orderExpireRoutes from './routes/orders.expire';
import orderPayRoutes from './routes/orders.pay';
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

    // allow easy HTTP requests/responses
    await server.register(sensible);

    // allow ZOD schema parsing
    server.setValidatorCompiler(validatorCompiler);
    server.setSerializerCompiler(serializerCompiler);

    // prevent DDoS scripts hammering endpoints
    await server.register(rateLimit, {
        global: true,
        max: 100,
        timeWindow: '1 minute',
    });

    const customTransform = createJsonSchemaTransform({
        zodToJsonConfig: {
            target: 'draft-2020-12',
        },
    });

    await server.register(fastifySwagger, {
        openapi: {
            openapi: '3.1.0',
            info: {
                title: 'TicketMallard API',
                description:
                    'A high-performance, atomically-enforced event ticketing and reservation system... mwap!',
                version: '1.0.0',
            },
        },
        transform: customTransform,
    });

    await server.register(fastifySwaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: false,
        },
    });

    server.addHook('onClose', async () => {
        await db.$client.end();
    });

    server.setErrorHandler((error: HttpError, request, reply) => {
        if (error instanceof DomainError) {
            return reply.code(error.statusCode).send({
                success: false,
                message: error.message,
            });
        }

        const mappedDbError = mapDatabaseError(error);
        if (mappedDbError) {
            return reply.status(mappedDbError.status).send({
                success: false,
                error: 'Bad Request',
                message: mappedDbError.message,
            });
        }

        request.log.error(error);

        const statusCode = error.statusCode || 500;
        return reply.code(statusCode).send({
            success: false,
            message: error.message || 'Ticketmallard Internal Server Error',
        });
    });

    server.get('/health', async () => {
        return { status: 'Ok 🦆' };
    });

    // Mitch - autoroute these?
    await server.register(customerRoutes, { prefix: '/api/customers' });
    await server.register(eventRoutes, { prefix: '/api/events' });
    await server.register(ticketRoutes, { prefix: '/api/tickets' });
    await server.register(orderRoutes, { prefix: '/api/orders' });
    await server.register(orderExpireRoutes, { prefix: '/api/orders/expire' });
    await server.register(orderPayRoutes, { prefix: '/api/orders/pay' });
    await server.register(orderCompleteRoutes, { prefix: '/api/orders/complete' });

    return server;
}

async function buildApp() {
    const app = await buildServer();
    app.withTypeProvider<ZodTypeProvider>();
    return app;
}

export default buildApp;
