import { createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

import { createInsertSchema } from '../drizzleFactories';
import { tableTickets, TICKET_TYPE } from './table.db';

// OBJECT

export const ticketObjectSchema = createSelectSchema(tableTickets);
export type Ticket = z.infer<typeof ticketObjectSchema>;

// -- CREATE

export const ticketCreateSchema = createInsertSchema(tableTickets, {
    type: z.enum(TICKET_TYPE),
}).omit({
    id: true,
    createdAt: true,
});
export type TicketCreateRequest = z.infer<typeof ticketCreateSchema>;

export const ticketCreateResponseSchema = ticketObjectSchema;
export type TicketCreateResponse = z.infer<typeof ticketCreateResponseSchema>;

// -- GET/:id

export const ticketGetRequestSchema = createSelectSchema(tableTickets).pick({ id: true });
export type TicketGetRequest = z.infer<typeof ticketGetRequestSchema>;

export const ticketGetResponseSchema = ticketObjectSchema;
export type TicketGetResponse = z.infer<typeof ticketGetResponseSchema>;

// -- GET/

export const ticketsGetRequestSchema = createSelectSchema(tableTickets)
    .omit({ createdAt: true })
    .partial();
export type TicketsGetRequest = z.infer<typeof ticketsGetRequestSchema>;

const gaTicketSchema = ticketObjectSchema
    .extend({
        type: z.literal(TICKET_TYPE.GA),
    })
    .omit({ id: true });

const standardTicketSchema = ticketObjectSchema.extend({
    type: z.literal(TICKET_TYPE.SEATED),
});

export const ticketsGetResponseSchema = z.array(
    z.discriminatedUnion('type', [gaTicketSchema, standardTicketSchema])
);
export type TicketsGetResponse = z.infer<typeof ticketsGetResponseSchema>;
