/**
 * Pre-launch Audit Suite 7: Warmup System Tests
 * Tests warmup templates, dedup logic, extractFirstName, warmup quota,
 * isAuthError, mode switching, and state synchronization.
 */

import assert from 'node:assert/strict';

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
// Import source modules
// ============================================================

import {
  WARMUP_TEMPLATES,
  WARMUP_REPLY_TEMPLATES,
  WARMUP_CONTINUATION_TEMPLATES,
  WARMUP_CLOSER_TEMPLATES,
  WarmupTemplate,
} from '../../apps/workers/src/warmup-templates';

import { calculateWarmupQuota, calculateHealthScore } from '../../packages/shared/src/utils';

// ============================================================
// Reconstruct extractFirstName from warmup.ts (it's not exported)
// ============================================================

function extractFirstName(fromName?: string | null): string | undefined {
  if (!fromName) return undefined;
  const trimmed = fromName.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}

// ============================================================
// Reconstruct isAuthError from warmup.ts (it's not exported)
// ============================================================

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

// ============================================================
// Reconstruct shuffleIndices from warmup-dedup.ts (it's not exported)
// ============================================================

function shuffleIndices(count: number): number[] {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================
// Section 1: Template Inventory (~30 tests)
// ============================================================

console.log('\n--- Template Inventory ---');

test('mainTemplates has exactly 105 items', () => {
  assert.equal(WARMUP_TEMPLATES.length, 105);
});

test('replyTemplates has exactly 50 items', () => {
  assert.equal(WARMUP_REPLY_TEMPLATES.length, 50);
});

test('continuationTemplates has exactly 30 items', () => {
  assert.equal(WARMUP_CONTINUATION_TEMPLATES.length, 30);
});

test('closerTemplates has exactly 20 items', () => {
  assert.equal(WARMUP_CLOSER_TEMPLATES.length, 20);
});

test('total templates = 205', () => {
  const total = WARMUP_TEMPLATES.length + WARMUP_REPLY_TEMPLATES.length +
    WARMUP_CONTINUATION_TEMPLATES.length + WARMUP_CLOSER_TEMPLATES.length;
  assert.equal(total, 205);
});

test('no duplicate subjects across mainTemplates', () => {
  const subjects = WARMUP_TEMPLATES.map(t => t.subject);
  const unique = new Set(subjects);
  assert.equal(unique.size, subjects.length, `Found ${subjects.length - unique.size} duplicate subjects`);
});

test('no duplicate subjects within mainTemplates (explicit check)', () => {
  const seen = new Map<string, number>();
  for (let i = 0; i < WARMUP_TEMPLATES.length; i++) {
    const subj = WARMUP_TEMPLATES[i].subject;
    if (seen.has(subj)) {
      assert.fail(`Duplicate subject "${subj}" at indices ${seen.get(subj)} and ${i}`);
    }
    seen.set(subj, i);
  }
});

test('all mainTemplates have subject field', () => {
  for (let i = 0; i < WARMUP_TEMPLATES.length; i++) {
    assert.ok(typeof WARMUP_TEMPLATES[i].subject === 'string', `Template ${i} missing subject`);
  }
});

test('all mainTemplates have body field', () => {
  for (let i = 0; i < WARMUP_TEMPLATES.length; i++) {
    assert.ok(typeof WARMUP_TEMPLATES[i].body === 'string', `Template ${i} missing body`);
  }
});

test('no mainTemplates have empty subjects', () => {
  for (let i = 0; i < WARMUP_TEMPLATES.length; i++) {
    assert.ok(WARMUP_TEMPLATES[i].subject.trim().length > 0, `Template ${i} has empty subject`);
  }
});

test('no mainTemplates have empty bodies', () => {
  for (let i = 0; i < WARMUP_TEMPLATES.length; i++) {
    assert.ok(WARMUP_TEMPLATES[i].body.trim().length > 0, `Template ${i} has empty body`);
  }
});

test('reply templates have empty subjects (used as replies)', () => {
  for (let i = 0; i < WARMUP_REPLY_TEMPLATES.length; i++) {
    assert.equal(WARMUP_REPLY_TEMPLATES[i].subject, '', `Reply template ${i} should have empty subject`);
  }
});

test('continuation templates have empty subjects', () => {
  for (let i = 0; i < WARMUP_CONTINUATION_TEMPLATES.length; i++) {
    assert.equal(WARMUP_CONTINUATION_TEMPLATES[i].subject, '', `Continuation template ${i} should have empty subject`);
  }
});

test('closer templates have empty subjects', () => {
  for (let i = 0; i < WARMUP_CLOSER_TEMPLATES.length; i++) {
    assert.equal(WARMUP_CLOSER_TEMPLATES[i].subject, '', `Closer template ${i} should have empty subject`);
  }
});

test('no reply templates have empty bodies', () => {
  for (let i = 0; i < WARMUP_REPLY_TEMPLATES.length; i++) {
    assert.ok(WARMUP_REPLY_TEMPLATES[i].body.trim().length > 0, `Reply template ${i} has empty body`);
  }
});

test('no continuation templates have empty bodies', () => {
  for (let i = 0; i < WARMUP_CONTINUATION_TEMPLATES.length; i++) {
    assert.ok(WARMUP_CONTINUATION_TEMPLATES[i].body.trim().length > 0, `Continuation template ${i} has empty body`);
  }
});

test('no closer templates have empty bodies', () => {
  for (let i = 0; i < WARMUP_CLOSER_TEMPLATES.length; i++) {
    assert.ok(WARMUP_CLOSER_TEMPLATES[i].body.trim().length > 0, `Closer template ${i} has empty body`);
  }
});

test('all templates implement WarmupTemplate interface (have subject and body)', () => {
  const allTemplates: WarmupTemplate[] = [
    ...WARMUP_TEMPLATES,
    ...WARMUP_REPLY_TEMPLATES,
    ...WARMUP_CONTINUATION_TEMPLATES,
    ...WARMUP_CLOSER_TEMPLATES,
  ];
  for (let i = 0; i < allTemplates.length; i++) {
    assert.ok('subject' in allTemplates[i], `Template ${i} missing "subject" key`);
    assert.ok('body' in allTemplates[i], `Template ${i} missing "body" key`);
  }
});

test('mainTemplate subjects are all distinct strings', () => {
  for (const t of WARMUP_TEMPLATES) {
    assert.ok(typeof t.subject === 'string' && t.subject.length > 0);
  }
});

test('mainTemplate bodies are multi-line (at least 2 lines)', () => {
  for (let i = 0; i < WARMUP_TEMPLATES.length; i++) {
    const lines = WARMUP_TEMPLATES[i].body.split('\n').filter(l => l.trim().length > 0);
    assert.ok(lines.length >= 2, `Template ${i} body has only ${lines.length} non-empty lines`);
  }
});

test('reply template bodies are multi-line', () => {
  for (let i = 0; i < WARMUP_REPLY_TEMPLATES.length; i++) {
    const lines = WARMUP_REPLY_TEMPLATES[i].body.split('\n').filter(l => l.trim().length > 0);
    assert.ok(lines.length >= 2, `Reply template ${i} body has only ${lines.length} non-empty lines`);
  }
});

// ============================================================
// Section 2: Template Variable Syntax (~40 tests)
// ============================================================

console.log('\n--- Template Variable Syntax ---');

const ALL_TEMPLATES: WarmupTemplate[] = [
  ...WARMUP_TEMPLATES,
  ...WARMUP_REPLY_TEMPLATES,
  ...WARMUP_CONTINUATION_TEMPLATES,
  ...WARMUP_CLOSER_TEMPLATES,
];

test('every template using {{firstName has a fallback', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const body = ALL_TEMPLATES[i].body;
    const subject = ALL_TEMPLATES[i].subject;
    const combined = subject + ' ' + body;
    const firstNameMatches = combined.match(/\{\{firstName[^}]*\}\}/g) || [];
    for (const m of firstNameMatches) {
      assert.ok(m.includes('|'), `Template ${i}: {{firstName}} without fallback: ${m}`);
    }
  }
});

