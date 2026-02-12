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

console.log('\n=== Smart Template: Context Building Tests ===\n');

// ==========================================
// API Service version (camelCase fields)
// Matches ai.service.ts buildLeadContextBlock
// ==========================================
function buildLeadContextBlock_API(lead: {
  firstName?: string; lastName?: string; company?: string; title?: string;
  analysisNotes?: string; country?: string; city?: string;
  linkedinUrl?: string; website?: string;
}): string {
  const sections: string[] = [];

  const profile: string[] = [];
  if (lead.firstName || lead.lastName) {
    profile.push(`- Name: ${[lead.firstName, lead.lastName].filter(Boolean).join(' ')}`);
  }
  if (lead.title) profile.push(`- Title: ${lead.title}`);
  if (lead.company) profile.push(`- Company: ${lead.company}`);
  if (profile.length > 0) {
    sections.push(`RECIPIENT PROFILE:\n${profile.join('\n')}`);
  }

  const location: string[] = [];
  if (lead.country) location.push(`- Country: ${lead.country}`);
  if (lead.city) location.push(`- City: ${lead.city}`);
  if (location.length > 0) {
    sections.push(`LOCATION:\n${location.join('\n')}`);
  }

  const digital: string[] = [];
  if (lead.linkedinUrl) digital.push(`- LinkedIn: ${lead.linkedinUrl}`);
  if (lead.website) digital.push(`- Website: ${lead.website}`);
  if (digital.length > 0) {
    sections.push(`DIGITAL PRESENCE:\n${digital.join('\n')}`);
  }

  if (lead.analysisNotes) {
    sections.push(`RESEARCH NOTES:\n${lead.analysisNotes}`);
  }

  return sections.length > 0 ? sections.join('\n\n') : 'No lead information available.';
}

// ==========================================
// Worker version (snake_case fields)
// Matches email-sender.ts buildLeadContextBlock
// ==========================================
function buildLeadContextBlock_Worker(lead: any): string {
  const sections: string[] = [];

  const profile: string[] = [];
  if (lead?.first_name || lead?.last_name) {
    profile.push(`- Name: ${[lead?.first_name, lead?.last_name].filter(Boolean).join(' ')}`);
  }
  if (lead?.title) profile.push(`- Title: ${lead.title}`);
  if (lead?.company) profile.push(`- Company: ${lead.company}`);
  if (profile.length > 0) {
    sections.push(`RECIPIENT PROFILE:\n${profile.join('\n')}`);
  }

  const location: string[] = [];
  if (lead?.country) location.push(`- Country: ${lead.country}`);
  if (lead?.city) location.push(`- City: ${lead.city}`);
  if (location.length > 0) {
    sections.push(`LOCATION:\n${location.join('\n')}`);
  }

  const digital: string[] = [];
  if (lead?.linkedin_url) digital.push(`- LinkedIn: ${lead.linkedin_url}`);
  if (lead?.website) digital.push(`- Website: ${lead.website}`);
  if (digital.length > 0) {
    sections.push(`DIGITAL PRESENCE:\n${digital.join('\n')}`);
  }

  if (lead?.analysis_notes) {
    sections.push(`RESEARCH NOTES:\n${lead.analysis_notes}`);
  }

  return sections.length > 0 ? sections.join('\n\n') : 'No lead information available.';
}

// ==========================================
// API Service version (camelCase fields)
// Matches ai.service.ts buildSenderContextBlock
// ==========================================
function buildSenderContextBlock_API(sender?: {
  firstName?: string; lastName?: string; company?: string;
  title?: string; website?: string;
}): string {
  if (!sender) return '';

  const lines: string[] = [];
  if (sender.firstName || sender.lastName) {
    lines.push(`- Name: ${[sender.firstName, sender.lastName].filter(Boolean).join(' ')}`);
  }
  if (sender.title) lines.push(`- Title: ${sender.title}`);
  if (sender.company) lines.push(`- Company: ${sender.company}`);
  if (sender.website) lines.push(`- Website: ${sender.website}`);

  return lines.length > 0 ? `SENDER PROFILE:\n${lines.join('\n')}` : '';
}

