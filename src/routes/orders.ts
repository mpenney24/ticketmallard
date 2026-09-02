import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
    orderCreateResponseSchema,
    orderCreateSchema,
    orderGetRequestSchema,
    orderGetResponseSchema,
} from '../db/schemas/order-schema.db';
import { idempotencyHook } from '../hooks/idempotency.hook';
import { createOrder, getOrder } from '../services/order.services';

const orderRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/:id',
        {
            config: {
                rateLimit: {
                    max: 5,
                    timeWindow: '1 minute',
                },
            },
            schema: {
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
            schema: {
                body: orderCreateSchema,
                response: {
                    201: orderCreateResponseSchema,
                },
            },
            preHandler: [idempotencyHook],
        },
        async (request, reply) => {
            return reply.code(201).send(
                await createOrder(request.body, {
                    idempotencyKey: request.headers['idempotency-key'] as string,
                })
            );
        }
    );
};

export default orderRoutes;
