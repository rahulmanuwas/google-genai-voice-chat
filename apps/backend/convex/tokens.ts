import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

export const createToken = corsHttpAction(async (ctx, request) => {
  const body = await request.json();

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const { app } = auth;

  try {
    const result = await ctx.runAction(internal.tokensInternal.generateTokenAction, {
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
