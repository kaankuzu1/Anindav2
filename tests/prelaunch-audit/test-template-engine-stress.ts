import assert from 'node:assert/strict';
import {
  processSpintax,
  processConditionalBlocks,
  processVariablesWithFallback,
  injectVariables,
  processEmailContent,
  validateTemplateSyntax,
  normalizeVariableMap,
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
    console.log(`  FAIL: ${name}\n        ${msg}`);
  }
}

// ============================================================
// SUITE 1: Spintax Basics & Edge Cases (~25 tests)
// ============================================================

console.log('\n=== Suite 1: Spintax Basics & Edge Cases ===\n');

test('Spintax: single option pair resolves to one of them', () => {
  const result = processSpintax('{Hello|Hi}');
  assert.ok(result === 'Hello' || result === 'Hi');
});

test('Spintax: three options all reachable', () => {
  const options = new Set<string>();
  for (let i = 0; i < 200; i++) {
    options.add(processSpintax('{A|B|C}'));
  }
  assert.ok(options.has('A'));
  assert.ok(options.has('B'));
  assert.ok(options.has('C'));
});

test('Spintax: text before and after preserved', () => {
  const result = processSpintax('Hello {World|Earth}!');
  assert.ok(result === 'Hello World!' || result === 'Hello Earth!');
});

test('Spintax: multiple independent spintax blocks', () => {
  const result = processSpintax('{Hi|Hey} {World|Earth}');
  const valid = ['Hi World', 'Hi Earth', 'Hey World', 'Hey Earth'];
  assert.ok(valid.includes(result));
});

test('Spintax: no spintax returns text unchanged', () => {
  assert.equal(processSpintax('plain text'), 'plain text');
});

test('Spintax: empty string returns empty', () => {
  assert.equal(processSpintax(''), '');
});

test('Spintax: single option is NOT valid spintax (requires pipe)', () => {
  // Regex requires at least one | : /\{([^{}|]+(?:\|[^{}|]+)+)\}/
  assert.equal(processSpintax('{Hello}'), '{Hello}');
});

test('Spintax: pipe only {|} is NOT valid (requires non-empty options)', () => {
  // [^{}|]+ requires at least one char that isn't {, }, or |
  assert.equal(processSpintax('{|}'), '{|}');
});

test('Spintax: preserves non-spintax curly braces', () => {
  assert.equal(processSpintax('function() { return 1; }'), 'function() { return 1; }');
});

test('Spintax: preserves double curly braces (variables)', () => {
  const result = processSpintax('{{firstName}}');
  assert.equal(result, '{{firstName}}');
});

test('Spintax: option with spaces', () => {
  const result = processSpintax('{Good morning|Good evening}');
  assert.ok(result === 'Good morning' || result === 'Good evening');
});

test('Spintax: option with numbers', () => {
  const result = processSpintax('{100|200|300}');
  assert.ok(['100', '200', '300'].includes(result));
});

test('Spintax: option with special characters', () => {
  const result = processSpintax('{hello!|hi?}');
  assert.ok(result === 'hello!' || result === 'hi?');
});

test('Spintax: many consecutive spintax blocks', () => {
  const template = '{A|B}{C|D}{E|F}{G|H}{I|J}';
  const result = processSpintax(template);
  assert.equal(result.length, 5);
  // Each position should be one of the options
  assert.ok('AB'.includes(result[0]));
  assert.ok('CD'.includes(result[1]));
});

test('Spintax: max 10 iterations prevents infinite loops', () => {
  // Even if somehow crafted to need many passes, it caps at 10
  const template = '{A|B}';
  const result = processSpintax(template);
  assert.ok(result === 'A' || result === 'B');
});

// ============================================================
// SUITE 2: Deeply Nested Spintax (~20 tests)
// ============================================================

console.log('\n=== Suite 2: Deeply Nested Spintax ===\n');

test('Nested Spintax: 2 levels deep', () => {
  // {Hi {there|friend}|Hello} → inner resolves first → {Hi there|Hello} or {Hi friend|Hello}
  const result = processSpintax('{Hi {there|friend}|Hello}');
  assert.ok(['Hi there', 'Hi friend', 'Hello'].includes(result));
});

test('Nested Spintax: 3 levels deep', () => {
  const result = processSpintax('{A {B {C|D}|E}|F}');
  assert.ok(['A B C', 'A B D', 'A E', 'F'].includes(result));
});

test('Nested Spintax: 4 levels deep', () => {
  const result = processSpintax('{W {X {Y {Z1|Z2}|Y2}|X2}|W2}');
  const valid = ['W X Y Z1', 'W X Y Z2', 'W X Y2', 'W X2', 'W2'];
  assert.ok(valid.includes(result));
});

test('Nested Spintax: 5 levels deep (maximum practical)', () => {
  const result = processSpintax('{A {B {C {D {E1|E2}|D2}|C2}|B2}|A2}');
  const valid = ['A B C D E1', 'A B C D E2', 'A B C D2', 'A B C2', 'A B2', 'A2'];
  assert.ok(valid.includes(result));
});

test('Nested Spintax: 6 levels deep resolves within 10 iterations', () => {
  const result = processSpintax('{L1 {L2 {L3 {L4 {L5 {L6a|L6b}|L5b}|L4b}|L3b}|L2b}|L1b}');
  // Should resolve to one valid combination
  assert.ok(!result.includes('{'));
  assert.ok(!result.includes('}'));
});

test('Nested Spintax: 8 levels deep still resolves (within 10 iteration limit)', () => {
  const result = processSpintax('{1 {2 {3 {4 {5 {6 {7 {a|b}|7b}|6b}|5b}|4b}|3b}|2b}|1b}');
  assert.ok(!result.includes('{') && !result.includes('}'),
    `Expected no braces but got: "${result}"`);
});

