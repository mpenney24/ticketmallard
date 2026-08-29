import { eq } from 'drizzle-orm';

import { db } from '../db';
import {
    OrderCreateRequest,
    OrderGetRequest,
    OrderTicketCreateRequest,
    tableOrders,
    tableOrderTickets,
} from '../db/schema';
import {
    NotFoundError,
    ReservationError,
    SoldOutError,
    UnavailableError,
} from '../errors/domain.errors';
import * as redis from '../utils/redis';

export async function getOrder(request: OrderGetRequest) {
    const { id } = request;

    const [order] = await db
        .select()
        .from(tableOrders)
        .where(eq(tableOrders.id, id))
        .limit(1);

    if (!order) {
        throw new NotFoundError('Order');
    }

    return order;
}

export async function createOrder(request: OrderCreateRequest, idempotencyKey?: string) {
    const result = await redis.reserveMixedCart(
        request.eventId,
        request.gaQuantity,
        request.ticketIds
    );

    // Mitch - how to move this somewhere global? Throw in lua, perhaps?
    if (!result.success) {
        if (result.code === 'SEAT_UNAVAILABLE')
            throw new UnavailableError(
                'Ticket',
                `Seated ticket id ${result.ticketId} is taken`
            );
        if (result.code === 'GA_SOLD_OUT')
            throw new SoldOutError('General admission pool sold out');
        throw new ReservationError('Inventory reservation failed');
    }

    const ticketIds = result.data!;

    const order = await db.transaction(async (tx) => {
        const [order] = await tx
            .insert(tableOrders)
            .values({
                customerId: request.customerId,
            })
            .returning();

        const tickets: OrderTicketCreateRequest[] = ticketIds.map((ticketId) => ({
            orderId: order.id,
            ticketId,
        }));

        await tx.insert(tableOrderTickets).values(tickets);

        return order;
    });

    if (idempotencyKey) {
        await redis.setIdempotency(idempotencyKey, { statusCode: 201, body: order });
    }

    return order;
}