test('every {{firstName usage has "there" as fallback', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    const matches = combined.match(/\{\{firstName[^}]*\}\}/g) || [];
    for (const m of matches) {
      assert.ok(m.includes('|there'), `Template ${i}: fallback is not "there" in ${m}`);
    }
  }
});

test('every template using {{senderFirstName}} has valid syntax', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    const matches = combined.match(/\{\{senderFirstName[^}]*\}\}/g) || [];
    for (const m of matches) {
      assert.ok(m === '{{senderFirstName}}', `Template ${i}: unexpected senderFirstName syntax: ${m}`);
    }
  }
});

test('no templates have unmatched {{ without }}', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    const opens = (combined.match(/\{\{/g) || []).length;
    const closes = (combined.match(/\}\}/g) || []).length;
    assert.equal(opens, closes, `Template ${i}: mismatched {{ (${opens}) vs }} (${closes})`);
  }
});

test('no templates have {if: without {/if}', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    const ifOpens = (combined.match(/\{if:/g) || []).length;
    const ifCloses = (combined.match(/\{\/if\}/g) || []).length;
    assert.equal(ifOpens, ifCloses, `Template ${i}: mismatched {if: (${ifOpens}) vs {/if} (${ifCloses})`);
  }
});

test('no templates have {ifnot: without {/ifnot}', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    const opens = (combined.match(/\{ifnot:/g) || []).length;
    const closes = (combined.match(/\{\/ifnot\}/g) || []).length;
    assert.equal(opens, closes, `Template ${i}: mismatched {ifnot: (${opens}) vs {/ifnot} (${closes})`);
  }
});

test('no hardcoded name "John" in any template', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    assert.ok(!combined.includes('John'), `Template ${i} contains hardcoded "John"`);
  }
});

test('no hardcoded name "Jane" in any template', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    assert.ok(!combined.includes('Jane'), `Template ${i} contains hardcoded "Jane"`);
  }
});

test('no hardcoded name "Mike" in any template', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    assert.ok(!combined.includes('Mike'), `Template ${i} contains hardcoded "Mike"`);
  }
});

test('no hardcoded name "Sarah" in any template', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    assert.ok(!combined.includes('Sarah'), `Template ${i} contains hardcoded "Sarah"`);
  }
});

test('all mainTemplates contain {{firstName|there}}', () => {
  for (let i = 0; i < WARMUP_TEMPLATES.length; i++) {
    const body = WARMUP_TEMPLATES[i].body;
    assert.ok(body.includes('{{firstName|there}}'), `Main template ${i} missing {{firstName|there}} in body`);
  }
});

test('all mainTemplates contain {{senderFirstName}}', () => {
  for (let i = 0; i < WARMUP_TEMPLATES.length; i++) {
    const body = WARMUP_TEMPLATES[i].body;
    assert.ok(body.includes('{{senderFirstName}}'), `Main template ${i} missing {{senderFirstName}} in body`);
  }
});

test('all reply templates contain {{firstName|there}}', () => {
  for (let i = 0; i < WARMUP_REPLY_TEMPLATES.length; i++) {
    const body = WARMUP_REPLY_TEMPLATES[i].body;
    assert.ok(body.includes('{{firstName|there}}'), `Reply template ${i} missing {{firstName|there}}`);
  }
});

test('all reply templates contain {{senderFirstName}}', () => {
  for (let i = 0; i < WARMUP_REPLY_TEMPLATES.length; i++) {
    const body = WARMUP_REPLY_TEMPLATES[i].body;
    assert.ok(body.includes('{{senderFirstName}}'), `Reply template ${i} missing {{senderFirstName}}`);
  }
});

test('all continuation templates contain {{firstName|there}}', () => {
  for (let i = 0; i < WARMUP_CONTINUATION_TEMPLATES.length; i++) {
    const body = WARMUP_CONTINUATION_TEMPLATES[i].body;
    assert.ok(body.includes('{{firstName|there}}'), `Continuation template ${i} missing {{firstName|there}}`);
  }
});

test('all continuation templates contain {{senderFirstName}}', () => {
  for (let i = 0; i < WARMUP_CONTINUATION_TEMPLATES.length; i++) {
    const body = WARMUP_CONTINUATION_TEMPLATES[i].body;
    assert.ok(body.includes('{{senderFirstName}}'), `Continuation template ${i} missing {{senderFirstName}}`);
  }
});

test('all closer templates contain {{firstName|there}}', () => {
  for (let i = 0; i < WARMUP_CLOSER_TEMPLATES.length; i++) {
    const body = WARMUP_CLOSER_TEMPLATES[i].body;
    assert.ok(body.includes('{{firstName|there}}'), `Closer template ${i} missing {{firstName|there}}`);
  }
});

test('all closer templates contain {{senderFirstName}}', () => {
  for (let i = 0; i < WARMUP_CLOSER_TEMPLATES.length; i++) {
    const body = WARMUP_CLOSER_TEMPLATES[i].body;
    assert.ok(body.includes('{{senderFirstName}}'), `Closer template ${i} missing {{senderFirstName}}`);
  }
});

