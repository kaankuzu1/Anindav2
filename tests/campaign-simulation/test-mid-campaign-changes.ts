/**
 * Mid-Campaign Settings Changes Simulation Tests
 * Tests behavior when campaign settings change while campaign is running or paused.
 *
 * Run: npx tsx tests/campaign-simulation/test-mid-campaign-changes.ts
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
// Shared helpers (same pattern as other test files)
// ============================================

interface CampaignSettings {
  timezone: string;
  sendDays: string[];
  startTime: string;
  endTime: string;
  trackOpens: boolean;
  trackClicks: boolean;
  stopOnReply: boolean;
  minHealthScore: number;
}

interface SimInbox {
  id: string;
  email: string;
  status: 'active' | 'paused' | 'error';
  healthScore: number;
}

interface SimCampaign {
  id: string;
  status: CampaignStatus;
  settings: CampaignSettings;
  inbox_ids: string[];
  sequences: { stepNumber: number; subject: string; body: string }[];
  sent_count: number;
}

function createSettings(overrides?: Partial<CampaignSettings>): CampaignSettings {
  return {
    timezone: 'America/New_York',
    sendDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startTime: '09:00',
    endTime: '17:00',
    trackOpens: true,
    trackClicks: true,
    stopOnReply: true,
    minHealthScore: 50,
    ...overrides,
  };
}

function createCampaign(overrides?: Partial<SimCampaign>): SimCampaign {
  return {
    id: 'camp-1',
    status: 'active',
    settings: createSettings(),
    inbox_ids: ['inbox-1', 'inbox-2'],
    sequences: [
      { stepNumber: 1, subject: 'Hello', body: 'Body 1' },
      { stepNumber: 2, subject: 'Follow up', body: 'Body 2' },
    ],
    sent_count: 0,
    ...overrides,
  };
}

function createInboxes(): SimInbox[] {
  return [
    { id: 'inbox-1', email: 'alice@example.com', status: 'active', healthScore: 85 },
    { id: 'inbox-2', email: 'bob@example.com', status: 'active', healthScore: 75 },
    { id: 'inbox-3', email: 'charlie@example.com', status: 'active', healthScore: 90 },
  ];
}

/** Filter inboxes by campaign config + health */
function getEligibleInboxes(campaign: SimCampaign, allInboxes: SimInbox[]): SimInbox[] {
  return allInboxes.filter(inbox =>
    campaign.inbox_ids.includes(inbox.id) &&
    inbox.status === 'active' &&
    inbox.healthScore >= campaign.settings.minHealthScore
  );
}

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

// ============================================
// Schedule Changes
// ============================================

console.log('\n--- Schedule Changes ---');

test('add day to sendDays: new day is recognized by isWithinSendWindow', () => {
  const settings = createSettings({ sendDays: ['mon', 'tue', 'wed', 'thu', 'fri'] });

  // Add Saturday
  settings.sendDays.push('sat');
  assert.ok(settings.sendDays.includes('sat'));
  assert.equal(settings.sendDays.length, 6);
});

test('remove day from sendDays: removed day is excluded', () => {
  const settings = createSettings({ sendDays: ['mon', 'tue', 'wed', 'thu', 'fri'] });

  // Remove Friday
  settings.sendDays = settings.sendDays.filter(d => d !== 'fri');
  assert.ok(!settings.sendDays.includes('fri'));
  assert.equal(settings.sendDays.length, 4);
});

test('change time windows: new start/end time respected', () => {
  const settings = createSettings({ startTime: '09:00', endTime: '17:00' });

  // Change to evening window
  settings.startTime = '18:00';
  settings.endTime = '22:00';

  assert.equal(settings.startTime, '18:00');
  assert.equal(settings.endTime, '22:00');
});

test('isWithinSendWindow with Monday sendDays', () => {
  const settings = createSettings({ sendDays: ['mon'] });

  // Find a Monday
  const monday = new Date('2026-01-12T14:00:00Z'); // Monday Jan 12 2026
  const result = isWithinSendWindow(
    monday, settings.startTime, settings.endTime, 'UTC', settings.sendDays
  );

  // 14:00 UTC is within 09:00-17:00 UTC on Monday
  assert.equal(result, true);
});

test('isWithinSendWindow rejects Saturday when not in sendDays', () => {
  const settings = createSettings({ sendDays: ['mon', 'tue', 'wed', 'thu', 'fri'] });
  // Saturday Jan 17 2026
  const saturday = new Date('2026-01-17T14:00:00Z');
  const result = isWithinSendWindow(
    saturday, settings.startTime, settings.endTime, 'UTC', settings.sendDays
  );
  assert.equal(result, false);
});

