// src/lib/constants.ts

import type { VoiceChatConfig } from './types';
import { StartSensitivity, EndSensitivity } from '@google/genai';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<Omit<VoiceChatConfig, 'systemPrompt' | 'theme' | 'modelId'>> & { theme: NonNullable<VoiceChatConfig['theme']> } = {
    welcomeMessage: 'Hello! How can I help you today?',
    suggestedQuestions: [],
    sessionStorageKey: 'genai-voice-chat-session',
    replyAsAudio: true,
    useClientVAD: false,
    serverVADPrefixPaddingMs: 500,
    serverVADSilenceDurationMs: 1000,
    serverVADStartSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
    serverVADEndSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
    sessionInitDelayMs: 300,
    micResumeDelayMs: 200,
    playbackStartDelayMs: 0,
    playbackSampleRate: 24000,
    clearSessionOnMount: true,
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
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: VoiceChatConfig): Required<Omit<VoiceChatConfig, 'theme'>> & { theme: NonNullable<VoiceChatConfig['theme']> } {
    return {
        ...DEFAULT_CONFIG,
        ...userConfig,
        theme: {
            ...DEFAULT_CONFIG.theme,
            ...userConfig.theme,
        },
    };
}
