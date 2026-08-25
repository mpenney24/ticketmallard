import { Response } from 'light-my-request';

import { EventCreateRequest } from '../src/db/schema';

export const FIXED_DATE = new Date('2026-09-01T12:00:00Z');

export function getJsonResponse<T>(response: Response): T {
    return response.json() as T;
}

export const testEvent: EventCreateRequest = {
    title: 'Pond Party 2026',
    description: 'The biggest flash sale of the year.',
    startTime: FIXED_DATE,
};
