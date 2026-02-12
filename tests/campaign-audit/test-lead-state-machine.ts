/**
 * Lead State Machine Audit Tests
 * Comprehensive state machine coverage: transitions, terminal states, helpers
 */

import assert from 'node:assert/strict';
import {
  LeadStateMachine,
  leadStateMachine,
  replyIntentToEvent,
  bounceTypeToEvent,
  getStatusDescription,
  getStatusColor,
  isPositiveOutcome,
  isNegativeOutcome,
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

const sm = new LeadStateMachine();

// ============================================
// Valid Transitions (~20 tests)
// ============================================

console.log('\n--- Valid Transitions ---');

test('pending → in_sequence via EMAIL_SENT', () => {
  assert.equal(sm.canTransition('pending', 'EMAIL_SENT'), 'in_sequence');
});

test('in_sequence → contacted via EMAIL_SENT', () => {
  assert.equal(sm.canTransition('in_sequence', 'EMAIL_SENT'), 'contacted');
});

test('contacted → contacted via EMAIL_SENT (self-loop)', () => {
  assert.equal(sm.canTransition('contacted', 'EMAIL_SENT'), 'contacted');
});

test('pending → soft_bounced via SOFT_BOUNCE', () => {
  assert.equal(sm.canTransition('pending', 'SOFT_BOUNCE'), 'soft_bounced');
});

test('in_sequence → soft_bounced via SOFT_BOUNCE', () => {
  assert.equal(sm.canTransition('in_sequence', 'SOFT_BOUNCE'), 'soft_bounced');
});

test('contacted → soft_bounced via SOFT_BOUNCE', () => {
  assert.equal(sm.canTransition('contacted', 'SOFT_BOUNCE'), 'soft_bounced');
});

test('pending → bounced via EMAIL_BOUNCED', () => {
  assert.equal(sm.canTransition('pending', 'EMAIL_BOUNCED'), 'bounced');
});

test('in_sequence → bounced via EMAIL_BOUNCED', () => {
  assert.equal(sm.canTransition('in_sequence', 'EMAIL_BOUNCED'), 'bounced');
});

test('contacted → bounced via EMAIL_BOUNCED', () => {
  assert.equal(sm.canTransition('contacted', 'EMAIL_BOUNCED'), 'bounced');
});

test('soft_bounced → bounced via EMAIL_BOUNCED', () => {
  assert.equal(sm.canTransition('soft_bounced', 'EMAIL_BOUNCED'), 'bounced');
});

test('in_sequence → replied via REPLY_RECEIVED', () => {
  assert.equal(sm.canTransition('in_sequence', 'REPLY_RECEIVED'), 'replied');
});

test('contacted → replied via REPLY_RECEIVED', () => {
  assert.equal(sm.canTransition('contacted', 'REPLY_RECEIVED'), 'replied');
});

test('replied → interested via REPLY_INTERESTED', () => {
  assert.equal(sm.canTransition('replied', 'REPLY_INTERESTED'), 'interested');
});

test('replied → not_interested via REPLY_NOT_INTERESTED', () => {
  assert.equal(sm.canTransition('replied', 'REPLY_NOT_INTERESTED'), 'not_interested');
});

test('in_sequence → interested via REPLY_INTERESTED (direct)', () => {
  assert.equal(sm.canTransition('in_sequence', 'REPLY_INTERESTED'), 'interested');
});

test('contacted → interested via REPLY_INTERESTED (direct)', () => {
  assert.equal(sm.canTransition('contacted', 'REPLY_INTERESTED'), 'interested');
});

test('in_sequence → not_interested via REPLY_NOT_INTERESTED (direct)', () => {
  assert.equal(sm.canTransition('in_sequence', 'REPLY_NOT_INTERESTED'), 'not_interested');
});

test('contacted → not_interested via REPLY_NOT_INTERESTED (direct)', () => {
  assert.equal(sm.canTransition('contacted', 'REPLY_NOT_INTERESTED'), 'not_interested');
});

test('replied → meeting_booked via MEETING_BOOKED', () => {
  assert.equal(sm.canTransition('replied', 'MEETING_BOOKED'), 'meeting_booked');
});

test('interested → meeting_booked via MEETING_BOOKED', () => {
  assert.equal(sm.canTransition('interested', 'MEETING_BOOKED'), 'meeting_booked');
});

test('pending → unsubscribed via UNSUBSCRIBE', () => {
  assert.equal(sm.canTransition('pending', 'UNSUBSCRIBE'), 'unsubscribed');
});

test('in_sequence → unsubscribed via UNSUBSCRIBE', () => {
  assert.equal(sm.canTransition('in_sequence', 'UNSUBSCRIBE'), 'unsubscribed');
});

test('contacted → unsubscribed via UNSUBSCRIBE', () => {
  assert.equal(sm.canTransition('contacted', 'UNSUBSCRIBE'), 'unsubscribed');
});

test('pending → spam_reported via SPAM_REPORT', () => {
  assert.equal(sm.canTransition('pending', 'SPAM_REPORT'), 'spam_reported');
});

test('in_sequence → spam_reported via SPAM_REPORT', () => {
  assert.equal(sm.canTransition('in_sequence', 'SPAM_REPORT'), 'spam_reported');
});

test('contacted → spam_reported via SPAM_REPORT', () => {
  assert.equal(sm.canTransition('contacted', 'SPAM_REPORT'), 'spam_reported');
});

test('in_sequence → sequence_complete via SEQUENCE_COMPLETE', () => {
  assert.equal(sm.canTransition('in_sequence', 'SEQUENCE_COMPLETE'), 'sequence_complete');
});

test('contacted → sequence_complete via SEQUENCE_COMPLETE', () => {
  assert.equal(sm.canTransition('contacted', 'SEQUENCE_COMPLETE'), 'sequence_complete');
});

// ============================================
// Terminal States (~8 tests)
// ============================================

console.log('\n--- Terminal States ---');

test('bounced blocks EMAIL_SENT', () => {
  assert.equal(sm.canTransition('bounced', 'EMAIL_SENT'), null);
});

test('bounced blocks REPLY_RECEIVED', () => {
  assert.equal(sm.canTransition('bounced', 'REPLY_RECEIVED'), null);
});

test('unsubscribed blocks EMAIL_SENT', () => {
  assert.equal(sm.canTransition('unsubscribed', 'EMAIL_SENT'), null);
});

test('unsubscribed blocks REPLY_INTERESTED', () => {
  assert.equal(sm.canTransition('unsubscribed', 'REPLY_INTERESTED'), null);
});

test('spam_reported blocks EMAIL_SENT', () => {
  assert.equal(sm.canTransition('spam_reported', 'EMAIL_SENT'), null);
});

test('spam_reported blocks SEQUENCE_COMPLETE', () => {
  assert.equal(sm.canTransition('spam_reported', 'SEQUENCE_COMPLETE'), null);
});

test('bounced allows MANUAL_OVERRIDE → pending', () => {
  assert.equal(sm.canTransition('bounced', 'MANUAL_OVERRIDE'), 'pending');
});

test('unsubscribed allows MANUAL_OVERRIDE', () => {
  assert.notEqual(sm.canTransition('unsubscribed', 'MANUAL_OVERRIDE'), null);
});

// ============================================
// blocksSequence() (~4 tests)
// ============================================

console.log('\n--- blocksSequence ---');

test('blocksSequence true for blocking statuses', () => {
  const blocking: LeadStatus[] = ['bounced', 'unsubscribed', 'spam_reported', 'replied', 'interested', 'not_interested', 'meeting_booked'];
  for (const status of blocking) {
    assert.equal(sm.blocksSequence(status), true, `${status} should block sequence`);
  }
});

test('blocksSequence false for non-blocking statuses', () => {
  const nonBlocking: LeadStatus[] = ['pending', 'in_sequence', 'contacted', 'soft_bounced', 'sequence_complete'];
  for (const status of nonBlocking) {
    assert.equal(sm.blocksSequence(status), false, `${status} should not block sequence`);
  }
});

test('contacted does NOT block sequence (self-loop via EMAIL_SENT allowed)', () => {
  assert.equal(sm.blocksSequence('contacted'), false);
  assert.equal(sm.canTransition('contacted', 'EMAIL_SENT'), 'contacted');
});

test('soft_bounced does not block sequence', () => {
  assert.equal(sm.blocksSequence('soft_bounced'), false);
});

// ============================================
// Invalid Transitions (~5 tests)
// ============================================

console.log('\n--- Invalid Transitions ---');

test('pending → replied is invalid (no REPLY_RECEIVED from pending)', () => {
  assert.equal(sm.canTransition('pending', 'REPLY_RECEIVED'), null);
});

test('pending → interested is invalid', () => {
  assert.equal(sm.canTransition('pending', 'REPLY_INTERESTED'), null);
});

test('meeting_booked → contacted is invalid (not via regular event)', () => {
  assert.equal(sm.canTransition('meeting_booked', 'EMAIL_SENT'), null);
});

test('sequence_complete → in_sequence is invalid via EMAIL_SENT', () => {
  assert.equal(sm.canTransition('sequence_complete', 'EMAIL_SENT'), null);
});

test('replied → contacted is invalid via EMAIL_SENT', () => {
  assert.equal(sm.canTransition('replied', 'EMAIL_SENT'), null);
});

// ============================================
// MANUAL_OVERRIDE (~4 tests)
// ============================================

console.log('\n--- MANUAL_OVERRIDE ---');

test('MANUAL_OVERRIDE from bounced → pending', () => {
  // canTransition finds first match; MANUAL_OVERRIDE to pending exists
  const result = sm.canTransition('bounced', 'MANUAL_OVERRIDE');
  assert.notEqual(result, null);
});

test('MANUAL_OVERRIDE from unsubscribed works', () => {
  const result = sm.canTransition('unsubscribed', 'MANUAL_OVERRIDE');
  assert.notEqual(result, null);
});

test('MANUAL_OVERRIDE from spam_reported works', () => {
  const result = sm.canTransition('spam_reported', 'MANUAL_OVERRIDE');
  assert.notEqual(result, null);
});

test('MANUAL_OVERRIDE from meeting_booked works', () => {
  const result = sm.canTransition('meeting_booked', 'MANUAL_OVERRIDE');
  assert.notEqual(result, null);
});

// ============================================
// isTerminalState()
// ============================================

console.log('\n--- isTerminalState ---');

test('isTerminalState true for bounced, unsubscribed, spam_reported', () => {
  assert.equal(sm.isTerminalState('bounced'), true);
  assert.equal(sm.isTerminalState('unsubscribed'), true);
  assert.equal(sm.isTerminalState('spam_reported'), true);
});

test('isTerminalState false for all non-terminal statuses', () => {
  const nonTerminal: LeadStatus[] = [
    'pending', 'in_sequence', 'contacted', 'replied', 'interested',
    'not_interested', 'meeting_booked', 'soft_bounced', 'sequence_complete',
  ];
  for (const status of nonTerminal) {
    assert.equal(sm.isTerminalState(status), false, `${status} should not be terminal`);
  }
});

// ============================================
// Helper Functions: replyIntentToEvent (~9 tests)
// ============================================

console.log('\n--- replyIntentToEvent ---');

test('interested → REPLY_INTERESTED', () => {
  assert.equal(replyIntentToEvent('interested'), 'REPLY_INTERESTED');
});

test('meeting_request → REPLY_INTERESTED', () => {
  assert.equal(replyIntentToEvent('meeting_request'), 'REPLY_INTERESTED');
});

test('not_interested → REPLY_NOT_INTERESTED', () => {
  assert.equal(replyIntentToEvent('not_interested'), 'REPLY_NOT_INTERESTED');
});

test('unsubscribe → UNSUBSCRIBE', () => {
  assert.equal(replyIntentToEvent('unsubscribe'), 'UNSUBSCRIBE');
});

test('bounce → EMAIL_BOUNCED', () => {
  assert.equal(replyIntentToEvent('bounce'), 'EMAIL_BOUNCED');
});

test('question → REPLY_RECEIVED (default)', () => {
  assert.equal(replyIntentToEvent('question'), 'REPLY_RECEIVED');
});

test('out_of_office → REPLY_RECEIVED (default)', () => {
  assert.equal(replyIntentToEvent('out_of_office'), 'REPLY_RECEIVED');
});

test('auto_reply → REPLY_RECEIVED (default)', () => {
  assert.equal(replyIntentToEvent('auto_reply'), 'REPLY_RECEIVED');
});

test('neutral → REPLY_RECEIVED (default)', () => {
  assert.equal(replyIntentToEvent('neutral'), 'REPLY_RECEIVED');
});

// ============================================
// Helper Functions: bounceTypeToEvent (~3 tests)
// ============================================

console.log('\n--- bounceTypeToEvent ---');

test('hard → EMAIL_BOUNCED', () => {
  assert.equal(bounceTypeToEvent('hard'), 'EMAIL_BOUNCED');
});

test('soft → SOFT_BOUNCE', () => {
  assert.equal(bounceTypeToEvent('soft'), 'SOFT_BOUNCE');
});

test('complaint → SPAM_REPORT', () => {
  assert.equal(bounceTypeToEvent('complaint'), 'SPAM_REPORT');
});

// ============================================
// getStatusDescription (~1 test for all 12)
// ============================================

console.log('\n--- getStatusDescription ---');

test('getStatusDescription returns non-empty string for all 12 statuses', () => {
  const allStatuses: LeadStatus[] = [
    'pending', 'in_sequence', 'contacted', 'replied', 'interested',
    'not_interested', 'meeting_booked', 'bounced', 'soft_bounced',
    'unsubscribed', 'spam_reported', 'sequence_complete',
  ];
  for (const status of allStatuses) {
    const desc = getStatusDescription(status);
    assert.ok(desc.length > 0, `${status} description is empty`);
    assert.notEqual(desc, status, `${status} description should not be the raw status`);
  }
});

// ============================================
// getStatusColor (~1 test for all 12)
// ============================================

console.log('\n--- getStatusColor ---');

test('getStatusColor returns non-empty string for all 12 statuses', () => {
  const allStatuses: LeadStatus[] = [
    'pending', 'in_sequence', 'contacted', 'replied', 'interested',
    'not_interested', 'meeting_booked', 'bounced', 'soft_bounced',
    'unsubscribed', 'spam_reported', 'sequence_complete',
  ];
  for (const status of allStatuses) {
    const color = getStatusColor(status);
    assert.ok(color.length > 0, `${status} color is empty`);
  }
});

// ============================================
// isPositiveOutcome (~5+ tests)
// ============================================

console.log('\n--- isPositiveOutcome ---');

test('interested is positive', () => {
  assert.equal(isPositiveOutcome('interested'), true);
});

test('meeting_booked is positive', () => {
  assert.equal(isPositiveOutcome('meeting_booked'), true);
});

test('pending is not positive', () => {
  assert.equal(isPositiveOutcome('pending'), false);
});

test('replied is not positive', () => {
  assert.equal(isPositiveOutcome('replied'), false);
});

test('bounced is not positive', () => {
  assert.equal(isPositiveOutcome('bounced'), false);
});

test('not_interested is not positive', () => {
  assert.equal(isPositiveOutcome('not_interested'), false);
});

// ============================================
// isNegativeOutcome (~5+ tests)
// ============================================

console.log('\n--- isNegativeOutcome ---');

test('not_interested is negative', () => {
  assert.equal(isNegativeOutcome('not_interested'), true);
});

test('bounced is negative', () => {
  assert.equal(isNegativeOutcome('bounced'), true);
});

test('unsubscribed is negative', () => {
  assert.equal(isNegativeOutcome('unsubscribed'), true);
});

test('spam_reported is negative', () => {
  assert.equal(isNegativeOutcome('spam_reported'), true);
});

test('interested is not negative', () => {
  assert.equal(isNegativeOutcome('interested'), false);
});

test('pending is not negative', () => {
  assert.equal(isNegativeOutcome('pending'), false);
});

test('replied is not negative', () => {
  assert.equal(isNegativeOutcome('replied'), false);
});

// ============================================
// getAvailableEvents
// ============================================

console.log('\n--- getAvailableEvents ---');

test('terminal states return only MANUAL_OVERRIDE', () => {
  const terminals: LeadStatus[] = ['bounced', 'unsubscribed', 'spam_reported'];
  for (const status of terminals) {
    const events = sm.getAvailableEvents(status);
    assert.deepEqual(events, ['MANUAL_OVERRIDE'], `${status} should only allow MANUAL_OVERRIDE`);
  }
});

test('pending includes EMAIL_SENT', () => {
  const events = sm.getAvailableEvents('pending');
  assert.ok(events.includes('EMAIL_SENT'), 'pending should include EMAIL_SENT');
});

test('pending includes SOFT_BOUNCE and EMAIL_BOUNCED', () => {
  const events = sm.getAvailableEvents('pending');
  assert.ok(events.includes('SOFT_BOUNCE'));
  assert.ok(events.includes('EMAIL_BOUNCED'));
});

test('in_sequence has multiple available events', () => {
  const events = sm.getAvailableEvents('in_sequence');
  assert.ok(events.length > 3, `in_sequence should have many events, got ${events.length}`);
  assert.ok(events.includes('EMAIL_SENT'));
  assert.ok(events.includes('REPLY_RECEIVED'));
  assert.ok(events.includes('SEQUENCE_COMPLETE'));
});

test('contacted has multiple available events including self-loop EMAIL_SENT', () => {
  const events = sm.getAvailableEvents('contacted');
  assert.ok(events.includes('EMAIL_SENT'));
  assert.ok(events.includes('REPLY_RECEIVED'));
});

test('replied has REPLY_INTERESTED and REPLY_NOT_INTERESTED', () => {
  const events = sm.getAvailableEvents('replied');
  assert.ok(events.includes('REPLY_INTERESTED'));
  assert.ok(events.includes('REPLY_NOT_INTERESTED'));
  assert.ok(events.includes('MEETING_BOOKED'));
});

// ============================================
// LeadStateMachine class: transition() method
// ============================================

console.log('\n--- transition() method ---');

test('transition() returns LeadStateChange on valid transition', async () => {
  const machine = new LeadStateMachine();
  const change = await machine.transition('lead-1', 'pending', 'EMAIL_SENT');
  assert.notEqual(change, null);
  assert.equal(change!.leadId, 'lead-1');
  assert.equal(change!.previousStatus, 'pending');
  assert.equal(change!.newStatus, 'in_sequence');
  assert.equal(change!.event, 'EMAIL_SENT');
  assert.ok(change!.timestamp instanceof Date);
});

test('transition() returns null on invalid transition', async () => {
  const machine = new LeadStateMachine();
  const change = await machine.transition('lead-2', 'pending', 'REPLY_RECEIVED');
  assert.equal(change, null);
});

test('transition() calls registered state change handlers', async () => {
  const machine = new LeadStateMachine();
  let handlerCalled = false;
  let receivedChange: any = null;

  const handler = async (change: any) => {
    handlerCalled = true;
    receivedChange = change;
  };

  machine.onStateChange(handler);
  await machine.transition('lead-3', 'in_sequence', 'EMAIL_SENT');

  assert.equal(handlerCalled, true);
  assert.equal(receivedChange.newStatus, 'contacted');
});

test('removeHandler prevents handler from being called', async () => {
  const machine = new LeadStateMachine();
  let callCount = 0;

  const handler = async () => { callCount++; };
  machine.onStateChange(handler);
  await machine.transition('lead-4', 'pending', 'EMAIL_SENT');
  assert.equal(callCount, 1);

  machine.removeHandler(handler);
  await machine.transition('lead-5', 'in_sequence', 'EMAIL_SENT');
  assert.equal(callCount, 1); // should not increment
});

test('transition() with metadata preserves metadata', async () => {
  const machine = new LeadStateMachine();
  const meta = { reason: 'test', userId: 'u-1' };
  const change = await machine.transition('lead-6', 'contacted', 'REPLY_RECEIVED', meta);
  assert.notEqual(change, null);
  assert.deepEqual(change!.metadata, meta);
});

test('getNextStatus is an alias for canTransition', () => {
  assert.equal(sm.getNextStatus('pending', 'EMAIL_SENT'), sm.canTransition('pending', 'EMAIL_SENT'));
  assert.equal(sm.getNextStatus('bounced', 'EMAIL_SENT'), sm.canTransition('bounced', 'EMAIL_SENT'));
});

test('singleton leadStateMachine instance works', () => {
  assert.equal(leadStateMachine.canTransition('pending', 'EMAIL_SENT'), 'in_sequence');
  assert.ok(leadStateMachine instanceof LeadStateMachine);
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
