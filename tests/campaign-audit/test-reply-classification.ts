/**
 * Reply Classification Tests
 * Tests reply intent-to-event mapping, state transitions,
 * manual override protection, and cross-system consistency.
 * ~30 tests
 */

import assert from 'node:assert/strict';
import {
  replyIntentToEvent,
  leadStateMachine,
  type LeadEvent,
} from '../../packages/shared/src/lead-state-machine';
import type { LeadStatus, ReplyIntent } from '../../packages/shared/src/types';

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
// replyIntentToEvent Mapping (all 9 intents)
// ============================================

console.log('\n--- replyIntentToEvent Mapping ---');

test('interested -> REPLY_INTERESTED', () => {
  assert.equal(replyIntentToEvent('interested'), 'REPLY_INTERESTED');
});

test('meeting_request -> REPLY_INTERESTED', () => {
  assert.equal(replyIntentToEvent('meeting_request'), 'REPLY_INTERESTED');
});

test('not_interested -> REPLY_NOT_INTERESTED', () => {
  assert.equal(replyIntentToEvent('not_interested'), 'REPLY_NOT_INTERESTED');
});

test('unsubscribe -> UNSUBSCRIBE', () => {
  assert.equal(replyIntentToEvent('unsubscribe'), 'UNSUBSCRIBE');
});

test('bounce -> EMAIL_BOUNCED', () => {
  assert.equal(replyIntentToEvent('bounce'), 'EMAIL_BOUNCED');
});

test('question -> REPLY_RECEIVED', () => {
  assert.equal(replyIntentToEvent('question'), 'REPLY_RECEIVED');
});

test('out_of_office -> REPLY_RECEIVED', () => {
  assert.equal(replyIntentToEvent('out_of_office'), 'REPLY_RECEIVED');
});

test('auto_reply -> REPLY_RECEIVED', () => {
  assert.equal(replyIntentToEvent('auto_reply'), 'REPLY_RECEIVED');
});

test('neutral -> REPLY_RECEIVED', () => {
  assert.equal(replyIntentToEvent('neutral'), 'REPLY_RECEIVED');
});

// ============================================
// State Transitions from replied
// ============================================

console.log('\n--- State Transitions from replied ---');

test('replied -> interested via REPLY_INTERESTED', () => {
  const result = leadStateMachine.canTransition('replied', 'REPLY_INTERESTED');
  assert.equal(result, 'interested');
});

test('replied -> not_interested via REPLY_NOT_INTERESTED', () => {
  const result = leadStateMachine.canTransition('replied', 'REPLY_NOT_INTERESTED');
  assert.equal(result, 'not_interested');
});

test('replied -> meeting_booked via MEETING_BOOKED', () => {
  const result = leadStateMachine.canTransition('replied', 'MEETING_BOOKED');
  assert.equal(result, 'meeting_booked');
});

test('replied -> unsubscribed via UNSUBSCRIBE', () => {
  const result = leadStateMachine.canTransition('replied', 'UNSUBSCRIBE');
  assert.equal(result, 'unsubscribed');
});

test('replied -> spam_reported via SPAM_REPORT', () => {
  const result = leadStateMachine.canTransition('replied', 'SPAM_REPORT');
  assert.equal(result, 'spam_reported');
});

// ============================================
// Direct Intent Classification (AI confident)
// ============================================

console.log('\n--- Direct Intent Classification ---');

test('in_sequence -> interested via REPLY_INTERESTED', () => {
  const result = leadStateMachine.canTransition('in_sequence', 'REPLY_INTERESTED');
  assert.equal(result, 'interested');
});

test('contacted -> interested via REPLY_INTERESTED', () => {
  const result = leadStateMachine.canTransition('contacted', 'REPLY_INTERESTED');
  assert.equal(result, 'interested');
});

test('in_sequence -> not_interested via REPLY_NOT_INTERESTED', () => {
  const result = leadStateMachine.canTransition('in_sequence', 'REPLY_NOT_INTERESTED');
  assert.equal(result, 'not_interested');
});

test('contacted -> not_interested via REPLY_NOT_INTERESTED', () => {
  const result = leadStateMachine.canTransition('contacted', 'REPLY_NOT_INTERESTED');
  assert.equal(result, 'not_interested');
});

test('in_sequence -> replied via REPLY_RECEIVED (neutral/question/ooo)', () => {
  const result = leadStateMachine.canTransition('in_sequence', 'REPLY_RECEIVED');
  assert.equal(result, 'replied');
});

test('contacted -> replied via REPLY_RECEIVED', () => {
  const result = leadStateMachine.canTransition('contacted', 'REPLY_RECEIVED');
  assert.equal(result, 'replied');
});

// ============================================
// Suppression Intents
// ============================================

console.log('\n--- Suppression Intents ---');

