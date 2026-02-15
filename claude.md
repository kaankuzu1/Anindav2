# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mindora Systems** (internal codename: Aninda) is an intelligent outreach platform for professional business development with multi-inbox management, warm-up automation, campaign sequencing, and deliverability protection.

### Branding

- **User-facing brand**: "Mindora Systems" (short: "Mindora"). All UI, landing pages, auth pages, and legal pages use this name.
- **Internal codename**: "Aninda" — used in `@aninda/*` package names, GitHub repo (`Anindav2`), Railway project name, and developer docs. Changing these would break the monorepo.
- **Logo**: `apps/web/public/logo.png` — dark background with brain/compass icon. Referenced by sidebar, login, signup, favicon, and apple-icon.
- **Domain**: `mindorasystems.com`

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui, React Query, Zustand
- **Backend:** NestJS (modular monolith), TypeScript
- **Workers:** BullMQ async workers on Node.js
- **Database:** Supabase PostgreSQL with Row Level Security
- **Auth:** Supabase Auth (Google/Microsoft OAuth)
- **Queue/Cache:** Redis (local dev) / Upstash Redis (production) + BullMQ
- **Email Providers:** Gmail API, Microsoft Graph API, SMTP fallback
- **AI:** OpenRouter API (GPT-4o-mini)
- **Monorepo:** pnpm workspaces + Turborepo

## Development

```bash
# Install dependencies
pnpm install

# Run all services (web :3000, api :3001, workers)
pnpm dev

# Run individual apps
pnpm --filter @aninda/web dev      # Frontend on http://localhost:3000
pnpm --filter @aninda/api dev      # API on http://localhost:3001
pnpm --filter @aninda/workers dev  # Background workers

# Database
pnpm db:push       # Push schema changes to Supabase
pnpm db:generate   # Regenerate TypeScript types from schema
pnpm db:studio     # Open Supabase Studio

# Build & Lint
pnpm build         # Build all (uses Turborepo cache)
pnpm lint          # Lint all apps
pnpm clean         # Remove build artifacts and node_modules
```

## Repository Structure

```
apps/
├── web/           # Next.js frontend (src/app/ for pages, src/components/, src/lib/)
├── api/           # NestJS API (src/modules/{feature}/{controller,service,module}.ts)
└── workers/       # BullMQ workers (email-sender, warmup, reply-scanner, campaign-scheduler)

packages/
├── database/      # Supabase client + generated types (src/types.ts)
├── email-client/  # Provider adapters (gmail.ts, microsoft.ts, smtp.ts)
└── shared/        # Shared utilities (template engine, validation, types)
```

Import shared packages via `@aninda/database`, `@aninda/email-client`, `@aninda/shared`.

## API Configuration

- **Global prefix**: All API routes are prefixed with `api/v1` (set in `apps/api/src/main.ts`). Frontend fetch calls must use `${NEXT_PUBLIC_API_URL}/api/v1/...`, not just `${NEXT_PUBLIC_API_URL}/...`. **Important**: `NEXT_PUBLIC_API_URL` is `http://localhost:3001` (no prefix), so always append `/api/v1` explicitly — e.g. `const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1'`.
- **CORS**: Permissive in dev (`*`), restricted to `FRONTEND_URL` in production.
- **Validation**: Global `ValidationPipe` with `whitelist: true`, `transform: true`, `forbidNonWhitelisted: true`.
- **Auth guard**: `SupabaseAuthGuard` validates Bearer tokens via `supabase.auth.getUser(token)`. Authenticated user is on `request.user` with `{ sub, email, role }`.
- **Global modules**: `DatabaseModule` (provides `SUPABASE_CLIENT`) and `RedisModule` (provides `REDIS_CLIENT`) are global — no need to import them per feature module.

## Frontend Patterns

- **Supabase clients**: `apps/web/src/lib/supabase/client.ts` (browser, `createBrowserClient`) and `server.ts` (Server Components, `createServerClient` with cookies).
- **AI client**: `apps/web/src/lib/ai/client.ts` — typed API client for all AI endpoints. Uses `${NEXT_PUBLIC_API_URL}/api/v1/ai/...` with Bearer token auth.
- **React Query**: Configured in `apps/web/src/components/providers.tsx` with `staleTime: 60s`, `refetchOnWindowFocus: false`.
- **Keyboard shortcuts**: `apps/web/src/hooks/use-keyboard-shortcuts.ts` — supports single keys and two-key sequences (1s timeout). Cmd+1-9 for templates. Ignores shortcuts when input/textarea focused.
- **Notifications**: `apps/web/src/lib/notifications.ts` — desktop notifications, tab badge counter, and audio alerts. Real-time via Supabase channel subscriptions on the `replies` table.

## Testing

No jest/vitest framework is configured. Tests use standalone TypeScript scripts with `node:assert/strict`, run via `npx tsx`. 765 total tests across 3 audit suites.

### Variable System Audit (tests/variable-audit/)

229 tests across 5 suites verifying template variable replacement across all code paths:

```bash
# Run all variable audit tests
for f in tests/variable-audit/*.ts; do npx tsx "$f"; done
```

| Suite | File | Tests | What it covers |
|-------|------|-------|----------------|
| Core Engine | `test-core-engine.ts` | 57 | `processSpintax`, `processConditionalBlocks`, `processVariablesWithFallback`, `injectVariables`, `processEmailContent`, `validateTemplateSyntax` |
| Campaign Path | `test-campaign-path.ts` | 20 | Variable map from `email-sender.ts`, all 28 variable keys, edge cases |
| Reply Paths | `test-reply-paths.ts` | 35 | `replies.service.ts` map, `processTemplateVariables` regex approach, cross-comparison |
| AI + Import | `test-ai-and-import.ts` | 68 | `validateAndFixVariables`, `parseCSVLine`, `detectColumnFallback` |
| Integration | `test-integration.ts` | 49 | Cross-path consistency, security (XSS/SQLi/template injection), edge cases, all 5 bug regressions |

### Analytics Pipeline Audit (tests/analytics-audit/)

58 tests across 3 suites verifying the analytics tracking pipeline, stat calculations, and bug fixes:

```bash
# Run all analytics audit tests
for f in tests/analytics-audit/*.ts; do npx tsx "$f"; done
```

| Suite | File | Tests | What it covers |
|-------|------|-------|----------------|
| Frontend Calculations | `test-frontend-calculations.ts` | 23 | Status filtering (excludes queued/sending/failed), open/click counting, rate calculations, division-by-zero, spam/bounce rate |
| Backend Analytics | `test-backend-analytics.ts` | 15 | Dashboard stats shape (spam fields), empty data handling, rate rounding, campaign rate calculations, null safety |
| Tracking Pipeline | `test-tracking-pipeline.ts` | 20 | RPC call verification (not manual updates), campaign sent increment, variant stat flow, COALESCE null handling, call ordering |

### Campaign System Audit (tests/campaign-audit/)

478 tests across 10 suites verifying the full campaign lifecycle — scheduling, sending, bouncing, A/B testing, tracking, reply classification, webhooks, and cross-system integration:

```bash
# Run all campaign audit tests
for f in tests/campaign-audit/*.ts; do npx tsx "$f"; done
```

