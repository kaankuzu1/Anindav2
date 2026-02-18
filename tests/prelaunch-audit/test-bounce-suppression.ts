/**
 * Pre-Launch Audit — Suite 9: Bounce Processor & Suppression Tests
 *
 * Tests bounce type classification, effective bounce type (Bug #1 regression),
 * soft bounce retry logic, suppression list, bounce rate thresholds,
 * complaint handling, and lead state transitions on bounce.
 *
 * ~160 tests covering:
 *   - Bounce type classification (~30)
 *   - Effective bounce type / Bug #1 regression (~25)
 *   - Soft bounce retry logic (~30)
 *   - Suppression list (~25)
 *   - Bounce rate threshold (~20)
 *   - Complaint handling (~15)
 *   - Lead state transitions on bounce (~15)
 */

import assert from 'node:assert/strict';

let passed = 0, failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (err: any) { failed++; const msg = err.message || String(err); failures.push(`${name}: ${msg}`); console.log(`  FAIL: ${name}\n        ${msg}`); }
}

// ============================================
// Reconstruct pure functions from source
// ============================================

// --- From packages/shared/src/lead-state-machine.ts ---

type LeadStatus =
  | 'pending' | 'in_sequence' | 'contacted' | 'replied'
  | 'interested' | 'not_interested' | 'meeting_booked'
  | 'bounced' | 'soft_bounced' | 'unsubscribed'
  | 'spam_reported' | 'sequence_complete';

type LeadEvent =
  | 'EMAIL_SENT' | 'EMAIL_OPENED' | 'EMAIL_CLICKED'
  | 'EMAIL_BOUNCED' | 'SOFT_BOUNCE' | 'REPLY_RECEIVED'
  | 'REPLY_INTERESTED' | 'REPLY_NOT_INTERESTED'
  | 'UNSUBSCRIBE' | 'SPAM_REPORT' | 'MEETING_BOOKED'
  | 'SEQUENCE_COMPLETE' | 'MANUAL_OVERRIDE';

interface StateTransition {
  from: LeadStatus[];
  to: LeadStatus;
  event: LeadEvent;
}

const VALID_TRANSITIONS: StateTransition[] = [
  { from: ['pending'], to: 'in_sequence', event: 'EMAIL_SENT' },
  { from: ['in_sequence'], to: 'contacted', event: 'EMAIL_SENT' },
  { from: ['contacted'], to: 'contacted', event: 'EMAIL_SENT' },
  { from: ['pending', 'in_sequence', 'contacted'], to: 'soft_bounced', event: 'SOFT_BOUNCE' },
  { from: ['pending', 'in_sequence', 'contacted', 'soft_bounced'], to: 'bounced', event: 'EMAIL_BOUNCED' },
  { from: ['in_sequence', 'contacted'], to: 'replied', event: 'REPLY_RECEIVED' },
  { from: ['replied'], to: 'interested', event: 'REPLY_INTERESTED' },
  { from: ['replied'], to: 'not_interested', event: 'REPLY_NOT_INTERESTED' },
  { from: ['in_sequence', 'contacted'], to: 'interested', event: 'REPLY_INTERESTED' },
  { from: ['in_sequence', 'contacted'], to: 'not_interested', event: 'REPLY_NOT_INTERESTED' },
  { from: ['replied', 'interested'], to: 'meeting_booked', event: 'MEETING_BOOKED' },
  { from: ['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested'], to: 'unsubscribed', event: 'UNSUBSCRIBE' },
  { from: ['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested'], to: 'spam_reported', event: 'SPAM_REPORT' },
  { from: ['in_sequence', 'contacted'], to: 'sequence_complete', event: 'SEQUENCE_COMPLETE' },
  // MANUAL_OVERRIDE transitions (all statuses → all non-terminal targets)
  ...(['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested', 'meeting_booked', 'bounced', 'soft_bounced', 'unsubscribed', 'spam_reported', 'sequence_complete'] as LeadStatus[]).flatMap(from =>
    (['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested', 'meeting_booked'] as LeadStatus[]).map(to => ({
      from: [from],
      to,
      event: 'MANUAL_OVERRIDE' as LeadEvent,
    }))
  ),
];

const TERMINAL_STATES: LeadStatus[] = ['bounced', 'unsubscribed', 'spam_reported'];

function canTransition(currentStatus: LeadStatus, event: LeadEvent): LeadStatus | null {
  if (TERMINAL_STATES.includes(currentStatus) && event !== 'MANUAL_OVERRIDE') {
    return null;
  }
  const transition = VALID_TRANSITIONS.find(
    t => t.from.includes(currentStatus) && t.event === event
  );
  return transition?.to ?? null;
}

