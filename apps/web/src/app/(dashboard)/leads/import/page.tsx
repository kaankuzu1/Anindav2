'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Plus, AlertTriangle, ShieldCheck, Sparkles, ArrowRight, ChevronRight, Loader2 } from 'lucide-react';

// Predefined lead variable options for the mapping dropdown
const LEAD_VARIABLES = [
  { value: 'email', label: '📧 Email', emoji: '📧', required: true },
  { value: 'first_name', label: '👤 First Name', emoji: '👤' },
  { value: 'last_name', label: '👤 Last Name', emoji: '👤' },
  { value: 'company', label: '🏢 Company', emoji: '🏢' },
  { value: 'title', label: '💼 Job Title', emoji: '💼' },
  { value: 'phone', label: '📞 Phone', emoji: '📞' },
  { value: 'linkedin_url', label: '🔗 LinkedIn URL', emoji: '🔗' },
  { value: 'website', label: '🌐 Website', emoji: '🌐' },
  { value: 'country', label: '🌍 Country', emoji: '🌍' },
  { value: 'city', label: '🏙️ City', emoji: '🏙️' },
  { value: 'timezone', label: '🕐 Timezone', emoji: '🕐' },
  { value: 'analysis_notes', label: '🧠 Analysis Notes', emoji: '🧠' },
] as const;

const API_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1`;

async function createLeadList(
  teamId: string,
  name: string,
  accessToken: string
): Promise<string> {
  const res = await fetch(
    `${API_URL}/leads/lists?team_id=${teamId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    }
  );

  if (!res.ok) {
    let errorMsg = 'Failed to create lead list';
    try {
      const errorData = await res.json();
      errorMsg = errorData.message || errorMsg;
    } catch {
      errorMsg = await res.text().catch(() => errorMsg);
    }
    throw new Error(errorMsg);
  }

  const data = await res.json();
  return data.id;
}

interface ColumnMapping {
  csvColumn: string;
  enabled: boolean;
  mappedTo: string | null; // 'email' | 'first_name' | ... | null
}

