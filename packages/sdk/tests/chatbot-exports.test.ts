import assert from 'node:assert/strict';
import { test } from 'node:test';

// Test that all public exports are available
test('main entry exports all expected hooks', async () => {
  const exports = await import('../src/chatbot/index');

  // Hooks
  assert.equal(typeof exports.useVoiceChat, 'function');
  assert.equal(typeof exports.useLiveSession, 'function');
  assert.equal(typeof exports.useVoiceInput, 'function');
  assert.equal(typeof exports.useVoiceOutput, 'function');

  // Components
  assert.equal(typeof exports.ChatBot, 'function');

  // Utilities
  assert.equal(typeof exports.mergeConfig, 'function');
  assert.ok(exports.DEFAULT_CONFIG);
  assert.ok(exports.STABLE_PRESET);
  assert.ok(exports.AUDIO_CONFIG);
});

test('api entry exports createChatHandler', async () => {
  const apiExports = await import('../src/chatbot/api/index');

  assert.equal(typeof apiExports.createChatHandler, 'function');
});

test('types are exported', async () => {
  // Just verify the module loads without error
  // Type exports are compile-time only, but we can check the module structure
  const exports = await import('../src/chatbot/index');

  // DEFAULT_CONFIG should have the shape of VoiceChatConfig
  assert.ok('welcomeMessage' in exports.DEFAULT_CONFIG);
  assert.ok('replyAsAudio' in exports.DEFAULT_CONFIG);
  assert.ok('modelId' in exports.DEFAULT_CONFIG === false); // Required field, not in defaults
});

test('audio-utils exports all functions', async () => {
  const audioUtils = await import('../src/chatbot/lib/audio-utils');

  assert.equal(typeof audioUtils.float32ToPCM16, 'function');
  assert.equal(typeof audioUtils.pcm16ToFloat32, 'function');
  assert.equal(typeof audioUtils.downsample, 'function');
  assert.equal(typeof audioUtils.encodeAudioToBase64, 'function');
  assert.equal(typeof audioUtils.base64ToPCM16, 'function');
  assert.equal(typeof audioUtils.calculateRMSLevel, 'function');
  assert.equal(audioUtils.INPUT_SAMPLE_RATE, 16000);
  assert.equal(audioUtils.OUTPUT_SAMPLE_RATE, 24000);
});
