#!/usr/bin/env node
/**
 * Seed guardrail violations and annotate them with TP/FP.
 * Uses per-app auth to trigger the correct guardrail rules.
 */

const CONVEX_URL = 'https://content-parakeet-457.convex.site';
const APP_SECRET = '152b7a940d7c14722f76e1ae5ecdad4a5a83393de288789ca6b7a6ccee329584';

async function checkGuardrail(appSlug, sessionId, content, direction) {
  const res = await fetch(`${CONVEX_URL}/api/guardrails/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appSlug, appSecret: APP_SECRET, sessionId, content, direction }),
  });
  return res.json();
}

async function annotateViolation(appSlug, violationId, annotatedCorrectness) {
  const res = await fetch(`${CONVEX_URL}/api/guardrails/violations`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appSlug, appSecret: APP_SECRET, violationId, annotatedCorrectness }),
  });
  return res.json();
}

async function getViolations(appSlug) {
  const res = await fetch(`${CONVEX_URL}/api/guardrails/violations?all=true`, {
    headers: {
      'Authorization': `Bearer ${APP_SECRET}`,
      'X-App-Slug': appSlug,
    },
  });
  return res.json();
}

const checks = [
  // ─── demo-dentist: medical advice (block) ───
  {
    appSlug: 'demo-dentist',
    sessionId: 'session-1770781765926-xt9ev7',
    content: 'Can you prescribe me something for my toothache?',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-dentist',
    sessionId: 'session-1770994578603-ur0kkw',
    content: 'Is it safe to take medication before my Invisalign appointment?',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-dentist',
    sessionId: 'session-1770688335625-lybt9c',
    content: 'What medication do you recommend for post-procedure pain?',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-dentist',
    sessionId: 'session-1770780785887-996bk4',
    content: 'Can Dr. Chen diagnose why my gums are bleeding?',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-dentist',
    sessionId: 'session-1771001073093-k7524s',
    content: 'My dentist at another dental office said I need a root canal',
    direction: 'input',
    annotation: 'false_positive', // mentioned "another dental" but wasn't asking about competitors
  },
  // ─── demo-dentist: competitor (block) ───
  {
    appSlug: 'demo-dentist',
    sessionId: 'session-1770700093670-etbytl',
    content: 'I might switch to another dentist, your service is slow',
    direction: 'input',
    annotation: 'false_positive', // user venting, not actually asking about competitor
  },
  {
    appSlug: 'demo-dentist',
    sessionId: 'session-1770690007297-pouvbr',
    content: 'Is there a different practice nearby that takes my insurance?',
    direction: 'input',
    annotation: 'true_positive',
  },

  // ─── demo-earnings: forward-looking (log) ───
  {
    appSlug: 'demo-earnings',
    sessionId: 'session-1770534054230-54rfep',
    content: 'What is the outlook for next quarter revenue?',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-earnings',
    sessionId: 'session-1770534054230-54rfep',
    content: 'Do you expect growth in the Asia Pacific region?',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-earnings',
    sessionId: 'session-1770515098766-9fuyyf',
    content: 'The company projects strong guidance for 2026',
    direction: 'output',
    annotation: 'true_positive',
  },
  // ─── demo-earnings: investment advice (block) ───
  {
    appSlug: 'demo-earnings',
    sessionId: 'session-1770515098766-9fuyyf',
    content: 'Should I buy more shares at this price?',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-earnings',
    sessionId: 'session-1770534054230-54rfep',
    content: 'What is the stock price target for next year?',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-earnings',
    sessionId: 'session-1770515098766-9fuyyf',
    content: 'We sold off our underperforming assets last quarter',
    direction: 'output',
    annotation: 'false_positive', // "sold" triggered but it's about company operations, not investment advice
  },

  // ─── demo-ecommerce: large refund (warn) ───
  {
    appSlug: 'demo-ecommerce',
    sessionId: 'session-1770553213358-nz9kos',
    content: 'I want a refund of over $250 for the damaged sofa',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-ecommerce',
    sessionId: 'session-1770695491178-p97abi',
    content: 'Can I get a $300 refund for the wrong item?',
    direction: 'input',
    annotation: 'true_positive',
  },
  // ─── demo-ecommerce: wholesale/pricing (block) ───
  {
    appSlug: 'demo-ecommerce',
    sessionId: 'session-1770695491178-p97abi',
    content: 'What is your wholesale price for bulk orders?',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-ecommerce',
    sessionId: 'session-1770553213358-nz9kos',
    content: 'What is the markup on your furniture?',
    direction: 'input',
    annotation: 'true_positive',
  },
  // ─── demo-ecommerce: competitor (block) ───
  {
    appSlug: 'demo-ecommerce',
    sessionId: 'session-1770553213358-nz9kos',
    content: 'I saw the same item cheaper at Pottery Barn',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-ecommerce',
    sessionId: 'session-1770695491178-p97abi',
    content: 'How does this compare to West Elm quality?',
    direction: 'input',
    annotation: 'true_positive',
  },
  {
    appSlug: 'demo-ecommerce',
    sessionId: 'session-1770641074134-p0qk08',
    content: 'I was looking at a restoration piece for my living room',
    direction: 'input',
    annotation: 'false_positive', // "restoration" triggered competitor rule but user means furniture restoration
  },
];

async function main() {
  console.log('🛡️  Seeding guardrail violations...\n');

  let created = 0;
  let annotated = 0;
  const violationIds = [];

  for (const check of checks) {
    try {
      const result = await checkGuardrail(check.appSlug, check.sessionId, check.content, check.direction);

      if (result.violations && result.violations.length > 0) {
        const v = result.violations[0];
        console.log(`  🚫 [${check.appSlug}] ${check.direction}: "${check.content.slice(0, 55)}..." → ${v.action}`);
        created++;
        violationIds.push({ check, ruleId: v.ruleId });
      } else if (result.allowed === false) {
        console.log(`  🚫 [${check.appSlug}] ${check.direction}: "${check.content.slice(0, 55)}..." → blocked`);
        created++;
      } else {
        console.log(`  ✅ [${check.appSlug}] ${check.direction}: "${check.content.slice(0, 55)}..." → passed (no match)`);
      }
    } catch (e) {
      console.error(`  ❌ ${check.content.slice(0, 40)}: ${e.message}`);
    }
  }

  // Now fetch all violations and annotate them
  console.log('\n📋 Annotating violations...');
  for (const appSlug of ['demo-dentist', 'demo-earnings', 'demo-ecommerce']) {
    const { violations } = await getViolations(appSlug);
    if (!violations || violations.length === 0) continue;

    for (const v of violations) {
      // Find the matching check by content
      const matchingCheck = checks.find(
        (c) => c.appSlug === appSlug && c.content === v.content
      );

      if (matchingCheck && matchingCheck.annotation && !v.annotatedCorrectness) {
        try {
          await annotateViolation(appSlug, v._id, matchingCheck.annotation);
          const label = matchingCheck.annotation === 'true_positive' ? 'TP ✓' : 'FP ✗';
          console.log(`  ${label} [${appSlug}] "${v.content.slice(0, 50)}..."`);
          annotated++;
        } catch (e) {
          console.error(`  ❌ Annotation failed: ${e.message}`);
        }
      }
    }
  }

  console.log(`\n✅ ${created} violations created, ${annotated} annotated`);
}

main().catch(console.error);
