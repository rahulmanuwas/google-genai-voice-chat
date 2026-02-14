import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** POST /api/experiments — Create a new experiment */
export const createExperiment = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { name, variants } = body as {
    name: string;
    variants: Array<{ id: string; weight: number; config?: Record<string, unknown> }>;
  };

  if (!name || !variants || !Array.isArray(variants) || variants.length < 2) {
    return jsonResponse({ error: "Name and at least 2 variants required" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const experimentId = await ctx.runMutation(internal.experiments.createExperimentRecord, {
    appSlug: auth.app.slug,
    name,
    variants: JSON.stringify(variants),
  });

  return jsonResponse({ id: experimentId });
});

/** GET /api/experiments — List experiments */
export const listExperiments = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const experiments = await ctx.runQuery(internal.experiments.listExperimentRecords, {
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
export const assignVariant = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { experimentId, sessionId } = body as {
    experimentId: string;
    sessionId: string;
  };

  if (!experimentId || !sessionId) {
    return jsonResponse({ error: "experimentId and sessionId required" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const experimentRecordId = experimentId as Id<"experiments">;

  // Check for existing exposure (sticky assignment)
  const existing = await ctx.runQuery(internal.experiments.getExposureRecord, {
    experimentId: experimentRecordId,
    sessionId,
  });

  if (existing) {
    return jsonResponse({ variantId: existing.variantId, alreadyAssigned: true });
  }

  // Get experiment
  const experiment = await ctx.runQuery(internal.experiments.getExperimentRecord, {
    experimentId: experimentRecordId,
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
  await ctx.runMutation(internal.experiments.logExposureRecord, {
    appSlug: auth.app.slug,
    experimentId: experimentRecordId,
    sessionId,
    variantId: selectedVariant,
  });

  return jsonResponse({ variantId: selectedVariant, alreadyAssigned: false });
});

/** Create a new experiment */
export const createExperimentRecord = internalMutation({
  args: {
    appSlug: v.string(),
    name: v.string(),
    variants: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("experiments", {
      appSlug: args.appSlug,
      name: args.name,
      variants: args.variants,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

/** List experiments (optionally filtered by app) */
export const listExperimentRecords = internalQuery({
  args: { appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.appSlug) {
      return await ctx.db
        .query("experiments")
        .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("experiments").order("desc").collect();
  },
});

/** Get a specific experiment by ID */
export const getExperimentRecord = internalQuery({
  args: { experimentId: v.id("experiments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.experimentId);
  },
});

/** Check if session already has an exposure for this experiment */
export const getExposureRecord = internalQuery({
  args: {
    experimentId: v.id("experiments"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const exposures = await ctx.db
      .query("experimentExposures")
      .withIndex("by_experiment", (q) => q.eq("experimentId", args.experimentId))
      .collect();
    return exposures.find((exposure) => exposure.sessionId === args.sessionId) ?? null;
  },
});

/** Log an experiment exposure */
export const logExposureRecord = internalMutation({
  args: {
    appSlug: v.string(),
    experimentId: v.id("experiments"),
    sessionId: v.string(),
    variantId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("experimentExposures", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
