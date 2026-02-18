import assert from 'node:assert/strict';
import {
  emailSchema,
  uuidSchema,
  timezoneSchema,
  urlSchema,
  createInboxSmtpSchema,
  updateInboxSettingsSchema,
  enableWarmupSchema,
  campaignSettingsSchema,
  sequenceStepSchema,
  createCampaignSchema,
  updateCampaignSchema,
  createLeadListSchema,
  leadImportMappingSchema,
  updateLeadSchema,
  updateReplyIntentSchema,
  sendReplySchema,
  createWebhookSchema,
  paginationSchema,
  dateRangeSchema,
} from '../../packages/shared/src/validation';

let passed = 0, failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (err: any) { failed++; const msg = err.message || String(err); failures.push(`${name}: ${msg}`); console.log(`  FAIL: ${name}\n        ${msg}`); }
}

function ok(schema: any, data: any) {
  const result = schema.safeParse(data);
  assert.ok(result.success, `Expected success but got errors: ${JSON.stringify(result.error?.issues?.map((i: any) => i.message))}`);
  return result.data;
}

function bad(schema: any, data: any) {
  const result = schema.safeParse(data);
  assert.ok(!result.success, `Expected failure but got success with data: ${JSON.stringify(result.data)}`);
  return result.error;
}

// ============================================
// 1. emailSchema
// ============================================
console.log('\n--- emailSchema ---');

test('emailSchema: valid simple email', () => { ok(emailSchema, 'user@example.com'); });
test('emailSchema: valid email with subdomain', () => { ok(emailSchema, 'user@mail.example.co.uk'); });
test('emailSchema: valid email with plus tag', () => { ok(emailSchema, 'user+tag@example.com'); });
test('emailSchema: valid email with dots in local', () => { ok(emailSchema, 'first.last@example.com'); });
test('emailSchema: invalid - missing @', () => { bad(emailSchema, 'userexample.com'); });
test('emailSchema: invalid - double @', () => { bad(emailSchema, 'user@@example.com'); });
test('emailSchema: invalid - no domain', () => { bad(emailSchema, 'user@'); });
test('emailSchema: invalid - no local part', () => { bad(emailSchema, '@example.com'); });
test('emailSchema: invalid - empty string', () => { bad(emailSchema, ''); });
test('emailSchema: invalid - number', () => { bad(emailSchema, 123); });
test('emailSchema: invalid - null', () => { bad(emailSchema, null); });
test('emailSchema: invalid - spaces', () => { bad(emailSchema, 'user @example.com'); });

// ============================================
// 2. uuidSchema
// ============================================
console.log('\n--- uuidSchema ---');

test('uuidSchema: valid v4 UUID', () => { ok(uuidSchema, '550e8400-e29b-41d4-a716-446655440000'); });
test('uuidSchema: valid v4 UUID lowercase', () => { ok(uuidSchema, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'); });
test('uuidSchema: invalid - wrong format', () => { bad(uuidSchema, 'not-a-uuid'); });
test('uuidSchema: invalid - too short', () => { bad(uuidSchema, '550e8400-e29b-41d4'); });
test('uuidSchema: invalid - empty string', () => { bad(uuidSchema, ''); });
test('uuidSchema: invalid - number', () => { bad(uuidSchema, 12345); });
test('uuidSchema: invalid - SQL injection', () => { bad(uuidSchema, "'; DROP TABLE users; --"); });
test('uuidSchema: invalid - null', () => { bad(uuidSchema, null); });
test('uuidSchema: invalid - missing hyphens', () => { bad(uuidSchema, '550e8400e29b41d4a716446655440000'); });

// ============================================
// 3. timezoneSchema
// ============================================
console.log('\n--- timezoneSchema ---');

test('timezoneSchema: valid timezone string', () => { ok(timezoneSchema, 'America/New_York'); });
test('timezoneSchema: valid short timezone', () => { ok(timezoneSchema, 'UTC'); });
test('timezoneSchema: invalid - empty string', () => { bad(timezoneSchema, ''); });
test('timezoneSchema: invalid - number', () => { bad(timezoneSchema, 0); });
test('timezoneSchema: invalid - null', () => { bad(timezoneSchema, null); });

// ============================================
// 4. urlSchema
// ============================================
console.log('\n--- urlSchema ---');

test('urlSchema: valid HTTPS URL', () => { ok(urlSchema, 'https://example.com'); });
test('urlSchema: valid HTTP URL', () => { ok(urlSchema, 'http://example.com'); });
test('urlSchema: valid URL with path', () => { ok(urlSchema, 'https://example.com/path/to/resource'); });
test('urlSchema: valid URL with query params', () => { ok(urlSchema, 'https://example.com?key=value'); });
test('urlSchema: invalid - no protocol', () => { bad(urlSchema, 'example.com'); });
test('urlSchema: invalid - empty string', () => { bad(urlSchema, ''); });
test('urlSchema: invalid - just a word', () => { bad(urlSchema, 'notaurl'); });
test('urlSchema: invalid - number', () => { bad(urlSchema, 123); });
test('urlSchema: FTP protocol is accepted by z.string().url()', () => { ok(urlSchema, 'ftp://files.example.com'); });

// ============================================
// 5. createInboxSmtpSchema
// ============================================
console.log('\n--- createInboxSmtpSchema ---');

const validSmtpInbox = {
  email: 'test@example.com',
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpUsername: 'user',
  smtpPassword: 'pass',
  imapHost: 'imap.example.com',
  imapPort: 993,
};

test('createInboxSmtpSchema: valid minimal input', () => {
  const d = ok(createInboxSmtpSchema, validSmtpInbox);
  assert.equal(d.dailySendLimit, 50); // default
});

test('createInboxSmtpSchema: valid with all optional fields', () => {
  ok(createInboxSmtpSchema, { ...validSmtpInbox, fromName: 'John Doe', dailySendLimit: 100 });
});

test('createInboxSmtpSchema: missing email', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, email: undefined }); });
test('createInboxSmtpSchema: invalid email', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, email: 'notanemail' }); });
test('createInboxSmtpSchema: missing smtpHost', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpHost: undefined }); });
test('createInboxSmtpSchema: empty smtpHost', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpHost: '' }); });
test('createInboxSmtpSchema: missing smtpPort', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpPort: undefined }); });
test('createInboxSmtpSchema: smtpPort 0 (below min)', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpPort: 0 }); });
test('createInboxSmtpSchema: smtpPort 65536 (above max)', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpPort: 65536 }); });
test('createInboxSmtpSchema: smtpPort float', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpPort: 587.5 }); });
test('createInboxSmtpSchema: smtpPort 1 (min boundary)', () => { ok(createInboxSmtpSchema, { ...validSmtpInbox, smtpPort: 1 }); });
test('createInboxSmtpSchema: smtpPort 65535 (max boundary)', () => { ok(createInboxSmtpSchema, { ...validSmtpInbox, smtpPort: 65535 }); });
test('createInboxSmtpSchema: missing smtpUsername', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpUsername: undefined }); });
test('createInboxSmtpSchema: empty smtpUsername', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpUsername: '' }); });
test('createInboxSmtpSchema: missing smtpPassword', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpPassword: undefined }); });
test('createInboxSmtpSchema: empty smtpPassword', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpPassword: '' }); });
test('createInboxSmtpSchema: missing imapHost', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, imapHost: undefined }); });
test('createInboxSmtpSchema: missing imapPort', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, imapPort: undefined }); });
test('createInboxSmtpSchema: imapPort 0', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, imapPort: 0 }); });
test('createInboxSmtpSchema: imapPort negative', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, imapPort: -1 }); });
test('createInboxSmtpSchema: dailySendLimit 0 (below min)', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, dailySendLimit: 0 }); });
test('createInboxSmtpSchema: dailySendLimit 501 (above max)', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, dailySendLimit: 501 }); });
test('createInboxSmtpSchema: dailySendLimit 1 (min boundary)', () => { ok(createInboxSmtpSchema, { ...validSmtpInbox, dailySendLimit: 1 }); });
test('createInboxSmtpSchema: dailySendLimit 500 (max boundary)', () => { ok(createInboxSmtpSchema, { ...validSmtpInbox, dailySendLimit: 500 }); });
test('createInboxSmtpSchema: smtpPort string type', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpPort: '587' }); });

