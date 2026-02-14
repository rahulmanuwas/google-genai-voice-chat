import assert from 'node:assert/strict';
import { test, describe, mock } from 'node:test';
import { createConvexHelper } from '../src/chatbot/telemetry/convexHelper';

const TEST_CONFIG = {
    url: 'https://test.convex.cloud',
    appSlug: 'test-app',
    appSecret: 'test-secret-123',
};

describe('createConvexHelper', () => {
    test('returns an object with all expected methods', () => {
        const helper = createConvexHelper(TEST_CONFIG);
        assert.equal(typeof helper.fetchToken, 'function');
        assert.equal(typeof helper.postEvents, 'function');
        assert.equal(typeof helper.saveConversation, 'function');
        assert.equal(typeof helper.beaconEvents, 'function');
        assert.equal(typeof helper.beaconConversation, 'function');
    });

    test('fetchToken sends correct request and returns token', async () => {
        const mockFetch = mock.fn(async () => ({
            ok: true,
            json: async () => ({ token: 'ephemeral-token-abc' }),
        }));
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        try {
            const helper = createConvexHelper(TEST_CONFIG);
            const token = await helper.fetchToken();

            assert.equal(token, 'ephemeral-token-abc');
            assert.equal(mockFetch.mock.callCount(), 1);

            const [url, opts] = mockFetch.mock.calls[0].arguments;
            assert.equal(url, 'https://test.convex.cloud/api/token');
            assert.equal(opts.method, 'POST');
            const body = JSON.parse(opts.body);
            assert.equal(body.appSlug, 'test-app');
            assert.equal(body.appSecret, 'test-secret-123');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('fetchToken throws on non-ok response', async () => {
        const mockFetch = mock.fn(async () => ({
            ok: false,
            statusText: 'Forbidden',
            json: async () => ({ error: 'Invalid secret' }),
        }));
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        try {
            const helper = createConvexHelper(TEST_CONFIG);
            await assert.rejects(
                () => helper.fetchToken(),
                (err: Error) => {
                    assert.ok(err.message.includes('Invalid secret'));
                    return true;
                }
            );
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('postEvents sends events to correct endpoint', async () => {
        const mockFetch = mock.fn(async () => ({ ok: true }));
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        try {
            const helper = createConvexHelper(TEST_CONFIG);
            const events = [
                { eventType: 'connect', ts: 1000 },
                { eventType: 'disconnect', ts: 2000, data: '{"reason":"user"}' },
            ];
            await helper.postEvents('ses_123', events);

            assert.equal(mockFetch.mock.callCount(), 1);
            const [url, opts] = mockFetch.mock.calls[0].arguments;
            assert.equal(url, 'https://test.convex.cloud/api/events');
            const body = JSON.parse(opts.body);
            assert.equal(body.sessionId, 'ses_123');
            assert.equal(body.events.length, 2);
            assert.equal(body.appSlug, 'test-app');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('postEvents swallows fetch errors (fire-and-forget)', async () => {
        const mockFetch = mock.fn(async () => {
            throw new Error('Network error');
        });
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        try {
            const helper = createConvexHelper(TEST_CONFIG);
            // Should not throw
            await helper.postEvents('ses_123', [{ eventType: 'test', ts: 1000 }]);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('saveConversation sends messages to correct endpoint', async () => {
        const mockFetch = mock.fn(async () => ({ ok: true }));
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        try {
            const helper = createConvexHelper(TEST_CONFIG);
            const messages = [
                { role: 'user', content: 'Hello', ts: 1000 },
                { role: 'model', content: 'Hi there!', ts: 1500 },
            ];
            await helper.saveConversation('ses_456', messages, 900);

            const [url, opts] = mockFetch.mock.calls[0].arguments;
            assert.equal(url, 'https://test.convex.cloud/api/conversations');
            const body = JSON.parse(opts.body);
            assert.equal(body.sessionId, 'ses_456');
            assert.equal(body.startedAt, 900);
            assert.equal(body.messages.length, 2);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('saveConversation swallows fetch errors', async () => {
        const mockFetch = mock.fn(async () => {
            throw new Error('Network error');
        });
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        try {
            const helper = createConvexHelper(TEST_CONFIG);
            await helper.saveConversation('ses_456', [{ role: 'user', content: 'Hi', ts: 1 }], 0);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('beaconEvents does nothing when navigator.sendBeacon is unavailable', () => {
        // In Node.js, navigator is undefined — should not throw
        const helper = createConvexHelper(TEST_CONFIG);
        helper.beaconEvents('ses_789', [{ eventType: 'test', ts: 1000 }]);
    });

    test('beaconEvents does nothing with empty events', () => {
        const helper = createConvexHelper(TEST_CONFIG);
        helper.beaconEvents('ses_789', []);
    });

    test('beaconConversation does nothing when navigator is unavailable', () => {
        const helper = createConvexHelper(TEST_CONFIG);
        helper.beaconConversation('ses_789', [{ role: 'user', content: 'Hi', ts: 1 }], 0);
    });

    test('beaconConversation does nothing with empty messages', () => {
        const helper = createConvexHelper(TEST_CONFIG);
        helper.beaconConversation('ses_789', [], 0);
    });
});
