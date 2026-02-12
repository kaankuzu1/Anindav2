/**
 * Campaign Pause/Resume Simulation Tests
 * Simulates campaign pause/resume behavior with in-memory state.
 *
 * Run: npx tsx tests/campaign-simulation/test-pause-resume.ts
 */

import assert from 'node:assert/strict';
import {
  LeadStateMachine,
} from '../../packages/shared/src/lead-state-machine';
import type { LeadStatus, CampaignStatus } from '../../packages/shared/src/types';
import {
  processEmailContent,
  isWithinSendWindow,
  calculateHealthScore,
} from '../../packages/shared/src/utils';
import {
  applyEmailTracking,
  generateTrackingId,
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
// In-memory campaign & lead state helpers
// ============================================

interface SimCampaign {
  id: string;
  status: CampaignStatus;
  paused_at: Date | null;
  started_at: Date | null;
  settings: {
    timezone: string;
    sendDays: string[];
    startTime: string;
    endTime: string;
    trackOpens: boolean;
    trackClicks: boolean;
    stopOnReply: boolean;
  };
  sequences: { stepNumber: number; subject: string; body: string; delayDays: number }[];
  sent_count: number;
}

interface SimLead {
  id: string;
  status: LeadStatus;
  current_step: number;
  next_send_at: Date | null;
  emails_sent: number;
}

function createCampaign(overrides?: Partial<SimCampaign>): SimCampaign {
  return {
    id: 'camp-1',
    status: 'active',
    paused_at: null,
    started_at: new Date('2026-01-15T09:00:00Z'),
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
      { stepNumber: 1, subject: 'Hello {{firstName}}', body: 'Body 1', delayDays: 0 },
      { stepNumber: 2, subject: 'Follow up', body: 'Body 2', delayDays: 3 },
      { stepNumber: 3, subject: 'Final', body: 'Body 3', delayDays: 5 },
    ],
    sent_count: 0,
    ...overrides,
  };
}

function createLeads(count: number): SimLead[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `lead-${i + 1}`,
    status: 'pending' as LeadStatus,
    current_step: 0,
    next_send_at: null,
    emails_sent: 0,
  }));
}

/** Simulate scheduler tick: enqueue emails for eligible leads */
function schedulerTick(campaign: SimCampaign, leads: SimLead[]): string[] {
  if (campaign.status !== 'active') return [];

  const queued: string[] = [];
  for (const lead of leads) {
    if (sm.blocksSequence(lead.status)) continue;
    if (lead.next_send_at && lead.next_send_at > new Date()) continue;
    if (lead.current_step >= campaign.sequences.length) continue;
    queued.push(lead.id);
  }
  return queued;
}

/** Simulate sending an email to a lead */
function sendEmail(campaign: SimCampaign, lead: SimLead): void {
  const step = campaign.sequences[lead.current_step];
  if (!step) return;

  // Process template
  processEmailContent(step.subject, { firstName: 'Test' });

  // Transition status
  const newStatus = sm.canTransition(lead.status, 'EMAIL_SENT');
  if (newStatus) lead.status = newStatus;

  lead.emails_sent++;
  lead.current_step++;
  campaign.sent_count++;

  // Set next_send_at if there's a next step
  if (lead.current_step < campaign.sequences.length) {
    const nextStep = campaign.sequences[lead.current_step];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + nextStep.delayDays);
    lead.next_send_at = nextDate;
  }
}

function pauseCampaign(campaign: SimCampaign): boolean {
  if (campaign.status !== 'active') return false;
  campaign.status = 'paused';
  campaign.paused_at = new Date();
  return true;
}

function resumeCampaign(campaign: SimCampaign): boolean {
  if (campaign.status !== 'paused') return false;
  campaign.status = 'active';
  return true;
}

// ============================================
// Pause Behavior
// ============================================

console.log('\n--- Pause Behavior ---');

test('paused campaign: scheduler returns no emails', () => {
  const campaign = createCampaign({ status: 'paused' });
  const leads = createLeads(5);
  const queued = schedulerTick(campaign, leads);
  assert.equal(queued.length, 0, 'No emails should be queued for paused campaign');
});

