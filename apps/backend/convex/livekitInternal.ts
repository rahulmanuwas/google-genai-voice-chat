"use node";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { createLiveKitToken, handleLiveKitWebhook, createRoom, deleteRoom } from "@genai-voice/sdk/server";
import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
} from "livekit-server-sdk";

type RecordingMode = "room_composite" | "participant_per_role";

function normalizeServiceUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.protocol === "ws:") parsed.protocol = "http:";
  if (parsed.protocol === "wss:") parsed.protocol = "https:";
  return parsed.toString().replace(/\/$/, "");
}

function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function resolveRecordingMode(): RecordingMode {
  const raw = process.env.LIVEKIT_EGRESS_RECORDING_MODE?.trim().toLowerCase();
  if (raw === "participant" || raw === "participant_per_role") {
    return "participant_per_role";
  }
  return "room_composite";
}

function normalizeRequestedFileType(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "mp4";
  if (normalized === "mp4" || normalized === "mp3" || normalized === "ogg") {
    return normalized;
  }
  return "mp4";
}

function resolveFileType(): EncodedFileType {
  // LiveKit participant egress file outputs are MP4.
  return EncodedFileType.MP4;
}

function fileExtensionForType(fileType: EncodedFileType): string {
  if (fileType === EncodedFileType.OGG) return "ogg";
  if (fileType === EncodedFileType.MP4) return "mp4";
  return "mp3";
}

function inferMimeTypeFromFilepath(filepath: string): string {
  const normalized = filepath.toLowerCase();
  if (normalized.endsWith(".ogg")) return "audio/ogg";
  if (normalized.endsWith(".wav")) return "audio/wav";
  if (normalized.endsWith(".m4a")) return "audio/mp4";
  if (normalized.endsWith(".mp4")) return "audio/mp4";
  return "audio/mpeg";
}

function normalizeEgressStatus(status: unknown): string {
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
  if (typeof status === "string") {
    return status.toLowerCase().replace(/^egress_/, "");
  }
  return "unknown";
}

function buildS3UploadFromEnv(): S3Upload | null {
  const bucket = process.env.LIVEKIT_EGRESS_S3_BUCKET;
  const accessKey = process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY;
  const secret = process.env.LIVEKIT_EGRESS_S3_SECRET;
  const region = process.env.LIVEKIT_EGRESS_S3_REGION;
  const endpoint = process.env.LIVEKIT_EGRESS_S3_ENDPOINT;

  if (!bucket || !accessKey || !secret) {
    return null;
  }

  return new S3Upload({
    accessKey,
    secret,
    bucket,
    region: region ?? "auto",
    endpoint: endpoint ?? "",
    forcePathStyle: parseBoolean(process.env.LIVEKIT_EGRESS_S3_FORCE_PATH_STYLE, false),
  });
}

function buildPlaybackUrlFromFilepath(filepath: string): string | undefined {
  const publicBase = process.env.LIVEKIT_RECORDINGS_PUBLIC_BASE_URL?.trim();
  if (publicBase) {
    return `${publicBase.replace(/\/$/, "")}/${filepath.replace(/^\/+/, "")}`;
  }

  const bucket = process.env.LIVEKIT_EGRESS_S3_BUCKET?.trim();
  if (!bucket) return undefined;
  return `https://${bucket}.s3.amazonaws.com/${filepath.replace(/^\/+/, "")}`;
}

function getParticipantIdentityFromEgressInfo(info: {
  request?: { case?: string; value?: { identity?: string } };
}): string | undefined {
  if (info.request?.case === "participant") {
    return info.request.value?.identity;
  }
  return undefined;
}

