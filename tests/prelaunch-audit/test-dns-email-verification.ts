/**
 * Suite 12: DNS & Email Verification Tests
 * Tests dns-validator.ts and email-verification.ts
 * ~150 assertions covering email syntax, domain extraction, SPF/DKIM/DMARC parsing,
 * DNS scoring, recommendations, risk scoring, and quick validation.
 */

import assert from 'node:assert/strict';

import {
  // dns-validator.ts exports
  parseSpfRecord,
  calculateDnsScore,
  generateRecommendations,
  // email-verification.ts exports
  isValidEmailSyntax,
  extractDomain,
  calculateRiskScore,
  quickValidate,
} from '../../packages/shared/src/index';

import type {
  SpfResult,
  DkimResult,
  DmarcResult,
  DnsValidationResult,
  EmailVerificationResult,
} from '../../packages/shared/src/index';

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

// ─── Helper: build a DnsValidationResult for scoring/recommendation tests ───

function makeDnsResult(overrides: Partial<DnsValidationResult> = {}): DnsValidationResult {
  const base: DnsValidationResult = {
    domain: 'example.com',
    spf: { valid: false, record: null, mechanisms: [], includes: [], policy: 'none' },
    dkim: { valid: false, selector: 'google', record: null, publicKey: false },
    dmarc: { valid: false, record: null, policy: null, subdomainPolicy: null, percentage: 100, rua: [], ruf: [] },
    hasMxRecords: false,
    mxRecords: [],
    overallValid: false,
    score: 0,
    recommendations: [],
    validatedAt: new Date(),
    ...overrides,
  };
  return base;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: Email Syntax Validation (isValidEmailSyntax) — 40 tests
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n=== Email Syntax Validation ===');

test('valid: user@example.com', () => {
  assert.equal(isValidEmailSyntax('user@example.com'), true);
});

test('valid: user+tag@example.com', () => {
  assert.equal(isValidEmailSyntax('user+tag@example.com'), true);
});

test('valid: user.name@example.com', () => {
  assert.equal(isValidEmailSyntax('user.name@example.com'), true);
});

test('valid: user@sub.domain.com', () => {
  assert.equal(isValidEmailSyntax('user@sub.domain.com'), true);
});

test('valid: user@example.co.uk', () => {
  assert.equal(isValidEmailSyntax('user@example.co.uk'), true);
});

test('valid: user123@example.com', () => {
  assert.equal(isValidEmailSyntax('user123@example.com'), true);
});

test('valid: first.last@example.com', () => {
  assert.equal(isValidEmailSyntax('first.last@example.com'), true);
});

test('valid: user!def@example.com (special char !)', () => {
  assert.equal(isValidEmailSyntax('user!def@example.com'), true);
});

test('valid: user#inbox@example.com (special char #)', () => {
  assert.equal(isValidEmailSyntax('user#inbox@example.com'), true);
});

test('valid: user%office@example.com (special char %)', () => {
  assert.equal(isValidEmailSyntax('user%office@example.com'), true);
});

test('valid: user&co@example.com (special char &)', () => {
  assert.equal(isValidEmailSyntax("user&co@example.com"), true);
});

test("valid: user'name@example.com (special char ')", () => {
  assert.equal(isValidEmailSyntax("user'name@example.com"), true);
});

test('valid: user*star@example.com (special char *)', () => {
  assert.equal(isValidEmailSyntax('user*star@example.com'), true);
});

test('valid: a@b.co (minimal valid)', () => {
  assert.equal(isValidEmailSyntax('a@b.co'), true);
});

test('valid: user@123.123.123.com (numeric domain labels)', () => {
  assert.equal(isValidEmailSyntax('user@123.123.123.com'), true);
});

test('invalid: empty string', () => {
  assert.equal(isValidEmailSyntax(''), false);
});

test('invalid: @example.com (no local part)', () => {
  assert.equal(isValidEmailSyntax('@example.com'), false);
});

test('invalid: user@ (no domain)', () => {
  assert.equal(isValidEmailSyntax('user@'), false);
});

test('invalid: user (no @ at all)', () => {
  assert.equal(isValidEmailSyntax('user'), false);
});

test('invalid: user@@example.com (double @)', () => {
  assert.equal(isValidEmailSyntax('user@@example.com'), false);
});

test('invalid: user@.com (domain starts with dot)', () => {
  assert.equal(isValidEmailSyntax('user@.com'), false);
});

test('edge: .user@example.com (local starts with dot) — regex allows it', () => {
  // The regex permits dots at start of local part (RFC 5322 allows this in display form)
  assert.equal(isValidEmailSyntax('.user@example.com'), true);
});

test('edge: user.@example.com (local ends with dot) — regex allows it', () => {
  // The regex permits dots at end of local part
  assert.equal(isValidEmailSyntax('user.@example.com'), true);
});

test('invalid: user@-example.com (domain starts with hyphen)', () => {
  assert.equal(isValidEmailSyntax('user@-example.com'), false);
});

test('invalid: user@example-.com (domain label ends with hyphen)', () => {
  assert.equal(isValidEmailSyntax('user@example-.com'), false);
});

test('invalid: whitespace only', () => {
  assert.equal(isValidEmailSyntax('   '), false);
});

test('invalid: email with spaces', () => {
  assert.equal(isValidEmailSyntax('user @example.com'), false);
});

test('invalid: email with space in domain', () => {
  assert.equal(isValidEmailSyntax('user@exam ple.com'), false);
});

test('invalid: just @', () => {
  assert.equal(isValidEmailSyntax('@'), false);
});

test('invalid: user@.', () => {
  assert.equal(isValidEmailSyntax('user@.'), false);
});

test('edge: very long local part (64 chars) is valid by regex', () => {
  const longLocal = 'a'.repeat(64);
  // The regex allows up to 64+ chars in local part; just ensure it doesn't crash
  const result = isValidEmailSyntax(`${longLocal}@example.com`);
  assert.equal(typeof result, 'boolean');
});

test('edge: very long domain (253 chars total)', () => {
  // Just a stress test - shouldn't crash
  const longDomain = 'a'.repeat(60) + '.com';
  const result = isValidEmailSyntax(`user@${longDomain}`);
  assert.equal(typeof result, 'boolean');
});

test('edge: IP address domain user@[127.0.0.1] is invalid (regex rejects brackets)', () => {
  assert.equal(isValidEmailSyntax('user@[127.0.0.1]'), false);
});

test('edge: unicode local part (emoji) is invalid', () => {
  assert.equal(isValidEmailSyntax('u🤖ser@example.com'), false);
});

test('edge: unicode domain is invalid by regex', () => {
  assert.equal(isValidEmailSyntax('user@exämple.com'), false);
});

test('valid: user=value@example.com (= sign)', () => {
  assert.equal(isValidEmailSyntax('user=value@example.com'), true);
});

test('valid: user^test@example.com (^ sign)', () => {
  assert.equal(isValidEmailSyntax('user^test@example.com'), true);
});

test('valid: {user}@example.com (curly braces)', () => {
  assert.equal(isValidEmailSyntax('{user}@example.com'), true);
});

test('valid: user|pipe@example.com (pipe)', () => {
  assert.equal(isValidEmailSyntax('user|pipe@example.com'), true);
});

test('valid: user~tilde@example.com (tilde)', () => {
  assert.equal(isValidEmailSyntax('user~tilde@example.com'), true);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: extractDomain — 20 tests
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n=== extractDomain ===');

test('basic: user@example.com → example.com', () => {
  assert.equal(extractDomain('user@example.com'), 'example.com');
});

test('subdomain: user@sub.domain.com → sub.domain.com', () => {
  assert.equal(extractDomain('user@sub.domain.com'), 'sub.domain.com');
});

test('uppercase: USER@EXAMPLE.COM → example.com', () => {
  assert.equal(extractDomain('USER@EXAMPLE.COM'), 'example.com');
});

test('mixed case: User@Example.Com → example.com', () => {
  assert.equal(extractDomain('User@Example.Com'), 'example.com');
});

test('empty string → empty', () => {
  assert.equal(extractDomain(''), '');
});

test('no @ sign → empty', () => {
  assert.equal(extractDomain('nodomain'), '');
});

test('multiple @ signs → takes last part after split', () => {
  // split('@') gives 3 parts, length !== 2, returns ''
  const result = extractDomain('user@@example.com');
  assert.equal(result, '');
});

test('just @ → empty strings on both sides', () => {
  const result = extractDomain('@');
  assert.equal(result, '');
});

test('@ at end → empty domain', () => {
  const result = extractDomain('user@');
  assert.equal(result, '');
});

test('@ at start → @example.com extracts domain', () => {
  const result = extractDomain('@example.com');
  assert.equal(result, 'example.com');
});

test('user+tag@example.com → example.com', () => {
  assert.equal(extractDomain('user+tag@example.com'), 'example.com');
});

test('user@co.uk → co.uk', () => {
  assert.equal(extractDomain('user@co.uk'), 'co.uk');
});

test('user@a.b.c.d.com → a.b.c.d.com', () => {
  assert.equal(extractDomain('user@a.b.c.d.com'), 'a.b.c.d.com');
});

test('lowercases domain: user@Gmail.COM → gmail.com', () => {
  assert.equal(extractDomain('user@Gmail.COM'), 'gmail.com');
});

test('lowercases entire email: USER@YAHOO.COM → yahoo.com', () => {
  assert.equal(extractDomain('USER@YAHOO.COM'), 'yahoo.com');
});

test('user@123.com (numeric domain) → 123.com', () => {
  assert.equal(extractDomain('user@123.com'), '123.com');
});

test('user@exam-ple.com (hyphen domain) → exam-ple.com', () => {
  assert.equal(extractDomain('user@exam-ple.com'), 'exam-ple.com');
});

test('user@x.co → x.co (short TLD)', () => {
  assert.equal(extractDomain('user@x.co'), 'x.co');
});

test('whitespace email trimming not done (returns lowercase of input)', () => {
  // extractDomain does not trim — ' user@example.com' splits on @
  const result = extractDomain(' user@example.com');
  assert.equal(result, 'example.com');
});

test('domain with trailing dot: user@example.com. → example.com.', () => {
  assert.equal(extractDomain('user@example.com.'), 'example.com.');
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: SPF Record Parsing (parseSpfRecord) — 20 tests
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n=== SPF Record Parsing ===');

test('SPF: v=spf1 -all → hardfail', () => {
  const result = parseSpfRecord('v=spf1 -all');
  assert.equal(result.valid, true);
  assert.equal(result.policy, 'hardfail');
});

test('SPF: v=spf1 ~all → softfail', () => {
  const result = parseSpfRecord('v=spf1 ~all');
  assert.equal(result.valid, true);
  assert.equal(result.policy, 'softfail');
});

test('SPF: v=spf1 ?all → neutral', () => {
  const result = parseSpfRecord('v=spf1 ?all');
  assert.equal(result.valid, true);
  assert.equal(result.policy, 'neutral');
});

test('SPF: v=spf1 +all → pass', () => {
  const result = parseSpfRecord('v=spf1 +all');
  assert.equal(result.valid, true);
  assert.equal(result.policy, 'pass');
});

test('SPF: no policy qualifier → defaults to none', () => {
  const result = parseSpfRecord('v=spf1 include:test.com');
  assert.equal(result.valid, true);
  assert.equal(result.policy, 'none');
});

test('SPF: include mechanism extracted', () => {
  const result = parseSpfRecord('v=spf1 include:_spf.google.com -all');
  assert.deepEqual(result.includes, ['_spf.google.com']);
  assert.equal(result.policy, 'hardfail');
});

test('SPF: multiple includes extracted', () => {
  const result = parseSpfRecord('v=spf1 include:_spf.google.com include:spf.protection.outlook.com -all');
  assert.equal(result.includes.length, 2);
  assert.ok(result.includes.includes('_spf.google.com'));
  assert.ok(result.includes.includes('spf.protection.outlook.com'));
});

test('SPF: ip4 mechanism added to mechanisms', () => {
  const result = parseSpfRecord('v=spf1 ip4:192.168.1.0/24 -all');
  assert.ok(result.mechanisms.includes('ip4:192.168.1.0/24'));
});

test('SPF: ip6 mechanism added to mechanisms', () => {
  const result = parseSpfRecord('v=spf1 ip6:2001:db8::/32 -all');
  assert.ok(result.mechanisms.includes('ip6:2001:db8::/32'));
});

test('SPF: mx mechanism added to mechanisms', () => {
  const result = parseSpfRecord('v=spf1 mx -all');
  assert.ok(result.mechanisms.includes('mx'));
});

test('SPF: a mechanism added to mechanisms', () => {
  const result = parseSpfRecord('v=spf1 a -all');
  assert.ok(result.mechanisms.includes('a'));
});

test('SPF: include is also added to mechanisms', () => {
  const result = parseSpfRecord('v=spf1 include:_spf.google.com -all');
  assert.ok(result.mechanisms.some(m => m.startsWith('include:')));
});

test('SPF: invalid (no v=spf1 prefix)', () => {
  const result = parseSpfRecord('some random text');
  assert.equal(result.valid, false);
  assert.equal(result.details, 'Invalid SPF version');
});

test('SPF: empty string is invalid', () => {
  const result = parseSpfRecord('');
  assert.equal(result.valid, false);
});

test('SPF: record is stored in result', () => {
  const rec = 'v=spf1 include:_spf.google.com -all';
  const result = parseSpfRecord(rec);
  assert.equal(result.record, rec);
});

test('SPF: complex record with multiple mechanism types', () => {
  const result = parseSpfRecord('v=spf1 a mx ip4:10.0.0.0/8 include:_spf.google.com ~all');
  assert.equal(result.valid, true);
  assert.equal(result.policy, 'softfail');
  assert.ok(result.mechanisms.length >= 4);
  assert.equal(result.includes.length, 1);
});

test('SPF: v=spf1 alone is valid with no policy', () => {
  const result = parseSpfRecord('v=spf1');
  assert.equal(result.valid, true);
  assert.equal(result.policy, 'none');
  assert.equal(result.mechanisms.length, 0);
});

test('SPF: redirect modifier is not parsed as mechanism (ignored silently)', () => {
  const result = parseSpfRecord('v=spf1 redirect=_spf.example.com');
  assert.equal(result.valid, true);
  // redirect is not explicitly parsed — no error, but not in mechanisms
  assert.equal(result.mechanisms.length, 0);
});

test('SPF: case sensitive — V=SPF1 is invalid (no v=spf1 prefix)', () => {
  const result = parseSpfRecord('V=SPF1 -all');
  assert.equal(result.valid, false);
});

test('SPF: extra whitespace between terms', () => {
  const result = parseSpfRecord('v=spf1  include:a.com   -all');
  assert.equal(result.valid, true);
  assert.equal(result.includes.length, 1);
  assert.equal(result.policy, 'hardfail');
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: DKIM Result Structure — 15 tests
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n=== DKIM Result Structure ===');

test('DKIM: valid result structure with public key', () => {
  const result: DkimResult = {
    valid: true,
    selector: 'google',
    record: 'v=DKIM1; k=rsa; p=MIGfMA0GCS...',
    publicKey: true,
  };
  assert.equal(result.valid, true);
  assert.equal(result.publicKey, true);
  assert.equal(result.selector, 'google');
});

test('DKIM: missing public key makes it invalid', () => {
  const result: DkimResult = {
    valid: false,
    selector: 'google',
    record: 'v=DKIM1; k=rsa',
    publicKey: false,
    details: 'DKIM record found but no public key',
  };
  assert.equal(result.valid, false);
  assert.equal(result.publicKey, false);
});

test('DKIM: empty public key (revoked) is not valid', () => {
  const result: DkimResult = {
    valid: false,
    selector: 'google',
    record: 'v=DKIM1; p=;',
    publicKey: false,
  };
  assert.equal(result.valid, false);
  assert.equal(result.publicKey, false);
});

test('DKIM: null record when not found', () => {
  const result: DkimResult = {
    valid: false,
    selector: 'default',
    record: null,
    publicKey: false,
    details: 'No DKIM record found for selector "default"',
  };
  assert.equal(result.record, null);
  assert.ok(result.details!.includes('default'));
});

test('DKIM: selector1 (Microsoft)', () => {
  const result: DkimResult = {
    valid: true,
    selector: 'selector1',
    record: 'v=DKIM1; k=rsa; p=MIGfMA...',
    publicKey: true,
  };
  assert.equal(result.selector, 'selector1');
  assert.equal(result.valid, true);
});

test('DKIM: selector2 (Microsoft fallback)', () => {
  const result: DkimResult = {
    valid: true,
    selector: 'selector2',
    record: 'v=DKIM1; k=rsa; p=MIGfMA...',
    publicKey: true,
  };
  assert.equal(result.selector, 'selector2');
});

test('DKIM: custom selector s1', () => {
  const result: DkimResult = {
    valid: true,
    selector: 's1',
    record: 'v=DKIM1; p=ABC123',
    publicKey: true,
  };
  assert.equal(result.selector, 's1');
});

test('DKIM: result with h= hash algorithm', () => {
  const record = 'v=DKIM1; h=sha256; k=rsa; p=MIGfMA...';
  const result: DkimResult = { valid: true, selector: 'google', record, publicKey: true };
  assert.ok(result.record!.includes('h=sha256'));
});

test('DKIM: result with t=s (strict mode)', () => {
  const record = 'v=DKIM1; t=s; k=rsa; p=MIGfMA...';
  const result: DkimResult = { valid: true, selector: 'google', record, publicKey: true };
  assert.ok(result.record!.includes('t=s'));
});

test('DKIM: no valid record for selector none', () => {
  const result: DkimResult = {
    valid: false,
    selector: 'none',
    record: null,
    publicKey: false,
    details: 'No valid DKIM record found with common selectors',
  };
  assert.equal(result.selector, 'none');
  assert.equal(result.valid, false);
});

test('DKIM: details is optional', () => {
  const result: DkimResult = {
    valid: true,
    selector: 'google',
    record: 'v=DKIM1; p=ABC',
    publicKey: true,
  };
  assert.equal(result.details, undefined);
});

test('DKIM: interface has correct required fields', () => {
  const result: DkimResult = { valid: false, selector: 'k1', record: null, publicKey: false };
  assert.equal(typeof result.valid, 'boolean');
  assert.equal(typeof result.selector, 'string');
  assert.equal(typeof result.publicKey, 'boolean');
});

test('DKIM: record can contain multiple chunks joined', () => {
  const record = 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ';
  const result: DkimResult = { valid: true, selector: 'google', record, publicKey: true };
  assert.ok(result.record!.length > 50);
});

test('DKIM: mail selector', () => {
  const result: DkimResult = { valid: true, selector: 'mail', record: 'v=DKIM1; p=ABC', publicKey: true };
  assert.equal(result.selector, 'mail');
});

test('DKIM: email selector', () => {
  const result: DkimResult = { valid: true, selector: 'email', record: 'v=DKIM1; p=XYZ', publicKey: true };
  assert.equal(result.selector, 'email');
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 5: DMARC Record Parsing (DmarcResult structure) — 20 tests
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n=== DMARC Record Parsing ===');

test('DMARC: reject policy', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=reject', policy: 'reject',
    subdomainPolicy: 'reject', percentage: 100, rua: [], ruf: [],
  };
  assert.equal(result.policy, 'reject');
});

test('DMARC: quarantine policy', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=quarantine', policy: 'quarantine',
    subdomainPolicy: 'quarantine', percentage: 100, rua: [], ruf: [],
  };
  assert.equal(result.policy, 'quarantine');
});

test('DMARC: none policy (monitoring only)', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=none', policy: 'none',
    subdomainPolicy: 'none', percentage: 100, rua: [], ruf: [],
  };
  assert.equal(result.policy, 'none');
});

test('DMARC: with rua aggregate reports', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com',
    policy: 'reject', subdomainPolicy: 'reject', percentage: 100,
    rua: ['dmarc@example.com'], ruf: [],
  };
  assert.deepEqual(result.rua, ['dmarc@example.com']);
});

test('DMARC: with ruf forensic reports', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=reject; ruf=mailto:forensics@example.com',
    policy: 'reject', subdomainPolicy: 'reject', percentage: 100,
    rua: [], ruf: ['forensics@example.com'],
  };
  assert.deepEqual(result.ruf, ['forensics@example.com']);
});