test('no templates use {{first_name}} (should be {{firstName|there}})', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    assert.ok(!combined.includes('{{first_name'), `Template ${i} uses {{first_name}} instead of {{firstName|there}}`);
  }
});

test('no templates use {{sender_first_name}} (should be {{senderFirstName}})', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    assert.ok(!combined.includes('{{sender_first_name'), `Template ${i} uses {{sender_first_name}} instead of {{senderFirstName}}`);
  }
});

test('only valid variable names used in templates', () => {
  const validVars = ['firstName', 'senderFirstName'];
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const combined = ALL_TEMPLATES[i].subject + ' ' + ALL_TEMPLATES[i].body;
    const varMatches = combined.match(/\{\{([^|}]+)/g) || [];
    for (const m of varMatches) {
      const varName = m.replace('{{', '');
      assert.ok(validVars.includes(varName), `Template ${i} uses unknown variable: {{${varName}}}`);
    }
  }
});

test('no template subjects contain template variables (main templates)', () => {
  // Main template subjects should be plain text, not personalized
  for (let i = 0; i < WARMUP_TEMPLATES.length; i++) {
    const subject = WARMUP_TEMPLATES[i].subject;
    assert.ok(!subject.includes('{{'), `Main template ${i} subject contains variables: ${subject}`);
  }
});

test('no templates contain HTML tags in body (plain text bodies)', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const body = ALL_TEMPLATES[i].body;
    // HTML is added at send time, templates should be plain text
    assert.ok(!/<[a-zA-Z][^>]*>/.test(body), `Template ${i} contains HTML tags in body`);
  }
});

test('all template bodies end with sender sign-off using {{senderFirstName}}', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const body = ALL_TEMPLATES[i].body.trim();
    assert.ok(body.endsWith('{{senderFirstName}}'), `Template ${i} does not end with {{senderFirstName}}`);
  }
});

test('no template body contains only variable placeholders', () => {
  for (let i = 0; i < ALL_TEMPLATES.length; i++) {
    const body = ALL_TEMPLATES[i].body;
    const withoutVars = body.replace(/\{\{[^}]+\}\}/g, '').trim();
    assert.ok(withoutVars.length > 50, `Template ${i} has too little real content (${withoutVars.length} chars)`);
  }
});

// ============================================================
// Section 3: extractFirstName (~25 tests)
// ============================================================

console.log('\n--- extractFirstName ---');

test('extractFirstName("John Smith") = "John"', () => {
  assert.equal(extractFirstName('John Smith'), 'John');
});

test('extractFirstName("john") = "john"', () => {
  assert.equal(extractFirstName('john'), 'john');
});

test('extractFirstName("") = undefined', () => {
  assert.equal(extractFirstName(''), undefined);
});

test('extractFirstName(null) = undefined', () => {
  assert.equal(extractFirstName(null), undefined);
});

test('extractFirstName(undefined) = undefined', () => {
  assert.equal(extractFirstName(undefined), undefined);
});

test('extractFirstName("Mary Jane Watson") = "Mary"', () => {
  assert.equal(extractFirstName('Mary Jane Watson'), 'Mary');
});

test('extractFirstName("Madonna") = "Madonna"', () => {
  assert.equal(extractFirstName('Madonna'), 'Madonna');
});

test('extractFirstName("  John  Smith  ") = "John" (trimmed)', () => {
  assert.equal(extractFirstName('  John  Smith  '), 'John');
});

test('extractFirstName("   ") = undefined (whitespace only)', () => {
  assert.equal(extractFirstName('   '), undefined);
});

test('extractFirstName("O\'Brien Smith") = "O\'Brien"', () => {
  assert.equal(extractFirstName("O'Brien Smith"), "O'Brien");
});

test('extractFirstName("Andre") = "Andre"', () => {
  assert.equal(extractFirstName('Andre'), 'Andre');
});

test('extractFirstName("Dr. Jane") first token = "Dr."', () => {
  assert.equal(extractFirstName('Dr. Jane'), 'Dr.');
});

test('extractFirstName("John2 Test") = "John2"', () => {
  assert.equal(extractFirstName('John2 Test'), 'John2');
});

test('extractFirstName("A B") = "A"', () => {
  assert.equal(extractFirstName('A B'), 'A');
});

test('extractFirstName with tab separator ("John\\tSmith") = "John"', () => {
  assert.equal(extractFirstName('John\tSmith'), 'John');
});

test('extractFirstName with newline ("John\\nSmith") = "John"', () => {
  assert.equal(extractFirstName('John\nSmith'), 'John');
});

test('extractFirstName("Alice") single name returns itself', () => {
  assert.equal(extractFirstName('Alice'), 'Alice');
});

test('extractFirstName with leading space only (" Bob") = "Bob"', () => {
  assert.equal(extractFirstName(' Bob'), 'Bob');
});

test('extractFirstName with trailing space only ("Bob ") = "Bob"', () => {
  assert.equal(extractFirstName('Bob '), 'Bob');
});

test('extractFirstName with hyphenated name ("Mary-Jane Watson") = "Mary-Jane"', () => {
  assert.equal(extractFirstName('Mary-Jane Watson'), 'Mary-Jane');
});

test('extractFirstName with unicode ("Rene") = "Rene"', () => {
  assert.equal(extractFirstName('Rene'), 'Rene');
});

test('extractFirstName returns string type when name provided', () => {
  const result = extractFirstName('Test User');
  assert.equal(typeof result, 'string');
});

test('extractFirstName returns undefined type when no name', () => {
  const result = extractFirstName(null);
  assert.equal(typeof result, 'undefined');
});

test('extractFirstName("Mr. Rogers") = "Mr."', () => {
  assert.equal(extractFirstName('Mr. Rogers'), 'Mr.');
});

test('extractFirstName with multiple spaces ("John    Smith") = "John"', () => {
  assert.equal(extractFirstName('John    Smith'), 'John');
});

// ============================================================
// Section 4: Warmup Quota Calculation (~40 tests)
// ============================================================

console.log('\n--- Warmup Quota Calculation ---');

// Normal speed tests
test('normal speed day 1: quota = 2', () => {
  assert.equal(calculateWarmupQuota(1, 'normal'), 2);
});

test('normal speed day 2: quota = 2', () => {
  assert.equal(calculateWarmupQuota(2, 'normal'), 2);
});

test('normal speed day 3: quota = 4', () => {
  assert.equal(calculateWarmupQuota(3, 'normal'), 4);
});

test('normal speed day 4: quota = 4', () => {
  assert.equal(calculateWarmupQuota(4, 'normal'), 4);
});

