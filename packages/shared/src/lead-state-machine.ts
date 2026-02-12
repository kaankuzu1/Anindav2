/**
 * Event-driven Lead State Machine
 * Provides formal state transitions with validation and event emission
 */

import type { LeadStatus, ReplyIntent } from './types';

// ============================================
// State Machine Types
// ============================================

export type LeadEvent =
  | 'EMAIL_SENT'
  | 'EMAIL_OPENED'
  | 'EMAIL_CLICKED'
  | 'EMAIL_BOUNCED'
  | 'SOFT_BOUNCE'
  | 'REPLY_RECEIVED'
  | 'REPLY_INTERESTED'
  | 'REPLY_NOT_INTERESTED'
  | 'UNSUBSCRIBE'
  | 'SPAM_REPORT'
  | 'MEETING_BOOKED'
  | 'SEQUENCE_COMPLETE'
  | 'MANUAL_OVERRIDE';

export interface StateTransition {
  from: LeadStatus[];
  to: LeadStatus;
  event: LeadEvent;
}

export interface LeadStateChange {
  leadId: string;
  previousStatus: LeadStatus;
  newStatus: LeadStatus;
  event: LeadEvent;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type StateChangeHandler = (change: LeadStateChange) => Promise<void>;

// ============================================
// Valid State Transitions
// ============================================

const VALID_TRANSITIONS: StateTransition[] = [
  // Initial contact
  { from: ['pending'], to: 'in_sequence', event: 'EMAIL_SENT' },
  { from: ['in_sequence'], to: 'contacted', event: 'EMAIL_SENT' },

  // Re-engagement from previous states
  { from: ['contacted'], to: 'contacted', event: 'EMAIL_SENT' },

  // Bounces (can happen from multiple states)
  { from: ['pending', 'in_sequence', 'contacted'], to: 'soft_bounced', event: 'SOFT_BOUNCE' },
  { from: ['pending', 'in_sequence', 'contacted', 'soft_bounced'], to: 'bounced', event: 'EMAIL_BOUNCED' },

  // Replies (can happen from multiple states)
  { from: ['in_sequence', 'contacted'], to: 'replied', event: 'REPLY_RECEIVED' },

  // Intent classification from replied state
  { from: ['replied'], to: 'interested', event: 'REPLY_INTERESTED' },
  { from: ['replied'], to: 'not_interested', event: 'REPLY_NOT_INTERESTED' },

  // Direct intent classification (if AI is confident)
  { from: ['in_sequence', 'contacted'], to: 'interested', event: 'REPLY_INTERESTED' },
  { from: ['in_sequence', 'contacted'], to: 'not_interested', event: 'REPLY_NOT_INTERESTED' },

  // Meeting booked (can happen from interested or replied)
  { from: ['replied', 'interested'], to: 'meeting_booked', event: 'MEETING_BOOKED' },

  // Unsubscribe (can happen from almost any state)
  { from: ['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested'], to: 'unsubscribed', event: 'UNSUBSCRIBE' },

  // Spam report (can happen from almost any state)
  { from: ['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested'], to: 'spam_reported', event: 'SPAM_REPORT' },

  // Sequence completion
  { from: ['in_sequence', 'contacted'], to: 'sequence_complete', event: 'SEQUENCE_COMPLETE' },

  // Manual override allows any transition
  { from: ['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested', 'meeting_booked', 'bounced', 'soft_bounced', 'unsubscribed', 'spam_reported', 'sequence_complete'], to: 'pending', event: 'MANUAL_OVERRIDE' },
  { from: ['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested', 'meeting_booked', 'bounced', 'soft_bounced', 'unsubscribed', 'spam_reported', 'sequence_complete'], to: 'in_sequence', event: 'MANUAL_OVERRIDE' },
  { from: ['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested', 'meeting_booked', 'bounced', 'soft_bounced', 'unsubscribed', 'spam_reported', 'sequence_complete'], to: 'contacted', event: 'MANUAL_OVERRIDE' },
  { from: ['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested', 'meeting_booked', 'bounced', 'soft_bounced', 'unsubscribed', 'spam_reported', 'sequence_complete'], to: 'replied', event: 'MANUAL_OVERRIDE' },
  { from: ['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested', 'meeting_booked', 'bounced', 'soft_bounced', 'unsubscribed', 'spam_reported', 'sequence_complete'], to: 'interested', event: 'MANUAL_OVERRIDE' },
  { from: ['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested', 'meeting_booked', 'bounced', 'soft_bounced', 'unsubscribed', 'spam_reported', 'sequence_complete'], to: 'not_interested', event: 'MANUAL_OVERRIDE' },
  { from: ['pending', 'in_sequence', 'contacted', 'replied', 'interested', 'not_interested', 'meeting_booked', 'bounced', 'soft_bounced', 'unsubscribed', 'spam_reported', 'sequence_complete'], to: 'meeting_booked', event: 'MANUAL_OVERRIDE' },
];

// ============================================
// Terminal States (cannot transition out except via manual override)
// ============================================

const TERMINAL_STATES: LeadStatus[] = [
  'bounced',
  'unsubscribed',
  'spam_reported',
];

// ============================================
// State Machine Class
// ============================================

export class LeadStateMachine {
  private handlers: StateChangeHandler[] = [];

