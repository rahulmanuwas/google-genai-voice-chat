#!/usr/bin/env node
/**
 * Seed script to populate evals & guardrails data based on existing Convex conversations.
 *
 * Usage: node scripts/seed-evals-data.mjs
 */

const CONVEX_URL = 'https://content-parakeet-457.convex.site';
const APP_SECRET = '152b7a940d7c14722f76e1ae5ecdad4a5a83393de288789ca6b7a6ccee329584';
const APP_SLUG = 'demo';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${APP_SECRET}`,
  'X-App-Slug': APP_SLUG,
};

async function post(path, body = {}) {
  const res = await fetch(`${CONVEX_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ appSlug: APP_SLUG, appSecret: APP_SECRET, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${JSON.stringify(data)}`);
  return data;
}

async function patch(path, body = {}) {
  const res = await fetch(`${CONVEX_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ appSlug: APP_SLUG, appSecret: APP_SECRET, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${JSON.stringify(data)}`);
  return data;
}

async function get(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${CONVEX_URL}${path}${sep}all=true`, { headers });
  return res.json();
}

// ─── 1. Annotations ───────────────────────────────────────────────
// Annotate conversations based on actual content quality analysis
const annotations = [
  // Good conversations — agent handled well
  {
    sessionId: 'session-1770996586146-ae7ej9', // Mario cancellation — already annotated, skip
    skip: true,
  },
  {
    sessionId: 'session-1771001073093-k7524s', // Maria appointment lookup — resolved well
    qualityRating: 'good',
    failureModes: [],
    notes: 'Agent correctly identified patient, found appointment, provided information. Name correction handled smoothly.',
  },
  {
    sessionId: 'session-1770700256264-8gg5nk', // PSTN call — Making (resolved)
    qualityRating: 'good',
    failureModes: [],
    notes: 'Phone call handled successfully via SIP trunk. Appointment managed correctly.',
  },
  {
    sessionId: 'session-1770688335625-lybt9c', // James — resolved, 20 msgs
    qualityRating: 'good',
    failureModes: [],
    notes: 'Comprehensive appointment management flow. Patient verified and appointment handled.',
  },
  {
    sessionId: 'session-1770553213358-nz9kos', // Jordan return — e-commerce, resolved
    qualityRating: 'good',
    failureModes: [],
    notes: 'E-commerce return flow completed successfully. All tools executed correctly.',
  },
  {
    sessionId: 'session-1770546504177-2ex6c6', // Residue appointment — SIP, resolved
    qualityRating: 'good',
    failureModes: [],
    notes: 'SIP call handled appointment reschedule despite ASR misrecognition of "reschedule" as "residue".',
  },
  {
    sessionId: 'session-1770467746554-560xel', // Hey how are you doing — short, resolved
    qualityRating: 'good',
    failureModes: [],
    notes: 'Brief interaction, agent responded appropriately to casual greeting.',
  },

  // Bad conversations — agent had issues
  {
    sessionId: 'session-1770994578603-ur0kkw', // Sarah reschedule — 38 msgs, active, tool errors
    qualityRating: 'bad',
    failureModes: ['wrong_tool', 'incomplete_response', 'context_loss'],
    notes: 'Agent failed to reschedule appointment multiple times. System kept losing the reschedule state. Patient got frustrated ("I don\'t see any"). Tool execution errors led to inconsistent state.',
  },
  {
    sessionId: 'session-1770780785887-996bk4', // David reschedule — 23 msgs, garbled response
    qualityRating: 'bad',
    failureModes: ['incomplete_response', 'tone_issue'],
    notes: 'Agent produced garbled control characters in response (<ctrl46>). User noted "was not very fluid". Rescheduling eventually worked but UX was poor.',
  },
  {
    sessionId: 'session-1771000878819-9dpv0x', // Hi / Anyone there? — no agent response
    qualityRating: 'bad',
    failureModes: ['incomplete_response'],
    notes: 'User said "Hi" and "Anyone there?" but agent never responded. 2m 48s of silence before disconnect. Complete failure to engage.',
  },
  {
    sessionId: 'session-1770641074134-p0qk08', // "I want to develop" — 126m session, wrong context
    qualityRating: 'bad',
    failureModes: ['context_loss', 'other'],
    notes: 'Session lasted 126 minutes which is abnormal. User said "I want to develop" suggesting they confused the support bot with a dev tool. Agent should have clarified scope earlier.',
  },

  // Mixed conversations — partially handled
  {
    sessionId: 'session-1770781765926-xt9ev7', // David crown fitting — reschedule worked but rough
    qualityRating: 'mixed',
    failureModes: ['tone_issue'],
    notes: 'Rescheduling eventually succeeded but had awkward pauses and disconnection mid-sentence. User had to ask "Is it done?" indicating unclear confirmation.',
  },
  {
    sessionId: 'session-1770991794516-otdi4y', // James Wilson reschedule — started well, incomplete
    qualityRating: 'mixed',
    failureModes: ['incomplete_response'],
    notes: 'Good verification flow (DOB check) and found appointment, but conversation ended before reschedule was completed. Only 5 messages — might be user dropout.',
  },
  {
    sessionId: 'session-1770700093670-etbytl', // James Wilson reschedule — 13 msgs, active, 9m
    qualityRating: 'mixed',
    failureModes: ['premature_handoff'],
    notes: 'Reschedule took 9 minutes which is too long. Multiple tool calls but resolution unclear. Session still marked as active.',
  },
  {
    sessionId: 'session-1770690007297-pouvbr', // James "did a research" — 18 msgs, active
    qualityRating: 'mixed',
    failureModes: ['context_loss', 'tone_issue'],
    notes: 'User said "I did a research of my appointment" (likely ASR error for "reschedule"). Agent should have clarified intent rather than proceeding with lookup.',
  },
  {
    sessionId: 'session-1770780325995-a17zhv', // Japanese text — 12 msgs, active
    qualityRating: 'mixed',
    failureModes: ['other'],
    notes: 'User spoke Japanese but agent is English-only. Agent should detect language mismatch and offer handoff or explain language limitations clearly.',
  },

  // Text chat annotations
  {
    sessionId: 'ses_1770998597721_jr0frx', // Nuvita team question
    qualityRating: 'good',
    failureModes: [],
    notes: 'Knowledge base retrieval worked correctly. Provided accurate team information.',
  },
  {
    sessionId: 'ses_1770468616001_j977hl', // Nuvita platform question
    qualityRating: 'good',
    failureModes: [],
    notes: 'RAG retrieval accurate. Concise answer about the platform.',
  },
  {
    sessionId: 'ses_1770374373008_8zfgxy', // COF non-combustion process
    qualityRating: 'good',
    failureModes: [],
    notes: 'Technical question answered correctly from knowledge base.',
  },
  {
    sessionId: 'ses_1770374256368_w8hrc2', // Nuvita "AI Assistant unavailable"
    qualityRating: 'bad',
    failureModes: ['other'],
    notes: 'Complete system failure — returned "AI Assistant unavailable. Please check configuration." User received no help.',
  },
  {
    sessionId: 'ses_1770374248959_r6rv3q', // Another "AI Assistant unavailable"
    qualityRating: 'bad',
    failureModes: ['other'],
    notes: 'Same configuration error. Two consecutive failures suggest a deployment issue that went undetected.',
  },
  {
    sessionId: 'session-1770534054230-54rfep', // Earnings outlook question
    qualityRating: 'good',
    failureModes: [],
    notes: 'Handled forward-looking statement guardrail correctly — logged but answered appropriately.',
  },
  {
    sessionId: 'session-1770515098766-9fuyyf', // Earnings profits question
    qualityRating: 'good',
    failureModes: [],
    notes: 'Answered financial question correctly from knowledge base without providing investment advice.',
  },
];

