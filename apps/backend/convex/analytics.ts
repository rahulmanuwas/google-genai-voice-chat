import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** POST /api/csat — Submit a CSAT rating */
export const submitCSAT = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { sessionId, rating, comment } = body as {
    sessionId: string;
    rating: number;
    comment?: string;
  };

  if (!sessionId || rating == null) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  if (rating < 1 || rating > 5) {
    return jsonResponse({ error: "Rating must be between 1 and 5" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  await ctx.runMutation(internal.analyticsInternal.insertCSAT, {
    appSlug: auth.app.slug,
    sessionId,
    rating,
    comment,
  });

  return jsonResponse({ ok: true });
});

/** GET /api/analytics/insights — Get insights for a period */
export const getInsights = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const period = url.searchParams.get("period");
  const all = url.searchParams.get("all") === "true";
  const filterApp = url.searchParams.get("appSlug") ?? undefined;

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  if (period) {
    const insight = await ctx.runQuery(
      internal.analyticsInternal.getInsightByPeriod,
      { appSlug: auth.app.slug, period }
    );
    return jsonResponse({ insight });
  }

  // Return last 30 periods
  const insights = await ctx.runQuery(
    internal.analyticsInternal.getRecentInsights,
    { appSlug: filterApp ?? (all ? undefined : auth.app.slug) }
  );
  return jsonResponse({ insights });
});

/** POST /api/analytics/cluster — Trigger conversation clustering */
export const clusterTopics = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { maxConversations, similarityThreshold } = body as {
    maxConversations?: number;
    similarityThreshold?: number;
  };

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const result = await ctx.runAction(internal.analyticsCluster.clusterConversations, {
    appSlug: auth.app.slug,
    maxConversations,
    similarityThreshold,
  });

  return jsonResponse(result);
});

/** GET /api/analytics/overview — Live overview stats */
export const getOverview = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const all = url.searchParams.get("all") === "true";
  const filterApp = url.searchParams.get("appSlug") ?? undefined;

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const overview = await ctx.runQuery(
    internal.analyticsInternal.computeOverview,
    { appSlug: filterApp ?? (all ? undefined : auth.app.slug), since: since ? Number(since) : undefined }
  );

  return jsonResponse(overview);
});
