'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Plus } from 'lucide-react';

interface PreviewLead {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
}

export default function ImportLeadsPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Form state
  const [listName, setListName] = useState('');
  const [createNewList, setCreateNewList] = useState(true);
  const [selectedListId, setSelectedListId] = useState('');
  const [existingLists, setExistingLists] = useState<Array<{ id: string; name: string }>>([]);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewLead[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  // Import results
  const [results, setResults] = useState<{
    imported: number;
    duplicates: number;
    invalid: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1) as { data: { team_id: string }[] | null };

      if (teamMembers && teamMembers.length > 0) {
        const tid = teamMembers[0].team_id;
        setTeamId(tid);

        const { data: lists } = await supabase
          .from('lead_lists')
          .select('id, name')
          .eq('team_id', tid);

        setExistingLists(lists ?? []);
      }
    }

    fetchData();
  }, [supabase, router]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);

    // Parse CSV locally for preview
    const text = await selectedFile.text();
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      alert('CSV must have headers and at least one row');
      setLoading(false);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
    setColumns(headers);

    // Map headers to expected fields
    const headerMap: Record<string, string> = {};
    headers.forEach((header, index) => {
      const normalized = header.toLowerCase();
      if (normalized.includes('email')) headerMap.email = header;
      if (normalized.includes('first') && normalized.includes('name')) headerMap.first_name = header;
      if (normalized === 'first_name' || normalized === 'firstname') headerMap.first_name = header;
      if (normalized.includes('last') && normalized.includes('name')) headerMap.last_name = header;
      if (normalized === 'last_name' || normalized === 'lastname') headerMap.last_name = header;
      if (normalized === 'company' || normalized === 'organization') headerMap.company = header;
      if (normalized === 'title' || normalized.includes('job')) headerMap.title = header;
    });

    // Parse preview rows
    const previewLeads: PreviewLead[] = [];
    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const values = parseCSVLine(lines[i]);
      const lead: PreviewLead = {
        email: values[headers.indexOf(headerMap.email)] || '',
        first_name: headerMap.first_name ? values[headers.indexOf(headerMap.first_name)] : undefined,
        last_name: headerMap.last_name ? values[headers.indexOf(headerMap.last_name)] : undefined,
        company: headerMap.company ? values[headers.indexOf(headerMap.company)] : undefined,
        title: headerMap.title ? values[headers.indexOf(headerMap.title)] : undefined,
      };
      previewLeads.push(lead);
    }

    setPreview(previewLeads);
    setTotalRows(lines.length - 1);
    setLoading(false);
  };

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  };

  const handleImport = async () => {
    if (!file || !teamId) return;

    setImporting(true);

    try {
      // Create or get lead list
      let listId = selectedListId;

      if (createNewList && listName) {
        const { data: newList, error: listError } = await (supabase
          .from('lead_lists') as any)
          .insert({
            team_id: teamId,
            name: listName,
            source: 'csv_import',
          })
          .select()
          .single();

        if (listError) throw listError;
        listId = newList.id;
      }

      // Parse and import leads
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());

      // Build header map
      const headerMap: Record<string, number> = {};
      headers.forEach((header, index) => {
        const normalized = header.toLowerCase();
        if (normalized.includes('email')) headerMap.email = index;
        if (normalized.includes('first') && normalized.includes('name')) headerMap.first_name = index;
        if (normalized === 'first_name' || normalized === 'firstname') headerMap.first_name = index;
        if (normalized.includes('last') && normalized.includes('name')) headerMap.last_name = index;
        if (normalized === 'last_name' || normalized === 'lastname') headerMap.last_name = index;
        if (normalized === 'company' || normalized === 'organization') headerMap.company = index;
        if (normalized === 'title' || normalized.includes('job')) headerMap.title = index;
        if (normalized === 'phone') headerMap.phone = index;
        if (normalized === 'linkedin' || normalized.includes('linkedin')) headerMap.linkedin_url = index;
        if (normalized === 'website' || normalized === 'url') headerMap.website = index;
      });

      // Parse all leads
      const leads = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const email = values[headerMap.email];
        if (!email || !email.includes('@')) continue;

        leads.push({
          email: email.toLowerCase(),
          first_name: headerMap.first_name !== undefined ? values[headerMap.first_name] : null,
          last_name: headerMap.last_name !== undefined ? values[headerMap.last_name] : null,
          company: headerMap.company !== undefined ? values[headerMap.company] : null,
          title: headerMap.title !== undefined ? values[headerMap.title] : null,
          phone: headerMap.phone !== undefined ? values[headerMap.phone] : null,
          linkedin_url: headerMap.linkedin_url !== undefined ? values[headerMap.linkedin_url] : null,
          website: headerMap.website !== undefined ? values[headerMap.website] : null,
          team_id: teamId,
          lead_list_id: listId || null,
          status: 'pending',
          custom_fields: {},
        });
      }

      // Check for existing emails
      const { data: existingLeads } = await supabase
        .from('leads')
        .select('email')
        .eq('team_id', teamId) as { data: { email: string }[] | null };

      const existingEmails = new Set(existingLeads?.map((l) => l.email.toLowerCase()) ?? []);

      const newLeads = leads.filter((l) => !existingEmails.has(l.email));
      const duplicateCount = leads.length - newLeads.length;

      // Insert in batches
      let importedCount = 0;
      const batchSize = 100;

      for (let i = 0; i < newLeads.length; i += batchSize) {
        const batch = newLeads.slice(i, i + batchSize);
        const { error } = await (supabase.from('leads') as any).insert(batch);

        if (!error) {
          importedCount += batch.length;
        }
      }

      // Update lead list count
      if (listId) {
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('lead_list_id', listId);

        await (supabase
          .from('lead_lists') as any)
          .update({ lead_count: count ?? 0 })
          .eq('id', listId);
      }

      setResults({
        imported: importedCount,
        duplicates: duplicateCount,
        invalid: leads.length - newLeads.length - duplicateCount,
        errors: [],
      });
    } catch (error) {
      console.error('Import error:', error);
      setResults({
        imported: 0,
        duplicates: 0,
        invalid: 0,
        errors: ['Failed to import leads. Please try again.'],
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/leads"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Leads
      </Link>

      <div className="bg-card rounded-xl border border-border">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-foreground">Import Leads</h1>
          <p className="text-muted-foreground mt-1">Upload a CSV file to import leads in bulk</p>
        </div>

        {/* Results */}
        {results && (
          <div className="p-6 border-b border-border">
            <div className={`p-4 rounded-lg ${
              results.errors.length > 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-green-50 dark:bg-green-500/10'
            }`}>
              <div className="flex items-center gap-3">
                {results.errors.length > 0 ? (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                )}
                <div>
                  <p className={`font-medium ${
                    results.errors.length > 0 ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'
                  }`}>
                    {results.errors.length > 0 ? 'Import failed' : 'Import complete!'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {results.imported} imported, {results.duplicates} duplicates skipped
                    {results.invalid > 0 && `, ${results.invalid} invalid`}
                  </p>
                </div>
              </div>
              {results.errors.length > 0 && (
                <ul className="mt-2 text-sm text-red-700 dark:text-red-400">
                  {results.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <Link
                href="/leads"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                View Leads
              </Link>
              <button
                onClick={() => {
                  setResults(null);
                  setFile(null);
                  setPreview([]);
                }}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Import More
              </button>
            </div>
          </div>
        )}

        {!results && (
          <div className="p-6 space-y-6">
            {/* Lead List */}
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={createNewList}
                  onChange={() => setCreateNewList(true)}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm font-medium text-foreground">Create new list</span>
              </label>
              {createNewList && (
                <input
                  type="text"
                  placeholder="List name (e.g., Q1 Prospects)"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              )}

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!createNewList}
                  onChange={() => setCreateNewList(false)}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm font-medium text-foreground">Add to existing list</span>
              </label>
              {!createNewList && (
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Select a list...</option>
                  {existingLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* File Upload */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-8 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="text-center">
                  {file ? (
                    <>
                      <FileText className="w-12 h-12 text-primary mx-auto mb-3" />
                      <p className="text-lg font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">{totalRows} rows found</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-lg font-medium text-foreground">Drop CSV here or click to upload</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Max file size: 10MB. Include email column.
                      </p>
                    </>
                  )}
                </div>
              </button>
            </div>

            {/* Preview */}
            {preview.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">Preview (first 5 rows)</h3>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Company</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Title</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.map((lead, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-foreground">{lead.email}</td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {lead.first_name || lead.last_name
                              ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                              : '-'}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{lead.company || '-'}</td>
                          <td className="px-4 py-2 text-muted-foreground">{lead.title || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-border">
              <Link href="/leads" className="px-4 py-2 text-muted-foreground hover:text-foreground">
                Cancel
              </Link>
              <button
                onClick={handleImport}
                disabled={importing || !file || (createNewList && !listName)}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Import {totalRows} Leads
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
