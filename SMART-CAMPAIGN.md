# Smart Campaign (Smart Template System)

AI-powered email personalization at send time with a **two-step pipeline**:
1. **Placeholder replacement** — `[instruction]` placeholders get filled with AI-generated content per-lead
2. **Tone & language transformation** — optional whole-template tone adjustment and/or language translation

Both steps preserve 100% of the original HTML formatting, `{{variables}}`, spintax, and conditionals.

## How It Works

### Placeholder Syntax

Users write square-bracket instructions anywhere in the email **subject and/or body**:

```html
<p>Hi {{firstName}},</p>

<p>[personalized 2-3 sentence paragraph about why their company needs our clipping service]</p>

<p>We help content creators like those at {{company}} monetize their videos through strategic clipping.</p>

<p>[1-2 sentences addressing their specific pain point based on research notes]</p>

<p>Would you be open to a quick chat this week?</p>

<p>Best,<br>{{senderFirstName}}</p>
```

- `[...]` = AI placeholder — gets replaced with AI-generated content at send time
- `{{...}}` = template variable — gets replaced with actual lead/inbox data
- Everything else (HTML tags, formatting, links, signatures) stays exactly as-is

### Processing Pipeline

```
1. Email subject + body contain [placeholder] instructions + {{variables}} + HTML

2. Step 1 — Placeholder replacement (personalizeWithAI):
   - Regex finds all [instruction] placeholders in BOTH subject and body
   - For each placeholder → separate AI API call with rich lead + sender context
   - AI returns raw text → replaces the [instruction]
   - HTML and {{variables}} are untouched
   - Skipped if no [placeholders] exist in either subject or body

3. Step 2 — Tone & language transformation (applyToneAndLanguage):
   - Single AI call to transform the WHOLE template
   - Tone (if enabled): rewrites body paragraphs to match selected tone, preserves greeting/signature
   - Language (if enabled + non-English country): translates entire email (subject + body) into lead's language
   - When both: tone applied first, then translated
   - Skipped if neither tone nor language is needed

4. Step 3 — Variable injection (processEmailContent):
   - Resolves {{variables}}, spintax, conditionals, fallbacks
   - All {{firstName}}, {{company}}, etc. are replaced with actual values

5. Final email has: AI content + tone/language adjustments + resolved variables + intact HTML
```

**Critical ordering**: Both AI steps run before variable injection so that `{{firstName}}` placeholders are never resolved before the AI sees them — they stay as raw template syntax for the variable engine to resolve.

### Step 2 Works Without Placeholders

Unlike Step 1 (which requires `[...]` placeholders), Step 2 (tone & language) works on ANY template — even those with zero placeholders. This means:
- A simple template with no `[...]` can still be tone-adjusted and/or translated
- Tone toggle ON + "Casual" tone → body paragraphs rewritten casually
- Language match ON + lead in Germany → entire email translated to German
- Both work together: tone first, then translate

### Skip Conditions

Step 2 skips automatically (no API call) when:
- Tone toggle is OFF **and** language match is OFF
- Tone toggle is OFF **and** lead's language is English
- Tone is `'professional'` (default, no adjustment needed) **and** language is English

## Configuration

### Per Sequence Step

Each campaign sequence step has independent smart template settings:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `smart_template_enabled` | BOOLEAN | FALSE | Enable AI personalization for this step |
| `smart_template_tone_enabled` | BOOLEAN | FALSE | Enable tone adjustment (Step 2) — rewrites body paragraphs to match selected tone |
| `smart_template_tone` | VARCHAR(30) | `'professional'` | AI writing tone (only applied when `tone_enabled = true`) |
| `smart_template_language_match` | BOOLEAN | TRUE | Translate entire email to lead's country language (Step 2) |
| `smart_template_notes` | TEXT | NULL | Free-text instructions for the AI (creator notes) |

### Per A/B Variant

Each A/B test variant can override the sequence-level settings independently. The same four columns exist on `sequence_variants`. Variant-level config takes priority over sequence-level config.

### Available Tones

