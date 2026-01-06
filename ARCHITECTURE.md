# Cold Email Platform Architecture

## Instantly-like SaaS - Technical Design Document

---

## 1. High-Level Architecture (UI-Driven)

### Architecture Philosophy

The system follows a **UI-first, API-driven** architecture where:
- All business logic is defined via the Web Dashboard
- Backend API is stateless and reads configuration from the database
- Workers execute tasks asynchronously based on database state
- No manual CLI operations for standard workflows

### ASCII Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USERS / CLIENTS                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js on Vercel)                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │  Dashboard  │ │  Campaign   │ │   Inbox     │ │    Unified Inbox        ││
│  │   Overview  │ │   Builder   │ │  Management │ │    (Reply Tracking)     ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────┘│
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │  Warm-up    │ │   Lead      │ │  Analytics  │ │    Settings /           ││
│  │  Control    │ │   Lists     │ │  & Reports  │ │    Team Management      ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                              REST API / tRPC
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND API (NestJS on Fly.io/Railway)                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        API Gateway Layer                              │   │
│  │   • Authentication (Supabase JWT)                                     │   │
│  │   • Rate Limiting (Redis)                                             │   │
│  │   • Request Validation                                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │  Campaign   │ │   Inbox     │ │   Lead      │ │      Warm-up            ││
│  │  Service    │ │  Service    │ │  Service    │ │      Service            ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────┘│
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │  Analytics  │ │   Event     │ │   Team      │ │      Queue              ││
│  │  Service    │ │  Service    │ │  Service    │ │      Service            ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                           │
        Enqueue Jobs│                                           │Read Config
                    ▼                                           ▼
┌───────────────────────────────┐       ┌─────────────────────────────────────┐
│      REDIS (Upstash)          │       │       SUPABASE                       │
│  ┌─────────────────────────┐  │       │  ┌─────────────────────────────────┐│
│  │   BullMQ Queues         │  │       │  │   PostgreSQL Database           ││
│  │   • email-send          │  │       │  │   • Users & Teams               ││
│  │   • warmup-task         │  │       │  │   • Inboxes & Domains           ││
│  │   • reply-scan          │  │       │  │   • Campaigns & Sequences       ││
│  │   • follow-up           │  │       │  │   • Leads & Events              ││
│  │   • bounce-process      │  │       │  │   • Warm-up State               ││
│  └─────────────────────────┘  │       │  └─────────────────────────────────┘│
│  ┌─────────────────────────┐  │       │  ┌─────────────────────────────────┐│
│  │   Rate Limit Buckets    │  │       │  │   Supabase Auth                 ││
│  │   • per-inbox           │  │       │  │   • OAuth (Google/Microsoft)    ││
│  │   • per-domain          │  │       │  │   • JWT Sessions                ││
│  │   • per-team            │  │       │  │   • Row Level Security          ││
│  └─────────────────────────┘  │       │  └─────────────────────────────────┘│
└───────────────────────────────┘       │  ┌─────────────────────────────────┐│
                    │                   │  │   Realtime (optional)           ││
                    │                   │  │   • Campaign status updates     ││
                    │                   │  │   • Reply notifications         ││
                    │                   │  └─────────────────────────────────┘│
                    │                   └─────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ASYNC WORKERS (Fly.io / Railway)                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Worker Process Pool                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │   Email     │ │   Warmup    │ │   Reply     │ │      Follow-up          ││
│  │   Sender    │ │   Worker    │ │   Scanner   │ │      Scheduler          ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────┘│
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────────────────┐│
│  │   Bounce    │ │   Health    │ │            Cron Scheduler               ││
│  │   Processor │ │   Monitor   │ │   • Daily send window opener            ││
│  └─────────────┘ └─────────────┘ │   • Warm-up batch scheduler             ││
│                                  │   • Reply scan trigger                  ││
│                                  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EMAIL INFRASTRUCTURE                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     OAuth Token Manager                                  ││
│  │   • Token refresh handling                                               ││
│  │   • Credential encryption (at rest)                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌───────────────────┐ ┌───────────────────┐ ┌─────────────────────────────┐│
│  │   Gmail API       │ │  Microsoft Graph  │ │   Generic SMTP/IMAP         ││
│  │   (Send + Read)   │ │  (Send + Read)    │ │   (Nodemailer fallback)     ││
│  └───────────────────┘ └───────────────────┘ └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### Frontend (Next.js App Router)

| Component | Responsibility |
|-----------|----------------|
| Dashboard | Campaign health, send stats, inbox status overview |
| Campaign Builder | Multi-step sequence creation, variable mapping, scheduling |
| Inbox Management | Connect OAuth inboxes, configure limits, enable warm-up |
| Warm-up Control | Enable/disable warm-up, view warm-up metrics |
| Lead Lists | Import CSV, manage lists, segment leads |
| Unified Inbox | View replies, classify intent, take actions |
| Analytics | Open rates, reply rates, bounce rates, deliverability |
| Settings | Team management, API keys, integrations |

#### Backend API (NestJS)

**Design Decision: Modular Monolith**

Justification:
- Simpler deployment and debugging for small teams
- Shared database transactions
- Easy refactoring to microservices later if needed
- Modules are logically separated but deployed together

```
src/
├── modules/
│   ├── auth/           # Supabase auth integration
│   ├── campaigns/      # Campaign CRUD, sequence logic
│   ├── inboxes/        # Inbox connection, OAuth handling
│   ├── leads/          # Lead management, import
│   ├── warmup/         # Warm-up configuration
│   ├── events/         # Event logging, webhooks
│   ├── analytics/      # Aggregation queries
│   └── queue/          # BullMQ job scheduling
├── workers/            # Separate process entry points
│   ├── email-sender.worker.ts
│   ├── warmup.worker.ts
│   ├── reply-scanner.worker.ts
│   └── scheduler.worker.ts
└── shared/
    ├── email/          # Gmail API, Graph API, SMTP clients
    ├── database/       # Supabase client, repositories
    └── redis/          # Redis client, rate limiter
```

#### Async Workers

Workers are deployed as separate processes (can scale independently):

| Worker | Responsibility | Scaling Strategy |
|--------|----------------|------------------|
| Email Sender | Execute send jobs from queue | Horizontal (multiple instances) |
| Warmup Worker | Execute warm-up sends/replies | Horizontal |
| Reply Scanner | Poll IMAP / Graph API for replies | Horizontal (partitioned by inbox) |
| Follow-up Scheduler | Move leads to next sequence step | Single instance (idempotent) |
| Bounce Processor | Handle bounce webhooks/detection | Single instance |
| Health Monitor | Check inbox health, update scores | Single instance |

### Horizontal Scaling Strategy

