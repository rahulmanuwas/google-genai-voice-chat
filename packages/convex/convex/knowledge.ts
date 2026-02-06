import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse } from "./helpers";

/** POST /api/knowledge — Add or update a knowledge document */
export const upsertDocument = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, title, content, category, sourceType, updatedBy } =
    body as {
      appSlug: string;
      appSecret: string;
      title: string;
      content: string;
      category: string;
      sourceType?: string;
      updatedBy?: string;
    };

  if (!appSlug || !appSecret || !title || !content || !category) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const docId = await ctx.runAction(internal.knowledgeInternal.upsertWithEmbedding, {
    appSlug,
    title,
    content,
    category,
    sourceType: sourceType ?? "document",
    updatedBy,
  });

  return jsonResponse({ id: docId });
});

/** POST /api/knowledge/search — Search knowledge base via vector similarity */
export const searchKnowledge = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, query, category, topK } = body as {
    appSlug: string;
    appSecret: string;
    query: string;
    category?: string;
    topK?: number;
  };

  if (!appSlug || !appSecret || !query) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const results = await ctx.runAction(internal.knowledgeInternal.searchAction, {
    appSlug,
    query,
    category,
    topK: topK ?? 5,
  });

  return jsonResponse({ results });
});

/** GET /api/knowledge/gaps — List knowledge gaps */
export const listGaps = httpAction(async (ctx, request) => {
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

  const gaps = await ctx.runQuery(internal.knowledgeInternal.getUnresolvedGaps, {
    appSlug,
  });

  return jsonResponse({ gaps });
});
