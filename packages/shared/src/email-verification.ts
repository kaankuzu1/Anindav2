import * as dns from 'dns';
import * as net from 'net';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

export type EmailVerificationStatus =
  | 'unverified'
  | 'verifying'
  | 'valid'
  | 'invalid'
  | 'catch_all'
  | 'risky'
  | 'unknown';

export interface EmailVerificationResult {
  email: string;
  status: EmailVerificationStatus;
  domain: string;
  mxRecords: string[];
  isValidSyntax: boolean;
  hasMxRecords: boolean;
  smtpConnectable: boolean;
  isCatchAll: boolean | null;
  riskScore: number; // 0-100, higher is riskier
  verifiedAt: Date;
  details?: string;
}

/**
 * Validate email syntax using regex
 */
export function isValidEmailSyntax(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

/**
 * Extract domain from email address
 */
export function extractDomain(email: string): string {
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

/**
 * Check MX records for a domain
 */
export async function checkMxRecords(domain: string): Promise<{ hasMx: boolean; records: string[] }> {
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
 * Test SMTP connection to verify mail server is reachable
 * This does NOT send any email - just tests the connection
 */
export async function testSmtpConnection(
  mxHost: string,
  timeout: number = 10000
): Promise<{ connectable: boolean; response?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let response = '';

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      // Connection successful, wait for SMTP banner
    });

    socket.on('data', (data) => {
      response += data.toString();
      // Check for SMTP banner (220 response)
      if (response.includes('220')) {
        socket.destroy();
        resolve({ connectable: true, response: response.trim() });
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ connectable: false, response: 'Connection timeout' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ connectable: false, response: err.message });
    });

    socket.on('close', () => {
      if (!response.includes('220')) {
        resolve({ connectable: false, response: response || 'Connection closed' });
      }
    });

    // Connect to port 25 (SMTP)
    try {
      socket.connect(25, mxHost);
    } catch {
      resolve({ connectable: false, response: 'Failed to initiate connection' });
    }
  });
}

/**
 * Detect if domain is a catch-all (accepts any email address)
 * This is done by testing a random non-existent address
 */
