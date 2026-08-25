import { eq } from 'drizzle-orm';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { db } from '../db';
import { createTicketSchema, getTicketParamsSchema, tableTickets } from '../db/schema';

const ticketRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get('/', async () => {
        const tickets = await db.select().from(tableTickets);
        return { tickets };
    });

    fastify.get(
        '/:id',
        {
            schema: {
                params: getTicketParamsSchema,
            },
        },
        async (request, reply) => {
            const { id } = request.params;

            const [event] = await db
                .select()
                .from(tableTickets)
                .where(eq(tableTickets.id, id))
                .limit(1);

            if (!event) {
                return reply.status(404).send({ error: 'Event not found 🦆' });
            }

            return { event };
        }
    );

    fastify.post(
        '/',
        {
            schema: {
                body: createTicketSchema,
            },
        },
        async (request, reply) => {
            const [event] = await db
                .insert(tableTickets)
                .values(request.body)
                .returning();

            return reply.status(201).send({
                message: 'Ticket created successfully',
                event,
            });
        }
    );
};

export default ticketRoutes;
