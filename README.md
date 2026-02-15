<div align="center">

```
    _          _           _       
   / \   _ __ (_)_ __   __| | __ _ 
  / _ \ | '_ \| | '_ \ / _` |/ _` |
 / ___ \| | | | | | | | (_| | (_| |
/_/   \_\_| |_|_|_| |_|\__,_|\__,_|
```

### Cold Email Outreach Platform

[![Next.js](https://img.shields.io/badge/Next.js-000?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org/)

</div>

---

A full-stack cold email outreach platform built for agencies and sales teams. Manage multiple inboxes, automate email warmup with AI, run A/B tested campaign sequences, and protect deliverability — all from one dashboard.

## Features

```
+---------------------+    +---------------------+    +---------------------+
|   INBOX MANAGEMENT  |    |    AI WARMUP ENGINE  |    |   CAMPAIGN BUILDER  |
|                     |    |                      |    |                     |
|  Multi-inbox setup  |    |  Auto warm-up flows  |    |  Multi-step seqs    |
|  Unified dashboard  |    |  AI-generated reply   |    |  A/B variant tests  |
|  Connection health  |    |  Reputation scoring  |    |  Smart scheduling   |
+---------------------+    +---------------------+    +---------------------+
          |                          |                          |
          +------------+-------------+-------------+------------+
                       |                           |
          +---------------------+    +---------------------+
          | TEAM COLLABORATION  |    |   DELIVERABILITY    |
          |                     |    |                     |
          |  Role-based access  |    |  Bounce detection   |
          |  Shared templates   |    |  Spam score checks  |
          |  Activity tracking  |    |  Domain monitoring  |
          +---------------------+    +---------------------+
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js, React, TypeScript, Tailwind CSS |
| **Backend** | NestJS, Node.js, BullMQ (job queues) |
| **Database** | Supabase (PostgreSQL), Row Level Security |
| **AI** | OpenRouter API for warmup & personalization |
| **Infra** | Docker-ready, background workers |

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Next.js    │────>│   NestJS     │────>│  Supabase    │
│   Frontend   │<────│   API        │<────│  PostgreSQL  │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────┴───────┐
                     │   BullMQ     │
                     │  Job Queue   │
                     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
       ┌──────┴──┐   ┌─────┴───┐   ┌─────┴────┐
       │ Warmup  │   │Campaign │   │ Bounce   │
       │ Worker  │   │ Worker  │   │ Monitor  │
       └─────────┘   └─────────┘   └──────────┘
```

## Getting Started

```bash
# Clone
git clone https://github.com/kaankuzu1/Anindav2.git
cd Anindav2

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run development server
npm run dev
```

## License

MIT
