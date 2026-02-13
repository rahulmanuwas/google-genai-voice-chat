import { NextResponse } from 'next/server';
import { getGeminiServerApiKey } from '../../../../server/env';

type InputMessage = { role: string; content: string };
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 1200;
const GEMINI_TIMEOUT_MS = 12_000;

function roleLabel(role: string): 'User' | 'Agent' | null {
  const r = (role || '').toLowerCase();
  if (r === 'user') return 'User';
  if (r === 'model' || r === 'assistant' || r === 'agent') return 'Agent';
  if (r === 'system') return null;
  return null;
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

  const messages = Array.isArray((body as { messages?: unknown }).messages)
    ? (body as { messages: InputMessage[] }).messages
    : [];

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
  }

  const cleaned = messages
    .map((m) => {
      const label = roleLabel(m.role);
      if (!label) return null;
      const content = typeof m.content === 'string' ? m.content.trim().slice(0, MAX_CONTENT_CHARS) : '';
      if (!content) return null;
      return `${label}: ${content}`;
    })
    .filter(Boolean)
    .slice(-MAX_MESSAGES) // keep it small; memory should be extracted from the latest conversation
    .join('\n');

  const prompt = `You are a "long-term memory" extractor for a customer support voice agent.

Given the transcript, extract ONLY durable, non-sensitive facts about the USER (the customer) that would be useful in a future conversation.

Rules:
- Only include facts the user explicitly stated.
- Prefer stable preferences (e.g. preferred appointment times, product preferences, communication preferences).
- Do NOT store sensitive data: exact address, phone/email, payment details, SSNs, passwords, medical diagnoses, or anything that would be unsafe to retain.
- Max 5 facts. Each fact should be a short sentence fragment in third person (e.g. "Prefers afternoon appointments").

Return a JSON object with exactly these fields:
- "userName": string or null
- "facts": string[] (0-5 items)
- "conversationSummary": string (1-2 short sentences)

Transcript:
${cleaned}

Respond ONLY with valid JSON.`;

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
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  const tryParse = (s: string) => {
    try {
      return JSON.parse(s.trim());
    } catch {
      return null;
    }
  };

  const parsed =
    tryParse(text) ??
    tryParse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const userName =
      typeof obj.userName === 'string' ? obj.userName : null;
    const factsRaw = Array.isArray(obj.facts) ? obj.facts : [];
    const facts = factsRaw
      .filter((f: unknown): f is string => typeof f === 'string')
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 5);
    const conversationSummary =
      typeof obj.conversationSummary === 'string'
        ? obj.conversationSummary
        : '';

    return NextResponse.json({ userName, facts, conversationSummary });
  }

  // Fallback: return something usable for the demo UI, even if JSON parsing failed.
  return NextResponse.json({
    userName: null,
    facts: [],
    conversationSummary: text.trim().slice(0, 300),
  });
}
