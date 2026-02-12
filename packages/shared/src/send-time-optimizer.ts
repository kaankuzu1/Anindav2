/**
 * Send Time Optimizer
 * 
 * Calculates optimal send times based on:
 * - Lead timezone (inferred from email domain or explicit)
 * - Historical open data per lead
 * - Day of week preferences (Tue-Thu best)
 * - Default send window (9-11am local time)
 */

// Country code to timezone mapping for domain inference
const DOMAIN_TIMEZONE_MAP: Record<string, string> = {
  // Europe
  'uk': 'Europe/London',
  'co.uk': 'Europe/London',
  'de': 'Europe/Berlin',
  'fr': 'Europe/Paris',
  'es': 'Europe/Madrid',
  'it': 'Europe/Rome',
  'nl': 'Europe/Amsterdam',
  'be': 'Europe/Brussels',
  'ch': 'Europe/Zurich',
  'at': 'Europe/Vienna',
  'pl': 'Europe/Warsaw',
  'se': 'Europe/Stockholm',
  'no': 'Europe/Oslo',
  'dk': 'Europe/Copenhagen',
  'fi': 'Europe/Helsinki',
  'ie': 'Europe/Dublin',
  'pt': 'Europe/Lisbon',
  'cz': 'Europe/Prague',
  'gr': 'Europe/Athens',
  'ru': 'Europe/Moscow',
  
  // Americas
  'us': 'America/New_York', // Default to ET, will be refined
  'ca': 'America/Toronto',
  'mx': 'America/Mexico_City',
  'br': 'America/Sao_Paulo',
  'ar': 'America/Buenos_Aires',
  'cl': 'America/Santiago',
  'co': 'America/Bogota',
  'pe': 'America/Lima',
  
  // Asia Pacific
  'au': 'Australia/Sydney',
  'nz': 'Pacific/Auckland',
  'jp': 'Asia/Tokyo',
  'cn': 'Asia/Shanghai',
  'hk': 'Asia/Hong_Kong',
  'sg': 'Asia/Singapore',
  'in': 'Asia/Kolkata',
  'kr': 'Asia/Seoul',
  'tw': 'Asia/Taipei',
  'th': 'Asia/Bangkok',
  'my': 'Asia/Kuala_Lumpur',
  'ph': 'Asia/Manila',
  'id': 'Asia/Jakarta',
  'vn': 'Asia/Ho_Chi_Minh',
  
  // Middle East & Africa
  'ae': 'Asia/Dubai',
  'sa': 'Asia/Riyadh',
  'il': 'Asia/Jerusalem',
  'za': 'Africa/Johannesburg',
  'eg': 'Africa/Cairo',
  'ke': 'Africa/Nairobi',
  'ng': 'Africa/Lagos',
};

// US state to timezone (for more accurate US scheduling)
const US_STATE_TIMEZONE: Record<string, string> = {
  // Eastern
  'ny': 'America/New_York', 'ma': 'America/New_York', 'ct': 'America/New_York',
  'nj': 'America/New_York', 'pa': 'America/New_York', 'va': 'America/New_York',
  'nc': 'America/New_York', 'sc': 'America/New_York', 'ga': 'America/New_York',
  'fl': 'America/New_York', 'oh': 'America/New_York', 'mi': 'America/New_York',
  'md': 'America/New_York', 'dc': 'America/New_York', 'de': 'America/New_York',
  'me': 'America/New_York', 'nh': 'America/New_York', 'ri': 'America/New_York',
  'vt': 'America/New_York', 'wv': 'America/New_York',
  
  // Central
  'il': 'America/Chicago', 'tx': 'America/Chicago', 'wi': 'America/Chicago',
  'mn': 'America/Chicago', 'ia': 'America/Chicago', 'mo': 'America/Chicago',
  'ks': 'America/Chicago', 'ne': 'America/Chicago', 'ok': 'America/Chicago',
  'la': 'America/Chicago', 'ar': 'America/Chicago', 'ms': 'America/Chicago',
  'al': 'America/Chicago', 'tn': 'America/Chicago', 'ky': 'America/Chicago',
  'nd': 'America/Chicago', 'sd': 'America/Chicago',
  
  // Mountain
  'co': 'America/Denver', 'az': 'America/Phoenix', 'ut': 'America/Denver',
  'nm': 'America/Denver', 'mt': 'America/Denver', 'wy': 'America/Denver',
  'id': 'America/Boise',
  
  // Pacific
  'ca': 'America/Los_Angeles', 'wa': 'America/Los_Angeles', 'or': 'America/Los_Angeles',
  'nv': 'America/Los_Angeles',
  
  // Other
  'ak': 'America/Anchorage', 'hi': 'Pacific/Honolulu',
};

