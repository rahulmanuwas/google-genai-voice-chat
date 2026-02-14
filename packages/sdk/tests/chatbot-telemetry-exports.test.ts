import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

describe('telemetry exports', () => {
    test('createConvexHelper is exported from main entry', async () => {
        const exports = await import('../src/chatbot/index');
        assert.equal(typeof exports.createConvexHelper, 'function');
    });

    test('useTelemetry is exported from main entry', async () => {
        const exports = await import('../src/chatbot/index');
        assert.equal(typeof exports.useTelemetry, 'function');
    });

    test('telemetry module barrel exports all expected items', async () => {
        const telemetry = await import('../src/chatbot/telemetry/index');
        assert.equal(typeof telemetry.createConvexHelper, 'function');
        assert.equal(typeof telemetry.useTelemetry, 'function');
    });

    test('ConvexHelperConfig interface shape is correct (via createConvexHelper)', () => {
        // Verify the factory accepts the expected config shape
        const { createConvexHelper } = require('../src/chatbot/telemetry/convexHelper');
        const helper = createConvexHelper({
            url: 'https://example.convex.cloud',
            appSlug: 'test',
            appSecret: 'secret',
        });
        assert.ok(helper);
        assert.equal(typeof helper.fetchToken, 'function');
        assert.equal(typeof helper.postEvents, 'function');
        assert.equal(typeof helper.saveConversation, 'function');
        assert.equal(typeof helper.beaconEvents, 'function');
        assert.equal(typeof helper.beaconConversation, 'function');
    });

    test('DEFAULT_CONFIG does not include onEvent (it is optional)', async () => {
        const { DEFAULT_CONFIG } = await import('../src/chatbot/lib/constants');
        // onEvent is optional and should not be set in defaults
        assert.ok(!('onEvent' in DEFAULT_CONFIG));
    });
});
