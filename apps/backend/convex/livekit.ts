import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

type RecordingMode = "room_composite" | "participant_per_role";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function resolveRecordingMode(): RecordingMode {
  const raw = process.env.LIVEKIT_EGRESS_RECORDING_MODE?.trim().toLowerCase();
  if (raw === "participant" || raw === "participant_per_role") {
    return "participant_per_role";
  }
  return "room_composite";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumberish(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeEpochMs(value: unknown): number | undefined {
  const n = readNumberish(value);
  if (n === undefined) return undefined;
  if (n > 1e15) return Math.floor(n / 1e6); // nanos -> ms
  if (n > 1e12) return Math.floor(n); // already ms
  if (n > 1e10) return Math.floor(n / 1e3); // micros -> ms
  if (n > 1e9) return Math.floor(n * 1000); // seconds -> ms
  return Math.floor(n);
}

function normalizeDurationMs(value: unknown): number | undefined {
  const n = readNumberish(value);
  if (n === undefined) return undefined;
  if (n > 1e12) return Math.floor(n / 1e6); // nanos -> ms
  if (n > 1e9) return Math.floor(n / 1e6); // nanos-ish -> ms
  if (n > 1e6) return Math.floor(n / 1e3); // micros -> ms
  return Math.floor(n); // ms
}

function normalizeEgressStatus(status: unknown, fallbackEvent?: string): string {
  if (typeof status === "number") {
    switch (status) {
      case 0: return "starting";
      case 1: return "active";
      case 2: return "ending";
      case 3: return "complete";
      case 4: return "failed";
      case 5: return "aborted";
      case 6: return "limit_reached";
      default: return "unknown";
    }
  }
  if (typeof status === "string" && status.trim().length > 0) {
    return status.toLowerCase().replace(/^egress_/, "");
  }
  if (fallbackEvent?.startsWith("egress_")) {
    return fallbackEvent.slice("egress_".length);
  }
  return "unknown";
}

function normalizeEgressSourceType(sourceType: unknown): string | undefined {
  if (typeof sourceType === "number") {
    if (sourceType === 0) return "web";
    if (sourceType === 1) return "sdk";
  }
  if (typeof sourceType === "string" && sourceType.trim().length > 0) {
    return sourceType.toLowerCase().replace(/^egress_source_type_/, "");
  }
  return undefined;
}

function inferParticipantRole(identity?: string): "user" | "agent" | "observer" {
  const normalized = identity?.trim().toLowerCase() ?? "";
  if (!normalized) return "user";
  if (
    normalized === "agent"
    || normalized.startsWith("agent-")
    || normalized.startsWith("assistant-")
    || normalized.includes("-agent")
    || normalized.includes("bot")
  ) {
    return "agent";
  }
  if (
    normalized.startsWith("viewer-")
    || normalized.startsWith("observer-")
    || normalized.startsWith("monitor-")
    || normalized.startsWith("eg_")
    || normalized.startsWith("egress-")
  ) {
    return "observer";
  }
  return "user";
}

function inferMimeType(path?: string): string | undefined {
  if (!path) return undefined;
  const normalized = path.toLowerCase();
  if (normalized.endsWith(".mp3")) return "audio/mpeg";
  if (normalized.endsWith(".ogg")) return "audio/ogg";
  if (normalized.endsWith(".wav")) return "audio/wav";
  if (normalized.endsWith(".m4a")) return "audio/mp4";
  if (normalized.endsWith(".mp4")) return "audio/mp4";
  return undefined;
}

function extractStoragePath(location: string): string | undefined {
  if (location.startsWith("s3://") || location.startsWith("gs://")) {
    const withoutScheme = location.replace(/^[a-z0-9+.-]+:\/\//i, "");
    const slash = withoutScheme.indexOf("/");
    if (slash < 0) return undefined;
    return withoutScheme.slice(slash + 1).replace(/^\/+/, "");
  }
  if (/^https?:\/\//i.test(location)) {
    try {
      const parsed = new URL(location);
      return parsed.pathname.replace(/^\/+/, "");
    } catch {
      return undefined;
    }
  }
  return location.replace(/^\/+/, "");
}

function buildPlaybackUrl(fileLocation?: string, fileName?: string): string | undefined {
  if (fileLocation && /^https?:\/\//i.test(fileLocation)) {
    return fileLocation;
  }

  const overrideBase = readString(process.env.LIVEKIT_RECORDINGS_PUBLIC_BASE_URL);
  const preferredPath = fileLocation ? extractStoragePath(fileLocation) : undefined;
  const fallbackPath = fileName?.replace(/^\/+/, "");
  const path = preferredPath ?? fallbackPath;
  if (overrideBase && path) {
    return `${overrideBase.replace(/\/$/, "")}/${path}`;
  }

  if (fileLocation?.startsWith("s3://")) {
    const withoutScheme = fileLocation.slice("s3://".length);
    const slash = withoutScheme.indexOf("/");
    if (slash > 0) {
      const bucket = withoutScheme.slice(0, slash);
      const key = withoutScheme.slice(slash + 1);
      return `https://${bucket}.s3.amazonaws.com/${key}`;
    }
  }

  if (fileLocation?.startsWith("gs://")) {
    const withoutScheme = fileLocation.slice("gs://".length);
    const slash = withoutScheme.indexOf("/");
    if (slash > 0) {
      const bucket = withoutScheme.slice(0, slash);
      const key = withoutScheme.slice(slash + 1);
      return `https://storage.googleapis.com/${bucket}/${key}`;
    }
  }

  return undefined;
}

function parseAppAndSessionFromRoomName(roomName: string): { appSlug: string; sessionId: string } | null {
  const marker = "-session-";
  const markerIdx = roomName.indexOf(marker);
  if (markerIdx <= 0) return null;

  const appSlug = roomName.slice(0, markerIdx);
  const rest = roomName.slice(markerIdx + 1);
  const lastDash = rest.lastIndexOf("-");
  const sessionId = lastDash > 0 ? rest.slice(0, lastDash) : rest;
  if (!appSlug || !sessionId) return null;
  return { appSlug, sessionId };
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item
    );
  } catch {
    return "{}";
  }
}

function resolveRoomNameFromRaw(rawEvent: Record<string, unknown> | null): string | undefined {
  if (!rawEvent) return undefined;
  const room = asRecord(rawEvent.room);
  if (room) {
    const direct = readString(room.name) ?? readString(room.roomName);
    if (direct) return direct;
  }

  const egressInfo = asRecord(rawEvent.egressInfo ?? rawEvent.egress_info);
  if (egressInfo) {
    return readString(egressInfo.roomName) ?? readString(egressInfo.room_name);
  }

  return undefined;
}

function buildEgressEventData(
  eventType: string,
  rawEvent: Record<string, unknown> | null,
  fallbackParticipantIdentity?: string,
): Record<string, unknown> | null {
  const egressInfo = asRecord(rawEvent?.egressInfo ?? rawEvent?.egress_info);
  if (!egressInfo) return null;

  const request = asRecord(egressInfo.request);
  const requestCase = readString(request?.case);
  const requestValue = asRecord(request?.value);
  const participantFromRequest =
    readString(requestValue?.identity)
    ?? readString(asRecord(request?.participant)?.identity);

  const participantIdentity = fallbackParticipantIdentity ?? participantFromRequest;
  const role = participantIdentity ? inferParticipantRole(participantIdentity) : undefined;

  const fileResults = asRecordArray(egressInfo.fileResults ?? egressInfo.file_results);
  const fileResult = fileResults.find((entry) =>
    readString(entry.location) || readString(entry.filename)
  ) ?? asRecord(egressInfo.file);

  const fileLocation = readString(fileResult?.location);
  const fileName = readString(fileResult?.filename);
  const playbackUrl = buildPlaybackUrl(fileLocation, fileName);
  const mimeType = inferMimeType(playbackUrl ?? fileName ?? fileLocation);

  const payload: Record<string, unknown> = {
    egressId: readString(egressInfo.egressId) ?? readString(egressInfo.egress_id),
    roomName: readString(egressInfo.roomName)
      ?? readString(egressInfo.room_name)
      ?? resolveRoomNameFromRaw(rawEvent),
    status: normalizeEgressStatus(egressInfo.status, eventType),
    sourceType: normalizeEgressSourceType(egressInfo.sourceType ?? egressInfo.source_type),
    startedAt: normalizeEpochMs(egressInfo.startedAt ?? egressInfo.started_at),
    endedAt: normalizeEpochMs(egressInfo.endedAt ?? egressInfo.ended_at),
    updatedAt: normalizeEpochMs(egressInfo.updatedAt ?? egressInfo.updated_at) ?? Date.now(),
    error: readString(egressInfo.error),
    requestCase,
    participantIdentity,
    role: role === "observer" ? undefined : role,
    fileLocation,
    fileName,
    playbackUrl,
    mimeType,
    durationMs: normalizeDurationMs(fileResult?.duration),
  };

  return payload;
}

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
      agents?: Array<{ agentName: string; metadata?: string }>;
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
    agents: config?.agents,
  });

  // Store the room record in Convex
  const roomId = await ctx.runMutation(internal.livekit.createLivekitRoomRecord, {
    appSlug: auth.app.slug,
    roomName,
    sessionId,
    maxParticipants,
    emptyTimeout,
    enableRecording: config?.enableRecording ?? true,
  });

  if (config?.enableRecording ?? true) {
    const recordingMode = resolveRecordingMode();
    if (recordingMode === "participant_per_role") {
      await ctx.scheduler.runAfter(
        1000,
        internal.livekitInternal.bootstrapRoomRecordingsAction,
        {
          appSlug: auth.app.slug,
          sessionId,
          roomName,
          attempt: 0,
        },
      );
    } else {
      await ctx.scheduler.runAfter(
        1000,
        internal.livekitInternal.startRoomRecordingAction,
        {
          appSlug: auth.app.slug,
          sessionId,
          roomName,
        },
      );
    }
  }

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
    raw?: Record<string, unknown>;
  };

  try {
    event = await ctx.runAction(internal.livekitInternal.validateWebhookAction, {
      body,
      authHeader,
    }) as typeof event;
  } catch {
    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  if (event.event) {
    await ctx.runMutation(internal.livekit.handleLivekitWebhookEventRecord, {
      event: event.event,
      roomName: event.room?.name ?? "",
      participantIdentity: event.participant?.identity,
      participantName: event.participant?.name,
      rawEvent: event.raw ? safeJsonStringify(event.raw) : undefined,
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

      if (
        room.enableRecording
        && (args.role === "user" || args.role === "agent")
      ) {
        const recordingMode = resolveRecordingMode();
        if (recordingMode === "participant_per_role") {
          await ctx.scheduler.runAfter(
            0,
            internal.livekitInternal.startParticipantRecordingAction,
            {
              appSlug: room.appSlug,
              sessionId: room.sessionId,
              roomName: room.roomName,
              participantIdentity: args.identity,
              role: args.role,
            }
          );
        } else {
          await ctx.scheduler.runAfter(
            0,
            internal.livekitInternal.startRoomRecordingAction,
            {
              appSlug: room.appSlug,
              sessionId: room.sessionId,
              roomName: room.roomName,
            },
          );
        }
      }
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

/** Find the most recent non-ended room for a session */
export const findActiveRoomBySession = internalQuery({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const rooms = await ctx.db
      .query("livekitRooms")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();
    return rooms.find((r) => r.status !== "ended") ?? null;
  },
});

/** Handle a webhook event from LiveKit, updating room/participant state */
export const handleLivekitWebhookEventRecord = internalMutation({
  args: {
    event: v.string(),
    roomName: v.string(),
    participantIdentity: v.optional(v.string()),
    participantName: v.optional(v.string()),
    rawEvent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let rawEvent: Record<string, unknown> | null = null;
    if (args.rawEvent) {
      try {
        rawEvent = JSON.parse(args.rawEvent) as Record<string, unknown>;
      } catch {
        rawEvent = null;
      }
    }

    const resolvedRoomName = readString(args.roomName) ?? resolveRoomNameFromRaw(rawEvent);
    const room = resolvedRoomName
      ? await ctx.db
          .query("livekitRooms")
          .withIndex("by_room_name", (q) => q.eq("roomName", resolvedRoomName))
          .first()
      : null;

    const inferred = resolvedRoomName ? parseAppAndSessionFromRoomName(resolvedRoomName) : null;
    const appSlug = room?.appSlug ?? inferred?.appSlug;
    const sessionId = room?.sessionId ?? inferred?.sessionId;

    if (args.event.startsWith("egress_") && appSlug && sessionId) {
      const egressData = buildEgressEventData(args.event, rawEvent, args.participantIdentity);
      if (egressData) {
        await ctx.db.insert("events", {
          appSlug,
          sessionId,
          eventType: "livekit_egress",
          ts: Date.now(),
          data: JSON.stringify(egressData),
        });
      }
    }

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
          const role = inferParticipantRole(args.participantIdentity);

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
