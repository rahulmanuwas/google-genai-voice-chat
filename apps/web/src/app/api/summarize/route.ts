import { NextResponse } from 'next/server';
import { getServerEnv } from '../../../server/env';

export async function POST(request: Request) {
  const apiKey = getServerEnv('NEXT_PUBLIC_GEMINI_API_KEY');
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server misconfigured: missing NEXT_PUBLIC_GEMINI_API_KEY' },
      { status: 500 },
    );
  }

  const { messages } = (await request.json()) as {
    messages: { role: string; content: string }[];
  };

  if (!messages || messages.length === 0) {
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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
        },
      }),
    },
  );

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
        sentiment: 'unknown',
        topics: [],
        resolution: 'unknown',
      });
    }
  }
}
