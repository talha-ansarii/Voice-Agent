# Vecktrix AI — Outreach Voice Agent

Outbound/inbound AI phone calls using **LiveKit Agents (TypeScript)**, **Gemini**, **Sarvam** STT/TTS, **Vobiz SIP**, and **Postgres** (Supabase) via **Prisma**.

Production (Hetzner CX22 + Coolify, ~$5–8/mo): [docs/COOLIFY_DEPLOYMENT.md](docs/COOLIFY_DEPLOYMENT.md). The worker cannot run on Vercel.

## Quick start

```bash
cp .env.example .env
# Set LIVEKIT_*, GEMINI_API_KEY, SARVAM_API_KEY, DATABASE_URL (Neon), OUTBOUND_TRUNK_ID

npm install
npx prisma migrate deploy

# Terminal 1 — API server (port 8000)
npm run server:dev

# Terminal 2 — voice agent worker
npm run agent:dev

# Terminal 3 — Next.js dashboard (port 3000)
npm run dashboard

# Outbound call
npm run call -- +91XXXXXXXXXX
```

## Project structure

```
src/
├── agent/          # LiveKit voice worker (STT / LLM / TTS / tools)
├── server/         # Express REST API (:8000)
└── lib/            # Config, Prisma, dispatch, calendar, notify

frontend/           # Next.js dashboard (:3000)
prisma/             # Schema + migrations
scripts/            # CLI utilities (make-call, setup-trunk)
config.json         # Agent prompts and model settings
```

## Stack

| Component | Path | Command |
|-----------|------|---------|
| Voice agent | `src/agent/` | `npm run agent:dev` |
| API | `src/server/` | `npm run server:dev` |
| Dashboard | `frontend/` | `npm run dashboard` |
| Outbound CLI | `scripts/make-call.ts` | `npm run call -- +91…` |

## Outreach flow

The agent pitches **Vecktrix AI** (web apps, AI automations, POCs), collects **name, email, phone, requirements**, and calls **`save_lead`** to store in Postgres. View leads in the dashboard **Leads** page.

## Environment

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `GEMINI_API_KEY`, `SARVAM_API_KEY`
- `DATABASE_URL` (Neon Postgres, **direct** host — see [docs/NEON_SETUP.md](docs/NEON_SETUP.md))
- `OUTBOUND_TRUNK_ID`, Vobiz SIP vars

See `.env.example` for the full list.

## Documentation

See [docs/README.md](docs/README.md) for architecture, deployment, and setup guides.

**New to voice agents?** Start with [docs/tutorial.md](docs/tutorial.md).
