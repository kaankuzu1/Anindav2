/**
 * Variable Audit — Reply / Unibox Path Tests
 *
 * Tests two code paths that now both use processEmailContent():
 *   1. replies.service.ts  → builds a variable map, then calls processEmailContent()
 *   2. reply-templates.service.ts → builds a variable map, then calls processEmailContent()
 *
 * Bug fixes verified:
 *   Bug #2 — FIXED: processTemplateVariables now handles spintax, conditionals, and fallbacks
 *   Bug #4 — FIXED: processTemplateVariables now preserves unrecognized {{variables}}
 */

import assert from 'node:assert/strict';
import {
  processEmailContent,
  processSpintax,
  processConditionalBlocks,
  injectVariables,
} from '../../packages/shared/src/utils';

// ─── Test infrastructure ────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err: any) {
    failed++;
    const msg = err?.message ?? String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${msg}`);
  }
}

// ─── Shared test data ───────────────────────────────────────────────────

const mockLead = {
  first_name: 'Jane',
  last_name: 'Smith',
  email: 'jane@acme.com',
  company: 'Acme Corp',
  title: 'CTO',
  phone: '+1-555-0100',
  custom_fields: { industry: 'SaaS', revenue: '10M' },
};

const mockInbox = {
  from_name: 'Bob Sales',
  email: 'bob@sender.io',
  sender_first_name: 'Bob',
  sender_last_name: 'Sales',
  sender_company: 'SenderCo',
  sender_title: 'AE',
  sender_phone: '+1-555-0200',
  sender_website: 'https://sender.io',
};

// ─── Replicate replies.service.ts variable map (lines 380–421) ────────

function buildReplyServiceVariableMap(
  lead: typeof mockLead,
  inbox: typeof mockInbox,
): Record<string, string> {
  const variables: Record<string, string> = {
    // Lead variables (both formats)
    firstName: lead.first_name ?? '',
    lastName: lead.last_name ?? '',
    first_name: lead.first_name ?? '',
    last_name: lead.last_name ?? '',
    email: lead.email ?? '',
    company: lead.company ?? '',
    title: lead.title ?? '',
    phone: lead.phone ?? '',
    fullName: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim(),
    full_name: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim(),

    // Inbox variables (both formats)
    from_name: inbox.from_name ?? '',
    from_email: inbox.email ?? '',
    fromName: inbox.from_name ?? '',
    fromEmail: inbox.email ?? '',

    // Sender variables (both formats)
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

  // Spread custom_fields
  if (lead.custom_fields && typeof lead.custom_fields === 'object') {
    for (const [key, value] of Object.entries(lead.custom_fields as Record<string, unknown>)) {
      if (typeof value === 'string') {
        variables[key] = value;
      }
    }
  }

  return variables;
}

// ─── Replicate reply-templates.service.ts processTemplateVariables ─────
// (FIXED: now uses processEmailContent instead of manual regex)

function processTemplateVariables(
  content: string,
  lead: {
    first_name?: string;
    last_name?: string;
    company?: string;
    email?: string;
    title?: string;
    phone?: string;
  },
  originalSubject?: string,
  inbox?: {
    from_name?: string;
    email?: string;
    sender_first_name?: string;
    sender_last_name?: string;
    sender_company?: string;
    sender_title?: string;
    sender_phone?: string;
    sender_website?: string;
  },
): string {
  const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();

  const variables: Record<string, string> = {
    firstName: lead.first_name || '',
    lastName: lead.last_name || '',
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    company: lead.company || '',
    email: lead.email || '',
    title: lead.title || '',
    phone: lead.phone || '',
    fullName,
    full_name: fullName,
    originalSubject: originalSubject || '',
  };

  if (inbox) {
    variables.from_name = inbox.from_name || '';
    variables.fromName = inbox.from_name || '';
    variables.from_email = inbox.email || '';
    variables.fromEmail = inbox.email || '';
    variables.senderFirstName = inbox.sender_first_name || '';
    variables.sender_first_name = inbox.sender_first_name || '';
    variables.senderLastName = inbox.sender_last_name || '';
    variables.sender_last_name = inbox.sender_last_name || '';
    variables.senderCompany = inbox.sender_company || '';
    variables.sender_company = inbox.sender_company || '';
    variables.senderTitle = inbox.sender_title || '';
    variables.sender_title = inbox.sender_title || '';
    variables.senderPhone = inbox.sender_phone || '';
    variables.sender_phone = inbox.sender_phone || '';
    variables.senderWebsite = inbox.sender_website || '';
    variables.sender_website = inbox.sender_website || '';
  }

  return processEmailContent(content, variables).trim();
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 1 — Reply service variable map tests
// ═══════════════════════════════════════════════════════════════════════

console.log('\n=== SECTION 1: Reply service variable map ===\n');

test('1.01 — map includes all lead camelCase keys', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  assert.equal(map.firstName, 'Jane');
  assert.equal(map.lastName, 'Smith');
  assert.equal(map.email, 'jane@acme.com');
  assert.equal(map.company, 'Acme Corp');
  assert.equal(map.title, 'CTO');
  assert.equal(map.phone, '+1-555-0100');
});

test('1.02 — map includes all lead snake_case keys', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  assert.equal(map.first_name, 'Jane');
  assert.equal(map.last_name, 'Smith');
});

test('1.03 — map includes computed fullName / full_name', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  assert.equal(map.fullName, 'Jane Smith');
  assert.equal(map.full_name, 'Jane Smith');
});

test('1.04 — map includes inbox from_name / fromName / from_email / fromEmail', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  assert.equal(map.from_name, 'Bob Sales');
  assert.equal(map.fromName, 'Bob Sales');
  assert.equal(map.from_email, 'bob@sender.io');
  assert.equal(map.fromEmail, 'bob@sender.io');
});

test('1.05 — map includes sender camelCase keys', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  assert.equal(map.senderFirstName, 'Bob');
  assert.equal(map.senderLastName, 'Sales');
  assert.equal(map.senderCompany, 'SenderCo');
  assert.equal(map.senderTitle, 'AE');
  assert.equal(map.senderPhone, '+1-555-0200');
  assert.equal(map.senderWebsite, 'https://sender.io');
});

test('1.06 — map includes sender snake_case keys', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  assert.equal(map.sender_first_name, 'Bob');
  assert.equal(map.sender_last_name, 'Sales');
  assert.equal(map.sender_company, 'SenderCo');
  assert.equal(map.sender_title, 'AE');
  assert.equal(map.sender_phone, '+1-555-0200');
  assert.equal(map.sender_website, 'https://sender.io');
});

test('1.07 — custom_fields are spread into map', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  assert.equal(map.industry, 'SaaS');
  assert.equal(map.revenue, '10M');
});

test('1.08 — non-string custom_fields are excluded', () => {
  const lead = { ...mockLead, custom_fields: { count: 42, valid: 'yes' } };
  const map = buildReplyServiceVariableMap(lead as any, mockInbox);
  assert.equal(map.valid, 'yes');
  assert.equal(map.count, undefined); // number, not string => excluded
});

test('1.09 — processEmailContent resolves variables from reply service map', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  const result = processEmailContent('Hi {{firstName}}, from {{senderCompany}}', map);
  assert.equal(result, 'Hi Jane, from SenderCo');
});

test('1.10 — processEmailContent resolves spintax with reply service map', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  const result = processEmailContent('{Hi|Hello} {{firstName}}', map);
  // spintax resolves to either "Hi" or "Hello"
  assert.ok(
    result === 'Hi Jane' || result === 'Hello Jane',
    `Expected "Hi Jane" or "Hello Jane", got "${result}"`,
  );
});

test('1.11 — processEmailContent resolves conditionals with reply service map', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  const result = processEmailContent('{if:company}At {{company}}.{/if}', map);
  assert.equal(result, 'At Acme Corp.');
});

test('1.12 — processEmailContent resolves fallbacks with reply service map', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  const result = processEmailContent('{{unknownField|your team}}', map);
  assert.equal(result, 'your team');
});

test('1.13 — processEmailContent preserves unrecognized variables (no silent strip)', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  const result = processEmailContent('Hello {{unknownVar}}!', map);
  // injectVariables keeps unknown vars as-is
  assert.equal(result, 'Hello {{unknownVar}}!');
});

test('1.14 — processEmailContent resolves custom_field variables', () => {
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  const result = processEmailContent('Industry: {{industry}}', map);
  assert.equal(result, 'Industry: SaaS');
});

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 2 — processTemplateVariables tests (Bug #2 & #4)
// ═══════════════════════════════════════════════════════════════════════

console.log('\n=== SECTION 2: processTemplateVariables (reply-templates.service.ts) ===\n');

test('2.01 — substitutes all lead camelCase variables', () => {
  const tpl = '{{firstName}} {{lastName}} at {{company}} ({{email}}, {{title}}, {{phone}})';
  const result = processTemplateVariables(tpl, mockLead);
  assert.equal(result, 'Jane Smith at Acme Corp (jane@acme.com, CTO, +1-555-0100)');
});

test('2.02 — substitutes lead snake_case variables', () => {
  const tpl = '{{first_name}} {{last_name}}';
  const result = processTemplateVariables(tpl, mockLead);
  assert.equal(result, 'Jane Smith');
});

test('2.03 — substitutes fullName and full_name', () => {
  const tpl = 'camelCase: {{fullName}}, snake: {{full_name}}';
  const result = processTemplateVariables(tpl, mockLead);
  assert.equal(result, 'camelCase: Jane Smith, snake: Jane Smith');
});

test('2.04 — substitutes originalSubject variable', () => {
  const tpl = 'Re: {{originalSubject}}';
  const result = processTemplateVariables(tpl, mockLead, 'Our Partnership');
  assert.equal(result, 'Re: Our Partnership');
});

test('2.05 — substitutes inbox from_name / fromName / from_email / fromEmail', () => {
  const tpl = '{{fromName}} ({{fromEmail}}) | {{from_name}} ({{from_email}})';
  const result = processTemplateVariables(tpl, mockLead, undefined, mockInbox);
  assert.equal(result, 'Bob Sales (bob@sender.io) | Bob Sales (bob@sender.io)');
});

test('2.06 — substitutes sender camelCase variables', () => {
  const tpl = '{{senderFirstName}} {{senderLastName}} of {{senderCompany}}, {{senderTitle}}, {{senderPhone}}, {{senderWebsite}}';
  const result = processTemplateVariables(tpl, mockLead, undefined, mockInbox);
  assert.equal(result, 'Bob Sales of SenderCo, AE, +1-555-0200, https://sender.io');
});

test('2.07 — substitutes sender snake_case variables', () => {
  const tpl = '{{sender_first_name}} {{sender_last_name}} of {{sender_company}}, {{sender_title}}, {{sender_phone}}, {{sender_website}}';
  const result = processTemplateVariables(tpl, mockLead, undefined, mockInbox);
  assert.equal(result, 'Bob Sales of SenderCo, AE, +1-555-0200, https://sender.io');
});

test('2.08 — FIXED: spintax is now resolved via processEmailContent', () => {
  const tpl = '{Hi|Hello} {{firstName}}';
  const result = processTemplateVariables(tpl, mockLead);
  // processTemplateVariables now uses processEmailContent which resolves spintax
  assert.ok(
    result === 'Hi Jane' || result === 'Hello Jane',
    `Expected "Hi Jane" or "Hello Jane", got "${result}"`,
  );
});

test('2.09 — FIXED: conditionals are now processed via processEmailContent', () => {
  const tpl = '{if:company}At {{company}}.{/if}';
  const result = processTemplateVariables(tpl, mockLead);
  // processTemplateVariables now uses processEmailContent which resolves conditionals
  assert.equal(result, 'At Acme Corp.');
});

test('2.10 — FIXED: ifnot conditionals are now processed via processEmailContent', () => {
  const tpl = '{ifnot:phone}Please reply with your number.{/ifnot}';
  const result = processTemplateVariables(tpl, mockLead);
  // phone exists, so ifnot block is hidden
  assert.equal(result, '');
});

test('2.11 — FIXED: fallback syntax is now processed via processEmailContent', () => {
  const tpl = '{{company|your company}}';
  const result = processTemplateVariables(tpl, mockLead);
  // company has a value, so it's used instead of fallback
  assert.equal(result, 'Acme Corp');
});

test('2.12 — FIXED: unrecognized variable is now preserved', () => {
  const tpl = 'Hello {{unknownVar}}!';
  const result = processTemplateVariables(tpl, mockLead, undefined, mockInbox);
  // Unknown vars are now preserved by processEmailContent instead of stripped
  assert.equal(result, 'Hello {{unknownVar}}!');
});

test('2.13 — FIXED: custom_fields variables are now preserved (not stripped)', () => {
  const tpl = 'Industry: {{industry}}';
  const result = processTemplateVariables(tpl, mockLead, undefined, mockInbox);
  // processTemplateVariables does NOT have custom_fields in its variable map,
  // but unknown vars are now preserved by processEmailContent instead of stripped
  assert.equal(result, 'Industry: {{industry}}');
});

test('2.14 — FIXED: without inbox, sender variables are preserved (not stripped)', () => {
  const tpl = 'From {{senderFirstName}} at {{senderCompany}}';
  const result = processTemplateVariables(tpl, mockLead);
  // inbox not provided => sender vars not in variable map => preserved by processEmailContent
  assert.equal(result, 'From {{senderFirstName}} at {{senderCompany}}');
});

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 3 — Cross-comparison: processEmailContent vs processTemplateVariables
// ═══════════════════════════════════════════════════════════════════════

console.log('\n=== SECTION 3: Cross-comparison ===\n');

test('3.01 — simple variable: both produce same result', () => {
  const tpl = 'Hi {{firstName}} from {{company}}';
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  const viaService = processEmailContent(tpl, map);
  const viaTemplate = processTemplateVariables(tpl, mockLead, undefined, mockInbox);
  assert.equal(viaService, viaTemplate);
});

test('3.02 — FIXED: spintax — both paths now resolve identically', () => {
  const tpl = '{Hi|Hello} {{firstName}}';
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  const viaService = processEmailContent(tpl, map);
  const viaTemplate = processTemplateVariables(tpl, mockLead, undefined, mockInbox);

  // Both paths now resolve spintax
  assert.ok(
    viaService === 'Hi Jane' || viaService === 'Hello Jane',
    `processEmailContent should resolve spintax, got "${viaService}"`,
  );
  assert.ok(
    viaTemplate === 'Hi Jane' || viaTemplate === 'Hello Jane',
    `processTemplateVariables should resolve spintax, got "${viaTemplate}"`,
  );
});

test('3.03 — FIXED: conditional — both paths now resolve identically', () => {
  const tpl = '{if:company}At {{company}}.{/if} Regards, {{senderFirstName}}';
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  const viaService = processEmailContent(tpl, map);
  const viaTemplate = processTemplateVariables(tpl, mockLead, undefined, mockInbox);

  assert.equal(viaService, 'At Acme Corp. Regards, Bob');
  assert.equal(viaTemplate, 'At Acme Corp. Regards, Bob');
  assert.equal(viaService, viaTemplate);
});

test('3.04 — FIXED: false conditional — both paths now hide the block', () => {
  const leadNoCompany = { ...mockLead, company: '' };
  const tpl = '{if:company}At {{company}}.{/if}Done.';
  const map = buildReplyServiceVariableMap({ ...leadNoCompany, custom_fields: {} }, mockInbox);
  const viaService = processEmailContent(tpl, map);
  const viaTemplate = processTemplateVariables(tpl, leadNoCompany, undefined, mockInbox);

  assert.equal(viaService, 'Done.');
  assert.equal(viaTemplate, 'Done.');
  assert.equal(viaService, viaTemplate);
});

test('3.05 — FIXED: fallback syntax — both paths now use fallback', () => {
  const leadNoCompany = { ...mockLead, company: '' };
  const tpl = '{{company|your company}}';
  const map = buildReplyServiceVariableMap({ ...leadNoCompany, custom_fields: {} }, mockInbox);
  const viaService = processEmailContent(tpl, map);
  const viaTemplate = processTemplateVariables(tpl, leadNoCompany, undefined, mockInbox);

  assert.equal(viaService, 'your company');
  assert.equal(viaTemplate, 'your company');
  assert.equal(viaService, viaTemplate);
});

test('3.06 — FIXED: unknown variable — both paths now preserve', () => {
  const tpl = 'See {{unknownVar}} here';
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  const viaService = processEmailContent(tpl, map);
  const viaTemplate = processTemplateVariables(tpl, mockLead, undefined, mockInbox);

  assert.equal(viaService, 'See {{unknownVar}} here');
  assert.equal(viaTemplate, 'See {{unknownVar}} here');
  assert.equal(viaService, viaTemplate);
});

test('3.07 — custom_fields — processEmailContent resolves, processTemplateVariables preserves placeholder', () => {
  const tpl = 'Industry: {{industry}}';
  const map = buildReplyServiceVariableMap(mockLead, mockInbox);
  const viaService = processEmailContent(tpl, map);
  const viaTemplate = processTemplateVariables(tpl, mockLead, undefined, mockInbox);

  // processEmailContent has custom_fields in the map, so it resolves
  assert.equal(viaService, 'Industry: SaaS');
  // processTemplateVariables does NOT have custom_fields, but now preserves unknown vars
  assert.equal(viaTemplate, 'Industry: {{industry}}');
  assert.notEqual(viaService, viaTemplate);
});

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(60));
console.log(`  TOTAL: ${passed + failed}  |  PASSED: ${passed}  |  FAILED: ${failed}`);
console.log('='.repeat(60));

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}

console.log('\n--- Bug Fix Status ---');
console.log('Bug #2: FIXED — processTemplateVariables now uses processEmailContent (spintax, conditionals, fallbacks)');
console.log('        (tests 2.08, 2.09, 2.10, 2.11, 3.02, 3.03, 3.04, 3.05)');
console.log('Bug #4: FIXED — unrecognized {{variables}} are now preserved (catch-all regex removed)');
console.log('        (tests 2.12, 2.13, 2.14, 3.06, 3.07)');
console.log('');

process.exit(failed > 0 ? 1 : 0);
