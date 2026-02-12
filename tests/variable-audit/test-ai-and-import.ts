/**
 * Tests for AI validateAndFixVariables, parseCSVLine, and detectColumnFallback
 * Run: npx tsx tests/variable-audit/test-ai-and-import.ts
 */
import assert from 'node:assert/strict';

// ============================================================
// Replicated functions from source
// ============================================================

// From apps/api/src/modules/ai/ai.service.ts (lines 80-106)
function validateAndFixVariables(content: string): { fixed: string; warnings: string[] } {
  const warnings: string[] = [];
  let fixed = content;

  const namePatterns = [
    /\b(Hi|Hello|Hey|Dear)\s+([A-Z][a-z]+)([,\s])/g,
    /\b(Mr\.|Ms\.|Mrs\.)\s+([A-Z][a-z]+)/g,
  ];

  for (const pattern of namePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      warnings.push(`Detected hardcoded name: "${matches[0].trim()}"`);
      fixed = fixed.replace(
        /\b(Hi|Hello|Hey|Dear)\s+([A-Z][a-z]+)([,\s])/g,
        '$1 {{firstName}}$3'
      );
    }
  }

  return { fixed, warnings };
}

// From apps/web/src/app/(dashboard)/leads/import/page.tsx (lines 138-163)
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

// From apps/web/src/app/(dashboard)/leads/import/page.tsx (lines 166-179)
function detectColumnFallback(header: string): string | null {
  const h = header.toLowerCase().trim();
  if (h.includes('email') || h === 'e-mail' || h === 'correo') return 'email';
  if ((h.includes('first') && h.includes('name')) || h === 'first_name' || h === 'firstname' || h === 'nombre' || h === 'given_name' || h === 'givenname') return 'first_name';
  if ((h.includes('last') && h.includes('name')) || h === 'last_name' || h === 'lastname' || h === 'apellido' || h === 'surname' || h === 'family_name' || h === 'familyname') return 'last_name';
  if (h === 'company' || h === 'organization' || h === 'org' || h === 'empresa' || h === 'organisation') return 'company';
  if (h === 'title' || h === 'job_title' || h === 'jobtitle' || h.includes('position') || h === 'role' || h === 'cargo' || h === 'job title') return 'title';
  if (h === 'phone' || h === 'telephone' || h === 'telefono' || h === 'phone_number' || h === 'mobile') return 'phone';
  if (h.includes('linkedin')) return 'linkedin_url';
  if (h === 'website' || h === 'url' || h === 'web') return 'website';
  if (h === 'country' || h === 'pais') return 'country';
  if (h === 'city' || h === 'ciudad') return 'city';
  if (h === 'timezone' || h === 'tz' || h === 'time_zone') return 'timezone';
  return null;
}

// ============================================================
// Test runner
// ============================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`        ${e.message}`);
  }
}

// ============================================================
// 1. validateAndFixVariables tests
// ============================================================
console.log('\n=== validateAndFixVariables ===');

test('replaces "Hi John," with "Hi {{firstName}},"', () => {
  const result = validateAndFixVariables('Hi John, how are you?');
  assert.equal(result.fixed, 'Hi {{firstName}}, how are you?');
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes('John'));
});

test('replaces "Dear Sarah " with "Dear {{firstName}} "', () => {
  const result = validateAndFixVariables('Dear Sarah welcome aboard');
  assert.equal(result.fixed, 'Dear {{firstName}} welcome aboard');
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes('Sarah'));
});

test('replaces "Hello Mike," correctly', () => {
  const result = validateAndFixVariables('Hello Mike, thanks for reaching out.');
  assert.equal(result.fixed, 'Hello {{firstName}}, thanks for reaching out.');
  assert.equal(result.warnings.length, 1);
});

test('replaces "Hey Anna " correctly', () => {
  const result = validateAndFixVariables('Hey Anna just checking in.');
  assert.equal(result.fixed, 'Hey {{firstName}} just checking in.');
});

test('leaves "Hi {{firstName}}," unchanged (no false positive)', () => {
  const result = validateAndFixVariables('Hi {{firstName}}, how are you?');
  assert.equal(result.fixed, 'Hi {{firstName}}, how are you?');
  assert.equal(result.warnings.length, 0);
});

test('detects "Mr. Smith" as hardcoded name', () => {
  const result = validateAndFixVariables('Mr. Smith is expected.');
  assert.ok(result.warnings.length > 0);
  assert.ok(result.warnings[0].includes('Mr. Smith'));
});

test('detects "Mrs. Johnson" as hardcoded name', () => {
  const result = validateAndFixVariables('Mrs. Johnson will attend.');
  assert.ok(result.warnings.length > 0);
  assert.ok(result.warnings[0].includes('Mrs. Johnson'));
});

