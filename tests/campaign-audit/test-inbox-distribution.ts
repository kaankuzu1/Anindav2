/**
 * Inbox Distribution & Health Tests
 *
 * Tests health score formula, warmup quota ramp-up by day/speed,
 * ESP rate limits, and domain detection utilities.
 */

import assert from 'node:assert/strict';
import {
  calculateHealthScore,
  calculateWarmupQuota,
  getEspLimits,
  getEmailDomain,
  detectEsp,
  ESP_RATE_LIMITS,
} from '../../packages/shared/src/utils';

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
// calculateHealthScore — Formula Tests
// ============================================

console.log('\n--- calculateHealthScore: Formula ---');

test('Health: no warmup, day 0 → score 0', () => {
  const score = calculateHealthScore({
    warmupEnabled: false,
    currentDay: 0,
    sentTotal: 0,
    repliedTotal: 0,
  });
  assert.equal(score, 0);
});

test('Health: day score = min(currentDay/30, 1) * 40 — day 15 → 20', () => {
  // day=15 → dayScore = 15/30 * 40 = 20
  // sentTotal=0 → replyScore=0, volumeScore=0
  // warmupEnabled=true, day>7 → engagement=10
  // total = 20 + 0 + 0 + 10 = 30
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 15,
    sentTotal: 0,
    repliedTotal: 0,
  });
  assert.equal(score, 30);
});

test('Health: day 30+ → full 40 day points', () => {
  // day=30 → dayScore = min(30/30,1)*40 = 40
  // sentTotal=0 → replyScore=0, volumeScore=0
  // enabled, day>7 → +10
  // total = 40 + 0 + 0 + 10 = 50
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 30,
    sentTotal: 0,
    repliedTotal: 0,
  });
  assert.equal(score, 50);
});

test('Health: day 60 caps at 40 day points (same as day 30)', () => {
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 60,
    sentTotal: 0,
    repliedTotal: 0,
  });
  assert.equal(score, 50); // 40 day + 10 engagement
});

test('Health: reply rate = 30% → full 30 reply points', () => {
  // day=0 → dayScore=0 (but warmupEnabled=true, day=0 → engagement=0 since not >7 or >0... actually day=0 but warmupEnabled)
  // Actually: warmupEnabled=true, currentDay=0: not (!warmupEnabled && currentDay===0) so we proceed.
  // day=0, enabled → dayScore = 0
  // sent=100, replied=30 → rate=0.3 → replyScore = min(0.3/0.3,1)*30 = 30
  // volumeScore = min(100/500,1)*20 = 4
  // warmupEnabled=true, day=0 → day is not >7, is not >0 → no engagement bonus
  // Actually day=0, which is NOT > 0, so no engagement
  // total = 0 + 30 + 4 + 0 = 34
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 0,
    sentTotal: 100,
    repliedTotal: 30,
  });
  assert.equal(score, 34);
});

test('Health: reply rate above 30% caps at 30 points', () => {
  // sent=100, replied=60 → rate=0.6 → min(0.6/0.3,1)*30 = 30 (capped)
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 0,
    sentTotal: 100,
    repliedTotal: 60,
  });
  // 0 + 30 + 4 + 0 = 34
  assert.equal(score, 34);
});

test('Health: volume 500+ → full 20 volume points', () => {
  // day=0, sent=500, replied=0, enabled
  // dayScore=0, replyScore=0, volumeScore=min(500/500,1)*20=20, engagement=0
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 0,
    sentTotal: 500,
    repliedTotal: 0,
  });
  assert.equal(score, 20);
});

test('Health: engagement bonus: enabled + day > 7 → +10', () => {
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 8,
    sentTotal: 0,
    repliedTotal: 0,
  });
  // dayScore = 8/30*40 = 10.67
  // engagement = +10
  // total ≈ 20.67 → round to 21
  assert.equal(score, 21);
});

test('Health: engagement bonus: enabled + day 1-7 → +5', () => {
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 3,
    sentTotal: 0,
    repliedTotal: 0,
  });
  // dayScore = 3/30*40 = 4
  // engagement = +5
  // total = 9
  assert.equal(score, 9);
});

test('Health: bounce rate penalty (bounceRate * 10)', () => {
  // Base score with day=30, sent=0, enabled → 50
  // With bounceRate=2.0 → penalty = 20
  // 50 - 20 = 30
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 30,
    sentTotal: 0,
    repliedTotal: 0,
    bounceRate: 2.0,
  });
  assert.equal(score, 30);
});

test('Health: spam rate penalty (spamRate * 20)', () => {
  // Base = 50, spamRate=1.5 → penalty = 30
  // 50 - 30 = 20
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 30,
    sentTotal: 0,
    repliedTotal: 0,
    spamRate: 1.5,
  });
  assert.equal(score, 20);
});

test('Health: clamped minimum is 0', () => {
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 1,
    sentTotal: 0,
    repliedTotal: 0,
    bounceRate: 5,
    spamRate: 5,
  });
  assert.equal(score, 0, 'Score should be clamped to 0');
});

test('Health: clamped maximum is 100', () => {
  // Maxed out: day=30(40) + reply=30% of 500(30) + vol=500(20) + engagement(10) = 100
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 30,
    sentTotal: 500,
    repliedTotal: 150, // 30% of 500
  });
  assert.equal(score, 100);
});

// ============================================
// calculateWarmupQuota — All Tiers × All Speeds
// ============================================

console.log('\n--- calculateWarmupQuota: Tiers × Speeds ---');

