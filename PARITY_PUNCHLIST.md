# Mobile vs Web Parity Punch List

Last reviewed: 2026-05-19

## Summary

This is a route-surface and implementation-parity audit between:

- `blues-clues-hris-mobile/`
- `frontend/blues-clues-hris-frontend-web/`

Headline:

- Route count is only roughly comparable after excluding web-only public/support/business pages.
- Functional parity is still incomplete.
- The biggest gaps are `admin` on mobile, applicant verification flow, HR sub-role access rules, and several mobile pages that are summary viewers instead of full workflows.

## Counts

### Mobile

- Total stack routes: `50`
- Source: `blues-clues-hris-mobile/src/navigation/AppNavigator.tsx`

Breakdown:

- Auth: `4`
- Employee: `10`
- Manager: `7`
- HR: `11`
- Applicant: `6`
- System Admin: `12`
- Admin: `0` real routes

### Web

- Total `page.tsx` routes: `56`
- Source root: `frontend/blues-clues-hris-frontend-web/src/app/`

Relevant web-only extra pages not mirrored in mobile:

- `/`
- `/subscribe`
- `/renewals`
- `/set-password`
- `/careers/[slug]`
- `/super-admin/dashboard`

If those pages are excluded, the comparable route surface is close to mobile, but not functionally equal.

## Route-Level Status

Legend:

- `full`: clear dedicated mobile counterpart
- `partial`: mobile exists but is simplified, read-only, or generic
- `missing`: no real mobile equivalent

### Employee

| Area | Status | Notes |
| --- | --- | --- |
| Dashboard | `full` | Dedicated in both apps |
| Timekeeping | `full` | Dedicated mobile screen |
| Leave | `full` | Dedicated mobile form flow |
| Overtime | `full` | Dedicated mobile form flow |
| Profile | `partial` | Mobile is backend-summary style |
| Payslips | `partial` | Mobile shows history/summary, not clearly full workflow |
| Documents | `partial` | Generic viewer-style implementation |
| Performance | `partial` | Generic summary implementation |
| Onboarding | `full` | Dedicated in both |
| Offboarding | `full` | Dedicated in both |

### Manager

| Area | Status | Notes |
| --- | --- | --- |
| Dashboard | `full` | Dedicated in both |
| Team | `full` | Dedicated in both |
| Timekeeping | `full` | Dedicated in both |
| Approvals | `full` | Dedicated in both |
| Performance | `partial` | Mobile uses expanded generic screen |
| Offboarding | `partial` | Mobile exists, lighter than web |
| Payslips | `partial` | Web redirects to employee payslips; mobile treats it as standalone |

### HR

| Area | Status | Notes |
| --- | --- | --- |
| Dashboard | `full` | Dedicated in both |
| Timekeeping | `full` | Dedicated in both |
| Jobs / Recruitment | `full` | Mobile has recruitment/jobs surface |
| Candidates | `full` | Mobile has candidate evaluation screen |
| Onboarding | `full` | Dedicated in both |
| Approvals | `full` | Dedicated in both |
| Offboarding | `partial` | Mobile is generic summary style |
| Payroll | `partial` | Mobile is not full management flow |
| Performance | `partial` | Mobile is generic summary style |
| Payslips | `partial` | Exists, but not with web-level role handling |

### Applicant

| Area | Status | Notes |
| --- | --- | --- |
| Dashboard | `full` | Dedicated in both |
| Jobs | `full` | Dedicated in both |
| Applications | `full` | Dedicated in both |
| Profile | `partial` | Mobile is generic backend-summary style |
| Onboarding | `partial` | Mobile looks checklist/session driven |
| Resume Upload | `partial` | Present on mobile, but web flow is distributed |
| Verify Email | `missing` | Web-only route |
| Public Job Detail | `missing` | Web has `/careers/[slug]` |

### System Admin

| Area | Status | Notes |
| --- | --- | --- |
| Dashboard | `full` | Dedicated in both |
| Timekeeping | `partial` | Mobile is overview style |
| Users | `full` | Dedicated in both |
| Onboarding | `full` | Dedicated in both |
| Offboarding | `partial` | Mobile is overview style |
| Approvals | `partial` | Mobile is queue summary style |
| Compensation Settings | `partial` | Mobile reads config but not clearly full admin UX |
| Subscriptions | `partial` | Mobile lists plans; web has broader surrounding flow |
| Performance Settings | `partial` | Mobile appears data-view heavy |
| Settings / Role Permissions | `partial` | Mobile is settings summary, not clear full controls |
| Audit Logs | `full` | Dedicated mobile screen exists |

### Admin

| Area | Status | Notes |
| --- | --- | --- |
| Dashboard | `missing` | Web has `/admin`; mobile has no real route |
| Users | `missing` | Web has `/admin/users`; mobile has no real route |
| Audit Logs | `missing` | Config exists in mobile, route does not |
| Subscriptions | `missing` | Config exists in mobile, route does not |

## Confirmed Gaps

