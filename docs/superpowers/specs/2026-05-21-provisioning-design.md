# Company Instance Provisioning — Design Spec

**Date:** 2026-05-21  
**Branch:** sprint5-provisioning-test  
**Status:** Approved

---

## Problem

After a company pays and Phase 1 provisioning runs (company row + System Admin user + invite email), there is no dedicated infrastructure instance tracking or per-company schema isolation. The super admin has no way to manually trigger schema provisioning and no visibility into instance status.

---

## What We Are Building

A two-phase provisioning system:

- **Phase 1** (existing, unchanged): Fires automatically on payment confirm. Creates company row, tenant_config, tenant_modules, System Admin user_profile, user_invite, sends emails.
- **Phase 2** (new): Super admin reviews the paid subscription in the portal and presses **"Provision Instance"**. This creates a per-company Supabase schema, seeds default data, and records the instance as active.

---

## Architecture

```
Company pays
  → confirmPayment() → provisionTenant()   [Phase 1, sync, unchanged]
  → instances row created, status: provisioning

Super Admin portal
  → views subscription (payment_status: Paid)
  → presses "Provision Instance"
  → POST /super-admin/subscriptions/:reg_id/provision
  → creates instances row
  → fires GitHub Actions workflow_dispatch (GHA_PAT)
  → returns { instance_id, status: 'provisioning' }

GitHub Actions (provision-instance.yml)
  → creates schema hris_{slug} in Supabase
  → runs seeds/defaults.sql scoped to schema
  → on success: PATCH /internal/instances/:id/activate
  → on failure: PATCH /internal/instances/:id/fail

Super admin polls GET /provisioning/instances/:id/status every 3s
  → status flips: provisioning → active (or failed)
```

---

## Database

### New table: `instances`

```sql
CREATE TABLE IF NOT EXISTS instances (
  instance_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES company(company_id),
  status         text NOT NULL DEFAULT 'provisioning',
  schema_name    text NOT NULL,
  access_url     text,
  error_message  text,
  gha_run_id     bigint,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instances_company_id ON instances(company_id);
```

Status values: `provisioning` | `active` | `failed`

---

## NestJS Changes

### Two separate NestJS apps

| App | Repo | Port | Purpose |
|-----|------|------|---------|
| `tribeX-hris-auth-api` | sprint5 | 3000 | Main HRIS backend — hosts instances table migration + seed file only |
| `backend` | blues-clues-hris-superadmin | 5010 | Super admin backend — owns ALL provisioning logic + GHA callbacks |

Both apps share the **same Supabase database**.

### Super admin backend changes (`blues-clues-hris-superadmin/backend/`)

**Modified: `src/subscriptions/subscriptions.service.ts`**

New methods:

| Method | Does |
|--------|------|
| `provision(registrationId)` | Validate paid + no existing instance → insert instances row → trigger GHA |
| `triggerGHAWorkflow(inputs)` | POST to GitHub API `workflow_dispatch` |
| `getInstance(registrationId)` | Join company_registrations + instances, return instance status |
| `markActive(instanceId)` | UPDATE instances SET status = 'active' |
| `markFailed(instanceId, error)` | UPDATE instances SET status = 'failed', error_message |

**Modified: `src/subscriptions/subscriptions.controller.ts`**

New endpoints (all under global prefix `super-admin`):

| Method | Path | Auth | Called by |
|--------|------|------|-----------|
| `POST` | `/subscriptions/:id/provision` | `SuperAdminGuard` | Super admin presses button |
| `GET` | `/subscriptions/:id/instance` | `SuperAdminGuard` | Frontend polling every 3s |
| `PATCH` | `/internal/instances/:id/activate` | `x-internal-secret` header | GHA on success |
| `PATCH` | `/internal/instances/:id/fail` | `x-internal-secret` header | GHA on failure |

`/internal/*` endpoints bypass `SuperAdminGuard`, check `x-internal-secret` header only.

`provision()` flow:
1. Fetch registration — `payment_status` must be `'Paid'`
2. Fetch `company_id` + `slug` from `company` table
3. Check no existing instance for this `company_id` (return 409 if exists)
4. Insert `instances` row → status: `provisioning`
5. Call `triggerGHAWorkflow({ company_id, company_slug, admin_email, instance_id })`
6. Return `{ instance_id, status: 'provisioning' }`

### Main backend changes (`tribeX-hris-auth-api/`)

Only two new files:
- `sql/2026-05-21_instances_table.sql` — creates `instances` table in Supabase
- `sql/seeds/defaults.sql` — seed data GHA runs per new company schema

---

## GitHub Actions Workflow

