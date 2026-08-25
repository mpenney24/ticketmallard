import { eq } from 'drizzle-orm';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { db } from '../db';
import { eventCreateSchema, eventGetParamsSchema, tableEvents } from '../db/schema';

const eventRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get('/', async () => {
        const events = await db.select().from(tableEvents);
        return { events };
    });

    fastify.get(
        '/:id',
        {
            schema: {
                params: eventGetParamsSchema,
            },
        },
        async (request, reply) => {
            const { id } = request.params;

            const [event] = await db
                .select()
                .from(tableEvents)
                .where(eq(tableEvents.id, id))
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
                body: eventCreateSchema,
            },
        },
        async (request, reply) => {
            const [event] = await db.insert(tableEvents).values(request.body).returning();

            return reply.status(201).send({
                message: 'Event created successfully 🦆',
                event,
            });
        }
    );
};

export default eventRoutes;
