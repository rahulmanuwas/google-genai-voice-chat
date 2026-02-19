import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getTraceId, getFullAuthCredentials, corsHttpAction } from "./helpers";

type RoleKey = "user" | "agent";
type RecordingRole = RoleKey | "conversation";

interface RecordingSnapshot {
  role: RecordingRole;
  playbackUrl: string;
  mimeType?: string;
  durationMs?: number;
  startedAt?: number;
  endedAt?: number;
  updatedAt: number;
}

interface SpeakingWindow {
  startAt: number;
  endAt: number;
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

function normalizeRole(role: string | undefined): RecordingRole | undefined {
  if (!role) return undefined;
  const normalized = role.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "agent" || normalized === "assistant" || normalized === "model") return "agent";
  if (normalized === "user" || normalized === "customer") return "user";
  if (normalized === "conversation" || normalized === "room" || normalized === "mixed") return "conversation";
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
    || normalized.startsWith("eg_")
    || normalized.startsWith("egress-")
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

function buildRecordingMap(
  events: Array<{ data?: string; ts: number }>,
): {
  byRole: Map<RoleKey, RecordingSnapshot>;
  conversation: RecordingSnapshot | null;
} {
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
      ?? inferRoleFromIdentity(readString(payload.participantIdentity))
      ?? "conversation";

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
        startedAt: readNumberish(payload.startedAt),
        endedAt: readNumberish(payload.endedAt),
        updatedAt,
        status,
      });
    }
  }

  const latestByRole = new Map<RoleKey, RecordingSnapshot>();
  let latestConversation: RecordingSnapshot | null = null;
  for (const recording of latestByEgress.values()) {
    if (recording.role === "conversation") {
      if (!latestConversation || recording.updatedAt >= latestConversation.updatedAt) {
        latestConversation = {
          role: "conversation",
          playbackUrl: recording.playbackUrl,
          mimeType: recording.mimeType,
          durationMs: recording.durationMs,
          startedAt: recording.startedAt,
          endedAt: recording.endedAt,
          updatedAt: recording.updatedAt,
        };
      }
      continue;
    }

    const existing = latestByRole.get(recording.role);
    if (!existing || recording.updatedAt >= existing.updatedAt) {
      latestByRole.set(recording.role, {
        role: recording.role,
        playbackUrl: recording.playbackUrl,
        mimeType: recording.mimeType,
        durationMs: recording.durationMs,
        startedAt: recording.startedAt,
        endedAt: recording.endedAt,
        updatedAt: recording.updatedAt,
      });
    }
  }

  return { byRole: latestByRole, conversation: latestConversation };
}

const CLIP_LEAD_MS = 300;
const CLIP_FOLLOW_MS = 250;
const CLIP_DEFAULT_MS = 3500;
const CLIP_MIN_MS = 700;
const CLIP_MAX_MS = 12000;
const WINDOW_MATCH_GRACE_MS = 500;
const WINDOW_LAST_TAIL_MS = 250;

function resolveRecordingStartAt(recording: RecordingSnapshot): number | undefined {
  if (recording.startedAt !== undefined) return recording.startedAt;
  if (recording.endedAt !== undefined && recording.durationMs !== undefined) {
    return recording.endedAt - recording.durationMs;
  }
  return undefined;
}

function resolveRecordingDurationMs(recording: RecordingSnapshot): number | undefined {
  if (recording.durationMs !== undefined) return recording.durationMs;
  const startAt = resolveRecordingStartAt(recording);
  if (startAt !== undefined && recording.endedAt !== undefined) {
    return recording.endedAt - startAt;
  }
  return undefined;
}