| Value | Description |
|-------|-------------|
| `professional` | Formal, business-appropriate |
| `casual` | Relaxed, conversational |
| `friendly` | Warm, approachable |
| `persuasive` | Value-focused, compelling |
| `urgent` | Time-sensitive, action-oriented |
| `empathetic` | Understanding, relatable |

### Language Matching

Language matching affects **both** pipeline steps:

**Step 1 (placeholders)**: When `smart_template_language_match = true` (default), placeholder content is generated in the lead's country language. When `false`, placeholders are always generated in English.

**Step 2 (whole-template)**: When `smart_template_language_match = true` and the lead's language is non-English, the **entire** email (subject + greeting + body + closing) is translated. This works even on templates with zero `[...]` placeholders.

The language mapper (`packages/shared/src/country-language.ts`) covers ~100 countries via both ISO 2-letter codes (`DE`, `FR`) and full names (`Germany`, `France`). Unknown countries fall back to English.

### Creator Notes

Free-text instructions passed to the AI as high-priority guidance. Examples:
- "Focus on their recent Series B funding round"
- "Mention our Salesforce integration"
- "Keep it under 2 sentences, very casual"
- "Reference the pain of manual video editing"

Creator notes are included in both the lead context and as dedicated instructions in the AI prompt.

### AI Model

| Environment Variable | Default | Purpose |
|---------------------|---------|---------|
| `SMART_TEMPLATE_MODEL` | `openai/gpt-4o-mini` | AI model for placeholder generation |
| `OPENROUTER_API_KEY` | (required) | OpenRouter API key |

## Architecture

### Files

| File | Purpose |
|------|---------|
| `apps/workers/src/email-sender.ts` | Production two-step pipeline. `personalizeWithAI()` fills placeholders in subject + body (Step 1) with rich lead + sender context. `applyToneAndLanguage()` transforms whole template (Step 2). `buildLeadContextBlock()` + `buildSenderContextBlock()` helpers for structured AI context. `getSmartTemplateConfig()` reads config from variant (priority) or sequence (fallback) — includes `toneEnabled`. |
| `apps/api/src/modules/ai/ai.service.ts` | `personalizeEmail()` — placeholder logic for subject + body (Step 1) with expert prompts, rich lead context, and sender context. `applyToneAndLanguage()` — whole-template transformation (Step 2). `buildLeadContextBlock()` + `buildSenderContextBlock()` helpers. `callOpenRouter()` with configurable `temperature` param. |
| `apps/api/src/modules/ai/ai.controller.ts` | `POST /api/v1/ai/personalize-email` — HTTP endpoint runs both steps. Accepts expanded `lead` (with country/city/linkedinUrl/website) + `sender` context + `toneEnabled` and `languageMatch` params. |
| `apps/api/src/modules/campaigns/campaign-test.service.ts` | `previewTest()` and `sendTest()` — test email flow. Runs both AI steps when smart template is enabled. Passes expanded lead data + inbox sender context. Accepts `smartTemplateToneEnabled`. |
| `apps/web/src/app/(dashboard)/campaigns/new/page.tsx` | Campaign creation UI — smart template toggle, tone toggle + dropdown, language match toggle, creator notes textarea, test email section. |
| `apps/web/src/lib/ai/client.ts` | Frontend AI API client — `personalizeEmail()` typed wrapper with `toneEnabled` and `languageMatch` params. |
| `packages/shared/src/country-language.ts` | `getLanguageFromCountry()` — maps country to language for AI content localization. |

### Database

#### Migrations

| Migration | What It Adds |
|-----------|-------------|
| `packages/database/supabase/migrations/20260211000000_add_smart_template.sql` | `smart_template_enabled`, `smart_template_tone` on `sequences` and `sequence_variants`. `analysis_notes` on `leads`. `smart_template_personalized` on `emails`. |
| `packages/database/supabase/migrations/20260212000000_add_smart_template_enhancements.sql` | `smart_template_language_match`, `smart_template_notes` on `sequences` and `sequence_variants`. |
| `packages/database/supabase/migrations/20260213000000_add_smart_template_tone_enabled.sql` | `smart_template_tone_enabled` on `sequences` and `sequence_variants`. Controls whether tone adjustment runs in Step 2. |