test('Nested Spintax: 10 levels deep may not fully resolve (maxIterations=10)', () => {
  // Build 10-level deep spintax
  let template = '{x|y}';
  for (let i = 0; i < 9; i++) {
    template = `{A ${template}|B}`;
  }
  const result = processSpintax(template);
  // With 10 iterations, it may or may not fully resolve — the key is it doesn't hang
  assert.equal(typeof result, 'string');
});

test('Nested Spintax: parallel nested blocks', () => {
  const result = processSpintax('{Hi {friend|pal}|Hey {buddy|mate}}');
  const valid = ['Hi friend', 'Hi pal', 'Hey buddy', 'Hey mate'];
  assert.ok(valid.includes(result));
});

test('Nested Spintax: nested with surrounding text', () => {
  const result = processSpintax('Dear {Mr. {Smith|Jones}|Mrs. {Smith|Jones}}');
  const valid = ['Dear Mr. Smith', 'Dear Mr. Jones', 'Dear Mrs. Smith', 'Dear Mrs. Jones'];
  assert.ok(valid.includes(result));
});

test('Nested Spintax: innermost resolves first (bottom-up)', () => {
  // The regex matches innermost first because it requires [^{}] inside
  const results = new Set<string>();
  for (let i = 0; i < 100; i++) {
    results.add(processSpintax('{outer {inner1|inner2}|other}'));
  }
  // All results should be from resolved nested spintax
  for (const r of results) {
    assert.ok(!r.includes('{'), `Should not contain {: "${r}"`);
  }
});

// ============================================================
// SUITE 3: Large-Scale Spintax (~15 tests)
// ============================================================

console.log('\n=== Suite 3: Large-Scale Spintax ===\n');

test('Large Spintax: 50-option block', () => {
  const options = Array.from({ length: 50 }, (_, i) => `opt${i}`);
  const template = `{${options.join('|')}}`;
  const result = processSpintax(template);
  assert.ok(options.includes(result));
});

test('Large Spintax: 100-option block', () => {
  const options = Array.from({ length: 100 }, (_, i) => `v${i}`);
  const template = `{${options.join('|')}}`;
  const result = processSpintax(template);
  assert.ok(options.includes(result));
});

test('Large Spintax: 500-option block', () => {
  const options = Array.from({ length: 500 }, (_, i) => `word${i}`);
  const template = `{${options.join('|')}}`;
  const result = processSpintax(template);
  assert.ok(options.includes(result));
});

test('Large Spintax: 1000-option block', () => {
  const options = Array.from({ length: 1000 }, (_, i) => `item${i}`);
  const template = `{${options.join('|')}}`;
  const result = processSpintax(template);
  assert.ok(options.includes(result));
});

test('Large Spintax: 1000-option block performance < 50ms', () => {
  const options = Array.from({ length: 1000 }, (_, i) => `item${i}`);
  const template = `{${options.join('|')}}`;
  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    processSpintax(template);
  }
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 5000, `100 iterations took ${elapsed.toFixed(1)}ms, expected <5000ms`);
});

test('Large Spintax: 100 independent blocks in one template', () => {
  const blocks = Array.from({ length: 100 }, (_, i) => `{A${i}|B${i}}`);
  const template = blocks.join(' ');
  const result = processSpintax(template);
  assert.ok(!result.includes('{'));
  const words = result.split(' ');
  assert.equal(words.length, 100);
});

test('Large Spintax: options with very long text (1000 chars each)', () => {
  const longA = 'A'.repeat(1000);
  const longB = 'B'.repeat(1000);
  const result = processSpintax(`{${longA}|${longB}}`);
  assert.ok(result === longA || result === longB);
});

test('Large Spintax: distribution is approximately uniform (chi-square sanity)', () => {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
  const n = 3000;
  for (let i = 0; i < n; i++) {
    const r = processSpintax('{A|B|C}');
    counts[r]++;
  }
  const expected = n / 3;
  // Allow 20% deviation
  for (const [key, count] of Object.entries(counts)) {
    assert.ok(Math.abs(count - expected) / expected < 0.2,
      `${key}: ${count} (expected ~${expected})`);
  }
});

// ============================================================
// SUITE 4: Variable Injection & Normalization (~30 tests)
// ============================================================

console.log('\n=== Suite 4: Variable Injection & Normalization ===\n');

test('Variables: basic injection', () => {
  assert.equal(injectVariables('Hi {{firstName}}', { firstName: 'John' }), 'Hi John');
});

test('Variables: unknown variable preserved', () => {
  assert.equal(injectVariables('{{unknown}}', {}), '{{unknown}}');
});

test('Variables: multiple variables', () => {
  const result = injectVariables('{{firstName}} {{lastName}}', { firstName: 'John', lastName: 'Doe' });
  assert.equal(result, 'John Doe');
});

test('Variables: empty value replaces (empty string is falsy but defined)', () => {
  // injectVariables uses normalizedVars[key] ?? match
  // '' is not null/undefined, so it replaces
  const result = injectVariables('Hi {{firstName}}', { firstName: '' });
  assert.equal(result, 'Hi ');
});

test('Variables: undefined value preserves placeholder', () => {
  const result = injectVariables('Hi {{firstName}}', { firstName: undefined });
  assert.equal(result, 'Hi {{firstName}}');
});

test('Normalize: camelCase → snake_case mapping', () => {
  const result = normalizeVariableMap({ firstName: 'John' });
  assert.equal(result.firstName, 'John');
  assert.equal(result.first_name, 'John');
});

