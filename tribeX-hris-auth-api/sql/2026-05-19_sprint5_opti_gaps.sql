-- ============================================================
-- Sprint 5 Opti: Gap Closure Migration
-- 2026-05-19
-- Covers: company logo, payslip_code column, retro leave flag,
--         name capitalization trigger, retirement_benefit_rate
-- ============================================================

-- ── 1. Company logo & display name ─────────────────────────────────────────
ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS logo_url           text,
  ADD COLUMN IF NOT EXISTS display_name       character varying,
  ADD COLUMN IF NOT EXISTS primary_color      character varying DEFAULT '#2563EB',
  ADD COLUMN IF NOT EXISTS updated_at         timestamp with time zone DEFAULT now();

COMMENT ON COLUMN public.company.logo_url     IS 'Public URL of the company logo image';
COMMENT ON COLUMN public.company.display_name IS 'Tenant-customizable display name (falls back to company_name)';
COMMENT ON COLUMN public.company.primary_color IS 'Brand accent colour (hex) for white-label UI';

-- ── 2. Payslip human-readable code column ─────────────────────────────────
ALTER TABLE public.cnb_payslips
  ADD COLUMN IF NOT EXISTS payslip_code character varying GENERATED ALWAYS AS (
    'PS-' ||
    to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYYMMDD') ||
    '-' ||
    upper(right(replace(payslip_id::text, '-', ''), 6))
  ) STORED;

COMMENT ON COLUMN public.cnb_payslips.payslip_code IS 'Human-readable code, e.g. PS-20260519-AB1CD2';

-- ── 3. Retro leave flag on time_leave_requests ────────────────────────────
ALTER TABLE public.time_leave_requests
  ADD COLUMN IF NOT EXISTS is_retro        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retro_reason    text;

COMMENT ON COLUMN public.time_leave_requests.is_retro     IS 'True when the request covers dates in the past (retro-filing)';
COMMENT ON COLUMN public.time_leave_requests.retro_reason IS 'Required justification for backdated leave filing';

-- ── 4. Retirement benefit rate on company config ──────────────────────────
-- Stored in tenant_config payroll_settings JSONB — no new column needed.
-- Route /cnb/compute/retirement/:userId reads it from there.

-- ── 5. Name capitalization DB trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_capitalize_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Capitalise first letter of each space-separated word
  IF NEW.first_name IS NOT NULL THEN
    NEW.first_name := initcap(NEW.first_name);
  END IF;
  IF NEW.last_name IS NOT NULL THEN
    NEW.last_name := initcap(NEW.last_name);
  END IF;
  IF NEW.middle_name IS NOT NULL THEN
    NEW.middle_name := initcap(NEW.middle_name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capitalize_user_names ON public.user_profile;
CREATE TRIGGER trg_capitalize_user_names
  BEFORE INSERT OR UPDATE OF first_name, last_name, middle_name
  ON public.user_profile
  FOR EACH ROW EXECUTE FUNCTION public.fn_capitalize_names();

-- Same trigger for applicant_profile
CREATE OR REPLACE FUNCTION public.fn_capitalize_applicant_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.first_name IS NOT NULL THEN NEW.first_name := initcap(NEW.first_name); END IF;
  IF NEW.last_name  IS NOT NULL THEN NEW.last_name  := initcap(NEW.last_name);  END IF;
  IF NEW.middle_name IS NOT NULL THEN NEW.middle_name := initcap(NEW.middle_name); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capitalize_applicant_names ON public.applicant_profile;
CREATE TRIGGER trg_capitalize_applicant_names
  BEFORE INSERT OR UPDATE OF first_name, last_name, middle_name
  ON public.applicant_profile
  FOR EACH ROW EXECUTE FUNCTION public.fn_capitalize_applicant_names();

-- ── 6. Index for payslip lookups by year ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cnb_payslips_user_year
  ON public.cnb_payslips (user_id, company_id, created_at);

-- ── 7. Index for retro leave lookups ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leave_requests_retro
  ON public.time_leave_requests (user_id, is_retro, status);
