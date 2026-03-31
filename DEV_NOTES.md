# Dev Session Notes

## What Was Accomplished

### Signup Flow Fixed
- Applicants can now register and have their data saved to Supabase (`applicant_profile` and `email_verifications` tables).
- The signup → login → apply flow is working end to end.

### Job Application Working
- Applicants can successfully apply to job postings.
- Applications are saved to the `job_applications` table in Supabase.
- Answers (if any) are saved to `applicant_answers`.

---

## Dev Notes / Known Workarounds

### Email Verification (Gmail SMTP - Commented Out)
`tribeX-hris-auth-api/src/applicants/applicants.service.ts` ~line 104

The `sendVerificationEmail` call is currently **commented out** for local development because `MAIL_USER` and `MAIL_PASS` in `.env` are placeholder values. Instead, the verify link is logged to the backend console.

**To verify an account in dev:** check the backend console output for a line like:
```
[DEV] Verify link for user@email.com: http://localhost:3000/applicant/verify-email?token=...
```
Open that URL in the browser to verify the account before signing in.

**To enable real email sending:** set valid Gmail credentials in `.env`:
```
MAIL_USER=youremail@gmail.com
MAIL_PASS=xxxx xxxx xxxx xxxx   # Gmail App Password (not your regular password)
```
Then uncomment the try/catch block in `applicants.service.ts`.

### Company ID Required for Job Applications
Applicants must have a `company_id` linked to their account to apply for jobs. This is normally set at registration via a `?company=<uuid>` query parameter in the signup URL.

In dev, if an account was registered without this, manually set the `company_id` directly in the `applicant_profile` table in Supabase.

### Staff Admin / HR Officer Account Creation
Unlike applicants, Staff Admin and HR Officer accounts **cannot self-register**. They are created by a System Admin through the app, which:
1. Inserts the user into `user_profile` with `account_status: 'Pending'`
2. Generates an invite token in `user_invites` and sends an activation email (same Gmail SMTP issue applies)
3. The user clicks the invite link → `/set-password?token=...` → sets their password → account becomes `Active`

**In dev (since email is broken)**, the activation link is automatically logged to the backend console:
```
==========================================
DEV MODE - activation link
Recipient: user@email.com
http://localhost:3000/set-password?token=...
==========================================
```
Open that URL in the browser to set the password and activate the account.

The same flow applies to **password resets** for these accounts — the reset link is also logged to the console in dev.

### Viewing Data in Supabase
If rows aren't visible in the Supabase table editor, check if **Row Level Security (RLS)** is filtering results. Toggle the RLS filter off in the table editor to view all rows.

---

## Sprint 3 — Onboarding Module (Supabase Integration)

### What Was Accomplished

#### Backend (`tribeX-hris-auth-api`)
- Full onboarding service and controllers wired to live Supabase tables
- Three controller files: `applicant-onboarding.controller.ts`, `hr-onboarding.controller.ts`, `admin-onboarding.controller.ts`
- File uploads go to Supabase Storage bucket `onboarding-documents` (private)
- Progress recalculation runs automatically after any item status change

#### Web Frontend (`frontend/blues-clues-hris-frontend-web`)
- Onboarding flow rendered in `OnboardingProcess.tsx` with tabbed UI (Profile, Documents, Tasks, Equipment)
- `SystemAdminView.tsx` now loads departments and positions from the live API (no more static hardcoded data)
- `onboardingApi.ts` covers all employee, HR, and admin endpoints

#### Mobile (`blues-clues-hris-mobile`)
- `EmployeeOnboardingScreen`, `HROfficerOnboardingScreen`, `SystemAdminOnboardingScreen` all call live API endpoints
- Template cards show item counts per category including `profile` and `welcome`

---

### Supabase Changes (Already Applied — Do Not Re-Apply)

#### Schema Changes

| Change | Detail |
|--------|--------|
| `document_submissions` renamed | → `onboarding_documents` |
| New table `job_positions` | `position_id` (UUID PK), `department_id` (UUID FK → `department`), `position_name` (varchar), `created_at` (timestamp) |
| FK added | `onboarding_templates.position_id` → `job_positions.position_id` |
| `template_items.tab_category` | Normalized to lowercase: `documents`, `tasks`, `equipment`, `profile`, `welcome` |
| `template_items.type` | Normalized to lowercase: `document`, `upload`, `task`, `equipment`, `profile`, `confirm` |
| `onboarding_sessions.status` | `IN_PROGRESS` → `in-progress` |
| `onboarding_templates.department_id` | Fixed to point to real IS department UUID `52a9050b-4f7f-4e3e-a1cf-fa12c93e0479` |

