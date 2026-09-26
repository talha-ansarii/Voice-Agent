# Prisma + Postgres setup (Neon)

[← Documentation index](README.md) · [Neon walkthrough](NEON_SETUP.md) · [Architecture](ARCHITECTURE.md)

Prisma is already in this project (`prisma/schema.prisma`, `@prisma/client`). Set **one** Postgres URL (Neon **direct** host, no `-pooler`) and run migrations.

**Recommended host:** [Neon](https://neon.tech) — see [NEON_SETUP.md](NEON_SETUP.md) for a full walkthrough.

## 1. Install

```bash
npm install
```

## 2. Configure `.env`

```env
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

The host must **not** contain `-pooler`. Do not set `DIRECT_URL`.

Copy the template from [.env.example](../.env.example).

## 3. Apply schema

```bash
npx prisma migrate deploy
npx prisma generate
```

Development alternative:

```bash
npx prisma db push
```

Migrations live in `prisma/migrations/`:

| Migration | Tables |
|-----------|--------|
| `20250601000000_baseline` | `call_logs`, `call_transcripts`, `active_calls` |
| `20250614000000_leads` | `leads` |

## 4. Verify

```bash
npm run db:studio
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `P1000` authentication failed | Check password; URL-encode special characters |
| `Environment variable not found: DATABASE_URL` | Add `DATABASE_URL` to `.env` |
| Migrate fails | Use the **direct** Neon host (no `-pooler` in the hostname) |
| `Can't reach database server` | Neon project paused? Wrong region/host? |
| `column "call_type" does not exist` | Run `npx prisma migrate deploy` |

## Variable usage

| Variable | Used for |
|----------|----------|
| `DATABASE_URL` | Prisma Client and `prisma migrate` (direct Neon host) |
| `SUPABASE_S3_*` | Optional call recordings (not the database) |
