import { createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

import { tableCustomers } from './table.db';

// OBJECT

export const customerTimestampedObjectSchema = createSelectSchema(tableCustomers);
export type CustomerTimestamped = z.infer<typeof customerTimestampedObjectSchema>;

export const customerObjectSchema = customerTimestampedObjectSchema.omit({
    createdAt: true,
});
export type Customer = z.infer<typeof customerObjectSchema>;

// -- GET/:id

export const customerGetRequestSchema = customerObjectSchema.pick({
    id: true,
});
export type CustomerGetRequest = z.infer<typeof customerGetRequestSchema>;

export const customerGetResponseSchema = customerObjectSchema;
export type CustomerGetResponse = z.infer<typeof customerGetResponseSchema>;

// -- GET/

export const customersGetRequestSchema = customerObjectSchema.partial();
export type CustomersGetRequest = z.infer<typeof customersGetRequestSchema>;

export const customersGetResponseSchema = z.array(customerObjectSchema);
export type CustomersGetResponse = z.infer<typeof customersGetResponseSchema>;
