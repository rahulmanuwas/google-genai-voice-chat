import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse } from "./helpers";

/** POST /api/csat — Submit a CSAT rating */
export const submitCSAT = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionId, rating, comment } = body as {
    appSlug: string;
    appSecret: string;
    sessionId: string;
    rating: number;
    comment?: string;
  };

  if (!appSlug || !appSecret || !sessionId || rating == null) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  if (rating < 1 || rating > 5) {
    return jsonResponse({ error: "Rating must be between 1 and 5" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  await ctx.runMutation(internal.analyticsInternal.insertCSAT, {
    appSlug,
    sessionId,
    rating,
    comment,
  });

  return jsonResponse({ ok: true });
});

/** GET /api/analytics/insights — Get insights for a period */
export const getInsights = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug");
  const appSecret = url.searchParams.get("appSecret");
  const period = url.searchParams.get("period");

  if (!appSlug || !appSecret) {
    return jsonResponse({ error: "Missing appSlug or appSecret" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (period) {
    const insight = await ctx.runQuery(
      internal.analyticsInternal.getInsightByPeriod,
      { appSlug, period }
    );
    return jsonResponse({ insight });
  }

  // Return last 30 periods
  const insights = await ctx.runQuery(
    internal.analyticsInternal.getRecentInsights,
    { appSlug }
  );
  return jsonResponse({ insights });
});

/** GET /api/analytics/overview — Live overview stats */
export const getOverview = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug");
  const appSecret = url.searchParams.get("appSecret");

  if (!appSlug || !appSecret) {
    return jsonResponse({ error: "Missing appSlug or appSecret" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const overview = await ctx.runQuery(
    internal.analyticsInternal.computeOverview,
    { appSlug }
  );

  return jsonResponse(overview);
});
