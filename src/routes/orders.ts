import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
    orderCreateResponseSchema,
    orderCreateSchema,
    orderGetRequestSchema,
    orderGetResponseSchema,
    ordersGetRequestSchema,
    ordersGetResponseSchema,
} from '../db/schemas/order/schemas.db';
import { createOrder, getOrder, getOrders } from '../services/order.services';

const orderRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/',
        {
            schema: {
                tags: ['Orders'],
                querystring: ordersGetRequestSchema,
                response: {
                    200: ordersGetResponseSchema,
                },
            },
        },
        async (request, reply) => {
            return reply.code(200).send(await getOrders(request.query));
        }
    );

    fastify.get(
        '/:id',
        {
            schema: {
                tags: ['Orders'],
                params: orderGetRequestSchema,
                response: {
                    200: orderGetResponseSchema,
                },
            },
        },
        async (request, reply) => {
            return reply.code(200).send(await getOrder(request.params));
        }
    );

    fastify.post(
        '/',
        {
            config: {
                rateLimit: {
                    max: 5,
                    timeWindow: '1 minute',
                    allowList: () => {
                        return process.env.NODE_ENV === 'test';
                    },
                },
            },
            schema: {
                tags: ['Orders'],
                body: orderCreateSchema,
                response: {
                    201: orderCreateResponseSchema,
                },
            },
        },
        async (request, reply) => {
            return reply.code(201).send(
                await createOrder(request.body, {
                    idempotencyKey: request.idempotencyKey!,
                })
            );
        }
    );
};

export default orderRoutes;
