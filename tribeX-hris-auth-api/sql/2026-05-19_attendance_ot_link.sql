-- Links attendance_time_logs to overtime_requests.
-- Enables: REST_DAY/HOLIDAY OT auto-link on clock-in, ot_session computation,
--           auto-clock-out at approved OT end, and future HR OT reconciliation.
--
-- Apply manually via Supabase SQL editor.
-- Confirm attendance_time_logs.log_status has no CHECK constraint before running;
-- app will start writing log_status='AUTO_CLOCKED_OUT' after deploy.

BEGIN;

ALTER TABLE attendance_time_logs
  ADD COLUMN IF NOT EXISTS ot_request_id uuid
  REFERENCES overtime_requests(ot_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_ot_request
  ON attendance_time_logs(ot_request_id);

COMMIT;
