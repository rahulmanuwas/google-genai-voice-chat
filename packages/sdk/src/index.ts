// React components and hooks (browser-safe)
// For server utilities, use @genai-voice/sdk/server
// For the voice agent, use @genai-voice/sdk/agent
// For shared protocol types, use @genai-voice/sdk/core
// For telephony adapters, use @genai-voice/sdk/telephony
export {
  useLiveKitVoiceChat,
  createConvexRoomCallbacks,
  LiveKitVoiceChat,
  AudioVisualizerWrapper,
  ConversationEventBridge,
} from './react/index';

export type {
  UseLiveKitVoiceChatOptions,
  UseLiveKitVoiceChatReturn,
  LiveKitRoomCallbacks,
  ConvexRoomConfig,
  LiveKitVoiceChatProps,
  AudioVisualizerWrapperProps,
  ConversationEventBridgeProps,
  AgentState,
  TranscriptMessage,
  ConversationEventCallbacks,
  TranscriptHandle,
  PersonaUIStrings,
} from './react/index';