#### Tables Modified

**`sequences`** — smart template config per campaign step:
- `smart_template_enabled` (BOOLEAN, default FALSE)
- `smart_template_tone_enabled` (BOOLEAN, default FALSE) — controls Step 2 tone adjustment
- `smart_template_tone` (VARCHAR(30), default `'professional'`)
- `smart_template_language_match` (BOOLEAN, default TRUE)
- `smart_template_notes` (TEXT, nullable)

**`sequence_variants`** — independent smart template config per A/B variant (same columns as above, including `smart_template_tone_enabled`)

**`leads`** — research data for AI context:
- `analysis_notes` (TEXT, nullable) — free-text notes about the lead, imported from CSV or entered manually

**`emails`** — tracking which emails were AI-personalized:
- `smart_template_personalized` (BOOLEAN, default FALSE)

### Type Definitions

Types are generated in `packages/database/src/types.ts` and include all smart template columns on both `sequences` and `sequence_variants` table types.

## Data Flow

### Campaign Send (Production)

```
email-sender.ts processJob()
│
├─ Fetch email, inbox, lead from database
├─ Build variable map (lead fields + inbox sender fields + custom_fields)
│
├─ IF email.sequence_id exists:
│   ├─ getSmartTemplateConfig(sequenceId, variantId)
│   │   ├─ Check variant config first (if variantId)
│   │   └─ Fall back to sequence config
│   │   └─ Returns: { enabled, tone, toneEnabled, languageMatch, notes }
│   │
│   └─ IF config.enabled:
│       ├─ Step 1: personalizeWithAI(subject, body, lead, tone, toneEnabled, languageMatch, notes, inbox)
│       │   ├─ Find all [instruction] placeholders in BOTH subject AND body via /\[([^\[\]]+)\]/g
│       │   ├─ No placeholders in either? → return null (skip Step 1)
│       │   ├─ Build rich lead context via buildLeadContextBlock() (RECIPIENT PROFILE, LOCATION, DIGITAL PRESENCE, RESEARCH NOTES)
│       │   ├─ Build sender context via buildSenderContextBlock() (name, title, company, website from inbox)
│       │   ├─ Tone in prompts: toneEnabled ? selectedTone : 'professional'
│       │   ├─ For each placeholder (subject + body independently):
│       │   │   ├─ Build expert system prompt (elite B2B copywriter, good/bad examples, anti-patterns)
│       │   │   ├─ Build user prompt (instruction + lead context + sender context + creator notes)
│       │   │   ├─ Call OpenRouter API (temperature: 0.4, 15s timeout)
│       │   │   ├─ Replace [instruction] with AI response
│       │   │   └─ On error: leave placeholder as-is, log warning
│       │   └─ Return { subject (placeholders filled), body (placeholders filled) }
│       │
│       ├─ Step 2: applyToneAndLanguage(subject, body, tone, toneEnabled, lead, languageMatch, notes)
│       │   ├─ needsTone = toneEnabled && tone !== 'professional'
│       │   ├─ needsTranslation = languageMatch && language !== 'English'
│       │   ├─ Neither needed? → return null (skip Step 2)
│       │   ├─ Single AI call with whole subject + body
│       │   │   ├─ Tone: rewrite body paragraphs only (preserve greeting/signature)
│       │   │   ├─ Language: translate entire email (subject + body)
│       │   │   ├─ Both: tone first, then translate
│       │   │   ├─ CRITICAL RULES: preserve {{vars}}, HTML, spintax, conditionals
│       │   │   └─ Temperature: 0.4 (faithful transformation)
│       │   └─ Return { subject, body } as JSON
│       │
│       └─ Mark email as smart_template_personalized = true (if either step ran)
│
├─ processEmailContent(subject, variables) — resolve {{vars}}, spintax, conditionals
├─ processEmailContent(body, variables)
├─ Apply email tracking (open pixel, link wrapping)
└─ Send via Gmail/Microsoft
```

### Test Email Preview