```
┌─────────────────────────────────────────────────────────┐
│                   Load Balancer                          │
└─────────────────────────────────────────────────────────┘
            │           │           │           │
            ▼           ▼           ▼           ▼
        ┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐
        │ API-1 │   │ API-2 │   │ API-3 │   │ API-N │
        └───────┘   └───────┘   └───────┘   └───────┘
            │           │           │           │
            └───────────┴─────┬─────┴───────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
        ┌───────┐         ┌───────┐         ┌───────┐
        │ Redis │         │Supabase│        │ Redis │
        │(Queue)│         │ (DB)   │        │(Cache)│
        └───────┘         └───────┘         └───────┘
            │
    ┌───────┼───────┬───────────┐
    │       │       │           │
    ▼       ▼       ▼           ▼
┌───────┐┌───────┐┌───────┐┌───────┐
│Worker1││Worker2││Worker3││WorkerN│
└───────┘└───────┘└───────┘└───────┘
```

**Scaling Rules:**
- API instances: Scale based on request rate
- Workers: Scale based on queue depth
- Database: Supabase handles scaling (connection pooling via PgBouncer)
- Redis: Upstash auto-scales

### Rate Limiting Architecture

```typescript
// Rate limit hierarchy
interface RateLimitConfig {
  // Global platform limits
  platform: {
    emailsPerMinute: 10000,
    apiRequestsPerSecond: 1000,
  },
  // Per-team limits (based on plan)
  team: {
    dailyEmails: 50000,
    activeInboxes: 100,
    activeCampaigns: 50,
  },
  // Per-inbox limits (user configurable via UI)
  inbox: {
    dailySendLimit: 50,      // Default, UI adjustable
    hourlyLimit: 10,          // Derived from daily
    minDelaySeconds: 60,      // Between emails
    maxDelaySeconds: 300,
    warmupDailyLimit: 20,     // Separate from campaign sends
  },
  // Per-domain reputation protection
  domain: {
    dailyLimit: 500,          // Across all inboxes on domain
    hourlySpike: 100,         // Prevent sudden spikes
  }
}
```

**Redis Rate Limit Keys:**
```
rate:team:{teamId}:daily         → Counter with TTL
rate:inbox:{inboxId}:daily       → Counter with TTL
rate:inbox:{inboxId}:hourly      → Counter with TTL
rate:domain:{domain}:daily       → Counter with TTL
rate:domain:{domain}:hourly      → Counter with TTL
```

### Fault Tolerance

#### Retry Strategy (Exponential Backoff)

```typescript
const retryConfig = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,        // 1s initial
    maxDelay: 60000,    // 60s max
  },
  removeOnComplete: true,
  removeOnFail: false,  // Keep for analysis
};
```

#### Dead Letter Queue

```
┌─────────────┐    Fail 5x     ┌─────────────────┐
│ email-send  │ ─────────────► │ email-send-dlq  │
│   queue     │                │   (dead letter) │
└─────────────┘                └─────────────────┘
                                       │
                                       ▼
                               ┌─────────────────┐
                               │  Alert System   │
                               │  (Slack/Email)  │
                               └─────────────────┘
```

#### Circuit Breaker Pattern

```typescript
// Per-inbox circuit breaker
interface CircuitBreaker {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  failureThreshold: 5;
  resetTimeout: 300000;  // 5 minutes
  lastFailure: Date;
}

// States:
// closed: Normal operation
// open: All requests fail fast (inbox likely banned/issues)
// half-open: Allow one test request after timeout
```

---

## 2. Tech Stack (Justified)

### Frontend

| Technology | Justification |
|------------|---------------|
| **Next.js 14 (App Router)** | Server components for initial data, client components for interactivity. App Router provides better layouts for dashboard UIs. |
| **TypeScript** | Type safety across full stack, shared types with backend. |
| **TailwindCSS + shadcn/ui** | Rapid UI development, consistent design system, accessible components. |
| **React Query (TanStack)** | Server state management, caching, optimistic updates for responsive UI. |
| **Zustand** | Lightweight client state (UI state, not server state). |
| **React Hook Form + Zod** | Form handling with schema validation, shared schemas with backend. |

### Backend

| Technology | Justification |
|------------|---------------|
| **NestJS** | Modular architecture, dependency injection, excellent TypeScript support, built-in validation. |
| **BullMQ** | Production-ready Redis queue with delayed jobs, retries, rate limiting, priorities. |
| **Nodemailer** | Battle-tested SMTP client, fallback for non-OAuth inboxes. |
| **googleapis** | Official Google API client for Gmail API. |
| **@microsoft/microsoft-graph-client** | Official Microsoft Graph client for Outlook. |

### Database & Auth

| Technology | Justification |
|------------|---------------|
| **Supabase PostgreSQL** | Managed Postgres with auto-backups, connection pooling, extensions (pg_cron). |
| **Supabase Auth** | OAuth providers built-in, JWT tokens, session management. |
| **Supabase RLS** | Row-level security for multi-tenant data isolation. |
| **Supabase Realtime** | Optional push updates for campaign status, new replies. |

### Cache & Queues

| Technology | Justification |
|------------|---------------|
| **Upstash Redis** | Serverless Redis, pay-per-request, auto-scaling, global replication. |
| **BullMQ** | Feature-rich queue library: priorities, delays, rate limiting, repeatable jobs. |

### Infrastructure

| Technology | Justification |
|------------|---------------|
| **Vercel** | Next.js optimized hosting, edge functions, easy deployments. |
| **Fly.io** | Workers need long-running processes, Fly supports this well. Docker-based. |
| **Docker** | Consistent environments, easy local development, containerized workers. |

### Monitoring & Observability

| Technology | Purpose |
|------------|---------|
| **Sentry** | Error tracking, performance monitoring |
| **Axiom / Logtail** | Log aggregation, search |
| **BullMQ Dashboard** | Queue monitoring |
| **Supabase Dashboard** | Database monitoring |

---

## 3. Core Systems

### A. Inbox & Domain Warm-Up System

#### Overview

