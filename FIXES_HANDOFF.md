# HRIS Gap Fixes — Developer Handoff
**Date:** May 17, 2026  
**Based on:** HRIS Architecture Audit Report v2 (Schema-Verified)  
**Branch source:** `Adrian_merge-main`  
**Fixed by:** Claude (Anthropic) — automated patch  

---

## What This Document Is

This doc explains every code and schema change made to close the 9 confirmed gaps from the v2 audit report. It also lists the **manual steps** a developer must complete before the fixes go live — specifically around `LeaveAccrualService`, which is a new module that needs to be registered.

---

## Files Changed

### 1. `tribeX-hris-auth-api/src/performance/performance.service.ts`
**Gap closed:** GAP-6.1 — Merit increase was syncing as a benefit row only, never mutating `basic_salary` or writing an audit trail.

**What changed:** Inside `syncRewardIntoPayroll()`, after the `cnb_employee_benefits` insert, a new block was added for `reward_type === 'MERIT_INCREASE'` that:
1. Reads the employee's most recent `cnb_salary_baselines` row
2. Decrypts the `basic_salary`, adds the merit amount, and inserts a **new** `cnb_salary_baselines` row with `effective_date = today`
3. Writes a `cnb_audit_trail` entry with `action_type = 'MERIT_INCREASE'`, `old_value = { basic_salary: X }`, `new_value = { basic_salary: Y, perf_eval_id: Z, merit_amount: N }`

**Nothing else in the file was touched.**

---

### 2. `tribeX-hris-auth-api/src/users/users.service.ts`
**Gap closed:** GAP-4.3 — `personal_notes` field (employee self-service item #7) was missing from schema and `updateMe()`.

**What changed:** In `updateMe()`:
- Added `personal_notes?: string` to the method parameter type
- Added `'personal_notes'` to the `allowed` fields array
- Added `personal_notes` to the Supabase `.select()` projection so it's returned in the response

> **Reminder:** The SQL migration (see below) must also run to add the `personal_notes TEXT` column to `user_profile` in the database. The code change alone won't work without it.

---

### 3. `tribeX-hris-auth-api/src/offboarding/dto/configure-checklist-template.dto.ts`
**Gap closed:** GAP-7.1 — Checklist items had no `category` (Asset/Document/Task) or `is_custom` flag, so the Employee dashboard couldn't route items into the correct tabs.

**What changed:** Two new optional fields added to `ChecklistTemplateItemDto`:
- `category?: 'Asset' | 'Document' | 'Task'` — routes items into the correct Employee offboarding dashboard tab
- `is_custom?: boolean` — distinguishes tenant-added items from base template items for reporting

Also added `IsIn` to the class-validator imports.

---

### 4. `tribeX-hris-auth-api/src/offboarding/offboarding.service.ts`
**Gap closed:** GAP-7.1 (continued from DTO above)

**What changed (3 spots in this file):**

**Spot 1 — `configureChecklistTemplate()` rows mapping:**  
The insert payload for `offboarding_checklist_template_items` now includes `category` and `is_custom` from the DTO.

**Spot 2 — Default fallback checklist items:**  
When no template is found for a company, the hardcoded defaults now include a `category` value each, and `is_custom: false`:
```
Return laptop/device              → Asset
Return company ID / access card   → Asset
Knowledge transfer documentation  → Task
Clear personal files from systems → Task
Return parking pass               → Asset
```

**Spot 3 — Template compile into `checklist_items`:**  
When template items are compiled into per-case `checklist_items`, `category` and `is_custom` are now propagated from the template row instead of being dropped.

---

### 5. `tribeX-hris-auth-api/src/jobs/jobs.service.ts`
**Gap closed:** GAP-2.2 — The `Manual-Processed` badge was stored only as `ranking_mode = 'MANUAL'` (a string that gets overwritten on SFIA re-run), with no persistent flag.

**What changed:** In the manual ranking update block, `is_manually_processed: true` is now set alongside `ranking_mode: 'MANUAL'`. This field is never included in SFIA re-run updates, so the badge persists for the lifetime of the record.

> **Reminder:** The SQL migration adds `is_manually_processed BOOLEAN NOT NULL DEFAULT FALSE` to `job_application_sfia`. Make sure it runs before deploying this change.

---

### 6. `tribeX-hris-auth-api/src/leave/leave-accrual.tasks.ts` ⭐ NEW FILE
**Gap closed:** GAP-5.1, GAP-5.2, GAP-5.3 — No automated accrual engine, no `leave_config` / `leave_config_logs` tables, no year-end carry-over logic.

**What this file contains:**

`LeaveAccrualService` — an injectable NestJS service with:

| Method | Purpose |
|---|---|
| `getConfig(companyId)` | Fetch the `leave_config` row for a tenant |
| `upsertConfig(companyId, changedBy, patch)` | Create or update accrual config; writes a `leave_config_logs` entry for every changed field |
| `runMonthlyAccrual()` | `@Cron('0 0 1 * *')` — runs at midnight on the 1st of every month; credits `accrual_rate` days to every active employee's `time_leave_balances` for Vacation Leave and Sick Leave |
| `runYearEndCarryOver()` | `@Cron('0 0 1 1 *')` — runs at midnight on 1 January; applies the tenant's `year_end_rule` (RESET / CARRY_ALL / CARRY_CAP) to all balances |

---

### 7. `tribeX-hris-auth-api/sql/2026-05-17_fix_all_gaps.sql` ⭐ NEW FILE
**Schema migration covering all gaps.** Run this once against your Supabase project. It is safe to run on a fresh DB or an existing one (`IF NOT EXISTS` / `IF NOT EXISTS` guards throughout).

What it does:

| Statement | Gap |
|---|---|
| `ALTER TABLE user_profile ADD COLUMN personal_notes TEXT` | GAP-4.3 |
| `CREATE TABLE leave_config` | GAP-5.2 |
| `CREATE TABLE leave_config_logs` | GAP-5.2 |
| `ALTER TABLE offboarding_checklist_template_items ADD COLUMN category, is_custom` | GAP-7.1 |
| `ALTER TABLE checklist_items ADD COLUMN category, is_custom` | GAP-7.1 |
| `ALTER TABLE job_application_sfia ADD COLUMN is_manually_processed` | GAP-2.2 |
| `ALTER TABLE job_applications ADD COLUMN offer_document_url, offer_signed_at, offer_signature_verified` | GAP-2.3 |
| `CREATE TABLE tenant_security_config` | GAP-4.1 |
| `ALTER TABLE payroll_log ALTER COLUMN case_id DROP NOT NULL` + add `payroll_period_id` FK | GAP-4.2 |

---

## ⚠️ Manual Steps Required Before Deploying

These are things that **could not be done automatically** because they involve files outside the source code (like `app.module.ts` config wiring) or require developer judgment.

---

### STEP 1 — Run the SQL migration on Supabase
```
tribeX-hris-auth-api/sql/2026-05-17_fix_all_gaps.sql
```
Run this in the Supabase SQL editor or via your migration pipeline. Do this **before** deploying the backend — the code changes reference columns that won't exist yet without it.

---

### STEP 2 — Register `LeaveAccrualService` in `app.module.ts`

The new `LeaveAccrualService` uses `@Cron` decorators from `@nestjs/schedule`. You need to:

**A) Make sure `@nestjs/schedule` is installed:**
```bash
npm install @nestjs/schedule
```

