"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";

export const generateToken = internalAction({
  args: {
    modelId: v.string(),
    replyAsAudio: v.boolean(),
    systemPrompt: v.string(),
    tokenExpireMinutes: v.float64(),
  },
  handler: async (_ctx, args) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error("Server misconfigured: missing GEMINI_API_KEY");
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const expireTime = new Date(
      Date.now() + args.tokenExpireMinutes * 60 * 1000
    ).toISOString();
    const newSessionExpireTime = new Date(
      Date.now() + 2 * 60 * 1000
    ).toISOString();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: "v1alpha" },
        liveConnectConstraints: {
          model: args.modelId,
          config: {
            responseModalities: [
              args.replyAsAudio ? ("AUDIO" as const) : ("TEXT" as const),
            ],
            systemInstruction: args.systemPrompt,
            sessionResumption: {},
            outputAudioTranscription: {},
            inputAudioTranscription: {},
          },
        },
      },
    });

    return {
      token: token.name,
      expiresAt: expireTime,
    };
  },
});
