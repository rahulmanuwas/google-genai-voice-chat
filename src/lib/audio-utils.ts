// src/lib/audio-utils.ts

/**
 * PCM audio conversion utilities - ported from tested g2p implementation
 */

/** Input sample rate for microphone (Google expects 16kHz) */
export const INPUT_SAMPLE_RATE = 16000;

/** Output sample rate for playback (Gemini outputs 24kHz) */
export const OUTPUT_SAMPLE_RATE = 24000;

/** Delay after playback ends before calling onPlaybackComplete */
export const PLAYBACK_COMPLETE_DELAY_MS = 200;

/**
 * Convert Float32 audio samples to 16-bit PCM
 */
export function float32ToPCM16(float32: Float32Array): Int16Array {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
}

/**
 * Convert 16-bit PCM to Float32 audio samples (for Web Audio API)
 */
export function pcm16ToFloat32(pcm16: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
    }
    return float32;
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ToBase64(u8: Uint8Array): string {
    let s = '';
    for (let i = 0; i < u8.length; i++) {
        s += String.fromCharCode(u8[i]);
    }
    return btoa(s);
}

/**
 * Convert base64 string to Int16Array PCM data
 */
export function base64ToPCM16(base64: string): Int16Array {
    const bin = atob(base64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        buf[i] = bin.charCodeAt(i);
    }
    return new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2));
}

/**
 * Downsample audio data to target sample rate
 */
export function downsample(
    inputData: Float32Array,
    inputSampleRate: number,
    targetSampleRate: number
): Float32Array {
    if (inputSampleRate === targetSampleRate) {
        return inputData;
    }

    const ratio = inputSampleRate / targetSampleRate;
    const newLength = Math.floor(inputData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
        result[i] = inputData[Math.floor(i * ratio)];
    }

    return result;
}

/**
 * Encode audio data to base64 PCM string for sending to API
 */
export function encodeAudioToBase64(
    audioData: Float32Array,
    sourceSampleRate: number,
    targetSampleRate: number = INPUT_SAMPLE_RATE
): { data: string; mimeType: string } {
    const processedData = downsample(audioData, sourceSampleRate, targetSampleRate);
    const pcm16 = float32ToPCM16(processedData);
    const u8 = new Uint8Array(pcm16.buffer);
    const base64 = uint8ToBase64(u8);

    return {
        data: base64,
        mimeType: `audio/pcm;rate=${targetSampleRate}`,
    };
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
