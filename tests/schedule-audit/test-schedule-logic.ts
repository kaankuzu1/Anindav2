import assert from 'node:assert/strict';
import { isWithinPerDaySchedule, isWithinSendWindow } from '../../packages/shared/src/utils';

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

console.log('\n=== Schedule Logic Tests ===\n');

// ============================================================
// 1. isWithinPerDaySchedule
// ============================================================
console.log('--- isWithinPerDaySchedule ---');

test('single interval - inside', () => {
  // Monday, January 5, 2026 at 14:00 UTC = Monday 9AM EST
  const date = new Date('2026-01-05T14:00:00Z');
  const schedule = {
    mon: [{ start: 9, end: 17 }]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Should be within Monday 9-17 schedule');
});

test('single interval - outside (wrong day)', () => {
  // Saturday, January 10, 2026 at 14:00 UTC = Saturday 9AM EST
  const date = new Date('2026-01-10T14:00:00Z');
  const schedule = {
    mon: [{ start: 9, end: 17 }]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, false, 'Should be outside schedule on Saturday');
});

test('single interval - outside (wrong hour)', () => {
  // Monday, January 5, 2026 at 23:00 UTC = Monday 6PM EST (18:00)
  const date = new Date('2026-01-05T23:00:00Z');
  const schedule = {
    mon: [{ start: 9, end: 17 }]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, false, 'Should be outside schedule at 18:00 (after 17:00 end)');
});

test('multiple intervals - first window', () => {
  // Monday, January 5, 2026 at 15:00 UTC = Monday 10AM EST
  const date = new Date('2026-01-05T15:00:00Z');
  const schedule = {
    mon: [
      { start: 9, end: 12 },
      { start: 14, end: 17 }
    ]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Should be within first window (9-12)');
});

test('multiple intervals - gap', () => {
  // Monday, January 5, 2026 at 18:00 UTC = Monday 1PM EST (13:00)
  const date = new Date('2026-01-05T18:00:00Z');
  const schedule = {
    mon: [
      { start: 9, end: 12 },
      { start: 14, end: 17 }
    ]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, false, 'Should be in the gap between windows');
});

test('multiple intervals - second window', () => {
  // Monday, January 5, 2026 at 20:00 UTC = Monday 3PM EST (15:00)
  const date = new Date('2026-01-05T20:00:00Z');
  const schedule = {
    mon: [
      { start: 9, end: 12 },
      { start: 14, end: 17 }
    ]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Should be within second window (14-17)');
});

test('start inclusive', () => {
  // Monday, January 5, 2026 at 14:00 UTC = Monday 9AM EST (exactly 9:00)
  const date = new Date('2026-01-05T14:00:00Z');
  const schedule = {
    mon: [{ start: 9, end: 17 }]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Start hour should be inclusive');
});

test('end exclusive', () => {
  // Monday, January 5, 2026 at 22:00 UTC = Monday 5PM EST (exactly 17:00)
  const date = new Date('2026-01-05T22:00:00Z');
  const schedule = {
    mon: [{ start: 9, end: 17 }]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, false, 'End hour should be exclusive');
});

test('empty schedule', () => {
  const date = new Date('2026-01-05T14:00:00Z');
  const schedule = {};
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, false, 'Empty schedule should return false');
});

test('day not in schedule', () => {
  // Tuesday, January 6, 2026 at 14:00 UTC = Tuesday 9AM EST
  const date = new Date('2026-01-06T14:00:00Z');
  const schedule = {
    mon: [{ start: 9, end: 17 }]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, false, 'Tuesday should not match Monday-only schedule');
});

test('all 7 days - Monday', () => {
  const date = new Date('2026-01-05T14:00:00Z'); // Monday 9AM EST
  const schedule = { mon: [{ start: 9, end: 17 }] };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Monday should match');
});

test('all 7 days - Tuesday', () => {
  const date = new Date('2026-01-06T14:00:00Z'); // Tuesday 9AM EST
  const schedule = { tue: [{ start: 9, end: 17 }] };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Tuesday should match');
});

test('all 7 days - Wednesday', () => {
  const date = new Date('2026-01-07T14:00:00Z'); // Wednesday 9AM EST
  const schedule = { wed: [{ start: 9, end: 17 }] };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Wednesday should match');
});

test('all 7 days - Thursday', () => {
  const date = new Date('2026-01-08T14:00:00Z'); // Thursday 9AM EST
  const schedule = { thu: [{ start: 9, end: 17 }] };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Thursday should match');
});

test('all 7 days - Friday', () => {
  const date = new Date('2026-01-09T14:00:00Z'); // Friday 9AM EST
  const schedule = { fri: [{ start: 9, end: 17 }] };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Friday should match');
});

test('all 7 days - Saturday', () => {
  const date = new Date('2026-01-10T14:00:00Z'); // Saturday 9AM EST
  const schedule = { sat: [{ start: 9, end: 17 }] };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Saturday should match');
});

test('all 7 days - Sunday', () => {
  const date = new Date('2026-01-11T14:00:00Z'); // Sunday 9AM EST
  const schedule = { sun: [{ start: 9, end: 17 }] };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Sunday should match');
});

test('midnight hour', () => {
  // Monday, January 5, 2026 at 05:00 UTC = Monday 12AM EST (0:00)
  const date = new Date('2026-01-05T05:00:00Z');
  const schedule = {
    mon: [{ start: 0, end: 6 }]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Hour 0 should work correctly');
});

test('end of day', () => {
  // Tuesday, January 6, 2026 at 04:00 UTC = Monday 11PM EST (23:00)
  const date = new Date('2026-01-06T04:00:00Z');
  const schedule = {
    mon: [{ start: 22, end: 24 }]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Hour 23 should be within 22-24 range');
});

test('hour 24 boundary', () => {
  // Tuesday, January 6, 2026 at 04:00 UTC = Monday 11PM EST (23:00)
  const date = new Date('2026-01-06T04:00:00Z');
  const schedule = {
    mon: [{ start: 9, end: 24 }]
  };
  const result = isWithinPerDaySchedule(date, schedule, 'America/New_York');
  assert.equal(result, true, 'Hour 23 should be < 24 (end exclusive)');
});

// ============================================================
// 2. isWithinSendWindow - Backward Compatibility
// ============================================================
console.log('\n--- isWithinSendWindow (backward compatibility) ---');

test('isWithinSendWindow - within window', () => {
  // Monday, January 5, 2026 at 14:00 UTC = Monday 9:00 EST
  const date = new Date('2026-01-05T14:00:00Z');
  const result = isWithinSendWindow(date, '09:00', '17:00', 'America/New_York', ['mon']);
  assert.equal(result, true, 'Should be within send window');
});

test('isWithinSendWindow - outside window (wrong day)', () => {
  // Saturday, January 10, 2026 at 14:00 UTC
  const date = new Date('2026-01-10T14:00:00Z');
  const result = isWithinSendWindow(date, '09:00', '17:00', 'America/New_York', ['mon']);
  assert.equal(result, false, 'Should be outside window on Saturday');
});

test('isWithinSendWindow - outside window (wrong time)', () => {
  // Monday, January 5, 2026 at 23:00 UTC = Monday 18:00 EST
  const date = new Date('2026-01-05T23:00:00Z');
  const result = isWithinSendWindow(date, '09:00', '17:00', 'America/New_York', ['mon']);
  assert.equal(result, false, 'Should be outside window after end time');
});

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(50));
if (failed > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log(`  - ${f}`));
}
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);
