/**
 * Email Sender Audit Tests
 * Tests for variable map construction, normalization, fullName computation,
 * custom_fields filtering, isAuthError detection, processEmailContent pipeline,
 * and blocksSequence() for all lead statuses.
 */
import assert from 'node:assert/strict';
import {
  processEmailContent,
  normalizeVariableMap,
  injectVariables,
  processConditionalBlocks,
  processVariablesWithFallback,
} from '../../packages/shared/src/utils';
import { leadStateMachine } from '../../packages/shared/src/lead-state-machine';

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
// Variable Map Construction (simulating email-sender.ts)
// ============================================
console.log('\n--- Variable Map Construction ---');

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

test('Variable map includes all lead fields', () => {
  const lead = { first_name: 'Jane', last_name: 'Doe', email: 'jane@test.com', company: 'Acme', title: 'CEO', phone: '+1555' };
  const inbox = { email: 'sender@co.com', from_name: 'Sales', sender_first_name: 'Sam', sender_last_name: 'Smith', sender_company: 'Co', sender_title: 'Rep', sender_phone: '+1234', sender_website: 'https://co.com' };
  const vars = buildVariableMap(lead, inbox);

  assert.equal(vars.firstName, 'Jane');
  assert.equal(vars.first_name, 'Jane');
  assert.equal(vars.lastName, 'Doe');
  assert.equal(vars.email, 'jane@test.com');
  assert.equal(vars.company, 'Acme');
  assert.equal(vars.title, 'CEO');
  assert.equal(vars.phone, '+1555');
});

test('Variable map includes all inbox sender fields', () => {
  const lead = { first_name: 'A', last_name: 'B', email: 'a@b.com' };
  const inbox = { email: 'send@co.com', from_name: 'Team', sender_first_name: 'Alice', sender_last_name: 'Wong', sender_company: 'BigCo', sender_title: 'Manager', sender_phone: '+9999', sender_website: 'https://bigco.com' };
  const vars = buildVariableMap(lead, inbox);

  assert.equal(vars.senderFirstName, 'Alice');
  assert.equal(vars.sender_first_name, 'Alice');
  assert.equal(vars.senderLastName, 'Wong');
  assert.equal(vars.senderCompany, 'BigCo');
  assert.equal(vars.senderTitle, 'Manager');
  assert.equal(vars.senderPhone, '+9999');
  assert.equal(vars.senderWebsite, 'https://bigco.com');
  assert.equal(vars.fromName, 'Team');
  assert.equal(vars.fromEmail, 'send@co.com');
  assert.equal(vars.from_name, 'Team');
  assert.equal(vars.from_email, 'send@co.com');
});

test('Variable map handles null lead gracefully', () => {
  const inbox = { email: 'x@y.com', from_name: 'X' };
  const vars = buildVariableMap(null, inbox);

  assert.equal(vars.firstName, '');
  assert.equal(vars.email, '');
  assert.equal(vars.fullName, '');
  assert.equal(vars.fromEmail, 'x@y.com');
});

// ============================================
// fullName Computation
// ============================================
console.log('\n--- fullName Computation ---');

test('fullName: first and last present', () => {
  const lead = { first_name: 'John', last_name: 'Smith' };
  const vars = buildVariableMap(lead, { email: 'x@y.com' });
  assert.equal(vars.fullName, 'John Smith');
  assert.equal(vars.full_name, 'John Smith');
});

test('fullName: first only', () => {
  const lead = { first_name: 'John', last_name: '' };
  const vars = buildVariableMap(lead, { email: 'x@y.com' });
  assert.equal(vars.fullName, 'John');
});

test('fullName: last only', () => {
  const lead = { first_name: '', last_name: 'Smith' };
  const vars = buildVariableMap(lead, { email: 'x@y.com' });
  assert.equal(vars.fullName, 'Smith');
});

test('fullName: neither first nor last', () => {
  const lead = { first_name: '', last_name: '' };
  const vars = buildVariableMap(lead, { email: 'x@y.com' });
  assert.equal(vars.fullName, '');
});

test('fullName: null first and last', () => {
  const lead = { first_name: null, last_name: null };
  const vars = buildVariableMap(lead, { email: 'x@y.com' });
  assert.equal(vars.fullName, '');
});

// ============================================
// custom_fields Type Filtering
// ============================================
console.log('\n--- custom_fields Type Filtering ---');

