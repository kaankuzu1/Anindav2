'use client';

import { VariableSummaryEntry } from '@/lib/email-preview-utils';

interface EmailPreviewVariablesProps {
  entries: VariableSummaryEntry[];
  resolvedCount: number;
  totalCount: number;
  isSampleData?: boolean;
}

export function EmailPreviewVariables({
  entries,
  resolvedCount,
  totalCount,
  isSampleData,
}: EmailPreviewVariablesProps) {
  const receiverEntries = entries.filter((e) => e.category === 'Receiver');
  const senderEntries = entries.filter((e) => e.category === 'Sender');

  if (entries.length === 0) {
    return (
      <div className="px-8 py-3 text-sm text-muted-foreground">
        No variables used in this template.
      </div>
    );
  }

  return (
    <div className="px-8 py-4 border-b border-border bg-muted/20">
      {isSampleData && (
        <div className="mb-3 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Preview uses sample data. Actual values come from your leads and inbox settings.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {receiverEntries.length > 0 && (
          <VariableGroup title="Receiver (Lead)" entries={receiverEntries} />
        )}
        {senderEntries.length > 0 && (
          <VariableGroup title="Sender (Inbox)" entries={senderEntries} />
        )}
      </div>
    </div>
  );
}

function VariableGroup({
  title,
  entries,
}: {
  title: string;
  entries: VariableSummaryEntry[];
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        {title}
      </p>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-sm">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                entry.isResolved
                  ? 'bg-green-500'
                  : 'bg-muted-foreground/30'
              }`}
            />
            <span className="text-muted-foreground font-mono text-xs">{entry.name}</span>
            <span className="text-muted-foreground/50">-</span>
            {entry.isResolved ? (
              <span className="text-foreground truncate">{entry.value}</span>
            ) : (
              <span className="text-muted-foreground italic">(not set)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
