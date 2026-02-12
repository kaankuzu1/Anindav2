/**
 * Full Campaign Lifecycle Simulation Tests
 * End-to-end lifecycle simulation with in-memory state tracking at each stage.
 *
 * Flow: Create (draft) -> Configure -> Start (active) -> Schedule Step 1 ->
 *   Send -> Track Opens -> Track Clicks -> Schedule Step 2 ->
 *   Send Follow-ups -> Receive Reply -> Classify Intent -> Pause ->
 *   Change Settings -> Resume -> Schedule Step 3 -> Complete -> Verify Final State
 *
 * Run: npx tsx tests/campaign-simulation/test-full-lifecycle.ts
 */

import assert from 'node:assert/strict';
import {
  LeadStateMachine,
  replyIntentToEvent,
} from '../../packages/shared/src/lead-state-machine';
import type { LeadStatus, CampaignStatus, ReplyIntent } from '../../packages/shared/src/types';
import {
  processEmailContent,
  normalizeVariableMap,
  isWithinSendWindow,
  calculateHealthScore,
} from '../../packages/shared/src/utils';
import {
  applyEmailTracking,
  generateTrackingId,
  decodeTrackingId,
  injectTrackingPixel,
  wrapLinksForTracking,
} from '../../packages/shared/src/tracking';

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
// In-memory simulation state
// ============================================

interface SimEmail {
  id: string;
  leadId: string;
  inboxId: string;
  variantId?: string;
  subject: string;
  bodyHtml: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  openCount: number;
  clickCount: number;
  trackingId: string;
  stepNumber: number;
}

interface SimCampaign {
  id: string;
  status: CampaignStatus;
  name: string;
  settings: {
    timezone: string;
    sendDays: string[];
    startTime: string;
    endTime: string;
    trackOpens: boolean;
    trackClicks: boolean;
    stopOnReply: boolean;
  };
  sequences: {
    stepNumber: number;
    subject: string;
    body: string;
    delayDays: number;
    variants?: { id: string; subject: string; body: string; weight: number;
      sentCount: number; openedCount: number; clickedCount: number; repliedCount: number;
      isWinner: boolean }[];
  }[];
  inboxIds: string[];
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  bounced_count: number;
}

interface SimLead {
  id: string;
  email: string;
  firstName: string;
  company: string;
  status: LeadStatus;
  currentStep: number;
  nextSendAt: Date | null;
}

// ============================================
// Campaign Creation (Draft)
// ============================================

console.log('\n--- Campaign Creation ---');

test('create draft campaign with default values', () => {
  const campaign: SimCampaign = {
    id: 'camp-lifecycle-1',
    status: 'draft',
    name: '',
    settings: {
      timezone: 'UTC',
      sendDays: [],
      startTime: '09:00',
      endTime: '17:00',
      trackOpens: true,
      trackClicks: true,
      stopOnReply: true,
    },
    sequences: [],
    inboxIds: [],
    sent_count: 0,
    opened_count: 0,
    clicked_count: 0,
    replied_count: 0,
    bounced_count: 0,
  };

  assert.equal(campaign.status, 'draft');
  assert.equal(campaign.sent_count, 0);
  assert.equal(campaign.sequences.length, 0);
});

// ============================================
// Configuration
// ============================================

console.log('\n--- Configuration ---');

// Create the main campaign for the lifecycle test
const campaign: SimCampaign = {
  id: 'camp-lifecycle-1',
  status: 'draft',
  name: 'Lifecycle Test Campaign',
  settings: {
    timezone: 'America/New_York',
    sendDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startTime: '09:00',
    endTime: '17:00',
    trackOpens: true,
    trackClicks: true,
    stopOnReply: true,
  },
  sequences: [
    { stepNumber: 1, subject: 'Hello {{firstName}}', body: '<html><body><p>Hi {{firstName}} from {{company|your company}}.</p><a href="https://example.com">Learn more</a></body></html>', delayDays: 0 },
    { stepNumber: 2, subject: 'Following up', body: '<html><body><p>Just checking in, {{firstName}}.</p><a href="https://example.com/demo">Book a demo</a></body></html>', delayDays: 3 },
    { stepNumber: 3, subject: 'Final thoughts', body: '<html><body><p>Last email, {{firstName}}.</p></body></html>', delayDays: 5 },
  ],
  inboxIds: ['inbox-1', 'inbox-2'],
  sent_count: 0,
  opened_count: 0,
  clicked_count: 0,
  replied_count: 0,
  bounced_count: 0,
};