function isTerminalState(status: LeadStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

function blocksSequence(status: LeadStatus): boolean {
  return ['bounced', 'unsubscribed', 'spam_reported', 'replied', 'interested', 'not_interested', 'meeting_booked'].includes(status);
}

// --- From packages/shared/src/lead-state-machine.ts: bounceTypeToEvent ---

type BounceType = 'hard' | 'soft' | 'complaint';

function bounceTypeToEvent(bounceType: BounceType): LeadEvent {
  if (bounceType === 'soft') return 'SOFT_BOUNCE';
  if (bounceType === 'complaint') return 'SPAM_REPORT';
  return 'EMAIL_BOUNCED';
}

// --- From apps/workers/src/bounce-processor.ts: constants ---

const BOUNCE_RATE_THRESHOLD = 0.03;
const MIN_EMAILS_FOR_RATE = 50;
const MAX_SOFT_BOUNCE_RETRIES = 3;
const SOFT_BOUNCE_RETRY_DELAYS = [
  1 * 60 * 60 * 1000,   // 1 hour
  4 * 60 * 60 * 1000,   // 4 hours
  24 * 60 * 60 * 1000,  // 24 hours
];

// --- Reconstruct bounce processor pure logic ---

interface BounceProcessResult {
  effectiveBounceType: BounceType;
  action: 'retry' | 'bounce';
  retryDelay?: number;
  retryCount?: number;
  addToSuppression: boolean;
  suppressionReason?: string;
  bounceEvent: LeadEvent;
  emailStatusUpdate: string;
  bounceReasonSuffix?: string;
}

function processBounce(
  bounceType: BounceType,
  currentRetryCount: number,
  bounceReason: string
): BounceProcessResult {
  // Soft bounce with retries remaining
  if (bounceType === 'soft' && currentRetryCount < MAX_SOFT_BOUNCE_RETRIES) {
    const retryDelay = SOFT_BOUNCE_RETRY_DELAYS[currentRetryCount] ?? SOFT_BOUNCE_RETRY_DELAYS[SOFT_BOUNCE_RETRY_DELAYS.length - 1];
    return {
      effectiveBounceType: 'soft',
      action: 'retry',
      retryDelay,
      retryCount: currentRetryCount + 1,
      addToSuppression: false,
      bounceEvent: bounceTypeToEvent('soft'),
      emailStatusUpdate: 'retry_pending',
    };
  }

  // Hard bounce or max retries exceeded
  const isMaxRetriesExceeded = bounceType === 'soft' && currentRetryCount >= MAX_SOFT_BOUNCE_RETRIES;
  const effectiveBounceType: BounceType = isMaxRetriesExceeded ? 'hard' : bounceType;

  const addToSuppression = effectiveBounceType === 'hard' || bounceType === 'complaint';
  let suppressionReason: string | undefined;
  if (effectiveBounceType === 'hard') suppressionReason = 'hard_bounce';
  if (bounceType === 'complaint') suppressionReason = 'spam_complaint';

  return {
    effectiveBounceType,
    action: 'bounce',
    addToSuppression,
    suppressionReason,
    bounceEvent: bounceTypeToEvent(effectiveBounceType),
    emailStatusUpdate: 'bounced',
    bounceReasonSuffix: isMaxRetriesExceeded ? ' (max retries exceeded)' : undefined,
  };
}

// Suppression list logic (from addToSuppressionList)
function normalizeEmailForSuppression(email: string): string {
  return email.toLowerCase();
}

// Bounce rate calculation (from checkInboxHealth)
function calculateBounceRate(bounceCount: number, sentTotal: number): number {
  if (sentTotal === 0) return 0;
  return bounceCount / sentTotal;
}

function shouldAutoPauseInbox(bounceCount: number, sentTotal: number): boolean {
  if (sentTotal < MIN_EMAILS_FOR_RATE) return false;
  const rate = calculateBounceRate(bounceCount, sentTotal);
  return rate > BOUNCE_RATE_THRESHOLD;
}

// ============================================
// Tests
// ============================================

console.log('\n=== Suite 9: Bounce Processor & Suppression Tests ===\n');

// ============================================
// 1. Bounce Type Classification (~30 tests)
// ============================================

console.log('\n--- Bounce Type Classification ---');

test('hard bounce → EMAIL_BOUNCED event', () => {
  assert.equal(bounceTypeToEvent('hard'), 'EMAIL_BOUNCED');
});

test('soft bounce → SOFT_BOUNCE event', () => {
  assert.equal(bounceTypeToEvent('soft'), 'SOFT_BOUNCE');
});

test('complaint → SPAM_REPORT event', () => {
  assert.equal(bounceTypeToEvent('complaint'), 'SPAM_REPORT');
});

test('bounceTypeToEvent returns string for hard', () => {
  assert.equal(typeof bounceTypeToEvent('hard'), 'string');
});

test('bounceTypeToEvent returns string for soft', () => {
  assert.equal(typeof bounceTypeToEvent('soft'), 'string');
});

test('bounceTypeToEvent returns string for complaint', () => {
  assert.equal(typeof bounceTypeToEvent('complaint'), 'string');
});

test('hard bounce event is not SOFT_BOUNCE', () => {
  assert.notEqual(bounceTypeToEvent('hard'), 'SOFT_BOUNCE');
});

test('hard bounce event is not SPAM_REPORT', () => {
  assert.notEqual(bounceTypeToEvent('hard'), 'SPAM_REPORT');
});

test('soft bounce event is not EMAIL_BOUNCED', () => {
  assert.notEqual(bounceTypeToEvent('soft'), 'EMAIL_BOUNCED');
});

test('soft bounce event is not SPAM_REPORT', () => {
  assert.notEqual(bounceTypeToEvent('soft'), 'SPAM_REPORT');
});

test('complaint event is not EMAIL_BOUNCED', () => {
  assert.notEqual(bounceTypeToEvent('complaint'), 'EMAIL_BOUNCED');
});

test('complaint event is not SOFT_BOUNCE', () => {
  assert.notEqual(bounceTypeToEvent('complaint'), 'SOFT_BOUNCE');
});

test('all three bounce types produce distinct events', () => {
  const hardEvt = bounceTypeToEvent('hard');
  const softEvt = bounceTypeToEvent('soft');
  const complaintEvt = bounceTypeToEvent('complaint');
  assert.notEqual(hardEvt, softEvt);
  assert.notEqual(hardEvt, complaintEvt);
  assert.notEqual(softEvt, complaintEvt);
});

test('bounceTypeToEvent hard result is a valid LeadEvent', () => {
  const validEvents: LeadEvent[] = ['EMAIL_SENT', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_BOUNCED', 'SOFT_BOUNCE', 'REPLY_RECEIVED', 'REPLY_INTERESTED', 'REPLY_NOT_INTERESTED', 'UNSUBSCRIBE', 'SPAM_REPORT', 'MEETING_BOOKED', 'SEQUENCE_COMPLETE', 'MANUAL_OVERRIDE'];
  assert.ok(validEvents.includes(bounceTypeToEvent('hard')));
});

test('bounceTypeToEvent soft result is a valid LeadEvent', () => {
  const validEvents: LeadEvent[] = ['EMAIL_SENT', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_BOUNCED', 'SOFT_BOUNCE', 'REPLY_RECEIVED', 'REPLY_INTERESTED', 'REPLY_NOT_INTERESTED', 'UNSUBSCRIBE', 'SPAM_REPORT', 'MEETING_BOOKED', 'SEQUENCE_COMPLETE', 'MANUAL_OVERRIDE'];
  assert.ok(validEvents.includes(bounceTypeToEvent('soft')));
});

test('bounceTypeToEvent complaint result is a valid LeadEvent', () => {
  const validEvents: LeadEvent[] = ['EMAIL_SENT', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_BOUNCED', 'SOFT_BOUNCE', 'REPLY_RECEIVED', 'REPLY_INTERESTED', 'REPLY_NOT_INTERESTED', 'UNSUBSCRIBE', 'SPAM_REPORT', 'MEETING_BOOKED', 'SEQUENCE_COMPLETE', 'MANUAL_OVERRIDE'];
  assert.ok(validEvents.includes(bounceTypeToEvent('complaint')));
});

test('BounceType "hard" is a valid BounceType', () => {
  const valid: BounceType[] = ['hard', 'soft', 'complaint'];
  assert.ok(valid.includes('hard'));
});

test('BounceType "soft" is a valid BounceType', () => {
  const valid: BounceType[] = ['hard', 'soft', 'complaint'];
  assert.ok(valid.includes('soft'));
});

test('BounceType "complaint" is a valid BounceType', () => {
  const valid: BounceType[] = ['hard', 'soft', 'complaint'];
  assert.ok(valid.includes('complaint'));
});

test('processBounce with hard type returns action "bounce"', () => {
  const result = processBounce('hard', 0, 'user unknown');
  assert.equal(result.action, 'bounce');
});

test('processBounce with complaint type returns action "bounce"', () => {
  const result = processBounce('complaint', 0, 'spam reported');
  assert.equal(result.action, 'bounce');
});

test('processBounce hard sets emailStatusUpdate to bounced', () => {
  const result = processBounce('hard', 0, 'user unknown');
  assert.equal(result.emailStatusUpdate, 'bounced');
});

test('processBounce complaint sets emailStatusUpdate to bounced', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.emailStatusUpdate, 'bounced');
});

test('processBounce hard effectiveBounceType is hard', () => {
  const result = processBounce('hard', 0, 'user unknown');
  assert.equal(result.effectiveBounceType, 'hard');
});

test('processBounce complaint effectiveBounceType is complaint', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.effectiveBounceType, 'complaint');
});

