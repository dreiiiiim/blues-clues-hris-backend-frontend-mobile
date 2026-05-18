-- ============================================================
-- Tenant payroll settings
-- Generated: 2026-05-17
-- Purpose: configurable payroll parameters for C&B/timekeeping
-- ============================================================

ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS payroll_settings JSONB NOT NULL DEFAULT jsonb_build_object(
    'working_days_per_year', 260,
    'overtime_multiplier', 1.25,
    'late_deduction_per_hour', 50,
    'night_shift_diff_multiplier', 1.10
  );
