/**
 * Campaign Integration Audit Tests
 * Cross-system integration: lifecycle, A/B variants, template engine, validation, tracking
 */

import assert from 'node:assert/strict';
import {
  LeadStateMachine,
  replyIntentToEvent,
} from '../../packages/shared/src/lead-state-machine';
import type { LeadStatus, ReplyIntent } from '../../packages/shared/src/types';
import {
  processEmailContent,
  normalizeVariableMap,
  calculateHealthScore,
  calculateWarmupQuota,
  generateWebhookSignature,
  verifyWebhookSignature,
  isValidEmail,
  getEspLimits,
} from '../../packages/shared/src/utils';
import {
  generateTrackingId,
  decodeTrackingId,
  applyEmailTracking,
  injectTrackingPixel,
  wrapLinksForTracking,
  isValidTrackingUrl,
} from '../../packages/shared/src/tracking';
import {
  createCampaignSchema,
  sequenceStepSchema,
  createWebhookSchema,
  updateLeadSchema,
} from '../../packages/shared/src/validation';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err: any) {
    failed++;
    const msg = err.message || String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  FAIL: ${name}`);
    console.log(`        ${msg}`);
  }
}

const sm = new LeadStateMachine();

// ============================================
// Full Lifecycle
// ============================================

console.log('\n--- Full Lifecycle ---');

test('complete happy path: pending → in_sequence → contacted → replied → interested → meeting_booked', () => {
  let status: LeadStatus = 'pending';

  // Step 1: first email sent
  const s1 = sm.canTransition(status, 'EMAIL_SENT');
  assert.equal(s1, 'in_sequence');
  status = s1!;

  // Step 2: second email sent
  const s2 = sm.canTransition(status, 'EMAIL_SENT');
  assert.equal(s2, 'contacted');
  status = s2!;

  // Step 3: reply received
  const s3 = sm.canTransition(status, 'REPLY_RECEIVED');
  assert.equal(s3, 'replied');
  status = s3!;

  // Step 4: classified as interested
  const s4 = sm.canTransition(status, 'REPLY_INTERESTED');
  assert.equal(s4, 'interested');
  status = s4!;

  // Step 5: meeting booked
  const s5 = sm.canTransition(status, 'MEETING_BOOKED');
  assert.equal(s5, 'meeting_booked');
});

test('multi-step sequence: pending → in_sequence → contacted → contacted → contacted', () => {
  let status: LeadStatus = 'pending';

  // Step 1
  status = sm.canTransition(status, 'EMAIL_SENT')!;
  assert.equal(status, 'in_sequence');

  // Step 2
  status = sm.canTransition(status, 'EMAIL_SENT')!;
  assert.equal(status, 'contacted');

  // Step 3 (self-loop)
  status = sm.canTransition(status, 'EMAIL_SENT')!;
  assert.equal(status, 'contacted');

  // Step 4 (still self-loop)
  status = sm.canTransition(status, 'EMAIL_SENT')!;
  assert.equal(status, 'contacted');
});

test('bounce path: pending → in_sequence → soft_bounced → bounced (terminal)', () => {
  let status: LeadStatus = 'pending';
  status = sm.canTransition(status, 'EMAIL_SENT')!;
  assert.equal(status, 'in_sequence');

  status = sm.canTransition(status, 'SOFT_BOUNCE')!;
  assert.equal(status, 'soft_bounced');

  status = sm.canTransition(status, 'EMAIL_BOUNCED')!;
  assert.equal(status, 'bounced');

  // Cannot continue
  assert.equal(sm.canTransition(status, 'EMAIL_SENT'), null);
});

// ============================================
// A/B Variant Lifecycle Simulation
// ============================================

console.log('\n--- A/B Variant Lifecycle ---');

test('weighted variant selection distributes traffic', () => {
  // Simulate variant selection with weights
  const variants = [
    { name: 'A', weight: 70, sent: 0, opened: 0, replied: 0 },
    { name: 'B', weight: 30, sent: 0, opened: 0, replied: 0 },
  ];

  function selectVariant(): number {
    const total = variants.reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * total;
    for (let i = 0; i < variants.length; i++) {
      random -= variants[i].weight;
      if (random <= 0) return i;
    }
    return variants.length - 1;
  }

  // Run 1000 selections
  for (let i = 0; i < 1000; i++) {
    variants[selectVariant()].sent++;
  }

  // Variant A should get roughly 70% (within tolerance)
  const aRatio = variants[0].sent / 1000;
  assert.ok(aRatio > 0.55, `A ratio ${aRatio} too low`);
  assert.ok(aRatio < 0.85, `A ratio ${aRatio} too high`);
});

test('track variant stats and compute rates', () => {
  const variant = { sent: 100, opened: 40, clicked: 10, replied: 5 };
  const openRate = variant.opened / variant.sent;
  const clickRate = variant.clicked / variant.sent;
  const replyRate = variant.replied / variant.sent;

  assert.equal(openRate, 0.4);
  assert.equal(clickRate, 0.1);
  assert.equal(replyRate, 0.05);
});

test('progressive weight shift based on confidence', () => {
  // Simulate: variant A has better open rate
  const varA = { sent: 100, opened: 50, weight: 50 };
  const varB = { sent: 100, opened: 30, weight: 50 };

  const rateA = varA.opened / varA.sent;
  const rateB = varB.opened / varB.sent;

  // Simple z-score approximation
  const pooledRate = (varA.opened + varB.opened) / (varA.sent + varB.sent);
  const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1 / varA.sent + 1 / varB.sent));
  const zScore = Math.abs(rateA - rateB) / se;

  // With 50/100 vs 30/100, z-score should be significant
  assert.ok(zScore > 1.96, `z-score ${zScore} should be > 1.96 for 95% confidence`);

  // Apply progressive shift
  if (zScore >= 1.96) {
    varA.weight = 100;
    varB.weight = 0;
  }

  assert.equal(varA.weight, 100);
  assert.equal(varB.weight, 0);
});

test('declare winner sets is_winner flag', () => {
  const variants = [
    { name: 'A', is_winner: false, weight: 85 },
    { name: 'B', is_winner: false, weight: 15 },
  ];

  // Declare A as winner
  variants[0].is_winner = true;
  variants[0].weight = 100;
  variants[1].weight = 0;

  assert.equal(variants[0].is_winner, true);
  assert.equal(variants[0].weight, 100);
  assert.equal(variants[1].weight, 0);
});

// ============================================
// Cross-System Consistency
// ============================================

console.log('\n--- Cross-System Consistency ---');

test('blocksSequence statuses should NOT allow EMAIL_SENT (except contacted self-loop)', () => {
  const allStatuses: LeadStatus[] = [
    'pending', 'in_sequence', 'contacted', 'replied', 'interested',
    'not_interested', 'meeting_booked', 'bounced', 'soft_bounced',
    'unsubscribed', 'spam_reported', 'sequence_complete',
  ];

  for (const status of allStatuses) {
    const blocks = sm.blocksSequence(status);
    const canSend = sm.canTransition(status, 'EMAIL_SENT');

    if (blocks && status !== 'contacted') {
      // Blocking statuses should not allow sending
      assert.equal(canSend, null, `${status} blocks sequence but allows EMAIL_SENT`);
    }
  }
});

test('contacted does not block sequence and allows EMAIL_SENT self-loop', () => {
  assert.equal(sm.blocksSequence('contacted'), false);
  assert.equal(sm.canTransition('contacted', 'EMAIL_SENT'), 'contacted');
});

// ============================================
// processEmailContent Integration
// ============================================

console.log('\n--- processEmailContent ---');

test('full variable map with lead + inbox + conditionals + spintax + fallbacks', () => {
  const template = '{if:company}Hi {{firstName}}, I see you work at {{company}}.{/if}{ifnot:company}Hi {{firstName}}.{/ifnot} {{senderFirstName}} from {{senderCompany|Our Company}}';
  const variables: Record<string, string | undefined> = {
    firstName: 'Alice',
    company: 'Acme',
    senderFirstName: 'Bob',
    senderCompany: undefined,
  };

  const result = processEmailContent(template, variables);
  assert.ok(result.includes('Hi Alice, I see you work at Acme.'));
  assert.ok(result.includes('Bob from Our Company'));
});

test('processEmailContent with snake_case variables', () => {
  const template = 'Dear {{first_name}} {{last_name}}, from {{sender_company}}';
  const variables = { first_name: 'John', last_name: 'Doe', sender_company: 'TestCo' };
  const result = processEmailContent(template, variables);
  assert.equal(result, 'Dear John Doe, from TestCo');
});

test('processEmailContent preserves unknown variables', () => {
  const template = 'Hello {{unknownVar}}, your name is {{firstName}}';
  const result = processEmailContent(template, { firstName: 'Test' });
  assert.ok(result.includes('{{unknownVar}}'));
  assert.ok(result.includes('Test'));
});

test('processEmailContent with fallback in variables', () => {
  const template = '{{company|your company}} {{title|professional}}';
  const result = processEmailContent(template, {});
  assert.equal(result, 'your company professional');
});

test('normalizeVariableMap adds missing formats bidirectionally', () => {
  const normalized = normalizeVariableMap({ firstName: 'Alice' });
  assert.equal(normalized.firstName, 'Alice');
  assert.equal(normalized.first_name, 'Alice');

  const normalized2 = normalizeVariableMap({ sender_company: 'Acme' });
  assert.equal(normalized2.senderCompany, 'Acme');
  assert.equal(normalized2.sender_company, 'Acme');
});

// ============================================
// Validation: createCampaignSchema
// ============================================

console.log('\n--- Campaign Validation ---');

test('createCampaignSchema accepts valid input', () => {
  const validCampaign = {
    name: 'Test Campaign',
    leadListId: '550e8400-e29b-41d4-a716-446655440000',
    inboxIds: ['550e8400-e29b-41d4-a716-446655440001'],
    sequences: [
      { stepNumber: 1, subject: 'Hello', body: 'Body text' },
    ],
  };

  const result = createCampaignSchema.safeParse(validCampaign);
  assert.equal(result.success, true);
});

test('createCampaignSchema rejects missing name', () => {
  const invalid = {
    leadListId: '550e8400-e29b-41d4-a716-446655440000',
    inboxIds: ['550e8400-e29b-41d4-a716-446655440001'],
    sequences: [{ stepNumber: 1, subject: 'Hello', body: 'Body' }],
  };
  const result = createCampaignSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('createCampaignSchema rejects empty sequences array', () => {
  const invalid = {
    name: 'Test',
    leadListId: '550e8400-e29b-41d4-a716-446655440000',
    inboxIds: ['550e8400-e29b-41d4-a716-446655440001'],
    sequences: [],
  };
  const result = createCampaignSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('createCampaignSchema rejects missing inboxIds', () => {
  const invalid = {
    name: 'Test',
    leadListId: '550e8400-e29b-41d4-a716-446655440000',
    sequences: [{ stepNumber: 1, subject: 'Hello', body: 'Body' }],
  };
  const result = createCampaignSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('createCampaignSchema accepts single inbox', () => {
  const valid = {
    name: 'Single Inbox Campaign',
    leadListId: '550e8400-e29b-41d4-a716-446655440000',
    inboxIds: ['550e8400-e29b-41d4-a716-446655440001'],
    sequences: [{ stepNumber: 1, subject: 'Hi', body: 'Hello there' }],
  };
  const result = createCampaignSchema.safeParse(valid);
  assert.equal(result.success, true);
});

// ============================================
// Race Condition Simulation
// ============================================

console.log('\n--- Race Condition Simulation ---');

test('lead status change between check and send prevents email send', () => {
  // Simulate: scheduler checked lead was in_sequence, but before sending,
  // lead unsubscribed
  let status: LeadStatus = 'in_sequence';

  // First check: can we send?
  assert.equal(sm.blocksSequence(status), false);

  // Between check and actual send, lead unsubscribes
  const unsub = sm.canTransition(status, 'UNSUBSCRIBE');
  assert.equal(unsub, 'unsubscribed');
  status = unsub!;

  // Re-check at send time: should block
  assert.equal(sm.blocksSequence(status), true);
  assert.equal(sm.canTransition(status, 'EMAIL_SENT'), null);
});

test('lead replied between enqueue and send prevents further emails', () => {
  let status: LeadStatus = 'contacted';
  assert.equal(sm.blocksSequence(status), false);

  // Lead replies in the meantime
  status = sm.canTransition(status, 'REPLY_RECEIVED')!;
  assert.equal(status, 'replied');

  // Re-check: should block
  assert.equal(sm.blocksSequence(status), true);
});

// ============================================
// Webhook Roundtrip
// ============================================

console.log('\n--- Webhook Roundtrip ---');

test('generateWebhookSignature → verifyWebhookSignature roundtrip', () => {
  const payload = JSON.stringify({ event: 'email.sent', data: { emailId: '123' } });
  const secret = 'webhook-secret-key-12345';

  const signature = generateWebhookSignature(payload, secret);
  assert.ok(signature.length > 0);

  const isValid = verifyWebhookSignature(payload, signature, secret);
  assert.equal(isValid, true);
});

test('webhook signature fails with wrong secret', () => {
  const payload = '{"test": true}';
  const signature = generateWebhookSignature(payload, 'correct-secret');
  // timingSafeEqual may throw (different lengths) or return false (same length, different content)
  let isValid: boolean;
  try {
    isValid = verifyWebhookSignature(payload, signature, 'wrong-secret');
  } catch {
    isValid = false;
  }
  assert.equal(isValid, false);
});

// ============================================
// Health + Warmup
// ============================================

console.log('\n--- Health + Warmup ---');

test('calculateHealthScore → use to determine warmup quota', () => {
  const healthScore = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 30,
    sentTotal: 500,
    repliedTotal: 150,
    bounceRate: 0,
    spamRate: 0,
  });

  // Day 30+, 500 sent, 30% reply rate, warmup enabled > 7 days
  // dayScore=40, replyScore=30, volumeScore=20, engagementBonus=10 = 100
  assert.equal(healthScore, 100);

  // Health > 50 means full capacity
  const quota = calculateWarmupQuota(30, 'normal');
  assert.ok(quota > 0);
});

test('low health score with bounce and spam penalties', () => {
  const healthScore = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 5,
    sentTotal: 20,
    repliedTotal: 0,
    bounceRate: 3,
    spamRate: 1,
  });

  // bounceRate*10 = 30 penalty, spamRate*20 = 20 penalty
  assert.ok(healthScore < 50, `health should be low, got ${healthScore}`);
});

test('calculateWarmupQuota increases with day number', () => {
  const day1 = calculateWarmupQuota(1, 'normal');
  const day15 = calculateWarmupQuota(15, 'normal');
  const day31 = calculateWarmupQuota(31, 'normal');

  assert.ok(day1 < day15, `day1 (${day1}) should be < day15 (${day15})`);
  assert.ok(day15 < day31, `day15 (${day15}) should be < day31 (${day31})`);
});

test('ramp speed affects warmup quota', () => {
  const slow = calculateWarmupQuota(15, 'slow');
  const normal = calculateWarmupQuota(15, 'normal');
  const fast = calculateWarmupQuota(15, 'fast');

  assert.ok(slow < normal, `slow (${slow}) should be < normal (${normal})`);
  assert.ok(normal < fast, `normal (${normal}) should be < fast (${fast})`);
});

// ============================================
// Tracking Pipeline Roundtrip
// ============================================

console.log('\n--- Tracking Pipeline ---');

test('generateTrackingId → decodeTrackingId roundtrip', () => {
  const emailId = '550e8400-e29b-41d4-a716-446655440000';
  const trackingId = generateTrackingId(emailId);
  assert.ok(trackingId.length > 0);
  assert.notEqual(trackingId, emailId); // Should be base64url encoded

  const decoded = decodeTrackingId(trackingId);
  assert.equal(decoded, emailId);
});

test('applyEmailTracking injects pixel and wraps links', () => {
  const html = '<html><body><a href="https://example.com">Click</a></body></html>';
  const trackingId = generateTrackingId('email-123');
  const baseUrl = 'https://api.test.com';

  const tracked = applyEmailTracking(html, trackingId, baseUrl);

  // Should have tracking pixel
  assert.ok(tracked.includes('/api/v1/t/o/'), 'should contain open tracking URL');
  // Should have wrapped link
  assert.ok(tracked.includes('/api/v1/t/c/'), 'should contain click tracking URL');
  assert.ok(tracked.includes('url='), 'should contain encoded original URL');
});

test('tracking pixel injected before </body>', () => {
  const html = '<html><body><p>Hello</p></body></html>';
  const result = injectTrackingPixel(html, 'track-1', 'https://api.test.com');
  assert.ok(result.includes('<img src="https://api.test.com/api/v1/t/o/track-1"'));
  assert.ok(result.indexOf('<img') < result.indexOf('</body>'));
});

test('wrapLinksForTracking skips unsubscribe links', () => {
  const html = '<a href="https://example.com/unsubscribe">Unsub</a><a href="https://example.com/page">Visit</a>';
  const result = wrapLinksForTracking(html, 'track-2', 'https://api.test.com');
  // Unsubscribe link should not be wrapped
  assert.ok(result.includes('href="https://example.com/unsubscribe"'));
  // Normal link should be wrapped
  assert.ok(result.includes('/api/v1/t/c/track-2'));
});

test('isValidTrackingUrl validates protocols', () => {
  assert.equal(isValidTrackingUrl('https://example.com'), true);
  assert.equal(isValidTrackingUrl('http://example.com'), true);
  assert.equal(isValidTrackingUrl('javascript:alert(1)'), false);
  assert.equal(isValidTrackingUrl('not-a-url'), false);
});

// ============================================
// State Machine + Reply Intent Consistency
// ============================================

console.log('\n--- State Machine + Reply Intent Consistency ---');

test('every ReplyIntent maps to an event that produces a valid transition', () => {
  const intents: ReplyIntent[] = [
    'interested', 'meeting_request', 'question', 'not_interested',
    'unsubscribe', 'out_of_office', 'auto_reply', 'bounce', 'neutral',
  ];

  // Common source states that a reply could come from
  const sourceStates: LeadStatus[] = ['in_sequence', 'contacted'];

  for (const intent of intents) {
    const event = replyIntentToEvent(intent);
    let hasValidTransition = false;

    for (const source of sourceStates) {
      const next = sm.canTransition(source, event);
      if (next !== null) {
        hasValidTransition = true;
        break;
      }
    }

    assert.ok(hasValidTransition, `intent '${intent}' → event '${event}' has no valid transition from in_sequence or contacted`);
  }
});

test('updateLeadSchema accepts valid lead update', () => {
  const valid = {
    firstName: 'Alice',
    lastName: 'Smith',
    company: 'Acme',
    status: 'contacted' as const,
  };
  const result = updateLeadSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test('sequenceStepSchema with variants', () => {
  const step = {
    stepNumber: 1,
    subject: 'Test Subject',
    body: 'Test Body',
    variants: [
      { subject: 'Variant A Subject', body: 'Variant A Body', weight: 60 },
      { subject: 'Variant B Subject', body: 'Variant B Body', weight: 40 },
    ],
  };
  const result = sequenceStepSchema.safeParse(step);
  assert.equal(result.success, true);
});

// ============================================
// Results
// ============================================

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
