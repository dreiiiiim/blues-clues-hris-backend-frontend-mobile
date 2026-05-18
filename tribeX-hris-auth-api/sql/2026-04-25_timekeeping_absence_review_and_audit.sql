-- Timekeeping absence review + attendance edit audit support.
-- Safe to run multiple times.

BEGIN;

ALTER TABLE public.attendance_time_logs
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS edited_by uuid,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edit_reason text;

CREATE TABLE IF NOT EXISTS public.attendance_time_log_audits (
  audit_id uuid PRIMARY KEY,
  employee_id text NOT NULL,
  target_user_id uuid NOT NULL,
  date date NOT NULL,
  edited_by uuid NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  edit_reason text NOT NULL,
  before_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  after_payload jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS attendance_time_log_audits_employee_date_idx
  ON public.attendance_time_log_audits (employee_id, date);

CREATE INDEX IF NOT EXISTS attendance_time_log_audits_target_user_idx
  ON public.attendance_time_log_audits (target_user_id);

COMMIT;

