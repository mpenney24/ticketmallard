import { createSchemaFactory } from 'drizzle-orm/zod';
import { z } from 'zod';

export const { createInsertSchema, createUpdateSchema, createSelectSchema } =
    createSchemaFactory({
        zodInstance: z,
        coerce: {
            date: true,
        },
    });
