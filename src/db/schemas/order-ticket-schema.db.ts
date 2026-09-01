import { pgTable, unique, uuid } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

import { tableOrders } from './order-schema.db';
import { tableTickets } from './ticket-schema.db';

// TABLES (and ENTITIES)

const orderTicket = {
    orderId: uuid('order_id')
        .references(() => tableOrders.id)
        .notNull(),
    ticketId: uuid('ticket_id')
        .references(() => tableTickets.id)
        .notNull(),
};
export const tableOrderTickets = pgTable('order_tickets', orderTicket, (t) => [
    unique('unique_ticket_order').on(t.ticketId),
]);

// TYPES

// - ORDER_TICKET

// -- OBJECT

export const orderTicketObjectSchema = createSelectSchema(tableOrderTickets);
export type OrderTicket = z.infer<typeof orderTicketObjectSchema>;

// -- CREATE

export const orderTicketCreateRequestSchema = createSelectSchema(tableOrderTickets);
export type OrderTicketCreateRequest = z.infer<typeof orderTicketCreateRequestSchema>;
