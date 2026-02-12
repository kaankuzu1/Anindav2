'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type ShortcutAction =
  | 'navigate-down'
  | 'navigate-up'
  | 'open-selected'
  | 'reply'
  | 'archive'
  | 'edit'
  | 'new'
  | 'close'
  | 'show-help'
  | 'go-dashboard'
  | 'go-campaigns'
  | 'go-leads'
  | 'go-replies'
  | 'go-inboxes'
  | 'go-settings'
  | 'mark-read'
  | 'mark-unread'
  | 'select-all'
  | 'template-1'
  | 'template-2'
  | 'template-3'
  | 'template-4'
  | 'template-5'
  | 'template-6'
  | 'template-7'
  | 'template-8'
  | 'template-9'
  | 'search';

export interface ShortcutConfig {
  key: string;
  action: ShortcutAction;
  description: string;
  category: 'navigation' | 'actions' | 'go-to' | 'templates';
  modifier?: 'ctrl' | 'meta' | 'shift' | 'alt';
  sequence?: string; // For two-key sequences like 'g d'
}

export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  // Navigation
  { key: 'j', action: 'navigate-down', description: 'Move down', category: 'navigation' },
  { key: 'k', action: 'navigate-up', description: 'Move up', category: 'navigation' },
  { key: 'Enter', action: 'open-selected', description: 'Open selected', category: 'navigation' },
  { key: 'Escape', action: 'close', description: 'Close / Deselect', category: 'navigation' },
  { key: '/', action: 'search', description: 'Focus search', category: 'navigation' },

  // Actions
  { key: 'r', action: 'reply', description: 'Reply to selected', category: 'actions' },
  { key: 'a', action: 'archive', description: 'Archive', category: 'actions' },
  { key: 'e', action: 'edit', description: 'Edit', category: 'actions' },
  { key: 'n', action: 'new', description: 'New item', category: 'actions' },
  { key: 'm', action: 'mark-read', description: 'Mark as read', category: 'actions' },
  { key: 'u', action: 'mark-unread', description: 'Mark as unread', category: 'actions' },
  { key: 'a', action: 'select-all', description: 'Select all', category: 'actions', modifier: 'meta' },
  { key: '?', action: 'show-help', description: 'Show shortcuts', category: 'actions' },

  // Go-to (g + letter sequence)
  { key: 'd', action: 'go-dashboard', description: 'Go to Dashboard', category: 'go-to', sequence: 'g' },
  { key: 'c', action: 'go-campaigns', description: 'Go to Campaigns', category: 'go-to', sequence: 'g' },
  { key: 'l', action: 'go-leads', description: 'Go to Leads', category: 'go-to', sequence: 'g' },
  { key: 'r', action: 'go-replies', description: 'Go to Replies', category: 'go-to', sequence: 'g' },
  { key: 'i', action: 'go-inboxes', description: 'Go to Inboxes', category: 'go-to', sequence: 'g' },
  { key: 's', action: 'go-settings', description: 'Go to Settings', category: 'go-to', sequence: 'g' },

  // Templates (Cmd/Ctrl + number)
  { key: '1', action: 'template-1', description: 'Insert template 1', category: 'templates', modifier: 'meta' },
  { key: '2', action: 'template-2', description: 'Insert template 2', category: 'templates', modifier: 'meta' },
  { key: '3', action: 'template-3', description: 'Insert template 3', category: 'templates', modifier: 'meta' },
  { key: '4', action: 'template-4', description: 'Insert template 4', category: 'templates', modifier: 'meta' },
  { key: '5', action: 'template-5', description: 'Insert template 5', category: 'templates', modifier: 'meta' },
  { key: '6', action: 'template-6', description: 'Insert template 6', category: 'templates', modifier: 'meta' },
  { key: '7', action: 'template-7', description: 'Insert template 7', category: 'templates', modifier: 'meta' },
  { key: '8', action: 'template-8', description: 'Insert template 8', category: 'templates', modifier: 'meta' },
  { key: '9', action: 'template-9', description: 'Insert template 9', category: 'templates', modifier: 'meta' },
];

