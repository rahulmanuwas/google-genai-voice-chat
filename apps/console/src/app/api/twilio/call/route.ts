import { NextResponse } from 'next/server';
import { getServerEnv } from '../../../../server/env';
import { createRoom, createSipParticipant, createLiveKitToken } from '@genai-voice/livekit/server';

export const runtime = 'nodejs';

interface StartCallRequest {
  to: string;
}

export async function POST(request: Request) {
  try {
    const livekitUrl = getServerEnv('LIVEKIT_URL');
    const livekitApiKey = getServerEnv('LIVEKIT_API_KEY');
    const livekitApiSecret = getServerEnv('LIVEKIT_API_SECRET');
    const trunkId = getServerEnv('LIVEKIT_SIP_TRUNK_ID');
    const fromNumber = getServerEnv('TWILIO_FROM_NUMBER');

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret || !trunkId) {
      return NextResponse.json(
        {
          error:
            'Server misconfigured: missing LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_SIP_TRUNK_ID',
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as Partial<StartCallRequest>;
    const to = typeof body.to === 'string' ? body.to.trim() : '';

    if (!to || !to.startsWith('+')) {
      return NextResponse.json(
        { error: 'Invalid "to" number. Use E.164 format (e.g. +15551234567).' },
        { status: 400 },
      );
    }

    const roomName = `pstn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Step 1: Create a LiveKit room (server API)
    await createRoom({
      roomName,
      serverUrl: livekitUrl,
      apiKey: livekitApiKey,
      apiSecret: livekitApiSecret,
      maxParticipants: 4,
    });

    // Step 2: Dial the phone number via LiveKit SIP (Twilio trunk) and bridge into the room
    const participant = await createSipParticipant({
      trunkId,
      to,
      roomName,
      serverUrl: livekitUrl,
      apiKey: livekitApiKey,
      apiSecret: livekitApiSecret,
      fromNumber,
      participantIdentity: `pstn-${to}`,
      participantName: to,
      waitUntilAnswered: false,
    });

    // Step 3: Generate a viewer token so the browser can join the room and see transcriptions
    const viewerIdentity = `viewer-${Math.random().toString(36).slice(2, 8)}`;
    const viewerToken = await createLiveKitToken({
      roomName,
      identity: viewerIdentity,
      name: 'Call Monitor',
      apiKey: livekitApiKey,
      apiSecret: livekitApiSecret,
    });

    return NextResponse.json({
      roomName,
      participant,
      viewerToken,
      serverUrl: livekitUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('invalid API key for domain')) {
      return NextResponse.json(
        {
          error: msg,
          hint:
            'LIVEKIT_API_KEY/LIVEKIT_API_SECRET must belong to the same LiveKit Cloud project as LIVEKIT_URL and LIVEKIT_SIP_TRUNK_ID.',
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: msg || 'Failed to start call' },
      { status: 500 },
    );
  }
}
