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

// === Extracted logic from analytics/page.tsx ===

// Bug #8 fix: Only count actually sent statuses
function countEmailsSent(emails: { status: string }[]): number {
  return emails.filter(e =>
    ['sent', 'delivered', 'opened', 'clicked', 'bounced'].includes(e.status)
  ).length;
}

function countEmailsOpened(emails: { open_count: number | null }[]): number {
  return emails.filter(e => (e.open_count ?? 0) > 0).length;
}

function countEmailsClicked(emails: { click_count: number | null }[]): number {
  return emails.filter(e => (e.click_count ?? 0) > 0).length;
}

function calculateRate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

// Tests
console.log('\n📊 Frontend Calculation Tests\n');

console.log('Status Filtering:');
test('counts sent emails correctly', () => {
  const emails = [
    { status: 'sent' }, { status: 'delivered' }, { status: 'opened' },
    { status: 'clicked' }, { status: 'bounced' },
  ];
  assert.equal(countEmailsSent(emails), 5);
});

test('excludes queued from sent count', () => {
  assert.equal(countEmailsSent([{ status: 'queued' }]), 0);
});

test('excludes sending from sent count', () => {
  assert.equal(countEmailsSent([{ status: 'sending' }]), 0);
});

test('excludes failed from sent count', () => {
  assert.equal(countEmailsSent([{ status: 'failed' }]), 0);
});

test('excludes retry_pending from sent count', () => {
  assert.equal(countEmailsSent([{ status: 'retry_pending' }]), 0);
});

test('handles empty array', () => {
  assert.equal(countEmailsSent([]), 0);
});

test('mixed statuses counted correctly', () => {
  const emails = [
    { status: 'sent' }, { status: 'queued' }, { status: 'failed' },
    { status: 'delivered' }, { status: 'sending' },
  ];
  assert.equal(countEmailsSent(emails), 2);
});

console.log('\nOpen/Click Counting:');
test('counts opened emails (open_count > 0)', () => {
  const emails = [
    { open_count: 1 }, { open_count: 0 }, { open_count: 3 }, { open_count: null },
  ];
  assert.equal(countEmailsOpened(emails), 2);
});

test('counts clicked emails (click_count > 0)', () => {
  const emails = [
    { click_count: 1 }, { click_count: 0 }, { click_count: null },
  ];
  assert.equal(countEmailsClicked(emails), 1);
});

test('null open_count treated as 0', () => {
  assert.equal(countEmailsOpened([{ open_count: null }]), 0);
});

test('null click_count treated as 0', () => {
  assert.equal(countEmailsClicked([{ click_count: null }]), 0);
});

console.log('\nRate Calculations:');
test('open rate = (opened/sent) * 100, rounded to 1 decimal', () => {
  assert.equal(calculateRate(15, 100), 15);
});

test('click rate with decimal precision', () => {
  assert.equal(calculateRate(3, 100), 3);
});

test('reply rate precision', () => {
  assert.equal(calculateRate(7, 100), 7);
});

test('rate with rounding', () => {
  assert.equal(calculateRate(1, 3), 33.3);
});

test('rate of 0 when denominator is 0', () => {
  assert.equal(calculateRate(5, 0), 0);
});

test('rate of 0 when numerator is 0', () => {
  assert.equal(calculateRate(0, 100), 0);
});

test('100% rate', () => {
  assert.equal(calculateRate(100, 100), 100);
});

console.log('\nSpam Rate:');
test('spam rate calculated correctly', () => {
  assert.equal(calculateRate(2, 200), 1);
});

test('spam rate with 0 sent', () => {
  assert.equal(calculateRate(5, 0), 0);
});

test('spam rate with 0 spam', () => {
  assert.equal(calculateRate(0, 500), 0);
});

console.log('\nBounce Rate:');
test('bounce rate calculated correctly', () => {
  assert.equal(calculateRate(3, 100), 3);
});

test('bounce rate 0 with no sends', () => {
  assert.equal(calculateRate(0, 0), 0);
});

// Summary
console.log(`\n${ failed === 0 ? '✓' : '✗' } ${passed}/${total.count} tests passed\n`);
process.exit(failed > 0 ? 1 : 0);