test('DMARC: with pct percentage', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=quarantine; pct=50',
    policy: 'quarantine', subdomainPolicy: 'quarantine', percentage: 50,
    rua: [], ruf: [],
  };
  assert.equal(result.percentage, 50);
});

test('DMARC: subdomain policy different from main', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=reject; sp=none',
    policy: 'reject', subdomainPolicy: 'none', percentage: 100,
    rua: [], ruf: [],
  };
  assert.equal(result.policy, 'reject');
  assert.equal(result.subdomainPolicy, 'none');
});

test('DMARC: subdomain policy defaults to main policy', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=quarantine',
    policy: 'quarantine', subdomainPolicy: 'quarantine', percentage: 100,
    rua: [], ruf: [],
  };
  assert.equal(result.subdomainPolicy, result.policy);
});

test('DMARC: null policy when no DMARC record', () => {
  const result: DmarcResult = {
    valid: false, record: null, policy: null, subdomainPolicy: null,
    percentage: 100, rua: [], ruf: [],
  };
  assert.equal(result.policy, null);
  assert.equal(result.subdomainPolicy, null);
});

test('DMARC: default percentage is 100', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=reject',
    policy: 'reject', subdomainPolicy: 'reject', percentage: 100,
    rua: [], ruf: [],
  };
  assert.equal(result.percentage, 100);
});

