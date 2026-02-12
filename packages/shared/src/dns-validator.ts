import * as dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);
const resolveMx = promisify(dns.resolveMx);

export interface SpfResult {
  valid: boolean;
  record: string | null;
  mechanisms: string[];
  includes: string[];
  policy: 'pass' | 'softfail' | 'hardfail' | 'neutral' | 'none';
  details?: string;
}

export interface DkimResult {
  valid: boolean;
  selector: string;
  record: string | null;
  publicKey: boolean;
  details?: string;
}

export interface DmarcResult {
  valid: boolean;
  record: string | null;
  policy: 'none' | 'quarantine' | 'reject' | null;
  subdomainPolicy: 'none' | 'quarantine' | 'reject' | null;
  percentage: number;
  rua: string[]; // Aggregate report addresses
  ruf: string[]; // Forensic report addresses
  details?: string;
}

export interface DnsValidationResult {
  domain: string;
  spf: SpfResult;
  dkim: DkimResult;
  dmarc: DmarcResult;
  hasMxRecords: boolean;
  mxRecords: string[];
  overallValid: boolean;
  score: number; // 0-100, higher is better
  recommendations: string[];
  validatedAt: Date;
}

/**
 * Parse SPF record
 */
export function parseSpfRecord(record: string): SpfResult {
  const result: SpfResult = {
    valid: false,
    record: record,
    mechanisms: [],
    includes: [],
    policy: 'none',
  };

  if (!record.startsWith('v=spf1')) {
    result.details = 'Invalid SPF version';
    return result;
  }

  result.valid = true;
  const parts = record.split(/\s+/);

  for (const part of parts) {
    if (part.startsWith('include:')) {
      result.includes.push(part.replace('include:', ''));
      result.mechanisms.push(part);
    } else if (part.startsWith('a') || part.startsWith('mx') || part.startsWith('ip4:') || part.startsWith('ip6:')) {
      result.mechanisms.push(part);
    } else if (part === '-all') {
      result.policy = 'hardfail';
    } else if (part === '~all') {
      result.policy = 'softfail';
    } else if (part === '+all') {
      result.policy = 'pass';
    } else if (part === '?all') {
      result.policy = 'neutral';
    }
  }

  return result;
}

/**
 * Check SPF record for a domain
 */
export async function checkSpf(domain: string): Promise<SpfResult> {
  try {
    const txtRecords = await resolveTxt(domain);
    const flatRecords = txtRecords.map(r => r.join('')).filter(r => r.startsWith('v=spf1'));

    if (flatRecords.length === 0) {
      return {
        valid: false,
        record: null,
        mechanisms: [],
        includes: [],
        policy: 'none',
        details: 'No SPF record found',
      };
    }

    if (flatRecords.length > 1) {
      return {
        valid: false,
        record: flatRecords[0],
        mechanisms: [],
        includes: [],
        policy: 'none',
        details: 'Multiple SPF records found (invalid)',
      };
    }

    return parseSpfRecord(flatRecords[0]);
  } catch (error: any) {
    return {
      valid: false,
      record: null,
      mechanisms: [],
      includes: [],
      policy: 'none',
      details: error.code === 'ENOTFOUND' ? 'Domain not found' : error.message,
    };
  }
}

/**
 * Check DKIM record for a domain with a specific selector
 */
export async function checkDkim(domain: string, selector: string = 'google'): Promise<DkimResult> {
  const dkimDomain = `${selector}._domainkey.${domain}`;

  try {
    const txtRecords = await resolveTxt(dkimDomain);
    const flatRecord = txtRecords.map(r => r.join('')).find(r => r.includes('v=DKIM1'));

    if (!flatRecord) {
      return {
        valid: false,
        selector,
        record: null,
        publicKey: false,
        details: `No DKIM record found for selector "${selector}"`,
      };
    }

    const hasPublicKey = flatRecord.includes('p=') && !flatRecord.includes('p=;');

    return {
      valid: hasPublicKey,
      selector,
      record: flatRecord,
      publicKey: hasPublicKey,
      details: hasPublicKey ? undefined : 'DKIM record found but no public key',
    };
  } catch (error: any) {
    return {
      valid: false,
      selector,
      record: null,
      publicKey: false,
      details: error.code === 'ENOTFOUND' ? 'DKIM record not found' : error.message,
    };
  }
}

