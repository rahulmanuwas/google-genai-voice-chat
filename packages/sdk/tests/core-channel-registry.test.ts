import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createChannelAdapterRegistry } from '../src/core';
import type { ChannelAdapter } from '../src/core/channel';

describe('core channel adapter registry', () => {
  test('register/list/get/unregister channel adapters', () => {
    const registry = createChannelAdapterRegistry();
    const adapter: ChannelAdapter = {
      id: 'demo-web',
      channel: 'web',
      capabilities: {
        supportsTextIn: true,
        supportsTextOut: true,
        supportsAudioIn: false,
        supportsAudioOut: false,
        supportsStreaming: true,
        supportsGroups: false,
        supportsTypingIndicators: true,
        supportsAttachments: true,
      },
      async sendMessage() {
        return { externalId: 'm1' };
      },
    };

    registry.register(adapter);
    assert.equal(registry.list().length, 1);
    assert.equal(registry.get('demo-web')?.channel, 'web');

    registry.unregister('demo-web');
    assert.equal(registry.list().length, 0);
  });
});
