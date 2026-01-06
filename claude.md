# Claude.md - Cold Email Platform

## Project Overview

This is a **Cold Email SaaS Platform** (Instantly.ai clone) - a production-ready cold email sending system with multi-inbox management, warm-up automation, campaign sequencing, and deliverability protection.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui, React Query, Zustand |
| **Backend API** | NestJS (modular monolith), TypeScript |
| **Workers** | BullMQ async workers on Node.js |
| **Database** | Supabase PostgreSQL with Row Level Security |
| **Auth** | Supabase Auth (Google/Microsoft OAuth) |
| **Queue/Cache** | Upstash Redis + BullMQ |
| **Email** | Gmail API, Microsoft Graph API, Nodemailer (SMTP fallback) |
| **Package Manager** | pnpm with workspaces |
| **Build System** | Turborepo |

## Repository Structure

```
cold-email-platform/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── api/              # NestJS API server
│   └── workers/          # BullMQ async workers
├── packages/
│   ├── database/         # Supabase client, Drizzle schema
│   ├── email-client/     # Gmail/Outlook/SMTP email adapters
│   └── shared/           # Shared types, utilities
├── ARCHITECTURE.md       # Detailed system design
├── API_DEFINITIONS.md    # API endpoint specifications
├── DATA_MODELS.md        # Database schema documentation
└── SETUP.md              # Environment setup guide
```

## Common Commands

```bash
# Install dependencies
pnpm install

# Run all services in development
pnpm dev

# Run specific app
pnpm --filter @aninda/web dev
pnpm --filter @aninda/api dev
pnpm --filter @aninda/workers dev

# Database operations
pnpm db:push      # Push schema to Supabase
pnpm db:generate  # Generate types
pnpm db:studio    # Open Drizzle Studio

# Build all apps
pnpm build

# Lint all apps
pnpm lint
```

## Core Features

1. **Inbox Management** - Connect Gmail/Outlook via OAuth, configure send limits
2. **Warm-up System** - Automated inbox warming with cross-team pooling
3. **Campaign Builder** - Multi-step email sequences with A/B testing
4. **Lead Management** - CSV import, list segmentation, variable mapping
5. **Unified Inbox** - Track replies, classify intent, manage conversations
6. **Analytics** - Open rates, reply rates, bounce tracking, deliverability scores

## Architecture Principles

- **UI-first, API-driven**: All business logic configurable via dashboard
- **Stateless API**: Backend reads configuration from database
- **Async workers**: BullMQ jobs for email sending, warm-up, reply scanning
- **Rate limiting**: Per-inbox, per-domain, per-team limits via Redis
- **Circuit breakers**: Auto-pause problematic inboxes

## Environment Files

```
apps/web/.env.local       # Frontend (Supabase URL, anon key)
apps/api/.env             # Backend (all credentials)
apps/workers/.env         # Workers (same as API)
```

Required credentials: Supabase, Upstash Redis, Google OAuth, Microsoft OAuth, Encryption Key

## Key Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design, worker behavior, scaling strategy
- [API_DEFINITIONS.md](./API_DEFINITIONS.md) - REST API endpoints
- [DATA_MODELS.md](./DATA_MODELS.md) - Database schema and relationships
- [SETUP.md](./SETUP.md) - Environment setup and credentials guide
