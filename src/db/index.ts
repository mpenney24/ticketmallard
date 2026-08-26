import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString =
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@127.0.0.1:5432/ticketmallard';

const client = postgres(connectionString);

export const db = drizzle({ client });
