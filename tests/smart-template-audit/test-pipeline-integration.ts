import assert from 'node:assert/strict';
import * as fs from 'node:fs';

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

console.log('\n=== Smart Template: Pipeline Integration Tests ===\n');

// Import the shared template engine
import { processEmailContent, getLanguageFromCountry } from '../../packages/shared/src/index';

// ==========================================
// Pipeline step determination
// ==========================================

function hasPlaceholders(subject: string, body: string): boolean {
  const regex = /\[([^\[\]]+)\]/g;
  return regex.test(subject) || regex.test(body);
}

function needsToneOrLanguage(tone: string, toneEnabled: boolean, country: string | undefined, languageMatch: boolean): boolean {
  const language = languageMatch ? getLanguageFromCountry(country) : 'English';
  const needsTone = toneEnabled && tone !== 'professional';
  const needsTranslation = languageMatch && language !== 'English';
  return needsTone || needsTranslation;
}

console.log('--- Pipeline Step Determination ---\n');

test('placeholders only -> step 1 runs', () => {
  assert.ok(hasPlaceholders('Subject', 'Body [placeholder]'));
  assert.ok(!needsToneOrLanguage('professional', false, undefined, true));
});

test('tone only -> step 2 runs', () => {
  assert.ok(!hasPlaceholders('Subject', 'Body without placeholders'));
  assert.ok(needsToneOrLanguage('casual', true, undefined, true));
});

test('language only -> step 2 runs', () => {
  assert.ok(!hasPlaceholders('Subject', 'Body'));
  assert.ok(needsToneOrLanguage('professional', false, 'Germany', true));
});

test('both placeholders and tone -> both steps run', () => {
  assert.ok(hasPlaceholders('Subject', 'Body [placeholder]'));
  assert.ok(needsToneOrLanguage('casual', true, undefined, true));
});

test('neither -> no steps run', () => {
  assert.ok(!hasPlaceholders('Subject', 'Body'));
  assert.ok(!needsToneOrLanguage('professional', false, undefined, true));
});

test('professional tone with English does not trigger step 2', () => {
  assert.ok(!needsToneOrLanguage('professional', true, 'United States', true));
});

test('professional tone disabled does not trigger step 2', () => {
  assert.ok(!needsToneOrLanguage('casual', false, undefined, true));
});

test('languageMatch disabled prevents translation even with non-English country', () => {
  assert.ok(!needsToneOrLanguage('professional', false, 'Germany', false));
});

test('subject placeholders detected', () => {
  assert.ok(hasPlaceholders('[catchy subject]', 'Normal body'));
});

test('body placeholders detected', () => {
  assert.ok(hasPlaceholders('Normal subject', '[personalized opening]'));
});

// ==========================================
// Variable preservation through pipeline
// ==========================================
console.log('\n--- Variable Preservation ---\n');

test('{{variables}} preserved through processEmailContent', () => {
  const result = processEmailContent('Hi {{firstName}}, this is about {{company}}', {});
  // Unknown variables are preserved
  assert.ok(result.includes('{{firstName}}'));
  assert.ok(result.includes('{{company}}'));
});

test('{{variables}} resolved when values provided', () => {
  const result = processEmailContent('Hi {{firstName}}, welcome to {{company}}', {
    firstName: 'Sarah',
    company: 'Acme Corp',
  });
  assert.equal(result, 'Hi Sarah, welcome to Acme Corp');
});

test('spintax preserved when no variables present', () => {
  // processEmailContent resolves spintax, so we verify it produces one of the options
  const result = processEmailContent('{Hello|Hi|Hey} there', {});
  assert.ok(['Hello there', 'Hi there', 'Hey there'].includes(result));
});

test('conditional blocks work with variables', () => {
  const withCompany = processEmailContent('{if:company}At {{company}}.{/if} Done.', { company: 'Acme' });
  assert.ok(withCompany.includes('At Acme. Done.'));

  const withoutCompany = processEmailContent('{if:company}At {{company}}.{/if} Done.', {});
  assert.equal(withoutCompany.trim(), 'Done.');
});

test('fallback variables work', () => {
  const result = processEmailContent('{{company|your company}}', {});
  assert.equal(result, 'your company');

  const withValue = processEmailContent('{{company|your company}}', { company: 'Acme' });
  assert.equal(withValue, 'Acme');
});

test('HTML tags preserved through processEmailContent', () => {
  const result = processEmailContent('<p>Hi {{firstName}},</p><br><a href="https://example.com">Link</a>', {
    firstName: 'Sarah',
  });
  assert.ok(result.includes('<p>'));
  assert.ok(result.includes('</p>'));
  assert.ok(result.includes('<br>'));
  assert.ok(result.includes('<a href="https://example.com">'));
});

