# New Features Setup Guide

This document covers the setup required for features implemented in the January 2025 update.

---

## Table of Contents

1. [Database Migrations](#database-migrations)
2. [Custom Tracking Domain](#custom-tracking-domain)
3. [Smart Scheduler (Send Time Optimization)](#smart-scheduler-send-time-optimization)
4. [Environment Variables](#environment-variables)

---

## Database Migrations

### Required Migrations

Two new migrations need to be applied to your Supabase database:

#### 1. Reply Templates Table
**File:** `packages/database/supabase/migrations/20240125000000_add_reply_templates.sql`

Creates the `reply_templates` table for quick reply functionality with:
- Template name and content
- Variable support (`{{firstName}}`, `{{company}}`, etc.)
- Keyboard shortcut assignment (1-9)
- Default template per intent type
- Row Level Security policies

#### 2. Tracking Domain & Future Integrations
**File:** `packages/database/supabase/migrations/20240126000000_add_tracking_domain.sql`

Adds columns to the `teams` table:
- `tracking_domain` - Custom tracking domain (e.g., `track.company.com`)
- `tracking_domain_verified` - Whether DNS is verified
- `tracking_domain_verified_at` - Verification timestamp
- `warmup_mode` - Internal vs external warmup
- `warmup_inbox_api_key_encrypted` - For Warmup Inbox API (future)
- `apollo_api_key_encrypted` - For Apollo email finder (future)
- `apollo_credits_remaining` - Apollo credits tracking
- `calendar_provider` - Calendly/Cal.com integration (future)
- `calendar_api_key_encrypted` - Calendar API key
- `calendar_scheduling_url` - Booking link URL

### How to Apply Migrations

**Option 1: Migration Script (Recommended)**
```bash
cd /Users/kaankuzu/Desktop/aninda

# Print SQL for manual copy/paste
./scripts/run-migrations.sh

# Or apply directly with psql (requires DATABASE_URL)
export DATABASE_URL='postgresql://postgres:[password]@[host]:5432/postgres'
./scripts/run-migrations.sh --apply
```

**Option 2: Supabase CLI**
```bash
cd /Users/kaankuzu/Desktop/aninda
supabase db push
```

**Option 3: Manual SQL Execution**
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste each migration file's contents
4. Execute in order (20240125 first, then 20240126)

**Option 4: Direct psql**
```bash
psql $DATABASE_URL -f packages/database/supabase/migrations/20240125000000_add_reply_templates.sql
psql $DATABASE_URL -f packages/database/supabase/migrations/20240126000000_add_tracking_domain.sql
```

---

## Custom Tracking Domain

### Overview

Custom tracking domains allow your tracking pixels and links to use your branded domain instead of a shared domain. This improves deliverability because:
- Tracking from shared domains often gets blocked
- Branded links build trust
- Better inbox placement rates

### How It Works

1. User configures domain in Settings > Tracking Domain (e.g., `track.company.com`)
2. User adds CNAME record: `track.company.com` → `tracking.aninda.app`
3. User clicks "Verify" to confirm DNS propagation
4. Tracking links now use the custom domain

### Infrastructure Requirements

You need a tracking server that:
1. Accepts requests at your tracking domain (default: `tracking.aninda.app`)
2. Handles tracking pixel requests (`/t/:trackingId`)
3. Handles click tracking redirects (`/c/:trackingId`)
4. Returns 1x1 transparent GIF for pixels
5. Records events to the database

### Setting Up the Tracking Server

#### Option A: Use Existing Tracking Module

The API already has tracking endpoints in `apps/api/src/modules/tracking/`. You can:

1. Deploy the API to a domain like `tracking.aninda.app`
2. Configure your DNS/load balancer to route tracking subdomains to this API
3. Set the `TRACKING_DOMAIN` environment variable

#### Option B: Dedicated Tracking Service

For high-volume tracking, consider a dedicated service:

```javascript
// Example: Minimal tracking server (Node.js/Express)
const express = require('express');
const app = express();

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// Tracking pixel
app.get('/t/:id', async (req, res) => {
  const { id } = req.params;
  // Record open event to database
  await recordEvent(id, 'opened');
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store');
  res.send(PIXEL);
});

// Click tracking
app.get('/c/:id', async (req, res) => {
  const { id } = req.params;
  const { url } = req.query;
  // Record click event to database
  await recordEvent(id, 'clicked');
  res.redirect(url);
});

app.listen(3000);
```

### DNS Configuration

Users need to add a CNAME record:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | track.yourcompany.com | tracking.aninda.app | 3600 |

### Environment Variables

```env
# The domain your tracking server runs on
# Users' custom domains will CNAME to this
TRACKING_DOMAIN=tracking.aninda.app

# Default tracking URL (fallback when custom domain not set)
DEFAULT_TRACKING_URL=https://tracking.aninda.app
```

### Verification Process

The `CustomDomainService` verifies domains by:
1. Performing DNS CNAME lookup on the user's domain
2. Checking if it resolves to `TRACKING_DOMAIN`
3. Marking as verified if match found

```typescript
// DNS verification (simplified)
const cnameRecords = await dns.resolveCname('track.company.com');
const isValid = cnameRecords.includes('tracking.aninda.app');
```

---

## Smart Scheduler (Send Time Optimization)

### Overview

The Smart Scheduler optimizes email delivery times based on:
- Lead timezone (inferred from email domain or explicit)
- Historical open data per lead
- Day of week preferences (Tue-Thu best)
- Default send window (9-11am recipient local time)

### Files Created

| File | Purpose |
|------|---------|
| `packages/shared/src/send-time-optimizer.ts` | Core optimization logic |
| `apps/workers/src/smart-scheduler.ts` | Worker for scheduled sending |

### Timezone Inference

The optimizer can infer timezones from:

1. **Explicit timezone** - If set on the lead record
2. **Country/City** - Uses location data if available
3. **Email domain TLD** - Maps 70+ country codes to timezones
   - `.de` → Europe/Berlin
   - `.uk` → Europe/London
   - `.jp` → Asia/Tokyo
   - etc.
4. **US state** - For US leads with state info
5. **Fallback** - Sender's timezone (default: America/New_York)

### Integration Options

#### Option 1: Use Alongside Existing Scheduler

The SmartScheduler can run in parallel with the existing CampaignScheduler. Add to `apps/workers/src/index.ts`:

```typescript
import { SmartScheduler } from './smart-scheduler';

// In main():
const smartScheduler = new SmartScheduler(redisConnection, supabase, {
  defaultWindowStart: 9,
  defaultWindowEnd: 11,
  preferredDays: [2, 3, 4], // Tue, Wed, Thu
  useHistoricalData: true,
  senderTimezone: 'America/New_York',
});

// Use for specific campaigns or leads:
// await smartScheduler.scheduleEmail(emailId, leadId, campaignId, inboxId, step, lead);
```

#### Option 2: Replace Campaign Scheduler

Modify `apps/workers/src/campaign-scheduler.ts` to use the optimizer:

```typescript
import { calculateOptimalSendTime, inferTimezoneFromEmail } from '@aninda/shared';

// In processSequenceStep(), before queuing:
const optimal = calculateOptimalSendTime(
  { email: lead.email, timezone: lead.timezone, country: lead.country },
  [], // historical opens (optional)
  { senderTimezone: 'America/New_York' }
);

// Use optimal.scheduledAt for job delay
const delay = optimal.scheduledAt.getTime() - Date.now();
```

#### Option 3: Campaign-Level Setting

Add a campaign setting to enable/disable optimization:

```typescript
// In campaign.settings:
{
  "send_time_optimization": true,
  "sender_timezone": "America/New_York"
}
```

### API Usage

```typescript
import {
  calculateOptimalSendTime,
  calculateBatchSendTimes,
  inferTimezoneFromEmail,
  isWithinOptimalWindow,
} from '@aninda/shared';

// Single lead
const optimal = calculateOptimalSendTime(
  { email: 'user@company.de', country: 'Germany' },
  openHistory, // Array of { openedAt, dayOfWeek, hourOfDay }
  { defaultWindowStart: 9, defaultWindowEnd: 11 }
);

console.log(optimal);
// {
//   scheduledAt: Date,
//   timezone: 'Europe/Berlin',
//   timezoneSource: 'domain',
//   confidence: 'medium',
//   reasoning: 'Inferred timezone from email domain. Sending at 10:00 local time. Scheduled for Tuesday.'
// }

// Batch processing
const optimalTimes = calculateBatchSendTimes(leads, openHistoryMap);

// Check if now is good time
const isGood = isWithinOptimalWindow('Europe/Berlin', 9, 17);
```

### Historical Data

For best results, the optimizer uses historical open data:

```typescript
interface LeadOpenHistory {
  openedAt: Date;
  dayOfWeek: number; // 0-6
  hourOfDay: number; // 0-23
}

// Fetch from email_events table
const history = await supabase
  .from('email_events')
  .select('created_at')
  .eq('lead_id', leadId)
  .eq('event_type', 'opened')
  .limit(20);
```

---

## Environment Variables

Add these to your `.env` files as needed:

### apps/api/.env
```env
# Custom Tracking Domain
TRACKING_DOMAIN=tracking.aninda.app
DEFAULT_TRACKING_URL=https://tracking.aninda.app
```

### apps/workers/.env
```env
# Send Time Optimization (optional overrides)
DEFAULT_SEND_WINDOW_START=9
DEFAULT_SEND_WINDOW_END=11
SENDER_TIMEZONE=America/New_York
```

---

## Quick Start Checklist

- [ ] Run database migrations (required for templates)
- [ ] Test keyboard shortcuts (press `?` on any page)
- [ ] Test browser notifications (enable in replies page)
- [ ] Configure tracking domain (optional - `/settings/tracking-domain`)
- [ ] Set up tracking server infrastructure (optional)
- [ ] Integrate SmartScheduler into workers (optional)

---

## Feature Status Summary

| Feature | Status | Requires |
|---------|--------|----------|
| Keyboard Shortcuts | Ready | Nothing |
| Help Modal | Ready | Nothing |
| Browser Notifications | Ready | Nothing |
| Tab Badge | Ready | Nothing |
| Sound Alerts | Ready | Nothing |
| Reply Templates | Ready | DB Migration |
| Template Selector | Ready | DB Migration |
| Tracking Domain UI | Ready | DB Migration |
| Tracking Domain Verification | Ready | Tracking Server |
| Send Time Optimizer | Ready | Worker Integration |
| Smart Scheduler | Ready | Worker Integration |

---

## Support

For issues with these features, check:
1. Browser console for frontend errors
2. API logs for backend errors
3. Worker logs for scheduling issues
4. Supabase logs for database/RLS issues
