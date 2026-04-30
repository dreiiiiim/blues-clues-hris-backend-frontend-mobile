-- Company registrations staging table (pre-activation)
CREATE TABLE IF NOT EXISTS company_registrations (
  registration_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  address text,
  contact text,
  email text NOT NULL,
  industry text,
  nature_of_business text,
  tin text,
  business_permit_url text,
  registration_cert_url text,
  hr_org_structure text,
  subscription_plan text,
  billing_cycle text,
  payment_status text NOT NULL DEFAULT 'Pending',
  payment_date timestamptz,
  transaction_id text UNIQUE,
  subscription_status text NOT NULL DEFAULT 'Pending',
  company_id character varying REFERENCES company(company_id),
  status text NOT NULL DEFAULT 'Registered',
  registered_date timestamptz NOT NULL DEFAULT NOW()
);

-- Tenant configuration (one row per company, created at provisioning)
CREATE TABLE IF NOT EXISTS tenant_config (
  company_id character varying PRIMARY KEY REFERENCES company(company_id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Asia/Manila',
  date_format text NOT NULL DEFAULT 'MM/DD/YYYY',
  currency text NOT NULL DEFAULT 'PHP',
  org_structure jsonb,
  updated_at timestamptz DEFAULT NOW()
);

-- Tenant HR module on/off flags (one row per company per module)
CREATE TABLE IF NOT EXISTS tenant_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  module text NOT NULL,
  status text NOT NULL DEFAULT 'Active',
  UNIQUE(company_id, module)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_company_registrations_email ON company_registrations(email);
CREATE INDEX IF NOT EXISTS idx_company_registrations_payment_status ON company_registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_tenant_modules_company_id ON tenant_modules(company_id);
