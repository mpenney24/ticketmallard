import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { buildConditions } from '../db/buildConditions';
import {
    TicketCreateRequest,
    TicketGetRequest,
    TicketsGetRequest,
} from '../db/schemas/ticket/schemas.db';
import { tableTickets, TICKET_TYPE } from '../db/schemas/ticket/table.db';
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
        .where(conditions.length ? and(...conditions) : undefined);
}

export async function createTicket(request: TicketCreateRequest) {
    const [ticket] = await db.insert(tableTickets).values(request).returning();

    await addTicketToRedis(request.eventId, ticket.id, ticket.type);

    return ticket;
}

async function addTicketToRedis(
    eventId: string,
    ticketId: string,
    ticketType: TICKET_TYPE
) {
    await redis.addTicketToRedis(eventId, ticketId, ticketType);
}
