import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** POST /api/livekit/token — Generate a LiveKit access token */
export const generateToken = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { roomName, identity, name, ttl } = body as {
    roomName: string;
    identity: string;
    name?: string;
    ttl?: number;
  };

  if (!roomName || !identity) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const token = await ctx.runAction(internal.livekitInternal.generateTokenAction, {
    roomName,
    identity,
    name,
    ttl,
  });

  return jsonResponse({ token, serverUrl: process.env.LIVEKIT_URL });
});

/** POST /api/livekit/rooms — Create a room record */
export const createRoom = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { sessionId, config, metadata } = body as {
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

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const roomName = `${auth.app.slug}-${sessionId}-${Date.now()}`;
  const maxParticipants = config?.maxParticipants ?? 2;
  const emptyTimeout = config?.emptyTimeout ?? 300;

  // Create the room on LiveKit server
  await ctx.runAction(internal.livekitInternal.createLiveKitServerRoomAction, {
    roomName,
    emptyTimeout,
    maxParticipants,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });

  // Store the room record in Convex
  const roomId = await ctx.runMutation(internal.livekit.createLivekitRoomRecord, {
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
export const listRooms = corsHttpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const rooms = await ctx.runQuery(internal.livekit.listActiveLivekitRoomRecords, {
    appSlug: auth.app.slug,
  });

  return jsonResponse({ rooms });
});

/** POST /api/livekit/webhook — Handle LiveKit webhook events (uses LiveKit's own auth) */
export const handleWebhook = corsHttpAction(async (ctx, request) => {
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
    event = await ctx.runAction(internal.livekitInternal.validateWebhookAction, {
      body,
      authHeader,
    }) as typeof event;
  } catch {
    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  if (event.event && event.room?.name) {
    await ctx.runMutation(internal.livekit.handleLivekitWebhookEventRecord, {
      event: event.event,
      roomName: event.room.name,
      participantIdentity: event.participant?.identity,
      participantName: event.participant?.name,
    });
  }

  return jsonResponse({ ok: true });
});

/** DELETE /api/livekit/rooms — End a room */
export const endRoom = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { roomName } = body as {
    roomName: string;
  };

  if (!roomName) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const room = await ctx.runQuery(internal.livekit.getLivekitRoomRecordByName, {
    roomName,
  });

  if (!room) {
    return jsonResponse({ error: "Room not found" }, 404);
  }

  // Close the room on LiveKit server
  await ctx.runAction(internal.livekitInternal.deleteLiveKitServerRoomAction, {
    roomName,
  });

  // Update the room record in Convex
  await ctx.runMutation(internal.livekit.updateLivekitRoomRecord, {
    roomId: room._id,
    status: "ended",
    endedAt: Date.now(),
  });

  return jsonResponse({ ok: true });
});

/** Create a new room record */
export const createLivekitRoomRecord = internalMutation({
  args: {
    appSlug: v.string(),
    roomName: v.string(),
    sessionId: v.string(),
    maxParticipants: v.float64(),
    emptyTimeout: v.float64(),
    enableRecording: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("livekitRooms", {
      ...args,
      status: "waiting",
      participantCount: 0,
      createdAt: Date.now(),
    });
  },
});

/** Update room status and metadata */
export const updateLivekitRoomRecord = internalMutation({
  args: {
    roomId: v.id("livekitRooms"),
    status: v.optional(v.string()),
    participantCount: v.optional(v.float64()),
    endedAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const { roomId, ...patch } = args;
    const updates: Record<string, unknown> = {};
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.participantCount !== undefined) updates.participantCount = patch.participantCount;
    if (patch.endedAt !== undefined) updates.endedAt = patch.endedAt;
    await ctx.db.patch(roomId, updates);
  },
});

/** Add a participant to a room */
export const addLivekitParticipantRecord = internalMutation({
  args: {
    appSlug: v.string(),
    roomId: v.id("livekitRooms"),
    identity: v.string(),
    name: v.optional(v.string()),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("livekitParticipants", {
      appSlug: args.appSlug,
      roomId: args.roomId,
      identity: args.identity,
      name: args.name,
      role: args.role,
      joinedAt: Date.now(),
    });

    const room = await ctx.db.get(args.roomId);
    if (room) {
      await ctx.db.patch(args.roomId, {
        status: "active",
        participantCount: room.participantCount + 1,
      });
    }
  },
});

/** Remove a participant from a room */
export const removeLivekitParticipantRecord = internalMutation({
  args: {
    roomId: v.id("livekitRooms"),
    identity: v.string(),
  },
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query("livekitParticipants")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const participant = participants.find(
      (entry) => entry.identity === args.identity && !entry.leftAt
    );

    if (participant) {
      await ctx.db.patch(participant._id, { leftAt: Date.now() });
    }

    const room = await ctx.db.get(args.roomId);
    if (room) {
      const newCount = Math.max(0, room.participantCount - 1);
      await ctx.db.patch(args.roomId, {
        participantCount: newCount,
        ...(newCount === 0
          ? { status: "ended" as const, endedAt: Date.now() }
          : {}),
      });
    }
  },
});

/** List active rooms for an app */
export const listActiveLivekitRoomRecords = internalQuery({
  args: { appSlug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("livekitRooms")
      .withIndex("by_app_status", (q) =>
        q.eq("appSlug", args.appSlug).eq("status", "active")
      )
      .collect();
  },
});

/** Get a room by its unique room name */
export const getLivekitRoomRecordByName = internalQuery({
  args: { roomName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("livekitRooms")
      .withIndex("by_room_name", (q) => q.eq("roomName", args.roomName))
      .first();
  },
});

/** Handle a webhook event from LiveKit, updating room/participant state */
export const handleLivekitWebhookEventRecord = internalMutation({
  args: {
    event: v.string(),
    roomName: v.string(),
    participantIdentity: v.optional(v.string()),
    participantName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("livekitRooms")
      .withIndex("by_room_name", (q) => q.eq("roomName", args.roomName))
      .first();

    if (!room) return;

    switch (args.event) {
      case "room_started":
        await ctx.db.patch(room._id, { status: "active" });
        break;

      case "room_finished":
        await ctx.db.patch(room._id, {
          status: "ended",
          endedAt: Date.now(),
        });
        {
          const conversation = await ctx.db
            .query("conversations")
            .withIndex("by_app_session", (q) =>
              q.eq("appSlug", room.appSlug).eq("sessionId", room.sessionId)
            )
            .first();
          if (conversation && conversation.status === "active") {
            await ctx.db.patch(conversation._id, {
              status: "resolved",
              resolution: "room_ended",
              endedAt: Date.now(),
            });
          }
        }
        break;

      case "participant_joined":
        if (args.participantIdentity) {
          const role = args.participantIdentity.startsWith("agent-")
            ? "agent"
            : "user";

          await ctx.runMutation(internal.livekit.addLivekitParticipantRecord, {
            appSlug: room.appSlug,
            roomId: room._id,
            identity: args.participantIdentity,
            name: args.participantName,
            role,
          });
        }
        break;

      case "participant_left":
        if (args.participantIdentity) {
          await ctx.runMutation(internal.livekit.removeLivekitParticipantRecord, {
            roomId: room._id,
            identity: args.participantIdentity,
          });
        }
        break;
    }
  },
});