| Suite | File | Tests | What it covers |
|-------|------|-------|----------------|
| Campaign Scheduler | `test-campaign-scheduler.ts` | 53 | selectVariant weighted random, send windows, per-day schedule, health filtering, throttle %, MAX_EMAILS_PER_RUN, blocksSequence, variable injection |
| Inbox Distribution | `test-inbox-distribution.ts` | 44 | Health score formula (day/reply/volume/engagement/penalties), warmup quota ramp (all tiers × speeds), ESP rate limits, domain detection |
| Email Sender | `test-email-sender.ts` | 55 | Variable map construction, normalizeVariableMap, fullName computation, custom_fields filtering, isAuthError detection, processEmailContent pipeline, blocksSequence |
| Tracking Pipeline | `test-tracking-pipeline.ts` | 29 | Tracking ID encode/decode, pixel injection (3 fallbacks), link wrapping (7 skip conditions), applyEmailTracking combos, URL validation, GIF buffer |
| Bounce Processor | `test-bounce-processor.ts` | 39 | bounceTypeToEvent, soft/hard transitions, retry simulation, suppression fix regression, inbox auto-pause, terminal states, non-blocking pattern |
| Reply Classification | `test-reply-classification.ts` | 35 | All 9 intent mappings, state transitions, direct classification, suppression intents, manual override protection, cross-system consistency |
| A/B Testing | `test-ab-testing.ts` | 59 | Weighted selection (10K iterations), z-score, CDF, progressive shifting (5 thresholds), reset weight fix regression, winner declaration, stat computation |
| Webhook Delivery | `test-webhook-delivery.ts` | 38 | HMAC-SHA256 determinism, roundtrip, tampering, retries, all 14 event types, schema validation, payload format |
| Lead State Machine | `test-lead-state-machine.ts` | 91 | All valid/invalid transitions, terminal states, blocksSequence, MANUAL_OVERRIDE, isTerminalState, helpers, getAvailableEvents, transition() method |
| Integration | `test-campaign-integration.ts` | 35 | Full lifecycle, multi-step sequences, A/B variant lifecycle, cross-system consistency, validation schemas, race conditions, webhook roundtrip |

### Campaign System — All Known Bugs Fixed

3 bugs discovered by the campaign audit suite have been fixed and verified by 478 regression tests:

| # | Bug (FIXED) | Fix Applied |
|---|-------------|-------------|
| 1 | **Bounce suppression gap** — soft bounces exhausting retries weren't added to suppression list because check used `bounceType` ('soft') instead of `effectiveBounceType` ('hard') | Changed suppression check in `bounce-processor.ts` from `bounceType === 'hard'` to `effectiveBounceType === 'hard'` |
| 2 | **A/B test reset rounding** — `Math.floor(100/3)=33`, total `33*3=99≠100` | `resetTest()` in `ab-test.service.ts` now assigns remainder to first variant: `baseWeight + remainder` |
| 3 | **isAuthError false positive** — `msg.includes('auth')` matched 'author' and other non-auth strings, risking incorrect inbox disconnection | Replaced with specific patterns in both `email-sender.ts` and `warmup.ts`: `'authentication'`, `'auth_error'`, `'auth error'`, `'insufficient permissions'` |

## Key Architecture Patterns

### Email Flow
1. Campaign created → API stores in database
2. Campaign scheduler worker enqueues send jobs (with A/B variant selection if variants exist)
3. Email sender worker processes queue → selects inbox → sends via provider → increments campaign `sent_count` via `increment_campaign_sent()` RPC + variant `sent_count`
4. Reply scanner periodically checks inboxes → AI classifies intent → increments variant `replied_count`
5. Tracking service records opens/clicks → atomically increments email `open_count`/`click_count` via `increment_email_open()`/`increment_email_click()` RPCs + campaign `opened_count`/`clicked_count` via RPCs + variant stats
6. AB Test Optimizer periodically evaluates variant performance → progressive traffic shifting → declares winners

### Reply Management Flow
1. User opens replies inbox → loads replies with AI-classified intents
2. **Manual Classification**: User can manually set intent → sets `intent_manual_override = true`
3. **Batch Re-classification**: AI re-classifies selected replies, but skips those with `intent_manual_override = true`
4. **Reply Composer**: User can write manual reply or generate AI reply
   - AI generation from composer: Populates textarea (does NOT show AI panel)
   - AI generation from panel: Shows in side panel for review
5. **Templates**: User can insert pre-defined templates with keyboard shortcuts (1-9)

### Workers (apps/workers/src/)
| Worker | Purpose |
|--------|---------|
| `email-sender.ts` | Send campaign emails with unsubscribe headers + variable injection (lead + inbox vars). Increments campaign `sent_count` via RPC + variant `sent_count`. Reactive disconnection detection on auth errors. Smart template personalization with optional language matching and creator notes. |
| `campaign-scheduler.ts` | Schedule follow-ups, conditional logic. Weighted A/B variant selection via `selectVariant()`. |
| `warmup.ts` | Inbox warm-up with multi-level threads. Reactive disconnection detection on auth errors. |
| `reply-scanner.ts` | Scan replies, AI intent classification. Increments variant `replied_count`. |
| `connection-checker.ts` | Daily proactive connection check for all active inboxes (runs at 04:00 UTC) |
| `ab-test-optimizer.ts` | Periodic A/B test evaluation with z-score significance testing and progressive traffic shifting. Runs every 30 minutes. |
| `bounce-processor.ts` | Process hard/soft bounces and spam complaints. Soft bounce retry with exponential backoff (uses `retry_pending` status + `soft_bounce_count`/`last_retry_at` columns). Suppression list uses `effectiveBounceType` (covers both direct hard bounces and soft bounces that exhausted retries). Increments `spam_complaints_total` on complaints. Increments campaign `bounced_count` via `increment_campaign_bounces()` RPC. Auto-pauses inboxes at >3% bounce rate. |

**Email Sender Variables**: Three processing paths handle variable injection, but they are NOT equivalent:

| Path | Engine | Spintax | Conditionals | Fallbacks | Unknown vars | Custom fields | Case |
|------|--------|---------|-------------|-----------|-------------|---------------|------|
| Campaign (`email-sender.ts`) | `processEmailContent()` | Resolved | Evaluated | Resolved | Preserved | NOT included | Sensitive |
| Reply (`replies.service.ts`) | `processEmailContent()` | Resolved | Evaluated | Resolved | Preserved | Included | Sensitive |
| Template preview (`reply-templates.service.ts`) | `processEmailContent()` | Resolved | Evaluated | Resolved | Preserved | N/A | Sensitive |
| Test email (`campaign-test.service.ts`) | `processEmailContent()` | Resolved | Evaluated | Resolved | Preserved | N/A | Sensitive |

All four paths now use the shared `processEmailContent()` pipeline and behave identically for spintax, conditionals, fallbacks, and unknown variable handling. The campaign and reply paths additionally spread `lead.custom_fields` into the variable map. The test email path uses synthetic lead data provided by the user.

### A/B Testing System

Campaign sequences support A/B testing with multiple subject/body variants per sequence step. The system handles variant selection, stat tracking, and automatic optimization.