function inferParticipantRole(identity: string): "user" | "agent" | "observer" {
  const normalized = identity.trim().toLowerCase();
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

const RECORDING_BOOTSTRAP_INTERVAL_MS = 2000;
const RECORDING_BOOTSTRAP_MAX_ATTEMPTS = 90;

/** Generate a LiveKit access token for a participant */
export const generateTokenAction = internalAction({
  args: {
    roomName: v.string(),
    identity: v.string(),
    name: v.optional(v.string()),
    ttl: v.optional(v.float64()),
  },
  handler: async (_ctx, args) => {
    return await createLiveKitToken({
      roomName: args.roomName,
      identity: args.identity,
      name: args.name,
      ttl: args.ttl ?? 3600,
    });
  },
});

/** Validate a LiveKit webhook signature */
export const validateWebhookAction = internalAction({
  args: {
    body: v.string(),
    authHeader: v.string(),
  },
  handler: async (_ctx, args) => {
    const result = await handleLiveKitWebhook(args.body, args.authHeader);
    return result;
  },
});

/** Create a room on the LiveKit server via RoomService API */
export const createLiveKitServerRoomAction = internalAction({
  args: {
    roomName: v.string(),
    emptyTimeout: v.float64(),
    maxParticipants: v.float64(),
    metadata: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    await createRoom({
      roomName: args.roomName,
      emptyTimeout: args.emptyTimeout,
      maxParticipants: args.maxParticipants,
      metadata: args.metadata,
    });
  },
});

/** Delete a room on the LiveKit server via RoomService API */
export const deleteLiveKitServerRoomAction = internalAction({
  args: { roomName: v.string() },
  handler: async (_ctx, args) => {
    try {
      await deleteRoom(args.roomName);
    } catch {
      // Room may already be gone -- best-effort cleanup
    }
  },
});

/**
 * Bootstrap participant recordings even when webhook participant events are unavailable.
 * Polls room participants for a short window and starts participant egress per role.
 */
export const bootstrapRoomRecordingsAction = internalAction({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    roomName: v.string(),
    attempt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    if (resolveRecordingMode() !== "participant_per_role") {
      return { ok: false, reason: "recording_mode_room_composite", attempt: args.attempt ?? 0 };
    }

    const attempt = args.attempt ?? 0;
    const enabled = parseBoolean(
      process.env.LIVEKIT_EGRESS_MANUAL_START,
      Boolean(process.env.LIVEKIT_EGRESS_S3_BUCKET),
    );
    if (!enabled) {
      return { ok: false, reason: "manual_start_disabled", attempt };
    }

    const room = await ctx.runQuery(internal.livekit.getLivekitRoomRecordByName, {
      roomName: args.roomName,
    });
    if (!room) {
      return { ok: false, reason: "room_not_found", attempt };
    }
    if (room.status === "ended") {
      return { ok: false, reason: "room_ended", attempt };
    }
    if (!room.enableRecording) {
      return { ok: false, reason: "recording_disabled", attempt };
    }

    const livekitUrl = process.env.LIVEKIT_URL;
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return { ok: false, reason: "missing_livekit_credentials", attempt };
    }

    let participants: Array<{ identity?: string }> = [];
    try {
      const roomClient = new RoomServiceClient(
        normalizeServiceUrl(livekitUrl),
        livekitApiKey,
        livekitApiSecret,
      );
      participants = await roomClient.listParticipants(args.roomName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.events.insertEventRecord, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        eventType: "livekit_recording_error",
        ts: Date.now(),
        data: JSON.stringify({
          roomName: args.roomName,
          source: "bootstrap_list_participants",
          attempt,
          error: message,
        }),
      });

      if (attempt < RECORDING_BOOTSTRAP_MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          RECORDING_BOOTSTRAP_INTERVAL_MS,
          internal.livekitInternal.bootstrapRoomRecordingsAction,
          {
            appSlug: args.appSlug,
            sessionId: args.sessionId,
            roomName: args.roomName,
            attempt: attempt + 1,
          },
        );
      }

      return { ok: false, reason: "list_participants_failed", attempt, retryScheduled: attempt < RECORDING_BOOTSTRAP_MAX_ATTEMPTS };
    }

    let seenUser = false;
    let seenAgent = false;
    let startedCount = 0;
    let attemptedParticipants = 0;

    for (const participant of participants) {
      const identity = participant.identity?.trim();
      if (!identity) continue;

      const role = inferParticipantRole(identity);
      if (role === "observer") continue;

      attemptedParticipants++;
      if (role === "user") seenUser = true;
      if (role === "agent") seenAgent = true;

      const result = await ctx.runAction(internal.livekitInternal.startParticipantRecordingAction, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        roomName: args.roomName,
        participantIdentity: identity,
        role,
      });

      if (
        result
        && typeof result === "object"
        && "started" in result
        && (result as { started?: boolean }).started
      ) {
        startedCount++;
      }
    }

    const hasBothConversationRoles = seenUser && seenAgent;
    const retryScheduled = !hasBothConversationRoles && attempt < RECORDING_BOOTSTRAP_MAX_ATTEMPTS;
    if (retryScheduled) {
      await ctx.scheduler.runAfter(
        RECORDING_BOOTSTRAP_INTERVAL_MS,
        internal.livekitInternal.bootstrapRoomRecordingsAction,
        {
          appSlug: args.appSlug,
          sessionId: args.sessionId,
          roomName: args.roomName,
          attempt: attempt + 1,
        },
      );
    }

    return {
      ok: true,
      attempt,
      participants: participants.length,
      attemptedParticipants,
      startedCount,
      seenUser,
      seenAgent,
      retryScheduled,
    };
  },
});

