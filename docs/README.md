# Documentation

All project documentation lives in this folder. The root [README.md](../README.md) is the entry point for setup and usage.

## Start here

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](QUICKSTART.md) | Step-by-step local setup |
| [ARCHITECTURE.md](ARCHITECTURE.md) | TypeScript system design, call flows, Prisma, LiveKit |
| [NEON_SETUP.md](NEON_SETUP.md) | **Database** — Neon Postgres + Prisma |
| [PRISMA_SETUP.md](PRISMA_SETUP.md) | Migrations, `DATABASE_URL` (direct Neon host) |
| [LOCAL_STARTUP_GUIDE.md](LOCAL_STARTUP_GUIDE.md) | Short local run guide and common fixes |
| [tutorial.md](tutorial.md) | **Learn to build** — step-by-step voice agent tutorial |

## Telephony and voice

| Document | Description |
|----------|-------------|
| [saravm.md](saravm.md) | Sarvam STT/TTS tuning, inbound SIP via Vobiz |
| [transfer_call.md](transfer_call.md) | SIP REFER transfer to a human agent |
| [mpconfig.md](mpconfig.md) | Post-call booking design (Cal.com after hangup) |

## Deployment

| Document | Description |
|----------|-------------|
| [COOLIFY_DEPLOYMENT.md](COOLIFY_DEPLOYMENT.md) | Hetzner CX22 + Coolify (Next :3000 public, Express private) |
| [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) | Why serverless is not suitable for the worker |

## Data and CRM

| Document | Description |
|----------|-------------|
| [SUPABASE_SETUP.md](SUPABASE_SETUP.md) | Optional call recording storage (S3) |

Database migrations: `prisma/migrations/` — run via `npx prisma migrate deploy`.

## Reference and meta

| Document | Description |
|----------|-------------|
| [SOP.md](SOP.md) | AI agent development SOP (workflow for coding agents) |

## Related files (repo root)

| File | Description |
|------|-------------|
| [.env.example](../.env.example) | Environment variable template |
| [config.json](../config.json) | Agent prompts and model settings (no secrets) |
