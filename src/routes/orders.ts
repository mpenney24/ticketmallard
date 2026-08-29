import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
    orderCreateResponseSchema,
    orderCreateSchema,
    orderGetRequestSchema,
    orderGetResponseSchema,
} from '../db/schema';
import { idempotencyHook } from '../hooks/idempotency.hook';
import { createOrder, getOrder } from '../services/order.services';

const orderRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/:id',
        {
            schema: {
                params: orderGetRequestSchema,
                response: {
                    200: orderGetResponseSchema,
                },
            },
        },
        async (request) => {
            return await getOrder(request.params);
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
        async (request) => {
            return await createOrder(
                request.body,
                request.headers['idempotency-key'] as string
            );
        }
    );
};

export default orderRoutes;
