-- Multi-role and portal support
-- Adds role assignments per user and a role-to-portal mapping table.

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profile(user_id) ON DELETE CASCADE,
  role_id character varying NOT NULL REFERENCES public.role(role_id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.user_profile(user_id),
  CONSTRAINT user_role_assignments_user_role_unique UNIQUE (user_id, role_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_one_primary_per_user
  ON public.user_role_assignments (user_id)
  WHERE is_primary = true AND is_active = true;

CREATE INDEX IF NOT EXISTS user_role_assignments_user_active_idx
  ON public.user_role_assignments (user_id, is_active);

CREATE TABLE IF NOT EXISTS public.role_portal_map (
  role_id character varying NOT NULL REFERENCES public.role(role_id) ON DELETE CASCADE,
  portal_key text NOT NULL CHECK (portal_key IN ('employee', 'hr', 'manager', 'admin', 'system-admin', 'applicant')),
  CONSTRAINT role_portal_map_pkey PRIMARY KEY (role_id, portal_key)
);

-- Backfill role assignments from existing user_profile.role_id.
INSERT INTO public.user_role_assignments (user_id, role_id, is_primary, is_active)
SELECT up.user_id, up.role_id, true, true
FROM public.user_profile up
WHERE up.role_id IS NOT NULL
ON CONFLICT (user_id, role_id) DO UPDATE
SET is_active = true,
    is_primary = EXCLUDED.is_primary;

-- Backfill role to portal mappings from existing role names.
INSERT INTO public.role_portal_map (role_id, portal_key)
SELECT r.role_id,
       CASE
         WHEN lower(trim(r.role_name)) IN ('active employee', 'employee') THEN 'employee'
         WHEN lower(trim(r.role_name)) IN ('manager', 'group head') THEN 'manager'
         WHEN lower(trim(r.role_name)) = 'admin' THEN 'admin'
         WHEN lower(trim(r.role_name)) = 'system admin' THEN 'system-admin'
         WHEN lower(trim(r.role_name)) = 'applicant' THEN 'applicant'
         ELSE 'hr'
       END AS portal_key
FROM public.role r
ON CONFLICT (role_id, portal_key) DO NOTHING;