// ─── 2. Handoffs ──────────────────────────────────────────────────
// Create realistic handoffs from problematic conversations
const handoffs = [
  {
    sessionId: 'session-1770994578603-ur0kkw',
    channel: 'voice-webrtc',
    reason: 'tool_failure',
    reasonDetail: 'Appointment rescheduling failed 3 times. System could not persist the new date. Patient frustrated.',
    priority: 'high',
    transcript: [
      { role: 'user', content: 'Hi, my name is Sarah. I want to schedule my appointment.', ts: 1770994614146 },
      { role: 'agent', content: 'Let me check your appointments.', ts: 1770994628957 },
      { role: 'user', content: 'So can you reschedule it for five days later.', ts: 1770994646208 },
      { role: 'agent', content: 'I found an appointment for an Invisalign Consultation on February 11th. Rescheduling...', ts: 1770994659609 },
      { role: 'agent', content: 'There was an error and I wasn\'t able to reschedule. The system says the original appointment could not be found.', ts: 1770994714435 },
      { role: 'user', content: 'I don\'t see any changes.', ts: 1770994831240 },
    ],
    aiSummary: 'Patient Sarah attempted to reschedule Invisalign consultation. Tool failed 3 times due to appointment lookup errors. Patient expressed frustration.',
    customerData: { patientName: 'Sarah', dob: '1992-01-12', appointmentType: 'Invisalign Consultation' },
    // Post-creation: claim and resolve with feedback
    resolve: {
      resolutionQuality: 'poor',
      necessityScore: 1,
      agentFeedback: 'Tool execution bug — rescheduling kept losing the appointment ID between steps. This is a backend issue, not something the AI could have handled differently.',
    },
  },
  {
    sessionId: 'session-1770780785887-996bk4',
    channel: 'voice-webrtc',
    reason: 'quality_issue',
    reasonDetail: 'Agent produced garbled control characters in response. User complained about non-fluid interaction.',
    priority: 'normal',
    transcript: [
      { role: 'user', content: 'Hi, my name is David and I want to reschedule my appointment.', ts: 1770780809376 },
      { role: 'agent', content: '<ctrl46><ctrl46><ctrl46><ctrl46>', ts: 1770780885013 },
      { role: 'user', content: 'Did you change it?', ts: 1770780954325 },
      { role: 'user', content: 'Actually it did work. But was not very fluid.', ts: 1770781005719 },
    ],
    aiSummary: 'Agent produced garbled output during rescheduling. Appointment was eventually rescheduled but experience was poor.',
    resolve: {
      resolutionQuality: 'good',
      necessityScore: 0.5,
      agentFeedback: 'The rescheduling did eventually work. The garbled text was a model output issue. Handoff was borderline — user resolved their own issue.',
    },
  },
  {
    sessionId: 'session-1771000878819-9dpv0x',
    channel: 'voice-webrtc',
    reason: 'no_response',
    reasonDetail: 'Agent completely failed to respond to user. User waited 2m 48s with no engagement.',
    priority: 'high',
    transcript: [
      { role: 'user', content: 'Hi.', ts: 1771000891815 },
      { role: 'user', content: 'Anyone there?', ts: 1771000901240 },
    ],
    aiSummary: 'Complete agent failure. User received no response for nearly 3 minutes before disconnecting.',
    resolve: {
      resolutionQuality: 'poor',
      necessityScore: 1,
      agentFeedback: 'Total system failure — agent process may have crashed or TTS pipeline stalled. Need to investigate server logs for this session.',
    },
  },
  {
    sessionId: 'session-1770780325995-a17zhv',
    channel: 'voice-webrtc',
    reason: 'language_barrier',
    reasonDetail: 'User spoke Japanese but agent only supports English. No language detection or handoff triggered.',
    priority: 'normal',
    transcript: [
      { role: 'user', content: '何 に し て', ts: 1770780340000 },
      { role: 'agent', content: 'Hello! How can I help you?', ts: 1770780345000 },
    ],
    aiSummary: 'User attempted to communicate in Japanese. Agent responded in English without acknowledging the language mismatch.',
    resolve: {
      resolutionQuality: 'good',
      necessityScore: 0.75,
      agentFeedback: 'Need language detection in the pipeline. Agent should detect non-English input and either switch languages or offer human handoff. Feature request filed.',
    },
  },
  {
    sessionId: 'session-1770695491178-p97abi',
    channel: 'voice-webrtc',
    reason: 'complex_inquiry',
    reasonDetail: 'E-commerce customer with multi-item order status check requiring cross-referencing multiple systems.',
    priority: 'normal',
    transcript: [
      { role: 'user', content: 'Yeah, hi. Can you um tell me the status of CB 2025 1234.', ts: 1770695491178 },
      { role: 'agent', content: 'Let me look up your order.', ts: 1770695500000 },
    ],
    aiSummary: 'Customer inquired about order status. Agent needed to look up order and provide tracking details.',
    // This one stays pending (not resolved) for the dashboard
  },
  {
    sessionId: 'session-1770641074134-p0qk08',
    channel: 'voice-webrtc',
    reason: 'user_confusion',
    reasonDetail: 'User appeared confused about the service. Said "I want to develop" suggesting they thought this was a development tool.',
    priority: 'low',
    transcript: [
      { role: 'user', content: 'I want to develop', ts: 1770641080000 },
      { role: 'agent', content: 'I\'m here to help with your order or product questions. What can I assist you with?', ts: 1770641085000 },
    ],
    aiSummary: 'User confused about service scope. Session lasted 126 minutes abnormally. Likely left connection open by accident.',
    resolve: {
      resolutionQuality: 'excellent',
      necessityScore: 0.25,
      agentFeedback: 'Handoff was unnecessary — user simply misunderstood the interface. Session duration was from an idle connection, not actual conversation. Could be avoided with idle timeout.',
    },
  },
];

