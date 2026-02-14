import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  float32ToPCM16,
  pcm16ToFloat32,
  downsample,
  encodeAudioToBase64,
  base64ToPCM16,
  calculateRMSLevel,
  INPUT_SAMPLE_RATE,
} from '../src/chatbot/lib/audio-utils';

if (!globalThis.atob) {
  globalThis.atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');
}
if (!globalThis.btoa) {
  globalThis.btoa = (bin: string) => Buffer.from(bin, 'binary').toString('base64');
}

test('float32 <-> pcm16 roundtrip stays within tolerance', () => {
  const input = new Float32Array([-1, -0.5, 0, 0.5, 1]);
  const pcm16 = float32ToPCM16(input);
  const roundtrip = pcm16ToFloat32(pcm16);

  for (let i = 0; i < input.length; i++) {
    assert.ok(Math.abs(input[i] - roundtrip[i]) < 1 / 32768 + 1e-4);
  }
});

test('downsample reduces length by ratio and preserves DC signal', () => {
  const inputSampleRate = 48000;
  const input = new Float32Array(inputSampleRate).fill(0.25);
  const out = downsample(input, inputSampleRate, INPUT_SAMPLE_RATE);
  assert.equal(out.length, Math.floor(input.length / (inputSampleRate / INPUT_SAMPLE_RATE)));
  const rms = calculateRMSLevel(out);
  assert.ok(rms > 0.2 && rms < 0.3);
});

test('encodeAudioToBase64 produces decodable pcm16', () => {
  const input = new Float32Array(480).map((_, i) => Math.sin(i / 10));
  const { data, mimeType } = encodeAudioToBase64(input, 48000, INPUT_SAMPLE_RATE);
  assert.ok(data.length > 0);
  assert.ok(mimeType.includes(`rate=${INPUT_SAMPLE_RATE}`));
  const pcm = base64ToPCM16(data);
  assert.ok(pcm.length > 0);
});

test('calculateRMSLevel returns expected values', () => {
  assert.equal(calculateRMSLevel(new Float32Array([0, 0, 0])), 0);
  assert.ok(Math.abs(calculateRMSLevel(new Float32Array([1, 1, 1, 1])) - 1) < 1e-6);
});
