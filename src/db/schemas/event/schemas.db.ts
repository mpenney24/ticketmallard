import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

import { tableEvents } from './table.db';

// OBJECT

export const eventTimestampedObjectSchema = createSelectSchema(tableEvents).extend({
    startDateTime: z.coerce.date(),
    createdAt: z.coerce.date(),
});
export type EventTimestamped = z.infer<typeof eventTimestampedObjectSchema>;

export const eventObjectSchema = eventTimestampedObjectSchema.omit({
    createdAt: true,
});
export type Event = z.infer<typeof eventObjectSchema>;

// -- CREATE

export const eventCreateSchema = createInsertSchema(tableEvents, {
    title: (schema) => schema.min(3, 'Title must be at least 3 characters long'),
    description: z.string().nullable().default(null),
    startDateTime: z.coerce.string(),
}).omit({
    id: true,
    description: true,
    createdAt: true,
});
export type EventCreateRequest = z.infer<typeof eventCreateSchema>;

export const eventCreateResponseSchema = eventTimestampedObjectSchema;
export type EventCreateResponse = z.infer<typeof eventCreateResponseSchema>;

// -- GET/:id

export const eventGetRequestSchema = eventObjectSchema.pick({ id: true });
export type EventGetRequest = z.infer<typeof eventGetRequestSchema>;

export const eventGetResponseSchema = eventTimestampedObjectSchema;
export type EventGetResponse = z.infer<typeof eventGetResponseSchema>;

// -- GET/

export const eventsGetRequestSchema = eventObjectSchema
    .pick({ id: true, title: true })
    .extend({
        startDateTime: z
            .string()
            .regex(/^\d{4}(-\d{2}(-\d{2}([ T]\d{2}:\d{2}:\d{2})?)?)?$/, {
                message:
                    'Invalid date format, use "YYYY", "YYYY-MM", "YYYY-MM-DD", or "YYYY-MM-DD HH:mm:ss"',
            })
            .optional(),
    })
    .partial();
export type EventsGetRequest = z.infer<typeof eventsGetRequestSchema>;

export const eventsGetResponseSchema = z.array(eventTimestampedObjectSchema);
export type EventsGetResponse = z.infer<typeof eventsGetResponseSchema>;