// ============================================
// 6. updateInboxSettingsSchema
// ============================================
console.log('\n--- updateInboxSettingsSchema ---');

test('updateInboxSettingsSchema: valid empty object (all optional)', () => { ok(updateInboxSettingsSchema, {}); });
test('updateInboxSettingsSchema: valid with fromName', () => { ok(updateInboxSettingsSchema, { fromName: 'Jane' }); });
test('updateInboxSettingsSchema: valid dailySendLimit', () => { ok(updateInboxSettingsSchema, { dailySendLimit: 100 }); });
test('updateInboxSettingsSchema: dailySendLimit 0', () => { bad(updateInboxSettingsSchema, { dailySendLimit: 0 }); });
test('updateInboxSettingsSchema: dailySendLimit 501', () => { bad(updateInboxSettingsSchema, { dailySendLimit: 501 }); });
test('updateInboxSettingsSchema: hourlyLimit 1 (min)', () => { ok(updateInboxSettingsSchema, { hourlyLimit: 1 }); });
test('updateInboxSettingsSchema: hourlyLimit 100 (max)', () => { ok(updateInboxSettingsSchema, { hourlyLimit: 100 }); });
test('updateInboxSettingsSchema: hourlyLimit 0', () => { bad(updateInboxSettingsSchema, { hourlyLimit: 0 }); });
test('updateInboxSettingsSchema: hourlyLimit 101', () => { bad(updateInboxSettingsSchema, { hourlyLimit: 101 }); });
test('updateInboxSettingsSchema: minDelaySeconds 30 (min)', () => { ok(updateInboxSettingsSchema, { minDelaySeconds: 30 }); });
test('updateInboxSettingsSchema: minDelaySeconds 3600 (max)', () => { ok(updateInboxSettingsSchema, { minDelaySeconds: 3600 }); });
test('updateInboxSettingsSchema: minDelaySeconds 29', () => { bad(updateInboxSettingsSchema, { minDelaySeconds: 29 }); });
test('updateInboxSettingsSchema: minDelaySeconds 3601', () => { bad(updateInboxSettingsSchema, { minDelaySeconds: 3601 }); });
test('updateInboxSettingsSchema: maxDelaySeconds 60 (min)', () => { ok(updateInboxSettingsSchema, { maxDelaySeconds: 60 }); });
test('updateInboxSettingsSchema: maxDelaySeconds 7200 (max)', () => { ok(updateInboxSettingsSchema, { maxDelaySeconds: 7200 }); });
test('updateInboxSettingsSchema: maxDelaySeconds 59', () => { bad(updateInboxSettingsSchema, { maxDelaySeconds: 59 }); });
test('updateInboxSettingsSchema: maxDelaySeconds 7201', () => { bad(updateInboxSettingsSchema, { maxDelaySeconds: 7201 }); });
test('updateInboxSettingsSchema: valid sendWindowStart HH:MM', () => { ok(updateInboxSettingsSchema, { sendWindowStart: '08:00' }); });
test('updateInboxSettingsSchema: invalid sendWindowStart format', () => { bad(updateInboxSettingsSchema, { sendWindowStart: '8:00' }); });
test('updateInboxSettingsSchema: invalid sendWindowStart no colon', () => { bad(updateInboxSettingsSchema, { sendWindowStart: '0800' }); });
test('updateInboxSettingsSchema: valid sendWindowEnd', () => { ok(updateInboxSettingsSchema, { sendWindowEnd: '17:30' }); });
test('updateInboxSettingsSchema: invalid sendWindowEnd', () => { bad(updateInboxSettingsSchema, { sendWindowEnd: '5pm' }); });
test('updateInboxSettingsSchema: valid sendWindowTimezone', () => { ok(updateInboxSettingsSchema, { sendWindowTimezone: 'US/Eastern' }); });
test('updateInboxSettingsSchema: empty sendWindowTimezone', () => { bad(updateInboxSettingsSchema, { sendWindowTimezone: '' }); });
test('updateInboxSettingsSchema: weekendsEnabled true', () => { ok(updateInboxSettingsSchema, { weekendsEnabled: true }); });
test('updateInboxSettingsSchema: weekendsEnabled false', () => { ok(updateInboxSettingsSchema, { weekendsEnabled: false }); });
test('updateInboxSettingsSchema: weekendsEnabled string "true"', () => { bad(updateInboxSettingsSchema, { weekendsEnabled: 'true' }); });
test('updateInboxSettingsSchema: all fields at once', () => {
  ok(updateInboxSettingsSchema, {
    fromName: 'Test',
    dailySendLimit: 200,
    hourlyLimit: 50,
    minDelaySeconds: 60,
    maxDelaySeconds: 120,
    sendWindowStart: '09:00',
    sendWindowEnd: '18:00',
    sendWindowTimezone: 'America/Chicago',
    weekendsEnabled: false,
  });
});

