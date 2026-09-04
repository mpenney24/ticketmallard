import 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        idempotencyKey?: string;
        idempotencyLockToken?: string;
    }
}
