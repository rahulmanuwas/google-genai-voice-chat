import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

// POST /api/annotations — create or update annotation
export const upsertAnnotation = corsHttpAction(async (ctx, request) => {
  const body = (await request.json()) as {
    sessionId?: string;
    conversationId?: string;
    qualityRating?: string;
    failureModes?: string[];
    notes?: string;
    annotatedBy?: string;
  };

  const { sessionId, conversationId, qualityRating, failureModes, notes, annotatedBy } = body;

  if (!sessionId || !qualityRating) {
    return jsonResponse({ error: "Missing required fields: sessionId, qualityRating" }, 400);
  }

  const validRatings = ["good", "bad", "mixed"];
  if (!validRatings.includes(qualityRating)) {
    return jsonResponse({ error: `qualityRating must be one of: ${validRatings.join(", ")}` }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const id = await ctx.runMutation(internal.annotations.upsertAnnotationRecord, {
    appSlug: auth.app.slug,
    sessionId,
    conversationId,
    qualityRating,
    failureModes: JSON.stringify(failureModes ?? []),
    notes: notes ?? "",
    annotatedBy: annotatedBy ?? "dashboard-user",
  });

  return jsonResponse({ ok: true, id });
});

// GET /api/annotations?sessionId=... or ?all=true&quality=good
export const listAnnotations = corsHttpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const all = url.searchParams.get("all") === "true";
  const filterApp = url.searchParams.get("appSlug") ?? undefined;
  const quality = url.searchParams.get("quality") ?? undefined;
  const limit = url.searchParams.get("limit");

  // Single annotation lookup by sessionId (app-scoped)
  if (sessionId) {
    const annotation = await ctx.runQuery(internal.annotations.getAnnotationBySessionRecord, { sessionId, appSlug: auth.app.slug });
    if (!annotation) return jsonResponse({ annotation: null });
    return jsonResponse({
      annotation: {
        ...annotation,
        failureModes: parseJson(annotation.failureModes, []),
      },
    });
  }

  // List annotations
  const annotations = await ctx.runQuery(internal.annotations.listAnnotationRecords, {
    appSlug: filterApp ?? (all ? undefined : auth.app.slug),
    quality,
    limit: limit ? Number(limit) : undefined,
  });

  return jsonResponse({
    annotations: annotations.map((a) => ({
      ...a,
      failureModes: parseJson(a.failureModes, []),
    })),
  });
});

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const upsertAnnotationRecord = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    conversationId: v.optional(v.string()),
    qualityRating: v.string(),
    failureModes: v.string(),
    notes: v.string(),
    annotatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("conversationAnnotations")
      .withIndex("by_app_createdAt", (q) => q.eq("appSlug", args.appSlug))
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        qualityRating: args.qualityRating,
        failureModes: args.failureModes,
        notes: args.notes,
        annotatedBy: args.annotatedBy,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("conversationAnnotations", {
      appSlug: args.appSlug,
      sessionId: args.sessionId,
      conversationId: args.conversationId as Id<"conversations"> | undefined,
      qualityRating: args.qualityRating,
      failureModes: args.failureModes,
      notes: args.notes,
      annotatedBy: args.annotatedBy,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getAnnotationBySessionRecord = internalQuery({
  args: { sessionId: v.string(), appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.appSlug) {
      return await ctx.db
        .query("conversationAnnotations")
        .withIndex("by_app_createdAt", (q) => q.eq("appSlug", args.appSlug!))
        .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
        .first();
    }
    return await ctx.db
      .query("conversationAnnotations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

export const listAnnotationRecords = internalQuery({
  args: {
    appSlug: v.optional(v.string()),
    quality: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const lim = args.limit ?? 200;

    if (args.appSlug && args.quality) {
      const all = await ctx.db
        .query("conversationAnnotations")
        .withIndex("by_app_createdAt", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(lim);
      return all.filter((annotation) => annotation.qualityRating === args.quality);
    }

    if (args.quality) {
      return await ctx.db
        .query("conversationAnnotations")
        .withIndex("by_quality", (q) => q.eq("qualityRating", args.quality!))
        .order("desc")
        .take(lim);
    }

    if (args.appSlug) {
      return await ctx.db
        .query("conversationAnnotations")
        .withIndex("by_app_createdAt", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(lim);
    }

    return await ctx.db
      .query("conversationAnnotations")
      .order("desc")
      .take(lim);
  },
});
