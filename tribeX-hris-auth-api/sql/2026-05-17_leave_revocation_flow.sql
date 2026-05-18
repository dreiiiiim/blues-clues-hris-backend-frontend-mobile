-- Add revocation_reason column for employee's stated reason when requesting revocation
ALTER TABLE time_leave_requests
  ADD COLUMN IF NOT EXISTS revocation_reason text;

-- If time_leave_requests.status has a CHECK constraint, drop and recreate to include new statuses.
-- Find constraint name: SELECT conname FROM pg_constraint WHERE conrelid = 'time_leave_requests'::regclass;
-- Then run:
--   ALTER TABLE time_leave_requests DROP CONSTRAINT <constraint_name>;
--   ALTER TABLE time_leave_requests
--     ADD CONSTRAINT time_leave_requests_status_check
--     CHECK (status IN ('Pending','Approved','Rejected','Cancelled','RevocationRequested','Revoked'));
