import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
    orderPayResponse200Schema,
    orderPayResponse401Schema,
    orderPaySchema,
} from '../db/schemas/order/schemas.db';
import { payOrder } from '../services/order.services';

const orderPayRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.patch(
        '/',
        {
            schema: {
                tags: ['Orders'],
                body: orderPaySchema,
                response: {
                    200: orderPayResponse200Schema,
                    401: orderPayResponse401Schema,
                },
            },
        },
        async (request, reply) => {
            const result = await payOrder(request.body, {
                idempotencyKey: request.headers['idempotency-key'] as string,
            });

            if (result.success === false) {
                console.warn(result.message);
                return reply.code(401).send(result);
            }

            return reply.code(200).send(result);
        }
    );
};

export default orderPayRoutes;
