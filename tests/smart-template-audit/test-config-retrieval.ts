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

console.log('\n=== Smart Template: Config Retrieval Tests ===\n');

// Reimplement the config retrieval logic for testing
// This mirrors the logic in email-sender.ts getSmartTemplateConfig
// The actual method does DB queries, but the config mapping logic is what we test
interface SmartTemplateConfig {
  enabled: boolean;
  tone: string;
  toneEnabled: boolean;
  languageMatch: boolean;
  notes: string | null;
}

function getSmartTemplateConfig(
  variantData: any | null,
  sequenceData: any | null,
): SmartTemplateConfig {
  // Try variant-level config first (matches worker: checks variantData?.smart_template_enabled != null)
  if (variantData && variantData.smart_template_enabled != null) {
    return {
      enabled: !!variantData.smart_template_enabled,
      tone: variantData.smart_template_tone || 'professional',
      toneEnabled: !!variantData.smart_template_tone_enabled,
      languageMatch: variantData.smart_template_language_match !== false,
      notes: variantData.smart_template_notes || null,
    };
  }

  // Fall back to sequence-level config
  return {
    enabled: !!sequenceData?.smart_template_enabled,
    tone: sequenceData?.smart_template_tone || 'professional',
    toneEnabled: !!sequenceData?.smart_template_tone_enabled,
    languageMatch: sequenceData?.smart_template_language_match !== false,
    notes: sequenceData?.smart_template_notes || null,
  };
}

// ==========================================
// Variant priority tests
// ==========================================
console.log('--- Variant Priority ---\n');

test('variant config takes priority when both exist', () => {
  const config = getSmartTemplateConfig(
    { smart_template_enabled: true, smart_template_tone: 'casual', smart_template_tone_enabled: true, smart_template_language_match: false, smart_template_notes: 'Variant notes' },
    { smart_template_enabled: false, smart_template_tone: 'professional', smart_template_tone_enabled: false, smart_template_language_match: true, smart_template_notes: 'Sequence notes' },
  );
  assert.equal(config.enabled, true);
  assert.equal(config.tone, 'casual');
  assert.equal(config.toneEnabled, true);
  assert.equal(config.languageMatch, false);
  assert.equal(config.notes, 'Variant notes');
});

test('falls back to sequence when variant is null', () => {
  const config = getSmartTemplateConfig(
    null,
    { smart_template_enabled: true, smart_template_tone: 'friendly', smart_template_tone_enabled: true, smart_template_language_match: true, smart_template_notes: 'Seq notes' },
  );
  assert.equal(config.enabled, true);
  assert.equal(config.tone, 'friendly');
  assert.equal(config.notes, 'Seq notes');
});

test('falls back to sequence when variant smart_template_enabled is null', () => {
  const config = getSmartTemplateConfig(
    { smart_template_enabled: null },
    { smart_template_enabled: true, smart_template_tone: 'persuasive' },
  );
  assert.equal(config.enabled, true);
  assert.equal(config.tone, 'persuasive');
});

test('variant disabled overrides sequence enabled', () => {
  const config = getSmartTemplateConfig(
    { smart_template_enabled: false },
    { smart_template_enabled: true },
  );
  assert.equal(config.enabled, false);
});

test('variant enabled with undefined sequence still works', () => {
  const config = getSmartTemplateConfig(
    { smart_template_enabled: true, smart_template_tone: 'casual', smart_template_tone_enabled: true },
    null,
  );
  assert.equal(config.enabled, true);
  assert.equal(config.tone, 'casual');
});

test('variant with smart_template_enabled=undefined falls back to sequence', () => {
  const config = getSmartTemplateConfig(
    { smart_template_enabled: undefined },
    { smart_template_enabled: true, smart_template_tone: 'urgent' },
  );
  // undefined != null is false, so it falls through to sequence
  assert.equal(config.enabled, true);
  assert.equal(config.tone, 'urgent');
});

// ==========================================
// Default values tests
// ==========================================
console.log('\n--- Default Values ---\n');

