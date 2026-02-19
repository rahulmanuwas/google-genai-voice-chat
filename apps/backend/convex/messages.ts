import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getTraceId, getFullAuthCredentials, corsHttpAction } from "./helpers";

type RoleKey = "user" | "agent";

interface RecordingSnapshot {
  role: RoleKey;
  playbackUrl: string;
  mimeType?: string;
  durationMs?: number;
  updatedAt: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
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

function normalizeRole(role: string | undefined): RoleKey | undefined {
  if (!role) return undefined;
  const normalized = role.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "agent" || normalized === "assistant" || normalized === "model") return "agent";
  if (normalized === "user" || normalized === "customer") return "user";
  return undefined;
}

function inferRoleFromIdentity(identity?: string): RoleKey | undefined {
  const normalized = identity?.trim().toLowerCase();
  if (!normalized) return undefined;
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
  ) {
    return undefined;
  }
  return "user";
}

function isUsableRecordingStatus(status: string | undefined): boolean {
  if (!status) return true;
  const normalized = status.trim().toLowerCase();
  if (!normalized) return true;
  return !["failed", "aborted", "limit_reached"].includes(normalized);
}

function buildRecordingMap(events: Array<{ data?: string; ts: number }>): Map<RoleKey, RecordingSnapshot> {
  const latestByEgress = new Map<string, RecordingSnapshot & { status?: string }>();

  for (const event of events) {
    if (!event.data) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      continue;
    }
    const payload = asRecord(parsed);
    if (!payload) continue;

    const explicitPlaybackUrl = readString(payload.playbackUrl);
    const httpFileLocation = readString(payload.fileLocation);
    const playbackUrl = explicitPlaybackUrl
      ?? (httpFileLocation && /^https?:\/\//i.test(httpFileLocation) ? httpFileLocation : undefined);
    if (!playbackUrl) continue;

    const role =
      normalizeRole(readString(payload.role))
      ?? inferRoleFromIdentity(readString(payload.participantIdentity));
    if (!role) continue;

    const status = readString(payload.status);
    if (!isUsableRecordingStatus(status)) continue;

    const updatedAt = readNumberish(payload.updatedAt) ?? event.ts;
    const egressId = readString(payload.egressId) ?? `${role}:${playbackUrl}`;

    const current = latestByEgress.get(egressId);
    if (!current || updatedAt >= current.updatedAt) {
      latestByEgress.set(egressId, {
        role,
        playbackUrl,
        mimeType: readString(payload.mimeType),
        durationMs: readNumberish(payload.durationMs),
        updatedAt,
        status,
      });
    }
  }

  const latestByRole = new Map<RoleKey, RecordingSnapshot>();
  for (const recording of latestByEgress.values()) {
    const existing = latestByRole.get(recording.role);
    if (!existing || recording.updatedAt >= existing.updatedAt) {
      latestByRole.set(recording.role, {
        role: recording.role,
        playbackUrl: recording.playbackUrl,
        mimeType: recording.mimeType,
        durationMs: recording.durationMs,
        updatedAt: recording.updatedAt,
      });
    }
  }

  return latestByRole;
}

const messageValidator = {
  appSlug: v.string(),
  sessionId: v.string(),
  roomName: v.optional(v.string()),
  participantIdentity: v.string(),
  role: v.string(),
  content: v.string(),
  isFinal: v.boolean(),
  language: v.optional(v.string()),
  createdAt: v.float64(),
  traceId: v.optional(v.string()),
};

/** POST /api/messages — Insert messages (batch) */
export const saveMessages = corsHttpAction(async (ctx, request) => {
  const traceId = getTraceId(request);
  const body = await request.json();
  const { messages } = body as {
    messages: Array<{
      sessionId: string;
      roomName?: string;
      participantIdentity: string;
      role: string;
      content: string;
      isFinal: boolean;
      language?: string;
      createdAt: number;
    }>;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: "Missing or empty messages array" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const ids = await ctx.runMutation(internal.messages.insertMessageBatchRecords, {
    messages: messages.map((m) => ({
      appSlug: auth.app.slug,
      sessionId: m.sessionId,
      roomName: m.roomName,
      participantIdentity: m.participantIdentity,
      role: m.role,
      content: m.content,
      isFinal: m.isFinal,
      language: m.language,
      createdAt: m.createdAt,
      traceId,
    })),
  });

  return jsonResponse({ ok: true, count: ids.length });
});

/** GET /api/messages?sessionId=... — Authorization: Bearer <token> */
export const listMessages = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const all = url.searchParams.get("all") === "true";
  const filterApp = url.searchParams.get("appSlug")?.trim() || undefined;

  if (!sessionId) {
    return jsonResponse({ error: "Missing sessionId" }, 400);
  }

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const appSlug = all ? filterApp : auth.app.slug;

  const [messages, events] = await Promise.all([
    appSlug
      ? ctx.runQuery(internal.messages.getAppSessionMessageRecords, {
        appSlug,
        sessionId,
      })
      : ctx.runQuery(internal.messages.getSessionMessageRecords, {
        sessionId,
      }),
    appSlug
      ? ctx.runQuery(internal.events.getAppSessionEventRecords, {
        appSlug,
        sessionId,
        limit: 500,
      })
      : ctx.runQuery(internal.events.getSessionEventRecords, {
        sessionId,
        limit: 500,
      }),
  ]);

  const egressEvents = events.filter((event) => event.eventType === "livekit_egress");
  const recordingsByRole = buildRecordingMap(egressEvents);

  const enrichedMessages = messages.map((message) => {
    const role = normalizeRole(message.role) ?? inferRoleFromIdentity(message.participantIdentity);
    if (!role) return message;
    const recording = recordingsByRole.get(role);
    if (!recording) return message;
    return {
      ...message,
      audioUrl: recording.playbackUrl,
      audioMimeType: recording.mimeType,
      audioDurationMs: recording.durationMs,
    };
  });

  return jsonResponse({
    messages: enrichedMessages,
    recordings: {
      user: recordingsByRole.get("user") ?? null,
      agent: recordingsByRole.get("agent") ?? null,
    },
  });
});

/** Insert a single message */
export const insertMessageRecord = internalMutation({
  args: messageValidator,
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});

/** Insert a batch of messages */
export const insertMessageBatchRecords = internalMutation({
  args: {
    messages: v.array(v.object(messageValidator)),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const msg of args.messages) {
      const id = await ctx.db.insert("messages", msg);
      ids.push(id);
    }
    return ids;
  },
});

/** Get messages for a session */
export const getSessionMessageRecords = internalQuery({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc");

    if (args.limit) {
      return await query.take(args.limit);
    }
    return await query.collect();
  },
});

/** Get messages for a session scoped to an app */
export const getAppSessionMessageRecords = internalQuery({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_app_session", (q) =>
        q.eq("appSlug", args.appSlug).eq("sessionId", args.sessionId)
      )
      .order("asc")
      .collect();
  },
});
