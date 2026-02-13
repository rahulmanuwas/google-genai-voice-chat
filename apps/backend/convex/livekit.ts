import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest } from "./helpers";

/** POST /api/livekit/token — Generate a LiveKit access token */
export const generateToken = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, roomName, identity, name, ttl } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    roomName: string;
    identity: string;
    name?: string;
    ttl?: number;
  };

  if (!roomName || !identity) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const token = await ctx.runAction(internal.livekitInternal.generateToken, {
    roomName,
    identity,
    name,
    ttl,
  });

  return jsonResponse({ token, serverUrl: process.env.LIVEKIT_URL });
});

/** POST /api/livekit/rooms — Create a room record */
export const createRoom = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, sessionId, config, metadata } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    sessionId: string;
    config?: {
      maxParticipants?: number;
      emptyTimeout?: number;
      enableRecording?: boolean;
    };
    metadata?: Record<string, unknown>;
  };

  if (!sessionId) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const roomName = `${auth.app.slug}-${sessionId}-${Date.now()}`;
  const maxParticipants = config?.maxParticipants ?? 2;
  const emptyTimeout = config?.emptyTimeout ?? 300;

  // Create the room on LiveKit server
  await ctx.runAction(internal.livekitInternal.createLiveKitServerRoom, {
    roomName,
    emptyTimeout,
    maxParticipants,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });

  // Store the room record in Convex
  const roomId = await ctx.runMutation(internal.livekitDb.createRoom, {
    appSlug: auth.app.slug,
    roomName,
    sessionId,
    maxParticipants,
    emptyTimeout,
    enableRecording: config?.enableRecording ?? false,
  });

  return jsonResponse({ roomId, roomName, sessionId });
});

/** GET /api/livekit/rooms — List active rooms */
export const listRooms = httpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const rooms = await ctx.runQuery(internal.livekitDb.listActiveRooms, {
    appSlug: auth.app.slug,
  });

  return jsonResponse({ rooms });
});

/** POST /api/livekit/webhook — Handle LiveKit webhook events (uses LiveKit's own auth) */
export const handleWebhook = httpAction(async (ctx, request) => {
  const body = await request.text();
  const authHeader = request.headers.get("Authorization") ?? "";

  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  let event: {
    event?: string;
    room?: { name?: string };
    participant?: { identity?: string; name?: string };
  };

  try {
    event = await ctx.runAction(internal.livekitInternal.validateWebhook, {
      body,
      authHeader,
    }) as typeof event;
  } catch {
    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  if (event.event && event.room?.name) {
    await ctx.runMutation(internal.livekitDb.handleWebhookEvent, {
      event: event.event,
      roomName: event.room.name,
      participantIdentity: event.participant?.identity,
      participantName: event.participant?.name,
    });
  }

  return jsonResponse({ ok: true });
});

/** DELETE /api/livekit/rooms — End a room */
export const endRoom = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, roomName } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    roomName: string;
  };

  if (!roomName) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const room = await ctx.runQuery(internal.livekitDb.getRoomByName, {
    roomName,
  });

  if (!room) {
    return jsonResponse({ error: "Room not found" }, 404);
  }

  // Close the room on LiveKit server
  await ctx.runAction(internal.livekitInternal.deleteLiveKitServerRoom, {
    roomName,
  });

  // Update the room record in Convex
  await ctx.runMutation(internal.livekitDb.updateRoom, {
    roomId: room._id,
    status: "ended",
    endedAt: Date.now(),
  });

  return jsonResponse({ ok: true });
});
