# Neon Postgres setup

[← Documentation index](README.md) · [Prisma](PRISMA_SETUP.md)

This project uses **Prisma** with **Neon** serverless Postgres for call logs, leads, and live transcripts. No Supabase account is required for the database.

Optional: call **recordings** can still use Supabase Storage or any S3-compatible bucket — see [SUPABASE_SETUP.md](SUPABASE_SETUP.md) (storage section only).

---

## 1. Create a Neon project

1. Sign up at [neon.tech](https://neon.tech)
2. **New Project** → pick a region close to your LiveKit/agent host
3. Save the generated database password

---

## 2. Copy the direct connection string

In Neon: **Dashboard → your project → Connect** → **Direct connection**.

Set a single variable. The host must **not** contain `-pooler`.

```env
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

Do not set `DIRECT_URL`. Do not use the pooled (`-pooler`) URL.

**Password tips:**

- If the password contains `@`, `#`, `!`, etc., [URL-encode](https://developer.mozilla.org/en-US/docs/Glossary/Percent-encoding) it in the connection string.
- Or reset the Neon password to alphanumeric only.

Remove any old pooled `DATABASE_URL` or `DIRECT_URL` lines.

---

## 3. Install and migrate

From the repo root:

```bash
npm install
npx prisma migrate deploy
npx prisma generate
```

**Fresh empty database?** Either command works:

```bash
npx prisma migrate deploy   # applies SQL in prisma/migrations/
# or
npx prisma db push          # syncs schema.prisma directly (dev)
```

---

## 4. Verify

```bash
npm run db:studio
```

Open **http://localhost:5555** — you should see `call_logs`, `leads`, `active_calls`, `call_transcripts`.

---

## 5. Run the app

```bash
npm run server:dev    # Terminal 1
npm run agent:dev     # Terminal 2
```

Place a test outbound call; after hangup, check `call_logs` in Studio.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Environment variable not found: DATABASE_URL` | Add `DATABASE_URL` to `.env` |
| `P1001` Can't reach database | Check `sslmode=require`; verify Neon project is active |
| `P1000` Authentication failed | Wrong password or missing URL encoding |
| Migrate fails | Use the **direct** host (no `-pooler`) |
| `relation "call_logs" does not exist` | Run `npx prisma migrate deploy` or `npx prisma db push` |

---

## What is NOT Neon

These are **optional** and unrelated to the database:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` / `SUPABASE_S3_*` | Call recording upload (LiveKit egress) |
| `SUPABASE_KEY` | Legacy; not used by Prisma in this repo |

You can leave them empty if you do not need recordings in cloud storage.