// Ramp table: [dayRange, baseQuota]
const tiers: [string, number, number, number][] = [
  // [label, day, baseQuota, ...]
  // We test specific day within each tier
];

// Tier 1: days 1-2, base=2
test('Warmup quota: day 1, normal → 2', () => {
  assert.equal(calculateWarmupQuota(1, 'normal'), 2);
});
test('Warmup quota: day 1, slow → 1 (floor(2*0.7))', () => {
  assert.equal(calculateWarmupQuota(1, 'slow'), 1);
});
test('Warmup quota: day 1, fast → 3 (floor(2*1.5))', () => {
  assert.equal(calculateWarmupQuota(1, 'fast'), 3);
});

// Tier 2: days 3-4, base=4
test('Warmup quota: day 3, normal → 4', () => {
  assert.equal(calculateWarmupQuota(3, 'normal'), 4);
});

// Tier 3: days 5-7, base=8
test('Warmup quota: day 5, normal → 8', () => {
  assert.equal(calculateWarmupQuota(5, 'normal'), 8);
});

// Tier 4: days 8-10, base=12
test('Warmup quota: day 10, normal → 12', () => {
  assert.equal(calculateWarmupQuota(10, 'normal'), 12);
});
test('Warmup quota: day 10, slow → 8 (floor(12*0.7))', () => {
  assert.equal(calculateWarmupQuota(10, 'slow'), 8);
});
test('Warmup quota: day 10, fast → 18 (floor(12*1.5))', () => {
  assert.equal(calculateWarmupQuota(10, 'fast'), 18);
});

// Tier 5: days 11-14, base=18
test('Warmup quota: day 14, normal → 18', () => {
  assert.equal(calculateWarmupQuota(14, 'normal'), 18);
});

// Tier 6: days 15-21, base=25
test('Warmup quota: day 20, normal → 25', () => {
  assert.equal(calculateWarmupQuota(20, 'normal'), 25);
});

// Tier 7: days 22-30, base=35
test('Warmup quota: day 25, normal → 35', () => {
  assert.equal(calculateWarmupQuota(25, 'normal'), 35);
});

// Tier 8: days 31+, base=40
test('Warmup quota: day 31, normal → 40', () => {
  assert.equal(calculateWarmupQuota(31, 'normal'), 40);
});
test('Warmup quota: day 100, normal → 40 (same as 31+)', () => {
  assert.equal(calculateWarmupQuota(100, 'normal'), 40);
});
test('Warmup quota: day 31, slow → 28 (floor(40*0.7))', () => {
  assert.equal(calculateWarmupQuota(31, 'slow'), 28);
});
test('Warmup quota: day 31, fast → 60 (floor(40*1.5))', () => {
  assert.equal(calculateWarmupQuota(31, 'fast'), 60);
});

// ============================================
// getEspLimits — ESP Rate Limits
// ============================================

console.log('\n--- getEspLimits: ESP Rate Limits ---');

test('getEspLimits: gmail.com → 500/day, 20/hour', () => {
  const limits = getEspLimits('user@gmail.com');
  assert.equal(limits.daily, 500);
  assert.equal(limits.hourly, 20);
});

test('getEspLimits: googlemail.com → same as gmail', () => {
  const limits = getEspLimits('user@googlemail.com');
  assert.equal(limits.daily, 500);
  assert.equal(limits.hourly, 20);
});

test('getEspLimits: outlook.com → 300/day, 30/hour', () => {
  const limits = getEspLimits('user@outlook.com');
  assert.equal(limits.daily, 300);
  assert.equal(limits.hourly, 30);
});

test('getEspLimits: hotmail.com → same as outlook', () => {
  const limits = getEspLimits('user@hotmail.com');
  assert.equal(limits.daily, 300);
  assert.equal(limits.hourly, 30);
});

test('getEspLimits: live.com → same as outlook', () => {
  const limits = getEspLimits('user@live.com');
  assert.equal(limits.daily, 300);
});

test('getEspLimits: unknown domain → 100/day, 20/hour', () => {
  const limits = getEspLimits('user@customdomain.io');
  assert.equal(limits.daily, 100);
  assert.equal(limits.hourly, 20);
});

// ============================================
// getEmailDomain & detectEsp
// ============================================

console.log('\n--- getEmailDomain & detectEsp ---');

test('getEmailDomain: extracts domain correctly', () => {
  assert.equal(getEmailDomain('alice@example.com'), 'example.com');
});

test('getEmailDomain: handles uppercase', () => {
  assert.equal(getEmailDomain('Alice@GMAIL.COM'), 'gmail.com');
});

test('getEmailDomain: handles empty string', () => {
  assert.equal(getEmailDomain(''), '');
});

test('detectEsp: gmail.com → gmail', () => {
  assert.equal(detectEsp('user@gmail.com'), 'gmail');
});

test('detectEsp: googlemail.com → gmail', () => {
  assert.equal(detectEsp('user@googlemail.com'), 'gmail');
});

test('detectEsp: outlook.com → microsoft', () => {
  assert.equal(detectEsp('user@outlook.com'), 'microsoft');
});

test('detectEsp: hotmail.com → microsoft', () => {
  assert.equal(detectEsp('user@hotmail.com'), 'microsoft');
});

test('detectEsp: live.com → microsoft', () => {
  assert.equal(detectEsp('user@live.com'), 'microsoft');
});

test('detectEsp: msn.com → microsoft', () => {
  assert.equal(detectEsp('user@msn.com'), 'microsoft');
});

test('detectEsp: custom domain → other', () => {
  assert.equal(detectEsp('user@acme.io'), 'other');
});

// Summary
console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
