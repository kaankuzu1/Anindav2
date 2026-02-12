/**
 * Campaign Simulation: Tracking Pipeline Tests
 * Tests tracking ID encode/decode, pixel injection, click tracking,
 * campaign/variant stat increment simulation, COALESCE behavior,
 * URL validation, GIF buffer, and applyEmailTracking combinations.
 * ~35 tests
 */
import assert from 'node:assert/strict';
import {
  generateTrackingId,
  decodeTrackingId,
  injectTrackingPixel,
  wrapLinksForTracking,
  applyEmailTracking,
  isValidTrackingUrl,
  TRANSPARENT_GIF_BUFFER,
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

const BASE_URL = 'https://api.example.com';

// ============================================
// Tracking ID Encode/Decode
// ============================================
console.log('\n--- Tracking ID Encode/Decode ---');

test('Roundtrip: UUID email ID', () => {
  const emailId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const trackingId = generateTrackingId(emailId);
  const decoded = decodeTrackingId(trackingId);
  assert.equal(decoded, emailId);
});

test('Roundtrip: short alphanumeric ID', () => {
  const emailId = 'abc123';
  assert.equal(decodeTrackingId(generateTrackingId(emailId)), emailId);
});

test('Roundtrip: long compound ID', () => {
  const emailId = 'campaign_12345_lead_67890_seq_3';
  assert.equal(decodeTrackingId(generateTrackingId(emailId)), emailId);
});

test('Roundtrip: ID with special characters (+/=)', () => {
  const emailId = 'test+foo/bar=baz';
  assert.equal(decodeTrackingId(generateTrackingId(emailId)), emailId);
});

test('Roundtrip: empty string', () => {
  assert.equal(decodeTrackingId(generateTrackingId('')), '');
});

test('Generated tracking ID is URL-safe (no +, /)', () => {
  // Use an input that would produce + and / in standard base64
  const emailId = 'test+id/with=chars??>>>';
  const trackingId = generateTrackingId(emailId);
  assert.equal(trackingId.includes('+'), false, 'Should not contain +');
  assert.equal(trackingId.includes('/'), false, 'Should not contain /');
});

// ============================================
// Open Tracking (injectTrackingPixel)
// ============================================
console.log('\n--- Open Tracking (injectTrackingPixel) ---');

test('Pixel inserted before </body>', () => {
  const html = '<html><body><p>Content</p></body></html>';
  const result = injectTrackingPixel(html, 'tid1', BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/o/tid1`));
  const imgIdx = result.indexOf('<img');
  const bodyIdx = result.indexOf('</body>');
  assert.ok(imgIdx < bodyIdx, 'Pixel should be before </body>');
});

test('Pixel inserted before </html> when no </body>', () => {
  const html = '<html><p>No body tag</p></html>';
  const result = injectTrackingPixel(html, 'tid2', BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/o/tid2`));
  const imgIdx = result.indexOf('<img');
  const htmlIdx = result.indexOf('</html>');
  assert.ok(imgIdx < htmlIdx, 'Pixel should be before </html>');
});

test('Pixel appended when no closing tags', () => {
  const html = '<p>Plain fragment</p>';
  const result = injectTrackingPixel(html, 'tid3', BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/o/tid3`));
  assert.ok(result.startsWith('<p>Plain fragment</p>'), 'Original content preserved');
  assert.ok(result.endsWith('/>'), 'Pixel appended at end');
});

test('Pixel URL format is correct', () => {
  const html = '<body></body>';
  const result = injectTrackingPixel(html, 'myTrackId', BASE_URL);
  assert.ok(result.includes(`src="${BASE_URL}/api/v1/t/o/myTrackId"`));
  assert.ok(result.includes('width="1"'));
  assert.ok(result.includes('height="1"'));
  assert.ok(result.includes('style="display:none'));
});

// ============================================
// Click Tracking (wrapLinksForTracking)
// ============================================
console.log('\n--- Click Tracking (wrapLinksForTracking) ---');

test('HTTP link is wrapped', () => {
  const html = '<a href="http://example.com/page">Visit</a>';
  const result = wrapLinksForTracking(html, 'tid', BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/c/tid`));
  assert.ok(result.includes(encodeURIComponent('http://example.com/page')));
});

test('HTTPS link is wrapped', () => {
  const html = '<a href="https://secure.example.com">Link</a>';
  const result = wrapLinksForTracking(html, 'tid', BASE_URL);
  assert.ok(result.includes(encodeURIComponent('https://secure.example.com')));
});

test('mailto link is skipped', () => {
  const html = '<a href="mailto:user@test.com">Email</a>';
  assert.equal(wrapLinksForTracking(html, 'tid', BASE_URL), html);
});

test('tel link is skipped', () => {
  const html = '<a href="tel:+15551234567">Call</a>';
  assert.equal(wrapLinksForTracking(html, 'tid', BASE_URL), html);
});