test('mixed template syntax preserved through pipeline', () => {
  const result = processEmailContent(
    '{Hi|Hello} {{firstName}}, {if:company}at {{company}}{/if}. {{unknown_var}}',
    { firstName: 'Sarah', company: 'Acme' }
  );
  assert.ok(result.includes('Sarah'));
  assert.ok(result.includes('Acme'));
  assert.ok(result.includes('{{unknown_var}}'));
});

// ==========================================
// Temperature verification
// ==========================================
console.log('\n--- Temperature Verification ---\n');

test('API callOpenRouter has temperature parameter with default 0.7', () => {
  const aiServiceCode = fs.readFileSync('apps/api/src/modules/ai/ai.service.ts', 'utf-8');
  assert.ok(aiServiceCode.includes('temperature: number = 0.7'),
    'callOpenRouter should have temperature parameter with default 0.7');
});

test('API personalizeEmail calls callOpenRouter with 0.4', () => {
  const aiServiceCode = fs.readFileSync('apps/api/src/modules/ai/ai.service.ts', 'utf-8');
  // Find the personalizeEmail method and check it calls callOpenRouter with 0.4
  const personalizeStart = aiServiceCode.indexOf('async personalizeEmail(');
  const personalizeSection = aiServiceCode.slice(personalizeStart);
  const nextMethodIndex = personalizeSection.indexOf('async applyToneAndLanguage(');
  const personalizeBody = personalizeSection.slice(0, nextMethodIndex);
  assert.ok(personalizeBody.includes(', 0.4)'), 'personalizeEmail should pass 0.4 as temperature');
});

test('API applyToneAndLanguage calls callOpenRouter with 0.4', () => {
  const aiServiceCode = fs.readFileSync('apps/api/src/modules/ai/ai.service.ts', 'utf-8');
  const toneStart = aiServiceCode.indexOf('async applyToneAndLanguage(');
  const toneSection = aiServiceCode.slice(toneStart);
  assert.ok(toneSection.includes(', 0.4)'), 'applyToneAndLanguage should pass 0.4 as temperature');
});

test('API callOpenRouter body uses temperature parameter (not hardcoded)', () => {
  const aiServiceCode = fs.readFileSync('apps/api/src/modules/ai/ai.service.ts', 'utf-8');
  // Get the callOpenRouter method body
  const methodStart = aiServiceCode.indexOf('private async callOpenRouter(');
  const methodSection = aiServiceCode.slice(methodStart);
  // Find the JSON.stringify block which is the request body
  const jsonStart = methodSection.indexOf('JSON.stringify({');
  const jsonEnd = methodSection.indexOf('})', jsonStart);
  const jsonBody = methodSection.slice(jsonStart, jsonEnd);
  // Should contain shorthand `temperature,` (not `temperature: 0.7`)
  assert.ok(jsonBody.includes('temperature,') || jsonBody.includes('temperature\n'),
    'callOpenRouter body should use the temperature parameter variable');
});

test('worker personalizeWithAI uses temperature 0.4', () => {
  const workerCode = fs.readFileSync('apps/workers/src/email-sender.ts', 'utf-8');
  const personalizeStart = workerCode.indexOf('private async personalizeWithAI(');
  const personalizeSection = workerCode.slice(personalizeStart);
  const nextMethodIndex = personalizeSection.indexOf('private async applyToneAndLanguage(');
  const personalizeBody = personalizeSection.slice(0, nextMethodIndex);
  assert.ok(personalizeBody.includes('temperature: 0.4'), 'worker personalizeWithAI should use temperature 0.4');
});

test('worker applyToneAndLanguage uses temperature 0.4', () => {
  const workerCode = fs.readFileSync('apps/workers/src/email-sender.ts', 'utf-8');
  const toneStart = workerCode.indexOf('private async applyToneAndLanguage(');
  const toneSection = workerCode.slice(toneStart);
  assert.ok(toneSection.includes('temperature: 0.4'), 'worker applyToneAndLanguage should use temperature 0.4');
});

// ==========================================
// Subject scanning verification
// ==========================================
console.log('\n--- Subject Scanning Verification ---\n');

test('API service personalizeEmail scans subject for placeholders', () => {
  const code = fs.readFileSync('apps/api/src/modules/ai/ai.service.ts', 'utf-8');
  const personalizeSection = code.slice(code.indexOf('async personalizeEmail('));
  assert.ok(personalizeSection.includes('subjectPlaceholders'),
    'personalizeEmail should extract subject placeholders');
});

test('worker personalizeWithAI scans subject for placeholders', () => {
  const code = fs.readFileSync('apps/workers/src/email-sender.ts', 'utf-8');
  const personalizeSection = code.slice(code.indexOf('personalizeWithAI('));
  assert.ok(personalizeSection.includes('subjectPlaceholders'),
    'worker personalizeWithAI should extract subject placeholders');
});

