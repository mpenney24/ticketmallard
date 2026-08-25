import { date, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

export const nullToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
    z.preprocess((val) => (val === null ? undefined : val), schema.optional());

export const ticketStatusEnum = pgEnum('ticket_status', [
    'AVAILABLE',
    'RESERVED',
    'SOLD',
]);
export const orderStatusEnum = pgEnum('order_status', [
    'PENDING',
    'PAID',
    'EXPIRED',
    'FAILED',
]);

export const tableUsers = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at'),
});

const event = {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    startTime: timestamp('start_time').notNull(),
    createdAt: date('created_at').default(new Date().toISOString()),
};

export const tableEvents = pgTable('events', event);

const eventObject = createSelectSchema(tableEvents);

export type EventObjectType = z.infer<typeof eventObject>;

export const eventCreateSchema = createInsertSchema(tableEvents, {
    title: (schema) => schema.min(3, 'Title must be at least 3 characters long'),
    description: z.string().nullable().default(null),
    startTime: z.coerce.date(),
}).omit({
    id: true,
    createdAt: true,
});

export type EventCreateRequest = z.infer<typeof eventCreateSchema>;

export const eventCreateResponseSchema = z.object({
    message: z.string(),
    event: createInsertSchema(tableEvents),
});

export type EventCreateResponse = z.infer<typeof eventCreateResponseSchema>;

export const eventGetParamsSchema = createSelectSchema(tableEvents, {
    id: z.uuid('Event id format must be uuid'),
});

export type EventGetInput = z.infer<typeof eventGetParamsSchema>;

export const eventGetResponseSchema = z.object({
    event: eventObject,
});

export type EventGetResponse = z.infer<typeof eventGetResponseSchema>;

export const eventsGetResponseSchema = z.object({
    events: z.array(createSelectSchema(tableEvents)),
});

export type EventsGetResponse = z.infer<typeof eventsGetResponseSchema>;

export const tableTickets = pgTable('tickets', {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
        .references(() => tableEvents.id)
        .notNull(),
    status: ticketStatusEnum('status').default('AVAILABLE').notNull(),
    reservedBy: uuid('reserved_by').references(() => tableUsers.id),
    reservedUntil: timestamp('reserved_until'),
    createdAt: date('created_at').default(new Date().toISOString()),
});

export const createTicketSchema = createInsertSchema(tableTickets, {
    reservedUntil: z.coerce.date(),
}).omit({
    id: true,
    createdAt: true,
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const getTicketParamsSchema = z.object({
    id: z.uuid('Ticket id format must be uuid'),
});

export type GetTicketInput = z.infer<typeof getTicketParamsSchema>;

export const tableOrders = pgTable('orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
        .references(() => tableUsers.id)
        .notNull(),
    ticketId: uuid('ticket_id')
        .references(() => tableTickets.id)
        .notNull(),
    status: orderStatusEnum('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