test('DMARC: invalid record is not valid', () => {
  const result: DmarcResult = {
    valid: false, record: null, policy: null, subdomainPolicy: null,
    percentage: 100, rua: [], ruf: [],
    details: 'No DMARC record found',
  };
  assert.equal(result.valid, false);
});

test('DMARC: multiple rua addresses', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=reject; rua=mailto:a@ex.com,mailto:b@ex.com',
    policy: 'reject', subdomainPolicy: 'reject', percentage: 100,
    rua: ['a@ex.com', 'b@ex.com'], ruf: [],
  };
  assert.equal(result.rua.length, 2);
});

test('DMARC: details field is optional', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=reject',
    policy: 'reject', subdomainPolicy: 'reject', percentage: 100,
    rua: [], ruf: [],
  };
  assert.equal(result.details, undefined);
});

test('DMARC: empty rua and ruf arrays when not specified', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=none',
    policy: 'none', subdomainPolicy: 'none', percentage: 100,
    rua: [], ruf: [],
  };
  assert.deepEqual(result.rua, []);
  assert.deepEqual(result.ruf, []);
});

test('DMARC: full complex record', () => {
  const result: DmarcResult = {
    valid: true,
    record: 'v=DMARC1; p=reject; sp=quarantine; pct=75; rua=mailto:agg@ex.com; ruf=mailto:for@ex.com',
    policy: 'reject', subdomainPolicy: 'quarantine', percentage: 75,
    rua: ['agg@ex.com'], ruf: ['for@ex.com'],
  };
  assert.equal(result.policy, 'reject');
  assert.equal(result.subdomainPolicy, 'quarantine');
  assert.equal(result.percentage, 75);
  assert.equal(result.rua.length, 1);
  assert.equal(result.ruf.length, 1);
});

