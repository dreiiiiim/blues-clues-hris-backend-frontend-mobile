-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_audit_logs (
  log_id character varying NOT NULL DEFAULT (gen_random_uuid())::character varying,
  action character varying NOT NULL,
  performed_by uuid,
  target_user_id uuid,
  timestamp timestamp with time zone DEFAULT now(),
  company_id character varying,
  severity character varying NOT NULL DEFAULT 'INFO'::character varying,
  ip_address character varying,
  CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT admin_audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.user_profile(user_id),
  CONSTRAINT admin_audit_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.user_profile(user_id),
  CONSTRAINT admin_audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.applicant_answers (
  answer_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  question_id uuid NOT NULL,
  answer_value text,
  CONSTRAINT applicant_answers_pkey PRIMARY KEY (answer_id),
  CONSTRAINT applicant_answers_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_applications(application_id),
  CONSTRAINT applicant_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.application_questions(question_id)
);
CREATE TABLE public.applicant_profile (
  applicant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  password_hash character varying,
  role character varying NOT NULL DEFAULT 'Applicant'::character varying,
  status character varying NOT NULL DEFAULT 'unverified'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'unverified'::character varying, 'onboarding'::character varying, 'converted_employee'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  phone_number character varying,
  applicant_code character varying UNIQUE,
  company_id character varying,
  middle_name character varying,
  personal_email character varying,
  date_of_birth date,
  place_of_birth character varying,
  nationality character varying,
  civil_status character varying,
  complete_address text,
  resume_url text,
  resume_name text,
  resume_uploaded_at timestamp with time zone,
  avatar_url text,
  CONSTRAINT applicant_profile_pkey PRIMARY KEY (applicant_id),
  CONSTRAINT applicant_profile_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.applicant_refresh_session (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT applicant_refresh_session_pkey PRIMARY KEY (id),
  CONSTRAINT applicant_refresh_session_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicant_profile(applicant_id)
);
CREATE TABLE public.application_questions (
  question_id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type = ANY (ARRAY['text'::text, 'multiple_choice'::text, 'checkbox'::text])),
  options jsonb,
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT application_questions_pkey PRIMARY KEY (question_id),
  CONSTRAINT application_questions_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(job_posting_id)
);
CREATE TABLE public.attendance_time_log_audits (
  audit_id uuid NOT NULL,
  employee_id text NOT NULL,
  target_user_id uuid NOT NULL,
  date date NOT NULL,
  edited_by uuid NOT NULL,
  edited_at timestamp with time zone NOT NULL DEFAULT now(),
  edit_reason text NOT NULL,
  before_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  after_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT attendance_time_log_audits_pkey PRIMARY KEY (audit_id)
);
CREATE TABLE public.attendance_time_logs (
  log_id character varying NOT NULL,
  employee_id character varying,
  schedule_id character varying,
  log_type character varying,
  timestamp timestamp without time zone,
  latitude numeric,
  longitude numeric,
  ip_address character varying,
  is_mock_location boolean,
  clock_type character varying,
  status character varying,
  log_status character varying,
  absence_reason text,
  absence_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_reason text,
  edited_by uuid,
  edited_at timestamp with time zone,
  edit_reason text,
  ot_request_id uuid,
  CONSTRAINT attendance_time_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT attendance_time_logs_ot_request_id_fkey FOREIGN KEY (ot_request_id) REFERENCES public.overtime_requests(ot_id)
);
CREATE TABLE public.candidate_skill_score_sfia (
  candidate_skill_score_sfia_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid,
  skill_id uuid,
  candidate_level integer NOT NULL CHECK (candidate_level >= 1 AND candidate_level <= 7),
  match_score numeric,
  CONSTRAINT candidate_skill_score_sfia_pkey PRIMARY KEY (candidate_skill_score_sfia_id),
  CONSTRAINT candidate_skill_score_sfia_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_application_sfia(application_id),
  CONSTRAINT candidate_skill_score_sfia_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.sfia_skills(skill_id)
);
CREATE TABLE public.checklist_items (
  item_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  item_name character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'Pending'::character varying,
  cleared_by_id uuid,
  cleared_at timestamp with time zone,
  category character varying CHECK (category::text = ANY (ARRAY['Asset'::character varying, 'Document'::character varying, 'Task'::character varying]::text[])),
  is_custom boolean NOT NULL DEFAULT false,
  CONSTRAINT checklist_items_pkey PRIMARY KEY (item_id),
  CONSTRAINT checklist_items_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.offboarding_cases(case_id),
  CONSTRAINT checklist_items_cleared_by_id_fkey FOREIGN KEY (cleared_by_id) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.clearance_documents (
  document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  document_type character varying NOT NULL,
  document_name character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'Pending'::character varying,
  released_by uuid,
  released_at timestamp with time zone,
  notes text,
  CONSTRAINT clearance_documents_pkey PRIMARY KEY (document_id),
  CONSTRAINT clearance_documents_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.offboarding_cases(case_id),
  CONSTRAINT clearance_documents_released_by_fkey FOREIGN KEY (released_by) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.cnb_audit_trail (
  audit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  actor_id uuid NOT NULL,
  action_type character varying NOT NULL,
  target_table character varying NOT NULL,
  target_record_id uuid,
  old_value text,
  new_value text,
  ip_address character varying,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cnb_audit_trail_pkey PRIMARY KEY (audit_id)
);
CREATE TABLE public.cnb_benefits_catalog (
  benefit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  benefit_name character varying NOT NULL,
  benefit_type character varying NOT NULL,
  taxable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  default_amount numeric NOT NULL DEFAULT 0.00,
  CONSTRAINT cnb_benefits_catalog_pkey PRIMARY KEY (benefit_id)
);
CREATE TABLE public.cnb_employee_benefits (
  mapping_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  benefit_id uuid NOT NULL,
  amount text NOT NULL,
  effective_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cnb_employee_benefits_pkey PRIMARY KEY (mapping_id),
  CONSTRAINT cnb_employee_benefits_benefit_id_fkey FOREIGN KEY (benefit_id) REFERENCES public.cnb_benefits_catalog(benefit_id)
);
CREATE TABLE public.cnb_payroll_periods (
  period_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  cutoff_start_date date NOT NULL,
  cutoff_end_date date NOT NULL,
  payout_date date NOT NULL,
  status character varying NOT NULL DEFAULT 'Draft'::character varying,
  processed_by uuid,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cnb_payroll_periods_pkey PRIMARY KEY (period_id)
);
CREATE TABLE public.cnb_payslips (
  payslip_id uuid NOT NULL DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL,
  user_id uuid NOT NULL,
  company_id character varying NOT NULL,
  basic_pay_earned text NOT NULL,
  total_allowances text NOT NULL,
  gross_pay text NOT NULL,
  tax_deduction text NOT NULL,
  statutory_deductions text NOT NULL,
  other_deductions text,
  total_deductions text NOT NULL,
  net_pay text NOT NULL,
  status character varying NOT NULL DEFAULT 'Pending Review'::character varying,
  employee_ack_status character varying NOT NULL DEFAULT 'Pending'::character varying,
  acknowledged_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cnb_payslips_pkey PRIMARY KEY (payslip_id),
  CONSTRAINT cnb_payslips_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.cnb_payroll_periods(period_id)
);
CREATE TABLE public.cnb_salary_baselines (
  baseline_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id character varying NOT NULL,
  pay_frequency character varying NOT NULL,
  basic_salary text NOT NULL,
  effective_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cnb_salary_baselines_pkey PRIMARY KEY (baseline_id)
);
CREATE TABLE public.cnb_statutory_deduction_defaults (
  config_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL UNIQUE,
  sss_type character varying NOT NULL DEFAULT 'percentage'::character varying CHECK (sss_type::text = ANY (ARRAY['percentage'::character varying, 'fixed_amount'::character varying]::text[])),
  sss_value numeric NOT NULL DEFAULT 4.5 CHECK (sss_value >= 0::numeric),
  philhealth_type character varying NOT NULL DEFAULT 'percentage'::character varying CHECK (philhealth_type::text = ANY (ARRAY['percentage'::character varying, 'fixed_amount'::character varying]::text[])),
  philhealth_value numeric NOT NULL DEFAULT 2.5 CHECK (philhealth_value >= 0::numeric),
  pagibig_type character varying NOT NULL DEFAULT 'percentage'::character varying CHECK (pagibig_type::text = ANY (ARRAY['percentage'::character varying, 'fixed_amount'::character varying]::text[])),
  pagibig_value numeric NOT NULL DEFAULT 2.0 CHECK (pagibig_value >= 0::numeric),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cnb_statutory_deduction_defaults_pkey PRIMARY KEY (config_id),
  CONSTRAINT cnb_statutory_deduction_defaults_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.cnb_statutory_ids (
  statutory_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id character varying NOT NULL,
  tin_number text,
  sss_number text,
  philhealth_number text,
  pagibig_number text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cnb_statutory_ids_pkey PRIMARY KEY (statutory_id)
);
CREATE TABLE public.cnb_tax_brackets (
  bracket_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  effective_year integer NOT NULL,
  min_salary numeric NOT NULL,
  max_salary numeric NOT NULL,
  base_tax_amount numeric NOT NULL,
  excess_percentage numeric NOT NULL,
  CONSTRAINT cnb_tax_brackets_pkey PRIMARY KEY (bracket_id)
);
CREATE TABLE public.company (
  company_id character varying NOT NULL,
  company_name character varying NOT NULL,
  subscription_status character varying NOT NULL DEFAULT 'Active'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  subscription_duration character varying NOT NULL DEFAULT 'monthly'::character varying,
  slug character varying UNIQUE,
  CONSTRAINT company_pkey PRIMARY KEY (company_id)
);
CREATE TABLE public.company_holidays (
  holiday_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  holiday_date date NOT NULL,
  holiday_name text NOT NULL,
  pay_multiplier numeric NOT NULL DEFAULT 2.00 CHECK (pay_multiplier >= 1.00),
  allow_time_logs boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_holidays_pkey PRIMARY KEY (holiday_id),
  CONSTRAINT company_holidays_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.company_registrations (
  registration_id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  payment_status text NOT NULL DEFAULT 'Pending'::text,
  payment_date timestamp with time zone,
  transaction_id text UNIQUE,
  subscription_status text NOT NULL DEFAULT 'Pending'::text,
  company_id character varying,
  status text NOT NULL DEFAULT 'Registered'::text,
  registered_date timestamp with time zone NOT NULL DEFAULT now(),
  checkout_id text,
  CONSTRAINT company_registrations_pkey PRIMARY KEY (registration_id),
  CONSTRAINT company_registrations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.department (
  department_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  department_name character varying NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT department_pkey PRIMARY KEY (department_id),
  CONSTRAINT department_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.document_replacement_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  new_file_url text NOT NULL,
  new_file_path text,
  reason text NOT NULL,
  proof_url text,
  status text NOT NULL DEFAULT 'pending'::text,
  hr_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT document_replacement_requests_pkey PRIMARY KEY (id),
  CONSTRAINT document_replacement_requests_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.employee_documents(id)
);
CREATE TABLE public.email_verifications (
  verification_id character varying NOT NULL DEFAULT (gen_random_uuid())::character varying,
  applicant_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  used_at timestamp with time zone,
  CONSTRAINT email_verifications_pkey PRIMARY KEY (verification_id),
  CONSTRAINT email_verifications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicant_profile(applicant_id)
);
CREATE TABLE public.employee_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  status text NOT NULL DEFAULT 'pending'::text,
  hr_notes text,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  CONSTRAINT employee_documents_pkey PRIMARY KEY (id),
  CONSTRAINT employee_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile(user_id),
  CONSTRAINT employee_documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.employee_id_sequence (
  company_id character varying NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  CONSTRAINT employee_id_sequence_pkey PRIMARY KEY (company_id),
  CONSTRAINT employee_id_sequence_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.employee_leave_balances (
  employee_id text NOT NULL,
  company_id character varying NOT NULL,
  leave_category text NOT NULL CHECK (leave_category = ANY (ARRAY['Sick Leave'::text, 'Vacation Leave'::text, 'Personal Leave'::text, 'Emergency Leave'::text, 'Maternity Leave'::text, 'Paternity Leave'::text])),
  entitled_days numeric NOT NULL DEFAULT 0,
  used_days numeric NOT NULL DEFAULT 0,
  balance_source text NOT NULL DEFAULT 'default'::text CHECK (balance_source = ANY (ARRAY['individual'::text, 'bulk'::text, 'default'::text])),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (employee_id, leave_category)
);
CREATE TABLE public.employee_staging (
  profile_id uuid NOT NULL,
  session_id uuid NOT NULL,
  first_name character varying NOT NULL,
  middle_name character varying,
  last_name character varying NOT NULL,
  email_address character varying NOT NULL,
  phone_number character varying NOT NULL,
  complete_address character varying NOT NULL,
  date_of_birth date NOT NULL,
  place_of_birth character varying NOT NULL,
  nationality character varying NOT NULL,
  civil_status character varying NOT NULL,
  contact_name character varying NOT NULL,
  relationship character varying NOT NULL,
  emergency_phone_number character varying NOT NULL,
  emergency_email_address character varying,
  status character varying NOT NULL,
  emergency_contacts jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT employee_staging_pkey PRIMARY KEY (profile_id),
  CONSTRAINT employee_staging_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.onboarding_sessions(session_id)
);
CREATE TABLE public.feature (
  feature_id character varying NOT NULL,
  feature_name character varying NOT NULL UNIQUE,
  description character varying,
  module_group character varying NOT NULL,
  is_active boolean DEFAULT true,
  CONSTRAINT feature_pkey PRIMARY KEY (feature_id)
);
CREATE TABLE public.final_pay (
  pay_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  salary_balance numeric NOT NULL DEFAULT 0.00,
  leave_encashment numeric NOT NULL DEFAULT 0.00,
  additional_pay numeric NOT NULL DEFAULT 0.00,
  deductions numeric NOT NULL DEFAULT 0.00,
  total_amount numeric NOT NULL DEFAULT 0.00,
  status character varying NOT NULL DEFAULT 'Payment Pending'::character varying,
  transfer_confirmed_at timestamp with time zone,
  CONSTRAINT final_pay_pkey PRIMARY KEY (pay_id),
  CONSTRAINT final_pay_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.offboarding_cases(case_id)
);
CREATE TABLE public.interview_schedules (
  schedule_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  company_id character varying NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time without time zone NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  format text NOT NULL CHECK (format = ANY (ARRAY['in_person'::text, 'video'::text, 'phone'::text])),
  location text,
  meeting_link text,
  interviewer_name text NOT NULL,
  interviewer_title text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  scheduled_by_email character varying,
  applicant_response character varying CHECK (applicant_response::text = ANY (ARRAY['accepted'::character varying, 'declined'::character varying, 'reschedule_requested'::character varying]::text[])),
  applicant_response_note text,
  applicant_responded_at timestamp with time zone,
  stage text NOT NULL DEFAULT 'first_interview'::text,
  CONSTRAINT interview_schedules_pkey PRIMARY KEY (schedule_id),
  CONSTRAINT interview_schedules_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_applications(application_id),
  CONSTRAINT interview_schedules_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.job_application_sfia (
  application_id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL,
  applicant_id uuid NOT NULL,
  status character varying DEFAULT 'SUBMITTED'::character varying,
  application_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  pre_screening_score numeric,
  sfia_matching_percentage numeric,
  manual_rank_position integer,
  ranking_mode character varying DEFAULT 'SFIA'::character varying,
  is_manually_processed boolean NOT NULL DEFAULT false,
  CONSTRAINT job_application_sfia_pkey PRIMARY KEY (application_id)
);
CREATE TABLE public.job_applications (
  application_id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL,
  applicant_id uuid NOT NULL,
  status character varying NOT NULL DEFAULT 'submitted'::character varying,
  applied_at timestamp with time zone DEFAULT now(),
  offer_accepted_at timestamp with time zone,
  offer_document_url text,
  offer_signed_at timestamp with time zone,
  offer_signature_verified boolean NOT NULL DEFAULT false,
  CONSTRAINT job_applications_pkey PRIMARY KEY (application_id),
  CONSTRAINT job_applications_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(job_posting_id),
  CONSTRAINT job_applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicant_profile(applicant_id)
);
CREATE TABLE public.job_positions (
  position_id uuid NOT NULL DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL,
  position_name character varying NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_positions_pkey PRIMARY KEY (position_id),
  CONSTRAINT job_positions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(department_id)
);
CREATE TABLE public.job_posting_sfia_skill (
  job_posting_skills_id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL,
  skill_id uuid,
  required_level integer NOT NULL CHECK (required_level >= 1 AND required_level <= 7),
  weight numeric DEFAULT 1.0,
  CONSTRAINT job_posting_sfia_skill_pkey PRIMARY KEY (job_posting_skills_id),
  CONSTRAINT job_posting_sfia_skill_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.sfia_skills(skill_id)
);
CREATE TABLE public.job_postings (
  job_posting_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  department_id uuid,
  title character varying NOT NULL,
  description text,
  location character varying,
  employment_type character varying,
  salary_range character varying,
  status character varying NOT NULL DEFAULT 'open'::character varying,
  posted_at timestamp with time zone DEFAULT now(),
  closes_at timestamp with time zone,
  CONSTRAINT job_postings_pkey PRIMARY KEY (job_posting_id),
  CONSTRAINT job_postings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id),
  CONSTRAINT job_postings_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(department_id)
);
CREATE TABLE public.knowledge_transfer (
  kt_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  transfer_notes text,
  status character varying NOT NULL DEFAULT 'Pending Manager Sign-Off'::character varying,
  signed_off_by_id uuid,
  signed_off_at timestamp with time zone,
  CONSTRAINT knowledge_transfer_pkey PRIMARY KEY (kt_id),
  CONSTRAINT knowledge_transfer_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.offboarding_cases(case_id),
  CONSTRAINT knowledge_transfer_signed_off_by_id_fkey FOREIGN KEY (signed_off_by_id) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.leave_balance_company_defaults (
  company_id character varying NOT NULL,
  leave_category text NOT NULL CHECK (leave_category = ANY (ARRAY['Sick Leave'::text, 'Vacation Leave'::text, 'Personal Leave'::text, 'Emergency Leave'::text, 'Maternity Leave'::text, 'Paternity Leave'::text])),
  default_days numeric NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_by_name text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leave_balance_company_defaults_pkey PRIMARY KEY (company_id, leave_category)
);
CREATE TABLE public.leave_balance_department_defaults (
  department_id uuid NOT NULL,
  company_id character varying NOT NULL,
  leave_category text NOT NULL CHECK (leave_category = ANY (ARRAY['Sick Leave'::text, 'Vacation Leave'::text, 'Personal Leave'::text, 'Emergency Leave'::text, 'Maternity Leave'::text, 'Paternity Leave'::text])),
  default_days numeric NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_by_name text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leave_balance_department_defaults_pkey PRIMARY KEY (department_id, leave_category)
);
CREATE TABLE public.leave_config (
  config_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL UNIQUE,
  accrual_rate numeric NOT NULL DEFAULT 1.5,
  year_end_rule character varying NOT NULL DEFAULT 'RESET'::character varying CHECK (year_end_rule::text = ANY (ARRAY['RESET'::character varying, 'CARRY_ALL'::character varying, 'CARRY_CAP'::character varying]::text[])),
  carry_over_max integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leave_config_pkey PRIMARY KEY (config_id),
  CONSTRAINT leave_config_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.leave_config_logs (
  log_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  changed_by uuid NOT NULL,
  field_changed character varying NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leave_config_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT leave_config_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id),
  CONSTRAINT leave_config_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.login_history (
  login_id character varying NOT NULL,
  role_id character varying,
  user_id uuid,
  li_timestamp timestamp with time zone DEFAULT now(),
  ip_address character varying,
  status character varying NOT NULL,
  browser_info character varying,
  CONSTRAINT login_history_pkey PRIMARY KEY (login_id),
  CONSTRAINT login_history_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(role_id)
);
CREATE TABLE public.logout_history (
  logout_id character varying NOT NULL,
  login_id character varying,
  role_id character varying,
  user_id uuid,
  session_id character varying,
  lo_timestamp timestamp with time zone DEFAULT now(),
  ip_address character varying,
  browser_info character varying,
  CONSTRAINT logout_history_pkey PRIMARY KEY (logout_id),
  CONSTRAINT logout_history_login_id_fkey FOREIGN KEY (login_id) REFERENCES public.login_history(login_id),
  CONSTRAINT logout_history_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(role_id)
);
CREATE TABLE public.manual_ranking_history (
  history_id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid,
  performed_by uuid NOT NULL,
  previous_rank integer,
  new_rank integer NOT NULL,
  changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT manual_ranking_history_pkey PRIMARY KEY (history_id),
  CONSTRAINT manual_ranking_history_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_application_sfia(application_id)
);
CREATE TABLE public.notifications (
  notification_id uuid NOT NULL DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  job_posting_id uuid,
  message text NOT NULL,
  type character varying NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (notification_id)
);
CREATE TABLE public.off_resignation_requests (
  resignation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id character varying NOT NULL,
  submission_date timestamp with time zone NOT NULL DEFAULT now(),
  proposed_last_day date NOT NULL,
  approved_last_day date,
  reason_category character varying NOT NULL,
  reason_notes text,
  status character varying NOT NULL DEFAULT 'Pending HR Review'::character varying,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  clearance_status character varying NOT NULL DEFAULT 'Pending'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT off_resignation_requests_pkey PRIMARY KEY (resignation_id)
);
CREATE TABLE public.offboarding_cases (
  case_id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  initiated_by_id uuid NOT NULL,
  offboarding_type character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'Submitted'::character varying,
  last_working_day date NOT NULL,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT offboarding_cases_pkey PRIMARY KEY (case_id),
  CONSTRAINT offboarding_cases_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.user_profile(user_id),
  CONSTRAINT offboarding_cases_initiated_by_id_fkey FOREIGN KEY (initiated_by_id) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.offboarding_checklist_template_items (
  item_id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  item_name character varying NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT true,
  category character varying CHECK (category::text = ANY (ARRAY['Asset'::character varying, 'Document'::character varying, 'Task'::character varying]::text[])),
  is_custom boolean NOT NULL DEFAULT false,
  CONSTRAINT offboarding_checklist_template_items_pkey PRIMARY KEY (item_id),
  CONSTRAINT offboarding_checklist_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.offboarding_checklist_templates(template_id)
);
CREATE TABLE public.offboarding_checklist_templates (
  template_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  template_name character varying NOT NULL,
  employee_type character varying,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  description text,
  applicable_offboarding_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  require_knowledge_transfer boolean NOT NULL DEFAULT true,
  system_access_to_revoke jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT offboarding_checklist_templates_pkey PRIMARY KEY (template_id),
  CONSTRAINT offboarding_checklist_templates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id),
  CONSTRAINT offboarding_checklist_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.offboarding_vacant_positions (
  vacant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  department_id uuid,
  company_id character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'Pending Review'::character varying,
  job_posting_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT offboarding_vacant_positions_pkey PRIMARY KEY (vacant_id),
  CONSTRAINT offboarding_vacant_positions_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.offboarding_cases(case_id),
  CONSTRAINT offboarding_vacant_positions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.user_profile(user_id),
  CONSTRAINT offboarding_vacant_positions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(department_id),
  CONSTRAINT offboarding_vacant_positions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id),
  CONSTRAINT offboarding_vacant_positions_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(job_posting_id)
);
CREATE TABLE public.onboarding_documents (
  submission_id uuid NOT NULL,
  onboarding_item_id uuid NOT NULL,
  file_url text NOT NULL,
  file_name character varying NOT NULL,
  file_size_bytes integer NOT NULL,
  file_type character varying NOT NULL,
  is_proof_of_receipt boolean NOT NULL,
  status character varying NOT NULL,
  uploaded_at timestamp without time zone NOT NULL,
  file_path text,
  CONSTRAINT onboarding_documents_pkey PRIMARY KEY (submission_id),
  CONSTRAINT document_submissions_onboarding_item_id_fkey FOREIGN KEY (onboarding_item_id) REFERENCES public.onboarding_items(onboarding_item_id)
);
CREATE TABLE public.onboarding_items (
  onboarding_item_id uuid NOT NULL,
  session_id uuid NOT NULL,
  template_item_id uuid NOT NULL,
  status character varying NOT NULL,
  is_requested boolean,
  delivery_method character varying,
  delivery_address text,
  CONSTRAINT onboarding_items_pkey PRIMARY KEY (onboarding_item_id),
  CONSTRAINT onboarding_items_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.onboarding_sessions(session_id),
  CONSTRAINT onboarding_items_template_item_id_fkey FOREIGN KEY (template_item_id) REFERENCES public.template_items(item_id)
);
CREATE TABLE public.onboarding_remarks (
  remark_id uuid NOT NULL,
  session_id uuid NOT NULL,
  author_id uuid NOT NULL,
  tab_tag character varying NOT NULL,
  remark_text text NOT NULL,
  created_at timestamp without time zone NOT NULL,
  CONSTRAINT onboarding_remarks_pkey PRIMARY KEY (remark_id),
  CONSTRAINT onboarding_remarks_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.onboarding_sessions(session_id)
);
CREATE TABLE public.onboarding_sessions (
  session_id uuid NOT NULL,
  account_id uuid NOT NULL,
  template_id uuid NOT NULL,
  assigned_position character varying NOT NULL,
  assigned_department character varying NOT NULL,
  status character varying NOT NULL,
  progress_percentage integer NOT NULL,
  deadline_date date NOT NULL,
  completed_at timestamp without time zone,
  CONSTRAINT onboarding_sessions_pkey PRIMARY KEY (session_id),
  CONSTRAINT onboarding_sessions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.onboarding_templates(template_id)
);
CREATE TABLE public.onboarding_submissions (
  submission_id uuid NOT NULL DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  application_id uuid NOT NULL,
  job_posting_id uuid NOT NULL,
  company_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text])),
  first_name text,
  last_name text,
  phone text,
  address text,
  date_of_birth date,
  nationality text,
  civil_status text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  preferred_username text,
  department_id uuid,
  start_date date,
  hr_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  submitted_at timestamp with time zone,
  created_user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_submissions_pkey PRIMARY KEY (submission_id),
  CONSTRAINT onboarding_submissions_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicant_profile(applicant_id),
  CONSTRAINT onboarding_submissions_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_applications(application_id),
  CONSTRAINT onboarding_submissions_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(job_posting_id),
  CONSTRAINT onboarding_submissions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(department_id),
  CONSTRAINT onboarding_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.user_profile(user_id),
  CONSTRAINT onboarding_submissions_created_user_id_fkey FOREIGN KEY (created_user_id) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.onboarding_templates (
  template_id uuid NOT NULL,
  name character varying NOT NULL,
  department_id uuid NOT NULL,
  position_id uuid NOT NULL,
  default_deadline_days integer NOT NULL,
  created_at timestamp without time zone NOT NULL,
  CONSTRAINT onboarding_templates_pkey PRIMARY KEY (template_id),
  CONSTRAINT onboarding_templates_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.job_positions(position_id)
);
CREATE TABLE public.overtime_requests (
  ot_id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  ot_type text NOT NULL CHECK (ot_type = ANY (ARRAY['NORMAL'::text, 'REST_DAY'::text, 'HOLIDAY'::text])),
  ot_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  planned_hours numeric NOT NULL,
  reason text,
  log_status text NOT NULL DEFAULT 'PENDING'::text CHECK (log_status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'DENIED'::text])),
  latitude double precision,
  longitude double precision,
  ip_address text,
  requested_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_reason text,
  CONSTRAINT overtime_requests_pkey PRIMARY KEY (ot_id)
);
CREATE TABLE public.payroll_log (
  log_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid,
  employee_id uuid NOT NULL,
  company_id character varying NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0.00,
  type character varying NOT NULL DEFAULT 'final_pay_offboarding'::character varying,
  confirmed_by uuid NOT NULL,
  confirmed_at timestamp with time zone NOT NULL DEFAULT now(),
  payroll_period_id uuid,
  CONSTRAINT payroll_log_pkey PRIMARY KEY (log_id),
  CONSTRAINT payroll_log_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.offboarding_cases(case_id),
  CONSTRAINT payroll_log_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.user_profile(user_id),
  CONSTRAINT payroll_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id),
  CONSTRAINT payroll_log_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.user_profile(user_id),
  CONSTRAINT payroll_log_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES public.cnb_payroll_periods(period_id)
);
CREATE TABLE public.performance_activity_logs (
  log_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  action character varying NOT NULL,
  performed_by uuid,
  actor_role character varying NOT NULL,
  target_user_id uuid,
  module_area character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT performance_activity_logs_pkey PRIMARY KEY (log_id)
);
CREATE TABLE public.performance_bonus_rules (
  bonus_rule_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  rating_min numeric NOT NULL,
  rating_max numeric NOT NULL,
  bonus_pct numeric NOT NULL DEFAULT 0.00,
  merit_increase_pct numeric NOT NULL DEFAULT 0.00,
  promotion_eligible boolean NOT NULL DEFAULT false,
  rating_label character varying,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  amount_type text NOT NULL DEFAULT 'percentage'::text,
  bonus_fixed_amount numeric,
  merit_fixed_amount numeric,
  CONSTRAINT performance_bonus_rules_pkey PRIMARY KEY (bonus_rule_id)
);
CREATE TABLE public.performance_comments (
  comment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  perf_eval_id uuid NOT NULL,
  author_id uuid NOT NULL,
  author_role character varying NOT NULL,
  comment_text text NOT NULL,
  is_visible_to_hr boolean NOT NULL DEFAULT true,
  is_visible_to_employee boolean NOT NULL DEFAULT false,
  parent_comment_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT performance_comments_pkey PRIMARY KEY (comment_id),
  CONSTRAINT performance_comments_perf_eval_id_fkey FOREIGN KEY (perf_eval_id) REFERENCES public.performance_evaluations(perf_eval_id),
  CONSTRAINT performance_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.performance_comments(comment_id)
);
CREATE TABLE public.performance_cycle_settings (
  settings_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL UNIQUE,
  module_enabled boolean NOT NULL DEFAULT true,
  self_proposed_goals_enabled boolean NOT NULL DEFAULT true,
  auto_compute_bonuses boolean NOT NULL DEFAULT false,
  kpi_suggestions_enabled boolean NOT NULL DEFAULT false,
  goal_setting_start date,
  goal_setting_end date,
  midyear_review_date date,
  yearend_review_date date,
  pip_max_attempts integer NOT NULL DEFAULT 2,
  pip_default_duration_days integer NOT NULL DEFAULT 60,
  pip_failure_action character varying NOT NULL,
  rating_label_1 character varying NOT NULL DEFAULT 'Below Expectations'::character varying,
  rating_label_2 character varying NOT NULL DEFAULT 'Below Expectations'::character varying,
  rating_label_3 character varying NOT NULL DEFAULT 'Meets Expectations'::character varying,
  rating_label_4 character varying NOT NULL DEFAULT 'Above Average'::character varying,
  rating_label_5 character varying NOT NULL DEFAULT 'Excellent'::character varying,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT performance_cycle_settings_pkey PRIMARY KEY (settings_id)
);
CREATE TABLE public.performance_evaluations (
  perf_eval_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  perf_cycle_id uuid NOT NULL,
  review_type character varying NOT NULL,
  scale_rating integer NOT NULL,
  rating_status character varying NOT NULL,
  perf_comments text NOT NULL,
  perf_status character varying NOT NULL,
  review_by uuid NOT NULL,
  review_period character varying NOT NULL,
  countersigned_by uuid,
  countersigned_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  employee_acknowledged_at timestamp with time zone,
  document_url text,
  CONSTRAINT performance_evaluations_pkey PRIMARY KEY (perf_eval_id),
  CONSTRAINT performance_evaluations_perf_cycle_id_fkey FOREIGN KEY (perf_cycle_id) REFERENCES public.performance_management_cycle(perf_cycle_id)
);
CREATE TABLE public.performance_goal_progress (
  progress_id uuid NOT NULL DEFAULT gen_random_uuid(),
  perf_goals_id uuid NOT NULL,
  recorded_by uuid NOT NULL,
  progress_value character varying NOT NULL,
  progress_pct numeric NOT NULL CHECK (progress_pct >= 0::numeric AND progress_pct <= 100::numeric),
  checkpoint_type character varying NOT NULL,
  notes text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT performance_goal_progress_pkey PRIMARY KEY (progress_id),
  CONSTRAINT performance_goal_progress_perf_goals_id_fkey FOREIGN KEY (perf_goals_id) REFERENCES public.performance_goals(perf_goals_id)
);
CREATE TABLE public.performance_goals (
  perf_goals_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  perf_cycle_id uuid NOT NULL,
  bsc_category character varying NOT NULL,
  goal_name character varying NOT NULL,
  kpi_description character varying NOT NULL,
  target_value character varying NOT NULL,
  status character varying NOT NULL,
  set_by uuid NOT NULL,
  deadline date,
  progress_value character varying,
  progress_pct numeric CHECK (progress_pct >= 0::numeric AND progress_pct <= 100::numeric),
  priority character varying NOT NULL,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejected_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT performance_goals_pkey PRIMARY KEY (perf_goals_id),
  CONSTRAINT performance_goals_perf_cycle_id_fkey FOREIGN KEY (perf_cycle_id) REFERENCES public.performance_management_cycle(perf_cycle_id)
);
CREATE TABLE public.performance_management_cycle (
  perf_cycle_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  cycle_name character varying NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status character varying NOT NULL,
  pip_max_attempts integer NOT NULL DEFAULT 2,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT performance_management_cycle_pkey PRIMARY KEY (perf_cycle_id)
);
CREATE TABLE public.performance_pip (
  perf_pip_id uuid NOT NULL DEFAULT gen_random_uuid(),
  perf_eval_id uuid,
  user_id uuid NOT NULL,
  attempt_num integer NOT NULL,
  deadline date NOT NULL,
  pip_status character varying NOT NULL,
  pip_goals jsonb,
  initiated_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  terminated_by uuid,
  terminated_at timestamp with time zone,
  termination_reason text,
  document_url text,
  CONSTRAINT performance_pip_pkey PRIMARY KEY (perf_pip_id),
  CONSTRAINT performance_pip_perf_eval_id_fkey FOREIGN KEY (perf_eval_id) REFERENCES public.performance_evaluations(perf_eval_id),
  CONSTRAINT performance_pip_terminated_by_fkey FOREIGN KEY (terminated_by) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.performance_pip_updates (
  pip_update_id uuid NOT NULL DEFAULT gen_random_uuid(),
  perf_pip_id uuid NOT NULL,
  user_id uuid NOT NULL,
  progress_data jsonb NOT NULL,
  progress_summary text,
  milestone_label character varying,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  manager_notes text,
  submitted_date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT performance_pip_updates_pkey PRIMARY KEY (pip_update_id),
  CONSTRAINT performance_pip_updates_perf_pip_id_fkey FOREIGN KEY (perf_pip_id) REFERENCES public.performance_pip(perf_pip_id)
);
CREATE TABLE public.performance_rewards (
  perf_rewards_id uuid NOT NULL DEFAULT gen_random_uuid(),
  perf_eval_id uuid NOT NULL,
  reward_type character varying NOT NULL,
  amount_value numeric NOT NULL,
  is_synced boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_discretionary boolean NOT NULL DEFAULT false,
  override_reason text,
  CONSTRAINT performance_rewards_pkey PRIMARY KEY (perf_rewards_id),
  CONSTRAINT performance_rewards_perf_eval_id_fkey FOREIGN KEY (perf_eval_id) REFERENCES public.performance_evaluations(perf_eval_id)
);
CREATE TABLE public.performance_self_assessments (
  self_assessment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  perf_cycle_id uuid NOT NULL,
  goal_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  self_comments text,
  status text NOT NULL DEFAULT 'SUBMITTED'::text,
  submitted_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT performance_self_assessments_pkey PRIMARY KEY (self_assessment_id),
  CONSTRAINT performance_self_assessments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile(user_id),
  CONSTRAINT performance_self_assessments_perf_cycle_id_fkey FOREIGN KEY (perf_cycle_id) REFERENCES public.performance_management_cycle(perf_cycle_id)
);
CREATE TABLE public.performance_violation_rules (
  rule_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  violation_count integer NOT NULL,
  severity_threshold character varying NOT NULL,
  within_days integer,
  resulting_action character varying NOT NULL,
  affects_bonus boolean NOT NULL DEFAULT false,
  affects_merit boolean NOT NULL DEFAULT false,
  affects_perks boolean NOT NULL DEFAULT false,
  suspension_days integer,
  rule_description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT performance_violation_rules_pkey PRIMARY KEY (rule_id)
);
CREATE TABLE public.performance_violations (
  perf_viol_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id character varying NOT NULL,
  severity character varying NOT NULL,
  violation_type character varying NOT NULL,
  evidence text NOT NULL DEFAULT ''::text,
  occured_at timestamp with time zone NOT NULL DEFAULT now(),
  violation_description text,
  logged_by uuid NOT NULL,
  disciplinary_action character varying,
  action_status character varying NOT NULL,
  action_override_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT performance_violations_pkey PRIMARY KEY (perf_viol_id)
);
CREATE TABLE public.profile_change_requests (
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  company_id character varying NOT NULL,
  field_type text NOT NULL CHECK (field_type = ANY (ARRAY['legal_name'::text, 'bank'::text])),
  requested_changes jsonb NOT NULL,
  reason text NOT NULL,
  supporting_doc_url text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  reviewed_by uuid,
  review_reason text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  old_value text,
  rejection_reason text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profile_change_requests_pkey PRIMARY KEY (request_id),
  CONSTRAINT profile_change_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.user_profile(user_id),
  CONSTRAINT profile_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.user_profile(user_id),
  CONSTRAINT profile_change_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.refresh_session (
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  user_agent text,
  ip_address text,
  CONSTRAINT refresh_session_pkey PRIMARY KEY (session_id),
  CONSTRAINT refresh_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.renewal_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_by uuid,
  CONSTRAINT renewal_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT renewal_reminders_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.company_registrations(registration_id),
  CONSTRAINT renewal_reminders_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.super_admin_users(id)
);
CREATE TABLE public.resignation_details (
  resignation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  reason character varying NOT NULL,
  resignation_letter text,
  document_url character varying,
  document_name character varying,
  CONSTRAINT resignation_details_pkey PRIMARY KEY (resignation_id),
  CONSTRAINT resignation_details_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.offboarding_cases(case_id)
);
CREATE TABLE public.role (
  role_id character varying NOT NULL,
  company_id character varying,
  role_name character varying NOT NULL,
  CONSTRAINT role_pkey PRIMARY KEY (role_id),
  CONSTRAINT role_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.role_feature (
  role_id character varying NOT NULL,
  feature_id character varying NOT NULL,
  can_read boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  CONSTRAINT role_feature_pkey PRIMARY KEY (role_id, feature_id),
  CONSTRAINT role_feature_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(role_id),
  CONSTRAINT role_feature_feature_id_fkey FOREIGN KEY (feature_id) REFERENCES public.feature(feature_id)
);
CREATE TABLE public.role_portal_map (
  role_id character varying NOT NULL,
  portal_key text NOT NULL CHECK (portal_key = ANY (ARRAY['employee'::text, 'hr'::text, 'manager'::text, 'admin'::text, 'system-admin'::text, 'applicant'::text])),
  CONSTRAINT role_portal_map_pkey PRIMARY KEY (role_id, portal_key),
  CONSTRAINT role_portal_map_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(role_id)
);
CREATE TABLE public.schedules (
  sched_id character varying NOT NULL DEFAULT (gen_random_uuid())::character varying,
  employee_id character varying NOT NULL,
  workdays character varying NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  break_start time without time zone NOT NULL,
  break_end time without time zone NOT NULL,
  is_nightshift boolean NOT NULL DEFAULT false,
  schedule_source text DEFAULT 'default'::text CHECK (schedule_source = ANY (ARRAY['bulk'::text, 'individual'::text, 'default'::text])),
  updated_by_name text,
  updated_at timestamp with time zone DEFAULT now(),
  effective_from date NOT NULL,
  CONSTRAINT schedules_pkey PRIMARY KEY (sched_id)
);
CREATE TABLE public.sfia_skills (
  skill_id uuid NOT NULL DEFAULT gen_random_uuid(),
  category character varying NOT NULL,
  skill character varying NOT NULL,
  level_1_desc text,
  level_2_desc text,
  level_3_desc text,
  level_4_desc text,
  level_5_desc text,
  level_6_desc text,
  level_7_desc text,
  CONSTRAINT sfia_skills_pkey PRIMARY KEY (skill_id)
);
CREATE TABLE public.super_admin_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  notify_new_signup boolean NOT NULL DEFAULT true,
  notify_payment boolean NOT NULL DEFAULT true,
  notify_renewal_due boolean NOT NULL DEFAULT true,
  notify_expiry boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT super_admin_settings_pkey PRIMARY KEY (id),
  CONSTRAINT super_admin_settings_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.super_admin_users(id)
);
CREATE TABLE public.super_admin_users (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT super_admin_users_pkey PRIMARY KEY (id),
  CONSTRAINT super_admin_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.survey_questions (
  question_id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL,
  question text NOT NULL,
  question_type character varying NOT NULL,
  options jsonb,
  is_required boolean DEFAULT true,
  display_order integer,
  CONSTRAINT survey_questions_pkey PRIMARY KEY (question_id),
  CONSTRAINT survey_questions_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(job_posting_id)
);
CREATE TABLE public.survey_responses (
  response_id uuid NOT NULL DEFAULT gen_random_uuid(),
  survey_question_id uuid NOT NULL,
  application_id uuid NOT NULL,
  applicant_id uuid NOT NULL,
  response text NOT NULL,
  submitted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT survey_responses_pkey PRIMARY KEY (response_id),
  CONSTRAINT survey_responses_question_id_fkey FOREIGN KEY (survey_question_id) REFERENCES public.survey_questions(question_id),
  CONSTRAINT survey_responses_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_applications(application_id),
  CONSTRAINT survey_responses_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicant_profile(applicant_id)
);
CREATE TABLE public.system_access (
  access_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  system_name character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'Active'::character varying,
  revoked_by_id uuid,
  revoked_at timestamp with time zone,
  CONSTRAINT system_access_pkey PRIMARY KEY (access_id),
  CONSTRAINT system_access_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.offboarding_cases(case_id),
  CONSTRAINT system_access_revoked_by_id_fkey FOREIGN KEY (revoked_by_id) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.template_items (
  item_id uuid NOT NULL,
  template_id uuid NOT NULL,
  type character varying NOT NULL,
  tab_category character varying NOT NULL,
  title character varying NOT NULL,
  description text,
  rich_content text,
  is_required boolean NOT NULL,
  CONSTRAINT template_items_pkey PRIMARY KEY (item_id),
  CONSTRAINT template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.onboarding_templates(template_id)
);
CREATE TABLE public.tenant_config (
  company_id character varying NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Manila'::text,
  date_format text NOT NULL DEFAULT 'MM/DD/YYYY'::text,
  currency text NOT NULL DEFAULT 'PHP'::text,
  org_structure jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  payroll_settings jsonb NOT NULL DEFAULT jsonb_build_object('working_days_per_year', 260, 'overtime_multiplier', 1.25, 'late_deduction_per_hour', 50, 'night_shift_diff_multiplier', 1.10),
  CONSTRAINT tenant_config_pkey PRIMARY KEY (company_id),
  CONSTRAINT tenant_config_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.tenant_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL,
  module_name character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'Inactive'::character varying,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tenant_modules_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_modules_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.tenant_security_config (
  config_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id character varying NOT NULL UNIQUE,
  require_cnb_reauth boolean NOT NULL DEFAULT false,
  max_login_attempts integer NOT NULL DEFAULT 5,
  lockout_duration_minutes integer NOT NULL DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tenant_security_config_pkey PRIMARY KEY (config_id),
  CONSTRAINT tenant_security_config_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.termination_details (
  termination_id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  reason character varying NOT NULL,
  termination_details text,
  document_url character varying,
  document_name character varying,
  CONSTRAINT termination_details_pkey PRIMARY KEY (termination_id),
  CONSTRAINT termination_details_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.offboarding_cases(case_id)
);
CREATE TABLE public.time_leave_balances (
  balance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id character varying NOT NULL,
  leave_type character varying NOT NULL,
  year integer NOT NULL,
  allocated_days numeric NOT NULL DEFAULT 0,
  used_days numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT time_leave_balances_pkey PRIMARY KEY (balance_id)
);
CREATE TABLE public.time_leave_requests (
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id character varying NOT NULL,
  leave_type character varying NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days numeric NOT NULL,
  reason text,
  status character varying NOT NULL DEFAULT 'Pending'::character varying,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  attachment_url text,
  revocation_reason text,
  CONSTRAINT time_leave_requests_pkey PRIMARY KEY (request_id)
);
CREATE TABLE public.timekeeping_company_default_schedules (
  company_id character varying NOT NULL,
  workdays character varying NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  break_start time without time zone NOT NULL DEFAULT '00:00:00'::time without time zone,
  break_end time without time zone NOT NULL DEFAULT '00:00:00'::time without time zone,
  is_nightshift boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL,
  updated_by uuid,
  updated_by_name text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT timekeeping_company_default_schedules_pkey PRIMARY KEY (company_id),
  CONSTRAINT timekeeping_company_default_schedules_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id),
  CONSTRAINT timekeeping_company_default_schedules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.token_blacklist (
  token_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  CONSTRAINT token_blacklist_pkey PRIMARY KEY (token_hash)
);
CREATE TABLE public.user_invites (
  invite_id character varying NOT NULL DEFAULT (gen_random_uuid())::character varying,
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  used_at timestamp with time zone,
  CONSTRAINT user_invites_pkey PRIMARY KEY (invite_id),
  CONSTRAINT user_invites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.user_notifications (
  notification_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id character varying NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_notifications_pkey PRIMARY KEY (notification_id),
  CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile(user_id),
  CONSTRAINT user_notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TABLE public.user_profile (
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role_id character varying,
  company_id character varying,
  employee_id character varying,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  is_first_login boolean DEFAULT true,
  username character varying UNIQUE,
  password_hash character varying,
  department_id uuid,
  start_date date,
  account_status character varying DEFAULT 'pending'::character varying,
  applicant_id uuid,
  middle_name character varying,
  personal_email character varying,
  date_of_birth date,
  place_of_birth character varying,
  nationality character varying,
  civil_status character varying,
  complete_address text,
  bank_name character varying,
  bank_account_number character varying,
  bank_account_name character varying,
  phone_number character varying,
  avatar_url text,
  emergency_contacts jsonb DEFAULT '[]'::jsonb,
  offboarding_status character varying,
  offboarded_at timestamp with time zone,
  promotion_tagged boolean DEFAULT false,
  promotion_tagged_at timestamp with time zone,
  promotion_tagged_by uuid,
  promotion_notes text,
  offboarding_triggered_at timestamp with time zone,
  offboarding_reason text,
  personal_notes text,
  CONSTRAINT user_profile_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_profile_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(role_id),
  CONSTRAINT user_profile_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id),
  CONSTRAINT user_profile_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicant_profile(applicant_id),
  CONSTRAINT user_profile_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(department_id),
  CONSTRAINT user_profile_promotion_tagged_by_fkey FOREIGN KEY (promotion_tagged_by) REFERENCES public.user_profile(user_id)
);
CREATE TABLE public.user_role_assignments (
  assignment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id character varying NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by uuid,
  CONSTRAINT user_role_assignments_pkey PRIMARY KEY (assignment_id),
  CONSTRAINT user_role_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile(user_id),
  CONSTRAINT user_role_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(role_id),
  CONSTRAINT user_role_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.user_profile(user_id)
);