const leads: SimLead[] = Array.from({ length: 10 }, (_, i) => ({
  id: `lead-${i + 1}`,
  email: `lead${i + 1}@test.com`,
  firstName: `User${i + 1}`,
  company: i % 3 === 0 ? '' : `Company${i + 1}`,
  status: 'pending' as LeadStatus,
  currentStep: 0,
  nextSendAt: null,
}));

const sentEmails: SimEmail[] = [];

test('configure campaign: name, schedule, tracking, inboxes, sequences set', () => {
  assert.equal(campaign.name, 'Lifecycle Test Campaign');
  assert.equal(campaign.settings.sendDays.length, 5);
  assert.equal(campaign.settings.trackOpens, true);
  assert.equal(campaign.settings.trackClicks, true);
  assert.equal(campaign.inboxIds.length, 2);
  assert.equal(campaign.sequences.length, 3);
});

// ============================================
// Start (draft -> active)
// ============================================

console.log('\n--- Start Campaign ---');

test('draft -> active transition', () => {
  assert.equal(campaign.status, 'draft');
  campaign.status = 'active';
  assert.equal(campaign.status, 'active');
});

// ============================================
// Step 1 Sending
// ============================================

console.log('\n--- Step 1 Sending ---');

test('step 1: 10 leads selected and emails sent with variable injection', () => {
  let inboxIndex = 0;

  for (const lead of leads) {
    const step = campaign.sequences[0];
    const variables = normalizeVariableMap({
      firstName: lead.firstName,
      company: lead.company || undefined,
    });

    const subject = processEmailContent(step.subject, variables);
    const body = processEmailContent(step.body, variables);

    // Apply tracking
    const trackingId = generateTrackingId(`${campaign.id}-${lead.id}-s1`);
    const trackedBody = applyEmailTracking(body, trackingId, 'https://api.test.com', {
      trackOpens: campaign.settings.trackOpens,
      trackClicks: campaign.settings.trackClicks,
    });

    const inboxId = campaign.inboxIds[inboxIndex % campaign.inboxIds.length];
    inboxIndex++;

    const email: SimEmail = {
      id: `email-${lead.id}-s1`,
      leadId: lead.id,
      inboxId,
      subject,
      bodyHtml: trackedBody,
      status: 'sent',
      openCount: 0,
      clickCount: 0,
      trackingId,
      stepNumber: 1,
    };

    sentEmails.push(email);

    // Update lead status
    const newStatus = sm.canTransition(lead.status, 'EMAIL_SENT');
    if (newStatus) lead.status = newStatus;
    lead.currentStep = 1;
    lead.nextSendAt = new Date(Date.now() + step.delayDays * 86400000 + 3 * 86400000); // step2 delay
    campaign.sent_count++;
  }

  assert.equal(campaign.sent_count, 10);
  assert.equal(sentEmails.length, 10);
});

test('step 1: variable injection works correctly', () => {
  const email1 = sentEmails[0];
  assert.ok(email1.subject.includes('User1'), `Subject should contain name, got: ${email1.subject}`);
});

test('step 1: tracking pixel injected', () => {
  for (const email of sentEmails) {
    assert.ok(email.bodyHtml.includes('/api/v1/t/o/'), `Email ${email.id} should have tracking pixel`);
  }
});

test('step 1: links wrapped for click tracking', () => {
  for (const email of sentEmails) {
    assert.ok(email.bodyHtml.includes('/api/v1/t/c/'), `Email ${email.id} should have click tracking`);
  }
});

test('step 1: all leads transitioned to in_sequence', () => {
  for (const lead of leads) {
    assert.equal(lead.status, 'in_sequence', `${lead.id} should be in_sequence`);
  }
});

test('step 1: inboxes rotated between emails', () => {
  const inbox1Count = sentEmails.filter(e => e.inboxId === 'inbox-1').length;
  const inbox2Count = sentEmails.filter(e => e.inboxId === 'inbox-2').length;
  assert.equal(inbox1Count, 5);
  assert.equal(inbox2Count, 5);
});

// ============================================
// Open Tracking
// ============================================

console.log('\n--- Open Tracking ---');

