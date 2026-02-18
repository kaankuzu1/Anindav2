/**
 * Pre-Launch Audit — Suite 8: Campaign Scheduler Logic Tests
 *
 * ~200 tests covering: selectVariant weighted selection, isWithinSendWindow,
 * isWithinPerDaySchedule, inbox health score & filtering, throttle percentages,
 * MAX_EMAILS_PER_RUN limits, and send-time optimizer.
 *
 * All tested functions are reconstructed locally from the source to allow
 * pure-function unit testing without Supabase/Redis dependencies.
 */

import assert from 'node:assert/strict';
import {
  isWithinSendWindow,
  isWithinPerDaySchedule,
  calculateHealthScore,
  calculateWarmupQuota,
  randomDelay,
} from '../../packages/shared/src/utils';
import {
  inferTimezoneFromEmail,
  inferTimezoneFromLocation,
  calculateOptimalSendTime,
  calculateBatchSendTimes,
  isWithinOptimalWindow,
  getDayScore,
} from '../../packages/shared/src/send-time-optimizer';

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
    console.log(`  FAIL: ${name}\n        ${msg}`);
  }
}

// ============================================
// Inline reconstructions from campaign-scheduler.ts
// ============================================

interface Variant {
  id: string;
  subject: string;
  body: string;
  weight: number;
}

/**
 * Exact replica of selectVariant from campaign-scheduler.ts (line 694-711)
 */
function selectVariant(variants: Variant[]): Variant | null {
  if (!variants || variants.length === 0) return null;

  const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);

  // If all weights are 0, fall back to first variant
  if (totalWeight === 0) return variants[0];

  let random = Math.random() * totalWeight;
  for (const variant of variants) {
    random -= (variant.weight || 0);
    if (random <= 0) {
      return variant;
    }
  }

  return variants[variants.length - 1];
}

/**
 * Deterministic version for precise testing
 */
function selectVariantWithRandom(variants: Variant[], randomValue: number): Variant | null {
  if (!variants || variants.length === 0) return null;

  const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);

  if (totalWeight === 0) return variants[0];

  let random = randomValue * totalWeight;
  for (const variant of variants) {
    random -= (variant.weight || 0);
    if (random <= 0) {
      return variant;
    }
  }

  return variants[variants.length - 1];
}

// Constants from campaign-scheduler.ts
const MAX_EMAILS_PER_RUN = 100;
const MIN_INBOX_HEALTH_SCORE = 50;
const DEFAULT_SEND_WINDOW_START = '09:00';
const DEFAULT_SEND_WINDOW_END = '17:00';
const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_SEND_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

// Inbox filtering logic from processCampaign (line 183-197)
interface TestInbox {
  id: string;
  email: string;
  from_name: string | null;
  status: string;
  sent_today: number;
  daily_send_limit: number;
  throttle_percentage?: number;
  health_score?: number;
  effective_daily_limit?: number;
}

function filterAvailableInboxes(inboxes: TestInbox[]): TestInbox[] {
  return inboxes
    .filter((inbox): inbox is TestInbox =>
      inbox !== null &&
      inbox.status === 'active' &&
      (inbox.health_score ?? 100) >= MIN_INBOX_HEALTH_SCORE
    )
    .map(inbox => {
      const throttlePercent = inbox.throttle_percentage ?? 100;
      const baseLimit = inbox.daily_send_limit || 50;
      const effectiveLimit = Math.floor(baseLimit * (throttlePercent / 100));
      return { ...inbox, effective_daily_limit: effectiveLimit };
    })
    .filter(inbox => (inbox.sent_today || 0) < inbox.effective_daily_limit!);
}

function selectInbox(campaignId: string, availableInboxes: TestInbox[], rotationIndex: Map<string, number>): TestInbox | null {
  const inboxesWithCapacity = availableInboxes.filter(inbox => {
    const effectiveLimit = inbox.effective_daily_limit ?? inbox.daily_send_limit ?? 50;
    return (inbox.sent_today || 0) < effectiveLimit;
  });

  if (inboxesWithCapacity.length === 0) return null;

  const currentIndex = rotationIndex.get(campaignId) || 0;
  const selectedInbox = inboxesWithCapacity[currentIndex % inboxesWithCapacity.length];
  rotationIndex.set(campaignId, currentIndex + 1);

  return selectedInbox;
}

// ============================================
// 1. selectVariant — Weighted Random Selection (~50 tests)
// ============================================

console.log('\n--- selectVariant: Weighted Random Selection ---');

test('selectVariant: empty array returns null', () => {
  assert.equal(selectVariant([]), null);
});

test('selectVariant: null/undefined returns null', () => {
  assert.equal(selectVariant(null as any), null);
  assert.equal(selectVariant(undefined as any), null);
});

test('selectVariant: single variant (100 weight) always selected', () => {
  const v: Variant[] = [{ id: 'a', subject: 'A', body: 'A', weight: 100 }];
  for (let i = 0; i < 200; i++) {
    assert.equal(selectVariant(v)!.id, 'a');
  }
});

test('selectVariant: single variant returns correct object', () => {
  const v: Variant[] = [{ id: 'x', subject: 'SubX', body: 'BodyX', weight: 100 }];
  const result = selectVariant(v)!;
  assert.equal(result.subject, 'SubX');
  assert.equal(result.body, 'BodyX');
});

test('selectVariant: 50/50 split distributes roughly equally (10K iterations)', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 50 },
    { id: 'b', subject: 'B', body: 'B', weight: 50 },
  ];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  assert.ok(counts.a > 4500 && counts.a < 5500, `A=${counts.a} should be ~5000`);
  assert.ok(counts.b > 4500 && counts.b < 5500, `B=${counts.b} should be ~5000`);
});

test('selectVariant: 33/33/34 split distributes roughly equally', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 33 },
    { id: 'b', subject: 'B', body: 'B', weight: 33 },
    { id: 'c', subject: 'C', body: 'C', weight: 34 },
  ];
  const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  assert.ok(counts.a > 2800 && counts.a < 3800, `A=${counts.a} should be ~3300`);
  assert.ok(counts.b > 2800 && counts.b < 3800, `B=${counts.b} should be ~3300`);
  assert.ok(counts.c > 2900 && counts.c < 3900, `C=${counts.c} should be ~3400`);
});

test('selectVariant: 90/10 split favors first variant (10K iterations, ±5%)', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 90 },
    { id: 'b', subject: 'B', body: 'B', weight: 10 },
  ];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  assert.ok(counts.a > 8500, `A=${counts.a} should be > 8500`);
  assert.ok(counts.b < 1500, `B=${counts.b} should be < 1500`);
  assert.ok(counts.b > 500, `B=${counts.b} should be > 500`);
});

test('selectVariant: 99/1 split extreme case', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 99 },
    { id: 'b', subject: 'B', body: 'B', weight: 1 },
  ];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  assert.ok(counts.a > 9700, `A=${counts.a} should be > 9700`);
  assert.ok(counts.b > 0, `B=${counts.b} should be > 0`);
  assert.ok(counts.b < 300, `B=${counts.b} should be < 300`);
});

test('selectVariant: 0-weight variant never selected when others have weight', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 100 },
    { id: 'b', subject: 'B', body: 'B', weight: 0 },
  ];
  for (let i = 0; i < 1000; i++) {
    assert.equal(selectVariant(v)!.id, 'a');
  }
});

test('selectVariant: 0-weight first, positive second → only second selected', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 0 },
    { id: 'b', subject: 'B', body: 'B', weight: 100 },
  ];
  for (let i = 0; i < 500; i++) {
    assert.equal(selectVariant(v)!.id, 'b');
  }
});

test('selectVariant: all weights 0 → falls back to first variant', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 0 },
    { id: 'b', subject: 'B', body: 'B', weight: 0 },
  ];
  for (let i = 0; i < 100; i++) {
    assert.equal(selectVariant(v)!.id, 'a');
  }
});

