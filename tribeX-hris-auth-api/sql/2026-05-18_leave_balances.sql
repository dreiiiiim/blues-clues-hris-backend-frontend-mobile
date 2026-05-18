BEGIN;

CREATE TABLE IF NOT EXISTS public.leave_balance_company_defaults (
  company_id      varchar NOT NULL,
  leave_category  text NOT NULL CHECK (leave_category IN (
                    'Sick Leave','Vacation Leave','Personal Leave',
                    'Emergency Leave','Maternity Leave','Paternity Leave'
                  )),
  default_days    numeric(6,2) NOT NULL DEFAULT 0,
  updated_by      uuid,
  updated_by_name text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, leave_category)
);

CREATE TABLE IF NOT EXISTS public.employee_leave_balances (
  employee_id     text NOT NULL,
  company_id      varchar NOT NULL,
  leave_category  text NOT NULL CHECK (leave_category IN (
                    'Sick Leave','Vacation Leave','Personal Leave',
                    'Emergency Leave','Maternity Leave','Paternity Leave'
                  )),
  entitled_days   numeric(6,2) NOT NULL DEFAULT 0,
  used_days       numeric(6,2) NOT NULL DEFAULT 0,
  balance_source  text NOT NULL DEFAULT 'default'
                    CHECK (balance_source IN ('individual','bulk','default')),
  updated_by      uuid,
  updated_by_name text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, leave_category)
);

CREATE INDEX IF NOT EXISTS employee_leave_balances_company_idx
  ON public.employee_leave_balances (company_id, leave_category, balance_source);

COMMIT;