test('hard bounce event maps to EMAIL_BOUNCED for state transitions', () => {
  const result = processBounce('hard', 0, 'unknown');
  assert.equal(result.bounceEvent, 'EMAIL_BOUNCED');
});

test('complaint bounceEvent maps to SPAM_REPORT for state transitions', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.bounceEvent, 'SPAM_REPORT');
});

test('soft bounce first attempt bounceEvent maps to SOFT_BOUNCE', () => {
  const result = processBounce('soft', 0, 'mailbox full');
  assert.equal(result.bounceEvent, 'SOFT_BOUNCE');
});

test('hard bounce has no bounceReasonSuffix', () => {
  const result = processBounce('hard', 0, 'user unknown');
  assert.equal(result.bounceReasonSuffix, undefined);
});

test('complaint has no bounceReasonSuffix', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.bounceReasonSuffix, undefined);
});

// ============================================
// 2. Effective Bounce Type (Bug #1 Regression) (~25 tests)
// ============================================

console.log('\n--- Effective Bounce Type (Bug #1 Regression) ---');

test('direct hard bounce → effectiveBounceType = hard', () => {
  const result = processBounce('hard', 0, 'user unknown');
  assert.equal(result.effectiveBounceType, 'hard');
});

test('soft bounce first attempt → effectiveBounceType = soft', () => {
  const result = processBounce('soft', 0, 'mailbox full');
  assert.equal(result.effectiveBounceType, 'soft');
});

