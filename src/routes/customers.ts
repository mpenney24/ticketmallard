import { and, eq } from 'drizzle-orm';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { db } from '../db';
import { buildConditions } from '../db/buildConditions';
import {
    customerGetRequestSchema,
    customerGetResponseSchema,
    customersGetRequestSchema,
    customersGetResponseSchema,
} from '../db/schemas/customer/schemas.db';
import { tableCustomers } from '../db/schemas/customer/table.db';

const customerRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/',
        {
            schema: {
                tags: ['Customers'],
                querystring: customersGetRequestSchema,
                response: { 200: customersGetResponseSchema },
            },
        },
        async (request, reply) => {
            const conditions = buildConditions(tableCustomers, request.query);

            return reply.code(200).send(
                await db
                    .select()
                    .from(tableCustomers)
                    .where(conditions.length ? and(...conditions) : undefined)
            );
        }
    );

    fastify.get(
        '/:id',
        {
            schema: {
                tags: ['Customers'],
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
