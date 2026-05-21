BEGIN;

CREATE TABLE IF NOT EXISTS public.overtime_requests (
  ot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  ot_type text NOT NULL DEFAULT 'NORMAL',
  ot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  planned_hours numeric(5,2) NOT NULL,
  reason text,
  log_status text NOT NULL DEFAULT 'PENDING',
  latitude double precision,
  longitude double precision,
  ip_address text,
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_reason text
);

ALTER TABLE public.overtime_requests
  ADD COLUMN IF NOT EXISTS ot_type text,
  ADD COLUMN IF NOT EXISTS ot_date date,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS planned_hours numeric(5,2),
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS log_status text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reason text;

UPDATE public.overtime_requests
SET ot_type = CASE
  WHEN ot_type = 'Regular OT' THEN 'NORMAL'
  WHEN ot_type = 'Rest Day OT' THEN 'REST_DAY'
  WHEN ot_type = 'Holiday OT' THEN 'HOLIDAY'
  ELSE ot_type
END
WHERE ot_type IN ('Regular OT', 'Rest Day OT', 'Holiday OT');

ALTER TABLE public.overtime_requests
  ALTER COLUMN ot_type SET DEFAULT 'NORMAL',
  ALTER COLUMN log_status SET DEFAULT 'PENDING';

ALTER TABLE public.overtime_requests
  DROP CONSTRAINT IF EXISTS overtime_requests_ot_type_check,
  DROP CONSTRAINT IF EXISTS overtime_requests_log_status_check;

ALTER TABLE public.overtime_requests
  ADD CONSTRAINT overtime_requests_ot_type_check
    CHECK (ot_type IN ('NORMAL', 'REST_DAY', 'HOLIDAY')),
  ADD CONSTRAINT overtime_requests_log_status_check
    CHECK (log_status IN ('PENDING', 'APPROVED', 'DENIED'));

CREATE INDEX IF NOT EXISTS overtime_requests_employee_date_idx
  ON public.overtime_requests (employee_id, ot_date, log_status);

CREATE INDEX IF NOT EXISTS overtime_requests_status_type_idx
  ON public.overtime_requests (log_status, ot_type);

COMMIT;
