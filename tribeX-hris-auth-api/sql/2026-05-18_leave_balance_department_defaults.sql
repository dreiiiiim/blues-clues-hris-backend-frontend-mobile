BEGIN;

CREATE TABLE IF NOT EXISTS public.leave_balance_department_defaults (
  department_id   uuid NOT NULL,
  company_id      varchar NOT NULL,
  leave_category  text NOT NULL CHECK (leave_category IN (
                    'Sick Leave','Vacation Leave','Personal Leave',
                    'Emergency Leave','Maternity Leave','Paternity Leave'
                  )),
  default_days    numeric(6,2) NOT NULL DEFAULT 0,
  updated_by      uuid,
  updated_by_name text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, leave_category)
);

CREATE INDEX IF NOT EXISTS leave_balance_department_defaults_company_idx
  ON public.leave_balance_department_defaults (company_id, department_id, leave_category);

COMMIT;
