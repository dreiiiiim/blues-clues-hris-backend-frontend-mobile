# HRIS Architecture Audit Report — v2 (Schema-Verified)
**Project:** Adrian_merge-main | **Revised:** May 17, 2026  
**Stack:** NestJS (tribeX-hris-auth-api) · Next.js (blues-clues-hris-frontend-web) · Supabase  
**Scope:** Cross-referenced source code against the architecture blueprint AND the actual database schema.

> **Note on v1 corrections:** Several table names were misidentified in the first audit. `cb_audit_logs` does not exist — the actual table is `cnb_audit_trail`. `offboarding_activity_logs` does not exist — offboarding audit goes to `admin_audit_logs` via `AuditService`. One gap from v1 (per-module toggle API) was found to already be implemented. All findings below reflect confirmed schema + code reality.

---

## Module 1 — Company Subscription & Registration ✅ Complete

**Implemented & Confirmed:**
- TIN, business permit URL, HR org structure captured in `company_registrations` table ✓
- Plan selection (monthly/annual), payment confirmation → `company_registrations.payment_status`, `company_registrations.billing_cycle` ✓
- Tenant provisioning auto-creates `tenant_modules` row for all 5 modules (recruitment, onboarding, compensation, performance, offboarding) ✓
- System Admin account auto-created with `account_status: Pending` ✓
- First-login / set-password flow via `user_invites` token + `/set-password` page ✓
- **Per-module toggle:** `PATCH /users/tenant-modules/:module` exists in `users.controller.ts` — System Admin only, validates `Active | Inactive`, updates `tenant_modules` table ✓
- Tenant config (timezone, currency, org): `tenant_config` table + `PATCH /users/tenant-config` ✓
- Audit log dashboard reads from `admin_audit_logs` → `GET /audit/logs` + `GET /audit/logs/count` ✓
- Login/logout history tracked in `login_history` + `logout_history` ✓
- Revoke/deactivate via `DELETE /users/:id` and `PATCH /users/:id` ✓

**No gaps identified.**

---

## Module 2 — Job Requisition & Recruitment ⚠️ 2 Gaps

**Implemented & Confirmed:**
- Career portal: `job_postings` → `GET /jobs/public/careers/:slug` ✓
- Applicant registration with file validation → `applicant_profile` table ✓
- Duplicate flagging logic present in `applicants.service.ts` ✓
- SFIA v9 extraction + fit % (0–100) → `job_application_sfia.sfia_matching_percentage` ✓
- Top-20 ranked list → `GET /jobs/:id/candidates/ranked` ✓
- Manual ranking fallback: sets `ranking_mode = 'MANUAL'` on `job_application_sfia`, history written to `manual_ranking_history` table ✓
- HR recruiter actions (shortlist, reject, on hold) → `PATCH /jobs/applications/:id/status` ✓
- Three-stage interview scheduling (`first_interview`, `tech_interview`, `final_interview`) → `interview_schedules` table with `stage` column ✓
- Applicant responses (accept/decline/reschedule) → `interview_schedules.applicant_response` ✓
- Job offer acceptance → `PATCH /jobs/applications/:id/accept-offer` ✓
- Role migration to onboarding on `Hired` status ✓

**⚠️ GAP-2.1 — Pillars 60-second health polling & automated failover is absent**

The blueprint requires: "Poll health every 60s → 2 consecutive failures → Auto-trigger Fallback Mode → Notify Recruiter → Poll every 60s for recovery." The only `@Cron` decorators in `jobs.service.ts` are `autoMarkAbsent` and `autoCloseOpenClockIns` — both timekeeping functions. There is **no Pillars health-check cron, no consecutive-failure counter, and no automated recruiter notification on service degradation.** The `ranking_mode` field and manual ranking work, but the automatic switchover trigger is missing entirely.

**⚠️ GAP-2.2 — "Manual-Processed" persistent badge not implemented per spec**

The blueprint specifies: "Tag records `Manual-Processed` (Badge persists)." The code sets `ranking_mode = 'MANUAL'` on `job_application_sfia` and the `ranking_mode` field is returned in ranked-list responses. However, the `job_application_sfia` table has no separate boolean flag or display label field for this. The tag is stored implicitly as a string value — functionally equivalent, but the schema has no dedicated badge/flag column, meaning no easy query for "all applications ever manually processed" without string-matching `ranking_mode`.