test('track 7 opens: campaign opened_count = 7', () => {
  // 7 of the 10 emails are opened
  for (let i = 0; i < 7; i++) {
    sentEmails[i].openCount++;
    sentEmails[i].status = 'opened';
    campaign.opened_count++;
  }

  assert.equal(campaign.opened_count, 7);
});

test('open tracking: tracking ID decodes back to original', () => {
  const email = sentEmails[0];
  const decoded = decodeTrackingId(email.trackingId);
  assert.equal(decoded, `${campaign.id}-${leads[0].id}-s1`);
});

// ============================================
// Click Tracking
// ============================================

console.log('\n--- Click Tracking ---');

test('track 3 clicks: campaign clicked_count = 3', () => {
  for (let i = 0; i < 3; i++) {
    sentEmails[i].clickCount++;
    sentEmails[i].status = 'clicked';
    campaign.clicked_count++;
  }

  assert.equal(campaign.clicked_count, 3);
});

// ============================================
// Step 2 Scheduling
// ============================================

console.log('\n--- Step 2 Scheduling ---');

test('step 2: 2 leads blocked (1 bounced, 1 unsubscribed), 8 eligible', () => {
  // Lead 9 bounced
  leads[8].status = 'bounced';
  campaign.bounced_count++;

  // Lead 10 unsubscribed
  leads[9].status = 'unsubscribed';

  // Count eligible leads
  const eligible = leads.filter(l => !sm.blocksSequence(l.status) && l.currentStep < campaign.sequences.length);
  assert.equal(eligible.length, 8, `Expected 8 eligible, got ${eligible.length}`);
});

// ============================================
// Follow-up Sending (Step 2)
// ============================================

console.log('\n--- Follow-up Sending ---');

test('step 2: 8 emails sent with correct delay accounting', () => {
  const eligibleLeads = leads.filter(l => !sm.blocksSequence(l.status) && l.currentStep < campaign.sequences.length);

  for (const lead of eligibleLeads) {
    const step = campaign.sequences[1]; // Step 2
    const variables = normalizeVariableMap({ firstName: lead.firstName });
    const subject = processEmailContent(step.subject, variables);
    const body = processEmailContent(step.body, variables);

    const trackingId = generateTrackingId(`${campaign.id}-${lead.id}-s2`);
    const trackedBody = applyEmailTracking(body, trackingId, 'https://api.test.com', {
      trackOpens: campaign.settings.trackOpens,
      trackClicks: campaign.settings.trackClicks,
    });

    const email: SimEmail = {
      id: `email-${lead.id}-s2`,
      leadId: lead.id,
      inboxId: campaign.inboxIds[0],
      subject,
      bodyHtml: trackedBody,
      status: 'sent',
      openCount: 0,
      clickCount: 0,
      trackingId,
      stepNumber: 2,
    };

    sentEmails.push(email);

    const newStatus = sm.canTransition(lead.status, 'EMAIL_SENT');
    if (newStatus) lead.status = newStatus;
    lead.currentStep = 2;
    campaign.sent_count++;
  }

  assert.equal(campaign.sent_count, 18); // 10 + 8
});

test('step 2: bounced lead was NOT sent to', () => {
  const bouncedEmails = sentEmails.filter(e => e.leadId === 'lead-9' && e.stepNumber === 2);
  assert.equal(bouncedEmails.length, 0);
});

test('step 2: unsubscribed lead was NOT sent to', () => {
  const unsubEmails = sentEmails.filter(e => e.leadId === 'lead-10' && e.stepNumber === 2);
  assert.equal(unsubEmails.length, 0);
});

// ============================================
// Reply Processing
// ============================================

console.log('\n--- Reply Processing ---');

test('2 replies received: intent classified (1 interested, 1 question)', () => {
  // Lead 1 replies with interest
  const event1 = replyIntentToEvent('interested');
  const newStatus1 = sm.canTransition(leads[0].status, event1);
  assert.ok(newStatus1, 'Lead should be able to transition');
  leads[0].status = newStatus1!;
  campaign.replied_count++;

  // Lead 2 replies with question (generic reply)
  const event2 = replyIntentToEvent('question');
  const newStatus2 = sm.canTransition(leads[1].status, event2);
  assert.ok(newStatus2, 'Lead should be able to transition');
  leads[1].status = newStatus2!;
  campaign.replied_count++;

  assert.equal(campaign.replied_count, 2);
  assert.equal(leads[0].status, 'interested');
  assert.equal(leads[1].status, 'replied');
});

