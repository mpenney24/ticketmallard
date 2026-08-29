import Redis from 'ioredis';

export interface CachedData {
    statusCode: number;
    body: unknown;
}

type LUA_ERROR_CODES = 'SEAT_UNAVAILABLE' | 'GA_SOLD_OUT';

export interface ReservationResult {
    success: boolean;
    code?: LUA_ERROR_CODES;
    ticketId?: string;
    data?: string[];
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

        -- 1. Process GA tickets from the Set
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
