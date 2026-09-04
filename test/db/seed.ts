import { db } from '../../src/db/index';
import { tableCustomers } from '../../src/db/schemas/customer/table.db';
import { tableEvents } from '../../src/db/schemas/event/table.db';
import { createNewEvent } from '../helpers';

async function seed() {
    console.log('🌱 Seeding Ticketmallard database...');

    const customerInserts = [];
    for (let i = 0; i < 10; i++) {
        customerInserts.push({ email: `mitch${i}@duckmail.com` });
    }

    const customers = await db.insert(tableCustomers).values(customerInserts).returning();

    const event = (
        await db
            .insert(tableEvents)
            .values({
                ...createNewEvent,
                startDateTime: new Date(createNewEvent.startDateTime),
            })
            .returning()
    )[0];

    console.log('✅ Seed complete!');
    console.log(`Test Customers(2): ${customers[0].email}, ${customers[1].email}`);
    console.log(`Test Event ID: ${event.id}`);
    process.exit(0);
}

seed().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