export interface SendTimeConfig {
  // Default send window (in recipient's local time)
  defaultWindowStart: number; // Hour (0-23), default 9
  defaultWindowEnd: number;   // Hour (0-23), default 11
  
  // Preferred days (0 = Sunday, 6 = Saturday)
  preferredDays: number[];    // Default [2, 3, 4] (Tue, Wed, Thu)
  
  // Whether to use historical data for optimization
  useHistoricalData: boolean;
  
  // Sender timezone (for fallback)
  senderTimezone: string;
}

export interface LeadOpenHistory {
  openedAt: Date;
  dayOfWeek: number;
  hourOfDay: number;
}

export interface OptimalSendTime {
  scheduledAt: Date;
  timezone: string;
  timezoneSource: 'explicit' | 'domain' | 'historical' | 'fallback';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

const DEFAULT_CONFIG: SendTimeConfig = {
  defaultWindowStart: 9,
  defaultWindowEnd: 11,
  preferredDays: [2, 3, 4], // Tuesday, Wednesday, Thursday
  useHistoricalData: true,
  senderTimezone: 'America/New_York',
};

/**
 * Infer timezone from email domain
 */
export function inferTimezoneFromEmail(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  
  // Extract TLD and check for country code
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  const secondLevel = parts.length > 1 ? `${parts[parts.length - 2]}.${tld}` : null;
  
  // Check second-level first (e.g., co.uk)
  if (secondLevel && DOMAIN_TIMEZONE_MAP[secondLevel]) {
    return DOMAIN_TIMEZONE_MAP[secondLevel];
  }
  
  // Check TLD
  if (DOMAIN_TIMEZONE_MAP[tld]) {
    return DOMAIN_TIMEZONE_MAP[tld];
  }
  
  // Common US business domains default to Eastern
  if (['com', 'net', 'org', 'io', 'co'].includes(tld)) {
    return 'America/New_York';
  }
  
  return null;
}

/**
 * Infer timezone from explicit location data
 */
export function inferTimezoneFromLocation(
  country?: string,
  city?: string,
  state?: string
): string | null {
  // Check US state first
  if (country?.toLowerCase() === 'us' || country?.toLowerCase() === 'united states') {
    if (state) {
      const stateCode = state.toLowerCase().substring(0, 2);
      if (US_STATE_TIMEZONE[stateCode]) {
        return US_STATE_TIMEZONE[stateCode];
      }
    }
    return 'America/New_York'; // Default US
  }
  
  // Check country code
  if (country) {
    const countryCode = country.toLowerCase().substring(0, 2);
    if (DOMAIN_TIMEZONE_MAP[countryCode]) {
      return DOMAIN_TIMEZONE_MAP[countryCode];
    }
  }
  
  return null;
}

/**
 * Calculate optimal send hour based on historical opens
 */
function calculateOptimalHourFromHistory(history: LeadOpenHistory[]): number | null {
  if (history.length < 3) return null; // Need enough data
  
  // Count opens by hour
  const hourCounts: Record<number, number> = {};
  for (const h of history) {
    hourCounts[h.hourOfDay] = (hourCounts[h.hourOfDay] || 0) + 1;
  }
  
  // Find the hour with most opens
  let maxCount = 0;
  let optimalHour = 9;
  
  for (const [hour, count] of Object.entries(hourCounts)) {
    if (count > maxCount) {
      maxCount = count;
      optimalHour = parseInt(hour);
    }
  }
  
  return optimalHour;
}

/**
 * Get the next occurrence of a specific day/hour in a timezone
 */
function getNextOccurrence(
  dayOfWeek: number,
  hour: number,
  timezone: string,
  afterDate: Date = new Date()
): Date {
  // Create date in target timezone
  const now = new Date(afterDate);
  
  // Get current day of week (0-6)
  const currentDay = now.getDay();
  
  // Calculate days until target day
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  
  // If it's the same day but past the hour, go to next week
  if (daysUntil === 0 && now.getHours() >= hour) {
    daysUntil = 7;
  }
  
  // Create target date
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysUntil);
  targetDate.setHours(hour, 0, 0, 0);
  
  return targetDate;
}

/**
 * Calculate optimal send time for a lead
 */
