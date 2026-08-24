import { db } from '../../src/db/index';
import { events, tickets, users } from '../../src/db/schema';

async function seed() {
    console.log('🌱 Seeding Ticketmallard database...');

    // 1. Create a test user
    const user = (
        await db.insert(users).values({ email: 'mitch@duckmail.com' }).returning()
    ).at(0)!;

    // 2. Create a test event (e.g., "Pond Party 2026")
    const event = (
        await db
            .insert(events)
            .values({
                title: 'Pond Party 2026',
                description: 'The biggest flash sale of the year.',
                startTime: new Date(Date.now() + 86400000 * 7), // 7 days from now
            })
            .returning()
    ).at(0)!;

    // 3. Create 5 available tickets for this event
    const ticketValues = Array.from({ length: 5 }).map(() => ({
        eventId: event.id,
        status: 'AVAILABLE' as const,
    }));

    await db.insert(tickets).values(ticketValues);

    console.log('✅ Seed complete!');
    console.log(`Test User ID: ${user.id}`);
    console.log(`Test Event ID: ${event.id}`);
    process.exit(0);
}

seed().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
