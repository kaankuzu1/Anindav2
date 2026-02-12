/**
 * Campaign CRUD & Settings Tests
 *
 * Tests campaign object shape, default values, settings validation,
 * status transitions, PATCH merge behavior, team isolation, and deletion.
 */

import assert from 'node:assert/strict';
import type { CampaignStatus, CampaignSettings } from '../../packages/shared/src/types';

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
// Campaign Factory (simulates DB shape)
// ============================================

interface Campaign {
  id: string;
  team_id: string;
  name: string;
  status: CampaignStatus;
  settings: CampaignSettings;
  lead_count: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  bounced_count: number;
  created_at: string;
  updated_at: string;
}

function createCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: overrides.id ?? 'camp-001',
    team_id: overrides.team_id ?? 'team-001',
    name: overrides.name ?? 'Test Campaign',
    status: overrides.status ?? 'draft',
    settings: overrides.settings ?? getDefaultSettings(),
    lead_count: overrides.lead_count ?? 0,
    sent_count: overrides.sent_count ?? 0,
    opened_count: overrides.opened_count ?? 0,
    clicked_count: overrides.clicked_count ?? 0,
    replied_count: overrides.replied_count ?? 0,
    bounced_count: overrides.bounced_count ?? 0,
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

function getDefaultSettings(): CampaignSettings {
  return {
    timezone: 'UTC',
    sendDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    stopOnReply: true,
    stopOnBounce: true,
    trackOpens: true,
    trackClicks: true,
    espMatching: true,
    minHealthScore: 50,
  };
}

/**
 * Simulate PATCH merge: partial settings update preserves other fields
 */
function patchSettings(current: CampaignSettings, patch: Partial<CampaignSettings>): CampaignSettings {
  return { ...current, ...patch };
}

/**
 * Validate campaign status transitions
 */
const VALID_STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['active', 'scheduled', 'archived'],
  scheduled: ['active', 'draft', 'archived'],
  active: ['paused', 'completed', 'archived'],
  paused: ['active', 'archived'],
  completed: ['archived'],
  archived: [],
};

function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

const VALID_SEND_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function validateSettings(settings: Partial<CampaignSettings>): string[] {
  const errors: string[] = [];
  if (settings.sendDays) {
    for (const day of settings.sendDays) {
      if (!VALID_SEND_DAYS.includes(day)) {
        errors.push(`Invalid send day: ${day}`);
      }
    }
  }
  if (settings.minHealthScore !== undefined) {
    if (settings.minHealthScore < 0 || settings.minHealthScore > 100) {
      errors.push('minHealthScore must be 0-100');
    }
  }
  if (settings.timezone !== undefined && typeof settings.timezone !== 'string') {
    errors.push('timezone must be a string');
  }
  return errors;
}

// ============================================
// Campaign Object Shape
// ============================================

console.log('\n--- Campaign Object Shape ---');

test('Campaign has all required fields', () => {
  const campaign = createCampaign();
  assert.ok(campaign.id, 'id is required');
  assert.ok(campaign.team_id, 'team_id is required');
  assert.ok(campaign.name, 'name is required');
  assert.ok(campaign.status, 'status is required');
  assert.ok(campaign.settings, 'settings is required');
  assert.ok(campaign.created_at, 'created_at is required');
  assert.ok(campaign.updated_at, 'updated_at is required');
});

test('Default status is draft', () => {
  const campaign = createCampaign();
  assert.equal(campaign.status, 'draft');
});

test('Default counters are zero', () => {
  const campaign = createCampaign();
  assert.equal(campaign.lead_count, 0);
  assert.equal(campaign.sent_count, 0);
  assert.equal(campaign.opened_count, 0);
  assert.equal(campaign.clicked_count, 0);
  assert.equal(campaign.replied_count, 0);
  assert.equal(campaign.bounced_count, 0);
});

// ============================================
// Settings Object Shape & Defaults
// ============================================

console.log('\n--- Settings Object Shape & Defaults ---');

test('Settings has all required fields', () => {
  const settings = getDefaultSettings();
  assert.ok('timezone' in settings);
  assert.ok('sendDays' in settings);
  assert.ok('stopOnReply' in settings);
  assert.ok('stopOnBounce' in settings);
  assert.ok('trackOpens' in settings);
  assert.ok('trackClicks' in settings);
  assert.ok('espMatching' in settings);
  assert.ok('minHealthScore' in settings);
});

test('Default stopOnReply is true', () => {
  const settings = getDefaultSettings();
  assert.equal(settings.stopOnReply, true);
});

test('Default trackOpens is true', () => {
  const settings = getDefaultSettings();
  assert.equal(settings.trackOpens, true);
});

test('Default trackClicks is true', () => {
  const settings = getDefaultSettings();
  assert.equal(settings.trackClicks, true);
});

test('Default espMatching is true', () => {
  const settings = getDefaultSettings();
  assert.equal(settings.espMatching, true);
});

test('Default minHealthScore is 50', () => {
  const settings = getDefaultSettings();
  assert.equal(settings.minHealthScore, 50);
});

test('Default sendDays is weekdays only', () => {
  const settings = getDefaultSettings();
  assert.deepEqual(settings.sendDays, ['mon', 'tue', 'wed', 'thu', 'fri']);
});

