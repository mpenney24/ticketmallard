import { FastifyReply, FastifyRequest } from 'fastify';

import * as redis from '../utils/redis';

export async function idempotencyHook(request: FastifyRequest, reply: FastifyReply) {
    const idempotencyKey = request.headers['x-idempotency-key'] as string;
    if (!idempotencyKey) return;

    const cached = await redis.getByKey(redis.CacheKeys.idempotency(idempotencyKey));
    if (cached) {
        const { statusCode, body }: redis.CachedData = JSON.parse(cached);
        return reply.code(statusCode).send(body);
    }
}
