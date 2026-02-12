'use client';

import { useEffect, useCallback } from 'react';
import { Brain, X, Check, AlertCircle } from 'lucide-react';

interface IntentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIntent: string | null;
  suggestedIntent: string;
  confidence: number;
  reasoning?: string;
  onAccept: () => void;
  onKeepCurrent: () => void;
}

export function IntentConfirmModal({
  isOpen,
  onClose,
  currentIntent,
  suggestedIntent,
  confidence,
  reasoning,
  onAccept,
  onKeepCurrent,
}: IntentConfirmModalProps) {
  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        onAccept();
      }
    },
    [onClose, onAccept]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const getIntentColor = (intent: string | null) => {
    switch (intent) {
      case 'interested':
      case 'meeting_request':
        return 'text-green-600 bg-green-100 dark:bg-green-500/20 dark:text-green-400';
      case 'question':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400';
      case 'not_interested':
      case 'unsubscribe':
        return 'text-red-600 bg-red-100 dark:bg-red-500/20 dark:text-red-400';
      case 'out_of_office':
      case 'auto_reply':
        return 'text-gray-600 bg-gray-100 dark:bg-gray-500/20 dark:text-gray-400';
      case 'bounce':
        return 'text-orange-600 bg-orange-100 dark:bg-orange-500/20 dark:text-orange-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-500/20 dark:text-gray-400';
    }
  };

  const formatIntent = (intent: string | null) => {
    if (!intent) return 'Unclassified';
    return intent.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'text-green-600 dark:text-green-400';
    if (conf >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">AI Intent Detection</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current vs Suggested */}
          <div className="grid grid-cols-2 gap-4">
            {/* Current Intent */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Current</p>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getIntentColor(currentIntent)}`}>
                {formatIntent(currentIntent)}
              </span>
            </div>

            {/* AI Suggestion */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-xs text-primary uppercase tracking-wide mb-2">AI Suggestion</p>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getIntentColor(suggestedIntent)}`}>
                {formatIntent(suggestedIntent)}
              </span>
            </div>
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
            <span className={`text-sm font-medium ${getConfidenceColor(confidence)}`}>
              {Math.round(confidence * 100)}% confident
            </span>
          </div>

          {/* Reasoning */}
          {reasoning && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">{reasoning}</p>
              </div>
            </div>
          )}

          {/* Hint */}
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> to accept or{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> to cancel
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 p-4 bg-muted/30 border-t border-border">
          <button
            onClick={onKeepCurrent}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Keep "{formatIntent(currentIntent)}"
          </button>
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Check className="w-4 h-4" />
            Accept "{formatIntent(suggestedIntent)}"
          </button>
        </div>
      </div>
    </div>
  );
}

export default IntentConfirmModal;