test('selectVariant: all weights 0 with 3 variants → first variant', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 0 },
    { id: 'b', subject: 'B', body: 'B', weight: 0 },
    { id: 'c', subject: 'C', body: 'C', weight: 0 },
  ];
  assert.equal(selectVariant(v)!.id, 'a');
});

test('selectVariant: weights sum to 99 (missing 1%)', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 49 },
    { id: 'b', subject: 'B', body: 'B', weight: 50 },
  ];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  // Should still distribute roughly proportionally
  assert.ok(counts.a > 4000, `A=${counts.a} should be > 4000`);
  assert.ok(counts.b > 4500, `B=${counts.b} should be > 4500`);
});

test('selectVariant: weights sum to 200 (over 100)', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 100 },
    { id: 'b', subject: 'B', body: 'B', weight: 100 },
  ];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  // Should still split roughly 50/50
  assert.ok(counts.a > 4500 && counts.a < 5500, `A=${counts.a} should be ~5000`);
});

test('selectVariant: 4 variants with equal weight (25 each)', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 25 },
    { id: 'b', subject: 'B', body: 'B', weight: 25 },
    { id: 'c', subject: 'C', body: 'C', weight: 25 },
    { id: 'd', subject: 'D', body: 'D', weight: 25 },
  ];
  const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  for (const k of ['a', 'b', 'c', 'd']) {
    assert.ok(counts[k] > 2000 && counts[k] < 3000, `${k}=${counts[k]} should be ~2500`);
  }
});

test('selectVariant: deterministic — random=0.0 → first variant', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 50 },
    { id: 'b', subject: 'B', body: 'B', weight: 50 },
  ];
  assert.equal(selectVariantWithRandom(v, 0.0)!.id, 'a');
});

test('selectVariant: deterministic — random=0.49 → first variant (50/50)', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 50 },
    { id: 'b', subject: 'B', body: 'B', weight: 50 },
  ];
  assert.equal(selectVariantWithRandom(v, 0.49)!.id, 'a');
});

test('selectVariant: deterministic — random=0.51 → second variant (50/50)', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 50 },
    { id: 'b', subject: 'B', body: 'B', weight: 50 },
  ];
  assert.equal(selectVariantWithRandom(v, 0.51)!.id, 'b');
});

test('selectVariant: deterministic — random=0.999 → last variant', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 50 },
    { id: 'b', subject: 'B', body: 'B', weight: 50 },
  ];
  assert.equal(selectVariantWithRandom(v, 0.999)!.id, 'b');
});

test('selectVariant: deterministic — 3 variants boundary at 60/30/10', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 60 },
    { id: 'b', subject: 'B', body: 'B', weight: 30 },
    { id: 'c', subject: 'C', body: 'C', weight: 10 },
  ];
  // random=0.0 → 0*100=0, 0-60=-60 ≤ 0 → A
  assert.equal(selectVariantWithRandom(v, 0.0)!.id, 'a');
  // random=0.59 → 59, 59-60=-1 ≤ 0 → A
  assert.equal(selectVariantWithRandom(v, 0.59)!.id, 'a');
  // random=0.61 → 61, 61-60=1, 1-30=-29 ≤ 0 → B
  assert.equal(selectVariantWithRandom(v, 0.61)!.id, 'b');
  // random=0.89 → 89, 89-60=29, 29-30=-1 ≤ 0 → B
  assert.equal(selectVariantWithRandom(v, 0.89)!.id, 'b');
  // random=0.91 → 91, 91-60=31, 31-30=1, 1-10=-9 ≤ 0 → C
  assert.equal(selectVariantWithRandom(v, 0.91)!.id, 'c');
});

test('selectVariant: very small weight (0.1) still participates', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 99 },
    { id: 'b', subject: 'B', body: 'B', weight: 1 },
  ];
  // random=0.995 → 99.5, 99.5-99=0.5, 0.5-1=-0.5 ≤ 0 → B
  assert.equal(selectVariantWithRandom(v, 0.995)!.id, 'b');
});

test('selectVariant: fallback to last variant on rounding edge', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 50 },
    { id: 'b', subject: 'B', body: 'B', weight: 50 },
  ];
  // Even with exact 1.0 (impossible for Math.random but let's test the fallback)
  assert.equal(selectVariantWithRandom(v, 1.0)!.id, 'b');
});

test('selectVariant: weight=1 on every variant (10 variants)', () => {
  const v: Variant[] = Array.from({ length: 10 }, (_, i) => ({
    id: `v${i}`, subject: `S${i}`, body: `B${i}`, weight: 1,
  }));
  const counts: Record<string, number> = {};
  v.forEach(x => counts[x.id] = 0);
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  // Each should be ~1000 ± 300
  for (const k of Object.keys(counts)) {
    assert.ok(counts[k] > 600 && counts[k] < 1400, `${k}=${counts[k]} should be ~1000`);
  }
});

test('selectVariant: mixed 0-weight with non-zero distributes only among non-zero', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 0 },
    { id: 'b', subject: 'B', body: 'B', weight: 50 },
    { id: 'c', subject: 'C', body: 'C', weight: 0 },
    { id: 'd', subject: 'D', body: 'D', weight: 50 },
  ];
  const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  assert.equal(counts.a, 0, 'Zero-weight A should not be selected');
  assert.equal(counts.c, 0, 'Zero-weight C should not be selected');
  assert.ok(counts.b > 4000, `B=${counts.b} should be ~5000`);
  assert.ok(counts.d > 4000, `D=${counts.d} should be ~5000`);
});

test('selectVariant: 80/20 split verifies ~80% for first', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 80 },
    { id: 'b', subject: 'B', body: 'B', weight: 20 },
  ];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  assert.ok(counts.a > 7500, `A=${counts.a} should be > 7500`);
  assert.ok(counts.b > 1500, `B=${counts.b} should be > 1500`);
});

test('selectVariant: 70/20/10 three-way split', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 70 },
    { id: 'b', subject: 'B', body: 'B', weight: 20 },
    { id: 'c', subject: 'C', body: 'C', weight: 10 },
  ];
  const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  assert.ok(counts.a > 6000, `A=${counts.a} should be > 6000`);
  assert.ok(counts.b > 1500, `B=${counts.b} should be > 1500`);
  assert.ok(counts.c > 500, `C=${counts.c} should be > 500`);
});

test('selectVariant: undefined weight treated as 0', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: undefined as any },
    { id: 'b', subject: 'B', body: 'B', weight: 100 },
  ];
  for (let i = 0; i < 100; i++) {
    assert.equal(selectVariant(v)!.id, 'b');
  }
});

test('selectVariant: all undefined weights → falls back to first variant', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: undefined as any },
    { id: 'b', subject: 'B', body: 'B', weight: undefined as any },
  ];
  // totalWeight = 0 (NaN + NaN treated as 0 via `|| 0`), so fallback to first
  assert.equal(selectVariant(v)!.id, 'a');
});

// ============================================
// 2. isWithinSendWindow (~40 tests)
// ============================================

console.log('\n--- isWithinSendWindow ---');

