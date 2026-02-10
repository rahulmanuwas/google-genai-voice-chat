'use client';

import { useEffect, useRef } from 'react';
import { LiveKitRoom, useRemoteParticipants } from '@livekit/components-react';
import { AudioVisualizerWrapper } from '@genai-voice/livekit';

interface CallRoomProps {
  token: string;
  serverUrl: string;
  onCallEnded?: () => void;
}

/** Detects when the PSTN participant (callee) leaves the room. */
function PstnParticipantWatcher({ onCallEnded }: { onCallEnded?: () => void }) {
  const participants = useRemoteParticipants();
  const hadPstn = useRef(false);

  useEffect(() => {
    const hasPstn = participants.some((p) => p.identity.startsWith('pstn-'));
    if (hasPstn) {
      hadPstn.current = true;
    } else if (hadPstn.current) {
      // PSTN participant was here but is now gone — callee hung up
      onCallEnded?.();
    }
  }, [participants, onCallEnded]);

  return null;
}

export default function CallRoom({ token, serverUrl, onCallEnded }: CallRoomProps) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      audio={false}
      connectOptions={{ autoSubscribe: true }}
      onDisconnected={onCallEnded}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
    >
      <PstnParticipantWatcher onCallEnded={onCallEnded} />
      <AudioVisualizerWrapper thinkingAudioSrc="/chieuk-thinking-289286.mp3" />
    </LiveKitRoom>
  );
}