#### Storage

| Bucket | Access | Usage |
|--------|--------|-------|
| `onboarding-documents` | Private | Uploaded employee documents and proof of receipt. All access via signed URLs (7-day expiry). |

#### Full Table List (Confirmed in Supabase)

| Table | Rows | Purpose |
|-------|------|---------|
| `onboarding_templates` | 1 | Master checklist definitions |
| `template_items` | 8 | Items within a template |
| `onboarding_sessions` | 1 | Active onboarding journey per employee |
| `onboarding_items` | 8 | Per-session item instances |
| `onboarding_documents` | 0 | Uploaded files (formerly `document_submissions`) |
| `onboarding_remarks` | 0 | HR feedback per tab |
| `employee_staging` | 0 | New hire personal info (profile form) |
| `job_positions` | 1 | Position definitions |
| `department` | 2 | Department definitions (note: singular table name) |

#### FK Chain

```
user_profile
  └── onboarding_sessions (account_id → user_id)
        ├── onboarding_templates (template_id)
        │     ├── job_positions (position_id)
        │     │     └── department (department_id)
        │     └── template_items (template_id)
        │           └── onboarding_items (template_item_id)
        │                 └── onboarding_documents (onboarding_item_id)
        ├── onboarding_items (session_id)
        ├── onboarding_remarks (session_id)
        └── employee_staging (session_id)
```

#### Current Seed Data Values

- **`template_items.tab_category`:** `documents`, `tasks`, `equipment`, `profile`, `welcome`
- **`template_items.type`:** `document`, `upload`, `task`, `equipment`, `profile`, `confirm`
- **`onboarding_sessions.status`:** `not-started`, `in-progress`, `for-review`, `approved`, `overdue`
- **`onboarding_items.status`:** `pending`, `submitted`, `for-review`, `approved`, `rejected`, `issued`, `confirmed`

---

### Code Changes (Post-Migration Alignment)

#### `onboarding.service.ts`
- All references to `document_submissions` replaced with `onboarding_documents`
- `getMySession` grouped object now includes `profile_items` and `welcome` arrays (previously silently dropped)
- `getAllTemplates` enriches each result with `position_name` and `department_name` via sequential lookups
- `createTemplate` validates `position_id` against `job_positions` and `department_id` against `department` before inserting
- New methods: `getAllPositions()`, `createPosition()`, `getDepartments()`

#### `admin-onboarding.controller.ts`
- New endpoints: `GET /positions`, `POST /positions`, `GET /departments`

#### `onboarding.types.ts` (web frontend)
- `OnboardingSession` now includes `profile_items: OnboardingItemBase[]` and `welcome: OnboardingItemBase[]`
- `OnboardingTemplate` now includes optional `position_name` and `department_name`
- New interfaces: `JobPosition`, `Department`

#### `onboardingApi.ts` (web frontend)
- New functions: `getAllPositions()`, `createPosition()`, `getDepartments()`

#### `OnboardingProcess.tsx`
- All session array accesses use defensive `|| []` defaults
- `approvedCount` now includes `welcomeItems` (confirmed) and `profileItems` (confirmed)

#### `SystemAdminView.tsx`
- Removed all static hardcoded `initialDepartments` and `initialPositions`
- Departments and positions loaded from API on mount
- Template table shows `department_name` / `position_name` instead of raw UUIDs
- `createPosition` calls the API instead of local state only

#### Mobile screens
- `EmployeeOnboardingScreen`: `profile_items` and `welcome` added to local type; all tab arrays use `|| []`
- `SystemAdminOnboardingScreen`: template cards show `position_name`, `department_name`, and profile/welcome chip counts

---

### Known Notes / Gotchas

#### `department` table is singular
The Supabase table is named `department` (not `departments`). All queries use `.from('department')`.

#### `job_positions` vs `/positions` endpoint
The Supabase table is `job_positions`. The API route is `/onboarding/system-admin/positions` (shortened for the endpoint path). They refer to the same data.

#### `profile` and `welcome` tab_category items
These were previously silently dropped from the `getMySession` response. They are now returned in `profile_items` and `welcome` arrays respectively. Ensure any new frontend code accesses these defensively (`session.profile_items || []`).

#### Storage bucket
The Supabase storage bucket is named `onboarding-documents` (with a hyphen). It is private — all file access uses signed URLs valid for 7 days.

#### TypeScript `enriched` arrays
In `onboarding.service.ts`, any loop that builds an `enriched` array must be explicitly typed as `any[]` to avoid TypeScript inferring `never[]`:
```ts
const enriched: any[] = [];
```
