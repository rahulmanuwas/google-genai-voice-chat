import { e as ChatHandlerConfig } from './types-Bt86lhtR.js';
import '@google/genai';

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
declare function createChatHandler(config: ChatHandlerConfig): (request: Request) => Promise<Response>;

export { createChatHandler };
