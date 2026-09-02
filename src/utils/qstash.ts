import { Client, Receiver } from '@upstash/qstash';
import { FastifyRequest } from 'fastify';

import { HTTPSignatureError } from '../errors/domain.errors';

let qstashInstance: Client | null = null;

export function getQstash() {
    if (!qstashInstance) {
        const token = process.env.QSTASH_TOKEN;

        if (!token) {
            throw new Error(
                'QSTASH_TOKEN environment variable is missing. Check your .env file or test setup.'
            );
        }

        qstashInstance = new Client({
            baseUrl: process.env.QSTASH_URL,
            token: process.env.QSTASH_TOKEN,
        });
    }
    return qstashInstance;
}

export const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function verifyQStashSignature(request: FastifyRequest) {
    const signature = request.headers['upstash-signature'] as string;

    if (!signature) {
        throw new HTTPSignatureError('upstash-signature');
    }

    try {
        const isValid = await receiver.verify({
            signature,
            body: JSON.stringify(request.body),
        });

        if (!isValid) {
            throw new HTTPSignatureError('upstash-signature', 'Invalid QStash Signature');
        }

        console.log('QStash Webhook Signature Verified!');
    } catch (error) {
        throw new HTTPSignatureError(
            'upstash-signature',
            'upstash-signature Verification Failed'
        );
    }
}
