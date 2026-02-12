import assert from 'node:assert/strict';

let passed = 0;
let failed = 0;
const total = { count: 0 };

function test(name: string, fn: () => void) {
  total.count++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

// === Extracted from analytics.service.ts ===

interface EmailRecord {
  status: string;
  open_count: number | null;
  click_count: number | null;
}

interface ReplyRecord {
  intent: string | null;
}

function computeDashboardStats(emails: EmailRecord[], replies: ReplyRecord[], spamCount: number) {
  const emailsSent = emails.length;
  const emailsDelivered = emails.filter(e => e.status !== 'bounced' && e.status !== 'failed').length;
  const emailsOpened = emails.filter(e => (e.open_count ?? 0) > 0).length;
  const emailsClicked = emails.filter(e => (e.click_count ?? 0) > 0).length;
  const emailsBounced = emails.filter(e => e.status === 'bounced').length;

  const repliesReceived = replies.length;
  const interestedReplies = replies.filter(r => r.intent === 'interested' || r.intent === 'meeting_request').length;

  const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0;
  const clickRate = emailsOpened > 0 ? (emailsClicked / emailsOpened) * 100 : 0;
  const replyRate = emailsSent > 0 ? (repliesReceived / emailsSent) * 100 : 0;
  const bounceRate = emailsSent > 0 ? (emailsBounced / emailsSent) * 100 : 0;
  const positiveReplyRate = repliesReceived > 0 ? (interestedReplies / repliesReceived) * 100 : 0;
  const spamRate = emailsSent > 0 ? (spamCount / emailsSent) * 100 : 0;

  return {
    overview: {
      emailsSent, emailsDelivered, emailsOpened, emailsClicked,
      emailsBounced, repliesReceived, interestedReplies, emailsSpamReported: spamCount,
    },
    rates: {
      openRate: Math.round(openRate * 10) / 10,
      clickRate: Math.round(clickRate * 10) / 10,
      replyRate: Math.round(replyRate * 10) / 10,
      bounceRate: Math.round(bounceRate * 10) / 10,
      positiveReplyRate: Math.round(positiveReplyRate * 10) / 10,
      spamRate: Math.round(spamRate * 10) / 10,
    },
  };
}

function computeCampaignRates(campaign: { sent_count: number; opened_count: number; clicked_count: number; replied_count: number; bounced_count: number }) {
  return {
    openRate: campaign.sent_count > 0 ? Math.round((campaign.opened_count / campaign.sent_count) * 1000) / 10 : 0,
    clickRate: campaign.opened_count > 0 ? Math.round((campaign.clicked_count / campaign.opened_count) * 1000) / 10 : 0,
    replyRate: campaign.sent_count > 0 ? Math.round((campaign.replied_count / campaign.sent_count) * 1000) / 10 : 0,
    bounceRate: campaign.sent_count > 0 ? Math.round((campaign.bounced_count / campaign.sent_count) * 1000) / 10 : 0,
  };
}

// Tests
console.log('\n📊 Backend Analytics Tests\n');

console.log('Dashboard Stats Shape:');
test('response includes emailsSpamReported in overview', () => {
  const result = computeDashboardStats([], [], 5);
  assert.equal(result.overview.emailsSpamReported, 5);
});

test('response includes spamRate in rates', () => {
  const result = computeDashboardStats(
    [{ status: 'sent', open_count: 0, click_count: 0 }],
    [], 0
  );
  assert.equal(typeof result.rates.spamRate, 'number');
});

test('spam rate calculated in response', () => {
  const emails = Array(100).fill({ status: 'sent', open_count: 0, click_count: 0 });
  const result = computeDashboardStats(emails, [], 5);
  assert.equal(result.rates.spamRate, 5);
});

console.log('\nEmpty Data Handling:');
test('empty emails returns zero stats', () => {
  const result = computeDashboardStats([], [], 0);
  assert.equal(result.overview.emailsSent, 0);
  assert.equal(result.overview.emailsOpened, 0);
  assert.equal(result.rates.openRate, 0);
});

test('empty replies returns zero reply stats', () => {
  const result = computeDashboardStats([], [], 0);
  assert.equal(result.overview.repliesReceived, 0);
  assert.equal(result.rates.positiveReplyRate, 0);
});

console.log('\nRate Calculations:');
test('open rate correct with mixed data', () => {
  const emails: EmailRecord[] = [
    { status: 'sent', open_count: 1, click_count: 0 },
    { status: 'sent', open_count: 0, click_count: 0 },
    { status: 'sent', open_count: 2, click_count: 1 },
    { status: 'bounced', open_count: 0, click_count: 0 },
  ];
  const result = computeDashboardStats(emails, [], 0);
  assert.equal(result.overview.emailsOpened, 2);
  assert.equal(result.rates.openRate, 50);
});

test('click rate based on opened, not sent', () => {
  const emails: EmailRecord[] = [
    { status: 'sent', open_count: 1, click_count: 1 },
    { status: 'sent', open_count: 1, click_count: 0 },
    { status: 'sent', open_count: 0, click_count: 0 },
  ];
  const result = computeDashboardStats(emails, [], 0);
  // 1 clicked / 2 opened = 50%
  assert.equal(result.rates.clickRate, 50);
});

test('interested replies = interested + meeting_request', () => {
  const replies: ReplyRecord[] = [
    { intent: 'interested' },
    { intent: 'meeting_request' },
    { intent: 'not_interested' },
    { intent: 'question' },
  ];
  const result = computeDashboardStats([], replies, 0);
  assert.equal(result.overview.interestedReplies, 2);
});

test('positive reply rate calculation', () => {
  const replies: ReplyRecord[] = [
    { intent: 'interested' },
    { intent: 'not_interested' },
    { intent: 'question' },
    { intent: 'neutral' },
  ];
  const result = computeDashboardStats([], replies, 0);
  assert.equal(result.rates.positiveReplyRate, 25);
});

console.log('\nRounding:');
test('rates rounded to 1 decimal place', () => {
  const emails: EmailRecord[] = Array(3).fill({ status: 'sent', open_count: 1, click_count: 0 });
  const result = computeDashboardStats(emails, [{ intent: 'neutral' }], 0);
  // 1/3 = 33.3333... → 33.3
  assert.equal(result.rates.replyRate, 33.3);
});

console.log('\nCampaign Rates:');
test('campaign open rate from sent_count', () => {
  const rates = computeCampaignRates({ sent_count: 100, opened_count: 25, clicked_count: 5, replied_count: 3, bounced_count: 2 });
  assert.equal(rates.openRate, 25);
});

test('campaign click rate from opened_count', () => {
  const rates = computeCampaignRates({ sent_count: 100, opened_count: 50, clicked_count: 10, replied_count: 3, bounced_count: 2 });
  assert.equal(rates.clickRate, 20);
});

test('campaign zero sent_count returns 0 rates', () => {
  const rates = computeCampaignRates({ sent_count: 0, opened_count: 0, clicked_count: 0, replied_count: 0, bounced_count: 0 });
  assert.equal(rates.openRate, 0);
  assert.equal(rates.clickRate, 0);
  assert.equal(rates.replyRate, 0);
  assert.equal(rates.bounceRate, 0);
});

console.log('\nNull Safety:');
test('null open_count treated as 0', () => {
  const emails: EmailRecord[] = [{ status: 'sent', open_count: null, click_count: null }];
  const result = computeDashboardStats(emails, [], 0);
  assert.equal(result.overview.emailsOpened, 0);
  assert.equal(result.overview.emailsClicked, 0);
});

test('null intent replies not counted as interested', () => {
  const replies: ReplyRecord[] = [{ intent: null }];
  const result = computeDashboardStats([], replies, 0);
  assert.equal(result.overview.interestedReplies, 0);
});

// Summary
console.log(`\n${ failed === 0 ? '✓' : '✗' } ${passed}/${total.count} tests passed\n`);
process.exit(failed > 0 ? 1 : 0);
