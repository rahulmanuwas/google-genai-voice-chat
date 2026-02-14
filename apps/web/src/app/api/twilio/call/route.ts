import { NextResponse } from 'next/server';
import { getServerEnv } from '../../../../server/env';
import { createRoom, createSipParticipant, createLiveKitToken } from '@genai-voice/sdk/server';

export const runtime = 'nodejs';

interface StartCallRequest {
  to: string;
  appSlug?: string;
  agentMode?: 'realtime' | 'pipeline';
}

const E164_NUMBER_REGEX = /^\+[1-9]\d{7,14}$/;

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
    const appSlug = typeof body.appSlug === 'string' && body.appSlug ? body.appSlug : undefined;
    const agentMode = body.agentMode === 'pipeline' ? 'pipeline' : 'realtime';
    const defaultSlug = getServerEnv('NEXT_PUBLIC_APP_SLUG') ?? 'demo';

    if (!E164_NUMBER_REGEX.test(to)) {
      return NextResponse.json(
        { error: 'Invalid "to" number. Use E.164 format (e.g. +15551234567).' },
        { status: 400 },
      );
    }

    // Room name must include appSlug + "-session-" marker so the agent's
    // parseRoomName() can extract the correct appSlug for persona loading.
    const slug = appSlug ?? defaultSlug;
    const roomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const roomName = `${slug}-session-${Date.now()}-${roomSuffix}-pstn`;

    await createRoom({
      roomName,
      serverUrl: livekitUrl,
      apiKey: livekitApiKey,
      apiSecret: livekitApiSecret,
      maxParticipants: 4,
      metadata: JSON.stringify({ ...(appSlug ? { appSlug } : {}), agentMode }),
    });

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
      waitUntilAnswered: true,
    });

    const viewerIdentity = `viewer-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
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
