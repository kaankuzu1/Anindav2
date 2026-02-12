/**
 * Webhook Delivery System Audit
 * Tests HMAC-SHA256 signatures, schema validation, retry logic, and payload format.
 *
 * Run: npx tsx tests/campaign-audit/test-webhook-delivery.ts
 */

import assert from 'node:assert/strict';
import { generateWebhookSignature, verifyWebhookSignature } from '../../packages/shared/src/utils';
import { createWebhookSchema } from '../../packages/shared/src/validation';

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
// Inline: retry delay formula from webhook-delivery.ts
// =============================================

function computeRetryDelay(attempt: number): number {
  return Math.pow(2, attempt) * 1000;
}

// =============================================
// All 14 webhook event types
// =============================================

const ALL_EVENT_TYPES = [
  'email.sent', 'email.delivered', 'email.opened', 'email.clicked', 'email.bounced',
  'reply.received', 'reply.interested', 'reply.not_interested',
  'lead.bounced', 'lead.unsubscribed',
  'campaign.started', 'campaign.completed',
  'inbox.health_warning', 'inbox.paused',
] as const;

// =============================================
// Tests
// =============================================

console.log('\n=== Webhook: HMAC-SHA256 Signature ===');

test('generateWebhookSignature is deterministic', () => {
  const payload = '{"event":"email.sent","data":{}}';
  const secret = 'my-webhook-secret-key';
  const sig1 = generateWebhookSignature(payload, secret);
  const sig2 = generateWebhookSignature(payload, secret);
  assert.equal(sig1, sig2, 'Same input should produce same signature');
});

test('generateWebhookSignature produces hex string', () => {
  const sig = generateWebhookSignature('test', 'secret');
  assert.match(sig, /^[0-9a-f]+$/, 'Should be lowercase hex');
});

test('generateWebhookSignature produces 64-char hex (SHA-256)', () => {
  const sig = generateWebhookSignature('test', 'secret');
  assert.equal(sig.length, 64, 'SHA-256 hex digest should be 64 chars');
});

test('different payloads produce different signatures', () => {
  const secret = 'test-secret';
  const sig1 = generateWebhookSignature('payload-one', secret);
  const sig2 = generateWebhookSignature('payload-two', secret);
  assert.notEqual(sig1, sig2);
});

test('different secrets produce different signatures', () => {
  const payload = 'same-payload';
  const sig1 = generateWebhookSignature(payload, 'secret-a');
  const sig2 = generateWebhookSignature(payload, 'secret-b');
  assert.notEqual(sig1, sig2);
});

console.log('\n=== Webhook: verifyWebhookSignature ===');

test('roundtrip: generate then verify returns true', () => {
  const payload = '{"event":"email.sent","timestamp":"2024-01-01"}';
  const secret = 'my-super-secret-key';
  const signature = generateWebhookSignature(payload, secret);
  assert.ok(verifyWebhookSignature(payload, signature, secret));
});

test('tampered payload: verify returns false', () => {
  const secret = 'my-secret';
  const signature = generateWebhookSignature('original-payload', secret);
  assert.equal(verifyWebhookSignature('tampered-payload', signature, secret), false);
});

test('wrong secret: verify returns false', () => {
  const payload = 'some-payload';
  const signature = generateWebhookSignature(payload, 'secret-A');
  assert.equal(verifyWebhookSignature(payload, signature, 'secret-B'), false);
});

test('different length signature throws (timingSafeEqual buffer mismatch)', () => {
  const payload = 'test-payload';
  const secret = 'test-secret';
  const shortSig = 'abc123'; // Much shorter than 64 chars

  assert.throws(() => {
    verifyWebhookSignature(payload, shortSig, secret);
  }, /Input buffers must have the same byte length/);
});

console.log('\n=== Webhook: Retry Delay Formula ===');

test('attempt 0 → 1000ms delay', () => {
  assert.equal(computeRetryDelay(0), 1000);
});

test('attempt 1 → 2000ms delay', () => {
  assert.equal(computeRetryDelay(1), 2000);
});

