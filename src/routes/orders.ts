import { eq } from 'drizzle-orm';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { db } from '../db';
import { redis } from '../db/redis';
import {
    orderCreateResponseSchema,
    orderCreateSchema,
    orderGetRequestSchema,
    orderGetResponseSchema,
    tableOrders,
} from '../db/schema';

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
        async (request, reply) => {
            const { id } = request.params;

            const [order] = await db
                .select()
                .from(tableOrders)
                .where(eq(tableOrders.id, id))
                .limit(1);

            if (!order) {
                return reply.notFound();
            }

            return order;
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
        },
        async (request, reply) => {
            const { ticketId } = request.body;
            const inventoryKey = `inventory:ticket:${ticketId}`;

            const result = await redis.reserveTicket(inventoryKey);

            if (result === 0) {
                return reply.conflict('Sold Out');
            }

            const [order] = await db.insert(tableOrders).values(request.body).returning();

            return order;
        }
    );
};

export default orderRoutes;
