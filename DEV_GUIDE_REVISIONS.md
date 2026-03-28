# Dev Revision Guide
**Blues-Clues HRIS — Sprint Revisions**

---

## Timekeeping Changes

**Scope:** Mobile app + Web frontend
**Backend:** No changes needed — existing time-in/time-out endpoints are fine as-is

---

### Confirmation Before Time In / Time Out

Before the app actually calls the punch endpoint, show the user a confirmation step first. This prevents accidental taps.

- **Time In** — show a simple "Are you sure you want to clock in?" confirmation before sending the request
- **Time Out** — show a confirmation with two options:
  - **Clock Out** — records the punch, user stays logged in
  - **Clock Out & Sign Out** — records the punch, then logs the user out and redirects to the login screen

On mobile use `Alert.alert` with the appropriate buttons. On web use a modal/dialog component.

---

### Reason for Absent — New Column in the Timekeeping Dashboard

HR and Manager views of the timekeeping table should have a new **Reason** column that shows why an employee is absent, if a reason was filed.

**How it works:**
- Employees can file an absent reason for a specific date (think of it like a short explanation — "Sick leave", "Emergency", etc.)
- HR/Manager sees this reason in the dashboard beside the employee's Absent status
- If no reason was filed, the column just shows a dash

**What needs to be built:**

**Backend:**
1. A new table in Supabase to store absent reasons — at minimum: `employee_id`, `date`, `reason`, and a timestamp. Use a unique constraint on `(employee_id, date)` so there's only one reason per employee per day.
2. An endpoint for employees to submit a reason for a given date
3. An endpoint for HR/Manager to retrieve all absent reasons for a given date (scoped to their company)

**Frontend / Mobile:**
1. Fetch the absent reasons alongside the existing timesheet data when loading the dashboard
2. Match each absent employee to their reason by `employee_id`
3. Display the reason in the new Reason column — only visible for employees with Absent status

---

## Admin Audit Logs — Soft Link Architecture

**Context:** After consulting with Sir, the recommendation is to stop relying on foreign keys for `admin_audit_logs` and instead use a soft link approach — storing identifying info as plain text snapshots.

---

### The Problem with Foreign Keys Here

Right now, `performed_by` stores the admin's `user_id`. If you ever want to display who performed an action, you need to JOIN with `user_profile`. The problem: if that admin account gets deleted, the join returns nothing and you lose the record of who did what.

Audit logs are supposed to be permanent historical records. They should not depend on the current state of the users table.

---

### The Solution — Store Snapshots at Insert Time

Instead of only storing the `user_id`, also store the admin's **name** and **email** at the time the action was logged. These are plain text columns — no foreign key, no constraint.

**Add to `admin_audit_logs` table:**
- `performed_by_name` — the admin's display name at the time of the action
- `performed_by_email` — the admin's email at the time of the action
- `target_user_name` — the name of the user who was affected (if applicable)

The existing `performed_by` column (user_id) can stay for reference — it just should not be a hard FK constraint.

**When writing a log entry**, pull the admin's name and email from the current session/token and save it alongside the action. This info is already available in the JWT payload so no extra DB call is needed.

**When reading logs**, display `performed_by_name` instead of the raw UUID. If for some reason the name is null (for older records before this change), fall back to showing the UUID.

---

### Why This Is the Right Pattern for Audit Logs

Audit logs are write-once, append-only records. Their job is to preserve what happened, who did it, and when — permanently. Using a foreign key introduces a dependency on a table that can change. Snapshots do not have that dependency. Even if the admin user is deleted, renamed, or their account is modified, the log entry stays accurate.

This is a standard pattern for any system that needs reliable audit trails.

---

### What Needs to Change

| Layer | Change |
|---|---|
| Supabase | Add `performed_by_name`, `performed_by_email`, `target_user_name` columns to `admin_audit_logs`. Remove any FK constraint on `performed_by` if one exists. |
| Backend (`audit.service.ts`) | Update the `log()` method to accept and save the name/email snapshot alongside the existing fields |
| Anywhere `auditService.log()` is called | Pass the admin's name and email from the request context (available in `req.user` from the JWT) |
| Web frontend (System Admin audit logs page) | Display `performed_by_name` instead of the raw UUID |
| Mobile (`SystemAdminAuditLogsScreen.tsx`) | Same — show the name, not the UUID |

---

*Branch: `claude/timekeeping-confirmations-absence-vqcW8`*
