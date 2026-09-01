import Redis from 'ioredis';

import {
    ReservationError,
    SoldOutError,
    UnavailableError,
} from '../errors/domain.errors';

export interface CachedData {
    statusCode: number;
    body: unknown;
}

interface ReservationResult {
    success: boolean;
    data: string[];
}

interface ReleaseResult {
    success: boolean;
}

export const CacheKeys = {
    gaPool: (eventId: string) => `{event:${eventId}}:tickets:ga` as const,
    seatedTicket: (eventId: string, ticketId: string) =>
        `{event:${eventId}}:seat:${ticketId}` as const,
    lock: (id: string) => `lock:${id}` as const,
    idempotency: (key: string) => `idempotency:${key}` as const,
};

export type CacheKey = ReturnType<(typeof CacheKeys)[keyof typeof CacheKeys]>;

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
});

redis.defineCommand('reserveMixedCart', {
    numberOfKeys: 1,
    lua: `
        local gaPoolKey = KEYS[1]
        local eventId = ARGV[1]
        local gaQty = tonumber(ARGV[2])
        local seatedIds = {}

        for i = 3, #ARGV do
            table.insert(seatedIds, ARGV[i])
        end

        local acquiredIds = {}

        -- 1. Process GA tickets
        if gaQty > 0 then
            local currentAvailable = redis.call('scard', gaPoolKey)
            
            if currentAvailable < gaQty then
                return cjson.encode({ success = false, code = "GA_SOLD_OUT" })
            end

            for i = 1, gaQty do
                local gaId = redis.call('spop', gaPoolKey)
                table.insert(acquiredIds, gaId)
            end
        end

        -- 2. Process Seated tickets
        for _, ticketId in ipairs(seatedIds) do
            local seatKey = "{event:" .. eventId .. "}:seat:" .. ticketId
            local status = redis.call('get', seatKey)
            
            if status and status ~= "AVAILABLE" then
                -- Rollback GA tickets if a seat fails
                for _, id in ipairs(acquiredIds) do
                    redis.call('sadd', gaPoolKey, id)
                end
                return cjson.encode({ success = false, code = "SEAT_UNAVAILABLE", ticketId = ticketId })
            end
            
            redis.call('set', seatKey, "RESERVED")
            table.insert(acquiredIds, ticketId)
        end

        return cjson.encode({ success = true, data = acquiredIds })
    `,
});

export async function reserveMixedCart(
    eventId: string,
    gaQuantity: number,
    seatedTicketIds: string[]
): Promise<ReservationResult> {
    const gaPoolKey = CacheKeys.gaPool(eventId);

    // @ts-ignore - ioredis dynamic command typing
    const rawResult: string = await redis.reserveMixedCart(
        gaPoolKey,
        eventId,
        gaQuantity,
        ...seatedTicketIds
    );

    const result = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;

    if (!result.success) {
        if (result.code === 'SEAT_UNAVAILABLE')
            throw new UnavailableError(
                'Ticket',
                `Seated ticket id ${result.ticketId} is taken`
            );
        if (result.code === 'GA_SOLD_OUT')
            throw new SoldOutError(`General admission pool for ${eventId} sold out`);
        throw new ReservationError(`Inventory reservation failed for ${eventId}`);
    }

    return result;
}

redis.defineCommand('releaseMixedCart', {
    numberOfKeys: 1,
    lua: `
        local gaPoolKey = KEYS[1]
        local eventId = ARGV[1]
        
        for i = 2, #ARGV do
            local ticketId = ARGV[i]
            local seatKey = "{event:" .. eventId .. "}:seat:" .. ticketId
            
            -- 1. Check if this ticket ID matches a seated ticket key pattern
            local seatExists = redis.call('exists', seatKey)
            
            if seatExists == 1 then
                redis.call('set', seatKey, "AVAILABLE")
            else
                -- 2. Otherwise, return it to GA pool
                redis.call('sadd', gaPoolKey, ticketId)
            end
        end
        
        return cjson.encode({ success = true })
    `,
});

export async function releaseMixedCart(
    eventId: string,
    orderTicketIds: string[]
): Promise<ReservationResult> {
    const gaPoolKey = CacheKeys.gaPool(eventId);

    // @ts-ignore - ioredis dynamic command typing
    const rawResult: string = await redis.releaseMixedCart(
        gaPoolKey,
        eventId,
        ...orderTicketIds
    );

    return typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
}

redis.defineCommand('markTicketsAsSold', {
    numberOfKeys: 1,
    lua: `
        local gaPoolKey = KEYS[1]
        local eventId = ARGV[1]
        
        for i = 2, #ARGV do
            local ticketId = ARGV[i]
            local seatKey = "{event:" .. eventId .. "}:seat:" .. ticketId
            
            -- 1. Check if this ticket ID matches a seated ticket key pattern
            local currentStatus = redis.call('get', seatKey)
            
            if currentStatus == "RESERVED" then
                redis.call('set', seatKey, "SOLD")
            end
            
            -- 2. GA tickets were already popped from gaPoolKey during
            --    reserveMixedCart, so they are already out of inventory
        end
        
        return cjson.encode({ success = true })
    `,
});

export async function markTicketsAsSold(
    eventId: string,
    orderTicketIds: string[]
): Promise<{ success: boolean }> {
    const gaPoolKey = CacheKeys.gaPool(eventId);

    // @ts-ignore - ioredis dynamic command typing
    const rawResult: string = await redis.markTicketsAsSold(
        gaPoolKey,
        eventId,
        ...orderTicketIds
    );

    return typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
}

export async function setByKey(key: CacheKey, value: string | Buffer | number) {
    await redis.set(key, value);
}

export async function getByKey(key: CacheKey) {
    return await redis.get(key);
}

export async function setPoolByKey(
    key: CacheKey,
    values: (string | number | Buffer<ArrayBufferLike>)[]
) {
    await redis.sadd(key, ...values);
}

export async function getPoolByKey(key: CacheKey) {
    return await redis.scard(key);
}

export async function setIdempotency(
    idempotencyKey: string | undefined,
    data: CachedData
) {
    if (!idempotencyKey) return;
    await redis.set(
        CacheKeys.idempotency(idempotencyKey),
        JSON.stringify(data),
        'EX',
        300
    );
}

export async function quit() {
    await redis.quit();
}
