import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CONFIG,
  STABLE_PRESET,
  AUDIO_CONFIG,
  mergeConfig,
  INPUT_SAMPLE_RATE,
  OUTPUT_SAMPLE_RATE,
} from '../src/chatbot/lib/constants';
import type { VoiceChatConfig } from '../src/chatbot/lib/types';

test('DEFAULT_CONFIG has all expected keys', () => {
  assert.ok(DEFAULT_CONFIG.welcomeMessage);
  assert.ok(DEFAULT_CONFIG.sessionStorageKey);
  assert.equal(DEFAULT_CONFIG.replyAsAudio, true);
  assert.equal(DEFAULT_CONFIG.useClientVAD, false);
  assert.equal(typeof DEFAULT_CONFIG.serverVADPrefixPaddingMs, 'number');
  assert.equal(typeof DEFAULT_CONFIG.serverVADSilenceDurationMs, 'number');
  assert.equal(typeof DEFAULT_CONFIG.micResumeDelayMs, 'number');
  assert.equal(typeof DEFAULT_CONFIG.playbackStartDelayMs, 'number');
  assert.equal(typeof DEFAULT_CONFIG.playbackSampleRate, 'number');
  assert.equal(typeof DEFAULT_CONFIG.maxMessages, 'number');
  assert.equal(typeof DEFAULT_CONFIG.maxOutputQueueMs, 'number');
  assert.equal(typeof DEFAULT_CONFIG.connectTimeoutMs, 'number');
  assert.equal(typeof DEFAULT_CONFIG.reconnectMaxRetries, 'number');
  assert.equal(typeof DEFAULT_CONFIG.reconnectBaseDelayMs, 'number');
  assert.equal(typeof DEFAULT_CONFIG.reconnectBackoffFactor, 'number');
  assert.equal(typeof DEFAULT_CONFIG.reconnectMaxDelayMs, 'number');
  assert.equal(typeof DEFAULT_CONFIG.reconnectJitterPct, 'number');
  assert.equal(DEFAULT_CONFIG.preferAudioWorklet, true);
  assert.equal(DEFAULT_CONFIG.restartMicOnDeviceChange, true);
  assert.ok(DEFAULT_CONFIG.theme);
});

test('DEFAULT_CONFIG.theme has expected properties', () => {
  assert.ok(DEFAULT_CONFIG.theme.primaryColor);
  assert.equal(DEFAULT_CONFIG.theme.position, 'bottom-right');
});

test('STABLE_PRESET contains tuned timing values', () => {
  assert.equal(typeof STABLE_PRESET.micResumeDelayMs, 'number');
  assert.equal(typeof STABLE_PRESET.playbackStartDelayMs, 'number');
  assert.ok((STABLE_PRESET.micResumeDelayMs ?? 0) > 0);
  assert.ok((STABLE_PRESET.playbackStartDelayMs ?? 0) > 0);
});

test('AUDIO_CONFIG has expected constants', () => {
  assert.equal(AUDIO_CONFIG.INPUT_SAMPLE_RATE, 16000);
  assert.equal(AUDIO_CONFIG.OUTPUT_SAMPLE_RATE, 24000);
  assert.ok(AUDIO_CONFIG.INPUT_MIME_TYPE.includes('16000'));
  assert.ok(AUDIO_CONFIG.OUTPUT_MIME_TYPE.includes('24000'));
});

test('INPUT_SAMPLE_RATE and OUTPUT_SAMPLE_RATE are exported', () => {
  assert.equal(INPUT_SAMPLE_RATE, 16000);
  assert.equal(OUTPUT_SAMPLE_RATE, 24000);
});

test('mergeConfig merges user config with defaults', () => {
  const userConfig: VoiceChatConfig = {
    systemPrompt: 'You are a helpful assistant',
    modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
  };

  const merged = mergeConfig(userConfig);

  // User values preserved
  assert.equal(merged.systemPrompt, 'You are a helpful assistant');
  assert.equal(merged.modelId, 'gemini-2.5-flash-native-audio-preview-12-2025');

  // Defaults applied
  assert.equal(merged.welcomeMessage, DEFAULT_CONFIG.welcomeMessage);
  assert.equal(merged.replyAsAudio, DEFAULT_CONFIG.replyAsAudio);
  assert.equal(merged.micResumeDelayMs, DEFAULT_CONFIG.micResumeDelayMs);
  assert.equal(merged.connectTimeoutMs, DEFAULT_CONFIG.connectTimeoutMs);
  assert.deepEqual(merged.theme, DEFAULT_CONFIG.theme);
});

test('mergeConfig allows overriding defaults', () => {
  const userConfig: VoiceChatConfig = {
    systemPrompt: 'Custom prompt',
    modelId: 'custom-model',
    welcomeMessage: 'Custom welcome',
    replyAsAudio: false,
    micResumeDelayMs: 1000,
    connectTimeoutMs: 5000,
    reconnectMaxRetries: 5,
    preferAudioWorklet: false,
  };

  const merged = mergeConfig(userConfig);

  assert.equal(merged.welcomeMessage, 'Custom welcome');
  assert.equal(merged.replyAsAudio, false);
  assert.equal(merged.micResumeDelayMs, 1000);
  assert.equal(merged.connectTimeoutMs, 5000);
  assert.equal(merged.reconnectMaxRetries, 5);
  assert.equal(merged.preferAudioWorklet, false);
});

test('mergeConfig deeply merges theme', () => {
  const userConfig: VoiceChatConfig = {
    systemPrompt: 'Test',
    modelId: 'test-model',
    theme: {
      primaryColor: '#ff0000',
    },
  };

  const merged = mergeConfig(userConfig);

  // User theme value applied
  assert.equal(merged.theme.primaryColor, '#ff0000');
  // Default theme value preserved
  assert.equal(merged.theme.position, 'bottom-right');
});

test('mergeConfig preserves onEvent callback', () => {
  const onEvent = () => {};
  const userConfig: VoiceChatConfig = {
    systemPrompt: 'Test',
    modelId: 'test-model',
    onEvent,
  };

  const merged = mergeConfig(userConfig);

  assert.equal(merged.onEvent, onEvent);
});

test('reconnect config defaults are sensible', () => {
  const merged = mergeConfig({
    systemPrompt: 'Test',
    modelId: 'test',
  });

  // Connection timeout should be reasonable
  assert.ok(merged.connectTimeoutMs >= 5000);
  assert.ok(merged.connectTimeoutMs <= 30000);

  // Retry count should be reasonable
  assert.ok(merged.reconnectMaxRetries >= 1);
  assert.ok(merged.reconnectMaxRetries <= 10);

  // Backoff factor should be > 1
  assert.ok(merged.reconnectBackoffFactor > 1);

  // Jitter should be between 0 and 1
  assert.ok(merged.reconnectJitterPct >= 0);
  assert.ok(merged.reconnectJitterPct <= 1);

  // Max delay should be >= base delay
  assert.ok(merged.reconnectMaxDelayMs >= merged.reconnectBaseDelayMs);
});