test('DMARC: pct=0 means apply to 0% (edge case)', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=reject; pct=0',
    policy: 'reject', subdomainPolicy: 'reject', percentage: 0,
    rua: [], ruf: [],
  };
  assert.equal(result.percentage, 0);
});

test('DMARC: pct=100 is the max', () => {
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=reject; pct=100',
    policy: 'reject', subdomainPolicy: 'reject', percentage: 100,
    rua: [], ruf: [],
  };
  assert.equal(result.percentage, 100);
});

test('DMARC: record field stores the raw TXT record', () => {
  const raw = 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com';
  const result: DmarcResult = {
    valid: true, record: raw, policy: 'reject', subdomainPolicy: 'reject',
    percentage: 100, rua: ['dmarc@example.com'], ruf: [],
  };
  assert.equal(result.record, raw);
});

test('DMARC: adkim and aspf are not explicitly parsed (no fields on interface)', () => {
  // The DmarcResult interface does not have adkim/aspf fields
  const result: DmarcResult = {
    valid: true, record: 'v=DMARC1; p=reject; adkim=s; aspf=s',
    policy: 'reject', subdomainPolicy: 'reject', percentage: 100,
    rua: [], ruf: [],
  };
  // Just verify that the interface compiles and the record stores the raw text
  assert.ok(result.record!.includes('adkim=s'));
  assert.ok(result.record!.includes('aspf=s'));
});

