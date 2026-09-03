import z from 'zod';

import { createInsertSchema, createSelectSchema } from '../drizzleFactories';
import { tableEvents } from './table.db';

// OBJECT

export const eventObjectSchema = createSelectSchema(tableEvents);
export type Event = z.infer<typeof eventObjectSchema>;

// -- CREATE

export const eventCreateSchema = createInsertSchema(tableEvents, {
    title: (schema) => schema.min(3, 'Title must be at least 3 characters long'),
    description: z.string().nullable().default(null),
}).omit({
    id: true,
    description: true,
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

export const eventsGetRequestSchema = createSelectSchema(tableEvents)
    .omit({ description: true, createdAt: true })
    .partial();
export type EventsGetRequest = z.infer<typeof eventsGetRequestSchema>;

export const eventsGetResponseSchema = z.array(eventObjectSchema);
export type EventsGetResponse = z.infer<typeof eventsGetResponseSchema>;
