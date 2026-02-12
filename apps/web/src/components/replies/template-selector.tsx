'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, ChevronDown, Sparkles, Command } from 'lucide-react';

interface ReplyTemplate {
  id: string;
  name: string;
  content: string;
  intent_type: string | null;
  shortcut_number: number | null;
  is_default: boolean;
}

interface TemplateSelectorProps {
  teamId: string;
  intentType?: string;
  lead?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    email?: string;
    title?: string;
  };
  originalSubject?: string;
  onSelect: (content: string) => void;
  className?: string;
}

export function TemplateSelector({
  teamId,
  intentType,
  lead,
  originalSubject,
  onSelect,
  className = '',
}: TemplateSelectorProps) {
  const supabase = createClient();
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch templates
  useEffect(() => {
    async function fetchTemplates() {
      const { data } = await supabase
        .from('reply_templates')
        .select('*')
        .eq('team_id', teamId)
        .order('shortcut_number', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      setTemplates(data ?? []);
      setLoading(false);
    }

    if (teamId) {
      fetchTemplates();
    }
  }, [supabase, teamId]);

  // Process template with variables
  const processTemplate = (content: string): string => {
    let processed = content;

    if (lead) {
      processed = processed.replace(/\{\{firstName\}\}/gi, lead.first_name || '');
      processed = processed.replace(/\{\{lastName\}\}/gi, lead.last_name || '');
      processed = processed.replace(/\{\{company\}\}/gi, lead.company || '');
      processed = processed.replace(/\{\{email\}\}/gi, lead.email || '');
      processed = processed.replace(/\{\{title\}\}/gi, lead.title || '');
    }

    if (originalSubject) {
      processed = processed.replace(/\{\{originalSubject\}\}/gi, originalSubject);
    }

    // Clean up any remaining empty variables
    processed = processed.replace(/\{\{[^}]+\}\}/g, '');

    return processed.trim();
  };

  const handleSelect = (template: ReplyTemplate) => {
    const processedContent = processTemplate(template.content);
    onSelect(processedContent);
    setIsOpen(false);
  };

  // Get default template for current intent
  const defaultTemplate = intentType 
    ? templates.find((t) => t.intent_type === intentType && t.is_default)
    : null;

  // Sort templates: shortcuts first, then default for intent, then rest
  const sortedTemplates = [...templates].sort((a, b) => {
    // Shortcuts first
    if (a.shortcut_number && !b.shortcut_number) return -1;
    if (!a.shortcut_number && b.shortcut_number) return 1;
    if (a.shortcut_number && b.shortcut_number) return a.shortcut_number - b.shortcut_number;
    
    // Default for current intent
    if (intentType) {
      if (a.intent_type === intentType && a.is_default) return -1;
      if (b.intent_type === intentType && b.is_default) return 1;
    }
    
    return 0;
  });

  if (loading) {
    return (
      <div className={`animate-pulse bg-muted rounded-lg h-9 w-32 ${className}`} />
    );
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
      >
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span>Templates</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            {/* Default template suggestion */}
            {defaultTemplate && (
              <div className="p-2 bg-primary/5 border-b border-border">
                <button
                  onClick={() => handleSelect(defaultTemplate)}
                  className="w-full text-left p-2 rounded hover:bg-primary/10 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Suggested for this intent</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{defaultTemplate.name}</p>
                </button>
              </div>
            )}

            {/* Template list */}
            <div className="max-h-64 overflow-y-auto">
              {sortedTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  className="w-full text-left p-3 hover:bg-muted transition-colors border-b border-border last:border-b-0"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground truncate">
                      {template.name}
                    </span>
                    {template.shortcut_number && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        <Command className="w-3 h-3" />
                        {template.shortcut_number}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.content.substring(0, 100)}...
                  </p>
                  {template.intent_type && (
                    <span className="inline-block mt-1 text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                      {template.intent_type.replace('_', ' ')}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Keyboard hint */}
            <div className="p-2 bg-muted/50 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Use <kbd className="px-1 py-0.5 bg-muted rounded text-xs font-mono">Cmd+1-9</kbd> to insert quickly
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TemplateSelector;