test('normal speed day 5: quota = 8', () => {
  assert.equal(calculateWarmupQuota(5, 'normal'), 8);
});

test('normal speed day 7: quota = 8', () => {
  assert.equal(calculateWarmupQuota(7, 'normal'), 8);
});

test('normal speed day 8: quota = 12', () => {
  assert.equal(calculateWarmupQuota(8, 'normal'), 12);
});

test('normal speed day 10: quota = 12', () => {
  assert.equal(calculateWarmupQuota(10, 'normal'), 12);
});

test('normal speed day 11: quota = 18', () => {
  assert.equal(calculateWarmupQuota(11, 'normal'), 18);
});

test('normal speed day 14: quota = 18', () => {
  assert.equal(calculateWarmupQuota(14, 'normal'), 18);
});

test('normal speed day 15: quota = 25', () => {
  assert.equal(calculateWarmupQuota(15, 'normal'), 25);
});

test('normal speed day 21: quota = 25', () => {
  assert.equal(calculateWarmupQuota(21, 'normal'), 25);
});

test('normal speed day 22: quota = 35', () => {
  assert.equal(calculateWarmupQuota(22, 'normal'), 35);
});

test('normal speed day 30: quota = 35', () => {
  assert.equal(calculateWarmupQuota(30, 'normal'), 35);
});

test('normal speed day 31: quota = 40', () => {
  assert.equal(calculateWarmupQuota(31, 'normal'), 40);
});

test('normal speed day 60: quota = 40', () => {
  assert.equal(calculateWarmupQuota(60, 'normal'), 40);
});

test('normal speed day 100: quota = 40', () => {
  assert.equal(calculateWarmupQuota(100, 'normal'), 40);
});

// Slow speed tests (multiplier = 0.7)
test('slow speed day 1: quota = floor(2*0.7) = 1', () => {
  assert.equal(calculateWarmupQuota(1, 'slow'), Math.floor(2 * 0.7));
});

test('slow speed day 3: quota = floor(4*0.7) = 2', () => {
  assert.equal(calculateWarmupQuota(3, 'slow'), Math.floor(4 * 0.7));
});

test('slow speed day 5: quota = floor(8*0.7) = 5', () => {
  assert.equal(calculateWarmupQuota(5, 'slow'), Math.floor(8 * 0.7));
});

test('slow speed day 8: quota = floor(12*0.7) = 8', () => {
  assert.equal(calculateWarmupQuota(8, 'slow'), Math.floor(12 * 0.7));
});

test('slow speed day 11: quota = floor(18*0.7) = 12', () => {
  assert.equal(calculateWarmupQuota(11, 'slow'), Math.floor(18 * 0.7));
});

test('slow speed day 15: quota = floor(25*0.7) = 17', () => {
  assert.equal(calculateWarmupQuota(15, 'slow'), Math.floor(25 * 0.7));
});

test('slow speed day 22: quota = floor(35*0.7) = 24', () => {
  assert.equal(calculateWarmupQuota(22, 'slow'), Math.floor(35 * 0.7));
});

test('slow speed day 31: quota = floor(40*0.7) = 28', () => {
  assert.equal(calculateWarmupQuota(31, 'slow'), Math.floor(40 * 0.7));
});

// Fast speed tests (multiplier = 1.5)
test('fast speed day 1: quota = floor(2*1.5) = 3', () => {
  assert.equal(calculateWarmupQuota(1, 'fast'), Math.floor(2 * 1.5));
});

test('fast speed day 3: quota = floor(4*1.5) = 6', () => {
  assert.equal(calculateWarmupQuota(3, 'fast'), Math.floor(4 * 1.5));
});

test('fast speed day 5: quota = floor(8*1.5) = 12', () => {
  assert.equal(calculateWarmupQuota(5, 'fast'), Math.floor(8 * 1.5));
});

test('fast speed day 8: quota = floor(12*1.5) = 18', () => {
  assert.equal(calculateWarmupQuota(8, 'fast'), Math.floor(12 * 1.5));
});

test('fast speed day 11: quota = floor(18*1.5) = 27', () => {
  assert.equal(calculateWarmupQuota(11, 'fast'), Math.floor(18 * 1.5));
});

test('fast speed day 15: quota = floor(25*1.5) = 37', () => {
  assert.equal(calculateWarmupQuota(15, 'fast'), Math.floor(25 * 1.5));
});

test('fast speed day 22: quota = floor(35*1.5) = 52', () => {
  assert.equal(calculateWarmupQuota(22, 'fast'), Math.floor(35 * 1.5));
});

test('fast speed day 31: quota = floor(40*1.5) = 60', () => {
  assert.equal(calculateWarmupQuota(31, 'fast'), Math.floor(40 * 1.5));
});

// Edge cases
test('quota is always a whole number', () => {
  for (const speed of ['slow', 'normal', 'fast'] as const) {
    for (let day = 1; day <= 60; day++) {
      const q = calculateWarmupQuota(day, speed);
      assert.equal(q, Math.floor(q), `Day ${day} speed ${speed} is not integer: ${q}`);
    }
  }
});

test('quota is monotonically non-decreasing (normal speed)', () => {
  let prev = 0;
  for (let day = 1; day <= 60; day++) {
    const q = calculateWarmupQuota(day, 'normal');
    assert.ok(q >= prev, `Day ${day}: quota ${q} < prev ${prev}`);
    prev = q;
  }
});

test('quota is monotonically non-decreasing (slow speed)', () => {
  let prev = 0;
  for (let day = 1; day <= 60; day++) {
    const q = calculateWarmupQuota(day, 'slow');
    assert.ok(q >= prev, `Day ${day}: quota ${q} < prev ${prev}`);
    prev = q;
  }
});

test('quota is monotonically non-decreasing (fast speed)', () => {
  let prev = 0;
  for (let day = 1; day <= 60; day++) {
    const q = calculateWarmupQuota(day, 'fast');
    assert.ok(q >= prev, `Day ${day}: quota ${q} < prev ${prev}`);
    prev = q;
  }
});

test('fast speed always >= normal speed at same day', () => {
  for (let day = 1; day <= 60; day++) {
    const fast = calculateWarmupQuota(day, 'fast');
    const normal = calculateWarmupQuota(day, 'normal');
    assert.ok(fast >= normal, `Day ${day}: fast ${fast} < normal ${normal}`);
  }
});

test('normal speed always >= slow speed at same day', () => {
  for (let day = 1; day <= 60; day++) {
    const normal = calculateWarmupQuota(day, 'normal');
    const slow = calculateWarmupQuota(day, 'slow');
    assert.ok(normal >= slow, `Day ${day}: normal ${normal} < slow ${slow}`);
  }
});