test('detects "Ms. Williams" as hardcoded name', () => {
  const result = validateAndFixVariables('Ms. Williams called.');
  assert.ok(result.warnings.length > 0);
  assert.ok(result.warnings[0].includes('Ms. Williams'));
});

test('handles multiple hardcoded greeting names', () => {
  const result = validateAndFixVariables('Hi John, and Hello Sarah, welcome!');
  assert.ok(result.fixed.includes('{{firstName}}'));
  assert.ok(!result.fixed.includes('Hi John'));
  assert.ok(!result.fixed.includes('Hello Sarah'));
});

test('detects common-word names like "Hi Will,"', () => {
  const result = validateAndFixVariables('Hi Will, thanks for your email.');
  assert.equal(result.fixed, 'Hi {{firstName}}, thanks for your email.');
  assert.ok(result.warnings.length > 0);
});

test('detects common-word names like "Dear Grace,"', () => {
  const result = validateAndFixVariables('Dear Grace, we appreciate your interest.');
  assert.equal(result.fixed, 'Dear {{firstName}}, we appreciate your interest.');
});

test('no warnings for content without names', () => {
  const result = validateAndFixVariables('Thank you for your interest in our product.');
  assert.equal(result.warnings.length, 0);
  assert.equal(result.fixed, 'Thank you for your interest in our product.');
});

test('does not match lowercase names like "Hi john,"', () => {
  const result = validateAndFixVariables('Hi john, how are you?');
  assert.equal(result.warnings.length, 0);
  assert.equal(result.fixed, 'Hi john, how are you?');
});

test('empty string returns no warnings', () => {
  const result = validateAndFixVariables('');
  assert.equal(result.warnings.length, 0);
  assert.equal(result.fixed, '');
});

// ============================================================
// 2. parseCSVLine tests
// ============================================================
console.log('\n=== parseCSVLine ===');

test('parses simple comma-separated values', () => {
  const result = parseCSVLine('john,doe,john@example.com');
  assert.deepEqual(result, ['john', 'doe', 'john@example.com']);
});

test('parses quoted values with commas inside', () => {
  const result = parseCSVLine('"Smith, John",doe@test.com,"Acme, Inc."');
  assert.deepEqual(result, ['Smith, John', 'doe@test.com', 'Acme, Inc.']);
});

test('handles escaped quotes (double-quote inside quoted field)', () => {
  const result = parseCSVLine('"He said ""hello""",value2');
  assert.deepEqual(result, ['He said "hello"', 'value2']);
});

test('handles empty fields', () => {
  const result = parseCSVLine('john,,doe');
  assert.deepEqual(result, ['john', '', 'doe']);
});

test('handles trailing comma (empty last field)', () => {
  const result = parseCSVLine('john,doe,');
  assert.deepEqual(result, ['john', 'doe', '']);
});

test('handles single field', () => {
  const result = parseCSVLine('hello');
  assert.deepEqual(result, ['hello']);
});

test('handles all empty fields', () => {
  const result = parseCSVLine(',,');
  assert.deepEqual(result, ['', '', '']);
});

test('handles unicode characters', () => {
  const result = parseCSVLine('Jose,Garcia,jose@empresa.com');
  assert.deepEqual(result, ['Jose', 'Garcia', 'jose@empresa.com']);
});

test('handles quoted field with newline-like content', () => {
  // Note: parseCSVLine processes a single line, so actual newlines would be split before
  const result = parseCSVLine('"field with spaces",normal');
  assert.deepEqual(result, ['field with spaces', 'normal']);
});

test('trims whitespace around unquoted values', () => {
  const result = parseCSVLine(' john , doe , test@test.com ');
  assert.deepEqual(result, ['john', 'doe', 'test@test.com']);
});

test('empty string returns array with one empty string', () => {
  const result = parseCSVLine('');
  assert.deepEqual(result, ['']);
});

// ============================================================
// 3. detectColumnFallback tests
// ============================================================
console.log('\n=== detectColumnFallback ===');

// Email variants
test('detects "email" as email', () => {
  assert.equal(detectColumnFallback('email'), 'email');
});

test('detects "Email Address" as email (includes "email")', () => {
  assert.equal(detectColumnFallback('Email Address'), 'email');
});

test('detects "e-mail" as email', () => {
  assert.equal(detectColumnFallback('e-mail'), 'email');
});

test('detects "correo" as email', () => {
  assert.equal(detectColumnFallback('correo'), 'email');
});

// First name variants
test('detects "first_name" as first_name', () => {
  assert.equal(detectColumnFallback('first_name'), 'first_name');
});