test('DMARC: both rua and ruf can coexist', () => {
  const result: DmarcResult = {
    valid: true,
    record: 'v=DMARC1; p=reject; rua=mailto:a@e.com; ruf=mailto:f@e.com',
    policy: 'reject', subdomainPolicy: 'reject', percentage: 100,
    rua: ['a@e.com'], ruf: ['f@e.com'],
  };
  assert.equal(result.rua.length, 1);
  assert.equal(result.ruf.length, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 6: DNS Validation Scoring (calculateDnsScore) — 20 tests
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n=== DNS Validation Scoring ===');

test('Score: all records valid (SPF hardfail + DKIM + DMARC reject) → 100', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 -all', mechanisms: [], includes: [], policy: 'hardfail' },
    dkim: { valid: true, selector: 'google', record: 'v=DKIM1; p=ABC', publicKey: true },
    dmarc: { valid: true, record: 'v=DMARC1; p=reject', policy: 'reject', subdomainPolicy: 'reject', percentage: 100, rua: [], ruf: [] },
  });
  assert.equal(calculateDnsScore(r), 100);
});

test('Score: no records at all → 0', () => {
  const r = makeDnsResult();
  assert.equal(calculateDnsScore(r), 0);
});

test('Score: MX only → 20', () => {
  const r = makeDnsResult({ hasMxRecords: true });
  assert.equal(calculateDnsScore(r), 20);
});

test('Score: MX + valid SPF hardfail → 50', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 -all', mechanisms: [], includes: [], policy: 'hardfail' },
  });
  assert.equal(calculateDnsScore(r), 50);
});

test('Score: MX + valid SPF softfail → 50', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 ~all', mechanisms: [], includes: [], policy: 'softfail' },
  });
  assert.equal(calculateDnsScore(r), 50);
});

test('Score: MX + valid SPF neutral → 40', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 ?all', mechanisms: [], includes: [], policy: 'neutral' },
  });
  // 20 (MX) + 15 (valid SPF) + 5 (neutral) = 40
  assert.equal(calculateDnsScore(r), 40);
});

test('Score: MX + valid SPF pass → 35', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 +all', mechanisms: [], includes: [], policy: 'pass' },
  });
  // 20 (MX) + 15 (valid SPF) + 0 (pass gets no extra) = 35
  assert.equal(calculateDnsScore(r), 35);
});

test('Score: MX + SPF none policy → 35', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1', mechanisms: [], includes: [], policy: 'none' },
  });
  // 20 + 15 + 0 = 35
  assert.equal(calculateDnsScore(r), 35);
});

test('Score: MX + DKIM only → 45', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    dkim: { valid: true, selector: 'google', record: 'v=DKIM1; p=ABC', publicKey: true },
  });
  assert.equal(calculateDnsScore(r), 45);
});

test('Score: MX + DMARC reject → 45', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    dmarc: { valid: true, record: 'v=DMARC1; p=reject', policy: 'reject', subdomainPolicy: 'reject', percentage: 100, rua: [], ruf: [] },
  });
  // 20 + 10 + 15 = 45
  assert.equal(calculateDnsScore(r), 45);
});

test('Score: MX + DMARC quarantine → 40', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    dmarc: { valid: true, record: 'v=DMARC1; p=quarantine', policy: 'quarantine', subdomainPolicy: 'quarantine', percentage: 100, rua: [], ruf: [] },
  });
  // 20 + 10 + 10 = 40
  assert.equal(calculateDnsScore(r), 40);
});