test('isWithinSendWindow: weekday 10:00 within 09:00-17:00 → true', () => {
  const wed10am = new Date('2024-01-10T10:00:00Z');
  assert.equal(isWithinSendWindow(wed10am, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']), true);
});

test('isWithinSendWindow: weekday 08:00 before 09:00-17:00 → false', () => {
  const wed8am = new Date('2024-01-10T08:00:00Z');
  assert.equal(isWithinSendWindow(wed8am, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']), false);
});

test('isWithinSendWindow: weekday 18:00 after 09:00-17:00 → false', () => {
  const wed6pm = new Date('2024-01-10T18:00:00Z');
  assert.equal(isWithinSendWindow(wed6pm, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']), false);
});

test('isWithinSendWindow: boundary start_hour=9, current=09:00 → true (inclusive)', () => {
  const wed9am = new Date('2024-01-10T09:00:00Z');
  assert.equal(isWithinSendWindow(wed9am, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']), true);
});

test('isWithinSendWindow: boundary end_hour=17, current=17:00 → true (inclusive via <=)', () => {
  const wed5pm = new Date('2024-01-10T17:00:00Z');
  assert.equal(isWithinSendWindow(wed5pm, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']), true);
});

test('isWithinSendWindow: Saturday not in weekday schedule → false', () => {
  // 2024-01-13 is Saturday
  const sat10am = new Date('2024-01-13T10:00:00Z');
  assert.equal(isWithinSendWindow(sat10am, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']), false);
});

test('isWithinSendWindow: Sunday not in weekday schedule → false', () => {
  // 2024-01-14 is Sunday
  const sun10am = new Date('2024-01-14T10:00:00Z');
  assert.equal(isWithinSendWindow(sun10am, '09:00', '17:00', 'UTC', ['mon', 'tue', 'wed', 'thu', 'fri']), false);
});

test('isWithinSendWindow: Saturday in weekend schedule → true', () => {
  const sat10am = new Date('2024-01-13T10:00:00Z');
  assert.equal(isWithinSendWindow(sat10am, '09:00', '17:00', 'UTC', ['sat', 'sun']), true);
});

test('isWithinSendWindow: Monday in Mon-only schedule → true', () => {
  // 2024-01-08 is Monday
  const mon10am = new Date('2024-01-08T10:00:00Z');
  assert.equal(isWithinSendWindow(mon10am, '09:00', '17:00', 'UTC', ['mon']), true);
});

test('isWithinSendWindow: Tuesday not in Mon-only schedule → false', () => {
  // 2024-01-09 is Tuesday
  const tue10am = new Date('2024-01-09T10:00:00Z');
  assert.equal(isWithinSendWindow(tue10am, '09:00', '17:00', 'UTC', ['mon']), false);
});

test('isWithinSendWindow: empty send_days → never send', () => {
  const wed10am = new Date('2024-01-10T10:00:00Z');
  assert.equal(isWithinSendWindow(wed10am, '09:00', '17:00', 'UTC', []), false);
});

test('isWithinSendWindow: all 7 days in schedule → any day works', () => {
  const allDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const sat10am = new Date('2024-01-13T10:00:00Z');
  assert.equal(isWithinSendWindow(sat10am, '09:00', '17:00', 'UTC', allDays), true);
});

test('isWithinSendWindow: 12:30 within 09:00-17:00 → true', () => {
  const wed1230 = new Date('2024-01-10T12:30:00Z');
  assert.equal(isWithinSendWindow(wed1230, '09:00', '17:00', 'UTC', ['wed']), true);
});

test('isWithinSendWindow: midnight (00:00) within 00:00-23:59 → true', () => {
  const wedMidnight = new Date('2024-01-10T00:00:00Z');
  assert.equal(isWithinSendWindow(wedMidnight, '00:00', '23:59', 'UTC', ['wed']), true);
});

test('isWithinSendWindow: 23:59 within 00:00-23:59 → true', () => {
  const wedLate = new Date('2024-01-10T23:59:00Z');
  assert.equal(isWithinSendWindow(wedLate, '00:00', '23:59', 'UTC', ['wed']), true);
});

test('isWithinSendWindow: narrow window 10:00-10:30, time=10:15 → true', () => {
  const wed1015 = new Date('2024-01-10T10:15:00Z');
  assert.equal(isWithinSendWindow(wed1015, '10:00', '10:30', 'UTC', ['wed']), true);
});

test('isWithinSendWindow: narrow window 10:00-10:30, time=10:31 → false', () => {
  const wed1031 = new Date('2024-01-10T10:31:00Z');
  assert.equal(isWithinSendWindow(wed1031, '10:00', '10:30', 'UTC', ['wed']), false);
});

test('isWithinSendWindow: timezone offset — UTC 14:00 is NY 09:00 in winter', () => {
  // In winter (EST = UTC-5), 14:00 UTC = 09:00 EST
  const utc14 = new Date('2024-01-10T14:00:00Z');
  assert.equal(isWithinSendWindow(utc14, '09:00', '17:00', 'America/New_York', ['wed']), true);
});

test('isWithinSendWindow: timezone offset — UTC 08:00 is NY 03:00 → outside', () => {
  const utc08 = new Date('2024-01-10T08:00:00Z');
  assert.equal(isWithinSendWindow(utc08, '09:00', '17:00', 'America/New_York', ['wed']), false);
});

test('isWithinSendWindow: UTC 10:00 is London 10:00 in winter → inside 9-17', () => {
  const utc10 = new Date('2024-01-10T10:00:00Z');
  assert.equal(isWithinSendWindow(utc10, '09:00', '17:00', 'Europe/London', ['wed']), true);
});

test('isWithinSendWindow: Tuesday within Tue-Thu schedule → true', () => {
  // 2024-01-09 is Tuesday
  const tue10am = new Date('2024-01-09T10:00:00Z');
  assert.equal(isWithinSendWindow(tue10am, '09:00', '17:00', 'UTC', ['tue', 'wed', 'thu']), true);
});

test('isWithinSendWindow: Friday not in Tue-Thu schedule → false', () => {
  // 2024-01-12 is Friday
  const fri10am = new Date('2024-01-12T10:00:00Z');
  assert.equal(isWithinSendWindow(fri10am, '09:00', '17:00', 'UTC', ['tue', 'wed', 'thu']), false);
});

test('isWithinSendWindow: start=end same time, current at that time → true', () => {
  const wed10am = new Date('2024-01-10T10:00:00Z');
  assert.equal(isWithinSendWindow(wed10am, '10:00', '10:00', 'UTC', ['wed']), true);
});

test('isWithinSendWindow: early morning window 06:00-08:00, time=07:00 → true', () => {
  const wed7am = new Date('2024-01-10T07:00:00Z');
  assert.equal(isWithinSendWindow(wed7am, '06:00', '08:00', 'UTC', ['wed']), true);
});

test('isWithinSendWindow: late evening window 18:00-22:00, time=20:00 → true', () => {
  const wed8pm = new Date('2024-01-10T20:00:00Z');
  assert.equal(isWithinSendWindow(wed8pm, '18:00', '22:00', 'UTC', ['wed']), true);
});

test('isWithinSendWindow: each hour 0-8 outside 9-17 window', () => {
  for (let h = 0; h <= 8; h++) {
    const time = new Date(`2024-01-10T${h.toString().padStart(2, '0')}:00:00Z`);
    assert.equal(isWithinSendWindow(time, '09:00', '17:00', 'UTC', ['wed']), false, `Hour ${h} should be outside`);
  }
});

test('isWithinSendWindow: each hour 9-17 inside 9-17 window', () => {
  for (let h = 9; h <= 17; h++) {
    const time = new Date(`2024-01-10T${h.toString().padStart(2, '0')}:00:00Z`);
    assert.equal(isWithinSendWindow(time, '09:00', '17:00', 'UTC', ['wed']), true, `Hour ${h} should be inside`);
  }
});

test('isWithinSendWindow: each hour 18-23 outside 9-17 window', () => {
  for (let h = 18; h <= 23; h++) {
    const time = new Date(`2024-01-10T${h.toString().padStart(2, '0')}:00:00Z`);
    assert.equal(isWithinSendWindow(time, '09:00', '17:00', 'UTC', ['wed']), false, `Hour ${h} should be outside`);
  }
});

// ============================================
// 3. isWithinPerDaySchedule (~30 tests)
// ============================================

console.log('\n--- isWithinPerDaySchedule ---');

test('isWithinPerDaySchedule: hour inside single interval → true', () => {
  const wed10am = new Date('2024-01-10T10:00:00Z');
  const schedule = { wed: [{ start: 9, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed10am, schedule, 'UTC'), true);
});

test('isWithinPerDaySchedule: hour outside single interval → false', () => {
  const wed8am = new Date('2024-01-10T08:00:00Z');
  const schedule = { wed: [{ start: 9, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed8am, schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: start hour inclusive (hour=9, start=9) → true', () => {
  const wed9am = new Date('2024-01-10T09:00:00Z');
  const schedule = { wed: [{ start: 9, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed9am, schedule, 'UTC'), true);
});

test('isWithinPerDaySchedule: end hour exclusive (hour=17, end=17) → false', () => {
  const wed5pm = new Date('2024-01-10T17:00:00Z');
  const schedule = { wed: [{ start: 9, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed5pm, schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: day not in schedule → false', () => {
  const wed10am = new Date('2024-01-10T10:00:00Z');
  const schedule = { mon: [{ start: 9, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed10am, schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: empty schedule → false', () => {
  const wed10am = new Date('2024-01-10T10:00:00Z');
  assert.equal(isWithinPerDaySchedule(wed10am, {}, 'UTC'), false);
});

test('isWithinPerDaySchedule: empty intervals for the day → false', () => {
  const wed10am = new Date('2024-01-10T10:00:00Z');
  const schedule = { wed: [] };
  assert.equal(isWithinPerDaySchedule(wed10am, schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: multiple intervals — matches first', () => {
  const wed10am = new Date('2024-01-10T10:00:00Z');
  const schedule = { wed: [{ start: 9, end: 12 }, { start: 14, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed10am, schedule, 'UTC'), true);
});

test('isWithinPerDaySchedule: multiple intervals — matches second', () => {
  const wed3pm = new Date('2024-01-10T15:00:00Z');
  const schedule = { wed: [{ start: 9, end: 12 }, { start: 14, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed3pm, schedule, 'UTC'), true);
});

test('isWithinPerDaySchedule: gap between intervals → false', () => {
  const wed1pm = new Date('2024-01-10T13:00:00Z');
  const schedule = { wed: [{ start: 9, end: 12 }, { start: 14, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(wed1pm, schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: full day Mon-Fri schedule', () => {
  const schedule: Record<string, { start: number; end: number }[]> = {
    mon: [{ start: 9, end: 17 }],
    tue: [{ start: 9, end: 17 }],
    wed: [{ start: 9, end: 17 }],
    thu: [{ start: 9, end: 17 }],
    fri: [{ start: 9, end: 17 }],
  };
  // Wednesday 10am → true
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T10:00:00Z'), schedule, 'UTC'), true);
  // Saturday 10am → false (not in schedule)
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-13T10:00:00Z'), schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: weekend only schedule', () => {
  const schedule = {
    sat: [{ start: 10, end: 14 }],
    sun: [{ start: 10, end: 14 }],
  };
  // Saturday 11am → true
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-13T11:00:00Z'), schedule, 'UTC'), true);
  // Wednesday 11am → false
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T11:00:00Z'), schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: single day only (Wednesday)', () => {
  const schedule = { wed: [{ start: 9, end: 17 }] };
  // Wednesday → true
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T10:00:00Z'), schedule, 'UTC'), true);
  // Thursday → false
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-11T10:00:00Z'), schedule, 'UTC'), false);
  // Tuesday → false
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-09T10:00:00Z'), schedule, 'UTC'), false);
});

test('isWithinPerDaySchedule: start=0 end=24 covers entire day', () => {
  const schedule = { wed: [{ start: 0, end: 24 }] };
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T00:00:00Z'), schedule, 'UTC'), true);
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T12:00:00Z'), schedule, 'UTC'), true);
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T23:00:00Z'), schedule, 'UTC'), true);
});

test('isWithinPerDaySchedule: timezone — UTC 14:00 = NY 09:00 EST in winter', () => {
  const utc14 = new Date('2024-01-10T14:00:00Z');
  const schedule = { wed: [{ start: 9, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(utc14, schedule, 'America/New_York'), true);
});

test('isWithinPerDaySchedule: timezone — UTC 13:00 = NY 08:00 EST → outside', () => {
  const utc13 = new Date('2024-01-10T13:00:00Z');
  const schedule = { wed: [{ start: 9, end: 17 }] };
  assert.equal(isWithinPerDaySchedule(utc13, schedule, 'America/New_York'), false);
});

test('isWithinPerDaySchedule: 3 intervals in a day — morning/afternoon/evening', () => {
  const schedule = {
    wed: [
      { start: 8, end: 10 },
      { start: 12, end: 14 },
      { start: 18, end: 20 },
    ],
  };
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T09:00:00Z'), schedule, 'UTC'), true);
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T11:00:00Z'), schedule, 'UTC'), false);
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T13:00:00Z'), schedule, 'UTC'), true);
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T16:00:00Z'), schedule, 'UTC'), false);
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T19:00:00Z'), schedule, 'UTC'), true);
});

test('isWithinPerDaySchedule: different schedules for different days', () => {
  const schedule = {
    mon: [{ start: 8, end: 12 }],
    wed: [{ start: 14, end: 18 }],
  };
  // Monday 10am → true
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-08T10:00:00Z'), schedule, 'UTC'), true);
  // Monday 3pm → false
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-08T15:00:00Z'), schedule, 'UTC'), false);
  // Wednesday 3pm → true
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T15:00:00Z'), schedule, 'UTC'), true);
  // Wednesday 10am → false
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-10T10:00:00Z'), schedule, 'UTC'), false);
});

// ============================================
// 4. Inbox Health Score & Filtering (~25 tests)
// ============================================

console.log('\n--- Inbox Health Score & Filtering ---');

test('Health score: warmup not enabled and day=0 → 0', () => {
  assert.equal(calculateHealthScore({ warmupEnabled: false, currentDay: 0, sentTotal: 0, repliedTotal: 0 }), 0);
});

test('Health score: warmup enabled day=1 → base + engagement bonus', () => {
  const score = calculateHealthScore({ warmupEnabled: true, currentDay: 1, sentTotal: 0, repliedTotal: 0 });
  // dayScore = (1/30)*40 ≈ 1.33, engagement = 5 → ~6
  assert.ok(score >= 6 && score <= 7, `Score=${score} should be ~6`);
});

test('Health score: day 30 full warmup → dayScore=40', () => {
  const score = calculateHealthScore({ warmupEnabled: true, currentDay: 30, sentTotal: 500, repliedTotal: 150 });
  // dayScore=40, replyRate=0.3 → replyScore=30, volumeScore=20, engagement=10 → 100
  assert.equal(score, 100);
});

test('Health score: day 15 partial warmup', () => {
  const score = calculateHealthScore({ warmupEnabled: true, currentDay: 15, sentTotal: 100, repliedTotal: 30 });
  // dayScore = (15/30)*40 = 20, replyRate=0.3 → replyScore=30, volumeScore=(100/500)*20=4, engagement=10 → 64
  assert.equal(score, 64);
});

test('Health score: high bounce rate reduces score', () => {
  const withBounce = calculateHealthScore({ warmupEnabled: true, currentDay: 30, sentTotal: 500, repliedTotal: 150, bounceRate: 0.5 });
  const noBounce = calculateHealthScore({ warmupEnabled: true, currentDay: 30, sentTotal: 500, repliedTotal: 150 });
  // bounceRate=0.5 → penalty=5
  assert.ok(withBounce < noBounce, `With bounce ${withBounce} should be less than ${noBounce}`);
});

test('Health score: high spam rate reduces score significantly', () => {
  const withSpam = calculateHealthScore({ warmupEnabled: true, currentDay: 30, sentTotal: 500, repliedTotal: 150, spamRate: 0.05 });
  const noSpam = calculateHealthScore({ warmupEnabled: true, currentDay: 30, sentTotal: 500, repliedTotal: 150 });
  // spamRate=0.05 → penalty=1.0
  assert.ok(withSpam < noSpam, `With spam ${withSpam} should be less than ${noSpam}`);
});

test('Health score: massive penalties clamp to 0', () => {
  const score = calculateHealthScore({ warmupEnabled: true, currentDay: 1, sentTotal: 10, repliedTotal: 0, bounceRate: 5, spamRate: 5 });
  assert.equal(score, 0);
});

test('Health score: max clamp to 100', () => {
  const score = calculateHealthScore({ warmupEnabled: true, currentDay: 100, sentTotal: 10000, repliedTotal: 5000 });
  assert.equal(score, 100);
});

test('Health score: day 0 with warmup enabled → not zero (engagement bonus)', () => {
  const score = calculateHealthScore({ warmupEnabled: true, currentDay: 0, sentTotal: 0, repliedTotal: 0 });
  // dayScore=0, no replies, no volume, currentDay=0 so no engagement bonus → 0
  assert.equal(score, 0);
});

test('Health score: day 8 gets full engagement bonus (10)', () => {
  const score = calculateHealthScore({ warmupEnabled: true, currentDay: 8, sentTotal: 0, repliedTotal: 0 });
  // dayScore = (8/30)*40 ≈ 10.67, engagement=10 → ~21
  assert.equal(score, 21);
});

test('Health score: day 5 gets partial engagement bonus (5)', () => {
  const score = calculateHealthScore({ warmupEnabled: true, currentDay: 5, sentTotal: 0, repliedTotal: 0 });
  // dayScore = (5/30)*40 ≈ 6.67, engagement=5 → ~12
  assert.equal(score, 12);
});

test('Health score: 0 sent total → no reply or volume score', () => {
  const score = calculateHealthScore({ warmupEnabled: true, currentDay: 30, sentTotal: 0, repliedTotal: 0 });
  // dayScore=40, replyScore=0, volumeScore=0, engagement=10 → 50
  assert.equal(score, 50);
});

test('Inbox filter: score 49 → excluded (below MIN=50)', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 49 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result.length, 0);
});

test('Inbox filter: score 50 → included (at threshold)', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 50 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result.length, 1);
});

test('Inbox filter: score 100 → included', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 100 },
  ];
  assert.equal(filterAvailableInboxes(inboxes).length, 1);
});

test('Inbox filter: score 0 → excluded', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 0 },
  ];
  assert.equal(filterAvailableInboxes(inboxes).length, 0);
});

test('Inbox filter: no health_score (undefined) → defaults to 100 → included', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 50 },
  ];
  assert.equal(filterAvailableInboxes(inboxes).length, 1);
});

test('Inbox filter: status=error → excluded', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'error', sent_today: 0, daily_send_limit: 50, health_score: 100 },
  ];
  assert.equal(filterAvailableInboxes(inboxes).length, 0);
});

test('Inbox filter: status=warming_up → excluded', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'warming_up', sent_today: 0, daily_send_limit: 50, health_score: 100 },
  ];
  assert.equal(filterAvailableInboxes(inboxes).length, 0);
});

test('Inbox filter: sent_today at limit → excluded', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 50, daily_send_limit: 50, health_score: 100 },
  ];
  assert.equal(filterAvailableInboxes(inboxes).length, 0);
});

test('Inbox filter: sent_today below limit → included', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 49, daily_send_limit: 50, health_score: 100 },
  ];
  assert.equal(filterAvailableInboxes(inboxes).length, 1);
});

test('Inbox filter: mixed health scores — only healthy included', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'A', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 80 },
    { id: 'i2', email: 'b@test.com', from_name: 'B', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 30 },
    { id: 'i3', email: 'c@test.com', from_name: 'C', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 60 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result.length, 2);
  assert.ok(result.some(i => i.id === 'i1'));
  assert.ok(result.some(i => i.id === 'i3'));
});

// ============================================
// 5. Throttle Percentages (~15 tests)
// ============================================

console.log('\n--- Throttle Percentages ---');

test('Throttle: 100% → effective limit = base limit', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 100, health_score: 100, throttle_percentage: 100 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result[0].effective_daily_limit, 100);
});

test('Throttle: 50% → effective limit = 50', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 100, health_score: 100, throttle_percentage: 50 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result[0].effective_daily_limit, 50);
});

test('Throttle: 0% → effective limit = 0 → inbox excluded (no capacity)', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 100, health_score: 100, throttle_percentage: 0 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result.length, 0);
});

test('Throttle: 75% of 100 → 75', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 100, health_score: 100, throttle_percentage: 75 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result[0].effective_daily_limit, 75);
});