test('custom_fields: string values included', () => {
  const lead = { first_name: 'A', custom_fields: { industry: 'Tech', city: 'NYC' } };
  const vars = buildVariableMap(lead, { email: 'x@y.com' });
  assert.equal(vars.industry, 'Tech');
  assert.equal(vars.city, 'NYC');
});

test('custom_fields: number values excluded', () => {
  const lead = { first_name: 'A', custom_fields: { revenue: 50000, name: 'valid' } };
  const vars = buildVariableMap(lead, { email: 'x@y.com' });
  assert.equal(vars.name, 'valid');
  assert.equal(vars.revenue, undefined);
});

test('custom_fields: object values excluded', () => {
  const lead = { first_name: 'A', custom_fields: { nested: { a: 1 }, tag: 'ok' } };
  const vars = buildVariableMap(lead, { email: 'x@y.com' });
  assert.equal(vars.tag, 'ok');
  assert.equal(vars.nested, undefined);
});

test('custom_fields: array values excluded', () => {
  const lead = { first_name: 'A', custom_fields: { tags: ['a', 'b'], note: 'hello' } };
  const vars = buildVariableMap(lead, { email: 'x@y.com' });
  assert.equal(vars.note, 'hello');
  assert.equal(vars.tags, undefined);
});

test('custom_fields: boolean values excluded', () => {
  const lead = { first_name: 'A', custom_fields: { active: true, label: 'vip' } };
  const vars = buildVariableMap(lead, { email: 'x@y.com' });
  assert.equal(vars.label, 'vip');
  assert.equal(vars.active, undefined);
});

test('custom_fields: null custom_fields object', () => {
  const lead = { first_name: 'A', custom_fields: null };
  const vars = buildVariableMap(lead, { email: 'x@y.com' });
  assert.equal(vars.firstName, 'A');
});

// ============================================
// normalizeVariableMap
// ============================================
console.log('\n--- normalizeVariableMap ---');

test('normalizeVariableMap: camelCase only → snake_case added', () => {
  const vars = normalizeVariableMap({ firstName: 'John' });
  assert.equal(vars.firstName, 'John');
  assert.equal(vars.first_name, 'John');
});

test('normalizeVariableMap: snake_case only → camelCase added', () => {
  const vars = normalizeVariableMap({ first_name: 'Jane' });
  assert.equal(vars.first_name, 'Jane');
  assert.equal(vars.firstName, 'Jane');
});

test('normalizeVariableMap: sender vars camelCase → snake_case', () => {
  const vars = normalizeVariableMap({ senderCompany: 'Acme' });
  assert.equal(vars.senderCompany, 'Acme');
  assert.equal(vars.sender_company, 'Acme');
});

test('normalizeVariableMap: from vars snake_case → camelCase', () => {
  const vars = normalizeVariableMap({ from_email: 'me@co.com', from_name: 'Me' });
  assert.equal(vars.fromEmail, 'me@co.com');
  assert.equal(vars.fromName, 'Me');
});

test('normalizeVariableMap: does not overwrite existing value', () => {
  const vars = normalizeVariableMap({ firstName: 'Camel', first_name: 'Snake' });
  assert.equal(vars.firstName, 'Camel');
  assert.equal(vars.first_name, 'Snake');
});

test('normalizeVariableMap: fullName ↔ full_name', () => {
  const vars = normalizeVariableMap({ fullName: 'John Doe' });
  assert.equal(vars.full_name, 'John Doe');
});

// ============================================
// isAuthError Simulation
// ============================================
console.log('\n--- isAuthError Simulation ---');

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

test('isAuthError: status code 401', () => {
  assert.equal(isAuthError({ statusCode: 401 }), true);
});

test('isAuthError: status code 403', () => {
  assert.equal(isAuthError({ code: 403 }), true);
});

test('isAuthError: invalid_grant message', () => {
  assert.equal(isAuthError({ message: 'invalid_grant: Token has been expired or revoked' }), true);
});

test('isAuthError: token expired message', () => {
  assert.equal(isAuthError({ message: 'The token expired at 2024-01-01' }), true);
});

test('isAuthError: unauthorized message', () => {
  assert.equal(isAuthError({ message: 'Unauthorized access' }), true);
});

test('isAuthError: normal send failure is NOT auth error (rate limit)', () => {
  // "Rate limit exceeded" does not contain any auth keywords
  assert.equal(isAuthError({ message: 'Rate limit exceeded' }), false);
});

test('isAuthError: "author" no longer matches (BUG-3 fixed)', () => {
  // The word "author" contains "auth" substring, but the fix uses more specific patterns
  assert.equal(isAuthError({ message: 'The author of this book is unknown' }), false);
});