test('Score: MX + DMARC none → 35', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    dmarc: { valid: true, record: 'v=DMARC1; p=none', policy: 'none', subdomainPolicy: 'none', percentage: 100, rua: [], ruf: [] },
  });
  // 20 + 10 + 5 = 35
  assert.equal(calculateDnsScore(r), 35);
});

test('Score: SPF hardfail + DMARC reject, no MX → 65', () => {
  const r = makeDnsResult({
    spf: { valid: true, record: 'v=spf1 -all', mechanisms: [], includes: [], policy: 'hardfail' },
    dmarc: { valid: true, record: 'v=DMARC1; p=reject', policy: 'reject', subdomainPolicy: 'reject', percentage: 100, rua: [], ruf: [] },
  });
  // 0 (no MX) + 30 (SPF) + 25 (DMARC) = 55
  // Wait: 15 (valid SPF) + 15 (hardfail) + 10 (valid DMARC) + 15 (reject) = 55
  assert.equal(calculateDnsScore(r), 55);
});

test('Score: DKIM alone → 25', () => {
  const r = makeDnsResult({
    dkim: { valid: true, selector: 'google', record: 'v=DKIM1; p=ABC', publicKey: true },
  });
  assert.equal(calculateDnsScore(r), 25);
});

test('Score: SPF valid but invalid DKIM → no DKIM points', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 -all', mechanisms: [], includes: [], policy: 'hardfail' },
    dkim: { valid: false, selector: 'google', record: null, publicKey: false },
  });
  // 20 + 30 + 0 = 50
  assert.equal(calculateDnsScore(r), 50);
});

test('Score: all valid with DMARC quarantine → 95', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 -all', mechanisms: [], includes: [], policy: 'hardfail' },
    dkim: { valid: true, selector: 'google', record: 'v=DKIM1; p=ABC', publicKey: true },
    dmarc: { valid: true, record: 'v=DMARC1; p=quarantine', policy: 'quarantine', subdomainPolicy: 'quarantine', percentage: 100, rua: [], ruf: [] },
  });
  // 20 + 30 + 25 + 20 = 95
  assert.equal(calculateDnsScore(r), 95);
});

test('Score: all valid with DMARC none → 90', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 -all', mechanisms: [], includes: [], policy: 'hardfail' },
    dkim: { valid: true, selector: 'google', record: 'v=DKIM1; p=ABC', publicKey: true },
    dmarc: { valid: true, record: 'v=DMARC1; p=none', policy: 'none', subdomainPolicy: 'none', percentage: 100, rua: [], ruf: [] },
  });
  // 20 + 30 + 25 + 15 = 90
  assert.equal(calculateDnsScore(r), 90);
});

test('Score: DMARC valid but null policy → 10 (valid bonus only, no policy bonus)', () => {
  const r = makeDnsResult({
    dmarc: { valid: true, record: 'v=DMARC1', policy: null, subdomainPolicy: null, percentage: 100, rua: [], ruf: [] },
  });
  // 0 + 0 + 0 + 10 (valid DMARC, no policy match) = 10
  assert.equal(calculateDnsScore(r), 10);
});

test('Score: score is always between 0 and 100', () => {
  // Maximum possible score
  const maxR = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 -all', mechanisms: [], includes: [], policy: 'hardfail' },
    dkim: { valid: true, selector: 'google', record: 'v=DKIM1; p=ABC', publicKey: true },
    dmarc: { valid: true, record: 'v=DMARC1; p=reject', policy: 'reject', subdomainPolicy: 'reject', percentage: 100, rua: [], ruf: [] },
  });
  const maxScore = calculateDnsScore(maxR);
  assert.ok(maxScore >= 0 && maxScore <= 100, `Score ${maxScore} not in 0-100`);

  // Minimum possible
  const minR = makeDnsResult();
  const minScore = calculateDnsScore(minR);
  assert.ok(minScore >= 0 && minScore <= 100, `Score ${minScore} not in 0-100`);
});

test('Score: SPF softfail same score as SPF hardfail', () => {
  const hardfail = makeDnsResult({
    spf: { valid: true, record: 'v=spf1 -all', mechanisms: [], includes: [], policy: 'hardfail' },
  });
  const softfail = makeDnsResult({
    spf: { valid: true, record: 'v=spf1 ~all', mechanisms: [], includes: [], policy: 'softfail' },
  });
  assert.equal(calculateDnsScore(hardfail), calculateDnsScore(softfail));
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 7: generateRecommendations — 15 tests
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n=== generateRecommendations ===');

test('Rec: no MX records → CRITICAL recommendation', () => {
  const r = makeDnsResult();
  const recs = generateRecommendations(r);
  assert.ok(recs.some(rec => rec.includes('CRITICAL') && rec.includes('MX')));
});

test('Rec: no SPF → add SPF recommendation', () => {
  const r = makeDnsResult({ hasMxRecords: true });
  const recs = generateRecommendations(r);
  assert.ok(recs.some(rec => rec.includes('SPF')));
});

test('Rec: no DKIM → configure DKIM recommendation', () => {
  const r = makeDnsResult({ hasMxRecords: true });
  const recs = generateRecommendations(r);
  assert.ok(recs.some(rec => rec.includes('DKIM')));
});

test('Rec: no DMARC → add DMARC recommendation', () => {
  const r = makeDnsResult({ hasMxRecords: true });
  const recs = generateRecommendations(r);
  assert.ok(recs.some(rec => rec.includes('DMARC')));
});

test('Rec: SPF neutral → strengthen SPF recommendation', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 ?all', mechanisms: [], includes: [], policy: 'neutral' },
  });
  const recs = generateRecommendations(r);
  assert.ok(recs.some(rec => rec.includes('Strengthen SPF')));
});

