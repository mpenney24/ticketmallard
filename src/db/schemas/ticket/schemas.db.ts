import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

import { tableTickets, TICKET_TYPE } from './table.db';

// OBJECT

export const ticketTimestampedObjectSchema = createSelectSchema(tableTickets).extend({
    createdAt: z.coerce.date(),
});
export type TicketTimestamped = z.infer<typeof ticketTimestampedObjectSchema>;

export const ticketObjectSchema = ticketTimestampedObjectSchema.omit({
    createdAt: true,
});
export type Ticket = z.infer<typeof ticketObjectSchema>;

// -- CREATE

export const ticketCreateSchema = createInsertSchema(tableTickets, {
    type: z.enum(TICKET_TYPE),
}).omit({
    id: true,
    createdAt: true,
});
export type TicketCreateRequest = z.infer<typeof ticketCreateSchema>;

export const ticketCreateResponseSchema = ticketTimestampedObjectSchema;
export type TicketCreateResponse = z.infer<typeof ticketCreateResponseSchema>;

// -- GET/:id

export const ticketGetRequestSchema = ticketObjectSchema.pick({ id: true });
export type TicketGetRequest = z.infer<typeof ticketGetRequestSchema>;

export const ticketGetResponseSchema = ticketTimestampedObjectSchema;
export type TicketGetResponse = z.infer<typeof ticketGetResponseSchema>;

// -- GET/

export const ticketsGetRequestSchema = ticketObjectSchema.partial();
export type TicketsGetRequest = z.infer<typeof ticketsGetRequestSchema>;

const gaTicketSchema = ticketObjectSchema
    .extend({
        type: z.literal(TICKET_TYPE.GA),
    })
    .omit({ id: true });

const standardTicketSchema = ticketTimestampedObjectSchema.extend({
    type: z.literal(TICKET_TYPE.SEATED),
});

export const ticketsGetResponseSchema = z.array(
    z.discriminatedUnion('type', [gaTicketSchema, standardTicketSchema])
);
export type TicketsGetResponse = z.infer<typeof ticketsGetResponseSchema>;
