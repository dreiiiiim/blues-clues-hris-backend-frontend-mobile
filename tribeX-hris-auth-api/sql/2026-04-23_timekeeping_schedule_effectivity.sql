-- Adds schedule effectivity versioning support.
-- Safe to run multiple times.

BEGIN;

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS effective_from date;

UPDATE public.schedules
SET effective_from = (timezone('Asia/Manila', now()))::date
WHERE effective_from IS NULL;

ALTER TABLE public.schedules
  ALTER COLUMN effective_from SET NOT NULL;

-- Remove legacy unique constraints that only allow one row per employee.
DO $$
DECLARE
  legacy_constraint record;
BEGIN
  FOR legacy_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    INNER JOIN pg_class t
      ON t.oid = c.conrelid
    INNER JOIN pg_namespace n
      ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'schedules'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(att.attname ORDER BY att.attnum)
        FROM unnest(c.conkey) AS col(attnum)
        INNER JOIN pg_attribute att
          ON att.attrelid = t.oid
         AND att.attnum = col.attnum
      ) = ARRAY['employee_id'::name]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS %I',
      legacy_constraint.conname
    );
  END LOOP;
END $$;

-- Ensure no duplicates remain before enforcing the new composite uniqueness.
WITH ranked AS (
  SELECT
    sched_id,
    row_number() OVER (
      PARTITION BY employee_id, effective_from
      ORDER BY updated_at DESC NULLS LAST, sched_id DESC
    ) AS rn
  FROM public.schedules
)
DELETE FROM public.schedules s
USING ranked r
WHERE s.sched_id = r.sched_id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS schedules_employee_effective_from_uidx
  ON public.schedules (employee_id, effective_from);

COMMIT;