test('soft bounce second attempt → effectiveBounceType = soft', () => {
  const result = processBounce('soft', 1, 'mailbox full');
  assert.equal(result.effectiveBounceType, 'soft');
});

test('soft bounce third attempt → effectiveBounceType = soft', () => {
  const result = processBounce('soft', 2, 'mailbox full');
  assert.equal(result.effectiveBounceType, 'soft');
});

test('soft bounce fourth attempt (exhausted retries) → effectiveBounceType = hard', () => {
  const result = processBounce('soft', 3, 'mailbox full');
  assert.equal(result.effectiveBounceType, 'hard');
});

test('soft bounce with count=4 (above max) → effectiveBounceType = hard', () => {
  const result = processBounce('soft', 4, 'mailbox full');
  assert.equal(result.effectiveBounceType, 'hard');
});

test('soft bounce with count=100 → effectiveBounceType = hard', () => {
  const result = processBounce('soft', 100, 'mailbox full');
  assert.equal(result.effectiveBounceType, 'hard');
});

test('MAX_SOFT_BOUNCE_RETRIES is 3', () => {
  assert.equal(MAX_SOFT_BOUNCE_RETRIES, 3);
});

test('Bug #1 fix: suppression uses effectiveBounceType, not bounceType', () => {
  // Soft bounce that exhausted retries → addToSuppression should be true
  const result = processBounce('soft', 3, 'mailbox full');
  assert.equal(result.addToSuppression, true, 'soft bounce exhausting retries must trigger suppression');
});

test('Bug #1 fix: soft bounce at retry count 2 → no suppression yet', () => {
  const result = processBounce('soft', 2, 'mailbox full');
  assert.equal(result.addToSuppression, false);
});

test('Bug #1 fix: soft bounce at retry count 0 → no suppression', () => {
  const result = processBounce('soft', 0, 'mailbox full');
  assert.equal(result.addToSuppression, false);
});

test('Bug #1 fix: soft bounce at retry count 1 → no suppression', () => {
  const result = processBounce('soft', 1, 'mailbox full');
  assert.equal(result.addToSuppression, false);
});

test('direct hard bounce → suppression triggered', () => {
  const result = processBounce('hard', 0, 'user unknown');
  assert.equal(result.addToSuppression, true);
});

test('complaint → suppression triggered', () => {
  const result = processBounce('complaint', 0, 'spam report');
  assert.equal(result.addToSuppression, true);
});

test('soft bounce exhausting retries → suppressionReason is hard_bounce', () => {
  const result = processBounce('soft', 3, 'mailbox full');
  assert.equal(result.suppressionReason, 'hard_bounce');
});

test('direct hard bounce → suppressionReason is hard_bounce', () => {
  const result = processBounce('hard', 0, 'user unknown');
  assert.equal(result.suppressionReason, 'hard_bounce');
});

test('complaint → suppressionReason is spam_complaint', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.suppressionReason, 'spam_complaint');
});

test('soft bounce exhausting retries appends "(max retries exceeded)" to reason', () => {
  const result = processBounce('soft', 3, 'mailbox full');
  assert.equal(result.bounceReasonSuffix, ' (max retries exceeded)');
});

test('soft bounce with retries left has no bounceReasonSuffix', () => {
  const result = processBounce('soft', 1, 'mailbox full');
  assert.equal(result.bounceReasonSuffix, undefined);
});

test('exhausted soft bounce bounceEvent is EMAIL_BOUNCED (not SOFT_BOUNCE)', () => {
  const result = processBounce('soft', 3, 'mailbox full');
  assert.equal(result.bounceEvent, 'EMAIL_BOUNCED');
});

test('exhausted soft bounce sets emailStatusUpdate to bounced', () => {
  const result = processBounce('soft', 3, 'mailbox full');
  assert.equal(result.emailStatusUpdate, 'bounced');
});

test('boundary: soft bounce at exactly MAX_SOFT_BOUNCE_RETRIES (3) → hard', () => {
  const result = processBounce('soft', MAX_SOFT_BOUNCE_RETRIES, 'temporary');
  assert.equal(result.effectiveBounceType, 'hard');
  assert.equal(result.action, 'bounce');
});

test('boundary: soft bounce at MAX_SOFT_BOUNCE_RETRIES-1 (2) → still soft/retry', () => {
  const result = processBounce('soft', MAX_SOFT_BOUNCE_RETRIES - 1, 'temporary');
  assert.equal(result.effectiveBounceType, 'soft');
  assert.equal(result.action, 'retry');
});

