import { NextResponse } from 'next/server';
import { getGeminiServerApiKey } from '../../../server/env';

const MAX_MESSAGES = 60;
const MAX_CONTENT_CHARS = 1200;
const GEMINI_TIMEOUT_MS = 12_000;

function normalizeMessages(
  input: unknown,
): Array<{ role: string; content: string }> {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const role = typeof record.role === 'string' ? record.role : '';
      const content = typeof record.content === 'string' ? record.content.trim() : '';
      if (!role || !content) return null;
      return {
        role,
        content: content.slice(0, MAX_CONTENT_CHARS),
      };
    })
    .filter((item): item is { role: string; content: string } => item !== null)
    .slice(-MAX_MESSAGES);
}

export async function POST(request: Request) {
  const apiKey = getGeminiServerApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server misconfigured: missing GEMINI_API_KEY' },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const messages = normalizeMessages((body as { messages?: unknown }).messages);

  if (messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
  }

  const transcript = messages
    .map((m) => `${m.role === 'agent' ? 'Agent' : 'User'}: ${m.content}`)
    .join('\n');

  const prompt = `Analyze this customer service conversation transcript and return a JSON object with exactly these fields:
- "summary": A concise 2-3 sentence summary of what happened in the conversation.
- "sentiment": One of "positive", "neutral", "negative", or "mixed" reflecting the customer's overall sentiment.
- "topics": An array of 1-4 short topic labels (e.g. "appointment booking", "billing issue").
- "resolution": One of "resolved", "unresolved", "escalated", or "unknown".

Transcript:
${transcript}

Respond ONLY with valid JSON, no markdown fences.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
          },
        }),
        signal: controller.signal,
      },
    );
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      { error: isAbortError ? 'Gemini API timed out' : 'Gemini API request failed' },
      { status: isAbortError ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: `Gemini API error: ${err}` },
      { status: 502 },
    );
  }

  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  try {
    const parsed = JSON.parse(text.trim());
    return NextResponse.json(parsed);
  } catch {
    // If Gemini wrapped it in markdown fences, strip them
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({
        summary: text,
        sentiment: 'neutral',
        topics: [],
        resolution: 'unknown',
      });
    }
  }
}
