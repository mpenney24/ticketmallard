import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
    ticketCreateResponseSchema,
    ticketCreateSchema,
    ticketGetRequestSchema,
    ticketGetResponseSchema,
    ticketsGetRequestSchema,
    ticketsGetResponseSchema,
} from '../db/schema';
import { createTicket, getTicket, getTickets } from '../services/ticket.service';

const ticketRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/',
        {
            schema: {
                params: ticketsGetRequestSchema,
                response: { 200: ticketsGetResponseSchema },
            },
        },
        async (request) => {
            return await getTickets(request.params);
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
        async (request) => {
            return await getTicket(request.params);
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
            return await createTicket(request.body);
        }
    );
};

export default ticketRoutes;
