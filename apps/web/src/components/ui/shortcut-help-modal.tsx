'use client';

import { useEffect, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';
import { 
  ShortcutConfig, 
  DEFAULT_SHORTCUTS, 
  getShortcutDisplay, 
  getShortcutsByCategory 
} from '@/hooks/use-keyboard-shortcuts';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts?: ShortcutConfig[];
}

export function ShortcutHelpModal({ 
  isOpen, 
  onClose, 
  shortcuts = DEFAULT_SHORTCUTS 
}: ShortcutHelpModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = getShortcutsByCategory(shortcuts);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    'go-to': 'Go To',
    templates: 'Quick Templates',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div 
        ref={modalRef}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(categories).map(([category, categoryShortcuts]) => {
              if (categoryShortcuts.length === 0) return null;
              
              return (
                <div key={category}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                    {categoryLabels[category]}
                  </h3>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut) => (
                      <div 
                        key={`${shortcut.action}-${shortcut.key}`}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-sm text-foreground">
                          {shortcut.description}
                        </span>
                        <kbd className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-muted rounded border border-border text-muted-foreground">
                          {getShortcutDisplay(shortcut)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tips */}
          <div className="mt-6 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs font-mono">?</kbd> anytime to show this help. 
              Shortcuts are disabled when typing in inputs.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/30 text-center">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}

export default ShortcutHelpModal;
