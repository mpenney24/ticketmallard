import { eq } from 'drizzle-orm';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { db } from '../db';
import {
    customerGetRequestSchema,
    customerGetResponseSchema,
    customersGetRequestSchema,
    customersGetResponseSchema,
    tableCustomers,
} from '../db/schemas/customer-schema.db';

const customerRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/',
        {
            schema: {
                params: customersGetRequestSchema,
                response: { 200: customersGetResponseSchema },
            },
        },
        async (request, reply) => {
            return reply.code(200).send(await db.select().from(tableCustomers));
        }
    );

    fastify.get(
        '/:id',
        {
            schema: {
                params: customerGetRequestSchema,
                response: {
                    200: customerGetResponseSchema,
                },
            },
        },
        async (request, reply) => {
            const { id } = request.params;

            const [customer] = await db
                .select()
                .from(tableCustomers)
                .where(eq(tableCustomers.id, id))
                .limit(1);

            if (!customer) {
                return reply.notFound();
            }

            return reply.code(200).send(customer);
        }
    );
};

export default customerRoutes;
