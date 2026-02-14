import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getTraceId, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** POST /api/knowledge — Add or update a knowledge document */
export const upsertDocument = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { title, content, category, sourceType, updatedBy } =
    body as {
      title: string;
      content: string;
      category: string;
      sourceType?: string;
      updatedBy?: string;
    };

  if (!title || !content || !category) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
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
export const searchKnowledge = corsHttpAction(async (ctx, request) => {
  const traceId = getTraceId(request);
  const body = await request.json();
  const { query, category, topK, sessionId } = body as {
    query: string;
    category?: string;
    topK?: number;
    sessionId?: string;
  };

  if (!query) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const results = await ctx.runAction(internal.knowledgeInternal.searchAction, {
    appSlug: auth.app.slug,
    query,
    category,
    topK: topK ?? 5,
    sessionId,
    traceId,
  });

  return jsonResponse({ results });
});

/** GET /api/knowledge/documents — List knowledge documents */
export const listDocuments = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const documents = await ctx.runQuery(
    internal.knowledgeDb.listDocuments,
    { appSlug: all ? undefined : auth.app.slug }
  );

  return jsonResponse({ documents });
});

/** GET /api/knowledge/gaps — List knowledge gaps */
export const listGaps = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const gaps = await ctx.runQuery(internal.knowledgeDb.getUnresolvedGaps, {
    appSlug: all ? undefined : auth.app.slug,
  });

  return jsonResponse({ gaps });
});

/** GET /api/knowledge/metrics?since= — Get knowledge search quality metrics */
export const searchMetrics = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const since = url.searchParams.get("since");

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const metrics = await ctx.runQuery(internal.knowledgeDb.getSearchMetrics, {
    appSlug: auth.app.slug,
    since: since ? Number(since) : undefined,
  });

  return jsonResponse(metrics);
});
