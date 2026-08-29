import { eq, SQL } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

export function buildConditions<T extends PgTable>(
    table: T,
    request: Record<string, any>
): SQL[] {
    const conditions: SQL[] = [];

    for (const [key, value] of Object.entries(request)) {
        if (value === undefined || value === null) continue;

        const column = (table as Record<string, any>)[key];
        if (column) {
            conditions.push(eq(column, value));
        }
    }

    return conditions;
}