/**
 * Try multiple common DKIM selectors
 */
export async function checkDkimMultipleSelectors(domain: string): Promise<DkimResult> {
  const commonSelectors = [
    'google', 'selector1', 'selector2', 's1', 's2', 'k1', 'k2',
    'mail', 'default', 'dkim', 'mx', 'email'
  ];

  for (const selector of commonSelectors) {
    const result = await checkDkim(domain, selector);
    if (result.valid) {
      return result;
    }
  }

  return {
    valid: false,
    selector: 'none',
    record: null,
    publicKey: false,
    details: 'No valid DKIM record found with common selectors',
  };
}

/**
 * Check DMARC record for a domain
 */
export async function checkDmarc(domain: string): Promise<DmarcResult> {
  const dmarcDomain = `_dmarc.${domain}`;

  try {
    const txtRecords = await resolveTxt(dmarcDomain);
    const flatRecord = txtRecords.map(r => r.join('')).find(r => r.startsWith('v=DMARC1'));

    if (!flatRecord) {
      return {
        valid: false,
        record: null,
        policy: null,
        subdomainPolicy: null,
        percentage: 100,
        rua: [],
        ruf: [],
        details: 'No DMARC record found',
      };
    }

    const result: DmarcResult = {
      valid: true,
      record: flatRecord,
      policy: null,
      subdomainPolicy: null,
      percentage: 100,
      rua: [],
      ruf: [],
    };

    // Parse DMARC tags
    const tags = flatRecord.split(';').map(t => t.trim());

    for (const tag of tags) {
      const [key, value] = tag.split('=').map(s => s?.trim());

      switch (key) {
        case 'p':
          if (value === 'none' || value === 'quarantine' || value === 'reject') {
            result.policy = value;
          }
          break;
        case 'sp':
          if (value === 'none' || value === 'quarantine' || value === 'reject') {
            result.subdomainPolicy = value;
          }
          break;
        case 'pct':
          result.percentage = parseInt(value, 10) || 100;
          break;
        case 'rua':
          result.rua = value?.split(',').map(v => v.trim().replace('mailto:', '')) || [];
          break;
        case 'ruf':
          result.ruf = value?.split(',').map(v => v.trim().replace('mailto:', '')) || [];
          break;
      }
    }

    // Subdomain policy defaults to main policy
    if (!result.subdomainPolicy) {
      result.subdomainPolicy = result.policy;
    }

    return result;
  } catch (error: any) {
    return {
      valid: false,
      record: null,
      policy: null,
      subdomainPolicy: null,
      percentage: 100,
      rua: [],
      ruf: [],
      details: error.code === 'ENOTFOUND' ? 'DMARC record not found' : error.message,
    };
  }
}

/**
 * Check MX records for a domain (internal function - exported from email-verification.ts)
 */
async function checkMxRecordsInternal(domain: string): Promise<{ hasMx: boolean; records: string[] }> {
  try {
    const mxRecords = await resolveMx(domain);
    const sortedRecords = mxRecords
      .sort((a, b) => a.priority - b.priority)
      .map(r => r.exchange);
    return { hasMx: sortedRecords.length > 0, records: sortedRecords };
  } catch {
    return { hasMx: false, records: [] };
  }
}

/**
 * Calculate DNS health score
 * 0-100, higher is better
 */
export function calculateDnsScore(result: DnsValidationResult): number {
  let score = 0;

  // MX records (20 points)
  if (result.hasMxRecords) {
    score += 20;
  }

  // SPF (30 points)
  if (result.spf.valid) {
    score += 15;
    if (result.spf.policy === 'hardfail' || result.spf.policy === 'softfail') {
      score += 15;
    } else if (result.spf.policy === 'neutral') {
      score += 5;
    }
  }

  // DKIM (25 points)
  if (result.dkim.valid) {
    score += 25;
  }

  // DMARC (25 points)
  if (result.dmarc.valid) {
    score += 10;
    if (result.dmarc.policy === 'reject') {
      score += 15;
    } else if (result.dmarc.policy === 'quarantine') {
      score += 10;
    } else if (result.dmarc.policy === 'none') {
      score += 5;
    }
  }

  return score;
}