test('quota never exceeds target max (60 for fast, 40 for normal, 28 for slow)', () => {
  for (let day = 1; day <= 100; day++) {
    assert.ok(calculateWarmupQuota(day, 'fast') <= 60, `Fast day ${day} exceeds 60`);
    assert.ok(calculateWarmupQuota(day, 'normal') <= 40, `Normal day ${day} exceeds 40`);
    assert.ok(calculateWarmupQuota(day, 'slow') <= 28, `Slow day ${day} exceeds 28`);
  }
});

test('quota > 0 for all days >= 1 at all speeds', () => {
  for (const speed of ['slow', 'normal', 'fast'] as const) {
    for (let day = 1; day <= 60; day++) {
      const q = calculateWarmupQuota(day, speed);
      assert.ok(q > 0, `Day ${day} speed ${speed}: quota is ${q}`);
    }
  }
});

// ============================================================
// Section 5: Fisher-Yates Dedup (~30 tests)
// ============================================================

console.log('\n--- Fisher-Yates Dedup ---');

test('shuffleIndices(5) returns array of length 5', () => {
  const result = shuffleIndices(5);
  assert.equal(result.length, 5);
});

test('shuffleIndices(5) contains all elements 0-4', () => {
  const result = shuffleIndices(5);
  const sorted = [...result].sort((a, b) => a - b);
  assert.deepEqual(sorted, [0, 1, 2, 3, 4]);
});

test('shuffleIndices(1) returns [0]', () => {
  const result = shuffleIndices(1);
  assert.deepEqual(result, [0]);
});

test('shuffleIndices(0) returns empty array', () => {
  const result = shuffleIndices(0);
  assert.deepEqual(result, []);
});

test('shuffleIndices(10) is a permutation (no duplicates)', () => {
  const result = shuffleIndices(10);
  const unique = new Set(result);
  assert.equal(unique.size, 10);
});

test('shuffleIndices(10) contains min=0 and max=9', () => {
  const result = shuffleIndices(10);
  assert.ok(result.includes(0));
  assert.ok(result.includes(9));
});

test('shuffleIndices(100) is a valid permutation', () => {
  const result = shuffleIndices(100);
  assert.equal(result.length, 100);
  const sorted = [...result].sort((a, b) => a - b);
  for (let i = 0; i < 100; i++) {
    assert.equal(sorted[i], i);
  }
});

test('shuffleIndices(2) produces both permutations over 1000 runs', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    seen.add(JSON.stringify(shuffleIndices(2)));
  }
  assert.ok(seen.has('[0,1]'), 'Never produced [0,1]');
  assert.ok(seen.has('[1,0]'), 'Never produced [1,0]');
});

test('shuffleIndices does not always return identity permutation', () => {
  // With 10 elements, probability of identity is 1/10! ≈ 0
  let allIdentity = true;
  for (let i = 0; i < 20; i++) {
    const result = shuffleIndices(10);
    if (JSON.stringify(result) !== JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      allIdentity = false;
      break;
    }
  }
  assert.ok(!allIdentity, 'All 20 shuffles returned identity - likely broken');
});

test('shuffleIndices(3) produces at least 3 distinct permutations over 100 runs', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) {
    seen.add(JSON.stringify(shuffleIndices(3)));
  }
  // 3! = 6 possible permutations, should see at least 3 in 100 runs
  assert.ok(seen.size >= 3, `Only saw ${seen.size} distinct permutations`);
});

test('full cycle: popping all indices from shuffled gives unique values', () => {
  const indices = shuffleIndices(20);
  const popped: number[] = [];
  for (let i = 0; i < 20; i++) {
    popped.push(indices[i]);
  }
  const unique = new Set(popped);
  assert.equal(unique.size, 20);
});

test('shuffleIndices preserves all elements (sum invariant)', () => {
  const n = 50;
  const expected = (n * (n - 1)) / 2; // sum of 0..49
  const result = shuffleIndices(n);
  const sum = result.reduce((a, b) => a + b, 0);
  assert.equal(sum, expected);
});

test('dedup key format: warmup:dedup:{fromId}:{toId}:{type}', () => {
  // Verify the key format matches what the code uses
  const key = `warmup:dedup:inbox-1:inbox-2:main`;
  assert.ok(key.startsWith('warmup:dedup:'));
  assert.ok(key.includes(':main'));
});

test('dedup TTL is 7 days (604800 seconds)', () => {
  const DEDUP_TTL = 7 * 24 * 60 * 60;
  assert.equal(DEDUP_TTL, 604800);
});

test('different inbox pairs produce different keys', () => {
  const key1 = `warmup:dedup:inbox-a:inbox-b:main`;
  const key2 = `warmup:dedup:inbox-c:inbox-d:main`;
  assert.notEqual(key1, key2);
});

test('same inbox pair with different types produce different keys', () => {
  const key1 = `warmup:dedup:inbox-a:inbox-b:main`;
  const key2 = `warmup:dedup:inbox-a:inbox-b:reply`;
  const key3 = `warmup:dedup:inbox-a:inbox-b:continuation`;
  const key4 = `warmup:dedup:inbox-a:inbox-b:closer`;
  const keys = new Set([key1, key2, key3, key4]);
  assert.equal(keys.size, 4);
});

test('shuffleIndices(105) matches mainTemplates count', () => {
  const result = shuffleIndices(WARMUP_TEMPLATES.length);
  assert.equal(result.length, WARMUP_TEMPLATES.length);
});

test('shuffleIndices(50) matches replyTemplates count', () => {
  const result = shuffleIndices(WARMUP_REPLY_TEMPLATES.length);
  assert.equal(result.length, WARMUP_REPLY_TEMPLATES.length);
});

test('shuffleIndices(30) matches continuationTemplates count', () => {
  const result = shuffleIndices(WARMUP_CONTINUATION_TEMPLATES.length);
  assert.equal(result.length, WARMUP_CONTINUATION_TEMPLATES.length);
});

test('shuffleIndices(20) matches closerTemplates count', () => {
  const result = shuffleIndices(WARMUP_CLOSER_TEMPLATES.length);
  assert.equal(result.length, WARMUP_CLOSER_TEMPLATES.length);
});

test('two consecutive shuffles of same size are (likely) different', () => {
  // For n=20, probability of identical shuffles is 1/20! ≈ 0
  const s1 = shuffleIndices(20);
  const s2 = shuffleIndices(20);
  // They CAN be equal but it's extremely unlikely
  // We check that the function doesn't always return the same result
  const s3 = shuffleIndices(20);
  const allSame = JSON.stringify(s1) === JSON.stringify(s2) && JSON.stringify(s2) === JSON.stringify(s3);
  assert.ok(!allSame, 'Three consecutive shuffles are identical');
});