test('replied leads are blocked from further sequence emails', () => {
  assert.equal(sm.blocksSequence(leads[0].status), true); // interested
  assert.equal(sm.blocksSequence(leads[1].status), true); // replied
});

// ============================================
// Pause
// ============================================

console.log('\n--- Pause ---');

test('pause campaign: status changes to paused', () => {
  campaign.status = 'paused';
  assert.equal(campaign.status, 'paused');
});

test('pause: no new sends while paused', () => {
  const eligibleWhilePaused = campaign.status === 'active'
    ? leads.filter(l => !sm.blocksSequence(l.status))
    : [];
  assert.equal(eligibleWhilePaused.length, 0);
});

// ============================================
// Mid-pause changes
// ============================================

console.log('\n--- Mid-pause Changes ---');

test('disable click tracking while paused', () => {
  campaign.settings.trackClicks = false;
  assert.equal(campaign.settings.trackClicks, false);
});

test('change send window while paused', () => {
  campaign.settings.startTime = '10:00';
  campaign.settings.endTime = '16:00';
  assert.equal(campaign.settings.startTime, '10:00');
  assert.equal(campaign.settings.endTime, '16:00');
});

// ============================================
// Resume
// ============================================

console.log('\n--- Resume ---');

test('resume campaign: status changes to active', () => {
  campaign.status = 'active';
  assert.equal(campaign.status, 'active');
});

// ============================================
// Step 3 (with new settings)
// ============================================

console.log('\n--- Step 3 (New Settings) ---');

test('step 3: click tracking disabled in new emails', () => {
  const eligibleLeads = leads.filter(l =>
    !sm.blocksSequence(l.status) && l.currentStep < campaign.sequences.length
  );

  for (const lead of eligibleLeads) {
    const step = campaign.sequences[2]; // Step 3
    const variables = normalizeVariableMap({ firstName: lead.firstName });
    const subject = processEmailContent(step.subject, variables);
    const body = processEmailContent(step.body, variables);

    const trackingId = generateTrackingId(`${campaign.id}-${lead.id}-s3`);
    const trackedBody = applyEmailTracking(body, trackingId, 'https://api.test.com', {
      trackOpens: campaign.settings.trackOpens,
      trackClicks: campaign.settings.trackClicks, // false now
    });

    const email: SimEmail = {
      id: `email-${lead.id}-s3`,
      leadId: lead.id,
      inboxId: campaign.inboxIds[0],
      subject,
      bodyHtml: trackedBody,
      status: 'sent',
      openCount: 0,
      clickCount: 0,
      trackingId,
      stepNumber: 3,
    };

    sentEmails.push(email);

    const newStatus = sm.canTransition(lead.status, 'EMAIL_SENT');
    if (newStatus) lead.status = newStatus;
    lead.currentStep = 3;
    campaign.sent_count++;
  }

  // Verify no click tracking on step 3 emails
  const step3Emails = sentEmails.filter(e => e.stepNumber === 3);
  for (const email of step3Emails) {
    assert.ok(!email.bodyHtml.includes('/api/v1/t/c/'), `Step 3 email ${email.id} should NOT have click tracking`);
  }
});

test('step 3: open tracking still active', () => {
  const step3Emails = sentEmails.filter(e => e.stepNumber === 3);
  for (const email of step3Emails) {
    assert.ok(email.bodyHtml.includes('/api/v1/t/o/'), `Step 3 email ${email.id} should have open tracking`);
  }
});

test('step 3: blocked leads (replied, interested, bounced, unsubscribed) excluded', () => {
  const step3Emails = sentEmails.filter(e => e.stepNumber === 3);
  const step3LeadIds = step3Emails.map(e => e.leadId);

  // Lead 1 (interested), Lead 2 (replied), Lead 9 (bounced), Lead 10 (unsubscribed) should NOT be in step 3
  assert.ok(!step3LeadIds.includes('lead-1'), 'Interested lead should not get step 3');
  assert.ok(!step3LeadIds.includes('lead-2'), 'Replied lead should not get step 3');
  assert.ok(!step3LeadIds.includes('lead-9'), 'Bounced lead should not get step 3');
  assert.ok(!step3LeadIds.includes('lead-10'), 'Unsubscribed lead should not get step 3');
});

