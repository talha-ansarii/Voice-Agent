# GCP VM deploy (syllabussprint@gmail.com)

## 1. Activate billing (required)

The CLI is logged in as `syllabussprint@gmail.com` and project `voice-agent-sprint` exists, but **billing is not open**. Google will not create a VM or enable Compute until you start the free trial:

1. Open [https://console.cloud.google.com/freetrial](https://console.cloud.google.com/freetrial) while signed in as **syllabussprint@gmail.com**.
2. Add a payment method. The **$300 credit** applies after billing is active.
3. Confirm billing for project `voice-agent-sprint` at [https://console.cloud.google.com/billing?project=voice-agent-sprint](https://console.cloud.google.com/billing?project=voice-agent-sprint).

Do not attach this app to `transpera-production` or other work billing accounts.

## 2. Create the VM

```bash
chmod +x scripts/gcp-create-vm.sh
./scripts/gcp-create-vm.sh
```

That creates `e2-medium` (2 vCPU / 4 GB) in `asia-south1-a`, installs Docker, and opens ports 22 / 80 / 443 / 3000.

## 3. Secrets on the VM (never in git)

SSH in, then put production env at `/opt/voice-agent/.env` (copy from local `.env`, then set):

- `AUTH_URL=https://voiceai.talhaansari.in`
- `EXPRESS_INTERNAL_URL=http://127.0.0.1:8000`
- `NEXT_PUBLIC_API_URL=` (empty)
- `AUTH_TRUST_HOST=true`
- `DATABASE_URL=` Neon **direct** URL only (no pooler, no `DIRECT_URL`)

Add the same origin and `/api/auth/callback/google` in Google Cloud OAuth.

## Domain (`voiceai.talhaansari.in`)

`talhaansari.in` DNS is Hostinger (`ns1.dns-parking.com`). In hPanel → DNS → add:

| Type | Name | Points to | TTL |
| --- | --- | --- | --- |
| A | `voiceai` | `34.14.143.249` | 300 |

Caddy on the VM terminates HTTPS and proxies to Next on localhost:3000.

## 4. GitHub Actions

Repo secrets:

- `GCP_VM_HOST` — VM public IP
- `GCP_VM_USER` — `ubuntu` (or `talha` if you change the image)
- `GCP_SSH_KEY` — private key whose public half is on the VM (`~/.ssh/authorized_keys`)

Push to `main` builds `ghcr.io/<owner>/<repo>:latest` and SSH-deploys it.

Make the GHCR package public, or keep it private (the deploy job logs in with `GITHUB_TOKEN`).