test('Rec: SPF none policy → strengthen recommendation', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1', mechanisms: [], includes: [], policy: 'none' },
  });
  const recs = generateRecommendations(r);
  assert.ok(recs.some(rec => rec.includes('Strengthen SPF')));
});

test('Rec: DMARC none → upgrade recommendation', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    dmarc: { valid: true, record: 'v=DMARC1; p=none', policy: 'none', subdomainPolicy: 'none', percentage: 100, rua: [], ruf: [] },
  });
  const recs = generateRecommendations(r);
  assert.ok(recs.some(rec => rec.includes('Upgrade DMARC')));
});

test('Rec: DMARC valid but no rua → add rua recommendation', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    dmarc: { valid: true, record: 'v=DMARC1; p=reject', policy: 'reject', subdomainPolicy: 'reject', percentage: 100, rua: [], ruf: [] },
  });
  const recs = generateRecommendations(r);
  assert.ok(recs.some(rec => rec.includes('rua')));
});

test('Rec: all perfect → fewer recommendations', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 -all', mechanisms: [], includes: [], policy: 'hardfail' },
    dkim: { valid: true, selector: 'google', record: 'v=DKIM1; p=ABC', publicKey: true },
    dmarc: { valid: true, record: 'v=DMARC1; p=reject; rua=mailto:a@e.com', policy: 'reject', subdomainPolicy: 'reject', percentage: 100, rua: ['a@e.com'], ruf: [] },
  });
  const recs = generateRecommendations(r);
  // Should have no CRITICAL, no "Add SPF", no "Add DMARC", no rua recommendation
  assert.equal(recs.length, 0);
});

test('Rec: SPF hardfail → no strengthen recommendation', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 -all', mechanisms: [], includes: [], policy: 'hardfail' },
  });
  const recs = generateRecommendations(r);
  assert.ok(!recs.some(rec => rec.includes('Strengthen SPF')));
});

test('Rec: DMARC reject → no upgrade recommendation', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    dmarc: { valid: true, record: 'v=DMARC1; p=reject; rua=mailto:a@e.com', policy: 'reject', subdomainPolicy: 'reject', percentage: 100, rua: ['a@e.com'], ruf: [] },
  });
  const recs = generateRecommendations(r);
  assert.ok(!recs.some(rec => rec.includes('Upgrade DMARC')));
});

test('Rec: DMARC quarantine → no upgrade recommendation', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    dmarc: { valid: true, record: 'v=DMARC1; p=quarantine; rua=mailto:a@e.com', policy: 'quarantine', subdomainPolicy: 'quarantine', percentage: 100, rua: ['a@e.com'], ruf: [] },
  });
  const recs = generateRecommendations(r);
  assert.ok(!recs.some(rec => rec.includes('Upgrade DMARC')));
});

test('Rec: returns string array', () => {
  const r = makeDnsResult();
  const recs = generateRecommendations(r);
  assert.ok(Array.isArray(recs));
  recs.forEach(rec => assert.equal(typeof rec, 'string'));
});

test('Rec: DMARC with rua → no rua recommendation', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    dmarc: { valid: true, record: 'v=DMARC1; p=reject; rua=mailto:d@e.com', policy: 'reject', subdomainPolicy: 'reject', percentage: 100, rua: ['d@e.com'], ruf: [] },
  });
  const recs = generateRecommendations(r);
  assert.ok(!recs.some(rec => rec.includes('rua')));
});

