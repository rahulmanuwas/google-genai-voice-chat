import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import {
    float32ToPCM16,
    pcm16ToFloat32,
    downsample,
    encodeAudioToBase64,
    base64ToPCM16,
    calculateRMSLevel,
    uint8ToBase64,
    INPUT_SAMPLE_RATE,
    OUTPUT_SAMPLE_RATE,
    PLAYBACK_COMPLETE_DELAY_MS,
} from '../src/chatbot/lib/audio-utils';

if (!globalThis.atob) {
    globalThis.atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');
}
if (!globalThis.btoa) {
    globalThis.btoa = (bin: string) => Buffer.from(bin, 'binary').toString('base64');
}

describe('audio-utils edge cases', () => {
    test('float32ToPCM16 handles NaN values by outputting 0', () => {
        const input = new Float32Array([0.5, NaN, -0.5]);
        const pcm16 = float32ToPCM16(input);
        assert.equal(pcm16[1], 0); // NaN → 0
        assert.ok(pcm16[0] > 0);   // 0.5 → positive
        assert.ok(pcm16[2] < 0);   // -0.5 → negative
    });

    test('float32ToPCM16 clamps values beyond [-1, 1]', () => {
        const input = new Float32Array([-2.0, 2.0, -1.5, 1.5]);
        const pcm16 = float32ToPCM16(input);
        // All should be clamped to [-32768, 32767]
        assert.equal(pcm16[0], -32768);
        assert.equal(pcm16[1], 32767);
        assert.equal(pcm16[2], -32768);
        assert.equal(pcm16[3], 32767);
    });

    test('float32ToPCM16 handles empty array', () => {
        const input = new Float32Array(0);
        const pcm16 = float32ToPCM16(input);
        assert.equal(pcm16.length, 0);
    });

    test('pcm16ToFloat32 handles empty array', () => {
        const input = new Int16Array(0);
        const float32 = pcm16ToFloat32(input);
        assert.equal(float32.length, 0);
    });

    test('pcm16ToFloat32 maps full range correctly', () => {
        const input = new Int16Array([0, 32767, -32768]);
        const float32 = pcm16ToFloat32(input);
        assert.ok(Math.abs(float32[0]) < 1e-6);       // 0 → ~0
        assert.ok(Math.abs(float32[1] - 1.0) < 0.001); // 32767 → ~1.0
        assert.ok(Math.abs(float32[2] + 1.0) < 0.001); // -32768 → ~-1.0
    });

    test('downsample returns same data when rates match', () => {
        const input = new Float32Array([0.1, 0.2, 0.3, 0.4]);
        const result = downsample(input, 16000, 16000);
        assert.equal(result, input); // Same reference
    });

    test('downsample handles 2:1 ratio correctly', () => {
        // 4 samples at 32kHz → 2 samples at 16kHz
        const input = new Float32Array([0.1, 0.3, 0.5, 0.7]);
        const result = downsample(input, 32000, 16000);
        assert.equal(result.length, 2);
        // First sample: avg of [0.1, 0.3] = 0.2
        assert.ok(Math.abs(result[0] - 0.2) < 0.01);
        // Second sample: avg of [0.5, 0.7] = 0.6
        assert.ok(Math.abs(result[1] - 0.6) < 0.01);
    });

    test('downsample handles 3:1 ratio', () => {
        const input = new Float32Array(48000).fill(0.5);
        const result = downsample(input, 48000, 16000);
        assert.equal(result.length, 16000);
        // All values should be ~0.5 (constant signal)
        for (let i = 0; i < 10; i++) {
            assert.ok(Math.abs(result[i] - 0.5) < 0.01);
        }
    });

    test('uint8ToBase64 roundtrips correctly', () => {
        const original = new Uint8Array([0, 1, 127, 128, 255]);
        const b64 = uint8ToBase64(original);
        assert.ok(b64.length > 0);
        // Decode back
        const decoded = atob(b64);
        assert.equal(decoded.length, original.length);
        for (let i = 0; i < original.length; i++) {
            assert.equal(decoded.charCodeAt(i), original[i]);
        }
    });

    test('uint8ToBase64 handles empty array', () => {
        const result = uint8ToBase64(new Uint8Array(0));
        assert.equal(result, '');
    });

    test('uint8ToBase64 handles large arrays (>32KB chunk boundary)', () => {
        const size = 40000; // > 32KB chunk size
        const input = new Uint8Array(size);
        for (let i = 0; i < size; i++) input[i] = i % 256;
        const b64 = uint8ToBase64(input);
        const decoded = atob(b64);
        assert.equal(decoded.length, size);
    });

    test('base64ToPCM16 roundtrips with float32ToPCM16', () => {
        const original = new Float32Array([0.0, 0.25, 0.5, -0.25, -0.5]);
        const pcm16 = float32ToPCM16(original);
        const u8 = new Uint8Array(pcm16.buffer);
        const b64 = uint8ToBase64(u8);
        const decoded = base64ToPCM16(b64);
        assert.equal(decoded.length, original.length);
        for (let i = 0; i < decoded.length; i++) {
            assert.equal(decoded[i], pcm16[i]);
        }
    });

    test('encodeAudioToBase64 defaults to INPUT_SAMPLE_RATE', () => {
        const input = new Float32Array(160).fill(0.5);
        const result = encodeAudioToBase64(input, INPUT_SAMPLE_RATE);
        assert.ok(result.mimeType.includes(`rate=${INPUT_SAMPLE_RATE}`));
        assert.ok(result.data.length > 0);
    });

    test('encodeAudioToBase64 with downsampling', () => {
        const input = new Float32Array(480).fill(0.3); // 480 samples at 48kHz
        const result = encodeAudioToBase64(input, 48000, 16000);
        assert.ok(result.mimeType.includes('rate=16000'));
        const decoded = base64ToPCM16(result.data);
        assert.equal(decoded.length, 160); // 480 / 3 = 160
    });

    test('calculateRMSLevel of empty array returns 0', () => {
        assert.equal(calculateRMSLevel(new Float32Array(0)), 0);
    });

    test('calculateRMSLevel of silence returns 0', () => {
        assert.equal(calculateRMSLevel(new Float32Array(100).fill(0)), 0);
    });

    test('calculateRMSLevel of full-scale sine wave returns ~0.707', () => {
        const samples = new Float32Array(10000);
        for (let i = 0; i < samples.length; i++) {
            samples[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
        }
        const rms = calculateRMSLevel(samples);
        assert.ok(Math.abs(rms - 0.707) < 0.01);
    });

    test('calculateRMSLevel of DC offset', () => {
        const rms = calculateRMSLevel(new Float32Array(100).fill(0.5));
        assert.ok(Math.abs(rms - 0.5) < 1e-6);
    });

    test('constants are correctly defined', () => {
        assert.equal(INPUT_SAMPLE_RATE, 16000);
        assert.equal(OUTPUT_SAMPLE_RATE, 24000);
        assert.equal(typeof PLAYBACK_COMPLETE_DELAY_MS, 'number');
        assert.ok(PLAYBACK_COMPLETE_DELAY_MS > 0);
    });
});