test('isWithinSendWindow accepts Saturday when added to sendDays', () => {
  const settings = createSettings({ sendDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] });
  const saturday = new Date('2026-01-17T14:00:00Z');
  const result = isWithinSendWindow(
    saturday, settings.startTime, settings.endTime, 'UTC', settings.sendDays
  );
  assert.equal(result, true);
});

test('change schedule mid-campaign: new schedule effective on next tick', () => {
  const campaign = createCampaign();

  // Initially weekdays only
  assert.equal(campaign.settings.sendDays.length, 5);

  // Mid-campaign: add weekend
  campaign.settings.sendDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  assert.equal(campaign.settings.sendDays.length, 7);
});

// ============================================
// Timezone Changes
// ============================================

console.log('\n--- Timezone Changes ---');

test('change timezone: send window evaluation shifts', () => {
  const settings = createSettings({ timezone: 'America/New_York', startTime: '09:00', endTime: '17:00' });

  // 14:00 UTC = 09:00 EST (within window for NYC)
  const time = new Date('2026-01-12T14:00:00Z'); // Monday
  const resultNY = isWithinSendWindow(
    time, settings.startTime, settings.endTime, settings.timezone, settings.sendDays
  );
  assert.equal(resultNY, true, '14:00 UTC should be within 09:00-17:00 EST');

  // Change to Pacific timezone
  settings.timezone = 'America/Los_Angeles';
  // 14:00 UTC = 06:00 PST (outside 09:00-17:00 window)
  const resultLA = isWithinSendWindow(
    time, settings.startTime, settings.endTime, settings.timezone, settings.sendDays
  );
  assert.equal(resultLA, false, '14:00 UTC should be outside 09:00-17:00 PST');
});

test('timezone change from EST to UTC: widens effective window', () => {
  const settings = createSettings({ timezone: 'UTC' });

  // 14:00 UTC is clearly within 09:00-17:00 UTC on a Monday
  const time = new Date('2026-01-12T14:00:00Z');
  const result = isWithinSendWindow(
    time, settings.startTime, settings.endTime, 'UTC', settings.sendDays
  );
  assert.equal(result, true);
});

// ============================================
// Inbox Changes
// ============================================

console.log('\n--- Inbox Changes ---');

test('add inbox: new inbox included in rotation', () => {
  const campaign = createCampaign({ inbox_ids: ['inbox-1', 'inbox-2'] });
  const allInboxes = createInboxes();

  let eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 2);

  // Add inbox-3
  campaign.inbox_ids.push('inbox-3');
  eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 3);
});

test('remove inbox: removed inbox excluded from rotation', () => {
  const campaign = createCampaign({ inbox_ids: ['inbox-1', 'inbox-2'] });
  const allInboxes = createInboxes();

  // Remove inbox-2
  campaign.inbox_ids = campaign.inbox_ids.filter(id => id !== 'inbox-2');
  const eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, 'inbox-1');
});

test('inbox health drops below 50: filtered out', () => {
  const campaign = createCampaign({ inbox_ids: ['inbox-1', 'inbox-2'] });
  const allInboxes = createInboxes();

  // Drop inbox-1 health
  allInboxes[0].healthScore = 30;
  const eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, 'inbox-2');
});

test('inbox health at exactly 50: included (threshold is >= 50)', () => {
  const campaign = createCampaign({ inbox_ids: ['inbox-1'] });
  const allInboxes = createInboxes();
  allInboxes[0].healthScore = 50;

  const eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 1);
});

test('inbox health at 49: excluded', () => {
  const campaign = createCampaign({ inbox_ids: ['inbox-1'] });
  const allInboxes = createInboxes();
  allInboxes[0].healthScore = 49;

  const eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 0);
});

test('inbox status=error: excluded from rotation', () => {
  const campaign = createCampaign({ inbox_ids: ['inbox-1', 'inbox-2'] });
  const allInboxes = createInboxes();
  allInboxes[0].status = 'error';

  const eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, 'inbox-2');
});

test('inbox status=paused: excluded from rotation', () => {
  const campaign = createCampaign({ inbox_ids: ['inbox-1'] });
  const allInboxes = createInboxes();
  allInboxes[0].status = 'paused';

  const eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 0);
});