/**
 * Generate recommendations based on DNS validation results
 */
export function generateRecommendations(result: DnsValidationResult): string[] {
  const recommendations: string[] = [];

  if (!result.hasMxRecords) {
    recommendations.push('CRITICAL: Add MX records to receive email');
  }

  if (!result.spf.valid) {
    recommendations.push('Add SPF record to authorize sending servers');
  } else if (result.spf.policy === 'none' || result.spf.policy === 'neutral') {
    recommendations.push('Strengthen SPF policy to ~all (softfail) or -all (hardfail)');
  }

  if (!result.dkim.valid) {
    recommendations.push('Configure DKIM to sign outgoing emails');
  }

  if (!result.dmarc.valid) {
    recommendations.push('Add DMARC record to protect against spoofing');
  } else if (result.dmarc.policy === 'none') {
    recommendations.push('Upgrade DMARC policy from "none" to "quarantine" or "reject"');
  }

  if (result.dmarc.valid && result.dmarc.rua.length === 0) {
    recommendations.push('Add DMARC aggregate report address (rua) for monitoring');
  }

  return recommendations;
}

/**
 * Full DNS validation for a domain
 */
export async function validateDns(
  domain: string,
  dkimSelector?: string
): Promise<DnsValidationResult> {
  const [spf, dkim, dmarc, mx] = await Promise.all([
    checkSpf(domain),
    dkimSelector ? checkDkim(domain, dkimSelector) : checkDkimMultipleSelectors(domain),
    checkDmarc(domain),
    checkMxRecordsInternal(domain),
  ]);

  const result: DnsValidationResult = {
    domain,
    spf,
    dkim,
    dmarc,
    hasMxRecords: mx.hasMx,
    mxRecords: mx.records,
    overallValid: false,
    score: 0,
    recommendations: [],
    validatedAt: new Date(),
  };

  result.score = calculateDnsScore(result);
  result.recommendations = generateRecommendations(result);

  // Overall valid if minimum requirements are met
  result.overallValid = result.hasMxRecords && result.spf.valid && result.score >= 50;

  return result;
}

/**
 * Quick check if domain meets minimum sending requirements
 */
export async function canSendEmail(domain: string): Promise<{ allowed: boolean; reason?: string }> {
  const mx = await checkMxRecordsInternal(domain);
  if (!mx.hasMx) {
    return { allowed: false, reason: 'No MX records' };
  }

  const spf = await checkSpf(domain);
  if (!spf.valid) {
    return { allowed: false, reason: 'No valid SPF record' };
  }

  return { allowed: true };
}

/**
 * Enforce DNS requirements before warmup/campaign
 * Returns true if all requirements are met
 */
export async function enforceDnsRequirements(
  domain: string,
  requirements: {
    requireSpf?: boolean;
    requireDkim?: boolean;
    requireDmarc?: boolean;
    minScore?: number;
  } = {}
): Promise<{ passed: boolean; result: DnsValidationResult; failures: string[] }> {
  const {
    requireSpf = true,
    requireDkim = false,
    requireDmarc = false,
    minScore = 35,
  } = requirements;

  const result = await validateDns(domain);
  const failures: string[] = [];

  if (!result.hasMxRecords) {
    failures.push('No MX records found');
  }

  if (requireSpf && !result.spf.valid) {
    failures.push('SPF record not found or invalid');
  }

  if (requireDkim && !result.dkim.valid) {
    failures.push('DKIM record not found or invalid');
  }

  if (requireDmarc && !result.dmarc.valid) {
    failures.push('DMARC record not found or invalid');
  }

  if (result.score < minScore) {
    failures.push(`DNS score ${result.score} is below minimum ${minScore}`);
  }

  return {
    passed: failures.length === 0,
    result,
    failures,
  };
}
