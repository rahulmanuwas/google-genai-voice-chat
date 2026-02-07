import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest } from "./helpers";

/** POST /api/knowledge — Add or update a knowledge document */
export const upsertDocument = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, title, content, category, sourceType, updatedBy } =
    body as {
      appSlug?: string;
      appSecret?: string;
      sessionToken?: string;
      title: string;
      content: string;
      category: string;
      sourceType?: string;
      updatedBy?: string;
    };

  if (!title || !content || !category) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const docId = await ctx.runAction(internal.knowledgeInternal.upsertWithEmbedding, {
    appSlug: auth.app.slug,
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
  const { appSlug, appSecret, sessionToken, query, category, topK } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    query: string;
    category?: string;
    topK?: number;
  };

  if (!query) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const results = await ctx.runAction(internal.knowledgeInternal.searchAction, {
    appSlug: auth.app.slug,
    query,
    category,
    topK: topK ?? 5,
  });

  return jsonResponse({ results });
});

/** GET /api/knowledge/gaps — List knowledge gaps */
export const listGaps = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug") ?? undefined;
  const appSecret = url.searchParams.get("appSecret") ?? undefined;
  const sessionToken = url.searchParams.get("sessionToken") ?? undefined;

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const gaps = await ctx.runQuery(internal.knowledgeDb.getUnresolvedGaps, {
    appSlug: auth.app.slug,
  });

  return jsonResponse({ gaps });
});
