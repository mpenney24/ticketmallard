import { sql } from 'drizzle-orm';
import { date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

// TABLES (and ENTITIES)

const event = {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    startTime: timestamp('start_time').notNull(),
    createdAt: date('created_at').default(sql`CURRENT_DATE`),
};
export const tableEvents = pgTable('events', event);

// TYPES

// - EVENT

// -- OBJECT

export const eventObjectSchema = createSelectSchema(tableEvents);
export type Event = z.infer<typeof eventObjectSchema>;

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

export const eventGetRequestSchema = createSelectSchema(tableEvents).pick({ id: true });
export type EventGetRequest = z.infer<typeof eventGetRequestSchema>;

export const eventGetResponseSchema = eventObjectSchema;
export type EventGetResponse = z.infer<typeof eventGetResponseSchema>;

// -- GET/

export const eventsGetRequestSchema = createSelectSchema(tableEvents).partial();
export type EventsGetRequest = z.infer<typeof eventsGetRequestSchema>;

export const eventsGetResponseSchema = z.array(eventObjectSchema);
export type EventsGetResponse = z.infer<typeof eventsGetResponseSchema>;
