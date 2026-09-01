import { sql } from 'drizzle-orm';
import { date, pgEnum, pgTable, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

import { tableEvents } from './event-schema.db';

// ENUMS

export enum TICKET_STATUS {
    AVAILABLE = 'AVAILABLE',
    RESERVED = 'RESERVED',
    SOLD = 'SOLD',
}

export enum TICKET_TYPE {
    GA = 'GA',
    SEATED = 'SEATED',
}
export const ticketTypeEnum = pgEnum('ticket_type', TICKET_TYPE);

// TABLES (and ENTITIES)

const ticket = {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
        .references(() => tableEvents.id)
        .notNull(),
    type: ticketTypeEnum('type').notNull(),
    createdAt: date('created_at')
        .default(sql`CURRENT_DATE`)
        .notNull(),
};
export const tableTickets = pgTable('tickets', ticket);

// TYPES

// - TICKET

// -- OBJECT

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

export const ticketsGetRequestSchema = createSelectSchema(tableTickets).partial();
export type TicketsGetRequest = z.infer<typeof ticketsGetRequestSchema>;

export const ticketsGetResponseSchema = z.array(ticketObjectSchema);
export type TicketsGetResponse = z.infer<typeof ticketsGetResponseSchema>;
