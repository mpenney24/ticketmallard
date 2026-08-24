import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at'),
});

export const events = pgTable('events', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    startTime: timestamp('start_time').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tickets = pgTable('tickets', {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
        .references(() => events.id)
        .notNull(),
    status: ticketStatusEnum('status').default('AVAILABLE').notNull(),
    reservedBy: uuid('reserved_by').references(() => users.id),
    reservedUntil: timestamp('reserved_until'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
        .references(() => users.id)
        .notNull(),
    ticketId: uuid('ticket_id')
        .references(() => tickets.id)
        .notNull(),
    status: orderStatusEnum('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
