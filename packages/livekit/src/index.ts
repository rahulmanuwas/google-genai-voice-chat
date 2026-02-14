// React components and hooks (browser-safe)
// For server utilities, use @genai-voice/livekit/server
// For the voice agent, use @genai-voice/livekit/agent
// For shared protocol types, use @genai-voice/livekit/core
// For telephony adapters, use @genai-voice/livekit/telephony
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
