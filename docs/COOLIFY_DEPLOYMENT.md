# Deploy on Hetzner + Coolify (low cost)

[← Documentation index](README.md)

**Target:** Hetzner **CX22-class** (~2 vCPU / 4 GB RAM) with **Coolify self-hosted on that VPS**. About **$5–8/mo** idle. Do not use a 2 GB machine — the LiveKit worker + Express + Next.js will OOM.

One Docker container runs:

- Next.js dashboard on **port 3000** (public, HTTPS via Coolify)
- Express API on **port 8000** (localhost only — never publish it)
- LiveKit worker (`outbound-caller`)

Google login (Auth.js) lives on Next. Next proxies `/api/*` (except `/api/auth` and `/api/health`) to Express with `x-user-id` / `x-agent-id`. If you expose Express to the internet, those headers are a backdoor.

Do **not** add Next.js `rewrites` from `/api` to Express. That would steal `/api/auth/*`.

## Cost

| Item | Notes |
|------|--------|
| Hetzner CX22 + Coolify | ~$5–8/mo, always on |
| Neon Postgres | Free tier |
| LiveKit Cloud Build | Free; you host the worker so you do not pay LiveKit hosted-agent minutes |
| Google OAuth | Free |
| India outbound | Keep Vobiz; LiveKit’s free US inbound number cannot dial +91. Budget ~$0.03–0.05 per answered minute (STT/LLM/TTS/SIP) |

Optional: `RECORDING_DISABLED=1`, `TELEGRAM_DISABLED=1`.

## 1. Hetzner VPS

1. Create a CX22 (or current 2 vCPU / 4 GB equivalent). Ubuntu 24.04, **IPv4**. EU or a region near India is fine (LiveKit Cloud in India South still works from EU).
2. Point a domain **A record** at the VPS IP (e.g. `studio.example.com`).
3. SSH in and install Coolify with the [official script](https://coolify.io/docs/installation). Coolify will later issue HTTPS for your domain.

## 2. Google OAuth (production)

In Google Cloud Console, on the same OAuth client you use locally, add:

- Authorized origin: `https://studio.example.com`
- Redirect: `https://studio.example.com/api/auth/callback/google`

Keep the localhost entries for local dev.

## 3. Coolify application

1. Push this repo to GitHub/GitLab (**do not commit `.env`**).
2. Coolify → **New Resource** → Application → your repository → Dockerfile (auto-detected).
3. **Ports Exposes:** `3000` only. Do **not** publish `8000` or `8081`.
4. Domain: `https://studio.example.com` mapped to port **3000**.
5. Healthcheck (optional): `GET /api/health` on port 3000 (proxies Express `/health` inside the container).

## 4. Environment variables

Copy from local `.env`, then **override** these for production:

```
PORT=8000
EXPRESS_INTERNAL_URL=http://127.0.0.1:8000
UI_METRICS_URL=http://127.0.0.1:8000/internal/record-call
NEXT_PUBLIC_API_URL=
AUTH_URL=https://studio.example.com
AUTH_TRUST_HOST=true
AUTH_SECRET=<same 32+ byte secret as used to sign sessions>
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
DATABASE_URL=<Neon direct host, no -pooler>
# Do not set DIRECT_URL. Do not use a host that contains -pooler.
```

Also required: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `SARVAM_API_KEY`, `OUTBOUND_TRUNK_ID`, `VOBIZ_*`, `VOBIZ_OUTBOUND_NUMBER`.

On start, the entrypoint runs `npx prisma migrate deploy`, then Supervisor starts worker, Express, and Next.

## 5. Deploy and verify

1. Click **Deploy**. Logs should show Prisma migrate, LiveKit `registered worker`, Express on 8000, Next on 3000.
2. Open `https://studio.example.com` → Google sign-in.
3. Confirm a Demo agent, scoped leads, and a **browser demo** call.
4. Place one real +91 outbound from `/outbound` (same LiveKit project as the API keys; Vobiz trunk already configured).

## Local image (optional)

With Docker running:

```bash
docker build -t voice-agent:prod .
```

The image listens on **3000**. Express stays on 8000 inside the container.
