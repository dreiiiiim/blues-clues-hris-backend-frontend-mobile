-- Persist the HR-selected checklist template on each offboarding case.
ALTER TABLE public.offboarding_cases
  ADD COLUMN IF NOT EXISTS selected_template_id uuid NULL;
