import { after, before } from 'node:test';

import sinon from 'sinon';

import buildApp from '../src/app';
import { FIXED_DATE } from './helpers';

let testApp: Awaited<ReturnType<typeof buildApp>>;

before(async () => {
    sinon.useFakeTimers({
        now: FIXED_DATE,
        toFake: ['Date'],
    });
    testApp = await buildApp();
});

after(async () => {
    sinon.restore();
    testApp.close();
});

export function getTestApp() {
    if (!testApp) {
        throw new Error(
            'testApp has not been initialized yet. Ensure this is called inside a test or hook.'
        );
    }
    return testApp;
}
