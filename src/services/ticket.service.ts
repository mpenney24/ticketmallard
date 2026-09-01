import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { buildConditions } from '../db/buildConditions';
import {
    tableTickets,
    TicketCreateRequest,
    TicketGetRequest,
    TicketsGetRequest,
} from '../db/schemas/ticket-schema.db';
import { NotFoundError } from '../errors/domain.errors';
import * as redis from '../utils/redis';

export async function getTicket(request: TicketGetRequest) {
    const { id } = request;

    const [ticket] = await db
        .select()
        .from(tableTickets)
        .where(eq(tableTickets.id, id))
        .limit(1);

    if (!ticket) {
        throw new NotFoundError('Ticket');
    }

    return ticket;
}

export async function getTickets(request: TicketsGetRequest) {
    const conditions = buildConditions(tableTickets, request);

    return await db
        .select()
        .from(tableTickets)
        .where(and(...conditions));
}

export async function createTicket(
    request: TicketCreateRequest,
    idempotencyKey?: string
) {
    const [ticket] = await db.insert(tableTickets).values(request).returning();

    if (idempotencyKey) {
        await redis.setIdempotency(idempotencyKey, { statusCode: 201, body: ticket });
    }

    return ticket;
}
