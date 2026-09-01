import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
    orderCompleteRequestSchema,
    orderCompleteResponseSchema,
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
                    201: orderCompleteResponseSchema,
                },
            },
            preHandler: verifyQStashSignature,
        },
        async (request) => {
            const result = await completeOrder(request.body);

            if (result.success === false) {
                console.error(result.message);
            }

            return result;
        }
    );
};

export default orderCompleteRoutes;