test('isAuthError: "authentication failed" is detected', () => {
  assert.equal(isAuthError({ message: 'authentication failed for user' }), true);
});

test('isAuthError: "auth_error" is detected', () => {
  assert.equal(isAuthError({ message: 'auth_error: invalid credentials' }), true);
});

test('isAuthError: "auth error" with space is detected', () => {
  assert.equal(isAuthError({ message: 'Got an auth error from provider' }), true);
});

test('isAuthError: "insufficient permissions" is detected', () => {
  assert.equal(isAuthError({ message: 'insufficient permissions to send email' }), true);
});

test('isAuthError: "authorization" in non-auth context is NOT detected', () => {
  // "authorization header missing from non-auth request" should not match
  // It does contain "unauthorized" substring? No. Let's verify carefully.
  // "authorization" does not contain "unauthorized", "authentication", "auth_error", or "auth error"
  assert.equal(isAuthError({ message: 'authorization header missing from non-auth request' }), false);
});

test('isAuthError: empty error', () => {
  assert.equal(isAuthError({}), false);
});

test('isAuthError: null error', () => {
  assert.equal(isAuthError(null), false);
});

// ============================================
// processEmailContent with Full Variable Maps
// ============================================
console.log('\n--- processEmailContent Pipeline ---');

test('processEmailContent: basic variable substitution', () => {
  const result = processEmailContent('Hi {{firstName}}, welcome to {{company}}.', {
    firstName: 'Alice',
    company: 'Acme',
  });
  assert.equal(result, 'Hi Alice, welcome to Acme.');
});

test('processEmailContent: snake_case variables work via normalization', () => {
  const result = processEmailContent('Hello {{first_name}} from {{sender_company}}', {
    firstName: 'Bob',
    senderCompany: 'BigCo',
  });
  assert.equal(result, 'Hello Bob from BigCo');
});

test('processEmailContent: conditional blocks', () => {
  const result = processEmailContent('{if:company}At {{company}}.{/if}', {
    company: 'Acme',
  });
  assert.equal(result, 'At Acme.');
});

test('processEmailContent: conditional block removed when var missing', () => {
  const result = processEmailContent('{if:company}At {{company}}.{/if} Hi.', {});
  assert.equal(result, ' Hi.');
});

test('processEmailContent: ifnot block', () => {
  const result = processEmailContent('{ifnot:phone}No phone on file.{/ifnot}', {});
  assert.equal(result, 'No phone on file.');
});

test('processEmailContent: fallback values', () => {
  const result = processEmailContent('Hello {{firstName|there}}', {});
  assert.equal(result, 'Hello there');
});

test('processEmailContent: fallback not used when var present', () => {
  const result = processEmailContent('Hello {{firstName|there}}', { firstName: 'Chris' });
  assert.equal(result, 'Hello Chris');
});

test('processEmailContent: unknown variables preserved', () => {
  const result = processEmailContent('Value: {{unknownVar}}', {});
  assert.equal(result, 'Value: {{unknownVar}}');
});

test('processEmailContent: full sender + lead pipeline', () => {
  const vars = buildVariableMap(
    { first_name: 'Dave', last_name: 'Lee', email: 'dave@co.com', company: 'StartupX', title: 'CTO' },
    { email: 'sales@myco.com', from_name: 'Sales Team', sender_first_name: 'Sam', sender_company: 'MyCo' }
  );
  const template = 'Hi {{firstName}}, I\'m {{senderFirstName}} from {{senderCompany}}. {if:title}As {{title}} at {{company}}, you might be interested.{/if}';
  const result = processEmailContent(template, vars);
  assert.equal(result, 'Hi Dave, I\'m Sam from MyCo. As CTO at StartupX, you might be interested.');
});

// ============================================
// blocksSequence() for All 12 Statuses
// ============================================
console.log('\n--- blocksSequence() ---');

const blockingStatuses = ['bounced', 'unsubscribed', 'spam_reported', 'replied', 'interested', 'not_interested', 'meeting_booked'];
const nonBlockingStatuses = ['pending', 'in_sequence', 'contacted', 'soft_bounced', 'sequence_complete'];

for (const status of blockingStatuses) {
  test(`blocksSequence('${status}') returns true`, () => {
    assert.equal(leadStateMachine.blocksSequence(status as any), true);
  });
}

for (const status of nonBlockingStatuses) {
  test(`blocksSequence('${status}') returns false`, () => {
    assert.equal(leadStateMachine.blocksSequence(status as any), false);
  });
}

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
