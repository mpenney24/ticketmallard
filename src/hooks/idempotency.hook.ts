import crypto from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';

import {
    dehydrateResponseForCache,
    generateIdempotencyKey,
    rehydrateResponseFromCache,
} from '../utils/idempotency';
import {
    clearIdempotency,
    getIdempotency,
    getIdempotencyLock,
    releaseIdempotencyLock,
    setIdempotency,
} from '../utils/redis';

export async function idempotencyPreHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    if (
        request.headers['x-bypass-idempotency'] === 'true' &&
        process.env.NODE_ENV !== 'prod'
    ) {
        return;
    }

    if (['POST', 'PATCH'].includes(request.method)) {
        const idempotencyKey = generateIdempotencyKey(request.body);
        request.idempotencyKey = idempotencyKey;
        const cached = await getIdempotency(idempotencyKey);

        if (cached) {
            console.log('Cache hit! Returning...');
            const revivedBody = rehydrateResponseFromCache(cached.body);
            return reply.code(cached.statusCode).send(revivedBody);
        }

        const lockToken = crypto.randomUUID();

        const lockAcquired = await getIdempotencyLock(idempotencyKey, lockToken);
        if (!lockAcquired) {
            return reply.code(409).send({ error: 'Concurrent request in progress' });
        }

        request.idempotencyLockToken = lockToken;
    }
}

export async function idempotencyOnSend(
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown
) {
    if (
        request.headers['x-bypass-idempotency'] === 'true' &&
        process.env.NODE_ENV !== 'prod'
    ) {
        return payload;
    }

    if (
        ['POST', 'PATCH'].includes(request.method) &&
        reply.statusCode >= 200 &&
        reply.statusCode < 300
    ) {
        const idempotencyKey = generateIdempotencyKey(request.body);
        const body = typeof payload === 'string' ? JSON.parse(payload) : payload;

        const serialized = dehydrateResponseForCache(body);

        await setIdempotency(idempotencyKey, {
            statusCode: reply.statusCode,
            body: serialized,
        });

        if (request.headers['x-idempotency-key']) {
            console.log('Passive cache release!');
            try {
                await clearIdempotency(request.headers['x-idempotency-key'] as string);
            } catch (err) {
                request.log.error({ err }, 'Failed to clear idempotency');
            }
        }
    }

    return payload;
}

export async function idempotencyOnResponse(request: FastifyRequest) {
    if (request.idempotencyKey && request.idempotencyLockToken) {
        try {
            await releaseIdempotencyLock(
                request.idempotencyKey,
                request.idempotencyLockToken
            );
        } catch (err) {
            request.log.error({ err }, 'Failed to release idempotency lock');
        }
    }
}