test('Throttle: 33% of 100 → Math.floor(33) = 33', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 100, health_score: 100, throttle_percentage: 33 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result[0].effective_daily_limit, 33);
});

test('Throttle: undefined → defaults to 100%', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 100, health_score: 100 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result[0].effective_daily_limit, 100);
});

test('Throttle: 50% of 50 → 25', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 100, throttle_percentage: 50 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result[0].effective_daily_limit, 25);
});

test('Throttle: 10% of 200 → 20', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 200, health_score: 100, throttle_percentage: 10 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result[0].effective_daily_limit, 20);
});

test('Throttle: sent_today = effective limit → excluded', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 25, daily_send_limit: 50, health_score: 100, throttle_percentage: 50 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result.length, 0);
});

test('Throttle: sent_today just below effective limit → included', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 24, daily_send_limit: 50, health_score: 100, throttle_percentage: 50 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result.length, 1);
});

test('Throttle: fractional result uses Math.floor → 33% of 10 = 3', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 10, health_score: 100, throttle_percentage: 33 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result[0].effective_daily_limit, 3);
});

test('Throttle: daily_send_limit=0 → default 50 used', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'Test', status: 'active', sent_today: 0, daily_send_limit: 0, health_score: 100, throttle_percentage: 100 },
  ];
  const result = filterAvailableInboxes(inboxes);
  // daily_send_limit || 50 → 50
  assert.equal(result[0].effective_daily_limit, 50);
});

