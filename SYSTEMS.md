# Aninda Cold Email Platform - Systems Documentation

> Complete technical documentation of all platform systems, workflows, and architecture.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Campaign System](#1-campaign-system)
3. [Warm-up System](#2-warm-up-system)
4. [Inbox Management System](#3-inbox-management-system)
5. [Lead Management System](#4-lead-management-system)
6. [Reply Management System](#5-reply-management-system)
7. [Analytics System](#6-analytics-system)
8. [AI Features System](#7-ai-features-system)
9. [Authentication System](#8-authentication-system)
10. [Worker System](#9-worker-system)
11. [Database Schema](#10-database-schema)
12. [API Reference](#11-api-reference)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                     Next.js 14 (App Router) + TailwindCSS                   │
│                         http://localhost:3000                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API (JWT Auth)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND API                                     │
│                    NestJS (Modular Monolith)                                │
│                         http://localhost:3001                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Campaigns │ │ Inboxes  │ │  Leads   │ │ Replies  │ │    AI    │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │ Warm-up  │ │Analytics │ │  Auth    │ │  Queue   │                       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
          │                          │                          │
          │                          │                          │
          ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────────┐
│   PostgreSQL    │      │     Redis       │      │       WORKERS           │
│   (Supabase)    │      │   (Upstash)     │      │      (BullMQ)           │
│                 │      │                 │      │  ┌─────────────────┐    │
│  - campaigns    │      │  - Job Queues   │      │  │  Email Sender   │    │
│  - inboxes      │      │  - Rate Limits  │      │  ├─────────────────┤    │
│  - leads        │      │  - Cache        │      │  │ Warmup Scheduler│    │
│  - replies      │      │                 │      │  ├─────────────────┤    │
│  - emails       │      │                 │      │  │  Reply Scanner  │    │
│  - warmup_state │      │                 │      │  └─────────────────┘    │
└─────────────────┘      └─────────────────┘      └─────────────────────────┘
                                                              │
                                                              ▼
                                                  ┌─────────────────────────┐
                                                  │    EMAIL PROVIDERS      │
                                                  │  ┌─────────────────┐    │
                                                  │  │   Gmail API     │    │
                                                  │  ├─────────────────┤    │
                                                  │  │ Microsoft Graph │    │
                                                  │  ├─────────────────┤    │
                                                  │  │   SMTP/IMAP     │    │
                                                  │  └─────────────────┘    │
                                                  └─────────────────────────┘
```

### Tech Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14, TailwindCSS, shadcn/ui | User interface |
| Backend API | NestJS, TypeScript | REST API server |
| Workers | BullMQ, Node.js | Async job processing |
| Database | Supabase PostgreSQL | Data persistence |
| Cache/Queue | Upstash Redis | Job queues, rate limiting |
| Auth | Supabase Auth | JWT authentication |
| Email | Gmail API, Microsoft Graph | Email sending/receiving |
| AI | OpenRouter (GPT-4o-mini) | AI-powered features |

---

## 1. Campaign System

### Overview

The Campaign System manages multi-step email sequences for cold outreach. Each campaign contains multiple sequence steps with configurable delays, A/B testing variants, and lead targeting.

### Campaign Lifecycle

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  DRAFT   │ ───► │  ACTIVE  │ ───► │  PAUSED  │ ───► │ COMPLETED│
└──────────┘      └──────────┘      └──────────┘      └──────────┘
     │                 │                  │
     │                 │                  │
     └─────────────────┴──────────────────┘
                       │
                       ▼
                 ┌──────────┐
                 │ ARCHIVED │
                 └──────────┘
```

### Sequence Flow

```
Day 0                    Day 3                    Day 7                    Day 14
  │                        │                        │                        │
  ▼                        ▼                        ▼                        ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Initial    │      │ Follow-up 1 │      │ Follow-up 2 │      │   Breakup   │
│   Email     │ ───► │   (if no    │ ───► │   (if no    │ ───► │   Email     │
│             │      │   reply)    │      │   reply)    │      │             │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
      │                    │                    │                    │
      │                    │                    │                    │
      ▼                    ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REPLY DETECTED → STOP SEQUENCE                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Controller | `apps/api/src/modules/campaigns/campaigns.controller.ts` | REST API endpoints |
| Service | `apps/api/src/modules/campaigns/campaigns.service.ts` | Business logic |
| Worker | `apps/workers/src/email-sender.ts` | Email sending |
| Frontend | `apps/web/src/app/(dashboard)/campaigns/` | UI pages |

### Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `campaigns` | Campaign records | id, name, status, team_id, lead_list_id |
| `sequences` | Sequence steps | campaign_id, step_number, delay_days, subject, body |
| `sequence_variants` | A/B test variants | sequence_id, variant_name, weight |
| `campaign_inboxes` | Inbox assignments | campaign_id, inbox_id |
| `emails` | Sent email records | campaign_id, lead_id, sequence_step, status |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/campaigns` | List all campaigns |
| GET | `/api/v1/campaigns/:id` | Get campaign details |
| POST | `/api/v1/campaigns` | Create new campaign |
| PATCH | `/api/v1/campaigns/:id` | Update campaign |
| POST | `/api/v1/campaigns/:id/start` | Start campaign |
| POST | `/api/v1/campaigns/:id/pause` | Pause campaign |
| DELETE | `/api/v1/campaigns/:id` | Delete campaign |

### Email Sending Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Campaign   │     │   Check     │     │   Queue     │     │   Worker    │
│   Active    │ ──► │   Limits    │ ──► │   Email     │ ──► │   Process   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                                        │
                          │                                        ▼
                    ┌─────────────┐                         ┌─────────────┐
                    │  Rate Limit │                         │  Send via   │
                    │  Exceeded?  │                         │  Gmail/SMTP │
                    └─────────────┘                         └─────────────┘
                          │                                        │
                          ▼                                        ▼
                    ┌─────────────┐                         ┌─────────────┐
                    │   Delay &   │                         │   Update    │
                    │   Retry     │                         │   Status    │
                    └─────────────┘                         └─────────────┘
```

---

## 2. Warm-up System

### Overview

The Warm-up System gradually builds inbox reputation by sending emails between inboxes in a pool. It simulates natural email activity with opens, reads, and replies to establish sender reputation before launching campaigns.

### Warm-up Phases

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           WARM-UP TIMELINE                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Days 1-2      Days 3-4      Days 5-7      Days 8-14     Days 15-30    30+   │
│    │              │              │              │              │         │    │
│    ▼              ▼              ▼              ▼              ▼         ▼    │
│  ┌────┐        ┌────┐        ┌────┐        ┌────┐        ┌────┐     ┌────┐  │
│  │ 2  │        │ 4  │        │ 8  │        │ 12 │        │ 25 │     │ 40 │  │
│  │/day│        │/day│        │/day│        │/day│        │/day│     │/day│  │
│  └────┘        └────┘        └────┘        └────┘        └────┘     └────┘  │
│                                                                              │
│  ◄─────────────── RAMPING PHASE ──────────────────►◄── MAINTAINING ────────► │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Ramp-up Schedule

| Day Range | Daily Quota | Cumulative Emails |
|-----------|-------------|-------------------|
| 1-2 | 2 | 4 |
| 3-4 | 4 | 12 |
| 5-7 | 8 | 36 |
| 8-10 | 12 | 72 |
| 11-14 | 18 | 144 |
| 15-21 | 25 | 319 |
| 22-30 | 35 | 634 |
| 31+ | 40 | Maintained |

### Ramp Speed Options

| Speed | Days to Full Volume | Use Case |
|-------|---------------------|----------|
| Slow | 45 days | New domains, cautious approach |
| Normal | 30 days | Standard warm-up |
| Fast | 14 days | Established domains |

### Warm-up Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WARM-UP POOL                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Inbox A  │    │ Inbox B  │    │ Inbox C  │    │ Inbox D  │              │
│  │ Team 1   │    │ Team 1   │    │ Team 2   │    │ Team 2   │              │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘              │
│       │               │               │               │                     │
│       └───────────────┼───────────────┼───────────────┘                     │
│                       │               │                                      │
│                       ▼               ▼                                      │
│              ┌─────────────────────────────────┐                            │
│              │     RANDOM PAIRING ENGINE       │                            │
│              │   (Prefers cross-team pairs)    │                            │
│              └─────────────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              │
                              ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                    WARM-UP INTERACTION                                       │
│                                                                              │
│   Inbox A                                              Inbox C               │
│   (Sender)                                            (Receiver)             │
│      │                                                    │                  │
│      │  1. Send warm-up email                            │                  │
│      │ ─────────────────────────────────────────────────►│                  │
│      │                                                    │                  │
│      │                               2. Mark as read      │                  │
│      │                               3. Add star          │                  │
│      │                               4. Wait 2-30 min     │                  │
│      │                                                    │                  │
│      │  5. Send auto-reply                               │                  │
│      │ ◄─────────────────────────────────────────────────│                  │
│      │                                                    │                  │
│      │  6. Mark reply as read                            │                  │
│      │  7. Log interaction                               │                  │
│      │                                                    │                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Controller | `apps/api/src/modules/warmup/warmup.controller.ts` | REST API endpoints |
| Service | `apps/api/src/modules/warmup/warmup.service.ts` | Business logic |
| Scheduler | `apps/workers/src/warmup-scheduler.ts` | Schedule warmup sends |
| Worker | `apps/workers/src/warmup.ts` | Execute warmup sends/replies |

### Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `warmup_state` | Per-inbox warmup config | inbox_id, enabled, phase, current_day, ramp_speed |
| `warmup_interactions` | Interaction logs | from_inbox_id, to_inbox_id, type, created_at |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/inboxes/:id/warmup` | Get warmup state |
| POST | `/api/v1/inboxes/:id/warmup/enable` | Enable warmup |
| POST | `/api/v1/inboxes/:id/warmup/disable` | Disable warmup |
| PATCH | `/api/v1/inboxes/:id/warmup` | Update settings |
| GET | `/api/v1/warmup/pool/stats` | Pool statistics |

---

## 3. Inbox Management System

### Overview

The Inbox Management System handles OAuth connections to Gmail/Outlook/SMTP, tracks health scores, configures sending limits, and monitors deliverability.

### Inbox Connection Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │   OAuth     │     │   Callback  │     │   Store     │
│   Clicks    │ ──► │   Consent   │ ──► │   Endpoint  │ ──► │   Tokens    │
│   Connect   │     │   Screen    │     │   (code)    │     │  (encrypted)│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                            ┌─────────────┐
                                                            │   Inbox     │
                                                            │   Ready     │
                                                            └─────────────┘
```

### Inbox Health Score Calculation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HEALTH SCORE (0-100)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────┐                                                      │
│   │  Deliverability  │ ████████████░░░░░░░░  30%                           │
│   │  (bounce rate)   │                                                      │
│   └──────────────────┘                                                      │
│                                                                              │
│   ┌──────────────────┐                                                      │
│   │   Engagement     │ ████████░░░░░░░░░░░░  20%                           │
│   │  (open + reply)  │                                                      │
│   └──────────────────┘                                                      │
│                                                                              │
│   ┌──────────────────┐                                                      │
│   │ Warmup Progress  │ ████████░░░░░░░░░░░░  20%                           │
│   │  (days warmed)   │                                                      │
│   └──────────────────┘                                                      │
│                                                                              │
│   ┌──────────────────┐                                                      │
│   │  Spam Reports    │ ████░░░░░░░░░░░░░░░░  10%                           │
│   │  (complaints)    │                                                      │
│   └──────────────────┘                                                      │
│                                                                              │
│   ┌──────────────────┐                                                      │
│   │  Send Volume     │ ████████░░░░░░░░░░░░  20%                           │
│   │  (consistency)   │                                                      │
│   └──────────────────┘                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Health Score Thresholds

| Score | Status | Action |
|-------|--------|--------|
| 80-100 | Healthy | Continue normal operation |
| 50-79 | Warning | Review and optimize |
| 0-49 | Critical | Pause sending, investigate |

### Inbox Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `daily_send_limit` | 50 | 1-500 | Max emails per day |
| `hourly_limit` | Auto | - | Derived from daily limit |
| `min_delay_seconds` | 60 | 30-300 | Min delay between sends |
| `max_delay_seconds` | 300 | 60-600 | Max delay between sends |
| `send_window_start` | 09:00 | - | Send window start time |
| `send_window_end` | 17:00 | - | Send window end time |
| `weekends_enabled` | false | - | Include weekends |

### Circuit Breaker Pattern

```
                    Normal Operation
                           │
                           ▼
┌──────────┐         ┌──────────┐         ┌──────────┐
│  CLOSED  │ ──────► │   OPEN   │ ──────► │HALF-OPEN │
│ (normal) │ failure │ (paused) │ timeout │ (testing)│
└──────────┘ >5%     └──────────┘         └──────────┘
     ▲                                          │
     │                                          │
     └──────────────── success ─────────────────┘
```

### Key Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Controller | `apps/api/src/modules/inboxes/inboxes.controller.ts` | REST API endpoints |
| Service | `apps/api/src/modules/inboxes/inboxes.service.ts` | Business logic |
| Frontend | `apps/web/src/app/(dashboard)/inboxes/` | UI pages |

### Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `inboxes` | Inbox records | email, provider, status, oauth_tokens |
| `inbox_settings` | Per-inbox config | daily_send_limit, delays, send_window |
| `domains` | Domain settings | domain, spf_valid, dkim_valid, dmarc_valid |

---

## 4. Lead Management System

### Overview

The Lead Management System handles lead lists, importing, segmentation, and status tracking throughout campaigns.

### Lead Status Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LEAD STATUS WORKFLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────┐
                              │ PENDING  │
                              └────┬─────┘
                                   │
                                   │ Campaign starts
                                   ▼
                              ┌──────────┐
                              │   IN     │
                              │ SEQUENCE │
                              └────┬─────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
    ┌──────────┐            ┌──────────┐            ┌──────────┐
    │ REPLIED  │            │ BOUNCED  │            │ SEQUENCE │
    └────┬─────┘            └──────────┘            │ COMPLETE │
         │                                          └──────────┘
         │
    ┌────┴────────────────────────┐
    │                             │
    ▼                             ▼
┌──────────┐               ┌──────────┐
│INTERESTED│               │   NOT    │
│          │               │INTERESTED│
└────┬─────┘               └──────────┘
     │
     ▼
┌──────────┐
│ MEETING  │
│ BOOKED   │
└──────────┘
```

### Lead Data Fields

| Category | Fields |
|----------|--------|
| **Contact** | email, first_name, last_name, phone |
| **Company** | company, title, website |
| **Social** | linkedin_url |
| **Location** | timezone, country, city |
| **Custom** | custom_fields (JSON) |
| **Status** | status, unsubscribe_token |

### CSV Import Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │     │   Parse     │     │   Map       │     │  Validate   │
│   CSV File  │ ──► │   Headers   │ ──► │   Columns   │ ──► │   Data      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Import    │     │   Check     │     │   Create    │     │  Dedupe     │
│   Complete  │ ◄── │   Errors    │ ◄── │   Records   │ ◄── │   by Email  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Suppression List

| Reason | Description | Action |
|--------|-------------|--------|
| `hard_bounce` | Email doesn't exist | Never send again |
| `spam_complaint` | Marked as spam | Never send again |
| `unsubscribe` | Opted out | Never send again |
| `manual` | Manually added | Never send again |

### Key Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Controller | `apps/api/src/modules/leads/leads.controller.ts` | REST API endpoints |
| Service | `apps/api/src/modules/leads/leads.service.ts` | Business logic |
| Frontend | `apps/web/src/app/(dashboard)/leads/` | UI pages |

### Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `lead_lists` | Named collections | name, team_id, lead_count |
| `leads` | Individual records | email, first_name, company, status |
| `suppression_list` | Global suppression | email, reason, team_id |

---

## 5. Reply Management System

### Overview

The Reply Management System detects, parses, and classifies incoming replies with AI-powered intent detection.

### Intent Classification

| Intent | Description | Action |
|--------|-------------|--------|
| `interested` | Shows genuine interest | Flag for follow-up |
| `meeting_request` | Wants to schedule | High priority |
| `question` | Asking for info | Respond with info |
| `not_interested` | Explicitly declining | Stop sequence |
| `unsubscribe` | Wants removal | Add to suppression |
| `out_of_office` | Auto-reply (away) | Wait and retry |
| `auto_reply` | Automated response | Ignore |
| `bounce` | Delivery failure | Mark bounced |
| `neutral` | Unclear intent | Manual review |

### Reply Detection Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REPLY SCANNER WORKER                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Every 2-5 minutes
                                   ▼
                    ┌──────────────────────────┐
                    │   For Each Inbox         │
                    │   with OAuth Tokens      │
                    └────────────┬─────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────┐
              │  Fetch Messages Since Last Check │
              │  (Gmail API / Microsoft Graph)   │
              └────────────────┬─────────────────┘
                               │
                               ▼
              ┌──────────────────────────────────┐
              │     For Each New Message         │
              └────────────────┬─────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Match to       │  │  Extract Body   │  │  Classify       │
│  Original Email │  │  (strip quotes) │  │  Intent (AI)    │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                               ▼
              ┌──────────────────────────────────┐
              │       Create Reply Record        │
              │       Update Lead Status         │
              │       Stop Sequence if Needed    │
              └──────────────────────────────────┘
```

### Key Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Controller | `apps/api/src/modules/replies/replies.controller.ts` | REST API endpoints |
| Service | `apps/api/src/modules/replies/replies.service.ts` | Business logic |
| Worker | `apps/workers/src/reply-scanner.ts` | Reply detection |
| Frontend | `apps/web/src/app/(dashboard)/replies/` | Unified inbox UI |

### Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `replies` | Reply records | from_email, subject, body, intent, is_read |
| `email_events` | Event tracking | email_id, event_type, timestamp |

---

## 6. Analytics System

### Overview

The Analytics System tracks email metrics, campaign performance, inbox health, and provides dashboard statistics.

### Metrics Tracked

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EMAIL FUNNEL                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │                         SENT                                     │       │
│   │                        100%                                      │       │
│   └───────────────────────────┬─────────────────────────────────────┘       │
│                               │                                              │
│   ┌───────────────────────────▼─────────────────────────────────────┐       │
│   │                       DELIVERED                                  │       │
│   │                         95%                                      │       │
│   └───────────────────────────┬─────────────────────────────────────┘       │
│                               │                                              │
│   ┌───────────────────────────▼─────────────────────────────────────┐       │
│   │                        OPENED                                    │       │
│   │                         45%                                      │       │
│   └───────────────────────────┬─────────────────────────────────────┘       │
│                               │                                              │
│   ┌───────────────────────────▼─────────────────────────────────────┐       │
│   │                        CLICKED                                   │       │
│   │                         12%                                      │       │
│   └───────────────────────────┬─────────────────────────────────────┘       │
│                               │                                              │
│   ┌───────────────────────────▼─────────────────────────────────────┐       │
│   │                        REPLIED                                   │       │
│   │                          8%                                      │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Dashboard Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Emails Sent** | Total sent (7d/30d) | COUNT(emails) |
| **Open Rate** | Opened / Delivered | opens / delivered * 100 |
| **Click Rate** | Clicked / Opened | clicks / opens * 100 |
| **Reply Rate** | Replied / Sent | replies / sent * 100 |
| **Bounce Rate** | Bounced / Sent | bounces / sent * 100 |
| **Active Inboxes** | Inboxes in use | COUNT(status='active') |
| **Total Leads** | All leads | COUNT(leads) |

### Key Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Controller | `apps/api/src/modules/analytics/analytics.controller.ts` | REST API endpoints |
| Service | `apps/api/src/modules/analytics/analytics.service.ts` | Analytics queries |
| Frontend | `apps/web/src/app/(dashboard)/analytics/` | Charts & reports |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/dashboard` | Overview stats |
| GET | `/api/v1/analytics/emails` | Email metrics |
| GET | `/api/v1/analytics/campaigns` | Campaign performance |
| GET | `/api/v1/analytics/inboxes` | Inbox analytics |
| GET | `/api/v1/analytics/leads` | Lead funnel |
| GET | `/api/v1/analytics/replies` | Reply analytics |

---

## 7. AI Features System

### Overview

LLM-powered features for email generation, classification, and assistance using OpenRouter API with GPT-4o-mini.

### AI Features

| Feature | Input | Output | Use Case |
|---------|-------|--------|----------|
| **Reply Assistant** | Thread + email | Draft reply | Respond to leads |
| **Intent Detection** | Email content | Intent + confidence | Classify replies |
| **Campaign Generator** | Product + audience | 4-email sequence | Create campaigns |
| **Spam Checker** | Email content | Risk score + issues | Improve deliverability |
| **Follow-up Generator** | Original + history | New follow-up | Fresh follow-ups |
| **Daily Summary** | Team's activity | Summary + actions | Dashboard overview |
| **Objection Handler** | Objection email | Response options | Handle objections |

### AI Processing Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │   Backend   │     │  OpenRouter │     │   Response  │
│   Request   │ ──► │   API       │ ──► │   API       │ ──► │   to User   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                    │
                          │                    │
                          ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Build     │     │   Parse     │
                    │   Prompt    │     │   JSON      │
                    └─────────────┘     └─────────────┘
```

### Key Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Controller | `apps/api/src/modules/ai/ai.controller.ts` | REST API endpoints |
| Service | `apps/api/src/modules/ai/ai.service.ts` | AI operations |
| Client | `apps/web/src/lib/ai/client.ts` | Frontend API client |
| UI | `apps/web/src/components/ai/` | AI UI components |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/generate-reply` | Generate reply |
| POST | `/api/v1/ai/detect-intent` | Classify intent |
| POST | `/api/v1/ai/generate-campaign` | Generate sequence |
| POST | `/api/v1/ai/check-spam` | Check spam risk |
| POST | `/api/v1/ai/generate-followup` | Generate follow-up |
| GET | `/api/v1/ai/daily-summary` | Daily summary |
| POST | `/api/v1/ai/handle-objection` | Handle objection |

---

## 8. Authentication System

### Overview

Uses Supabase Auth with JWT tokens, supporting Google/Microsoft OAuth for inbox connections.

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USER AUTHENTICATION                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │  Supabase   │     │  Google/    │     │   JWT       │
│   Login     │ ──► │   Auth      │ ──► │  Microsoft  │ ──► │   Token     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API AUTHENTICATION                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   API       │     │   Extract   │     │  Validate   │     │   Allow     │
│   Request   │ ──► │   JWT       │ ──► │   Token     │ ──► │   Request   │
│  + Bearer   │     │   Token     │     │  (Supabase) │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, billing, delete team |
| **Admin** | Manage resources, invite members |
| **Member** | Use features, limited settings |
| **Viewer** | Read-only access |

### Key Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Controller | `apps/api/src/modules/auth/auth.controller.ts` | Auth endpoints |
| Service | `apps/api/src/modules/auth/auth.service.ts` | Auth operations |
| Guard | `apps/api/src/shared/guards/supabase-auth.guard.ts` | JWT validation |
| Frontend | `apps/web/src/lib/supabase/` | Supabase client |

---

## 9. Worker System

### Overview

Async job processing using BullMQ with Redis for email sending, warm-up, and reply scanning.

### Worker Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKER SYSTEM                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         REDIS (BullMQ)                               │   │
│   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│   │  │ email-send  │ │ warmup-send │ │warmup-reply │ │ reply-scan  │   │   │
│   │  │   Queue     │ │    Queue    │ │   Queue     │ │   Queue     │   │   │
│   │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘   │   │
│   └─────────┼───────────────┼───────────────┼───────────────┼───────────┘   │
│             │               │               │               │               │
│             ▼               ▼               ▼               ▼               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                          WORKERS                                     │   │
│   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│   │  │   Email     │ │   Warmup    │ │   Warmup    │ │   Reply     │   │   │
│   │  │   Sender    │ │   Sender    │ │   Replier   │ │   Scanner   │   │   │
│   │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Queue Configuration

| Queue | Concurrency | Rate Limit | Retries | Purpose |
|-------|-------------|------------|---------|---------|
| `email-send` | 5 | 10/sec | 5 | Campaign emails |
| `warmup-send` | 3 | 5/sec | 3 | Warmup emails |
| `warmup-reply` | 2 | 3/sec | 3 | Auto-replies |
| `reply-scan` | 2 | - | 3 | Scan for replies |

### Worker Files

| Worker | File Path | Purpose |
|--------|-----------|---------|
| Entry Point | `apps/workers/src/index.ts` | Start all workers |
| Email Sender | `apps/workers/src/email-sender.ts` | Send campaign emails |
| Warmup Worker | `apps/workers/src/warmup.ts` | Warmup sends/replies |
| Warmup Scheduler | `apps/workers/src/warmup-scheduler.ts` | Schedule warmups |
| Reply Scanner | `apps/workers/src/reply-scanner.ts` | Detect replies |

### Email Sender Job Flow

```
┌─────────────┐
│  Job Data   │
│  - emailId  │
│  - leadId   │
│  - inboxId  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Fetch Email    │ ──► │  Fetch Inbox    │ ──► │  Decrypt Tokens │
│  Record         │     │  + Settings     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Update Status  │ ◄── │  Send Email     │ ◄── │ Process Content │
│  Log Event      │     │  (Gmail/SMTP)   │     │ (variables)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 10. Database Schema

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE RELATIONSHIPS                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────────┐     ┌──────────┐
│  teams   │◄────│ team_members │────►│  users   │
└────┬─────┘     └──────────────┘     └──────────┘
     │
     │ 1:N
     ▼
┌──────────┐     ┌──────────────┐     ┌──────────┐
│ inboxes  │◄────│campaign_inbox│────►│campaigns │
└────┬─────┘     └──────────────┘     └────┬─────┘
     │                                      │
     │ 1:1                                  │ 1:N
     ▼                                      ▼
┌──────────┐                          ┌──────────┐
│ warmup   │                          │sequences │
│ _state   │                          └────┬─────┘
└──────────┘                               │
                                           │ 1:N
┌──────────┐     ┌──────────────┐          ▼
│lead_lists│◄────│    leads     │    ┌──────────┐
└──────────┘     └──────┬───────┘    │ sequence │
                        │            │ variants │
                        │ 1:N        └──────────┘
                        ▼
                 ┌──────────────┐     ┌──────────┐
                 │   emails     │────►│  email   │
                 └──────┬───────┘     │  events  │
                        │             └──────────┘
                        │ 1:N
                        ▼
                 ┌──────────────┐
                 │   replies    │
                 └──────────────┘
```

### Core Tables Summary

| Table | Purpose | Row Count (typical) |
|-------|---------|---------------------|
| `teams` | Team records | 100s |
| `users` | User accounts | 100s |
| `inboxes` | Email accounts | 1,000s |
| `campaigns` | Campaign records | 1,000s |
| `leads` | Lead contacts | 100,000s |
| `emails` | Sent emails | 1,000,000s |
| `replies` | Received replies | 10,000s |
| `warmup_state` | Warmup config | 1,000s |

---

## 11. API Reference

### Base URL

```
Development: http://localhost:3001/api/v1
Production:  https://api.aninda.com/api/v1
```

### Authentication

All endpoints (except health) require JWT authentication:

```
Authorization: Bearer <supabase_access_token>
```

### Complete Endpoint List

| Module | Method | Endpoint | Description |
|--------|--------|----------|-------------|
| **Campaigns** | GET | `/campaigns` | List campaigns |
| | GET | `/campaigns/:id` | Get campaign |
| | POST | `/campaigns` | Create campaign |
| | PATCH | `/campaigns/:id` | Update campaign |
| | POST | `/campaigns/:id/start` | Start campaign |
| | POST | `/campaigns/:id/pause` | Pause campaign |
| | DELETE | `/campaigns/:id` | Delete campaign |
| **Inboxes** | GET | `/inboxes` | List inboxes |
| | GET | `/inboxes/:id` | Get inbox |
| | POST | `/inboxes/smtp` | Add SMTP inbox |
| | PATCH | `/inboxes/:id` | Update inbox |
| | DELETE | `/inboxes/:id` | Remove inbox |
| **Leads** | GET | `/lead-lists` | List lead lists |
| | POST | `/lead-lists` | Create list |
| | GET | `/leads/:id` | Get lead |
| | PATCH | `/leads/:id` | Update lead |
| | POST | `/lead-lists/:id/import` | Import CSV |
| **Replies** | GET | `/replies` | List replies |
| | GET | `/replies/:id` | Get reply |
| | POST | `/replies/:id/read` | Mark read |
| **Warmup** | GET | `/inboxes/:id/warmup` | Get state |
| | POST | `/inboxes/:id/warmup/enable` | Enable |
| | POST | `/inboxes/:id/warmup/disable` | Disable |
| **Analytics** | GET | `/analytics/dashboard` | Dashboard |
| | GET | `/analytics/campaigns/:id` | Campaign stats |
| **AI** | POST | `/ai/generate-reply` | Generate reply |
| | POST | `/ai/detect-intent` | Detect intent |
| | POST | `/ai/generate-campaign` | Generate campaign |
| | POST | `/ai/check-spam` | Check spam |
| | GET | `/ai/daily-summary` | Daily summary |
| **Auth** | GET | `/auth/google/callback` | Google OAuth |
| | GET | `/auth/microsoft/callback` | Microsoft OAuth |

---

## Quick Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `REDIS_URL` | Yes | Upstash Redis URL |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth secret |
| `ENCRYPTION_KEY` | Yes | Token encryption key |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |

### Common Commands

```bash
# Development
pnpm dev                    # Start all services
pnpm --filter @aninda/web dev    # Start frontend only
pnpm --filter @aninda/api dev    # Start API only

# Build
pnpm build                  # Build all
pnpm --filter @aninda/web build  # Build frontend

# Database
pnpm db:push               # Push schema changes
pnpm db:generate           # Generate types
```

---

*Documentation generated for Aninda Cold Email Platform v0.1.0*