function buildSpeakingWindows(
  events: Array<{ eventType: string; ts: number; data?: string }>,
): Record<RoleKey, SpeakingWindow[]> {
  const windows: Record<RoleKey, SpeakingWindow[]> = { user: [], agent: [] };
  const openStart: Partial<Record<RoleKey, number>> = {};
  const sorted = [...events].sort((a, b) => a.ts - b.ts);

  const closeWindow = (role: RoleKey, endAt: number) => {
    const startAt = openStart[role];
    if (startAt === undefined) return;
    if (endAt > startAt) {
      windows[role].push({ startAt, endAt });
    }
    delete openStart[role];
  };

  for (const event of sorted) {
    let role: RoleKey | undefined;
    if (event.eventType === "user_state_changed") role = "user";
    if (event.eventType === "agent_state_changed") role = "agent";
    if (!role) continue;

    let payload: Record<string, unknown> | null = null;
    if (event.data) {
      try {
        payload = asRecord(JSON.parse(event.data));
      } catch {
        payload = null;
      }
    }

    const state = (
      readString(payload?.state)
      ?? readString(payload?.newState)
      ?? readString(payload?.new_state)
      ?? ""
    ).toLowerCase();

    if (state === "speaking") {
      if (openStart[role] === undefined) {
        openStart[role] = event.ts;
      }
      continue;
    }

    if (openStart[role] !== undefined) {
      closeWindow(role, event.ts);
    }
  }

  const lastTs = sorted.length > 0 ? sorted[sorted.length - 1]!.ts : Date.now();
  const closeOpenWindow = (role: RoleKey) => {
    const startAt = openStart[role];
    if (startAt === undefined) return;
    // Some sessions end without a terminal "listening" event. Cap tail duration to avoid giant clips.
    const boundedLastTs = Math.max(lastTs, startAt + CLIP_MIN_MS);
    closeWindow(role, Math.min(boundedLastTs, startAt + CLIP_MAX_MS));
  };

  closeOpenWindow("user");
  closeOpenWindow("agent");

  return windows;
}

function speakingWindowScore(window: SpeakingWindow, ts: number): number {
  if (ts < window.startAt) return window.startAt - ts;
  if (ts > window.endAt) return ts - window.endAt;
  return 0;
}

interface MessageForClipping {
  _id: string;
  createdAt: number;
  role: string;
  participantIdentity: string;
}

interface ClipTimestampRange {
  startAt: number;
  endAt: number;
}

function inferMessageRole(message: Pick<MessageForClipping, "role" | "participantIdentity">): RoleKey | undefined {
  return (normalizeRole(message.role) ?? inferRoleFromIdentity(message.participantIdentity)) as RoleKey | undefined;
}

function assignUserMessagesToWindows(
  messages: MessageForClipping[],
  windows: SpeakingWindow[],
): Map<string, number> {
  const assignments = new Map<string, number>();
  if (messages.length === 0 || windows.length === 0) return assignments;

  let windowIndex = 0;
  for (const message of messages) {
    while (
      windowIndex + 1 < windows.length
      && message.createdAt > windows[windowIndex]!.endAt + WINDOW_MATCH_GRACE_MS
    ) {
      windowIndex += 1;
    }

    let candidateIndex = windowIndex;
    if (windowIndex + 1 < windows.length) {
      const currentScore = speakingWindowScore(windows[windowIndex]!, message.createdAt);
      const nextScore = speakingWindowScore(windows[windowIndex + 1]!, message.createdAt);
      if (nextScore < currentScore) {
        candidateIndex = windowIndex + 1;
      }
    }

    assignments.set(String(message._id), candidateIndex);
    if (candidateIndex > windowIndex) {
      windowIndex = candidateIndex;
    }
  }

  return assignments;
}