```
Frontend (campaigns/new page)
│
├─ User fills test lead data (first_name, last_name, company, title, analysis_notes, country, linkedin_url, website, city)
├─ User selects inbox and step/variant to test
├─ Click "Preview"
│
└─ POST /api/v1/campaigns/preview-test
    │
    └─ campaign-test.service.ts previewTest()
        ├─ Fetch inbox, build variable map
        ├─ IF smartTemplateEnabled:
        │   ├─ Step 1: aiService.personalizeEmail(subject, body, lead, tone, country, notes, toneEnabled, languageMatch)
        │   │   ├─ Find [instruction] placeholders
        │   │   ├─ For each: call OpenRouter → replace with AI content
        │   │   └─ Return personalized subject + body
        │   └─ Step 2: aiService.applyToneAndLanguage(subject, body, tone, toneEnabled, country, languageMatch, notes)
        │       ├─ Tone adjustment (if toneEnabled) + language translation (if non-English)
        │       └─ Return transformed subject + body
        ├─ processEmailContent() — resolve variables
        └─ Return processed subject + body
```

### Test Email Send

```
Frontend → POST /api/v1/campaigns/send-test
│
└─ campaign-test.service.ts sendTest()
    ├─ Call previewTest() (same pipeline as above)
    ├─ Decrypt inbox credentials
    ├─ Send via GmailClient or MicrosoftClient
    └─ Return { success, subject, body }
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/ai/personalize-email` | Direct AI personalization (used by frontend) |
| `POST` | `/api/v1/campaigns/preview-test` | Preview processed template with test lead data |
| `POST` | `/api/v1/campaigns/send-test` | Send test email to a recipient address |

### POST /api/v1/ai/personalize-email

```typescript
// Request
{
  subject: string;
  body: string;         // HTML body with [instructions] and {{variables}}
  lead: {
    firstName?: string;
    lastName?: string;
    company?: string;
    title?: string;
    analysisNotes?: string;
    country?: string;
    city?: string;
    linkedinUrl?: string;
    website?: string;
  };
  sender?: {             // sender context for AI
    firstName?: string;
    lastName?: string;
    company?: string;
    title?: string;
    website?: string;
  };
  tone?: string;        // default: 'professional'
  country?: string;     // for language matching
  creatorNotes?: string;
  toneEnabled?: boolean;    // default: false — enable Step 2 tone adjustment
  languageMatch?: boolean;  // default: true — enable Step 2 language translation
}

// Response
{
  subject: string;      // may be translated if languageMatch + non-English
  body: string;         // placeholders replaced + tone adjusted + translated
}
```

### POST /api/v1/campaigns/preview-test

```typescript
// Request (requires team_id query param)
{
  subject: string;
  body: string;
  smartTemplateEnabled: boolean;
  smartTemplateToneEnabled?: boolean;  // enable Step 2 tone adjustment
  smartTemplateTone?: string;
  smartTemplateLanguageMatch?: boolean;
  smartTemplateNotes?: string;
  testLead: {
    first_name?: string;
    last_name?: string;
    company?: string;
    title?: string;
    analysis_notes?: string;
    country?: string;
    linkedin_url?: string;
    website?: string;
    city?: string;
  };
  inboxId: string;
}

// Response
{
  subject: string;      // fully processed (AI Steps 1+2 + variables resolved)
  body: string;         // fully processed (AI Steps 1+2 + variables resolved)
}
```

### POST /api/v1/campaigns/send-test

Same request body as preview-test, plus `recipientEmail: string`. Returns `{ success: boolean; subject: string; body: string }`.

## Frontend UI

### Campaign Creation (`/campaigns/new`)

#### Smart Template Toggle Row

Located below the email body editor for each sequence step. Purple/violet theme when enabled.

**Components:**
- Toggle switch (ON/OFF)
- Sparkles icon + "Smart Template" label
- "Tone" mini-toggle button (visible when smart template enabled) — controls Step 2 tone adjustment
- Tone dropdown (visible only when tone toggle is ON)
- "Match language" mini-toggle button (visible when smart template enabled) — controls Step 2 language translation
- Info tooltip explaining the feature

#### Creator Notes

