-- Add PayMongo checkout_id to company_registrations
ALTER TABLE company_registrations
  ADD COLUMN IF NOT EXISTS checkout_id TEXT;