/**
 * Start room-level recording egress (manual mode).
 * Produces a single mixed audio recording for the full conversation.
 */
export const startRoomRecordingAction = internalAction({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    roomName: v.string(),
  },
  handler: async (ctx, args) => {
    if (resolveRecordingMode() !== "room_composite") {
      return { started: false, reason: "recording_mode_participant_per_role" };
    }

    const enabled = parseBoolean(
      process.env.LIVEKIT_EGRESS_MANUAL_START,
      Boolean(process.env.LIVEKIT_EGRESS_S3_BUCKET),
    );
    if (!enabled) {
      return { started: false, reason: "manual_start_disabled" };
    }

    const livekitUrl = process.env.LIVEKIT_URL;
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return { started: false, reason: "missing_livekit_credentials" };
    }

    const s3Upload = buildS3UploadFromEnv();
    if (!s3Upload) {
      return { started: false, reason: "missing_egress_storage_config" };
    }

    const client = new EgressClient(
      normalizeServiceUrl(livekitUrl),
      livekitApiKey,
      livekitApiSecret,
    );

    try {
      const active = await client.listEgress({ roomName: args.roomName, active: true });
      const existing = active[0];
      if (existing) {
        return {
          started: false,
          reason: "already_active",
          egressId: existing.egressId,
          status: normalizeEgressStatus(existing.status),
        };
      }

      const requestedFileType = normalizeRequestedFileType(process.env.LIVEKIT_EGRESS_FILE_TYPE);
      const fileType = resolveFileType();
      const extension = fileExtensionForType(fileType);
      const prefix = sanitizePathSegment(process.env.LIVEKIT_EGRESS_FILEPATH_PREFIX ?? "recordings");
      const appSlug = sanitizePathSegment(args.appSlug);
      const sessionId = sanitizePathSegment(args.sessionId);
      const filepath = `${prefix}/${appSlug}/${sessionId}/conversation-${Date.now()}.${extension}`;

      const output = new EncodedFileOutput({
        fileType,
        filepath,
        output: {
          case: "s3",
          value: s3Upload,
        },
      });

      const info = await client.startRoomCompositeEgress(
        args.roomName,
        { file: output },
        { audioOnly: true },
      );

      await ctx.runMutation(internal.events.insertEventRecord, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        eventType: "livekit_egress",
        ts: Date.now(),
        data: JSON.stringify({
          egressId: info.egressId,
          roomName: args.roomName,
          role: "conversation",
          status: normalizeEgressStatus(info.status),
          source: "manual_room_start",
          requestCase: "room_composite",
          requestedFileType,
          fileType: "mp4",
          fileName: filepath,
          fileLocation: `s3://${s3Upload.bucket}/${filepath}`,
          playbackUrl: buildPlaybackUrlFromFilepath(filepath),
          mimeType: inferMimeTypeFromFilepath(filepath),
          updatedAt: Date.now(),
        }),
      });

      return {
        started: true,
        egressId: info.egressId,
        status: normalizeEgressStatus(info.status),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.events.insertEventRecord, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        eventType: "livekit_recording_error",
        ts: Date.now(),
        data: JSON.stringify({
          roomName: args.roomName,
          source: "room_composite_start",
          error: message,
        }),
      });
      return {
        started: false,
        reason: "start_failed",
        error: message,
      };
    }
  },
});

