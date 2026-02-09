import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest } from "./helpers";

/** POST /api/experiments — Create a new experiment */
export const createExperiment = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, name, variants } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    name: string;
    variants: Array<{ id: string; weight: number; config?: Record<string, unknown> }>;
  };

  if (!name || !variants || !Array.isArray(variants) || variants.length < 2) {
    return jsonResponse({ error: "Name and at least 2 variants required" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const experimentId = await ctx.runMutation(internal.experimentsDb.createExperiment, {
    appSlug: auth.app.slug,
    name,
    variants: JSON.stringify(variants),
  });

  return jsonResponse({ id: experimentId });
});

/** GET /api/experiments — List experiments */
export const listExperiments = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const experiments = await ctx.runQuery(internal.experimentsDb.listExperiments, {
    appSlug: all ? undefined : auth.app.slug,
  });

  return jsonResponse({
    experiments: experiments.map((e: { variants: string; [key: string]: unknown }) => ({
      ...e,
      variants: JSON.parse(e.variants),
    })),
  });
});

/** POST /api/experiments/assign — Assign a variant (weighted random) and log exposure */
export const assignVariant = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, experimentId, sessionId } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    experimentId: string;
    sessionId: string;
  };

  if (!experimentId || !sessionId) {
    return jsonResponse({ error: "experimentId and sessionId required" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  // Check for existing exposure (sticky assignment)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await ctx.runQuery(internal.experimentsDb.getExposure, {
    experimentId: experimentId as any,
    sessionId,
  });

  if (existing) {
    return jsonResponse({ variantId: existing.variantId, alreadyAssigned: true });
  }

  // Get experiment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const experiment = await ctx.runQuery(internal.experimentsDb.getExperiment, {
    experimentId: experimentId as any,
  });

  if (!experiment || !experiment.isActive) {
    return jsonResponse({ error: "Experiment not found or inactive" }, 404);
  }

  // Weighted random assignment
  const variants = JSON.parse(experiment.variants) as Array<{ id: string; weight: number }>;
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let rand = Math.random() * totalWeight;
  let selectedVariant = variants[0].id;

  for (const variant of variants) {
    rand -= variant.weight;
    if (rand <= 0) {
      selectedVariant = variant.id;
      break;
    }
  }

  // Log exposure
  await ctx.runMutation(internal.experimentsDb.logExposure, {
    appSlug: auth.app.slug,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    experimentId: experimentId as any,
    sessionId,
    variantId: selectedVariant,
  });

  return jsonResponse({ variantId: selectedVariant, alreadyAssigned: false });
});