// ============================================
// 7. enableWarmupSchema
// ============================================
console.log('\n--- enableWarmupSchema ---');

test('enableWarmupSchema: valid defaults (empty obj)', () => {
  const d = ok(enableWarmupSchema, {});
  assert.equal(d.rampSpeed, 'normal');
  assert.equal(d.targetDailyVolume, 40);
});
test('enableWarmupSchema: rampSpeed slow', () => { ok(enableWarmupSchema, { rampSpeed: 'slow' }); });
test('enableWarmupSchema: rampSpeed fast', () => { ok(enableWarmupSchema, { rampSpeed: 'fast' }); });
test('enableWarmupSchema: rampSpeed invalid', () => { bad(enableWarmupSchema, { rampSpeed: 'turbo' }); });
test('enableWarmupSchema: rampSpeed empty string', () => { bad(enableWarmupSchema, { rampSpeed: '' }); });
test('enableWarmupSchema: targetDailyVolume 10 (min)', () => { ok(enableWarmupSchema, { targetDailyVolume: 10 }); });
test('enableWarmupSchema: targetDailyVolume 100 (max)', () => { ok(enableWarmupSchema, { targetDailyVolume: 100 }); });
test('enableWarmupSchema: targetDailyVolume 9 (below min)', () => { bad(enableWarmupSchema, { targetDailyVolume: 9 }); });
test('enableWarmupSchema: targetDailyVolume 101 (above max)', () => { bad(enableWarmupSchema, { targetDailyVolume: 101 }); });
test('enableWarmupSchema: targetDailyVolume float', () => { bad(enableWarmupSchema, { targetDailyVolume: 50.5 }); });
test('enableWarmupSchema: targetDailyVolume 0', () => { bad(enableWarmupSchema, { targetDailyVolume: 0 }); });
test('enableWarmupSchema: targetDailyVolume negative', () => { bad(enableWarmupSchema, { targetDailyVolume: -10 }); });

// ============================================
// 8. campaignSettingsSchema
// ============================================
console.log('\n--- campaignSettingsSchema ---');

test('campaignSettingsSchema: valid defaults (empty obj)', () => {
  const d = ok(campaignSettingsSchema, {});
  assert.equal(d.timezone, 'America/New_York');
  assert.deepEqual(d.sendDays, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(d.stopOnReply, true);
  assert.equal(d.stopOnBounce, true);
  assert.equal(d.trackOpens, true);
  assert.equal(d.trackClicks, false);
  assert.equal(d.espMatching, true);
  assert.equal(d.minHealthScore, 70);
});
test('campaignSettingsSchema: custom timezone', () => { ok(campaignSettingsSchema, { timezone: 'Europe/London' }); });
test('campaignSettingsSchema: sendDays all days', () => {
  ok(campaignSettingsSchema, { sendDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] });
});
test('campaignSettingsSchema: sendDays single day', () => { ok(campaignSettingsSchema, { sendDays: ['mon'] }); });
test('campaignSettingsSchema: sendDays invalid day', () => { bad(campaignSettingsSchema, { sendDays: ['monday'] }); });
test('campaignSettingsSchema: minHealthScore 0 (min)', () => { ok(campaignSettingsSchema, { minHealthScore: 0 }); });
test('campaignSettingsSchema: minHealthScore 100 (max)', () => { ok(campaignSettingsSchema, { minHealthScore: 100 }); });
test('campaignSettingsSchema: minHealthScore -1', () => { bad(campaignSettingsSchema, { minHealthScore: -1 }); });
test('campaignSettingsSchema: minHealthScore 101', () => { bad(campaignSettingsSchema, { minHealthScore: 101 }); });
test('campaignSettingsSchema: minHealthScore float', () => { bad(campaignSettingsSchema, { minHealthScore: 70.5 }); });
test('campaignSettingsSchema: schedule with valid windows', () => {
  ok(campaignSettingsSchema, {
    schedule: {
      mon: [{ start: 9, end: 17 }],
      fri: [{ start: 8, end: 12 }, { start: 13, end: 18 }],
    },
  });
});
test('campaignSettingsSchema: schedule start 0', () => {
  ok(campaignSettingsSchema, { schedule: { mon: [{ start: 0, end: 8 }] } });
});
test('campaignSettingsSchema: schedule end 24', () => {
  ok(campaignSettingsSchema, { schedule: { mon: [{ start: 8, end: 24 }] } });
});
test('campaignSettingsSchema: schedule start negative', () => {
  bad(campaignSettingsSchema, { schedule: { mon: [{ start: -1, end: 8 }] } });
});
test('campaignSettingsSchema: schedule end 25', () => {
  bad(campaignSettingsSchema, { schedule: { mon: [{ start: 8, end: 25 }] } });
});
test('campaignSettingsSchema: schedule invalid day key', () => {
  bad(campaignSettingsSchema, { schedule: { monday: [{ start: 9, end: 17 }] } });
});
test('campaignSettingsSchema: schedule empty windows array', () => {
  bad(campaignSettingsSchema, { schedule: { mon: [] } });
});
test('campaignSettingsSchema: schedule 3 windows (max 2)', () => {
  bad(campaignSettingsSchema, { schedule: { mon: [{ start: 8, end: 10 }, { start: 11, end: 13 }, { start: 14, end: 16 }] } });
});
test('campaignSettingsSchema: stopOnReply false override', () => {
  const d = ok(campaignSettingsSchema, { stopOnReply: false });
  assert.equal(d.stopOnReply, false);
});
test('campaignSettingsSchema: trackClicks true override', () => {
  const d = ok(campaignSettingsSchema, { trackClicks: true });
  assert.equal(d.trackClicks, true);
});

