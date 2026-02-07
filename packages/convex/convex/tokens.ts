import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest } from "./helpers";

export const createToken = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
  };

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const { app } = auth;

  try {
    const result = await ctx.runAction(internal.tokensInternal.generateToken, {
      modelId: app.modelId as string,
      replyAsAudio: app.replyAsAudio as boolean,
      systemPrompt: app.systemPrompt as string,
      tokenExpireMinutes: (app.tokenExpireMinutes as number | undefined) ?? 30,
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
