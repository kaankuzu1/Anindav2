/**
 * Pre-launch Audit — Suite 5: Lead State Machine Completeness
 *
 * Tests the full transition matrix, terminal states, helper functions,
 * sequential lifecycles, and edge cases for the lead state machine.
 *
 * ~250 assertions covering:
 *   - Complete (status × event) transition matrix (156 tests)
 *   - Terminal state enforcement (15 tests)
 *   - replyIntentToEvent mapping (15 tests)
 *   - bounceTypeToEvent mapping (8 tests)
 *   - blocksSequence checks (13 tests)
 *   - getAvailableEvents per status (13 tests)
 *   - Sequential lifecycle transitions (12 tests)
 *   - Helper functions (15 tests)
 *   - Edge cases & class methods (8 tests)
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
  type LeadEvent,
  type StateTransition,
  type LeadStateChange,
  type StateChangeHandler,
} from '../../packages/shared/src/lead-state-machine';

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

// ============================================================
// Constants
// ============================================================

const ALL_STATUSES = [
  'pending', 'in_sequence', 'contacted', 'replied', 'interested',
  'not_interested', 'meeting_booked', 'bounced', 'soft_bounced',
  'unsubscribed', 'spam_reported', 'sequence_complete',
] as const;

const ALL_EVENTS: LeadEvent[] = [
  'EMAIL_SENT', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_BOUNCED',
  'SOFT_BOUNCE', 'REPLY_RECEIVED', 'REPLY_INTERESTED', 'REPLY_NOT_INTERESTED',
  'UNSUBSCRIBE', 'SPAM_REPORT', 'MEETING_BOOKED', 'SEQUENCE_COMPLETE',
  'MANUAL_OVERRIDE',
];

const TERMINAL_STATUSES = ['bounced', 'unsubscribed', 'spam_reported'] as const;

const sm = new LeadStateMachine();

// ============================================================
// Build the expected transition matrix from source-of-truth
// ============================================================

type Status = typeof ALL_STATUSES[number];

// Map of (status, event) → expected target status (null = invalid)
const EXPECTED: Record<string, string | null> = {};
function key(s: string, e: string) { return `${s}::${e}`; }

// Initialize everything to null
for (const s of ALL_STATUSES) {
  for (const e of ALL_EVENTS) {
    EXPECTED[key(s, e)] = null;
  }
}

// Valid transitions (from source code VALID_TRANSITIONS)
// pending
EXPECTED[key('pending', 'EMAIL_SENT')] = 'in_sequence';
EXPECTED[key('pending', 'SOFT_BOUNCE')] = 'soft_bounced';
EXPECTED[key('pending', 'EMAIL_BOUNCED')] = 'bounced';
EXPECTED[key('pending', 'UNSUBSCRIBE')] = 'unsubscribed';
EXPECTED[key('pending', 'SPAM_REPORT')] = 'spam_reported';
EXPECTED[key('pending', 'MANUAL_OVERRIDE')] = 'pending';

// in_sequence
EXPECTED[key('in_sequence', 'EMAIL_SENT')] = 'contacted';
EXPECTED[key('in_sequence', 'SOFT_BOUNCE')] = 'soft_bounced';
EXPECTED[key('in_sequence', 'EMAIL_BOUNCED')] = 'bounced';
EXPECTED[key('in_sequence', 'REPLY_RECEIVED')] = 'replied';
EXPECTED[key('in_sequence', 'REPLY_INTERESTED')] = 'interested';
EXPECTED[key('in_sequence', 'REPLY_NOT_INTERESTED')] = 'not_interested';
EXPECTED[key('in_sequence', 'UNSUBSCRIBE')] = 'unsubscribed';
EXPECTED[key('in_sequence', 'SPAM_REPORT')] = 'spam_reported';
EXPECTED[key('in_sequence', 'SEQUENCE_COMPLETE')] = 'sequence_complete';
EXPECTED[key('in_sequence', 'MANUAL_OVERRIDE')] = 'pending';

// contacted
EXPECTED[key('contacted', 'EMAIL_SENT')] = 'contacted';
EXPECTED[key('contacted', 'SOFT_BOUNCE')] = 'soft_bounced';
EXPECTED[key('contacted', 'EMAIL_BOUNCED')] = 'bounced';
EXPECTED[key('contacted', 'REPLY_RECEIVED')] = 'replied';
EXPECTED[key('contacted', 'REPLY_INTERESTED')] = 'interested';
EXPECTED[key('contacted', 'REPLY_NOT_INTERESTED')] = 'not_interested';
EXPECTED[key('contacted', 'UNSUBSCRIBE')] = 'unsubscribed';
EXPECTED[key('contacted', 'SPAM_REPORT')] = 'spam_reported';
EXPECTED[key('contacted', 'SEQUENCE_COMPLETE')] = 'sequence_complete';
EXPECTED[key('contacted', 'MANUAL_OVERRIDE')] = 'pending';

// replied
EXPECTED[key('replied', 'REPLY_INTERESTED')] = 'interested';
EXPECTED[key('replied', 'REPLY_NOT_INTERESTED')] = 'not_interested';
EXPECTED[key('replied', 'UNSUBSCRIBE')] = 'unsubscribed';
EXPECTED[key('replied', 'SPAM_REPORT')] = 'spam_reported';
EXPECTED[key('replied', 'MEETING_BOOKED')] = 'meeting_booked';
EXPECTED[key('replied', 'MANUAL_OVERRIDE')] = 'pending';

// interested
EXPECTED[key('interested', 'UNSUBSCRIBE')] = 'unsubscribed';
EXPECTED[key('interested', 'SPAM_REPORT')] = 'spam_reported';
EXPECTED[key('interested', 'MEETING_BOOKED')] = 'meeting_booked';
EXPECTED[key('interested', 'MANUAL_OVERRIDE')] = 'pending';

// not_interested
EXPECTED[key('not_interested', 'UNSUBSCRIBE')] = 'unsubscribed';
EXPECTED[key('not_interested', 'SPAM_REPORT')] = 'spam_reported';
EXPECTED[key('not_interested', 'MANUAL_OVERRIDE')] = 'pending';

// meeting_booked (no valid non-MANUAL events)
EXPECTED[key('meeting_booked', 'MANUAL_OVERRIDE')] = 'pending';

// bounced (terminal — all non-MANUAL blocked)
EXPECTED[key('bounced', 'MANUAL_OVERRIDE')] = 'pending';

// soft_bounced
EXPECTED[key('soft_bounced', 'EMAIL_BOUNCED')] = 'bounced';
EXPECTED[key('soft_bounced', 'MANUAL_OVERRIDE')] = 'pending';

// unsubscribed (terminal)
EXPECTED[key('unsubscribed', 'MANUAL_OVERRIDE')] = 'pending';

// spam_reported (terminal)
EXPECTED[key('spam_reported', 'MANUAL_OVERRIDE')] = 'pending';

// sequence_complete (no valid non-MANUAL events)
EXPECTED[key('sequence_complete', 'MANUAL_OVERRIDE')] = 'pending';


// ============================================================
// SECTION 1: Complete Transition Matrix — Valid Transitions
// ============================================================

console.log('\n--- Section 1: Complete Transition Matrix — Valid Transitions ---');

for (const s of ALL_STATUSES) {
  for (const e of ALL_EVENTS) {
    const expected = EXPECTED[key(s, e)];
    if (expected !== null) {
      test(`[VALID] (${s}, ${e}) → ${expected}`, () => {
        const result = sm.canTransition(s, e);
        assert.equal(result, expected);
      });
    }
  }
}

// ============================================================
// SECTION 2: Complete Transition Matrix — Invalid Transitions
// ============================================================

console.log('\n--- Section 2: Complete Transition Matrix — Invalid Transitions ---');

for (const s of ALL_STATUSES) {
  for (const e of ALL_EVENTS) {
    const expected = EXPECTED[key(s, e)];
    if (expected === null) {
      test(`[INVALID] (${s}, ${e}) → null`, () => {
        const result = sm.canTransition(s, e);
        assert.equal(result, null);
      });
    }
  }
}

// ============================================================
// SECTION 3: Terminal State Enforcement
// ============================================================

console.log('\n--- Section 3: Terminal State Enforcement ---');

// 3a: isTerminalState returns true for terminal states
for (const ts of TERMINAL_STATUSES) {
  test(`isTerminalState('${ts}') is true`, () => {
    assert.equal(sm.isTerminalState(ts), true);
  });
}

// 3b: isTerminalState returns false for non-terminal states
const NON_TERMINAL = ALL_STATUSES.filter(s => !TERMINAL_STATUSES.includes(s as any));
for (const s of NON_TERMINAL) {
  test(`isTerminalState('${s}') is false`, () => {
    assert.equal(sm.isTerminalState(s), false);
  });
}

// 3c: Terminal states reject ALL events except MANUAL_OVERRIDE (already in matrix, add explicit group tests)
test('bounced rejects all 12 non-MANUAL events', () => {
  const nonManual = ALL_EVENTS.filter(e => e !== 'MANUAL_OVERRIDE');
  for (const e of nonManual) {
    assert.equal(sm.canTransition('bounced', e), null, `bounced + ${e} should be null`);
  }
});

test('unsubscribed rejects all 12 non-MANUAL events', () => {
  const nonManual = ALL_EVENTS.filter(e => e !== 'MANUAL_OVERRIDE');
  for (const e of nonManual) {
    assert.equal(sm.canTransition('unsubscribed', e), null, `unsubscribed + ${e} should be null`);
  }
});

test('spam_reported rejects all 12 non-MANUAL events', () => {
  const nonManual = ALL_EVENTS.filter(e => e !== 'MANUAL_OVERRIDE');
  for (const e of nonManual) {
    assert.equal(sm.canTransition('spam_reported', e), null, `spam_reported + ${e} should be null`);
  }
});

// ============================================================
// SECTION 4: replyIntentToEvent Mapping
// ============================================================

console.log('\n--- Section 4: replyIntentToEvent Mapping ---');

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

test('replyIntentToEvent returns REPLY_RECEIVED for unknown intent', () => {
  assert.equal(replyIntentToEvent('unknown_intent' as any), 'REPLY_RECEIVED');
});

test('replyIntentToEvent returns REPLY_RECEIVED for empty string', () => {
  assert.equal(replyIntentToEvent('' as any), 'REPLY_RECEIVED');
});

test('interested and meeting_request both map to same event', () => {
  assert.equal(replyIntentToEvent('interested'), replyIntentToEvent('meeting_request'));
});

test('question/out_of_office/auto_reply/neutral all map to REPLY_RECEIVED', () => {
  const defaults = ['question', 'out_of_office', 'auto_reply', 'neutral'] as const;
  for (const intent of defaults) {
    assert.equal(replyIntentToEvent(intent), 'REPLY_RECEIVED', `${intent} should map to REPLY_RECEIVED`);
  }
});

test('replyIntentToEvent with null falls to default', () => {
  assert.equal(replyIntentToEvent(null as any), 'REPLY_RECEIVED');
});

test('replyIntentToEvent with undefined falls to default', () => {
  assert.equal(replyIntentToEvent(undefined as any), 'REPLY_RECEIVED');
});

// ============================================================
// SECTION 5: bounceTypeToEvent Mapping
// ============================================================

console.log('\n--- Section 5: bounceTypeToEvent Mapping ---');

test('hard → EMAIL_BOUNCED', () => {
  assert.equal(bounceTypeToEvent('hard'), 'EMAIL_BOUNCED');
});

test('soft → SOFT_BOUNCE', () => {
  assert.equal(bounceTypeToEvent('soft'), 'SOFT_BOUNCE');
});

test('complaint → SPAM_REPORT', () => {
  assert.equal(bounceTypeToEvent('complaint'), 'SPAM_REPORT');
});

test('bounceTypeToEvent with unknown type defaults to EMAIL_BOUNCED', () => {
  assert.equal(bounceTypeToEvent('unknown' as any), 'EMAIL_BOUNCED');
});

test('bounceTypeToEvent with empty string defaults to EMAIL_BOUNCED', () => {
  assert.equal(bounceTypeToEvent('' as any), 'EMAIL_BOUNCED');
});

test('hard bounce leads to bounced state from pending', () => {
  const event = bounceTypeToEvent('hard');
  assert.equal(sm.canTransition('pending', event), 'bounced');
});

test('soft bounce leads to soft_bounced state from contacted', () => {
  const event = bounceTypeToEvent('soft');
  assert.equal(sm.canTransition('contacted', event), 'soft_bounced');
});

test('complaint leads to spam_reported state from in_sequence', () => {
  const event = bounceTypeToEvent('complaint');
  assert.equal(sm.canTransition('in_sequence', event), 'spam_reported');
});

// ============================================================
// SECTION 6: blocksSequence
// ============================================================

console.log('\n--- Section 6: blocksSequence ---');

const BLOCKING_STATUSES = ['bounced', 'unsubscribed', 'spam_reported', 'replied', 'interested', 'not_interested', 'meeting_booked'];
const NON_BLOCKING_STATUSES = ['pending', 'in_sequence', 'contacted', 'soft_bounced', 'sequence_complete'];

for (const s of BLOCKING_STATUSES) {
  test(`blocksSequence('${s}') is true`, () => {
    assert.equal(sm.blocksSequence(s as any), true);
  });
}

for (const s of NON_BLOCKING_STATUSES) {
  test(`blocksSequence('${s}') is false`, () => {
    assert.equal(sm.blocksSequence(s as any), false);
  });
}

test('blocksSequence with unknown status returns false', () => {
  assert.equal(sm.blocksSequence('unknown_status' as any), false);
});

// ============================================================
// SECTION 7: getAvailableEvents
// ============================================================

console.log('\n--- Section 7: getAvailableEvents ---');

const EXPECTED_EVENTS: Record<string, LeadEvent[]> = {
  pending: ['EMAIL_SENT', 'SOFT_BOUNCE', 'EMAIL_BOUNCED', 'UNSUBSCRIBE', 'SPAM_REPORT', 'MANUAL_OVERRIDE'],
  in_sequence: ['EMAIL_SENT', 'SOFT_BOUNCE', 'EMAIL_BOUNCED', 'REPLY_RECEIVED', 'REPLY_INTERESTED', 'REPLY_NOT_INTERESTED', 'UNSUBSCRIBE', 'SPAM_REPORT', 'SEQUENCE_COMPLETE', 'MANUAL_OVERRIDE'],
  contacted: ['EMAIL_SENT', 'SOFT_BOUNCE', 'EMAIL_BOUNCED', 'REPLY_RECEIVED', 'REPLY_INTERESTED', 'REPLY_NOT_INTERESTED', 'UNSUBSCRIBE', 'SPAM_REPORT', 'SEQUENCE_COMPLETE', 'MANUAL_OVERRIDE'],
  replied: ['REPLY_INTERESTED', 'REPLY_NOT_INTERESTED', 'UNSUBSCRIBE', 'SPAM_REPORT', 'MEETING_BOOKED', 'MANUAL_OVERRIDE'],
  interested: ['UNSUBSCRIBE', 'SPAM_REPORT', 'MEETING_BOOKED', 'MANUAL_OVERRIDE'],
  not_interested: ['UNSUBSCRIBE', 'SPAM_REPORT', 'MANUAL_OVERRIDE'],
  meeting_booked: ['MANUAL_OVERRIDE'],
  bounced: ['MANUAL_OVERRIDE'],
  soft_bounced: ['EMAIL_BOUNCED', 'MANUAL_OVERRIDE'],
  unsubscribed: ['MANUAL_OVERRIDE'],
  spam_reported: ['MANUAL_OVERRIDE'],
  sequence_complete: ['MANUAL_OVERRIDE'],
};

for (const s of ALL_STATUSES) {
  test(`getAvailableEvents('${s}') returns correct event set`, () => {
    const result = sm.getAvailableEvents(s);
    const expected = EXPECTED_EVENTS[s];
    // Compare as sets (order doesn't matter)
    assert.equal(result.length, expected.length, `${s}: expected ${expected.length} events, got ${result.length}`);
    for (const e of expected) {
      assert.ok(result.includes(e), `${s}: missing event ${e}`);
    }
  });
}

test('getAvailableEvents for terminal state only returns MANUAL_OVERRIDE', () => {
  for (const ts of TERMINAL_STATUSES) {
    const events = sm.getAvailableEvents(ts);
    assert.equal(events.length, 1);
    assert.equal(events[0], 'MANUAL_OVERRIDE');
  }
});

// ============================================================
// SECTION 8: Sequential Lifecycle Transitions
// ============================================================

console.log('\n--- Section 8: Sequential Lifecycle Transitions ---');

test('Happy path: pending → in_sequence → contacted → replied → interested → meeting_booked', () => {
  let state: string = 'pending';
  state = sm.canTransition(state as any, 'EMAIL_SENT')!;
  assert.equal(state, 'in_sequence');
  state = sm.canTransition(state as any, 'EMAIL_SENT')!;
  assert.equal(state, 'contacted');
  state = sm.canTransition(state as any, 'REPLY_RECEIVED')!;
  assert.equal(state, 'replied');
  state = sm.canTransition(state as any, 'REPLY_INTERESTED')!;
  assert.equal(state, 'interested');
  state = sm.canTransition(state as any, 'MEETING_BOOKED')!;
  assert.equal(state, 'meeting_booked');
});

test('Bounce path: pending → in_sequence → contacted → bounced', () => {
  let state: string = 'pending';
  state = sm.canTransition(state as any, 'EMAIL_SENT')!;
  assert.equal(state, 'in_sequence');
  state = sm.canTransition(state as any, 'EMAIL_SENT')!;
  assert.equal(state, 'contacted');
  state = sm.canTransition(state as any, 'EMAIL_BOUNCED')!;
  assert.equal(state, 'bounced');
});

test('Unsubscribe path: pending → in_sequence → contacted → unsubscribed', () => {
  let state: string = 'pending';
  state = sm.canTransition(state as any, 'EMAIL_SENT')!;
  state = sm.canTransition(state as any, 'EMAIL_SENT')!;
  state = sm.canTransition(state as any, 'UNSUBSCRIBE')!;
  assert.equal(state, 'unsubscribed');
});

test('Sequence complete path: pending → in_sequence → contacted → sequence_complete', () => {
  let state: string = 'pending';
  state = sm.canTransition(state as any, 'EMAIL_SENT')!;
  state = sm.canTransition(state as any, 'EMAIL_SENT')!;
  state = sm.canTransition(state as any, 'SEQUENCE_COMPLETE')!;
  assert.equal(state, 'sequence_complete');
});

test('Soft bounce → hard bounce path: contacted → soft_bounced → bounced', () => {
  let state: string = 'contacted';
  state = sm.canTransition(state as any, 'SOFT_BOUNCE')!;
  assert.equal(state, 'soft_bounced');
  state = sm.canTransition(state as any, 'EMAIL_BOUNCED')!;
  assert.equal(state, 'bounced');
});

test('Spam path: in_sequence → spam_reported (terminal)', () => {
  const result = sm.canTransition('in_sequence', 'SPAM_REPORT');
  assert.equal(result, 'spam_reported');
  // Then terminal — cannot go further
  assert.equal(sm.canTransition('spam_reported', 'EMAIL_SENT'), null);
});

test('Not interested path: contacted → not_interested', () => {
  const result = sm.canTransition('contacted', 'REPLY_NOT_INTERESTED');
  assert.equal(result, 'not_interested');
});

test('Direct interest from in_sequence: in_sequence → interested', () => {
  const result = sm.canTransition('in_sequence', 'REPLY_INTERESTED');
  assert.equal(result, 'interested');
});

test('Multiple emails: contacted → contacted (re-engagement)', () => {
  const result = sm.canTransition('contacted', 'EMAIL_SENT');
  assert.equal(result, 'contacted');
});

test('Manual override recovery: bounced → pending via MANUAL_OVERRIDE', () => {
  const result = sm.canTransition('bounced', 'MANUAL_OVERRIDE');
  assert.equal(result, 'pending');
});

test('Manual override on non-terminal: meeting_booked → pending via MANUAL_OVERRIDE', () => {
  const result = sm.canTransition('meeting_booked', 'MANUAL_OVERRIDE');
  assert.equal(result, 'pending');
});

test('Full lifecycle with manual recovery: bounced → (MANUAL_OVERRIDE) → pending → in_sequence', () => {
  let state: string = 'bounced';
  state = sm.canTransition(state as any, 'MANUAL_OVERRIDE')!;
  assert.equal(state, 'pending');
  state = sm.canTransition(state as any, 'EMAIL_SENT')!;
  assert.equal(state, 'in_sequence');
});

// ============================================================
// SECTION 9: Helper Functions
// ============================================================

console.log('\n--- Section 9: Helper Functions ---');

// getStatusDescription
test('getStatusDescription(pending) returns non-empty string', () => {
  const desc = getStatusDescription('pending');
  assert.ok(desc.length > 0);
  assert.ok(desc.includes('Waiting'));
});

test('getStatusDescription(bounced) mentions bounce', () => {
  const desc = getStatusDescription('bounced');
  assert.ok(desc.toLowerCase().includes('bounce'));
});

test('getStatusDescription(meeting_booked) mentions meeting', () => {
  const desc = getStatusDescription('meeting_booked');
  assert.ok(desc.toLowerCase().includes('meeting'));
});

test('getStatusDescription returns description for all 12 statuses', () => {
  for (const s of ALL_STATUSES) {
    const desc = getStatusDescription(s);
    assert.ok(desc.length > 0, `${s} should have a description`);
  }
});

test('getStatusDescription with unknown status returns the status itself', () => {
  const desc = getStatusDescription('totally_unknown' as any);
  assert.equal(desc, 'totally_unknown');
});

// getStatusColor
test('getStatusColor(pending) returns gray', () => {
  assert.equal(getStatusColor('pending'), 'gray');
});

test('getStatusColor(interested) returns green', () => {
  assert.equal(getStatusColor('interested'), 'green');
});

test('getStatusColor(bounced) returns red', () => {
  assert.equal(getStatusColor('bounced'), 'red');
});

test('getStatusColor returns color for all 12 statuses', () => {
  for (const s of ALL_STATUSES) {
    const color = getStatusColor(s);
    assert.ok(color.length > 0, `${s} should have a color`);
  }
});

test('getStatusColor with unknown status returns gray', () => {
  assert.equal(getStatusColor('xyz_unknown' as any), 'gray');
});

// isPositiveOutcome
test('isPositiveOutcome(interested) is true', () => {
  assert.equal(isPositiveOutcome('interested'), true);
});

test('isPositiveOutcome(meeting_booked) is true', () => {
  assert.equal(isPositiveOutcome('meeting_booked'), true);
});

test('isPositiveOutcome(pending) is false', () => {
  assert.equal(isPositiveOutcome('pending'), false);
});

test('isPositiveOutcome(bounced) is false', () => {
  assert.equal(isPositiveOutcome('bounced'), false);
});

// isNegativeOutcome
test('isNegativeOutcome(not_interested) is true', () => {
  assert.equal(isNegativeOutcome('not_interested'), true);
});

test('isNegativeOutcome(bounced) is true', () => {
  assert.equal(isNegativeOutcome('bounced'), true);
});

test('isNegativeOutcome(unsubscribed) is true', () => {
  assert.equal(isNegativeOutcome('unsubscribed'), true);
});

test('isNegativeOutcome(spam_reported) is true', () => {
  assert.equal(isNegativeOutcome('spam_reported'), true);
});

test('isNegativeOutcome(interested) is false', () => {
  assert.equal(isNegativeOutcome('interested'), false);
});

// ============================================================
// SECTION 10: Edge Cases & Class Methods
// ============================================================

console.log('\n--- Section 10: Edge Cases & Class Methods ---');

test('getNextStatus is alias for canTransition', () => {
  for (const s of ALL_STATUSES) {
    for (const e of ALL_EVENTS) {
      assert.equal(
        sm.getNextStatus(s, e),
        sm.canTransition(s, e),
        `getNextStatus and canTransition should agree for (${s}, ${e})`
      );
    }
  }
});

test('leadStateMachine singleton is a LeadStateMachine instance', () => {
  assert.ok(leadStateMachine instanceof LeadStateMachine);
});

test('leadStateMachine singleton works the same as new instance', () => {
  assert.equal(leadStateMachine.canTransition('pending', 'EMAIL_SENT'), 'in_sequence');
  assert.equal(leadStateMachine.isTerminalState('bounced'), true);
});

test('transition() returns null for invalid transition', async () => {
  const result = await sm.transition('lead-1', 'bounced', 'EMAIL_SENT');
  assert.equal(result, null);
});

test('transition() returns LeadStateChange for valid transition', async () => {
  const result = await sm.transition('lead-2', 'pending', 'EMAIL_SENT');
  assert.ok(result !== null);
  assert.equal(result!.leadId, 'lead-2');
  assert.equal(result!.previousStatus, 'pending');
  assert.equal(result!.newStatus, 'in_sequence');
  assert.equal(result!.event, 'EMAIL_SENT');
  assert.ok(result!.timestamp instanceof Date);
});

test('transition() passes metadata through', async () => {
  const meta = { reason: 'test', campaign_id: '123' };
  const result = await sm.transition('lead-3', 'in_sequence', 'REPLY_RECEIVED', meta);
  assert.ok(result !== null);
  assert.deepEqual(result!.metadata, meta);
});

test('onStateChange handler is called on transition', async () => {
  const localSm = new LeadStateMachine();
  let capturedChange: LeadStateChange | null = null;
  const handler: StateChangeHandler = async (change) => { capturedChange = change; };
  localSm.onStateChange(handler);
  await localSm.transition('lead-4', 'pending', 'EMAIL_SENT');
  assert.ok(capturedChange !== null);
  assert.equal(capturedChange!.newStatus, 'in_sequence');
  localSm.removeHandler(handler);
});

test('removeHandler stops handler from being called', async () => {
  const localSm = new LeadStateMachine();
  let callCount = 0;
  const handler: StateChangeHandler = async () => { callCount++; };
  localSm.onStateChange(handler);
  await localSm.transition('lead-5', 'pending', 'EMAIL_SENT');
  assert.equal(callCount, 1);
  localSm.removeHandler(handler);
  await localSm.transition('lead-5', 'in_sequence', 'EMAIL_SENT');
  assert.equal(callCount, 1); // Not incremented after removal
});

// ============================================================
// Results
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed of ${passed + failed}`);
console.log(`${'='.repeat(50)}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
