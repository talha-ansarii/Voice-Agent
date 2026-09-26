-- Outreach leads table

CREATE TABLE IF NOT EXISTS leads (
    id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    name           TEXT,
    email          TEXT,
    phone          TEXT,
    requirements   TEXT,
    interest_level TEXT        DEFAULT 'medium',
    source         TEXT        DEFAULT 'outbound_call',
    call_room_id   TEXT,
    status         TEXT        DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
