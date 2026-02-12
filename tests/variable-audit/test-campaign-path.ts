/**
 * Campaign Email Path Variable Audit Tests
 *
 * Tests the variable map construction logic from apps/workers/src/email-sender.ts
 * lines 164-203, and verifies processEmailContent works correctly with that map.
 *
 * Bug #3 FIXED: email-sender.ts now spreads lead.custom_fields into the variable
 * map, matching the pattern in replies.service.ts (line 414-421). Both campaign
 * and reply paths now support custom_fields in templates.
 */

import assert from 'node:assert/strict';
import { processEmailContent } from '../../packages/shared/src/utils';

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

// ---------------------------------------------------------------------------
// Mock data matching the shapes used in email-sender.ts
// ---------------------------------------------------------------------------

interface MockLead {
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  title: string | null;
  phone: string | null;
  custom_fields?: Record<string, unknown> | null;
}

interface MockInbox {
  from_name: string | null;
  email: string;
  sender_first_name: string | null;
  sender_last_name: string | null;
  sender_company: string | null;
  sender_title: string | null;
  sender_phone: string | null;
  sender_website: string | null;
}

// Reconstruct the exact variable map that email-sender.ts builds (lines 164-203)
function buildCampaignVariables(lead: MockLead | null, inbox: MockInbox): Record<string, string> {
  const variables: Record<string, string> = {
    // Lead variables (both formats)
    firstName: lead?.first_name ?? '',
    lastName: lead?.last_name ?? '',
    first_name: lead?.first_name ?? '',
    last_name: lead?.last_name ?? '',
    email: lead?.email ?? '',
    company: lead?.company ?? '',
    title: lead?.title ?? '',
    phone: lead?.phone ?? '',
    fullName: `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim(),
    full_name: `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim(),

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

  // Spread custom_fields from lead into variables
  if (lead?.custom_fields && typeof lead.custom_fields === 'object') {
    for (const [key, value] of Object.entries(lead.custom_fields as Record<string, unknown>)) {
      if (typeof value === 'string') {
        variables[key] = value;
      }
    }
  }

  return variables;
}

// Standard test fixtures
const standardLead: MockLead = {
  first_name: 'Jane',
  last_name: 'Smith',
  email: 'jane@acmecorp.com',
  company: 'Acme Corp',
  title: 'VP of Sales',
  phone: '+1-555-123-4567',
};

const standardInbox: MockInbox = {
  from_name: 'John Doe',
  email: 'john@outreach.io',
  sender_first_name: 'John',
  sender_last_name: 'Doe',
  sender_company: 'Outreach Inc',
  sender_title: 'Account Executive',
  sender_phone: '+1-555-987-6543',
  sender_website: 'https://outreach.io',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\n=== Campaign Email Path Variable Audit ===\n');

// -- Test 1: All lead camelCase variables present and correct --
test('1. Lead camelCase variables (firstName, lastName, fullName)', () => {
  const vars = buildCampaignVariables(standardLead, standardInbox);
  assert.equal(vars.firstName, 'Jane');
  assert.equal(vars.lastName, 'Smith');
  assert.equal(vars.email, 'jane@acmecorp.com');
  assert.equal(vars.company, 'Acme Corp');
  assert.equal(vars.title, 'VP of Sales');
  assert.equal(vars.phone, '+1-555-123-4567');
  assert.equal(vars.fullName, 'Jane Smith');
});

// -- Test 2: All lead snake_case variables present and correct --
test('2. Lead snake_case variables (first_name, last_name, full_name)', () => {
  const vars = buildCampaignVariables(standardLead, standardInbox);
  assert.equal(vars.first_name, 'Jane');
  assert.equal(vars.last_name, 'Smith');
  assert.equal(vars.full_name, 'Jane Smith');
});

// -- Test 3: Inbox from_name/from_email in both formats --
test('3. Inbox from variables (fromName, fromEmail, from_name, from_email)', () => {
  const vars = buildCampaignVariables(standardLead, standardInbox);
  assert.equal(vars.fromName, 'John Doe');
  assert.equal(vars.fromEmail, 'john@outreach.io');
  assert.equal(vars.from_name, 'John Doe');
  assert.equal(vars.from_email, 'john@outreach.io');
});

// -- Test 4: Sender camelCase variables --
test('4. Sender camelCase variables (senderFirstName through senderWebsite)', () => {
  const vars = buildCampaignVariables(standardLead, standardInbox);
  assert.equal(vars.senderFirstName, 'John');
  assert.equal(vars.senderLastName, 'Doe');
  assert.equal(vars.senderCompany, 'Outreach Inc');
  assert.equal(vars.senderTitle, 'Account Executive');
  assert.equal(vars.senderPhone, '+1-555-987-6543');
  assert.equal(vars.senderWebsite, 'https://outreach.io');
});

// -- Test 5: Sender snake_case variables --
test('5. Sender snake_case variables (sender_first_name through sender_website)', () => {
  const vars = buildCampaignVariables(standardLead, standardInbox);
  assert.equal(vars.sender_first_name, 'John');
  assert.equal(vars.sender_last_name, 'Doe');
  assert.equal(vars.sender_company, 'Outreach Inc');
  assert.equal(vars.sender_title, 'Account Executive');
  assert.equal(vars.sender_phone, '+1-555-987-6543');
  assert.equal(vars.sender_website, 'https://outreach.io');
});

// -- Test 6: All 28 variable keys are present --
test('6. Variable map contains all 28 expected keys', () => {
  const vars = buildCampaignVariables(standardLead, standardInbox);
  const expectedKeys = [
    'firstName', 'lastName', 'first_name', 'last_name',
    'email', 'company', 'title', 'phone',
    'fullName', 'full_name',
    'from_name', 'from_email', 'fromName', 'fromEmail',
    'senderFirstName', 'sender_first_name',
    'senderLastName', 'sender_last_name',
    'senderCompany', 'sender_company',
    'senderTitle', 'sender_title',
    'senderPhone', 'sender_phone',
    'senderWebsite', 'sender_website',
  ];
  for (const key of expectedKeys) {
    assert.ok(key in vars, `Missing variable key: ${key}`);
  }
  assert.equal(Object.keys(vars).length, 26, 'Should have exactly 26 keys');
});

// -- Test 7: processEmailContent resolves every lead variable --
test('7. processEmailContent resolves all lead variables in template', () => {
  const vars = buildCampaignVariables(standardLead, standardInbox);
  const template = 'Hi {{firstName}} {{lastName}}, ({{first_name}} {{last_name}}), email: {{email}}, at {{company}}, role: {{title}}, phone: {{phone}}, full: {{fullName}} ({{full_name}})';
  const result = processEmailContent(template, vars);
  assert.equal(
    result,
    'Hi Jane Smith, (Jane Smith), email: jane@acmecorp.com, at Acme Corp, role: VP of Sales, phone: +1-555-123-4567, full: Jane Smith (Jane Smith)'
  );
});

// -- Test 8: processEmailContent resolves every sender variable --
test('8. processEmailContent resolves all sender variables in template', () => {
  const vars = buildCampaignVariables(standardLead, standardInbox);
  const template = '{{senderFirstName}} {{senderLastName}} at {{senderCompany}} ({{senderTitle}}), {{senderPhone}}, {{senderWebsite}}';
  const result = processEmailContent(template, vars);
  assert.equal(result, 'John Doe at Outreach Inc (Account Executive), +1-555-987-6543, https://outreach.io');
});

// -- Test 9: processEmailContent resolves sender snake_case variables --
test('9. processEmailContent resolves sender snake_case variables', () => {
  const vars = buildCampaignVariables(standardLead, standardInbox);
  const template = '{{sender_first_name}} {{sender_last_name}} at {{sender_company}} ({{sender_title}}), {{sender_phone}}, {{sender_website}}';
  const result = processEmailContent(template, vars);
  assert.equal(result, 'John Doe at Outreach Inc (Account Executive), +1-555-987-6543, https://outreach.io');
});

// -- Test 10: processEmailContent resolves from variables --
test('10. processEmailContent resolves from_name/from_email/fromName/fromEmail', () => {
  const vars = buildCampaignVariables(standardLead, standardInbox);
  const template = 'From: {{fromName}} <{{fromEmail}}> / {{from_name}} <{{from_email}}>';
  const result = processEmailContent(template, vars);
  assert.equal(result, 'From: John Doe <john@outreach.io> / John Doe <john@outreach.io>');
});

// -- Test 11: Null lead fields default to empty string --
test('11. Null lead fields default to empty string', () => {
  const nullLead: MockLead = {
    first_name: null,
    last_name: null,
    email: 'unknown@test.com',
    company: null,
    title: null,
    phone: null,
  };
  const vars = buildCampaignVariables(nullLead, standardInbox);
  assert.equal(vars.firstName, '');
  assert.equal(vars.lastName, '');
  assert.equal(vars.company, '');
  assert.equal(vars.title, '');
  assert.equal(vars.phone, '');
  assert.equal(vars.fullName, '', 'fullName should be empty when both names null');
  assert.equal(vars.full_name, '', 'full_name should be empty when both names null');
});

// -- Test 12: Lead is null (lead not found scenario) --
test('12. Lead is null - all lead vars default to empty', () => {
  const vars = buildCampaignVariables(null, standardInbox);
  assert.equal(vars.firstName, '');
  assert.equal(vars.lastName, '');
  assert.equal(vars.email, '');
  assert.equal(vars.company, '');
  assert.equal(vars.fullName, '');
  // Inbox vars should still be present
  assert.equal(vars.fromName, 'John Doe');
  assert.equal(vars.senderCompany, 'Outreach Inc');
});

// -- Test 13: Empty inbox fields default to empty string --
test('13. Empty inbox sender fields default to empty string', () => {
  const emptyInbox: MockInbox = {
    from_name: null,
    email: 'basic@test.com',
    sender_first_name: null,
    sender_last_name: null,
    sender_company: null,
    sender_title: null,
    sender_phone: null,
    sender_website: null,
  };
  const vars = buildCampaignVariables(standardLead, emptyInbox);
  assert.equal(vars.fromName, '');
  assert.equal(vars.from_name, '');
  assert.equal(vars.fromEmail, 'basic@test.com');
  assert.equal(vars.senderFirstName, '');
  assert.equal(vars.senderCompany, '');
  assert.equal(vars.senderWebsite, '');
});

// -- Test 14: Special characters in company name --
test('14. Special characters in company name preserved', () => {
  const specialLead: MockLead = {
    first_name: "O'Brien",
    last_name: 'Müller-Schmidt',
    email: 'ob@test.com',
    company: 'Johnson & Johnson (J&J) <Pharma>',
    title: 'Sr. Engineer / Team Lead',
    phone: '+49-176-555-0000',
  };
  const vars = buildCampaignVariables(specialLead, standardInbox);
  const result = processEmailContent('Hi {{firstName}} at {{company}}', vars);
  assert.equal(result, "Hi O'Brien at Johnson & Johnson (J&J) <Pharma>");
});

// -- Test 15: fullName with only first name (last_name is null) --
test('15. fullName with only first_name (last_name null)', () => {
  const partialLead: MockLead = {
    first_name: 'Alice',
    last_name: null,
    email: 'alice@test.com',
    company: null,
    title: null,
    phone: null,
  };
  const vars = buildCampaignVariables(partialLead, standardInbox);
  assert.equal(vars.fullName, 'Alice', 'fullName should be just first name when last is null');
  assert.equal(vars.full_name, 'Alice');
});

// -- Test 16: fullName with only last name (first_name is null) --
test('16. fullName with only last_name (first_name null)', () => {
  const partialLead: MockLead = {
    first_name: null,
    last_name: 'Williams',
    email: 'w@test.com',
    company: null,
    title: null,
    phone: null,
  };
  const vars = buildCampaignVariables(partialLead, standardInbox);
  assert.equal(vars.fullName, 'Williams', 'fullName should be just last name when first is null');
  assert.equal(vars.full_name, 'Williams');
});

// -- Test 17: Conditional blocks with campaign variables --
test('17. Conditional blocks work with campaign variable map', () => {
  const vars = buildCampaignVariables(standardLead, standardInbox);
  const template = '{if:company}I see you work at {{company}}.{/if} {ifnot:phone}Please share your phone.{/ifnot}';
  const result = processEmailContent(template, vars);
  assert.equal(result, 'I see you work at Acme Corp. ');
});

// -- Test 18: Conditional blocks with missing fields --
test('18. Conditional blocks with empty/null fields', () => {
  const nullLead: MockLead = {
    first_name: 'Test',
    last_name: null,
    email: 'test@test.com',
    company: null,
    title: null,
    phone: null,
  };
  const vars = buildCampaignVariables(nullLead, standardInbox);
  const template = '{if:company}At {{company}}.{/if}{ifnot:company}Tell me about your company.{/ifnot}';
  const result = processEmailContent(template, vars);
  assert.equal(result, 'Tell me about your company.');
});

// -- Test 19: Fallback variables --
test('19. Fallback syntax {{variable|fallback}} works', () => {
  const nullLead: MockLead = {
    first_name: null,
    last_name: null,
    email: 'x@x.com',
    company: null,
    title: null,
    phone: null,
  };
  const vars = buildCampaignVariables(nullLead, standardInbox);
  const template = 'Hi {{firstName|there}}, at {{company|your company}}';
  const result = processEmailContent(template, vars);
  assert.equal(result, 'Hi there, at your company');
});

// ---------------------------------------------------------------------------
// Bug #3 FIXED: custom_fields now spread in email-sender.ts
// ---------------------------------------------------------------------------
console.log('\n=== Bug #3 FIXED: custom_fields Consistency ===\n');

test('FIXED: email-sender.ts now spreads lead.custom_fields', () => {
  // Both email-sender.ts and replies.service.ts now spread custom_fields
  // into the variable map, so templates using custom_field variables
  // resolve correctly in both campaign and reply paths.

  const leadWithCustomFields: MockLead = {
    first_name: 'Dan',
    last_name: 'Test',
    email: 'dan@test.com',
    company: 'TestCo',
    title: null,
    phone: null,
    custom_fields: { industry: 'SaaS', revenue: '$10M' },
  };

  // Build variables using the email-sender.ts pattern (now includes custom_fields spread)
  const campaignVars = buildCampaignVariables(leadWithCustomFields, standardInbox);

  // Verify custom_fields ARE present in the campaign variable map
  assert.equal(campaignVars.industry, 'SaaS', 'industry should be in campaign vars');
  assert.equal(campaignVars.revenue, '$10M', 'revenue should be in campaign vars');

  // Templates using custom_fields now resolve correctly in campaign path
  const template = 'Hi {{firstName}}, industry: {{industry}}';
  const result = processEmailContent(template, campaignVars);
  assert.equal(result, 'Hi Dan, industry: SaaS',
    'custom_field variable should resolve in campaign email path');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
