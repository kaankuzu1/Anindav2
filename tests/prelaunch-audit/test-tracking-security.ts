/**
 * Pre-Launch Audit — Suite 4: Tracking & Security
 *
 * Tests for packages/shared/src/tracking.ts
 * Covers: tracking ID encode/decode, pixel injection, link wrapping,
 *         URL validation, applyEmailTracking integration, GIF buffer
 *
 * Run: npx tsx tests/prelaunch-audit/test-tracking-security.ts
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
    console.log(`  FAIL: ${name}\n        ${msg}`);
  }
}

const BASE_URL = 'https://api.example.com';

// ============================================================
// Section 1: Tracking ID Encode/Decode (~30 tests)
// ============================================================
console.log('\n--- Tracking ID Encode/Decode ---');

test('Roundtrip: UUID encode then decode returns original', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: short ID', () => {
  const id = 'abc123';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: numeric string', () => {
  const id = '1234567890';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: empty string', () => {
  const id = '';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: very long ID (500 chars)', () => {
  const id = 'x'.repeat(500);
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: special characters (!@#$%^&*)', () => {
  const id = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: unicode characters', () => {
  const id = 'test-üñïcödé-日本語';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: spaces in ID', () => {
  const id = 'hello world test';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: newlines in ID', () => {
  const id = 'line1\nline2\nline3';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: forward slashes in ID', () => {
  const id = 'path/to/resource';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('URL-safe encoding: no + characters', () => {
  // base64 uses + but base64url uses -
  const id = '>>>>'; // encodes to Pj4+Pg in base64, Pj4-Pg in base64url
  const encoded = generateTrackingId(id);
  assert.equal(encoded.includes('+'), false);
});

test('URL-safe encoding: no / characters', () => {
  const id = '????'; // would have / in base64
  const encoded = generateTrackingId(id);
  assert.equal(encoded.includes('/'), false);
});

test('URL-safe encoding: no = padding', () => {
  const id = 'ab'; // 2 bytes → normally base64 padded with ==
  const encoded = generateTrackingId(id);
  assert.equal(encoded.includes('='), false);
});

test('generateTrackingId returns a string', () => {
  assert.equal(typeof generateTrackingId('test'), 'string');
});

test('generateTrackingId returns non-empty for non-empty input', () => {
  assert.ok(generateTrackingId('test').length > 0);
});

test('decodeTrackingId returns a string', () => {
  assert.equal(typeof decodeTrackingId('dGVzdA'), 'string');
});

test('Different IDs produce different tracking IDs', () => {
  const a = generateTrackingId('email-1');
  const b = generateTrackingId('email-2');
  assert.notEqual(a, b);
});

test('Same ID always produces same tracking ID (deterministic)', () => {
  const id = 'deterministic-test';
  assert.equal(generateTrackingId(id), generateTrackingId(id));
});

test('Decode of arbitrary base64url string returns some string', () => {
  // Not a real tracking ID, but decode should not throw
  const result = decodeTrackingId('SGVsbG8');
  assert.equal(typeof result, 'string');
  assert.equal(result, 'Hello');
});

test('Roundtrip: ID with only numbers', () => {
  const id = '000000';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: ID with dashes (UUID-like)', () => {
  const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: single character', () => {
  const id = 'A';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: base64-like characters in input', () => {
  const id = 'dGVzdA==';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Decode of empty string returns empty string', () => {
  assert.equal(decodeTrackingId(''), '');
});

test('Roundtrip: tab characters', () => {
  const id = 'col1\tcol2\tcol3';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: email address as ID', () => {
  const id = 'user@example.com';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: URL as ID', () => {
  const id = 'https://example.com/path?q=1&b=2';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: JSON string as ID', () => {
  const id = '{"key":"value","num":42}';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

test('Roundtrip: binary-like characters', () => {
  const id = '\x00\x01\x02\xff';
  assert.equal(decodeTrackingId(generateTrackingId(id)), id);
});

// ============================================================
// Section 2: Pixel Injection (~30 tests)
// ============================================================
console.log('\n--- Pixel Injection ---');

const TRACKING_ID = generateTrackingId('test-email-123');

test('Injects pixel before </body> (primary position)', () => {
  const html = '<html><body><p>Hello</p></body></html>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(`<img src="${BASE_URL}/api/v1/t/o/${TRACKING_ID}"`));
  assert.ok(result.includes('</body>'));
  // Pixel should be before </body>
  const pixelIdx = result.indexOf('<img src=');
  const bodyIdx = result.indexOf('</body>');
  assert.ok(pixelIdx < bodyIdx);
});

test('Injects pixel before </html> when no </body> (fallback 1)', () => {
  const html = '<html><p>Hello</p></html>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<img src='));
  const pixelIdx = result.indexOf('<img src=');
  const htmlIdx = result.indexOf('</html>');
  assert.ok(pixelIdx < htmlIdx);
});

test('Appends pixel to end when no </body> or </html> (fallback 2)', () => {
  const html = '<p>Hello world</p>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.endsWith('alt="" />'));
  assert.ok(result.startsWith('<p>Hello world</p>'));
});

test('Pixel is 1x1 with display:none', () => {
  const html = '<body></body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('width="1"'));
  assert.ok(result.includes('height="1"'));
  assert.ok(result.includes('display:none'));
});

test('Pixel has correct tracking URL format', () => {
  const html = '<body></body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/o/${TRACKING_ID}`));
});

test('Pixel is a valid img tag', () => {
  const html = '<body></body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<img src="'));
  assert.ok(result.includes('alt=""'));
  assert.ok(result.includes('/>'));
});

test('Empty HTML gets pixel appended', () => {
  const result = injectTrackingPixel('', TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<img src='));
});

test('Plain text (not HTML) gets pixel appended', () => {
  const result = injectTrackingPixel('Just plain text, no tags', TRACKING_ID, BASE_URL);
  assert.ok(result.startsWith('Just plain text, no tags'));
  assert.ok(result.includes('<img src='));
});

test('Case-insensitive </BODY> match', () => {
  const html = '<html><BODY><p>Hi</p></BODY></html>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<img src='));
  // Pixel should be before the closing body tag
  const pixelIdx = result.indexOf('<img src=');
  const bodyIdx = result.toLowerCase().indexOf('</body>');
  assert.ok(pixelIdx < bodyIdx);
});

test('Case-insensitive </HTML> match (fallback)', () => {
  const html = '<HTML><p>Hi</p></HTML>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<img src='));
});

test('HTML with existing img tag (not tracking pixel)', () => {
  const html = '<body><img src="photo.jpg"></body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('photo.jpg'));
  assert.ok(result.includes(`/api/v1/t/o/${TRACKING_ID}`));
});

test('Pixel injected only once even with body tag', () => {
  const html = '<body>content</body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  const count = (result.match(/api\/v1\/t\/o\//g) || []).length;
  assert.equal(count, 1);
});

test('Custom tracking domain in pixel URL', () => {
  const customBase = 'https://track.mycompany.com';
  const html = '<body></body>';
  const result = injectTrackingPixel(html, TRACKING_ID, customBase);
  assert.ok(result.includes('https://track.mycompany.com/api/v1/t/o/'));
});

test('HTML with whitespace around body tag', () => {
  const html = '<body>  \n  content  \n  </body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<img src='));
});

test('HTML with nested body-like text (not a tag)', () => {
  const html = '<body>The word body appears here</body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<img src='));
  // Only one pixel
  const count = (result.match(/api\/v1\/t\/o\//g) || []).length;
  assert.equal(count, 1);
});

test('Complex HTML email structure', () => {
  const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <table><tr><td>
    <h1>Hello</h1>
    <p>World</p>
  </td></tr></table>
</body>
</html>`;
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<img src='));
  assert.ok(result.includes('</body>'));
  assert.ok(result.includes('</html>'));
});

test('Preserves existing HTML content after injection', () => {
  const html = '<body><p>Important content</p></body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<p>Important content</p>'));
});

test('Adding a second tracking pixel appends another (no dedup)', () => {
  const html = '<body>content</body>';
  const first = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  const secondId = generateTrackingId('second-email');
  const result = injectTrackingPixel(first, secondId, BASE_URL);
  // Both pixels should exist — the function does not dedup
  const count = (result.match(/api\/v1\/t\/o\//g) || []).length;
  assert.equal(count, 2);
});

test('Pixel with border:0 attribute', () => {
  const html = '<body></body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('border:0'));
});

test('HTML with DOCTYPE preserved', () => {
  const html = '<!DOCTYPE html><html><body>Content</body></html>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.startsWith('<!DOCTYPE html>'));
});

test('Pixel style includes width:1px and height:1px', () => {
  const html = '<body></body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('width:1px'));
  assert.ok(result.includes('height:1px'));
});

test('HTML with both body and html closing tags uses body', () => {
  const html = '<html><body>Hi</body></html>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  const pixelIdx = result.indexOf('<img src=');
  const bodyIdx = result.indexOf('</body>');
  const htmlIdx = result.indexOf('</html>');
  // Pixel before body, body before html
  assert.ok(pixelIdx < bodyIdx);
  assert.ok(bodyIdx < htmlIdx);
});

test('Mixed case </Body> tag', () => {
  const html = '<html><Body>Hi</Body></html>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<img src='));
});

test('Pixel src attribute is properly quoted', () => {
  const html = '<body></body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  const match = result.match(/src="([^"]+)"/);
  assert.ok(match);
  assert.ok(match![1].startsWith(BASE_URL));
});

test('HTML with only </html> closing tag and no body at all', () => {
  const html = '<html><div>Content</div></html>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<img src='));
  const pixelIdx = result.indexOf('<img src=');
  const htmlIdx = result.indexOf('</html>');
  assert.ok(pixelIdx < htmlIdx);
});

test('Pixel alt attribute is empty string', () => {
  const html = '<body></body>';
  const result = injectTrackingPixel(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('alt=""'));
});

// ============================================================
// Section 3: Link Wrapping (~40 tests)
// ============================================================
console.log('\n--- Link Wrapping ---');

test('Basic HTTPS link is wrapped', () => {
  const html = '<a href="https://example.com">Click</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/c/${TRACKING_ID}`));
  assert.ok(result.includes('url=' + encodeURIComponent('https://example.com')));
});

test('Basic HTTP link is wrapped', () => {
  const html = '<a href="http://example.com">Click</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(`${BASE_URL}/api/v1/t/c/${TRACKING_ID}`));
});

test('Skip mailto: links', () => {
  const html = '<a href="mailto:user@example.com">Email</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('mailto:user@example.com'));
  assert.ok(!result.includes('/t/c/'));
});

test('Skip tel: links', () => {
  const html = '<a href="tel:+1234567890">Call</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('tel:+1234567890'));
  assert.ok(!result.includes('/t/c/'));
});

test('Skip anchor (#) links', () => {
  const html = '<a href="#section">Jump</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('#section'));
  assert.ok(!result.includes('/t/c/'));
});

test('Skip already-wrapped links (contains /t/c/)', () => {
  const html = `<a href="${BASE_URL}/api/v1/t/c/${TRACKING_ID}?url=test">Click</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  // Should not double-wrap
  const count = (result.match(/\/t\/c\//g) || []).length;
  assert.equal(count, 1);
});

test('Skip unsubscribe links', () => {
  const html = '<a href="https://example.com/unsubscribe?id=123">Unsubscribe</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('https://example.com/unsubscribe?id=123'));
  assert.ok(!result.includes('/t/c/'));
});

test('Skip unsubscribe links (case insensitive)', () => {
  const html = '<a href="https://example.com/UNSUBSCRIBE">Leave</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(!result.includes('/t/c/'));
});

test('Skip javascript: links (XSS prevention)', () => {
  const html = '<a href="javascript:alert(1)">XSS</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(!result.includes('/t/c/'));
});

test('Skip data: links (security)', () => {
  const html = '<a href="data:text/html,<h1>test</h1>">Data</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(!result.includes('/t/c/'));
});

test('Skip file: links (security)', () => {
  const html = '<a href="file:///etc/passwd">File</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(!result.includes('/t/c/'));
});

test('Multiple links in one email — all trackable wrapped', () => {
  const html = `
    <a href="https://example.com">Link 1</a>
    <a href="https://other.com">Link 2</a>
    <a href="mailto:test@test.com">Email</a>
  `;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  const count = (result.match(/\/t\/c\//g) || []).length;
  assert.equal(count, 2); // Two http(s) links wrapped, mailto skipped
});

test('Link with query parameters preserved', () => {
  const url = 'https://example.com/page?foo=bar&baz=qux';
  const html = `<a href="${url}">Link</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(encodeURIComponent(url)));
});

test('Link with fragment preserved', () => {
  const url = 'https://example.com/page#section';
  const html = `<a href="${url}">Link</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(encodeURIComponent(url)));
});

test('Link with special characters in URL', () => {
  const url = 'https://example.com/search?q=hello+world&lang=en';
  const html = `<a href="${url}">Link</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(encodeURIComponent(url)));
});

test('Empty href is not wrapped (not http)', () => {
  const html = '<a href="">Link</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(!result.includes('/t/c/'));
});

test('Relative URL is not wrapped (not http)', () => {
  const html = '<a href="/about">About</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(!result.includes('/t/c/'));
});

test('Link with single quotes in href', () => {
  const html = "<a href='https://example.com'>Link</a>";
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/c/'));
});

test('Link wrapping preserves anchor text', () => {
  const html = '<a href="https://example.com">Click Here</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('>Click Here</a>'));
});

test('Non-anchor href attributes (e.g., area) are also wrapped', () => {
  const html = '<area href="https://example.com/map">';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/c/'));
});

test('Link with port number in URL', () => {
  const url = 'https://example.com:8080/path';
  const html = `<a href="${url}">Link</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(encodeURIComponent(url)));
});

test('Link with auth in URL (user:pass@host)', () => {
  const url = 'https://user:pass@example.com/path';
  const html = `<a href="${url}">Link</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(encodeURIComponent(url)));
});

test('Link with encoded characters in URL', () => {
  const url = 'https://example.com/path%20with%20spaces';
  const html = `<a href="${url}">Link</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(encodeURIComponent(url)));
});

test('HTML with no links returns unchanged', () => {
  const html = '<p>No links here</p>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.equal(result, html);
});

test('Wrapped link uses double quotes in output', () => {
  const html = '<a href="https://example.com">Link</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('href="'));
});

test('URL with unicode characters', () => {
  const url = 'https://example.com/path/日本語';
  const html = `<a href="${url}">Link</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/c/'));
});

test('URL ending with trailing slash', () => {
  const url = 'https://example.com/';
  const html = `<a href="${url}">Link</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(encodeURIComponent(url)));
});

test('Unsubscribe in path is skipped', () => {
  const html = '<a href="https://mail.com/v1/unsubscribe/token123">Unsub</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(!result.includes('/t/c/'));
});

test('URL with "subscribe" (but not unsubscribe) IS wrapped', () => {
  const html = '<a href="https://example.com/subscribe">Subscribe</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/c/'));
});

test('Very long URL is wrapped', () => {
  const url = 'https://example.com/' + 'a'.repeat(2000);
  const html = `<a href="${url}">Link</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/c/'));
});

test('Link with spaces in href attribute', () => {
  const html = '<a href = "https://example.com">Link</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/c/'));
});

test('Multiple attributes on anchor — only href modified', () => {
  const html = '<a class="btn" href="https://example.com" target="_blank">Link</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/c/'));
  assert.ok(result.includes('class="btn"'));
  assert.ok(result.includes('target="_blank"'));
});

test('ftp: link is not wrapped (not http/https)', () => {
  const html = '<a href="ftp://files.example.com/file.zip">Download</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(!result.includes('/t/c/'));
});

test('Custom base URL used in wrapped link', () => {
  const customBase = 'https://track.myapp.io';
  const html = '<a href="https://example.com">Link</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, customBase);
  assert.ok(result.includes('https://track.myapp.io/api/v1/t/c/'));
});

test('Link with both query and fragment', () => {
  const url = 'https://example.com/page?key=val#top';
  const html = `<a href="${url}">Link</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes(encodeURIComponent(url)));
});

test('Img src with http URL is NOT wrapped (no href)', () => {
  const html = '<img src="https://example.com/image.png">';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(!result.includes('/t/c/'));
  assert.ok(result.includes('src="https://example.com/image.png"'));
});

test('Link with uppercase HTTPS is wrapped', () => {
  const html = '<a href="HTTPS://EXAMPLE.COM">Link</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  // The regex checks url.startsWith('http://') or 'https://' — uppercase won't match
  // This is expected behavior: only lowercase protocol is tracked
  const hasTracking = result.includes('/t/c/');
  // Since HTTPS doesn't start with lowercase https://, it won't be wrapped
  assert.equal(hasTracking, false);
});

test('Link with mixed case Https:// is not wrapped', () => {
  const html = '<a href="Https://example.com">Link</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(!result.includes('/t/c/'));
});

test('Wrapped URL is properly encoded', () => {
  const url = 'https://example.com/path?a=1&b=2';
  const html = `<a href="${url}">Link</a>`;
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  // The URL should be encodeURIComponent'd in the query param
  assert.ok(result.includes('url=' + encodeURIComponent(url)));
});

test('Tracking URL format is correct', () => {
  const html = '<a href="https://example.com">Link</a>';
  const result = wrapLinksForTracking(html, TRACKING_ID, BASE_URL);
  const expectedPrefix = `${BASE_URL}/api/v1/t/c/${TRACKING_ID}?url=`;
  assert.ok(result.includes(expectedPrefix));
});

// ============================================================
// Section 4: isValidTrackingUrl (~30 tests)
// ============================================================
console.log('\n--- isValidTrackingUrl ---');

test('Valid HTTPS URL → true', () => {
  assert.equal(isValidTrackingUrl('https://example.com'), true);
});

test('Valid HTTP URL → true', () => {
  assert.equal(isValidTrackingUrl('http://example.com'), true);
});

test('HTTPS with path → true', () => {
  assert.equal(isValidTrackingUrl('https://example.com/page/sub'), true);
});

test('HTTPS with query string → true', () => {
  assert.equal(isValidTrackingUrl('https://example.com?q=test'), true);
});

test('HTTPS with fragment → true', () => {
  assert.equal(isValidTrackingUrl('https://example.com#section'), true);
});

test('HTTPS with port → true', () => {
  assert.equal(isValidTrackingUrl('https://example.com:8443/api'), true);
});

test('HTTP with port → true', () => {
  assert.equal(isValidTrackingUrl('http://localhost:3000'), true);
});

test('URL with auth (user:pass@host) → true', () => {
  assert.equal(isValidTrackingUrl('https://user:pass@example.com'), true);
});

test('javascript: → false (XSS prevention)', () => {
  assert.equal(isValidTrackingUrl('javascript:alert(1)'), false);
});

test('javascript: with encoding → false', () => {
  assert.equal(isValidTrackingUrl('javascript:void(0)'), false);
});

test('data: → false', () => {
  assert.equal(isValidTrackingUrl('data:text/html,<h1>test</h1>'), false);
});

test('data: with base64 → false', () => {
  assert.equal(isValidTrackingUrl('data:image/png;base64,abc123'), false);
});

test('file: → false', () => {
  assert.equal(isValidTrackingUrl('file:///etc/passwd'), false);
});

test('ftp: → false (only http/https allowed)', () => {
  assert.equal(isValidTrackingUrl('ftp://files.example.com'), false);
});

test('Empty string → false', () => {
  assert.equal(isValidTrackingUrl(''), false);
});

test('Malformed URL (no protocol) → false', () => {
  assert.equal(isValidTrackingUrl('example.com'), false);
});

test('Malformed URL (just protocol) → false', () => {
  assert.equal(isValidTrackingUrl('https://'), false);
});

test('Whitespace only → false', () => {
  assert.equal(isValidTrackingUrl('   '), false);
});

test('about:blank → false', () => {
  assert.equal(isValidTrackingUrl('about:blank'), false);
});

test('blob: → false', () => {
  assert.equal(isValidTrackingUrl('blob:https://example.com/uuid'), false);
});

test('tel: → false', () => {
  assert.equal(isValidTrackingUrl('tel:+1234567890'), false);
});

test('mailto: → false', () => {
  assert.equal(isValidTrackingUrl('mailto:test@example.com'), false);
});

test('Very long valid URL → true', () => {
  assert.equal(isValidTrackingUrl('https://example.com/' + 'a'.repeat(2000)), true);
});

test('URL with special characters → true', () => {
  assert.equal(isValidTrackingUrl('https://example.com/path?q=hello%20world&x=1'), true);
});

test('IP address URL → true', () => {
  assert.equal(isValidTrackingUrl('http://192.168.1.1:8080'), true);
});

test('Localhost URL → true', () => {
  assert.equal(isValidTrackingUrl('http://localhost:3001/api'), true);
});

test('URL with unicode domain → true', () => {
  assert.equal(isValidTrackingUrl('https://例え.jp'), true);
});

test('ws: websocket → false', () => {
  assert.equal(isValidTrackingUrl('ws://example.com/socket'), false);
});

test('wss: secure websocket → false', () => {
  assert.equal(isValidTrackingUrl('wss://example.com/socket'), false);
});

test('Random string → false', () => {
  assert.equal(isValidTrackingUrl('not-a-url-at-all'), false);
});

// ============================================================
// Section 5: applyEmailTracking Integration (~20 tests)
// ============================================================
console.log('\n--- applyEmailTracking Integration ---');

test('Default: applies both pixel and link wrapping', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/o/'));  // pixel
  assert.ok(result.includes('/t/c/'));  // link wrap
});

test('trackOpens=false: no pixel injected', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL, { trackOpens: false });
  assert.ok(!result.includes('/t/o/'));
  assert.ok(result.includes('/t/c/'));
});

test('trackClicks=false: no link wrapping', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL, { trackClicks: false });
  assert.ok(result.includes('/t/o/'));
  assert.ok(!result.includes('/t/c/'));
});

test('Both disabled: returns unchanged HTML', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL, { trackOpens: false, trackClicks: false });
  assert.equal(result, html);
});

test('Both enabled explicitly', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL, { trackOpens: true, trackClicks: true });
  assert.ok(result.includes('/t/o/'));
  assert.ok(result.includes('/t/c/'));
});

test('HTML with no links — only pixel added', () => {
  const html = '<body><p>No links</p></body>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/o/'));
  assert.ok(!result.includes('/t/c/'));
});

test('Plain text email — pixel appended', () => {
  const html = 'Just text, no HTML tags';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/o/'));
});

test('Empty options object defaults to both enabled', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL, {});
  assert.ok(result.includes('/t/o/'));
  assert.ok(result.includes('/t/c/'));
});

test('Multiple links + pixel in complex HTML', () => {
  const html = `<body>
    <a href="https://link1.com">One</a>
    <a href="https://link2.com">Two</a>
    <a href="mailto:skip@test.com">Email</a>
  </body>`;
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL);
  const linkCount = (result.match(/\/t\/c\//g) || []).length;
  const pixelCount = (result.match(/\/t\/o\//g) || []).length;
  assert.equal(linkCount, 2);
  assert.equal(pixelCount, 1);
});

test('Link wrapping happens before pixel injection (order)', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL);
  // The wrapped link should exist and the pixel should be before </body>
  assert.ok(result.includes('/t/c/'));
  assert.ok(result.includes('/t/o/'));
  // Pixel should be between links and </body>
  const pixelIdx = result.indexOf('/t/o/');
  const bodyIdx = result.indexOf('</body>');
  assert.ok(pixelIdx < bodyIdx);
});

test('Unsubscribe link preserved while others wrapped', () => {
  const html = `<body>
    <a href="https://example.com">Visit</a>
    <a href="https://example.com/unsubscribe">Unsubscribe</a>
  </body>`;
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/c/')); // Visit link wrapped
  assert.ok(result.includes('example.com/unsubscribe')); // Unsubscribe preserved
  const linkCount = (result.match(/\/t\/c\//g) || []).length;
  assert.equal(linkCount, 1);
});

test('Same tracking ID used for pixel and links', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL);
  // Both should contain the same tracking ID
  const pixelMatch = result.match(/\/t\/o\/([^"]+)/);
  const linkMatch = result.match(/\/t\/c\/([^?]+)/);
  assert.ok(pixelMatch);
  assert.ok(linkMatch);
  assert.equal(pixelMatch![1], linkMatch![1]);
});

test('Pixel not added when trackOpens=false even with body tag', () => {
  const html = '<html><body><p>Content</p></body></html>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL, { trackOpens: false });
  assert.ok(!result.includes('<img'));
  assert.ok(!result.includes('/t/o/'));
});

test('Complex email: skips all non-trackable links', () => {
  const html = `<body>
    <a href="https://trackme.com">Track this</a>
    <a href="mailto:no@no.com">No</a>
    <a href="tel:123">No</a>
    <a href="#jump">No</a>
    <a href="javascript:void(0)">No</a>
    <a href="data:text/plain,no">No</a>
    <a href="/relative">No</a>
  </body>`;
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL);
  const linkCount = (result.match(/\/t\/c\//g) || []).length;
  assert.equal(linkCount, 1); // Only https://trackme.com
});

test('applyEmailTracking with custom base URL', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const result = applyEmailTracking(html, TRACKING_ID, 'https://track.custom.io');
  assert.ok(result.includes('https://track.custom.io/api/v1/t/o/'));
  assert.ok(result.includes('https://track.custom.io/api/v1/t/c/'));
});

test('Empty HTML with tracking enabled', () => {
  const result = applyEmailTracking('', TRACKING_ID, BASE_URL);
  assert.ok(result.includes('/t/o/'));
});

test('Idempotent: applying tracking twice does not double-wrap links', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const first = applyEmailTracking(html, TRACKING_ID, BASE_URL);
  const second = applyEmailTracking(first, TRACKING_ID, BASE_URL);
  // Links should still have only 1 /t/c/ (already-wrapped skipped)
  const linkCount = (second.match(/\/t\/c\//g) || []).length;
  assert.equal(linkCount, 1);
});

test('Tracking preserves original HTML structure', () => {
  const html = '<html><head><title>Test</title></head><body><p>Content</p></body></html>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL);
  assert.ok(result.includes('<head><title>Test</title></head>'));
  assert.ok(result.includes('<p>Content</p>'));
});

test('Only trackOpens option provided — clicks default to true', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL, { trackOpens: true });
  assert.ok(result.includes('/t/o/'));
  assert.ok(result.includes('/t/c/'));
});

test('Only trackClicks option provided — opens default to true', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const result = applyEmailTracking(html, TRACKING_ID, BASE_URL, { trackClicks: true });
  assert.ok(result.includes('/t/o/'));
  assert.ok(result.includes('/t/c/'));
});

test('applyEmailTracking returns a string', () => {
  const result = applyEmailTracking('<body></body>', TRACKING_ID, BASE_URL);
  assert.equal(typeof result, 'string');
});

test('Double-apply with different IDs adds second pixel but skips link re-wrap', () => {
  const html = '<body><a href="https://example.com">Click</a></body>';
  const id1 = generateTrackingId('email-1');
  const id2 = generateTrackingId('email-2');
  const first = applyEmailTracking(html, id1, BASE_URL);
  const second = applyEmailTracking(first, id2, BASE_URL);
  // Two pixels (no dedup on pixel injection)
  const pixelCount = (second.match(/\/t\/o\//g) || []).length;
  assert.equal(pixelCount, 2);
  // But links only wrapped once (already-wrapped skipped)
  const linkCount = (second.match(/\/t\/c\//g) || []).length;
  assert.equal(linkCount, 1);
});

// ============================================================
// Section 6: GIF Buffer (~10 tests)
// ============================================================
console.log('\n--- GIF Buffer ---');

test('TRANSPARENT_GIF_BUFFER is a Buffer', () => {
  assert.ok(Buffer.isBuffer(TRANSPARENT_GIF_BUFFER));
});

test('GIF buffer starts with GIF89a magic bytes', () => {
  const magic = TRANSPARENT_GIF_BUFFER.subarray(0, 6).toString('ascii');
  assert.equal(magic, 'GIF89a');
});

test('GIF buffer is a reasonable size (< 100 bytes)', () => {
  assert.ok(TRANSPARENT_GIF_BUFFER.length < 100);
});

test('GIF buffer is non-empty', () => {
  assert.ok(TRANSPARENT_GIF_BUFFER.length > 0);
});

test('GIF buffer has 1x1 dimensions', () => {
  // GIF format: bytes 6-7 = width (little-endian), bytes 8-9 = height (little-endian)
  const width = TRANSPARENT_GIF_BUFFER.readUInt16LE(6);
  const height = TRANSPARENT_GIF_BUFFER.readUInt16LE(8);
  assert.equal(width, 1);
  assert.equal(height, 1);
});

test('GIF buffer contains GIF trailer byte (0x3B)', () => {
  const lastByte = TRANSPARENT_GIF_BUFFER[TRANSPARENT_GIF_BUFFER.length - 1];
  assert.equal(lastByte, 0x3b); // ';' = GIF trailer
});

test('GIF buffer is deterministic (same every time)', () => {
  const expected = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );
  assert.ok(TRANSPARENT_GIF_BUFFER.equals(expected));
});

test('GIF buffer can be used as response body', () => {
  // Simulate sending as HTTP response
  const base64 = TRANSPARENT_GIF_BUFFER.toString('base64');
  assert.ok(base64.length > 0);
  assert.equal(typeof base64, 'string');
});

test('GIF buffer has correct Global Color Table flag', () => {
  // Byte 10 is the packed field: M(1) CR(3) S(1) Size(3)
  // GIF89a with GCT: bit 7 should be set
  const packed = TRANSPARENT_GIF_BUFFER[10];
  const hasGCT = (packed & 0x80) !== 0;
  assert.equal(hasGCT, true);
});

test('GIF buffer roundtrips through base64 encoding', () => {
  const encoded = TRANSPARENT_GIF_BUFFER.toString('base64');
  const decoded = Buffer.from(encoded, 'base64');
  assert.ok(decoded.equals(TRANSPARENT_GIF_BUFFER));
});

// ============================================================
// Section 7: Cross-Cutting Security (~3 tests)
// ============================================================
console.log('\n--- Cross-Cutting Security ---');

test('XSS in tracking ID does not break pixel HTML', () => {
  const maliciousId = '"><script>alert(1)</script><img src="';
  const encoded = generateTrackingId(maliciousId);
  const html = '<body></body>';
  const result = injectTrackingPixel(html, encoded, BASE_URL);
  // The tracking ID is base64url encoded, so no raw script tag should appear
  assert.ok(!result.includes('<script>'));
});

test('XSS in tracking ID does not break link wrapping', () => {
  const maliciousId = '"><script>alert(1)</script>';
  const encoded = generateTrackingId(maliciousId);
  const html = '<a href="https://example.com">Link</a>';
  const result = wrapLinksForTracking(html, encoded, BASE_URL);
  assert.ok(!result.includes('<script>'));
});

test('isValidTrackingUrl blocks javascript with whitespace padding', () => {
  // URL constructor trims whitespace from protocol
  assert.equal(isValidTrackingUrl('  javascript:alert(1)'), false);
});

// ============================================================
// Results
// ============================================================
console.log(`\n${'='.repeat(50)}\nResults: ${passed} passed, ${failed} failed of ${passed + failed}\n${'='.repeat(50)}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