test('hard bounce with non-zero retryCount is still hard', () => {
  const result = processBounce('hard', 5, 'permanent failure');
  assert.equal(result.effectiveBounceType, 'hard');
  assert.equal(result.action, 'bounce');
});

test('complaint with non-zero retryCount is still complaint', () => {
  const result = processBounce('complaint', 2, 'spam');
  assert.equal(result.effectiveBounceType, 'complaint');
  assert.equal(result.action, 'bounce');
});

// ============================================
// 3. Soft Bounce Retry Logic (~30 tests)
// ============================================

console.log('\n--- Soft Bounce Retry Logic ---');

test('first soft bounce → action is retry', () => {
  const result = processBounce('soft', 0, 'mailbox full');
  assert.equal(result.action, 'retry');
});

test('second soft bounce → action is retry', () => {
  const result = processBounce('soft', 1, 'mailbox full');
  assert.equal(result.action, 'retry');
});

test('third soft bounce → action is retry', () => {
  const result = processBounce('soft', 2, 'mailbox full');
  assert.equal(result.action, 'retry');
});

test('fourth soft bounce → action is bounce (retries exhausted)', () => {
  const result = processBounce('soft', 3, 'mailbox full');
  assert.equal(result.action, 'bounce');
});

test('first retry delay is 1 hour (3600000ms)', () => {
  const result = processBounce('soft', 0, 'mailbox full');
  assert.equal(result.retryDelay, 1 * 60 * 60 * 1000);
});

test('second retry delay is 4 hours (14400000ms)', () => {
  const result = processBounce('soft', 1, 'mailbox full');
  assert.equal(result.retryDelay, 4 * 60 * 60 * 1000);
});

test('third retry delay is 24 hours (86400000ms)', () => {
  const result = processBounce('soft', 2, 'mailbox full');
  assert.equal(result.retryDelay, 24 * 60 * 60 * 1000);
});

test('SOFT_BOUNCE_RETRY_DELAYS has exactly 3 entries', () => {
  assert.equal(SOFT_BOUNCE_RETRY_DELAYS.length, 3);
});

test('retry delays are in ascending order', () => {
  for (let i = 1; i < SOFT_BOUNCE_RETRY_DELAYS.length; i++) {
    assert.ok(SOFT_BOUNCE_RETRY_DELAYS[i] > SOFT_BOUNCE_RETRY_DELAYS[i - 1]);
  }
});

test('first retry delay in minutes = 60', () => {
  assert.equal(SOFT_BOUNCE_RETRY_DELAYS[0] / 1000 / 60, 60);
});

test('second retry delay in minutes = 240', () => {
  assert.equal(SOFT_BOUNCE_RETRY_DELAYS[1] / 1000 / 60, 240);
});

test('third retry delay in minutes = 1440', () => {
  assert.equal(SOFT_BOUNCE_RETRY_DELAYS[2] / 1000 / 60, 1440);
});

test('retry sets emailStatusUpdate to retry_pending', () => {
  const result = processBounce('soft', 0, 'mailbox full');
  assert.equal(result.emailStatusUpdate, 'retry_pending');
});

test('retry increments retryCount from 0 → 1', () => {
  const result = processBounce('soft', 0, 'mailbox full');
  assert.equal(result.retryCount, 1);
});

test('retry increments retryCount from 1 → 2', () => {
  const result = processBounce('soft', 1, 'mailbox full');
  assert.equal(result.retryCount, 2);
});

test('retry increments retryCount from 2 → 3', () => {
  const result = processBounce('soft', 2, 'mailbox full');
  assert.equal(result.retryCount, 3);
});

test('retry does NOT add to suppression list', () => {
  const result = processBounce('soft', 0, 'temporary');
  assert.equal(result.addToSuppression, false);
});

test('retry has no suppressionReason', () => {
  const result = processBounce('soft', 0, 'temporary');
  assert.equal(result.suppressionReason, undefined);
});

test('soft bounce retry has no bounceReasonSuffix', () => {
  const result = processBounce('soft', 0, 'temp');
  assert.equal(result.bounceReasonSuffix, undefined);
});

test('soft bounce retries: full lifecycle count=0 → retry', () => {
  assert.equal(processBounce('soft', 0, 'err').action, 'retry');
});

test('soft bounce retries: full lifecycle count=1 → retry', () => {
  assert.equal(processBounce('soft', 1, 'err').action, 'retry');
});

test('soft bounce retries: full lifecycle count=2 → retry', () => {
  assert.equal(processBounce('soft', 2, 'err').action, 'retry');
});

test('soft bounce retries: full lifecycle count=3 → bounce', () => {
  assert.equal(processBounce('soft', 3, 'err').action, 'bounce');
});

test('total retry delays sum = 29 hours in ms', () => {
  const total = SOFT_BOUNCE_RETRY_DELAYS.reduce((a, b) => a + b, 0);
  assert.equal(total, (1 + 4 + 24) * 60 * 60 * 1000);
});

test('hard bounce at retryCount=0 skips retry logic entirely', () => {
  const result = processBounce('hard', 0, 'permanent');
  assert.equal(result.action, 'bounce');
  assert.equal(result.retryDelay, undefined);
  assert.equal(result.retryCount, undefined);
});

