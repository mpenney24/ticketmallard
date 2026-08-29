export abstract class DomainError extends Error {
    abstract readonly statusCode: number;

    constructor(message: string, name?: string) {
        super(message);
        this.name = name || this.constructor.name;
    }
}

export class SoldOutError extends DomainError {
    readonly statusCode = 409;

    constructor(message = 'Sold Out') {
        super(message);
    }
}

export class UnavailableError extends DomainError {
    readonly statusCode = 409;
    constructor(entity = 'Resource', message = `${entity} Unavailable`) {
        super(message, `${entity}${UnavailableError.name}`);
    }
}

export class NotFoundError extends DomainError {
    readonly statusCode = 404;

    constructor(entity = 'Resource', message = `${entity} Not Found`) {
        super(message, `${entity}${NotFoundError.name}`);
    }
}

export class ReservationError extends DomainError {
    readonly statusCode = 423;

    constructor(message = 'Unknown Reservation Error') {
        super(message, ReservationError.name);
    }
}
