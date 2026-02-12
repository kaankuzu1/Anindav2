'use client';

import { AnnotatedSegment } from '@/lib/email-preview-utils';

interface EmailPreviewBodyProps {
  mode: 'final' | 'annotated';
  resolvedText: string;
  segments: AnnotatedSegment[];
}

export function EmailPreviewBody({ mode, resolvedText, segments }: EmailPreviewBodyProps) {
  if (mode === 'final') {
    return (
      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {resolvedText || <span className="text-muted-foreground italic">(empty)</span>}
      </div>
    );
  }

  // Annotated mode
  return (
    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {segments.length === 0 ? (
        <span className="text-muted-foreground italic">(empty)</span>
      ) : (
        segments.map((seg, i) =>
          seg.type === 'text' ? (
            <span key={i}>{seg.text}</span>
          ) : (
            <VariableChip key={i} segment={seg} />
          ),
        )
      )}
    </div>
  );
}

function VariableChip({ segment }: { segment: AnnotatedSegment }) {
  if (segment.isMissing) {
    // Missing variable - neutral gray, not alarming
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted border border-border">
        <span className="text-xs font-medium text-muted-foreground">{segment.varName}</span>
        <span className="text-xs text-muted-foreground italic">not set</span>
      </span>
    );
  }

  if (segment.usedFallback) {
    // Fallback variable
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/8 border border-primary/15">
        <span className="text-xs font-medium text-primary/60">{segment.varName}</span>
        <span className="text-xs text-muted-foreground/60">&rarr;</span>
        <span className="font-medium text-foreground italic">{segment.fallback}</span>
      </span>
    );
  }

  // Resolved variable
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/8 border border-primary/15">
      <span className="text-xs font-medium text-primary/60">{segment.varName}</span>
      <span className="font-medium text-foreground">{segment.value}</span>
    </span>
  );
}
