/**
 * Lead State Machine Wrapper for Workers
 * Provides helper functions for workers to use the lead state machine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  leadStateMachine,
  LeadEvent,
  LeadStateChange,
  replyIntentToEvent,
  bounceTypeToEvent,
} from '@aninda/shared';
import type { LeadStatus, ReplyIntent } from '@aninda/shared';

// Re-export helpers for convenience
export { replyIntentToEvent, bounceTypeToEvent };

/**
 * Validates and executes a lead status transition using the state machine.
 * Returns the state change if successful, null if the transition is invalid.
 * Updates the database with the new status.
 */
export async function transitionLeadStatus(
  supabase: SupabaseClient,
  leadId: string,
  event: LeadEvent,
  metadata?: Record<string, unknown>
): Promise<LeadStateChange | null> {
  // Get current lead status
  const { data: lead, error } = await supabase
    .from('leads')
    .select('status')
    .eq('id', leadId)
    .single();

  if (error || !lead) {
    console.error(`Failed to get lead ${leadId} for state transition:`, error);
    return null;
  }

  const currentStatus = lead.status as LeadStatus;

  // Use state machine to validate and get new status
  const stateChange = await leadStateMachine.transition(
    leadId,
    currentStatus,
    event,
    metadata
  );

  if (!stateChange) {
    // Invalid transition - logged by state machine
    return null;
  }

  // Build update object based on event
  const updateData: Record<string, unknown> = {
    status: stateChange.newStatus,
  };

  // Add timestamp fields based on event type
  const now = new Date().toISOString();
  switch (event) {
    case 'EMAIL_SENT':
      if (stateChange.previousStatus === 'pending') {
        updateData.first_contacted_at = now;
      }
      updateData.last_contacted_at = now;
      break;
    case 'REPLY_RECEIVED':
    case 'REPLY_INTERESTED':
    case 'REPLY_NOT_INTERESTED':
      updateData.replied_at = now;
      if (metadata?.intent) {
        updateData.reply_intent = metadata.intent;
      }
      break;
    case 'EMAIL_BOUNCED':
    case 'SOFT_BOUNCE':
      updateData.bounced_at = now;
      if (metadata?.bounceReason) {
        updateData.bounce_reason = metadata.bounceReason;
      }
      break;
    case 'UNSUBSCRIBE':
      updateData.unsubscribed_at = now;
      break;
    case 'SPAM_REPORT':
      updateData.unsubscribed_at = now;
      break;
  }

  // Update the database
  const { error: updateError } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', leadId);

  if (updateError) {
    console.error(`Failed to update lead ${leadId} status:`, updateError);
    return null;
  }

  return stateChange;
}

/**
 * Check if a lead's current status should stop the sequence.
 * Returns true if the lead should NOT receive more emails.
 */
export function shouldStopSequence(status: LeadStatus): boolean {
  return leadStateMachine.blocksSequence(status);
}

/**
 * Get the list of statuses that block sequence continuation.
 * Useful for database queries.
 */
export function getSequenceBlockingStatuses(): LeadStatus[] {
  return [
    'bounced',
    'unsubscribed',
    'spam_reported',
    'replied',
    'interested',
    'not_interested',
    'meeting_booked',
  ];
}

/**
 * Map a reply intent directly to the appropriate lead event
 */
export function getEventFromReplyIntent(intent: ReplyIntent): LeadEvent {
  return replyIntentToEvent(intent);
}

/**
 * Map a bounce type directly to the appropriate lead event
 */
export function getEventFromBounceType(bounceType: 'hard' | 'soft' | 'complaint'): LeadEvent {
  return bounceTypeToEvent(bounceType);
}
