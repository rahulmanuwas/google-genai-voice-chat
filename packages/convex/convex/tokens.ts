import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse } from "./helpers";

export const createToken = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret } = body as {
    appSlug: string;
    appSecret: string;
  };

  if (!appSlug || !appSecret) {
    return jsonResponse({ error: "Missing appSlug or appSecret" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, {
    slug: appSlug,
  });

  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const result = await ctx.runAction(internal.tokensInternal.generateToken, {
      modelId: app.modelId,
      replyAsAudio: app.replyAsAudio,
      systemPrompt: app.systemPrompt,
      tokenExpireMinutes: app.tokenExpireMinutes ?? 30,
    });

    return jsonResponse(result);
  } catch (err) {
    console.error("Token creation failed:", err);
    return jsonResponse(
      { error: "Token creation failed", details: (err as Error).message },
      500
    );
  }
});