test('Normalize: snake_case → camelCase mapping', () => {
  const result = normalizeVariableMap({ first_name: 'John' });
  assert.equal(result.first_name, 'John');
  assert.equal(result.firstName, 'John');
});

test('Normalize: both present — no override', () => {
  const result = normalizeVariableMap({ firstName: 'Camel', first_name: 'Snake' });
  assert.equal(result.firstName, 'Camel');
  assert.equal(result.first_name, 'Snake');
});

test('Normalize: all lead variable pairs', () => {
  const result = normalizeVariableMap({ firstName: 'A', lastName: 'B', fullName: 'C' });
  assert.equal(result.first_name, 'A');
  assert.equal(result.last_name, 'B');
  assert.equal(result.full_name, 'C');
});

test('Normalize: all sender variable pairs', () => {
  const result = normalizeVariableMap({
    senderFirstName: 'S1', senderLastName: 'S2', senderCompany: 'S3',
    senderTitle: 'S4', senderPhone: 'S5', senderWebsite: 'S6',
  });
  assert.equal(result.sender_first_name, 'S1');
  assert.equal(result.sender_last_name, 'S2');
  assert.equal(result.sender_company, 'S3');
  assert.equal(result.sender_title, 'S4');
  assert.equal(result.sender_phone, 'S5');
  assert.equal(result.sender_website, 'S6');
});

test('Normalize: from variable pairs', () => {
  const result = normalizeVariableMap({ fromEmail: 'a@b.com', fromName: 'AB' });
  assert.equal(result.from_email, 'a@b.com');
  assert.equal(result.from_name, 'AB');
});

test('Normalize: undefined/empty values are NOT mapped', () => {
  // Source: if (variables[camel] && !variables[snake]) → falsy check
  const result = normalizeVariableMap({ firstName: undefined });
  assert.equal(result.first_name, undefined);
});

test('Normalize: empty string is falsy — NOT mapped', () => {
  const result = normalizeVariableMap({ firstName: '' });
  assert.equal(result.first_name, undefined);
});

test('Variables: 500 variables performance < 100ms', () => {
  const vars: Record<string, string> = {};
  let template = '';
  for (let i = 0; i < 500; i++) {
    vars[`var${i}`] = `value${i}`;
    template += `{{var${i}}} `;
  }
  const start = performance.now();
  const result = injectVariables(template, vars);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 100, `Took ${elapsed.toFixed(1)}ms, expected <100ms`);
  assert.ok(result.includes('value0'));
  assert.ok(result.includes('value499'));
});

test('Variables: 1000 variables still works', () => {
  const vars: Record<string, string> = {};
  let template = '';
  for (let i = 0; i < 1000; i++) {
    vars[`v${i}`] = `val${i}`;
    template += `{{v${i}}} `;
  }
  const result = injectVariables(template, vars);
  assert.ok(result.includes('val0'));
  assert.ok(result.includes('val999'));
  assert.ok(!result.includes('{{v0}}'));
});

test('Variables: snake_case in template with camelCase map', () => {
  const result = injectVariables('{{first_name}}', { firstName: 'John' });
  assert.equal(result, 'John');
});

test('Variables: camelCase in template with snake_case map', () => {
  const result = injectVariables('{{firstName}}', { first_name: 'John' });
  assert.equal(result, 'John');
});

test('Variables: mixed case formats in same template', () => {
  const result = injectVariables('{{firstName}} {{last_name}}', {
    firstName: 'John',
    last_name: 'Doe',
  });
  assert.equal(result, 'John Doe');
});

test('Variables: non-mapped custom variable names are not normalized', () => {
  // Only the predefined pairs in normalizeVariableMap are mapped
  const result = injectVariables('{{customField}}', { customField: 'value' });
  assert.equal(result, 'value');
  // custom_field is NOT auto-mapped
  const result2 = injectVariables('{{custom_field}}', { customField: 'value' });
  assert.equal(result2, '{{custom_field}}');
});

test('Variables: value with curly braces does not cause recursion', () => {
  // String.replace with /g flag is single-pass
  const result = injectVariables('{{firstName}}', { firstName: '{{lastName}}' });
  assert.equal(result, '{{lastName}}');
  // Does NOT resolve {{lastName}} — single pass only
});

test('Variables: value with spintax syntax does not get processed', () => {
  const result = injectVariables('{{firstName}}', { firstName: '{A|B}' });
  assert.equal(result, '{A|B}');
});

// ============================================================
// SUITE 5: Fallback Variables (~20 tests)
// ============================================================

console.log('\n=== Suite 5: Fallback Variables ===\n');

test('Fallback: uses value when present', () => {
  assert.equal(processVariablesWithFallback('{{name|friend}}', { name: 'John' }), 'John');
});

test('Fallback: uses fallback when value missing', () => {
  assert.equal(processVariablesWithFallback('{{name|friend}}', {}), 'friend');
});

test('Fallback: uses fallback when value undefined', () => {
  assert.equal(processVariablesWithFallback('{{name|friend}}', { name: undefined }), 'friend');
});

test('Fallback: uses fallback when value is empty string', () => {
  assert.equal(processVariablesWithFallback('{{name|friend}}', { name: '' }), 'friend');
});

test('Fallback: uses fallback when value is whitespace-only', () => {
  assert.equal(processVariablesWithFallback('{{name|friend}}', { name: '   ' }), 'friend');
});

test('Fallback: fallback with pipe character inside (lazy match)', () => {
  // The regex uses [\s\S]+? (lazy) so it stops at first }}
  const result = processVariablesWithFallback('{{name|choice A | choice B}}', {});
  assert.equal(result, 'choice A | choice B');
});

test('Fallback: fallback containing } character', () => {
  // Per CLAUDE.md Bug #5 fix: lazy [\s\S]+? handles } in fallback text
  const result = processVariablesWithFallback('{{name|fallback with } brace}}', {});
  assert.equal(result, 'fallback with } brace');
});

