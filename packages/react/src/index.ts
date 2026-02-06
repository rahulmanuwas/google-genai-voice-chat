// src/index.ts

// Components
export { ChatBot } from './components/ChatBot';
export { ChatMessage } from './components/ChatMessage';

// Hooks
export { useVoiceChat } from './hooks/useVoiceChat';
export { useLiveSession } from './hooks/useLiveSession';
export { useVoiceInput } from './hooks/useVoiceInput';
export { useVoiceOutput } from './hooks/useVoiceOutput';

// Types
export type {
    ChatMessage as ChatMessageType,
    ChatRole,
    VoiceChatConfig,
    VoiceChatEvent,
    AudioDropPolicy,
    VoiceChatStats,
    ChatTheme,
    ChatHandlerConfig,
    LiveSession,
    MessageHandler,
} from './lib/types';

// Utilities
export { mergeConfig, DEFAULT_CONFIG, AUDIO_CONFIG, STABLE_PRESET } from './lib/constants';

// Telemetry
export { createConvexHelper, useTelemetry } from './telemetry';
export type { ConvexHelperConfig, EventPayload, MessagePayload } from './telemetry';
