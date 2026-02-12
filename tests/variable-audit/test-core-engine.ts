import assert from 'node:assert/strict';
import {
  processSpintax,
  processConditionalBlocks,
  processVariablesWithFallback,
  injectVariables,
  processEmailContent,
  validateTemplateSyntax,
} from '../../packages/shared/src/utils';

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

// ============================================================
// 1. processSpintax
// ============================================================
console.log('\n--- processSpintax ---');

test('basic spintax returns one of the options', () => {
  const options = ['Hello', 'Hi', 'Hey'];
  const result = processSpintax('{Hello|Hi|Hey}');
  assert.ok(options.includes(result), `Expected one of ${options}, got "${result}"`);
});

test('no spintax passthrough', () => {
  assert.equal(processSpintax('plain text'), 'plain text');
});

test('spintax with single option returns that option', () => {
  // Single option without pipe should NOT be treated as spintax (regex requires at least one |)
  assert.equal(processSpintax('{Hello}'), '{Hello}');
});

test('multiple spintax blocks', () => {
  const result = processSpintax('{A|B} and {C|D}');
  assert.ok(
    ['A and C', 'A and D', 'B and C', 'B and D'].includes(result),
    `Unexpected: "${result}"`
  );
});

test('nested spintax', () => {
  // {Hi {there|friend}|Hello} — inner resolves first
  const result = processSpintax('{Hi {there|friend}|Hello}');
  assert.ok(
    ['Hi there', 'Hi friend', 'Hello'].includes(result),
    `Unexpected nested result: "${result}"`
  );
});

test('spintax preserves surrounding text', () => {
  const result = processSpintax('Start {A|B} end');
  assert.ok(
    result === 'Start A end' || result === 'Start B end',
    `Unexpected: "${result}"`
  );
});

test('deeply nested spintax resolves within 10 iterations', () => {
  // 3 levels of nesting
  const result = processSpintax('{a|{b|{c|d}}}');
  assert.ok(['a', 'b', 'c', 'd'].includes(result), `Unexpected deep nested: "${result}"`);
});

// ============================================================
// 2. processConditionalBlocks
// ============================================================
console.log('\n--- processConditionalBlocks ---');

test('{if:var} shows content when var present', () => {
  const result = processConditionalBlocks('{if:company}At {{company}}{/if}', { company: 'Acme' });
  assert.equal(result, 'At {{company}}');
});

test('{if:var} hides content when var missing', () => {
  const result = processConditionalBlocks('{if:company}At {{company}}{/if}', {});
  assert.equal(result, '');
});

test('{if:var} hides content when var is empty string', () => {
  const result = processConditionalBlocks('{if:company}At {{company}}{/if}', { company: '' });
  assert.equal(result, '');
});

test('{if:var} hides content when var is whitespace', () => {
  const result = processConditionalBlocks('{if:company}text{/if}', { company: '   ' });
  assert.equal(result, '');
});

test('{if:var}{else}{/if} shows else when var missing', () => {
  const result = processConditionalBlocks('{if:company}At {{company}}{else}No company{/if}', {});
  assert.equal(result, 'No company');
});

test('{if:var}{else}{/if} shows if-content when var present', () => {
  const result = processConditionalBlocks(
    '{if:company}At {{company}}{else}No company{/if}',
    { company: 'Acme' }
  );
  assert.equal(result, 'At {{company}}');
});

test('{ifnot:var} shows content when var missing', () => {
  const result = processConditionalBlocks('{ifnot:phone}No phone{/ifnot}', {});
  assert.equal(result, 'No phone');
});

test('{ifnot:var} hides content when var present', () => {
  const result = processConditionalBlocks('{ifnot:phone}No phone{/ifnot}', { phone: '555-1234' });
  assert.equal(result, '');
});

test('{ifnot:var} shows content when var is empty', () => {
  const result = processConditionalBlocks('{ifnot:phone}No phone{/ifnot}', { phone: '' });
  assert.equal(result, 'No phone');
});