test('API service processes subject placeholders separately from body', () => {
  const code = fs.readFileSync('apps/api/src/modules/ai/ai.service.ts', 'utf-8');
  const personalizeStart = code.indexOf('async personalizeEmail(');
  const personalizeSection = code.slice(personalizeStart);
  const nextMethod = personalizeSection.indexOf('async applyToneAndLanguage(');
  const methodBody = personalizeSection.slice(0, nextMethod);

  assert.ok(methodBody.includes('resultSubject'), 'Should have resultSubject variable');
  assert.ok(methodBody.includes('resultBody'), 'Should have resultBody variable');
});

// ==========================================
// Expert prompt verification
// ==========================================
console.log('\n--- Expert Prompt Verification ---\n');

test('API service uses expert system prompt with anti-patterns', () => {
  const code = fs.readFileSync('apps/api/src/modules/ai/ai.service.ts', 'utf-8');
  assert.ok(code.includes('elite B2B cold email copywriter'), 'Should have expert role');
  assert.ok(code.includes("CRITICAL DON'TS"), 'Should have anti-pattern section');
  assert.ok(code.includes('EXAMPLES OF GOOD OUTPUT'), 'Should have good examples');
  assert.ok(code.includes('EXAMPLES OF BAD OUTPUT'), 'Should have bad examples');
  assert.ok(code.includes('I hope this finds you well'), 'Should warn against generic filler');
});

test('worker uses same expert system prompt', () => {
  const code = fs.readFileSync('apps/workers/src/email-sender.ts', 'utf-8');
  assert.ok(code.includes('elite B2B cold email copywriter'), 'Worker should have expert role');
  assert.ok(code.includes("CRITICAL DON'TS"), 'Worker should have anti-pattern section');
  assert.ok(code.includes('EXAMPLES OF GOOD OUTPUT'), 'Worker should have good examples');
});

test('API applyToneAndLanguage uses absolute rules prompt', () => {
  const code = fs.readFileSync('apps/api/src/modules/ai/ai.service.ts', 'utf-8');
  assert.ok(code.includes('ABSOLUTE RULES'), 'Should have ABSOLUTE RULES');
  assert.ok(code.includes('BREAKING THESE FAILS THE TASK'), 'Should emphasize consequences');
});

test('worker applyToneAndLanguage uses absolute rules prompt', () => {
  const code = fs.readFileSync('apps/workers/src/email-sender.ts', 'utf-8');
  assert.ok(code.includes('ABSOLUTE RULES'), 'Worker should have ABSOLUTE RULES');
  assert.ok(code.includes('BREAKING THESE FAILS THE TASK'), 'Worker should emphasize consequences');
});

// ==========================================
// analysis_notes import fix verification
// ==========================================
console.log('\n--- analysis_notes Import Fix ---\n');

test('CreateLeadInput includes analysis_notes field', () => {
  const code = fs.readFileSync('apps/api/src/modules/leads/leads.service.ts', 'utf-8');

  // Find the CreateLeadInput interface
  const interfaceStart = code.indexOf('export interface CreateLeadInput');
  const interfaceEnd = code.indexOf('}', interfaceStart);
  const interfaceBody = code.slice(interfaceStart, interfaceEnd);

  assert.ok(interfaceBody.includes('analysis_notes'),
    'CreateLeadInput should include analysis_notes field');
});

// ==========================================
// Sender context verification
// ==========================================
console.log('\n--- Sender Context ---\n');

test('API personalizeEmail accepts sender parameter', () => {
  const code = fs.readFileSync('apps/api/src/modules/ai/ai.service.ts', 'utf-8');
  const personalizeStart = code.indexOf('async personalizeEmail(');
  const personalizeSection = code.slice(personalizeStart);
  // The method signature spans multiple lines with nested type literals containing {}.
  // Look for the ): Promise<...> { pattern that marks end of signature.
  const bodyStart = personalizeSection.indexOf('): Promise<');
  const signature = personalizeSection.slice(0, bodyStart);

  assert.ok(signature.includes('sender'), 'personalizeEmail should accept sender parameter');
});

test('worker personalizeWithAI accepts inbox parameter', () => {
  const code = fs.readFileSync('apps/workers/src/email-sender.ts', 'utf-8');
  const personalizeStart = code.indexOf('private async personalizeWithAI(');
  const personalizeSection = code.slice(personalizeStart);
  const methodSignatureEnd = personalizeSection.indexOf('{');
  const signature = personalizeSection.slice(0, methodSignatureEnd);

  assert.ok(signature.includes('inbox'), 'worker personalizeWithAI should accept inbox parameter');
});

