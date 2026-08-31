import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { orderExpireResponseSchema, orderExpireSchema } from '../db/schema';
import { expireOrder } from '../services/order.services';

const orderExpireRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.post(
        '/',
        {
            schema: {
                body: orderExpireSchema,
                response: {
                    200: orderExpireResponseSchema,
                },
            },
        },
        async (request) => {
            console.log('--- QSTASH HIT /EXPIRE ---');
            console.log('Headers:', request.headers);
            console.log('Body:', request.body);
            return await expireOrder(request.body);
        }
    );
};

export default orderExpireRoutes;