**How it works:**
1. **Variant creation**: User adds variants (A, B, C...) during campaign creation at `/campaigns/new`. Each variant has its own subject and body. Stored in `sequence_variants` with `variant_index` (0=A, 1=B, etc.) and `weight` (traffic %).
2. **Weighted selection**: Campaign scheduler (`campaign-scheduler.ts`) calls `selectVariant()` which picks a variant using weighted random distribution based on current weights. Falls back to original sequence content if no variants exist.
3. **Stat tracking**: Every email touchpoint increments variant counters via `increment_variant_stat()` RPC:
   - `email-sender.ts` → `sent_count` (after successful send)
   - `tracking.service.ts` → `opened_count` (on pixel load) and `clicked_count` (on link click)
   - `reply-scanner.ts` → `replied_count` (when reply linked to variant email)
4. **Progressive traffic shifting**: `ab-test-optimizer.ts` runs every 30 min, computes z-score confidence:
   - < 50 sends per variant → keep equal split (insufficient data)
   - 70-80% confidence → 60/40 favoring leader
   - 80-90% confidence → 75/25 favoring leader
   - 90-95% confidence → 85/15 favoring leader
   - ≥ 95% confidence → declare winner (100/0), set `is_winner = true`
5. **Manual override**: Users can declare a winner or reset tests via the campaign detail page. Manual winners are respected — optimizer skips sequences with `is_winner = true`.

**Key database tables:**

**`sequence_variants`**
- `variant_index` (INTEGER): Position (0=A, 1=B, ...)
- `variant_name` (VARCHAR): Display name ("Variant A", "Variant B")
- `subject`, `body`: Email content for this variant
- `weight` (INTEGER): Traffic percentage (all weights for a sequence should sum to 100)
- `sent_count`, `opened_count`, `clicked_count`, `replied_count`: Stat counters (incremented via RPC)
- `is_winner` (BOOLEAN): Whether this variant was declared the winner
- `winner_declared_at` (TIMESTAMPTZ): When winner was declared

**`ab_test_events`** (audit trail)
- `event_type`: `winner_declared`, `weight_adjusted`, `manual_override`, `test_reset`
- `winner_variant_id`, `metric`, `confidence`, `metadata`
- Used for the A/B Test History timeline on campaign detail page

**API endpoints** (on campaigns controller):
| Endpoint | Purpose |
|----------|---------|
| `GET /campaigns/:id/ab-test/:seqId/stats` | Variant performance data with computed rates |
| `POST /campaigns/:id/ab-test/:seqId/winner` | Manual winner declaration |
| `POST /campaigns/:id/ab-test/:seqId/reset` | Reset test to equal weights |
| `PATCH /campaigns/:id/ab-test/:seqId/weights` | Manual weight adjustment (must sum to 100) |
| `GET /campaigns/:id/ab-test/history` | Optimization audit log |

**Frontend pages:**
- `/campaigns/new` — Variant creation during campaign setup (variant_index + variant_name saved). Smart template controls (toggle, tone, language match, creator notes) per step and per variant. Test email section for preview/send. Inline "Test" buttons on each variant card and "Test A" on the original step header for quick testing — clicking scrolls to the test email section with the correct step/variant pre-selected.
- `/campaigns/[id]` — A/B performance table with Declare Winner / Reset buttons, confidence meter, click columns, collapsible test history. Auto-refreshes every 60s for active campaigns.
- `/analytics` — "A/B Tests" tab showing active tests (with variant cards) and completed tests (with winner badges)

**Service files:**
- `apps/api/src/modules/campaigns/ab-test.service.ts` — A/B test management (stats, winner, reset, weights, history)
- `apps/workers/src/ab-test-optimizer.ts` — Automated optimization with progressive traffic shifting

### Smart Template System

AI-powered email personalization at send time. Each sequence step (and each A/B variant independently) can enable smart template to have AI personalize the email for each lead.

**Features:**
1. **Toggle per step/variant**: `smart_template_enabled` (BOOLEAN) + `smart_template_tone` (VARCHAR) on both `sequences` and `sequence_variants` tables
2. **Optional language matching**: `smart_template_language_match` (BOOLEAN, default TRUE). When enabled, AI translates to the lead's country language via `getLanguageFromCountry()`. When disabled, AI keeps the email in English regardless of lead country.
3. **Creator notes**: `smart_template_notes` (TEXT, nullable). Free-text AI instructions per step/variant (e.g., "Focus on their recent funding round", "Mention our Salesforce integration"). Passed as high-priority guidance in AI prompts.
4. **Test email**: Preview and send test emails during campaign creation to verify personalization before launching.

**Database columns** (on both `sequences` and `sequence_variants`):
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `smart_template_enabled` | BOOLEAN | FALSE | Enable AI personalization |
| `smart_template_tone` | VARCHAR(30) | 'professional' | AI tone (professional, casual, friendly, persuasive, urgent, empathetic) |
| `smart_template_language_match` | BOOLEAN | TRUE | Translate to lead's country language |
| `smart_template_notes` | TEXT | NULL | Creator instructions for AI |

**Migrations**:
- `20260211000000_add_smart_template.sql` — adds `smart_template_enabled`, `smart_template_tone`, `analysis_notes` (leads), `smart_template_personalized` (emails)
- `20260212000000_add_smart_template_enhancements.sql` — adds `smart_template_language_match`, `smart_template_notes`

**Worker flow** (`email-sender.ts`):
1. `getSmartTemplateConfig()` reads config from variant (priority) or sequence (fallback), returns `{ enabled, tone, languageMatch, notes }`
2. `personalizeWithAI()` calls OpenRouter with language (or English if match disabled), tone, analysis notes, and creator notes
3. Skip optimization: if language=English AND no analysis notes AND tone=professional AND no creator notes → skip AI call entirely

**Test email flow** (`campaign-test.service.ts`):
1. `previewTest()` — builds variable map from test lead + inbox, processes template, optionally runs AI personalization
2. `sendTest()` — calls `previewTest()` then sends via Gmail/Microsoft to a test recipient (no DB record created)

**API endpoints** (on campaigns controller):
| Endpoint | Purpose |
|----------|---------|
| `POST /campaigns/preview-test` | Preview processed template with test lead data |
| `POST /campaigns/send-test` | Send test email to a recipient address |

**Frontend** (`/campaigns/new`):
- Smart template toggle row includes tone dropdown, language match toggle button, and info tooltip
- Creator notes textarea appears below toggle when smart template is enabled
- Same controls available independently on each A/B variant
- Collapsible "Test Email" card (`testEmailRef`) with step selector, inbox picker, variant selector, recipient email, test lead data form, Preview/Send buttons, and rendered preview display
- **Inline variant testing**: Each variant card has a "Test" button (Send icon) in its header row; the A/B section header has a "Test A" button for the original step content. Both call `testVariant(stepIndex, variantId)` which sets `testStepIndex`/`testVariantId`, opens the test email section, resets preview state, and smooth-scrolls to `testEmailRef`

**Service files:**
- `apps/api/src/modules/campaigns/campaign-test.service.ts` — Test email preview and send
- `apps/api/src/modules/ai/ai.service.ts` — `personalizeEmail()` accepts `creatorNotes` param

### Template Syntax (packages/shared/src/utils.ts)
```
{Hello|Hi|Hey} {{firstName}}           # Spintax + variable
{{company|your company}}               # Variable with fallback
{if:company}At {{company}}.{/if}       # Conditional block
{ifnot:phone}Reply to schedule.{/ifnot}
```

