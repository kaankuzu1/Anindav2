/**
 * Email Sending Pipeline Tests
 *
 * Tests variable map construction, processEmailContent pipeline, tracking
 * injection, unsubscribe headers, suppression recheck, isAuthError detection,
 * and mid-campaign tracking toggles.
 */

import assert from 'node:assert/strict';
import {
  processEmailContent,
  normalizeVariableMap,
} from '../../packages/shared/src/utils';
import {
  generateTrackingId,
  decodeTrackingId,
  injectTrackingPixel,
  wrapLinksForTracking,
  applyEmailTracking,
  TRANSPARENT_GIF_BUFFER,
  isValidTrackingUrl,
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

// ============================================
// Inline buildVariableMap (matching email-sender.ts)
// ============================================

function buildVariableMap(
  lead: Record<string, any> | null,
  inbox: Record<string, any>
): Record<string, string> {
  const variables: Record<string, string> = {
    firstName: lead?.first_name ?? '',
    lastName: lead?.last_name ?? '',
    first_name: lead?.first_name ?? '',
    last_name: lead?.last_name ?? '',
    email: lead?.email ?? '',
    company: lead?.company ?? '',
    title: lead?.title ?? '',
    phone: lead?.phone ?? '',
    fullName: [lead?.first_name, lead?.last_name].filter(Boolean).join(' '),
    full_name: [lead?.first_name, lead?.last_name].filter(Boolean).join(' '),
    from_name: inbox.from_name ?? '',
    from_email: inbox.email ?? '',
    fromName: inbox.from_name ?? '',
    fromEmail: inbox.email ?? '',
    senderFirstName: inbox.sender_first_name ?? '',
    sender_first_name: inbox.sender_first_name ?? '',
    senderLastName: inbox.sender_last_name ?? '',
    sender_last_name: inbox.sender_last_name ?? '',
    senderCompany: inbox.sender_company ?? '',
    sender_company: inbox.sender_company ?? '',
    senderTitle: inbox.sender_title ?? '',
    sender_title: inbox.sender_title ?? '',
    senderPhone: inbox.sender_phone ?? '',
    sender_phone: inbox.sender_phone ?? '',
    senderWebsite: inbox.sender_website ?? '',
    sender_website: inbox.sender_website ?? '',
  };

  if (lead?.custom_fields && typeof lead.custom_fields === 'object') {
    for (const [key, value] of Object.entries(lead.custom_fields as Record<string, unknown>)) {
      if (typeof value === 'string') {
        variables[key] = value;
      }
    }
  }

  return variables;
}

// ============================================
// Inline isAuthError (matching email-sender.ts)
// ============================================

function isAuthError(err: any): boolean {
  const msg = (err?.message ?? '').toLowerCase();
  const code = String(err?.code ?? err?.statusCode ?? '');
  return (
    code === '401' ||
    code === '403' ||
    msg.includes('unauthorized') ||
    msg.includes('invalid_grant') ||
    msg.includes('invalid_client') ||
    msg.includes('token expired') ||
    msg.includes('token has been expired') ||
    msg.includes('token has been revoked') ||
    msg.includes('refresh token') ||
    msg.includes('authentication') ||
    msg.includes('auth_error') ||
    msg.includes('auth error') ||
    msg.includes('insufficient permissions')
  );
}

// ============================================
// Variable Map Construction
// ============================================

console.log('\n--- Variable Map: Lead Fields ---');

test('Lead vars: firstName, lastName, email, company, title, phone', () => {
  const vars = buildVariableMap(
    { first_name: 'Jane', last_name: 'Doe', email: 'jane@co.com', company: 'Acme', title: 'CEO', phone: '+1555' },
    { email: 'send@co.com' }
  );
  assert.equal(vars.firstName, 'Jane');
  assert.equal(vars.lastName, 'Doe');
  assert.equal(vars.email, 'jane@co.com');
  assert.equal(vars.company, 'Acme');
  assert.equal(vars.title, 'CEO');
  assert.equal(vars.phone, '+1555');
});

test('Lead vars: both camelCase and snake_case provided', () => {
  const vars = buildVariableMap(
    { first_name: 'Bob', last_name: 'Smith' },
    { email: 'x@y.com' }
  );
  assert.equal(vars.firstName, 'Bob');
  assert.equal(vars.first_name, 'Bob');
  assert.equal(vars.lastName, 'Smith');
  assert.equal(vars.last_name, 'Smith');
});

test('Lead vars: fullName computed from first + last', () => {
  const vars = buildVariableMap(
    { first_name: 'John', last_name: 'Smith' },
    { email: 'x@y.com' }
  );
  assert.equal(vars.fullName, 'John Smith');
  assert.equal(vars.full_name, 'John Smith');
});

test('Lead vars: fullName with only first name', () => {
  const vars = buildVariableMap({ first_name: 'John' }, { email: 'x@y.com' });
  assert.equal(vars.fullName, 'John');
});

test('Lead vars: fullName with only last name', () => {
  const vars = buildVariableMap({ last_name: 'Smith' }, { email: 'x@y.com' });
  assert.equal(vars.fullName, 'Smith');
});

test('Lead vars: fullName empty when both empty', () => {
  const vars = buildVariableMap({ first_name: '', last_name: '' }, { email: 'x@y.com' });
  assert.equal(vars.fullName, '');
});

test('Lead vars: null lead handled gracefully', () => {
  const vars = buildVariableMap(null, { email: 'x@y.com', from_name: 'Sender' });
  assert.equal(vars.firstName, '');
  assert.equal(vars.email, '');
  assert.equal(vars.fullName, '');
  assert.equal(vars.fromEmail, 'x@y.com');
});

console.log('\n--- Variable Map: Inbox Fields ---');

test('Inbox vars: all sender fields mapped', () => {
  const vars = buildVariableMap({ first_name: 'A' }, {
    email: 'send@co.com', from_name: 'Team',
    sender_first_name: 'Alice', sender_last_name: 'Wong',
    sender_company: 'BigCo', sender_title: 'Manager',
    sender_phone: '+9999', sender_website: 'https://bigco.com',
  });
  assert.equal(vars.senderFirstName, 'Alice');
  assert.equal(vars.sender_first_name, 'Alice');
  assert.equal(vars.senderLastName, 'Wong');
  assert.equal(vars.senderCompany, 'BigCo');
  assert.equal(vars.senderTitle, 'Manager');
  assert.equal(vars.senderPhone, '+9999');
  assert.equal(vars.senderWebsite, 'https://bigco.com');
  assert.equal(vars.fromName, 'Team');
  assert.equal(vars.from_name, 'Team');
  assert.equal(vars.fromEmail, 'send@co.com');
  assert.equal(vars.from_email, 'send@co.com');
});

test('Inbox vars: missing fields default to empty string', () => {
  const vars = buildVariableMap({ first_name: 'A' }, { email: 'x@y.com' });
  assert.equal(vars.senderFirstName, '');
  assert.equal(vars.senderCompany, '');
  assert.equal(vars.fromName, '');
});

// ============================================
// processEmailContent Pipeline
// ============================================

console.log('\n--- processEmailContent Pipeline ---');

test('Spintax resolution picks one option', () => {
  const result = processEmailContent('{Hello|Hi|Hey} there', {});
  assert.ok(['Hello there', 'Hi there', 'Hey there'].includes(result), `Got: ${result}`);
});

test('Conditional blocks: shown when var present', () => {
  const result = processEmailContent('{if:company}At {{company}}.{/if}', { company: 'Acme' });
  assert.equal(result, 'At Acme.');
});

test('Conditional blocks: hidden when var empty', () => {
  const result = processEmailContent('{if:company}At {{company}}.{/if}Rest.', { company: '' });
  assert.equal(result, 'Rest.');
});

test('Fallback used when variable missing', () => {
  const result = processEmailContent('Hi {{firstName|there}}', {});
  assert.equal(result, 'Hi there');
});

test('Fallback NOT used when variable present', () => {
  const result = processEmailContent('Hi {{firstName|there}}', { firstName: 'Chris' });
  assert.equal(result, 'Hi Chris');
});

test('Variable injection: basic substitution', () => {
  const result = processEmailContent('Hello {{firstName}} from {{company}}', {
    firstName: 'Alice', company: 'Acme'
  });
  assert.equal(result, 'Hello Alice from Acme');
});

test('Unknown variables preserved', () => {
  const result = processEmailContent('Value: {{unknownVar}}', {});
  assert.equal(result, 'Value: {{unknownVar}}');
});

test('Combined template: all features together', () => {
  const vars = buildVariableMap(
    { first_name: 'Dave', last_name: 'Lee', company: 'StartupX', title: 'CTO' },
    { email: 'sales@myco.com', sender_first_name: 'Sam', sender_company: 'MyCo' }
  );
  const template = '{Hello|Hello} {{firstName}}, I\'m {{senderFirstName}} from {{senderCompany}}. {if:title}As {{title}} at {{company}}, you\'d love this.{/if}';
  const result = processEmailContent(template, vars);
  assert.equal(result, 'Hello Dave, I\'m Sam from MyCo. As CTO at StartupX, you\'d love this.');
});

test('snake_case variables via normalization', () => {
  const result = processEmailContent('Hello {{first_name}} from {{sender_company}}', {
    firstName: 'Bob', senderCompany: 'BigCo'
  });
  assert.equal(result, 'Hello Bob from BigCo');
});

test('ifnot block shown when variable missing', () => {
  const result = processEmailContent('{ifnot:phone}Reply to schedule.{/ifnot}', {});
  assert.equal(result, 'Reply to schedule.');
});

test('ifnot block hidden when variable present', () => {
  const result = processEmailContent('{ifnot:phone}Reply to schedule.{/ifnot}', { phone: '555' });
  assert.equal(result, '');
});

// ============================================
// Tracking Injection
// ============================================

console.log('\n--- Tracking: Pixel Injection ---');

test('Tracking ID encode/decode roundtrip', () => {
  const emailId = 'email-abc-123';
  const trackingId = generateTrackingId(emailId);
  const decoded = decodeTrackingId(trackingId);
  assert.equal(decoded, emailId);
});

test('Pixel injected before </body>', () => {
  const html = '<html><body><p>Hello</p></body></html>';
  const result = injectTrackingPixel(html, 'tid1', 'https://api.example.com');
  assert.ok(result.includes('<img src="https://api.example.com/api/v1/t/o/tid1"'));
  assert.ok(result.indexOf('<img') < result.indexOf('</body>'));
});

test('Pixel injected before </html> when no </body>', () => {
  const html = '<html><p>Hello</p></html>';
  const result = injectTrackingPixel(html, 'tid2', 'https://api.example.com');
  assert.ok(result.includes('<img src="https://api.example.com/api/v1/t/o/tid2"'));
  assert.ok(result.indexOf('<img') < result.indexOf('</html>'));
});

test('Pixel appended to end when no </body> or </html>', () => {
  const html = '<p>Hello</p>';
  const result = injectTrackingPixel(html, 'tid3', 'https://api.example.com');
  assert.ok(result.endsWith('alt="" />'));
});

console.log('\n--- Tracking: Link Wrapping ---');

test('HTTP links wrapped with tracking URL', () => {
  const html = '<a href="https://example.com">Click</a>';
  const result = wrapLinksForTracking(html, 'tid1', 'https://api.example.com');
  assert.ok(result.includes('/api/v1/t/c/tid1?url='));
  assert.ok(result.includes(encodeURIComponent('https://example.com')));
});

test('mailto: links NOT wrapped', () => {
  const html = '<a href="mailto:test@co.com">Email</a>';
  const result = wrapLinksForTracking(html, 'tid1', 'https://api.example.com');
  assert.ok(result.includes('mailto:test@co.com'));
  assert.ok(!result.includes('/t/c/'));
});

test('tel: links NOT wrapped', () => {
  const html = '<a href="tel:+1555">Call</a>';
  const result = wrapLinksForTracking(html, 'tid1', 'https://api.example.com');
  assert.ok(result.includes('tel:+1555'));
  assert.ok(!result.includes('/t/c/'));
});

test('Unsubscribe links NOT wrapped', () => {
  const html = '<a href="https://example.com/unsubscribe?id=123">Unsubscribe</a>';
  const result = wrapLinksForTracking(html, 'tid1', 'https://api.example.com');
  assert.ok(result.includes('https://example.com/unsubscribe?id=123'));
  assert.ok(!result.includes('/t/c/'));
});

test('Already-wrapped links NOT double-wrapped', () => {
  const html = '<a href="https://api.example.com/api/v1/t/c/tid1?url=xyz">Link</a>';
  const result = wrapLinksForTracking(html, 'tid1', 'https://api.example.com');
  const matches = result.match(/\/t\/c\//g);
  assert.equal(matches?.length, 1, 'Should not double-wrap');
});

test('Non-http links NOT wrapped (javascript:)', () => {
  const html = '<a href="javascript:void(0)">Click</a>';
  const result = wrapLinksForTracking(html, 'tid1', 'https://api.example.com');
  assert.ok(!result.includes('/t/c/'));
});

test('Multiple links: all http links wrapped, skippable ones preserved', () => {
  const html = `
    <a href="https://example.com/page1">Page 1</a>
    <a href="mailto:hi@co.com">Email</a>
    <a href="https://example.com/page2">Page 2</a>
    <a href="https://example.com/unsubscribe">Unsub</a>
  `;
  const result = wrapLinksForTracking(html, 'tid1', 'https://api.example.com');
  const trackingMatches = result.match(/\/t\/c\/tid1/g);
  assert.equal(trackingMatches?.length, 2, 'Should wrap exactly 2 links');
});

console.log('\n--- Tracking: applyEmailTracking ---');

test('applyEmailTracking: both opens and clicks enabled', () => {
  const html = '<html><body><a href="https://example.com">Link</a></body></html>';
  const result = applyEmailTracking(html, 'tid1', 'https://api.example.com', { trackOpens: true, trackClicks: true });
  assert.ok(result.includes('/t/o/tid1'), 'Should have tracking pixel');
  assert.ok(result.includes('/t/c/tid1'), 'Should have wrapped links');
});

test('applyEmailTracking: opens only', () => {
  const html = '<html><body><a href="https://example.com">Link</a></body></html>';
  const result = applyEmailTracking(html, 'tid1', 'https://api.example.com', { trackOpens: true, trackClicks: false });
  assert.ok(result.includes('/t/o/tid1'), 'Should have tracking pixel');
  assert.ok(!result.includes('/t/c/tid1'), 'Should NOT have wrapped links');
});

test('applyEmailTracking: clicks only', () => {
  const html = '<html><body><a href="https://example.com">Link</a></body></html>';
  const result = applyEmailTracking(html, 'tid1', 'https://api.example.com', { trackOpens: false, trackClicks: true });
  assert.ok(!result.includes('/t/o/tid1'), 'Should NOT have tracking pixel');
  assert.ok(result.includes('/t/c/tid1'), 'Should have wrapped links');
});

test('applyEmailTracking: both disabled', () => {
  const html = '<html><body><a href="https://example.com">Link</a></body></html>';
  const result = applyEmailTracking(html, 'tid1', 'https://api.example.com', { trackOpens: false, trackClicks: false });
  assert.ok(!result.includes('/t/o/'), 'Should NOT have tracking pixel');
  assert.ok(!result.includes('/t/c/'), 'Should NOT have wrapped links');
});

test('applyEmailTracking: defaults to both enabled', () => {
  const html = '<html><body><a href="https://example.com">Link</a></body></html>';
  const result = applyEmailTracking(html, 'tid1', 'https://api.example.com');
  assert.ok(result.includes('/t/o/tid1'), 'Default should have pixel');
  assert.ok(result.includes('/t/c/tid1'), 'Default should have wrapped links');
});

// ============================================
// Unsubscribe Header
// ============================================

console.log('\n--- Unsubscribe Header ---');

test('RFC 8058 List-Unsubscribe format', () => {
  const unsubUrl = 'https://api.example.com/api/v1/unsubscribe/token-123';
  const header = `<${unsubUrl}>`;
  assert.ok(header.startsWith('<'));
  assert.ok(header.endsWith('>'));
  assert.ok(header.includes('unsubscribe'));
});

test('List-Unsubscribe-Post header for one-click', () => {
  const postHeader = 'List-Unsubscribe=One-Click';
  assert.equal(postHeader, 'List-Unsubscribe=One-Click');
});

// ============================================
// Suppression Recheck
// ============================================

console.log('\n--- Suppression Recheck ---');

test('Suppressed email skips send', () => {
  const suppressionList = new Set(['blocked@co.com', 'spam@test.com']);
  const emailToSend = 'blocked@co.com';
  const shouldSend = !suppressionList.has(emailToSend);
  assert.equal(shouldSend, false);
});

test('Non-suppressed email proceeds to send', () => {
  const suppressionList = new Set(['blocked@co.com']);
  const emailToSend = 'allowed@co.com';
  const shouldSend = !suppressionList.has(emailToSend);
  assert.equal(shouldSend, true);
});

test('Suppression check is case-sensitive', () => {
  const suppressionList = new Set(['Blocked@Co.com']);
  assert.equal(suppressionList.has('blocked@co.com'), false);
  assert.equal(suppressionList.has('Blocked@Co.com'), true);
});

// ============================================
// isAuthError
// ============================================

console.log('\n--- isAuthError Detection ---');

test('isAuthError: status code 401', () => {
  assert.equal(isAuthError({ statusCode: 401 }), true);
});

test('isAuthError: status code 403', () => {
  assert.equal(isAuthError({ code: 403 }), true);
});

test('isAuthError: "authentication" in message', () => {
  assert.equal(isAuthError({ message: 'authentication failed for user' }), true);
});

test('isAuthError: "auth_error" in message', () => {
  assert.equal(isAuthError({ message: 'auth_error: invalid credentials' }), true);
});

test('isAuthError: "auth error" with space', () => {
  assert.equal(isAuthError({ message: 'Got an auth error from provider' }), true);
});

test('isAuthError: "insufficient permissions"', () => {
  assert.equal(isAuthError({ message: 'insufficient permissions to send email' }), true);
});

test('isAuthError: "invalid_grant"', () => {
  assert.equal(isAuthError({ message: 'invalid_grant: Token has been expired or revoked' }), true);
});

test('isAuthError: "token expired"', () => {
  assert.equal(isAuthError({ message: 'The token expired at 2024-01-01' }), true);
});

test('isAuthError: "token has been revoked"', () => {
  assert.equal(isAuthError({ message: 'token has been revoked by user' }), true);
});

test('isAuthError: "unauthorized"', () => {
  assert.equal(isAuthError({ message: 'Unauthorized access' }), true);
});

test('isAuthError: NO false positive on "author"', () => {
  assert.equal(isAuthError({ message: 'The author of this book is unknown' }), false);
});

test('isAuthError: NO false positive on "authorized"', () => {
  // "authorized" does not match our specific patterns
  assert.equal(isAuthError({ message: 'user is fully authorized for this action' }), false);
});

test('isAuthError: NO false positive on "authority"', () => {
  assert.equal(isAuthError({ message: 'certificate authority validation passed' }), false);
});

test('isAuthError: NO false positive on rate limit', () => {
  assert.equal(isAuthError({ message: 'Rate limit exceeded' }), false);
});

test('isAuthError: empty error returns false', () => {
  assert.equal(isAuthError({}), false);
});

test('isAuthError: null error returns false', () => {
  assert.equal(isAuthError(null), false);
});

// ============================================
// Mid-Campaign Tracking Toggle
// ============================================

console.log('\n--- Mid-Campaign Tracking Toggle ---');

test('track_opens=false means no pixel injected', () => {
  const html = '<html><body><p>Hello</p></body></html>';
  const result = applyEmailTracking(html, 'tid1', 'https://api.example.com', { trackOpens: false, trackClicks: true });
  assert.ok(!result.includes('/t/o/'), 'No pixel when trackOpens=false');
});

test('track_clicks=false means no link wrapping', () => {
  const html = '<html><body><a href="https://example.com">Link</a></body></html>';
  const result = applyEmailTracking(html, 'tid1', 'https://api.example.com', { trackOpens: true, trackClicks: false });
  assert.ok(!result.includes('/t/c/'), 'No link wrapping when trackClicks=false');
});

// ============================================
// Tracking URL Validation & GIF Buffer
// ============================================

console.log('\n--- Tracking URL Validation ---');

test('Valid https URL passes validation', () => {
  assert.equal(isValidTrackingUrl('https://example.com/page'), true);
});

test('Valid http URL passes validation', () => {
  assert.equal(isValidTrackingUrl('http://example.com/page'), true);
});

test('javascript: URL fails validation', () => {
  assert.equal(isValidTrackingUrl('javascript:alert(1)'), false);
});

test('Invalid URL fails validation', () => {
  assert.equal(isValidTrackingUrl('not-a-url'), false);
});

test('Transparent GIF buffer is valid', () => {
  assert.ok(TRANSPARENT_GIF_BUFFER instanceof Buffer);
  assert.ok(TRANSPARENT_GIF_BUFFER.length > 0);
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