test('paused campaign: status is paused', () => {
  const campaign = createCampaign();
  pauseCampaign(campaign);
  assert.equal(campaign.status, 'paused');
});

test('paused campaign: paused_at timestamp is set', () => {
  const campaign = createCampaign();
  pauseCampaign(campaign);
  assert.ok(campaign.paused_at, 'paused_at should be set');
  assert.ok(campaign.paused_at instanceof Date);
});

test('paused campaign: existing queued emails are not processed', () => {
  const campaign = createCampaign();
  const leads = createLeads(3);

  // Send step 1 to all leads
  for (const lead of leads) sendEmail(campaign, lead);
  assert.equal(campaign.sent_count, 3);

  // Pause before step 2
  pauseCampaign(campaign);

  // Scheduler should return nothing
  const queued = schedulerTick(campaign, leads);
  assert.equal(queued.length, 0);
});

test('paused campaign: new leads added while paused are not sent', () => {
  const campaign = createCampaign({ status: 'paused' });
  const newLeads = createLeads(2);
  const queued = schedulerTick(campaign, newLeads);
  assert.equal(queued.length, 0);
});

// ============================================
// Resume Behavior
// ============================================

console.log('\n--- Resume Behavior ---');

test('resume: paused → active transition', () => {
  const campaign = createCampaign();
  pauseCampaign(campaign);
  assert.equal(campaign.status, 'paused');

  resumeCampaign(campaign);
  assert.equal(campaign.status, 'active');
});

test('resume: scheduler processes leads after resume', () => {
  const campaign = createCampaign();
  const leads = createLeads(3);

  pauseCampaign(campaign);
  assert.equal(schedulerTick(campaign, leads).length, 0);

  resumeCampaign(campaign);
  const queued = schedulerTick(campaign, leads);
  assert.equal(queued.length, 3, 'All 3 pending leads should be queued after resume');
});

test('resume: picks up from current step', () => {
  const campaign = createCampaign();
  const leads = createLeads(2);

  // Send step 1
  for (const lead of leads) sendEmail(campaign, lead);
  assert.equal(leads[0].current_step, 1);
  assert.equal(leads[0].status, 'in_sequence');

  // Pause then resume
  pauseCampaign(campaign);
  resumeCampaign(campaign);

  // Leads should be at step 1 (0-indexed current_step = 1 means ready for step 2)
  assert.equal(leads[0].current_step, 1);
  assert.equal(leads[1].current_step, 1);
});

// ============================================
// Already-contacted leads NOT re-sent
// ============================================

console.log('\n--- Already-contacted NOT re-sent ---');

test('leads at step 2 do not get step 1 again after resume', () => {
  const campaign = createCampaign();
  const leads = createLeads(3);

  // Send step 1 to all
  for (const lead of leads) sendEmail(campaign, lead);

  // Send step 2 to lead 1 only (simulate delay passed)
  leads[0].next_send_at = new Date(Date.now() - 1000); // in the past
  sendEmail(campaign, leads[0]);
  assert.equal(leads[0].current_step, 2);
  assert.equal(leads[0].status, 'contacted');

  // Pause and resume
  pauseCampaign(campaign);
  resumeCampaign(campaign);

  // Lead 1 is at step 2, should not get step 1 again
  assert.equal(leads[0].current_step, 2);
  // Lead 1 was already contacted, scheduler should not re-queue step 1
  // Verify by checking the step index
  assert.ok(leads[0].current_step > 0, 'Lead should remain at advanced step');
});

test('contacted leads with blocksSequence=false can continue', () => {
  assert.equal(sm.blocksSequence('contacted'), false);
  assert.equal(sm.blocksSequence('in_sequence'), false);
});

test('replied leads are blocked after resume', () => {
  const campaign = createCampaign();
  const leads = createLeads(2);

  // Send step 1
  for (const lead of leads) sendEmail(campaign, lead);

  // Lead 1 replies
  leads[0].status = sm.canTransition(leads[0].status, 'REPLY_RECEIVED')!;
  assert.equal(leads[0].status, 'replied');

  pauseCampaign(campaign);
  resumeCampaign(campaign);

  // Scheduler should skip replied lead
  const queued = schedulerTick(campaign, leads);
  assert.ok(!queued.includes('lead-1'), 'Replied lead should not be queued');
});

