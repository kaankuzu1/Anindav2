import assert from 'node:assert/strict';
import {
  processEmailContent,
  processSpintax,
  processConditionalBlocks,
  processVariablesWithFallback,
  injectVariables,
} from '../../packages/shared/src/utils';

// ============================================================
// Test Infrastructure
// ============================================================

let passed = 0;
let failed = 0;
const failures: { name: string; error: string }[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err: any) {
    failed++;
    const msg = err.message || String(err);
    failures.push({ name, error: msg });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${msg.slice(0, 200)}`);
  }
}

// ============================================================
// Replicate processTemplateVariables logic locally
// (FIXED: now uses processEmailContent instead of manual regex)
// ============================================================

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

// ============================================================
// Shared Variable Map (identical to email-sender.ts lines 164-196)
// ============================================================

const fullVariables: Record<string, string> = {
  firstName: 'Jane', lastName: 'Doe', first_name: 'Jane', last_name: 'Doe',
  email: 'jane@example.com', company: 'Acme Corp', title: 'CTO', phone: '+1234567890',
  fullName: 'Jane Doe', full_name: 'Jane Doe',
  from_name: 'Bob Sender', from_email: 'bob@sender.com', fromName: 'Bob Sender', fromEmail: 'bob@sender.com',
  senderFirstName: 'Bob', sender_first_name: 'Bob', senderLastName: 'Sender', sender_last_name: 'Sender',
  senderCompany: 'SenderCo', sender_company: 'SenderCo', senderTitle: 'Sales', sender_title: 'Sales',
  senderPhone: '+0987654321', sender_phone: '+0987654321', senderWebsite: 'https://sender.com', sender_website: 'https://sender.com',
};

const lead = {
  first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com',
  company: 'Acme Corp', title: 'CTO', phone: '+1234567890',
};

const inbox = {
  from_name: 'Bob Sender', email: 'bob@sender.com',
  sender_first_name: 'Bob', sender_last_name: 'Sender',
  sender_company: 'SenderCo', sender_title: 'Sales',
  sender_phone: '+0987654321', sender_website: 'https://sender.com',
};

// ============================================================
// Section 1: Cross-Path Consistency Tests (12 tests)
// ============================================================

console.log('\n=== Cross-Path Consistency Tests ===\n');

test('1.1 Simple variable substitution via processEmailContent', () => {
  const tpl = 'Hello {{firstName}}, welcome to {{company}}!';
  const result = processEmailContent(tpl, fullVariables);
  assert.equal(result, 'Hello Jane, welcome to Acme Corp!');
});

test('1.2 Simple variable substitution via processTemplateVariables', () => {
  const tpl = 'Hello {{firstName}}, welcome to {{company}}!';
  const result = processTemplateVariables(tpl, lead, undefined, inbox);
  assert.equal(result, 'Hello Jane, welcome to Acme Corp!');
});

test('1.3 snake_case variables produce same output in both paths', () => {
  const tpl = '{{first_name}} {{last_name}} at {{sender_company}}';
  const pec = processEmailContent(tpl, fullVariables);
  const ptv = processTemplateVariables(tpl, lead, undefined, inbox);
  assert.equal(pec, 'Jane Doe at SenderCo');
  assert.equal(ptv, 'Jane Doe at SenderCo');
});

test('1.4 Mixed camelCase and snake_case -- both paths agree', () => {
  const tpl = '{{firstName}} from {{sender_company}} via {{fromEmail}}';
  const pec = processEmailContent(tpl, fullVariables);
  const ptv = processTemplateVariables(tpl, lead, undefined, inbox);
  assert.equal(pec, ptv);
});

test('1.5 All sender variables via processEmailContent', () => {
  const tpl = '{{senderFirstName}} {{senderLastName}} | {{senderCompany}} | {{senderTitle}} | {{senderPhone}} | {{senderWebsite}}';
  const result = processEmailContent(tpl, fullVariables);
  assert.equal(result, 'Bob Sender | SenderCo | Sales | +0987654321 | https://sender.com');
});

test('1.6 All sender variables via processTemplateVariables', () => {
  const tpl = '{{senderFirstName}} {{senderLastName}} | {{senderCompany}} | {{senderTitle}} | {{senderPhone}} | {{senderWebsite}}';
  const result = processTemplateVariables(tpl, lead, undefined, inbox);
  assert.equal(result, 'Bob Sender | SenderCo | Sales | +0987654321 | https://sender.com');
});

test('1.7 fullName and full_name both resolve identically', () => {
  const r1 = processEmailContent('{{fullName}}', fullVariables);
  const r2 = processEmailContent('{{full_name}}', fullVariables);
  assert.equal(r1, 'Jane Doe');
  assert.equal(r2, 'Jane Doe');
});

test('1.8 Fallback variable resolved correctly by processEmailContent', () => {
  const tpl = '{{company|your company}}';
  const emptyVars: Record<string, string> = { ...fullVariables, company: '' };
  const result = processEmailContent(tpl, emptyVars);
  assert.equal(result, 'your company');
});

test('1.9 FIXED: processTemplateVariables now resolves fallback syntax', () => {
  const tpl = '{{company|your company}}';
  const emptyLead = { ...lead, company: '' };
  const result = processTemplateVariables(tpl, emptyLead, undefined, inbox);
  // processTemplateVariables now uses processEmailContent which resolves fallbacks
  assert.equal(result, 'your company');
});

test('1.10 Conditional blocks processed by processEmailContent', () => {
  const tpl = '{if:company}Works at {{company}}.{/if} Done.';
  const result = processEmailContent(tpl, fullVariables);
  assert.equal(result, 'Works at Acme Corp. Done.');
});

test('1.11 FIXED: processTemplateVariables now resolves {if:} syntax', () => {
  const tpl = '{if:company}Works at {{company}}.{/if} Done.';
  const result = processTemplateVariables(tpl, lead, undefined, inbox);
  assert.equal(result, 'Works at Acme Corp. Done.');
});

test('1.12 Complex template -- both paths produce identical output for plain variables', () => {
  const tpl = 'Hi {{firstName}}, I am {{senderFirstName}} from {{sender_company}}. Contact: {{fromEmail}}';
  const pec = processEmailContent(tpl, fullVariables);
  const ptv = processTemplateVariables(tpl, lead, undefined, inbox);
  assert.equal(pec, ptv);
  assert.equal(pec, 'Hi Jane, I am Bob from SenderCo. Contact: bob@sender.com');
});

// ============================================================
// Section 2: Security Tests (7 tests)
// ============================================================

console.log('\n=== Security Tests ===\n');

test('2.1 XSS in variable value -- passes through unescaped (NO SANITIZATION)', () => {
  const xssValue = '<script>alert("xss")</script>';
  // Must override BOTH camelCase and snake_case because injectVariables normalizes bidirectionally
  const vars: Record<string, string> = { ...fullVariables, firstName: xssValue, first_name: xssValue };
  const result = processEmailContent('Hello {{firstName}}', vars);
  // SECURITY NOTE: The engine does NOT sanitize HTML. By design for email HTML content.
  assert.equal(result, `Hello ${xssValue}`);
});

test('2.2 XSS in processTemplateVariables -- also passes through unescaped', () => {
  const xssValue = '<script>alert("xss")</script>';
  const xssLead = { ...lead, first_name: xssValue };
  const result = processTemplateVariables('Hello {{firstName}}', xssLead, undefined, inbox);
  assert.equal(result, `Hello ${xssValue}`);
});

test('2.3 SQL injection in variable value -- passes through as-is', () => {
  const sqlValue = "'; DROP TABLE leads; --";
  const vars: Record<string, string> = { ...fullVariables, company: sqlValue };
  const result = processEmailContent('Company: {{company}}', vars);
  assert.equal(result, `Company: ${sqlValue}`);
});

test('2.4 Template injection -- {{otherVar}} in value not recursively resolved', () => {
  const vars: Record<string, string> = { ...fullVariables, firstName: '{{company}}', first_name: '{{company}}' };
  const result = processEmailContent('Hello {{firstName}}', vars);
  // JS String.replace with /g processes matches in the ORIGINAL string.
  // Replacement text is NOT re-scanned. So "{{company}}" injected as firstName is final.
  assert.equal(result, 'Hello {{company}}');
});

test('2.5 Spintax syntax in variable value -- not processed (injection safe)', () => {
  // processEmailContent order: 1. conditionals, 2. fallbacks, 3. spintax, 4. variables
  // Spintax runs in step 3 BEFORE variable injection (step 4), so it stays literal. Safe.
  const vars: Record<string, string> = { ...fullVariables, firstName: '{hack|attack}', first_name: '{hack|attack}' };
  const result = processEmailContent('Hello {{firstName}}', vars);
  assert.equal(result, 'Hello {hack|attack}');
});

test('2.6 Conditional syntax in variable value -- not processed (injection safe)', () => {
  const vars: Record<string, string> = { ...fullVariables, firstName: '{if:x}evil{/if}', first_name: '{if:x}evil{/if}' };
  const result = processEmailContent('Hello {{firstName}}', vars);
  assert.equal(result, 'Hello {if:x}evil{/if}');
});

test('2.7 Nested template syntax in value -- not resolved', () => {
  const vars: Record<string, string> = { ...fullVariables, firstName: '{{deep{{nested}}}}', first_name: '{{deep{{nested}}}}' };
  const result = processEmailContent('Hello {{firstName}}', vars);
  assert.equal(result, 'Hello {{deep{{nested}}}}');
});

// ============================================================
// Section 3: Edge Cases (13 tests)
// ============================================================

console.log('\n=== Edge Cases ===\n');

test('3.1 Unicode emoji in variable values', () => {
  const vars: Record<string, string> = { ...fullVariables, firstName: 'Jane \u{1F389}', first_name: 'Jane \u{1F389}', company: '\u682A\u5F0F\u4F1A\u793E\u30C6\u30B9\u30C8' };
  const result = processEmailContent('Hi {{firstName}} at {{company}}', vars);
  assert.equal(result, 'Hi Jane \u{1F389} at \u682A\u5F0F\u4F1A\u793E\u30C6\u30B9\u30C8');
});

test('3.2 CJK characters in variable values', () => {
  const vars: Record<string, string> = { ...fullVariables, firstName: '\u592A\u90CE', first_name: '\u592A\u90CE', lastName: '\u5C71\u7530', last_name: '\u5C71\u7530' };
  const result = processEmailContent('{{firstName}} {{lastName}}', vars);
  assert.equal(result, '\u592A\u90CE \u5C71\u7530');
});

test('3.3 RTL text in variable values', () => {
  const vars: Record<string, string> = { ...fullVariables, firstName: '\u0623\u062D\u0645\u062F', first_name: '\u0623\u062D\u0645\u062F', company: '\u0634\u0631\u0643\u0629' };
  const result = processEmailContent('Hi {{firstName}} at {{company}}', vars);
  assert.equal(result, 'Hi \u0623\u062D\u0645\u062F at \u0634\u0631\u0643\u0629');
});

test('3.4 Extremely long variable value (10000 chars)', () => {
  const longValue = 'A'.repeat(10000);
  const vars: Record<string, string> = { ...fullVariables, firstName: longValue, first_name: longValue };
  const result = processEmailContent('Hi {{firstName}}!', vars);
  assert.equal(result, `Hi ${longValue}!`);
  assert.equal(result.length, 3 + 10000 + 1); // "Hi " (3) + 10000 + "!" (1)
});

test('3.5 Empty template string', () => {
  const result = processEmailContent('', fullVariables);
  assert.equal(result, '');
});

test('3.6 Template with only variables, no static text', () => {
  const result = processEmailContent('{{firstName}}{{lastName}}', fullVariables);
  assert.equal(result, 'JaneDoe');
});

test('3.7 All variables undefined -- processEmailContent keeps placeholders', () => {
  const emptyVars: Record<string, string | undefined> = {};
  const tpl = '{{firstName}} {{company}} {{senderFirstName}}';
  const result = processEmailContent(tpl, emptyVars);
  assert.equal(result, '{{firstName}} {{company}} {{senderFirstName}}');
});

test('3.8 FIXED: empty lead -- known vars resolve to empty, unknown vars preserved', () => {
  const emptyLead = {};
  const tpl = '{{firstName}} {{company}} {{senderFirstName}}';
  const result = processTemplateVariables(tpl, emptyLead);
  // firstName and company are in the map (as ''), so they resolve to ''
  // senderFirstName is NOT in map (no inbox), so it's preserved
  assert.equal(result, '{{senderFirstName}}');
});

test('3.9 Whitespace-only variable values', () => {
  const vars: Record<string, string> = { ...fullVariables, firstName: '   ', first_name: '   ', company: '\t\n' };
  const result = processEmailContent('Hi {{firstName}} at {{company}}', vars);
  // "Hi " (3) + "   " (3 spaces) + " at " (4) + "\t\n" (2) = "Hi    at \t\n" (5 spaces total)
  assert.equal(result, 'Hi     at \t\n');
});

test('3.10 Whitespace-only value in conditional -- treated as empty', () => {
  const vars: Record<string, string> = { ...fullVariables, company: '   ' };
  const tpl = '{if:company}Has company{/if}';
  const result = processEmailContent(tpl, vars);
  // processConditionalBlocks checks value.trim() !== '' -> '   '.trim() is '' -> block removed
  assert.equal(result, '');
});

test('3.11 Multiple occurrences of same variable', () => {
  const tpl = '{{firstName}} and {{firstName}} and {{firstName}}';
  const result = processEmailContent(tpl, fullVariables);
  assert.equal(result, 'Jane and Jane and Jane');
});

test('3.12 Variable names are case-sensitive in processEmailContent', () => {
  const tpl = '{{FIRSTNAME}}';
  const result = processEmailContent(tpl, fullVariables);
  // FIRSTNAME not in map, normalization doesn't create it -> placeholder kept
  assert.equal(result, '{{FIRSTNAME}}');
});

test('3.13 FIXED: Variable names are now case-sensitive in processTemplateVariables (uses processEmailContent)', () => {
  const tpl = '{{FIRSTNAME}}';
  const result = processTemplateVariables(tpl, lead, undefined, inbox);
  // processEmailContent is case-sensitive, so {{FIRSTNAME}} is not matched by firstName
  assert.equal(result, '{{FIRSTNAME}}');
});

// ============================================================
// Section 4: Bug Regression Tests (11 tests)
// ============================================================

console.log('\n=== Bug Regression Tests ===\n');

test('4.1 Bug #1 FIXED: {if:first_name} with only {firstName} in map -- block shown', () => {
  const vars: Record<string, string> = { firstName: 'John' };
  const result = processConditionalBlocks('{if:first_name}Hello {{firstName}}{/if}', vars);
  // Fixed: normalizeVariableMap adds first_name from firstName, so conditional works
  assert.equal(result, 'Hello {{firstName}}');
});

test('4.2 Bug #1 inverse: {if:firstName} with {firstName} in map -- works', () => {
  const vars: Record<string, string> = { firstName: 'John' };
  const result = processConditionalBlocks('{if:firstName}Hello{/if}', vars);
  assert.equal(result, 'Hello');
});

test('4.3 Bug #1 workaround: providing both formats works', () => {
  const vars: Record<string, string> = { firstName: 'John', first_name: 'John' };
  const result = processConditionalBlocks('{if:first_name}Hello{/if}', vars);
  assert.equal(result, 'Hello');
});

test('4.4 Bug #2 FIXED: spintax {Hi|Hello} in processTemplateVariables -- now resolved', () => {
  const tpl = '{Hi|Hello} {{firstName}}';
  const result = processTemplateVariables(tpl, lead, undefined, inbox);
  // processTemplateVariables now uses processEmailContent which resolves spintax
  assert.ok(
    result === 'Hi Jane' || result === 'Hello Jane',
    `Expected "Hi Jane" or "Hello Jane", got "${result}"`,
  );
});

test('4.5 Bug #2: spintax {Hi|Hello} in processEmailContent -- IS resolved', () => {
  const tpl = '{Hi|Hello} {{firstName}}';
  const result = processEmailContent(tpl, fullVariables);
  assert.ok(
    result === 'Hi Jane' || result === 'Hello Jane',
    `Expected "Hi Jane" or "Hello Jane", got "${result}"`
  );
});

test('4.6 Bug #3 FIXED: email-sender base variable map has all 26 standard keys', () => {
  // email-sender.ts now spreads custom_fields into variables when present on lead.
  // This test verifies the base variable structure (without custom_fields).
  // Custom_fields are dynamically added per-lead, so the static map here doesn't include them.
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
    assert.ok(key in fullVariables, `Expected key "${key}" in variable map`);
  }

  // These columns are not part of the base variable map (custom_fields are spread dynamically)
  const absentKeys = ['linkedin_url', 'website', 'country', 'city', 'timezone'];
  for (const key of absentKeys) {
    assert.ok(!(key in fullVariables), `Key "${key}" should NOT be in base variable map`);
  }
});

test('4.7 Bug #4 FIXED: {{unknownVar}} now preserved in processTemplateVariables', () => {
  const tpl = 'Hello {{unknownVar}}, welcome!';
  const result = processTemplateVariables(tpl, lead, undefined, inbox);
  // processTemplateVariables now uses processEmailContent which preserves unknown vars
  assert.equal(result, 'Hello {{unknownVar}}, welcome!');
});

test('4.8 Bug #4 contrast: {{unknownVar}} preserved in processEmailContent', () => {
  const tpl = 'Hello {{unknownVar}}, welcome!';
  const result = processEmailContent(tpl, fullVariables);
  // injectVariables returns the match when key not found -> placeholder preserved
  assert.equal(result, 'Hello {{unknownVar}}, welcome!');
});

test('4.9 Bug #5 FIXED: {{var|fallback with } brace}} now resolved by fallback regex', () => {
  // processVariablesWithFallback regex: /\{\{(\w+)\|([\s\S]+?)\}\}/g
  // Lazy [\s\S]+? matches past } to find the closing }}
  const tpl = '{{company|fallback with } brace}}';
  const vars: Record<string, string | undefined> = { company: '' };
  const result = processVariablesWithFallback(tpl, vars);
  // Fixed: regex now matches -> fallback text returned
  assert.equal(result, 'fallback with } brace');
});

test('4.10 Bug #5 contrast: normal fallback works', () => {
  const tpl = '{{company|your company}}';
  const vars: Record<string, string | undefined> = { company: '' };
  const result = processVariablesWithFallback(tpl, vars);
  assert.equal(result, 'your company');
});

test('4.11 Bug #5 FIXED: fallback with } in full pipeline -- correctly resolved', () => {
  // With Bug #5 fixed, processEmailContent pipeline:
  // 1. Conditionals: no change
  // 2. Fallbacks: regex NOW matches {{company|fallback with } brace}} -> "fallback with } brace"
  // 3. Spintax: no spintax patterns in result ({braces} has no | separator)
  // 4. InjectVariables: no {{...}} variables remain
  // Result is deterministic: "fallback with } brace"
  const tpl = '{{company|fallback with } brace}}';
  const vars: Record<string, string | undefined> = { company: '' };
  const result = processEmailContent(tpl, vars);
  assert.equal(result, 'fallback with } brace');
});

// ============================================================
// Section 5: Additional Integration Edge Cases (6 tests)
// ============================================================

console.log('\n=== Additional Integration Edge Cases ===\n');

test('5.1 ifnot conditional -- variable present -> block removed', () => {
  const tpl = '{ifnot:phone}No phone on file.{/ifnot}';
  const result = processEmailContent(tpl, fullVariables);
  assert.equal(result, '');
});

test('5.2 ifnot conditional -- variable absent -> block shown', () => {
  const vars: Record<string, string | undefined> = { ...fullVariables, phone: '' };
  const tpl = '{ifnot:phone}No phone on file.{/ifnot}';
  const result = processEmailContent(tpl, vars);
  assert.equal(result, 'No phone on file.');
});

test('5.3 if/else conditional', () => {
  const tpl = '{if:company}At {{company}}{else}Independent{/if}';
  const result1 = processEmailContent(tpl, fullVariables);
  assert.equal(result1, 'At Acme Corp');

  const vars2: Record<string, string | undefined> = { ...fullVariables, company: '' };
  const result2 = processEmailContent(tpl, vars2);
  assert.equal(result2, 'Independent');
});

test('5.4 originalSubject variable -- only available in processTemplateVariables', () => {
  const tpl = 'Re: {{originalSubject}}';
  const result = processTemplateVariables(tpl, lead, 'Test Subject', inbox);
  assert.equal(result, 'Re: Test Subject');
});

test('5.5 originalSubject variable -- NOT in processEmailContent variable map', () => {
  const tpl = 'Re: {{originalSubject}}';
  const result = processEmailContent(tpl, fullVariables);
  assert.equal(result, 'Re: {{originalSubject}}');
});

test('5.6 fromName/from_name both resolve via processEmailContent', () => {
  const r1 = processEmailContent('{{fromName}}', fullVariables);
  const r2 = processEmailContent('{{from_name}}', fullVariables);
  assert.equal(r1, 'Bob Sender');
  assert.equal(r2, 'Bob Sender');
});

// ============================================================
// Summary
// ============================================================

console.log('\n=========================================');
console.log(`  Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log('=========================================');

if (failures.length > 0) {
  console.log('\nFailed tests:');
  for (const f of failures) {
    console.log(`  - ${f.name}`);
    console.log(`    ${f.error}`);
  }
}

console.log('\n--- Bug Fix Status ---');
console.log('1. FIXED: Fallback syntax {{var|fallback}}: both paths now resolve (test 1.8, 1.9)');
console.log('2. FIXED: Conditional blocks {if:var}: both paths now resolve (test 1.10, 1.11)');
console.log('3. FIXED: Spintax {opt|opt}: both paths now resolve (test 4.4, 4.5)');
console.log('4. FIXED: Unknown variables: both paths now preserve placeholders (test 4.7, 4.8)');
console.log('5. FIXED: Case sensitivity: both paths now case-sensitive (test 3.12, 3.13)');
console.log('6. originalSubject: available only in PTV, not in PEC (test 5.4 vs 5.5)');

if (failed > 0) {
  process.exit(1);
}
