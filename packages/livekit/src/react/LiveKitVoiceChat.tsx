import React, { useEffect, useRef, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import {
  useLiveKitVoiceChat,
  type UseLiveKitVoiceChatOptions,
} from './useLiveKitVoiceChat';
import { AudioVisualizerWrapper } from './AudioVisualizerWrapper';
import { ConversationEventBridge } from './ConversationEventBridge';
import type {
  ConversationEventCallbacks,
  TranscriptHandle,
  PersonaUIStrings,
} from './types';

export interface LiveKitVoiceChatProps
  extends UseLiveKitVoiceChatOptions,
    ConversationEventCallbacks {
  /** Custom CSS class for the container */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** URL of an audio file to loop while the agent is thinking */
  thinkingAudioSrc?: string;
  /** Volume for the thinking audio (0–1, default 0.3) */
  thinkingAudioVolume?: number;
  /** Imperative ref for transcript export */
  transcriptRef?: React.RefObject<TranscriptHandle | null>;
  /** Server-driven UI strings (overrides defaults) */
  uiStrings?: PersonaUIStrings;
}

const ACCENT = '#E8960D';

/**
 * Ready-to-use voice chat component backed by LiveKit.
 * Handles room creation, token management, and renders audio controls.
 */
export function LiveKitVoiceChat({
  className,
  style,
  thinkingAudioSrc,
  thinkingAudioVolume,
  transcriptRef,
  uiStrings,
  // Event callbacks
  onAgentStateChange,
  onTranscript,
  onConversationEnd,
  onHandoff,
  // Everything else → hook options
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

  // Fetch persona UI strings on mount if callbacks support it
  const [remoteStrings, setRemoteStrings] = useState<PersonaUIStrings | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    const cb = options.callbacks;
    if (cb?.fetchPersona) {
      fetchedRef.current = true;
      cb.fetchPersona()
        .then((strings) => setRemoteStrings(strings))
        .catch(() => {});
    }
  }, [options.callbacks]);

  // Merge: prop uiStrings > remote strings > defaults
  const strings = { ...remoteStrings, ...uiStrings };

  if (error) {
    return (
      <div className={className} style={{ color: '#ef4444', fontSize: 14, ...style }}>
        {strings.errorMessage ?? `Error: ${error}`}
      </div>
    );
  }

  if (!isReady || !token || !serverUrl) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', ...style }}>
        <button
          onClick={connect}
          disabled={isConnecting}
          style={{
            padding: '12px 28px',
            borderRadius: 24,
            border: 'none',
            backgroundColor: ACCENT,
            color: '#0a0a0a',
            fontSize: 14,
            fontWeight: 600,
            cursor: isConnecting ? 'wait' : 'pointer',
            opacity: isConnecting ? 0.7 : 1,
            transition: 'all 150ms ease',
            boxShadow: `0 0 20px ${ACCENT}33`,
          }}
        >
          {isConnecting
            ? (strings.connectingText ?? 'Connecting...')
            : (strings.connectButtonText ?? 'Start Voice Chat')}
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
        <ConversationEventBridge
          ref={transcriptRef}
          onAgentStateChange={onAgentStateChange}
          onTranscript={onTranscript}
          onConversationEnd={onConversationEnd}
          onHandoff={onHandoff}
        />
        <AudioVisualizerWrapper
          thinkingAudioSrc={thinkingAudioSrc}
          thinkingAudioVolume={thinkingAudioVolume}
          accentColor={ACCENT}
        />
        <button
          onClick={disconnect}
          style={{
            padding: '8px 20px',
            borderRadius: 20,
            border: '1px solid hsl(0 0% 20%)',
            backgroundColor: 'transparent',
            color: 'hsl(0 0% 55%)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#ef4444';
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'hsl(0 0% 20%)';
            e.currentTarget.style.color = 'hsl(0 0% 55%)';
          }}
        >
          {strings.disconnectButtonText ?? 'End Session'}
        </button>
      </LiveKitRoom>
    </div>
  );
}
