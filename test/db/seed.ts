import { db } from '../../src/db/index';
import { tableCustomers, tableEvents } from '../../src/db/schema';
import { createNewEvent } from '../helpers';

async function seed() {
    console.log('🌱 Seeding Ticketmallard database...');

    const customers = await db
        .insert(tableCustomers)
        .values([{ email: 'mitch@duckmail.com' }, { email: 'zoe@dogmail.com' }])
        .returning();

    const event = (await db.insert(tableEvents).values(createNewEvent).returning())[0];

    console.log('✅ Seed complete!');
    console.log(`Test Customers: ${customers[0].email}, ${customers[1].email}`);
    console.log(`Test Event ID: ${event.id}`);
    process.exit(0);
}

seed().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