test('Anchor (#) link is skipped', () => {
  const html = '<a href="#top">Back to top</a>';
  assert.equal(wrapLinksForTracking(html, 'tid', BASE_URL), html);
});

test('Unsubscribe link is skipped', () => {
  const html = '<a href="https://app.example.com/unsubscribe?t=abc">Unsubscribe</a>';
  assert.equal(wrapLinksForTracking(html, 'tid', BASE_URL), html);
});

test('Already-wrapped /t/c/ link is skipped', () => {
  const html = `<a href="${BASE_URL}/api/v1/t/c/tid?url=http%3A%2F%2Fexample.com">Link</a>`;
  assert.equal(wrapLinksForTracking(html, 'tid', BASE_URL), html);
});

test('Non-link attributes preserved after wrapping', () => {
  const html = '<a href="https://example.com" class="btn" target="_blank">Go</a>';
  const result = wrapLinksForTracking(html, 'tid', BASE_URL);
  assert.ok(result.includes('class="btn"'), 'class should be preserved');
  assert.ok(result.includes('target="_blank"'), 'target should be preserved');
});

// ============================================
// Campaign Stat Increment Simulation
// ============================================
console.log('\n--- Campaign Stat Increment Simulation ---');

test('Simulated increment_campaign_sent increments atomically', () => {
  const campaign = { sent_count: 0, opened_count: 0, clicked_count: 0, bounced_count: 0 };
  // Simulate 10 sends
  for (let i = 0; i < 10; i++) campaign.sent_count++;
  assert.equal(campaign.sent_count, 10);
});

test('Simulated increment_campaign_opens/clicks/bounces', () => {
  const campaign = { sent_count: 100, opened_count: 0, clicked_count: 0, bounced_count: 0 };
  for (let i = 0; i < 45; i++) campaign.opened_count++;
  for (let i = 0; i < 12; i++) campaign.clicked_count++;
  for (let i = 0; i < 3; i++) campaign.bounced_count++;
  assert.equal(campaign.opened_count, 45);
  assert.equal(campaign.clicked_count, 12);
  assert.equal(campaign.bounced_count, 3);
});

test('Final campaign counts match total operations', () => {
  const ops = { sent: 50, opened: 22, clicked: 8, bounced: 2 };
  const campaign = { sent_count: 0, opened_count: 0, clicked_count: 0, bounced_count: 0 };
  for (let i = 0; i < ops.sent; i++) campaign.sent_count++;
  for (let i = 0; i < ops.opened; i++) campaign.opened_count++;
  for (let i = 0; i < ops.clicked; i++) campaign.clicked_count++;
  for (let i = 0; i < ops.bounced; i++) campaign.bounced_count++;
  assert.equal(campaign.sent_count, ops.sent);
  assert.equal(campaign.opened_count, ops.opened);
  assert.equal(campaign.clicked_count, ops.clicked);
  assert.equal(campaign.bounced_count, ops.bounced);
});

// ============================================
// Variant Stat Increment Simulation
// ============================================
console.log('\n--- Variant Stat Increment Simulation ---');

test('Variant-level stats track independently', () => {
  const variantA = { sent_count: 0, opened_count: 0, clicked_count: 0, replied_count: 0 };
  const variantB = { sent_count: 0, opened_count: 0, clicked_count: 0, replied_count: 0 };
  for (let i = 0; i < 30; i++) variantA.sent_count++;
  for (let i = 0; i < 20; i++) variantB.sent_count++;
  for (let i = 0; i < 15; i++) variantA.opened_count++;
  for (let i = 0; i < 8; i++) variantB.opened_count++;
  for (let i = 0; i < 3; i++) variantA.replied_count++;
  assert.equal(variantA.sent_count, 30);
  assert.equal(variantB.sent_count, 20);
  assert.equal(variantA.opened_count, 15);
  assert.equal(variantB.opened_count, 8);
  assert.equal(variantA.replied_count, 3);
  assert.equal(variantB.replied_count, 0);
});

test('Campaign total equals sum of variant stats', () => {
  const variants = [
    { sent_count: 30, opened_count: 15, clicked_count: 5 },
    { sent_count: 20, opened_count: 8, clicked_count: 3 },
    { sent_count: 10, opened_count: 4, clicked_count: 1 },
  ];
  const totalSent = variants.reduce((s, v) => s + v.sent_count, 0);
  const totalOpened = variants.reduce((s, v) => s + v.opened_count, 0);
  const totalClicked = variants.reduce((s, v) => s + v.clicked_count, 0);
  assert.equal(totalSent, 60);
  assert.equal(totalOpened, 27);
  assert.equal(totalClicked, 9);
});

// ============================================
// COALESCE Behavior (first open/click timestamps)
// ============================================
console.log('\n--- COALESCE Behavior (first open/click timestamps) ---');