The warm-up system gradually increases sending volume for new inboxes while building positive engagement signals (opens, replies) to establish sender reputation.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WARM-UP POOL                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Inbox A │ │ Inbox B │ │ Inbox C │ │ Inbox D │ │ Inbox E │           │
│  │ (Team1) │ │ (Team2) │ │ (Team1) │ │ (Team3) │ │ (Team2) │           │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       │           │           │           │           │                  │
│       └───────────┴─────┬─────┴───────────┴───────────┘                  │
│                         │                                                │
│                         ▼                                                │
│              ┌─────────────────────┐                                     │
│              │  Warm-up Scheduler  │                                     │
│              │  (Pairs inboxes)    │                                     │
│              └─────────────────────┘                                     │
│                         │                                                │
│         ┌───────────────┼───────────────┐                               │
│         ▼               ▼               ▼                               │
│    A ──► B         B ──► C         D ──► A                              │
│    (send)          (send)          (send)                               │
│    B ──► A         C ──► B         A ──► D                              │
│    (reply)         (reply)         (reply)                              │
└─────────────────────────────────────────────────────────────────────────┘
```

#### UI Actions

| Action | UI Location | Result |
|--------|-------------|--------|
| Add Inbox | Inboxes → Add New | OAuth flow, inbox record created |
| Enable Warm-up | Inbox Detail → Toggle | `warmup_enabled = true`, join pool |
| Configure Warm-up | Inbox Detail → Settings | Adjust ramp-up speed, daily limits |
| View Warm-up Status | Inbox Detail → Warm-up Tab | Health score, daily sends, replies |
| Pause Warm-up | Inbox Detail → Toggle | Temporarily remove from pool |

#### API Endpoints

```
POST   /api/v1/inboxes                    # Connect new inbox
GET    /api/v1/inboxes/:id/warmup         # Get warm-up status
PUT    /api/v1/inboxes/:id/warmup         # Configure warm-up settings
POST   /api/v1/inboxes/:id/warmup/enable  # Enable warm-up
POST   /api/v1/inboxes/:id/warmup/disable # Disable warm-up
GET    /api/v1/warmup/pool/stats          # Pool-wide statistics
```

#### Worker Behavior

**Warm-up Scheduler (Cron: Every 15 minutes)**

```typescript
async function scheduleWarmupBatch() {
  // 1. Get all inboxes with warmup_enabled = true
  const inboxes = await getWarmupEnabledInboxes();

  // 2. Calculate today's send quota per inbox based on ramp-up day
  for (const inbox of inboxes) {
    const dayNumber = getDaysSinceWarmupStart(inbox);
    const dailyQuota = calculateRampUpQuota(dayNumber);
    const sentToday = await getWarmupSentToday(inbox.id);
    const remaining = dailyQuota - sentToday;

    if (remaining > 0) {
      // 3. Pair with random inbox from pool (different team preferred)
      const partner = await selectWarmupPartner(inbox);

      // 4. Queue warm-up job
      await warmupQueue.add('send-warmup', {
        fromInboxId: inbox.id,
        toInboxId: partner.id,
        messageType: 'warmup',
      }, {
        delay: randomDelay(60000, 300000), // 1-5 min random delay
      });
    }
  }
}
```

**Ramp-Up Algorithm**

```typescript
function calculateRampUpQuota(dayNumber: number): number {
  // Conservative ramp-up over 30 days
  const rampUpTable = [
    { days: [1, 2], quota: 2 },
    { days: [3, 4], quota: 4 },
    { days: [5, 7], quota: 8 },
    { days: [8, 10], quota: 12 },
    { days: [11, 14], quota: 18 },
    { days: [15, 21], quota: 25 },
    { days: [22, 30], quota: 35 },
    { days: [31, Infinity], quota: 40 },
  ];

  for (const tier of rampUpTable) {
    if (dayNumber >= tier.days[0] && dayNumber <= tier.days[1]) {
      return tier.quota;
    }
  }
  return 40; // Max warm-up volume
}
```

**Auto-Reply Logic**

```typescript
async function processWarmupReply(job: Job) {
  const { originalMessageId, toInboxId } = job.data;

  // 1. Wait human-like delay (2-30 minutes)
  // (Already handled by delayed job)

  // 2. Generate natural reply
  const replyTemplates = [
    "Thanks for reaching out!",
    "Got it, thanks!",
    "Appreciate the message.",
    "Thanks for the update!",
  ];
  const reply = replyTemplates[Math.floor(Math.random() * replyTemplates.length)];

  // 3. Mark original as read + star (positive engagement signals)
  await markAsRead(originalMessageId);
  await addStar(originalMessageId);

  // 4. Send reply
  await sendReply(toInboxId, originalMessageId, reply);

  // 5. Log interaction
  await logWarmupInteraction({
    inboxId: toInboxId,
    type: 'reply',
    originalMessageId,
  });
}
```

#### Inbox Reputation Score

```typescript
interface InboxHealthScore {
  overall: number;        // 0-100
  components: {
    deliverability: number,  // Based on bounce rate
    engagement: number,      // Open + reply rates
    warmupProgress: number,  // Days warmed up
    spamReports: number,     // Negative signal
    sendVolume: number,      // Healthy volume maintenance
  };
}

function calculateHealthScore(inbox: Inbox): InboxHealthScore {
  const metrics = await getInboxMetrics(inbox.id, '30d');

  return {
    overall: weightedAverage([
      { value: 100 - (metrics.bounceRate * 100), weight: 0.3 },
      { value: metrics.openRate * 100, weight: 0.2 },
      { value: metrics.replyRate * 100, weight: 0.2 },
      { value: Math.min(metrics.warmupDays / 30, 1) * 100, weight: 0.2 },
      { value: 100 - (metrics.spamReports * 10), weight: 0.1 },
    ]),
    components: { ... },
  };
}
```

---

### B. Email Sending Engine

#### Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          CAMPAIGN EXECUTION FLOW                           │
│                                                                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌────────────┐│
│  │   Campaign  │    │   Inbox     │    │   Rate      │    │   Email    ││
│  │   Queue     │───►│   Rotation  │───►│   Limiter   │───►│   Sender   ││
│  │             │    │             │    │             │    │            ││
│  └─────────────┘    └─────────────┘    └─────────────┘    └────────────┘│
│        │                  │                  │                   │       │
│        │                  │                  │                   │       │
│        ▼                  ▼                  ▼                   ▼       │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                        DECISION POINTS                               ││
│  │                                                                      ││
│  │  1. Is inbox within daily limit?         → Yes: continue, No: skip  ││
│  │  2. Is domain within hourly limit?       → Yes: continue, No: delay ││
│  │  3. Is recipient ESP matching preferred? → Yes: priority, No: ok    ││
│  │  4. Is inbox healthy (circuit closed)?   → Yes: continue, No: skip  ││
│  │  5. Has lead replied/bounced?            → Yes: skip, No: continue  ││
│  └─────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────┘
```

#### Multi-Inbox Rotation

```typescript
interface InboxRotationStrategy {
  type: 'round-robin' | 'weighted' | 'esp-match';
  weights?: Record<string, number>;  // For weighted strategy
  espPreference?: boolean;           // Prioritize matching ESPs
}

async function selectInboxForLead(
  campaign: Campaign,
  lead: Lead,
  assignedInboxes: Inbox[]
): Promise<Inbox | null> {
  const availableInboxes = [];

  for (const inbox of assignedInboxes) {
    // Check rate limits
    const withinLimits = await checkInboxLimits(inbox);
    if (!withinLimits) continue;

    // Check circuit breaker
    const circuitClosed = await checkCircuitBreaker(inbox);
    if (!circuitClosed) continue;

    // Check health score threshold
    if (inbox.healthScore < campaign.minHealthScore) continue;

    availableInboxes.push(inbox);
  }

  if (availableInboxes.length === 0) return null;

  // ESP Matching: Gmail inbox → Gmail recipient
  const leadEsp = detectEsp(lead.email);
  const espMatched = availableInboxes.filter(i => i.provider === leadEsp);

  if (espMatched.length > 0 && campaign.espMatchingEnabled) {
    return selectByStrategy(espMatched, campaign.rotationStrategy);
  }

  return selectByStrategy(availableInboxes, campaign.rotationStrategy);
}
```

