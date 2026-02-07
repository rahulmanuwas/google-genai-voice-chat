'use client';

import { LiveKitRoom } from '@livekit/components-react';
import { AudioVisualizerWrapper } from '@genai-voice/livekit';

interface CallRoomProps {
  token: string;
  serverUrl: string;
}

export default function CallRoom({ token, serverUrl }: CallRoomProps) {
  // Convert wss:// to proper format if needed — LiveKitRoom accepts both
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      audio={false}
      connectOptions={{ autoSubscribe: true }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
    >
      <AudioVisualizerWrapper />
    </LiveKitRoom>
  );
}