**Variable Naming**: Templates support both `camelCase` and `snake_case` for flexibility:
- `{{firstName}}` and `{{first_name}}` both work
- `{{senderCompany}}` and `{{sender_company}}` both work
- Normalization handled in `normalizeVariableMap()` helper (used by both `injectVariables()` and `processConditionalBlocks()`)

**Variable Types** (two categories):

**Receiver (Lead)** variables — data from imported leads:
| Variable | Description |
|----------|-------------|
| `firstName` / `first_name` | Lead's first name |
| `lastName` / `last_name` | Lead's last name |
| `email` | Lead's email |
| `company` | Lead's company |
| `title` | Lead's job title |
| `phone` | Lead's phone |
| `fullName` / `full_name` | Computed: firstName + lastName |

**Sender (Inbox)** variables — configured per inbox in settings:
| Variable | DB Column |
|----------|-----------|
| `senderFirstName` / `sender_first_name` | `inboxes.sender_first_name` |
| `senderLastName` / `sender_last_name` | `inboxes.sender_last_name` |
| `senderCompany` / `sender_company` | `inboxes.sender_company` |
| `senderTitle` / `sender_title` | `inboxes.sender_title` |
| `senderPhone` / `sender_phone` | `inboxes.sender_phone` |
| `senderWebsite` / `sender_website` | `inboxes.sender_website` |
| `fromEmail` / `from_email` | `inboxes.email` |
| `fromName` / `from_name` | `inboxes.from_name` (auto-computed from first+last) |

There are no custom/arbitrary variables. All variables are either Receiver (lead) or Sender (inbox).

### Template System — All Known Bugs Fixed

All 5 previously-known template system bugs have been fixed and verified by 229 regression tests in `tests/variable-audit/`.