// ============================================
// 9. sequenceStepSchema
// ============================================
console.log('\n--- sequenceStepSchema ---');

const validStep = { stepNumber: 1, subject: 'Hello', body: '<p>Hi there</p>' };

test('sequenceStepSchema: valid minimal', () => {
  const d = ok(sequenceStepSchema, validStep);
  assert.equal(d.delayDays, 0);
  assert.equal(d.delayHours, 0);
});
test('sequenceStepSchema: valid with all fields', () => {
  ok(sequenceStepSchema, { ...validStep, delayDays: 3, delayHours: 12, variants: [{ subject: 'B', body: 'B body', weight: 50 }] });
});
test('sequenceStepSchema: missing stepNumber', () => { bad(sequenceStepSchema, { subject: 'Hi', body: 'Body' }); });
test('sequenceStepSchema: stepNumber 0', () => { bad(sequenceStepSchema, { ...validStep, stepNumber: 0 }); });
test('sequenceStepSchema: stepNumber negative', () => { bad(sequenceStepSchema, { ...validStep, stepNumber: -1 }); });
test('sequenceStepSchema: stepNumber float', () => { bad(sequenceStepSchema, { ...validStep, stepNumber: 1.5 }); });
test('sequenceStepSchema: missing subject', () => { bad(sequenceStepSchema, { stepNumber: 1, body: 'Body' }); });
test('sequenceStepSchema: empty subject', () => { bad(sequenceStepSchema, { ...validStep, subject: '' }); });
test('sequenceStepSchema: subject 500 chars (max)', () => { ok(sequenceStepSchema, { ...validStep, subject: 'a'.repeat(500) }); });
test('sequenceStepSchema: subject 501 chars (over max)', () => { bad(sequenceStepSchema, { ...validStep, subject: 'a'.repeat(501) }); });
test('sequenceStepSchema: missing body', () => { bad(sequenceStepSchema, { stepNumber: 1, subject: 'Hi' }); });
test('sequenceStepSchema: empty body', () => { bad(sequenceStepSchema, { ...validStep, body: '' }); });
test('sequenceStepSchema: delayDays negative', () => { bad(sequenceStepSchema, { ...validStep, delayDays: -1 }); });
test('sequenceStepSchema: delayHours 23 (max)', () => { ok(sequenceStepSchema, { ...validStep, delayHours: 23 }); });
test('sequenceStepSchema: delayHours 24 (over max)', () => { bad(sequenceStepSchema, { ...validStep, delayHours: 24 }); });
test('sequenceStepSchema: delayHours negative', () => { bad(sequenceStepSchema, { ...validStep, delayHours: -1 }); });
test('sequenceStepSchema: variants empty array is valid', () => { ok(sequenceStepSchema, { ...validStep, variants: [] }); });
test('sequenceStepSchema: variant valid', () => {
  ok(sequenceStepSchema, { ...validStep, variants: [{ subject: 'B', body: 'B body', weight: 50 }] });
});
test('sequenceStepSchema: variant missing subject', () => {
  bad(sequenceStepSchema, { ...validStep, variants: [{ body: 'B body', weight: 50 }] });
});
test('sequenceStepSchema: variant empty subject', () => {
  bad(sequenceStepSchema, { ...validStep, variants: [{ subject: '', body: 'B body', weight: 50 }] });
});
test('sequenceStepSchema: variant subject 501 chars', () => {
  bad(sequenceStepSchema, { ...validStep, variants: [{ subject: 'a'.repeat(501), body: 'B body', weight: 50 }] });
});
test('sequenceStepSchema: variant missing body', () => {
  bad(sequenceStepSchema, { ...validStep, variants: [{ subject: 'B', weight: 50 }] });
});
test('sequenceStepSchema: variant empty body', () => {
  bad(sequenceStepSchema, { ...validStep, variants: [{ subject: 'B', body: '', weight: 50 }] });
});
test('sequenceStepSchema: variant weight 0', () => {
  bad(sequenceStepSchema, { ...validStep, variants: [{ subject: 'B', body: 'B body', weight: 0 }] });
});
test('sequenceStepSchema: variant weight 101', () => {
  bad(sequenceStepSchema, { ...validStep, variants: [{ subject: 'B', body: 'B body', weight: 101 }] });
});
test('sequenceStepSchema: variant weight 1 (min)', () => {
  ok(sequenceStepSchema, { ...validStep, variants: [{ subject: 'B', body: 'B body', weight: 1 }] });
});
test('sequenceStepSchema: variant weight 100 (max)', () => {
  ok(sequenceStepSchema, { ...validStep, variants: [{ subject: 'B', body: 'B body', weight: 100 }] });
});
test('sequenceStepSchema: variant weight default 50', () => {
  const d = ok(sequenceStepSchema, { ...validStep, variants: [{ subject: 'B', body: 'B body' }] });
  assert.equal(d.variants[0].weight, 50);
});

