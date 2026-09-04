import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tableCustomers } from '../customer/table.db';

export enum ORDER_STATUS {
    PENDING = 'PENDING',
    EXPIRED = 'EXPIRED',
    PAID = 'PAID',
    FAILED = 'FAILED',
}
export const orderStatusEnum = pgEnum('order_status', ORDER_STATUS);

const order = {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
        .references(() => tableCustomers.id)
        .notNull(),
    status: orderStatusEnum('status').default(ORDER_STATUS.PENDING).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).$onUpdate(
        () => new Date()
    ),
};
export const tableOrders = pgTable('orders', order);
