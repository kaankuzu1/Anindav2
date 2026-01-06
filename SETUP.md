# Setup Guide

## Credential Configuration

All credentials are stored in environment variables. You'll have different `.env` files for each part of the system.

---

## 1. Environment Files Structure

```
cold-email-platform/
├── apps/
│   ├── web/
│   │   └── .env.local          # Frontend env vars
│   ├── api/
│   │   └── .env                # Backend API env vars
│   └── workers/
│       └── .env                # Workers env vars (same as API)
└── .env.example                # Template for all vars
```

---

## 2. Required Credentials & Where to Get Them

### A. Supabase (Database & Auth)

**Where to get:**

1. Go to <https://supabase.com>
2. Create a new project
3. Go to **Project Settings → API**

**Copy these values:**

```bash
# .env (backend) and .env.local (frontend)
NEXT_PUBLIC_SUPABASE_URL=https://rtbtgafvuhfcaevxxipf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0YnRnYWZ2dWhmY2Fldnh4aXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNjU0NjAsImV4cCI6MjA4MjY0MTQ2MH0.KanzsdXnboJHW3jTGDnjJrMZQiSUtJ-2cfuflbzFSak

# .env (backend only - keep secret)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0YnRnYWZ2dWhmY2Fldnh4aXBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA2NTQ2MCwiZXhwIjoyMDgyNjQxNDYwfQ.Ynk6UMay3S2AqfjZAk-SiLInrQ1gNOs8NPsVa6yzzlU
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.rtbtgafvuhfcaevxxipf.supabase.co:5432/postgres
```

---

### B. Redis (Upstash)

**Where to get:**

1. Go to <https://upstash.com>
2. Create a new Redis database
3. Go to **Database → Details**

**Copy these values:**

```bash
# .env (backend & workers)
REDIS_URL=redis://default:********@premium-stinkbug-59286.upstash.io:6379
# OR for Upstash REST API:
UPSTASH_REDIS_REST_URL=https://premium-stinkbug-59286.upstash.io
UPSTASH_REDIS_REST_TOKEN=AeeWAAIncDEzNmU3YzI5MTJhYmU0YTljYjQ3NTFkNzhhNjkyZGQ1NnAxNTkyODY
```

---

### C. Google OAuth (Gmail API)

**Where to get:**

1. Go to <https://console.cloud.google.com>
2. Create a new project (or select existing)
3. Enable these APIs:
   - Gmail API
   - Google+ API (for profile info)
4. Go to **APIs & Services → Credentials**
5. Create **OAuth 2.0 Client ID** (Web application)
6. Add authorized redirect URIs:

   ```
   http://localhost:3000/api/auth/callback/google (development)
   https://yourdomain.com/api/auth/callback/google (production)
   ```

**Copy these values:**

```bash
# .env (backend)
GOOGLE_CLIENT_ID=1092971437078-njtprkpssmhm5i9rug7oks9v0k94rgi3.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

**Required OAuth Scopes:**

```
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

---

### D. Microsoft OAuth (Outlook/Graph API)

**Where to get:**

1. Go to <https://portal.azure.com>
2. Go to **Azure Active Directory → App registrations**
3. Click **New registration**
4. Set redirect URIs:

   ```
   http://localhost:3000/api/auth/callback/microsoft (development)
   https://yourdomain.com/api/auth/callback/microsoft (production)
   ```

5. Go to **Certificates & secrets → New client secret**
6. Go to **API permissions** and add:
   - Microsoft Graph → Delegated:
     - Mail.Send
     - Mail.Read
     - Mail.ReadWrite
     - User.Read

**Copy these values:**

```bash
# .env (backend)
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxx~xxxxx
MICROSOFT_TENANT_ID=common  # or your specific tenant
```

---

### E. Encryption Key (for OAuth tokens at rest)

**Generate yourself:**

```bash
# Run this in terminal to generate a 32-byte key
openssl rand -base64 32
```

**Add to env:**

```bash
# .env (backend & workers)
ENCRYPTION_KEY=your-generated-32-byte-key-here
```

---

### F. Optional: OpenAI (for intent classification)

**Where to get:**

1. Go to <https://platform.openai.com>
2. Go to **API Keys**
3. Create new secret key

```bash
# .env (backend)
OPENAI_API_KEY=sk-xxxxx
```

---

## 3. Complete .env.example

Create this file at the root of your project:

```bash
# ===========================================
# SUPABASE
# ===========================================
```bash
# .env (backend) and .env.local (frontend)
NEXT_PUBLIC_SUPABASE_URL=https://rtbtgafvuhfcaevxxipf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0YnRnYWZ2dWhmY2Fldnh4aXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNjU0NjAsImV4cCI6MjA4MjY0MTQ2MH0.KanzsdXnboJHW3jTGDnjJrMZQiSUtJ-2cfuflbzFSak