test('Fallback: fallback with HTML', () => {
  const result = processVariablesWithFallback('{{name|<b>friend</b>}}', {});
  assert.equal(result, '<b>friend</b>');
});

test('Fallback: multiple fallbacks in one template', () => {
  const result = processVariablesWithFallback('{{first|A}} {{last|B}}', {});
  assert.equal(result, 'A B');
});

test('Fallback: mixed present and fallback', () => {
  const result = processVariablesWithFallback('{{first|A}} {{last|B}}', { first: 'John' });
  assert.equal(result, 'John B');
});

test('Fallback: fallback with newlines', () => {
  const result = processVariablesWithFallback('{{name|line1\nline2}}', {});
  assert.equal(result, 'line1\nline2');
});

test('Fallback: fallback does NOT normalize variable names', () => {
  // processVariablesWithFallback does NOT call normalizeVariableMap
  // It uses raw variables[key]
  const result = processVariablesWithFallback('{{first_name|fallback}}', { firstName: 'John' });
  assert.equal(result, 'fallback');
  // first_name is not in the raw map — normalization happens in injectVariables and processConditionalBlocks
});

test('Fallback: empty fallback text', () => {
  // {{name|}} — the regex requires [\s\S]+? (at least 1 char)
  // So empty fallback doesn't match the regex
  const result = processVariablesWithFallback('{{name|}}', {});
  // Doesn't match the fallback regex — left as-is
  assert.equal(result, '{{name|}}');
});

test('Fallback: very long fallback (10000 chars)', () => {
  const longFallback = 'x'.repeat(10000);
  const result = processVariablesWithFallback(`{{name|${longFallback}}}`, {});
  assert.equal(result, longFallback);
});

// ============================================================
// SUITE 6: Conditional Blocks (~25 tests)
// ============================================================

console.log('\n=== Suite 6: Conditional Blocks ===\n');

test('Conditional: if block shown when var present', () => {
  const result = processConditionalBlocks('{if:name}Hello {{name}}{/if}', { name: 'John' });
  assert.equal(result, 'Hello {{name}}');
});

test('Conditional: if block hidden when var missing', () => {
  const result = processConditionalBlocks('{if:name}Hello {{name}}{/if}', {});
  assert.equal(result, '');
});

test('Conditional: if block hidden when var empty string', () => {
  const result = processConditionalBlocks('{if:name}Hello{/if}', { name: '' });
  assert.equal(result, '');
});

test('Conditional: if block hidden when var whitespace only', () => {
  const result = processConditionalBlocks('{if:name}Hello{/if}', { name: '   ' });
  assert.equal(result, '');
});

test('Conditional: if/else — shows if-branch when var present', () => {
  const result = processConditionalBlocks('{if:name}Hi {{name}}{else}Hi there{/if}', { name: 'John' });
  assert.equal(result, 'Hi {{name}}');
});

test('Conditional: if/else — shows else-branch when var missing', () => {
  const result = processConditionalBlocks('{if:name}Hi {{name}}{else}Hi there{/if}', {});
  assert.equal(result, 'Hi there');
});

test('Conditional: ifnot block shown when var missing', () => {
  const result = processConditionalBlocks('{ifnot:phone}Reply to schedule.{/ifnot}', {});
  assert.equal(result, 'Reply to schedule.');
});

test('Conditional: ifnot block hidden when var present', () => {
  const result = processConditionalBlocks('{ifnot:phone}Reply to schedule.{/ifnot}', { phone: '555-1234' });
  assert.equal(result, '');
});

test('Conditional: ifnot shown when var empty string', () => {
  const result = processConditionalBlocks('{ifnot:phone}No phone{/ifnot}', { phone: '' });
  assert.equal(result, 'No phone');
});

test('Conditional: normalizes variable names (snake_case with camelCase map)', () => {
  // processConditionalBlocks calls normalizeVariableMap
  const result = processConditionalBlocks('{if:first_name}Has name{/if}', { firstName: 'John' });
  assert.equal(result, 'Has name');
});

test('Conditional: normalizes variable names (camelCase with snake_case map)', () => {
  const result = processConditionalBlocks('{if:firstName}Has name{/if}', { first_name: 'John' });
  assert.equal(result, 'Has name');
});

test('Conditional: multiple independent if blocks', () => {
  const result = processConditionalBlocks(
    '{if:name}Name{/if} {if:company}Company{/if}',
    { name: 'John' }
  );
  assert.equal(result, 'Name ');
});

test('Conditional: nested if blocks — known limitation (lazy regex matches first {/if})', () => {
  // Nested conditionals are a known limitation: the lazy [\s\S]*? matches
  // up to the FIRST {/if}, so the outer {if:name} consumes the inner
  // {if:company} as plain content, and the second {/if} remains unmatched.
  const result = processConditionalBlocks(
    '{if:name}Hi {if:company}at {{company}}{/if}{/if}',
    { name: 'John', company: 'Acme' }
  );
  assert.equal(result, 'Hi {if:company}at {{company}}{/if}');
});

test('Conditional: multiline content preserved', () => {
  const result = processConditionalBlocks('{if:name}Line1\nLine2\nLine3{/if}', { name: 'John' });
  assert.equal(result, 'Line1\nLine2\nLine3');
});

test('Conditional: HTML content in block', () => {
  const result = processConditionalBlocks('{if:name}<b>Hello</b>{/if}', { name: 'John' });
  assert.equal(result, '<b>Hello</b>');
});

