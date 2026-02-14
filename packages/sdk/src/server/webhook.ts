import { WebhookReceiver } from 'livekit-server-sdk';

export interface WebhookResult {
  event: string;
  room?: {
    name: string;
    sid: string;
  };
  participant?: {
    identity: string;
    name: string;
    sid: string;
  };
  /** Raw parsed event data */
  raw: Record<string, unknown>;
}

export interface WebhookOptions {
  /** LiveKit API key (defaults to LIVEKIT_API_KEY env var) */
  apiKey?: string;
  /** LiveKit API secret (defaults to LIVEKIT_API_SECRET env var) */
  apiSecret?: string;
}

/**
 * Validate and parse a LiveKit webhook request.
 * Verifies the signature using the API key/secret.
 */
export async function handleLiveKitWebhook(
  body: string,
  authHeader: string,
  options?: WebhookOptions,
): Promise<WebhookResult> {
  const apiKey = options?.apiKey ?? process.env.LIVEKIT_API_KEY;
  const apiSecret = options?.apiSecret ?? process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set');
  }

  const receiver = new WebhookReceiver(apiKey, apiSecret);
  const event = await receiver.receive(body, authHeader);

  const raw = event as unknown as Record<string, unknown>;

  return {
    event: (raw.event as string) ?? '',
    room: raw.room
      ? {
          name: (raw.room as Record<string, string>).name,
          sid: (raw.room as Record<string, string>).sid,
        }
      : undefined,
    participant: raw.participant
      ? {
          identity: (raw.participant as Record<string, string>).identity,
          name: (raw.participant as Record<string, string>).name,
          sid: (raw.participant as Record<string, string>).sid,
        }
      : undefined,
    raw,
  };
}
