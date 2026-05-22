-- ============================================================
-- Offboarding template customization
-- Generated: 2026-05-17
-- Purpose: richer system-admin template configuration
-- ============================================================

ALTER TABLE offboarding_checklist_templates
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS applicable_offboarding_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_knowledge_transfer BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS system_access_to_revoke JSONB NOT NULL DEFAULT '[]'::jsonb;