// ==========================================
// Worker version (snake_case inbox fields)
// Matches email-sender.ts buildSenderContextBlock
// ==========================================
function buildSenderContextBlock_Worker(inbox: any): string {
  const lines: string[] = [];
  if (inbox?.sender_first_name || inbox?.sender_last_name) {
    lines.push(`- Name: ${[inbox.sender_first_name, inbox.sender_last_name].filter(Boolean).join(' ')}`);
  }
  if (inbox?.sender_title) lines.push(`- Title: ${inbox.sender_title}`);
  if (inbox?.sender_company) lines.push(`- Company: ${inbox.sender_company}`);
  if (inbox?.sender_website) lines.push(`- Website: ${inbox.sender_website}`);

  return lines.length > 0 ? `SENDER PROFILE:\n${lines.join('\n')}` : '';
}

// ==========================================
// buildLeadContextBlock tests (API version)
// ==========================================
console.log('--- buildLeadContextBlock (API - camelCase) ---\n');

test('full lead data produces all sections', () => {
  const result = buildLeadContextBlock_API({
    firstName: 'Sarah',
    lastName: 'Chen',
    title: 'VP of Engineering',
    company: 'Acme Corp',
    country: 'United States',
    city: 'San Francisco',
    linkedinUrl: 'linkedin.com/in/sarahchen',
    website: 'acmecorp.com',
    analysisNotes: 'Recently raised $15M Series B',
  });
  assert.ok(result.includes('RECIPIENT PROFILE:'));
  assert.ok(result.includes('- Name: Sarah Chen'));
  assert.ok(result.includes('- Title: VP of Engineering'));
  assert.ok(result.includes('- Company: Acme Corp'));
  assert.ok(result.includes('LOCATION:'));
  assert.ok(result.includes('- Country: United States'));
  assert.ok(result.includes('- City: San Francisco'));
  assert.ok(result.includes('DIGITAL PRESENCE:'));
  assert.ok(result.includes('- LinkedIn: linkedin.com/in/sarahchen'));
  assert.ok(result.includes('- Website: acmecorp.com'));
  assert.ok(result.includes('RESEARCH NOTES:'));
  assert.ok(result.includes('Recently raised $15M Series B'));
});

test('empty lead returns fallback message', () => {
  const result = buildLeadContextBlock_API({});
  assert.equal(result, 'No lead information available.');
});

test('only name produces only profile section', () => {
  const result = buildLeadContextBlock_API({ firstName: 'John' });
  assert.ok(result.includes('RECIPIENT PROFILE:'));
  assert.ok(result.includes('- Name: John'));
  assert.ok(!result.includes('LOCATION:'));
  assert.ok(!result.includes('DIGITAL PRESENCE:'));
  assert.ok(!result.includes('RESEARCH NOTES:'));
});

test('only location produces only location section', () => {
  const result = buildLeadContextBlock_API({ country: 'Germany' });
  assert.ok(!result.includes('RECIPIENT PROFILE:'));
  assert.ok(result.includes('LOCATION:'));
  assert.ok(result.includes('- Country: Germany'));
});

test('only digital presence produces only digital section', () => {
  const result = buildLeadContextBlock_API({ linkedinUrl: 'linkedin.com/in/test' });
  assert.ok(!result.includes('RECIPIENT PROFILE:'));
  assert.ok(result.includes('DIGITAL PRESENCE:'));
});

test('only analysis notes produces only research section', () => {
  const result = buildLeadContextBlock_API({ analysisNotes: 'Hiring 3 SDRs' });
  assert.ok(!result.includes('RECIPIENT PROFILE:'));
  assert.ok(result.includes('RESEARCH NOTES:'));
  assert.ok(result.includes('Hiring 3 SDRs'));
});

test('first name only (no last name)', () => {
  const result = buildLeadContextBlock_API({ firstName: 'Sarah' });
  assert.ok(result.includes('- Name: Sarah'));
  // filter(Boolean).join(' ') with only firstName should not add trailing space
  assert.ok(!result.includes('- Name: Sarah '));
});

test('last name only (no first name)', () => {
  const result = buildLeadContextBlock_API({ lastName: 'Chen' });
  assert.ok(result.includes('- Name: Chen'));
});

test('company without name or title still shows in profile', () => {
  const result = buildLeadContextBlock_API({ company: 'Acme Corp' });
  assert.ok(result.includes('RECIPIENT PROFILE:'));
  assert.ok(result.includes('- Company: Acme Corp'));
});