// ============================================
// Multi-step continuity
// ============================================

console.log('\n--- Multi-step Continuity ---');

test('pause during step 2: resume continues from step 2', () => {
  const campaign = createCampaign();
  const leads = createLeads(5);

  // Send step 1 to all
  for (const lead of leads) sendEmail(campaign, lead);

  // Send step 2 to first 2 leads
  leads[0].next_send_at = new Date(Date.now() - 1000);
  leads[1].next_send_at = new Date(Date.now() - 1000);
  sendEmail(campaign, leads[0]);
  sendEmail(campaign, leads[1]);

  // Pause mid-step-2
  pauseCampaign(campaign);

  // Verify state preserved
  assert.equal(leads[0].current_step, 2); // Done with step 2
  assert.equal(leads[2].current_step, 1); // Still needs step 2

  // Resume
  resumeCampaign(campaign);

  // Leads 2,3,4 should be eligible for step 2 (when delay passes)
  assert.equal(leads[2].current_step, 1);
  assert.equal(leads[3].current_step, 1);
  assert.equal(leads[4].current_step, 1);
});

test('multi-step: lead progress is preserved across pause/resume', () => {
  const campaign = createCampaign();
  const leads = createLeads(1);

  // Step 1
  sendEmail(campaign, leads[0]);
  assert.equal(leads[0].current_step, 1);

  pauseCampaign(campaign);
  resumeCampaign(campaign);

  // Step 2
  leads[0].next_send_at = new Date(Date.now() - 1000);
  sendEmail(campaign, leads[0]);
  assert.equal(leads[0].current_step, 2);

  pauseCampaign(campaign);
  resumeCampaign(campaign);

  // Step 3
  leads[0].next_send_at = new Date(Date.now() - 1000);
  sendEmail(campaign, leads[0]);
  assert.equal(leads[0].current_step, 3);
  assert.equal(leads[0].emails_sent, 3);
});

// ============================================
// Delay timers NOT reset
// ============================================

console.log('\n--- Delay Timers NOT Reset ---');

test('next_send_at preserved after pause/resume', () => {
  const campaign = createCampaign();
  const leads = createLeads(1);

  sendEmail(campaign, leads[0]);
  const originalNextSend = leads[0].next_send_at;
  assert.ok(originalNextSend, 'next_send_at should be set after step 1');

  pauseCampaign(campaign);
  resumeCampaign(campaign);

  assert.deepEqual(leads[0].next_send_at, originalNextSend, 'next_send_at should not change');
});

test('lead with future next_send_at is not queued after resume', () => {
  const campaign = createCampaign();
  const leads = createLeads(1);

  sendEmail(campaign, leads[0]);
  // Set next_send_at to future
  leads[0].next_send_at = new Date(Date.now() + 86400000); // +1 day

  pauseCampaign(campaign);
  resumeCampaign(campaign);

  const queued = schedulerTick(campaign, leads);
  assert.equal(queued.length, 0, 'Lead with future next_send_at should not be queued');
});

test('lead with past next_send_at IS queued after resume', () => {
  const campaign = createCampaign();
  const leads = createLeads(1);

  sendEmail(campaign, leads[0]);
  leads[0].next_send_at = new Date(Date.now() - 1000); // past

  pauseCampaign(campaign);
  resumeCampaign(campaign);

  const queued = schedulerTick(campaign, leads);
  assert.equal(queued.length, 1, 'Lead with past next_send_at should be queued');
});

// ============================================
// Pause counter tracking
// ============================================

console.log('\n--- Pause Counter Tracking ---');

test('paused_at is set on pause', () => {
  const campaign = createCampaign();
  assert.equal(campaign.paused_at, null);

  pauseCampaign(campaign);
  assert.ok(campaign.paused_at instanceof Date);
});

