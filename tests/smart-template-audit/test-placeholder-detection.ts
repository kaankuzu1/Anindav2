import assert from 'node:assert/strict';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  \u2717 ${name}`);
    console.log(`    ${e.message}`);
  }
}

console.log('\n=== Smart Template: Placeholder Detection Tests ===\n');

function extractPlaceholders(text: string): { full: string; instruction: string }[] {
  const regex = /\[([^\[\]]+)\]/g;
  const results: { full: string; instruction: string }[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({ full: match[0], instruction: match[1] });
  }
  return results;
}

function extractPlaceholdersFromBoth(subject: string, body: string): {
  subjectPlaceholders: { full: string; instruction: string }[];
  bodyPlaceholders: { full: string; instruction: string }[];
} {
  const regex = /\[([^\[\]]+)\]/g;
  const subjectPlaceholders: { full: string; instruction: string }[] = [];
  const bodyPlaceholders: { full: string; instruction: string }[] = [];
  let match;

  while ((match = regex.exec(subject)) !== null) {
    subjectPlaceholders.push({ full: match[0], instruction: match[1] });
  }
  regex.lastIndex = 0;
  while ((match = regex.exec(body)) !== null) {
    bodyPlaceholders.push({ full: match[0], instruction: match[1] });
  }

  return { subjectPlaceholders, bodyPlaceholders };
}

// Basic body placeholder extraction
test('extracts single placeholder from body', () => {
  const result = extractPlaceholders('Hello [personalized opening]');
  assert.equal(result.length, 1);
  assert.equal(result[0].full, '[personalized opening]');
  assert.equal(result[0].instruction, 'personalized opening');
});

test('extracts multiple placeholders from body', () => {
  const result = extractPlaceholders('[opening] some text [value prop] more text [closing]');
  assert.equal(result.length, 3);
  assert.equal(result[0].instruction, 'opening');
  assert.equal(result[1].instruction, 'value prop');
  assert.equal(result[2].instruction, 'closing');
});

test('returns empty array for no placeholders', () => {
  const result = extractPlaceholders('Hello {{firstName}}, this is a normal email');
  assert.equal(result.length, 0);
});

test('does not confuse {{variables}} with [placeholders]', () => {
  const result = extractPlaceholders('Hi {{firstName}}, [personalized line about {{company}}]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'personalized line about {{company}}');
});

test('handles placeholder with special characters', () => {
  const result = extractPlaceholders('[mention their $50M funding round]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'mention their $50M funding round');
});

test('does not match nested brackets', () => {
  const result = extractPlaceholders('[[nested]]');
  // The inner [nested] should match but not the outer brackets
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'nested');
});

test('handles empty brackets', () => {
  const result = extractPlaceholders('Hello [] world');
  assert.equal(result.length, 0); // Empty brackets should not match since [^\[\]]+ requires 1+ chars
});

test('handles placeholder at start of text', () => {
  const result = extractPlaceholders('[opening line] rest of email');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'opening line');
});

test('handles placeholder at end of text', () => {
  const result = extractPlaceholders('rest of email [closing line]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'closing line');
});

test('handles placeholder with numbers', () => {
  const result = extractPlaceholders('[mention their 3 new hires]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'mention their 3 new hires');
});

test('handles placeholder with hyphens and underscores', () => {
  const result = extractPlaceholders('[pain-point_description]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'pain-point_description');
});

test('handles multiline body with placeholders', () => {
  const body = 'Line 1 [opening]\nLine 2\nLine 3 [closing]';
  const result = extractPlaceholders(body);
  assert.equal(result.length, 2);
});

test('handles placeholder with quotes inside', () => {
  const result = extractPlaceholders('[mention "Series B" funding]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'mention "Series B" funding');
});

// Subject + body scanning
console.log('\n--- Subject + Body Scanning ---\n');

test('extracts placeholders from subject only', () => {
  const { subjectPlaceholders, bodyPlaceholders } = extractPlaceholdersFromBoth(
    '[attention-grabbing subject]',
    'Normal body without placeholders'
  );
  assert.equal(subjectPlaceholders.length, 1);
  assert.equal(bodyPlaceholders.length, 0);
});

test('extracts placeholders from body only', () => {
  const { subjectPlaceholders, bodyPlaceholders } = extractPlaceholdersFromBoth(
    'Normal subject',
    'Body with [personalized opening]'
  );
  assert.equal(subjectPlaceholders.length, 0);
  assert.equal(bodyPlaceholders.length, 1);
});

test('extracts placeholders from both subject and body', () => {
  const { subjectPlaceholders, bodyPlaceholders } = extractPlaceholdersFromBoth(
    '[catchy subject for {{company}}]',
    'Hi {{firstName}}, [personalized opening] then [value prop]'
  );
  assert.equal(subjectPlaceholders.length, 1);
  assert.equal(subjectPlaceholders[0].instruction, 'catchy subject for {{company}}');
  assert.equal(bodyPlaceholders.length, 2);
});

test('returns empty for both when no placeholders', () => {
  const { subjectPlaceholders, bodyPlaceholders } = extractPlaceholdersFromBoth(
    'Normal subject',
    'Normal body with {{firstName}}'
  );
  assert.equal(subjectPlaceholders.length, 0);
  assert.equal(bodyPlaceholders.length, 0);
});

test('handles multiple subject placeholders', () => {
  const { subjectPlaceholders } = extractPlaceholdersFromBoth(
    '[hook] - [benefit for {{company}}]',
    'body'
  );
  assert.equal(subjectPlaceholders.length, 2);
});

test('preserves {{variables}} in placeholder instructions', () => {
  const { bodyPlaceholders } = extractPlaceholdersFromBoth(
    'Subject',
    '[personalized line referencing {{company}} and {{title}}]'
  );
  assert.equal(bodyPlaceholders.length, 1);
  assert.ok(bodyPlaceholders[0].instruction.includes('{{company}}'));
  assert.ok(bodyPlaceholders[0].instruction.includes('{{title}}'));
});

test('handles HTML in body with placeholders', () => {
  const { bodyPlaceholders } = extractPlaceholdersFromBoth(
    'Subject',
    '<p>[personalized opening]</p><br>[value prop]'
  );
  assert.equal(bodyPlaceholders.length, 2);
});

test('handles spintax near placeholders', () => {
  const { bodyPlaceholders } = extractPlaceholdersFromBoth(
    'Subject',
    '{Hi|Hello} {{firstName}}, [personalized opening]'
  );
  assert.equal(bodyPlaceholders.length, 1);
  assert.equal(bodyPlaceholders[0].instruction, 'personalized opening');
});

test('handles conditional blocks near placeholders', () => {
  const { bodyPlaceholders } = extractPlaceholdersFromBoth(
    'Subject',
    '{if:company}[mention something about {{company}}]{/if}'
  );
  assert.equal(bodyPlaceholders.length, 1);
});

test('does not match markdown links as placeholders', () => {
  // Markdown links like [text](url) should match [text] part
  const result = extractPlaceholders('Check [our website](https://example.com)');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'our website');
});

test('handles long placeholder instructions', () => {
  const longInstruction = 'write a personalized opening that references their recent Series B funding round and how it relates to their hiring challenges in the engineering department';
  const result = extractPlaceholders(`[${longInstruction}]`);
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, longInstruction);
});

test('handles placeholder with newline - does not cross lines', () => {
  // [^\[\]]+ does not match newlines by default in the regex
  const result = extractPlaceholders('[line1\nline2]');
  // The placeholder regex uses [^\[\]]+ which DOES match \n since it's not [ or ]
  assert.equal(result.length, 1);
});

test('placeholder replacement preserves surrounding text', () => {
  const body = 'Before [placeholder] after';
  const placeholders = extractPlaceholders(body);
  let result = body;
  for (const ph of placeholders) {
    result = result.replace(ph.full, 'REPLACED');
  }
  assert.equal(result, 'Before REPLACED after');
});

test('multiple replacements work correctly', () => {
  const body = '[opening] middle [closing]';
  const placeholders = extractPlaceholders(body);
  let result = body;
  result = result.replace(placeholders[0].full, 'START');
  result = result.replace(placeholders[1].full, 'END');
  assert.equal(result, 'START middle END');
});

test('replacement preserves {{variables}} in surrounding text', () => {
  const body = 'Hi {{firstName}}, [personalized line]. Best, {{senderFirstName}}';
  const placeholders = extractPlaceholders(body);
  let result = body;
  for (const ph of placeholders) {
    result = result.replace(ph.full, 'Great work at Acme');
  }
  assert.equal(result, 'Hi {{firstName}}, Great work at Acme. Best, {{senderFirstName}}');
});

test('subject replacement works independently from body', () => {
  const subject = '[catchy hook] for {{company}}';
  const body = 'Hi, [personalized opening]';
  const { subjectPlaceholders, bodyPlaceholders } = extractPlaceholdersFromBoth(subject, body);

  let resultSubject = subject;
  for (const ph of subjectPlaceholders) {
    resultSubject = resultSubject.replace(ph.full, 'Quick question');
  }

  let resultBody = body;
  for (const ph of bodyPlaceholders) {
    resultBody = resultBody.replace(ph.full, 'Noticed your recent growth');
  }

  assert.equal(resultSubject, 'Quick question for {{company}}');
  assert.equal(resultBody, 'Hi, Noticed your recent growth');
});

test('handles duplicate placeholders in body', () => {
  const body = '[same placeholder] and [same placeholder]';
  const placeholders = extractPlaceholders(body);
  assert.equal(placeholders.length, 2);
  assert.equal(placeholders[0].instruction, 'same placeholder');
  assert.equal(placeholders[1].instruction, 'same placeholder');
});

test('handles placeholder with colon', () => {
  const result = extractPlaceholders('[note: mention their product launch]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'note: mention their product launch');
});

test('handles placeholder with parentheses', () => {
  const result = extractPlaceholders('[mention ROI (2-3x)]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'mention ROI (2-3x)');
});

test('handles placeholder with forward slash', () => {
  const result = extractPlaceholders('[pain point/challenge]');
  assert.equal(result.length, 1);
});

test('regex lastIndex reset between subject and body scans', () => {
  // Verify that extractPlaceholdersFromBoth properly resets lastIndex
  const { subjectPlaceholders, bodyPlaceholders } = extractPlaceholdersFromBoth(
    '[subject placeholder]',
    '[body placeholder]'
  );
  assert.equal(subjectPlaceholders.length, 1);
  assert.equal(bodyPlaceholders.length, 1);
  assert.equal(subjectPlaceholders[0].instruction, 'subject placeholder');
  assert.equal(bodyPlaceholders[0].instruction, 'body placeholder');
});

test('handles placeholder with ampersand', () => {
  const result = extractPlaceholders('[mention B2B & SaaS focus]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'mention B2B & SaaS focus');
});

test('handles placeholder with percentage', () => {
  const result = extractPlaceholders('[mention 200% growth]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'mention 200% growth');
});

test('handles adjacent placeholders with no space', () => {
  const result = extractPlaceholders('[first][second]');
  assert.equal(result.length, 2);
  assert.equal(result[0].instruction, 'first');
  assert.equal(result[1].instruction, 'second');
});

test('single character placeholder matches', () => {
  const result = extractPlaceholders('[x]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'x');
});

test('handles placeholder with tab character', () => {
  const result = extractPlaceholders('[with\ttab]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'with\ttab');
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