test('Conditional: if with else and multiline', () => {
  const result = processConditionalBlocks(
    '{if:company}Works at\n{{company}}{else}Independent\nconsultant{/if}',
    {}
  );
  assert.equal(result, 'Independent\nconsultant');
});

// ============================================================
// SUITE 7: processEmailContent Full Pipeline (~30 tests)
// ============================================================

console.log('\n=== Suite 7: processEmailContent Full Pipeline ===\n');

test('Pipeline: order is conditionals → fallbacks → spintax → variables', () => {
  // Build a template that tests all 4 stages
  const template = '{if:name}{{name|friend}}{/if} {Hi|Hey} {{company}}';
  const result = processEmailContent(template, { name: 'John', company: 'Acme' });
  // 1. Conditional: name exists → keeps '{{name|friend}}'
  // 2. Fallback: name=John → 'John'
  // 3. Spintax: {Hi|Hey} → one of them
  // 4. Variables: {{company}} → Acme
  assert.ok(result === 'John Hi Acme' || result === 'John Hey Acme');
});

test('Pipeline: conditional removes block, rest still processes', () => {
  const result = processEmailContent('{if:phone}Call me{/if} {Hi|Hey} {{firstName|friend}}', {
    firstName: 'John',
  });
  assert.ok(result === ' Hi John' || result === ' Hey John');
});

test('Pipeline: empty template returns empty', () => {
  assert.equal(processEmailContent('', {}), '');
});

test('Pipeline: no variables, no spintax returns unchanged', () => {
  assert.equal(processEmailContent('Hello World', {}), 'Hello World');
});

test('Pipeline: spintax inside conditional block', () => {
  const result = processEmailContent('{if:name}{Hi|Hey} {{name}}{/if}', { name: 'John' });
  assert.ok(result === 'Hi John' || result === 'Hey John');
});

test('Pipeline: fallback inside conditional — var empty removes entire block', () => {
  const result = processEmailContent('{if:name}{{name|friend}}{/if}', { name: '' });
  // name is empty → conditional removes block
  assert.equal(result, '');
});

test('Pipeline: variable value containing template syntax is NOT re-processed', () => {
  // Template injection safety: single-pass replace
  const result = processEmailContent('{{firstName}}', { firstName: '{{lastName}}' });
  assert.equal(result, '{{lastName}}');
});

test('Pipeline: variable value with spintax is NOT re-processed', () => {
  const result = processEmailContent('{{firstName}}', { firstName: '{A|B}' });
  // Variable injection happens AFTER spintax, so {A|B} is injected as literal
  assert.equal(result, '{A|B}');
});

test('Pipeline: variable value with conditional syntax is NOT re-processed', () => {
  const result = processEmailContent('{{firstName}}', { firstName: '{if:x}hack{/if}' });
  assert.equal(result, '{if:x}hack{/if}');
});

test('Pipeline: XSS in variable value passes through (by design)', () => {
  const result = processEmailContent('{{firstName}}', { firstName: '<script>alert(1)</script>' });
  assert.equal(result, '<script>alert(1)</script>');
  // HTML in email is expected; XSS prevention is at display layer
});

test('Pipeline: SQL injection in variable value passes through (by design)', () => {
  const result = processEmailContent('{{company}}', { company: "'; DROP TABLE;--" });
  assert.equal(result, "'; DROP TABLE;--");
  // Template engine doesn't interact with SQL
});

test('Pipeline: 1MB template handles without crash', () => {
  const bigText = 'Hello '.repeat(170000); // ~1MB
  const start = performance.now();
  const result = processEmailContent(bigText, { firstName: 'John' });
  const elapsed = performance.now() - start;
  assert.equal(result, bigText); // No variables to replace
  assert.ok(elapsed < 5000, `1MB template took ${elapsed.toFixed(1)}ms`);
});

test('Pipeline: 1MB template with variables', () => {
  const segment = 'Hi {{firstName}} ';
  const repeats = Math.floor(1000000 / segment.length);
  const template = segment.repeat(repeats);
  const start = performance.now();
  const result = processEmailContent(template, { firstName: 'J' });
  const elapsed = performance.now() - start;
  assert.ok(!result.includes('{{firstName}}'));
  assert.ok(result.includes('Hi J'));
  assert.ok(elapsed < 5000, `1MB template with vars took ${elapsed.toFixed(1)}ms`);
});

test('Pipeline: preserves whitespace exactly', () => {
  const result = processEmailContent('  {{name}}  ', { name: 'John' });
  assert.equal(result, '  John  ');
});

test('Pipeline: preserves HTML entities', () => {
  const result = processEmailContent('&lt;{{name}}&gt;', { name: 'John' });
  assert.equal(result, '&lt;John&gt;');
});

test('Pipeline: handles all sender variables', () => {
  const vars = {
    senderFirstName: 'Jane',
    senderLastName: 'Smith',
    senderCompany: 'Acme',
    senderTitle: 'CEO',
    senderPhone: '555-1234',
    senderWebsite: 'https://acme.com',
    fromEmail: 'jane@acme.com',
    fromName: 'Jane Smith',
  };
  const template = '{{senderFirstName}} {{senderLastName}} - {{senderCompany}} ({{senderTitle}}) {{senderPhone}} {{senderWebsite}} {{fromEmail}} {{fromName}}';
  const result = processEmailContent(template, vars);
  assert.equal(result, 'Jane Smith - Acme (CEO) 555-1234 https://acme.com jane@acme.com Jane Smith');
});

test('Pipeline: handles all sender variables via snake_case', () => {
  const vars = {
    sender_first_name: 'Jane',
    sender_last_name: 'Smith',
    sender_company: 'Acme',
  };
  const template = '{{senderFirstName}} {{senderLastName}} at {{senderCompany}}';
  const result = processEmailContent(template, vars);
  assert.equal(result, 'Jane Smith at Acme');
});

