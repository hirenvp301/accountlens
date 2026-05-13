-- AccountLens schema
-- Run in Supabase SQL editor

-- ── Sessions ────────────────────────────────────────────────────────────────
-- One row per visitor session. Updated as the pipeline progresses.
CREATE TABLE sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            TEXT NOT NULL UNIQUE,
  ip                    TEXT,
  user_agent            TEXT,
  page_url              TEXT,
  utm_source            TEXT,
  utm_campaign          TEXT,
  referrer              TEXT,

  -- Agent 01: Account Resolution
  resolved              BOOLEAN DEFAULT false,
  company_name          TEXT,
  domain                TEXT,
  industry              TEXT,
  icp_tier              INTEGER,
  open_opportunity      BOOLEAN DEFAULT false,
  opportunity_id        TEXT,
  opportunity_value     DECIMAL,
  deal_stage            TEXT,
  ae_owner              TEXT,
  salesforce_account_id TEXT,
  resolution_latency_ms INTEGER,

  -- Agent 02: Audience & Intent
  persona               TEXT,
  funnel_stage          TEXT,
  intent_score          INTEGER,
  session_depth         INTEGER DEFAULT 1,
  prior_visits          INTEGER DEFAULT 0,
  content_consumed      TEXT[],

  -- Agent 03: Content Decision
  content_source        TEXT,     -- 'authored' | 'generated' | 'default'
  variant_id            TEXT,
  content_confidence    INTEGER,
  content_payload       JSONB,

  -- Agent 04: Delivery
  holdout               BOOLEAN DEFAULT false,

  -- Pipeline state
  pipeline_status       TEXT NOT NULL DEFAULT 'pending',
  pipeline_progress     JSONB,
  pipeline_error        TEXT,

  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON sessions USING (true);

-- ── Impression Events ────────────────────────────────────────────────────────
CREATE TABLE impression_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,     -- 'impression_treatment' | 'impression_control'
  session_id      TEXT NOT NULL,
  account_id      TEXT,
  opportunity_id  TEXT,
  variant_id      TEXT,
  funnel_stage    TEXT,
  icp_tier        INTEGER,
  page_url        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE impression_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON impression_events USING (true);

-- ── AE Brief Log (24h dedup) ─────────────────────────────────────────────────
CREATE TABLE ae_brief_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     TEXT NOT NULL,
  ae_owner       TEXT,
  deal_stage     TEXT,
  brief_payload  JSONB,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ae_brief_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON ae_brief_log USING (true);

-- ── Realtime ─────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;

-- ── Updated-at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
