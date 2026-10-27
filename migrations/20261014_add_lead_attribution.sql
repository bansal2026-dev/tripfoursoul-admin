-- Run against PostgreSQL before deploying the application release.
-- Nullable columns keep existing lead rows and older website clients compatible.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS gbraid VARCHAR(500),
  ADD COLUMN IF NOT EXISTS wbraid VARCHAR(500),
  ADD COLUMN IF NOT EXISTS landing_page VARCHAR(2048),
  ADD COLUMN IF NOT EXISTS referrer VARCHAR(2048),
  ADD COLUMN IF NOT EXISTS lead_source VARCHAR(255);
