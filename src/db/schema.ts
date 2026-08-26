import { date, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

// ENUMS

export enum TICKET_STATUS {
    AVAILABLE = 'AVAILABLE',
    RESERVED = 'RESERVED',
    SOLD = 'SOLD',
}
export const ticketStatusEnum = pgEnum('ticket_status', TICKET_STATUS);

export const orderStatusEnum = pgEnum('order_status', [
    'PENDING',
    'PAID',
    'EXPIRED',
    'FAILED',
]);

// TABLES (and ENTITIES)

const customer = {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
};
export const tableCustomers = pgTable('customers', customer);

const event = {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    startTime: timestamp('start_time').notNull(),
    createdAt: date('created_at').default(new Date().toISOString()),
};
export const tableEvents = pgTable('events', event);

const ticket = {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
        .references(() => tableEvents.id)
        .notNull(),
    status: ticketStatusEnum('status').default(TICKET_STATUS.AVAILABLE).notNull(),
    reservedBy: uuid('reserved_by').references(() => tableCustomers.id),
    reservedUntil: timestamp('reserved_until'),
    createdAt: date('created_at').default(new Date().toISOString()).notNull(),
};
export const tableTickets = pgTable('tickets', ticket);

const order = {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
        .references(() => tableCustomers.id)
        .notNull(),
    ticketId: uuid('ticket_id')
        .references(() => tableTickets.id)
        .notNull(),
    status: orderStatusEnum('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
};
export const tableOrders = pgTable('orders', order);

// TYPES

// - EVENT

// -- OBJECT

export const eventObjectSchema = createSelectSchema(tableEvents);
export type EventObject = z.infer<typeof eventObjectSchema>;

// -- CREATE

export const eventCreateSchema = createInsertSchema(tableEvents, {
    title: (schema) => schema.min(3, 'Title must be at least 3 characters long'),
    description: z.string().nullable().default(null),
    startTime: z.coerce.date(),
}).omit({
    id: true,
    createdAt: true,
});
export type EventCreateRequest = z.infer<typeof eventCreateSchema>;

export const eventCreateResponseSchema = eventObjectSchema;
export type EventCreateResponse = z.infer<typeof eventCreateResponseSchema>;

// -- GET/:id

export const eventGetRequestSchema = createSelectSchema(tableEvents)
    .pick({ id: true })
    .extend({
        id: z.uuid('Event id format must be uuid'),
    });
export type EventGetRequest = z.infer<typeof eventGetRequestSchema>;

export const eventGetResponseSchema = eventObjectSchema;
export type EventGetResponse = z.infer<typeof eventGetResponseSchema>;

// -- GET/

export const eventsGetRequestSchema = createSelectSchema(tableEvents).partial();
export type EventsGetRequest = z.infer<typeof eventsGetRequestSchema>;

export const eventsGetResponseSchema = z.array(eventObjectSchema);
export type EventsGetResponse = z.infer<typeof eventsGetResponseSchema>;

// - TICKET

// -- OBJECT

export const ticketObjectSchema = createSelectSchema(tableTickets);
export type TicketObject = z.infer<typeof ticketObjectSchema>;

// -- CREATE

export const ticketCreateSchema = createInsertSchema(tableTickets, {
    reservedUntil: z.coerce.date().nullable().optional(),
    status: () => z.enum(TICKET_STATUS).optional(),
})
    .omit({
        id: true,
        createdAt: true,
    })
    .refine((data) => Boolean(data.reservedBy) === Boolean(data.reservedUntil), {
        message: 'reservedUntil and reservedBy must either both be set or both be empty',
        path: ['reservedUntil'],
    });
export type TicketCreateRequest = z.infer<typeof ticketCreateSchema>;

export const ticketCreateResponseSchema = ticketObjectSchema;
export type TicketCreateResponse = z.infer<typeof ticketCreateResponseSchema>;

// -- GET/:id

export const ticketGetRequestSchema = createSelectSchema(tableTickets)
    .pick({ id: true })
    .extend({
        id: z.uuid('Ticket id format must be uuid'),
    });
export type TicketGetRequest = z.infer<typeof ticketGetRequestSchema>;

export const ticketGetResponseSchema = ticketObjectSchema;
export type TicketGetResponse = z.infer<typeof ticketGetResponseSchema>;

// -- GET/

export const ticketsGetRequestSchema = createSelectSchema(tableTickets).partial();
export type TicketsGetRequest = z.infer<typeof ticketsGetRequestSchema>;

export const ticketsGetResponseSchema = z.array(ticketObjectSchema);
export type TicketsGetResponse = z.infer<typeof ticketsGetResponseSchema>;