// ─── 3. Guardrail Violations ──────────────────────────────────────
// Check existing guardrails and create violations
const guardrailChecks = [
  // Medical advice attempts
  {
    sessionId: 'session-1770781765926-xt9ev7',
    input: 'Can you tell me if I need antibiotics before my crown fitting?',
    direction: 'input',
    expectedAction: 'block',
    expectedType: 'topic',
    annotation: 'true_positive',
  },
  {
    sessionId: 'session-1770994578603-ur0kkw',
    input: 'Is it safe to take ibuprofen before my Invisalign consultation?',
    direction: 'input',
    expectedAction: 'block',
    expectedType: 'topic',
    annotation: 'true_positive',
  },
  // Competitor mentions
  {
    sessionId: 'session-1770780785887-996bk4',
    input: 'Can I switch to another dentist office nearby?',
    direction: 'input',
    expectedAction: 'block',
    expectedType: 'topic',
    annotation: 'false_positive',  // "another dentist" triggered but user was just asking about their options
  },
  // Forward-looking statements (earnings)
  {
    sessionId: 'session-1770534054230-54rfep',
    input: 'Well how are the outlook for 2026?',
    direction: 'input',
    expectedAction: 'log',
    expectedType: 'topic',
    annotation: 'true_positive',
  },
  {
    sessionId: 'session-1770515098766-9fuyyf',
    input: 'Do you expect revenue to grow next year?',
    direction: 'input',
    expectedAction: 'log',
    expectedType: 'topic',
    annotation: 'true_positive',
  },
  // Investment advice
  {
    sessionId: 'session-1770515098766-9fuyyf',
    input: 'Should I buy more shares based on these earnings?',
    direction: 'input',
    expectedAction: 'block',
    expectedType: 'topic',
    annotation: 'true_positive',
  },
  // E-commerce guardrails
  {
    sessionId: 'session-1770553213358-nz9kos',
    input: 'I want to return this. Can I get a refund of $350?',
    direction: 'input',
    expectedAction: 'warn',
    expectedType: 'financial',
    annotation: 'true_positive',
  },
  {
    sessionId: 'session-1770695491178-p97abi',
    input: 'What are your wholesale prices for bulk orders?',
    direction: 'input',
    expectedAction: 'block',
    expectedType: 'topic',
    annotation: 'true_positive',
  },
  // False positives
  {
    sessionId: 'session-1770699317785-hgr3g6',
    input: 'Hey, would you help me update the appointment for David',
    direction: 'input',
    expectedAction: 'block',
    expectedType: 'topic',
    annotation: 'false_positive',  // "another" was in context but not competitor mention
  },
  {
    sessionId: 'session-1770781765926-xt9ev7',
    input: 'Is the medication I\'m taking going to affect the procedure?',
    direction: 'input',
    expectedAction: 'block',
    expectedType: 'topic',
    annotation: 'true_positive',
  },
  // Output-side violations
  {
    sessionId: 'session-1770994578603-ur0kkw',
    input: 'The system projects you\'ll need a follow-up in 6 months based on your dental history forecast.',
    direction: 'output',
    expectedAction: 'log',
    expectedType: 'topic',
    annotation: 'false_positive',  // "forecast" triggered but agent was talking about dental, not financial
  },
  {
    sessionId: 'session-1770553213358-nz9kos',
    input: 'I can process your refund of $275 right away.',
    direction: 'output',
    expectedAction: 'warn',
    expectedType: 'financial',
    annotation: 'true_positive',
  },
];