test('defaults when no data exists', () => {
  const config = getSmartTemplateConfig(null, null);
  assert.equal(config.enabled, false);
  assert.equal(config.tone, 'professional');
  assert.equal(config.toneEnabled, false);
  assert.equal(config.languageMatch, true);
  assert.equal(config.notes, null);
});

test('defaults when sequence has empty object', () => {
  const config = getSmartTemplateConfig(null, {});
  assert.equal(config.enabled, false);
  assert.equal(config.tone, 'professional');
  assert.equal(config.toneEnabled, false);
  assert.equal(config.languageMatch, true);
  assert.equal(config.notes, null);
});

test('enabled defaults to false', () => {
  const config = getSmartTemplateConfig(null, { smart_template_tone: 'casual' });
  assert.equal(config.enabled, false);
});

test('tone defaults to professional', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true });
  assert.equal(config.tone, 'professional');
});

test('toneEnabled defaults to false', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true });
  assert.equal(config.toneEnabled, false);
});

test('languageMatch defaults to true', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true });
  assert.equal(config.languageMatch, true);
});

test('notes defaults to null', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true });
  assert.equal(config.notes, null);
});

test('empty string tone falls back to professional', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true, smart_template_tone: '' });
  assert.equal(config.tone, 'professional');
});

test('empty string notes becomes null', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true, smart_template_notes: '' });
  assert.equal(config.notes, null);
});

// ==========================================
// languageMatch edge cases
// ==========================================
console.log('\n--- Language Match Edge Cases ---\n');

test('languageMatch explicitly false', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true, smart_template_language_match: false });
  assert.equal(config.languageMatch, false);
});

test('languageMatch explicitly true', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true, smart_template_language_match: true });
  assert.equal(config.languageMatch, true);
});

test('languageMatch null defaults to true (null !== false is true)', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true, smart_template_language_match: null });
  assert.equal(config.languageMatch, true);
});

test('languageMatch undefined defaults to true (undefined !== false is true)', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true, smart_template_language_match: undefined });
  assert.equal(config.languageMatch, true);
});

// ==========================================
// Tone types
// ==========================================
console.log('\n--- Tone Types ---\n');

test('casual tone preserved', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true, smart_template_tone: 'casual' });
  assert.equal(config.tone, 'casual');
});

test('friendly tone preserved', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true, smart_template_tone: 'friendly' });
  assert.equal(config.tone, 'friendly');
});

test('persuasive tone preserved', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true, smart_template_tone: 'persuasive' });
  assert.equal(config.tone, 'persuasive');
});

test('urgent tone preserved', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true, smart_template_tone: 'urgent' });
  assert.equal(config.tone, 'urgent');
});

test('empathetic tone preserved', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: true, smart_template_tone: 'empathetic' });
  assert.equal(config.tone, 'empathetic');
});

// ==========================================
// Boolean coercion
// ==========================================
console.log('\n--- Boolean Coercion ---\n');

test('enabled truthy values: 1 -> true', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: 1 });
  assert.equal(config.enabled, true);
});

test('enabled falsy values: 0 -> false', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: 0 });
  assert.equal(config.enabled, false);
});

test('toneEnabled truthy values: 1 -> true', () => {
  const config = getSmartTemplateConfig({ smart_template_enabled: true, smart_template_tone_enabled: 1 }, null);
  assert.equal(config.toneEnabled, true);
});

test('enabled truthy values: "true" string -> true', () => {
  const config = getSmartTemplateConfig(null, { smart_template_enabled: 'true' });
  assert.equal(config.enabled, true);
});

test('variant with all null fields except enabled falls back correctly', () => {
  const config = getSmartTemplateConfig(
    { smart_template_enabled: true, smart_template_tone: null, smart_template_tone_enabled: null, smart_template_language_match: null, smart_template_notes: null },
    { smart_template_enabled: false, smart_template_tone: 'casual' },
  );
  // Variant takes priority because smart_template_enabled != null
  assert.equal(config.enabled, true);
  assert.equal(config.tone, 'professional'); // null || 'professional'
  assert.equal(config.toneEnabled, false); // !!null
  assert.equal(config.languageMatch, true); // null !== false
  assert.equal(config.notes, null); // null || null
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
