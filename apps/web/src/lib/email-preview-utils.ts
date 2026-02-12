// ============================================
// Email Preview Utilities
// Client-side template processing for preview
// ============================================

export interface LeadData {
  id?: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  title?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  website?: string | null;
  country?: string | null;
  city?: string | null;
}

export interface InboxData {
  id?: string;
  email?: string;
  from_name?: string | null;
  sender_first_name?: string | null;
  sender_last_name?: string | null;
  sender_company?: string | null;
  sender_title?: string | null;
  sender_phone?: string | null;
  sender_website?: string | null;
}

export interface AnnotatedSegment {
  type: 'text' | 'variable';
  text: string;
  varName?: string;
  value?: string;
  fallback?: string;
  isMissing?: boolean;
  usedFallback?: boolean;
}

export interface VariableSummaryEntry {
  name: string;
  label: string;
  category: 'Receiver' | 'Sender';
  value?: string;
  isResolved: boolean;
}

/**
 * Build a comprehensive variable map from lead + inbox data.
 * Supports both camelCase and snake_case keys.
 */
export function buildVariableMap(
  lead?: LeadData | null,
  inbox?: InboxData | null,
): Record<string, string> {
  const vars: Record<string, string> = {};

  if (lead) {
    if (lead.first_name) {
      vars.firstName = lead.first_name;
      vars.first_name = lead.first_name;
    }
    if (lead.last_name) {
      vars.lastName = lead.last_name;
      vars.last_name = lead.last_name;
    }
    if (lead.email) {
      vars.email = lead.email;
    }
    if (lead.company) {
      vars.company = lead.company;
    }
    if (lead.title) {
      vars.title = lead.title;
    }
    if (lead.phone) {
      vars.phone = lead.phone;
    }
    if (lead.linkedin_url) {
      vars.linkedin_url = lead.linkedin_url;
      vars.linkedinUrl = lead.linkedin_url;
    }
    if (lead.website) {
      vars.website = lead.website;
    }
    if (lead.country) {
      vars.country = lead.country;
    }
    if (lead.city) {
      vars.city = lead.city;
    }

    const fullName = `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim();
    if (fullName) {
      vars.fullName = fullName;
      vars.full_name = fullName;
    }
  }

  if (inbox) {
    if (inbox.sender_first_name) {
      vars.senderFirstName = inbox.sender_first_name;
      vars.sender_first_name = inbox.sender_first_name;
    }
    if (inbox.sender_last_name) {
      vars.senderLastName = inbox.sender_last_name;
      vars.sender_last_name = inbox.sender_last_name;
    }
    if (inbox.sender_company) {
      vars.senderCompany = inbox.sender_company;
      vars.sender_company = inbox.sender_company;
    }
    if (inbox.sender_title) {
      vars.senderTitle = inbox.sender_title;
      vars.sender_title = inbox.sender_title;
    }
    if (inbox.sender_phone) {
      vars.senderPhone = inbox.sender_phone;
      vars.sender_phone = inbox.sender_phone;
    }
    if (inbox.sender_website) {
      vars.senderWebsite = inbox.sender_website;
      vars.sender_website = inbox.sender_website;
    }
    if (inbox.from_name) {
      vars.fromName = inbox.from_name;
      vars.from_name = inbox.from_name;
    }
    if (inbox.email) {
      vars.fromEmail = inbox.email;
      vars.from_email = inbox.email;
    }
  }

  return vars;
}

/**
 * Process conditionals in template text.
 * Handles {if:var}...{/if}, {if:var}...{else}...{/if}, {ifnot:var}...{/ifnot}
 */
function processConditionals(text: string, vars: Record<string, string>): string {
  let result = text;

  // {if:var}content{else}fallback{/if}
  result = result.replace(
    /\{if:(\w+)\}([\s\S]*?)\{else\}([\s\S]*?)\{\/if\}/g,
    (_, variable: string, ifContent: string, elseContent: string) => {
      const value = vars[variable];
      return value && value.trim() !== '' ? ifContent : elseContent;
    },
  );

  // {if:var}content{/if}
  result = result.replace(
    /\{if:(\w+)\}([\s\S]*?)\{\/if\}/g,
    (_, variable: string, content: string) => {
      const value = vars[variable];
      return value && value.trim() !== '' ? content : '';
    },
  );

  // {ifnot:var}content{/ifnot}
  result = result.replace(
    /\{ifnot:(\w+)\}([\s\S]*?)\{\/ifnot\}/g,
    (_, variable: string, content: string) => {
      const value = vars[variable];
      return !value || value.trim() === '' ? content : '';
    },
  );

  return result;
}

/**
 * Deterministic spintax variation generation.
 * Returns up to maxCount unique variations from spintax patterns.
 */
export function getSpintaxVariations(text: string, maxCount = 6): string[] {
  const spintaxRegex = /\{([^{}|]+(?:\|[^{}|]+)+)\}/g;
  const matches: { full: string; options: string[] }[] = [];
  let match;

  while ((match = spintaxRegex.exec(text)) !== null) {
    matches.push({ full: match[0], options: match[1].split('|') });
  }

  if (matches.length === 0) return [text];

  // Generate deterministic combinations
  const results: string[] = [];
  const totalCombos = matches.reduce((acc, m) => acc * m.options.length, 1);
  const count = Math.min(totalCombos, maxCount);

  for (let i = 0; i < count; i++) {
    let variant = text;
    let divisor = 1;

    for (const m of matches) {
      const optionIndex = Math.floor(i / divisor) % m.options.length;
      variant = variant.replace(m.full, m.options[optionIndex]);
      divisor *= m.options.length;
    }

    if (!results.includes(variant)) {
      results.push(variant);
    }
  }

  return results;
}

/**
 * Process fallback variables: {{var|fallback}} → value or fallback
 */
function processFallbacks(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\|([^}]+)\}\}/g, (_, key: string, fallback: string) => {
    const value = vars[key];
    return value && value.trim() !== '' ? value : fallback;
  });
}

/**
 * Annotate a template into segments for the annotated view.
 * Returns text segments and variable segments with resolved values.
 * Processes conditionals and spintax first, then annotates remaining variables.
 */
export function annotateTemplate(
  raw: string,
  variables: Record<string, string>,
  spintaxVariation = 0,
): AnnotatedSegment[] {
  // Step 1: process conditionals
  let processed = processConditionals(raw, variables);

  // Step 2: apply spintax variation
  const variations = getSpintaxVariations(processed);
  processed = variations[spintaxVariation % variations.length];

  // Step 3: annotate variables (both with and without fallbacks)
  const segments: AnnotatedSegment[] = [];
  const regex = /\{\{(\w+)(?:\|([^}]+))?\}\}/g;
  let lastIndex = 0;
  let m;

  while ((m = regex.exec(processed)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', text: processed.slice(lastIndex, m.index) });
    }

    const varName = m[1];
    const fallback = m[2];
    const value = variables[varName];
    const resolved = value || fallback || undefined;

    segments.push({
      type: 'variable',
      text: m[0],
      varName,
      value: value || undefined,
      fallback: fallback || undefined,
      isMissing: !resolved,
      usedFallback: !value && !!fallback,
    });

    lastIndex = m.index + m[0].length;
  }

  if (lastIndex < processed.length) {
    segments.push({ type: 'text', text: processed.slice(lastIndex) });
  }

  return segments;
}

/**
 * Fully resolve a template to final rendered text.
 * Processes: conditionals → fallbacks → spintax → variables
 */
export function resolveTemplate(
  raw: string,
  variables: Record<string, string>,
  spintaxVariation = 0,
): string {
  let result = processConditionals(raw, variables);
  result = processFallbacks(result, variables);

  const variations = getSpintaxVariations(result);
  result = variations[spintaxVariation % variations.length];

  // Inject remaining variables
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return variables[key] ?? '';
  });

  return result;
}

/**
 * Generate a variable summary for the variable panel.
 * Lists all known variables with their resolved status.
 */
export function getVariableSummary(
  variables: Record<string, string>,
  templateText?: string,
): { entries: VariableSummaryEntry[]; resolvedCount: number; totalCount: number } {
  // Canonical receiver variables
  const receiverVars: { name: string; label: string }[] = [
    { name: 'firstName', label: 'First Name' },
    { name: 'lastName', label: 'Last Name' },
    { name: 'email', label: 'Email' },
    { name: 'company', label: 'Company' },
    { name: 'title', label: 'Title' },
    { name: 'phone', label: 'Phone' },
    { name: 'fullName', label: 'Full Name' },
  ];

  // Canonical sender variables
  const senderVars: { name: string; label: string }[] = [
    { name: 'senderFirstName', label: 'First Name' },
    { name: 'senderLastName', label: 'Last Name' },
    { name: 'fromEmail', label: 'Email' },
    { name: 'senderCompany', label: 'Company' },
    { name: 'senderTitle', label: 'Title' },
    { name: 'senderPhone', label: 'Phone' },
    { name: 'senderWebsite', label: 'Website' },
    { name: 'fromName', label: 'Display Name' },
  ];

  // If template text is provided, only show variables that are used
  let usedVarNames: Set<string> | null = null;
  if (templateText) {
    usedVarNames = new Set<string>();
    const regex = /\{\{(\w+)(?:\|[^}]+)?\}\}/g;
    let match;
    while ((match = regex.exec(templateText)) !== null) {
      usedVarNames.add(match[1]);
    }
  }

  const entries: VariableSummaryEntry[] = [];

  for (const v of receiverVars) {
    if (usedVarNames && !usedVarNames.has(v.name) && !usedVarNames.has(toSnakeCase(v.name))) {
      continue;
    }
    entries.push({
      name: v.name,
      label: v.label,
      category: 'Receiver',
      value: variables[v.name],
      isResolved: !!variables[v.name],
    });
  }

  for (const v of senderVars) {
    if (usedVarNames && !usedVarNames.has(v.name) && !usedVarNames.has(toSnakeCase(v.name))) {
      continue;
    }
    entries.push({
      name: v.name,
      label: v.label,
      category: 'Sender',
      value: variables[v.name],
      isResolved: !!variables[v.name],
    });
  }

  const resolvedCount = entries.filter((e) => e.isResolved).length;

  return { entries, resolvedCount, totalCount: entries.length };
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
