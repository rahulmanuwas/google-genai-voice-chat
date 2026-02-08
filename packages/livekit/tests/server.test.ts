import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  AccessToken,
  RoomServiceClient,
  SipClient,
  WebhookReceiver,
} from 'livekit-server-sdk';

import { createLiveKitToken } from '../src/server/token';
import { createRoom, deleteRoom } from '../src/server/room';
import { createSipParticipant } from '../src/server/sip';
import { handleLiveKitWebhook } from '../src/server/webhook';

function withEnv<T>(patch: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(patch)) {
    prev[k] = process.env[k];
    const v = patch[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(patch)) {
      const v = prev[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('livekit server utils', () => {
  test('createLiveKitToken throws if apiKey/apiSecret are missing', async () => {
    await withEnv(
      { LIVEKIT_API_KEY: undefined, LIVEKIT_API_SECRET: undefined },
      async () => {
        await assert.rejects(
          () => createLiveKitToken({ roomName: 'room', identity: 'id' }),
          /LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set/,
        );
      },
    );
  });

  test('createLiveKitToken attaches roomConfig as metadata', async () => {
    const originalToJwt = AccessToken.prototype.toJwt;
    const originalAddGrant = AccessToken.prototype.addGrant;

    let seenMetadata: unknown;
    let seenGrant: unknown;

    AccessToken.prototype.addGrant = function (grant: unknown) {
      seenGrant = grant;
      // livekit-server-sdk returns void here, but we keep "this" for safety.
      return this as unknown as void;
    } as unknown as typeof AccessToken.prototype.addGrant;

    AccessToken.prototype.toJwt = async function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seenMetadata = (this as any).metadata;
      return 'jwt-token';
    } as unknown as typeof AccessToken.prototype.toJwt;

    try {
      const roomConfig = { appSlug: 'demo', sessionId: 'ses_123' };
      const jwt = await createLiveKitToken({
        apiKey: 'k',
        apiSecret: 's',
        roomName: 'room-abc',
        identity: 'user-1',
        name: 'Jane',
        ttl: 123,
        roomConfig,
      });

      assert.equal(jwt, 'jwt-token');
      assert.equal(seenMetadata, JSON.stringify(roomConfig));
      assert.deepEqual(seenGrant, {
        room: 'room-abc',
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      });
    } finally {
      AccessToken.prototype.toJwt = originalToJwt;
      AccessToken.prototype.addGrant = originalAddGrant;
    }
  });

  test('createRoom throws if env is missing and options not provided', async () => {
    await withEnv(
      {
        LIVEKIT_URL: undefined,
        LIVEKIT_API_KEY: undefined,
        LIVEKIT_API_SECRET: undefined,
      },
      async () => {
        await assert.rejects(
          // @ts-expect-error: intentional missing auth for test
          () => createRoom({ roomName: 'x' }),
          /LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set/,
        );
      },
    );
  });

  test('createRoom passes defaults and overrides to RoomServiceClient', async () => {
    const originalCreateRoom = RoomServiceClient.prototype.createRoom;
    let seen: unknown;
    RoomServiceClient.prototype.createRoom = async function (opts: unknown) {
      seen = opts;
      return { name: (opts as { name: string }).name };
    } as unknown as typeof RoomServiceClient.prototype.createRoom;

    try {
      await createRoom({
        serverUrl: 'https://lk.example',
        apiKey: 'k',
        apiSecret: 's',
        roomName: 'room-1',
      });
      assert.deepEqual(seen, {
        name: 'room-1',
        maxParticipants: 2,
        emptyTimeout: 300,
        metadata: undefined,
      });

      await createRoom({
        serverUrl: 'https://lk.example',
        apiKey: 'k',
        apiSecret: 's',
        roomName: 'room-2',
        maxParticipants: 5,
        emptyTimeout: 42,
        metadata: '{"a":1}',
      });
      assert.deepEqual(seen, {
        name: 'room-2',
        maxParticipants: 5,
        emptyTimeout: 42,
        metadata: '{"a":1}',
      });
    } finally {
      RoomServiceClient.prototype.createRoom = originalCreateRoom;
    }
  });

  test('deleteRoom calls RoomServiceClient.deleteRoom', async () => {
    const originalDeleteRoom = RoomServiceClient.prototype.deleteRoom;
    let seenRoom: unknown;
    RoomServiceClient.prototype.deleteRoom = async function (roomName: string) {
      seenRoom = roomName;
    } as unknown as typeof RoomServiceClient.prototype.deleteRoom;

    try {
      await deleteRoom('room-x', {
        serverUrl: 'https://lk.example',
        apiKey: 'k',
        apiSecret: 's',
      });
      assert.equal(seenRoom, 'room-x');
    } finally {
      RoomServiceClient.prototype.deleteRoom = originalDeleteRoom;
    }
  });

  test('createSipParticipant passes args to SipClient.createSipParticipant', async () => {
    const originalCreateSipParticipant = SipClient.prototype.createSipParticipant;
    let seen: unknown[] | undefined;
    SipClient.prototype.createSipParticipant = async function (
      trunkId: string,
      to: string,
      roomName: string,
      opts: unknown,
    ) {
      seen = [trunkId, to, roomName, opts];
      return { ok: true };
    } as unknown as typeof SipClient.prototype.createSipParticipant;

    try {
      const res = await createSipParticipant({
        serverUrl: 'https://lk.example',
        apiKey: 'k',
        apiSecret: 's',
        trunkId: 'ST_123',
        to: '+15551234567',
        roomName: 'room-abc',
        fromNumber: '+15550001111',
        participantIdentity: 'sip-1',
        participantName: 'Caller',
        waitUntilAnswered: true,
      });
      assert.deepEqual(res, { ok: true });
      assert.deepEqual(seen, [
        'ST_123',
        '+15551234567',
        'room-abc',
        {
          fromNumber: '+15550001111',
          participantIdentity: 'sip-1',
          participantName: 'Caller',
          waitUntilAnswered: true,
        },
      ]);
    } finally {
      SipClient.prototype.createSipParticipant = originalCreateSipParticipant;
    }
  });

  test('handleLiveKitWebhook returns normalized fields', async () => {
    const originalReceive = WebhookReceiver.prototype.receive;
    WebhookReceiver.prototype.receive = async function () {
      return {
        event: 'room_started',
        room: { name: 'r', sid: 'RM_1' },
        participant: { identity: 'u', name: 'User', sid: 'PA_1' },
        extra: { a: 1 },
      };
    } as unknown as typeof WebhookReceiver.prototype.receive;

    try {
      const result = await handleLiveKitWebhook('body', 'auth', {
        apiKey: 'k',
        apiSecret: 's',
      });
      assert.equal(result.event, 'room_started');
      assert.deepEqual(result.room, { name: 'r', sid: 'RM_1' });
      assert.deepEqual(result.participant, { identity: 'u', name: 'User', sid: 'PA_1' });
      assert.equal(typeof result.raw, 'object');
      assert.equal((result.raw.extra as { a: number }).a, 1);
    } finally {
      WebhookReceiver.prototype.receive = originalReceive;
    }
  });
});