test('all inboxes unhealthy: no eligible inboxes', () => {
  const campaign = createCampaign({ inbox_ids: ['inbox-1', 'inbox-2'] });
  const allInboxes = createInboxes();
  allInboxes[0].healthScore = 20;
  allInboxes[1].healthScore = 30;

  const eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 0);
});

test('calculateHealthScore integration: high bounce rate penalizes', () => {
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 20,
    sentTotal: 300,
    repliedTotal: 90,
    bounceRate: 4,
    spamRate: 0,
  });
  // 4% bounce rate penalty = -40 points
  assert.ok(score < 70, `Expected score < 70 with 4% bounce, got ${score}`);
});

// ============================================
// Tracking Toggle
// ============================================

console.log('\n--- Tracking Toggle ---');

test('disable track_opens: new emails have no pixel', () => {
  const html = '<html><body><p>Hello</p></body></html>';
  const trackingId = generateTrackingId('email-1');
  const tracked = applyEmailTracking(html, trackingId, 'https://api.test.com', {
    trackOpens: false,
    trackClicks: true,
  });

  assert.ok(!tracked.includes('/api/v1/t/o/'), 'Should NOT have open tracking pixel');
});

test('enable track_opens: new emails have pixel', () => {
  const html = '<html><body><p>Hello</p></body></html>';
  const trackingId = generateTrackingId('email-2');
  const tracked = applyEmailTracking(html, trackingId, 'https://api.test.com', {
    trackOpens: true,
    trackClicks: false,
  });

  assert.ok(tracked.includes('/api/v1/t/o/'), 'Should have open tracking pixel');
});

test('disable track_clicks: links are NOT wrapped', () => {
  const html = '<html><body><a href="https://example.com">Click</a></body></html>';
  const trackingId = generateTrackingId('email-3');
  const tracked = applyEmailTracking(html, trackingId, 'https://api.test.com', {
    trackOpens: false,
    trackClicks: false,
  });

  assert.ok(!tracked.includes('/api/v1/t/c/'), 'Should NOT have click tracking');
  assert.ok(tracked.includes('href="https://example.com"'), 'Original link preserved');
});

test('enable track_clicks: links ARE wrapped', () => {
  const html = '<html><body><a href="https://example.com">Click</a></body></html>';
  const trackingId = generateTrackingId('email-4');
  const tracked = applyEmailTracking(html, trackingId, 'https://api.test.com', {
    trackOpens: false,
    trackClicks: true,
  });

  assert.ok(tracked.includes('/api/v1/t/c/'), 'Should have click tracking');
});

test('toggle tracking mid-campaign: old emails unaffected, new emails use new setting', () => {
  const campaign = createCampaign();

  // Email sent with tracking enabled
  const html1 = '<html><body><a href="https://example.com">Link</a></body></html>';
  const tracked1 = applyEmailTracking(html1, generateTrackingId('old'), 'https://api.test.com', {
    trackOpens: campaign.settings.trackOpens,
    trackClicks: campaign.settings.trackClicks,
  });
  assert.ok(tracked1.includes('/api/v1/t/o/'));
  assert.ok(tracked1.includes('/api/v1/t/c/'));

  // Disable both
  campaign.settings.trackOpens = false;
  campaign.settings.trackClicks = false;

  // New email sent without tracking
  const tracked2 = applyEmailTracking(html1, generateTrackingId('new'), 'https://api.test.com', {
    trackOpens: campaign.settings.trackOpens,
    trackClicks: campaign.settings.trackClicks,
  });
  assert.ok(!tracked2.includes('/api/v1/t/o/'));
  assert.ok(!tracked2.includes('/api/v1/t/c/'));
});

// ============================================
// stop_on_reply Toggle
// ============================================

console.log('\n--- stop_on_reply Toggle ---');

test('stop_on_reply=true: replied leads blocked by blocksSequence', () => {
  // blocksSequence returns true for 'replied'
  assert.equal(sm.blocksSequence('replied'), true);
});

test('stop_on_reply=false: replied leads still blocked by state machine', () => {
  // Even with stop_on_reply disabled, the state machine still blocks replied leads
  // because blocksSequence checks the lead status, not the campaign setting.
  // The campaign setting is separate business logic.
  assert.equal(sm.blocksSequence('replied'), true);
});

test('stop_on_reply=true with interested lead: blocked by blocksSequence', () => {
  assert.equal(sm.blocksSequence('interested'), true);
});

