function toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function mapDatabaseError(error: any) {
    const cause = error?.cause ?? error;
    const code = cause?.code;
    const detail = cause?.detail || '';

    const match = detail.match(/Key \((.*?)\)=/);
    const rawColumn = match ? match[1] : cause?.column;
    const column = rawColumn ? toCamelCase(rawColumn) : 'unknown';

    const errorMap: Record<string, string> = {
        '23503': `Foreign key constraint violation on field '${column}': the referenced record does not exist.`,
        '23505': `Unique constraint violation on field '${column}': a record with this value already exists`,
        '23502': `Missing required field: ${column}`,
        '22007': 'Invalid date/datetime format provided',
    };

    const message = errorMap[code];
    if (!message) return null;

    return { status: 400, message };
}
