# Railway Deployment Skill

Use this skill when the user wants to deploy, manage, check status, view logs, or update environment variables on Railway. Trigger words: "railway", "deploy", "redeploy", "deployment", "railway logs", "railway status".

## Project Details

- **Project**: Aninda
- **Dashboard**: https://railway.com/project/09cd2aae-567f-42eb-864c-8b74acfffe07

| Service | ID | URL | Dockerfile |
|---------|-----|-----|------------|
| web | 870b8551-8413-4afd-a3d0-4fcf4b60a0ce | https://web-production-e1385.up.railway.app | Dockerfile.web |
| api | 934214be-dbf5-4e38-b778-3ff8f31019bf | https://api-production-06e6.up.railway.app | Dockerfile.api |
| workers | 7a5c547e-43b3-4f9c-a9a0-08d8619f93f5 | No public URL | Dockerfile.workers |
| Redis | 953182b3-4444-409d-97c6-82babba7a753 | redis.railway.internal:6379 | Railway-provisioned |

## Available Commands

### Check status of all services
```bash
echo "=== API ===" && railway service link api && railway service status --json && echo "=== WEB ===" && railway service link web && railway service status --json && echo "=== WORKERS ===" && railway service link workers && railway service status --json
```

### View logs
```bash
railway logs -s <service-name> --lines <N>
# service-name: api, web, workers, Redis
```

### Deploy all services (from local code)
```bash
railway service link api && railway up --detach
railway service link web && railway up --detach
railway service link workers && railway up --detach
```

### Deploy a single service
```bash
railway service link <service-name> && railway up --detach
```

### Set environment variables
```bash
# With auto-redeploy
railway variable set "KEY=VALUE" -s <service-name>

# Without redeploy
railway variable set "KEY=VALUE" -s <service-name> --skip-deploys
```

### List environment variables
```bash
railway variable list -s <service-name> --json
```

### Redeploy (without code changes)
```bash
railway service redeploy -s <service-name>
```

## Important Notes

1. **NEXT_PUBLIC_* vars are build-time**: If you change `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `NEXT_PUBLIC_API_URL` on the web service, it must be **rebuilt** (not just restarted). The `Dockerfile.web` has ARG declarations to handle this.

2. **Cross-service URLs**:
   - `web` has `NEXT_PUBLIC_API_URL` = `https://api-production-06e6.up.railway.app`
   - `api` has `FRONTEND_URL` = `https://web-production-e1385.up.railway.app`
   - `api` has `APP_URL` = `https://web-production-e1385.up.railway.app`
   - `api` has `API_URL` = `https://api-production-06e6.up.railway.app/api/v1`

3. **Redis**: All services use Railway-provisioned Redis at `redis://default:<password>@redis.railway.internal:6379`

4. **OAuth Redirect URIs** (must be in Google Cloud Console):
   - Google inbox connect: `https://web-production-e1385.up.railway.app/api/auth/google/callback`
   - Microsoft inbox connect: `https://api-production-06e6.up.railway.app/api/v1/auth/microsoft/callback`

5. **Deploy workflow**: Always commit and push to GitHub first, then deploy:
   ```bash
   git add <files> && git commit -m "message" && git push origin main
   railway service link <service> && railway up --detach
   ```

6. **After deploying, verify**:
   ```bash
   sleep 90 && railway service link <service> && railway service status --json
   railway logs -s <service> --lines 15
   ```