function buildClipRangesFromSpeakingWindows(
  finalMessages: MessageForClipping[],
  windowsByRole: Record<RoleKey, SpeakingWindow[]>,
): Map<string, ClipTimestampRange> {
  const ranges = new Map<string, ClipTimestampRange>();
  const userMessages = finalMessages.filter((message) => inferMessageRole(message) === "user");
  const agentMessages = finalMessages.filter((message) => inferMessageRole(message) === "agent");

  if (userMessages.length > 0 && windowsByRole.user.length > 0) {
    const assignments = assignUserMessagesToWindows(userMessages, windowsByRole.user);
    const groupedByWindow = new Map<number, MessageForClipping[]>();

    for (const message of userMessages) {
      const windowIndex = assignments.get(String(message._id));
      if (windowIndex === undefined) continue;
      const grouped = groupedByWindow.get(windowIndex) ?? [];
      grouped.push(message);
      groupedByWindow.set(windowIndex, grouped);
    }

    for (const [windowIndex, groupedMessages] of groupedByWindow) {
      const window = windowsByRole.user[windowIndex];
      if (!window || groupedMessages.length === 0) continue;

      groupedMessages.sort((a, b) => a.createdAt - b.createdAt);
      const lastMessage = groupedMessages[groupedMessages.length - 1]!;
      const windowEndAt = Math.max(window.endAt, lastMessage.createdAt + WINDOW_LAST_TAIL_MS);

      for (let i = 0; i < groupedMessages.length; i += 1) {
        const message = groupedMessages[i]!;
        const previousMessage = i > 0 ? groupedMessages[i - 1] : undefined;
        const segmentStartAt = previousMessage ? previousMessage.createdAt : window.startAt;
        const segmentEndAt = i < groupedMessages.length - 1 ? message.createdAt : windowEndAt;
        if (segmentEndAt <= segmentStartAt) continue;

        ranges.set(String(message._id), {
          startAt: segmentStartAt - CLIP_LEAD_MS,
          endAt: segmentEndAt + CLIP_FOLLOW_MS,
        });
      }
    }
  }

  if (agentMessages.length > 0 && windowsByRole.agent.length > 0) {
    const matchedCount = Math.min(agentMessages.length, windowsByRole.agent.length);
    for (let i = 0; i < matchedCount; i += 1) {
      const window = windowsByRole.agent[i]!;
      if (window.endAt <= window.startAt) continue;
      ranges.set(String(agentMessages[i]!._id), {
        startAt: window.startAt - CLIP_LEAD_MS,
        endAt: window.endAt + CLIP_FOLLOW_MS,
      });
    }
  }

  return ranges;
}

function buildFallbackClipRange(
  message: MessageForClipping,
  nextMessage?: MessageForClipping,
): ClipTimestampRange {
  const startAt = message.createdAt - CLIP_LEAD_MS;
  let endAt = nextMessage
    ? nextMessage.createdAt + CLIP_FOLLOW_MS
    : (startAt + CLIP_DEFAULT_MS);

  endAt = Math.max(endAt, startAt + CLIP_MIN_MS);
  endAt = Math.min(endAt, startAt + CLIP_MAX_MS);
  return { startAt, endAt };
}

