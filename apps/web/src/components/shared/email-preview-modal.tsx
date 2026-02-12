'use client';

import { useMemo, useState } from 'react';
import { X, Mail, ChevronLeft, ChevronRight, Eye, Code, SlidersHorizontal } from 'lucide-react';
import {
  buildVariableMap,
  annotateTemplate,
  resolveTemplate,
  getSpintaxVariations,
  getVariableSummary,
  type LeadData,
  type InboxData,
} from '@/lib/email-preview-utils';
import { EmailPreviewBody } from './email-preview-body';
import { EmailPreviewVariables } from './email-preview-variables';

interface EmailPreviewStep {
  subject: string;
  body: string;
  stepNumber: number;
  delayDays?: number;
  delayHours?: number;
}

export interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: EmailPreviewStep[];
  lead?: LeadData | null;
  inbox?: InboxData | null;
  recipientEmail?: string;
  recipientName?: string;
  showSpintax?: boolean;
  isSampleData?: boolean;
}

export function EmailPreviewModal({
  isOpen,
  onClose,
  steps,
  lead,
  inbox,
  recipientEmail,
  recipientName,
  showSpintax = false,
  isSampleData = false,
}: EmailPreviewModalProps) {
  const [viewMode, setViewMode] = useState<'final' | 'annotated'>('final');
  const [showVariables, setShowVariables] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spintaxVariation, setSpintaxVariation] = useState(0);

  const variables = useMemo(() => buildVariableMap(lead, inbox), [lead, inbox]);

  const step = steps[currentStep];

  // Combine subject and body for spintax detection
  const combinedText = step ? `${step.subject}\n${step.body}` : '';
  const spintaxVariations = useMemo(
    () => (showSpintax ? getSpintaxVariations(combinedText) : [combinedText]),
    [combinedText, showSpintax],
  );
  const hasSpintax = showSpintax && spintaxVariations.length > 1;

  // Annotated segments
  const subjectSegments = useMemo(
    () => (step ? annotateTemplate(step.subject, variables, spintaxVariation) : []),
    [step, variables, spintaxVariation],
  );
  const bodySegments = useMemo(
    () => (step ? annotateTemplate(step.body, variables, spintaxVariation) : []),
    [step, variables, spintaxVariation],
  );

  // Resolved text
  const resolvedSubject = useMemo(
    () => (step ? resolveTemplate(step.subject, variables, spintaxVariation) : ''),
    [step, variables, spintaxVariation],
  );
  const resolvedBody = useMemo(
    () => (step ? resolveTemplate(step.body, variables, spintaxVariation) : ''),
    [step, variables, spintaxVariation],
  );

  // Variable summary
  const allTemplateText = steps.map((s) => `${s.subject} ${s.body}`).join(' ');
  const { entries, resolvedCount, totalCount } = useMemo(
    () => getVariableSummary(variables, allTemplateText),
    [variables, allTemplateText],
  );

  // From display
  const fromDisplay = inbox
    ? inbox.from_name
      ? `${inbox.from_name} <${inbox.email}>`
      : inbox.email ?? ''
    : '';
  const toDisplay = recipientName && recipientName !== recipientEmail
    ? `${recipientName} <${recipientEmail}>`
    : recipientEmail ?? '';

  if (!isOpen || !step) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Email Preview</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('final')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'final'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Final
              </button>
              <button
                onClick={() => setViewMode('annotated')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'annotated'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Annotated
              </button>
            </div>

            {/* Variables toggle */}
            {totalCount > 0 && (
              <button
                onClick={() => setShowVariables(!showVariables)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  showVariables
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{totalCount} vars</span>
                <span className="text-[10px] opacity-70">
                  ({resolvedCount}/{totalCount})
                </span>
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Variable Summary Panel (collapsible) */}
        {showVariables && (
          <EmailPreviewVariables
            entries={entries}
            resolvedCount={resolvedCount}
            totalCount={totalCount}
            isSampleData={isSampleData}
          />
        )}

        {/* Email Simulation */}
        <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0">
          <div className="border border-border rounded-lg overflow-hidden bg-white dark:bg-[hsl(var(--card))] shadow-sm">
            {/* Email header */}
            <div className="bg-muted/50 px-5 py-4 border-b border-border space-y-2 text-sm">
              {fromDisplay && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-14 shrink-0 text-right">From:</span>
                  <span className="text-foreground">{fromDisplay}</span>
                </div>
              )}
              {toDisplay && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-14 shrink-0 text-right">To:</span>
                  <span className="text-foreground">{toDisplay}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground w-14 shrink-0 text-right">Subject:</span>
                <span className="text-foreground font-medium">
                  {viewMode === 'final' ? (
                    resolvedSubject || <span className="text-muted-foreground italic">(no subject)</span>
                  ) : (
                    <EmailPreviewBody
                      mode="annotated"
                      resolvedText=""
                      segments={subjectSegments}
                    />
                  )}
                </span>
              </div>
            </div>

            {/* Email body */}
            <div className="px-5 py-5 min-h-[200px]">
              <EmailPreviewBody
                mode={viewMode}
                resolvedText={resolvedBody}
                segments={bodySegments}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          {/* Step navigation */}
          <div className="flex items-center gap-2">
            {steps.length > 1 && (
              <>
                <button
                  onClick={() => {
                    setCurrentStep(Math.max(0, currentStep - 1));
                    setSpintaxVariation(0);
                  }}
                  disabled={currentStep === 0}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <span className="text-xs text-muted-foreground px-1">
                  Step {currentStep + 1} of {steps.length}
                </span>
                <button
                  onClick={() => {
                    setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
                    setSpintaxVariation(0);
                  }}
                  disabled={currentStep >= steps.length - 1}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Spintax variations */}
          {hasSpintax && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Variation:</span>
              {spintaxVariations.slice(0, 6).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSpintaxVariation(idx)}
                  className={`w-7 h-7 text-xs rounded-md border transition-colors ${
                    spintaxVariation === idx
                      ? 'bg-purple-100 dark:bg-purple-500/20 border-purple-400 dark:border-purple-500/50 text-purple-700 dark:text-purple-300 font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
