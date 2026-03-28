# Developer Revision Guide
**Blues-Clues HRIS — Sprint Revision Tasks**
Branch: `claude/timekeeping-confirmations-absence-vqcW8`

---

## Overview

This guide covers two focused revision areas based on the chapter lead review and the Sir consultation on audit logs:

1. **Timekeeping UX Changes** — confirmation dialogs, absent reason column, time-out + sign-out option
2. **Admin Audit Logs — Soft Link Architecture** — replacing foreign keys with snapshot text fields

Read the relevant section for your task. Each section includes exact file paths, what to change, and code samples.

---

## Part 1 — Timekeeping Changes

**Assigned to: Neal, Dre**
**Affects:** Mobile (`blues-clues-hris-mobile`) + Web Frontend (`frontend/blues-clues-hris-frontend-web`)
**No backend changes required** — the existing `POST /timekeeping/time-in` and `POST /timekeeping/time-out` endpoints already work correctly.

---

### 1A — Confirmation Dialog for Time In

**File (mobile):** `blues-clues-hris-mobile/src/screens/EmployeeTimekeepingScreen.tsx`

**What to change:**
Replace the direct `handlePunch("time-in")` call inside the Clock In button's `onPress` with a confirmation `Alert` before actually punching.

**Current code (~line 155):**
```tsx
onPress={() => handlePunch("time-in")}
```

**Replace with:**
```tsx
onPress={() => {
  Alert.alert(
    "Confirm Time In",
    "Are you sure you want to clock in now?",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Clock In", style: "default", onPress: () => handlePunch("time-in") },
    ]
  );
}}
```

**File (web frontend):** `frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/employee/` *(check if there's an employee timekeeping page — add a confirmation modal/dialog there too using shadcn's `AlertDialog` component)*

---

### 1B — Confirmation Dialog for Time Out + Sign Out Option

**File (mobile):** `blues-clues-hris-mobile/src/screens/EmployeeTimekeepingScreen.tsx`

**What to change:**
The Clock Out button should show a confirmation dialog with two options:
- **Clock Out Only** — records the time-out punch and stays logged in
- **Clock Out & Sign Out** — records the time-out punch, then navigates to the login screen

**Replace the Clock Out button's `onPress`:**
```tsx
onPress={() => {
  Alert.alert(
    "Confirm Time Out",
    "Do you want to clock out or clock out and sign out?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clock Out",
        style: "default",
        onPress: () => handlePunch("time-out"),
      },
      {
        text: "Clock Out & Sign Out",
        style: "destructive",
        onPress: async () => {
          await handlePunch("time-out");
          // Navigate to login — adjust screen name to match your navigator
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        },
      },
    ]
  );
}}
```

> **Note:** Check the navigator in `blues-clues-hris-mobile/src/navigation/` to confirm the correct screen name for Login (currently appears to be `"Login"`).

**For the web frontend**, add a shadcn `AlertDialog` with two action buttons ("Clock Out" and "Clock Out & Sign Out") before calling the time-out API. The sign-out flow should call your existing logout/session clear utility then redirect to `/login`.

---

### 1C — Reason for Absent Column in HR Dashboard

**What to add:** A new `"Reason"` column in the HR timekeeping table for employees whose status is `"absent"`.

#### Step 1 — Backend: Add `absent_reason` field support

**File:** `tribeX-hris-auth-api/src/timekeeping/dto/time-punch.dto.ts`

No change needed here — absent reasons are submitted separately, not on punch.

**Add a new endpoint** or extend the existing timesheet to carry absent reasons. The simplest approach: create a new Supabase table `attendance_absent_reasons` and a new endpoint.

**New Supabase table (run in SQL editor):**
```sql
create table attendance_absent_reasons (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  date date not null,
  reason text not null,
  filed_at timestamptz default now(),
  unique (employee_id, date)
);
```

**New DTO:** `tribeX-hris-auth-api/src/timekeeping/dto/absent-reason.dto.ts`
```ts
import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class AbsentReasonDto {
  @IsDateString()
  date: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
```