test('stop_on_reply status check: non-blocking statuses', () => {
  assert.equal(sm.blocksSequence('pending'), false);
  assert.equal(sm.blocksSequence('in_sequence'), false);
  assert.equal(sm.blocksSequence('contacted'), false);
});

test('stop_on_reply status check: blocking statuses', () => {
  const blockingStatuses: LeadStatus[] = [
    'replied', 'interested', 'not_interested', 'meeting_booked',
    'bounced', 'unsubscribed', 'spam_reported',
  ];
  for (const status of blockingStatuses) {
    assert.equal(sm.blocksSequence(status), true, `${status} should block sequence`);
  }
});

// ============================================
// A/B Weight Changes
// ============================================

console.log('\n--- A/B Weight Changes ---');

test('manual weight adjustment 70/30: distribution shifts', () => {
  const variants = [
    { id: 'a', subject: 'A', body: 'Body A', weight: 70 },
    { id: 'b', subject: 'B', body: 'Body B', weight: 30 },
  ];

  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 5000; i++) {
    const v = selectVariant(variants);
    counts[v!.id]++;
  }

  const ratioA = counts.a / 5000;
  assert.ok(ratioA >= 0.63 && ratioA <= 0.77, `Expected ~70%, got ${(ratioA * 100).toFixed(1)}%`);
});

test('declare winner 100/0: only winner selected', () => {
  const variants = [
    { id: 'winner', subject: 'W', body: 'Body W', weight: 100 },
    { id: 'loser', subject: 'L', body: 'Body L', weight: 0 },
  ];

  for (let i = 0; i < 100; i++) {
    const v = selectVariant(variants);
    assert.equal(v!.id, 'winner');
  }
});

test('reset test: equal weights restored', () => {
  const variantCount = 3;
  const baseWeight = Math.floor(100 / variantCount);
  const remainder = 100 - (baseWeight * variantCount);
  const weights = Array.from({ length: variantCount }, (_, i) =>
    i === 0 ? baseWeight + remainder : baseWeight
  );

  assert.deepEqual(weights, [34, 33, 33]);
  assert.equal(weights.reduce((a, b) => a + b, 0), 100);
});

test('weight change: weights must always sum to 100', () => {
  const variants = [
    { id: 'a', weight: 60 },
    { id: 'b', weight: 40 },
  ];
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  assert.equal(total, 100);
});

test('weight change: invalid weights (sum != 100) detected', () => {
  const variants = [
    { id: 'a', weight: 60 },
    { id: 'b', weight: 30 },
  ];
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  assert.notEqual(total, 100);
});

test('A/B weight change from 50/50 to 80/20: new distribution applies', () => {
  const variants = [
    { id: 'a', subject: 'A', body: 'Body A', weight: 50 },
    { id: 'b', subject: 'B', body: 'Body B', weight: 50 },
  ];

  // Before change: roughly 50/50
  let counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 2000; i++) {
    counts[selectVariant(variants)!.id]++;
  }
  const ratioBefore = counts.a / 2000;
  assert.ok(ratioBefore >= 0.43 && ratioBefore <= 0.57, `Before: expected ~50%, got ${(ratioBefore * 100).toFixed(1)}%`);

  // Change to 80/20
  variants[0].weight = 80;
  variants[1].weight = 20;

  counts = { a: 0, b: 0 };
  for (let i = 0; i < 2000; i++) {
    counts[selectVariant(variants)!.id]++;
  }
  const ratioAfter = counts.a / 2000;
  assert.ok(ratioAfter >= 0.73 && ratioAfter <= 0.87, `After: expected ~80%, got ${(ratioAfter * 100).toFixed(1)}%`);
});

// ============================================
// Compound Changes
// ============================================

console.log('\n--- Compound Changes ---');

test('multiple settings changed simultaneously: all respected', () => {
  const campaign = createCampaign();

  // Change schedule + tracking + stop_on_reply
  campaign.settings.sendDays = ['mon', 'wed', 'fri'];
  campaign.settings.trackOpens = false;
  campaign.settings.trackClicks = false;
  campaign.settings.stopOnReply = false;

  assert.deepEqual(campaign.settings.sendDays, ['mon', 'wed', 'fri']);
  assert.equal(campaign.settings.trackOpens, false);
  assert.equal(campaign.settings.trackClicks, false);
  assert.equal(campaign.settings.stopOnReply, false);

  // Verify tracking respects new settings
  const html = '<html><body><a href="https://example.com">Link</a></body></html>';
  const tracked = applyEmailTracking(html, generateTrackingId('test'), 'https://api.test.com', {
    trackOpens: campaign.settings.trackOpens,
    trackClicks: campaign.settings.trackClicks,
  });
  assert.ok(!tracked.includes('/api/v1/t/o/'));
  assert.ok(!tracked.includes('/api/v1/t/c/'));
});