  /**
   * Register a handler for state changes
   */
  onStateChange(handler: StateChangeHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove a state change handler
   */
  removeHandler(handler: StateChangeHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Check if a transition is valid
   */
  canTransition(currentStatus: LeadStatus, event: LeadEvent): LeadStatus | null {
    // Check terminal states (only manual override can exit)
    if (TERMINAL_STATES.includes(currentStatus) && event !== 'MANUAL_OVERRIDE') {
      return null;
    }

    // Find valid transition
    const transition = VALID_TRANSITIONS.find(
      t => t.from.includes(currentStatus) && t.event === event
    );

    return transition?.to ?? null;
  }

  /**
   * Get the new status for a given event
   */
  getNextStatus(currentStatus: LeadStatus, event: LeadEvent): LeadStatus | null {
    return this.canTransition(currentStatus, event);
  }

  /**
   * Get all possible events for a given status
   */
  getAvailableEvents(currentStatus: LeadStatus): LeadEvent[] {
    if (TERMINAL_STATES.includes(currentStatus)) {
      return ['MANUAL_OVERRIDE'];
    }

    const events = new Set<LeadEvent>();
    for (const transition of VALID_TRANSITIONS) {
      if (transition.from.includes(currentStatus)) {
        events.add(transition.event);
      }
    }

    return Array.from(events);
  }

  /**
   * Validate and execute a state transition
   * Returns the new status or null if invalid
   */
  async transition(
    leadId: string,
    currentStatus: LeadStatus,
    event: LeadEvent,
    metadata?: Record<string, unknown>
  ): Promise<LeadStateChange | null> {
    const newStatus = this.canTransition(currentStatus, event);

    if (!newStatus) {
      console.warn(
        `Invalid state transition: ${currentStatus} -> ? (event: ${event}) for lead ${leadId}`
      );
      return null;
    }

    const change: LeadStateChange = {
      leadId,
      previousStatus: currentStatus,
      newStatus,
      event,
      timestamp: new Date(),
      metadata,
    };

    // Notify all handlers
    await Promise.all(
      this.handlers.map(handler => handler(change).catch(err => {
        console.error('State change handler error:', err);
      }))
    );

    return change;
  }

  /**
   * Check if a status is a terminal state
   */
  isTerminalState(status: LeadStatus): boolean {
    return TERMINAL_STATES.includes(status);
  }

  /**
   * Check if a status blocks sequence continuation
   */
  blocksSequence(status: LeadStatus): boolean {
    return [
      'bounced',
      'unsubscribed',
      'spam_reported',
      'replied',
      'interested',
      'not_interested',
      'meeting_booked',
    ].includes(status);
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Map reply intent to lead event
 */
export function replyIntentToEvent(intent: ReplyIntent): LeadEvent {
  switch (intent) {
    case 'interested':
    case 'meeting_request':
      return 'REPLY_INTERESTED';
    case 'not_interested':
      return 'REPLY_NOT_INTERESTED';
    case 'unsubscribe':
      return 'UNSUBSCRIBE';
    case 'bounce':
      return 'EMAIL_BOUNCED';
    default:
      return 'REPLY_RECEIVED';
  }
}

/**
 * Map bounce type to lead event
 */
export function bounceTypeToEvent(bounceType: 'hard' | 'soft' | 'complaint'): LeadEvent {
  if (bounceType === 'soft') {
    return 'SOFT_BOUNCE';
  }
  if (bounceType === 'complaint') {
    return 'SPAM_REPORT';
  }
  return 'EMAIL_BOUNCED';
}

/**
 * Get human-readable description of a lead status
 */
export function getStatusDescription(status: LeadStatus): string {
  const descriptions: Record<LeadStatus, string> = {
    pending: 'Waiting to be contacted',
    in_sequence: 'Currently in email sequence',
    contacted: 'Has been contacted',
    replied: 'Has replied to an email',
    interested: 'Showed interest in reply',
    not_interested: 'Declined or not interested',
    meeting_booked: 'Meeting has been scheduled',
    bounced: 'Email bounced (hard bounce)',
    soft_bounced: 'Email soft bounced (temporary)',
    unsubscribed: 'Opted out of communications',
    spam_reported: 'Marked email as spam',
    sequence_complete: 'Completed all sequence steps',
  };

  return descriptions[status] || status;
}

/**
 * Get status color for UI display
 */
export function getStatusColor(status: LeadStatus): string {
  const colors: Record<LeadStatus, string> = {
    pending: 'gray',
    in_sequence: 'blue',
    contacted: 'indigo',
    replied: 'purple',
    interested: 'green',
    not_interested: 'orange',
    meeting_booked: 'emerald',
    bounced: 'red',
    soft_bounced: 'yellow',
    unsubscribed: 'gray',
    spam_reported: 'red',
    sequence_complete: 'teal',
  };

  return colors[status] || 'gray';
}

/**
 * Check if status indicates a successful outcome
 */
export function isPositiveOutcome(status: LeadStatus): boolean {
  return ['interested', 'meeting_booked'].includes(status);
}

/**
 * Check if status indicates a negative outcome
 */
export function isNegativeOutcome(status: LeadStatus): boolean {
  return ['not_interested', 'bounced', 'unsubscribed', 'spam_reported'].includes(status);
}

// Singleton instance for convenience
export const leadStateMachine = new LeadStateMachine();