test('worker processJob passes inbox to personalizeWithAI', () => {
  const code = fs.readFileSync('apps/workers/src/email-sender.ts', 'utf-8');
  // Find the personalizeWithAI call in processJob
  const processJobStart = code.indexOf('private async processJob(');
  const processJobSection = code.slice(processJobStart);
  const personalizeCallIdx = processJobSection.indexOf('personalizeWithAI(');
  const personalizeCall = processJobSection.slice(personalizeCallIdx);
  const callEnd = personalizeCall.indexOf(';');
  const callArgs = personalizeCall.slice(0, callEnd);

  assert.ok(callArgs.includes('inbox'), 'processJob should pass inbox to personalizeWithAI');
});

test('campaign test service passes sender context to personalizeEmail', () => {
  const code = fs.readFileSync('apps/api/src/modules/campaigns/campaign-test.service.ts', 'utf-8');
  // The personalizeEmail call should include sender fields
  assert.ok(code.includes('sender_first_name') || code.includes('senderFirstName'),
    'campaign test service should pass sender context');
});

// ==========================================
// Expanded lead data
// ==========================================
console.log('\n--- Expanded Lead Data ---\n');

test('AI controller accepts country in lead type', () => {
  const code = fs.readFileSync('apps/api/src/modules/ai/ai.controller.ts', 'utf-8');
  // Find the personalizeEmail endpoint body type
  const personalizeSection = code.slice(code.indexOf('personalizeEmail'));
  const leadTypeSection = personalizeSection.slice(personalizeSection.indexOf('lead:'));

  assert.ok(leadTypeSection.includes('country'), 'AI controller lead type should include country');
});

test('AI controller accepts linkedinUrl in lead type', () => {
  const code = fs.readFileSync('apps/api/src/modules/ai/ai.controller.ts', 'utf-8');
  const personalizeSection = code.slice(code.indexOf('personalizeEmail'));
  assert.ok(personalizeSection.includes('linkedinUrl'), 'AI controller lead type should include linkedinUrl');
});

test('campaign test service testLead accepts linkedin_url', () => {
  const code = fs.readFileSync('apps/api/src/modules/campaigns/campaign-test.service.ts', 'utf-8');
  const testLeadStart = code.indexOf('testLead:');
  const testLeadSection = code.slice(testLeadStart);
  const typeEnd = testLeadSection.indexOf('}');
  const typeBody = testLeadSection.slice(0, typeEnd);

  assert.ok(typeBody.includes('linkedin_url'), 'TestEmailInput.testLead should include linkedin_url');
});

test('campaign test service testLead accepts website', () => {
  const code = fs.readFileSync('apps/api/src/modules/campaigns/campaign-test.service.ts', 'utf-8');
  const testLeadStart = code.indexOf('testLead:');
  const testLeadSection = code.slice(testLeadStart);
  const typeEnd = testLeadSection.indexOf('}');
  const typeBody = testLeadSection.slice(0, typeEnd);

  assert.ok(typeBody.includes('website'), 'TestEmailInput.testLead should include website');
});

// ==========================================
// getLanguageFromCountry integration
// ==========================================
console.log('\n--- getLanguageFromCountry Integration ---\n');

test('getLanguageFromCountry returns English for US', () => {
  assert.equal(getLanguageFromCountry('US'), 'English');
  assert.equal(getLanguageFromCountry('United States'), 'English');
});

test('getLanguageFromCountry returns German for Germany', () => {
  assert.equal(getLanguageFromCountry('Germany'), 'German');
  assert.equal(getLanguageFromCountry('DE'), 'German');
});

test('getLanguageFromCountry returns English for null/undefined', () => {
  assert.equal(getLanguageFromCountry(null), 'English');
  assert.equal(getLanguageFromCountry(undefined), 'English');
});

test('getLanguageFromCountry is case-insensitive', () => {
  assert.equal(getLanguageFromCountry('germany'), 'German');
  assert.equal(getLanguageFromCountry('GERMANY'), 'German');
  assert.equal(getLanguageFromCountry('Germany'), 'German');
});

test('getLanguageFromCountry returns English for unknown country', () => {
  assert.equal(getLanguageFromCountry('Atlantis'), 'English');
});

test('needsToneOrLanguage correctly integrates with getLanguageFromCountry', () => {
  // Germany -> German != English -> needs translation
  assert.ok(needsToneOrLanguage('professional', false, 'Germany', true));
  // US -> English -> no translation needed
  assert.ok(!needsToneOrLanguage('professional', false, 'United States', true));
  // Japan -> Japanese != English -> needs translation
  assert.ok(needsToneOrLanguage('professional', false, 'Japan', true));
  // languageMatch=false -> no translation regardless
  assert.ok(!needsToneOrLanguage('professional', false, 'Japan', false));
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
