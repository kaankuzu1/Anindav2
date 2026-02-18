# Pre-Launch Critical Issues

> Found by the pre-launch comprehensive audit (2,933 assertions across 15 test suites).
> Date: 2026-02-19

---

## Issue 1: No Rate Limiting on Any API Endpoint [CRITICAL]

**File:** `apps/api/src/main.ts`

**Problem:** All 139 API endpoints are exposed without any request rate limiting. `main.ts` sets up `ValidationPipe` and CORS only — no `ThrottlerModule`, no `@Throttle()` decorator, no `ThrottlerGuard` anywhere in the codebase.

**High-value targets:**
- `POST /api/v1/admin/login` — brute-forceable admin credentials
- `POST /api/v1/leads/gdpr/delete` — mass GDPR deletion abuse
- `GET /api/v1/leads/gdpr/export` — PII exfiltration
- `POST /api/v1/auth/...` — authentication flooding
- All campaign/lead/inbox endpoints — resource exhaustion

**Impact:** Any client can flood endpoints with unlimited requests. Admin login can be brute-forced. GDPR endpoints can be abused for mass data destruction or exfiltration.

**Recommended fix:**
1. Install `@nestjs/throttler`
2. Register `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` in `AppModule`
3. Apply `ThrottlerGuard` globally via `APP_GUARD`
4. Add stricter per-route `@Throttle()` overrides for sensitive endpoints:
   - `/admin/login`: 5 requests/minute
   - `/leads/gdpr/*`: 10 requests/minute
   - `/auth/*`: 20 requests/minute

---

## Issue 2: N+1 Query in Admin Inboxes Service [HIGH]

**File:** `apps/api/src/modules/admin/admin-inboxes.service.ts` (lines 21-47)

**Problem:** `listAdminInboxes()` fetches all admin inboxes in 1 query, then issues 1 additional query per inbox to count assignments:

```typescript
async listAdminInboxes() {
  const { data } = await this.supabase
    .from('admin_inboxes')
    .select('*')
    .order('created_at', { ascending: false });

  const result = [];
  for (const inbox of data ?? []) {
    const { count } = await this.supabase          // N+1 here
      .from('admin_inbox_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('admin_inbox_id', inbox.id);
    result.push({ ...inbox, assignment_count: count ?? 0 });
  }
  return result;
}
```

**Impact:** 50 admin inboxes = 51 database round-trips per call. Degrades admin dashboard performance and creates database connection pressure.

**Recommended fix:** Replace with a single query using Supabase's relational count:
```typescript
const { data } = await this.supabase
  .from('admin_inboxes')
  .select('*, admin_inbox_assignments(count)')
  .order('created_at', { ascending: false });
```

---

## Issue 3: Analytics Queries Fetch Unlimited Rows [HIGH]

**File:** `apps/api/src/modules/analytics/analytics.service.ts`

**Problem:** 9 analytics methods issue Supabase queries with no `.limit()` clause. All rows matching the date range are loaded into Node.js memory as JavaScript objects.

**Affected methods:**

| Method | What it fetches |
|--------|----------------|
| `getDashboardStats` | ALL emails + ALL replies for team in date range |
| `getEmailStats` | ALL emails for 30 days |
| `getLeadStats` | ALL leads for team (no date filter) |
| `getReplyIntentBreakdown` | ALL replies for 30 days |
| `getHourlyDistribution` | ALL emails for 7 days |
| `getTimeToReplyStats` | ALL replies for 30 days |
| `detectVelocityAnomalies` | ALL emails for 7 days |
| `getBounceRateByDomain` | ALL emails for 30 days |

**Impact:** A team with 500K emails triggers a full table scan per analytics page load. This will OOM the Node.js API process, exhaust the Supabase connection pool, and cause HTTP timeouts.

**Recommended fix:**
- Add `.limit(10000)` or `.limit(50000)` as safety caps on all unbounded queries
- For aggregate stats (counts, rates, averages), use PostgreSQL aggregate functions via `.rpc()` instead of fetching all rows and computing in JavaScript

