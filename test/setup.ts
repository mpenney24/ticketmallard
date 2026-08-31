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
    await testApp.listen({ port: 0, host: '127.0.0.1' });

    const address = testApp.server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 3000;
    process.env.APP_URL = `http://127.0.0.1:${port}`;
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
