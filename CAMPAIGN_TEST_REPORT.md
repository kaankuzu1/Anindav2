# Campaign System Test Report

**Date**: 2026-02-09
**Suite**: `tests/campaign-audit/` (10 files, 472 tests)
**Status**: ALL PASSING

## Summary

| File | Tests | Passed | Failed |
|------|-------|--------|--------|
| `test-campaign-scheduler.ts` | 53 | 53 | 0 |
| `test-inbox-distribution.ts` | 44 | 44 | 0 |
| `test-email-sender.ts` | 50 | 50 | 0 |
| `test-tracking-pipeline.ts` | 29 | 29 | 0 |
| `test-bounce-processor.ts` | 39 | 39 | 0 |
| `test-reply-classification.ts` | 35 | 35 | 0 |
| `test-ab-testing.ts` | 58 | 58 | 0 |
| `test-webhook-delivery.ts` | 38 | 38 | 0 |
| `test-lead-state-machine.ts` | 91 | 91 | 0 |
| `test-campaign-integration.ts` | 35 | 35 | 0 |
| **Total** | **472** | **472** | **0** |

## Run Command

```bash
for f in tests/campaign-audit/*.ts; do npx tsx "$f"; done
```

## Discovered Bugs

### BUG-1: Bounce Processor Suppression Gap (Medium Severity)

**File**: `apps/workers/src/bounce-processor.ts`
**Test**: `test-bounce-processor.ts` — "BUG: suppression check uses original bounceType, not effectiveBounceType"

**Description**: When soft bounces exhaust `MAX_SOFT_BOUNCE_RETRIES` (3), the `effectiveBounceType` becomes `'hard'`, but the suppression list check still uses the original `bounceType` value (`'soft'`). Since only hard bounces are added to the suppression list, leads that soft-bounced out of retries may not be properly suppressed.

**Impact**: Emails could continue to be sent to addresses that are effectively hard-bounced after 3 soft bounce retries.

**Fix**: Change the suppression check to use `effectiveBounceType` instead of `bounceType`:
```typescript
// Before (bug):
if (bounceType === 'hard') { addToSuppressionList(email); }

// After (fix):
if (effectiveBounceType === 'hard') { addToSuppressionList(email); }
```

### BUG-2: A/B Test Reset Weight Rounding (Low Severity)

**File**: `apps/api/src/modules/campaigns/ab-test.service.ts`
**Test**: `test-ab-testing.ts` — "BUG: resetTest with 3 variants → weights sum to 99, not 100"

**Description**: When resetting an A/B test, `Math.floor(100 / variantCount)` is applied to each variant. For counts that don't evenly divide 100 (3, 6, 7, etc.), the total is less than 100:
- 3 variants: `33 * 3 = 99` (missing 1)
- 6 variants: `16 * 6 = 96` (missing 4)
- 7 variants: `14 * 7 = 98` (missing 2)

**Impact**: After reset, weights don't sum to 100, which the weight validation endpoint would reject. The weighted random selection would slightly under-allocate traffic.

**Fix**: Assign the remainder to the first variant:
```typescript
const baseWeight = Math.floor(100 / variantCount);
const remainder = 100 - (baseWeight * variantCount);
// First variant gets baseWeight + remainder, others get baseWeight
```

### BUG-3: isAuthError False Positive Risk (Low Severity)

**File**: `apps/workers/src/email-sender.ts`
**Test**: `test-email-sender.ts` — "isAuthError: 'author' matches as false positive (documents bug)"

**Description**: The `isAuthError()` helper uses `msg.includes('auth')` to detect authentication errors. This matches any error message containing the substring "auth", including false positives like "author", "authorization header missing from non-auth request", etc.

**Impact**: Non-auth errors containing "auth" as a substring could incorrectly trigger inbox disconnection, marking a healthy inbox as `status='error'` and disabling warmup.

**Fix**: Use more specific patterns:
```typescript
// Before:
msg.includes('auth')

// After:
msg.includes('unauthorized') || msg.includes('authentication') || msg.includes('auth_error')
```

## Coverage Summary

### Systems Tested

| System | Coverage |
|--------|----------|
| Campaign Scheduler | selectVariant, send windows, health filtering, throttling, status filtering, dedup |
| Email Sender | Variable maps, normalization, fullName, custom_fields, auth errors, tracking |
| Bounce Processor | bounceTypeToEvent, soft/hard transitions, retry logic, auto-pause, suppression |
| Reply Classification | All 9 intent mappings, state transitions, manual override, batch processing |
| A/B Testing | Weighted selection, z-score, CDF, traffic shifting, stats, reset rounding, winner |
| Webhook Delivery | HMAC-SHA256, roundtrip, tampering, retries, schema validation, all 14 events |
| Lead State Machine | All transitions, terminal states, blocksSequence, MANUAL_OVERRIDE, helpers |
| Inbox Distribution | Health score formula, warmup quotas, ESP limits, domain detection |
| Tracking Pipeline | ID encode/decode, pixel injection, link wrapping, URL validation, GIF buffer |
| Integration | Full lifecycle, cross-system consistency, race conditions, validation schemas |

### Key Validations

- **State Machine**: All 12 statuses, all valid/invalid transitions, terminal state enforcement, MANUAL_OVERRIDE from any state
- **Template Engine**: processEmailContent with full lead+inbox variables, conditionals, spintax, fallbacks, unknown variable preservation
- **A/B Testing**: Statistical distribution over 10K iterations, z-score math, progressive shifting at all 5 confidence thresholds
- **Bounce Handling**: Soft→hard escalation, exponential backoff, auto-pause thresholds, suppression gap bug
- **Tracking**: Pixel injection (3 fallback strategies), link wrapping (7 skip conditions), URL validation
- **Webhooks**: HMAC-SHA256 determinism, timing-safe comparison, all 14 event types, retry delays

## Recommendations

1. **Fix BUG-1 (suppression gap)** — Medium priority. Leads exhausting soft bounce retries should be suppressed to protect deliverability.
2. **Fix BUG-2 (reset rounding)** — Low priority but easy fix. Add remainder to first variant after `Math.floor`.
3. **Fix BUG-3 (isAuthError)** — Low priority. Use word-boundary patterns or more specific substrings to avoid false positives.
4. **Add these tests to CI** — Run `for f in tests/campaign-audit/*.ts; do npx tsx "$f"; done` in the CI pipeline alongside the existing variable-audit and analytics-audit suites.
