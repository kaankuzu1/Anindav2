/**
 * Campaign Simulation: Reply Handling Tests
 * Tests reply intent-to-event mapping, stop_on_reply simulation,
 * lead status transitions, terminal states, manual override protection,
 * batch re-classify simulation, state machine getAvailableEvents,
 * and isTerminalState checks.
 * ~45 tests
 */
import assert from 'node:assert/strict';
import {
  replyIntentToEvent,
  bounceTypeToEvent,
  LeadStateMachine,
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
// Reply Intent to Event Mapping (all 9 intents)
// ============================================
console.log('\n--- Reply Intent to Event Mapping ---');

test('interested -> REPLY_INTERESTED', () => {
  assert.equal(replyIntentToEvent('interested'), 'REPLY_INTERESTED');
});

test('meeting_request -> REPLY_INTERESTED', () => {
  assert.equal(replyIntentToEvent('meeting_request'), 'REPLY_INTERESTED');
});

test('question -> REPLY_RECEIVED', () => {
  assert.equal(replyIntentToEvent('question'), 'REPLY_RECEIVED');
});

test('not_interested -> REPLY_NOT_INTERESTED', () => {
  assert.equal(replyIntentToEvent('not_interested'), 'REPLY_NOT_INTERESTED');
});

test('unsubscribe -> UNSUBSCRIBE', () => {
  assert.equal(replyIntentToEvent('unsubscribe'), 'UNSUBSCRIBE');
});

test('out_of_office -> REPLY_RECEIVED', () => {
  assert.equal(replyIntentToEvent('out_of_office'), 'REPLY_RECEIVED');
});

test('auto_reply -> REPLY_RECEIVED', () => {
  assert.equal(replyIntentToEvent('auto_reply'), 'REPLY_RECEIVED');
});

test('bounce -> EMAIL_BOUNCED', () => {
  assert.equal(replyIntentToEvent('bounce'), 'EMAIL_BOUNCED');
});

test('neutral -> REPLY_RECEIVED', () => {
  assert.equal(replyIntentToEvent('neutral'), 'REPLY_RECEIVED');
});

// ============================================
// stop_on_reply Simulation
// ============================================
console.log('\n--- stop_on_reply Simulation ---');

test('stop_on_reply=true: replied leads excluded from follow-up', () => {
  const settings = { stopOnReply: true };
  const leads = [
    { id: '1', status: 'contacted' as LeadStatus },
    { id: '2', status: 'replied' as LeadStatus },
    { id: '3', status: 'in_sequence' as LeadStatus },
    { id: '4', status: 'interested' as LeadStatus },
  ];
  const eligible = leads.filter(l => {
    if (settings.stopOnReply && leadStateMachine.blocksSequence(l.status)) return false;
    return true;
  });
  // contacted and in_sequence do NOT block sequence, so both are eligible
  assert.equal(eligible.length, 2);
  assert.deepEqual(eligible.map(l => l.id), ['1', '3']);
});

test('stop_on_reply=false: replied leads continue receiving follow-ups', () => {
  const settings = { stopOnReply: false };
  const leads = [
    { id: '1', status: 'contacted' as LeadStatus },
    { id: '2', status: 'replied' as LeadStatus },
    { id: '3', status: 'in_sequence' as LeadStatus },
  ];
  // When stopOnReply is false, only terminal states block
  const eligible = leads.filter(l => {
    if (settings.stopOnReply && leadStateMachine.blocksSequence(l.status)) return false;
    if (leadStateMachine.isTerminalState(l.status)) return false;
    return true;
  });
  assert.equal(eligible.length, 3);
});

test('stop_on_reply does not affect terminal states', () => {
  const settings = { stopOnReply: false };
  const leads = [
    { id: '1', status: 'bounced' as LeadStatus },
    { id: '2', status: 'unsubscribed' as LeadStatus },
    { id: '3', status: 'spam_reported' as LeadStatus },
    { id: '4', status: 'contacted' as LeadStatus },
  ];
  const eligible = leads.filter(l => !leadStateMachine.isTerminalState(l.status));
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, '4');
});

// ============================================
// Lead Status Transitions (full chain)
// ============================================
console.log('\n--- Lead Status Transitions (Full Chain) ---');

test('Full chain: pending -> in_sequence -> contacted -> replied -> interested -> meeting_booked', () => {
  const sm = new LeadStateMachine();
  let status: LeadStatus = 'pending';

  const next1 = sm.canTransition(status, 'EMAIL_SENT');
  assert.equal(next1, 'in_sequence');
  status = next1!;

  const next2 = sm.canTransition(status, 'EMAIL_SENT');
  assert.equal(next2, 'contacted');
  status = next2!;

  const next3 = sm.canTransition(status, 'REPLY_RECEIVED');
  assert.equal(next3, 'replied');
  status = next3!;

  const next4 = sm.canTransition(status, 'REPLY_INTERESTED');
  assert.equal(next4, 'interested');
  status = next4!;

  const next5 = sm.canTransition(status, 'MEETING_BOOKED');
  assert.equal(next5, 'meeting_booked');
});