#### Daily Per-Inbox Limits (UI Configurable)

```typescript
// Database schema
interface InboxSettings {
  inbox_id: string;
  daily_send_limit: number;      // Default: 50, UI adjustable
  hourly_limit: number;          // Auto-calculated or manual
  min_delay_seconds: number;     // Default: 60
  max_delay_seconds: number;     // Default: 300
  send_window_start: string;     // "09:00"
  send_window_end: string;       // "17:00"
  send_window_timezone: string;  // "America/New_York"
  weekends_enabled: boolean;     // Default: false
}

// UI Component pseudo-code
function InboxSettingsForm({ inbox }) {
  return (
    <Form>
      <NumberInput
        label="Daily Send Limit"
        value={inbox.dailySendLimit}
        min={1}
        max={200}
        help="Recommended: 30-50 for warm inboxes"
      />
      <TimeRangePicker
        label="Send Window"
        start={inbox.sendWindowStart}
        end={inbox.sendWindowEnd}
        timezone={inbox.timezone}
      />
      <Toggle
        label="Send on Weekends"
        value={inbox.weekendsEnabled}
      />
    </Form>
  );
}
```

#### Randomized Delays

```typescript
async function calculateSendDelay(inbox: Inbox, campaign: Campaign): Promise<number> {
  const baseMin = inbox.settings.minDelaySeconds * 1000;
  const baseMax = inbox.settings.maxDelaySeconds * 1000;

  // Add human-like variance
  const variance = 0.2; // 20% variance
  const adjustedMin = baseMin * (1 - variance);
  const adjustedMax = baseMax * (1 + variance);

  // Random delay within range
  const delay = Math.floor(
    Math.random() * (adjustedMax - adjustedMin) + adjustedMin
  );

  // Check if within send window
  const now = new Date();
  const sendWindowStart = parseTime(inbox.settings.sendWindowStart, inbox.settings.timezone);
  const sendWindowEnd = parseTime(inbox.settings.sendWindowEnd, inbox.settings.timezone);

  if (now < sendWindowStart) {
    // Delay until window opens
    return sendWindowStart.getTime() - now.getTime() + delay;
  }

  if (now > sendWindowEnd) {
    // Delay until next day's window
    const nextWindowStart = addDays(sendWindowStart, 1);
    return nextWindowStart.getTime() - now.getTime() + delay;
  }

  return delay;
}
```

#### Bounce Handling

```typescript
enum BounceType {
  HARD = 'hard',      // Invalid email, permanent
  SOFT = 'soft',      // Temporary (mailbox full, etc.)
  SPAM = 'spam',      // Marked as spam
  UNKNOWN = 'unknown'
}

async function handleBounce(event: BounceEvent) {
  const { leadId, inboxId, bounceType, rawMessage } = event;

  // 1. Update lead status
  await updateLeadStatus(leadId, {
    status: bounceType === BounceType.HARD ? 'bounced' : 'soft_bounced',
    bounceReason: rawMessage,
  });

  // 2. Stop campaign sequence for this lead
  await pauseLeadSequence(leadId);

  // 3. Update inbox health metrics
  await incrementInboxMetric(inboxId, 'bounces');

  // 4. Check for inbox health threshold
  const recentBounceRate = await getRecentBounceRate(inboxId);
  if (recentBounceRate > 0.05) { // 5% bounce rate threshold
    // Open circuit breaker
    await openCircuitBreaker(inboxId);
    // Alert team
    await sendAlert({
      type: 'high_bounce_rate',
      inboxId,
      bounceRate: recentBounceRate,
    });
  }

  // 5. If hard bounce, add to global suppression list
  if (bounceType === BounceType.HARD) {
    await addToSuppressionList(event.recipientEmail);
  }
}
```

---

### C. Campaign & Sequence Engine

#### Sequence Data Model

```
Campaign
├── id
├── name
├── status: draft | active | paused | completed
├── settings
│   ├── timezone
│   ├── send_days: ['mon', 'tue', 'wed', 'thu', 'fri']
│   ├── stop_on_reply: true
│   ├── stop_on_bounce: true
│   └── track_opens: true
├── assigned_inboxes: [inbox_id, ...]
└── sequences: [Sequence, ...]

Sequence (Step)
├── id
├── campaign_id
├── step_number: 1, 2, 3...
├── delay_days: 3  (days after previous step)
├── delay_hours: 0
├── subject: "{{firstName}}, quick question"
├── body: "<p>Hi {{firstName}},...</p>"
├── variants: [  // A/B testing
│   { subject: "...", body: "...", weight: 50 },
│   { subject: "...", body: "...", weight: 50 },
│ ]
└── conditions: [
    { type: 'no_reply', action: 'continue' },
    { type: 'replied', action: 'stop' },
  ]
```

#### UI: Campaign Builder

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Campaign: "Q1 Outreach"                                    [Save Draft]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─── Step 1 ───────────────────────────────────────────────────────┐  │
│  │ Subject: {{firstName}}, quick question about {{company}}         │  │
│  │ ──────────────────────────────────────────────────────────────── │  │
│  │ Hi {{firstName}},                                                │  │
│  │                                                                  │  │
│  │ I noticed {{company}} is growing fast. We helped [similar co]    │  │
│  │ achieve [result].                                                │  │
│  │                                                                  │  │
│  │ Worth a quick chat?                                              │  │
│  │ ──────────────────────────────────────────────────────────────── │  │
│  │ [+ Add Variant]                              Delay: Immediate    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│                        [Wait 3 days]                                    │
│                              │                                          │
│                              ▼                                          │
│  ┌─── Step 2 (if no reply) ─────────────────────────────────────────┐  │
│  │ Subject: Re: {{firstName}}, quick question about {{company}}     │  │
│  │ ──────────────────────────────────────────────────────────────── │  │
│  │ Hi {{firstName}},                                                │  │
│  │                                                                  │  │
│  │ Just following up on my previous email...                        │  │
│  │ ──────────────────────────────────────────────────────────────── │  │
│  │ [+ Add Variant]                              Delay: 3 days       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                        [+ Add Step]                                     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Assigned Inboxes: [inbox1@gmail.com] [inbox2@outlook.com] [+Add]      │
│  Lead List: "Q1 Prospects" (2,450 leads)                   [Change]     │
│  Schedule: Mon-Fri, 9am-5pm EST                            [Edit]       │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Conditional Logic