export function calculateOptimalSendTime(
  lead: {
    email: string;
    timezone?: string;
    country?: string;
    city?: string;
  },
  openHistory: LeadOpenHistory[] = [],
  config: Partial<SendTimeConfig> = {}
): OptimalSendTime {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  let timezone: string;
  let timezoneSource: 'explicit' | 'domain' | 'historical' | 'fallback';
  let confidence: 'high' | 'medium' | 'low';
  let reasoning: string;
  
  // 1. Use explicit timezone if provided
  if (lead.timezone) {
    timezone = lead.timezone;
    timezoneSource = 'explicit';
    confidence = 'high';
    reasoning = `Using explicitly set timezone: ${timezone}`;
  }
  // 2. Infer from location
  else if (lead.country) {
    const inferred = inferTimezoneFromLocation(lead.country, lead.city);
    if (inferred) {
      timezone = inferred;
      timezoneSource = 'domain';
      confidence = 'medium';
      reasoning = `Inferred timezone from location (${lead.country}): ${timezone}`;
    } else {
      timezone = cfg.senderTimezone;
      timezoneSource = 'fallback';
      confidence = 'low';
      reasoning = `Could not infer timezone, using sender timezone: ${timezone}`;
    }
  }
  // 3. Infer from email domain
  else {
    const inferred = inferTimezoneFromEmail(lead.email);
    if (inferred) {
      timezone = inferred;
      timezoneSource = 'domain';
      confidence = 'medium';
      reasoning = `Inferred timezone from email domain: ${timezone}`;
    } else {
      timezone = cfg.senderTimezone;
      timezoneSource = 'fallback';
      confidence = 'low';
      reasoning = `Could not infer timezone, using sender timezone: ${timezone}`;
    }
  }
  
  // Determine optimal hour
  let targetHour = cfg.defaultWindowStart;
  
  if (cfg.useHistoricalData && openHistory.length >= 3) {
    const historicalHour = calculateOptimalHourFromHistory(openHistory);
    if (historicalHour !== null) {
      targetHour = historicalHour;
      confidence = 'high';
      reasoning += `. Optimal hour ${targetHour}:00 based on ${openHistory.length} historical opens.`;
    }
  } else {
    // Add some randomization within the window to avoid batching
    targetHour = cfg.defaultWindowStart + Math.floor(Math.random() * (cfg.defaultWindowEnd - cfg.defaultWindowStart + 1));
    reasoning += ` Sending at ${targetHour}:00 local time.`;
  }
  
  // Find the next preferred day
  const now = new Date();
  let bestDate: Date | null = null;
  
  for (const day of cfg.preferredDays) {
    const candidate = getNextOccurrence(day, targetHour, timezone, now);
    if (!bestDate || candidate < bestDate) {
      bestDate = candidate;
    }
  }
  
  // If no preferred day found in the next week, use any weekday
  if (!bestDate) {
    for (let day = 1; day <= 5; day++) {
      const candidate = getNextOccurrence(day, targetHour, timezone, now);
      if (!bestDate || candidate < bestDate) {
        bestDate = candidate;
      }
    }
  }
  
  // Fallback to tomorrow
  if (!bestDate) {
    bestDate = new Date(now);
    bestDate.setDate(bestDate.getDate() + 1);
    bestDate.setHours(targetHour, 0, 0, 0);
  }
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  reasoning += ` Scheduled for ${dayNames[bestDate.getDay()]}.`;
  
  return {
    scheduledAt: bestDate,
    timezone,
    timezoneSource,
    confidence,
    reasoning,
  };
}

/**
 * Batch calculate optimal send times for multiple leads
 */
export function calculateBatchSendTimes(
  leads: Array<{
    id: string;
    email: string;
    timezone?: string;
    country?: string;
    city?: string;
  }>,
  openHistoryMap: Map<string, LeadOpenHistory[]> = new Map(),
  config: Partial<SendTimeConfig> = {}
): Map<string, OptimalSendTime> {
  const results = new Map<string, OptimalSendTime>();
  
  for (const lead of leads) {
    const history = openHistoryMap.get(lead.id) || [];
    const optimal = calculateOptimalSendTime(lead, history, config);
    results.set(lead.id, optimal);
  }
  
  return results;
}

/**
 * Check if current time is within the optimal send window for a timezone
 */
export function isWithinOptimalWindow(
  timezone: string,
  windowStart: number = 9,
  windowEnd: number = 17
): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    });
    
    const hour = parseInt(formatter.format(now));
    return hour >= windowStart && hour < windowEnd;
  } catch {
    return true; // If timezone is invalid, allow sending
  }
}

/**
 * Get day scoring for scheduling (higher = better)
 */
export function getDayScore(date: Date): number {
  const day = date.getDay();
  
  // Tuesday, Wednesday, Thursday = best
  if (day >= 2 && day <= 4) return 100;
  
  // Monday, Friday = okay
  if (day === 1 || day === 5) return 70;
  
  // Saturday = poor
  if (day === 6) return 30;
  
  // Sunday = worst
  return 20;
}

export default {
  inferTimezoneFromEmail,
  inferTimezoneFromLocation,
  calculateOptimalSendTime,
  calculateBatchSendTimes,
  isWithinOptimalWindow,
  getDayScore,
};
