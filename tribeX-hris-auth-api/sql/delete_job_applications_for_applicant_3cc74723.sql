-- Delete all job application records for applicant:
-- 3cc74723-4510-4ca1-8edc-f8d45e6d90d3
--
-- Run the SELECT first to confirm the applications that will be removed.

SELECT
  application_id,
  job_posting_id,
  applicant_id,
  status,
  applied_at
FROM public.job_applications
WHERE applicant_id = '3cc74723-4510-4ca1-8edc-f8d45e6d90d3';

BEGIN;

WITH target_applications AS (
  SELECT application_id
  FROM public.job_applications
  WHERE applicant_id = '3cc74723-4510-4ca1-8edc-f8d45e6d90d3'
)
DELETE FROM public.candidate_skill_score_sfia
WHERE application_id IN (SELECT application_id FROM target_applications);

WITH target_applications AS (
  SELECT application_id
  FROM public.job_applications
  WHERE applicant_id = '3cc74723-4510-4ca1-8edc-f8d45e6d90d3'
)
DELETE FROM public.interview_schedules
WHERE application_id IN (SELECT application_id FROM target_applications);

WITH target_applications AS (
  SELECT application_id
  FROM public.job_applications
  WHERE applicant_id = '3cc74723-4510-4ca1-8edc-f8d45e6d90d3'
)
DELETE FROM public.job_application_sfia
WHERE application_id IN (SELECT application_id FROM target_applications);

DELETE FROM public.job_applications
WHERE applicant_id = '3cc74723-4510-4ca1-8edc-f8d45e6d90d3';

COMMIT;
