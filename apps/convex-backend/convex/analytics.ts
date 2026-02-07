import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest } from "./helpers";

/** POST /api/csat — Submit a CSAT rating */
export const submitCSAT = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, sessionId, rating, comment } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
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

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
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
export const getInsights = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug") ?? undefined;
  const appSecret = url.searchParams.get("appSecret") ?? undefined;
  const sessionToken = url.searchParams.get("sessionToken") ?? undefined;
  const period = url.searchParams.get("period");

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
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
    { appSlug: auth.app.slug }
  );
  return jsonResponse({ insights });
});

/** GET /api/analytics/overview — Live overview stats */
export const getOverview = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug") ?? undefined;
  const appSecret = url.searchParams.get("appSecret") ?? undefined;
  const sessionToken = url.searchParams.get("sessionToken") ?? undefined;
  const since = url.searchParams.get("since");

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const overview = await ctx.runQuery(
    internal.analyticsInternal.computeOverview,
    { appSlug: auth.app.slug, since: since ? Number(since) : undefined }
  );

  return jsonResponse(overview);
});
