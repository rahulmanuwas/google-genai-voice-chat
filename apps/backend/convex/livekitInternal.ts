"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { createLiveKitToken, handleLiveKitWebhook, createRoom, deleteRoom } from "@genai-voice/sdk/server";

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
