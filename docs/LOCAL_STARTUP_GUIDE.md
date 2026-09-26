# Local Start-Up Guide

[← Documentation index](README.md) · [Prisma](PRISMA_SETUP.md) · [Architecture](ARCHITECTURE.md)

## Prerequisites

1. **Node.js 20+** — [nodejs.org](https://nodejs.org/)
2. `.env` from `.env.example` (including Neon `DATABASE_URL`, direct host)
3. Database migrated — `npx prisma migrate deploy` or [NEON_SETUP.md](NEON_SETUP.md)

---

## Step 1 — Install and migrate

```bash
cd "/path/to/Voice Agent"
cp .env.example .env
# Edit .env

npm install
npx prisma migrate deploy
```

---

## Step 2 — API server (Terminal 1)

```bash
npm run server:dev
```

Health check: [http://localhost:8000/health](http://localhost:8000/health)

If port 8000 is in use, another instance is already running or change `PORT` in `.env`.

---

## Step 3 — Agent worker (Terminal 2)

```bash
npm run agent:dev
```

Wait for LiveKit worker registration in the logs. The agent name must match your dispatch rule: **`outbound-caller`**.

---

## Step 4 — Dashboard (Terminal 3)

```bash
npm run dashboard
```

Open **[http://localhost:3000](http://localhost:3000)**.

---

## Step 5 — Test outbound

```bash
npm run call -- +91XXXXXXXXXX
```

Or use the dashboard **Outbound** tab.

---

## Demo (browser)

With the API server and agent running, open **http://localhost:8000/demo** for a WebRTC test (uses `livekit-client`).

---

## Common fixes

| Issue | Fix |
|-------|-----|
| No CRM rows after calls | Set Neon `DATABASE_URL`; run [NEON_SETUP.md](NEON_SETUP.md) |
| Outbound does not ring | `OUTBOUND_TRUNK_ID` in `.env` |
| Inbound agent silent | Dispatch rule agent = `outbound-caller` |
| `prisma migrate` fails | Apply baseline SQL in `prisma/migrations/`, then `npx prisma migrate resolve` |
