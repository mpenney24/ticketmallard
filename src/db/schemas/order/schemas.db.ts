import {
    createInsertSchema,
    createSelectSchema,
    createUpdateSchema,
} from 'drizzle-orm/zod';
import z from 'zod';

import { ORDER_STATUS, tableOrders } from './table.db';

// OBJECT

export const orderTimestampedObjectSchema = createSelectSchema(tableOrders).extend({
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});
export type OrderTimestamped = z.infer<typeof orderTimestampedObjectSchema>;

export const orderObjectSchema = orderTimestampedObjectSchema.omit({
    createdAt: true,
    updatedAt: true,
});
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

export const orderCreateResponseSchema = orderTimestampedObjectSchema.required();
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

export const orderUpdateResponseSchema = orderTimestampedObjectSchema.required();
export type OrderUpdateResponse = z.infer<typeof orderUpdateResponseSchema>;

// -- EXPIRE

export const orderExpireRequestSchema = orderUpdateSchema
    .extend({
        status: z.literal(ORDER_STATUS.EXPIRED).default(ORDER_STATUS.EXPIRED),
        orderItems: z.array(orderItemsReservedByEvent).nonempty(),
    })
    .required();
export type OrderExpireWebhookRequest = z.infer<typeof orderExpireRequestSchema>;

export const orderExpireResponse200Schema = z.object({
    success: z.literal(true),
});
export const orderExpireResponse409Schema = orderExpireResponse200Schema.extend({
    success: z.literal(false),
    message: z.string(),
});
export const orderExpireResponse200RunThroughSchema = z.union([
    orderExpireResponse200Schema,
    orderExpireResponse409Schema,
]);
export type OrderExpireWebhookResponse = z.infer<
    typeof orderExpireResponse200RunThroughSchema
>;

// -- PAY

export const orderPaySchema = orderUpdateSchema
    .extend({
        status: z.literal(ORDER_STATUS.PAID).default(ORDER_STATUS.PAID),
    })
    .required();
export type OrderPayRequest = z.infer<typeof orderPaySchema>;

export const orderPayResponse200Schema = z.object({
    success: z.literal(true),
});
export const orderPayResponse409Schema = orderPayResponse200Schema.extend({
    success: z.literal(false),
    message: z.string(),
});
export type OrderPayResponse =
    z.infer<typeof orderPayResponse200Schema> | z.infer<typeof orderPayResponse409Schema>;

// -- COMPLETED

export const orderCompleteRequestSchema = orderObjectSchema.pick({
    id: true,
});
export type OrderCompleteWebhookRequest = z.infer<typeof orderCompleteRequestSchema>;

export const orderCompleteResponse200Schema = z.object({
    success: z.literal(true),
    message: z.string().optional(),
});
export type OrderCompleteWebhookResponse = z.infer<typeof orderCompleteResponse200Schema>;

// -- GET/:id

export const orderGetRequestSchema = orderObjectSchema.pick({ id: true });
export type OrderGetRequest = z.infer<typeof orderGetRequestSchema>;

export const orderGetResponseSchema = orderTimestampedObjectSchema;
export type OrderGetResponse = z.infer<typeof orderGetResponseSchema>;

// -- GET

export const ordersGetRequestSchema = orderObjectSchema.partial();
export type OrdersGetRequest = z.infer<typeof ordersGetRequestSchema>;

export const ordersGetResponseSchema = z.array(
    orderTimestampedObjectSchema
        .extend({
            orderTicketIds: z.array(z.uuid()),
        })
        .required()
);
export type OrdersGetResponse = z.infer<typeof ordersGetResponseSchema>;