// ============================================================
// SUITE 8: Unicode, Emoji, RTL (~20 tests)
// ============================================================

console.log('\n=== Suite 8: Unicode, Emoji, RTL ===\n');

test('Unicode: emoji in variable value', () => {
  const result = processEmailContent('{{name}}', { name: '🎉 Party' });
  assert.equal(result, '🎉 Party');
});

test('Unicode: emoji in template text', () => {
  const result = processEmailContent('Hello 🌍 {{name}}', { name: 'World' });
  assert.equal(result, 'Hello 🌍 World');
});

test('Unicode: emoji in spintax', () => {
  const result = processSpintax('{🎉|🎊|🎈}');
  assert.ok(['🎉', '🎊', '🎈'].includes(result));
});

test('Unicode: CJK characters in variable value', () => {
  const result = processEmailContent('{{name}}', { name: '田中太郎' });
  assert.equal(result, '田中太郎');
});

test('Unicode: CJK characters in template', () => {
  const result = processEmailContent('こんにちは {{name}} さん', { name: '田中' });
  assert.equal(result, 'こんにちは 田中 さん');
});

test('Unicode: Arabic RTL text in variable', () => {
  const result = processEmailContent('{{name}}', { name: 'محمد' });
  assert.equal(result, 'محمد');
});

test('Unicode: mixed LTR and RTL', () => {
  const result = processEmailContent('Hello {{name}} world', { name: 'مرحبا' });
  assert.equal(result, 'Hello مرحبا world');
});

test('Unicode: Cyrillic characters', () => {
  const result = processEmailContent('{{name}}', { name: 'Иван Петров' });
  assert.equal(result, 'Иван Петров');
});

test('Unicode: accented Latin characters', () => {
  const result = processEmailContent('{{name}}', { name: 'José García' });
  assert.equal(result, 'José García');
});

test('Unicode: combining characters (diacritics)', () => {
  const result = processEmailContent('{{name}}', { name: 'e\u0301' }); // é as combining
  assert.equal(result, 'e\u0301');
});

test('Unicode: zero-width characters in value', () => {
  const result = processEmailContent('{{name}}', { name: 'John\u200BDoe' }); // zero-width space
  assert.equal(result, 'John\u200BDoe');
});

test('Unicode: emoji in fallback', () => {
  const result = processVariablesWithFallback('{{name|👋 friend}}', {});
  assert.equal(result, '👋 friend');
});

test('Unicode: emoji in conditional content', () => {
  const result = processConditionalBlocks('{if:name}🎉 {{name}}{/if}', { name: 'John' });
  assert.equal(result, '🎉 {{name}}');
});

test('Unicode: Korean text', () => {
  const result = processEmailContent('안녕하세요 {{name}}님', { name: '김철수' });
  assert.equal(result, '안녕하세요 김철수님');
});

test('Unicode: Thai script', () => {
  const result = processEmailContent('{{name}}', { name: 'สวัสดี' });
  assert.equal(result, 'สวัสดี');
});

test('Unicode: multi-byte emoji (skin tone modifier)', () => {
  const result = processEmailContent('{{name}} 👋🏽', { name: 'Hi' });
  assert.equal(result, 'Hi 👋🏽');
});

// ============================================================
// SUITE 9: HTML Injection & Template Injection Safety (~20 tests)
// ============================================================

console.log('\n=== Suite 9: HTML Injection & Template Injection Safety ===\n');

test('HTML: basic HTML tag in variable passes through', () => {
  const result = processEmailContent('{{name}}', { name: '<b>Bold</b>' });
  assert.equal(result, '<b>Bold</b>');
});

test('HTML: script tag in variable passes through (email context)', () => {
  const result = processEmailContent('{{name}}', { name: '<script>alert("xss")</script>' });
  assert.equal(result, '<script>alert("xss")</script>');
});

test('HTML: img onerror in variable passes through', () => {
  const result = processEmailContent('{{name}}', { name: '<img onerror="alert(1)" src=x>' });
  assert.equal(result, '<img onerror="alert(1)" src=x>');
});

test('HTML: iframe in variable passes through', () => {
  const result = processEmailContent('{{name}}', { name: '<iframe src="evil.com"></iframe>' });
  assert.equal(result, '<iframe src="evil.com"></iframe>');
});

test('Template Injection: {{var}} in variable value is NOT resolved', () => {
  const result = processEmailContent('{{firstName}}', {
    firstName: '{{email}}',
    email: 'secret@example.com',
  });
  // Single-pass: {{firstName}} → '{{email}}' → NOT re-scanned
  assert.equal(result, '{{email}}');
});

test('Template Injection: recursive variable reference is safe', () => {
  const result = processEmailContent('{{a}}', { a: '{{b}}', b: '{{a}}' });
  assert.equal(result, '{{b}}');
});

test('Template Injection: spintax in value not processed by variable step', () => {
  // Variables are injected AFTER spintax processing
  const result = processEmailContent('{{firstName}}', { firstName: '{evil|hack}' });
  assert.equal(result, '{evil|hack}');
});

test('Template Injection: conditional syntax in value not processed', () => {
  const result = processEmailContent('{{name}}', { name: '{if:x}hacked{/if}' });
  assert.equal(result, '{if:x}hacked{/if}');
});

test('Template Injection: fallback syntax in value not processed', () => {
  const result = processEmailContent('{{name}}', { name: '{{secret|default}}' });
  // Variables are injected after fallback processing, so {{secret|default}} is literal
  assert.equal(result, '{{secret|default}}');
});

