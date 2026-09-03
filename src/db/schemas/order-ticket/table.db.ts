import { pgTable, unique, uuid } from 'drizzle-orm/pg-core';

import { tableOrders } from '../order/table.db';
import { tableTickets } from '../ticket/table.db';

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
