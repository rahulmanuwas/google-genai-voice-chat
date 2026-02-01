import * as react_jsx_runtime from 'react/jsx-runtime';
import { V as VoiceChatConfig, C as ChatMessage$1, M as MessageHandler, L as LiveSession, a as VoiceChatEvent } from './types-ZoP0AQBP.js';
export { d as ChatHandlerConfig, b as ChatRole, c as ChatTheme } from './types-ZoP0AQBP.js';
import '@google/genai';

interface ChatBotProps {
    config: VoiceChatConfig;
    apiKey: string;
}
declare function ChatBot({ config: userConfig, apiKey }: ChatBotProps): react_jsx_runtime.JSX.Element;

interface ChatMessageProps {
    message: ChatMessage$1;
    primaryColor?: string;
}
declare function ChatMessage({ message, primaryColor }: ChatMessageProps): react_jsx_runtime.JSX.Element;

interface UseVoiceChatOptions {
    config: VoiceChatConfig;
    apiKey: string;
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
}
declare function useVoiceChat(options: UseVoiceChatOptions): UseVoiceChatReturn;

interface UseLiveSessionOptions {
    config: VoiceChatConfig;
    apiKey: string;
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
}
declare function useLiveSession(options: UseLiveSessionOptions): UseLiveSessionReturn;

interface UseVoiceInputOptions {
    session: LiveSession | null;
    isEnabled: boolean;
    maxConsecutiveErrors?: number;
    errorCooldownMs?: number;
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
}
declare function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputReturn;

interface UseVoiceOutputOptions {
    playbackContext: AudioContext | null;
    isPaused: boolean;
    startBufferMs?: number;
    maxQueueMs?: number;
    maxQueueChunks?: number;
    onEvent?: (event: VoiceChatEvent) => void;
    onPlaybackStart?: () => void;
    onPlaybackComplete?: () => void;
}
interface UseVoiceOutputReturn {
    isPlaying: boolean;
    enqueueAudio: (base64Data: string, sampleRate?: number) => void;
    stopPlayback: () => void;
    clearQueue: () => void;
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

export { AUDIO_CONFIG, ChatBot, ChatMessage, ChatMessage$1 as ChatMessageType, DEFAULT_CONFIG, LiveSession, MessageHandler, STABLE_PRESET, VoiceChatConfig, VoiceChatEvent, mergeConfig, useLiveSession, useVoiceChat, useVoiceInput, useVoiceOutput };