export async function detectCatchAll(
  mxHost: string,
  domain: string,
  timeout: number = 15000
): Promise<{ isCatchAll: boolean | null; details?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const randomLocal = `verify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const testEmail = `${randomLocal}@${domain}`;
    let step = 0;
    let response = '';

    socket.setTimeout(timeout);

    const sendCommand = (cmd: string) => {
      socket.write(cmd + '\r\n');
    };

    socket.on('connect', () => {
      // Wait for banner
    });

    socket.on('data', (data) => {
      response += data.toString();

      // Process SMTP dialogue
      if (step === 0 && response.includes('220')) {
        step = 1;
        sendCommand(`HELO verify.local`);
        response = '';
      } else if (step === 1 && response.includes('250')) {
        step = 2;
        sendCommand(`MAIL FROM:<verify@verify.local>`);
        response = '';
      } else if (step === 2 && response.includes('250')) {
        step = 3;
        sendCommand(`RCPT TO:<${testEmail}>`);
        response = '';
      } else if (step === 3) {
        // Check RCPT response
        sendCommand('QUIT');
        socket.destroy();

        if (response.includes('250')) {
          // Server accepted the random address = catch-all
          resolve({ isCatchAll: true, details: 'Server accepts any address' });
        } else if (response.includes('550') || response.includes('551') || response.includes('553')) {
          // Server rejected the random address = not catch-all
          resolve({ isCatchAll: false, details: 'Server validates addresses' });
        } else {
          // Unclear response
          resolve({ isCatchAll: null, details: response.trim() });
        }
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ isCatchAll: null, details: 'SMTP timeout' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ isCatchAll: null, details: err.message });
    });

    try {
      socket.connect(25, mxHost);
    } catch {
      resolve({ isCatchAll: null, details: 'Failed to connect' });
    }
  });
}

/**
 * Calculate risk score based on verification results
 * 0 = lowest risk (safest), 100 = highest risk
 */
export function calculateRiskScore(result: Partial<EmailVerificationResult>): number {
  let score = 0;

  // Invalid syntax = highest risk
  if (!result.isValidSyntax) {
    return 100;
  }

  // No MX records = very high risk
  if (!result.hasMxRecords) {
    return 90;
  }

  // SMTP not connectable = high risk
  if (!result.smtpConnectable) {
    score += 40;
  }

  // Catch-all domains are risky (hard to verify individual addresses)
  if (result.isCatchAll === true) {
    score += 30;
  }

  // Free email providers are lower risk
  const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
  if (result.domain && freeProviders.includes(result.domain.toLowerCase())) {
    score = Math.max(0, score - 20);
  }

  return Math.min(100, score);
}

/**
 * Full email verification
 */
export async function verifyEmail(
  email: string,
  options: { skipSmtp?: boolean; skipCatchAll?: boolean; timeout?: number } = {}
): Promise<EmailVerificationResult> {
  const { skipSmtp = false, skipCatchAll = false, timeout = 10000 } = options;

  const result: EmailVerificationResult = {
    email: email.toLowerCase(),
    status: 'unverified',
    domain: '',
    mxRecords: [],
    isValidSyntax: false,
    hasMxRecords: false,
    smtpConnectable: false,
    isCatchAll: null,
    riskScore: 100,
    verifiedAt: new Date(),
  };

  // Step 1: Syntax validation
  result.isValidSyntax = isValidEmailSyntax(email);
  if (!result.isValidSyntax) {
    result.status = 'invalid';
    result.details = 'Invalid email syntax';
    result.riskScore = calculateRiskScore(result);
    return result;
  }

  // Step 2: Extract domain
  result.domain = extractDomain(email);
  if (!result.domain) {
    result.status = 'invalid';
    result.details = 'Could not extract domain';
    result.riskScore = calculateRiskScore(result);
    return result;
  }

  // Step 3: Check MX records
  const mxResult = await checkMxRecords(result.domain);
  result.hasMxRecords = mxResult.hasMx;
  result.mxRecords = mxResult.records;

  if (!result.hasMxRecords) {
    result.status = 'invalid';
    result.details = 'No MX records found';
    result.riskScore = calculateRiskScore(result);
    return result;
  }

  // Step 4: SMTP connectivity test (optional)
  if (!skipSmtp && result.mxRecords.length > 0) {
    const smtpResult = await testSmtpConnection(result.mxRecords[0], timeout);
    result.smtpConnectable = smtpResult.connectable;
  } else {
    result.smtpConnectable = true; // Assume connectable if skipped
  }

  // Step 5: Catch-all detection (optional)
  if (!skipCatchAll && result.smtpConnectable && result.mxRecords.length > 0) {
    const catchAllResult = await detectCatchAll(result.mxRecords[0], result.domain, timeout);
    result.isCatchAll = catchAllResult.isCatchAll;
    if (catchAllResult.details) {
      result.details = catchAllResult.details;
    }
  }

  // Calculate final risk score
  result.riskScore = calculateRiskScore(result);

  // Determine status
  if (result.isCatchAll === true) {
    result.status = 'catch_all';
  } else if (result.riskScore <= 20) {
    result.status = 'valid';
  } else if (result.riskScore <= 50) {
    result.status = 'risky';
  } else {
    result.status = 'unknown';
  }

  return result;
}

/**
 * Batch verify multiple emails
 */
export async function verifyEmailBatch(
  emails: string[],
  options: { concurrency?: number; skipSmtp?: boolean; skipCatchAll?: boolean } = {}
): Promise<EmailVerificationResult[]> {
  const { concurrency = 5, ...verifyOptions } = options;
  const results: EmailVerificationResult[] = [];

  // Process in batches to respect concurrency
  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(email => verifyEmail(email, verifyOptions))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Quick syntax-only validation (no network calls)
 */
export function quickValidate(email: string): { valid: boolean; domain: string } {
  const valid = isValidEmailSyntax(email);
  const domain = valid ? extractDomain(email) : '';
  return { valid, domain };
}
