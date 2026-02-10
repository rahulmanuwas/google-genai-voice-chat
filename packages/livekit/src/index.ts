// React components and hooks (browser-safe)
// For server utilities, use @genai-voice/livekit/server
// For the voice agent, use @genai-voice/livekit/agent
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
