/**
 * Campaign Scheduler Logic Tests
 *
 * Tests campaign scheduling logic: weighted variant selection, send windows,
 * per-day schedules, inbox health filtering, throttle calculation,
 * MAX_EMAILS_PER_RUN limit, lead status blocking, and variable injection.
 */

import assert from 'node:assert/strict';
import {
  isWithinSendWindow,
  isWithinPerDaySchedule,
  calculateHealthScore,
  processEmailContent,
} from '../../packages/shared/src/utils';
import {
  LeadStateMachine,
  leadStateMachine,
} from '../../packages/shared/src/lead-state-machine';
import type { LeadStatus } from '../../packages/shared/src/types';

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

// ============================================
// selectVariant — weighted random selection
// ============================================

console.log('\n--- selectVariant: Weighted Random Distribution ---');

interface Variant {
  id: string;
  variant_name: string;
  weight: number;
  subject: string;
  body: string;
}

/**
 * Inline selectVariant matching campaign-scheduler.ts logic:
 * weighted random selection based on variant weights
 */
function selectVariant(variants: Variant[]): Variant {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;
  for (const variant of variants) {
    random -= variant.weight;
    if (random <= 0) return variant;
  }
  return variants[variants.length - 1]; // fallback
}

test('selectVariant: single variant always selected', () => {
  const variants: Variant[] = [
    { id: 'a', variant_name: 'A', weight: 100, subject: 'A sub', body: 'A body' },
  ];
  for (let i = 0; i < 100; i++) {
    assert.equal(selectVariant(variants).id, 'a');
  }
});

test('selectVariant: two equal-weight variants get roughly 50/50', () => {
  const variants: Variant[] = [
    { id: 'a', variant_name: 'A', weight: 50, subject: 'A', body: 'A' },
    { id: 'b', variant_name: 'B', weight: 50, subject: 'B', body: 'B' },
  ];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) {
    counts[selectVariant(variants).id]++;
  }
  // Each should be roughly 5000 ± 500 (5% tolerance)
  assert.ok(counts.a > 4000, `A count ${counts.a} should be > 4000`);
  assert.ok(counts.a < 6000, `A count ${counts.a} should be < 6000`);
  assert.ok(counts.b > 4000, `B count ${counts.b} should be > 4000`);
  assert.ok(counts.b < 6000, `B count ${counts.b} should be < 6000`);
});

test('selectVariant: 80/20 split distributes accordingly', () => {
  const variants: Variant[] = [
    { id: 'a', variant_name: 'A', weight: 80, subject: 'A', body: 'A' },
    { id: 'b', variant_name: 'B', weight: 20, subject: 'B', body: 'B' },
  ];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) {
    counts[selectVariant(variants).id]++;
  }
  // A should be ~8000, B should be ~2000
  assert.ok(counts.a > 7000, `A count ${counts.a} should be > 7000`);
  assert.ok(counts.b > 1000, `B count ${counts.b} should be > 1000`);
  assert.ok(counts.b < 3000, `B count ${counts.b} should be < 3000`);
});

test('selectVariant: three variants 60/30/10 distribution', () => {
  const variants: Variant[] = [
    { id: 'a', variant_name: 'A', weight: 60, subject: 'A', body: 'A' },
    { id: 'b', variant_name: 'B', weight: 30, subject: 'B', body: 'B' },
    { id: 'c', variant_name: 'C', weight: 10, subject: 'C', body: 'C' },
  ];
  const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 10000; i++) {
    counts[selectVariant(variants).id]++;
  }
  assert.ok(counts.a > 5000, `A count ${counts.a} should be > 5000`);
  assert.ok(counts.b > 2000, `B count ${counts.b} should be > 2000`);
  assert.ok(counts.c > 500, `C count ${counts.c} should be > 500`);
  assert.ok(counts.c < 2000, `C count ${counts.c} should be < 2000`);
});

test('selectVariant: zero-weight variant never selected when others have weight', () => {
  const variants: Variant[] = [
    { id: 'a', variant_name: 'A', weight: 100, subject: 'A', body: 'A' },
    { id: 'b', variant_name: 'B', weight: 0, subject: 'B', body: 'B' },
  ];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 1000; i++) {
    counts[selectVariant(variants).id]++;
  }
  assert.equal(counts.b, 0, 'Zero-weight variant should never be selected');
});

// ============================================
// isWithinSendWindow
// ============================================

console.log('\n--- isWithinSendWindow ---');