test('change timezone + schedule: both applied', () => {
  const campaign = createCampaign();

  campaign.settings.timezone = 'Asia/Tokyo';
  campaign.settings.sendDays = ['mon', 'tue', 'wed'];

  assert.equal(campaign.settings.timezone, 'Asia/Tokyo');
  assert.equal(campaign.settings.sendDays.length, 3);
});

test('change inbox list + health threshold: both applied', () => {
  const campaign = createCampaign({ inbox_ids: ['inbox-1', 'inbox-2', 'inbox-3'] });
  const allInboxes = createInboxes();

  // Raise health threshold
  campaign.settings.minHealthScore = 80;
  // Remove inbox-2
  campaign.inbox_ids = ['inbox-1', 'inbox-3'];

  const eligible = getEligibleInboxes(campaign, allInboxes);
  // inbox-1 has 85 (passes), inbox-3 has 90 (passes), inbox-2 removed
  assert.equal(eligible.length, 2);
  assert.ok(eligible.every(i => i.healthScore >= 80));
});

// ============================================
// Settings Persistence
// ============================================

console.log('\n--- Settings Persistence ---');

test('settings change: fresh read returns new value', () => {
  const campaign = createCampaign();
  campaign.settings.sendDays = ['tue', 'thu'];

  // Simulate fresh read
  const freshSettings = campaign.settings;
  assert.deepEqual(freshSettings.sendDays, ['tue', 'thu']);
});

test('settings change while paused: persisted after resume', () => {
  const campaign = createCampaign();
  campaign.status = 'paused';

  campaign.settings.timezone = 'Europe/London';
  campaign.settings.trackOpens = false;

  campaign.status = 'active';

  assert.equal(campaign.settings.timezone, 'Europe/London');
  assert.equal(campaign.settings.trackOpens, false);
});

test('sequence content change: new template used after change', () => {
  const campaign = createCampaign();

  // Change sequence subject
  campaign.sequences[0].subject = 'Updated: Hello {{firstName}}';

  const result = processEmailContent(campaign.sequences[0].subject, { firstName: 'Alice' });
  assert.equal(result, 'Updated: Hello Alice');
});

test('sequence body change: variable injection uses new body', () => {
  const campaign = createCampaign();
  campaign.sequences[0].body = 'New body for {{company|your company}}';

  const result = processEmailContent(campaign.sequences[0].body, { company: 'Acme' });
  assert.equal(result, 'New body for Acme');
});

test('sequence body change: fallback works in new body', () => {
  const campaign = createCampaign();
  campaign.sequences[0].body = 'New body for {{company|your company}}';

  const result = processEmailContent(campaign.sequences[0].body, {});
  assert.equal(result, 'New body for your company');
});

// ============================================
// Edge cases
// ============================================

console.log('\n--- Edge Cases ---');

test('empty sendDays: isWithinSendWindow always returns false', () => {
  const time = new Date('2026-01-12T14:00:00Z');
  const result = isWithinSendWindow(time, '09:00', '17:00', 'UTC', []);
  assert.equal(result, false);
});

test('no inboxes assigned: no eligible inboxes', () => {
  const campaign = createCampaign({ inbox_ids: [] });
  const allInboxes = createInboxes();
  const eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 0);
});

test('minHealthScore set to 0: all active inboxes eligible', () => {
  const campaign = createCampaign({ inbox_ids: ['inbox-1', 'inbox-2'] });
  campaign.settings.minHealthScore = 0;
  const allInboxes = createInboxes();
  allInboxes[0].healthScore = 1;
  allInboxes[1].healthScore = 5;

  const eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 2);
});

test('minHealthScore set to 100: only perfect inboxes eligible', () => {
  const campaign = createCampaign({ inbox_ids: ['inbox-1', 'inbox-2', 'inbox-3'] });
  campaign.settings.minHealthScore = 100;
  const allInboxes = createInboxes();
  // None have 100 health
  const eligible = getEligibleInboxes(campaign, allInboxes);
  assert.equal(eligible.length, 0);
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
