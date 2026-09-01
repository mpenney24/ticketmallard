import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
    orderExpireRequestSchema,
    orderExpireResponseSchema,
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
                    200: orderExpireResponseSchema,
                },
            },
            preHandler: verifyQStashSignature,
        },
        async (request) => {
            const result = await expireOrder(request.body);

            if ('success' in result && result.success === false) {
                console.warn(result.message);
            }

            return result;
        }
    );
};

export default orderExpireRoutes;
