// React components and hooks (browser-safe)
// For server utilities, use @genai-voice/livekit/server
// For the voice agent, use @genai-voice/livekit/agent
export {
  useLiveKitVoiceChat,
  createConvexRoomCallbacks,
  LiveKitVoiceChat,
  AudioVisualizerWrapper,
} from './react/index';

export type {
  UseLiveKitVoiceChatOptions,
  UseLiveKitVoiceChatReturn,
  LiveKitRoomCallbacks,
  ConvexRoomConfig,
  LiveKitVoiceChatProps,
} from './react/index';
