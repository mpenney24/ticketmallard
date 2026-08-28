import Redis from 'ioredis';

export const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
});

redis.defineCommand('reserveTicket', {
    numberOfKeys: 1,
    lua: `
        local current = tonumber(redis.call('get', KEYS[1]))
        if current and current >= 1 then
            redis.call('decr', KEYS[1])
            return 1
        else
            return 0
        end
    `,
});

declare module 'ioredis' {
    interface RedisCommander {
        reserveTicket(key: string): Promise<number>;
    }
}
