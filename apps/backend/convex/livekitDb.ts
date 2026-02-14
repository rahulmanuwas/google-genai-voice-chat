import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/** Create a new room record */
export const createRoom = internalMutation({
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
export const updateRoom = internalMutation({
  args: {
    roomId: v.id("livekitRooms"),
    status: v.optional(v.string()),
    participantCount: v.optional(v.float64()),
    endedAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const { roomId, ...patch } = args;
    // Remove undefined values
    const updates: Record<string, unknown> = {};
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.participantCount !== undefined) updates.participantCount = patch.participantCount;
    if (patch.endedAt !== undefined) updates.endedAt = patch.endedAt;
    await ctx.db.patch(roomId, updates);
  },
});

/** Add a participant to a room */
export const addParticipant = internalMutation({
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
export const removeParticipant = internalMutation({
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
      (p) => p.identity === args.identity && !p.leftAt
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
export const listActiveRooms = internalQuery({
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
export const getRoomByName = internalQuery({
  args: { roomName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("livekitRooms")
      .withIndex("by_room_name", (q) => q.eq("roomName", args.roomName))
      .first();
  },
});

/** Handle a webhook event from LiveKit, updating room/participant state */
export const handleWebhookEvent = internalMutation({
  args: {
    event: v.string(), // "room_started" | "room_finished" | "participant_joined" | "participant_left"
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
        // Safety net: resolve any conversation still marked "active" for this room's session.
        // The agent process may have been killed before its finally block completed the
        // resolveConversation HTTP call, leaving the conversation stuck in "active".
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
          // Determine role: identities starting with "agent-" are agents
          const role = args.participantIdentity.startsWith("agent-")
            ? "agent"
            : "user";

          await ctx.runMutation(internal.livekitDb.addParticipant, {
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
          await ctx.runMutation(internal.livekitDb.removeParticipant, {
            roomId: room._id,
            identity: args.participantIdentity,
          });
        }
        break;
    }
  },
});
