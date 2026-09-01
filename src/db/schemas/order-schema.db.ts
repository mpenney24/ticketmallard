import { sql } from 'drizzle-orm';
import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
    createInsertSchema,
    createSelectSchema,
    createUpdateSchema,
} from 'drizzle-orm/zod';
import z from 'zod';

import { tableCustomers } from './customer-schema.db';

// ENUMS

export enum ORDER_STATUS {
    PENDING = 'PENDING',
    EXPIRED = 'EXPIRED',
    PAID = 'PAID',
    FAILED = 'FAILED',
}
export const orderStatusEnum = pgEnum('order_status', ORDER_STATUS);

// TABLES (and ENTITIES)

const order = {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
        .references(() => tableCustomers.id)
        .notNull(),
    status: orderStatusEnum('status').default(ORDER_STATUS.PENDING).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').$onUpdate(() => sql`CURRENT_DATE`),
};
export const tableOrders = pgTable('orders', order);

// TYPES

// - ORDER

// -- OBJECT

export const orderObjectSchema = createSelectSchema(tableOrders);
export type Order = z.infer<typeof orderObjectSchema>;

// -- CREATE

const orderItemSchema = z.object({
    eventId: z.uuid('Event id format must be uuid'),
    gaTicketQuantity: z.number().int().nonnegative().default(0),
    seatedTicketIds: z.array(z.uuid('Ticket id format must be uuid')).default([]),
});

export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderItemsReservedByEvent = orderItemSchema
    .omit({ gaTicketQuantity: true, seatedTicketIds: true })
    .extend({
        orderTicketIds: z.array(z.uuid('Ticket id format must be uuid')).default([]),
    });
export type OrderItemsReservedByEvent = z.infer<typeof orderItemsReservedByEvent>;

export const orderCreateSchema = createInsertSchema(tableOrders)
    .omit({
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
    })
    .extend({
        orderItems: z
            .array(orderItemSchema)
            .min(1, 'Order must contain tickets for at least one event'),
    });
export type OrderCreateRequest = z.infer<typeof orderCreateSchema>;

export const orderCreateResponseSchema = orderObjectSchema;
export type OrderCreateResponse = z.infer<typeof orderCreateResponseSchema>;

// -- UPDATE

export const orderUpdateSchema = createUpdateSchema(tableOrders, {
    status: z.enum(ORDER_STATUS),
})
    .omit({
        createdAt: true,
        updatedAt: true,
        customerId: true,
    })
    .required();
export type OrderUpdateRequest = z.infer<typeof orderUpdateSchema>;

export const orderUpdateResponseSchema = orderObjectSchema.extend({
    updatedAt: z.date(),
});
export type OrderUpdateResponse = z.infer<typeof orderUpdateResponseSchema>;

// -- EXPIRE

export const orderExpireRequestSchema = orderUpdateSchema
    .extend({
        status: z.literal(ORDER_STATUS.EXPIRED).default(ORDER_STATUS.EXPIRED),
        orderItems: z.array(orderItemsReservedByEvent).nonempty(),
    })
    .required();
export type OrderExpireWebhookRequest = z.infer<typeof orderExpireRequestSchema>;

export const orderExpireResponseSchema = z.union([
    orderUpdateResponseSchema,
    z.object({
        success: z.boolean(),
        message: z.string(),
    }),
]);
export type OrderExpireWebhookResponse = z.infer<typeof orderExpireResponseSchema>;

// -- PAY

export const orderPaySchema = orderUpdateSchema
    .extend({
        status: z.literal(ORDER_STATUS.PAID).default(ORDER_STATUS.PAID),
    })
    .required();
export type OrderPayRequest = z.infer<typeof orderPaySchema>;

export const orderPayResponseSchema = z.union([
    orderObjectSchema.extend({
        updatedAt: z.date(),
    }),
    z.object({
        success: z.boolean(),
        message: z.string(),
    }),
]);
export type OrderPayResponse = z.infer<typeof orderPayResponseSchema>;

// -- COMPLETED

export const orderCompleteRequestSchema = createSelectSchema(tableOrders).pick({
    id: true,
});
export type OrderCompleteWebhookRequest = z.infer<typeof orderCompleteRequestSchema>;

export const orderCompleteResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
});
export type OrderCompleteWebhookResponse = z.infer<typeof orderCompleteResponseSchema>;

// -- GET/:id

export const orderGetRequestSchema = createSelectSchema(tableOrders).pick({ id: true });
export type OrderGetRequest = z.infer<typeof orderGetRequestSchema>;

export const orderGetResponseSchema = orderObjectSchema;
export type OrderGetResponse = z.infer<typeof orderGetResponseSchema>;
