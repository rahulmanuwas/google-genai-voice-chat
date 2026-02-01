import * as react_jsx_runtime from 'react/jsx-runtime';
import { V as VoiceChatConfig, C as ChatMessage$1, a as VoiceChatStats, M as MessageHandler, L as LiveSession, A as AudioDropPolicy, b as VoiceChatEvent } from './types-Bt86lhtR.js';
export { e as ChatHandlerConfig, c as ChatRole, d as ChatTheme } from './types-Bt86lhtR.js';
import '@google/genai';

interface ChatBotProps {
    config: VoiceChatConfig;
    apiKey?: string;
    getApiKey?: () => Promise<string>;
}
declare function ChatBot({ config: userConfig, apiKey, getApiKey }: ChatBotProps): react_jsx_runtime.JSX.Element;

interface ChatMessageProps {
    message: ChatMessage$1;
    primaryColor?: string;
}
declare function ChatMessage({ message, primaryColor }: ChatMessageProps): react_jsx_runtime.JSX.Element;

interface UseVoiceChatOptions {
    config: VoiceChatConfig;
    apiKey?: string;
    getApiKey?: () => Promise<string>;
}
interface UseVoiceChatReturn {
    isConnected: boolean;
    isReconnecting: boolean;
    isListening: boolean;
    isAISpeaking: boolean;
    micLevel: number;
    isMuted: boolean;
    isMicEnabled: boolean;
    isSpeakerPaused: boolean;
    messages: ChatMessage$1[];
    isLoading: boolean;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    sendText: (text: string) => void;
    toggleMute: () => void;
    toggleMic: () => void;
    toggleSpeaker: () => void;
    getStats: () => VoiceChatStats;
}
declare function useVoiceChat(options: UseVoiceChatOptions): UseVoiceChatReturn;

interface UseLiveSessionOptions {
    config: VoiceChatConfig;
    apiKey?: string;
    getApiKey?: () => Promise<string>;
    onMessage?: MessageHandler;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: string) => void;
    onSystemMessage?: (message: string) => void;
}
interface UseLiveSessionReturn {
    session: LiveSession | null;
    isConnected: boolean;
    isReconnecting: boolean;
    sessionHandle: string | null;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    sendText: (text: string) => void;
    playbackContext: AudioContext | null;
    getStats: () => {
        reconnectAttempts: number;
        lastConnectAttemptAt: number | null;
        lastDisconnectCode: number | null;
        lastDisconnectReason: string | null;
    };
}
declare function useLiveSession(options: UseLiveSessionOptions): UseLiveSessionReturn;

interface UseVoiceInputOptions {
    session: LiveSession | null;
    isEnabled: boolean;
    maxConsecutiveErrors?: number;
    errorCooldownMs?: number;
    inputMinSendIntervalMs?: number;
    inputMaxQueueMs?: number;
    inputMaxQueueChunks?: number;
    inputDropPolicy?: AudioDropPolicy;
    preferAudioWorklet?: boolean;
    audioWorkletBufferSize?: number;
    restartMicOnDeviceChange?: boolean;
    onEvent?: (event: VoiceChatEvent) => void;
    onVoiceStart?: () => void;
    onVoiceEnd?: () => void;
    onError?: (error: string) => void;
}
interface UseVoiceInputReturn {
    isListening: boolean;
    micLevel: number;
    startMic: () => Promise<void>;
    stopMic: () => void;
    getStats: () => {
        queueMs: number;
        queueChunks: number;
        droppedChunks: number;
        droppedMs: number;
        sendErrorStreak: number;
        blockedUntil: number;
        lastSendAt: number;
        usingWorklet: boolean;
    };
}
declare function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputReturn;

interface UseVoiceOutputOptions {
    playbackContext: AudioContext | null;
    isPaused: boolean;
    startBufferMs?: number;
    maxQueueMs?: number;
    maxQueueChunks?: number;
    dropPolicy?: AudioDropPolicy;
    onEvent?: (event: VoiceChatEvent) => void;
    onPlaybackStart?: () => void;
    onPlaybackComplete?: () => void;
}
interface UseVoiceOutputReturn {
    isPlaying: boolean;
    enqueueAudio: (base64Data: string, sampleRate?: number) => void;
    stopPlayback: () => void;
    clearQueue: () => void;
    getStats: () => {
        queueMs: number;
        queueChunks: number;
        droppedChunks: number;
        droppedMs: number;
        contextState: AudioContextState | 'none';
    };
}
declare function useVoiceOutput(options: UseVoiceOutputOptions): UseVoiceOutputReturn;

/**
 * Default configuration values
 */
declare const DEFAULT_CONFIG: Required<Omit<VoiceChatConfig, 'systemPrompt' | 'theme' | 'modelId' | 'onEvent'>> & {
    theme: NonNullable<VoiceChatConfig['theme']>;
};

declare const AUDIO_CONFIG: {
    /** Input sample rate for microphone */
    readonly INPUT_SAMPLE_RATE: 16000;
    /** Output sample rate for playback */
    readonly OUTPUT_SAMPLE_RATE: 24000;
    /** Audio MIME type for sending to API */
    readonly INPUT_MIME_TYPE: "audio/pcm;rate=16000";
    /** Audio MIME type for playback */
    readonly OUTPUT_MIME_TYPE: "audio/pcm;rate=24000";
};
/**
 * Stable preset tuned for smoother playback and mic transitions.
 * Use as: mergeConfig({ ...STABLE_PRESET, ...yourConfig })
 */
declare const STABLE_PRESET: Partial<VoiceChatConfig>;
/**
 * Merge user config with defaults
 */
declare function mergeConfig(userConfig: VoiceChatConfig): Required<Omit<VoiceChatConfig, 'theme' | 'onEvent'>> & {
    theme: NonNullable<VoiceChatConfig['theme']>;
    onEvent?: VoiceChatConfig['onEvent'];
};

export { AUDIO_CONFIG, AudioDropPolicy, ChatBot, ChatMessage, ChatMessage$1 as ChatMessageType, DEFAULT_CONFIG, LiveSession, MessageHandler, STABLE_PRESET, VoiceChatConfig, VoiceChatEvent, VoiceChatStats, mergeConfig, useLiveSession, useVoiceChat, useVoiceInput, useVoiceOutput };