**⚠️ GAP-2.3 — Digital signature verification on job offer absent**

The blueprint specifies: "Gen Job Offer [C&B Details] → Trigger Email → **Verify Digital Signature** → Update Status: `Hired`." The `accept-offer` endpoint is a single unverified PATCH call. Neither `job_applications` nor `job_application_sfia` has a `signature_url`, `signed_at`, or `signature_verified` column. No e-signature integration exists.

---

## Module 3 — Onboarding Process ✅ Complete

**Implemented & Confirmed:**
- System Admin enable/provision flow ✓
- HR Onboarding Officer: template config via `onboarding_templates` + `template_items` tables ✓
- Auto-generated Employee ID (`employee_id_sequence` table) + credentials dispatch via `user_invites` ✓
- Employee dashboard: splash screen, progress bar (`onboarding_sessions.progress_percentage`), checklist tabs (Docs, Tasks, Equipment via `template_items.tab_category`) ✓
- Pre-employment document upload with type/size validation → `onboarding_documents` table ✓
- Upload history tracked via `onboarding_documents` with `uploaded_at` ✓
- HR officer monitoring: name, position, start date, progress %, status, deadlines → `onboarding_sessions` ✓
- Approve/reject docs with feedback loop (HR remarks → `onboarding_remarks` table) ✓
- 100% checklist → `Active Employee` status transition ✓

**No gaps identified.**

---

## Module 4 — C&B Salary & Payroll ⚠️ 3 Gaps

**Implemented & Confirmed:**
- Tax brackets → `cnb_tax_brackets` table (CRUD confirmed) ✓
- Salary baseline: basic salary, employment type, pay frequency → `cnb_salary_baselines` table ✓
- Benefits catalog + per-employee assignment → `cnb_benefits_catalog` + `cnb_employee_benefits` ✓
- Statutory deductions (SSS/PhilHealth/PAG-IBIG) → `cnb_statutory_deduction_defaults` table ✓
- 13th month computation endpoint ✓
- Payroll run: gross pay, tax deduction, net pay → `cnb_payslips` + `cnb_payroll_periods` ✓
- Timesheet sync: approved leave records pulled from `time_leave_requests`, absence adjustments applied ✓
- C&B audit trail → `cnb_audit_trail` table (`old_value` / `new_value` fields present in schema) ✓
- Encryption at rest via `CnbEncryptionService` ✓
- Employee self-service: view compensation, download payslips ✓

**⚠️ GAP-4.1 — `tenant_security_config` table does not exist in schema or code**

The blueprint requires: "Enforce Encryption → Save `tenant_security_config`" and "Enforce Auth Gateways → Password verification for sensitive records + Max login lockouts → Save `tenant_security_config`." This table **does not appear anywhere** in the database schema. There is no secondary re-authentication challenge before C&B write operations, and no per-tenant lockout threshold configuration. The `cnb_statutory_deduction_defaults` and `cnb_tax_brackets` tables serve adjacent purposes but do not replace this. Auto-logout on inactivity is handled only on the frontend.

**⚠️ GAP-4.2 — `payroll_log` table is schema-locked to offboarding; no general bank-run endpoint**

The blueprint describes a regular payroll bank-run step: "Execute manual bank run → Record receipt confirmation → Save `payroll_log`." Looking at the actual schema, `payroll_log` has a **NOT NULL foreign key to `offboarding_cases`** — it is structurally designed only for offboarding final pay, not regular payroll runs. There is no `POST /payroll/bank-run` or equivalent endpoint. The `cnb_payroll_periods` status transitions to `Processed` but there is no bank transfer confirmation record for regular payroll cycles.

