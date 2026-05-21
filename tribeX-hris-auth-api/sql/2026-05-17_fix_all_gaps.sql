-- ============================================================
-- HRIS Gap Fixes — Schema Migration
-- Generated: 2026-05-17
-- Covers: GAP-4.3, GAP-5.1/5.2/5.3, GAP-7.1
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- GAP-4.3 — Personal Notes field on user_profile
-- ──────────────────────────────────────────────────────────────
ALTER TABLE user_profile
  ADD COLUMN IF NOT EXISTS personal_notes TEXT;

-- ──────────────────────────────────────────────────────────────
-- GAP-5.2 — leave_config table (accrual rate + year-end rules)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_config (
  config_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        VARCHAR NOT NULL REFERENCES public.company(company_id) ON DELETE CASCADE,
  -- Accrual
  accrual_rate      NUMERIC(5, 2) NOT NULL DEFAULT 1.5,   -- days per month
  -- Year-end carry-over rule: 'RESET' | 'CARRY_ALL' | 'CARRY_CAP'
  year_end_rule     VARCHAR(20)   NOT NULL DEFAULT 'RESET'
                      CHECK (year_end_rule IN ('RESET', 'CARRY_ALL', 'CARRY_CAP')),
  carry_over_max    INT           NULL,                   -- only used when year_end_rule = 'CARRY_CAP'
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (company_id)
);

-- ──────────────────────────────────────────────────────────────
-- GAP-5.2 — leave_config_logs (override audit trail)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_config_logs (
  log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    VARCHAR     NOT NULL REFERENCES public.company(company_id) ON DELETE CASCADE,
  changed_by    UUID        NOT NULL REFERENCES user_profile(user_id),
  field_changed VARCHAR(50) NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- GAP-7.1 — category + is_custom on offboarding checklist tables
-- ──────────────────────────────────────────────────────────────
ALTER TABLE offboarding_checklist_template_items
  ADD COLUMN IF NOT EXISTS category  VARCHAR(20)
    CHECK (category IN ('Asset', 'Document', 'Task')),
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS category  VARCHAR(20)
    CHECK (category IN ('Asset', 'Document', 'Task')),
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE;

-- ──────────────────────────────────────────────────────────────
-- GAP-2.2 — Persistent Manual-Processed badge on job_application_sfia
-- ──────────────────────────────────────────────────────────────
ALTER TABLE job_application_sfia
  ADD COLUMN IF NOT EXISTS is_manually_processed BOOLEAN NOT NULL DEFAULT FALSE;

-- ──────────────────────────────────────────────────────────────
-- GAP-2.3 — Digital signature fields on job_applications
-- ──────────────────────────────────────────────────────────────
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS offer_document_url       TEXT,
  ADD COLUMN IF NOT EXISTS offer_signed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offer_signature_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- ──────────────────────────────────────────────────────────────
-- GAP-4.1 — tenant_security_config table
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_security_config (
  config_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              VARCHAR NOT NULL REFERENCES public.company(company_id) ON DELETE CASCADE,
  require_cnb_reauth      BOOLEAN NOT NULL DEFAULT FALSE,
  max_login_attempts      INT     NOT NULL DEFAULT 5,
  lockout_duration_minutes INT    NOT NULL DEFAULT 30,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id)
);

-- ──────────────────────────────────────────────────────────────
-- GAP-4.2 — Allow payroll_log to hold regular payroll bank-run entries
--   Remove NOT NULL constraint on case_id so it isn't forced to offboarding
-- ──────────────────────────────────────────────────────────────
ALTER TABLE payroll_log
  ALTER COLUMN case_id DROP NOT NULL;

-- Add a payroll_period_id FK so regular payroll runs can be linked instead
ALTER TABLE payroll_log
  ADD COLUMN IF NOT EXISTS payroll_period_id UUID
    REFERENCES public.cnb_payroll_periods(period_id) ON DELETE SET NULL;
