import { db } from '../../src/db/index';
import { tableEvents, tableTickets, tableUsers } from '../../src/db/schema';
import { testEvent } from '../helpers';

async function seed() {
    console.log('🌱 Seeding Ticketmallard database...');

    const user = (
        await db.insert(tableUsers).values({ email: 'mitch@duckmail.com' }).returning()
    ).at(0)!;

    const event = (await db.insert(tableEvents).values(testEvent).returning()).at(0)!;

    const ticketValues = Array.from({ length: 5 }).map(() => ({
        eventId: event.id,
        status: 'AVAILABLE' as const,
    }));

    await db.insert(tableTickets).values(ticketValues);

    console.log('✅ Seed complete!');
    console.log(`Test User ID: ${user.id}`);
    console.log(`Test Event ID: ${event.id}`);
    process.exit(0);
}

seed().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