Textarea that appears below the toggle row when smart template is enabled. Placeholder: "Optional: AI instructions for personalizing this step..."

#### A/B Variant Controls

Each variant card has its own compact smart template section with the same controls (toggle, tone, language match, creator notes). Variant settings are independent from the sequence-level settings.

#### Test Email Section

Collapsible card at the bottom of the page with:
- Step selector dropdown
- Variant selector (if step has variants)
- Inbox picker
- Recipient email input
- Test lead data form (first_name, last_name, company, title, analysis_notes, country, linkedin_url, website, city)
- Preview button → shows rendered HTML
- Send button → sends actual email

**Inline test buttons**: Each variant card header has a "Test" button (Send icon). The step header has a "Test A" button for the original content. Both scroll to the test email section with the correct step/variant pre-selected.

### Frontend AI Client

`apps/web/src/lib/ai/client.ts` provides a typed wrapper:

```typescript
personalizeEmail: (
  subject: string,
  body: string,
  lead: { firstName?; lastName?; company?; title?; analysisNotes? },
  tone: string | undefined,
  country: string | undefined,
  token: string,
  toneEnabled?: boolean,     // enable Step 2 tone adjustment
  languageMatch?: boolean,   // enable Step 2 language translation
) => Promise<{ subject: string; body: string }>
```

## AI Prompt Design

### Step 1: System Prompt (per placeholder) — Expert Cold Email Copywriter

```
You are an elite B2B cold email copywriter specializing in personalized outreach.

YOUR TASK: Generate ONLY the text content for the placeholder described below. Return raw text — no JSON, no quotes, no labels.

WRITING RULES:
- Write a concise, natural sentence or phrase (1-3 sentences max)
- Reference SPECIFIC details from the recipient's profile (company name, role, industry, recent news)
- Sound like a real human wrote this — conversational, not corporate
- Match the email's existing voice and flow

CRITICAL DON'TS:
- Do NOT use generic filler ("I hope this finds you well", "I wanted to reach out", "I came across your profile")
- Do NOT include greetings ("Hi", "Dear") or sign-offs ("Best regards", "Thanks")
- Do NOT include template variables like {{firstName}} or {{company}}
- Do NOT use spam trigger words (free, guarantee, act now, limited time, exclusive offer)
- Do NOT use literal placeholders like [Your Name] or [Company Name]
- Do NOT mention AI, automation, or personalization
- Do NOT write more than 3 sentences

EXAMPLES OF GOOD OUTPUT:
- For "[personalized opening based on company]": "Noticed Acme Corp just closed your Series B — congrats. Scaling the SDR team at that pace usually means outbound infrastructure becomes a bottleneck fast."
- For "[value proposition]": "We help engineering-led teams like yours cut cold email setup time from weeks to hours, with built-in deliverability protection."
- For "[relevant pain point]": "Most VP-level folks I talk to at companies your size say their biggest challenge is getting replies without landing in spam."

EXAMPLES OF BAD OUTPUT (never write like this):
- "I hope this message finds you well. I wanted to reach out regarding..."
- "As a leader in your industry, you know the importance of..."
- "I came across your profile and was impressed by your work at..."
```

### Step 1: User Prompt (per placeholder) — Rich Context

```
Generate content for this placeholder: "{instruction}"

RECIPIENT PROFILE:
- Name: Sarah Chen
- Title: VP of Engineering
- Company: Acme Corp

LOCATION:
- Country: United States
- City: San Francisco

DIGITAL PRESENCE:
- LinkedIn: linkedin.com/in/sarahchen
- Website: acmecorp.com

RESEARCH NOTES:
Recently raised $15M Series B. Hiring 3 SDRs. Moving to HubSpot.

SENDER PROFILE:
- Name: Alex Smith
- Title: Account Executive
- Company: SalesTech Inc
- Website: salestech.io

CAMPAIGN CREATOR INSTRUCTIONS (high priority): Focus on their expansion plans

Language: English
Tone: professional

Write ONLY the replacement text. Nothing else.
```

Each section is only included when data exists. Empty sections are omitted entirely.

### Step 2: System Prompt (whole-template transformation) — Absolute Rules