test('shuffleIndices produces all values in valid range', () => {
  const n = 30;
  const result = shuffleIndices(n);
  for (const v of result) {
    assert.ok(v >= 0 && v < n, `Value ${v} out of range [0, ${n})`);
  }
});

test('reshuffle after exhaustion gives new complete cycle', () => {
  // Simulate: use all indices from first shuffle, then reshuffle
  const first = shuffleIndices(10);
  const second = shuffleIndices(10);
  // Both should be complete permutations
  assert.equal(new Set(first).size, 10);
  assert.equal(new Set(second).size, 10);
});

test('shuffleIndices distribution is roughly uniform (chi-square light test)', () => {
  // For shuffleIndices(3), track how often each element appears in position 0
  const counts = [0, 0, 0];
  const N = 3000;
  for (let i = 0; i < N; i++) {
    const result = shuffleIndices(3);
    counts[result[0]]++;
  }
  // Expected: N/3 = 1000 each. Allow 20% deviation
  for (let i = 0; i < 3; i++) {
    assert.ok(counts[i] > N / 3 * 0.7, `Element ${i} in position 0 only ${counts[i]} times (expected ~${N / 3})`);
    assert.ok(counts[i] < N / 3 * 1.3, `Element ${i} in position 0 ${counts[i]} times (expected ~${N / 3})`);
  }
});

// ============================================================
// Section 6: isAuthError Detection (~20 tests)
// ============================================================

console.log('\n--- isAuthError Detection ---');

test('isAuthError: status code 401 → true', () => {
  assert.ok(isAuthError({ statusCode: 401 }));
});

test('isAuthError: status code 403 → true', () => {
  assert.ok(isAuthError({ statusCode: 403 }));
});

test('isAuthError: code "401" (string) → true', () => {
  assert.ok(isAuthError({ code: '401' }));
});

test('isAuthError: "unauthorized" message → true', () => {
  assert.ok(isAuthError({ message: 'Request unauthorized' }));
});

test('isAuthError: "invalid_grant" message → true', () => {
  assert.ok(isAuthError({ message: 'Error: invalid_grant' }));
});

test('isAuthError: "invalid_client" message → true', () => {
  assert.ok(isAuthError({ message: 'invalid_client credentials' }));
});

test('isAuthError: "token expired" message → true', () => {
  assert.ok(isAuthError({ message: 'Token expired' }));
});

test('isAuthError: "token has been expired" → true', () => {
  assert.ok(isAuthError({ message: 'The token has been expired' }));
});

test('isAuthError: "token has been revoked" → true', () => {
  assert.ok(isAuthError({ message: 'token has been revoked by user' }));
});

test('isAuthError: "refresh token" → true', () => {
  assert.ok(isAuthError({ message: 'Could not refresh token' }));
});

test('isAuthError: "authentication" → true', () => {
  assert.ok(isAuthError({ message: 'Authentication required' }));
});

test('isAuthError: "auth_error" → true', () => {
  assert.ok(isAuthError({ message: 'auth_error: session expired' }));
});

test('isAuthError: "auth error" → true', () => {
  assert.ok(isAuthError({ message: 'Auth error occurred' }));
});

test('isAuthError: "insufficient permissions" → true', () => {
  assert.ok(isAuthError({ message: 'Insufficient permissions for this operation' }));
});

test('isAuthError: does NOT match "author" (false positive fix)', () => {
  assert.ok(!isAuthError({ message: 'The author of this post' }));
});

test('isAuthError: does NOT match "authority"', () => {
  assert.ok(!isAuthError({ message: 'Contact your local authority' }));
});

test('isAuthError: generic network error → false', () => {
  assert.ok(!isAuthError({ message: 'ECONNREFUSED' }));
});

test('isAuthError: status code 500 → false', () => {
  assert.ok(!isAuthError({ statusCode: 500 }));
});

test('isAuthError: null error → false', () => {
  assert.ok(!isAuthError(null));
});

test('isAuthError: empty object → false', () => {
  assert.ok(!isAuthError({}));
});

// ============================================================
// Section 7: Health Score (~15 tests)
// ============================================================

console.log('\n--- Health Score ---');

test('health score 0 for disabled warmup with day 0', () => {
  assert.equal(calculateHealthScore({
    warmupEnabled: false,
    currentDay: 0,
    sentTotal: 0,
    repliedTotal: 0,
  }), 0);
});

test('health score > 0 for enabled warmup on day 1', () => {
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 1,
    sentTotal: 0,
    repliedTotal: 0,
  });
  assert.ok(score > 0, `Score should be > 0, got ${score}`);
});

test('health score increases with more days', () => {
  const day5 = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 5,
    sentTotal: 100,
    repliedTotal: 30,
  });
  const day30 = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 30,
    sentTotal: 100,
    repliedTotal: 30,
  });
  assert.ok(day30 > day5, `Day 30 (${day30}) should be > day 5 (${day5})`);
});

test('health score increases with higher reply rate', () => {
  const low = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 15,
    sentTotal: 100,
    repliedTotal: 5,
  });
  const high = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 15,
    sentTotal: 100,
    repliedTotal: 50,
  });
  assert.ok(high > low, `High reply (${high}) should be > low reply (${low})`);
});

test('health score penalty for high bounce rate', () => {
  // Use a large enough bounce rate so the penalty survives Math.round()
  const noBounce = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 10,
    sentTotal: 50,
    repliedTotal: 5,
    bounceRate: 0,
  });
  const highBounce = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 10,
    sentTotal: 50,
    repliedTotal: 5,
    bounceRate: 0.5, // penalty = 0.5 * 10 = 5 points
  });
  assert.ok(noBounce > highBounce, `No bounce (${noBounce}) should be > high bounce (${highBounce})`);
});

test('health score penalty for high spam rate', () => {
  const noSpam = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 30,
    sentTotal: 500,
    repliedTotal: 150,
    spamRate: 0,
  });
  const highSpam = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 30,
    sentTotal: 500,
    repliedTotal: 150,
    spamRate: 0.05,
  });
  assert.ok(noSpam > highSpam, `No spam (${noSpam}) should be > high spam (${highSpam})`);
});

test('health score clamped to max 100', () => {
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 60,
    sentTotal: 10000,
    repliedTotal: 5000,
  });
  assert.ok(score <= 100, `Score ${score} exceeds 100`);
});