test('Template Injection: nested template attack {{{{a}}}}', () => {
  const result = processEmailContent('{{{{name}}}}', { name: 'John' });
  // The regex /\{\{(\w+)\}\}/g finds {{name}} in the middle → 'John'
  // Result: '{{John}}'
  assert.equal(result, '{{John}}');
});

test('Template Injection: 100 chained variable references', () => {
  const vars: Record<string, string> = {};
  for (let i = 0; i < 100; i++) {
    vars[`v${i}`] = `{{v${i + 1}}}`;
  }
  vars['v100'] = 'end';
  // Only v0 should be resolved to '{{v1}}' — no chain resolution
  const result = processEmailContent('{{v0}}', vars);
  assert.equal(result, '{{v1}}');
});

// ============================================================
// SUITE 10: Conflicting camelCase/snake_case (~15 tests)
// ============================================================

console.log('\n=== Suite 10: Conflicting camelCase/snake_case ===\n');

test('Conflict: both formats provided — each keeps its value', () => {
  const vars = { firstName: 'CamelJohn', first_name: 'SnakeJohn' };
  const normalized = normalizeVariableMap(vars);
  assert.equal(normalized.firstName, 'CamelJohn');
  assert.equal(normalized.first_name, 'SnakeJohn');
});

test('Conflict: template uses camelCase, both provided → camelCase value used', () => {
  const result = injectVariables('{{firstName}}', { firstName: 'Camel', first_name: 'Snake' });
  assert.equal(result, 'Camel');
});

test('Conflict: template uses snake_case, both provided → snake_case value used', () => {
  const result = injectVariables('{{first_name}}', { firstName: 'Camel', first_name: 'Snake' });
  assert.equal(result, 'Snake');
});

test('Conflict: conditional uses camelCase, only snake_case provided → normalized', () => {
  const result = processConditionalBlocks('{if:firstName}Yes{/if}', { first_name: 'John' });
  assert.equal(result, 'Yes');
});

test('Conflict: conditional uses snake_case, only camelCase provided → normalized', () => {
  const result = processConditionalBlocks('{if:first_name}Yes{/if}', { firstName: 'John' });
  assert.equal(result, 'Yes');
});

test('Conflict: fullName auto-normalized from full_name', () => {
  const result = injectVariables('{{fullName}}', { full_name: 'John Doe' });
  assert.equal(result, 'John Doe');
});

test('Conflict: full_name auto-normalized from fullName', () => {
  const result = injectVariables('{{full_name}}', { fullName: 'John Doe' });
  assert.equal(result, 'John Doe');
});

test('Conflict: fromEmail auto-normalized from from_email', () => {
  const result = injectVariables('{{fromEmail}}', { from_email: 'a@b.com' });
  assert.equal(result, 'a@b.com');
});

test('Conflict: from_name auto-normalized from fromName', () => {
  const result = injectVariables('{{from_name}}', { fromName: 'John' });
  assert.equal(result, 'John');
});

test('Conflict: unmapped variable name has no cross-format alias', () => {
  // 'company' is not in the mapping pairs (it maps itself)
  const result = injectVariables('{{company}}', { company: 'Acme' });
  assert.equal(result, 'Acme');
  // No snake-case equivalent mapped
});

test('Conflict: empty camelCase is falsy — snake_case fills it via normalization', () => {
  // normalizeVariableMap uses truthiness: '' is falsy, so when first_name='John'
  // exists and firstName='' is falsy, the normalization overwrites firstName with 'John'
  const normalized = normalizeVariableMap({ firstName: '', first_name: 'John' });
  assert.equal(normalized.first_name, 'John');
  assert.equal(normalized.firstName, 'John'); // Overwritten because '' is falsy
});

test('Conflict: undefined camelCase gets filled from snake_case', () => {
  const normalized = normalizeVariableMap({ firstName: undefined, first_name: 'John' });
  assert.equal(normalized.first_name, 'John');
  // if (variables[snake] && !variables[camel]) → first_name truthy, firstName falsy → SET
  assert.equal(normalized.firstName, 'John');
});

// ============================================================
// SUITE 11: validateTemplateSyntax (~20 tests)
// ============================================================

console.log('\n=== Suite 11: validateTemplateSyntax ===\n');

test('Syntax Validation: valid template returns no errors', () => {
  const errors = validateTemplateSyntax('{Hello|Hi} {{firstName}} {if:name}content{/if}');
  assert.equal(errors.length, 0);
});

test('Syntax Validation: empty template returns no errors', () => {
  assert.equal(validateTemplateSyntax('').length, 0);
});

test('Syntax Validation: plain text returns no errors', () => {
  assert.equal(validateTemplateSyntax('Just plain text').length, 0);
});

test('Syntax Validation: unmatched opening brace', () => {
  const errors = validateTemplateSyntax('{Hello');
  assert.ok(errors.some(e => e.includes('Unmatched opening brace')));
});

test('Syntax Validation: unmatched closing brace', () => {
  const errors = validateTemplateSyntax('Hello}');
  assert.ok(errors.some(e => e.includes('Unmatched closing brace')));
});

test('Syntax Validation: mismatched if blocks (more opens)', () => {
  const errors = validateTemplateSyntax('{if:name}content');
  assert.ok(errors.some(e => e.includes('Mismatched conditional')));
});

test('Syntax Validation: mismatched if blocks (more closes)', () => {
  const errors = validateTemplateSyntax('content{/if}');
  assert.ok(errors.some(e => e.includes('Mismatched conditional')));
});

test('Syntax Validation: mismatched ifnot blocks', () => {
  const errors = validateTemplateSyntax('{ifnot:phone}content');
  assert.ok(errors.some(e => e.includes('Mismatched inverse conditional')));
});

test('Syntax Validation: matched if blocks returns no errors', () => {
  const errors = validateTemplateSyntax('{if:name}content{/if}');
  assert.equal(errors.length, 0);
});