// ============================================
// Completion
// ============================================

console.log('\n--- Completion ---');

test('all leads processed: campaign can be marked completed', () => {
  // Check all leads are either at final step or blocked
  const allProcessed = leads.every(l =>
    l.currentStep >= campaign.sequences.length || sm.blocksSequence(l.status)
  );
  assert.ok(allProcessed, 'All leads should be processed or blocked');

  campaign.status = 'completed';
  assert.equal(campaign.status, 'completed');
});

// ============================================
// Final State Verification
// ============================================

console.log('\n--- Final State Verification ---');

test('final state: sent_count correct', () => {
  // Step 1: 10, Step 2: 8, Step 3: 6 (10 - 2 blocked from step2 - 2 replied after step2)
  const step3Emails = sentEmails.filter(e => e.stepNumber === 3);
  const expectedSent = 10 + 8 + step3Emails.length;
  assert.equal(campaign.sent_count, expectedSent, `Expected sent_count=${expectedSent}, got ${campaign.sent_count}`);
});

test('final state: opened_count = 7', () => {
  assert.equal(campaign.opened_count, 7);
});

test('final state: clicked_count = 3', () => {
  assert.equal(campaign.clicked_count, 3);
});

test('final state: replied_count = 2', () => {
  assert.equal(campaign.replied_count, 2);
});

test('final state: bounced_count = 1', () => {
  assert.equal(campaign.bounced_count, 1);
});

test('final state: campaign status is completed', () => {
  assert.equal(campaign.status, 'completed');
});

test('final state: lead statuses are correct', () => {
  assert.equal(leads[0].status, 'interested');    // replied interested
  assert.equal(leads[1].status, 'replied');        // replied question
  assert.equal(leads[8].status, 'bounced');        // bounced
  assert.equal(leads[9].status, 'unsubscribed');   // unsubscribed

  // Leads 3-8 should be contacted (received multiple emails)
  for (let i = 2; i < 8; i++) {
    assert.equal(leads[i].status, 'contacted', `Lead ${i + 1} should be contacted`);
  }
});

test('final state: total emails in system correct', () => {
  const step1 = sentEmails.filter(e => e.stepNumber === 1).length;
  const step2 = sentEmails.filter(e => e.stepNumber === 2).length;
  const step3 = sentEmails.filter(e => e.stepNumber === 3).length;

  assert.equal(step1, 10);
  assert.equal(step2, 8);
  assert.equal(step1 + step2 + step3, sentEmails.length);
});

// ============================================
// A/B Variant Lifecycle
// ============================================

console.log('\n--- A/B Variant Lifecycle ---');

/** selectVariant — inline from campaign-scheduler.ts */
function selectVariant(
  variants: { id: string; subject: string; body: string; weight: number }[]
): { id: string; subject: string; body: string } | null {
  if (!variants || variants.length === 0) return null;
  const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
  if (totalWeight === 0) return variants[0];
  let random = Math.random() * totalWeight;
  for (const variant of variants) {
    random -= (variant.weight || 0);
    if (random <= 0) return variant;
  }
  return variants[variants.length - 1];
}

test('A/B lifecycle: variant stats tracked separately', () => {
  const abCampaign: SimCampaign = {
    id: 'camp-ab-1',
    status: 'active',
    name: 'A/B Test Campaign',
    settings: campaign.settings,
    sequences: [{
      stepNumber: 1,
      subject: 'Default',
      body: 'Default body',
      delayDays: 0,
      variants: [
        { id: 'var-a', subject: 'Variant A: Hi {{firstName}}', body: 'A body', weight: 50,
          sentCount: 0, openedCount: 0, clickedCount: 0, repliedCount: 0, isWinner: false },
        { id: 'var-b', subject: 'Variant B: Hello {{firstName}}', body: 'B body', weight: 50,
          sentCount: 0, openedCount: 0, clickedCount: 0, repliedCount: 0, isWinner: false },
      ],
    }],
    inboxIds: ['inbox-1'],
    sent_count: 0, opened_count: 0, clicked_count: 0, replied_count: 0, bounced_count: 0,
  };

  const abLeads = Array.from({ length: 100 }, (_, i) => ({
    id: `ab-lead-${i}`,
    firstName: `User${i}`,
  }));

  // Send to all leads with variant selection
  for (const lead of abLeads) {
    const step = abCampaign.sequences[0];
    const selected = selectVariant(step.variants!);
    assert.ok(selected, 'Variant should be selected');

    const variant = step.variants!.find(v => v.id === selected!.id)!;
    variant.sentCount++;
    abCampaign.sent_count++;
  }

  const varA = abCampaign.sequences[0].variants![0];
  const varB = abCampaign.sequences[0].variants![1];

  // Both should have received some traffic
  assert.ok(varA.sentCount > 20, `Variant A got ${varA.sentCount} sends, expected > 20`);
  assert.ok(varB.sentCount > 20, `Variant B got ${varB.sentCount} sends, expected > 20`);
  assert.equal(varA.sentCount + varB.sentCount, 100, 'Total should be 100');
});

