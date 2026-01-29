import * as react_jsx_runtime from 'react/jsx-runtime';
import { V as VoiceChatConfig, C as ChatMessage$1, M as MessageHandler, L as LiveSession } from './types-Cn2btWbS.js';
export { c as ChatHandlerConfig, a as ChatRole, b as ChatTheme } from './types-Cn2btWbS.js';
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
declare const DEFAULT_CONFIG: Required<Omit<VoiceChatConfig, 'systemPrompt' | 'theme' | 'modelId'>> & {
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
 * Merge user config with defaults
 */
declare function mergeConfig(userConfig: VoiceChatConfig): Required<Omit<VoiceChatConfig, 'theme'>> & {
    theme: NonNullable<VoiceChatConfig['theme']>;
};

export { AUDIO_CONFIG, ChatBot, ChatMessage, ChatMessage$1 as ChatMessageType, DEFAULT_CONFIG, LiveSession, MessageHandler, VoiceChatConfig, mergeConfig, useLiveSession, useVoiceChat, useVoiceInput, useVoiceOutput };
