import { FastifyPluginAsync } from 'fastify';

const ticketRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (request, reply) => {
        return { tickets: [] }; // Mock data for now, ready for a Drizzle query!
    });

    fastify.post('/', async (request, reply) => {
        return { message: 'Ticket created successfully 🦆' };
    });
};

export default ticketRoutes;
