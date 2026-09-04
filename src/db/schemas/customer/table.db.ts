import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const customer = {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
        .notNull()
        .default(sql`now()`),
};
export const tableCustomers = pgTable('customers', customer);
