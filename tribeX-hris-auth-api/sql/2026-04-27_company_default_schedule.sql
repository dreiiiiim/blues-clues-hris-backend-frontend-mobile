-- Persistent company-wide default schedule for future employees.
-- This is separate from public.schedules because public.schedules is employee-scoped.

CREATE TABLE IF NOT EXISTS public.timekeeping_company_default_schedules (
  company_id character varying NOT NULL,
  workdays character varying NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  break_start time without time zone NOT NULL DEFAULT '00:00',
  break_end time without time zone NOT NULL DEFAULT '00:00',
  is_nightshift boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL,
  updated_by uuid,
  updated_by_name text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT timekeeping_company_default_schedules_pkey PRIMARY KEY (company_id),
  CONSTRAINT timekeeping_company_default_schedules_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.company(company_id),
  CONSTRAINT timekeeping_company_default_schedules_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.user_profile(user_id)
);

CREATE INDEX IF NOT EXISTS timekeeping_company_default_schedules_effective_idx
  ON public.timekeeping_company_default_schedules (company_id, effective_from);
