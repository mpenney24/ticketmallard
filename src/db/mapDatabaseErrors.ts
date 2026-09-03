function toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function mapDatabaseError(error: any) {
    const cause = error?.cause ?? error;
    const code = cause?.code;

    switch (code) {
        case '23503': {
            const detail = cause?.detail || '';
            const match = detail.match(/Key \((.*?)\)=/);
            const column = match ? match[1] : 'unknown';

            return {
                status: 400,
                message: `Foreign key constraint violation on field '${toCamelCase(column)}': the referenced record does not exist.`,
            };
        }
        case '23505': {
            const detail = cause?.detail || '';
            const match = detail.match(/Key \((.*?)\)=/);
            const column = match ? match[1] : 'unknown';
            return {
                status: 400,
                message: `Unique constraint violation on field '${toCamelCase(column)}': a record with this value already exists`,
            };
        }
        case '23502':
            return {
                status: 400,
                message: `Missing required field: ${cause?.column || 'unknown'}`,
            };
        case '22007':
            return {
                status: 400,
                message: 'Invalid date/datetime format provided',
            };
        default:
            return null;
    }
}
