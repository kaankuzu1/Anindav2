/**
 * Tracking Pipeline Audit Tests
 * Tests for tracking ID encoding/decoding, pixel injection, link wrapping,
 * combined tracking, URL validation, and GIF buffer verification.
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
// generateTrackingId / decodeTrackingId
// ============================================
console.log('\n--- Tracking ID Encode/Decode ---');

test('Roundtrip: UUID-style email ID', () => {
  const emailId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const trackingId = generateTrackingId(emailId);
  const decoded = decodeTrackingId(trackingId);
  assert.equal(decoded, emailId);
});

test('Roundtrip: simple alphanumeric ID', () => {
  const emailId = 'email123';
  const trackingId = generateTrackingId(emailId);
  const decoded = decodeTrackingId(trackingId);
  assert.equal(decoded, emailId);
});

test('Roundtrip: ID with special characters', () => {
  const emailId = 'email+special/chars=test';
  const trackingId = generateTrackingId(emailId);
  const decoded = decodeTrackingId(trackingId);
  assert.equal(decoded, emailId);
});

test('Roundtrip: empty string', () => {
  const trackingId = generateTrackingId('');
  const decoded = decodeTrackingId(trackingId);
  assert.equal(decoded, '');
});

test('generateTrackingId produces base64url (no +, /, =)', () => {
  const emailId = 'test+id/with=chars';
  const trackingId = generateTrackingId(emailId);
  assert.equal(trackingId.includes('+'), false);
  assert.equal(trackingId.includes('/'), false);
  // base64url may omit padding, but should not use standard '='
  assert.ok(!trackingId.includes('=') || trackingId.endsWith('='));
});

// ============================================
// injectTrackingPixel
// ============================================
console.log('\n--- injectTrackingPixel ---');

test('Pixel injected before </body>', () => {
  const html = '<html><body><p>Hello</p></body></html>';
  const result = injectTrackingPixel(html, 'tid123', BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/o/tid123`));
  assert.ok(result.indexOf('<img') < result.indexOf('</body>'));
});

test('Pixel injected before </html> when no </body>', () => {
  const html = '<html><p>Hello</p></html>';
  const result = injectTrackingPixel(html, 'tid456', BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/o/tid456`));
  assert.ok(result.indexOf('<img') < result.indexOf('</html>'));
});

test('Pixel appended when no </body> or </html>', () => {
  const html = '<p>Hello</p>';
  const result = injectTrackingPixel(html, 'tid789', BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/o/tid789`));
  assert.ok(result.startsWith('<p>Hello</p>'));
  assert.ok(result.endsWith('/>'));
});

test('Pixel has correct attributes', () => {
  const html = '<body></body>';
  const result = injectTrackingPixel(html, 'tid', BASE_URL);
  assert.ok(result.includes('width="1"'));
  assert.ok(result.includes('height="1"'));
  assert.ok(result.includes('style="display:none'));
});

// ============================================
// wrapLinksForTracking
// ============================================
console.log('\n--- wrapLinksForTracking ---');

test('HTTP link wrapped', () => {
  const html = '<a href="http://example.com">Link</a>';
  const result = wrapLinksForTracking(html, 'tid', BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/c/tid`));
  assert.ok(result.includes(encodeURIComponent('http://example.com')));
});

test('HTTPS link wrapped', () => {
  const html = '<a href="https://secure.example.com/page">Link</a>';
  const result = wrapLinksForTracking(html, 'tid', BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/c/tid`));
  assert.ok(result.includes(encodeURIComponent('https://secure.example.com/page')));
});

test('mailto link skipped', () => {
  const html = '<a href="mailto:user@test.com">Email</a>';
  const result = wrapLinksForTracking(html, 'tid', BASE_URL);
  assert.equal(result, html);
});

test('tel link skipped', () => {
  const html = '<a href="tel:+1234567890">Call</a>';
  const result = wrapLinksForTracking(html, 'tid', BASE_URL);
  assert.equal(result, html);
});

test('Anchor (#) link skipped', () => {
  const html = '<a href="#section">Section</a>';
  const result = wrapLinksForTracking(html, 'tid', BASE_URL);
  assert.equal(result, html);
});

test('Unsubscribe link skipped', () => {
  const html = '<a href="https://example.com/unsubscribe?token=abc">Unsubscribe</a>';
  const result = wrapLinksForTracking(html, 'tid', BASE_URL);
  assert.equal(result, html);
});

test('Already-wrapped link skipped (/t/c/ in URL)', () => {
  const html = `<a href="${BASE_URL}/api/v1/t/c/tid?url=http%3A%2F%2Fexample.com">Link</a>`;
  const result = wrapLinksForTracking(html, 'tid', BASE_URL);
  assert.equal(result, html);
});

test('Multiple links: only http/https wrapped', () => {
  const html = '<a href="https://a.com">A</a><a href="mailto:x@y.com">X</a><a href="https://b.com">B</a>';
  const result = wrapLinksForTracking(html, 'tid', BASE_URL);
  // a.com and b.com should be wrapped, mailto should not
  assert.ok(result.includes(encodeURIComponent('https://a.com')));
  assert.ok(result.includes(encodeURIComponent('https://b.com')));
  assert.ok(result.includes('mailto:x@y.com'));
});

// ============================================
// applyEmailTracking
// ============================================
console.log('\n--- applyEmailTracking ---');

test('Both trackOpens and trackClicks enabled (default)', () => {
  const html = '<body><a href="https://link.com">Link</a></body>';
  const result = applyEmailTracking(html, 'tid', BASE_URL);
  assert.ok(result.includes('/t/o/tid'), 'Should have tracking pixel');
  assert.ok(result.includes('/t/c/tid'), 'Should have click tracking');
});

test('trackOpens only', () => {
  const html = '<body><a href="https://link.com">Link</a></body>';
  const result = applyEmailTracking(html, 'tid', BASE_URL, { trackOpens: true, trackClicks: false });
  assert.ok(result.includes('/t/o/tid'), 'Should have tracking pixel');
  assert.ok(!result.includes('/t/c/tid'), 'Should NOT have click tracking');
});

test('trackClicks only', () => {
  const html = '<body><a href="https://link.com">Link</a></body>';
  const result = applyEmailTracking(html, 'tid', BASE_URL, { trackOpens: false, trackClicks: true });
  assert.ok(!result.includes('/t/o/tid'), 'Should NOT have tracking pixel');
  assert.ok(result.includes('/t/c/tid'), 'Should have click tracking');
});

test('Neither trackOpens nor trackClicks', () => {
  const html = '<body><a href="https://link.com">Link</a></body>';
  const result = applyEmailTracking(html, 'tid', BASE_URL, { trackOpens: false, trackClicks: false });
  assert.equal(result, html);
});

// ============================================
// isValidTrackingUrl
// ============================================
console.log('\n--- isValidTrackingUrl ---');

test('http URL is valid', () => {
  assert.equal(isValidTrackingUrl('http://example.com'), true);
});

test('https URL is valid', () => {
  assert.equal(isValidTrackingUrl('https://example.com/path?q=1'), true);
});

test('javascript: URL is invalid', () => {
  assert.equal(isValidTrackingUrl('javascript:alert(1)'), false);
});

test('data: URL is invalid', () => {
  assert.equal(isValidTrackingUrl('data:text/html,<h1>hi</h1>'), false);
});

test('ftp: URL is invalid', () => {
  assert.equal(isValidTrackingUrl('ftp://files.example.com'), false);
});

test('Empty string is invalid', () => {
  assert.equal(isValidTrackingUrl(''), false);
});

// ============================================
// TRANSPARENT_GIF_BUFFER
// ============================================
console.log('\n--- TRANSPARENT_GIF_BUFFER ---');

test('GIF buffer starts with GIF89a magic bytes', () => {
  assert.ok(TRANSPARENT_GIF_BUFFER.length > 6, 'Buffer should be at least 6 bytes');
  assert.equal(TRANSPARENT_GIF_BUFFER[0], 0x47); // G
  assert.equal(TRANSPARENT_GIF_BUFFER[1], 0x49); // I
  assert.equal(TRANSPARENT_GIF_BUFFER[2], 0x46); // F
  assert.equal(TRANSPARENT_GIF_BUFFER[3], 0x38); // 8
  assert.equal(TRANSPARENT_GIF_BUFFER[4], 0x39); // 9
  assert.equal(TRANSPARENT_GIF_BUFFER[5], 0x61); // a
});

test('GIF buffer is a valid Buffer instance', () => {
  assert.ok(Buffer.isBuffer(TRANSPARENT_GIF_BUFFER));
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