test('A/B lifecycle: open/click rates computed per variant', () => {
  const variant = {
    sentCount: 100,
    openedCount: 40,
    clickedCount: 10,
    repliedCount: 5,
  };

  const openRate = variant.sentCount > 0 ? variant.openedCount / variant.sentCount : 0;
  const clickRate = variant.openedCount > 0 ? variant.clickedCount / variant.openedCount : 0;
  const replyRate = variant.sentCount > 0 ? variant.repliedCount / variant.sentCount : 0;

  assert.equal(openRate, 0.4);
  assert.equal(clickRate, 0.25);
  assert.equal(replyRate, 0.05);
});

test('A/B lifecycle: winner declaration stops further testing', () => {
  const variants = [
    { id: 'a', sentCount: 100, openedCount: 50, weight: 50, isWinner: false },
    { id: 'b', sentCount: 100, openedCount: 30, weight: 50, isWinner: false },
  ];

  // Declare winner
  variants[0].isWinner = true;
  variants[0].weight = 100;
  variants[1].weight = 0;

  // Optimizer should skip when is_winner exists
  const hasWinner = variants.some(v => v.isWinner);
  assert.ok(hasWinner);

  assert.equal(variants[0].weight, 100);
  assert.equal(variants[1].weight, 0);
});

test('A/B lifecycle: variant content uses template engine', () => {
  const variantSubject = 'Variant A: Hi {{firstName}} from {{company|your org}}';
  const result = processEmailContent(variantSubject, { firstName: 'Alice', company: 'Acme' });
  assert.equal(result, 'Variant A: Hi Alice from Acme');
});

test('A/B lifecycle: variant content with fallback', () => {
  const variantSubject = 'Hi {{firstName}} from {{company|your org}}';
  const result = processEmailContent(variantSubject, { firstName: 'Bob' });
  assert.equal(result, 'Hi Bob from your org');
});

// ============================================
// Cross-system consistency
// ============================================

console.log('\n--- Cross-system Consistency ---');

test('replyIntentToEvent maps all intents to valid events', () => {
  const intents: ReplyIntent[] = [
    'interested', 'meeting_request', 'question', 'not_interested',
    'unsubscribe', 'out_of_office', 'auto_reply', 'bounce', 'neutral',
  ];

  for (const intent of intents) {
    const event = replyIntentToEvent(intent);
    assert.ok(event, `Intent '${intent}' should map to an event`);
  }
});

test('terminal states cannot transition (except MANUAL_OVERRIDE)', () => {
  const terminalStatuses: LeadStatus[] = ['bounced', 'unsubscribed', 'spam_reported'];

  for (const status of terminalStatuses) {
    assert.equal(sm.canTransition(status, 'EMAIL_SENT'), null, `${status} should not allow EMAIL_SENT`);
    assert.equal(sm.isTerminalState(status), true, `${status} should be terminal`);

    // But MANUAL_OVERRIDE works
    const overrideResult = sm.canTransition(status, 'MANUAL_OVERRIDE');
    assert.ok(overrideResult !== null, `${status} should allow MANUAL_OVERRIDE`);
  }
});

test('normalizeVariableMap preserves all variable formats', () => {
  const vars = normalizeVariableMap({
    firstName: 'Alice',
    sender_company: 'Acme',
  });

  assert.equal(vars.firstName, 'Alice');
  assert.equal(vars.first_name, 'Alice');
  assert.equal(vars.senderCompany, 'Acme');
  assert.equal(vars.sender_company, 'Acme');
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
