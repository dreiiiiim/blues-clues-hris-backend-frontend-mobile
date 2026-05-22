-- 2026-05-21_instances_table.sql
-- Tracks per-company provisioning instances created by GHA

CREATE TABLE IF NOT EXISTS instances (
  instance_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     varchar NOT NULL REFERENCES company(company_id),
  status         text NOT NULL DEFAULT 'provisioning',
  schema_name    text NOT NULL,
  access_url     text,
  error_message  text,
  gha_run_id     bigint,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instances_company_id ON instances(company_id);