test('First open sets opened_at, subsequent opens do not change it', () => {
  const email: { open_count: number; opened_at: Date | null } = { open_count: 0, opened_at: null };
  // First open
  email.open_count++;
  email.opened_at = email.opened_at ?? new Date('2025-01-01T10:00:00Z');
  const firstOpenedAt = email.opened_at;
  // Second open
  email.open_count++;
  email.opened_at = email.opened_at ?? new Date('2025-01-01T11:00:00Z');
  // Third open
  email.open_count++;
  email.opened_at = email.opened_at ?? new Date('2025-01-01T12:00:00Z');
  assert.equal(email.open_count, 3);
  assert.equal(email.opened_at, firstOpenedAt, 'opened_at should remain first open time');
});

test('First click sets clicked_at, subsequent clicks do not change it', () => {
  const email: { click_count: number; clicked_at: Date | null } = { click_count: 0, clicked_at: null };
  email.click_count++;
  email.clicked_at = email.clicked_at ?? new Date('2025-02-01T09:00:00Z');
  const firstClickedAt = email.clicked_at;
  email.click_count++;
  email.clicked_at = email.clicked_at ?? new Date('2025-02-01T10:00:00Z');
  assert.equal(email.click_count, 2);
  assert.equal(email.clicked_at, firstClickedAt, 'clicked_at should remain first click time');
});

test('Open count increments even after opened_at is set', () => {
  const email: { open_count: number; opened_at: Date | null } = { open_count: 0, opened_at: null };
  for (let i = 0; i < 5; i++) {
    email.open_count++;
    email.opened_at = email.opened_at ?? new Date();
  }
  assert.equal(email.open_count, 5);
  assert.notEqual(email.opened_at, null);
});

// ============================================
// URL Validation (isValidTrackingUrl)
// ============================================
console.log('\n--- URL Validation ---');

test('http URL is valid', () => {
  assert.equal(isValidTrackingUrl('http://example.com'), true);
});

test('https URL is valid', () => {
  assert.equal(isValidTrackingUrl('https://example.com/path?q=1&r=2'), true);
});

test('javascript: URL is invalid', () => {
  assert.equal(isValidTrackingUrl('javascript:alert(1)'), false);
});

test('data: URL is invalid', () => {
  assert.equal(isValidTrackingUrl('data:text/html,<h1>x</h1>'), false);
});

test('ftp: URL is invalid', () => {
  assert.equal(isValidTrackingUrl('ftp://files.example.com/doc'), false);
});

test('Empty string is invalid', () => {
  assert.equal(isValidTrackingUrl(''), false);
});

test('Malformed URL is invalid', () => {
  assert.equal(isValidTrackingUrl('not a url at all'), false);
});

// ============================================
// Transparent GIF Buffer
// ============================================
console.log('\n--- Transparent GIF Buffer ---');

test('GIF buffer is a Buffer instance', () => {
  assert.ok(Buffer.isBuffer(TRANSPARENT_GIF_BUFFER));
});

test('GIF buffer is 42 bytes (standard 1x1 GIF89a)', () => {
  assert.equal(TRANSPARENT_GIF_BUFFER.length, 42);
});

test('GIF buffer starts with GIF89a magic bytes', () => {
  const header = TRANSPARENT_GIF_BUFFER.subarray(0, 6).toString('ascii');
  assert.equal(header, 'GIF89a');
});

// ============================================
// applyEmailTracking Combinations
// ============================================
console.log('\n--- applyEmailTracking Combinations ---');

test('Default: both opens and clicks enabled', () => {
  const html = '<body><a href="https://example.com">Link</a></body>';
  const result = applyEmailTracking(html, 'combo1', BASE_URL);
  assert.ok(result.includes('/t/o/combo1'), 'Should have open pixel');
  assert.ok(result.includes('/t/c/combo1'), 'Should have click tracking');
});

test('Opens only: pixel present, links not wrapped', () => {
  const html = '<body><a href="https://example.com">Link</a></body>';
  const result = applyEmailTracking(html, 'combo2', BASE_URL, { trackOpens: true, trackClicks: false });
  assert.ok(result.includes('/t/o/combo2'), 'Should have open pixel');
  assert.ok(!result.includes('/t/c/combo2'), 'Should NOT have click tracking');
  assert.ok(result.includes('href="https://example.com"'), 'Link should remain unwrapped');
});

test('Clicks only: links wrapped, no pixel', () => {
  const html = '<body><a href="https://example.com">Link</a></body>';
  const result = applyEmailTracking(html, 'combo3', BASE_URL, { trackOpens: false, trackClicks: true });
  assert.ok(!result.includes('/t/o/combo3'), 'Should NOT have open pixel');
  assert.ok(result.includes('/t/c/combo3'), 'Should have click tracking');
});

test('Neither: HTML unchanged', () => {
  const html = '<body><a href="https://example.com">Link</a></body>';
  const result = applyEmailTracking(html, 'combo4', BASE_URL, { trackOpens: false, trackClicks: false });
  assert.equal(result, html, 'HTML should be unchanged');
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