```typescript
interface SequenceCondition {
  type: 'no_reply' | 'replied' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed';
  action: 'continue' | 'stop' | 'move_to_step' | 'tag';
  targetStep?: number;
  tag?: string;
}

async function evaluateLeadConditions(
  lead: Lead,
  currentStep: Sequence,
  nextStep: Sequence | null
): Promise<'continue' | 'stop' | number> {

  // Check for reply (highest priority)
  const hasReplied = await checkLeadReplied(lead.id);
  if (hasReplied && currentStep.stopOnReply) {
    await updateLeadStatus(lead.id, 'replied');
    return 'stop';
  }

  // Check for bounce
  const hasBounced = await checkLeadBounced(lead.id);
  if (hasBounced) {
    return 'stop';
  }

  // Check for unsubscribe
  const hasUnsubscribed = await checkLeadUnsubscribed(lead.id);
  if (hasUnsubscribed) {
    return 'stop';
  }

  // Continue to next step if exists
  if (nextStep) {
    return 'continue';
  }

  // Sequence complete
  await updateLeadStatus(lead.id, 'sequence_complete');
  return 'stop';
}
```

#### Timezone-Aware Scheduling

```typescript
async function scheduleNextStep(lead: Lead, campaign: Campaign, step: Sequence) {
  const leadTimezone = lead.timezone || campaign.defaultTimezone;

  // Calculate next send time
  const now = new Date();
  const delayMs = (step.delayDays * 24 * 60 * 60 * 1000) +
                  (step.delayHours * 60 * 60 * 1000);
  let scheduledTime = new Date(now.getTime() + delayMs);

  // Adjust to send window in lead's timezone
  scheduledTime = adjustToSendWindow(
    scheduledTime,
    leadTimezone,
    campaign.sendWindowStart,
    campaign.sendWindowEnd,
    campaign.sendDays
  );

  // Queue the job
  await emailQueue.add('send-campaign-email', {
    leadId: lead.id,
    campaignId: campaign.id,
    stepId: step.id,
  }, {
    delay: scheduledTime.getTime() - now.getTime(),
    jobId: `${campaign.id}-${lead.id}-${step.id}`, // Idempotency
  });
}
```

#### Spintax & Variable Injection

```typescript
// Spintax: {Hello|Hi|Hey} {{firstName}}
function processSpintax(text: string): string {
  const spintaxRegex = /\{([^{}]+)\}/g;
  return text.replace(spintaxRegex, (match, options) => {
    const choices = options.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

// Variables: {{firstName}}, {{company}}, {{customField}}
function injectVariables(text: string, lead: Lead): string {
  const variables = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    company: lead.company,
    title: lead.title,
    ...lead.customFields,
  };

  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match; // Keep original if not found
  });
}

// Combined processing
function processEmailContent(template: string, lead: Lead): string {
  let content = processSpintax(template);
  content = injectVariables(content, lead);
  return content;
}
```

---

### D. Deliverability Protection

#### System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DELIVERABILITY PROTECTION LAYER                       │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  Pre-Send       │  │  Real-time      │  │  Post-Send              │ │
│  │  Checks         │  │  Monitoring     │  │  Analysis               │ │
│  │                 │  │                 │  │                         │ │
│  │  • Spam score   │  │  • Bounce rate  │  │  • Open rate trends     │ │
│  │  • Link check   │  │  • Send rate    │  │  • Reply patterns       │ │
│  │  • Content      │  │  • Error rate   │  │  • Spam reports         │ │
│  │    variation    │  │  • Queue depth  │  │  • Unsubscribes         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│           │                    │                      │                 │
│           ▼                    ▼                      ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    AUTO-THROTTLE ENGINE                              ││
│  │                                                                      ││
│  │  IF bounce_rate > 3%  → Reduce send rate by 50%                     ││
│  │  IF spam_reports > 1% → Pause inbox, alert team                     ││
│  │  IF open_rate < 5%    → Flag for content review                     ││
│  │  IF error_rate > 5%   → Open circuit breaker                        ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

#### UI: Deliverability Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Deliverability Health                                        [Refresh] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Overall Score: 92/100  ████████████████████░░░░                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Inbox Health                                                    │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  inbox1@gmail.com       ██████████████████░░  89%   [Details]   │   │
│  │  inbox2@outlook.com     █████████████████████  95%  [Details]   │   │
│  │  inbox3@gmail.com       ████████████░░░░░░░░  62%   [!Warning]  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Warnings & Recommendations                                      │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  ⚠️  inbox3@gmail.com: High bounce rate (4.2%) - Consider       │   │
│  │      pausing and reviewing lead list quality                     │   │
│  │                                                                  │   │
│  │  💡 Campaign "Q1 Outreach": Low open rate (8%) - Consider A/B   │   │
│  │     testing subject lines                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Safe Mode Settings                                              │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  [x] Enable open tracking                                        │   │
│  │  [x] Enable click tracking                                       │   │
│  │  [x] Auto-throttle on high bounce                                │   │
│  │  [x] Require content variation (>20% unique)                     │   │
│  │  [ ] Ultra-safe mode (50% volume reduction)                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Content Variation Enforcement

```typescript
interface ContentVariationCheck {
  isValid: boolean;
  uniquenessScore: number;  // 0-100
  issues: string[];
}

async function checkContentVariation(
  campaign: Campaign,
  recentEmails: Email[]
): Promise<ContentVariationCheck> {
  const issues: string[] = [];

  // Get last 100 sent emails from this campaign
  const recentBodies = recentEmails.map(e => e.body);
  const currentTemplate = campaign.sequences[0].body;

  // Calculate uniqueness using fuzzy matching
  let totalSimilarity = 0;
  for (const body of recentBodies) {
    const similarity = calculateSimilarity(currentTemplate, body);
    totalSimilarity += similarity;
  }

  const avgSimilarity = totalSimilarity / recentBodies.length;
  const uniquenessScore = (1 - avgSimilarity) * 100;

  if (uniquenessScore < 20) {
    issues.push('Content too similar to recent emails. Add more spintax or variations.');
  }

  // Check for spam trigger words
  const spamWords = ['free', 'act now', 'limited time', 'click here'];
  for (const word of spamWords) {
    if (currentTemplate.toLowerCase().includes(word)) {
      issues.push(`Avoid spam trigger word: "${word}"`);
    }
  }

  // Check link safety
  const links = extractLinks(currentTemplate);
  for (const link of links) {
    const isSafe = await checkLinkReputation(link);
    if (!isSafe) {
      issues.push(`Link may trigger spam filters: ${link}`);
    }
  }

  return {
    isValid: issues.length === 0 && uniquenessScore >= 20,
    uniquenessScore,
    issues,
  };
}
```

