import { and, eq } from 'drizzle-orm';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { db } from '../db';
import { buildConditions } from '../db/buildConditions';
import {
    eventCreateResponseSchema,
    eventCreateSchema,
    eventGetRequestSchema,
    eventGetResponseSchema,
    eventsGetRequestSchema,
    eventsGetResponseSchema,
} from '../db/schemas/event/schemas.db';
import { tableEvents } from '../db/schemas/event/table.db';

const eventRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/',
        {
            schema: {
                tags: ['Events'],
                querystring: eventsGetRequestSchema,
                response: { 200: eventsGetResponseSchema },
            },
        },
        async (request, reply) => {
            const conditions = buildConditions(tableEvents, request.query);

            return reply.code(200).send(
                await db
                    .select()
                    .from(tableEvents)
                    .where(and(...conditions))
            );
        }
    );

    fastify.get(
        '/:id',
        {
            schema: {
                tags: ['Events'],
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
                tags: ['Events'],
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
