-- Drop legacy table (incompatible schema) then create with v2 schema
DROP TABLE IF EXISTS public.overtime_requests CASCADE;

BEGIN;

CREATE TABLE IF NOT EXISTS public.overtime_requests (
  ot_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    text NOT NULL,
  ot_type        text NOT NULL CHECK (ot_type IN ('NORMAL','REST_DAY','HOLIDAY')),
  ot_date        date NOT NULL,
  start_time     time NOT NULL,
  end_time       time NOT NULL,
  planned_hours  numeric(5,2) NOT NULL,
  reason         text,
  log_status     text NOT NULL DEFAULT 'PENDING'
                   CHECK (log_status IN ('PENDING','APPROVED','DENIED')),
  latitude       double precision,
  longitude      double precision,
  ip_address     text,
  requested_by   uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  review_reason  text
);

CREATE INDEX IF NOT EXISTS overtime_requests_employee_date_idx
  ON public.overtime_requests (employee_id, ot_date, log_status);

CREATE INDEX IF NOT EXISTS overtime_requests_status_type_idx
  ON public.overtime_requests (log_status, ot_type);

COMMIT;
