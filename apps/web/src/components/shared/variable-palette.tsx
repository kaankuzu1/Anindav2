'use client';

import { RefObject } from 'react';

interface VariableChip {
  name: string;
  label: string;
  emoji: string;
  value?: string | null;
  category: 'Receiver' | 'Sender' | 'Context';
}

interface VariablePaletteProps {
  teamId: string;
  lead?: {
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
    email?: string | null;
    title?: string | null;
    phone?: string | null;
  } | null;
  inbox?: {
    from_name?: string | null;
    email?: string | null;
    sender_first_name?: string | null;
    sender_last_name?: string | null;
    sender_company?: string | null;
    sender_title?: string | null;
    sender_phone?: string | null;
    sender_website?: string | null;
  } | null;
  originalSubject?: string | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInsert: (newFullText: string) => void;
  className?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Receiver: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  Sender: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
  Context: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
};

const CATEGORY_LABEL_COLORS: Record<string, string> = {
  Receiver: 'text-blue-600 dark:text-blue-400',
  Sender: 'text-green-600 dark:text-green-400',
  Context: 'text-purple-600 dark:text-purple-400',
};

export function VariablePalette({
  teamId,
  lead,
  inbox,
  originalSubject,
  textareaRef,
  onInsert,
  className = '',
}: VariablePaletteProps) {
  const chips: VariableChip[] = [
    // Receiver (Lead) variables
    { name: 'firstName', label: 'First Name', emoji: '👤', value: lead?.first_name, category: 'Receiver' },
    { name: 'lastName', label: 'Last Name', emoji: '👤', value: lead?.last_name, category: 'Receiver' },
    { name: 'email', label: 'Email', emoji: '📧', value: lead?.email, category: 'Receiver' },
    { name: 'company', label: 'Company', emoji: '🏢', value: lead?.company, category: 'Receiver' },
    { name: 'title', label: 'Title', emoji: '💼', value: lead?.title, category: 'Receiver' },
    { name: 'phone', label: 'Phone', emoji: '📞', value: lead?.phone, category: 'Receiver' },
    { name: 'fullName', label: 'Full Name', emoji: '👥', value: lead ? `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || null : null, category: 'Receiver' },

    // Sender (Inbox) variables
    { name: 'senderFirstName', label: 'First Name', emoji: '👤', value: inbox?.sender_first_name, category: 'Sender' },
    { name: 'senderLastName', label: 'Last Name', emoji: '👤', value: inbox?.sender_last_name, category: 'Sender' },
    { name: 'fromEmail', label: 'Email', emoji: '📧', value: inbox?.email, category: 'Sender' },
    { name: 'senderCompany', label: 'Company', emoji: '🏢', value: inbox?.sender_company, category: 'Sender' },
    { name: 'senderTitle', label: 'Title', emoji: '💼', value: inbox?.sender_title, category: 'Sender' },
    { name: 'senderPhone', label: 'Phone', emoji: '📞', value: inbox?.sender_phone, category: 'Sender' },
    { name: 'senderWebsite', label: 'Website', emoji: '🌐', value: inbox?.sender_website, category: 'Sender' },

    // Context variables
    { name: 'originalSubject', label: 'Original Subject', emoji: '📧', value: originalSubject, category: 'Context' },
  ];

  const insertVariable = (varName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const tag = `{{${varName}}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const newText = text.substring(0, start) + tag + text.substring(end);

    onInsert(newText);

    // Restore cursor position after the inserted tag
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + tag.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handleDragStart = (e: React.DragEvent, varName: string) => {
    e.dataTransfer.setData('text/plain', `{{${varName}}}`);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Group chips by category
  const categories = ['Receiver', 'Sender', 'Context'] as const;
  const categoryLabels: Record<string, string> = {
    Receiver: '📩 Receiver (Lead)',
    Sender: '📤 Sender (Inbox)',
    Context: '🔗 Context',
  };
  const grouped = categories
    .map((cat) => ({
      category: cat,
      chips: chips.filter((c) => c.category === cat),
    }))
    .filter((g) => g.chips.length > 0);

  return (
    <div className={`space-y-2 ${className}`}>
      {grouped.map((group) => (
        <div key={group.category}>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_LABEL_COLORS[group.category]}`}>
            {categoryLabels[group.category]}
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {group.chips.map((chip) => (
              <button
                key={chip.name}
                type="button"
                draggable="true"
                onDragStart={(e) => handleDragStart(e, chip.name)}
                onClick={() => insertVariable(chip.name)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity ${CATEGORY_COLORS[chip.category]}`}
                title={lead || inbox ? (chip.value ? `${chip.label}: ${chip.value}` : `${chip.label}: (empty)`) : `Insert {{${chip.name}}}`}
              >
                <span>{chip.emoji}</span>
                <span>{chip.label}</span>
                {(lead || inbox) && chip.value && (
                  <span className="opacity-60 max-w-[80px] truncate">
                    = {chip.value}
                  </span>
                )}
                {(lead || inbox) && !chip.value && (
                  <span className="opacity-40">--</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