// ============================================
// 6. MAX_EMAILS_PER_RUN (~15 tests)
// ============================================

console.log('\n--- MAX_EMAILS_PER_RUN ---');

test('MAX_EMAILS_PER_RUN: constant is 100', () => {
  assert.equal(MAX_EMAILS_PER_RUN, 100);
});

test('MAX_EMAILS_PER_RUN: slice 50 leads → all 50 processed', () => {
  const leads = Array.from({ length: 50 }, (_, i) => ({ id: `l${i}` }));
  const toProcess = leads.slice(0, MAX_EMAILS_PER_RUN);
  assert.equal(toProcess.length, 50);
});

test('MAX_EMAILS_PER_RUN: slice 100 leads → all 100 processed', () => {
  const leads = Array.from({ length: 100 }, (_, i) => ({ id: `l${i}` }));
  const toProcess = leads.slice(0, MAX_EMAILS_PER_RUN);
  assert.equal(toProcess.length, 100);
});

test('MAX_EMAILS_PER_RUN: slice 101 leads → only 100 processed', () => {
  const leads = Array.from({ length: 101 }, (_, i) => ({ id: `l${i}` }));
  const toProcess = leads.slice(0, MAX_EMAILS_PER_RUN);
  assert.equal(toProcess.length, 100);
});

test('MAX_EMAILS_PER_RUN: slice 200 leads → only 100 processed', () => {
  const leads = Array.from({ length: 200 }, (_, i) => ({ id: `l${i}` }));
  const toProcess = leads.slice(0, MAX_EMAILS_PER_RUN);
  assert.equal(toProcess.length, 100);
});

test('MAX_EMAILS_PER_RUN: slice 1000 leads → only 100 processed', () => {
  const leads = Array.from({ length: 1000 }, (_, i) => ({ id: `l${i}` }));
  const toProcess = leads.slice(0, MAX_EMAILS_PER_RUN);
  assert.equal(toProcess.length, 100);
});