#### Auto-Throttling

```typescript
interface ThrottleRule {
  metric: 'bounce_rate' | 'spam_rate' | 'error_rate';
  threshold: number;
  window: '1h' | '24h' | '7d';
  action: 'reduce_50' | 'pause' | 'alert';
}

const defaultThrottleRules: ThrottleRule[] = [
  { metric: 'bounce_rate', threshold: 0.03, window: '24h', action: 'reduce_50' },
  { metric: 'bounce_rate', threshold: 0.05, window: '24h', action: 'pause' },
  { metric: 'spam_rate', threshold: 0.01, window: '7d', action: 'pause' },
  { metric: 'error_rate', threshold: 0.05, window: '1h', action: 'reduce_50' },
];

async function evaluateThrottleRules(inbox: Inbox): Promise<void> {
  for (const rule of defaultThrottleRules) {
    const metricValue = await getMetric(inbox.id, rule.metric, rule.window);

    if (metricValue > rule.threshold) {
      switch (rule.action) {
        case 'reduce_50':
          await reduceInboxLimit(inbox.id, 0.5);
          await logThrottleEvent(inbox.id, rule, metricValue);
          break;
        case 'pause':
          await pauseInbox(inbox.id);
          await sendAlert({
            type: 'inbox_paused',
            inboxId: inbox.id,
            reason: `${rule.metric} exceeded threshold`,
            value: metricValue,
          });
          break;
        case 'alert':
          await sendAlert({
            type: 'metric_warning',
            inboxId: inbox.id,
            metric: rule.metric,
            value: metricValue,
          });
          break;
      }
    }
  }
}
```

---

### E. Reply & Intent Detection

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      REPLY DETECTION SYSTEM                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     INGESTION LAYER                              │   │
│  │                                                                  │   │
│  │   Gmail API          Microsoft Graph         Generic IMAP        │   │
│  │   (Webhook +         (Webhook +              (Polling every      │   │
│  │    Push)              Delta Sync)             2-5 min)           │   │
│  │       │                    │                       │             │   │
│  │       └────────────────────┴───────────────────────┘             │   │
│  │                            │                                      │   │
│  │                            ▼                                      │   │
│  │                    ┌──────────────┐                               │   │
│  │                    │ Reply Queue  │                               │   │
│  │                    └──────────────┘                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                               │                                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   PROCESSING LAYER                               │   │
│  │                                                                  │   │
│  │   1. Thread Matching                                             │   │
│  │      └─ Match reply to original campaign email                   │   │
│  │                                                                  │   │
│  │   2. Content Extraction                                          │   │
│  │      └─ Strip signatures, quoted text, extract reply body        │   │
│  │                                                                  │   │
│  │   3. Intent Classification                                       │   │
│  │      └─ NLP model → Interested / Neutral / Not Interested /      │   │
│  │                     Out of Office / Bounce                       │   │
│  │                                                                  │   │
│  │   4. Action Execution                                            │   │
│  │      └─ Update lead status, stop sequence, notify user           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                               │                                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    UNIFIED INBOX UI                              │   │
│  │                                                                  │   │
│  │   All replies across all campaigns, filterable by:               │   │
│  │   - Intent (Interested / Not Interested / etc.)                  │   │
│  │   - Campaign                                                     │   │
│  │   - Inbox                                                        │   │
│  │   - Date range                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### IMAP Polling vs Webhooks

| Method | Provider | Latency | Setup Complexity |
|--------|----------|---------|------------------|
| Gmail Push Notifications | Google | Real-time | Medium (Pub/Sub) |
| Graph Webhooks | Microsoft | Real-time | Medium |
| IMAP Polling | Any | 2-5 min | Low |

```typescript
// Gmail Push Notification Setup
async function setupGmailPush(inbox: Inbox) {
  const gmail = google.gmail({ version: 'v1', auth: inbox.oauth });

  await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: `projects/${PROJECT_ID}/topics/gmail-push`,
      labelIds: ['INBOX'],
    },
  });
}

// Microsoft Graph Webhook Setup
async function setupGraphWebhook(inbox: Inbox) {
  const client = getGraphClient(inbox.oauth);

  await client.api('/subscriptions').post({
    changeType: 'created',
    notificationUrl: `${API_URL}/webhooks/microsoft`,
    resource: '/me/mailFolders/inbox/messages',
    expirationDateTime: addDays(new Date(), 3).toISOString(),
    clientState: inbox.id,
  });
}

// IMAP Polling (Fallback)
async function pollImapInbox(inbox: Inbox) {
  const imap = new Imap({
    user: inbox.email,
    password: inbox.appPassword,
    host: inbox.imapHost,
    port: 993,
    tls: true,
  });

  await imap.connect();
  await imap.openBox('INBOX');

  // Fetch messages since last check
  const messages = await imap.search([
    ['SINCE', inbox.lastChecked],
    ['UNSEEN']
  ]);

  for (const msg of messages) {
    await replyQueue.add('process-reply', {
      inboxId: inbox.id,
      messageId: msg.id,
      raw: msg.body,
    });
  }

  await updateInbox(inbox.id, { lastChecked: new Date() });
}
```

#### Intent Classification

```typescript
enum ReplyIntent {
  INTERESTED = 'interested',
  MEETING_REQUEST = 'meeting_request',
  QUESTION = 'question',
  NOT_INTERESTED = 'not_interested',
  UNSUBSCRIBE = 'unsubscribe',
  OUT_OF_OFFICE = 'out_of_office',
  AUTO_REPLY = 'auto_reply',
  BOUNCE = 'bounce',
  NEUTRAL = 'neutral',
}

// Rule-based classification (fast, no API cost)
function classifyIntentRuleBased(body: string): ReplyIntent {
  const lowerBody = body.toLowerCase();

  // Out of Office
  if (lowerBody.includes('out of office') ||
      lowerBody.includes('on vacation') ||
      lowerBody.includes('automatic reply')) {
    return ReplyIntent.OUT_OF_OFFICE;
  }

  // Bounce indicators
  if (lowerBody.includes('delivery failed') ||
      lowerBody.includes('undeliverable') ||
      lowerBody.includes('mailbox not found')) {
    return ReplyIntent.BOUNCE;
  }

  // Unsubscribe
  if (lowerBody.includes('unsubscribe') ||
      lowerBody.includes('remove me') ||
      lowerBody.includes('stop emailing')) {
    return ReplyIntent.UNSUBSCRIBE;
  }

  // Not interested
  if (lowerBody.includes('not interested') ||
      lowerBody.includes('no thanks') ||
      lowerBody.includes('please don\'t')) {
    return ReplyIntent.NOT_INTERESTED;
  }

  // Interested signals
  if (lowerBody.includes('interested') ||
      lowerBody.includes('tell me more') ||
      lowerBody.includes('let\'s chat') ||
      lowerBody.includes('schedule a call')) {
    return ReplyIntent.INTERESTED;
  }

  // Meeting request
  if (lowerBody.includes('calendar') ||
      lowerBody.includes('available') ||
      lowerBody.includes('meet') ||
      lowerBody.includes('call')) {
    return ReplyIntent.MEETING_REQUEST;
  }

  // Question
  if (body.includes('?')) {
    return ReplyIntent.QUESTION;
  }

  return ReplyIntent.NEUTRAL;
}

// LLM-based classification (more accurate, has cost)
async function classifyIntentLLM(body: string): Promise<ReplyIntent> {
  const prompt = `Classify this email reply into one of these categories:
  - interested: Wants to learn more or engage
  - meeting_request: Wants to schedule a call/meeting
  - question: Asking a question (needs response)
  - not_interested: Explicitly declining
  - unsubscribe: Wants to be removed from list
  - out_of_office: Auto-reply, person is away
  - bounce: Delivery failure
  - neutral: No clear intent

  Reply content:
  """
  ${body}
  """

  Category:`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 20,
  });

  return response.choices[0].message.content.trim() as ReplyIntent;
}
```