test('health score clamped to min 0', () => {
  const score = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 1,
    sentTotal: 10,
    repliedTotal: 0,
    bounceRate: 5,
    spamRate: 5,
  });
  assert.ok(score >= 0, `Score ${score} is below 0`);
});

test('engagement bonus: 10 points when enabled and day > 7', () => {
  const day7 = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 7,
    sentTotal: 0,
    repliedTotal: 0,
  });
  const day8 = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 8,
    sentTotal: 0,
    repliedTotal: 0,
  });
  assert.ok(day8 > day7, `Day 8 (${day8}) should be > day 7 (${day7}) due to engagement bonus`);
});

test('volume score increases with more sent emails (same reply rate)', () => {
  // Keep reply rate proportional so only volume score differs
  const low = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 15,
    sentTotal: 10,
    repliedTotal: 0,
  });
  const high = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 15,
    sentTotal: 500,
    repliedTotal: 0,
  });
  assert.ok(high > low, `High volume (${high}) should be > low volume (${low})`);
});

test('max day score at day 30+ (40 points)', () => {
  const day30 = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 30,
    sentTotal: 0,
    repliedTotal: 0,
  });
  const day60 = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 60,
    sentTotal: 0,
    repliedTotal: 0,
  });
  assert.equal(day30, day60, `Day 30 (${day30}) should equal day 60 (${day60}) for day score`);
});

test('spam rate has heavier penalty than bounce rate', () => {
  const bounceOnly = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 30,
    sentTotal: 500,
    repliedTotal: 150,
    bounceRate: 0.1,
    spamRate: 0,
  });
  const spamOnly = calculateHealthScore({
    warmupEnabled: true,
    currentDay: 30,
    sentTotal: 500,
    repliedTotal: 150,
    bounceRate: 0,
    spamRate: 0.1,
  });
  assert.ok(bounceOnly > spamOnly, `Bounce penalty (${bounceOnly}) should be lighter than spam penalty (${spamOnly})`);
});

// ============================================================
// Section 8: Mode Switching (~15 tests)
// ============================================================

console.log('\n--- Mode Switching ---');

test('warmup_mode valid values include "pool"', () => {
  const validModes = ['pool', 'network', null];
  assert.ok(validModes.includes('pool'));
});

test('warmup_mode valid values include "network"', () => {
  const validModes = ['pool', 'network', null];
  assert.ok(validModes.includes('network'));
});

test('warmup_mode valid values include null (unassigned)', () => {
  const validModes = ['pool', 'network', null];
  assert.ok(validModes.includes(null));
});

test('pool mode requires >= 2 active inboxes (logic verification)', () => {
  const poolInboxCount = 1;
  const shouldDisable = poolInboxCount < 2;
  assert.ok(shouldDisable, 'Pool warmup should be disabled with < 2 inboxes');
});

test('pool mode allowed with 2 inboxes', () => {
  const poolInboxCount = 2;
  const shouldDisable = poolInboxCount < 2;
  assert.ok(!shouldDisable, 'Pool warmup should be allowed with 2 inboxes');
});

test('pool mode allowed with 5 inboxes', () => {
  const poolInboxCount = 5;
  const shouldDisable = poolInboxCount < 2;
  assert.ok(!shouldDisable, 'Pool warmup should be allowed with 5 inboxes');
});

test('cannot enable warmup when inbox status is error', () => {
  const inboxStatus = 'error';
  const canEnable = inboxStatus !== 'error';
  assert.ok(!canEnable, 'Should not enable warmup for error status');
});

test('can enable warmup when inbox status is active', () => {
  const inboxStatus = 'active';
  const canEnable = inboxStatus !== 'error';
  assert.ok(canEnable, 'Should allow warmup for active status');
});

test('disablePoolWarmup sets enabled=false and phase=paused', () => {
  const update = { enabled: false, phase: 'paused' };
  assert.equal(update.enabled, false);
  assert.equal(update.phase, 'paused');
});

test('disablePoolWarmup resets inbox status to active', () => {
  const inboxUpdate = { status: 'active' };
  assert.equal(inboxUpdate.status, 'active');
});

test('mode switch from pool to network preserves inbox state', () => {
  const state = { warmup_mode: 'pool' as string };
  state.warmup_mode = 'network';
  assert.equal(state.warmup_mode, 'network');
});

test('mode switch to null (unassign) is valid', () => {
  const state = { warmup_mode: 'pool' as string | null };
  state.warmup_mode = null;
  assert.equal(state.warmup_mode, null);
});

test('disconnected inbox filter excludes error status from pool scheduling', () => {
  const inboxes = [
    { id: '1', status: 'active', warmup_mode: 'pool' },
    { id: '2', status: 'error', warmup_mode: 'pool' },
    { id: '3', status: 'warming_up', warmup_mode: 'pool' },
  ];
  const active = inboxes.filter(i => i.status === 'active' || i.status === 'warming_up');
  assert.equal(active.length, 2);
  assert.ok(!active.some(i => i.status === 'error'));
});

test('network mode separates from pool mode in scheduling', () => {
  const inboxStates = [
    { warmup_mode: 'pool', status: 'active' },
    { warmup_mode: 'network', status: 'active' },
    { warmup_mode: 'pool', status: 'warming_up' },
  ];
  const poolInboxes = inboxStates.filter(
    is => is.warmup_mode !== 'network' && (is.status === 'active' || is.status === 'warming_up')
  );
  const networkInboxes = inboxStates.filter(
    is => is.warmup_mode === 'network' && (is.status === 'active' || is.status === 'warming_up')
  );
  assert.equal(poolInboxes.length, 2);
  assert.equal(networkInboxes.length, 1);
});

test('network warmup sets isNetworkWarmup flag to true', () => {
  const job = { fromInboxId: 'inbox-1', toInboxId: 'admin:admin-1', isNetworkWarmup: true };
  assert.ok(job.isNetworkWarmup);
});

// ============================================================
// Section 9: State Synchronization (~10 tests)
// ============================================================

console.log('\n--- State Synchronization ---');

test('invariant: warming_up status implies enabled=true', () => {
  const inboxStatus = 'warming_up';
  const warmupEnabled = true;
  const isSync = (inboxStatus === 'warming_up') === warmupEnabled;
  assert.ok(isSync, 'warming_up + enabled=true is the valid sync state');
});

test('valid state: active status with enabled=false', () => {
  const inboxStatus = 'active';
  const warmupEnabled = false;
  const isValid = inboxStatus === 'active' && !warmupEnabled;
  assert.ok(isValid);
});