test('city without country shows only city', () => {
  const result = buildLeadContextBlock_API({ city: 'Berlin' });
  assert.ok(result.includes('LOCATION:'));
  assert.ok(result.includes('- City: Berlin'));
  assert.ok(!result.includes('Country'));
});

test('country without city shows only country', () => {
  const result = buildLeadContextBlock_API({ country: 'Japan' });
  assert.ok(result.includes('- Country: Japan'));
  assert.ok(!result.includes('City'));
});

test('website without linkedin shows only website', () => {
  const result = buildLeadContextBlock_API({ website: 'example.com' });
  assert.ok(result.includes('- Website: example.com'));
  assert.ok(!result.includes('LinkedIn'));
});

test('linkedin without website shows only linkedin', () => {
  const result = buildLeadContextBlock_API({ linkedinUrl: 'linkedin.com/in/test' });
  assert.ok(result.includes('- LinkedIn: linkedin.com/in/test'));
  assert.ok(!result.includes('Website'));
});

test('special characters in data are preserved', () => {
  const result = buildLeadContextBlock_API({
    firstName: "O'Brien",
    company: 'AT&T Inc.',
    analysisNotes: 'Revenue: $5M+, Growth: 200%',
  });
  assert.ok(result.includes("O'Brien"));
  assert.ok(result.includes('AT&T Inc.'));
  assert.ok(result.includes('$5M+'));
});

test('XSS payload in lead data is preserved as-is (no HTML escaping needed for AI)', () => {
  const result = buildLeadContextBlock_API({
    firstName: '<script>alert("xss")</script>',
    company: '"><img src=x onerror=alert(1)>',
  });
  // The context block is sent to AI, not rendered in HTML, so raw data is fine
  assert.ok(result.includes('<script>'));
  assert.ok(result.includes('"><img'));
});

test('sections are separated by double newlines', () => {
  const result = buildLeadContextBlock_API({
    firstName: 'Sarah',
    country: 'US',
    linkedinUrl: 'linkedin.com/in/sarah',
    analysisNotes: 'Notes here',
  });
  // Check that sections are separated by \n\n
  const sections = result.split('\n\n');
  assert.ok(sections.length >= 4);
});

// ==========================================
// buildLeadContextBlock tests (Worker version)
// ==========================================
console.log('\n--- buildLeadContextBlock (Worker - snake_case) ---\n');

test('worker: handles snake_case fields (first_name, last_name)', () => {
  const result = buildLeadContextBlock_Worker({ first_name: 'John', last_name: 'Doe' });
  assert.ok(result.includes('- Name: John Doe'));
});

test('worker: handles snake_case linkedin_url', () => {
  const result = buildLeadContextBlock_Worker({ linkedin_url: 'linkedin.com/in/johndoe' });
  assert.ok(result.includes('- LinkedIn: linkedin.com/in/johndoe'));
});

test('worker: handles snake_case analysis_notes', () => {
  const result = buildLeadContextBlock_Worker({ analysis_notes: 'Key decision maker' });
  assert.ok(result.includes('RESEARCH NOTES:'));
  assert.ok(result.includes('Key decision maker'));
});

test('worker: null lead returns fallback message', () => {
  const result = buildLeadContextBlock_Worker(null);
  assert.equal(result, 'No lead information available.');
});

test('worker: undefined lead returns fallback message', () => {
  const result = buildLeadContextBlock_Worker(undefined);
  assert.equal(result, 'No lead information available.');
});

test('worker: full lead data with snake_case produces all sections', () => {
  const result = buildLeadContextBlock_Worker({
    first_name: 'Sarah',
    last_name: 'Chen',
    title: 'VP of Engineering',
    company: 'Acme Corp',
    country: 'United States',
    city: 'San Francisco',
    linkedin_url: 'linkedin.com/in/sarahchen',
    website: 'acmecorp.com',
    analysis_notes: 'Recently raised $15M Series B',
  });
  assert.ok(result.includes('RECIPIENT PROFILE:'));
  assert.ok(result.includes('- Name: Sarah Chen'));
  assert.ok(result.includes('- Title: VP of Engineering'));
  assert.ok(result.includes('- Company: Acme Corp'));
  assert.ok(result.includes('LOCATION:'));
  assert.ok(result.includes('DIGITAL PRESENCE:'));
  assert.ok(result.includes('RESEARCH NOTES:'));
});

