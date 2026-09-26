-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "google_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
CREATE INDEX "idx_agents_user" ON "agents"("user_id");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "agent_id" UUID;
CREATE INDEX IF NOT EXISTS "idx_call_logs_tenant" ON "call_logs"("user_id", "agent_id");
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "call_transcripts" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "call_transcripts" ADD COLUMN IF NOT EXISTS "agent_id" UUID;
CREATE INDEX IF NOT EXISTS "idx_call_transcripts_tenant" ON "call_transcripts"("user_id", "agent_id");
ALTER TABLE "call_transcripts" ADD CONSTRAINT "call_transcripts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "call_transcripts" ADD CONSTRAINT "call_transcripts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "active_calls" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "active_calls" ADD COLUMN IF NOT EXISTS "agent_id" UUID;
CREATE INDEX IF NOT EXISTS "idx_active_calls_tenant" ON "active_calls"("user_id", "agent_id");
ALTER TABLE "active_calls" ADD CONSTRAINT "active_calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "active_calls" ADD CONSTRAINT "active_calls_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "agent_id" UUID;
CREATE INDEX IF NOT EXISTS "idx_leads_tenant" ON "leads"("user_id", "agent_id");
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
