import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";
import { getInitialState } from "./toolHandlers";

/** GET /api/scenario-state — Get current scenario state for an app */
export const getScenarioState = corsHttpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const slug = auth.app.slug;

  const stateRow = await ctx.runQuery(internal.scenarioStateDb.getState, {
    appSlug: slug,
  });

  if (stateRow) {
    try {
      return jsonResponse({
        appSlug: slug,
        state: JSON.parse(stateRow.state),
        updatedAt: stateRow.updatedAt,
      });
    } catch {
      return jsonResponse({ appSlug: slug, state: null, updatedAt: null });
    }
  }

  // Return initial state if no row exists (but don't persist — that happens on first tool call)
  const initial = getInitialState(slug);
  return jsonResponse({
    appSlug: slug,
    state: initial,
    updatedAt: null,
  });
});

/** POST /api/scenario-state/reset — Reset scenario state to initial values */
export const resetScenarioState = corsHttpAction(async (ctx, request) => {
  const body = await request.json().catch(() => ({}));

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const slug = auth.app.slug;
  const initial = getInitialState(slug);

  if (!initial) {
    return jsonResponse({ ok: true, message: "No mutable state for this scenario" });
  }

  await ctx.runMutation(internal.scenarioStateDb.upsertState, {
    appSlug: slug,
    state: JSON.stringify(initial),
  });

  return jsonResponse({ ok: true, state: initial });
});
