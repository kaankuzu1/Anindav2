/**
 * Lead Status Utilities for Frontend
 * Provides consistent status colors and helpers across all pages
 */

export type LeadStatus =
  | 'pending'
  | 'in_sequence'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'not_interested'
  | 'meeting_booked'
  | 'bounced'
  | 'soft_bounced'
  | 'unsubscribed'
  | 'spam_reported'
  | 'sequence_complete';

export type VerificationStatus =
  | 'unverified'
  | 'verifying'
  | 'valid'
  | 'invalid'
  | 'catch_all'
  | 'risky'
  | 'unknown';

/**
 * Get consistent status colors for lead status badges
 */
export function getLeadStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-300',
    in_sequence: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
    contacted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300',
    replied: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
    interested: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
    meeting_booked: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
    not_interested: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
    bounced: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
    soft_bounced: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
    unsubscribed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
    spam_reported: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
    sequence_complete: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300',
  };
  return colors[status] || colors.pending;
}

/**
 * Format lead status for display
 */
export function formatLeadStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Check if status blocks sequence continuation
 */
export function isSequenceBlocked(status: string): boolean {
  const blockingStatuses = [
    'bounced',
    'soft_bounced',
    'unsubscribed',
    'spam_reported',
    'replied',
    'interested',
    'not_interested',
    'meeting_booked',
  ];
  return blockingStatuses.includes(status);
}

/**
 * Get verification status color
 */
export function getVerificationStatusColor(status: string | null): string {
  const colors: Record<string, string> = {
    valid: 'text-green-600 dark:text-green-400',
    invalid: 'text-red-600 dark:text-red-400',
    catch_all: 'text-yellow-600 dark:text-yellow-400',
    risky: 'text-orange-600 dark:text-orange-400',
    unverified: 'text-gray-400 dark:text-gray-500',
    verifying: 'text-blue-600 dark:text-blue-400',
    unknown: 'text-gray-500 dark:text-gray-400',
  };
  return colors[status || 'unverified'] || colors.unverified;
}

/**
 * Get verification status badge color (background + text)
 */
export function getVerificationBadgeColor(status: string | null): string {
  const colors: Record<string, string> = {
    valid: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
    invalid: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
    catch_all: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
    risky: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
    unverified: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
    verifying: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
    unknown: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
  };
  return colors[status || 'unverified'] || colors.unverified;
}

/**
 * Get verification status icon indicator
 */
export function getVerificationIcon(status: string | null): 'check' | 'x' | 'alert' | 'question' | 'spinner' {
  const icons: Record<string, 'check' | 'x' | 'alert' | 'question' | 'spinner'> = {
    valid: 'check',
    invalid: 'x',
    catch_all: 'alert',
    risky: 'alert',
    unverified: 'question',
    verifying: 'spinner',
    unknown: 'question',
  };
  return icons[status || 'unverified'] || 'question';
}

/**
 * Get risk score color based on value
 */
export function getRiskScoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score <= 30) return 'text-green-600 dark:text-green-400';
  if (score <= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get risk level label
 */
export function getRiskLevel(score: number | null): string {
  if (score === null) return 'Unknown';
  if (score <= 30) return 'Low';
  if (score <= 60) return 'Medium';
  return 'High';
}