test('detects "firstname" as first_name', () => {
  assert.equal(detectColumnFallback('firstname'), 'first_name');
});

test('detects "First Name" as first_name (includes both "first" and "name")', () => {
  assert.equal(detectColumnFallback('First Name'), 'first_name');
});

test('detects "nombre" as first_name', () => {
  assert.equal(detectColumnFallback('nombre'), 'first_name');
});

test('detects "given_name" as first_name', () => {
  assert.equal(detectColumnFallback('given_name'), 'first_name');
});

test('detects "givenname" as first_name', () => {
  assert.equal(detectColumnFallback('givenname'), 'first_name');
});

// Last name variants
test('detects "last_name" as last_name', () => {
  assert.equal(detectColumnFallback('last_name'), 'last_name');
});

test('detects "lastname" as last_name', () => {
  assert.equal(detectColumnFallback('lastname'), 'last_name');
});

test('detects "apellido" as last_name', () => {
  assert.equal(detectColumnFallback('apellido'), 'last_name');
});

test('detects "surname" as last_name', () => {
  assert.equal(detectColumnFallback('surname'), 'last_name');
});

test('detects "family_name" as last_name', () => {
  assert.equal(detectColumnFallback('family_name'), 'last_name');
});

// Company variants
test('detects "company" as company', () => {
  assert.equal(detectColumnFallback('company'), 'company');
});

test('detects "organization" as company', () => {
  assert.equal(detectColumnFallback('organization'), 'company');
});

test('detects "org" as company', () => {
  assert.equal(detectColumnFallback('org'), 'company');
});

test('detects "empresa" as company', () => {
  assert.equal(detectColumnFallback('empresa'), 'company');
});

test('detects "organisation" as company', () => {
  assert.equal(detectColumnFallback('organisation'), 'company');
});

// Title variants
test('detects "title" as title', () => {
  assert.equal(detectColumnFallback('title'), 'title');
});

test('detects "job_title" as title', () => {
  assert.equal(detectColumnFallback('job_title'), 'title');
});

test('detects "position" as title (includes "position")', () => {
  assert.equal(detectColumnFallback('position'), 'title');
});

test('detects "role" as title', () => {
  assert.equal(detectColumnFallback('role'), 'title');
});

test('detects "cargo" as title', () => {
  assert.equal(detectColumnFallback('cargo'), 'title');
});

// Phone variants
test('detects "phone" as phone', () => {
  assert.equal(detectColumnFallback('phone'), 'phone');
});

test('detects "telefono" as phone', () => {
  assert.equal(detectColumnFallback('telefono'), 'phone');
});

test('detects "mobile" as phone', () => {
  assert.equal(detectColumnFallback('mobile'), 'phone');
});

// LinkedIn
test('detects "linkedin" as linkedin_url', () => {
  assert.equal(detectColumnFallback('linkedin'), 'linkedin_url');
});

test('detects "LinkedIn URL" as linkedin_url (includes "linkedin")', () => {
  assert.equal(detectColumnFallback('LinkedIn URL'), 'linkedin_url');
});

// Website
test('detects "website" as website', () => {
  assert.equal(detectColumnFallback('website'), 'website');
});

test('detects "url" as website', () => {
  assert.equal(detectColumnFallback('url'), 'website');
});

// Country / City / Timezone
test('detects "country" as country', () => {
  assert.equal(detectColumnFallback('country'), 'country');
});

test('detects "pais" as country', () => {
  assert.equal(detectColumnFallback('pais'), 'country');
});

test('detects "city" as city', () => {
  assert.equal(detectColumnFallback('city'), 'city');
});

test('detects "ciudad" as city', () => {
  assert.equal(detectColumnFallback('ciudad'), 'city');
});

test('detects "timezone" as timezone', () => {
  assert.equal(detectColumnFallback('timezone'), 'timezone');
});

test('detects "tz" as timezone', () => {
  assert.equal(detectColumnFallback('tz'), 'timezone');
});

test('detects "time_zone" as timezone', () => {
  assert.equal(detectColumnFallback('time_zone'), 'timezone');
});

// Case insensitivity
test('case insensitive: "EMAIL" maps to email', () => {
  assert.equal(detectColumnFallback('EMAIL'), 'email');
});

test('case insensitive: "COMPANY" maps to company', () => {
  assert.equal(detectColumnFallback('COMPANY'), 'company');
});

// Unknown header
test('returns null for unknown header "foo_bar"', () => {
  assert.equal(detectColumnFallback('foo_bar'), null);
});

test('returns null for empty string', () => {
  assert.equal(detectColumnFallback(''), null);
});

// ============================================================
// Summary
// ============================================================
console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
