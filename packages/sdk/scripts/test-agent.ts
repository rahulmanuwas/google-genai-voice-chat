/**
 * Test the Pi agent API.
 *
 * Run: npx tsx packages/sdk/scripts/test-agent.ts
 *
 * Requires GOOGLE_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY) in environment.
 *   export $(grep -v '^#' apps/web/.env.local | grep -v '^$' | xargs) && npx tsx packages/sdk/scripts/test-agent.ts
 */
import { createAgent, isAvailable, getProviders, getAdapter } from '../src/agent/index';

// Pi SDK uses GEMINI_API_KEY for Google provider, map from GOOGLE_API_KEY
if (process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
}

async function main() {
  console.log('=== Pi Runtime Available ===');
  console.log(isAvailable() ? 'Yes' : 'No — install @mariozechner/pi-coding-agent');

  console.log('\n=== Static Providers ===');
  for (const p of getProviders()) {
    console.log(`  ${p.name}: ${p.models.map(m => m.id).join(', ')}`);
  }

  // Dynamic provider discovery
  if (isAvailable()) {
    console.log('\n=== Dynamic Provider Discovery (Pi SDK) ===');
    const adapter = getAdapter();
    const discovered = await adapter.discoverProviders();
    console.log(`  Found ${discovered.length} providers:`);
    for (const p of discovered) {
      if (p.models.length > 0) {
        const preview = p.models.slice(0, 3).map(m => m.id).join(', ');
        const more = p.models.length > 3 ? ` (+${p.models.length - 3} more)` : '';
        console.log(`    ${p.name}: ${preview}${more}`);
      }
    }
  }

  // Test creating an agent
  console.log('\n=== Creating Agent ===');
  const provider = process.env.GOOGLE_API_KEY ? 'google' :
                   process.env.ANTHROPIC_API_KEY ? 'anthropic' :
                   process.env.OPENAI_API_KEY ? 'openai' : 'google';

  const model = provider === 'google' ? 'gemini-3-flash-preview' :
                provider === 'anthropic' ? 'claude-sonnet-4-5-20250929' :
                'gpt-4o';

  console.log(`  Provider: ${provider}, Model: ${model}`);

  try {
    const agent = await createAgent({ provider, model });

    console.log(`  Session: ${agent.sessionId}`);
    console.log(`  State: ${agent.getState()}`);

    agent.on('state_change', (s: unknown) => console.log(`  [event] state → ${s}`));
    agent.on('tool_call', (d: unknown) => console.log(`  [event] tool_call: ${(d as any)?.tool}`));
    agent.on('response', (delta: unknown) => process.stdout.write(String(delta)));

    console.log('\n  --- Prompt: "What files are in the current directory? List top-level ones briefly." ---');
    const response = await agent.prompt('What files are in the current directory? List top-level ones briefly.');
    console.log(`\n  --- Response: ${response.length} chars ---`);

    await agent.close();
    console.log(`  State after close: ${agent.getState()}`);
  } catch (err: any) {
    console.error(`  Error: ${err.message}`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
