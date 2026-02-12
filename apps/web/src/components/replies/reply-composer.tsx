'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Send,
  Sparkles,
  RefreshCw,
  Loader2,
  Minimize2,
  Maximize2,
  Command,
  Braces,
  Eye,
} from 'lucide-react';
import { InboxSelector } from './inbox-selector';
import { TemplateSelector } from './template-selector';
import { VariablePalette } from '@/components/shared/variable-palette';
import { EmailPreviewModal } from '@/components/shared/email-preview-modal';

interface Inbox {
  id: string;
  email: string;
  provider: 'google' | 'microsoft' | 'smtp';
  status: 'active' | 'paused' | 'error' | 'warming_up' | 'banned';
  health_score: number;
  from_name?: string | null;
  sender_first_name?: string | null;
  sender_last_name?: string | null;
  sender_company?: string | null;
  sender_title?: string | null;
  sender_phone?: string | null;
  sender_website?: string | null;
}

interface Reply {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_preview: string | null;
  leads?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    title?: string | null;
    phone?: string | null;
  } | null;
  inboxes?: {
    id: string;
    email: string;
    provider: string;
    from_name?: string | null;
    sender_first_name?: string | null;
    sender_last_name?: string | null;
    sender_company?: string | null;
    sender_title?: string | null;
    sender_phone?: string | null;
    sender_website?: string | null;
  } | null;
}

