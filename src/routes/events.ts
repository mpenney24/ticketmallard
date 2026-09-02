import { eq } from 'drizzle-orm';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { db } from '../db';
import {
    eventCreateResponseSchema,
    eventCreateSchema,
    eventGetRequestSchema,
    eventGetResponseSchema,
    eventsGetRequestSchema,
    eventsGetResponseSchema,
    tableEvents,
} from '../db/schemas/event-schema.db';

const eventRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/',
        {
            schema: {
                params: eventsGetRequestSchema,
                response: { 200: eventsGetResponseSchema },
            },
        },
        async (request, reply) => {
            return reply.code(200).send(await db.select().from(tableEvents));
        }
    );

    fastify.get(
        '/:id',
        {
            schema: {
                params: eventGetRequestSchema,
                response: {
                    200: eventGetResponseSchema,
                },
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
                return reply.notFound();
            }

            return reply.code(200).send(event);
        }
    );

    fastify.post(
        '/',
        {
            schema: {
                body: eventCreateSchema,
                response: {
                    201: eventCreateResponseSchema,
                },
            },
        },
        async (request, reply) => {
            const [event] = await db.insert(tableEvents).values(request.body).returning();

            return reply.code(201).send(event);
        }
    );
};

export default eventRoutes;
