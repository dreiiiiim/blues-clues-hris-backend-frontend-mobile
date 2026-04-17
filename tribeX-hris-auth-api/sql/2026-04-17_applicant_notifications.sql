-- Verification-only script (NO SCHEMA CHANGES)
--
-- Per instruction, do not modify database objects.
-- This file only verifies that the existing notifications table already matches
-- the backend implementation requirements.

-- 1) Verify table exists
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'notifications';

-- 2) Verify required columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications'
  AND column_name IN (
    'notification_id',
    'applicant_id',
    'job_posting_id',
    'message',
    'type',
    'is_read',
    'created_at'
  )
ORDER BY column_name;

-- 3) Verify FK to applicant_profile(applicant_id)
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'notifications'
  AND kcu.column_name = 'applicant_id';

-- NOTE:
-- Optional performance index reference only (do not execute if DB changes are not allowed):
-- CREATE INDEX IF NOT EXISTS idx_notifications_applicant_unread
--   ON public.notifications (applicant_id, is_read)
--   WHERE is_read = false;
