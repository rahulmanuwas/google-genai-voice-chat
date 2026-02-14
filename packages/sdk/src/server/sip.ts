import { SipClient } from 'livekit-server-sdk';

export interface SipOptions {
  /** LiveKit API key (defaults to LIVEKIT_API_KEY env var) */
  apiKey?: string;
  /** LiveKit API secret (defaults to LIVEKIT_API_SECRET env var) */
  apiSecret?: string;
  /**
   * LiveKit server URL for server APIs (defaults to LIVEKIT_URL env var).
   * For LiveKit Cloud, this should be an HTTPS URL, e.g. `https://<project>.livekit.cloud`.
   */
  serverUrl?: string;
}

export interface CreateSipParticipantOptions extends SipOptions {
  /** LiveKit SIP trunk ID (e.g. ST_xxx) */
  trunkId: string;
  /** E.164 phone number to dial (e.g. +15551234567) */
  to: string;
  /** Room to attach the call to */
  roomName: string;
  /** Caller ID / from number (if configured on the trunk) */
  fromNumber?: string;
  /** Participant identity in the LiveKit room (default: sip-participant) */
  participantIdentity?: string;
  /** Participant display name */
  participantName?: string;
  /** Wait until the callee answers (default: false) */
  waitUntilAnswered?: boolean;
}

function getClient(options?: SipOptions): SipClient {
  const url = options?.serverUrl ?? process.env.LIVEKIT_URL;
  const apiKey = options?.apiKey ?? process.env.LIVEKIT_API_KEY;
  const apiSecret = options?.apiSecret ?? process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error('LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set');
  }

  return new SipClient(url, apiKey, apiSecret);
}

/**
 * Create a SIP participant that dials a phone number and bridges it into a LiveKit room.
 * This uses LiveKit's SIP service (which can be backed by a Twilio SIP trunk).
 */
export async function createSipParticipant(options: CreateSipParticipantOptions) {
  const client = getClient(options);

  return await client.createSipParticipant(
    options.trunkId,
    options.to,
    options.roomName,
    {
      fromNumber: options.fromNumber,
      participantIdentity: options.participantIdentity,
      participantName: options.participantName,
      waitUntilAnswered: options.waitUntilAnswered ?? false,
    },
  );
}

