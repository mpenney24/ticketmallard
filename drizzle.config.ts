import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config();

export default defineConfig({
    schema: './src/**/*.db.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url:
            process.env.DATABASE_URL ||
            'postgres://postgres:postgres@127.0.0.1:5432/ticketmallard',
    },
});