interface ReplyComposerProps {
  reply: Reply;
  teamId: string;
  inboxes: Inbox[];
  defaultContent?: string;
  onSend: (data: { content: string; inboxId: string; subject?: string }) => Promise<void>;
  onCancel: () => void;
  onGenerateAI?: (tone: 'professional' | 'friendly' | 'short' | 'follow_up') => Promise<string>;
  isGeneratingAI?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function ReplyComposer({
  reply,
  teamId,
  inboxes,
  defaultContent = '',
  onSend,
  onCancel,
  onGenerateAI,
  isGeneratingAI = false,
  onExpandedChange,
}: ReplyComposerProps) {
  const [content, setContent] = useState(defaultContent);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [subject, setSubject] = useState(
    reply.subject?.startsWith('Re:') ? reply.subject : `Re: ${reply.subject || '(No subject)'}`
  );
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [aiTone, setAiTone] = useState<'professional' | 'friendly' | 'short' | 'follow_up'>('professional');
  const [showVariables, setShowVariables] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update content when defaultContent changes
  useEffect(() => {
    if (defaultContent) {
      setContent(defaultContent);
    }
  }, [defaultContent]);

  // Notify parent of expanded state changes
  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

  // Focus textarea on mount
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter to send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (content.trim() && selectedInboxId && !isSending) {
          handleSend();
        }
      }
      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      // Cmd+Shift+A for AI generation
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        if (onGenerateAI && !isGeneratingAI) {
          handleGenerateAI();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, selectedInboxId, isSending, onCancel, onGenerateAI, isGeneratingAI]);

  const handleSend = useCallback(async () => {
    if (!content.trim() || !selectedInboxId || isSending) return;

    setIsSending(true);
    try {
      // Convert plain text to HTML if needed
      const htmlContent = content.includes('<') ? content : `<p>${content.replace(/\n/g, '</p><p>')}</p>`;
      await onSend({ content: htmlContent, inboxId: selectedInboxId, subject });
    } finally {
      setIsSending(false);
    }
  }, [content, selectedInboxId, subject, isSending, onSend]);

  const handleGenerateAI = useCallback(async () => {
    if (!onGenerateAI || isGeneratingAI) return;
    try {
      const generated = await onGenerateAI(aiTone);
      if (generated) {
        setContent(generated);
        textareaRef.current?.focus();
        textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (error) {
      console.error('[ReplyComposer] AI generation error:', error);
    }
  }, [onGenerateAI, isGeneratingAI, aiTone]);

  const handleTemplateSelect = (templateContent: string) => {
    setContent(templateContent);
    textareaRef.current?.focus();
  };

  // Drag-and-drop handlers for textarea
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const tag = e.dataTransfer.getData('text/plain');
    if (!tag || !tag.startsWith('{{')) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    // Get drop position from mouse position
    textarea.focus();
    const text = textarea.value;

    // Use document.caretPositionFromPoint or caretRangeFromPoint for accurate drop position
    // Fallback: insert at current cursor
    const start = textarea.selectionStart;
    const newText = text.substring(0, start) + tag + text.substring(start);
    setContent(newText);

    requestAnimationFrame(() => {
      const newPos = start + tag.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    });
  };

  const selectedInbox = inboxes.find((i) => i.id === selectedInboxId);
  const recipientName = reply.from_name || reply.from_email;
  const recipientEmail = reply.from_email;

  return (
    <div
      className={`fixed bottom-0 lg:left-64 left-0 right-0 bg-card border-t lg:border-l border-border shadow-2xl transition-all duration-300 ease-out z-40 ${
        isExpanded ? (showVariables ? 'h-[440px]' : 'h-[360px]') : 'h-14'
      }`}
    >
      {/* Collapsed Header */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full h-full flex items-center justify-between px-6 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Maximize2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Reply to {recipientName}
            </span>
            {content && (
              <span className="text-xs text-muted-foreground">
                ({content.length} characters)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Command className="w-3 h-3" />
            <span>Enter to expand</span>
          </div>
        </button>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-foreground">
                Reply to {recipientName}
              </h3>
              <span className="text-xs text-muted-foreground">{recipientEmail}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={onCancel}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Inbox Selector */}
          <div className="px-6 py-3 border-b border-border">
            <InboxSelector
              inboxes={inboxes}
              selectedInboxId={selectedInboxId}
              onSelect={setSelectedInboxId}
              defaultInboxEmail={reply.inboxes?.email}
            />
          </div>

          {/* Subject */}
          <div className="px-6 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Subject:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-foreground"
                placeholder="Enter subject..."
              />
            </div>
          </div>

          {/* Variable Palette (collapsible) */}
          {showVariables && (
            <div className="px-6 py-2 border-b border-border max-h-32 overflow-y-auto bg-muted/20">
              <VariablePalette
                teamId={teamId}
                lead={reply.leads ? {
                  first_name: reply.leads.first_name,
                  last_name: reply.leads.last_name,
                  company: reply.leads.company,
                  email: reply.leads.email,
                  title: reply.leads.title,
                  phone: reply.leads.phone,
                } : null}
                inbox={reply.inboxes ? {
                  email: reply.inboxes.email,
                  from_name: reply.inboxes.from_name,
                  sender_first_name: reply.inboxes.sender_first_name,
                  sender_last_name: reply.inboxes.sender_last_name,
                  sender_company: reply.inboxes.sender_company,
                  sender_title: reply.inboxes.sender_title,
                  sender_phone: reply.inboxes.sender_phone,
                  sender_website: reply.inboxes.sender_website,
                } : null}
                originalSubject={reply.subject}
                textareaRef={textareaRef}
                onInsert={(newText) => setContent(newText)}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 px-6 py-4 overflow-y-auto min-h-0">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              placeholder={`Hi ${reply.leads?.first_name || recipientName.split(' ')[0] || 'there'},\n\nType your reply here...`}
              className="w-full h-full min-h-[100px] text-sm bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground/50"
              disabled={isSending}
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border bg-muted/30">
            <div className="flex items-center justify-between">
              {/* Left side - Templates, Variables, and AI */}
              <div className="flex items-center gap-3">
                <TemplateSelector
                  teamId={teamId}
                  intentType={undefined}
                  lead={reply.leads ? {
                    first_name: reply.leads.first_name || undefined,
                    last_name: reply.leads.last_name || undefined,
                    company: reply.leads.company || undefined,
                    email: reply.leads.email,
                    title: reply.leads.title || undefined,
                  } : undefined}
                  originalSubject={reply.subject || undefined}
                  onSelect={handleTemplateSelect}
                />

                <button
                  type="button"
                  onClick={() => setShowVariables(!showVariables)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    showVariables
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300'
                      : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                  }`}
                  title="Toggle variable palette"
                >
                  <Braces className="w-3.5 h-3.5" />
                  Variables
                </button>

                {onGenerateAI && (
                  <div className="flex items-center gap-2">
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value as typeof aiTone)}
                      className="text-xs border border-border rounded px-2 py-1.5 bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly</option>
                      <option value="short">Short</option>
                      <option value="follow_up">Follow-up</option>
                    </select>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleGenerateAI();
                      }}
                      disabled={isGeneratingAI}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-50 transition-colors"
                      title="Generate AI reply (Cmd+Shift+A)"
                    >
                      {isGeneratingAI ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      AI Reply
                    </button>
                  </div>
                )}
              </div>

              {/* Right side - Preview, Cancel, Send */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  disabled={!content.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
                  title="Preview email with resolved variables"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
                <button
                  onClick={onCancel}
                  disabled={isSending}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={!content.trim() || !selectedInboxId || isSending}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send
                  <span className="text-xs opacity-70 ml-1">
                    <Command className="w-3 h-3 inline" />
                    <span className="align-middle">Enter</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <EmailPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        steps={[{ subject, body: content, stepNumber: 1 }]}
        lead={reply.leads ?? undefined}
        inbox={selectedInbox ?? undefined}
        recipientEmail={recipientEmail}
        recipientName={recipientName}
      />
    </div>
  );
}

export default ReplyComposer;
