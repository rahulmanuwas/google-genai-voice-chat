import React from 'react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import {
  useLiveKitVoiceChat,
  type UseLiveKitVoiceChatOptions,
} from './useLiveKitVoiceChat';
import { AudioVisualizerWrapper } from './AudioVisualizerWrapper';

export interface LiveKitVoiceChatProps extends UseLiveKitVoiceChatOptions {
  /** Custom CSS class for the container */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
}

/**
 * Ready-to-use voice chat component backed by LiveKit.
 * Handles room creation, token management, and renders audio controls.
 */
export function LiveKitVoiceChat({
  className,
  style,
  ...options
}: LiveKitVoiceChatProps) {
  const {
    token,
    serverUrl,
    isReady,
    isConnecting,
    error,
    connect,
    disconnect,
  } = useLiveKitVoiceChat(options);

  if (error) {
    return (
      <div className={className} style={{ color: 'red', ...style }}>
        Error: {error}
      </div>
    );
  }

  if (!isReady || !token || !serverUrl) {
    return (
      <div className={className} style={style}>
        <button
          onClick={connect}
          disabled={isConnecting}
          style={{
            padding: '12px 24px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: '#2563eb',
            color: 'white',
            fontSize: 16,
            cursor: isConnecting ? 'wait' : 'pointer',
            opacity: isConnecting ? 0.7 : 1,
          }}
        >
          {isConnecting ? 'Connecting...' : 'Start Voice Chat'}
        </button>
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        audio={true}
        connectOptions={{ autoSubscribe: true }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
      >
        <RoomAudioRenderer />
        <AudioVisualizerWrapper />
        <button
          onClick={disconnect}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #dc2626',
            backgroundColor: 'transparent',
            color: '#dc2626',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          End Session
        </button>
      </LiveKitRoom>
    </div>
  );
}
