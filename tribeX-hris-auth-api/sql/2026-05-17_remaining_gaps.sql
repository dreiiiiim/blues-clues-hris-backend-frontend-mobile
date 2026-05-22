-- ============================================================
-- Remaining gap support
-- Generated: 2026-05-17
-- Covers: holidays, tenant branding
-- ============================================================

CREATE TABLE IF NOT EXISTS company_holidays (
  holiday_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR NOT NULL REFERENCES public.company(company_id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  pay_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 2.00 CHECK (pay_multiplier >= 1.00),
  allow_time_logs BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, holiday_date)
);

ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS branding_settings JSONB NOT NULL DEFAULT jsonb_build_object(
    'company_display_name', null,
    'company_logo_url', null
  );
