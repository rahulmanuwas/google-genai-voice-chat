import { internal } from "./_generated/api";
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

  const id = await ctx.runMutation(internal.annotationsDb.upsertAnnotation, {
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
    const annotation = await ctx.runQuery(internal.annotationsDb.getBySession, { sessionId, appSlug: auth.app.slug });
    if (!annotation) return jsonResponse({ annotation: null });
    return jsonResponse({
      annotation: {
        ...annotation,
        failureModes: parseJson(annotation.failureModes, []),
      },
    });
  }

  // List annotations
  const annotations = await ctx.runQuery(internal.annotationsDb.list, {
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