**New method in `timekeeping.service.ts`:**
```ts
async fileAbsentReason(userId: string, dto: AbsentReasonDto) {
  const supabase = this.supabaseService.getClient();
  const employeeId = await this.getEmployeeId(userId);
  if (!employeeId) throw new BadRequestException('Employee profile not found.');

  const { error } = await supabase
    .from('attendance_absent_reasons')
    .upsert({ employee_id: employeeId, date: dto.date, reason: dto.reason });

  if (error) throw new Error(error.message);
  return { success: true };
}

async getAbsentReasons(companyId: string, date: string) {
  const supabase = this.supabaseService.getClient();
  const employees = await this.getEmployeeUsers(companyId);
  const employeeIds = employees.map(e => e.employee_id).filter(Boolean);

  const { data, error } = await supabase
    .from('attendance_absent_reasons')
    .select('employee_id, date, reason, filed_at')
    .in('employee_id', employeeIds)
    .eq('date', date);

  if (error) throw new Error(error.message);
  return data ?? [];
}
```

**New routes in `timekeeping.controller.ts`:**
```ts
@Post('absent-reason')
@ApiOperation({ summary: 'Employee: File a reason for being absent' })
fileAbsentReason(@Body() dto: AbsentReasonDto, @Req() req: any) {
  return this.timekeepingService.fileAbsentReason(req.user.sub_userid, dto);
}

@Get('absent-reasons')
@UseGuards(RolesGuard)
@Roles(...HR_AND_ABOVE)
@ApiOperation({ summary: 'HR/Manager: Get absent reasons for a date' })
@ApiQuery({ name: 'date', required: true, example: '2026-03-28' })
getAbsentReasons(@Req() req: any, @Query('date') date: string) {
  return this.timekeepingService.getAbsentReasons(req.user.company_id, date);
}
```

#### Step 2 — Frontend: Add "Reason" column to HR Timekeeping table

**File:** `frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/hr/timekeeping/page.tsx`

1. **Fetch absent reasons** alongside the existing two fetches inside the `useEffect`:
```ts
authFetch(`${API_BASE_URL}/timekeeping/absent-reasons?date=${dateStr}`)
  .then(r => r.json() as Promise<{ employee_id: string; reason: string }[]>)
```

2. **Merge reasons into `RosterEntry`** — add an optional `absent_reason?: string | null` field and pass it through `buildFullRoster`.

3. **Add a new table column header** `"Reason"` after the `"GPS"` column header:
```tsx
<th className="px-6 py-4">Reason</th>
```

4. **Render the reason cell** in each table row:
```tsx
<td className="px-6 py-4 text-xs text-muted-foreground max-w-[160px] truncate">
  {log.status === "absent" ? (log.absent_reason ?? "—") : "—"}
</td>
```

5. **Update `colSpan`** on all placeholder `<tr>` cells from `6` to `7`.

#### Step 3 — Mobile: Add "Reason" to HROfficerTimekeepingScreen + ManagerTimekeepingScreen

**Files:**
- `blues-clues-hris-mobile/src/screens/HROfficerTimekeepingScreen.tsx`
- `blues-clues-hris-mobile/src/screens/ManagerTimekeepingScreen.tsx`

In the absent-employee rows, fetch from the new `GET /timekeeping/absent-reasons?date=...` endpoint and display the reason below the "Absent" badge.

---

## Part 2 — Admin Audit Logs: Soft Link Architecture

