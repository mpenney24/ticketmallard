import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
    ticketCreateResponseSchema,
    ticketCreateSchema,
    ticketGetRequestSchema,
    ticketGetResponseSchema,
    ticketsGetRequestSchema,
    ticketsGetResponseSchema,
} from '../db/schemas/ticket/schemas.db';
import { createTicket, getTicket, getTickets } from '../services/ticket.service';

const ticketRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/',
        {
            schema: {
                tags: ['Tickets'],
                querystring: ticketsGetRequestSchema,
                response: { 200: ticketsGetResponseSchema },
            },
        },
        async (request, reply) => {
            return reply.code(200).send(await getTickets(request.query));
        }
    );

    fastify.get(
        '/:id',
        {
            schema: {
                tags: ['Tickets'],
                params: ticketGetRequestSchema,
                response: { 200: ticketGetResponseSchema },
            },
        },
        async (request, reply) => {
            return reply.code(200).send(await getTicket(request.params));
        }
    );

    fastify.post(
        '/',
        {
            schema: {
                tags: ['Tickets'],
                body: ticketCreateSchema,
                response: { 201: ticketCreateResponseSchema },
            },
        },
        async (request, reply) => {
            return reply.code(201).send(await createTicket(request.body));
        }
    );
};

export default ticketRoutes;
