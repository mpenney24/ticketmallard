import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
    orderCompleteRequestSchema,
    orderCompleteResponse200Schema,
} from '../db/schemas/order-schema.db';
import { completeOrder } from '../services/order.services';
import { verifyQStashSignature } from '../utils/qstash';

const orderCompleteRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.post(
        '/',
        {
            schema: {
                body: orderCompleteRequestSchema,
                response: {
                    201: orderCompleteResponse200Schema,
                },
            },
            preHandler: verifyQStashSignature,
        },
        async (request, reply) => {
            const result = await completeOrder(request.body);

            return reply.code(201).send(result);
        }
    );
};

export default orderCompleteRoutes;