test('pending -> in_sequence via EMAIL_SENT', () => {
  assert.equal(leadStateMachine.canTransition('pending', 'EMAIL_SENT'), 'in_sequence');
});

test('in_sequence -> contacted via EMAIL_SENT', () => {
  assert.equal(leadStateMachine.canTransition('in_sequence', 'EMAIL_SENT'), 'contacted');
});

test('contacted -> contacted via EMAIL_SENT (re-engagement)', () => {
  assert.equal(leadStateMachine.canTransition('contacted', 'EMAIL_SENT'), 'contacted');
});

test('contacted -> replied via REPLY_RECEIVED', () => {
  assert.equal(leadStateMachine.canTransition('contacted', 'REPLY_RECEIVED'), 'replied');
});

test('in_sequence -> sequence_complete via SEQUENCE_COMPLETE', () => {
  assert.equal(leadStateMachine.canTransition('in_sequence', 'SEQUENCE_COMPLETE'), 'sequence_complete');
});

test('contacted -> sequence_complete via SEQUENCE_COMPLETE', () => {
  assert.equal(leadStateMachine.canTransition('contacted', 'SEQUENCE_COMPLETE'), 'sequence_complete');
});

// ============================================
// Terminal States Blocking Sequence
// ============================================
console.log('\n--- Terminal States Blocking Sequence ---');

test('bounced blocks sequence via blocksSequence()', () => {
  assert.equal(leadStateMachine.blocksSequence('bounced'), true);
});

test('unsubscribed blocks sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('unsubscribed'), true);
});

test('spam_reported blocks sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('spam_reported'), true);
});

test('replied blocks sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('replied'), true);
});

test('interested blocks sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('interested'), true);
});

test('not_interested blocks sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('not_interested'), true);
});

test('meeting_booked blocks sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('meeting_booked'), true);
});

// ============================================
// Non-Terminal States Do NOT Block Sequence
// ============================================
console.log('\n--- Non-Terminal States ---');

test('pending does NOT block sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('pending'), false);
});

test('in_sequence does NOT block sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('in_sequence'), false);
});

test('contacted does NOT block sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('contacted'), false);
});

test('soft_bounced does NOT block sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('soft_bounced'), false);
});

test('sequence_complete does NOT block sequence', () => {
  assert.equal(leadStateMachine.blocksSequence('sequence_complete'), false);
});

// ============================================
// Manual Override Protection
// ============================================
console.log('\n--- Manual Override Protection ---');

test('intent_manual_override=true skips batch re-classification', () => {
  interface Reply { id: string; intent: ReplyIntent; intent_manual_override: boolean }
  const replies: Reply[] = [
    { id: '1', intent: 'neutral', intent_manual_override: false },
    { id: '2', intent: 'interested', intent_manual_override: true },
    { id: '3', intent: 'question', intent_manual_override: false },
    { id: '4', intent: 'not_interested', intent_manual_override: true },
    { id: '5', intent: 'out_of_office', intent_manual_override: false },
  ];
  const toProcess = replies.filter(r => !r.intent_manual_override);
  const skipped = replies.filter(r => r.intent_manual_override);
  assert.equal(toProcess.length, 3);
  assert.equal(skipped.length, 2);
  assert.deepEqual(skipped.map(r => r.id), ['2', '4']);
});

test('Manual override preserves original intent after batch', () => {
  const manualReply = { id: '2', intent: 'interested' as ReplyIntent, intent_manual_override: true };
  // Simulate batch re-classification that would change to 'neutral'
  const newIntent: ReplyIntent = 'neutral';
  const finalIntent = manualReply.intent_manual_override ? manualReply.intent : newIntent;
  assert.equal(finalIntent, 'interested', 'Manual override should preserve original intent');
});

// ============================================
// Batch Re-Classify Simulation
// ============================================
console.log('\n--- Batch Re-Classify Simulation ---');

test('Batch re-classify: process N replies, skip manual overrides, count correctly', () => {
  interface Reply { id: string; intent: ReplyIntent; intent_manual_override: boolean }
  const replies: Reply[] = Array.from({ length: 20 }, (_, i) => ({
    id: String(i + 1),
    intent: 'neutral' as ReplyIntent,
    intent_manual_override: i % 4 === 0, // every 4th has manual override
  }));

  let processed = 0;
  let skipped = 0;
  const newClassifications: Record<string, ReplyIntent> = {};

  for (const reply of replies) {
    if (reply.intent_manual_override) {
      skipped++;
      continue;
    }
    processed++;
    newClassifications[reply.id] = 'interested'; // simulate AI re-classification
  }

  assert.equal(skipped, 5, '5 replies with manual override should be skipped');
  assert.equal(processed, 15, '15 replies should be processed');
  assert.equal(Object.keys(newClassifications).length, 15);
});

test('Batch re-classify: all manual overrides results in 0 processed', () => {
  interface Reply { id: string; intent_manual_override: boolean }
  const replies: Reply[] = Array.from({ length: 5 }, (_, i) => ({
    id: String(i + 1),
    intent_manual_override: true,
  }));
  const toProcess = replies.filter(r => !r.intent_manual_override);
  assert.equal(toProcess.length, 0);
});

