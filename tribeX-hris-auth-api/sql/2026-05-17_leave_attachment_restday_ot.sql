-- Add attachment_url to leave requests (for sick, maternity, paternity proof)
ALTER TABLE time_leave_requests
  ADD COLUMN IF NOT EXISTS attachment_url text;

-- Add ot_type to overtime requests (Regular OT vs Rest Day OT)
ALTER TABLE overtime_requests
  ADD COLUMN IF NOT EXISTS ot_type text NOT NULL DEFAULT 'Regular OT'
    CHECK (ot_type IN ('Regular OT', 'Rest Day OT'));

-- Note: if time_leave_requests has a CHECK constraint on leave_type,
-- drop and recreate it to include 'Maternity Leave' and 'Paternity Leave'.
-- Example (replace <constraint_name> with actual name from \d time_leave_requests):
--   ALTER TABLE time_leave_requests DROP CONSTRAINT <constraint_name>;
