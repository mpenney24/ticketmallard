import { FastifyPluginAsync } from 'fastify';
import { db } from '../db';
// Assuming you have an events table defined in your schema:
// import { eventsTable } from '../db/schema';

const eventRoutes: FastifyPluginAsync = async (fastify) => {
    // GET /api/events - Fetch all events from Postgres
    fastify.get('/', async (request, reply) => {
        try {
            // Real Drizzle query example:
            // const allEvents = await db.select().from(eventsTable);
            // return { events: allEvents };

            return {
                events: [{ id: 1, title: 'Duck Concert 2026', date: '2026-12-01' }],
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch events' });
        }
    });

    // POST /api/events - Create a new event
    fastify.post('/', async (request, reply) => {
        const body = request.body as { title: string; date: string };

        try {
            // TODO: Insert into Drizzle eventsTable
            return reply.status(201).send({
                message: 'Event created successfully 🦆',
                event: body,
            });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to create event' });
        }
    });
};

export default eventRoutes;
