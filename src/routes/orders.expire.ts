import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
    orderExpireRequestSchema,
    orderExpireResponse200RunThroughSchema,
} from '../db/schemas/order-schema.db';
import { expireOrder } from '../services/order.services';
import { verifyQStashSignature } from '../utils/qstash';

const orderExpireRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.post(
        '/',
        {
            schema: {
                body: orderExpireRequestSchema,
                response: {
                    200: orderExpireResponse200RunThroughSchema,
                },
            },
            preHandler: verifyQStashSignature,
        },
        async (request, reply) => {
            const result = await expireOrder(request.body);

            if (result.success === false) {
                console.warn(result.message);
                // sending 200 instead of 401 as qstash will retry/DLQ it
                return reply.code(200).send(result);
            }

            return reply.code(200).send(result);
        }
    );
};

export default orderExpireRoutes;
