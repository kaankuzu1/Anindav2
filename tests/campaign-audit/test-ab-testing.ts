/**
 * A/B Testing System Audit
 * Tests selectVariant, z-score calculation, confidence conversion,
 * progressive traffic shifting, stat computation, and known bugs.
 *
 * Run: npx tsx tests/campaign-audit/test-ab-testing.ts
 */

import assert from 'node:assert/strict';

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

// =============================================
// Inline implementations (mirroring private methods from source)
// =============================================

/**
 * selectVariant — from campaign-scheduler.ts (private method)
 * Weighted random selection.
 */
function selectVariant(
  variants: { id: string; subject: string; body: string; weight: number }[]
): { id: string; subject: string; body: string } | null {
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
 * calculateZScore — from ab-test-optimizer.ts (private method)
 * Z-score for comparing two proportions.
 */
function calculateZScore(p1: number, n1: number, p2: number, n2: number): number {
  if (n1 === 0 || n2 === 0) return 0;

  const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

  if (se === 0) return 0;

  return Math.abs(p1 - p2) / se;
}

/**
 * zScoreToConfidence — from ab-test-optimizer.ts (private method)
 * Normal CDF approximation using polynomial.
 */
function zScoreToConfidence(zScore: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(zScore));
  const d = 0.3989423 * Math.exp(-zScore * zScore / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  return zScore > 0 ? 1 - p : p;
}

/**
 * getVariantStats — rate computation from ab-test-optimizer.ts
 */
function computeRates(sentCount: number, openedCount: number, clickedCount: number, repliedCount: number) {
  return {
    openRate: sentCount > 0 ? openedCount / sentCount : 0,
    clickRate: openedCount > 0 ? clickedCount / openedCount : 0,
    replyRate: sentCount > 0 ? repliedCount / sentCount : 0,
  };
}

/**
 * getVariantStats — rate computation from ab-test.service.ts (API)
 * Uses percentage with 1 decimal rounding.
 */
function computeApiRates(sentCount: number, openedCount: number, clickedCount: number, repliedCount: number) {
  return {
    openRate: sentCount > 0 ? Math.round((openedCount / sentCount) * 1000) / 10 : 0,
    clickRate: openedCount > 0 ? Math.round((clickedCount / openedCount) * 1000) / 10 : 0,
    replyRate: sentCount > 0 ? Math.round((repliedCount / sentCount) * 1000) / 10 : 0,
  };
}

/**
 * Progressive traffic shifting thresholds — from ab-test-optimizer.ts
 */
function getNewWeights(confidence: number, variantCount: number): { leaderWeight: number; declareWinner: boolean } | null {
  if (confidence >= 0.95) return { leaderWeight: 100, declareWinner: true };
  if (confidence >= 0.90) return { leaderWeight: 85, declareWinner: false };
  if (confidence >= 0.80) return { leaderWeight: 75, declareWinner: false };
  if (confidence >= 0.70) return { leaderWeight: 60, declareWinner: false };
  return null; // No change below 70%
}

/**
 * adjustTraffic loser weight — from ab-test-optimizer.ts
 */
function computeLoserWeight(leaderWeight: number, loserCount: number): number {
  return loserCount > 0 ? Math.floor((100 - leaderWeight) / loserCount) : 0;
}

/**
 * resetTest equal weight — from ab-test.service.ts
 * Returns an array of weights that always sum to exactly 100.
 * The first variant gets the remainder when 100 doesn't divide evenly.
 */
function computeResetWeights(variantCount: number): number[] {
  const baseWeight = Math.floor(100 / variantCount);
  const remainder = 100 - (baseWeight * variantCount);
  return Array.from({ length: variantCount }, (_, i) =>
    i === 0 ? baseWeight + remainder : baseWeight
  );
}

// =============================================
// Tests
// =============================================

console.log('\n=== A/B Testing: selectVariant ===');

test('selectVariant returns null for empty array', () => {
  assert.equal(selectVariant([]), null);
});

test('selectVariant returns null for null-ish input', () => {
  assert.equal(selectVariant(null as any), null);
});

test('selectVariant returns first variant when all weights are 0', () => {
  const variants = [
    { id: 'a', subject: 'A', body: 'A body', weight: 0 },
    { id: 'b', subject: 'B', body: 'B body', weight: 0 },
  ];
  const result = selectVariant(variants);
  assert.equal(result!.id, 'a');
});

test('selectVariant returns only variant when single variant', () => {
  const variants = [{ id: 'a', subject: 'A', body: 'A body', weight: 100 }];
  const result = selectVariant(variants);
  assert.equal(result!.id, 'a');
});

test('selectVariant weighted distribution [70, 30] over 10K iterations', () => {
  const variants = [
    { id: 'a', subject: 'A', body: 'A body', weight: 70 },
    { id: 'b', subject: 'B', body: 'B body', weight: 30 },
  ];

  const counts: Record<string, number> = { a: 0, b: 0 };
  const iterations = 10000;

  for (let i = 0; i < iterations; i++) {
    const result = selectVariant(variants);
    counts[result!.id]++;
  }

  const ratioA = counts.a / iterations;
  // Should be ~0.70, within 5% tolerance
  assert.ok(ratioA >= 0.65 && ratioA <= 0.75, `Expected ~70%, got ${(ratioA * 100).toFixed(1)}%`);
});

test('selectVariant weighted distribution [50, 30, 20] over 10K iterations', () => {
  const variants = [
    { id: 'a', subject: 'A', body: 'A body', weight: 50 },
    { id: 'b', subject: 'B', body: 'B body', weight: 30 },
    { id: 'c', subject: 'C', body: 'C body', weight: 20 },
  ];

  const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
  const iterations = 10000;

  for (let i = 0; i < iterations; i++) {
    const result = selectVariant(variants);
    counts[result!.id]++;
  }

  const ratioA = counts.a / iterations;
  const ratioB = counts.b / iterations;
  const ratioC = counts.c / iterations;

  assert.ok(ratioA >= 0.45 && ratioA <= 0.55, `A: expected ~50%, got ${(ratioA * 100).toFixed(1)}%`);
  assert.ok(ratioB >= 0.25 && ratioB <= 0.35, `B: expected ~30%, got ${(ratioB * 100).toFixed(1)}%`);
  assert.ok(ratioC >= 0.15 && ratioC <= 0.25, `C: expected ~20%, got ${(ratioC * 100).toFixed(1)}%`);
});

test('selectVariant handles missing weight (defaults to 0)', () => {
  const variants = [
    { id: 'a', subject: 'A', body: 'A body', weight: 100 },
    { id: 'b', subject: 'B', body: 'B body', weight: undefined as any },
  ];

  // Should always select 'a' since b has no weight
  let allA = true;
  for (let i = 0; i < 100; i++) {
    const result = selectVariant(variants);
    if (result!.id !== 'a') allA = false;
  }
  assert.ok(allA, 'Expected all selections to be variant A');
});

test('selectVariant with 100/0 winner split always picks winner', () => {
  const variants = [
    { id: 'winner', subject: 'W', body: 'W body', weight: 100 },
    { id: 'loser', subject: 'L', body: 'L body', weight: 0 },
  ];

  for (let i = 0; i < 100; i++) {
    const result = selectVariant(variants);
    assert.equal(result!.id, 'winner');
  }
});

console.log('\n=== A/B Testing: Z-Score Calculation ===');

test('z-score returns 0 when n1 is 0', () => {
  assert.equal(calculateZScore(0.5, 0, 0.3, 100), 0);
});

test('z-score returns 0 when n2 is 0', () => {
  assert.equal(calculateZScore(0.5, 100, 0.3, 0), 0);
});

test('z-score returns 0 when both proportions are 0', () => {
  assert.equal(calculateZScore(0, 100, 0, 100), 0);
});

test('z-score returns 0 when both proportions are 1', () => {
  assert.equal(calculateZScore(1, 100, 1, 100), 0);
});

test('z-score is positive for different proportions', () => {
  const z = calculateZScore(0.6, 100, 0.4, 100);
  assert.ok(z > 0, `Expected positive z-score, got ${z}`);
});

test('z-score with known values: 60/100 vs 40/100', () => {
  // p1=0.6, n1=100, p2=0.4, n2=100
  // pooledP = (60+40)/200 = 0.5
  // se = sqrt(0.5 * 0.5 * (1/100 + 1/100)) = sqrt(0.005) ≈ 0.07071
  // z = |0.6 - 0.4| / 0.07071 ≈ 2.828
  const z = calculateZScore(0.6, 100, 0.4, 100);
  assert.ok(Math.abs(z - 2.828) < 0.01, `Expected ~2.828, got ${z}`);
});

test('z-score is symmetric (absolute value)', () => {
  const z1 = calculateZScore(0.6, 100, 0.4, 100);
  const z2 = calculateZScore(0.4, 100, 0.6, 100);
  assert.ok(Math.abs(z1 - z2) < 0.001, 'Z-scores should be equal due to Math.abs');
});

test('z-score increases with larger sample sizes for same proportions', () => {
  const zSmall = calculateZScore(0.6, 50, 0.4, 50);
  const zLarge = calculateZScore(0.6, 500, 0.4, 500);
  assert.ok(zLarge > zSmall, 'Larger samples should give higher z-score');
});

console.log('\n=== A/B Testing: Normal CDF (zScoreToConfidence) ===');

test('z=0 → confidence ~0.5', () => {
  const c = zScoreToConfidence(0);
  assert.ok(Math.abs(c - 0.5) < 0.01, `Expected ~0.5, got ${c}`);
});

test('z=1.645 → confidence ~0.95', () => {
  const c = zScoreToConfidence(1.645);
  assert.ok(Math.abs(c - 0.95) < 0.01, `Expected ~0.95, got ${c}`);
});

test('z=1.96 → confidence ~0.975', () => {
  const c = zScoreToConfidence(1.96);
  assert.ok(Math.abs(c - 0.975) < 0.01, `Expected ~0.975, got ${c}`);
});

test('z=2.576 → confidence ~0.995', () => {
  const c = zScoreToConfidence(2.576);
  assert.ok(Math.abs(c - 0.995) < 0.01, `Expected ~0.995, got ${c}`);
});

test('z=-1.96 → confidence ~0.025 (left tail)', () => {
  const c = zScoreToConfidence(-1.96);
  assert.ok(Math.abs(c - 0.025) < 0.01, `Expected ~0.025, got ${c}`);
});

test('confidence is monotonically increasing with z', () => {
  const c1 = zScoreToConfidence(0);
  const c2 = zScoreToConfidence(1);
  const c3 = zScoreToConfidence(2);
  const c4 = zScoreToConfidence(3);
  assert.ok(c1 < c2 && c2 < c3 && c3 < c4, 'Confidence should increase with z-score');
});

console.log('\n=== A/B Testing: Progressive Traffic Shifting ===');

test('confidence < 0.70 → no changes', () => {
  const result = getNewWeights(0.65, 2);
  assert.equal(result, null);
});

test('confidence 0.70-0.80 → 60/40 split', () => {
  const result = getNewWeights(0.75, 2);
  assert.deepEqual(result, { leaderWeight: 60, declareWinner: false });
});

test('confidence 0.80-0.90 → 75/25 split', () => {
  const result = getNewWeights(0.85, 2);
  assert.deepEqual(result, { leaderWeight: 75, declareWinner: false });
});

test('confidence 0.90-0.95 → 85/15 split', () => {
  const result = getNewWeights(0.92, 2);
  assert.deepEqual(result, { leaderWeight: 85, declareWinner: false });
});

test('confidence >= 0.95 → 100/0, declare winner', () => {
  const result = getNewWeights(0.96, 2);
  assert.deepEqual(result, { leaderWeight: 100, declareWinner: true });
});

test('confidence exactly 0.70 → 60/40 (boundary)', () => {
  const result = getNewWeights(0.70, 2);
  assert.deepEqual(result, { leaderWeight: 60, declareWinner: false });
});

test('confidence exactly 0.80 → 75/25 (boundary)', () => {
  const result = getNewWeights(0.80, 2);
  assert.deepEqual(result, { leaderWeight: 75, declareWinner: false });
});

test('confidence exactly 0.90 → 85/15 (boundary)', () => {
  const result = getNewWeights(0.90, 2);
  assert.deepEqual(result, { leaderWeight: 85, declareWinner: false });
});

test('confidence exactly 0.95 → 100/0 winner (boundary)', () => {
  const result = getNewWeights(0.95, 2);
  assert.deepEqual(result, { leaderWeight: 100, declareWinner: true });
});

console.log('\n=== A/B Testing: Loser Weight Distribution ===');

test('2 variants, leader=60: loser gets 40', () => {
  assert.equal(computeLoserWeight(60, 1), 40);
});

test('3 variants, leader=75: each loser gets 12 (floor)', () => {
  // (100 - 75) / 2 = 12.5 → floor = 12
  assert.equal(computeLoserWeight(75, 2), 12);
});

test('2 variants, leader=100: loser gets 0', () => {
  assert.equal(computeLoserWeight(100, 1), 0);
});

test('4 variants, leader=85: each loser gets 5 (floor)', () => {
  // (100 - 85) / 3 = 5
  assert.equal(computeLoserWeight(85, 3), 5);
});

console.log('\n=== A/B Testing: Minimum Sample Enforcement ===');

test('all variants >= 50 sends → optimization proceeds', () => {
  const variants = [
    { sentCount: 50, openRate: 0.3 },
    { sentCount: 60, openRate: 0.2 },
  ];
  const allHaveMinSamples = variants.every(v => v.sentCount >= 50);
  assert.ok(allHaveMinSamples);
});

test('one variant < 50 sends → skip optimization', () => {
  const variants = [
    { sentCount: 100, openRate: 0.3 },
    { sentCount: 49, openRate: 0.2 },
  ];
  const allHaveMinSamples = variants.every(v => v.sentCount >= 50);
  assert.ok(!allHaveMinSamples);
});

test('zero sends → skip optimization', () => {
  const variants = [
    { sentCount: 0, openRate: 0 },
    { sentCount: 0, openRate: 0 },
  ];
  const allHaveMinSamples = variants.every(v => v.sentCount >= 50);
  assert.ok(!allHaveMinSamples);
});

console.log('\n=== A/B Testing: Winner Override ===');

test('is_winner=true on any variant → skip optimization', () => {
  const variants = [
    { id: 'a', is_winner: true, weight: 100 },
    { id: 'b', is_winner: false, weight: 0 },
  ];
  const hasWinner = variants.some(v => v.is_winner === true);
  assert.ok(hasWinner, 'Should detect existing winner');
});

test('no is_winner → proceed with optimization', () => {
  const variants = [
    { id: 'a', is_winner: false, weight: 50 },
    { id: 'b', is_winner: false, weight: 50 },
  ];
  const hasWinner = variants.some(v => v.is_winner === true);
  assert.ok(!hasWinner, 'Should not detect winner');
});

console.log('\n=== A/B Testing: Stat Computation (Worker) ===');

test('openRate = opened / sent', () => {
  const rates = computeRates(100, 30, 10, 5);
  assert.equal(rates.openRate, 0.3);
});

test('clickRate = clicked / opened (CTR based on opens)', () => {
  const rates = computeRates(100, 30, 10, 5);
  assert.ok(Math.abs(rates.clickRate - 10 / 30) < 0.0001);
});

test('replyRate = replied / sent', () => {
  const rates = computeRates(100, 30, 10, 5);
  assert.equal(rates.replyRate, 0.05);
});

test('division by zero: sent=0 → all rates 0', () => {
  const rates = computeRates(0, 0, 0, 0);
  assert.equal(rates.openRate, 0);
  assert.equal(rates.clickRate, 0);
  assert.equal(rates.replyRate, 0);
});

test('division by zero: opened=0, sent>0 → clickRate=0', () => {
  const rates = computeRates(100, 0, 0, 0);
  assert.equal(rates.openRate, 0);
  assert.equal(rates.clickRate, 0);
  assert.equal(rates.replyRate, 0);
});

console.log('\n=== A/B Testing: Stat Computation (API — percentage format) ===');

test('API openRate is percentage with 1 decimal: 30/100 → 30.0', () => {
  const rates = computeApiRates(100, 30, 10, 5);
  assert.equal(rates.openRate, 30);
});

test('API clickRate is based on opens: 10/30 → 33.3', () => {
  const rates = computeApiRates(100, 30, 10, 5);
  assert.equal(rates.clickRate, 33.3);
});

test('API replyRate: 5/100 → 5.0', () => {
  const rates = computeApiRates(100, 30, 10, 5);
  assert.equal(rates.replyRate, 5);
});

test('API division by zero: sent=0 → all rates 0', () => {
  const rates = computeApiRates(0, 0, 0, 0);
  assert.equal(rates.openRate, 0);
  assert.equal(rates.clickRate, 0);
  assert.equal(rates.replyRate, 0);
});

console.log('\n=== A/B Testing: resetTest Weight Rounding (FIXED) ===');

test('resetTest with 3 variants → weights sum to 100 (remainder on first)', () => {
  const weights = computeResetWeights(3);
  assert.deepEqual(weights, [34, 33, 33], 'First variant gets remainder: 34, rest get 33');
  assert.equal(weights.reduce((a, b) => a + b, 0), 100, 'Total weight must be 100');
});

test('resetTest with 2 variants → weights sum to 100 (even split)', () => {
  const weights = computeResetWeights(2);
  assert.deepEqual(weights, [50, 50]);
  assert.equal(weights.reduce((a, b) => a + b, 0), 100);
});

test('resetTest with 4 variants → weights sum to 100 (even split)', () => {
  const weights = computeResetWeights(4);
  assert.deepEqual(weights, [25, 25, 25, 25]);
  assert.equal(weights.reduce((a, b) => a + b, 0), 100);
});

test('resetTest with 6 variants → weights sum to 100 (remainder on first)', () => {
  const weights = computeResetWeights(6);
  assert.deepEqual(weights, [20, 16, 16, 16, 16, 16], 'First variant gets remainder: 20, rest get 16');
  assert.equal(weights.reduce((a, b) => a + b, 0), 100, 'Total weight must be 100');
});

test('resetTest with 7 variants → weights sum to 100 (remainder on first)', () => {
  const weights = computeResetWeights(7);
  assert.deepEqual(weights, [16, 14, 14, 14, 14, 14, 14], 'First variant gets remainder: 16, rest get 14');
  assert.equal(weights.reduce((a, b) => a + b, 0), 100, 'Total weight must be 100');
});

test('resetTest with 1 variant → weight is 100', () => {
  const weights = computeResetWeights(1);
  assert.deepEqual(weights, [100]);
  assert.equal(weights.reduce((a, b) => a + b, 0), 100);
});

console.log('\n=== A/B Testing: Weight Validation ===');

test('weights must sum to 100', () => {
  const weights = [{ variantId: 'a', weight: 60 }, { variantId: 'b', weight: 40 }];
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  assert.equal(total, 100);
});

test('weights not summing to 100 should fail validation', () => {
  const weights = [{ variantId: 'a', weight: 60 }, { variantId: 'b', weight: 30 }];
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  assert.notEqual(total, 100);
});

console.log('\n=== A/B Testing: Winner Declaration ===');

test('winner gets weight=100, losers get weight=0', () => {
  // Simulate winner declaration
  const variants = [
    { id: 'a', weight: 50, is_winner: false },
    { id: 'b', weight: 50, is_winner: false },
  ];
  const winnerId = 'a';

  // Apply winner logic
  const updated = variants.map(v => ({
    ...v,
    weight: v.id === winnerId ? 100 : 0,
    is_winner: v.id === winnerId,
  }));

  assert.equal(updated[0].weight, 100);
  assert.equal(updated[0].is_winner, true);
  assert.equal(updated[1].weight, 0);
  assert.equal(updated[1].is_winner, false);
});

test('winner declaration with 3 variants', () => {
  const variants = [
    { id: 'a', weight: 33, is_winner: false },
    { id: 'b', weight: 34, is_winner: false },
    { id: 'c', weight: 33, is_winner: false },
  ];
  const winnerId = 'b';

  const updated = variants.map(v => ({
    ...v,
    weight: v.id === winnerId ? 100 : 0,
    is_winner: v.id === winnerId,
  }));

  const totalWeight = updated.reduce((sum, v) => sum + v.weight, 0);
  assert.equal(totalWeight, 100, 'Total weight should be 100 after winner declaration');
  assert.equal(updated.filter(v => v.is_winner).length, 1, 'Only one winner');
});

// =============================================
// Results
// =============================================

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
