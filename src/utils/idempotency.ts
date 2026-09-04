import crypto from 'crypto';
import stableStringify from 'fast-json-stable-stringify';
import superjson from 'superjson';

export function generateIdempotencyKey(body: unknown): string {
    return crypto.createHash('sha256').update(stableStringify(body)).digest('hex');
}

export function dehydrateResponseForCache(body: any) {
    return superjson.stringify(body);
}

export function rehydrateResponseFromCache(cachedBodyFromRedis: string | object): any {
    const parsedJson =
        typeof cachedBodyFromRedis === 'string'
            ? JSON.parse(cachedBodyFromRedis)
            : cachedBodyFromRedis;

    return superjson.deserialize(parsedJson);
}