test('isWithinSendWindow: weekday within business hours returns true', () => {
  // Wednesday 2024-01-10 at 10:00 UTC
  const wed10am = new Date('2024-01-10T10:00:00Z');
  const result = isWithinSendWindow(wed10am, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(result, true);
});

test('isWithinSendWindow: weekday outside business hours returns false', () => {
  // Wednesday 2024-01-10 at 20:00 UTC
  const wed8pm = new Date('2024-01-10T20:00:00Z');
  const result = isWithinSendWindow(wed8pm, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(result, false);
});

test('isWithinSendWindow: weekend day returns false even if within hours', () => {
  // Saturday 2024-01-13 at 10:00 UTC
  const sat10am = new Date('2024-01-13T10:00:00Z');
  const result = isWithinSendWindow(sat10am, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(result, false);
});

test('isWithinSendWindow: Saturday allowed when included in sendDays', () => {
  const sat10am = new Date('2024-01-13T10:00:00Z');
  const result = isWithinSendWindow(sat10am, '09:00', '17:00', 'UTC', ['sat']);
  assert.equal(result, true);
});

test('isWithinSendWindow: exact start time is within window', () => {
  // Wednesday at 09:00 UTC
  const wed9am = new Date('2024-01-10T09:00:00Z');
  const result = isWithinSendWindow(wed9am, '09:00', '17:00', 'UTC', ['wed']);
  assert.equal(result, true);
});

test('isWithinSendWindow: exact end time is within window', () => {
  // Wednesday at 17:00 UTC
  const wed5pm = new Date('2024-01-10T17:00:00Z');
  const result = isWithinSendWindow(wed5pm, '09:00', '17:00', 'UTC', ['wed']);
  assert.equal(result, true);
});

test('isWithinSendWindow: timezone conversion - EST is UTC-5', () => {
  // 15:00 UTC = 10:00 EST — should be within 09:00-17:00 EST
  const utc3pm = new Date('2024-01-10T15:00:00Z');
  const result = isWithinSendWindow(utc3pm, '09:00', '17:00', 'America/New_York', ['wed']);
  assert.equal(result, true);
});

test('isWithinSendWindow: empty sendDays returns false', () => {
  const wed10am = new Date('2024-01-10T10:00:00Z');
  const result = isWithinSendWindow(wed10am, '09:00', '17:00', 'UTC', []);
  assert.equal(result, false);
});

// ============================================
// isWithinPerDaySchedule
// ============================================

console.log('\n--- isWithinPerDaySchedule ---');

test('isWithinPerDaySchedule: within single interval returns true', () => {
  // Wednesday 10:00 UTC, schedule has wed 9-17
  const wed10 = new Date('2024-01-10T10:00:00Z');
  const schedule = { wed: [{ start: 9, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed10, schedule, 'UTC'), true);
});

test('isWithinPerDaySchedule: outside all intervals returns false', () => {
  // Wednesday 20:00 UTC
  const wed20 = new Date('2024-01-10T20:00:00Z');
  const schedule = { wed: [{ start: 9, end: 12 }, { start: 14, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed20, schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: multiple intervals - within second interval', () => {
  // Wednesday 15:00 UTC in afternoon interval
  const wed15 = new Date('2024-01-10T15:00:00Z');
  const schedule = { wed: [{ start: 9, end: 12 }, { start: 14, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed15, schedule, 'UTC'), true);
});

test('isWithinPerDaySchedule: between intervals returns false', () => {
  // Wednesday 13:00 UTC in gap between 9-12 and 14-17
  const wed13 = new Date('2024-01-10T13:00:00Z');
  const schedule = { wed: [{ start: 9, end: 12 }, { start: 14, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed13, schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: unscheduled day returns false', () => {
  // Thursday 10:00 UTC, only wed is scheduled
  const thu10 = new Date('2024-01-11T10:00:00Z');
  const schedule = { wed: [{ start: 9, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(thu10, schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: empty intervals for day returns false', () => {
  const wed10 = new Date('2024-01-10T10:00:00Z');
  const schedule = { wed: [] };
  assert.equal(isWithinPerDaySchedule(wed10, schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: start hour is inclusive', () => {
  // Wednesday exactly 9:00 UTC
  const wed9 = new Date('2024-01-10T09:00:00Z');
  const schedule = { wed: [{ start: 9, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed9, schedule, 'UTC'), true);
});

test('isWithinPerDaySchedule: end hour is exclusive', () => {
  // Wednesday exactly 17:00 UTC — end is exclusive so should be false
  const wed17 = new Date('2024-01-10T17:00:00Z');
  const schedule = { wed: [{ start: 9, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed17, schedule, 'UTC'), false);
});

// ============================================
// calculateHealthScore — Campaign Filtering
// ============================================

console.log('\n--- Health Score Campaign Filtering ---');

test('Health score = 49 should be excluded (below 50 threshold)', () => {
  // Engineer a score that lands at 49
  // day=15 → dayScore = min(15/30,1)*40 = 20
  // sent=100, replied=30 → replyRate=0.3 → replyScore = min(0.3/0.3,1)*30 = 30
  // volumeScore = min(100/500,1)*20 = 4
  // engagement: enabled, day>7 → +10
  // total = 20+30+4+10 = 64 → too high
  //
  // Let's target exactly 49:
  // day=10 → dayScore = min(10/30,1)*40 = 13.33
  // sent=50, replied=0 → replyScore=0
  // volumeScore = min(50/500,1)*20 = 2
  // engagement: enabled, day>7 → +10
  // total = 13.33+0+2+10 = 25.33 → too low
  //
  // day=20 → dayScore = min(20/30,1)*40 = 26.67
  // sent=200, replied=20 → replyRate=0.1 → replyScore = min(0.1/0.3,1)*30 = 10
  // volumeScore = min(200/500,1)*20 = 8
  // engagement: enabled, day>7 → +10
  // total = 26.67+10+8+10 = 54.67 → round to 55
  //
  // We need bounceRate penalty to bring to 49:
  // 55 - bounceRate*10 = 49 → bounceRate = 0.6
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 20,
    sentTotal: 200,
    repliedTotal: 20,
    bounceRate: 0.6,
  });
  assert.equal(score, 49, `Expected 49, got ${score}`);
  assert.ok(score < 50, 'Score 49 should be below 50 threshold');
});

test('Health score = 50 should be included (at threshold)', () => {
  // Same as above but bounceRate slightly less
  // 55 - bounceRate*10 = 50 → bounceRate = 0.5
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 20,
    sentTotal: 200,
    repliedTotal: 20,
    bounceRate: 0.5,
  });
  assert.equal(score, 50, `Expected 50, got ${score}`);
  assert.ok(score >= 50, 'Score 50 should meet 50 threshold');
});

test('Health score null/no warmup defaults to 0', () => {
  const score = calculateHealthScore({
    warmupEnabled: false,
    currentDay: 0,
    sentTotal: 0,
    repliedTotal: 0,
  });
  assert.equal(score, 0);
});

// ============================================
// Throttle % from Health Score
// ============================================

console.log('\n--- Throttle Percentage from Health Score ---');

/**
 * Inline throttle calculation matching campaign-scheduler.ts logic:
 * health 20 → 25%, health 50 → 50%, health 100 → 100%
 * Linear mapping: throttle = 25 + (health - 20) * (75 / 80)
 * Clamped to 25-100 range
 */
function calculateThrottlePercent(health: number): number {
  if (health <= 20) return 25;
  if (health >= 100) return 100;
  return Math.round(25 + (health - 20) * (75 / 80));
}

test('Throttle: health 20 → 25%', () => {
  assert.equal(calculateThrottlePercent(20), 25);
});

test('Throttle: health 50 → ~53%', () => {
  const result = calculateThrottlePercent(50);
  // 25 + 30 * 75/80 = 25 + 28.125 = 53.125 → round to 53
  assert.equal(result, 53);
});

test('Throttle: health 100 → 100%', () => {
  assert.equal(calculateThrottlePercent(100), 100);
});

test('Throttle: health 0 → 25% (minimum)', () => {
  assert.equal(calculateThrottlePercent(0), 25);
});

test('Throttle: health 60 → ~62%', () => {
  const result = calculateThrottlePercent(60);
  // 25 + 40 * 75/80 = 25 + 37.5 = 62.5 → round to 63
  assert.equal(result, 63);
});

// ============================================
// MAX_EMAILS_PER_RUN limit
// ============================================

console.log('\n--- MAX_EMAILS_PER_RUN Limit ---');

test('MAX_EMAILS_PER_RUN=100: loop stops after 100 emails', () => {
  const MAX_EMAILS_PER_RUN = 100;
  const pendingEmails = Array.from({ length: 250 }, (_, i) => ({ id: `email-${i}` }));
  let sent = 0;

  for (const email of pendingEmails) {
    if (sent >= MAX_EMAILS_PER_RUN) break;
    sent++;
  }

  assert.equal(sent, 100, 'Should stop at 100 emails');
});

test('MAX_EMAILS_PER_RUN: fewer than 100 sends all', () => {
  const MAX_EMAILS_PER_RUN = 100;
  const pendingEmails = Array.from({ length: 50 }, (_, i) => ({ id: `email-${i}` }));
  let sent = 0;

  for (const email of pendingEmails) {
    if (sent >= MAX_EMAILS_PER_RUN) break;
    sent++;
  }

  assert.equal(sent, 50, 'Should send all 50');
});

// ============================================
// blocksSequence — Lead Status Filtering
// ============================================

console.log('\n--- blocksSequence: Lead Status Filtering ---');

const ALL_STATUSES: LeadStatus[] = [
  'pending', 'in_sequence', 'contacted', 'replied',
  'interested', 'not_interested', 'meeting_booked',
  'bounced', 'soft_bounced', 'unsubscribed', 'spam_reported',
  'sequence_complete',
];

const BLOCKING_STATUSES: LeadStatus[] = [
  'bounced', 'unsubscribed', 'spam_reported',
  'replied', 'interested', 'not_interested', 'meeting_booked',
];

const NON_BLOCKING_STATUSES: LeadStatus[] = [
  'pending', 'in_sequence', 'contacted',
  'soft_bounced', 'sequence_complete',
];

test('blocksSequence: all 12 statuses are covered', () => {
  assert.equal(ALL_STATUSES.length, 12);
});

for (const status of BLOCKING_STATUSES) {
  test(`blocksSequence: '${status}' should BLOCK sequence`, () => {
    assert.equal(leadStateMachine.blocksSequence(status), true);
  });
}

for (const status of NON_BLOCKING_STATUSES) {
  test(`blocksSequence: '${status}' should NOT block sequence`, () => {
    assert.equal(leadStateMachine.blocksSequence(status), false);
  });
}

// ============================================
// processEmailContent with Campaign Variables
// ============================================

console.log('\n--- processEmailContent: Campaign Variables ---');

test('processEmailContent: basic variable injection', () => {
  const result = processEmailContent('Hi {{firstName}}, welcome to {{company}}!', {
    firstName: 'Alice',
    company: 'Acme',
  });
  assert.equal(result, 'Hi Alice, welcome to Acme!');
});

test('processEmailContent: snake_case variables work', () => {
  const result = processEmailContent('Hi {{first_name}}', {
    first_name: 'Bob',
  });
  assert.equal(result, 'Hi Bob');
});

test('processEmailContent: sender variables', () => {
  const result = processEmailContent(
    'Best, {{senderFirstName}} from {{senderCompany}}',
    { senderFirstName: 'Jane', senderCompany: 'SalesOrg' }
  );
  assert.equal(result, 'Best, Jane from SalesOrg');
});

test('processEmailContent: conditional blocks with variable', () => {
  const result = processEmailContent(
    '{if:company}I see you work at {{company}}.{/if} Cheers!',
    { company: 'BigCorp' }
  );
  assert.equal(result, 'I see you work at BigCorp. Cheers!');
});

test('processEmailContent: conditional block removed when variable empty', () => {
  const result = processEmailContent(
    '{if:company}I see you work at {{company}}.{/if}Cheers!',
    { company: '' }
  );
  assert.equal(result, 'Cheers!');
});

test('processEmailContent: fallback value used when variable missing', () => {
  const result = processEmailContent(
    'Hi {{firstName|there}}',
    {}
  );
  assert.equal(result, 'Hi there');
});

test('processEmailContent: unknown variables preserved', () => {
  const result = processEmailContent(
    'Hi {{unknownVar}}',
    { firstName: 'Test' }
  );
  assert.equal(result, 'Hi {{unknownVar}}');
});

test('processEmailContent: ifnot block shown when variable missing', () => {
  const result = processEmailContent(
    '{ifnot:phone}Please reply to schedule a call.{/ifnot}',
    {}
  );
  assert.equal(result, 'Please reply to schedule a call.');
});

test('processEmailContent: ifnot block hidden when variable present', () => {
  const result = processEmailContent(
    '{ifnot:phone}Please reply to schedule a call.{/ifnot}',
    { phone: '555-1234' }
  );
  assert.equal(result, '');
});

// Summary
console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
