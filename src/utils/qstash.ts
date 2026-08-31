import { Client } from '@upstash/qstash';

let qstashInstance: Client | null = null;

export function getQstash() {
    if (!qstashInstance) {
        const token = process.env.QSTASH_TOKEN;

        if (!token) {
            throw new Error(
                'QSTASH_TOKEN environment variable is missing. Check your .env file or test setup.'
            );
        }

        console.log('CONNECTING TO QSTASH URL:', process.env.QSTASH_URL);

        qstashInstance = new Client({
            baseUrl: process.env.QSTASH_URL,
            token: process.env.QSTASH_TOKEN,
        });
    }
    return qstashInstance;
}