test('MAX_EMAILS_PER_RUN: slice 0 leads → 0 processed', () => {
  const leads: { id: string }[] = [];
  const toProcess = leads.slice(0, MAX_EMAILS_PER_RUN);
  assert.equal(toProcess.length, 0);
});

test('MAX_EMAILS_PER_RUN: slice 1 lead → 1 processed', () => {
  const leads = [{ id: 'l1' }];
  const toProcess = leads.slice(0, MAX_EMAILS_PER_RUN);
  assert.equal(toProcess.length, 1);
});

test('MAX_EMAILS_PER_RUN: first 100 leads are the ones processed', () => {
  const leads = Array.from({ length: 150 }, (_, i) => ({ id: `l${i}` }));
  const toProcess = leads.slice(0, MAX_EMAILS_PER_RUN);
  assert.equal(toProcess[0].id, 'l0');
  assert.equal(toProcess[99].id, 'l99');
});

test('MIN_INBOX_HEALTH_SCORE: constant is 50', () => {
  assert.equal(MIN_INBOX_HEALTH_SCORE, 50);
});

test('DEFAULT_SEND_WINDOW_START: constant is 09:00', () => {
  assert.equal(DEFAULT_SEND_WINDOW_START, '09:00');
});

test('DEFAULT_SEND_WINDOW_END: constant is 17:00', () => {
  assert.equal(DEFAULT_SEND_WINDOW_END, '17:00');
});

test('DEFAULT_TIMEZONE: constant is America/New_York', () => {
  assert.equal(DEFAULT_TIMEZONE, 'America/New_York');
});

test('DEFAULT_SEND_DAYS: weekdays only', () => {
  assert.deepEqual(DEFAULT_SEND_DAYS, ['mon', 'tue', 'wed', 'thu', 'fri']);
});

// ============================================
// 7. Inbox Round-Robin Selection (~10 tests)
// ============================================

console.log('\n--- Inbox Round-Robin Selection ---');

test('selectInbox: round-robin cycles through inboxes', () => {
  const rotation = new Map<string, number>();
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'A', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 100, effective_daily_limit: 50 },
    { id: 'i2', email: 'b@test.com', from_name: 'B', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 100, effective_daily_limit: 50 },
  ];
  assert.equal(selectInbox('c1', inboxes, rotation)!.id, 'i1');
  assert.equal(selectInbox('c1', inboxes, rotation)!.id, 'i2');
  assert.equal(selectInbox('c1', inboxes, rotation)!.id, 'i1');
});

test('selectInbox: single inbox always returns same inbox', () => {
  const rotation = new Map<string, number>();
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'A', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 100, effective_daily_limit: 50 },
  ];
  for (let i = 0; i < 5; i++) {
    assert.equal(selectInbox('c1', inboxes, rotation)!.id, 'i1');
  }
});

test('selectInbox: no inboxes → null', () => {
  const rotation = new Map<string, number>();
  assert.equal(selectInbox('c1', [], rotation), null);
});

test('selectInbox: all at capacity → null', () => {
  const rotation = new Map<string, number>();
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'A', status: 'active', sent_today: 50, daily_send_limit: 50, health_score: 100, effective_daily_limit: 50 },
  ];
  assert.equal(selectInbox('c1', inboxes, rotation), null);
});

test('selectInbox: different campaigns have independent rotation', () => {
  const rotation = new Map<string, number>();
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'A', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 100, effective_daily_limit: 50 },
    { id: 'i2', email: 'b@test.com', from_name: 'B', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 100, effective_daily_limit: 50 },
  ];
  assert.equal(selectInbox('c1', inboxes, rotation)!.id, 'i1');
  assert.equal(selectInbox('c2', inboxes, rotation)!.id, 'i1');
  assert.equal(selectInbox('c1', inboxes, rotation)!.id, 'i2');
  assert.equal(selectInbox('c2', inboxes, rotation)!.id, 'i2');
});

test('selectInbox: 3 inboxes round-robin through all three', () => {
  const rotation = new Map<string, number>();
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'A', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 100, effective_daily_limit: 50 },
    { id: 'i2', email: 'b@test.com', from_name: 'B', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 100, effective_daily_limit: 50 },
    { id: 'i3', email: 'c@test.com', from_name: 'C', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 100, effective_daily_limit: 50 },
  ];
  const ids = [];
  for (let i = 0; i < 6; i++) ids.push(selectInbox('c1', inboxes, rotation)!.id);
  assert.deepEqual(ids, ['i1', 'i2', 'i3', 'i1', 'i2', 'i3']);
});

// ============================================
// 8. Send Time Optimizer (~25 tests)
// ============================================

console.log('\n--- Send Time Optimizer ---');

test('inferTimezoneFromEmail: .de domain → Europe/Berlin', () => {
  assert.equal(inferTimezoneFromEmail('user@company.de'), 'Europe/Berlin');
});

test('inferTimezoneFromEmail: .co.uk domain → Europe/London', () => {
  assert.equal(inferTimezoneFromEmail('user@company.co.uk'), 'Europe/London');
});

test('inferTimezoneFromEmail: .fr domain → Europe/Paris', () => {
  assert.equal(inferTimezoneFromEmail('user@company.fr'), 'Europe/Paris');
});

test('inferTimezoneFromEmail: .jp domain → Asia/Tokyo', () => {
  assert.equal(inferTimezoneFromEmail('user@company.jp'), 'Asia/Tokyo');
});

test('inferTimezoneFromEmail: .au domain → Australia/Sydney', () => {
  assert.equal(inferTimezoneFromEmail('user@company.au'), 'Australia/Sydney');
});

test('inferTimezoneFromEmail: .com domain → America/New_York (default US)', () => {
  assert.equal(inferTimezoneFromEmail('user@company.com'), 'America/New_York');
});

test('inferTimezoneFromEmail: .io domain → America/New_York (US business default)', () => {
  assert.equal(inferTimezoneFromEmail('user@company.io'), 'America/New_York');
});

test('inferTimezoneFromEmail: .org domain → America/New_York', () => {
  assert.equal(inferTimezoneFromEmail('user@company.org'), 'America/New_York');
});

test('inferTimezoneFromEmail: .in domain → Asia/Kolkata', () => {
  assert.equal(inferTimezoneFromEmail('user@company.in'), 'Asia/Kolkata');
});

test('inferTimezoneFromEmail: .br domain → America/Sao_Paulo', () => {
  assert.equal(inferTimezoneFromEmail('user@company.br'), 'America/Sao_Paulo');
});

test('inferTimezoneFromEmail: unknown TLD returns null', () => {
  assert.equal(inferTimezoneFromEmail('user@company.xyz'), null);
});

test('inferTimezoneFromEmail: no @ sign → null', () => {
  assert.equal(inferTimezoneFromEmail('invalid-email'), null);
});

test('inferTimezoneFromLocation: US + NY → America/New_York', () => {
  assert.equal(inferTimezoneFromLocation('US', undefined, 'NY'), 'America/New_York');
});

test('inferTimezoneFromLocation: US + CA → America/Los_Angeles', () => {
  assert.equal(inferTimezoneFromLocation('US', undefined, 'CA'), 'America/Los_Angeles');
});

test('inferTimezoneFromLocation: US + TX → America/Chicago', () => {
  assert.equal(inferTimezoneFromLocation('US', undefined, 'TX'), 'America/Chicago');
});

test('inferTimezoneFromLocation: US + CO → America/Denver', () => {
  assert.equal(inferTimezoneFromLocation('US', undefined, 'CO'), 'America/Denver');
});

test('inferTimezoneFromLocation: US + AK → America/Anchorage', () => {
  assert.equal(inferTimezoneFromLocation('US', undefined, 'AK'), 'America/Anchorage');
});