test('paused_at reflects accurate timestamp', () => {
  const campaign = createCampaign();
  const before = new Date();
  pauseCampaign(campaign);
  const after = new Date();

  assert.ok(campaign.paused_at! >= before);
  assert.ok(campaign.paused_at! <= after);
});

// ============================================
// Multiple pause/resume cycles
// ============================================

console.log('\n--- Multiple Pause/Resume Cycles ---');

test('pause → resume → pause → resume works correctly', () => {
  const campaign = createCampaign();
  const leads = createLeads(2);

  // Cycle 1
  assert.equal(schedulerTick(campaign, leads).length, 2);
  pauseCampaign(campaign);
  assert.equal(campaign.status, 'paused');
  assert.equal(schedulerTick(campaign, leads).length, 0);

  resumeCampaign(campaign);
  assert.equal(campaign.status, 'active');
  assert.equal(schedulerTick(campaign, leads).length, 2);

  // Cycle 2
  pauseCampaign(campaign);
  assert.equal(campaign.status, 'paused');
  assert.equal(schedulerTick(campaign, leads).length, 0);

  resumeCampaign(campaign);
  assert.equal(campaign.status, 'active');
  assert.equal(schedulerTick(campaign, leads).length, 2);
});

test('sent_count is preserved across multiple cycles', () => {
  const campaign = createCampaign();
  const leads = createLeads(2);

  // Send step 1
  for (const lead of leads) sendEmail(campaign, lead);
  assert.equal(campaign.sent_count, 2);

  pauseCampaign(campaign);
  resumeCampaign(campaign);

  // Send step 2
  for (const lead of leads) {
    lead.next_send_at = new Date(Date.now() - 1000);
    sendEmail(campaign, lead);
  }
  assert.equal(campaign.sent_count, 4);

  pauseCampaign(campaign);
  resumeCampaign(campaign);

  assert.equal(campaign.sent_count, 4, 'sent_count should persist');
});

test('lead statuses preserved across multiple cycles', () => {
  const campaign = createCampaign();
  const leads = createLeads(3);

  // Send step 1
  for (const lead of leads) sendEmail(campaign, lead);

  // Lead 0 replies
  leads[0].status = sm.canTransition(leads[0].status, 'REPLY_RECEIVED')!;

  pauseCampaign(campaign);
  resumeCampaign(campaign);
  pauseCampaign(campaign);
  resumeCampaign(campaign);

  assert.equal(leads[0].status, 'replied');
  assert.equal(leads[1].status, 'in_sequence');
  assert.equal(leads[2].status, 'in_sequence');
});

// ============================================
// Mid-pause settings changes
// ============================================

console.log('\n--- Mid-pause Settings Change ---');

test('change schedule while paused: resume uses new settings', () => {
  const campaign = createCampaign();
  pauseCampaign(campaign);

  // Change schedule: remove Friday
  campaign.settings.sendDays = ['mon', 'tue', 'wed', 'thu'];
  resumeCampaign(campaign);

  assert.deepEqual(campaign.settings.sendDays, ['mon', 'tue', 'wed', 'thu']);
  assert.ok(!campaign.settings.sendDays.includes('fri'));
});

test('change tracking while paused: new emails use new settings', () => {
  const campaign = createCampaign();

  pauseCampaign(campaign);
  campaign.settings.trackClicks = false;
  resumeCampaign(campaign);

  // Simulate applying tracking with new settings
  const html = '<html><body><a href="https://example.com">Link</a></body></html>';
  const trackingId = generateTrackingId('email-test');
  const tracked = applyEmailTracking(html, trackingId, 'https://api.test.com', {
    trackOpens: campaign.settings.trackOpens,
    trackClicks: campaign.settings.trackClicks,
  });

  assert.ok(tracked.includes('/api/v1/t/o/'), 'Should still have open tracking');
  assert.ok(!tracked.includes('/api/v1/t/c/'), 'Should NOT have click tracking');
});

test('change stop_on_reply while paused: applies after resume', () => {
  const campaign = createCampaign();

  pauseCampaign(campaign);
  campaign.settings.stopOnReply = false;
  resumeCampaign(campaign);

  assert.equal(campaign.settings.stopOnReply, false);
});