export default function ImportLeadsPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { teamId, loading: teamLoading, accessToken } = useTeam();

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Step tracking: 1 = upload + list, 2 = map columns, 3 = preview + import
  const [step, setStep] = useState(1);

  // Form state
  const [listName, setListName] = useState('');
  const [createNewList, setCreateNewList] = useState(true);
  const [selectedListId, setSelectedListId] = useState('');
  const [existingLists, setExistingLists] = useState<Array<{ id: string; name: string }>>([]);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  // Column mapping state
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [aiMapping, setAiMapping] = useState(false);
  const [aiMapped, setAiMapped] = useState(false);

  // Import results
  const [results, setResults] = useState<{
    imported: number;
    duplicates: number;
    invalid: number;
    risky: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    if (teamLoading || !teamId) return;

    async function fetchData() {
      const { data: lists } = await supabase
        .from('lead_lists')
        .select('id, name')
        .eq('team_id', teamId!);

      setExistingLists(lists ?? []);
    }

    fetchData();
  }, [teamId, teamLoading]);

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

  // Simple pattern-based fallback detection
  const detectColumnFallback = (header: string): string | null => {
    const h = header.toLowerCase().trim();
    if (h.includes('email') || h === 'e-mail' || h === 'correo') return 'email';
    if ((h.includes('first') && h.includes('name')) || h === 'first_name' || h === 'firstname' || h === 'nombre' || h === 'given_name' || h === 'givenname') return 'first_name';
    if ((h.includes('last') && h.includes('name')) || h === 'last_name' || h === 'lastname' || h === 'apellido' || h === 'surname' || h === 'family_name' || h === 'familyname') return 'last_name';
    if (h === 'company' || h === 'organization' || h === 'org' || h === 'empresa' || h === 'organisation') return 'company';
    if (h === 'title' || h === 'job_title' || h === 'jobtitle' || h.includes('position') || h === 'role' || h === 'cargo' || h === 'job title') return 'title';
    if (h === 'phone' || h === 'telephone' || h === 'telefono' || h === 'phone_number' || h === 'mobile') return 'phone';
    if (h.includes('linkedin')) return 'linkedin_url';
    if (h === 'website' || h === 'url' || h === 'web') return 'website';
    if (h === 'country' || h === 'pais') return 'country';
    if (h === 'city' || h === 'ciudad') return 'city';
    if (h === 'timezone' || h === 'tz' || h === 'time_zone') return 'timezone';
    if (h === 'analysis_notes' || h === 'analysis notes' || h === 'notes' || h === 'research_notes' || h === 'research notes') return 'analysis_notes';
    return null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);

    const text = await selectedFile.text();
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      alert('CSV must have headers and at least one row');
      setLoading(false);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    setRawHeaders(headers);
    setRawLines(lines);
    setTotalRows(lines.length - 1);

    // Build initial mappings using fallback pattern detection
    const usedFields = new Set<string>();
    const initialMappings: ColumnMapping[] = headers.map((header) => {
      const detected = detectColumnFallback(header);
      if (detected && !usedFields.has(detected)) {
        usedFields.add(detected);
        return { csvColumn: header, enabled: true, mappedTo: detected };
      }
      return { csvColumn: header, enabled: false, mappedTo: null };
    });

    setColumnMappings(initialMappings);
    setLoading(false);

    // Move to mapping step
    setStep(2);
  };

  // AI-powered column mapping
  const handleAiMap = async () => {
    if (!accessToken || rawHeaders.length === 0) return;

    setAiMapping(true);
    try {
      // Get sample rows for AI context
      const sampleRows: string[][] = [];
      for (let i = 1; i < Math.min(rawLines.length, 4); i++) {
        sampleRows.push(parseCSVLine(rawLines[i]));
      }

      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      const res = await fetch(`${apiUrl}/ai/map-columns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ headers: rawHeaders, sampleRows }),
      });

      if (!res.ok) throw new Error('AI mapping request failed');

      let aiResult: Record<string, string | null>;
      try {
        aiResult = await res.json();
      } catch {
        aiResult = {};
      }

      // Apply AI suggestions — ensure no duplicate field assignments
      const usedFields = new Set<string>();
      const newMappings: ColumnMapping[] = rawHeaders.map((header) => {
        const aiSuggestion = aiResult[header];
        if (aiSuggestion && !usedFields.has(aiSuggestion)) {
          usedFields.add(aiSuggestion);
          return { csvColumn: header, enabled: true, mappedTo: aiSuggestion };
        }
        return { csvColumn: header, enabled: false, mappedTo: null };
      });

      setColumnMappings(newMappings);
      setAiMapped(true);
    } catch (error) {
      console.error('AI column mapping failed:', error);
      // Keep existing pattern-based mappings
    } finally {
      setAiMapping(false);
    }
  };

  // Get which fields are already used in mappings
  const usedFields = new Set(
    columnMappings.filter((m) => m.enabled && m.mappedTo).map((m) => m.mappedTo!)
  );

  const updateMapping = (index: number, field: keyof ColumnMapping, value: any) => {
    setColumnMappings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };

      // If toggling off, clear the mappedTo
      if (field === 'enabled' && !value) {
        next[index].mappedTo = null;
      }

      return next;
    });
  };

  // Check if email is mapped (required)
  const emailMapped = columnMappings.some((m) => m.enabled && m.mappedTo === 'email');
  const mappedCount = columnMappings.filter((m) => m.enabled && m.mappedTo).length;

  // Build preview data from current mappings
  const getPreviewData = () => {
    const enabledMappings = columnMappings.filter((m) => m.enabled && m.mappedTo);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < Math.min(rawLines.length, 6); i++) {
      const values = parseCSVLine(rawLines[i]);
      const row: Record<string, string> = {};
      for (const mapping of enabledMappings) {
        const colIndex = rawHeaders.indexOf(mapping.csvColumn);
        if (colIndex >= 0) {
          row[mapping.mappedTo!] = values[colIndex] ?? '';
        }
      }
      rows.push(row);
    }

    return { mappings: enabledMappings, rows };
  };

  const handleImport = async () => {
    if (!teamId) return;

    setImporting(true);
    setResults(null);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // 1. Create lead list if needed
      let finalListId = selectedListId;

      if (createNewList && listName.trim()) {
        finalListId = await createLeadList(teamId, listName.trim(), accessToken);
      }

      if (!finalListId) {
        throw new Error('Please select or create a lead list');
      }

      // 2. Build leads array from parsed data using column mappings
      const enabledMappings = columnMappings.filter((m) => m.enabled && m.mappedTo);
      const headerIndexMap: Record<string, number> = {};
      for (const mapping of enabledMappings) {
        const colIndex = rawHeaders.indexOf(mapping.csvColumn);
        if (colIndex >= 0) {
          headerIndexMap[mapping.mappedTo!] = colIndex;
        }
      }

      const leads: any[] = [];
      for (let i = 1; i < rawLines.length; i++) {
        const values = parseCSVLine(rawLines[i]);
        const emailIdx = headerIndexMap.email;
        if (emailIdx === undefined) continue;
        const email = values[emailIdx];
        if (!email || !email.includes('@')) continue;

        const lead: any = {
          email: email.toLowerCase().trim(),
        };

        // Map all enabled fields
        if (headerIndexMap.first_name !== undefined) {
          lead.first_name = values[headerIndexMap.first_name] || null;
        }
        if (headerIndexMap.last_name !== undefined) {
          lead.last_name = values[headerIndexMap.last_name] || null;
        }
        if (headerIndexMap.company !== undefined) {
          lead.company = values[headerIndexMap.company] || null;
        }
        if (headerIndexMap.title !== undefined) {
          lead.title = values[headerIndexMap.title] || null;
        }
        if (headerIndexMap.phone !== undefined) {
          lead.phone = values[headerIndexMap.phone] || null;
        }
        if (headerIndexMap.linkedin_url !== undefined) {
          lead.linkedin_url = values[headerIndexMap.linkedin_url] || null;
        }
        if (headerIndexMap.website !== undefined) {
          lead.website = values[headerIndexMap.website] || null;
        }
        if (headerIndexMap.country !== undefined) {
          lead.country = values[headerIndexMap.country] || null;
        }
        if (headerIndexMap.city !== undefined) {
          lead.city = values[headerIndexMap.city] || null;
        }
        if (headerIndexMap.timezone !== undefined) {
          lead.timezone = values[headerIndexMap.timezone] || null;
        }
        if (headerIndexMap.analysis_notes !== undefined) {
          lead.analysis_notes = values[headerIndexMap.analysis_notes] || null;
        }

        leads.push(lead);
      }

      // 3. Call import API
      const res = await fetch(
        `${API_URL}/leads/import?team_id=${teamId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lead_list_id: finalListId,
            leads,
          }),
        }
      );

      if (!res.ok) {
        let errorMsg = 'Failed to import leads';
        try {
          const errorData = await res.json();
          errorMsg = errorData.message || errorMsg;
        } catch {
          errorMsg = await res.text().catch(() => errorMsg);
        }
        throw new Error(errorMsg);
      }

      const result = await res.json();

      // Backend returns: { imported, duplicates, invalid, risky, errors }
      setResults({
        imported: result.imported || 0,
        duplicates: result.duplicates || 0,
        invalid: result.invalid || 0,
        risky: result.risky || 0,
        errors: result.errors || [],
      });

      // Redirect to the lead list on success
      if (result.imported > 0) {
        router.push(`/leads?list=${finalListId}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to import leads. Please try again.';
      setResults({
        imported: 0,
        duplicates: 0,
        invalid: 0,
        risky: 0,
        errors: [errorMsg],
      });
    } finally {
      setImporting(false);
    }
  };

  const resetAll = () => {
    setResults(null);
    setFile(null);
    setRawHeaders([]);
    setRawLines([]);
    setColumnMappings([]);
    setAiMapped(false);
    setStep(1);
    setTotalRows(0);
  };

  // Get sample value for a column (first non-empty row)
  const getSampleValue = (csvColumn: string): string => {
    const colIndex = rawHeaders.indexOf(csvColumn);
    if (colIndex < 0) return '';
    for (let i = 1; i < Math.min(rawLines.length, 4); i++) {
      const values = parseCSVLine(rawLines[i]);
      if (values[colIndex]?.trim()) return values[colIndex].trim();
    }
    return '';
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
          <h1 className="text-2xl font-bold text-foreground">📥 Import Leads</h1>
          <p className="text-muted-foreground mt-1">Upload a CSV file to import leads in bulk</p>

          {/* Step indicator */}
          {!results && file && (
            <div className="flex items-center gap-2 mt-4">
              {[
                { num: 1, label: 'Upload' },
                { num: 2, label: 'Map Columns' },
                { num: 3, label: 'Review & Import' },
              ].map((s, i) => (
                <div key={s.num} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    step === s.num
                      ? 'bg-primary/10 text-primary'
                      : step > s.num
                        ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {step > s.num ? '✅' : `${s.num}.`} {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    {results.errors.length > 0 ? 'Import failed' : '🎉 Import complete!'}
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

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-800 dark:text-green-300">Imported</span>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">{results.imported}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-500/10 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm text-gray-800 dark:text-gray-300">Duplicates</span>
                </div>
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-400 mt-1">{results.duplicates}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-800 dark:text-red-300">Invalid</span>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">{results.invalid}</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-500/10 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm text-yellow-800 dark:text-yellow-300">Risky</span>
                </div>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mt-1">{results.risky || 0}</p>
              </div>
            </div>

            {results.risky > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    {results.risky} leads were imported but marked as risky (catch-all domains or high risk score).
                    Consider verifying these emails before sending campaigns.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <Link
                href="/leads"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                View Leads
              </Link>
              <button onClick={resetAll} className="px-4 py-2 text-muted-foreground hover:text-foreground">
                Import More
              </button>
            </div>
          </div>
        )}

        {!results && (
          <div className="p-6 space-y-6">

            {/* Step 1: Upload + List Selection */}
            {step === 1 && (
              <>
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
                    disabled={loading}
                    className="w-full p-8 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    <div className="text-center">
                      {loading ? (
                        <>
                          <Loader2 className="w-12 h-12 text-primary mx-auto mb-3 animate-spin" />
                          <p className="text-lg font-medium text-foreground">Parsing CSV...</p>
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
              </>
            )}

            {/* Step 2: Column Mapping */}
            {step === 2 && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-semibold text-foreground">🗂️ Map Columns</h3>
                    <button
                      onClick={handleAiMap}
                      disabled={aiMapping}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-50 transition-colors"
                    >
                      {aiMapping ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          AI Detecting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          {aiMapped ? 'Re-detect with AI' : 'Auto-detect with AI'}
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Map your CSV columns to lead variables. Only checked columns will be imported.
                  </p>

                  {aiMapped && (
                    <div className="mb-4 p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <Sparkles className="w-4 h-4" />
                        <span className="font-medium">AI mapped {mappedCount} columns automatically</span>
                      </div>
                    </div>
                  )}

                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-8"></th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">CSV Column</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-6"></th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Maps To</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Sample</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {columnMappings.map((mapping, index) => {
                          const isEmailRequired = mapping.mappedTo === 'email';
                          const sample = getSampleValue(mapping.csvColumn);

                          return (
                            <tr
                              key={mapping.csvColumn}
                              className={mapping.enabled ? 'bg-card' : 'bg-muted/20 opacity-60'}
                            >
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={mapping.enabled}
                                  disabled={isEmailRequired}
                                  onChange={(e) => updateMapping(index, 'enabled', e.target.checked)}
                                  className="w-4 h-4 text-primary rounded"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                  {mapping.csvColumn}
                                </code>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                <ArrowRight className="w-3.5 h-3.5" />
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={mapping.mappedTo ?? ''}
                                  disabled={!mapping.enabled}
                                  onChange={(e) => updateMapping(index, 'mappedTo', e.target.value || null)}
                                  className="w-full px-2 py-1 text-xs border border-border rounded bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                                >
                                  <option value="">🚫 Skip</option>
                                  {LEAD_VARIABLES.map((v) => {
                                    const isUsed = usedFields.has(v.value) && mapping.mappedTo !== v.value;
                                    return (
                                      <option key={v.value} value={v.value} disabled={isUsed}>
                                        {v.label}{isUsed ? ' (already mapped)' : ''}{'required' in v && v.required ? ' *' : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-xs text-muted-foreground truncate max-w-[120px] block">
                                  {sample || '—'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {!emailMapped && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <p className="text-sm text-red-800 dark:text-red-300">
                        📧 Email column must be mapped to continue.
                      </p>
                    </div>
                  )}
                </div>

                {/* Step 2 Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <button
                    onClick={() => {
                      setFile(null);
                      setRawHeaders([]);
                      setRawLines([]);
                      setColumnMappings([]);
                      setAiMapped(false);
                      setStep(1);
                    }}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!emailMapped}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    Continue to Preview
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Preview & Import */}
            {step === 3 && (() => {
              const { mappings, rows } = getPreviewData();
              return (
                <>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-1">👀 Preview Mapped Data</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {mappedCount} columns mapped from {totalRows} rows. First 5 rows shown below.
                    </p>

                    <div className="border border-border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            {mappings.map((m) => {
                              const v = LEAD_VARIABLES.find((lv) => lv.value === m.mappedTo);
                              return (
                                <th key={m.mappedTo} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                                  {v?.emoji} {v?.label.replace(/^[^\s]+\s/, '') || m.mappedTo}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {rows.map((row, i) => (
                            <tr key={i}>
                              {mappings.map((m) => (
                                <td key={m.mappedTo} className="px-4 py-2 text-foreground whitespace-nowrap">
                                  {row[m.mappedTo!] || <span className="text-muted-foreground">—</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* File info */}
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <FileText className="w-5 h-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{file?.name}</p>
                      <p className="text-xs text-muted-foreground">{totalRows} rows &middot; {mappedCount} columns mapped</p>
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit mapping
                    </button>
                  </div>

                  {/* Step 3 Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <button
                      onClick={() => setStep(2)}
                      className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing || !file || (createNewList && !listName)}
                      className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 text-sm font-medium"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
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
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
