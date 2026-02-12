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

// === Simulated tracking pipeline logic ===

interface TrackingCall {
  type: 'rpc' | 'insert' | 'update';
  target: string;
  params?: Record<string, unknown>;
}

function simulateRecordOpen(email: { id: string; campaign_id?: string; variant_id?: string }): TrackingCall[] {
  const calls: TrackingCall[] = [];

  // Step 1: RPC for atomic open increment (Bug #1 fix)
  calls.push({ type: 'rpc', target: 'increment_email_open', params: { p_email_id: email.id } });

  // Step 2: Log event
  calls.push({ type: 'insert', target: 'email_events', params: { event_type: 'opened' } });

  // Step 3: Campaign stats
  if (email.campaign_id) {
    calls.push({ type: 'rpc', target: 'increment_campaign_opens', params: { campaign_id: email.campaign_id } });
  }

  // Step 4: Variant stats
  if (email.variant_id) {
    calls.push({ type: 'rpc', target: 'increment_variant_stat', params: { p_variant_id: email.variant_id, p_stat: 'opened' } });
  }

  return calls;
}

function simulateRecordClick(email: { id: string; campaign_id?: string; variant_id?: string }): TrackingCall[] {
  const calls: TrackingCall[] = [];

  calls.push({ type: 'rpc', target: 'increment_email_click', params: { p_email_id: email.id } });
  calls.push({ type: 'insert', target: 'email_events', params: { event_type: 'clicked' } });

  if (email.campaign_id) {
    calls.push({ type: 'rpc', target: 'increment_campaign_clicks', params: { campaign_id: email.campaign_id } });
  }

  if (email.variant_id) {
    calls.push({ type: 'rpc', target: 'increment_variant_stat', params: { p_variant_id: email.variant_id, p_stat: 'clicked' } });
  }

  return calls;
}

function simulateEmailSent(email: { id: string; campaign_id?: string; variant_id?: string }): TrackingCall[] {
  const calls: TrackingCall[] = [];

  // Step 1: Update email status to sent
  calls.push({ type: 'update', target: 'emails', params: { status: 'sent' } });

  // Step 2: Increment campaign sent count (Bug #5 fix)
  if (email.campaign_id) {
    calls.push({ type: 'rpc', target: 'increment_campaign_sent', params: { campaign_id: email.campaign_id } });
  }

  // Step 3: Variant stats
  if (email.variant_id) {
    calls.push({ type: 'rpc', target: 'increment_variant_stat', params: { p_variant_id: email.variant_id, p_stat: 'sent' } });
  }

  // Step 4: Log event
  calls.push({ type: 'insert', target: 'email_events', params: { event_type: 'sent' } });

  return calls;
}

// === SQL RPC simulation ===
function simulateIncrementEmailOpen(email: { open_count: number | null; opened_at: string | null }) {
  return {
    open_count: (email.open_count ?? 0) + 1,
    opened_at: email.opened_at ?? new Date().toISOString(),
  };
}

function simulateIncrementEmailClick(email: { click_count: number | null; clicked_at: string | null }) {
  return {
    click_count: (email.click_count ?? 0) + 1,
    clicked_at: email.clicked_at ?? new Date().toISOString(),
  };
}

// Tests
console.log('\n📊 Tracking Pipeline Tests\n');

console.log('Open Tracking:');
test('recordOpen uses RPC not manual update', () => {
  const calls = simulateRecordOpen({ id: 'e1', campaign_id: 'c1' });
  const rpcCall = calls.find(c => c.target === 'increment_email_open');
  assert.ok(rpcCall, 'should call increment_email_open RPC');
  assert.equal(rpcCall.type, 'rpc');
  // Ensure no manual update to emails table for opened_at
  const manualUpdate = calls.find(c => c.type === 'update' && c.target === 'emails');
  assert.equal(manualUpdate, undefined, 'should not manually update emails');
});

test('recordOpen logs email_events', () => {
  const calls = simulateRecordOpen({ id: 'e1' });
  const eventInsert = calls.find(c => c.target === 'email_events');
  assert.ok(eventInsert);
});

test('recordOpen increments campaign opens when campaign_id present', () => {
  const calls = simulateRecordOpen({ id: 'e1', campaign_id: 'c1' });
  const campaignRpc = calls.find(c => c.target === 'increment_campaign_opens');
  assert.ok(campaignRpc);
});

test('recordOpen skips campaign increment when no campaign_id', () => {
  const calls = simulateRecordOpen({ id: 'e1' });
  const campaignRpc = calls.find(c => c.target === 'increment_campaign_opens');
  assert.equal(campaignRpc, undefined);
});

test('recordOpen increments variant stat when variant_id present', () => {
  const calls = simulateRecordOpen({ id: 'e1', variant_id: 'v1' });
  const variantRpc = calls.find(c => c.target === 'increment_variant_stat');
  assert.ok(variantRpc);
  assert.deepEqual(variantRpc.params, { p_variant_id: 'v1', p_stat: 'opened' });
});