function clampClipRangeToRecording(
  range: ClipTimestampRange,
  recordingStartAt: number,
  maxDurationMs?: number,
): { clipStartMs: number; clipEndMs: number } | null {
  let clipStartMs = Math.max(0, range.startAt - recordingStartAt);
  let clipEndMs = Math.max(clipStartMs + CLIP_MIN_MS, range.endAt - recordingStartAt);
  if (clipEndMs - clipStartMs > CLIP_MAX_MS) {
    clipEndMs = clipStartMs + CLIP_MAX_MS;
  }

  if (maxDurationMs !== undefined) {
    const boundedDuration = Math.max(0, maxDurationMs);
    if (boundedDuration <= 0) return null;

    const minClipDurationMs = Math.min(CLIP_MIN_MS, boundedDuration);
    clipStartMs = Math.min(clipStartMs, Math.max(0, boundedDuration - minClipDurationMs));
    clipEndMs = Math.min(clipEndMs, boundedDuration);

    if (clipEndMs - clipStartMs < minClipDurationMs) {
      clipStartMs = Math.max(0, clipEndMs - minClipDurationMs);
    }
  }

  if (clipEndMs <= clipStartMs) return null;
  return {
    clipStartMs: Math.floor(clipStartMs),
    clipEndMs: Math.floor(clipEndMs),
  };
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

  const [messages, events, conversation] = await Promise.all([
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
    appSlug
      ? ctx.runQuery(internal.conversationsInternal.getConversationByAppSessionRecord, {
        appSlug,
        sessionId,
      })
      : Promise.resolve(null),
  ]);

  const egressEvents = events.filter((event) => event.eventType === "livekit_egress");
  const recordings = buildRecordingMap(egressEvents);
  const finalMessages = messages
    .filter((message) => message.isFinal)
    .sort((a, b) => a.createdAt - b.createdAt);
  const speakingWindows = buildSpeakingWindows(events);
  const clipRangesByMessageId = buildClipRangesFromSpeakingWindows(
    finalMessages.map((message) => ({
      _id: String(message._id),
      createdAt: message.createdAt,
      role: message.role,
      participantIdentity: message.participantIdentity,
    })),
    speakingWindows,
  );

  for (let i = 0; i < finalMessages.length; i += 1) {
    const message = finalMessages[i]!;
    const messageId = String(message._id);
    if (clipRangesByMessageId.has(messageId)) continue;

    const nextMessage = finalMessages[i + 1];
    clipRangesByMessageId.set(messageId, buildFallbackClipRange(
      {
        _id: messageId,
        createdAt: message.createdAt,
        role: message.role,
        participantIdentity: message.participantIdentity,
      },
      nextMessage
        ? {
          _id: String(nextMessage._id),
          createdAt: nextMessage.createdAt,
          role: nextMessage.role,
          participantIdentity: nextMessage.participantIdentity,
        }
        : undefined,
    ));
  }

  const clipBoundsByMessageId = new Map<string, { clipStartMs: number; clipEndMs: number }>();

  for (const message of finalMessages) {
    const messageId = String(message._id);
    const inferredRole = inferMessageRole({
      role: message.role,
      participantIdentity: message.participantIdentity,
    });
    const recording =
      (inferredRole ? recordings.byRole.get(inferredRole) : undefined) ?? recordings.conversation;
    if (!recording) continue;

    const clipRange = clipRangesByMessageId.get(messageId);
    if (!clipRange) continue;

    const recordingStartAt = resolveRecordingStartAt(recording) ?? conversation?.startedAt;
    if (recordingStartAt === undefined) continue;

    const maxDurationMs =
      resolveRecordingDurationMs(recording)
      ?? (conversation?.endedAt !== undefined
        ? Math.max(0, conversation.endedAt - recordingStartAt)
        : undefined);
    const clipBounds = clampClipRangeToRecording(clipRange, recordingStartAt, maxDurationMs);
    if (!clipBounds) continue;

    clipBoundsByMessageId.set(messageId, clipBounds);
  }

  const enrichedMessages = messages.map((message) => {
    const inferredRole =
      (normalizeRole(message.role) ?? inferRoleFromIdentity(message.participantIdentity)) as RoleKey | undefined;
    const recording = (inferredRole ? recordings.byRole.get(inferredRole) : undefined) ?? recordings.conversation;
    const clip = clipBoundsByMessageId.get(String(message._id));
    if (!recording) return message;
    return {
      ...message,
      audioUrl: recording.playbackUrl,
      audioMimeType: recording.mimeType,
      audioDurationMs: recording.durationMs,
      clipStartMs: clip?.clipStartMs,
      clipEndMs: clip?.clipEndMs,
    };
  });

  return jsonResponse({
    messages: enrichedMessages,
    recordings: {
      user: recordings.byRole.get("user") ?? recordings.conversation ?? null,
      agent: recordings.byRole.get("agent") ?? recordings.conversation ?? null,
      conversation: recordings.conversation ?? null,
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