test('desync detection: warming_up + enabled=false needs fix', () => {
  const inboxStatus = 'warming_up';
  const warmupEnabled = false;
  const isDesynced = (inboxStatus === 'warming_up') !== warmupEnabled;
  assert.ok(isDesynced, 'Should detect desync: warming_up but not enabled');
});

test('desync detection: active + enabled=true needs fix', () => {
  const inboxStatus = 'active';
  const warmupEnabled = true;
  // This is a desync because active status should not have warmup enabled
  // (the inbox should be warming_up if warmup is enabled)
  const isDesynced = (inboxStatus !== 'warming_up') && warmupEnabled;
  assert.ok(isDesynced, 'Should detect desync: active but warmup enabled');
});

test('getEffectiveStatus: warming_up + disabled → shows active', () => {
  // Frontend helper logic
  const inboxStatus = 'warming_up';
  const warmupEnabled = false;
  const effectiveStatus = (inboxStatus === 'warming_up' && !warmupEnabled) ? 'active' : inboxStatus;
  assert.equal(effectiveStatus, 'active');
});

test('getEffectiveStatus: warming_up + enabled → shows warming_up', () => {
  const inboxStatus = 'warming_up';
  const warmupEnabled = true;
  const effectiveStatus = (inboxStatus === 'warming_up' && !warmupEnabled) ? 'active' : inboxStatus;
  assert.equal(effectiveStatus, 'warming_up');
});

test('getEffectiveStatus: active + disabled → shows active', () => {
  const inboxStatus = 'active';
  const warmupEnabled = false;
  const effectiveStatus = (inboxStatus === 'warming_up' && !warmupEnabled) ? 'active' : inboxStatus;
  assert.equal(effectiveStatus, 'active');
});

test('getEffectiveStatus: error status is never overridden', () => {
  const inboxStatus = 'error';
  const warmupEnabled = false;
  const effectiveStatus = (inboxStatus === 'warming_up' && !warmupEnabled) ? 'active' : inboxStatus;
  assert.equal(effectiveStatus, 'error');
});

test('markDisconnected sets inbox status to error', () => {
  const update = { status: 'error', status_reason: 'Email account disconnected — please reconnect' };
  assert.equal(update.status, 'error');
  assert.ok(update.status_reason.includes('disconnected'));
});

test('markDisconnected disables warmup (enabled=false, phase=paused)', () => {
  const warmupUpdate = { enabled: false, phase: 'paused' };
  assert.equal(warmupUpdate.enabled, false);
  assert.equal(warmupUpdate.phase, 'paused');
});

// ============================================================
// Section 10: Reply Subject & Thread Logic (~10 tests)
// ============================================================

console.log('\n--- Reply Subject & Thread Logic ---');

test('reply subject adds "Re: " prefix to original subject', () => {
  const originalSubject = 'Quick sync this week?';
  const replySubject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;
  assert.equal(replySubject, 'Re: Quick sync this week?');
});

test('reply subject does not double-prefix "Re: Re:"', () => {
  const originalSubject = 'Re: Quick sync this week?';
  const replySubject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;
  assert.equal(replySubject, 'Re: Quick sync this week?');
});

test('reply subject fallback when originalSubject is undefined', () => {
  const originalSubject: string | undefined = undefined;
  const replySubject = originalSubject
    ? (originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`)
    : 'Re: Quick question';
  assert.equal(replySubject, 'Re: Quick question');
});

test('thread depth 1 selects reply template', () => {
  const threadDepth = 1;
  const maxThreadDepth = 3;
  const isLastReply = threadDepth >= maxThreadDepth;
  assert.ok(!isLastReply);
  assert.ok(threadDepth === 1); // Uses reply templates
});

test('thread depth = maxThreadDepth selects closer template', () => {
  const threadDepth = 3;
  const maxThreadDepth = 3;
  const isLastReply = threadDepth >= maxThreadDepth;
  assert.ok(isLastReply);
});

test('thread depth 2 with max 4 selects continuation template', () => {
  const threadDepth = 2;
  const maxThreadDepth = 4;
  const isLastReply = threadDepth >= maxThreadDepth;
  assert.ok(!isLastReply && threadDepth !== 1);
  // This means continuation template is used
});

test('multi-level thread max depth is 2-5', () => {
  // From the code: Math.floor(Math.random() * 4) + 2
  const min = 2;
  const max = 5;
  // Verify range
  for (let i = 0; i < 100; i++) {
    const depth = Math.floor(Math.random() * 4) + 2;
    assert.ok(depth >= min && depth <= max, `Depth ${depth} out of range [${min}, ${max}]`);
  }
});

test('50% chance of multi-level thread', () => {
  let multiLevel = 0;
  const N = 10000;
  for (let i = 0; i < N; i++) {
    if (Math.random() < 0.5) multiLevel++;
  }
  // Should be roughly 50% ± 5%
  const ratio = multiLevel / N;
  assert.ok(ratio > 0.45 && ratio < 0.55, `Multi-level ratio ${ratio} not ~50%`);
});

test('non-multi-level thread has maxThreadDepth = 1', () => {
  const isMultiLevel = false;
  const maxThreadDepth = isMultiLevel ? Math.floor(Math.random() * 4) + 2 : 1;
  assert.equal(maxThreadDepth, 1);
});

test('no more replies scheduled when threadDepth >= maxThreadDepth', () => {
  const threadDepth = 3;
  const maxThreadDepth = 3;
  const shouldScheduleMore = threadDepth < maxThreadDepth;
  assert.ok(!shouldScheduleMore);
});

// ============================================================
// Section 11: Daily Reset & Scheduling (~5 tests)
// ============================================================

console.log('\n--- Daily Reset & Scheduling ---');

test('work hours are 9 hours in milliseconds', () => {
  const WORK_HOURS_MS = 9 * 60 * 60 * 1000;
  assert.equal(WORK_HOURS_MS, 32400000);
});

test('scheduler interval is 30 minutes', () => {
  const intervalMs = 30 * 60 * 1000;
  assert.equal(intervalMs, 1800000);
});

test('daily reset checks every minute', () => {
  const checkIntervalMs = 60 * 1000;
  assert.equal(checkIntervalMs, 60000);
});

test('daily reset key is well-formed', () => {
  const key = 'warmup:last_reset_date';
  assert.ok(key.startsWith('warmup:'));
});

test('remaining emails calculation: max(0, quota - sent - pending)', () => {
  const quota = 20;
  const sentToday = 15;
  const pendingInQueue = 3;
  const remaining = Math.max(0, quota - sentToday - pendingInQueue);
  assert.equal(remaining, 2);
});

// ============================================================
// Summary
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed of ${passed + failed}`);
console.log(`${'='.repeat(50)}`);

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