test('complaint at retryCount=0 skips retry logic entirely', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.action, 'bounce');
  assert.equal(result.retryDelay, undefined);
  assert.equal(result.retryCount, undefined);
});

test('soft bounce retry delay index clamping: out-of-bounds uses last delay', () => {
  // If somehow currentRetryCount is beyond array length, use last element
  // In real code, this can't happen because count >= 3 triggers bounce path
  // but let's verify the fallback pattern
  const delays = SOFT_BOUNCE_RETRY_DELAYS;
  const fallback = delays[5] ?? delays[delays.length - 1];
  assert.equal(fallback, 24 * 60 * 60 * 1000);
});

test('soft bounce retry preserves bounce reason', () => {
  const result = processBounce('soft', 0, 'mailbox full');
  // The function doesn't modify bounceReason for retries (no suffix)
  assert.equal(result.bounceReasonSuffix, undefined);
});

test('exhausted soft bounce gets "(max retries exceeded)" suffix', () => {
  const result = processBounce('soft', 3, 'mailbox full');
  assert.ok(result.bounceReasonSuffix?.includes('max retries exceeded'));
});

test('retryCount is undefined when action is bounce (hard)', () => {
  const result = processBounce('hard', 0, 'permanent');
  assert.equal(result.retryCount, undefined);
});

// ============================================
// 4. Suppression List (~25 tests)
// ============================================

console.log('\n--- Suppression List ---');

test('hard bounce triggers suppression', () => {
  const result = processBounce('hard', 0, 'user unknown');
  assert.equal(result.addToSuppression, true);
});

test('soft bounce exhausting retries triggers suppression', () => {
  const result = processBounce('soft', 3, 'mailbox full');
  assert.equal(result.addToSuppression, true);
});

test('complaint triggers suppression', () => {
  const result = processBounce('complaint', 0, 'spam report');
  assert.equal(result.addToSuppression, true);
});

test('soft bounce with retries remaining does NOT trigger suppression', () => {
  const result = processBounce('soft', 0, 'temp error');
  assert.equal(result.addToSuppression, false);
});

test('soft bounce count=1 does NOT trigger suppression', () => {
  const result = processBounce('soft', 1, 'temp error');
  assert.equal(result.addToSuppression, false);
});

test('soft bounce count=2 does NOT trigger suppression', () => {
  const result = processBounce('soft', 2, 'temp error');
  assert.equal(result.addToSuppression, false);
});

test('email normalization: uppercase → lowercase', () => {
  assert.equal(normalizeEmailForSuppression('John@Example.COM'), 'john@example.com');
});

test('email normalization: mixed case → lowercase', () => {
  assert.equal(normalizeEmailForSuppression('JoHn.DoE@Gmail.Com'), 'john.doe@gmail.com');
});

test('email normalization: already lowercase → unchanged', () => {
  assert.equal(normalizeEmailForSuppression('test@example.com'), 'test@example.com');
});

test('email normalization: all uppercase → lowercase', () => {
  assert.equal(normalizeEmailForSuppression('TEST@EXAMPLE.COM'), 'test@example.com');
});

test('suppression matching is case-insensitive via normalization', () => {
  const email1 = normalizeEmailForSuppression('John@Example.com');
  const email2 = normalizeEmailForSuppression('john@example.com');
  assert.equal(email1, email2);
});

test('hard bounce suppressionReason = hard_bounce', () => {
  const result = processBounce('hard', 0, 'permanent');
  assert.equal(result.suppressionReason, 'hard_bounce');
});

test('exhausted soft bounce suppressionReason = hard_bounce', () => {
  const result = processBounce('soft', 3, 'temp');
  assert.equal(result.suppressionReason, 'hard_bounce');
});

test('complaint suppressionReason = spam_complaint', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.suppressionReason, 'spam_complaint');
});

test('retry has no suppressionReason', () => {
  const result = processBounce('soft', 0, 'temp');
  assert.equal(result.suppressionReason, undefined);
});

test('normalizeEmailForSuppression preserves special characters in local part', () => {
  assert.equal(normalizeEmailForSuppression('USER+tag@EXAMPLE.com'), 'user+tag@example.com');
});

test('normalizeEmailForSuppression preserves dots in local part', () => {
  assert.equal(normalizeEmailForSuppression('First.Last@Domain.COM'), 'first.last@domain.com');
});

test('normalizeEmailForSuppression preserves hyphens in domain', () => {
  assert.equal(normalizeEmailForSuppression('User@My-Domain.COM'), 'user@my-domain.com');
});

test('hard bounce with any retryCount still suppresses', () => {
  const result = processBounce('hard', 10, 'permanent');
  assert.equal(result.addToSuppression, true);
});

test('complaint with any retryCount still suppresses', () => {
  const result = processBounce('complaint', 5, 'spam');
  assert.equal(result.addToSuppression, true);
});