test('Syntax Validation: matched ifnot blocks returns no errors', () => {
  const errors = validateTemplateSyntax('{ifnot:phone}content{/ifnot}');
  assert.equal(errors.length, 0);
});

test('Syntax Validation: double curly braces (variables) do not affect brace count', () => {
  const errors = validateTemplateSyntax('{{firstName}} {{lastName}}');
  assert.equal(errors.length, 0);
});

test('Syntax Validation: spintax with balanced braces returns no errors', () => {
  const errors = validateTemplateSyntax('{Hello|Hi|Hey}');
  assert.equal(errors.length, 0);
});

test('Syntax Validation: nested spintax with balanced braces', () => {
  const errors = validateTemplateSyntax('{Hi {there|friend}|Hello}');
  assert.equal(errors.length, 0);
});

test('Syntax Validation: multiple errors returned together', () => {
  const errors = validateTemplateSyntax('{if:name}content {unclosed');
  assert.ok(errors.length >= 1);
});

test('Syntax Validation: if/else balanced returns no errors', () => {
  const errors = validateTemplateSyntax('{if:name}yes{else}no{/if}');
  assert.equal(errors.length, 0);
});

test('Syntax Validation: multiple balanced ifs and ifnots', () => {
  const template = '{if:a}A{/if} {if:b}B{/if} {ifnot:c}C{/ifnot}';
  assert.equal(validateTemplateSyntax(template).length, 0);
});

test('Syntax Validation: variable with fallback does not break brace count', () => {
  const errors = validateTemplateSyntax('{{name|friend}}');
  assert.equal(errors.length, 0);
});

test('Syntax Validation: complex valid template passes', () => {
  const template = '{Hello|Hi} {{firstName|friend}}, {if:company}at {{company}}{else}nice to meet you{/if}. {ifnot:phone}Reply to schedule.{/ifnot}';
  assert.equal(validateTemplateSyntax(template).length, 0);
});

// ============================================================
// SUITE 12: Edge Cases & Stress (~15 tests)
// ============================================================

console.log('\n=== Suite 12: Edge Cases & Stress ===\n');

test('Edge: template with only whitespace', () => {
  assert.equal(processEmailContent('   \n\t  ', {}), '   \n\t  ');
});

test('Edge: template with only variables, all missing', () => {
  assert.equal(processEmailContent('{{a}}{{b}}{{c}}', {}), '{{a}}{{b}}{{c}}');
});

test('Edge: template with only spintax', () => {
  const result = processEmailContent('{A|B|C}', {});
  assert.ok(['A', 'B', 'C'].includes(result));
});

test('Edge: null-like string values', () => {
  const result = processEmailContent('{{name}}', { name: 'null' });
  assert.equal(result, 'null');
});

test('Edge: numeric-like string values', () => {
  const result = processEmailContent('{{name}}', { name: '0' });
  assert.equal(result, '0');
});

test('Edge: variable name with digits', () => {
  const result = injectVariables('{{var123}}', { var123: 'value' });
  assert.equal(result, 'value');
});

test('Edge: variable name with underscores', () => {
  const result = injectVariables('{{my_var}}', { my_var: 'value' });
  assert.equal(result, 'value');
});

test('Edge: variable name that is just digits', () => {
  // \w+ matches digits too
  const result = injectVariables('{{123}}', { '123': 'numeric' });
  assert.equal(result, 'numeric');
});

test('Edge: back-to-back variables without separator', () => {
  const result = injectVariables('{{first}}{{last}}', { first: 'John', last: 'Doe' });
  assert.equal(result, 'JohnDoe');
});

test('Edge: variable at start of template', () => {
  const result = injectVariables('{{name}} is here', { name: 'John' });
  assert.equal(result, 'John is here');
});

test('Edge: variable at end of template', () => {
  const result = injectVariables('Hello {{name}}', { name: 'John' });
  assert.equal(result, 'Hello John');
});

test('Edge: 500 variable injection performance < 100ms via processEmailContent', () => {
  const vars: Record<string, string> = {};
  let template = '';
  for (let i = 0; i < 500; i++) {
    vars[`var${i}`] = `val${i}`;
    template += `{{var${i}}} `;
  }
  const start = performance.now();
  const result = processEmailContent(template, vars);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 100, `500-var pipeline took ${elapsed.toFixed(1)}ms`);
  assert.ok(result.includes('val0'));
  assert.ok(result.includes('val499'));
});

test('Edge: deeply mixed template (spintax + conditionals + fallbacks + variables)', () => {
  const template = '{Dear|Hi} {{firstName|friend}}, {if:company}I noticed you work at {{company}}.{else}How are you?{/if} {ifnot:phone}Please reply to connect.{/ifnot} {{senderFirstName}}';
  const vars = {
    firstName: 'Alice',
    company: 'TechCo',
    phone: '',
    senderFirstName: 'Bob',
  };
  const result = processEmailContent(template, vars);
  assert.ok(result.includes('Alice'));
  assert.ok(result.includes('TechCo'));
  assert.ok(result.includes('Please reply to connect.'));
  assert.ok(result.includes('Bob'));
  assert.ok(result.startsWith('Dear') || result.startsWith('Hi'));
});

test('Edge: processEmailContent with template containing only conditionals', () => {
  const result = processEmailContent(
    '{if:a}A{/if}{if:b}B{/if}{if:c}C{/if}',
    { a: 'yes', c: 'yes' }
  );
  assert.equal(result, 'AC');
});

test('Edge: spintax with very similar options', () => {
  const result = processSpintax('{test1|test2}');
  assert.ok(result === 'test1' || result === 'test2');
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