test('multiple conditional blocks in one template', () => {
  const template = '{if:company}At {{company}}. {/if}{ifnot:phone}Reply here.{/ifnot}';
  const result = processConditionalBlocks(template, { company: 'Acme' });
  assert.equal(result, 'At {{company}}. Reply here.');
});

test('multiline content in conditional', () => {
  const template = '{if:company}Line1\nLine2{/if}';
  const result = processConditionalBlocks(template, { company: 'Acme' });
  assert.equal(result, 'Line1\nLine2');
});

// BUG #1 FIXED: processConditionalBlocks now normalizes variable names
test('BUG #1 FIXED: {if:first_name} works with camelCase-only variable map', () => {
  const result = processConditionalBlocks('{if:first_name}Hello{/if}', { firstName: 'John' });
  // Fixed: normalizeVariableMap adds first_name from firstName
  assert.equal(result, 'Hello');
});

test('BUG #1 FIXED: {ifnot:first_name} correctly hides content when camelCase key exists', () => {
  const result = processConditionalBlocks('{ifnot:first_name}Missing{/ifnot}', { firstName: 'John' });
  // Fixed: normalizeVariableMap adds first_name, so ifnot correctly sees it exists
  assert.equal(result, '');
});

test('BUG #1: {if:firstName} works with camelCase key (no normalization needed)', () => {
  const result = processConditionalBlocks('{if:firstName}Hello{/if}', { firstName: 'John' });
  assert.equal(result, 'Hello');
});

test('BUG #1 FIXED: {if:sender_company} works with camelCase-only map', () => {
  const result = processConditionalBlocks('{if:sender_company}At co{/if}', { senderCompany: 'Acme' });
  assert.equal(result, 'At co');
});

// ============================================================
// 3. processVariablesWithFallback
// ============================================================
console.log('\n--- processVariablesWithFallback ---');

test('fallback used when variable missing', () => {
  const result = processVariablesWithFallback('Hello {{firstName|there}}', {});
  assert.equal(result, 'Hello there');
});

test('fallback used when variable is empty string', () => {
  const result = processVariablesWithFallback('Hello {{firstName|there}}', { firstName: '' });
  assert.equal(result, 'Hello there');
});

test('fallback used when variable is whitespace', () => {
  const result = processVariablesWithFallback('Hello {{firstName|there}}', { firstName: '   ' });
  assert.equal(result, 'Hello there');
});

test('variable value used when present', () => {
  const result = processVariablesWithFallback('Hello {{firstName|there}}', { firstName: 'John' });
  assert.equal(result, 'Hello John');
});

test('multiple fallbacks in one template', () => {
  const result = processVariablesWithFallback(
    '{{firstName|Friend}} at {{company|your company}}',
    { firstName: 'Jane' }
  );
  assert.equal(result, 'Jane at your company');
});

test('fallback with spaces', () => {
  const result = processVariablesWithFallback('{{company|your company}}', {});
  assert.equal(result, 'your company');
});

// BUG #5 FIXED: Fallback regex now handles } in fallback text
test('BUG #5 FIXED: fallback with closing brace in fallback text', () => {
  // The regex is /\{\{(\w+)\|([\s\S]+?)\}\}/g — lazy match allows } in fallback
  const template = '{{company|default}}';
  const result = processVariablesWithFallback(template, {});
  assert.equal(result, 'default'); // This simple case works fine

  // Previously broken: fallback containing a }
  const bugTemplate = '{{company|use {braces} here}}';
  const bugResult = processVariablesWithFallback(bugTemplate, {});
  // Fixed: lazy [\s\S]+? matches past } to find the closing }}
  assert.equal(
    bugResult,
    'use {braces} here',
    'BUG #5 FIXED: fallback with } brace is now processed correctly'
  );
});

test('fallback does not apply to plain variable syntax', () => {
  // {{firstName}} (no pipe) should NOT be processed by fallback function
  const result = processVariablesWithFallback('Hello {{firstName}}', {});
  assert.equal(result, 'Hello {{firstName}}');
});