| # | Bug (FIXED) | Fix Applied |
|---|-------------|-------------|
| 1 | **Conditional blocks now normalize variable names** — `{if:first_name}` works with camelCase-only variable maps | Extracted `normalizeVariableMap()` helper, called at start of `processConditionalBlocks()` |
| 2 | **Reply template preview now supports full template syntax** — spintax, conditionals, and fallbacks all work | Rewrote `processTemplateVariables()` to use `processEmailContent()` |
| 3 | **Custom fields now supported in campaign emails** — `email-sender.ts` spreads `lead.custom_fields` into variables | Added custom_fields spread after variable map construction |
| 4 | **Unknown variables now preserved in template preview** — `{{unknownVar}}` kept as-is instead of silently stripped | Removed catch-all regex (inherent in Bug #2 fix) |
| 5 | **Fallback regex now handles `}` in fallback text** — `{{var\|fallback with } brace}}` works correctly | Changed regex from `[^}]+` to lazy `[\s\S]+?` matching |

**Notes:**
- `normalizeVariableMap()` provides bidirectional camelCase↔snake_case mapping for all variable pairs including `fullName`↔`full_name`, `fromEmail`↔`from_email`, `fromName`↔`from_name`
- The template engine does NOT sanitize HTML in variable values (XSS payloads pass through). This is by design for email HTML content but should be noted for any web-facing preview contexts
- Template injection is safe: `String.replace` with `/g` flag is single-pass and does not re-scan replacement text, preventing recursive variable resolution

### Reply Templates (apps/api/src/modules/replies/)
Reply templates allow quick responses with:
- Keyboard shortcuts (1-9)
- Intent-based defaults (interested, question, etc.)
- Variable substitution (lead + inbox variables)
- AI-generated replies with validation

**Intent Manual Override**: Replies with `intent_manual_override=true` are protected from batch AI re-classification to prevent accidental data loss.

### AI Content Generation (apps/api/src/modules/ai/ai.service.ts)
AI generates campaign copy and replies using OpenRouter API with:
- **Validation**: Auto-detects and fixes hardcoded names (e.g., "Hi John," → "Hi {{firstName}},")
- **Prompt Engineering**: Explicit variable usage rules in system prompts
- **Post-processing**: Regex-based validation with warning logs
- **Tone Support**: Professional, friendly, short, follow-up tones
- **CSV Column Mapping** (`POST /ai/map-columns`): AI-powered detection of CSV column-to-lead-field mappings during lead import. Takes headers + sample rows, returns suggested mappings.
- **Smart Template Personalization** (`personalizeEmail()`): Accepts optional `creatorNotes` param. Creator notes are included in both the lead context array and as a dedicated `CAMPAIGN CREATOR INSTRUCTIONS` section in the user prompt. System prompt rule prioritizes creator instructions as high-priority guidance.

### Lead Import Flow
1. **Upload CSV** + choose/create lead list
2. **Map Columns** — visual mapping UI with checkboxes and dropdowns. Pattern-based detection auto-maps recognized columns. "Auto-detect with AI" button sends headers + sample rows to `POST /ai/map-columns` for intelligent mapping.
3. **Preview** — shows mapped data in a table (first 5 rows)
4. **Import** — only imports enabled+mapped columns. No custom fields.

**Predefined lead fields**: email (required), first_name, last_name, company, title, phone, linkedin_url, website, country, city, timezone.

### Leads Table Inline Editing

The leads table at `/leads` supports click-to-edit on Contact and Company columns. Edits are accumulated locally and batch-saved via a floating save bar.

**Editable fields**: `first_name`, `last_name`, `email` (Contact column), `company`, `title` (Company column). List, Status, and Added columns are not editable inline.

**State management** (all in `apps/web/src/app/(dashboard)/leads/page.tsx`):
- `editingCell: { leadId, field } | null` — which cell is in edit mode
- `editedLeads: Map<string, Partial<Lead>>` — unsaved changes keyed by lead ID
- `saving` / `saveError` / `saveSuccess` — save lifecycle

**UX behavior**:
- Click text → transforms to `<input>`, auto-focused and selected
- Enter → commits edit locally, exits edit mode
- Escape → reverts that field's edit, exits edit mode
- Tab/Shift+Tab → commits and moves to next/previous editable field in the row (`first_name` → `last_name` → `email` → `company` → `title`)
- Click outside → commits edit locally
- Edited cells show a primary-colored left border indicator

**Contact column**: Clicking the name shows side-by-side first/last name inputs. Clicking email shows a separate email input.

**Save bar**: Sticky bar at bottom appears when `editedLeads.size > 0`. Shows "{N} lead(s) modified" + Discard/Save buttons. Save validates emails (same regex as detail page), then calls `supabase.from('leads').update(...)` per lead. On success, clears edits and refreshes the list.

**No backend changes**: Uses the same direct Supabase client update pattern as the lead detail page (`leads/[id]/page.tsx`). RLS policies handle authorization.

### Lead Status Flow
```
pending → in_sequence → contacted → replied → interested/not_interested → meeting_booked
                     ↘ bounced/unsubscribed/sequence_complete
```

### Key Database Tables
**`replies`**
- Stores incoming replies with AI-classified intent
- `intent_manual_override` (boolean): Protects manual classifications from batch AI re-classification
- Indexed on `intent_manual_override WHERE true` for performance

**`reply_templates`**
- Pre-defined response templates with variable support
- `shortcut_number` (1-9): Keyboard shortcut for quick access
- `intent_type`: Default template for specific intent (interested, question, etc.)
- `is_default`: Auto-suggest for matching intent type

**`sent_replies`**
- Tracks outbound replies sent in response to incoming emails
- Links to `replies`, `inboxes`, `leads`, `campaigns`
- Threading headers: `message_id`, `in_reply_to`, `thread_id`, `references_header`
- Status: `queued`, `sending`, `sent`, `failed`, `bounced`

**`sequence_variants`**
- Stores A/B test variants for campaign sequence steps
- Each variant has its own subject/body, weight (traffic %), and stat counters
- `is_winner` flag protects against optimizer overrides after manual winner declaration
- Stats incremented atomically via `increment_variant_stat()` RPC function

**`ab_test_events`**
- Audit trail for A/B test optimization decisions
- Event types: `winner_declared`, `weight_adjusted`, `manual_override`, `test_reset`
- Links to `campaigns`, `sequences`, and optionally `sequence_variants`
- RLS policy: team access via campaign ownership

### Inbox Connection Check
Proactive and reactive detection of disconnected email inboxes (expired/revoked OAuth, bad SMTP credentials).

**Proactive (daily)**: `ConnectionChecker` worker runs at 04:00 UTC, checks all `active`/`warming_up` inboxes via `GmailClient.getProfile()`, `MicrosoftClient.ensureValidToken() + getProfile()`, or `testSmtpConnection()`. Disconnected inboxes are marked `status='error'` with `status_reason='Email account disconnected — please reconnect'`. Warmup is auto-disabled.

**Reactive (on send)**: `email-sender.ts` and `warmup.ts` catch auth errors (401, invalid_grant, token expired, etc.) during sends. On auth error, the inbox is marked disconnected and the job fails as non-retryable.

**Manual check**: `POST /inboxes/:id/check-connection` endpoint + UI button on inboxes list and detail pages.

**Auto-recovery**: If a previously disconnected inbox passes a connection check (e.g., user reconnected via OAuth), it's automatically restored to `status='active'`.

**UI indicators**:
- Inboxes list: `DISCONNECTED` badge (dark/black), check connection button, disconnected stat card
- Inbox detail: Red banner with "Reconnect" and "Check Again" buttons
- Warmup page: `DISCONNECTED` badge, disabled warmup controls
- Campaign detail: Warning banner listing disconnected sending inboxes

**Campaign behavior**: Campaigns don't auto-pause. The campaign scheduler already filters by `status='active'`, so disconnected inboxes (`status='error'`) are naturally excluded from rotation. Campaigns continue with remaining healthy inboxes.

### Warmup Modes

Warmup supports two modes managed via a choice screen at `/warmup`:

**Pool Warmup** (`/warmup/pool`): Peer-to-peer warmup where user's own inboxes exchange emails with each other. Requires 2+ active inboxes. Blue theme.

**Network Warmup** (`/warmup/network`): Platform-managed warmup using admin inboxes. Works with 1 inbox. Purple theme. Currently "Coming Soon" until admin inboxes are configured.

**Route structure**:
| Route | Purpose |
|-------|---------|
| `/warmup` | Choice screen with Pool vs Network hero cards |
| `/warmup/pool` | Pool warmup management (active + available inboxes) |
| `/warmup/network` | Network warmup management (active + available inboxes) |

**Database**: `warmup_state.warmup_mode` column (`VARCHAR(20)`, nullable, default `'pool'`). `null` means unassigned — inbox appears in "Available Inboxes" on both pages.

**API endpoints**:
- `PATCH /api/v1/warmup/:id/mode` — Set `warmup_mode` to `'pool'`, `'network'`, or `null` (unassign)
- `POST /api/v1/warmup/:id/enable` — Enable warmup
- `POST /api/v1/warmup/:id/disable` — Disable warmup
- `PATCH /api/v1/warmup/:id` — Update settings (ramp_speed, target_daily_volume, reply_rate_target)
- `POST /api/v1/warmup/:id/reset` — Reset warmup progress
- `GET /api/v1/warmup/:id/history` — Fetch warmup history

**Frontend components** (`apps/web/src/components/warmup/`):
- `warmup-mode-card.tsx` — Hero card for choice screen
- `warmup-stats-grid.tsx` — Stats filtered by mode
- `warmup-inbox-table.tsx` — Active inbox table with enable/disable, settings, history, remove actions
- `unassigned-inbox-card.tsx` — Card for available inboxes with "Add to Pool/Network" CTA

**User flow**: Choice screen → Select mode → See active + available inboxes → Assign inboxes → Enable warmup. Remove button unassigns inbox (sets `warmup_mode = null`).

### Warmup Email Templates

Warmup emails use 205 pre-written templates with personalization and Fisher-Yates shuffle deduplication to prevent repetition.

**Template files:**
- `apps/workers/src/warmup-templates.ts` — 105 main templates, 50 reply templates, 30 continuation templates, 20 closer templates
- `apps/workers/src/warmup-dedup.ts` — Redis-based dedup using shuffled index sequences per inbox-pair

**Personalization variables** (uses the shared `processEmailContent()` pipeline):
- `{{firstName|there}}` — Recipient's first name (extracted from `from_name`), falls back to "there"
- `{{senderFirstName}}` — Sender's first name (extracted from `from_name`)

**Dedup mechanism** (`getNextTemplateIndex()`):
- Redis key: `warmup:dedup:{fromId}:{toId}:{type}` where type is `main`, `reply`, `continuation`, or `closer`
- Stores a Fisher-Yates shuffled index sequence per inbox-pair + template type
- Pops next index on each call; reshuffles automatically when exhausted
- 7-day TTL per key to prevent stale data
- Guarantees no duplicate templates until the full set cycles through

**Reply subject fix**: Reply jobs receive `originalSubject` from the initial send job and use it with `Re:` prefix instead of the previously hardcoded `'Re: Quick question'`.

### Warmup State Synchronization

`inbox.status` (`'active'` / `'warming_up'`) and `warmup_state.enabled` (`true` / `false`) must always be in sync. Multiple code paths disable warmup, and all must reset `inbox.status` back to `'active'`.

**Invariant**: `inbox.status === 'warming_up'` ⟺ `warmup_state.enabled === true`. Any violation is a desync bug.

**Code paths that disable warmup (all must reset inbox.status):**

| Code Path | File | Trigger |
|-----------|------|---------|
| `disableWarmup()` | `warmup.service.ts` | User disables via API |
| `updateWarmupSettings(enabled=false)` | `warmup.service.ts` | Settings update |
| `resetWarmup()` | `warmup.service.ts` | User resets warmup |
| `disablePoolWarmup()` | `warmup-scheduler.ts` | Scheduler detects < 2 pool peers |
| `markDisconnected()` (user inbox) | `warmup.ts`, `connection-checker.ts`, `inboxes.service.ts` | Auth error or daily check |
| `markDisconnected()` / `markAdminDisconnected()` (admin inbox cascade) | `warmup.ts`, `connection-checker.ts` | Admin inbox disconnects → disables user inboxes |
| `cascadePoolWarmupCheck()` | `warmup.ts`, `connection-checker.ts`, `warmup.service.ts`, `inboxes.service.ts` | After disconnection, remaining pool < 2 |

**Auto-healing (defense in depth):**
- `reconcileWarmupState()` in `warmup.service.ts` — called on every `getWarmupState()` read, auto-fixes desync in both directions
- `autoRecover()` in `inboxes.service.ts` — on connection check success, also fixes warmup desync
- OAuth callback (`google/callback/route.ts`) — on inbox reconnection, scans team for desynced inboxes

**Pre-flight guard**: `enableWarmup()` rejects if `inbox.status === 'error'` (disconnected).

### Legal Pages & Signup Consent

Public-facing Terms of Service and Privacy Policy pages with a mandatory consent checkbox on signup.

**Route group**: `(legal)` — no URL prefix, pages are at `/terms` and `/privacy`

**Layout** (`apps/web/src/app/(legal)/layout.tsx`):
- Server Component, no auth required
- Header with logo + brand link to `/`, nav links to Terms/Privacy
- `max-w-4xl` centered content area on `bg-gray-50`
- Footer with copyright + legal links

**Pages**:
- `/terms` (`apps/web/src/app/(legal)/terms/page.tsx`) — 14 sections: acceptance, service description, account registration, acceptable use, email compliance (CAN-SPAM/GDPR/CASL/PECR), warm-up disclaimers, data ownership, IP, third-party integrations, payment, liability, indemnification, termination, contact (legal@mindorasystems.com)
- `/privacy` (`apps/web/src/app/(legal)/privacy/page.tsx`) — 12 sections: introduction, data collection, usage, lead data processing (controller/processor model), AI & email content, storage & security, third-party services, retention, GDPR rights, cookies, policy changes, contact (privacy@mindorasystems.com)

**Landing page footer** (`apps/web/src/components/landing/Footer.tsx`): Bottom bar links use Next.js `Link` to `/privacy` and `/terms` (replaced `#privacy`/`#terms` anchors).

**Signup consent** (`apps/web/src/app/(auth)/signup/page.tsx`):
- `agreedToTerms` state (default `false`)
- Checkbox with label linking to `/terms` and `/privacy` (open in new tab via `target="_blank"`)
- Both "Create account" (email/password) and "Google" (OAuth) buttons are `disabled` when `!agreedToTerms`
- Existing `disabled:opacity-50` class handles visual disabled state

### Admin Panel

Admin panel at `/admin` with separate auth (env-based credentials, not Supabase Auth).

**Credentials**: Set via `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET` in `apps/api/.env`.

**API client**: `apps/web/src/lib/admin-api.ts` — uses `localStorage` `admin_token` with Bearer auth. URL constructed as `${NEXT_PUBLIC_API_URL}/api/v1/admin/...`.

**Routes**: `/admin/login`, `/admin` (dashboard), `/admin/inboxes`, `/admin/users`.

### Spam Tracking

Spam complaint and spam folder detection across campaigns and warmup, with visibility on inboxes, warmup, and analytics pages.

**Campaign Spam (inboxes)**:
- `inboxes.spam_complaints_total` (INTEGER, default 0): All-time count of spam complaints for campaign emails sent from this inbox
- Incremented atomically via `increment_inbox_spam(p_inbox_id)` RPC function in `bounce-processor.ts` when `bounceType === 'complaint'`
- Non-blocking: wrapped in try/catch, logs warning on failure

**Warmup Spam (warmup_state)**:
- `warmup_state.spam_today` (INTEGER, default 0): Warmup emails detected in spam/junk folder today
- `warmup_state.spam_total` (INTEGER, default 0): All-time warmup spam detections

**Migration**: `packages/database/supabase/migrations/20260209000000_add_spam_tracking.sql`

**UI indicators**:
- **Inboxes page** (`/inboxes`): "Spam Reports" stat card (conditional, red, shown when total > 0), "Spam" table column with `ShieldAlert` icon (red when > 0)
- **Warmup pages** (`/warmup/pool`, `/warmup/network`): "Spam" column in inbox table (today/total), "Spam Detected" stat card (conditional, shown when today > 0)
- **Analytics Emails tab** (`/analytics`): "Spam" stat card, "Spam Rate" rate card, expandable "Spam Reports by Campaign" table with per-inbox drill-down (queries `email_events` where `event_type = 'spam_reported'`)

### Analytics & Tracking Pipeline

Open/click tracking and campaign stat increments use atomic RPC functions to prevent race conditions.

**Email-level RPCs** (called by `tracking.service.ts`):
| RPC | What it does |
|-----|-------------|
| `increment_email_open(p_email_id)` | Atomically increments `open_count` + sets `opened_at` on first open (COALESCE) |
| `increment_email_click(p_email_id)` | Atomically increments `click_count` + sets `clicked_at` on first click (COALESCE) |

**Campaign-level RPCs** (called by workers + tracking service):
| RPC | Called by |
|-----|----------|
| `increment_campaign_sent(campaign_id)` | `email-sender.ts` after email marked as sent |
| `increment_campaign_opens(campaign_id)` | `tracking.service.ts` on open event |
| `increment_campaign_clicks(campaign_id)` | `tracking.service.ts` on click event |
| `increment_campaign_bounces(campaign_id)` | `bounce-processor.ts` on bounce |

**Migration**: `packages/database/supabase/migrations/20260210000000_fix_analytics_pipeline.sql`

**Additional `emails` table columns** (added by the analytics pipeline migration):
- `opened_at` (TIMESTAMPTZ): First open timestamp
- `clicked_at` (TIMESTAMPTZ): First click timestamp
- `bounced_at` (TIMESTAMPTZ): Bounce timestamp
- `bounce_type` (VARCHAR(20)): `hard`, `soft`, or `complaint`
- `bounce_reason` (TEXT): Human-readable bounce reason
- `soft_bounce_count` (INTEGER, default 0): Retry counter for soft bounces
- `last_retry_at` (TIMESTAMPTZ): Last retry attempt timestamp

**`email_status` enum** includes: `queued`, `sending`, `sent`, `delivered`, `opened`, `clicked`, `bounced`, `failed`, `retry_pending`

**Frontend analytics** (`/analytics`): Queries Supabase directly (not the backend API). 4 tabs: Overview, Emails, Replies, A/B Tests. Time range selector (7d/30d/90d) triggers re-fetch via `useEffect` on `timeRange` state. `emailsSent` count filters by actual sent statuses (`sent`, `delivered`, `opened`, `clicked`, `bounced`) — excludes `queued`/`sending`/`failed`.

**Backend analytics** (`analytics.controller.ts`): All endpoints require `team_id` query param (validated with `BadRequestException`). Sequences endpoint uses `@Param('campaign_id')` (path param). `getSequencePerformance` verifies campaign belongs to team before returning data. `getDashboardStats` includes `emailsSpamReported` and `spamRate` in response.

### Deliverability Thresholds
- Bounce rate > 3% or Spam rate > 1%: Auto-pause inbox
- Health score < 50: Skip for campaigns
- Health score determines send capacity (20-100 → 25-100%)

## Railway Deployment

Production is deployed on Railway with 4 services in the "Aninda" project.

**Dashboard**: https://railway.com/project/09cd2aae-567f-42eb-864c-8b74acfffe07

**Custom domain**: `https://mindorasystems.com` → web service (SSL via Let's Encrypt, auto-renewed by Railway)

| Service | URL | Dockerfile |
|---------|-----|------------|
| web (Next.js) | https://mindorasystems.com (primary) / https://web-production-e1385.up.railway.app | `Dockerfile.web` |
| api (NestJS) | https://api-production-06e6.up.railway.app | `Dockerfile.api` |
| workers (BullMQ) | No public URL (background) | `Dockerfile.workers` |
| Redis | `redis.railway.internal:6379` | Railway-provisioned |

**Domain DNS** (Hostinger): ALIAS `@` → `5xoto5rz.up.railway.app`, CNAME `www` → `mindorasystems.com`

**GitHub repo**: https://github.com/kaankuzu1/Anindav2 (main branch)

**Dockerfiles** (root-level):
- `Dockerfile.web` — Multi-stage build: builds with `NEXT_PUBLIC_*` ARGs, then copies Next.js standalone output to a slim runner image. Requires `sharp` for image optimization.
- `Dockerfile.api` — Standard NestJS build with `NODE_ENV=production`
- `Dockerfile.workers` — Standard workers build with `NODE_ENV=production`

**Next.js Standalone Output**: `apps/web/next.config.js` uses `output: 'standalone'` with `outputFileTracingRoot` pointing to monorepo root. The runner stage copies `.next/standalone`, `.next/static`, and `public` — runs via `node apps/web/server.js` (not `next start`).

**Proxy-aware Origin Detection**: All Next.js API routes (`/api/auth/*`) use `x-forwarded-host` and `x-forwarded-proto` headers to derive the real origin. This is required because standalone mode behind Railway's reverse proxy returns `0.0.0.0:3000` from `request.url`. Helper function `getOrigin()` in each route handles this.

**Cross-service linking**:
- `web` has `NEXT_PUBLIC_API_URL` → api Railway URL
- `api` has `FRONTEND_URL` + `CORS_ORIGIN` → web Railway URL (CORS uses `CORS_ORIGIN` with `FRONTEND_URL` fallback)

**Auto-deploy from GitHub**: Each service must be connected to the GitHub repo via the Railway dashboard (Settings → Source → Connect Repo → `kaankuzu1/Anindav2`). Once connected, every push to `main` auto-deploys all 3 services. Without this, deploys are manual via `railway up`.

**Deploy workflow**:
```bash
# Manual deploy (if GitHub not connected)
railway service link <service-name> && railway up --detach

# Check logs
railway logs -s <service-name> --lines 20

# Set env vars (triggers auto-redeploy if GitHub connected)
railway variable set "KEY=VALUE" -s <service-name> --skip-deploys  # skip redeploy
railway variable set "KEY=VALUE" -s <service-name>                  # with redeploy
```

**Important**: `NEXT_PUBLIC_*` env vars are build-time in Next.js. If you change them, the web service must be rebuilt (not just restarted). The `Dockerfile.web` ARG declarations handle this — Railway passes env vars as build args during Docker builds.

### Google OAuth Configuration

**Google Cloud Console project** for OAuth (Gmail inbox connection + Supabase Auth login).

**OAuth Client ID**: `185462103920-a0ev0d37n4ubpua54ahaj2ba9e9ld54t.apps.googleusercontent.com`

**Authorized redirect URIs** (Google Cloud Console → Credentials → Edit OAuth Client):
| URI | Purpose |
|-----|---------|
| `https://rtbtgafvuhfcaevxxipf.supabase.co/auth/v1/callback` | Supabase Auth Google login |
| `https://mindorasystems.com/api/auth/google/callback` | Gmail inbox connection (production) |
| `https://web-production-e1385.up.railway.app/api/auth/google/callback` | Gmail inbox connection (Railway URL) |
| `http://localhost:3000/api/auth/google/callback` | Gmail inbox connection (local dev) |

**Authorized JavaScript origins**: `https://mindorasystems.com`, `https://web-production-e1385.up.railway.app`, `https://rtbtgafvuhfcaevxxipf.supabase.co`, `http://localhost:3000`

**Supabase Auth** (Dashboard → Authentication → Providers → Google): Uses the same OAuth Client ID/Secret. Dashboard → URL Configuration: Site URL = `https://mindorasystems.com/`, Redirect URLs = `https://mindorasystems.com/api/auth/callback` + `https://web-production-e1385.up.railway.app/api/auth/callback`.

**Gmail API scopes** requested during inbox connection: `gmail.send`, `gmail.readonly`, `gmail.modify`, `userinfo.email`, `userinfo.profile`

**OAuth consent screen**: External, Testing mode (only added test users can connect). Requires Google verification for production use (sensitive Gmail scopes).

## Environment Variables

```
apps/web/.env.local   # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
apps/api/.env         # All credentials (Supabase, Redis, OAuth, ENCRYPTION_KEY, OPENROUTER_API_KEY)
apps/workers/.env     # Same as API
```

## Common Workflows

### Adding an API Endpoint
1. Add method to `apps/api/src/modules/{feature}/{feature}.controller.ts`
2. Implement logic in `{feature}.service.ts`
3. Register dependencies in `{feature}.module.ts` if needed

### Adding a Worker
1. Create `apps/workers/src/{name}.ts` using BullMQ `Worker` class
2. Register in `apps/workers/src/index.ts`
3. Create queue in API module that enqueues jobs

### Database Changes
1. Modify schema in Supabase Studio or add migration in `packages/database/supabase/migrations/`
2. Run `pnpm db:push` then `pnpm db:generate`
3. Import types from `@aninda/database`

**Note**: If `pnpm db:push` fails with config errors, run SQL manually via Supabase Dashboard SQL Editor.

## Best Practices

### Working with Templates
- **Always use variables** instead of hardcoded values: `{{firstName}}` not "John"
- **Support both formats**: When adding new variables, support both camelCase and snake_case
- **Provide both formats in variable maps**: Callers should still provide both `firstName` and `first_name` in the map for optimal performance (avoids normalization overhead), though `normalizeVariableMap()` handles missing formats automatically
- **Validate AI output**: Use `validateAndFixVariables()` to catch hardcoded names in AI-generated content
- **Test both conventions**: Ensure `{{firstName}}` and `{{first_name}}` produce identical results
- **`}` in fallback text now supported**: `{{var|fallback with } brace}}` works correctly with the lazy regex match
- **Run audit tests after changes**: `for f in tests/variable-audit/*.ts; do npx tsx "$f"; done`

### Reply Classification
- **Respect manual overrides**: Always filter by `intent_manual_override = false` in batch operations
- **Show user feedback**: Toast notifications when skipping manually classified replies
- **Preserve user intent**: Manual classifications are considered ground truth and must not be auto-overwritten

### AI Content Generation
- **Explicit prompts**: Use "CRITICAL" and "IMPORTANT RULES" sections in system prompts
- **Post-process validation**: Always run `validateAndFixVariables()` on AI output
- **Log warnings**: Console.warn when hardcoded names are detected and fixed
- **Tone consistency**: Maintain tone parameter throughout AI generation flow

### A/B Testing
- **Always set `variant_id` on emails**: When a sequence has variants, the campaign scheduler must select one and set `variant_id` on the email insert — otherwise stats won't track
- **Wrap RPC calls in try/catch**: All `increment_variant_stat()` calls should be non-blocking — log warnings on failure, never break the main flow
- **Respect `is_winner` flag**: The optimizer must skip sequences where a variant already has `is_winner = true` (manual override)
- **Weights must sum to 100**: The `updateWeights()` API endpoint validates this; frontend should enforce it too. `resetTest()` assigns `Math.floor(100/n)` to each variant and gives the remainder to the first variant to guarantee exact sum of 100
- **Fallback for no variants**: Campaign scheduler falls back to original sequence `subject`/`body` if no `sequence_variants` rows exist — never break existing non-A/B campaigns

### Error Handling
- **Use NestJS Logger**: Add `private readonly logger = new Logger(ServiceName.name)` to services for structured server-side logging
- **Wrap decrypt() calls**: Crypto operations on inbox credentials can throw — catch and throw `BadRequestException` with "reconnect your email account" message
- **Validate provider credentials before use**: Check that OAuth client ID/secret are non-empty before calling email provider APIs; throw `InternalServerErrorException` if missing
- **Classify email provider errors**: Wrap `client.sendEmail()` in try/catch and map errors to specific `BadGatewayException` messages:
  - 401/unauthorized/invalid_grant/token → "Email account authorization has expired. Please reconnect..."
  - 403/forbidden/insufficient → "Insufficient permissions..."
  - 429/rate/throttle → "Rate limit reached..."
  - Other → "Failed to send email through your email provider..."
- **Reactive disconnection on auth errors**: In workers (`email-sender.ts`, `warmup.ts`), auth errors during sends trigger `markDisconnected()` — sets inbox `status='error'`, disables warmup, and makes the job non-retryable. `isAuthError()` detects: status codes 401/403, `'unauthorized'`, `'invalid_grant'`, `'invalid_client'`, `'token expired'`/`'revoked'`, `'refresh token'`, `'authentication'`, `'auth_error'`, `'auth error'`, `'insufficient permissions'`. Does NOT match substrings like 'author' (uses specific patterns to avoid false positives).
- **Non-critical DB inserts after side effects**: If email was already sent, log a warning on insert failure instead of throwing (prevents false error when the action succeeded)
- **Frontend fetch error parsing**: Always wrap `res.json()` in try/catch with `res.text()` fallback — backend may return non-JSON error responses

## Important Files

- `apps/api/src/modules/*/` - Feature modules (campaigns, inboxes, leads, replies, warmup, ai)
- `apps/api/src/modules/inboxes/inboxes.service.ts` - Inbox management with `checkConnection()`, `markDisconnected()`, and auto-recovery
- `apps/api/src/modules/replies/replies.service.ts` - Reply sending with full lead + sender variable injection, structured error handling and provider error classification
- `apps/api/src/modules/replies/reply-templates.service.ts` - Reply template processing with full lead + sender variable substitution
- `apps/api/src/modules/ai/ai.service.ts` - AI content generation with validation (detects hardcoded names) + CSV column mapping + smart template personalization with creator notes
- `apps/api/src/modules/campaigns/campaign-test.service.ts` - Test email preview and send with variable processing + optional AI personalization
- `packages/shared/src/utils.ts` - Template engine (spintax, conditionals, variable injection with format normalization)
- `packages/shared/src/lead-state-machine.ts` - Lead status transitions
- `packages/email-client/src/gmail.ts` - Gmail API integration
- `apps/workers/src/email-sender.ts` - Email sending with lead + sender variable injection + campaign `sent_count` increment via RPC + variant stat tracking + reactive disconnection detection + smart template personalization (language match toggle + creator notes)
- `apps/workers/src/ab-test-optimizer.ts` - A/B test optimization with z-score significance and progressive traffic shifting
- `apps/api/src/modules/campaigns/ab-test.service.ts` - A/B test management (stats, winner, reset, weights, history)
- `apps/api/src/modules/tracking/tracking.service.ts` - Email open/click tracking via atomic RPCs (`increment_email_open`/`increment_email_click`) + campaign and variant stat updates
- `apps/web/src/components/shared/variable-palette.tsx` - Variable palette with Receiver (Lead) / Sender (Inbox) / Context categories
- `apps/web/src/app/(dashboard)/leads/page.tsx` - Leads table with inline editing (click-to-edit Contact/Company, floating save bar)
- `apps/web/src/app/(dashboard)/leads/import/page.tsx` - Lead import with column mapping UI + AI detection
- `apps/workers/src/warmup.ts` - Warmup email sending with reactive disconnection detection
- `apps/workers/src/warmup-templates.ts` - 205 warmup email templates with {{firstName|there}} and {{senderFirstName}} personalization
- `apps/workers/src/warmup-dedup.ts` - Fisher-Yates shuffle dedup via Redis for warmup template selection
- `apps/web/src/components/warmup/` - Warmup UI components (mode card, stats grid, inbox table, unassigned card)
- `apps/web/src/app/(dashboard)/warmup/` - Warmup pages (choice screen, pool, network)
- `apps/web/src/app/(legal)/layout.tsx` - Legal pages shared layout (header, content, footer)
- `apps/web/src/app/(legal)/terms/page.tsx` - Terms of Service (14 sections, cold email specific)
- `apps/web/src/app/(legal)/privacy/page.tsx` - Privacy Policy (12 sections, GDPR-aware)
- `apps/web/src/lib/admin-api.ts` - Admin panel API client
- `apps/workers/src/connection-checker.ts` - Daily proactive inbox connection validation (04:00 UTC)
- `apps/workers/src/index.ts` - Worker orchestration entry point
- `tests/variable-audit/` - Variable system audit tests (229 tests across 5 suites, run with `npx tsx`)
- `tests/analytics-audit/` - Analytics pipeline audit tests (58 tests across 3 suites, run with `npx tsx`)
- `tests/campaign-audit/` - Campaign system audit tests (478 tests across 10 suites, run with `npx tsx`)
- `packages/database/supabase/migrations/20260210000000_fix_analytics_pipeline.sql` - Migration adding email columns, `retry_pending` enum, and 6 atomic RPC functions for stat increments
- `packages/database/supabase/migrations/20260211000000_add_smart_template.sql` - Migration adding smart template columns to sequences/variants, analysis_notes to leads, smart_template_personalized to emails
- `packages/database/supabase/migrations/20260212000000_add_smart_template_enhancements.sql` - Migration adding smart_template_language_match and smart_template_notes to sequences/variants

## Gemini Delegation

**When the user says "use gemini"**, offload bulk analysis to Gemini CLI:

```bash
cat data.json | gemini -p "Analyze this" -o text 2>/dev/null
```

**Appropriate for Gemini:** Bulk file analysis, pattern finding, summarization, data validation, log analysis, code review of large diffs

**Keep with Claude:** File writes, multi-step work, final decisions, deployments, anything requiring judgment

**Gemini is READ-ONLY** - it cannot write files or run modifying commands.

## "x" Shorthand - Parallel Agents

**`x3` or `x5` at end of command spawns parallel agents:**

| Shorthand | Claude Subagents | Gemini CLI | Total |
|-----------|------------------|------------|-------|
| `x3` | 1 (judgment) | 2 (analysis) | 3 |
| `x5` | 1 (judgment) | 4 (analysis) | 5 |

**Announce with emojis:** ✅ = Claude subagents, 🔵 = Gemini agents

**Gemini fallback:** gemini-3-pro-preview → gemini-2.5-pro → gemini-3-flash-preview

**Gemini is READ-ONLY** - cannot write files or run modifying commands.

## Proactive Subagents

These trigger automatically - announce with ✅ emoji:

| Subagent | Triggers When |
|----------|---------------|
| `investigator` | When user says "x" or "xN" at end of a command |
