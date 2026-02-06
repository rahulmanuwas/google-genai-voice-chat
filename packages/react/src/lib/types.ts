// src/lib/types.ts

import type { LiveServerMessage } from '@google/genai';
import type { StartSensitivity, EndSensitivity } from '@google/genai';

/**
 * Chat message role
 */
export type ChatRole = 'user' | 'model' | 'system';

/**
 * Chat message structure
 */
export interface ChatMessage {
    id: string;
    content: string;
    role: ChatRole;
    ts: number;
}

/**
 * Live session interface (subset of Google GenAI session)
 */
export interface LiveSession {
    sendClientContent: (content: { turns: string; turnComplete: boolean }) => void;
    sendRealtimeInput: (input: { audioStreamEnd?: boolean; audio?: { data: string; mimeType: string } }) => void;
    close: () => void;
}

/**
 * Message handler type
 */
export type MessageHandler = (msg: LiveServerMessage) => void;

/**
 * Audio drop policy when queues overflow
 */
export type AudioDropPolicy = 'drop-oldest' | 'drop-newest' | 'drop-all';

/**
 * Debug/telemetry event emitted by the voice chat hooks
 */
export interface VoiceChatEvent {
    type: string;
    ts: number;
    data?: Record<string, unknown>;
}

/**
 * Theme configuration for the chat component
 */
export interface ChatTheme {
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
export interface VoiceChatConfig {
    /** System instruction/prompt for the AI */
    systemPrompt: string;

    /** Welcome message shown when chat opens */
    welcomeMessage?: string;

    /** Suggested questions to show before first message */
    suggestedQuestions?: string[];

    /** localStorage key for session resumption */
    sessionStorageKey?: string;

    /** Max age for stored session handle (ms); 0 disables TTL */
    sessionHandleTtlMs?: number;

    /** Whether to reply with audio (default: true) */
    replyAsAudio?: boolean;

    /** Whether to use client-side VAD (default: false, uses server VAD) */
    useClientVAD?: boolean;

    /** Server VAD prefix padding in ms (default: 500) */
    serverVADPrefixPaddingMs?: number;

    /** Server VAD silence duration in ms (default: 1000) */
    serverVADSilenceDurationMs?: number;

    /** Server VAD start sensitivity (default: LOW) */
    serverVADStartSensitivity?: StartSensitivity;

    /** Server VAD end sensitivity (default: HIGH) */
    serverVADEndSensitivity?: EndSensitivity;

    /** Session initialization delay in ms (default: 300) */
    sessionInitDelayMs?: number;

    /** Timeout for initial connection (ms) */
    connectTimeoutMs?: number;

    /** Max reconnection attempts before giving up */
    reconnectMaxRetries?: number;

    /** Base delay for reconnection backoff (ms) */
    reconnectBaseDelayMs?: number;

    /** Backoff multiplier for reconnection attempts */
    reconnectBackoffFactor?: number;

    /** Max delay cap for reconnection backoff (ms) */
    reconnectMaxDelayMs?: number;

    /** Jitter percentage applied to reconnect delays (0-1) */
    reconnectJitterPct?: number;

    /** Delay before starting mic after AI playback completes (ms) */
    micResumeDelayMs?: number;

    /** Delay before starting playback to buffer audio chunks (ms) */
    playbackStartDelayMs?: number;

    /** Playback AudioContext sample rate (default: 24000) */
    playbackSampleRate?: number;

    /** Max number of messages to keep in memory (0 disables cap) */
    maxMessages?: number;

    /** Max characters to keep per transcript/message (0 disables cap) */
    maxTranscriptChars?: number;

    /** Max queued playback audio in ms before dropping (0 disables cap) */
    maxOutputQueueMs?: number;

    /** Max queued playback chunks before dropping (0 disables cap) */
    maxOutputQueueChunks?: number;

    /** Drop policy when output queue overflows */
    outputDropPolicy?: AudioDropPolicy;

    /** Max consecutive input send errors before stopping mic */
    maxConsecutiveInputErrors?: number;

    /** Cooldown after an input send error (ms) */
    inputErrorCooldownMs?: number;

    /** Minimum interval between audio input sends (ms) */
    inputMinSendIntervalMs?: number;

    /** Max queued input audio in ms before dropping (0 disables cap) */
    inputMaxQueueMs?: number;

    /** Max queued input chunks before dropping (0 disables cap) */
    inputMaxQueueChunks?: number;

    /** Drop policy when input queue overflows */
    inputDropPolicy?: AudioDropPolicy;

    /** Clear stored session handle on mount (default: true) */
    clearSessionOnMount?: boolean;

    /** Prefer AudioWorklet for mic capture when available */
    preferAudioWorklet?: boolean;

    /** AudioWorklet/ScriptProcessor buffer size (samples) */
    audioWorkletBufferSize?: number;

    /** Restart mic automatically on device change */
    restartMicOnDeviceChange?: boolean;

    /** Voice configuration for native audio output */
    speechConfig?: Record<string, unknown>;

    /** Thinking configuration for native audio output */
    thinkingConfig?: {
        thinkingBudget?: number;
        includeThoughts?: boolean;
    };

    /** Enable affective dialog (v1alpha only) */
    enableAffectiveDialog?: boolean;

    /** Proactive audio settings (v1alpha only) */
    proactivity?: Record<string, unknown>;

    /** Automatically pause mic when sending text (default: true) */
    autoPauseMicOnSendText?: boolean;

    /** Speak a welcome message on connect */
    autoWelcomeAudio?: boolean;

    /** Prompt used to generate the welcome audio */
    welcomeAudioPrompt?: string;

    /** Auto-start mic after connecting (default: true) */
    autoStartMicOnConnect?: boolean;

    /** Model ID to use - check https://ai.google.dev/gemini-api/docs/live for available models */
    modelId: string;

    /** Theme configuration */
    theme?: ChatTheme;

    /** Title shown in the chat header */
    chatTitle?: string;

    /** Optional debug/event hook */
    onEvent?: (event: VoiceChatEvent) => void;

    /** HTTP options passed to GoogleGenAI constructor (e.g. { apiVersion: 'v1alpha' } for ephemeral tokens) */
    httpOptions?: { apiVersion?: string; baseUrl?: string; headers?: Record<string, string>; timeout?: number };
}

/**
 * Runtime stats snapshot
 */
export interface VoiceChatStats {
    ts: number;
    session: {
        isConnected: boolean;
        isReconnecting: boolean;
        reconnectAttempts: number;
        lastConnectAttemptAt: number | null;
        lastDisconnectCode: number | null;
        lastDisconnectReason: string | null;
    };
    input: {
        isListening: boolean;
        queueMs: number;
        queueChunks: number;
        droppedChunks: number;
        droppedMs: number;
        sendErrorStreak: number;
        blockedUntil: number;
        lastSendAt: number;
        usingWorklet: boolean;
    };
    output: {
        isPlaying: boolean;
        queueMs: number;
        queueChunks: number;
        droppedChunks: number;
        droppedMs: number;
        contextState: AudioContextState | 'none';
    };
}

/**
 * API handler configuration
 */
export interface ChatHandlerConfig {
    /** System instruction/prompt for the AI */
    systemPrompt: string;

    /** Model ID to use (default: gemini-2.0-flash) */
    model?: string;

    /** Initial model acknowledgment message */
    modelAcknowledgment?: string;
}