// ============================================================
// 4. injectVariables
// ============================================================
console.log('\n--- injectVariables ---');

test('inject basic variable', () => {
  assert.equal(injectVariables('Hi {{firstName}}', { firstName: 'John' }), 'Hi John');
});

test('unknown variable left as placeholder', () => {
  assert.equal(injectVariables('Hi {{unknown}}', {}), 'Hi {{unknown}}');
});

test('camelCase to snake_case normalization for firstName', () => {
  const result = injectVariables('Hi {{first_name}}', { firstName: 'John' });
  assert.equal(result, 'Hi John');
});

test('snake_case to camelCase normalization for first_name', () => {
  const result = injectVariables('Hi {{firstName}}', { first_name: 'John' });
  assert.equal(result, 'Hi John');
});

test('lastName normalization both directions', () => {
  assert.equal(injectVariables('{{last_name}}', { lastName: 'Doe' }), 'Doe');
  assert.equal(injectVariables('{{lastName}}', { last_name: 'Doe' }), 'Doe');
});

test('sender variable normalization: senderFirstName <-> sender_first_name', () => {
  assert.equal(
    injectVariables('{{sender_first_name}}', { senderFirstName: 'Alice' }),
    'Alice'
  );
  assert.equal(
    injectVariables('{{senderFirstName}}', { sender_first_name: 'Alice' }),
    'Alice'
  );
});

test('sender variable normalization: senderLastName <-> sender_last_name', () => {
  assert.equal(
    injectVariables('{{sender_last_name}}', { senderLastName: 'Smith' }),
    'Smith'
  );
  assert.equal(
    injectVariables('{{senderLastName}}', { sender_last_name: 'Smith' }),
    'Smith'
  );
});

test('sender variable normalization: senderCompany <-> sender_company', () => {
  assert.equal(
    injectVariables('{{sender_company}}', { senderCompany: 'ACME' }),
    'ACME'
  );
  assert.equal(
    injectVariables('{{senderCompany}}', { sender_company: 'ACME' }),
    'ACME'
  );
});

test('sender variable normalization: senderTitle <-> sender_title', () => {
  assert.equal(injectVariables('{{sender_title}}', { senderTitle: 'CEO' }), 'CEO');
  assert.equal(injectVariables('{{senderTitle}}', { sender_title: 'CEO' }), 'CEO');
});

test('sender variable normalization: senderPhone <-> sender_phone', () => {
  assert.equal(injectVariables('{{sender_phone}}', { senderPhone: '555' }), '555');
  assert.equal(injectVariables('{{senderPhone}}', { sender_phone: '555' }), '555');
});

test('sender variable normalization: senderWebsite <-> sender_website', () => {
  assert.equal(injectVariables('{{sender_website}}', { senderWebsite: 'x.com' }), 'x.com');
  assert.equal(injectVariables('{{senderWebsite}}', { sender_website: 'x.com' }), 'x.com');
});

test('non-normalized variables (email, company, title, phone) work directly', () => {
  const vars = { email: 'a@b.com', company: 'Co', title: 'Dev', phone: '123' };
  assert.equal(injectVariables('{{email}} {{company}} {{title}} {{phone}}', vars), 'a@b.com Co Dev 123');
});

test('fullName and fromEmail now normalized via normalizeVariableMap', () => {
  // normalizeVariableMap adds fullName↔full_name and fromEmail↔from_email mappings
  assert.equal(injectVariables('{{full_name}}', { fullName: 'John Doe' }), 'John Doe');
  assert.equal(injectVariables('{{from_email}}', { fromEmail: 'a@b.com' }), 'a@b.com');
});

test('multiple variables in one template', () => {
  const result = injectVariables(
    '{{firstName}} {{lastName}} at {{company}}',
    { firstName: 'John', lastName: 'Doe', company: 'Acme' }
  );
  assert.equal(result, 'John Doe at Acme');
});

