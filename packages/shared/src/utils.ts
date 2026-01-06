import crypto from 'crypto';

// ============================================
// String Utilities
// ============================================

/**
 * Process spintax in text: {Hello|Hi|Hey} -> random selection
 */
export function processSpintax(text: string): string {
  const spintaxRegex = /\{([^{}]+)\}/g;
  return text.replace(spintaxRegex, (_, options: string) => {
    const choices = options.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

/**
 * Inject variables into text: {{firstName}} -> John
 */
export function injectVariables(text: string, variables: Record<string, string | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return variables[key] ?? match;
  });
}

/**
 * Process both spintax and variables
 */
export function processEmailContent(template: string, variables: Record<string, string | undefined>): string {
  let content = processSpintax(template);
  content = injectVariables(content, variables);
  return content;
}

/**
 * Generate a random delay within a range
 */
export function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs) + minMs);
}

/**
 * Generate a slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================
// Email Utilities
// ============================================

/**
 * Extract domain from email
 */
export function getEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

/**
 * Detect ESP from email
 */
export function detectEsp(email: string): 'gmail' | 'microsoft' | 'other' {
  const domain = getEmailDomain(email);

  const gmailDomains = ['gmail.com', 'googlemail.com'];
  const microsoftDomains = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'];

  if (gmailDomains.includes(domain)) return 'gmail';
  if (microsoftDomains.includes(domain)) return 'microsoft';
  return 'other';
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Strip HTML tags from text
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract preview text from email body
 */
export function extractPreview(body: string, maxLength = 500): string {
  const text = stripHtml(body);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

// ============================================
// Warmup Utilities
// ============================================

/**
 * Calculate inbox health score based on warmup metrics
 * Returns a score from 0-100
 */
export function calculateHealthScore(metrics: {
  warmupEnabled: boolean;
  currentDay: number;
  sentTotal: number;
  repliedTotal: number;
  bounceRate?: number;
  spamRate?: number;
}): number {
  const { warmupEnabled, currentDay, sentTotal, repliedTotal, bounceRate = 0, spamRate = 0 } = metrics;

  // If warmup is not enabled or never started, health is 0
  if (!warmupEnabled && currentDay === 0) {
    return 0;
  }

  let score = 0;

  // Base score from warmup days (max 40 points)
  // Day 30+ = full 40 points
  const dayScore = Math.min(currentDay / 30, 1) * 40;
  score += dayScore;

  // Reply rate score (max 30 points)
  // Target: 30%+ reply rate = full points
  if (sentTotal > 0) {
    const replyRate = repliedTotal / sentTotal;
    const replyScore = Math.min(replyRate / 0.3, 1) * 30;
    score += replyScore;
  }

  // Volume score (max 20 points)
  // 500+ emails sent = full points
  const volumeScore = Math.min(sentTotal / 500, 1) * 20;
  score += volumeScore;

  // Engagement bonus (max 10 points)
  // Based on consistent activity
  if (warmupEnabled && currentDay > 7) {
    score += 10;
  } else if (warmupEnabled && currentDay > 0) {
    score += 5;
  }

  // Penalties
  // Bounce rate penalty (0-10% penalty based on bounce rate)
  score -= bounceRate * 10;

  // Spam rate penalty (more severe, 0-20% penalty)
  score -= spamRate * 20;

  // Clamp between 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate warmup quota based on day number
 */
export function calculateWarmupQuota(dayNumber: number, rampSpeed: 'slow' | 'normal' | 'fast'): number {
  const multiplier = rampSpeed === 'slow' ? 0.7 : rampSpeed === 'fast' ? 1.5 : 1;

  const rampUpTable = [
    { days: [1, 2], quota: 2 },
    { days: [3, 4], quota: 4 },
    { days: [5, 7], quota: 8 },
    { days: [8, 10], quota: 12 },
    { days: [11, 14], quota: 18 },
    { days: [15, 21], quota: 25 },
    { days: [22, 30], quota: 35 },
    { days: [31, Infinity], quota: 40 },
  ];

  for (const tier of rampUpTable) {
    if (dayNumber >= tier.days[0] && dayNumber <= tier.days[1]) {
      return Math.floor(tier.quota * multiplier);
    }
  }

  return Math.floor(40 * multiplier);
}

// ============================================
// Rate Limiting
// ============================================

export interface RateLimitConfig {
  daily: number;
  hourly: number;
  perMinute?: number;
}

export const ESP_RATE_LIMITS: Record<string, RateLimitConfig> = {
  'gmail.com': { daily: 500, hourly: 20, perMinute: 20 },
  'googlemail.com': { daily: 500, hourly: 20, perMinute: 20 },
  'outlook.com': { daily: 300, hourly: 30, perMinute: 10 },
  'hotmail.com': { daily: 300, hourly: 30, perMinute: 10 },
  'live.com': { daily: 300, hourly: 30, perMinute: 10 },
  'default': { daily: 100, hourly: 20, perMinute: 5 },
};

export function getEspLimits(email: string): RateLimitConfig {
  const domain = getEmailDomain(email);
  return ESP_RATE_LIMITS[domain] ?? ESP_RATE_LIMITS['default'];
}

// ============================================
// Encryption
// ============================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encrypt(text: string, key: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const keyBuffer = Buffer.from(key, 'base64');
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encrypted: string, key: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const [ivHex, authTagHex, encryptedText] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const keyBuffer = Buffer.from(key, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ============================================
// Webhook Utilities
// ============================================

export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ============================================
// Date Utilities
// ============================================

export function isWithinSendWindow(
  now: Date,
  startTime: string,
  endTime: string,
  timezone: string,
  sendDays: string[]
): boolean {
  // Get current time in the specified timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);
  const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
  const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase().slice(0, 3) ?? 'mon';

  // Check day
  if (!sendDays.includes(weekday)) {
    return false;
  }

  // Check time
  const currentTime = `${hour}:${minute}`;
  return currentTime >= startTime && currentTime <= endTime;
}

export function getNextSendWindow(
  now: Date,
  startTime: string,
  timezone: string,
  sendDays: string[]
): Date {
  const result = new Date(now);
  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

  // Try next 7 days
  for (let i = 0; i < 7; i++) {
    result.setDate(result.getDate() + (i === 0 ? 0 : 1));

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    });
    const weekday = formatter.format(result).toLowerCase().slice(0, 3);

    if (sendDays.includes(weekday)) {
      // Set to start time
      const [hours, minutes] = startTime.split(':').map(Number);
      result.setHours(hours, minutes, 0, 0);

      if (result > now) {
        return result;
      }
    }
  }

  // Fallback to next day at start time
  result.setDate(now.getDate() + 1);
  const [hours, minutes] = startTime.split(':').map(Number);
  result.setHours(hours, minutes, 0, 0);
  return result;
}