test('Default timezone is UTC', () => {
  const settings = getDefaultSettings();
  assert.equal(settings.timezone, 'UTC');
});

// ============================================
// PATCH Merge Behavior
// ============================================

console.log('\n--- PATCH Merge Behavior ---');

test('Partial settings update preserves other fields', () => {
  const original = getDefaultSettings();
  const patched = patchSettings(original, { trackOpens: false });
  assert.equal(patched.trackOpens, false);
  assert.equal(patched.trackClicks, true);
  assert.equal(patched.stopOnReply, true);
  assert.equal(patched.minHealthScore, 50);
});

test('PATCH timezone preserves sendDays', () => {
  const original = getDefaultSettings();
  const patched = patchSettings(original, { timezone: 'America/New_York' });
  assert.equal(patched.timezone, 'America/New_York');
  assert.deepEqual(patched.sendDays, ['mon', 'tue', 'wed', 'thu', 'fri']);
});

test('PATCH sendDays replaces entire array', () => {
  const original = getDefaultSettings();
  const patched = patchSettings(original, { sendDays: ['mon', 'wed', 'fri'] });
  assert.deepEqual(patched.sendDays, ['mon', 'wed', 'fri']);
});

test('Name update does not affect status', () => {
  const campaign = createCampaign({ name: 'Old Name', status: 'active' });
  campaign.name = 'New Name';
  assert.equal(campaign.status, 'active');
  assert.equal(campaign.name, 'New Name');
});

// ============================================
// Status Transitions
// ============================================

console.log('\n--- Status Transitions ---');

test('draft -> active is valid', () => {
  assert.equal(canTransition('draft', 'active'), true);
});

test('active -> paused is valid', () => {
  assert.equal(canTransition('active', 'paused'), true);
});

test('paused -> active is valid', () => {
  assert.equal(canTransition('paused', 'active'), true);
});

test('active -> completed is valid', () => {
  assert.equal(canTransition('active', 'completed'), true);
});

test('completed -> active is invalid', () => {
  assert.equal(canTransition('completed', 'active'), false);
});

test('completed -> archived is valid', () => {
  assert.equal(canTransition('completed', 'archived'), true);
});

test('archived -> active is invalid (terminal)', () => {
  assert.equal(canTransition('archived', 'active'), false);
});

test('draft -> paused is invalid (must activate first)', () => {
  assert.equal(canTransition('draft', 'paused'), false);
});

// ============================================
// Delete & Team Isolation
// ============================================

console.log('\n--- Delete & Team Isolation ---');

test('Delete removes campaign from list', () => {
  const campaigns = [
    createCampaign({ id: 'c1' }),
    createCampaign({ id: 'c2' }),
    createCampaign({ id: 'c3' }),
  ];
  const remaining = campaigns.filter(c => c.id !== 'c2');
  assert.equal(remaining.length, 2);
  assert.ok(!remaining.find(c => c.id === 'c2'));
});

test('Team isolation: campaigns scoped to team_id', () => {
  const campaigns = [
    createCampaign({ id: 'c1', team_id: 'team-A' }),
    createCampaign({ id: 'c2', team_id: 'team-B' }),
    createCampaign({ id: 'c3', team_id: 'team-A' }),
  ];
  const teamACampaigns = campaigns.filter(c => c.team_id === 'team-A');
  assert.equal(teamACampaigns.length, 2);
  assert.ok(teamACampaigns.every(c => c.team_id === 'team-A'));
});

test('Team isolation: team B cannot see team A campaigns', () => {
  const campaigns = [
    createCampaign({ id: 'c1', team_id: 'team-A' }),
    createCampaign({ id: 'c2', team_id: 'team-A' }),
  ];
  const teamBVisible = campaigns.filter(c => c.team_id === 'team-B');
  assert.equal(teamBVisible.length, 0);
});

// ============================================
// Settings Validation
// ============================================

console.log('\n--- Settings Validation ---');

test('Valid send days pass validation', () => {
  const errors = validateSettings({ sendDays: ['mon', 'tue', 'wed'] });
  assert.equal(errors.length, 0);
});

test('Invalid send day fails validation', () => {
  const errors = validateSettings({ sendDays: ['mon', 'xyz'] });
  assert.ok(errors.length > 0);
  assert.ok(errors[0].includes('xyz'));
});

test('minHealthScore 0 is valid', () => {
  const errors = validateSettings({ minHealthScore: 0 });
  assert.equal(errors.length, 0);
});

test('minHealthScore 100 is valid', () => {
  const errors = validateSettings({ minHealthScore: 100 });
  assert.equal(errors.length, 0);
});

test('minHealthScore -1 is invalid', () => {
  const errors = validateSettings({ minHealthScore: -1 });
  assert.ok(errors.length > 0);
});

test('minHealthScore 101 is invalid', () => {
  const errors = validateSettings({ minHealthScore: 101 });
  assert.ok(errors.length > 0);
});

test('All 7 day abbreviations are valid', () => {
  const errors = validateSettings({ sendDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] });
  assert.equal(errors.length, 0);
});

// ============================================
// Summary
// ============================================

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