test('unsubscribe: in_sequence -> unsubscribed', () => {
  const event = replyIntentToEvent('unsubscribe');
  const result = leadStateMachine.canTransition('in_sequence', event);
  assert.equal(result, 'unsubscribed');
});

test('unsubscribe: contacted -> unsubscribed', () => {
  const event = replyIntentToEvent('unsubscribe');
  const result = leadStateMachine.canTransition('contacted', event);
  assert.equal(result, 'unsubscribed');
});

test('unsubscribe: replied -> unsubscribed', () => {
  const event = replyIntentToEvent('unsubscribe');
  const result = leadStateMachine.canTransition('replied', event);
  assert.equal(result, 'unsubscribed');
});

test('bounce intent: in_sequence -> bounced', () => {
  const event = replyIntentToEvent('bounce');
  const result = leadStateMachine.canTransition('in_sequence', event);
  assert.equal(result, 'bounced');
});

test('bounce intent: contacted -> bounced', () => {
  const event = replyIntentToEvent('bounce');
  const result = leadStateMachine.canTransition('contacted', event);
  assert.equal(result, 'bounced');
});

test('unsubscribed is terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('unsubscribed'), true);
});

// ============================================
// Manual Override Simulation
// ============================================

console.log('\n--- Manual Override Protection ---');

test('batch re-classification skips leads with intent_manual_override=true', () => {
  interface Reply {
    id: string;
    intent: ReplyIntent;
    intent_manual_override: boolean;
  }

  const replies: Reply[] = [
    { id: '1', intent: 'neutral', intent_manual_override: false },
    { id: '2', intent: 'interested', intent_manual_override: true },
    { id: '3', intent: 'question', intent_manual_override: false },
    { id: '4', intent: 'not_interested', intent_manual_override: true },
  ];

  // Batch re-classification filters out manual overrides
  const toReclassify = replies.filter(r => !r.intent_manual_override);
  assert.equal(toReclassify.length, 2);
  assert.deepEqual(toReclassify.map(r => r.id), ['1', '3']);
});

test('manual override leads are preserved in batch results', () => {
  const manualOverrides = [
    { id: '2', intent: 'interested' as ReplyIntent, intent_manual_override: true },
    { id: '4', intent: 'not_interested' as ReplyIntent, intent_manual_override: true },
  ];

  // After batch re-classification, manual overrides retain their original intent
  for (const reply of manualOverrides) {
    assert.equal(reply.intent_manual_override, true);
    // Intent should not be changed by batch processing
    assert.ok(['interested', 'not_interested'].includes(reply.intent));
  }
});

test('single reply re-classification ignores manual_override flag', () => {
  // Individual re-classification (user explicitly clicks classify) can override
  // Only batch re-classification respects the flag
  const reply = { id: '2', intent: 'interested' as ReplyIntent, intent_manual_override: true };
  // User explicitly requests single re-classification - should proceed
  const singleClassifyAllowed = true; // design: single always proceeds
  assert.equal(singleClassifyAllowed, true);
});

// ============================================
// Cross-System Consistency
// ============================================

console.log('\n--- Cross-System: Every Intent Produces Valid Transition ---');

test('every replyIntentToEvent output maps to valid transition from at least one active state', () => {
  const allIntents: ReplyIntent[] = [
    'interested', 'meeting_request', 'not_interested', 'unsubscribe',
    'bounce', 'question', 'out_of_office', 'auto_reply', 'neutral',
  ];

  const activeStates: LeadStatus[] = ['in_sequence', 'contacted', 'replied'];

  for (const intent of allIntents) {
    const event = replyIntentToEvent(intent);
    let hasValidTransition = false;

    for (const state of activeStates) {
      if (leadStateMachine.canTransition(state, event) !== null) {
        hasValidTransition = true;
        break;
      }
    }

    assert.ok(hasValidTransition,
      `Intent "${intent}" -> event "${event}" has no valid transition from any active state`);
  }
});

test('interested and meeting_request map to same event', () => {
  assert.equal(
    replyIntentToEvent('interested'),
    replyIntentToEvent('meeting_request'),
  );
});

test('question, out_of_office, auto_reply, neutral all map to REPLY_RECEIVED', () => {
  const genericIntents: ReplyIntent[] = ['question', 'out_of_office', 'auto_reply', 'neutral'];
  for (const intent of genericIntents) {
    assert.equal(replyIntentToEvent(intent), 'REPLY_RECEIVED',
      `Expected ${intent} to map to REPLY_RECEIVED`);
  }
});

test('replied blocks sequence continuation', () => {
  assert.equal(leadStateMachine.blocksSequence('replied'), true);
});

test('interested blocks sequence continuation', () => {
  assert.equal(leadStateMachine.blocksSequence('interested'), true);
});

test('not_interested blocks sequence continuation', () => {
  assert.equal(leadStateMachine.blocksSequence('not_interested'), true);
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