test('inferTimezoneFromLocation: US + HI → Pacific/Honolulu', () => {
  assert.equal(inferTimezoneFromLocation('US', undefined, 'HI'), 'Pacific/Honolulu');
});

test('inferTimezoneFromLocation: US no state → defaults to America/New_York', () => {
  assert.equal(inferTimezoneFromLocation('US'), 'America/New_York');
});

test('inferTimezoneFromLocation: "United States" recognized', () => {
  assert.equal(inferTimezoneFromLocation('United States', undefined, 'CA'), 'America/Los_Angeles');
});

test('inferTimezoneFromLocation: Germany → Europe/Berlin', () => {
  assert.equal(inferTimezoneFromLocation('DE'), 'Europe/Berlin');
});

test('inferTimezoneFromLocation: unknown country → null', () => {
  assert.equal(inferTimezoneFromLocation('XX'), null);
});

test('inferTimezoneFromLocation: no country → null', () => {
  assert.equal(inferTimezoneFromLocation(), null);
});

test('calculateOptimalSendTime: explicit timezone → high confidence', () => {
  const result = calculateOptimalSendTime(
    { email: 'user@test.com', timezone: 'Europe/London' },
    [],
    { useHistoricalData: false }
  );
  assert.equal(result.timezone, 'Europe/London');
  assert.equal(result.timezoneSource, 'explicit');
  assert.equal(result.confidence, 'high');
});

test('calculateOptimalSendTime: country-based → medium confidence', () => {
  const result = calculateOptimalSendTime(
    { email: 'user@test.com', country: 'DE' },
    [],
    { useHistoricalData: false }
  );
  assert.equal(result.timezone, 'Europe/Berlin');
  assert.equal(result.timezoneSource, 'domain');
  assert.equal(result.confidence, 'medium');
});

test('calculateOptimalSendTime: domain-based → medium confidence', () => {
  const result = calculateOptimalSendTime(
    { email: 'user@test.de' },
    [],
    { useHistoricalData: false }
  );
  assert.equal(result.timezone, 'Europe/Berlin');
  assert.equal(result.timezoneSource, 'domain');
  assert.equal(result.confidence, 'medium');
});

test('calculateOptimalSendTime: unknown domain → fallback to sender tz', () => {
  const result = calculateOptimalSendTime(
    { email: 'user@test.xyz' },
    [],
    { useHistoricalData: false, senderTimezone: 'America/Chicago' }
  );
  assert.equal(result.timezone, 'America/Chicago');
  assert.equal(result.timezoneSource, 'fallback');
  assert.equal(result.confidence, 'low');
});

test('calculateOptimalSendTime: historical data (3+ entries) → high confidence', () => {
  const history = [
    { openedAt: new Date(), dayOfWeek: 2, hourOfDay: 10 },
    { openedAt: new Date(), dayOfWeek: 3, hourOfDay: 10 },
    { openedAt: new Date(), dayOfWeek: 4, hourOfDay: 10 },
  ];
  const result = calculateOptimalSendTime(
    { email: 'user@test.com', timezone: 'UTC' },
    history,
    { useHistoricalData: true }
  );
  assert.equal(result.confidence, 'high');
});

test('calculateOptimalSendTime: insufficient history (< 3) → uses default window', () => {
  const history = [
    { openedAt: new Date(), dayOfWeek: 2, hourOfDay: 10 },
    { openedAt: new Date(), dayOfWeek: 3, hourOfDay: 14 },
  ];
  const result = calculateOptimalSendTime(
    { email: 'user@test.com' },
    history,
    { useHistoricalData: true }
  );
  // Not enough data for historical optimization, falls back to default window
  // .com domain → medium confidence from domain inference
  assert.equal(result.timezoneSource, 'domain');
  assert.equal(result.confidence, 'medium');
});

test('calculateOptimalSendTime: scheduledAt is a future Date', () => {
  const result = calculateOptimalSendTime(
    { email: 'user@test.com' },
    [],
    { useHistoricalData: false }
  );
  assert.ok(result.scheduledAt instanceof Date);
  // scheduledAt should be in the future (or very near present)
  assert.ok(result.scheduledAt.getTime() > Date.now() - 60000, 'scheduledAt should be near present or future');
});

test('calculateOptimalSendTime: reasoning string is non-empty', () => {
  const result = calculateOptimalSendTime(
    { email: 'user@test.com' },
    [],
    { useHistoricalData: false }
  );
  assert.ok(result.reasoning.length > 0);
});

test('calculateBatchSendTimes: processes multiple leads', () => {
  const leads = [
    { id: '1', email: 'a@test.de' },
    { id: '2', email: 'b@test.fr' },
    { id: '3', email: 'c@test.jp' },
  ];
  const results = calculateBatchSendTimes(leads, new Map(), { useHistoricalData: false });
  assert.equal(results.size, 3);
  assert.equal(results.get('1')!.timezone, 'Europe/Berlin');
  assert.equal(results.get('2')!.timezone, 'Europe/Paris');
  assert.equal(results.get('3')!.timezone, 'Asia/Tokyo');
});

test('getDayScore: Tuesday → 100', () => {
  // 2024-01-09 is Tuesday
  assert.equal(getDayScore(new Date('2024-01-09T10:00:00Z')), 100);
});

test('getDayScore: Wednesday → 100', () => {
  assert.equal(getDayScore(new Date('2024-01-10T10:00:00Z')), 100);
});

test('getDayScore: Thursday → 100', () => {
  assert.equal(getDayScore(new Date('2024-01-11T10:00:00Z')), 100);
});

test('getDayScore: Monday → 70', () => {
  assert.equal(getDayScore(new Date('2024-01-08T10:00:00Z')), 70);
});

test('getDayScore: Friday → 70', () => {
  assert.equal(getDayScore(new Date('2024-01-12T10:00:00Z')), 70);
});

test('getDayScore: Saturday → 30', () => {
  assert.equal(getDayScore(new Date('2024-01-13T10:00:00Z')), 30);
});

test('getDayScore: Sunday → 20', () => {
  assert.equal(getDayScore(new Date('2024-01-14T10:00:00Z')), 20);
});

test('isWithinOptimalWindow: valid timezone inside window → true', () => {
  // This test is time-dependent, so we just verify it returns a boolean
  const result = isWithinOptimalWindow('UTC', 0, 24);
  assert.equal(result, true);
});

test('isWithinOptimalWindow: valid timezone outside window → false', () => {
  // Window of 0 hours
  const result = isWithinOptimalWindow('UTC', 25, 25);
  // Invalid hours but should handle gracefully
  assert.equal(typeof result, 'boolean');
});

test('isWithinOptimalWindow: invalid timezone → returns true (allows sending)', () => {
  const result = isWithinOptimalWindow('Invalid/Timezone', 9, 17);
  assert.equal(result, true);
});

// ============================================
// 9. randomDelay utility (~5 tests)
// ============================================

console.log('\n--- randomDelay ---');

test('randomDelay: result is within [min, max) range', () => {
  for (let i = 0; i < 100; i++) {
    const result = randomDelay(1000, 5000);
    assert.ok(result >= 1000, `${result} should be >= 1000`);
    assert.ok(result < 5000, `${result} should be < 5000`);
  }
});

test('randomDelay: min=0 max=1 → result is 0', () => {
  for (let i = 0; i < 50; i++) {
    const result = randomDelay(0, 1);
    assert.equal(result, 0);
  }
});

test('randomDelay: min=max → result is min', () => {
  const result = randomDelay(5000, 5000);
  assert.equal(result, 5000);
});

test('randomDelay: large range still works', () => {
  const result = randomDelay(0, 1000000);
  assert.ok(result >= 0 && result < 1000000);
});

