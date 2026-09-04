import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

import { mapDatabaseError } from '../db/mapDatabaseErrors';
import { DomainError } from '../errors/domain.errors';

export async function globalErrorHandler(
    error: FastifyError | DomainError | any,
    request: FastifyRequest,
    reply: FastifyReply
) {
    if (error instanceof DomainError) {
        return reply.code(error.statusCode).send({
            success: false,
            message: error.message,
        });
    }

    const mappedDbError = mapDatabaseError(error);
    if (mappedDbError) {
        return reply.status(mappedDbError.status).send({
            success: false,
            error: 'Bad Request',
            message: mappedDbError.message,
        });
    }

    const statusCode = error.statusCode || 500;
    if (statusCode === 404) {
        return reply.code(404).send({
            success: false,
            message: error.message || 'Not Found',
        });
    }

    request.log.error(error);

    return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Ticketmallard Internal Server Error',
    });
}
