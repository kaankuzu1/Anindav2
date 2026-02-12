'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  FileText,
  Command,
  Sparkles,
} from 'lucide-react';

interface ReplyTemplate {
  id: string;
  name: string;
  content: string;
  intent_type: string | null;
  shortcut_number: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface QuickTemplatesManagerProps {
  teamId: string;
  accessToken: string;
}

const INTENT_OPTIONS = [
  { value: '', label: 'No specific intent' },
  { value: 'interested', label: 'Interested' },
  { value: 'meeting_request', label: 'Meeting Request' },
  { value: 'question', label: 'Question' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'neutral', label: 'Neutral' },
];

const SHORTCUT_OPTIONS = [
  { value: 0, label: 'No shortcut' },
  { value: 1, label: 'Cmd+1' },
  { value: 2, label: 'Cmd+2' },
  { value: 3, label: 'Cmd+3' },
  { value: 4, label: 'Cmd+4' },
  { value: 5, label: 'Cmd+5' },
  { value: 6, label: 'Cmd+6' },
  { value: 7, label: 'Cmd+7' },
  { value: 8, label: 'Cmd+8' },
  { value: 9, label: 'Cmd+9' },
];

export function QuickTemplatesManager({ teamId, accessToken }: QuickTemplatesManagerProps) {
  const supabase = createClient();
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    intent_type: '',
    shortcut_number: 0,
    is_default: false,
  });

  // Fetch templates
  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('reply_templates')
      .select('*')
      .eq('team_id', teamId)
      .order('shortcut_number', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    setTemplates(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (teamId) {
      fetchTemplates();
    }
  }, [teamId]);

  // Get used shortcut numbers
  const usedShortcuts = new Set(
    templates
      .filter((t) => t.id !== editingId)
      .map((t) => t.shortcut_number)
      .filter(Boolean)
  );

  // Start creating
  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData({
      name: '',
      content: '',
      intent_type: '',
      shortcut_number: 0,
      is_default: false,
    });
  };

  // Start editing
  const handleStartEdit = (template: ReplyTemplate) => {
    setEditingId(template.id);
    setIsCreating(false);
    setFormData({
      name: template.name,
      content: template.content,
      intent_type: template.intent_type || '',
      shortcut_number: template.shortcut_number || 0,
      is_default: template.is_default,
    });
  };

  // Cancel
  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({
      name: '',
      content: '',
      intent_type: '',
      shortcut_number: 0,
      is_default: false,
    });
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      alert('Name and content are required');
      return;
    }

    setSaving(true);

    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      const payload = {
        name: formData.name.trim(),
        content: formData.content.trim(),
        intent_type: formData.intent_type || null,
        shortcut_number: formData.shortcut_number || null,
        is_default: formData.is_default,
      };

      if (editingId) {
        // Update
        await fetch(`${apiUrl}/reply-templates/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        // Create
        await fetch(`${apiUrl}/reply-templates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });
      }

      await fetchTemplates();
      handleCancel();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      await fetch(`${apiUrl}/reply-templates/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      await fetchTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    }
  };

  // Create default templates
  const handleCreateDefaults = async () => {
    if (!confirm('This will create 3 default templates. Continue?')) return;

    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      await fetch(`${apiUrl}/reply-templates/create-defaults`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      await fetchTemplates();
    } catch (error) {
      console.error('Failed to create defaults:', error);
      alert('Failed to create default templates');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Quick Reply Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create templates with variables like {'{{firstName}}'}, {'{{company}}'}, {'{{originalSubject}}'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {templates.length === 0 && (
            <button
              onClick={handleCreateDefaults}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Create Defaults
            </button>
          )}
          <button
            onClick={handleStartCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h3 className="font-medium text-foreground mb-4">
            {isCreating ? 'Create Template' : 'Edit Template'}
          </h3>
          
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Interested - Schedule Call"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Template Content
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                placeholder={`Hi {{firstName}},

Thanks for your interest! I'd love to schedule a quick call.

Best regards`}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available variables: {'{{firstName}}'}, {'{{lastName}}'}, {'{{company}}'}, {'{{email}}'}, {'{{title}}'}, {'{{originalSubject}}'}
              </p>
            </div>

            {/* Row: Intent + Shortcut + Default */}
            <div className="grid grid-cols-3 gap-4">
              {/* Intent Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  For Intent Type
                </label>
                <select
                  value={formData.intent_type}
                  onChange={(e) => setFormData({ ...formData, intent_type: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {INTENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shortcut */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Keyboard Shortcut
                </label>
                <select
                  value={formData.shortcut_number}
                  onChange={(e) => setFormData({ ...formData, shortcut_number: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {SHORTCUT_OPTIONS.map((opt) => (
                    <option 
                      key={opt.value} 
                      value={opt.value}
                      disabled={opt.value !== 0 && usedShortcuts.has(opt.value)}
                    >
                      {opt.label} {opt.value !== 0 && usedShortcuts.has(opt.value) ? '(in use)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Is Default */}
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary/20"
                  />
                  <span className="text-sm text-foreground">Default for intent</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Template
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No templates yet</p>
          <button
            onClick={handleCreateDefaults}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90"
          >
            <Sparkles className="w-4 h-4" />
            Create Default Templates
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-foreground">{template.name}</h3>
                    {template.shortcut_number && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        <Command className="w-3 h-3" />
                        {template.shortcut_number}
                      </span>
                    )}
                    {template.is_default && template.intent_type && (
                      <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                    {template.content}
                  </p>
                  {template.intent_type && (
                    <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
                      {template.intent_type.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => handleStartEdit(template)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default QuickTemplatesManager;
