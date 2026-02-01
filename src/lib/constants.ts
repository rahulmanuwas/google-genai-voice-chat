// src/lib/constants.ts

import type { VoiceChatConfig } from './types';
import { StartSensitivity, EndSensitivity } from '@google/genai';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<Omit<VoiceChatConfig, 'systemPrompt' | 'theme' | 'modelId' | 'onEvent'>> & { theme: NonNullable<VoiceChatConfig['theme']> } = {
    welcomeMessage: 'Hello! How can I help you today?',
    suggestedQuestions: [],
    sessionStorageKey: 'genai-voice-chat-session',
    sessionHandleTtlMs: 6 * 60 * 60 * 1000,
    replyAsAudio: true,
    useClientVAD: false,
    serverVADPrefixPaddingMs: 500,
    serverVADSilenceDurationMs: 1000,
    serverVADStartSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
    serverVADEndSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
    sessionInitDelayMs: 300,
    connectTimeoutMs: 12000,
    reconnectMaxRetries: 3,
    reconnectBaseDelayMs: 1500,
    reconnectBackoffFactor: 1.5,
    reconnectMaxDelayMs: 15000,
    reconnectJitterPct: 0.2,
    micResumeDelayMs: 600,
    playbackStartDelayMs: 120,
    playbackSampleRate: 24000,
    maxMessages: 200,
    maxTranscriptChars: 6000,
    maxOutputQueueMs: 15000,
    maxOutputQueueChunks: 200,
    outputDropPolicy: 'drop-oldest',
    maxConsecutiveInputErrors: 3,
    inputErrorCooldownMs: 750,
    inputMinSendIntervalMs: 0,
    inputMaxQueueMs: 0,
    inputMaxQueueChunks: 0,
    inputDropPolicy: 'drop-oldest',
    clearSessionOnMount: true,
    preferAudioWorklet: true,
    audioWorkletBufferSize: 2048,
    restartMicOnDeviceChange: true,
    speechConfig: {},
    thinkingConfig: {},
    enableAffectiveDialog: false,
    proactivity: {},
    autoPauseMicOnSendText: true,
    autoWelcomeAudio: false,
    welcomeAudioPrompt: '',
    autoStartMicOnConnect: true,
    chatTitle: 'AI Assistant',
    theme: {
        primaryColor: '#2563eb',
        position: 'bottom-right',
    },
};

/**
 * Audio configuration constants - re-exported from audio-utils
 */
export { INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE, PLAYBACK_COMPLETE_DELAY_MS } from './audio-utils';

// Legacy AUDIO_CONFIG for backwards compatibility
export const AUDIO_CONFIG = {
    /** Input sample rate for microphone */
    INPUT_SAMPLE_RATE: 16000,
    /** Output sample rate for playback */
    OUTPUT_SAMPLE_RATE: 24000,
    /** Audio MIME type for sending to API */
    INPUT_MIME_TYPE: 'audio/pcm;rate=16000',
    /** Audio MIME type for playback */
    OUTPUT_MIME_TYPE: 'audio/pcm;rate=24000',
} as const;

/**
 * Stable preset tuned for smoother playback and mic transitions.
 * Use as: mergeConfig({ ...STABLE_PRESET, ...yourConfig })
 */
export const STABLE_PRESET: Partial<VoiceChatConfig> = {
    micResumeDelayMs: 600,
    playbackStartDelayMs: 120,
};

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: VoiceChatConfig): Required<Omit<VoiceChatConfig, 'theme' | 'onEvent'>> & { theme: NonNullable<VoiceChatConfig['theme']>; onEvent?: VoiceChatConfig['onEvent'] } {
    return {
        ...DEFAULT_CONFIG,
        ...userConfig,
        theme: {
            ...DEFAULT_CONFIG.theme,
            ...userConfig.theme,
        },
    };
}