# .env (backend only - keep secret)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0YnRnYWZ2dWhmY2Fldnh4aXBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA2NTQ2MCwiZXhwIjoyMDgyNjQxNDYwfQ.Ynk6UMay3S2AqfjZAk-SiLInrQ1gNOs8NPsVa6yzzlU
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.rtbtgafvuhfcaevxxipf.supabase.co:5432/postgres
```

# ===========================================

# REDIS (Upstash)

# ===========================================

```bash
# .env (backend & workers)
REDIS_URL=redis://default:********@premium-stinkbug-59286.upstash.io:6379
# OR for Upstash REST API:
UPSTASH_REDIS_REST_URL=https://premium-stinkbug-59286.upstash.io
UPSTASH_REDIS_REST_TOKEN=AeeWAAIncDEzNmU3YzI5MTJhYmU0YTljYjQ3NTFkNzhhNjkyZGQ1NnAxNTkyODY
```

# ===========================================

# GOOGLE OAUTH

# ===========================================

```bash
# .env (backend)
GOOGLE_CLIENT_ID=1092971437078-njtprkpssmhm5i9rug7oks9v0k94rgi3.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# ===========================================
# MICROSOFT OAUTH
# ===========================================
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxx~xxxxx
MICROSOFT_TENANT_ID=common

# ===========================================
# SECURITY
# ===========================================
ENCRYPTION_KEY=24qfBZ1kkXA1MCgZ0McfKuLA0m7vkYokUyT+VvaKDhk=
JWT_SECRET=24qfBZ1kkXA1MCgZ0McfKuLA0m7vkYokUyT+VvaKDhk=

# ===========================================
# APP CONFIG
# ===========================================
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
NODE_ENV=development

# ===========================================
# OPTIONAL: AI FEATURES
# ===========================================
OPENAI_API_KEY=sk-xxxxx

# ===========================================
# OPTIONAL: MONITORING
# ===========================================
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

---

## 4. Where Each Service Uses Credentials

| Service | Credentials Used | File Location |
|---------|------------------|---------------|
| **Next.js Frontend** | Supabase URL, Anon Key | `apps/web/.env.local` |
| **NestJS API** | All credentials | `apps/api/.env` |
| **Workers** | All except frontend-specific | `apps/workers/.env` |

---

## 5. Step-by-Step Setup Order

### Step 1: Supabase

```bash
# 1. Create project at supabase.com
# 2. Copy credentials to .env files
# 3. Run database migrations:
cd packages/database
npx supabase db push
```

### Step 2: Redis

```bash
# 1. Create Redis at upstash.com
# 2. Copy REDIS_URL to .env files
# 3. Test connection:
npx redis-cli -u $REDIS_URL ping
```

### Step 3: Google OAuth

```bash
# 1. Create OAuth app at console.cloud.google.com
# 2. Enable Gmail API
# 3. Configure redirect URIs
# 4. Copy credentials to .env
```

### Step 4: Microsoft OAuth

```bash
# 1. Create app registration at portal.azure.com
# 2. Configure API permissions
# 3. Create client secret
# 4. Copy credentials to .env
```

### Step 5: Generate Encryption Key

```bash
# Generate and add to .env
openssl rand -base64 32
```

### Step 6: Start Development

```bash
# Install dependencies
pnpm install

# Start all services
pnpm dev
```

---

## 6. Production Deployment

### Vercel (Frontend)

Add environment variables in Vercel Dashboard:

- Project → Settings → Environment Variables

### Fly.io (API & Workers)

```bash
# Set secrets via CLI
fly secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
fly secrets set GOOGLE_CLIENT_SECRET=xxx
fly secrets set MICROSOFT_CLIENT_SECRET=xxx
fly secrets set ENCRYPTION_KEY=xxx
fly secrets set REDIS_URL=xxx
```

### Railway (Alternative)

Add environment variables in Railway Dashboard:

- Project → Variables

---

## 7. Security Checklist

- [ ] Never commit `.env` files to git
- [ ] Add `.env*` to `.gitignore`
- [ ] Use different credentials for dev/staging/prod
- [ ] Rotate secrets periodically
- [ ] Use Supabase RLS for data isolation
- [ ] Encrypt OAuth tokens before storing in DB
- [ ] Use HTTPS in production

---

## 8. Testing Credentials

### Test Supabase Connection

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data, error } = await supabase.from('teams').select('*').limit(1);
console.log({ data, error });
```

### Test Redis Connection

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);
await redis.ping(); // Should return 'PONG'
```

### Test Google OAuth

```typescript
// Visit this URL in browser to test OAuth flow:
// http://localhost:3000/api/auth/google
```