```
You are an email language and tone specialist. Transform the email below according to the instructions.

ABSOLUTE RULES — BREAKING THESE FAILS THE TASK:
1. PRESERVE every {{variable}} placeholder EXACTLY (e.g., {{firstName}}, {{company}}, {{senderCompany}})
2. PRESERVE every HTML tag EXACTLY (e.g., <br>, <p>, <a href="...">)
3. PRESERVE every spintax pattern EXACTLY (e.g., {Hello|Hi|Hey})
4. PRESERVE every conditional block EXACTLY (e.g., {if:company}...{/if})
5. Do NOT add content that wasn't in the original (no new greetings, closings, or paragraphs)
6. Do NOT remove content that was in the original
7. Do NOT use spam trigger words (free, guarantee, act now, limited time)
8. Keep the email roughly the same length — do not expand or shrink significantly

Return ONLY a JSON object: {"subject": "...", "body": "..."}

{If both tone and language: "Apply the tone adjustment first, then translate the result."}
```

### Step 2: User Prompt

```
TONE ADJUSTMENT: Rewrite ONLY the body paragraphs to match a "{tone}" tone. Do NOT modify the greeting line or the closing/signature.

LANGUAGE TRANSLATION: Translate the ENTIRE email (subject line, greeting, body, and closing) into {language}.

{If creatorNotes: "CAMPAIGN CREATOR INSTRUCTIONS (high priority): {creatorNotes}"}

SUBJECT:
{subject}

BODY:
{body}

Return ONLY a JSON object: {"subject": "...", "body": "..."}
```

### Key Design Decisions

1. **One API call per placeholder (Step 1)** — each placeholder gets its own focused prompt, producing better results than asking the AI to handle multiple placeholders at once
2. **Single API call for whole-template (Step 2)** — tone + language in one call for efficiency; returns JSON with subject + body
3. **Raw text output for placeholders** — AI returns plain text (not JSON), eliminating JSON parsing failures and HTML escaping issues
4. **JSON output for tone/language** — Step 2 needs to return both subject and body, so JSON is required
5. **Temperature 0.4 for both steps** — consistent, faithful personalization; prevents unpredictable/creative output. The `callOpenRouter()` helper accepts a `temperature` param (default 0.7) but both smart template steps explicitly pass 0.4
6. **Graceful degradation** — if any placeholder fails, it's left as-is; if Step 2 fails, the email sends with original tone/language
7. **15-second timeout** for Step 1 (per-placeholder), **20-second timeout** for Step 2 (whole template)
8. **Tone respects greeting/signature** — body paragraphs are rewritten, but "Hi {{firstName}}," and "Best, {{senderFirstName}}" are preserved
9. **Language translates everything** — subject, greeting, body, closing all get translated (unlike tone which only changes body)
10. **Subject line scanning** — `[placeholders]` in subject lines are now AI-personalized too (processed independently from body placeholders)
11. **Rich lead context** — structured into 4 sections (RECIPIENT PROFILE, LOCATION, DIGITAL PRESENCE, RESEARCH NOTES), each omitted if empty
12. **Sender context** — AI knows who is sending (name, title, company, website from inbox sender fields), enabling more natural voice matching
13. **Expert anti-pattern enforcement** — system prompt includes explicit examples of good vs bad output, preventing generic corporate-speak like "I hope this finds you well"

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No `[...]` placeholders in subject or body | Step 1 skipped (returns null), Step 2 may still run |
| `OPENROUTER_API_KEY` not set | Both steps skipped, log warning |
| Step 1: API returns non-200 status | Log warning, leave that placeholder as-is |
| Step 1: API timeout (15s) | Abort, leave placeholder as-is |
| Step 1: Empty AI response | Leave placeholder as-is |
| Step 1: All placeholders fail | Email continues to Step 2 with original `[instruction]` text |
| Step 2: Tone OFF + language English | Step 2 skipped entirely (no API call) |
| Step 2: API returns non-200 / timeout (20s) | Log warning, email sends without tone/language adjustment |
| Step 2: Invalid JSON response | Log warning, email sends without tone/language adjustment |
| Smart template config fetch fails | Log warning, send with original content |
| `smart_template_personalized` DB update fails | Log warning, email still sends (non-blocking) |

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API authentication |
| `SMART_TEMPLATE_MODEL` | No | `openai/gpt-4o-mini` | AI model for both placeholder generation and tone/language transformation |