**Context:** Sir recommended that `admin_audit_logs` should NOT use a foreign key for `performed_by` (the admin's user_id). Instead, it should store a **snapshot** of the admin's identifying information at the time of the action, so that if the admin user is deleted, the historical record is still readable.

**Current architecture:**
```
admin_audit_logs.performed_by  →  TEXT  (stores user_id as string, no FK constraint currently)
admin_audit_logs.target_user_id →  TEXT  (same)
```

Looking at the current `audit.service.ts`, `performed_by` already stores a `string` (user_id). The issue is that querying the logs requires a JOIN to `user_profile` to get the admin's name — and if that user is deleted, the name is lost.

**Proposed fix: Store name snapshot at insert time.**

---

### Step 1 — Update Supabase table

Run this migration in the Supabase SQL editor:

```sql
-- Add snapshot columns to preserve historical identity
alter table admin_audit_logs
  add column if not exists performed_by_name text,
  add column if not exists performed_by_email text,
  add column if not exists target_user_name text;

-- Index for fast lookups (optional but helpful)
create index if not exists idx_audit_performed_by on admin_audit_logs(performed_by);
```

> **Important:** Do NOT add a `REFERENCES` foreign key constraint on `performed_by`. Keep it as plain `TEXT`. This is the "soft link" — it stores the ID for reference but has no hard FK dependency.

---

### Step 2 — Update `AuditService.log()`

**File:** `tribeX-hris-auth-api/src/audit/audit.service.ts`

Update the `log()` method signature to accept snapshot data:

```ts
async log(
  action: string,
  performedBy: string,
  options?: {
    performedByName?: string;
    performedByEmail?: string;
    targetUserId?: string;
    targetUserName?: string;
  }
) {
  const { error } = await this.supabaseService
    .getClient()
    .from('admin_audit_logs')
    .insert({
      action,
      performed_by: performedBy,
      performed_by_name: options?.performedByName ?? null,
      performed_by_email: options?.performedByEmail ?? null,
      target_user_id: options?.targetUserId ?? null,
      target_user_name: options?.targetUserName ?? null,
    });

  if (error) {
    console.error('[AuditService] Failed to write audit log:', error.message);
  }
}
```

---

### Step 3 — Pass snapshot data everywhere `AuditService.log()` is called

Search the codebase for all existing calls to `auditService.log(` and update them to pass the admin's name/email from the JWT payload.

**Example — in any controller that calls audit logging:**
```ts
// Before
await this.auditService.log('UPDATE_USER', req.user.sub_userid, targetUserId);

// After
await this.auditService.log('UPDATE_USER', req.user.sub_userid, {
  performedByName: req.user.name,        // from JWT payload
  performedByEmail: req.user.email,      // from JWT payload
  targetUserId: targetUserId,
  targetUserName: targetUser.first_name + ' ' + targetUser.last_name,
});
```

> Check `tribeX-hris-auth-api/src/auth/` to confirm which fields are in `req.user` from your JWT strategy. Typically `sub_userid`, `email`, `name`, `role`.

---

### Step 4 — Update `AuditService.getLogs()` response

**File:** `tribeX-hris-auth-api/src/audit/audit.service.ts`

The `getLogs()` method uses `select('*')` so it will automatically return the new columns with no changes needed. Verify the frontend renders `performed_by_name` and `performed_by_email`.

---

### Step 5 — Update the frontend and mobile audit log display

**Web Frontend:**
- `frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/system-admin/` (find the audit logs page)
- Replace displaying just `performed_by` (a raw UUID) with `performed_by_name` (human-readable name)
- Show `performed_by_email` as a secondary line or tooltip
- For deleted users, the name snapshot will still be present, so display it as-is (no UUID fallback needed)

**Mobile:**
- `blues-clues-hris-mobile/src/screens/SystemAdminAuditLogsScreen.tsx`
- Same change: display `performed_by_name ?? performed_by` and `performed_by_email` instead of raw UUIDs

---

### Why This Approach

| | Foreign Key | Soft Link (Current Recommendation) |
|---|---|---|
| Admin deleted | Record broken / JOIN fails | Name/email snapshot preserved |
| Query performance | Requires JOIN | Direct read, no JOIN needed |
| Historical accuracy | Loses name if user is renamed | Snapshot is immutable at insert time |
| Referential integrity | Enforced by DB | Not enforced — acceptable for audit logs |

Audit logs are **write-once, append-only records**. They must preserve the state at the time of the action, not reflect current state. Soft links (plain text snapshots) are the correct pattern for this.

---

## File Reference Summary

| Task | File(s) |
|---|---|
| Time In confirmation (mobile) | `blues-clues-hris-mobile/src/screens/EmployeeTimekeepingScreen.tsx` |
| Time Out + Sign Out (mobile) | `blues-clues-hris-mobile/src/screens/EmployeeTimekeepingScreen.tsx` |
| Absent reason — backend DTO | `tribeX-hris-auth-api/src/timekeeping/dto/absent-reason.dto.ts` *(new)* |
| Absent reason — backend service | `tribeX-hris-auth-api/src/timekeeping/timekeeping.service.ts` |
| Absent reason — backend controller | `tribeX-hris-auth-api/src/timekeeping/timekeeping.controller.ts` |
| Absent reason — HR web dashboard | `frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/hr/timekeeping/page.tsx` |
| Absent reason — HR/Manager mobile | `blues-clues-hris-mobile/src/screens/HROfficerTimekeepingScreen.tsx`, `ManagerTimekeepingScreen.tsx` |
| Audit logs — DB migration | Supabase SQL editor |
| Audit logs — service update | `tribeX-hris-auth-api/src/audit/audit.service.ts` |
| Audit logs — frontend display | `frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/system-admin/` |
| Audit logs — mobile display | `blues-clues-hris-mobile/src/screens/SystemAdminAuditLogsScreen.tsx` |

---

*Generated: 2026-03-28 | Branch: `claude/timekeeping-confirmations-absence-vqcW8`*