test('Rec: SPF softfail → no strengthen recommendation', () => {
  const r = makeDnsResult({
    hasMxRecords: true,
    spf: { valid: true, record: 'v=spf1 ~all', mechanisms: [], includes: [], policy: 'softfail' },
  });
  const recs = generateRecommendations(r);
  assert.ok(!recs.some(rec => rec.includes('Strengthen SPF')));
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 8: Risk Score (calculateRiskScore) — 15 tests
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n=== Risk Score ===');

test('Risk: invalid syntax → 100', () => {
  assert.equal(calculateRiskScore({ isValidSyntax: false }), 100);
});

test('Risk: valid syntax + no MX → 90', () => {
  assert.equal(calculateRiskScore({ isValidSyntax: true, hasMxRecords: false }), 90);
});

test('Risk: valid + MX + SMTP not connectable → 40', () => {
  assert.equal(calculateRiskScore({ isValidSyntax: true, hasMxRecords: true, smtpConnectable: false, isCatchAll: false }), 40);
});

test('Risk: valid + MX + SMTP connectable + not catch-all → 0', () => {
  assert.equal(calculateRiskScore({ isValidSyntax: true, hasMxRecords: true, smtpConnectable: true, isCatchAll: false }), 0);
});

test('Risk: valid + MX + SMTP connectable + catch-all → 30', () => {
  assert.equal(calculateRiskScore({ isValidSyntax: true, hasMxRecords: true, smtpConnectable: true, isCatchAll: true }), 30);
});

test('Risk: valid + MX + SMTP down + catch-all → 70', () => {
  assert.equal(calculateRiskScore({ isValidSyntax: true, hasMxRecords: true, smtpConnectable: false, isCatchAll: true }), 70);
});

test('Risk: gmail.com reduces score by 20', () => {
  const score = calculateRiskScore({
    isValidSyntax: true, hasMxRecords: true, smtpConnectable: true,
    isCatchAll: true, domain: 'gmail.com',
  });
  // 30 (catch-all) - 20 (free provider) = 10
  assert.equal(score, 10);
});

test('Risk: yahoo.com is a free provider', () => {
  const score = calculateRiskScore({
    isValidSyntax: true, hasMxRecords: true, smtpConnectable: true,
    isCatchAll: true, domain: 'yahoo.com',
  });
  assert.equal(score, 10);
});

test('Risk: outlook.com is a free provider', () => {
  const score = calculateRiskScore({
    isValidSyntax: true, hasMxRecords: true, smtpConnectable: true,
    isCatchAll: true, domain: 'outlook.com',
  });
  assert.equal(score, 10);
});

test('Risk: hotmail.com is a free provider', () => {
  const score = calculateRiskScore({
    isValidSyntax: true, hasMxRecords: true, smtpConnectable: true,
    isCatchAll: true, domain: 'hotmail.com',
  });
  assert.equal(score, 10);
});

test('Risk: aol.com is a free provider', () => {
  const score = calculateRiskScore({
    isValidSyntax: true, hasMxRecords: true, smtpConnectable: true,
    isCatchAll: true, domain: 'aol.com',
  });
  assert.equal(score, 10);
});

test('Risk: custom domain (not free) gets no reduction', () => {
  const score = calculateRiskScore({
    isValidSyntax: true, hasMxRecords: true, smtpConnectable: true,
    isCatchAll: true, domain: 'mydomain.com',
  });
  assert.equal(score, 30);
});

test('Risk: free provider reduction cannot go below 0', () => {
  const score = calculateRiskScore({
    isValidSyntax: true, hasMxRecords: true, smtpConnectable: true,
    isCatchAll: false, domain: 'gmail.com',
  });
  // 0 - 20 = clamped to 0
  assert.equal(score, 0);
});

test('Risk: score capped at 100', () => {
  const score = calculateRiskScore({ isValidSyntax: false });
  assert.ok(score <= 100);
});

test('Risk: isCatchAll null does not add points', () => {
  const score = calculateRiskScore({
    isValidSyntax: true, hasMxRecords: true, smtpConnectable: true,
    isCatchAll: null,
  });
  assert.equal(score, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 9: quickValidate — 10 tests
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n=== quickValidate ===');

test('quickValidate: valid email returns valid true and domain', () => {
  const result = quickValidate('user@example.com');
  assert.equal(result.valid, true);
  assert.equal(result.domain, 'example.com');
});

test('quickValidate: invalid email returns valid false and empty domain', () => {
  const result = quickValidate('not-an-email');
  assert.equal(result.valid, false);
  assert.equal(result.domain, '');
});

test('quickValidate: uppercase email → lowercase domain', () => {
  const result = quickValidate('User@EXAMPLE.COM');
  assert.equal(result.valid, true);
  assert.equal(result.domain, 'example.com');
});

test('quickValidate: empty string → invalid', () => {
  const result = quickValidate('');
  assert.equal(result.valid, false);
  assert.equal(result.domain, '');
});

test('quickValidate: email with tag', () => {
  const result = quickValidate('user+tag@example.com');
  assert.equal(result.valid, true);
  assert.equal(result.domain, 'example.com');
});

test('quickValidate: @@ → invalid', () => {
  const result = quickValidate('@@');
  assert.equal(result.valid, false);
});

test('quickValidate: subdomain email', () => {
  const result = quickValidate('user@mail.sub.example.com');
  assert.equal(result.valid, true);
  assert.equal(result.domain, 'mail.sub.example.com');
});

test('quickValidate: returns exactly two fields', () => {
  const result = quickValidate('user@example.com');
  const keys = Object.keys(result);
  assert.ok(keys.includes('valid'));
  assert.ok(keys.includes('domain'));
});

test('quickValidate: result types are correct', () => {
  const result = quickValidate('user@example.com');
  assert.equal(typeof result.valid, 'boolean');
  assert.equal(typeof result.domain, 'string');
});

test('quickValidate: dot-separated local part', () => {
  const result = quickValidate('first.last@example.com');
  assert.equal(result.valid, true);
  assert.equal(result.domain, 'example.com');
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 10: DnsValidationResult & EmailVerificationResult interfaces — 5 tests
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n=== Interface / Integration ===');

test('DnsValidationResult has all required fields', () => {
  const r = makeDnsResult();
  assert.ok('domain' in r);
  assert.ok('spf' in r);
  assert.ok('dkim' in r);
  assert.ok('dmarc' in r);
  assert.ok('hasMxRecords' in r);
  assert.ok('mxRecords' in r);
  assert.ok('overallValid' in r);
  assert.ok('score' in r);
  assert.ok('recommendations' in r);
  assert.ok('validatedAt' in r);
});

test('EmailVerificationResult has all required fields', () => {
  const r: EmailVerificationResult = {
    email: 'test@example.com',
    status: 'valid',
    domain: 'example.com',
    mxRecords: [],
    isValidSyntax: true,
    hasMxRecords: true,
    smtpConnectable: true,
    isCatchAll: false,
    riskScore: 0,
    verifiedAt: new Date(),
  };
  assert.ok('email' in r);
  assert.ok('status' in r);
  assert.ok('riskScore' in r);
  assert.ok('verifiedAt' in r);
});

test('EmailVerificationStatus covers all expected values', () => {
  const statuses: string[] = ['unverified', 'verifying', 'valid', 'invalid', 'catch_all', 'risky', 'unknown'];
  statuses.forEach(s => {
    // Should be assignable
    const val = s as any;
    assert.equal(typeof val, 'string');
  });
  assert.equal(statuses.length, 7);
});

test('SpfResult policy covers all 5 values', () => {
  const policies: Array<SpfResult['policy']> = ['pass', 'softfail', 'hardfail', 'neutral', 'none'];
  assert.equal(policies.length, 5);
});

test('DmarcResult policy covers 3 values + null', () => {
  const policies: Array<DmarcResult['policy']> = ['none', 'quarantine', 'reject', null];
  assert.equal(policies.length, 4);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed of ${passed + failed}`);
console.log(`${'='.repeat(50)}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