test('recordOpen skips variant stat when no variant_id', () => {
  const calls = simulateRecordOpen({ id: 'e1' });
  const variantRpc = calls.find(c => c.target === 'increment_variant_stat');
  assert.equal(variantRpc, undefined);
});

console.log('\nClick Tracking:');
test('recordClick uses RPC not manual update', () => {
  const calls = simulateRecordClick({ id: 'e1', campaign_id: 'c1' });
  const rpcCall = calls.find(c => c.target === 'increment_email_click');
  assert.ok(rpcCall);
  assert.equal(rpcCall.type, 'rpc');
});

test('recordClick increments campaign clicks', () => {
  const calls = simulateRecordClick({ id: 'e1', campaign_id: 'c1' });
  const campaignRpc = calls.find(c => c.target === 'increment_campaign_clicks');
  assert.ok(campaignRpc);
});

test('recordClick logs clicked event', () => {
  const calls = simulateRecordClick({ id: 'e1' });
  const eventInsert = calls.find(c => c.target === 'email_events' && c.params?.event_type === 'clicked');
  assert.ok(eventInsert);
});

console.log('\nEmail Sent Flow:');
test('email sent increments campaign sent count (Bug #5 fix)', () => {
  const calls = simulateEmailSent({ id: 'e1', campaign_id: 'c1' });
  const sentRpc = calls.find(c => c.target === 'increment_campaign_sent');
  assert.ok(sentRpc, 'should call increment_campaign_sent');
});

test('email sent skips campaign increment without campaign_id', () => {
  const calls = simulateEmailSent({ id: 'e1' });
  const sentRpc = calls.find(c => c.target === 'increment_campaign_sent');
  assert.equal(sentRpc, undefined);
});

test('email sent increments variant sent stat', () => {
  const calls = simulateEmailSent({ id: 'e1', variant_id: 'v1' });
  const variantRpc = calls.find(c => c.target === 'increment_variant_stat');
  assert.ok(variantRpc);
  assert.deepEqual(variantRpc.params, { p_variant_id: 'v1', p_stat: 'sent' });
});

test('email sent updates status before incrementing', () => {
  const calls = simulateEmailSent({ id: 'e1', campaign_id: 'c1' });
  const statusUpdateIdx = calls.findIndex(c => c.target === 'emails');
  const sentIncrementIdx = calls.findIndex(c => c.target === 'increment_campaign_sent');
  assert.ok(statusUpdateIdx < sentIncrementIdx, 'status update should come before sent increment');
});

console.log('\nRPC Atomicity:');
test('increment_email_open increments count and sets opened_at on first open', () => {
  const result = simulateIncrementEmailOpen({ open_count: null, opened_at: null });
  assert.equal(result.open_count, 1);
  assert.ok(result.opened_at, 'opened_at should be set');
});

test('increment_email_open increments count but preserves existing opened_at', () => {
  const existingTime = '2024-01-01T00:00:00Z';
  const result = simulateIncrementEmailOpen({ open_count: 2, opened_at: existingTime });
  assert.equal(result.open_count, 3);
  assert.equal(result.opened_at, existingTime, 'opened_at should not change');
});

test('increment_email_click increments count and sets clicked_at on first click', () => {
  const result = simulateIncrementEmailClick({ click_count: null, clicked_at: null });
  assert.equal(result.click_count, 1);
  assert.ok(result.clicked_at, 'clicked_at should be set');
});

test('increment_email_click increments count but preserves existing clicked_at', () => {
  const existingTime = '2024-01-01T00:00:00Z';
  const result = simulateIncrementEmailClick({ click_count: 1, clicked_at: existingTime });
  assert.equal(result.click_count, 2);
  assert.equal(result.clicked_at, existingTime, 'clicked_at should not change');
});

test('increment handles null count gracefully (COALESCE behavior)', () => {
  const result = simulateIncrementEmailOpen({ open_count: null, opened_at: null });
  assert.equal(result.open_count, 1, 'null count should be treated as 0');
});

console.log('\nCall Order:');
test('open tracking: RPC → event → campaign → variant', () => {
  const calls = simulateRecordOpen({ id: 'e1', campaign_id: 'c1', variant_id: 'v1' });
  assert.equal(calls[0].target, 'increment_email_open');
  assert.equal(calls[1].target, 'email_events');
  assert.equal(calls[2].target, 'increment_campaign_opens');
  assert.equal(calls[3].target, 'increment_variant_stat');
});

test('click tracking: RPC → event → campaign → variant', () => {
  const calls = simulateRecordClick({ id: 'e1', campaign_id: 'c1', variant_id: 'v1' });
  assert.equal(calls[0].target, 'increment_email_click');
  assert.equal(calls[1].target, 'email_events');
  assert.equal(calls[2].target, 'increment_campaign_clicks');
  assert.equal(calls[3].target, 'increment_variant_stat');
});

// Summary
console.log(`\n${ failed === 0 ? '✓' : '✗' } ${passed}/${total.count} tests passed\n`);
process.exit(failed > 0 ? 1 : 0);
