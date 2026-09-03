import { and, eq, gte, ilike, lt, SQL } from 'drizzle-orm';
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
            const isTextColumn =
                column.columnType === 'PgText' ||
                column.columnType === 'PgVarchar' ||
                column.columnType === 'PgChar';

            const isTimestampColumn =
                column.columnType === 'PgTimestamp' ||
                column.columnType === 'PgTimestampString';

            if (isTextColumn && typeof value === 'string') {
                conditions.push(ilike(column, `%${value}%`));
            } else if (isTimestampColumn && typeof value === 'string') {
                const parsedDate = new Date(value);
                if (isNaN(parsedDate.getTime())) {
                    throw new Error(
                        `Invalid date/datetime format provided for field '${key}', use "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss"`
                    );
                }

                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    const nextDay = new Date(parsedDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    const nextDayStr = nextDay.toISOString().split('T')[0];

                    conditions.push(
                        and(
                            gte(column, `${value} 00:00:00`),
                            lt(column, `${nextDayStr} 00:00:00`)
                        )!
                    );
                } else {
                    conditions.push(eq(column, parsedDate.toISOString()));
                }
            } else {
                conditions.push(eq(column, value));
            }
        }
    }

    return conditions;
}