/**
 * Start participant recording egress (manual mode).
 * Requires egress storage env vars; otherwise this action exits no-op.
 */
export const startParticipantRecordingAction = internalAction({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    roomName: v.string(),
    participantIdentity: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    if (resolveRecordingMode() !== "participant_per_role") {
      return { started: false, reason: "recording_mode_room_composite" };
    }

    const enabled = parseBoolean(
      process.env.LIVEKIT_EGRESS_MANUAL_START,
      Boolean(process.env.LIVEKIT_EGRESS_S3_BUCKET),
    );
    if (!enabled) {
      return { started: false, reason: "manual_start_disabled" };
    }

    const livekitUrl = process.env.LIVEKIT_URL;
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return { started: false, reason: "missing_livekit_credentials" };
    }

    const s3Upload = buildS3UploadFromEnv();
    if (!s3Upload) {
      return { started: false, reason: "missing_egress_storage_config" };
    }

    const client = new EgressClient(
      normalizeServiceUrl(livekitUrl),
      livekitApiKey,
      livekitApiSecret,
    );

    try {
      const active = await client.listEgress({ roomName: args.roomName, active: true });
      const existing = active.find((item) => {
        const identity = getParticipantIdentityFromEgressInfo(item);
        return identity === args.participantIdentity;
      });

      if (existing) {
        return {
          started: false,
          reason: "already_active",
          egressId: existing.egressId,
          status: normalizeEgressStatus(existing.status),
        };
      }

      const requestedFileType = normalizeRequestedFileType(process.env.LIVEKIT_EGRESS_FILE_TYPE);
      const fileType = resolveFileType();
      const extension = fileExtensionForType(fileType);
      const prefix = sanitizePathSegment(process.env.LIVEKIT_EGRESS_FILEPATH_PREFIX ?? "recordings");
      const appSlug = sanitizePathSegment(args.appSlug);
      const sessionId = sanitizePathSegment(args.sessionId);
      const role = sanitizePathSegment(args.role);
      const participant = sanitizePathSegment(args.participantIdentity);
      const filepath = `${prefix}/${appSlug}/${sessionId}/${role}-${participant}-${Date.now()}.${extension}`;

      const output = new EncodedFileOutput({
        fileType,
        filepath,
        output: {
          case: "s3",
          value: s3Upload,
        },
      });

      const info = await client.startParticipantEgress(
        args.roomName,
        args.participantIdentity,
        { file: output },
      );

      await ctx.runMutation(internal.events.insertEventRecord, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        eventType: "livekit_egress",
        ts: Date.now(),
        data: JSON.stringify({
          egressId: info.egressId,
          roomName: args.roomName,
          participantIdentity: args.participantIdentity,
          role: args.role,
          status: normalizeEgressStatus(info.status),
          source: "manual_start",
          requestedFileType,
          fileType: "mp4",
          fileName: filepath,
          fileLocation: `s3://${s3Upload.bucket}/${filepath}`,
          playbackUrl: buildPlaybackUrlFromFilepath(filepath),
          mimeType: inferMimeTypeFromFilepath(filepath),
          updatedAt: Date.now(),
        }),
      });

      return {
        started: true,
        egressId: info.egressId,
        status: normalizeEgressStatus(info.status),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.events.insertEventRecord, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        eventType: "livekit_recording_error",
        ts: Date.now(),
        data: JSON.stringify({
          roomName: args.roomName,
          participantIdentity: args.participantIdentity,
          role: args.role,
          error: message,
        }),
      });
      return {
        started: false,
        reason: "start_failed",
        error: message,
      };
    }
  },
});