Set in `apps/api/.env` and `apps/workers/.env`.

## Examples

### Example 1: Placeholder Replacement (Step 1 only)

**Config:** Smart Template ON, Tone toggle OFF, Language match OFF

### Template (as written by user)

```html
<p>Hi {{firstName}},</p>

<p>[personalized opening about why their company would benefit from video clipping, 2-3 sentences]</p>

<p>We help content creators like those at <b>{{company}}</b> monetize their long-form videos through strategic short-form clips.</p>

<ul>
  <li>3x more engagement on social media</li>
  <li>Automated clip selection with AI</li>
  <li>Full analytics dashboard</li>
</ul>

<p>[closing sentence that creates urgency without being pushy]</p>

<p>Best,<br>{{senderFirstName}}</p>
```

### After AI Personalization (placeholders filled)

```html
<p>Hi {{firstName}},</p>

<p>With Acme Corp's recent expansion into the APAC market, scaling your video content across multiple regions and languages is going to be critical. A strategic clipping approach could help you maintain consistent brand presence across all your new markets without multiplying your production costs.</p>

<p>We help content creators like those at <b>{{company}}</b> monetize their long-form videos through strategic short-form clips.</p>

<ul>
  <li>3x more engagement on social media</li>
  <li>Automated clip selection with AI</li>
  <li>Full analytics dashboard</li>
</ul>

<p>I'd love to show you how this works in practice — would next Tuesday or Wednesday work for a quick 15-minute demo?</p>

<p>Best,<br>{{senderFirstName}}</p>
```

### After Variable Injection (final email)

```html
<p>Hi John,</p>

<p>With Acme Corp's recent expansion into the APAC market, scaling your video content across multiple regions and languages is going to be critical. A strategic clipping approach could help you maintain consistent brand presence across all your new markets without multiplying your production costs.</p>

<p>We help content creators like those at <b>Acme Corp</b> monetize their long-form videos through strategic short-form clips.</p>

<ul>
  <li>3x more engagement on social media</li>
  <li>Automated clip selection with AI</li>
  <li>Full analytics dashboard</li>
</ul>

<p>I'd love to show you how this works in practice — would next Tuesday or Wednesday work for a quick 15-minute demo?</p>

<p>Best,<br>Sarah</p>
```

HTML formatting (paragraphs, bold, bullet points, line breaks) is 100% preserved.

### Example 2: Tone Adjustment Only (Step 2, no placeholders)

**Config:** Smart Template ON, Tone toggle ON ("Casual"), Language match OFF
**Lead:** Country = US (English)

#### Template (as written by user)

```html
<p>Hi {{firstName}},</p>

<p>I wanted to reach out regarding our video clipping service. We help content creators at companies like {{company}} monetize their long-form videos through strategic short-form clips.</p>

<p>Our platform delivers 3x more engagement on social media with automated clip selection.</p>

<p>Would you be available for a brief call this week to discuss?</p>

<p>Best regards,<br>{{senderFirstName}}</p>
```

#### After Step 2 (tone adjusted to "Casual")

```html
<p>Hi {{firstName}},</p>

<p>Just wanted to drop you a quick note about our video clipping service. We help content creators at companies like {{company}} turn their long-form videos into killer short-form clips that actually make money.</p>

<p>Our platform gets you 3x more engagement on social — all with automated clip selection. Pretty cool stuff.</p>

<p>Got 15 minutes this week to chat about it?</p>

<p>Best regards,<br>{{senderFirstName}}</p>
```

Note: Greeting ("Hi {{firstName}},") and closing ("Best regards, {{senderFirstName}}") are preserved. Only body paragraphs are rewritten. No `[...]` placeholders needed.

### Example 3: Language Translation (Step 2, no placeholders)

**Config:** Smart Template ON, Tone toggle OFF, Language match ON
**Lead:** Country = DE (German)

