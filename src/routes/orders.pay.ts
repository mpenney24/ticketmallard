import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { orderPayResponseSchema, orderPaySchema } from '../db/schemas/order-schema.db';
import { payOrder } from '../services/order.services';

const orderPayRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.patch(
        '/',
        {
            schema: {
                body: orderPaySchema,
                response: {
                    204: orderPayResponseSchema,
                },
            },
        },
        async (request) => {
            const result = await payOrder(request.body, {
                idempotencyKey: request.headers['idempotency-key'] as string,
            });

            if ('success' in result && result.success === false) {
                console.warn(result.message);
            }

            return result;
        }
    );
};

export default orderPayRoutes;
