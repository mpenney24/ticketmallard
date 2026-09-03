import z from 'zod';

import { createSelectSchema } from '../drizzleFactories';
import { tableCustomers } from './table.db';

// OBJECT

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

export const customersGetRequestSchema = createSelectSchema(tableCustomers)
    .omit({ createdAt: true })
    .partial();
export type CustomersGetRequest = z.infer<typeof customersGetRequestSchema>;

export const customersGetResponseSchema = z.array(customerObjectSchema);
export type CustomersGetResponse = z.infer<typeof customersGetResponseSchema>;
