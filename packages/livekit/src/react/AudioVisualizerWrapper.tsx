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

function AudioVisualizerInner({ thinkingAudioSrc, thinkingAudioVolume = 0.3 }: AudioVisualizerWrapperProps) {
  const { state, audioTrack, agent } = useVoiceAssistant();
  const transcriptions = useTranscriptions();
  const scrollRef = useRef<HTMLDivElement>(null);
  const thinkingAudioRef = useRef<HTMLAudioElement | null>(null);

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
      <BarVisualizer
        state={state}
        track={audioTrack}
        barCount={5}
        style={{ width: 100, height: 40 }}
      />
      <span style={{ fontSize: 12, color: '#666', textTransform: 'capitalize' }}>
        {state}
      </span>

      {messages.length > 0 && (
        <div
          ref={scrollRef}
          style={{
            width: '100%',
            maxHeight: 300,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 16,
            background: '#0f172a',
            borderRadius: 8,
            border: '1px solid #1e293b',
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
                background: msg.role === 'user' ? '#2563eb' : '#1e293b',
                color: 'white',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {msg.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