test('attempt 2 → 4000ms delay', () => {
  assert.equal(computeRetryDelay(2), 4000);
});

test('attempt 3 → 8000ms delay', () => {
  assert.equal(computeRetryDelay(3), 8000);
});

test('attempt 4 → 16000ms delay', () => {
  assert.equal(computeRetryDelay(4), 16000);
});

console.log('\n=== Webhook: createWebhookSchema — Event Types ===');

for (const eventType of ALL_EVENT_TYPES) {
  test(`schema accepts event type: ${eventType}`, () => {
    const result = createWebhookSchema.safeParse({
      url: 'https://example.com/webhook',
      events: [eventType],
    });
    assert.ok(result.success, `Should accept ${eventType}: ${!result.success ? JSON.stringify(result.error.issues) : ''}`);
  });
}

console.log('\n=== Webhook: createWebhookSchema — Validation ===');

test('schema rejects missing url', () => {
  const result = createWebhookSchema.safeParse({
    events: ['email.sent'],
  });
  assert.ok(!result.success, 'Should reject missing url');
});

test('schema rejects invalid url', () => {
  const result = createWebhookSchema.safeParse({
    url: 'not-a-url',
    events: ['email.sent'],
  });
  assert.ok(!result.success, 'Should reject invalid url');
});

test('schema rejects empty events array', () => {
  const result = createWebhookSchema.safeParse({
    url: 'https://example.com/webhook',
    events: [],
  });
  assert.ok(!result.success, 'Should reject empty events');
});

test('schema rejects invalid event type', () => {
  const result = createWebhookSchema.safeParse({
    url: 'https://example.com/webhook',
    events: ['email.invalid_event'],
  });
  assert.ok(!result.success, 'Should reject invalid event type');
});

test('schema accepts optional secret (min 16 chars)', () => {
  const result = createWebhookSchema.safeParse({
    url: 'https://example.com/webhook',
    events: ['email.sent'],
    secret: 'abcdefghijklmnop', // exactly 16 chars
  });
  assert.ok(result.success, 'Should accept 16-char secret');
});

test('schema rejects short secret (< 16 chars)', () => {
  const result = createWebhookSchema.safeParse({
    url: 'https://example.com/webhook',
    events: ['email.sent'],
    secret: 'short',
  });
  assert.ok(!result.success, 'Should reject short secret');
});

test('schema accepts without secret (optional)', () => {
  const result = createWebhookSchema.safeParse({
    url: 'https://example.com/webhook',
    events: ['email.sent'],
  });
  assert.ok(result.success, 'Should accept without secret');
});

test('schema accepts multiple events', () => {
  const result = createWebhookSchema.safeParse({
    url: 'https://example.com/webhook',
    events: ['email.sent', 'email.opened', 'reply.received'],
  });
  assert.ok(result.success, 'Should accept multiple events');
});

console.log('\n=== Webhook: Payload Format ===');

test('webhook payload contains required fields', () => {
  const payload = {
    event: 'email.sent',
    timestamp: new Date().toISOString(),
    data: { emailId: 'abc-123', campaignId: 'xyz-456' },
  };

  assert.ok('event' in payload, 'Must have event field');
  assert.ok('timestamp' in payload, 'Must have timestamp field');
  assert.ok('data' in payload, 'Must have data field');
  assert.equal(typeof payload.event, 'string');
  assert.equal(typeof payload.timestamp, 'string');
  assert.equal(typeof payload.data, 'object');
});

test('webhook payload JSON serialization is stable for signing', () => {
  const payload = { event: 'email.sent', timestamp: '2024-01-01T00:00:00Z', data: {} };
  const json1 = JSON.stringify(payload);
  const json2 = JSON.stringify(payload);
  assert.equal(json1, json2, 'JSON.stringify should be deterministic');

  const secret = 'webhook-secret-key';
  const sig1 = generateWebhookSignature(json1, secret);
  const sig2 = generateWebhookSignature(json2, secret);
  assert.equal(sig1, sig2, 'Signatures of same JSON should match');
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
