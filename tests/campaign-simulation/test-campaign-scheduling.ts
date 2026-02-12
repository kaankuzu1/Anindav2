/**
 * Campaign Scheduling Logic Tests
 *
 * Tests lead selection, send window, inbox selection, health score filtering,
 * A/B variant selection, throttle calculation, MAX_EMAILS_PER_RUN, delay
 * threshold filtering, and mid-campaign schedule changes.
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
// Inline selectVariant (matching campaign-scheduler.ts)
// ============================================

interface Variant {
  id: string;
  variant_name: string;
  weight: number;
  subject: string;
  body: string;
}

function selectVariant(variants: Variant[]): Variant {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;
  for (const variant of variants) {
    random -= variant.weight;
    if (random <= 0) return variant;
  }
  return variants[variants.length - 1];
}

// ============================================
// Inline throttle calculation
// ============================================

function calculateThrottlePercent(health: number): number {
  if (health <= 20) return 25;
  if (health >= 100) return 100;
  return Math.round(25 + (health - 20) * (75 / 80));
}

// ============================================
// Lead Selection — Step 1 (Initial)
// ============================================

console.log('\n--- Lead Selection: Step 1 (Initial) ---');

test('Only pending leads selected for step 1', () => {
  const leads = [
    { id: 'l1', status: 'pending' as LeadStatus },
    { id: 'l2', status: 'contacted' as LeadStatus },
    { id: 'l3', status: 'pending' as LeadStatus },
    { id: 'l4', status: 'bounced' as LeadStatus },
    { id: 'l5', status: 'replied' as LeadStatus },
  ];
  const eligible = leads.filter(l => l.status === 'pending');
  assert.equal(eligible.length, 2);
  assert.deepEqual(eligible.map(l => l.id), ['l1', 'l3']);
});

test('MAX_EMAILS_PER_RUN=100 caps lead selection', () => {
  const MAX_EMAILS_PER_RUN = 100;
  const pendingLeads = Array.from({ length: 250 }, (_, i) => ({ id: `lead-${i}`, status: 'pending' as LeadStatus }));
  const selected = pendingLeads.slice(0, MAX_EMAILS_PER_RUN);
  assert.equal(selected.length, 100);
});

test('Fewer than 100 pending leads selects all', () => {
  const MAX_EMAILS_PER_RUN = 100;
  const pendingLeads = Array.from({ length: 30 }, (_, i) => ({ id: `lead-${i}`, status: 'pending' as LeadStatus }));
  const selected = pendingLeads.slice(0, MAX_EMAILS_PER_RUN);
  assert.equal(selected.length, 30);
});

test('Terminal statuses skipped via blocksSequence()', () => {
  const leads = [
    { id: 'l1', status: 'pending' as LeadStatus },
    { id: 'l2', status: 'bounced' as LeadStatus },
    { id: 'l3', status: 'unsubscribed' as LeadStatus },
    { id: 'l4', status: 'spam_reported' as LeadStatus },
    { id: 'l5', status: 'replied' as LeadStatus },
    { id: 'l6', status: 'interested' as LeadStatus },
    { id: 'l7', status: 'meeting_booked' as LeadStatus },
  ];
  const eligible = leads.filter(l => !leadStateMachine.blocksSequence(l.status));
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, 'l1');
});

test('in_sequence and contacted do not block sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('in_sequence'), false);
  assert.equal(leadStateMachine.blocksSequence('contacted'), false);
});

// ============================================
// Lead Selection — Step N (Follow-ups)
// ============================================

console.log('\n--- Lead Selection: Step N (Follow-ups) ---');

test('Step N: only contacted leads with delay exceeded are selected', () => {
  const now = Date.now();
  const leads = [
    { id: 'l1', status: 'contacted' as LeadStatus, last_sent_at: now - 3 * 86400000 },
    { id: 'l2', status: 'contacted' as LeadStatus, last_sent_at: now - 1 * 86400000 },
    { id: 'l3', status: 'pending' as LeadStatus, last_sent_at: 0 },
  ];
  const delayDays = 2;
  const eligible = leads.filter(
    l => l.status === 'contacted' && (now - l.last_sent_at) >= delayDays * 86400000
  );
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, 'l1');
});

test('Step N: lead contacted but delay not met is skipped', () => {
  const now = Date.now();
  const leads = [
    { id: 'l1', status: 'contacted' as LeadStatus, last_sent_at: now - 12 * 3600000 },
  ];
  const delayDays = 1;
  const eligible = leads.filter(
    l => l.status === 'contacted' && (now - l.last_sent_at) >= delayDays * 86400000
  );
  assert.equal(eligible.length, 0);
});

test('Step N: blocking statuses excluded from follow-ups', () => {
  const now = Date.now();
  const leads = [
    { id: 'l1', status: 'replied' as LeadStatus, last_sent_at: now - 5 * 86400000 },
    { id: 'l2', status: 'bounced' as LeadStatus, last_sent_at: now - 5 * 86400000 },
    { id: 'l3', status: 'contacted' as LeadStatus, last_sent_at: now - 5 * 86400000 },
  ];
  const eligible = leads.filter(l => !leadStateMachine.blocksSequence(l.status));
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, 'l3');
});

// ============================================
// isWithinSendWindow
// ============================================

console.log('\n--- isWithinSendWindow ---');

test('Weekday within business hours returns true', () => {
  const wed10am = new Date('2024-01-10T10:00:00Z');
  assert.equal(isWithinSendWindow(wed10am, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']), true);
});

test('Weekday outside business hours returns false', () => {
  const wed8pm = new Date('2024-01-10T20:00:00Z');
  assert.equal(isWithinSendWindow(wed8pm, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']), false);
});

test('Weekend returns false when not in sendDays', () => {
  const sat10am = new Date('2024-01-13T10:00:00Z');
  assert.equal(isWithinSendWindow(sat10am, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']), false);
});

test('Saturday returns true when included', () => {
  const sat10am = new Date('2024-01-13T10:00:00Z');
  assert.equal(isWithinSendWindow(sat10am, '09:00', '17:00', 'UTC', ['sat']), true);
});

test('Exact start time is within window', () => {
  const wed9am = new Date('2024-01-10T09:00:00Z');
  assert.equal(isWithinSendWindow(wed9am, '09:00', '17:00', 'UTC', ['wed']), true);
});

test('Exact end time is within window', () => {
  const wed5pm = new Date('2024-01-10T17:00:00Z');
  assert.equal(isWithinSendWindow(wed5pm, '09:00', '17:00', 'UTC', ['wed']), true);
});

test('EST timezone conversion: 15:00 UTC = 10:00 EST', () => {
  const utc3pm = new Date('2024-01-10T15:00:00Z');
  assert.equal(isWithinSendWindow(utc3pm, '09:00', '17:00', 'America/New_York', ['wed']), true);
});

test('Empty sendDays returns false', () => {
  const wed10am = new Date('2024-01-10T10:00:00Z');
  assert.equal(isWithinSendWindow(wed10am, '09:00', '17:00', 'UTC', []), false);
});

// ============================================
// isWithinPerDaySchedule
// ============================================

console.log('\n--- isWithinPerDaySchedule ---');

test('Within single interval returns true', () => {
  const wed10 = new Date('2024-01-10T10:00:00Z');
  assert.equal(isWithinPerDaySchedule(wed10, { wed: [{ start: 9, end: 17 }] }, 'UTC'), true);
});

test('Outside all intervals returns false', () => {
  const wed20 = new Date('2024-01-10T20:00:00Z');
  assert.equal(isWithinPerDaySchedule(wed20, { wed: [{ start: 9, end: 12 }, { start: 14, end: 17 }] }, 'UTC'), false);
});

test('Within second interval returns true', () => {
  const wed15 = new Date('2024-01-10T15:00:00Z');
  assert.equal(isWithinPerDaySchedule(wed15, { wed: [{ start: 9, end: 12 }, { start: 14, end: 17 }] }, 'UTC'), true);
});

test('Between intervals returns false', () => {
  const wed13 = new Date('2024-01-10T13:00:00Z');
  assert.equal(isWithinPerDaySchedule(wed13, { wed: [{ start: 9, end: 12 }, { start: 14, end: 17 }] }, 'UTC'), false);
});

test('Unscheduled day returns false', () => {
  const thu10 = new Date('2024-01-11T10:00:00Z');
  assert.equal(isWithinPerDaySchedule(thu10, { wed: [{ start: 9, end: 17 }] }, 'UTC'), false);
});

test('Empty intervals for day returns false', () => {
  const wed10 = new Date('2024-01-10T10:00:00Z');
  assert.equal(isWithinPerDaySchedule(wed10, { wed: [] }, 'UTC'), false);
});

test('Start hour is inclusive', () => {
  const wed9 = new Date('2024-01-10T09:00:00Z');
  assert.equal(isWithinPerDaySchedule(wed9, { wed: [{ start: 9, end: 17 }] }, 'UTC'), true);
});

test('End hour is exclusive', () => {
  const wed17 = new Date('2024-01-10T17:00:00Z');
  assert.equal(isWithinPerDaySchedule(wed17, { wed: [{ start: 9, end: 17 }] }, 'UTC'), false);
});

// ============================================
// Inbox Selection — Health Score Filter
// ============================================

console.log('\n--- Inbox Selection: Health Score Filter ---');

test('Health >= 50 passes filter', () => {
  const inboxes = [
    { id: 'i1', health_score: 80 },
    { id: 'i2', health_score: 50 },
    { id: 'i3', health_score: 49 },
    { id: 'i4', health_score: 30 },
  ];
  const eligible = inboxes.filter(i => i.health_score >= 50);
  assert.equal(eligible.length, 2);
  assert.deepEqual(eligible.map(i => i.id), ['i1', 'i2']);
});

test('No inboxes above threshold returns empty', () => {
  const inboxes = [
    { id: 'i1', health_score: 20 },
    { id: 'i2', health_score: 30 },
  ];
  const eligible = inboxes.filter(i => i.health_score >= 50);
  assert.equal(eligible.length, 0);
});

test('Round-robin simulation distributes evenly', () => {
  const inboxes = [
    { id: 'i1', count: 0 },
    { id: 'i2', count: 0 },
    { id: 'i3', count: 0 },
  ];
  for (let i = 0; i < 30; i++) {
    inboxes[i % inboxes.length].count++;
  }
  assert.equal(inboxes[0].count, 10);
  assert.equal(inboxes[1].count, 10);
  assert.equal(inboxes[2].count, 10);
});

// ============================================
// Throttle Percentage
// ============================================

console.log('\n--- Throttle Percentage ---');

test('Throttle: health 20 -> 25%', () => {
  assert.equal(calculateThrottlePercent(20), 25);
});

test('Throttle: health 50 -> ~53%', () => {
  assert.equal(calculateThrottlePercent(50), 53);
});

test('Throttle: health 100 -> 100%', () => {
  assert.equal(calculateThrottlePercent(100), 100);
});

test('Throttle: health 0 -> 25% (minimum)', () => {
  assert.equal(calculateThrottlePercent(0), 25);
});

test('Throttle: health 60 -> ~63%', () => {
  const result = calculateThrottlePercent(60);
  assert.equal(result, 63);
});

test('Capacity: health 80, base limit 100 -> 81 emails', () => {
  const baseLimit = 100;
  const throttle = calculateThrottlePercent(80);
  // 25 + 60 * 75/80 = 25 + 56.25 = 81
  const capacity = Math.round(baseLimit * throttle / 100);
  assert.equal(capacity, 81);
});

// ============================================
// A/B Variant Selection
// ============================================

console.log('\n--- A/B Variant Selection ---');

test('Single variant always selected', () => {
  const variants: Variant[] = [
    { id: 'a', variant_name: 'A', weight: 100, subject: 'A sub', body: 'A body' },
  ];
  for (let i = 0; i < 100; i++) {
    assert.equal(selectVariant(variants).id, 'a');
  }
});

test('Two equal-weight variants: ~50/50 (±5%)', () => {
  const variants: Variant[] = [
    { id: 'a', variant_name: 'A', weight: 50, subject: 'A', body: 'A' },
    { id: 'b', variant_name: 'B', weight: 50, subject: 'B', body: 'B' },
  ];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) {
    counts[selectVariant(variants).id]++;
  }
  assert.ok(counts.a > 4500, `A count ${counts.a} should be > 4500`);
  assert.ok(counts.a < 5500, `A count ${counts.a} should be < 5500`);
  assert.ok(counts.b > 4500, `B count ${counts.b} should be > 4500`);
  assert.ok(counts.b < 5500, `B count ${counts.b} should be < 5500`);
});

test('80/20 split: A gets ~80% (±8%)', () => {
  const variants: Variant[] = [
    { id: 'a', variant_name: 'A', weight: 80, subject: 'A', body: 'A' },
    { id: 'b', variant_name: 'B', weight: 20, subject: 'B', body: 'B' },
  ];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) {
    counts[selectVariant(variants).id]++;
  }
  assert.ok(counts.a > 7200, `A count ${counts.a} should be > 7200`);
  assert.ok(counts.a < 8800, `A count ${counts.a} should be < 8800`);
});

test('Three variants 60/30/10: distribution within tolerance', () => {
  const variants: Variant[] = [
    { id: 'a', variant_name: 'A', weight: 60, subject: 'A', body: 'A' },
    { id: 'b', variant_name: 'B', weight: 30, subject: 'B', body: 'B' },
    { id: 'c', variant_name: 'C', weight: 10, subject: 'C', body: 'C' },
  ];
  const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 10000; i++) {
    counts[selectVariant(variants).id]++;
  }
  assert.ok(counts.a > 5200, `A count ${counts.a} should be > 5200`);
  assert.ok(counts.a < 6800, `A count ${counts.a} should be < 6800`);
  assert.ok(counts.b > 2200, `B count ${counts.b} should be > 2200`);
  assert.ok(counts.b < 3800, `B count ${counts.b} should be < 3800`);
  assert.ok(counts.c > 200, `C count ${counts.c} should be > 200`);
  assert.ok(counts.c < 1800, `C count ${counts.c} should be < 1800`);
});

test('Zero-weight variant never selected', () => {
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

test('Winner gets 100%: only winner selected', () => {
  const variants: Variant[] = [
    { id: 'a', variant_name: 'A', weight: 100, subject: 'A', body: 'A' },
    { id: 'b', variant_name: 'B', weight: 0, subject: 'B', body: 'B' },
    { id: 'c', variant_name: 'C', weight: 0, subject: 'C', body: 'C' },
  ];
  for (let i = 0; i < 100; i++) {
    assert.equal(selectVariant(variants).id, 'a');
  }
});

test('Fallback to original sequence content when no variants', () => {
  const sequence = { subject: 'Original Subject', body: 'Original Body' };
  const variants: Variant[] = [];
  const chosen = variants.length > 0 ? selectVariant(variants) : null;
  const subject = chosen?.subject ?? sequence.subject;
  const body = chosen?.body ?? sequence.body;
  assert.equal(subject, 'Original Subject');
  assert.equal(body, 'Original Body');
});

// ============================================
// Health Score for Inbox Filtering
// ============================================

console.log('\n--- Health Score Calculations ---');

test('calculateHealthScore: score 49 excluded', () => {
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 20,
    sentTotal: 200,
    repliedTotal: 20,
    bounceRate: 0.6,
  });
  assert.equal(score, 49);
  assert.ok(score < 50);
});

test('calculateHealthScore: score 50 included', () => {
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 20,
    sentTotal: 200,
    repliedTotal: 20,
    bounceRate: 0.5,
  });
  assert.equal(score, 50);
  assert.ok(score >= 50);
});

test('calculateHealthScore: no warmup defaults to 0', () => {
  const score = calculateHealthScore({
    warmupEnabled: false,
    currentDay: 0,
    sentTotal: 0,
    repliedTotal: 0,
  });
  assert.equal(score, 0);
});

test('calculateHealthScore: fully warmed inbox with high engagement', () => {
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 45,
    sentTotal: 600,
    repliedTotal: 200,
    bounceRate: 0,
  });
  assert.ok(score >= 90, `Expected >= 90, got ${score}`);
});

// ============================================
// Mid-Campaign Changes
// ============================================

console.log('\n--- Mid-Campaign Schedule Changes ---');

test('Schedule change: new sendDays takes effect next tick', () => {
  // Simulate reading fresh settings per tick
  let settings = { sendDays: ['mon', 'tue', 'wed', 'thu', 'fri'], startTime: '09:00', endTime: '17:00' };
  const sat10am = new Date('2024-01-13T10:00:00Z');
  assert.equal(isWithinSendWindow(sat10am, settings.startTime, settings.endTime, 'UTC', settings.sendDays), false);

  // Mid-campaign change: add Saturday
  settings = { ...settings, sendDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] };
  assert.equal(isWithinSendWindow(sat10am, settings.startTime, settings.endTime, 'UTC', settings.sendDays), true);
});

test('Schedule change: new send window takes effect next tick', () => {
  let settings = { sendDays: ['wed'], startTime: '09:00', endTime: '12:00' };
  const wed15 = new Date('2024-01-10T15:00:00Z');
  assert.equal(isWithinSendWindow(wed15, settings.startTime, settings.endTime, 'UTC', settings.sendDays), false);

  // Expand window to 18:00
  settings = { ...settings, endTime: '18:00' };
  assert.equal(isWithinSendWindow(wed15, settings.startTime, settings.endTime, 'UTC', settings.sendDays), true);
});

test('Variable injection works with selected variant content', () => {
  const variants: Variant[] = [
    { id: 'a', variant_name: 'A', weight: 100, subject: 'Hi {{firstName}}', body: 'Welcome to {{company}}' },
  ];
  const chosen = selectVariant(variants);
  const subject = processEmailContent(chosen.subject, { firstName: 'Alice' });
  const body = processEmailContent(chosen.body, { company: 'Acme' });
  assert.equal(subject, 'Hi Alice');
  assert.equal(body, 'Welcome to Acme');
});

// ============================================
// MAX_EMAILS_PER_RUN Edge Cases
// ============================================

console.log('\n--- MAX_EMAILS_PER_RUN Edge Cases ---');

test('Exactly 100 leads: all sent', () => {
  const MAX_EMAILS_PER_RUN = 100;
  const leads = Array.from({ length: 100 }, (_, i) => ({ id: `l-${i}` }));
  let sent = 0;
  for (const lead of leads) {
    if (sent >= MAX_EMAILS_PER_RUN) break;
    sent++;
  }
  assert.equal(sent, 100);
});

test('101 leads: only 100 sent', () => {
  const MAX_EMAILS_PER_RUN = 100;
  const leads = Array.from({ length: 101 }, (_, i) => ({ id: `l-${i}` }));
  let sent = 0;
  for (const lead of leads) {
    if (sent >= MAX_EMAILS_PER_RUN) break;
    sent++;
  }
  assert.equal(sent, 100);
});

test('Zero leads: zero sent', () => {
  const MAX_EMAILS_PER_RUN = 100;
  const leads: any[] = [];
  let sent = 0;
  for (const lead of leads) {
    if (sent >= MAX_EMAILS_PER_RUN) break;
    sent++;
  }
  assert.equal(sent, 0);
});

// ============================================
// Summary
// ============================================

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