test('both hard bounce and complaint can independently trigger suppression', () => {
  const hard = processBounce('hard', 0, 'permanent');
  const complaint = processBounce('complaint', 0, 'spam');
  assert.equal(hard.addToSuppression, true);
  assert.equal(complaint.addToSuppression, true);
  // But for different reasons
  assert.notEqual(hard.suppressionReason, complaint.suppressionReason);
});

test('normalizeEmailForSuppression handles empty string', () => {
  assert.equal(normalizeEmailForSuppression(''), '');
});

test('normalizeEmailForSuppression handles numeric local part', () => {
  assert.equal(normalizeEmailForSuppression('12345@test.com'), '12345@test.com');
});

test('suppression: soft bounce count exactly at MAX converts to hard', () => {
  const result = processBounce('soft', MAX_SOFT_BOUNCE_RETRIES, 'mailbox full');
  assert.equal(result.addToSuppression, true);
  assert.equal(result.suppressionReason, 'hard_bounce');
});

test('suppression: soft bounce count above MAX converts to hard', () => {
  const result = processBounce('soft', MAX_SOFT_BOUNCE_RETRIES + 5, 'mailbox full');
  assert.equal(result.addToSuppression, true);
  assert.equal(result.suppressionReason, 'hard_bounce');
});

// ============================================
// 5. Bounce Rate Threshold (~20 tests)
// ============================================

console.log('\n--- Bounce Rate Threshold ---');

test('BOUNCE_RATE_THRESHOLD is 0.03 (3%)', () => {
  assert.equal(BOUNCE_RATE_THRESHOLD, 0.03);
});

test('MIN_EMAILS_FOR_RATE is 50', () => {
  assert.equal(MIN_EMAILS_FOR_RATE, 50);
});

test('0 bounces out of 100 → 0% rate', () => {
  assert.equal(calculateBounceRate(0, 100), 0);
});

test('1 bounce out of 100 → 1% rate', () => {
  assert.equal(calculateBounceRate(1, 100), 0.01);
});

test('3 bounces out of 100 → 3% rate', () => {
  assert.equal(calculateBounceRate(3, 100), 0.03);
});

test('4 bounces out of 100 → 4% rate', () => {
  assert.equal(calculateBounceRate(4, 100), 0.04);
});

test('50 bounces out of 100 → 50% rate', () => {
  assert.equal(calculateBounceRate(50, 100), 0.5);
});

test('0 total sent → 0 rate (no division by zero)', () => {
  assert.equal(calculateBounceRate(0, 0), 0);
});

test('bounces with 0 total sent → 0 rate (safe)', () => {
  assert.equal(calculateBounceRate(5, 0), 0);
});

test('shouldAutoPauseInbox: 0/100 → no pause', () => {
  assert.equal(shouldAutoPauseInbox(0, 100), false);
});

test('shouldAutoPauseInbox: 1/100 (1%) → no pause', () => {
  assert.equal(shouldAutoPauseInbox(1, 100), false);
});

test('shouldAutoPauseInbox: 3/100 (3%) → no pause (at threshold, not above)', () => {
  // Threshold is > 0.03, so exactly 0.03 should NOT pause
  assert.equal(shouldAutoPauseInbox(3, 100), false);
});

test('shouldAutoPauseInbox: 4/100 (4%) → pause', () => {
  assert.equal(shouldAutoPauseInbox(4, 100), true);
});

test('shouldAutoPauseInbox: 2/50 (4%) → pause', () => {
  assert.equal(shouldAutoPauseInbox(2, 50), true);
});

test('shouldAutoPauseInbox: 50/100 (50%) → pause', () => {
  assert.equal(shouldAutoPauseInbox(50, 100), true);
});

test('shouldAutoPauseInbox: below MIN_EMAILS_FOR_RATE → no pause regardless of rate', () => {
  // 5/10 = 50% but only 10 emails sent (below minimum of 50)
  assert.equal(shouldAutoPauseInbox(5, 10), false);
});

test('shouldAutoPauseInbox: exactly at MIN_EMAILS_FOR_RATE with high rate → pause', () => {
  assert.equal(shouldAutoPauseInbox(10, 50), true); // 20% > 3%
});

test('shouldAutoPauseInbox: 0 sent → no pause', () => {
  assert.equal(shouldAutoPauseInbox(0, 0), false);
});

test('shouldAutoPauseInbox: 49 sent (below min) → no pause even at 100% rate', () => {
  assert.equal(shouldAutoPauseInbox(49, 49), false);
});

test('shouldAutoPauseInbox: 1 out of 33 (~3.03%) → no pause (below min)', () => {
  // 33 < 50, so rate check is skipped
  assert.equal(shouldAutoPauseInbox(1, 33), false);
});

// ============================================
// 6. Complaint Handling (~15 tests)
// ============================================

console.log('\n--- Complaint Handling ---');

test('complaint bounceType produces SPAM_REPORT event', () => {
  assert.equal(bounceTypeToEvent('complaint'), 'SPAM_REPORT');
});

test('complaint adds to suppression list', () => {
  const result = processBounce('complaint', 0, 'user marked as spam');
  assert.equal(result.addToSuppression, true);
});

test('complaint suppressionReason is spam_complaint', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.suppressionReason, 'spam_complaint');
});

