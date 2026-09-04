import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const event = {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    startDateTime: timestamp('start_date_time', {
        mode: 'date',
        withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
        .notNull()
        .default(sql`now()`),
};
export const tableEvents = pgTable('events', event);