**File:** `blues-clues-hris-superadmin/.github/workflows/provision-instance.yml`  
(Workflow lives in super admin repo — that's the repo `GH_REPO` points to, so `workflow_dispatch` triggers it there.)

```yaml
name: Provision Company Instance
on:
  workflow_dispatch:
    inputs:
      company_id:   { required: true }
      company_slug: { required: true }
      admin_email:  { required: true }
      instance_id:  { required: true }

jobs:
  provision:
    runs-on: ubuntu-latest
    env:
      SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
      INTERNAL_API_URL: ${{ secrets.INTERNAL_API_URL }}
      INTERNAL_API_SECRET: ${{ secrets.INTERNAL_API_SECRET }}
    steps:
      - uses: actions/checkout@v4

      - name: Create company schema
        run: |
          psql "$SUPABASE_DB_URL" -c \
            "CREATE SCHEMA IF NOT EXISTS hris_${{ inputs.company_slug }}"

      - name: Seed default data
        run: |
          psql "$SUPABASE_DB_URL" \
            -v schema=hris_${{ inputs.company_slug }} \
            -v company_id=${{ inputs.company_id }} \
            -f sql/seeds/defaults.sql

      - name: Activate instance
        if: success()
        run: |
          curl -sf -X PATCH \
            "$INTERNAL_API_URL/internal/instances/${{ inputs.instance_id }}/activate" \
            -H "x-internal-secret: $INTERNAL_API_SECRET" \
            -H "Content-Type: application/json"

      - name: Mark failed
        if: failure()
        run: |
          curl -sf -X PATCH \
            "$INTERNAL_API_URL/internal/instances/${{ inputs.instance_id }}/fail" \
            -H "x-internal-secret: $INTERNAL_API_SECRET" \
            -H "Content-Type: application/json" \
            -d "{\"error\":\"GHA provision job failed\"}"
```

---

## Seeds File: `sql/seeds/defaults.sql`

Run inside the new company schema. Seeds:
- Default roles: `HR Manager`, `Employee`, `Recruiter`
- Default departments: `General`, `IT`, `HR`, `Finance`, `Operations`
- Default leave types: `Sick Leave`, `Vacation Leave`, `Emergency Leave`
- Default work schedule: 8am–5pm, Mon–Fri

---

## Super Admin Frontend (blues-clues-hris-superadmin/frontend)

### Subscriptions list page changes (`src/app/super-admin/subscriptions/page.tsx`)
- Add `instance_status` column to table (from `GET /subscriptions/:id/instance`)
- Add "Provision" button in Actions column — visible only if `payment_status = 'Paid'` AND `instance_status` is null/missing
- On click: `POST /subscriptions/:id/provision` → open provision status drawer/modal

### New provision status panel (inline in subscriptions page)
- Opens as slide-over drawer when "Provision" clicked or row is provisioning
- Polls `GET /subscriptions/:id/instance` every 3s while status = `provisioning`

```
[Paid — Not Provisioned]  → "Provision Instance" button (blue)
[Provisioning...]         → spinner + "Setting up instance..." (auto-polls every 3s)
[Active]                  → green badge + schema_name + access_url
[Failed]                  → red badge + error_message + "Retry" button
```

All API calls go through existing `api` axios instance → `http://localhost:5010/super-admin/...`

---

## Environment Variables

### `blues-clues-hris-superadmin/backend/.env` additions
```
GH_PAT=ghp_xxxxxxxxxxxx
GH_OWNER=dreiiiiim
GH_REPO=blues-clues-hris-superadmin
INTERNAL_API_SECRET=replace-with-random-string
```

### GitHub Actions Secrets (blues-clues-hris-superadmin repo settings)
```
SUPABASE_DB_URL     → Supabase → Settings → Database → URI (Transaction Pooler mode)
INTERNAL_API_URL    → ngrok URL for super admin backend (port 5010) for local test
INTERNAL_API_SECRET → same value as in .env
```

---

## Security

- `/internal/*` endpoints never exposed publicly — require `x-internal-secret` header
- GH_PAT stored only in `.env`, never committed
- `INTERNAL_API_SECRET` is a shared secret between GHA and NestJS
- Super admin endpoints guarded by `SuperAdminGuard` (existing JWT + role check)

---

## Failure Handling

| Failure point | What happens |
|---------------|-------------|
| GHA not triggered (GitHub API error) | `triggerGHAWorkflow` throws, caught in service, instance stays `provisioning`, logged |
| Schema creation fails | GHA step fails → mark-failed step runs → instance → `failed` |
| Seed fails | Same as above |
| Callback fails (backend unreachable) | GHA step fails → mark-failed runs → instance → `failed` |
| Double-provision attempt | Guard check in provision endpoint returns 409 |

---

## Test Checklist

1. Company registers → pays → super admin sees "Paid — Not Provisioned"
2. Super admin clicks "Provision Instance"
3. GitHub Actions tab shows workflow running
4. Supabase Database → Schemas → `hris_{slug}` appears
5. `instances` table row status = `active`
6. Super admin detail page shows green "Active" badge + schema name
7. Failure case: break seed SQL → instance shows `failed` with error message