// ─── Main execution ──────────────────────────────────────────────

async function main() {
  console.log('🚀 Seeding evals & guardrails data...\n');

  // Step 1: Create annotations
  console.log('📝 Creating annotations...');
  let annotationCount = 0;
  for (const a of annotations) {
    if (a.skip) continue;
    try {
      await post('/api/annotations', {
        sessionId: a.sessionId,
        qualityRating: a.qualityRating,
        failureModes: a.failureModes,
        notes: a.notes,
      });
      const icon = a.qualityRating === 'good' ? '👍' : a.qualityRating === 'bad' ? '👎' : '↕️';
      console.log(`  ${icon} ${a.sessionId.slice(0, 30)}... → ${a.qualityRating}`);
      annotationCount++;
    } catch (e) {
      console.error(`  ❌ ${a.sessionId}: ${e.message}`);
    }
  }
  console.log(`  ✅ ${annotationCount} annotations created\n`);

  // Step 2: Create handoffs
  console.log('🤝 Creating handoffs...');
  let handoffCount = 0;
  for (const h of handoffs) {
    try {
      const result = await post('/api/handoffs', {
        sessionId: h.sessionId,
        channel: h.channel,
        reason: h.reason,
        reasonDetail: h.reasonDetail,
        priority: h.priority,
        transcript: h.transcript,
        aiSummary: h.aiSummary,
        customerData: h.customerData,
      });
      console.log(`  📋 ${h.sessionId.slice(0, 30)}... → ${h.reason} (${h.priority})`);
      handoffCount++;

      // Claim and resolve if specified
      if (h.resolve) {
        // First claim
        await patch('/api/handoffs', {
          handoffId: result.id,
          status: 'claimed',
          assignedAgent: 'dashboard-reviewer',
        });
        // Then resolve with feedback
        await patch('/api/handoffs', {
          handoffId: result.id,
          status: 'resolved',
          resolutionQuality: h.resolve.resolutionQuality,
          necessityScore: h.resolve.necessityScore,
          agentFeedback: h.resolve.agentFeedback,
        });
        console.log(`    ↳ Resolved: ${h.resolve.resolutionQuality} (necessity: ${h.resolve.necessityScore})`);
      }
    } catch (e) {
      console.error(`  ❌ ${h.sessionId}: ${e.message}`);
    }
  }
  console.log(`  ✅ ${handoffCount} handoffs created\n`);

  // Step 3: Create guardrail violations via /api/guardrails/check
  console.log('🛡️ Creating guardrail violations...');
  let violationCount = 0;
  let annotatedCount = 0;

  for (const check of guardrailChecks) {
    try {
      const result = await post('/api/guardrails/check', {
        sessionId: check.sessionId,
        content: check.input,
        direction: check.direction,
      });

      if (result.violated) {
        console.log(`  🚫 ${check.direction}: "${check.input.slice(0, 50)}..." → ${result.action}`);
        violationCount++;

        // Annotate the violation if we have the ID
        if (result.violationId && check.annotation) {
          try {
            await patch('/api/guardrails/violations', {
              violationId: result.violationId,
              annotatedCorrectness: check.annotation,
            });
            const label = check.annotation === 'true_positive' ? 'TP ✓' : 'FP ✗';
            console.log(`    ↳ Annotated: ${label}`);
            annotatedCount++;
          } catch (e) {
            console.log(`    ↳ Annotation skipped: ${e.message}`);
          }
        }
      } else {
        console.log(`  ✅ ${check.direction}: "${check.input.slice(0, 50)}..." → passed`);
      }
    } catch (e) {
      console.error(`  ❌ Check failed: ${e.message}`);
    }
  }
  console.log(`  ✅ ${violationCount} violations created, ${annotatedCount} annotated\n`);

  // Step 4: Summary
  console.log('─'.repeat(50));
  console.log('📊 Summary:');
  console.log(`  • ${annotationCount} conversation annotations`);
  console.log(`  • ${handoffCount} handoffs (with quality feedback)`);
  console.log(`  • ${violationCount} guardrail violations (${annotatedCount} annotated)`);
  console.log('\n✨ Done! Check the dashboard at https://dashboard-production-ad02.up.railway.app');
}

main().catch(console.error);
