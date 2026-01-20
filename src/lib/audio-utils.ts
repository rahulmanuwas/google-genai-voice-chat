// src/lib/audio-utils.ts

import { AUDIO_CONFIG } from './constants';

/**
 * Convert Float32 audio samples to Int16 PCM
 */
export function float32ToInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
}

/**
 * Convert Int16 PCM to Float32 audio samples
 */
export function int16ToFloat32(int16: Int16Array): Float32Array {
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    }
    return float32;
}

/**
 * Resample audio data from one sample rate to another
 */
export function resample(
    input: Float32Array,
    inputRate: number,
    outputRate: number
): Float32Array {
    if (inputRate === outputRate) return input;

    const ratio = inputRate / outputRate;
    const outputLength = Math.round(input.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
        const srcIndex = i * ratio;
        const srcIndexFloor = Math.floor(srcIndex);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
        const t = srcIndex - srcIndexFloor;
        output[i] = input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t;
    }

    return output;
}

/**
 * Encode audio data as base64 PCM for sending to API
 */
export function encodeAudioForAPI(float32: Float32Array, inputSampleRate: number): string {
    // Resample to API input rate if needed
    const resampled = resample(float32, inputSampleRate, AUDIO_CONFIG.INPUT_SAMPLE_RATE);
    const int16 = float32ToInt16(resampled);

    // Convert to base64
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Decode base64 PCM audio from API response
 */
export function decodeAudioFromAPI(base64: string): Float32Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    return int16ToFloat32(int16);
}

/**
 * Calculate RMS (root mean square) level of audio samples
 * Returns a value between 0 and 1 representing the audio level
 */
export function calculateRMSLevel(samples: Float32Array): number {
    if (samples.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
    }

    return Math.sqrt(sum / samples.length);
}