test('Batch re-classify: no manual overrides results in all processed', () => {
  interface Reply { id: string; intent_manual_override: boolean }
  const replies: Reply[] = Array.from({ length: 8 }, (_, i) => ({
    id: String(i + 1),
    intent_manual_override: false,
  }));
  const toProcess = replies.filter(r => !r.intent_manual_override);
  assert.equal(toProcess.length, 8);
});

// ============================================
// Mid-Campaign stop_on_reply Toggle
// ============================================
console.log('\n--- Mid-Campaign stop_on_reply Toggle ---');

test('Toggle off mid-campaign: replied leads become eligible for follow-ups', () => {
  // Phase 1: stop_on_reply is true
  let settings = { stopOnReply: true };
  const leads = [
    { id: '1', status: 'replied' as LeadStatus },
    { id: '2', status: 'contacted' as LeadStatus },
    { id: '3', status: 'interested' as LeadStatus },
    { id: '4', status: 'in_sequence' as LeadStatus },
  ];

  let eligible = leads.filter(l => {
    if (settings.stopOnReply && leadStateMachine.blocksSequence(l.status)) return false;
    if (leadStateMachine.isTerminalState(l.status)) return false;
    return true;
  });
  // contacted and in_sequence don't block; replied and interested do
  assert.equal(eligible.length, 2, 'With stop_on_reply=true, only non-blocking leads are eligible');

  // Phase 2: Toggle off
  settings = { stopOnReply: false };
  eligible = leads.filter(l => {
    if (settings.stopOnReply && leadStateMachine.blocksSequence(l.status)) return false;
    if (leadStateMachine.isTerminalState(l.status)) return false;
    return true;
  });
  assert.equal(eligible.length, 4, 'With stop_on_reply=false, all non-terminal leads are eligible');
});

// ============================================
// State Machine getAvailableEvents
// ============================================
console.log('\n--- getAvailableEvents ---');

test('pending: available events include EMAIL_SENT', () => {
  const events = leadStateMachine.getAvailableEvents('pending');
  assert.ok(events.includes('EMAIL_SENT'), 'pending should have EMAIL_SENT');
});

test('pending: available events include SOFT_BOUNCE and EMAIL_BOUNCED', () => {
  const events = leadStateMachine.getAvailableEvents('pending');
  assert.ok(events.includes('SOFT_BOUNCE'), 'pending should have SOFT_BOUNCE');
  assert.ok(events.includes('EMAIL_BOUNCED'), 'pending should have EMAIL_BOUNCED');
});

test('in_sequence: available events include EMAIL_SENT, REPLY_RECEIVED, REPLY_INTERESTED', () => {
  const events = leadStateMachine.getAvailableEvents('in_sequence');
  assert.ok(events.includes('EMAIL_SENT'));
  assert.ok(events.includes('REPLY_RECEIVED'));
  assert.ok(events.includes('REPLY_INTERESTED'));
});

test('contacted: available events include REPLY_RECEIVED and SEQUENCE_COMPLETE', () => {
  const events = leadStateMachine.getAvailableEvents('contacted');
  assert.ok(events.includes('REPLY_RECEIVED'));
  assert.ok(events.includes('SEQUENCE_COMPLETE'));
});

test('replied: available events include REPLY_INTERESTED, REPLY_NOT_INTERESTED, MEETING_BOOKED', () => {
  const events = leadStateMachine.getAvailableEvents('replied');
  assert.ok(events.includes('REPLY_INTERESTED'));
  assert.ok(events.includes('REPLY_NOT_INTERESTED'));
  assert.ok(events.includes('MEETING_BOOKED'));
});

test('bounced (terminal): only MANUAL_OVERRIDE available', () => {
  const events = leadStateMachine.getAvailableEvents('bounced');
  assert.deepEqual(events, ['MANUAL_OVERRIDE']);
});

test('unsubscribed (terminal): only MANUAL_OVERRIDE available', () => {
  const events = leadStateMachine.getAvailableEvents('unsubscribed');
  assert.deepEqual(events, ['MANUAL_OVERRIDE']);
});

test('spam_reported (terminal): only MANUAL_OVERRIDE available', () => {
  const events = leadStateMachine.getAvailableEvents('spam_reported');
  assert.deepEqual(events, ['MANUAL_OVERRIDE']);
});

// ============================================
// isTerminalState
// ============================================
console.log('\n--- isTerminalState ---');

test('bounced is terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('bounced'), true);
});

test('unsubscribed is terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('unsubscribed'), true);
});

test('spam_reported is terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('spam_reported'), true);
});

test('pending is NOT terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('pending'), false);
});

test('in_sequence is NOT terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('in_sequence'), false);
});

test('contacted is NOT terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('contacted'), false);
});

test('replied is NOT terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('replied'), false);
});

test('interested is NOT terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('interested'), false);
});

test('meeting_booked is NOT terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('meeting_booked'), false);
});

test('soft_bounced is NOT terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('soft_bounced'), false);
});

test('sequence_complete is NOT terminal', () => {
  assert.equal(leadStateMachine.isTerminalState('sequence_complete'), false);
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