// ============================================
// 10. createCampaignSchema
// ============================================
console.log('\n--- createCampaignSchema ---');

const validUUID = '550e8400-e29b-41d4-a716-446655440000';
const validCampaign = {
  name: 'My Campaign',
  leadListId: validUUID,
  inboxIds: [validUUID],
  sequences: [{ stepNumber: 1, subject: 'Hello', body: 'Hi there' }],
};

test('createCampaignSchema: valid minimal', () => { ok(createCampaignSchema, validCampaign); });
test('createCampaignSchema: valid with settings', () => {
  ok(createCampaignSchema, { ...validCampaign, settings: { timezone: 'UTC' } });
});
test('createCampaignSchema: missing name', () => { bad(createCampaignSchema, { ...validCampaign, name: undefined }); });
test('createCampaignSchema: empty name', () => { bad(createCampaignSchema, { ...validCampaign, name: '' }); });
test('createCampaignSchema: name 255 chars', () => { ok(createCampaignSchema, { ...validCampaign, name: 'a'.repeat(255) }); });
test('createCampaignSchema: name 256 chars', () => { bad(createCampaignSchema, { ...validCampaign, name: 'a'.repeat(256) }); });
test('createCampaignSchema: missing leadListId', () => { bad(createCampaignSchema, { ...validCampaign, leadListId: undefined }); });
test('createCampaignSchema: invalid leadListId', () => { bad(createCampaignSchema, { ...validCampaign, leadListId: 'not-uuid' }); });
test('createCampaignSchema: missing inboxIds', () => { bad(createCampaignSchema, { ...validCampaign, inboxIds: undefined }); });
test('createCampaignSchema: empty inboxIds array', () => { bad(createCampaignSchema, { ...validCampaign, inboxIds: [] }); });
test('createCampaignSchema: invalid UUID in inboxIds', () => { bad(createCampaignSchema, { ...validCampaign, inboxIds: ['not-uuid'] }); });
test('createCampaignSchema: multiple valid inboxIds', () => {
  ok(createCampaignSchema, { ...validCampaign, inboxIds: [validUUID, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'] });
});
test('createCampaignSchema: missing sequences', () => { bad(createCampaignSchema, { ...validCampaign, sequences: undefined }); });
test('createCampaignSchema: empty sequences array', () => { bad(createCampaignSchema, { ...validCampaign, sequences: [] }); });
test('createCampaignSchema: sequences with invalid step', () => {
  bad(createCampaignSchema, { ...validCampaign, sequences: [{ stepNumber: 0, subject: '', body: '' }] });
});
test('createCampaignSchema: multiple sequences', () => {
  ok(createCampaignSchema, {
    ...validCampaign,
    sequences: [
      { stepNumber: 1, subject: 'Hello', body: 'First email' },
      { stepNumber: 2, delayDays: 3, subject: 'Follow up', body: 'Second email' },
    ],
  });
});

// ============================================
// 11. updateCampaignSchema
// ============================================
console.log('\n--- updateCampaignSchema ---');

test('updateCampaignSchema: valid empty object', () => { ok(updateCampaignSchema, {}); });
test('updateCampaignSchema: valid name', () => { ok(updateCampaignSchema, { name: 'Updated' }); });
test('updateCampaignSchema: empty name', () => { bad(updateCampaignSchema, { name: '' }); });
test('updateCampaignSchema: name 256 chars', () => { bad(updateCampaignSchema, { name: 'a'.repeat(256) }); });
test('updateCampaignSchema: valid partial settings', () => {
  ok(updateCampaignSchema, { settings: { timezone: 'UTC' } });
});
test('updateCampaignSchema: settings with just one boolean', () => {
  ok(updateCampaignSchema, { settings: { trackClicks: true } });
});

// ============================================
// 12. createLeadListSchema
// ============================================
console.log('\n--- createLeadListSchema ---');

test('createLeadListSchema: valid minimal', () => { ok(createLeadListSchema, { name: 'My List' }); });
test('createLeadListSchema: valid with description', () => { ok(createLeadListSchema, { name: 'List', description: 'A description' }); });
test('createLeadListSchema: missing name', () => { bad(createLeadListSchema, {}); });
test('createLeadListSchema: empty name', () => { bad(createLeadListSchema, { name: '' }); });
test('createLeadListSchema: name 255 chars', () => { ok(createLeadListSchema, { name: 'a'.repeat(255) }); });
test('createLeadListSchema: name 256 chars', () => { bad(createLeadListSchema, { name: 'a'.repeat(256) }); });
test('createLeadListSchema: description 1000 chars (max)', () => {
  ok(createLeadListSchema, { name: 'List', description: 'a'.repeat(1000) });
});
test('createLeadListSchema: description 1001 chars (over max)', () => {
  bad(createLeadListSchema, { name: 'List', description: 'a'.repeat(1001) });
});
test('createLeadListSchema: name number type', () => { bad(createLeadListSchema, { name: 123 }); });

// ============================================
// 13. leadImportMappingSchema
// ============================================
console.log('\n--- leadImportMappingSchema ---');

test('leadImportMappingSchema: valid minimal (just email)', () => { ok(leadImportMappingSchema, { email: 'Email' }); });
test('leadImportMappingSchema: valid with all optional fields', () => {
  ok(leadImportMappingSchema, {
    email: 'Email',
    firstName: 'First',
    lastName: 'Last',
    company: 'Company',
    title: 'Title',
    phone: 'Phone',
    linkedinUrl: 'LinkedIn',
    website: 'Website',
    customFields: { industry: 'Industry' },
  });
});
test('leadImportMappingSchema: missing email', () => { bad(leadImportMappingSchema, {}); });
test('leadImportMappingSchema: empty email', () => { bad(leadImportMappingSchema, { email: '' }); });
test('leadImportMappingSchema: email is number', () => { bad(leadImportMappingSchema, { email: 123 }); });
test('leadImportMappingSchema: customFields valid record', () => {
  ok(leadImportMappingSchema, { email: 'Email', customFields: { key1: 'val1', key2: 'val2' } });
});
test('leadImportMappingSchema: customFields empty object', () => {
  ok(leadImportMappingSchema, { email: 'Email', customFields: {} });
});

// ============================================
// 14. updateLeadSchema
// ============================================
console.log('\n--- updateLeadSchema ---');

test('updateLeadSchema: valid empty object', () => { ok(updateLeadSchema, {}); });
test('updateLeadSchema: valid firstName', () => { ok(updateLeadSchema, { firstName: 'John' }); });
test('updateLeadSchema: firstName 100 chars (max)', () => { ok(updateLeadSchema, { firstName: 'a'.repeat(100) }); });
test('updateLeadSchema: firstName 101 chars (over max)', () => { bad(updateLeadSchema, { firstName: 'a'.repeat(101) }); });
test('updateLeadSchema: lastName 100 chars', () => { ok(updateLeadSchema, { lastName: 'a'.repeat(100) }); });
test('updateLeadSchema: lastName 101 chars', () => { bad(updateLeadSchema, { lastName: 'a'.repeat(101) }); });
test('updateLeadSchema: company 255 chars', () => { ok(updateLeadSchema, { company: 'a'.repeat(255) }); });
test('updateLeadSchema: company 256 chars', () => { bad(updateLeadSchema, { company: 'a'.repeat(256) }); });
test('updateLeadSchema: title 255 chars', () => { ok(updateLeadSchema, { title: 'a'.repeat(255) }); });
test('updateLeadSchema: title 256 chars', () => { bad(updateLeadSchema, { title: 'a'.repeat(256) }); });
test('updateLeadSchema: phone 50 chars', () => { ok(updateLeadSchema, { phone: '1'.repeat(50) }); });
test('updateLeadSchema: phone 51 chars', () => { bad(updateLeadSchema, { phone: '1'.repeat(51) }); });
test('updateLeadSchema: linkedinUrl valid URL', () => { ok(updateLeadSchema, { linkedinUrl: 'https://linkedin.com/in/user' }); });
test('updateLeadSchema: linkedinUrl empty string allowed', () => { ok(updateLeadSchema, { linkedinUrl: '' }); });
test('updateLeadSchema: linkedinUrl invalid URL', () => { bad(updateLeadSchema, { linkedinUrl: 'not-a-url' }); });
test('updateLeadSchema: website valid URL', () => { ok(updateLeadSchema, { website: 'https://example.com' }); });
test('updateLeadSchema: website empty string allowed', () => { ok(updateLeadSchema, { website: '' }); });
test('updateLeadSchema: website invalid URL', () => { bad(updateLeadSchema, { website: 'example' }); });
test('updateLeadSchema: status pending', () => { ok(updateLeadSchema, { status: 'pending' }); });
test('updateLeadSchema: status in_sequence', () => { ok(updateLeadSchema, { status: 'in_sequence' }); });
test('updateLeadSchema: status contacted', () => { ok(updateLeadSchema, { status: 'contacted' }); });
test('updateLeadSchema: status replied', () => { ok(updateLeadSchema, { status: 'replied' }); });
test('updateLeadSchema: status interested', () => { ok(updateLeadSchema, { status: 'interested' }); });
test('updateLeadSchema: status not_interested', () => { ok(updateLeadSchema, { status: 'not_interested' }); });
test('updateLeadSchema: status meeting_booked', () => { ok(updateLeadSchema, { status: 'meeting_booked' }); });
test('updateLeadSchema: status bounced', () => { ok(updateLeadSchema, { status: 'bounced' }); });
test('updateLeadSchema: status soft_bounced', () => { ok(updateLeadSchema, { status: 'soft_bounced' }); });
test('updateLeadSchema: status unsubscribed', () => { ok(updateLeadSchema, { status: 'unsubscribed' }); });
test('updateLeadSchema: status spam_reported', () => { ok(updateLeadSchema, { status: 'spam_reported' }); });
test('updateLeadSchema: status sequence_complete', () => { ok(updateLeadSchema, { status: 'sequence_complete' }); });
test('updateLeadSchema: status invalid', () => { bad(updateLeadSchema, { status: 'active' }); });
test('updateLeadSchema: status empty string', () => { bad(updateLeadSchema, { status: '' }); });
test('updateLeadSchema: customFields valid', () => { ok(updateLeadSchema, { customFields: { key: 'value' } }); });
test('updateLeadSchema: customFields empty', () => { ok(updateLeadSchema, { customFields: {} }); });
test('updateLeadSchema: all fields at once', () => {
  ok(updateLeadSchema, {
    firstName: 'Jane',
    lastName: 'Doe',
    company: 'Acme',
    title: 'CEO',
    phone: '+1234567890',
    linkedinUrl: 'https://linkedin.com/in/jane',
    website: 'https://acme.com',
    status: 'interested',
    customFields: { industry: 'Tech' },
  });
});

// ============================================
// 15. updateReplyIntentSchema
// ============================================
console.log('\n--- updateReplyIntentSchema ---');

test('updateReplyIntentSchema: intent interested', () => { ok(updateReplyIntentSchema, { intent: 'interested' }); });
test('updateReplyIntentSchema: intent meeting_request', () => { ok(updateReplyIntentSchema, { intent: 'meeting_request' }); });
test('updateReplyIntentSchema: intent question', () => { ok(updateReplyIntentSchema, { intent: 'question' }); });
test('updateReplyIntentSchema: intent not_interested', () => { ok(updateReplyIntentSchema, { intent: 'not_interested' }); });
test('updateReplyIntentSchema: intent unsubscribe', () => { ok(updateReplyIntentSchema, { intent: 'unsubscribe' }); });
test('updateReplyIntentSchema: intent out_of_office', () => { ok(updateReplyIntentSchema, { intent: 'out_of_office' }); });
test('updateReplyIntentSchema: intent auto_reply', () => { ok(updateReplyIntentSchema, { intent: 'auto_reply' }); });
test('updateReplyIntentSchema: intent bounce', () => { ok(updateReplyIntentSchema, { intent: 'bounce' }); });
test('updateReplyIntentSchema: intent neutral', () => { ok(updateReplyIntentSchema, { intent: 'neutral' }); });
test('updateReplyIntentSchema: intent invalid', () => { bad(updateReplyIntentSchema, { intent: 'spam' }); });
test('updateReplyIntentSchema: intent empty string', () => { bad(updateReplyIntentSchema, { intent: '' }); });
test('updateReplyIntentSchema: missing intent', () => { bad(updateReplyIntentSchema, {}); });
test('updateReplyIntentSchema: intent number', () => { bad(updateReplyIntentSchema, { intent: 1 }); });

// ============================================
// 16. sendReplySchema
// ============================================
console.log('\n--- sendReplySchema ---');

test('sendReplySchema: valid', () => { ok(sendReplySchema, { body: 'Thanks!', inboxId: validUUID }); });
test('sendReplySchema: missing body', () => { bad(sendReplySchema, { inboxId: validUUID }); });
test('sendReplySchema: empty body', () => { bad(sendReplySchema, { body: '', inboxId: validUUID }); });
test('sendReplySchema: missing inboxId', () => { bad(sendReplySchema, { body: 'Hi' }); });
test('sendReplySchema: invalid inboxId', () => { bad(sendReplySchema, { body: 'Hi', inboxId: 'not-uuid' }); });
test('sendReplySchema: body with HTML', () => { ok(sendReplySchema, { body: '<p>Hello</p>', inboxId: validUUID }); });
test('sendReplySchema: body number type', () => { bad(sendReplySchema, { body: 123, inboxId: validUUID }); });
test('sendReplySchema: body whitespace only', () => { ok(sendReplySchema, { body: '   ', inboxId: validUUID }); });
test('sendReplySchema: inboxId SQL injection', () => { bad(sendReplySchema, { body: 'Hi', inboxId: "'; DROP TABLE--" }); });

// ============================================
// 17. createWebhookSchema
// ============================================
console.log('\n--- createWebhookSchema ---');

test('createWebhookSchema: valid minimal', () => {
  ok(createWebhookSchema, { url: 'https://example.com/webhook', events: ['email.sent'] });
});
test('createWebhookSchema: valid with all events', () => {
  ok(createWebhookSchema, {
    url: 'https://example.com/hook',
    events: [
      'email.sent', 'email.delivered', 'email.opened', 'email.clicked', 'email.bounced',
      'reply.received', 'reply.interested', 'reply.not_interested',
      'lead.bounced', 'lead.unsubscribed',
      'campaign.started', 'campaign.completed',
      'inbox.health_warning', 'inbox.paused',
    ],
  });
});
test('createWebhookSchema: valid with secret', () => {
  ok(createWebhookSchema, { url: 'https://example.com/hook', events: ['email.sent'], secret: 'my_secret_key_1234' });
});
test('createWebhookSchema: missing url', () => { bad(createWebhookSchema, { events: ['email.sent'] }); });
test('createWebhookSchema: invalid url', () => { bad(createWebhookSchema, { url: 'notaurl', events: ['email.sent'] }); });
test('createWebhookSchema: url without protocol', () => { bad(createWebhookSchema, { url: 'example.com/hook', events: ['email.sent'] }); });
test('createWebhookSchema: missing events', () => { bad(createWebhookSchema, { url: 'https://example.com/hook' }); });
test('createWebhookSchema: empty events array', () => { bad(createWebhookSchema, { url: 'https://example.com/hook', events: [] }); });
test('createWebhookSchema: invalid event type', () => { bad(createWebhookSchema, { url: 'https://example.com/hook', events: ['email.deleted'] }); });
test('createWebhookSchema: mixed valid and invalid events', () => {
  bad(createWebhookSchema, { url: 'https://example.com/hook', events: ['email.sent', 'invalid.event'] });
});
test('createWebhookSchema: secret too short (15 chars)', () => {
  bad(createWebhookSchema, { url: 'https://example.com/hook', events: ['email.sent'], secret: 'short_secret_12' });
});
test('createWebhookSchema: secret exactly 16 chars (min)', () => {
  ok(createWebhookSchema, { url: 'https://example.com/hook', events: ['email.sent'], secret: 'exactly16chars!!' });
});
test('createWebhookSchema: url HTTP is valid', () => {
  ok(createWebhookSchema, { url: 'http://example.com/hook', events: ['email.sent'] });
});
test('createWebhookSchema: single event email.delivered', () => {
  ok(createWebhookSchema, { url: 'https://example.com/hook', events: ['email.delivered'] });
});
test('createWebhookSchema: single event inbox.paused', () => {
  ok(createWebhookSchema, { url: 'https://example.com/hook', events: ['inbox.paused'] });
});

// ============================================
// 18. paginationSchema
// ============================================
console.log('\n--- paginationSchema ---');

test('paginationSchema: valid defaults (empty obj)', () => {
  const d = ok(paginationSchema, {});
  assert.equal(d.page, 1);
  assert.equal(d.limit, 20);
});
test('paginationSchema: valid page 1', () => { ok(paginationSchema, { page: 1 }); });
test('paginationSchema: page 0 (below min)', () => { bad(paginationSchema, { page: 0 }); });
test('paginationSchema: page -1', () => { bad(paginationSchema, { page: -1 }); });
test('paginationSchema: page large number', () => { ok(paginationSchema, { page: 999999 }); });
test('paginationSchema: page coerces string "5"', () => {
  const d = ok(paginationSchema, { page: '5' });
  assert.equal(d.page, 5);
});
test('paginationSchema: limit 1 (min)', () => { ok(paginationSchema, { limit: 1 }); });
test('paginationSchema: limit 100 (max)', () => { ok(paginationSchema, { limit: 100 }); });
test('paginationSchema: limit 0', () => { bad(paginationSchema, { limit: 0 }); });
test('paginationSchema: limit 101', () => { bad(paginationSchema, { limit: 101 }); });
test('paginationSchema: limit coerces string "50"', () => {
  const d = ok(paginationSchema, { limit: '50' });
  assert.equal(d.limit, 50);
});
test('paginationSchema: page float 1.5 is rejected', () => { bad(paginationSchema, { page: 1.5 }); });
test('paginationSchema: limit float 20.5 is rejected', () => { bad(paginationSchema, { limit: 20.5 }); });
test('paginationSchema: page non-numeric string', () => { bad(paginationSchema, { page: 'abc' }); });

// ============================================
// 19. dateRangeSchema
// ============================================
console.log('\n--- dateRangeSchema ---');

test('dateRangeSchema: valid empty object', () => { ok(dateRangeSchema, {}); });
test('dateRangeSchema: valid dateFrom ISO', () => { ok(dateRangeSchema, { dateFrom: '2024-01-01T00:00:00Z' }); });
test('dateRangeSchema: valid dateTo ISO', () => { ok(dateRangeSchema, { dateTo: '2024-12-31T23:59:59Z' }); });
test('dateRangeSchema: valid both dates', () => {
  ok(dateRangeSchema, { dateFrom: '2024-01-01T00:00:00Z', dateTo: '2024-12-31T23:59:59Z' });
});
test('dateRangeSchema: invalid dateFrom format', () => { bad(dateRangeSchema, { dateFrom: '2024-01-01' }); });
test('dateRangeSchema: invalid dateTo format', () => { bad(dateRangeSchema, { dateTo: 'not-a-date' }); });
test('dateRangeSchema: dateFrom number', () => { bad(dateRangeSchema, { dateFrom: 1704067200 }); });
test('dateRangeSchema: dateTo just date no time', () => { bad(dateRangeSchema, { dateTo: '2024-12-31' }); });
test('dateRangeSchema: valid ISO with milliseconds', () => { ok(dateRangeSchema, { dateFrom: '2024-06-15T10:30:00.000Z' }); });
test('dateRangeSchema: ISO with offset rejected (z.datetime() requires Z suffix)', () => { bad(dateRangeSchema, { dateFrom: '2024-06-15T10:30:00+05:00' }); });

// ============================================
// Cross-schema edge cases
// ============================================
console.log('\n--- Cross-schema edge cases ---');

test('email SQL injection in emailSchema', () => { bad(emailSchema, "admin@test.com'; DROP TABLE users;--"); });
test('uuidSchema with XSS payload', () => { bad(uuidSchema, '<script>alert(1)</script>'); });
test('urlSchema: javascript: protocol accepted by z.string().url()', () => { ok(urlSchema, 'javascript:alert(1)'); });
test('createInboxSmtpSchema with extra unknown field (whitelist irrelevant for zod)', () => {
  // Zod strips unknown fields by default, so extra fields don't cause errors
  const d = ok(createInboxSmtpSchema, { ...validSmtpInbox, unknownField: 'value' });
  assert.equal((d as any).unknownField, undefined);
});
test('updateLeadSchema: firstName empty string is valid (not required)', () => {
  ok(updateLeadSchema, { firstName: '' });
});
test('sequenceStepSchema: body with HTML tags', () => {
  ok(sequenceStepSchema, { stepNumber: 1, subject: 'Test', body: '<div><p>Hello {{firstName}}</p></div>' });
});
test('sequenceStepSchema: subject with template variables', () => {
  ok(sequenceStepSchema, { stepNumber: 1, subject: '{{firstName}}, check this out', body: 'Body' });
});
test('campaignSettingsSchema: sendDays empty array gets default', () => {
  // Empty array overrides default - zod accepts it
  const d = ok(campaignSettingsSchema, { sendDays: [] });
  assert.deepEqual(d.sendDays, []);
});
test('createWebhookSchema: duplicate events in array', () => {
  // Zod doesn't deduplicate arrays by default; dupes are valid
  ok(createWebhookSchema, { url: 'https://example.com/hook', events: ['email.sent', 'email.sent'] });
});
test('paginationSchema: both page and limit as strings', () => {
  const d = ok(paginationSchema, { page: '3', limit: '25' });
  assert.equal(d.page, 3);
  assert.equal(d.limit, 25);
});
test('createCampaignSchema: name with unicode', () => {
  ok(createCampaignSchema, { ...validCampaign, name: 'Campaign with emojis and accents' });
});
test('createInboxSmtpSchema: smtpPort NaN', () => { bad(createInboxSmtpSchema, { ...validSmtpInbox, smtpPort: NaN }); });
test('enableWarmupSchema: rampSpeed number instead of string', () => { bad(enableWarmupSchema, { rampSpeed: 1 }); });
test('sendReplySchema: inboxId empty string', () => { bad(sendReplySchema, { body: 'Hi', inboxId: '' }); });
test('updateReplyIntentSchema: extra fields stripped', () => {
  const d = ok(updateReplyIntentSchema, { intent: 'interested', extraField: 'test' });
  assert.equal((d as any).extraField, undefined);
});
test('createWebhookSchema: secret empty string', () => {
  bad(createWebhookSchema, { url: 'https://example.com/hook', events: ['email.sent'], secret: '' });
});
test('dateRangeSchema: dateFrom empty string', () => { bad(dateRangeSchema, { dateFrom: '' }); });
test('createLeadListSchema: description null', () => {
  // Zod will reject null for optional string
  bad(createLeadListSchema, { name: 'List', description: null });
});

// ============================================
// Results
// ============================================
console.log(`\n${'='.repeat(50)}\nResults: ${passed} passed, ${failed} failed of ${passed + failed}\n${'='.repeat(50)}`);
if (failures.length > 0) { console.log('\nFailures:'); failures.forEach(f => console.log(`  - ${f}`)); }
process.exit(failed > 0 ? 1 : 0);