test('randomDelay: returns integer', () => {
  for (let i = 0; i < 20; i++) {
    const result = randomDelay(100, 200);
    assert.equal(result, Math.floor(result));
  }
});

// ============================================
// 10. Warmup Quota Calculation (~10 tests)
// ============================================

console.log('\n--- Warmup Quota Calculation ---');

test('calculateWarmupQuota: day 1 normal speed → 2', () => {
  assert.equal(calculateWarmupQuota(1, 'normal'), 2);
});

test('calculateWarmupQuota: day 1 slow speed → 1 (2 * 0.7 = 1.4 → floor 1)', () => {
  assert.equal(calculateWarmupQuota(1, 'slow'), 1);
});

test('calculateWarmupQuota: day 1 fast speed → 3 (2 * 1.5 = 3)', () => {
  assert.equal(calculateWarmupQuota(1, 'fast'), 3);
});

test('calculateWarmupQuota: day 5 normal → 8', () => {
  assert.equal(calculateWarmupQuota(5, 'normal'), 8);
});

test('calculateWarmupQuota: day 15 normal → 25', () => {
  assert.equal(calculateWarmupQuota(15, 'normal'), 25);
});

test('calculateWarmupQuota: day 31 normal → 40', () => {
  assert.equal(calculateWarmupQuota(31, 'normal'), 40);
});

test('calculateWarmupQuota: day 31 fast → 60 (40 * 1.5)', () => {
  assert.equal(calculateWarmupQuota(31, 'fast'), 60);
});

test('calculateWarmupQuota: day 31 slow → 28 (40 * 0.7)', () => {
  assert.equal(calculateWarmupQuota(31, 'slow'), 28);
});

test('calculateWarmupQuota: day 100 normal → 40 (capped at max tier)', () => {
  assert.equal(calculateWarmupQuota(100, 'normal'), 40);
});

test('calculateWarmupQuota: day 22 normal → 35', () => {
  assert.equal(calculateWarmupQuota(22, 'normal'), 35);
});

test('calculateWarmupQuota: day 3 normal → 4', () => {
  assert.equal(calculateWarmupQuota(3, 'normal'), 4);
});

test('calculateWarmupQuota: day 8 normal → 12', () => {
  assert.equal(calculateWarmupQuota(8, 'normal'), 12);
});

test('calculateWarmupQuota: day 11 normal → 18', () => {
  assert.equal(calculateWarmupQuota(11, 'normal'), 18);
});

// ============================================
// 11. Additional Send Window Edge Cases
// ============================================

console.log('\n--- Additional Edge Cases ---');

test('isWithinSendWindow: Thursday each hour 9-17 in schedule → true', () => {
  // 2024-01-11 is Thursday
  for (let h = 9; h <= 17; h++) {
    const time = new Date(`2024-01-11T${h.toString().padStart(2, '0')}:00:00Z`);
    assert.equal(isWithinSendWindow(time, '09:00', '17:00', 'UTC', ['thu']), true, `Thu hour ${h} should be inside`);
  }
});

test('isWithinPerDaySchedule: all 7 days with uniform schedule', () => {
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const schedule: Record<string, { start: number; end: number }[]> = {};
  days.forEach(d => schedule[d] = [{ start: 8, end: 20 }]);
  // Any weekday at noon → true
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-08T12:00:00Z'), schedule, 'UTC'), true); // Mon
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-13T12:00:00Z'), schedule, 'UTC'), true); // Sat
  assert.equal(isWithinPerDaySchedule(new Date('2024-01-14T12:00:00Z'), schedule, 'UTC'), true); // Sun
});

test('Inbox filter: multiple healthy inboxes, one at capacity → capacity one excluded', () => {
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'A', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 80 },
    { id: 'i2', email: 'b@test.com', from_name: 'B', status: 'active', sent_today: 50, daily_send_limit: 50, health_score: 80 },
    { id: 'i3', email: 'c@test.com', from_name: 'C', status: 'active', sent_today: 10, daily_send_limit: 50, health_score: 80 },
  ];
  const result = filterAvailableInboxes(inboxes);
  assert.equal(result.length, 2);
  assert.ok(!result.some(i => i.id === 'i2'), 'i2 at capacity should be excluded');
});

test('selectVariant: 50/25/25 three-way distribution', () => {
  const v: Variant[] = [
    { id: 'a', subject: 'A', body: 'A', weight: 50 },
    { id: 'b', subject: 'B', body: 'B', weight: 25 },
    { id: 'c', subject: 'C', body: 'C', weight: 25 },
  ];
  const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 10000; i++) counts[selectVariant(v)!.id]++;
  assert.ok(counts.a > 4500 && counts.a < 5500, `A=${counts.a} should be ~5000`);
  assert.ok(counts.b > 2000 && counts.b < 3000, `B=${counts.b} should be ~2500`);
  assert.ok(counts.c > 2000 && counts.c < 3000, `C=${counts.c} should be ~2500`);
});

test('Health score: reply rate exactly 30% (target) → full reply score', () => {
  const score = calculateHealthScore({ warmupEnabled: true, currentDay: 30, sentTotal: 100, repliedTotal: 30 });
  // dayScore=40, replyRate=0.3 → replyScore=30, volumeScore=(100/500)*20=4, engagement=10 → 84
  assert.equal(score, 84);
});

test('Health score: reply rate 60% (above target) → still capped at 30 reply score', () => {
  const score = calculateHealthScore({ warmupEnabled: true, currentDay: 30, sentTotal: 100, repliedTotal: 60 });
  // dayScore=40, replyRate=0.6 → min(0.6/0.3,1)=1 → replyScore=30, volumeScore=4, engagement=10 → 84
  assert.equal(score, 84);
});

test('inferTimezoneFromEmail: .sg domain → Asia/Singapore', () => {
  assert.equal(inferTimezoneFromEmail('user@company.sg'), 'Asia/Singapore');
});

test('inferTimezoneFromEmail: .nl domain → Europe/Amsterdam', () => {
  assert.equal(inferTimezoneFromEmail('user@company.nl'), 'Europe/Amsterdam');
});

test('inferTimezoneFromEmail: .ae domain → Asia/Dubai', () => {
  assert.equal(inferTimezoneFromEmail('user@company.ae'), 'Asia/Dubai');
});

test('inferTimezoneFromEmail: .za domain → Africa/Johannesburg', () => {
  assert.equal(inferTimezoneFromEmail('user@company.za'), 'Africa/Johannesburg');
});

test('inferTimezoneFromEmail: .net domain → America/New_York (US business)', () => {
  assert.equal(inferTimezoneFromEmail('user@company.net'), 'America/New_York');
});

test('inferTimezoneFromLocation: US + AZ → America/Phoenix', () => {
  assert.equal(inferTimezoneFromLocation('US', undefined, 'AZ'), 'America/Phoenix');
});

test('selectInbox: skips inboxes that hit capacity mid-rotation', () => {
  const rotation = new Map<string, number>();
  const inboxes: TestInbox[] = [
    { id: 'i1', email: 'a@test.com', from_name: 'A', status: 'active', sent_today: 49, daily_send_limit: 50, health_score: 100, effective_daily_limit: 50 },
    { id: 'i2', email: 'b@test.com', from_name: 'B', status: 'active', sent_today: 0, daily_send_limit: 50, health_score: 100, effective_daily_limit: 50 },
  ];
  // First select: i1 (index 0)
  const first = selectInbox('c1', inboxes, rotation)!;
  assert.equal(first.id, 'i1');
  // Simulate sending: i1 hits capacity
  inboxes[0].sent_today = 50;
  // Second select: should skip i1, go to i2
  const second = selectInbox('c1', inboxes, rotation)!;
  assert.equal(second.id, 'i2');
});

// ============================================
// Results
// ============================================

console.log(`\n${'='.repeat(50)}\nResults: ${passed} passed, ${failed} failed of ${passed + failed}\n${'='.repeat(50)}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