test('complaint effectiveBounceType is complaint (not converted to hard)', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.effectiveBounceType, 'complaint');
});

test('complaint action is bounce (no retry)', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.action, 'bounce');
});

test('complaint has no retryDelay', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.retryDelay, undefined);
});

test('complaint has no retryCount', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.retryCount, undefined);
});

test('complaint emailStatusUpdate is bounced', () => {
  const result = processBounce('complaint', 0, 'spam');
  assert.equal(result.emailStatusUpdate, 'bounced');
});

test('complaint from contacted lead → spam_reported via state machine', () => {
  const event = bounceTypeToEvent('complaint');
  const newStatus = canTransition('contacted', event);
  assert.equal(newStatus, 'spam_reported');
});

test('complaint from in_sequence lead → spam_reported', () => {
  const event = bounceTypeToEvent('complaint');
  const newStatus = canTransition('in_sequence', event);
  assert.equal(newStatus, 'spam_reported');
});

test('complaint from pending lead → spam_reported', () => {
  const event = bounceTypeToEvent('complaint');
  const newStatus = canTransition('pending', event);
  assert.equal(newStatus, 'spam_reported');
});

test('complaint from replied lead → spam_reported', () => {
  const event = bounceTypeToEvent('complaint');
  const newStatus = canTransition('replied', event);
  assert.equal(newStatus, 'spam_reported');
});

test('spam_reported is a terminal state', () => {
  assert.equal(isTerminalState('spam_reported'), true);
});

test('spam_reported blocks sequence', () => {
  assert.equal(blocksSequence('spam_reported'), true);
});

test('complaint from already spam_reported lead → null (terminal state)', () => {
  const event = bounceTypeToEvent('complaint');
  const newStatus = canTransition('spam_reported', event);
  assert.equal(newStatus, null);
});

// ============================================
// 7. Lead State Transitions on Bounce (~15 tests)
// ============================================

console.log('\n--- Lead State Transitions on Bounce ---');

test('contacted + EMAIL_BOUNCED → bounced', () => {
  const newStatus = canTransition('contacted', 'EMAIL_BOUNCED');
  assert.equal(newStatus, 'bounced');
});

test('in_sequence + EMAIL_BOUNCED → bounced', () => {
  const newStatus = canTransition('in_sequence', 'EMAIL_BOUNCED');
  assert.equal(newStatus, 'bounced');
});

test('pending + EMAIL_BOUNCED → bounced', () => {
  const newStatus = canTransition('pending', 'EMAIL_BOUNCED');
  assert.equal(newStatus, 'bounced');
});

test('soft_bounced + EMAIL_BOUNCED → bounced', () => {
  const newStatus = canTransition('soft_bounced', 'EMAIL_BOUNCED');
  assert.equal(newStatus, 'bounced');
});

test('contacted + SOFT_BOUNCE → soft_bounced', () => {
  const newStatus = canTransition('contacted', 'SOFT_BOUNCE');
  assert.equal(newStatus, 'soft_bounced');
});

test('in_sequence + SOFT_BOUNCE → soft_bounced', () => {
  const newStatus = canTransition('in_sequence', 'SOFT_BOUNCE');
  assert.equal(newStatus, 'soft_bounced');
});

test('pending + SOFT_BOUNCE → soft_bounced', () => {
  const newStatus = canTransition('pending', 'SOFT_BOUNCE');
  assert.equal(newStatus, 'soft_bounced');
});

test('bounced is a terminal state', () => {
  assert.equal(isTerminalState('bounced'), true);
});

test('bounced + EMAIL_BOUNCED → null (terminal, blocked)', () => {
  const newStatus = canTransition('bounced', 'EMAIL_BOUNCED');
  assert.equal(newStatus, null);
});

test('bounced + MANUAL_OVERRIDE → can transition', () => {
  const newStatus = canTransition('bounced', 'MANUAL_OVERRIDE');
  assert.notEqual(newStatus, null);
});

test('replied + EMAIL_BOUNCED → null (not a valid from state)', () => {
  const newStatus = canTransition('replied', 'EMAIL_BOUNCED');
  assert.equal(newStatus, null);
});

test('interested + EMAIL_BOUNCED → null (not a valid from state)', () => {
  const newStatus = canTransition('interested', 'EMAIL_BOUNCED');
  assert.equal(newStatus, null);
});

test('bounced blocks sequence continuation', () => {
  assert.equal(blocksSequence('bounced'), true);
});

test('soft_bounced does NOT block sequence', () => {
  assert.equal(blocksSequence('soft_bounced'), false);
});

test('full bounce lifecycle: pending → soft_bounced → bounced', () => {
  const step1 = canTransition('pending', 'SOFT_BOUNCE');
  assert.equal(step1, 'soft_bounced');
  const step2 = canTransition('soft_bounced', 'EMAIL_BOUNCED');
  assert.equal(step2, 'bounced');
});

// ============================================
// Summary
// ============================================

console.log(`\n${'='.repeat(50)}\nResults: ${passed} passed, ${failed} failed of ${passed + failed}\n${'='.repeat(50)}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