#### UI: Unified Inbox

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Unified Inbox                                               [Refresh]  │
├─────────────────────────────────────────────────────────────────────────┤
│  Filter: [All Intents ▼] [All Campaigns ▼] [All Inboxes ▼] [Last 7d ▼] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🟢 INTERESTED                                                   │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  From: john@acmecorp.com                         2 hours ago    │   │
│  │  Campaign: Q1 Outreach                                          │   │
│  │  ──────────────────────────────────────────────────────────     │   │
│  │  "Hi, this sounds interesting. Can we schedule a call next      │   │
│  │   week to discuss further?"                                     │   │
│  │  ──────────────────────────────────────────────────────────     │   │
│  │  [Reply] [Mark as Contacted] [Change Status ▼]                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🟡 QUESTION                                                     │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  From: sarah@techstartup.io                      5 hours ago    │   │
│  │  Campaign: Product Launch                                        │   │
│  │  ──────────────────────────────────────────────────────────     │   │
│  │  "Thanks for reaching out. What pricing tiers do you offer?"    │   │
│  │  ──────────────────────────────────────────────────────────     │   │
│  │  [Reply] [Mark as Contacted] [Change Status ▼]                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🔴 NOT INTERESTED                                               │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  From: mike@enterprise.co                        1 day ago      │   │
│  │  Campaign: Q1 Outreach                                          │   │
│  │  ──────────────────────────────────────────────────────────     │   │
│  │  "Not interested at this time, please remove me from your list."│   │
│  │  ──────────────────────────────────────────────────────────     │   │
│  │  [Archive] [Add to Suppression List]                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [Load More...]                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Anti-Spam & Compliance

### ESP Rate Limits

| Provider | Daily Send Limit | Rate Limit | Notes |
|----------|------------------|------------|-------|
| Gmail (free) | 500/day | 20/min | Workspace has higher limits |
| Gmail (Workspace) | 2,000/day | 100/min | Varies by plan |
| Microsoft 365 | 10,000/day | 30/min | Recipient limits apply |
| Generic SMTP | Varies | Varies | Check provider docs |

```typescript
// ESP-specific rate limiting
const espLimits = {
  'gmail.com': { daily: 500, perMinute: 20 },
  'googlemail.com': { daily: 500, perMinute: 20 },
  'outlook.com': { daily: 300, perMinute: 10 },
  'hotmail.com': { daily: 300, perMinute: 10 },
};

async function checkEspLimits(inbox: Inbox): Promise<boolean> {
  const domain = inbox.email.split('@')[1];
  const limits = espLimits[domain] || { daily: 100, perMinute: 5 };

  const dailySent = await redis.get(`esp:${inbox.id}:daily`);
  const minuteSent = await redis.get(`esp:${inbox.id}:minute`);

  return dailySent < limits.daily && minuteSent < limits.perMinute;
}
```

### DKIM / SPF / DMARC

```typescript
interface DomainHealth {
  domain: string;
  spf: { valid: boolean; record: string };
  dkim: { valid: boolean; selector: string };
  dmarc: { valid: boolean; policy: 'none' | 'quarantine' | 'reject' };
  overallScore: number;
}

async function checkDomainHealth(domain: string): Promise<DomainHealth> {
  const [spf, dkim, dmarc] = await Promise.all([
    checkSpfRecord(domain),
    checkDkimRecord(domain),
    checkDmarcRecord(domain),
  ]);

  const score = calculateDomainScore(spf, dkim, dmarc);

  return {
    domain,
    spf,
    dkim,
    dmarc,
    overallScore: score,
  };
}
```

### Unsubscribe Handling

```typescript
// One-click unsubscribe header (RFC 8058)
function addUnsubscribeHeaders(email: Email, lead: Lead): Email {
  const unsubscribeUrl = `${APP_URL}/unsubscribe/${lead.unsubscribeToken}`;

  return {
    ...email,
    headers: {
      ...email.headers,
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

// Unsubscribe endpoint
app.post('/unsubscribe/:token', async (req, res) => {
  const { token } = req.params;

  const lead = await findLeadByUnsubscribeToken(token);
  if (!lead) {
    return res.status(404).send('Invalid token');
  }

  await updateLead(lead.id, {
    status: 'unsubscribed',
    unsubscribedAt: new Date(),
  });

  // Stop all active sequences
  await stopAllSequencesForLead(lead.id);

  // Add to team suppression list
  await addToSuppressionList(lead.teamId, lead.email);

  res.send('You have been unsubscribed successfully.');
});
```

### GDPR / CAN-SPAM Compliance

```typescript
interface ComplianceChecklist {
  hasUnsubscribeLink: boolean;
  hasPhysicalAddress: boolean;
  hasValidFromName: boolean;
  isConsentRecorded: boolean;
  subjectNotMisleading: boolean;
}

async function validateCompliance(campaign: Campaign): Promise<ComplianceChecklist> {
  const template = campaign.sequences[0];

  return {
    hasUnsubscribeLink: template.body.includes('{{unsubscribe_link}}'),
    hasPhysicalAddress: template.body.includes(campaign.team.physicalAddress),
    hasValidFromName: !!campaign.fromName && campaign.fromName.length > 0,
    isConsentRecorded: campaign.leadList.consentType !== 'none',
    subjectNotMisleading: !containsMisleadingSubject(template.subject),
  };
}
```

---

## 7. Scaling & Reliability

### Scaling to 100k+ Emails/Day

