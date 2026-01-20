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
 * import { createChatHandler } from 'google-genai-voice-chat/api';
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

            const contents = [
                { role: 'user' as const, parts: [{ text: systemPrompt }] },
                { role: 'model' as const, parts: [{ text: modelAcknowledgment }] },
            ];

            if (Array.isArray(history)) {
                for (const msg of history) {
                    contents.push({
                        role: msg.role === 'user' ? 'user' as const : 'model' as const,
                        parts: [{ text: msg.content }],
                    });
                }
            }

            contents.push({ role: 'user' as const, parts: [{ text: message }] });

            const response = await ai.models.generateContent({
                model,
                contents,
            });

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