**⚠️ GAP-4.3 — "Personal Notes" field (profile update item #7) absent from schema and code**

The blueprint lists 7 employee self-service update actions, the last being "Personal Notes." The `user_profile` table has no `personal_notes` column, it is not in the `updateMe` allowed-fields list, and no migration or code reference to it exists anywhere. Items 1–6 (Address/Contact, Legal Name Request via `profile_change_requests`, Bank Account, Profile Photo/`avatar_url`, Emergency Contact via `PATCH /users/me/emergency-contacts`, Demographics) are all implemented. Item 7 is missing.

---

## Module 5 — Leave Management ⚠️ 3 Gaps

**Implemented & Confirmed:**
- Leave balance view with credit calculation → `time_leave_balances` table ✓
- Leave request filing with hard block when requested days > accrued → `time_leave_requests` ✓
- Approval loop: HR approves (deducts `used_days`) or rejects with reason ✓
- Leave deductions feed into payroll computation (payroll service reads `time_leave_requests`) ✓

**⚠️ GAP-5.1 — Automated accrual engine does not exist**

The blueprint requires: "Set Accrual Rate (Default 1.5 days/mo automated based on hire date) → Save `leave_config`." The `time_leave_balances` table has `allocated_days` and `used_days` columns, but accrual is never computed dynamically. The leave service uses a **hardcoded constant** (`Vacation Leave: 15, Sick Leave: 10, Emergency Leave: 3, Personal Leave: 2`). There is no `@Cron` that runs monthly to credit 1.5 days. `allocated_days` in the DB is only populated when a row is manually inserted; there is no automated seeding tied to hire date.

**⚠️ GAP-5.2 — `leave_config` and `leave_config_logs` tables do not exist**

These tables are specified in the blueprint for storing accrual rate, HR overrides, and year-end rule configuration. Neither appears in the database schema. Without them, there is no API surface for HR to set per-tenant accrual rates or per-employee override limits, and no audit trail of those config changes.

**⚠️ GAP-5.3 — Year-end carry-over rules not implemented**

The blueprint specifies 3 configurable year-end options: reset to zero Jan 1, carry over all, carry over up to N days. There is no cron, no config table, and no code path that processes `time_leave_balances` at year-end. Balances from prior years are never reset or carried forward programmatically.

---

## Module 6 — Performance Management ⚠️ 1 Gap

**Implemented & Confirmed:**
- Configurable Likert scale (labels in `performance_cycle_settings`: `rating_label_1` through `rating_label_5`) ✓
- Balanced Scorecard framework with `bsc_category` on `performance_goals` ✓
- 2-step approval workflow: Manager signs → HR co-signs (`countersigned_by`, `countersigned_at` on `performance_evaluations`) ✓
- PIP workflow with `pip_max_attempts` enforced at creation (default 2, reads from `performance_cycle_settings`) ✓
- `performance_violation_rules` + `performance_violations` tables with automatic C&B impact flags (`affects_bonus`, `affects_merit`, `affects_perks`) ✓
- Self-assessment → `performance_self_assessments` table ✓
- `performance_rewards` table: merit amount computed and stored per evaluation ✓
- Bonus rules with rating-range thresholds → `performance_bonus_rules` table ✓
- PIP failure path: `termination_reason`, `terminated_by` on `performance_pip`; recommended termination flow to offboarding ✓

**⚠️ GAP-6.1 — Merit increase does NOT write back to `cnb_salary_baselines.basic_salary`**

The blueprint specifies: "System programmatically updates `salary_records.basic_salary`. Mutation logs automatically target `cb_audit_logs` (`old_salary` → `new_salary` bound to the evaluation ID)."

The actual implementation in `syncRewardIntoPayroll()` inserts the merit amount as a new row into **`cnb_employee_benefits`** (treated as a one-time supplemental payment/benefit), not as a mutation to `cnb_salary_baselines.basic_salary`. Consequences:

1. The employee's base salary never increases — the merit raise is a recurring benefit line, not a salary escalation.
2. The `cnb_audit_trail` table has `old_value` / `new_value` columns that exist for exactly this purpose but are **not written** during the merit sync.
3. The audit trail entry binding `old_salary → new_salary` to `perf_eval_id` — explicitly required by the blueprint — is absent.

The fix requires `syncRewardIntoPayroll()` (for `reward_type = 'MERIT_INCREASE'`) to: (a) read current `cnb_salary_baselines.basic_salary`, (b) insert a new `cnb_salary_baselines` row with the incremented salary and a new `effective_date`, and (c) write a `cnb_audit_trail` entry with `action_type = 'MERIT_INCREASE'`, `target_table = 'cnb_salary_baselines'`, `old_value = {basic_salary: X}`, `new_value = {basic_salary: Y, perf_eval_id: Z}`.

---

## Module 7 — Offboarding ⚠️ 1 Gap

**Implemented & Confirmed:**
- System Admin enable/disable per tenant → `tenant_modules` table ✓
- Audit logging via `AuditService` → `admin_audit_logs` table ✓
- Resignation path: `offboarding_cases` + `resignation_details` tables; simultaneous alerts to Manager + HR ✓
- Manager acknowledgement and termination/end-of-contract initiation ✓
- HR accept/reject with Last Working Day → `PATCH /offboarding/hr/cases/:caseId/review` ✓
- Checklist template: `offboarding_checklist_templates` + `offboarding_checklist_template_items` tables ✓
- Runtime checklist compilation: base template items + HR-added items merged into `checklist_items` per case ✓
- Verified/Disputed item status on `checklist_items` ✓
- Final pay: `final_pay` table + prorated salary computation + `payroll_log` write ✓
- Clearance certificate → `clearance_documents` table ✓
- Vacant position auto-creates `job_postings` entry + alerts Manager → `offboarding_vacant_positions` table ✓
- `user_profile.account_status = Inactive`, `offboarding_status = Ended` with timestamp ✓
- Soft-delete enforced (no hard delete — FK constraints on `offboarding_cases` from multiple child tables prevent it) ✓

**⚠️ GAP-7.1 — Dynamic checklist `category` and `is_custom` fields missing from schema**

The blueprint (specifically citing "Sir Catubag Feedback") requires the checklist template to map `item_id`, `tenant_id`, `item_name`, **`category` (Asset/Document/Task)**, and an **`is_custom` boolean flag**.

In the actual schema:
- `offboarding_checklist_template_items` has: `item_id`, `template_id`, `item_name`, `description`, `is_required` — **no `category`, no `is_custom`**
- `checklist_items` (the per-case operational table) has: `item_id`, `case_id`, `item_name`, `status`, `cleared_by_id`, `cleared_at` — **no `category`, no `is_custom`**
- The `ConfigureChecklistTemplateDto` likewise has no `category` or `is_custom` field

Without `category`, the Employee UI cannot route items into the three distinct dashboard tabs (Documents / Tasks / Equipment) as the blueprint specifies. Without `is_custom`, there is no way to distinguish tenant-added items from base template items for reporting or auditing purposes.

---

## Corrected Summary Table

| # | Module | Status | Confirmed Gaps |
|---|--------|--------|----------------|
| 1 | Company Subscription & Registration | ✅ **Complete** | — |
| 2 | Job Requisition & Recruitment | ⚠️ 3 Gaps | No Pillars health-polling cron; no digital signature; Manual-Processed badge is implicit only |
| 3 | Onboarding Process | ✅ **Complete** | — |
| 4 | C&B — Salary & Payroll | ⚠️ 3 Gaps | `tenant_security_config` missing; `payroll_log` FK prevents regular bank-run; "Personal Notes" field missing |
| 5 | Leave Management | ⚠️ 3 Gaps | No accrual cron; `leave_config`/`leave_config_logs` tables absent; no year-end rules |
| 6 | Performance Management | ⚠️ 1 Gap | Merit increase syncs as benefit — does not mutate `basic_salary` or write salary audit trail |
| 7 | Offboarding | ⚠️ 1 Gap | Checklist `category` and `is_custom` columns absent from both template and operational tables |

**Total confirmed gaps: 11** (3 new vs v1, 1 v1 gap closed, several v1 claims corrected)

---

## Corrected Database Table Reference

| Blueprint Table | Actual DB Table | Status | Notes |
|----------------|----------------|--------|-------|
| `tax_config` | `cnb_tax_brackets` | ✅ Present | Renamed with `cnb_` prefix |
| `salary_records` | `cnb_salary_baselines` | ✅ Present | Renamed; stores as encrypted text |
| `payroll_records` | `cnb_payslips` + `cnb_payroll_periods` | ✅ Present | Split into two tables |
| `payroll_log` | `payroll_log` | ⚠️ Partial | Present but `case_id` FK is NOT NULL — offboarding-only by schema constraint |
| `bonuses` | `performance_rewards` + `cnb_employee_benefits` | ✅ Present | Distributed across two tables |
| `payslips` | `cnb_payslips` | ✅ Present | |
| `cb_audit_logs` | `cnb_audit_trail` | ✅ Present | Different name; `old_value`/`new_value` columns exist but not used for merit |
| `role_permissions` | `role_feature` | ✅ Present | Read/create/update/delete granularity per feature |
| `tenant_security_config` | **NOT IN SCHEMA** | ❌ Missing | |
| `leave_config` | **NOT IN SCHEMA** | ❌ Missing | Hardcoded constant used instead |
| `leave_config_logs` | **NOT IN SCHEMA** | ❌ Missing | |
| `offboarding_activity_logs` | `admin_audit_logs` (via `AuditService`) | ✅ Present | Different name; same function |
| `interview_evaluations` | `interview_schedules` (with `stage` column) | ⚠️ Pattern differs | No standalone evaluations table; stage outcomes tracked on the schedule record |
| `recruitment_timeline` | `user_notifications` + application status | ⚠️ Pattern differs | No dedicated timeline table; events dispatched as notifications |
| `offboarding_checklist_template` | `offboarding_checklist_templates` + `offboarding_checklist_template_items` | ⚠️ Partial | Tables exist; `category` and `is_custom` columns missing |

---

## Prioritized Fix List

### 🔴 High Priority

**FIX-1 — Leave Accrual Engine (Gaps 5.1, 5.2, 5.3)**  
Add `leave_config` table (`company_id`, `accrual_rate`, `year_end_rule`, `carry_over_max`). Add `leave_config_logs` for override audit. Add two cron jobs: a monthly job (`@Cron('0 0 1 * *')`) that credits `accrual_rate` days per active employee into `time_leave_balances`, and a year-end job (`@Cron('0 0 1 1 *')`) that applies the carry-over rule.

**FIX-2 — Merit Increase → `cnb_salary_baselines` write-back (Gap 6.1)**  
In `syncRewardIntoPayroll()`, after inserting the benefit row, add: (a) a new `cnb_salary_baselines` INSERT with `basic_salary = old + merit_amount`, `effective_date = today`; (b) a `cnb_audit_trail` INSERT with `action_type = 'MERIT_INCREASE'`, `target_table = 'cnb_salary_baselines'`, `old_value = JSON(old_salary)`, `new_value = JSON({new_salary, perf_eval_id})`.

**FIX-3 — Offboarding Checklist `category` + `is_custom` (Gap 7.1)**  
Add `category VARCHAR CHECK (category IN ('Asset', 'Document', 'Task'))` and `is_custom BOOLEAN DEFAULT FALSE` columns to both `offboarding_checklist_template_items` and `checklist_items`. Update `ConfigureChecklistTemplateDto` and `ChecklistTemplateItemDto` to accept `category`. Update the Employee offboarding dashboard to route items into three separate UI panels using the `category` field.

### 🟡 Medium Priority

**FIX-4 — Pillars Health-Polling Cron (Gap 2.1)**  
Add a `PillarsHealthService` with `@Cron('*/60 * * * * *')` that calls the Pillars health endpoint, increments a Redis/DB failure counter per company, triggers `ranking_mode` switch to `MANUAL` and fires `user_notifications` to HR Recruiters on 2 consecutive failures, and resets on recovery.

**FIX-5 — Digital Signature on Job Offer (Gap 2.3)**  
Add `offer_document_url`, `offer_signed_at`, and `offer_signature_verified` columns to `job_applications`. Require a non-null `offer_signed_at` before the status mutation to `Hired` is permitted.

### 🟢 Low Priority

**FIX-6 — `tenant_security_config` + Re-auth Gateway (Gap 4.1)**  
Create `tenant_security_config` table (`company_id`, `require_cnb_reauth BOOLEAN`, `max_login_attempts INT`, `lockout_duration_minutes INT`). Add a `POST /cnb/reauth` endpoint. Add a login-attempt counter to `user_profile` or a separate `login_lockout` table.

**FIX-7 — Regular Payroll `payroll_log` / Bank-Run Endpoint (Gap 4.2)**  
Either remove the `NOT NULL` FK constraint on `payroll_log.case_id` to allow general payroll bank-run entries, or create a separate `cnb_bank_run_log` table. Add `POST /payroll/bank-run` endpoint.

**FIX-8 — Personal Notes Field (Gap 4.3)**  
Add `personal_notes TEXT` column to `user_profile`. Add `personal_notes` to the allowed-fields list in `updateMe()`.

**FIX-9 — Manual-Processed Badge Column (Gap 2.2)**  
Add `is_manually_processed BOOLEAN DEFAULT FALSE` to `job_application_sfia`. Set to `TRUE` when `ranking_mode` is ever changed to `'MANUAL'` (and do not reset on SFIA re-run), so the badge truly persists per spec.
