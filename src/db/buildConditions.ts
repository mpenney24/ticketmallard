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
            } else if (
                isTimestampColumn &&
                (typeof value === 'string' || value instanceof Date)
            ) {
                const rawValueStr =
                    typeof value === 'string' ? value : value.toISOString();

                const isYearOnly = /^\d{4}$/.test(rawValueStr);
                const isMonthOnly = /^\d{4}-\d{2}$/.test(rawValueStr);
                const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(rawValueStr);
                const isFullTimestamp =
                    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(rawValueStr) ||
                    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(
                        rawValueStr
                    );

                if (isYearOnly) {
                    const year = Number(rawValueStr);
                    const startDate = `${year}-01-01 00:00:00`;
                    const nextYearStr = `${year + 1}-01-01 00:00:00`;

                    conditions.push(
                        and(gte(column, startDate), lt(column, nextYearStr))!
                    );
                } else if (isMonthOnly) {
                    const [year, month] = rawValueStr.split('-').map(Number);
                    const startDate = `${rawValueStr}-01 00:00:00`;

                    let nextYear = year;
                    let nextMonth = month + 1;
                    if (nextMonth > 12) {
                        nextMonth = 1;
                        nextYear += 1;
                    }
                    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01 00:00:00`;

                    conditions.push(
                        and(gte(column, startDate), lt(column, nextMonthStr))!
                    );
                } else if (isDateOnly) {
                    const dateStr = rawValueStr;
                    const nextDay = new Date(`${dateStr}T00:00:00Z`);
                    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
                    const nextDayStr = nextDay.toISOString().split('T')[0];

                    conditions.push(
                        and(
                            gte(column, `${dateStr} 00:00:00`),
                            lt(column, `${nextDayStr} 00:00:00`)
                        )!
                    );
                } else if (isFullTimestamp || value instanceof Date) {
                    const parsedDate = new Date(rawValueStr);
                    conditions.push(eq(column, parsedDate.toISOString()));
                }
            }
        }
    }

    return conditions;
}