---

## Issue 4: Campaign Start Has No Inbox Health Check [HIGH]

**File:** `apps/api/src/modules/campaigns/campaigns.service.ts` (lines 76-91)

**Problem:** `startCampaign()` only checks that the campaign exists and belongs to the team. It does not verify that any assigned inboxes are `active` and healthy:

```typescript
async startCampaign(campaignId: string, teamId: string) {
  await this.getCampaign(campaignId, teamId);  // Only checks existence

  const { data } = await this.supabase
    .from('campaigns')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', campaignId)
    .select()
    .single();

  return data;
  // No check: are assigned inboxes active? healthy? any have errors?
}
```

**Impact:** Users can start campaigns with all inboxes disconnected (`status='error'`). The campaign shows as "active" in the UI but never sends any emails — a silent failure mode with no user feedback.

**Recommended fix:** Before updating campaign status, query `campaign_inboxes` joined with `inboxes` to verify at least one inbox has `status='active'` and `health_score >= 50`. Throw `BadRequestException('No healthy active inboxes assigned to this campaign')` if none qualify.

---

## Issue 5: Admin JWT Accepted via Query Parameter [HIGH]

**File:** `apps/api/src/shared/guards/admin-auth.guard.ts` (lines 25-28)

**Problem:** The admin auth guard accepts JWT tokens from URL query parameters as a fallback:

```typescript
// Fallback: Check query parameter (used for OAuth redirect flows)
if (!token && request.query?.token) {
  token = request.query.token as string;
}
```

**Impact:** Admin JWT tokens in query params leak through:
1. **Railway access logs** — `GET /api/v1/admin/inboxes?token=eyJ...` logged verbatim
2. **Browser history** — visible to anyone with browser access
3. **Referrer headers** — leaked to external resources
4. **Server-side request logs** — any reverse proxy logs the full URL

The admin frontend (`/admin`) always uses `localStorage` with `Authorization: Bearer` headers (per `apps/web/src/lib/admin-api.ts`). The query param fallback is not needed.

**Recommended fix:** Remove lines 25-28 of `admin-auth.guard.ts` entirely. The current frontend architecture does not use query parameter tokens.

---

## Issue 6: Reply Scanner Missing Auth Error Detection [HIGH]

**File:** `apps/workers/src/reply-scanner.ts` (lines 107-120)

**Problem:** The reply scanner calls `gmailClient.getMessages()` and `msClient.getMessages()` with no auth error detection. When OAuth tokens expire, the job fails with a generic error and is retried up to 3 times — hitting the same expired token each time. The inbox is never marked as disconnected.

```typescript
// In processJob():
messages = await gmailClient.getMessages(sinceDate, 50);  // throws on 401
// No try/catch, no isAuthError(), no markDisconnected()
```

**Contrast:** Both `email-sender.ts` and `warmup.ts` have `isAuthError()` + `markDisconnected()` for the same scenario.

**Impact:** An inbox with expired OAuth silently stops having replies scanned. Users don't see new replies. No disconnect notification appears. The inbox shows as `active` despite being non-functional for reply scanning.

**Recommended fix:** Wrap the `getMessages()` calls in a `try/catch`. Add the same `isAuthError()` function from `email-sender.ts`. On auth error, call `markDisconnected(inboxId)` and set `(err as any).nonRetryable = true`.

---

## Issue 7: SmartScheduler Initialized but Never Started [MEDIUM]

**File:** `apps/workers/src/index.ts` (lines 67-76)

**Problem:** `index.ts` instantiates `SmartScheduler` and logs "Smart Scheduler initialized (send time optimization enabled)" but never calls any start method. The `SmartScheduler` class creates a BullMQ queue `'smart-email-send'` but there is no `Worker` listening to it anywhere in the codebase.

