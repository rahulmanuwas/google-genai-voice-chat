// src/api/createChatHandler.ts

/**
 * Factory function to create a Next.js API route handler for text-only chat
 */

import { GoogleGenAI } from '@google/genai';
import type { ChatHandlerConfig } from '../lib/types';

interface ChatRequest {
    message: string;
    history?: Array<{ role: 'user' | 'model'; content: string }>;
}

interface ChatResponse {
    response?: string;
    error?: string;
}

/**
 * Create a chat handler for Next.js API routes
 * 
 * @example
 * ```ts
 * // app/api/chat/route.ts
 * import { createChatHandler } from '@genai-voice/livekit/chatbot/api';
 * 
 * export const POST = createChatHandler({
 *   systemPrompt: 'You are a helpful assistant...',
 * });
 * ```
 */
export function createChatHandler(config: ChatHandlerConfig) {
    const { systemPrompt, model = 'gemini-2.0-flash', modelAcknowledgment = 'Understood. I am ready to help.' } = config;

    return async function handler(request: Request): Promise<Response> {
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return Response.json(
                    { error: 'API key not configured' } as ChatResponse,
                    { status: 500 }
                );
            }

            const body = await request.json() as ChatRequest;
            const { message, history } = body;

            if (!message || typeof message !== 'string') {
                return Response.json(
                    { error: 'Message is required' } as ChatResponse,
                    { status: 400 }
                );
            }

            const ai = new GoogleGenAI({ apiKey });

            const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [
                { role: 'model' as const, parts: [{ text: modelAcknowledgment }] },
            ];

            const historyLimit = 10;
            const safeHistory = Array.isArray(history) ? history.slice(-historyLimit) : [];
            for (const msg of safeHistory) {
                if (!msg || typeof msg.content !== 'string') continue;
                contents.push({
                    role: msg.role === 'user' ? 'user' as const : 'model' as const,
                    parts: [{ text: msg.content }],
                });
            }

            contents.push({ role: 'user' as const, parts: [{ text: message }] });

            const response = await ai.models.generateContent({
                model,
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents,
            } as unknown as Parameters<typeof ai.models.generateContent>[0]);

            const text = response.text || "I apologize, but I couldn't generate a response. Please try again.";

            return Response.json({ response: text } as ChatResponse);
        } catch (error) {
            console.error('Chat API error:', error);
            return Response.json(
                { error: 'Failed to process request' } as ChatResponse,
                { status: 500 }
            );
        }
    };
}