**B) Import `ScheduleModule` in `app.module.ts`:**
```typescript
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),  // ← add this
    // ... rest of your imports
  ],
})
```

**C) Import and provide `LeaveAccrualService` in `app.module.ts`:**
```typescript
import { LeaveAccrualService } from './leave/leave-accrual.tasks';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ...
  ],
  providers: [
    LeaveAccrualService,  // ← add this
    // ...
  ],
})
export class AppModule {}
```

> If you already have `ScheduleModule.forRoot()` in the app (e.g. for the timekeeping crons), skip step B — just add `LeaveAccrualService` to providers.

---

### STEP 3 — Expose `leave_config` endpoints in a controller (optional but recommended)

`LeaveAccrualService` has `getConfig()` and `upsertConfig()` methods but no controller yet. HR needs a UI to set the accrual rate and year-end rule per tenant. Wire it up like this:

```typescript
// src/leave/leave-accrual.controller.ts

import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LeaveAccrualService } from './leave-accrual.tasks';

@Controller('leave/config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveConfigController {
  constructor(private readonly leaveAccrual: LeaveAccrualService) {}

  @Get()
  @Roles('HR_OFFICER', 'SYSTEM_ADMIN')
  getConfig(@Req() req: any) {
    return this.leaveAccrual.getConfig(req.user.company_id);
  }

  @Patch()
  @Roles('HR_OFFICER', 'SYSTEM_ADMIN')
  upsertConfig(@Req() req: any, @Body() body: any) {
    return this.leaveAccrual.upsertConfig(req.user.company_id, req.user.sub, body);
  }
}
```

Then add this controller to `app.module.ts` controllers array alongside the service.

---

### STEP 4 — Gaps left for future implementation (not in this patch)

These gaps were documented in the audit report but **not implemented** in this patch because they require third-party integrations or significant architectural decisions:

| Gap | What's needed | Notes |
|---|---|---|
| **GAP-2.1** — Pillars health-polling cron | A `PillarsHealthService` with `@Cron('*/60 * * * * *')` | Requires Pillars API health endpoint URL + Redis or DB counter for consecutive failure tracking |
| **GAP-2.3** — Digital signature on job offer | E-signature integration (e.g. DocuSign, HelloSign) | Schema columns already added by migration (`offer_document_url`, `offer_signed_at`, `offer_signature_verified`); backend logic and frontend flow still needed |
| **GAP-4.1** — `tenant_security_config` re-auth gateway | `POST /cnb/reauth` endpoint + login lockout counter | Table created by migration; the actual re-auth middleware and lockout logic still needs implementing |
| **GAP-4.2** — Regular payroll bank-run endpoint | `POST /payroll/bank-run` endpoint | `payroll_log.case_id` NOT NULL constraint dropped by migration; endpoint and bank-transfer confirmation record still needed |

---

## Quick Checklist Before Going Live

- [ ] Run `2026-05-17_fix_all_gaps.sql` on Supabase
- [ ] `npm install @nestjs/schedule` (if not already installed)
- [ ] Add `ScheduleModule.forRoot()` to `app.module.ts` imports
- [ ] Add `LeaveAccrualService` to `app.module.ts` providers
- [ ] (Recommended) Create `leave-accrual.controller.ts` and wire up the config endpoints
- [ ] Test monthly accrual by calling `runMonthlyAccrual()` manually in a test before relying on the cron
- [ ] Test year-end carry-over against a staging DB before January
- [ ] Verify merit increase flow end-to-end: approve eval → sync reward → check `cnb_salary_baselines` for new row + `cnb_audit_trail` for the entry