test('undefined variable value leaves placeholder', () => {
  assert.equal(
    injectVariables('Hi {{firstName}}', { firstName: undefined }),
    'Hi {{firstName}}'
  );
});

// ============================================================
// 5. processEmailContent (full pipeline)
// ============================================================
console.log('\n--- processEmailContent ---');

test('full pipeline: conditionals + fallbacks + spintax + variables', () => {
  // Use a template with conditionals, fallback, and a variable
  // Spintax is random so we use a single option to be deterministic
  const template = '{if:company}At {{company}}. {/if}Hi {{firstName|there}}, {{lastName}}';
  const result = processEmailContent(template, { company: 'Acme', firstName: 'John', lastName: 'Doe' });
  assert.equal(result, 'At Acme. Hi John, Doe');
});

test('pipeline: conditional removes block, fallback fills in', () => {
  const template = '{if:company}At {{company}}. {/if}Hi {{firstName|friend}}';
  const result = processEmailContent(template, {});
  assert.equal(result, 'Hi friend');
});

test('pipeline: ifnot + variable injection', () => {
  const template = '{ifnot:phone}Reply to this email.{/ifnot} Regards, {{senderFirstName}}';
  const result = processEmailContent(template, { senderFirstName: 'Alice' });
  assert.equal(result, 'Reply to this email. Regards, Alice');
});

test('pipeline ordering: conditionals before fallbacks before variables', () => {
  // This tests that conditional blocks are evaluated first,
  // then fallback processing, then variable injection
  const template = '{if:firstName}Name: {{firstName}}{else}Name: {{firstName|Unknown}}{/if}';
  // With firstName missing: else branch chosen -> "Name: {{firstName|Unknown}}"
  // Then fallback: "Name: Unknown"
  const result = processEmailContent(template, {});
  assert.equal(result, 'Name: Unknown');
});

test('pipeline with snake_case normalization in injectVariables step', () => {
  // Conditional uses camelCase (works), variable uses snake_case (normalized by injectVariables)
  const template = '{if:firstName}Hi {{first_name}}{/if}';
  const result = processEmailContent(template, { firstName: 'Jane' });
  assert.equal(result, 'Hi Jane');
});

// ============================================================
// 6. validateTemplateSyntax
// ============================================================
console.log('\n--- validateTemplateSyntax ---');

test('valid template returns no errors', () => {
  const errors = validateTemplateSyntax('{Hello|Hi} {{firstName}}, {if:company}at {{company}}{/if}');
  assert.deepEqual(errors, []);
});

test('unmatched opening brace', () => {
  const errors = validateTemplateSyntax('{Hello|Hi} and {unclosed');
  assert.ok(errors.length > 0, 'Expected errors for unmatched opening brace');
  assert.ok(errors.some(e => e.includes('Unmatched opening brace')));
});

test('unmatched closing brace', () => {
  const errors = validateTemplateSyntax('text } more');
  assert.ok(errors.length > 0);
  assert.ok(errors.some(e => e.includes('Unmatched closing brace')));
});

test('mismatched if/endif count', () => {
  const errors = validateTemplateSyntax('{if:company}at company');
  assert.ok(errors.some(e => e.includes('Mismatched conditional')));
});

test('mismatched ifnot/endifnot count', () => {
  const errors = validateTemplateSyntax('{ifnot:phone}text');
  assert.ok(errors.some(e => e.includes('Mismatched inverse conditional')));
});

test('valid variable syntax passes', () => {
  const errors = validateTemplateSyntax('{{firstName}} {{company|fallback}}');
  assert.deepEqual(errors, []);
});

test('properly matched conditionals pass', () => {
  const errors = validateTemplateSyntax('{if:a}x{/if}{ifnot:b}y{/ifnot}');
  assert.deepEqual(errors, []);
});

// ============================================================
// Summary
// ============================================================
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failures.length > 0) {
  console.log('\nFailure details:');
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
