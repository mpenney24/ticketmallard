import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tableEvents } from '../event/table.db';

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

const ticket = {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
        .references(() => tableEvents.id)
        .notNull(),
    type: ticketTypeEnum('type').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
        .notNull()
        .defaultNow(),
};
export const tableTickets = pgTable('tickets', ticket);
