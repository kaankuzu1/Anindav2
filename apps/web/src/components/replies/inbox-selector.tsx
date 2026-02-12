'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Mail, AlertCircle } from 'lucide-react';

interface Inbox {
  id: string;
  email: string;
  provider: 'google' | 'microsoft' | 'smtp';
  status: 'active' | 'paused' | 'error' | 'warming_up' | 'banned';
  health_score: number;
  from_name?: string | null;
}

interface InboxSelectorProps {
  inboxes: Inbox[];
  selectedInboxId: string | null;
  onSelect: (inboxId: string) => void;
  defaultInboxEmail?: string;
  className?: string;
}

export function InboxSelector({
  inboxes,
  selectedInboxId,
  onSelect,
  defaultInboxEmail,
  className = '',
}: InboxSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Include active and warming_up inboxes (they can still send, just at reduced capacity)
  const usableInboxes = inboxes.filter((inbox) =>
    inbox.status === 'active' || inbox.status === 'warming_up'
  );
  const selectedInbox = inboxes.find((inbox) => inbox.id === selectedInboxId);

  // Auto-select default inbox on mount
  useEffect(() => {
    if (!selectedInboxId && defaultInboxEmail) {
      const matchingInbox = usableInboxes.find((inbox) => inbox.email === defaultInboxEmail);
      if (matchingInbox) {
        onSelect(matchingInbox.id);
      } else if (usableInboxes.length > 0) {
        onSelect(usableInboxes[0].id);
      }
    } else if (!selectedInboxId && usableInboxes.length > 0) {
      onSelect(usableInboxes[0].id);
    }
  }, [selectedInboxId, defaultInboxEmail, usableInboxes, onSelect]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setFocusIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIndex((prev) => Math.min(prev + 1, usableInboxes.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusIndex >= 0 && usableInboxes[focusIndex]) {
          onSelect(usableInboxes[focusIndex].id);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        );
      case 'microsoft':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#F25022" d="M1 1h10v10H1z" />
            <path fill="#00A4EF" d="M1 13h10v10H1z" />
            <path fill="#7FBA00" d="M13 1h10v10H13z" />
            <path fill="#FFB900" d="M13 13h10v10H13z" />
          </svg>
        );
      default:
        return <Mail className="w-4 h-4" />;
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (usableInboxes.length === 0) {
    const pausedCount = inboxes.filter((i) => i.status === 'paused').length;
    const errorCount = inboxes.filter((i) => i.status === 'error' || i.status === 'banned').length;

    return (
      <div className={`flex items-center gap-2 px-3 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400 rounded-lg ${className}`}>
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>
          No active inboxes available
          {pausedCount > 0 && ` (${pausedCount} paused)`}
          {errorCount > 0 && ` (${errorCount} with errors)`}
          {inboxes.length === 0 && ' - please connect an inbox first'}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-border rounded-lg bg-card hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground shrink-0">From:</span>
          {selectedInbox ? (
            <>
              <span className="shrink-0">{getProviderIcon(selectedInbox.provider)}</span>
              <span className="truncate text-foreground">
                {selectedInbox.from_name ? `${selectedInbox.from_name} <${selectedInbox.email}>` : selectedInbox.email}
              </span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${getHealthColor(selectedInbox.health_score)}`} title={`Health: ${selectedInbox.health_score}%`} />
            </>
          ) : (
            <span className="text-muted-foreground">Select inbox...</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {usableInboxes.map((inbox, index) => (
              <button
                key={inbox.id}
                type="button"
                onClick={() => {
                  onSelect(inbox.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors ${
                  index === focusIndex ? 'bg-muted' : ''
                } ${selectedInboxId === inbox.id ? 'bg-primary/5' : ''}`}
              >
                <span className="shrink-0">{getProviderIcon(inbox.provider)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {inbox.from_name || inbox.email}
                  </p>
                  {inbox.from_name && (
                    <p className="text-xs text-muted-foreground truncate">{inbox.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {inbox.status === 'warming_up' && (
                    <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 rounded">
                      Warming
                    </span>
                  )}
                  <span className={`w-2 h-2 rounded-full ${getHealthColor(inbox.health_score)}`} />
                  <span className="text-xs text-muted-foreground">{inbox.health_score}%</span>
                  {selectedInboxId === inbox.id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default InboxSelector;
