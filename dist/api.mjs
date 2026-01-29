import { GoogleGenAI } from '@google/genai';

// src/api/createChatHandler.ts
function createChatHandler(config) {
  const { systemPrompt, model = "gemini-2.0-flash", modelAcknowledgment = "Understood. I am ready to help." } = config;
  return async function handler(request) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return Response.json(
          { error: "API key not configured" },
          { status: 500 }
        );
      }
      const body = await request.json();
      const { message, history } = body;
      if (!message || typeof message !== "string") {
        return Response.json(
          { error: "Message is required" },
          { status: 400 }
        );
      }
      const ai = new GoogleGenAI({ apiKey });
      const contents = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: modelAcknowledgment }] }
      ];
      if (Array.isArray(history)) {
        for (const msg of history) {
          contents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }]
          });
        }
      }
      contents.push({ role: "user", parts: [{ text: message }] });
      const response = await ai.models.generateContent({
        model,
        contents
      });
      const text = response.text || "I apologize, but I couldn't generate a response. Please try again.";
      return Response.json({ response: text });
    } catch (error) {
      console.error("Chat API error:", error);
      return Response.json(
        { error: "Failed to process request" },
        { status: 500 }
      );
    }
  };
}

export { createChatHandler };
//# sourceMappingURL=api.mjs.map
//# sourceMappingURL=api.mjs.map