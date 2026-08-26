import { eq } from 'drizzle-orm';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { db } from '../db';
import {
    tableTickets,
    ticketCreateResponseSchema,
    ticketCreateSchema,
    ticketGetRequestSchema,
    ticketGetResponseSchema,
    ticketsGetRequestSchema,
    ticketsGetResponseSchema,
} from '../db/schema';

const ticketRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/',
        {
            schema: {
                params: ticketsGetRequestSchema,
                response: { 200: ticketsGetResponseSchema },
            },
        },
        async () => {
            return await db.select().from(tableTickets);
        }
    );

    fastify.get(
        '/:id',
        {
            schema: {
                params: ticketGetRequestSchema,
                response: { 200: ticketGetResponseSchema },
            },
        },
        async (request, reply) => {
            const { id } = request.params;

            const [ticket] = await db
                .select()
                .from(tableTickets)
                .where(eq(tableTickets.id, id))
                .limit(1);

            if (!ticket) {
                return reply.notFound();
            }

            return ticket;
        }
    );

    fastify.post(
        '/',
        {
            schema: {
                body: ticketCreateSchema,
                response: { 201: ticketCreateResponseSchema },
            },
        },
        async (request) => {
            const [ticket] = await db
                .insert(tableTickets)
                .values(request.body)
                .returning();

            return ticket;
        }
    );
};

export default ticketRoutes;
