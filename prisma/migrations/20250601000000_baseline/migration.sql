-- Baseline migration — aligns Postgres with prisma/schema.prisma
-- Safe to re-run (IF NOT EXISTS). Works on fresh Neon / Postgres.

-- ── call_logs (base table + analytics columns) ───────────────────────────────
CREATE TABLE IF NOT EXISTS call_logs (
    id                  BIGSERIAL PRIMARY KEY,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    phone_number        TEXT,
    duration_seconds    INTEGER,
    transcript          TEXT,
    summary             TEXT,
    recording_url       TEXT,
    caller_name         TEXT,
    sentiment           TEXT,
    estimated_cost_usd  NUMERIC(10, 5),
    call_date           DATE,
    call_hour           INTEGER,
    call_day_of_week    TEXT,
    was_booked          BOOLEAN DEFAULT FALSE,
    interrupt_count     INTEGER DEFAULT 0,
    audio_codec         TEXT,
    call_type           TEXT DEFAULT 'unknown'
);

ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sentiment           TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS estimated_cost_usd  NUMERIC(10,5);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_date           DATE;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_hour           INTEGER;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_day_of_week    TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS was_booked          BOOLEAN DEFAULT FALSE;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS interrupt_count     INTEGER DEFAULT 0;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS audio_codec         TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_type           TEXT DEFAULT 'unknown';

-- ── call_transcripts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_transcripts (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    call_room_id TEXT        NOT NULL,
    phone        TEXT,
    role         TEXT        CHECK (role IN ('user', 'assistant')),
    content      TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_transcripts_room  ON call_transcripts (call_room_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_phone ON call_transcripts (phone);

-- ── active_calls ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS active_calls (
    room_id      TEXT        PRIMARY KEY,
    phone        TEXT,
    caller_name  TEXT,
    status       TEXT        DEFAULT 'ringing',
    started_at   TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE active_calls ADD COLUMN IF NOT EXISTS call_type TEXT;
