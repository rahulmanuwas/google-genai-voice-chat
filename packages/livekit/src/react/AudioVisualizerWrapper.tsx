import { useRef, useEffect } from 'react';
import {
  useVoiceAssistant,
  useTranscriptions,
  BarVisualizer,
  useMaybeRoomContext,
} from '@livekit/components-react';

export interface AudioVisualizerWrapperProps {
  /** URL of an audio file to loop while the agent is thinking (e.g. "/thinking.mp3") */
  thinkingAudioSrc?: string;
  /** Volume for the thinking audio (0–1, default 0.3) */
  thinkingAudioVolume?: number;
  /** Brand accent color (default: #E8960D) */
  accentColor?: string;
}

/**
 * Wrapper around LiveKit's BarVisualizer that shows the voice agent's
 * audio track with a state indicator and live transcriptions.
 *
 * Guards against being rendered outside a LiveKitRoom context.
 */
export function AudioVisualizerWrapper(props: AudioVisualizerWrapperProps) {
  const room = useMaybeRoomContext();
  if (!room) return null;
  return <AudioVisualizerInner {...props} />;
}

const STATE_CONFIG: Record<string, { label: string; color: string; pulse: boolean }> = {
  listening: { label: 'Listening', color: '#ef4444', pulse: true },
  thinking: { label: 'Thinking', color: '#f59e0b', pulse: true },
  speaking: { label: 'Speaking', color: '#22c55e', pulse: false },
  idle: { label: 'Ready', color: '#6b7280', pulse: false },
  initializing: { label: 'Initializing', color: '#6b7280', pulse: true },
  connecting: { label: 'Connecting', color: '#6b7280', pulse: true },
  'pre-connect-buffering': { label: 'Buffering', color: '#6b7280', pulse: true },
  disconnected: { label: 'Disconnected', color: '#6b7280', pulse: false },
  failed: { label: 'Failed', color: '#ef4444', pulse: false },
};

function AudioVisualizerInner({ thinkingAudioSrc, thinkingAudioVolume = 0.3, accentColor = '#E8960D' }: AudioVisualizerWrapperProps) {
  const { state, audioTrack, agent } = useVoiceAssistant();
  const transcriptions = useTranscriptions();
  const scrollRef = useRef<HTMLDivElement>(null);
  const thinkingAudioRef = useRef<HTMLAudioElement | null>(null);

  const config = STATE_CONFIG[state] ?? STATE_CONFIG.idle;

  // Play/stop thinking audio based on agent state
  useEffect(() => {
    if (!thinkingAudioSrc) return;

    if (state === 'thinking') {
      if (!thinkingAudioRef.current) {
        const audio = new Audio(thinkingAudioSrc);
        audio.loop = true;
        audio.volume = thinkingAudioVolume;
        thinkingAudioRef.current = audio;
      }
      thinkingAudioRef.current.volume = thinkingAudioVolume;
      thinkingAudioRef.current.play().catch(() => {
        // Autoplay might be blocked — ignore
      });
    } else {
      if (thinkingAudioRef.current) {
        thinkingAudioRef.current.pause();
        thinkingAudioRef.current.currentTime = 0;
      }
    }
  }, [state, thinkingAudioSrc, thinkingAudioVolume]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (thinkingAudioRef.current) {
        thinkingAudioRef.current.pause();
        thinkingAudioRef.current = null;
      }
    };
  }, []);

  const agentIdentity = agent?.identity;

  // Map transcriptions to messages with role info, sorted by timestamp
  const messages = transcriptions
    .map((t) => ({
      role: (t.participantInfo.identity === agentIdentity ? 'agent' : 'user') as 'user' | 'agent',
      // Strip <noise> tags that Gemini outputs for low-quality telephony audio
      text: t.text.replace(/<noise>/gi, '').trim(),
      id: t.streamInfo.id,
      timestamp: t.streamInfo.timestamp,
    }))
    .filter((m) => m.text)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-30);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      {/* State indicator + visualizer */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <BarVisualizer
          state={state}
          track={audioTrack}
          barCount={5}
          style={{ width: 120, height: 48 }}
          options={{
            minHeight: 4,
          }}
        />

        {/* Recording-style state indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 20,
          backgroundColor: `${config.color}12`,
          border: `1px solid ${config.color}30`,
          transition: 'all 150ms ease',
        }}>
          {/* Pulsing dot */}
          <span style={{
            position: 'relative',
            display: 'inline-flex',
            width: 8,
            height: 8,
          }}>
            {config.pulse && (
              <span style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                backgroundColor: config.color,
                opacity: 0.6,
                animation: 'lk-pulse 1.5s ease-in-out infinite',
              }} />
            )}
            <span style={{
              position: 'relative',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: config.color,
            }} />
          </span>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: config.color,
          }}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Transcript */}
      {messages.length > 0 && (
        <div
          ref={scrollRef}
          style={{
            width: '100%',
            maxHeight: 300,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 16,
            background: 'hsl(0 0% 5%)',
            borderRadius: 12,
            border: '1px solid hsl(0 0% 10%)',
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '8px 14px',
                borderRadius: 12,
                background: msg.role === 'user' ? accentColor : 'hsl(0 0% 10%)',
                color: msg.role === 'user' ? 'hsl(0 0% 5%)' : 'hsl(0 0% 90%)',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {msg.text}
            </div>
          ))}
        </div>
      )}

      {/* Keyframe injection — only once */}
      <style>{`
        @keyframes lk-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
