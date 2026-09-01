import { InjectOptions } from 'fastify';

import { CustomersGetResponse } from '../src/db/schemas/customer-schema.db';
import {
    Event,
    EventCreateRequest,
    eventCreateSchema,
} from '../src/db/schemas/event-schema.db';
import { Order, OrderCreateRequest } from '../src/db/schemas/order-schema.db';
import {
    Ticket,
    TICKET_TYPE,
    TicketCreateRequest,
} from '../src/db/schemas/ticket-schema.db';
import { getTestApp } from './setup';

export async function typedInject<T>(opts: InjectOptions | string) {
    const response = await getTestApp().inject(opts);
    return {
        ...response,
        json: response.json() as T,
    };
}

export const FIXED_DATE = new Date('2026-09-01T12:00:00Z');
export const UNKNOWN_UUID = '00000000-0000-0000-0000-000000000000';

export async function waitUntil(
    condition: () => Promise<boolean>,
    timeoutMs = 5000,
    intervalMs = 1000
): Promise<void> {
    const start = performance.now();
    console.log('Starting wait for callback:');

    while (performance.now() - start < timeoutMs) {
        if (await condition()) return;
        console.log('Waiting...');
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Condition timed out');
}

export const createNewEvent: EventCreateRequest = eventCreateSchema.parse({
    title: 'Duck Concert 2026',
    startTime: FIXED_DATE,
});

export const createNewTicket: (event: Event) => TicketCreateRequest = (event) => {
    const payload = {
        eventId: event.id,
        type: TICKET_TYPE.GA,
    } satisfies TicketCreateRequest;

    return payload;
};

export const createTestEvent = async (payload: EventCreateRequest = createNewEvent) => {
    return (
        await typedInject<Event>({
            method: 'POST',
            url: '/api/events',
            payload,
        })
    ).json;
};

export const createTestTicket = async (request?: Partial<TicketCreateRequest>) => {
    const eventId = request?.eventId || (await createTestEvent()).id;
    const type = request?.type || TICKET_TYPE.SEATED;
    const payload: TicketCreateRequest = {
        eventId,
        type,
    };
    return (
        await typedInject<Ticket>({
            method: 'POST',
            url: '/api/tickets',
            payload,
        })
    ).json;
};

export const createTestOrder = async (payload: OrderCreateRequest) => {
    return (
        await typedInject<Order>({
            method: 'POST',
            url: '/api/orders',
            payload,
        })
    ).json;
};

export const getTestCustomer = async (index: number) => {
    return (
        await typedInject<CustomersGetResponse>({
            method: 'GET',
            url: '/api/customers',
        })
    ).json[index];
};