// ==========================================
// buildSenderContextBlock tests (API version)
// ==========================================
console.log('\n--- buildSenderContextBlock (API - camelCase) ---\n');

test('full sender data produces complete block', () => {
  const result = buildSenderContextBlock_API({
    firstName: 'Alex',
    lastName: 'Smith',
    title: 'Account Executive',
    company: 'SalesTech Inc',
    website: 'salestech.io',
  });
  assert.ok(result.includes('SENDER PROFILE:'));
  assert.ok(result.includes('- Name: Alex Smith'));
  assert.ok(result.includes('- Title: Account Executive'));
  assert.ok(result.includes('- Company: SalesTech Inc'));
  assert.ok(result.includes('- Website: salestech.io'));
});

test('undefined sender returns empty string', () => {
  const result = buildSenderContextBlock_API(undefined);
  assert.equal(result, '');
});

test('empty sender object returns empty string', () => {
  const result = buildSenderContextBlock_API({});
  assert.equal(result, '');
});

test('sender with only name', () => {
  const result = buildSenderContextBlock_API({ firstName: 'Alex' });
  assert.ok(result.includes('SENDER PROFILE:'));
  assert.ok(result.includes('- Name: Alex'));
  assert.ok(!result.includes('Title'));
  assert.ok(!result.includes('Company'));
});

test('sender with only company', () => {
  const result = buildSenderContextBlock_API({ company: 'Acme Inc' });
  assert.ok(result.includes('- Company: Acme Inc'));
  assert.ok(!result.includes('Name'));
});

// ==========================================
// buildSenderContextBlock tests (Worker version)
// ==========================================
console.log('\n--- buildSenderContextBlock (Worker - snake_case) ---\n');

test('worker: sender with snake_case fields from inbox', () => {
  const result = buildSenderContextBlock_Worker({
    sender_first_name: 'Alex',
    sender_last_name: 'Smith',
    sender_company: 'Acme',
    sender_title: 'CEO',
    sender_website: 'acme.com',
  });
  assert.ok(result.includes('- Name: Alex Smith'));
  assert.ok(result.includes('- Title: CEO'));
  assert.ok(result.includes('- Company: Acme'));
  assert.ok(result.includes('- Website: acme.com'));
});

test('worker: null inbox returns empty string', () => {
  const result = buildSenderContextBlock_Worker(null);
  assert.equal(result, '');
});

test('worker: undefined inbox returns empty string', () => {
  const result = buildSenderContextBlock_Worker(undefined);
  assert.equal(result, '');
});

test('worker: empty inbox object returns empty string', () => {
  const result = buildSenderContextBlock_Worker({});
  assert.equal(result, '');
});

test('worker: inbox with only sender_company', () => {
  const result = buildSenderContextBlock_Worker({ sender_company: 'Acme' });
  assert.ok(result.includes('- Company: Acme'));
  assert.ok(!result.includes('Name'));
});

// ==========================================
// Cross-version consistency
// ==========================================
console.log('\n--- Cross-Version Consistency ---\n');

test('API and worker produce equivalent output for same data', () => {
  const apiResult = buildLeadContextBlock_API({
    firstName: 'Sarah',
    lastName: 'Chen',
    title: 'VP Engineering',
    company: 'Acme',
    country: 'US',
    city: 'SF',
    linkedinUrl: 'linkedin.com/in/sarah',
    website: 'acme.com',
    analysisNotes: 'Good lead',
  });
  const workerResult = buildLeadContextBlock_Worker({
    first_name: 'Sarah',
    last_name: 'Chen',
    title: 'VP Engineering',
    company: 'Acme',
    country: 'US',
    city: 'SF',
    linkedin_url: 'linkedin.com/in/sarah',
    website: 'acme.com',
    analysis_notes: 'Good lead',
  });
  assert.equal(apiResult, workerResult);
});

test('API and worker sender blocks produce equivalent output for same data', () => {
  const apiResult = buildSenderContextBlock_API({
    firstName: 'Alex',
    lastName: 'Smith',
    title: 'AE',
    company: 'SalesCo',
    website: 'sales.co',
  });
  const workerResult = buildSenderContextBlock_Worker({
    sender_first_name: 'Alex',
    sender_last_name: 'Smith',
    sender_title: 'AE',
    sender_company: 'SalesCo',
    sender_website: 'sales.co',
  });
  assert.equal(apiResult, workerResult);
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
