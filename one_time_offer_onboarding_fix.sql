-- One-time data correction: accepted offers with stale hired offers and/or missing onboarding sessions
-- Safe to run multiple times (idempotent where possible).
-- Run in Supabase SQL editor or psql against the same database used by the API.

BEGIN;

-- 1) Auto-expire other hired offers when an applicant already accepted one offer
WITH accepted AS (
  SELECT application_id, applicant_id
  FROM job_applications
  WHERE status = 'offer_accepted'
), to_expire AS (
  SELECT ja.application_id
  FROM job_applications ja
  JOIN accepted a ON a.applicant_id = ja.applicant_id
  WHERE ja.status = 'hired'
    AND ja.application_id <> a.application_id
)
UPDATE job_applications ja
SET
  status = 'offer_expired',
  offer_declined_at = COALESCE(ja.offer_declined_at, NOW())
FROM to_expire te
WHERE ja.application_id = te.application_id;

-- 2) Backfill onboarding session for accepted offers that have none yet
-- Pick template by matching department first, fallback to any template.
DO $$
DECLARE
  has_offer_status boolean;
  sql_text text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'onboarding_sessions'
      AND column_name = 'offer_status'
  ) INTO has_offer_status;

  sql_text := '
    WITH accepted_missing_session AS (
      SELECT
        ja.application_id,
        ja.applicant_id,
        ja.job_posting_id,
        jp.title AS posting_title,
        jp.department_id
      FROM job_applications ja
      JOIN job_postings jp ON jp.job_posting_id = ja.job_posting_id
      LEFT JOIN onboarding_sessions os ON os.account_id = ja.applicant_id
      WHERE ja.status = ''offer_accepted''
        AND os.session_id IS NULL
    ), picked_template AS (
      SELECT
        ams.*,
        COALESCE(t_dept.template_id, t_any.template_id) AS template_id,
        COALESCE(t_dept.default_deadline_days, t_any.default_deadline_days, 14) AS default_deadline_days
      FROM accepted_missing_session ams
      LEFT JOIN LATERAL (
        SELECT ot.template_id, ot.default_deadline_days
        FROM onboarding_templates ot
        WHERE ot.department_id = ams.department_id
        ORDER BY ot.created_at DESC NULLS LAST
        LIMIT 1
      ) t_dept ON TRUE
      LEFT JOIN LATERAL (
        SELECT ot.template_id, ot.default_deadline_days
        FROM onboarding_templates ot
        ORDER BY ot.created_at DESC NULLS LAST
        LIMIT 1
      ) t_any ON TRUE
    ), inserted_sessions AS (
      INSERT INTO onboarding_sessions (
        session_id,
        account_id,
        template_id,
        assigned_position,
        assigned_department,
        status,
        progress_percentage,
        deadline_date';

  IF has_offer_status THEN
    sql_text := sql_text || ', offer_status';
  END IF;

  sql_text := sql_text || '
      )
      SELECT
        gen_random_uuid(),
        pt.applicant_id,
        pt.template_id,
        COALESCE(pt.posting_title, ''New Hire''),
        COALESCE(d.department_name, ''General''),
        ''not-started'',
        0,
        (NOW() + (COALESCE(pt.default_deadline_days, 14) || '' days'')::interval)::date';

  IF has_offer_status THEN
    sql_text := sql_text || ', ''pending''';
  END IF;

  sql_text := sql_text || '
      FROM picked_template pt
      LEFT JOIN department d ON d.department_id = pt.department_id
      WHERE pt.template_id IS NOT NULL
      RETURNING session_id, account_id, template_id
    )
    INSERT INTO onboarding_items (
      onboarding_item_id,
      session_id,
      template_item_id,
      status,
      is_requested,
      delivery_method
    )
    SELECT
      gen_random_uuid(),
      s.session_id,
      ti.item_id,
      ''pending'',
      NULL,
      NULL
    FROM inserted_sessions s
    JOIN template_items ti ON ti.template_id = s.template_id';

  EXECUTE sql_text;
END $$;

-- 3) Ensure applicant profile reflects onboarding once accepted
UPDATE applicant_profile ap
SET status = 'onboarding'
WHERE ap.applicant_id IN (
  SELECT DISTINCT applicant_id
  FROM job_applications
  WHERE status = 'offer_accepted'
)
AND COALESCE(ap.status, '') <> 'converted_employee';

COMMIT;

-- Optional verification queries:
-- A) Accepted applicants still having hired offers (should return 0 rows)
-- SELECT a.applicant_id, COUNT(*) AS hired_count
-- FROM job_applications h
-- JOIN job_applications a ON a.applicant_id = h.applicant_id AND a.status = 'offer_accepted'
-- WHERE h.status = 'hired'
-- GROUP BY a.applicant_id;

-- B) Accepted applicants missing onboarding session (should return 0 rows)
-- SELECT ja.application_id, ja.applicant_id
-- FROM job_applications ja
-- LEFT JOIN onboarding_sessions os ON os.account_id = ja.applicant_id
-- WHERE ja.status = 'offer_accepted' AND os.session_id IS NULL;