```typescript
const smartScheduler = new SmartScheduler(redisConnection, supabase, { ... });
console.log('Smart Scheduler initialized (send time optimization enabled)');
// No smartScheduler.start() — and the class has no start() method
```

**Impact:**
- The `'smart-email-send'` queue accumulates jobs without processing if anything enqueues to it
- The log message "send time optimization enabled" is misleading
- The Redis memory for this unused queue grows if jobs are added
- Dead code in production

**Recommended fix:** Either implement the feature fully (add a `Worker` for the queue) or remove the `SmartScheduler` instantiation from `index.ts` and the `close()` call from the shutdown sequence.

---

## Issue 8: No `process.on('unhandledRejection')` in Workers [MEDIUM]

**File:** `apps/workers/src/index.ts` (lines 88-107)

**Problem:** The workers process registers `SIGINT` and `SIGTERM` handlers but has no `unhandledRejection` or `uncaughtException` handlers:

```typescript
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// Missing: process.on('unhandledRejection', ...)
// Missing: process.on('uncaughtException', ...)
```

**Impact:** In Node.js 15+, an unhandled Promise rejection terminates the process immediately with exit code 1. Without handlers:
1. The process exits without calling `shutdown()` — Redis connections and BullMQ workers not closed gracefully
2. In-flight jobs are abandoned and left in "active" state in Redis
3. Root cause is not logged in a structured way
4. Railway restarts the container but the error context is lost

**Recommended fix:**
```typescript
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});
```

---

## Issue 9: GDPR Endpoints Lack Input Validation and Auth Guard [CRITICAL]

**File:** `apps/api/src/modules/leads/leads.controller.ts` (lines 289-302)

**Problem:** Both GDPR endpoints have **no authentication guard** and **no input validation**:

```typescript
@Post('gdpr/delete')
async gdprDelete(@Body() body: { email: string }) {
  return this.leadsService.gdprDeleteByEmail(body.email);
  // body.email is not validated — could be undefined, empty, or malicious
}

@Get('gdpr/export')
async gdprExport(@Query('email') email: string) {
  return this.leadsService.gdprExportByEmail(email);
  // email is not validated — could be empty or missing
}
```

**Three compounding problems:**

1. **No email format validation:** `body.email` could be `undefined`, `null`, `""`, or arbitrary strings. The service calls `gdprDeleteByEmail(undefined)` which issues a Supabase query with `undefined` — behavior is undefined.

2. **No authentication guard:** Both endpoints have no `@UseGuards(SupabaseAuthGuard)`. Any unauthenticated request can trigger GDPR deletion for any email. Calling `POST /api/v1/leads/gdpr/delete` with `{ "email": "ceo@bigclient.com" }` deletes that lead's data across all teams.

3. **Exfiltration on export:** `GET /api/v1/leads/gdpr/export?email=any@company.com` returns all personal data for the given email without any auth.

**Impact:** Unauthenticated data destruction and PII exfiltration. This is the highest-severity issue in the audit.

**Recommended fix:**
1. Add `@UseGuards(SupabaseAuthGuard)` to both endpoints (minimum)
2. Create a validated DTO:
   ```typescript
   class GdprDeleteDto {
     @IsEmail()
     @IsNotEmpty()
     email: string;
   }
   ```
3. Apply it: `async gdprDelete(@Body() dto: GdprDeleteDto)`
4. For export, validate `@Query('email')` with a pipe or move to a POST with validated body
5. Consider requiring the requesting user to be the data subject or adding admin-only access

---

## Priority Order for Fixes

| Priority | Issues | Reason |
|----------|--------|--------|
| P0 (immediate) | #9, #1 | Unauthenticated data destruction + no rate limiting |
| P1 (before launch) | #5, #6, #8 | Token leakage, silent failures, process crashes |
| P2 (first sprint) | #3, #4, #2 | Performance + UX (silent campaign failures, OOM risk) |
| P3 (backlog) | #7 | Dead code cleanup |
