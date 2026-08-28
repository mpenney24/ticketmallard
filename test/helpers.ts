import { InjectOptions } from 'fastify';

import {
    CustomersGetResponse,
    EventCreateRequest,
    eventCreateSchema,
    EventObject,
    OrderCreateRequest,
    OrderObject,
    TICKET_STATUS,
    TicketCreateRequest,
    ticketCreateSchema,
    TicketObject,
} from '../src/db/schema';
import { getTestApp } from './setup';

// export function getTypedResponse<T>(response: Response): T {
//     return response.json as T;
// }

export async function typedInject<T>(opts: InjectOptions | string) {
    const response = await getTestApp().inject(opts);
    return {
        ...response,
        json: response.json() as T,
    };
}

export const FIXED_DATE = new Date('2026-09-01T12:00:00Z');
export const UNKNOWN_UUID = '00000000-0000-0000-0000-000000000000';

export const createNewEvent: EventCreateRequest = eventCreateSchema.parse({
    title: 'Duck Concert 2026',
    startTime: FIXED_DATE,
});

export const createNewTicket: (event: EventObject) => TicketCreateRequest = (event) =>
    ticketCreateSchema.parse({
        eventId: event.id,
        status: TICKET_STATUS.AVAILABLE,
    });

export const createTestEvent = async (payload: EventCreateRequest = createNewEvent) => {
    return (
        await typedInject<EventObject>({
            method: 'POST',
            url: '/api/events',
            payload,
        })
    ).json;
};

export const createTestTicket = async (opts?: {
    event?: EventObject;
    payload?: TicketCreateRequest;
}) => {
    const ticketEvent = opts?.event || (await createTestEvent());
    return (
        await typedInject<TicketObject>({
            method: 'POST',
            url: '/api/tickets',
            payload: {
                ...opts?.payload,
                eventId: ticketEvent.id,
            },
        })
    ).json;
};

export const createTestOrder = async (payload: OrderCreateRequest) => {
    return (
        await typedInject<OrderObject>({
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