```
Target: 100,000 emails/day
= 4,166 emails/hour
= 69 emails/minute
= ~1.15 emails/second

With 50 active inboxes (50 emails/day each):
= 2,500 emails/day per rotation

Need: 40 active inboxes minimum for 100k/day
(with 50/inbox limit, that's 2,000 inboxes)

More realistically:
- 200 inboxes × 500 emails/day = 100k/day
- (Higher-tier Workspace accounts)
```

#### Worker Scaling

```typescript
// Auto-scaling based on queue depth
const scalingConfig = {
  minWorkers: 2,
  maxWorkers: 20,
  scaleUpThreshold: 1000,   // Queue depth
  scaleDownThreshold: 100,
  cooldownSeconds: 300,
};

// Fly.io auto-scaling config
// fly.toml
[http_service]
  min_machines_running = 2
  auto_stop_machines = true
  auto_start_machines = true

[[services]]
  internal_port = 3000
  protocol = "tcp"
  [services.concurrency]
    type = "requests"
    soft_limit = 100
    hard_limit = 200
```

### Handling Inbox Bans

```typescript
interface InboxBanHandler {
  // Detection
  detectBan(inbox: Inbox): Promise<boolean>;

  // Response
  handleBan(inbox: Inbox): Promise<void>;

  // Recovery
  attemptRecovery(inbox: Inbox): Promise<boolean>;
}

async function handlePotentialBan(inbox: Inbox, error: Error) {
  const banIndicators = [
    'Account suspended',
    'Too many login attempts',
    'Access denied',
    'Account locked',
  ];

  const isBan = banIndicators.some(ind =>
    error.message.includes(ind)
  );

  if (isBan) {
    // 1. Immediately pause inbox
    await pauseInbox(inbox.id, 'potential_ban');

    // 2. Redistribute queued emails
    await redistributeInboxQueue(inbox.id);

    // 3. Alert team
    await sendAlert({
      type: 'inbox_ban',
      inboxId: inbox.id,
      error: error.message,
      action: 'Manual review required',
    });

    // 4. Log for analysis
    await logBanEvent(inbox.id, error);
  }
}
```

### Observability Stack

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OBSERVABILITY STACK                               │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │    Metrics      │  │     Logs        │  │       Traces            │ │
│  │   (Prometheus/  │  │   (Axiom/       │  │      (Sentry)           │ │
│  │    Grafana)     │  │    Logtail)     │  │                         │ │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘ │
│           │                    │                        │               │
│           └────────────────────┼────────────────────────┘               │
│                                │                                        │
│                                ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      ALERTING                                    │   │
│  │                                                                  │   │
│  │   • Slack integration for critical alerts                        │   │
│  │   • Email digest for daily summaries                             │   │
│  │   • PagerDuty for on-call (enterprise)                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Key Metrics to Track

```typescript
const criticalMetrics = {
  // System health
  'api.latency.p95': { threshold: 500, unit: 'ms' },
  'api.error_rate': { threshold: 0.01, unit: 'ratio' },
  'queue.depth': { threshold: 10000, unit: 'jobs' },
  'worker.processing_time.p95': { threshold: 5000, unit: 'ms' },

  // Email operations
  'email.sent.rate': { min: 10, unit: 'per_minute' },
  'email.bounce_rate': { threshold: 0.03, unit: 'ratio' },
  'email.delivery_rate': { min: 0.95, unit: 'ratio' },

  // Inbox health
  'inbox.active_count': { min: 10, unit: 'count' },
  'inbox.circuit_open_count': { threshold: 5, unit: 'count' },

  // Business metrics
  'campaign.active_count': { unit: 'count' },
  'reply.detected.rate': { unit: 'per_hour' },
};
```

### Fallback & Degradation

```typescript
// Graceful degradation strategies
const degradationStrategies = {
  // Redis unavailable
  redisDown: {
    rateLimit: 'Use in-memory rate limiting',
    queue: 'Fall back to PostgreSQL-based queue',
    cache: 'Bypass cache, direct DB queries',
  },

  // Gmail API down
  gmailApiDown: {
    sending: 'Use SMTP fallback if app password configured',
    reading: 'Increase IMAP polling frequency',
  },

  // High load
  highLoad: {
    analytics: 'Disable real-time analytics',
    warmup: 'Reduce warm-up frequency',
    tracking: 'Disable pixel tracking temporarily',
  },
};
```

---

## 8. MVP vs Full Product

### MVP (Internal Tool Level)

**Scope: 4-6 weeks for small team**

| Feature | Included | Notes |
|---------|----------|-------|
| Gmail OAuth connection | ✅ | Single provider |
| Basic campaign creation | ✅ | Single sequence, no A/B |
| Lead import (CSV) | ✅ | Basic mapping |
| Email sending with rotation | ✅ | Round-robin only |
| Manual inbox limits | ✅ | No auto-throttle |
| Basic reply detection | ✅ | Rule-based only |
| Simple dashboard | ✅ | Key metrics only |

**Not Included in MVP:**
- Microsoft/Outlook support
- Warm-up system
- A/B testing
- Advanced intent classification
- Team management
- Analytics/reporting
- Webhook integrations

### V1 SaaS

**Scope: 2-3 months additional**

| Feature | Status |
|---------|--------|
| Everything in MVP | ✅ |
| Microsoft Graph integration | ✅ |
| Warm-up system | ✅ |
| A/B testing (2 variants) | ✅ |
| Auto-throttling | ✅ |
| LLM intent classification | ✅ |
| Team management (2-3 seats) | ✅ |
| Basic analytics | ✅ |
| Webhook support | ✅ |
| Stripe billing | ✅ |

### Enterprise Features

**Scope: Additional 3-6 months**

| Feature | Description |
|---------|-------------|
| SSO (SAML/OIDC) | Enterprise auth |
| Audit logs | Compliance tracking |
| Custom domains | White-label sending |
| API access | Full REST API |
| Advanced analytics | Custom reports |
| Dedicated support | SLA guarantees |
| Custom integrations | CRM connectors |
| Multi-workspace | Agency features |
| Advanced A/B | Multiple variants + auto-winner |
| AI writing assistant | Subject/body suggestions |

---

## Appendix: Quick Reference

### Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Redis
REDIS_URL=redis://xxx

# Google OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# Microsoft OAuth
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx

# App
APP_URL=https://app.example.com
API_URL=https://api.example.com
ENCRYPTION_KEY=xxx  # For OAuth token encryption

# Optional: LLM for intent
OPENAI_API_KEY=xxx
```

### Project Structure

```
cold-email-platform/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── api/                 # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   └── workers/
│   │   └── Dockerfile
│   └── workers/             # Standalone workers
│       └── Dockerfile
├── packages/
│   ├── database/            # Supabase types & migrations
│   ├── email-client/        # Gmail/Graph/SMTP clients
│   └── shared/              # Shared types & utils
├── docker-compose.yml
├── turbo.json
└── package.json
```