#### Template (same as above)

#### After Step 2 (translated to German)

```html
<p>Hallo {{firstName}},</p>

<p>Ich wollte mich bezüglich unseres Video-Clipping-Services melden. Wir helfen Content-Erstellern bei Unternehmen wie {{company}}, ihre Langform-Videos durch strategische Kurzform-Clips zu monetarisieren.</p>

<p>Unsere Plattform liefert 3x mehr Engagement in sozialen Medien mit automatisierter Clip-Auswahl.</p>

<p>Hätten Sie diese Woche Zeit für ein kurzes Gespräch?</p>

<p>Mit freundlichen Grüßen,<br>{{senderFirstName}}</p>
```

Note: The ENTIRE email is translated — subject, greeting, body, and closing. `{{variables}}` and HTML tags are preserved exactly.

### Example 4: Both Tone + Language (Steps 1 + 2 combined)

**Config:** Smart Template ON, Tone toggle ON ("Friendly"), Language match ON
**Lead:** Country = FR (French), Company = "TechVision", Title = "Head of Content"

Template has `[placeholder]` → Step 1 fills it → Step 2 adjusts tone to "Friendly" then translates everything to French. All `{{variables}}` and HTML preserved throughout.

## Lead Context Helpers

Both `ai.service.ts` and `email-sender.ts` use identical helper functions to build structured AI context:

### `buildLeadContextBlock(lead)`

Builds a multi-section string from lead data. Each section is only included if data exists:

```
RECIPIENT PROFILE:
- Name: Sarah Chen
- Title: VP of Engineering
- Company: Acme Corp

LOCATION:
- Country: United States
- City: San Francisco

DIGITAL PRESENCE:
- LinkedIn: linkedin.com/in/sarahchen
- Website: acmecorp.com

RESEARCH NOTES:
Recently raised $15M Series B. Hiring 3 SDRs.
```

Returns `'No lead information available.'` if all fields are empty.

**API service** uses camelCase fields (`firstName`, `linkedinUrl`, `analysisNotes`).
**Worker** uses snake_case fields (`first_name`, `linkedin_url`, `analysis_notes`).

### `buildSenderContextBlock(sender)`

Builds sender context from inbox data:

```
SENDER PROFILE:
- Name: Alex Smith
- Title: Account Executive
- Company: SalesTech Inc
- Website: salestech.io
```

Returns empty string if no sender data. **API service** uses camelCase; **worker** uses inbox fields directly (`sender_first_name`, `sender_company`, etc.).

## analysis_notes Import Fix

The `analysis_notes` field was silently dropped during CSV import because it was missing from the `CreateLeadInput` interface in `leads.service.ts`. Now added — the field flows through to the database on both single lead creation and batch import, since the existing insert code already spreads the input object.

## Test Suite

147 tests across 4 files in `tests/smart-template-audit/`:

```bash
for f in tests/smart-template-audit/*.ts; do npx tsx "$f"; done
```

| Suite | File | Tests | What it covers |
|-------|------|-------|----------------|
| Placeholder Detection | `test-placeholder-detection.ts` | 39 | Regex extraction from body, subject, both; special characters; interaction with `{{variables}}`, spintax, conditionals; replacement mechanics; edge cases (nested brackets, empty, adjacent, duplicates) |
| Context Building | `test-context-building.ts` | 34 | `buildLeadContextBlock()` with full/partial/empty data; section omission; snake_case vs camelCase; XSS payloads; `buildSenderContextBlock()` with full/partial/empty/null; worker field compatibility |
| Config Retrieval | `test-config-retrieval.ts` | 29 | Variant priority over sequence; fallback chain; default values (enabled=false, tone=professional, toneEnabled=false, languageMatch=true, notes=null); boolean coercion; all tone types; languageMatch edge cases |
| Pipeline Integration | `test-pipeline-integration.ts` | 45 | Pipeline step determination; variable preservation through `processEmailContent`; temperature verification (0.4 in all smart template paths); subject scanning verification; expert prompt presence; analysis_notes import fix; sender context params; expanded lead data types |