### P0

#### 1. Mobile `admin` role is not wired end-to-end

Why it matters:

- This is a hard parity break.
- Mobile declares `admin` in auth and menu config, but there are no admin screens in the navigator.

Evidence:

- `blues-clues-hris-mobile/src/services/auth.ts`
- `blues-clues-hris-mobile/src/constants/config.ts`
- `blues-clues-hris-mobile/src/navigation/AppNavigator.tsx`

Fix:

- Add real mobile admin routes, or
- Remove/hide `admin` from mobile until supported

Effort: `M`

#### 2. Applicant verify-email flow is web-only

Why it matters:

- Applicant auth journey differs by platform.
- Creates inconsistent onboarding and registration behavior.

Evidence:

- `frontend/blues-clues-hris-frontend-web/src/app/(portal)/applicant/verify-email/page.tsx`

Fix:

- Add a mobile verification screen and deep-link path, or
- Move verification to a shared backend-driven flow that works on both platforms

Effort: `M`

#### 3. HR sub-role access control is not mirrored on mobile

Why it matters:

- Web filters page access by HR role name.
- Mobile shows one broad HR menu, which risks overexposure of features.

Evidence:

- `frontend/blues-clues-hris-frontend-web/src/components/layout/Sidebar.tsx`
- `frontend/blues-clues-hris-frontend-web/src/lib/hrRoleAccess.ts`
- `blues-clues-hris-mobile/src/constants/config.ts`

Fix:

- Port `hrRoleAccess` rules into mobile navigation/menu filtering
- Ensure route guards match web behavior

Effort: `M`

### P1

#### 4. Several mobile screens are generic backend summaries, not full workflows

Why it matters:

- Route counts can look equal while behavior is still behind the web app.
- Users may reach screens that only summarize data without full actions.

Evidence:

- `blues-clues-hris-mobile/src/screens/ExpandedScreens.tsx`

Likely affected areas:

- Employee profile
- Employee payslips
- Employee documents
- Employee performance
- Manager performance
- Manager offboarding
- Manager payslips
- HR offboarding
- HR payroll
- HR performance
- HR payslips
- System admin settings/timekeeping/offboarding/approvals/compensation/subscriptions/performance settings

Fix:

- Replace generic cards-only screens with role-specific feature flows where parity matters
- Keep summary screens only where the web route is also mostly read-only

Effort: `L`

#### 5. Payroll/settings flows are still web-first in mobile

Why it matters:

- Mobile explicitly points users back to web for some actions.
- This is partial parity by definition.

Evidence:

- `blues-clues-hris-mobile/src/screens/ExpandedScreens.tsx`
  - "Run payroll from the web portal."
  - "Set baselines from the web portal."

Fix:

- Decide which admin workflows are intentionally web-only
- If intentional, document that as product scope
- If not intentional, implement missing mobile actions

Effort: `M` to `L`

### P2

#### 6. Web has extra public/business/support pages with no mobile equivalent

Pages:

- `/subscribe`
- `/renewals`
- `/set-password`
- `/careers/[slug]`
- `/super-admin/dashboard`
- `/`

Why it matters:

- These inflate web route count.
- Some may be intentionally web-only rather than true parity gaps.

Fix:

- Mark each page as either:
  - `web-only by design`, or
  - `needs mobile parity`

Effort: `S`

#### 7. Route naming and duplication are not cleanly aligned

Examples:

- Mobile has both `HROfficerRecruitment` and `HROfficerJobs`
- Mobile has both `SystemAdminBilling` and `SystemAdminSubscriptions`, but they point to the same screen
- Web manager/hr payslips redirect to employee payslips

Why it matters:

- Inflates perceived parity
- Makes audits and maintenance harder

Fix:

- Normalize route naming
- Remove duplicate aliases unless product intentionally needs them
- Document redirects/shared pages explicitly

Effort: `S`

## Recommended Order

1. Fix or remove unsupported mobile `admin`
2. Mirror HR sub-role access restrictions on mobile
3. Add applicant verify-email parity decision and implementation
4. Decide which system-admin and payroll flows are intentionally web-only
5. Replace highest-value generic mobile summary screens with true feature flows
6. Normalize route naming and duplicate route aliases
7. Document permanent web-only pages

## Suggested Definition Of Parity

Use this to avoid future ambiguity:

- Same role can access the same allowed modules on both platforms
- Same critical user journeys complete successfully on both platforms
- Mobile may simplify layout, but not remove required actions
- Any intentionally web-only flow must be explicitly documented

## Suggested Follow-Up Tasks

### Task 1: Hard parity blockers

- Wire mobile `admin` properly or remove it
- Add mobile HR sub-role filtering
- Decide and implement applicant verify-email strategy

### Task 2: Product scope clarification

- Label each web-only route as `web-only by design` or `missing on mobile`

### Task 3: Replace summary screens

- Start with:
  - HR payroll
  - System admin settings
  - Employee profile
  - Employee documents
  - Manager performance