// ============================================
// Status validation
// ============================================

console.log('\n--- Status Validation ---');

test('only active campaigns can be paused', () => {
  const activeCampaign = createCampaign({ status: 'active' });
  assert.equal(pauseCampaign(activeCampaign), true);

  const draftCampaign = createCampaign({ status: 'draft' });
  assert.equal(pauseCampaign(draftCampaign), false);

  const completedCampaign = createCampaign({ status: 'completed' });
  assert.equal(pauseCampaign(completedCampaign), false);

  const archivedCampaign = createCampaign({ status: 'archived' });
  assert.equal(pauseCampaign(archivedCampaign), false);
});

test('only paused campaigns can be resumed', () => {
  const pausedCampaign = createCampaign({ status: 'paused' });
  assert.equal(resumeCampaign(pausedCampaign), true);

  const activeCampaign = createCampaign({ status: 'active' });
  assert.equal(resumeCampaign(activeCampaign), false);

  const draftCampaign = createCampaign({ status: 'draft' });
  assert.equal(resumeCampaign(draftCampaign), false);

  const completedCampaign = createCampaign({ status: 'completed' });
  assert.equal(resumeCampaign(completedCampaign), false);
});

test('pausing a paused campaign returns false', () => {
  const campaign = createCampaign({ status: 'paused' });
  assert.equal(pauseCampaign(campaign), false);
  assert.equal(campaign.status, 'paused');
});

test('resuming an active campaign returns false', () => {
  const campaign = createCampaign({ status: 'active' });
  assert.equal(resumeCampaign(campaign), false);
  assert.equal(campaign.status, 'active');
});

test('draft campaigns cannot be paused or resumed', () => {
  const campaign = createCampaign({ status: 'draft' });
  assert.equal(pauseCampaign(campaign), false);
  assert.equal(resumeCampaign(campaign), false);
  assert.equal(campaign.status, 'draft');
});

test('scheduled campaigns cannot be paused', () => {
  const campaign = createCampaign({ status: 'scheduled' });
  assert.equal(pauseCampaign(campaign), false);
  assert.equal(campaign.status, 'scheduled');
});

// ============================================
// Edge cases
// ============================================

console.log('\n--- Edge Cases ---');

test('pause with no leads does not error', () => {
  const campaign = createCampaign();
  const leads: SimLead[] = [];
  pauseCampaign(campaign);
  const queued = schedulerTick(campaign, leads);
  assert.equal(queued.length, 0);
});

test('resume with all leads completed: no emails queued', () => {
  const campaign = createCampaign();
  const leads = createLeads(2);

  // Complete all 3 steps for both leads
  for (const lead of leads) {
    sendEmail(campaign, lead);
    lead.next_send_at = new Date(Date.now() - 1000);
    sendEmail(campaign, lead);
    lead.next_send_at = new Date(Date.now() - 1000);
    sendEmail(campaign, lead);
  }

  pauseCampaign(campaign);
  resumeCampaign(campaign);

  const queued = schedulerTick(campaign, leads);
  assert.equal(queued.length, 0, 'Completed leads should not be queued');
});

test('resume with mixed lead states: only eligible leads queued', () => {
  const campaign = createCampaign();
  const leads = createLeads(4);

  // Send step 1 to all
  for (const lead of leads) sendEmail(campaign, lead);

  // Lead 0: replied (blocked)
  leads[0].status = sm.canTransition(leads[0].status, 'REPLY_RECEIVED')!;
  // Lead 1: bounced (blocked)
  leads[1].status = 'bounced';
  // Lead 2: in_sequence, delay not passed
  leads[2].next_send_at = new Date(Date.now() + 86400000);
  // Lead 3: in_sequence, delay passed
  leads[3].next_send_at = new Date(Date.now() - 1000);

  pauseCampaign(campaign);
  resumeCampaign(campaign);

  const queued = schedulerTick(campaign, leads);
  assert.equal(queued.length, 1, 'Only lead-4 (delay passed, not blocked) should be queued');
  assert.equal(queued[0], 'lead-4');
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
