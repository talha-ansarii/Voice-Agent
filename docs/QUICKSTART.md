# Quick Start Guide

[← Documentation index](README.md)

Get the voice agent running locally in under 15 minutes.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 20+ | [nodejs.org](https://nodejs.org/) |
| LiveKit Cloud project | [cloud.livekit.io](https://cloud.livekit.io) |
| Gemini API key | Google AI Studio |
| Sarvam API key | [sarvam.ai](https://sarvam.ai) |
| Postgres (Neon) | [neon.tech](https://neon.tech) |

---

## Step 1 — Clone and install

```bash
cd "/path/to/Voice Agent"
cp .env.example .env
npm install
```

---

## Step 2 — Configure `.env`

Required variables:

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
GEMINI_API_KEY=...
SARVAM_API_KEY=...
DATABASE_URL=postgresql://...@ep-xxx....neon.tech/neondb?sslmode=require
OUTBOUND_TRUNK_ID=...
```

See `.env.example` for the full list (Vobiz SIP, Cal.com, Telegram, S3 recordings).

---

## Step 3 — Database

```bash
npx prisma migrate deploy
```

See [NEON_SETUP.md](NEON_SETUP.md) if migration fails on an existing database.

---

## Step 4 — Run services

**Terminal 1 — API (port 8000):**

```bash
npm run server:dev
```

**Terminal 2 — Agent worker:**

```bash
npm run agent:dev
```

**Terminal 3 — Dashboard (port 3000):**

```bash
npm run dashboard
```

---

## Step 5 — Test a call

```bash
npm run call -- +91XXXXXXXXXX
```

Or use the **Outbound** page at http://localhost:3000/outbound.

---

## Key files

| File | Role |
|------|------|
| `src/agent/` | LiveKit voice worker |
| `src/server/` | Express REST API |
| `frontend/` | Next.js dashboard |
| `config.json` | Prompts, models, STT/TTS settings |
| `prisma/schema.prisma` | Database models |

---

## Next steps

- [ARCHITECTURE.md](ARCHITECTURE.md) — system design
- [COOLIFY_DEPLOYMENT.md](COOLIFY_DEPLOYMENT.md) — production Docker deploy
- [transfer_call.md](transfer_call.md) — SIP transfer to a human
