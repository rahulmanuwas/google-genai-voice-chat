import { expect, test } from '@playwright/test';

const integrationEnabled = process.env.E2E_INTEGRATION === '1';
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const hasRealApiKey = Boolean(apiKey) && apiKey !== 'dummy-playwright-key';

test.describe('Gemini API integration (real network)', () => {
  test.skip(!integrationEnabled, 'Set E2E_INTEGRATION=1 to enable real-network tests');
  test.skip(!hasRealApiKey, 'Set NEXT_PUBLIC_GEMINI_API_KEY to a real key');

  test.describe.configure({ mode: 'serial' });

  test('POST /api/summarize returns structured JSON', async ({ request }) => {
    test.setTimeout(120_000);

    const res = await request.post('/api/summarize', {
      data: {
        messages: [
          { role: 'user', content: "Hi, I'm Rahul. Can you reschedule my appointment?" },
          { role: 'agent', content: 'Sure, what day works best for you?' },
          { role: 'user', content: 'Afternoons are best. Sometime next week.' },
        ],
      },
    });

    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as unknown;
    expect(json).toBeTruthy();
    expect(typeof (json as { summary?: unknown }).summary).toBe('string');

    const sentiment = (json as { sentiment?: unknown }).sentiment;
    expect(['positive', 'neutral', 'negative', 'mixed', 'unknown']).toContain(sentiment);

    const topics = (json as { topics?: unknown }).topics;
    expect(Array.isArray(topics)).toBeTruthy();

    const resolution = (json as { resolution?: unknown }).resolution;
    expect(['resolved', 'unresolved', 'escalated', 'unknown']).toContain(resolution);
  });

  test('POST /api/memory/extract returns durable user memory', async ({ request }) => {
    test.setTimeout(120_000);

    const res = await request.post('/api/memory/extract', {
      data: {
        messages: [
          { role: 'user', content: "Hi, I'm Rahul." },
          { role: 'assistant', content: 'Nice to meet you, Rahul. How can I help?' },
          { role: 'user', content: 'I prefer afternoon appointments. I like text updates.' },
        ],
      },
    });

    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as unknown;
    expect(json).toBeTruthy();

    const userName = (json as { userName?: unknown }).userName;
    expect(userName === null || typeof userName === 'string').toBeTruthy();

    const facts = (json as { facts?: unknown }).facts;
    expect(Array.isArray(facts)).toBeTruthy();
    if (Array.isArray(facts)) {
      expect(facts.length).toBeLessThanOrEqual(5);
      for (const f of facts) {
        expect(typeof f).toBe('string');
        expect(f.trim().length).toBeGreaterThan(0);
      }
    }

    const conversationSummary = (json as { conversationSummary?: unknown }).conversationSummary;
    expect(typeof conversationSummary).toBe('string');
  });
});

