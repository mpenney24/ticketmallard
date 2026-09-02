import { AddressInfo } from 'node:net';
import { after, before } from 'node:test';

import sinon from 'sinon';

import buildApp from '../src/app';
import * as redis from '../src/utils/redis';
import { FIXED_DATE } from './helpers';

let testApp: Awaited<ReturnType<typeof buildApp>>;

before(async () => {
    sinon.useFakeTimers({
        now: FIXED_DATE,
        toFake: ['Date'],
    });
    testApp = await buildApp();
    await testApp.listen({ port: 0, host: 'localhost' });

    const address: AddressInfo | string | null = testApp.server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 3000;
    process.env.APP_URL = `http://localhost:${port}`;
});

after(async () => {
    sinon.restore();
    await testApp.close();
    await redis.quit();
});

export function getTestApp() {
    if (!testApp) {
        throw new Error(
            'testApp has not been initialized yet. Ensure this is called inside a test or hook.'
        );
    }
    return testApp;
}
