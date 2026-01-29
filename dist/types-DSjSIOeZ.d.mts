import { LiveServerMessage } from '@google/genai';

/**
 * Chat message role
 */
type ChatRole = 'user' | 'model' | 'system';
/**
 * Chat message structure
 */
interface ChatMessage {
    id: string;
    content: string;
    role: ChatRole;
    ts: number;
}
/**
 * Live session interface (subset of Google GenAI session)
 */
interface LiveSession {
    sendClientContent: (content: {
        turns: string;
        turnComplete: boolean;
    }) => void;
    sendRealtimeInput: (input: {
        audioStreamEnd?: boolean;
        audio?: {
            data: string;
            mimeType: string;
        };
    }) => void;
    close: () => void;
}
/**
 * Message handler type
 */
type MessageHandler = (msg: LiveServerMessage) => void;
/**
 * Theme configuration for the chat component
 */
interface ChatTheme {
    /** Primary accent color (hex or CSS variable) */
    primaryColor?: string;
    /** Position of the chat launcher */
    position?: 'bottom-right' | 'bottom-left';
    /** Custom class name for the chat card */
    cardClassName?: string;
    /** Custom class name for the launcher button */
    launcherClassName?: string;
}
/**
 * Voice chat configuration
 */
interface VoiceChatConfig {
    /** System instruction/prompt for the AI */
    systemPrompt: string;
    /** Welcome message shown when chat opens */
    welcomeMessage?: string;
    /** Suggested questions to show before first message */
    suggestedQuestions?: string[];
    /** localStorage key for session resumption */
    sessionStorageKey?: string;
    /** Whether to reply with audio (default: true) */
    replyAsAudio?: boolean;
    /** Whether to use client-side VAD (default: false, uses server VAD) */
    useClientVAD?: boolean;
    /** Server VAD prefix padding in ms (default: 500) */
    serverVADPrefixPaddingMs?: number;
    /** Server VAD silence duration in ms (default: 1000) */
    serverVADSilenceDurationMs?: number;
    /** Session initialization delay in ms (default: 300) */
    sessionInitDelayMs?: number;
    /** Model ID to use - check https://ai.google.dev/gemini-api/docs/live for available models */
    modelId: string;
    /** Theme configuration */
    theme?: ChatTheme;
    /** Title shown in the chat header */
    chatTitle?: string;
}
/**
 * API handler configuration
 */
interface ChatHandlerConfig {
    /** System instruction/prompt for the AI */
    systemPrompt: string;
    /** Model ID to use (default: gemini-2.0-flash) */
    model?: string;
    /** Initial model acknowledgment message */
    modelAcknowledgment?: string;
}

export type { ChatMessage as C, LiveSession as L, MessageHandler as M, VoiceChatConfig as V, ChatRole as a, ChatTheme as b, ChatHandlerConfig as c };