export interface UseKeyboardShortcutsOptions {
  onAction?: (action: ShortcutAction) => void;
  enabled?: boolean;
  shortcuts?: ShortcutConfig[];
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { onAction, enabled = true, shortcuts = DEFAULT_SHORTCUTS } = options;
  const router = useRouter();
  
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const pendingSequenceRef = useRef<string | null>(null);
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear sequence after timeout
  const clearSequence = useCallback(() => {
    pendingSequenceRef.current = null;
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
      sequenceTimeoutRef.current = null;
    }
  }, []);

  // Default navigation handler
  const handleNavigation = useCallback((action: ShortcutAction) => {
    switch (action) {
      case 'go-dashboard':
        router.push('/dashboard');
        break;
      case 'go-campaigns':
        router.push('/campaigns');
        break;
      case 'go-leads':
        router.push('/leads');
        break;
      case 'go-replies':
        router.push('/unibox');
        break;
      case 'go-inboxes':
        router.push('/inboxes');
        break;
      case 'go-settings':
        router.push('/settings');
        break;
      case 'show-help':
        setHelpModalOpen(true);
        break;
    }
  }, [router]);

  // Main keydown handler
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      const isInputFocused = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Allow escape and some modifiers even when input is focused
      if (isInputFocused && event.key !== 'Escape') {
        // Allow Cmd/Ctrl shortcuts
        if (!(event.metaKey || event.ctrlKey)) {
          return;
        }
      }

      const key = event.key;
      const hasCtrl = event.ctrlKey;
      const hasMeta = event.metaKey;
      const hasShift = event.shiftKey;
      const hasAlt = event.altKey;

      // Check for pending sequence (like 'g' + 'd')
      if (pendingSequenceRef.current) {
        const sequenceShortcuts = shortcuts.filter(
          (s) => s.sequence === pendingSequenceRef.current && s.key.toLowerCase() === key.toLowerCase()
        );

        if (sequenceShortcuts.length > 0) {
          const shortcut = sequenceShortcuts[0];
          event.preventDefault();
          clearSequence();
          
          if (onAction) {
            onAction(shortcut.action);
          }
          handleNavigation(shortcut.action);
          return;
        }

        // Invalid sequence, clear it
        clearSequence();
      }

      // Check if this starts a sequence
      if (key === 'g' && !hasCtrl && !hasMeta && !hasShift && !hasAlt && !isInputFocused) {
        pendingSequenceRef.current = 'g';
        sequenceTimeoutRef.current = setTimeout(clearSequence, 1000);
        return;
      }

      // Check for matching shortcut
      for (const shortcut of shortcuts) {
        if (shortcut.sequence) continue; // Skip sequence shortcuts

        const keyMatches = shortcut.key.toLowerCase() === key.toLowerCase() || 
                          (shortcut.key === '?' && key === '?' && hasShift);
        
        if (!keyMatches) continue;

        // Check modifier
        let modifierMatches = true;
        if (shortcut.modifier === 'ctrl') {
          modifierMatches = hasCtrl && !hasMeta;
        } else if (shortcut.modifier === 'meta') {
          modifierMatches = hasMeta || hasCtrl; // Support both Cmd (Mac) and Ctrl (Win)
        } else if (shortcut.modifier === 'shift') {
          modifierMatches = hasShift;
        } else if (shortcut.modifier === 'alt') {
          modifierMatches = hasAlt;
        } else {
          // No modifier required, make sure none are pressed (except for ? which needs shift)
          modifierMatches = !hasCtrl && !hasMeta && !hasAlt && (shortcut.key !== '?' || hasShift);
        }

        if (!modifierMatches) continue;

        // Don't prevent default for template shortcuts if not handled
        if (shortcut.category === 'templates') {
          if (onAction) {
            event.preventDefault();
            onAction(shortcut.action);
          }
          return;
        }

        event.preventDefault();

        if (onAction) {
          onAction(shortcut.action);
        }

        // Handle built-in navigation
        handleNavigation(shortcut.action);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearSequence();
    };
  }, [enabled, shortcuts, onAction, handleNavigation, clearSequence]);

  return {
    helpModalOpen,
    setHelpModalOpen,
    shortcuts,
  };
}

// Utility to get shortcut display string
export function getShortcutDisplay(shortcut: ShortcutConfig): string {
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
  
  let display = '';
  
  if (shortcut.sequence) {
    display = `${shortcut.sequence} then ${shortcut.key}`;
  } else if (shortcut.modifier) {
    const modKey = shortcut.modifier === 'meta' 
      ? (isMac ? 'Cmd' : 'Ctrl')
      : shortcut.modifier === 'ctrl'
      ? 'Ctrl'
      : shortcut.modifier === 'shift'
      ? 'Shift'
      : 'Alt';
    display = `${modKey}+${shortcut.key.toUpperCase()}`;
  } else {
    display = shortcut.key.toUpperCase();
  }
  
  return display;
}

// Group shortcuts by category
export function getShortcutsByCategory(shortcuts: ShortcutConfig[]) {
  const categories: Record<string, ShortcutConfig[]> = {
    navigation: [],
    actions: [],
    'go-to': [],
    templates: [],
  };

  for (const shortcut of shortcuts) {
    categories[shortcut.category].push(shortcut);
  }

  return categories;
}
