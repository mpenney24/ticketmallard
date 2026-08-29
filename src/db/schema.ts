import { sql } from 'drizzle-orm';
import {
    date,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

// ENUMS

export enum TICKET_STATUS {
    AVAILABLE = 'AVAILABLE',
    RESERVED = 'RESERVED',
    SOLD = 'SOLD',
}
export const ticketStatusEnum = pgEnum('ticket_status', TICKET_STATUS);

export enum TICKET_TYPE {
    GA = 'GA',
    SEATED = 'SEATED',
}
export const ticketTypeEnum = pgEnum('ticket_type', TICKET_TYPE);

export enum ORDER_STATUS {
    PENDING = 'PENDING',
    EXPIRED = 'EXPIRED',
    PAID = 'PAID',
    FAILED = 'FAILED',
}

export const orderStatusEnum = pgEnum('order_status', ORDER_STATUS);

// TABLES (and ENTITIES)

const customer = {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
};
export const tableCustomers = pgTable('customers', customer);

const event = {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    startTime: timestamp('start_time').notNull(),
    createdAt: date('created_at').default(sql`CURRENT_DATE`),
};
export const tableEvents = pgTable('events', event);

const ticket = {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
        .references(() => tableEvents.id)
        .notNull(),
    type: ticketTypeEnum('type').notNull(),
    status: ticketStatusEnum('status').default(TICKET_STATUS.AVAILABLE).notNull(),
    reservedBy: uuid('reserved_by').references(() => tableCustomers.id),
    reservedUntil: timestamp('reserved_until'),
    createdAt: date('created_at')
        .default(sql`CURRENT_DATE`)
        .notNull(),
};
export const tableTickets = pgTable('tickets', ticket);

const order = {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
        .references(() => tableCustomers.id)
        .notNull(),
    status: orderStatusEnum('status').default(ORDER_STATUS.PENDING).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
};
export const tableOrders = pgTable('orders', order);

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

// - ORDER

// -- CUSTOMER

export const customerObjectSchema = createSelectSchema(tableCustomers);
export type Customer = z.infer<typeof customerObjectSchema>;

// -- GET/:id

export const customerGetRequestSchema = createSelectSchema(tableCustomers).pick({
    id: true,
});
export type CustomerGetRequest = z.infer<typeof customerGetRequestSchema>;

export const customerGetResponseSchema = customerObjectSchema;
export type CustomerGetResponse = z.infer<typeof customerGetResponseSchema>;

// -- GET/

export const customersGetRequestSchema = createSelectSchema(tableCustomers).partial();
export type CustomersGetRequest = z.infer<typeof customersGetRequestSchema>;

export const customersGetResponseSchema = z.array(customerObjectSchema);
export type CustomersGetResponse = z.infer<typeof customersGetResponseSchema>;

// - EVENT

// -- OBJECT

export const eventObjectSchema = createSelectSchema(tableEvents);
export type Event = z.infer<typeof eventObjectSchema>;

// -- CREATE

export const eventCreateSchema = createInsertSchema(tableEvents, {
    title: (schema) => schema.min(3, 'Title must be at least 3 characters long'),
    description: z.string().nullable().default(null),
    startTime: z.coerce.date(),
}).omit({
    id: true,
    createdAt: true,
});
export type EventCreateRequest = z.infer<typeof eventCreateSchema>;

export const eventCreateResponseSchema = eventObjectSchema;
export type EventCreateResponse = z.infer<typeof eventCreateResponseSchema>;

// -- GET/:id

export const eventGetRequestSchema = createSelectSchema(tableEvents).pick({ id: true });
export type EventGetRequest = z.infer<typeof eventGetRequestSchema>;

export const eventGetResponseSchema = eventObjectSchema;
export type EventGetResponse = z.infer<typeof eventGetResponseSchema>;

// -- GET/

export const eventsGetRequestSchema = createSelectSchema(tableEvents).partial();
export type EventsGetRequest = z.infer<typeof eventsGetRequestSchema>;

export const eventsGetResponseSchema = z.array(eventObjectSchema);
export type EventsGetResponse = z.infer<typeof eventsGetResponseSchema>;

// - TICKET

// -- OBJECT

export const ticketObjectSchema = createSelectSchema(tableTickets);
export type Ticket = z.infer<typeof ticketObjectSchema>;

// -- CREATE

export const ticketCreateSchema = createInsertSchema(tableTickets, {
    type: () => z.enum(TICKET_TYPE),
    status: () => z.enum(TICKET_STATUS).optional(),
    reservedUntil: z.coerce.date().nullable().optional(),
})
    .omit({
        id: true,
        createdAt: true,
    })
    // Mitch - remove this, as this should be for ticket update! (done by Redis/Lua script?)
    .refine((data) => Boolean(data.reservedBy) === Boolean(data.reservedUntil), {
        message: 'reservedUntil and reservedBy must either both be set or both be empty',
        path: ['reservedUntil'],
    });
export type TicketCreateRequest = z.infer<typeof ticketCreateSchema>;

export const ticketCreateResponseSchema = ticketObjectSchema;
export type TicketCreateResponse = z.infer<typeof ticketCreateResponseSchema>;

// -- GET/:id

export const ticketGetRequestSchema = createSelectSchema(tableTickets).pick({ id: true });
export type TicketGetRequest = z.infer<typeof ticketGetRequestSchema>;

export const ticketGetResponseSchema = ticketObjectSchema;
export type TicketGetResponse = z.infer<typeof ticketGetResponseSchema>;

// -- GET/

export const ticketsGetRequestSchema = createSelectSchema(tableTickets).partial();
export type TicketsGetRequest = z.infer<typeof ticketsGetRequestSchema>;

export const ticketsGetResponseSchema = z.array(ticketObjectSchema);
export type TicketsGetResponse = z.infer<typeof ticketsGetResponseSchema>;

// - ORDER

// -- OBJECT

export const orderObjectSchema = createSelectSchema(tableOrders);
export type Order = z.infer<typeof orderObjectSchema>;

// -- CREATE

export const orderCreateSchema = createInsertSchema(tableOrders, {
    status: () => z.enum(ORDER_STATUS).optional(),
})
    .omit({
        id: true,
        createdAt: true,
    })
    .extend({
        eventId: z.uuid('Event id format must be uuid'),
        gaQuantity: z.number().int().nonnegative().default(0),
        ticketIds: z.array(z.uuid('Ticket id format must be uuid')).default([]),
    })
    .refine((data) => data.gaQuantity > 0 || data.ticketIds.length > 0, {
        message:
            'Cart must contain a number of general admission tickets, or seated ticket ids, or both',
    });

export type OrderCreateRequest = z.infer<typeof orderCreateSchema>;

export const orderCreateResponseSchema = orderObjectSchema;
export type OrderCreateResponse = z.infer<typeof orderCreateResponseSchema>;

// -- GET/:id

export const orderGetRequestSchema = createSelectSchema(tableOrders).pick({ id: true });
export type OrderGetRequest = z.infer<typeof orderGetRequestSchema>;

export const orderGetResponseSchema = orderObjectSchema;
export type OrderGetResponse = z.infer<typeof orderGetResponseSchema>;

// - ORDER_TICKET

// -- OBJECT

export const orderTicketObjectSchema = createSelectSchema(tableOrderTickets);
export type OrderTicket = z.infer<typeof orderTicketObjectSchema>;

// -- CREATE

export const orderTicketCreateRequestSchema = createSelectSchema(tableOrderTickets);
export type OrderTicketCreateRequest = z.infer<typeof orderTicketCreateRequestSchema>;
