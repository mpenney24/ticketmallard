import { createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

import { tableOrderTickets } from './table.db';

// OBJECT

export const orderTicketObjectSchema = createSelectSchema(tableOrderTickets);
export type OrderTicket = z.infer<typeof orderTicketObjectSchema>;

// -- CREATE

export const orderTicketCreateRequestSchema = createSelectSchema(tableOrderTickets);
export type OrderTicketCreateRequest = z.infer<typeof orderTicketCreateRequestSchema>;
