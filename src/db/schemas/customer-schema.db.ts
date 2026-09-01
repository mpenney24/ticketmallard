import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

// TABLES (and ENTITIES)

const customer = {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
};
export const tableCustomers = pgTable('customers', customer);

// TYPES

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
