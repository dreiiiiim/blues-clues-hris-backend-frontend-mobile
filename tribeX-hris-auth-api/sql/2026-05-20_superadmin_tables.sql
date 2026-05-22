-- Super admin users (separate from HRIS user_profile)
-- IMPORTANT: id MUST equal Supabase Auth user.id (same UUID)
CREATE TABLE IF NOT EXISTS super_admin_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- Renewal reminders log (avoid duplicate sends within 24h)
CREATE TABLE IF NOT EXISTS renewal_reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES company_registrations(registration_id),
  sent_at         timestamptz NOT NULL DEFAULT NOW(),
  sent_by         uuid REFERENCES super_admin_users(id)
);

-- Super admin notification preferences
CREATE TABLE IF NOT EXISTS super_admin_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id              uuid NOT NULL REFERENCES super_admin_users(id),
  notify_new_signup     boolean NOT NULL DEFAULT true,
  notify_payment        boolean NOT NULL DEFAULT true,
  notify_renewal_due    boolean NOT NULL DEFAULT true,
  notify_expiry         boolean NOT NULL DEFAULT true,
  updated_at            timestamptz DEFAULT NOW(),
  UNIQUE (admin_id)
);

CREATE INDEX IF NOT EXISTS idx_renewal_reminders_registration
  ON renewal_reminders(registration_id);
