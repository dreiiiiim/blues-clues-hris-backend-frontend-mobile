# Company Subscription Provisioning Plan

Stack: **NestJS + Supabase + GitHub Actions**

---

## Overview

When a company subscribes, the system triggers an automated provisioning pipeline via GitHub Actions that spins up a dedicated HRIS instance — own DB schema, default data, admin account, and subdomain.

---

## Phase 1 — Subscription Trigger (NestJS)

Extend existing `subscription.service.ts`:

**New endpoint:** `POST /subscription/provision`

Payload:
```json
{
  "company_name": "ABC Corporation",
  "plan_id": "monthly" | "annual",
  "admin_email": "admin@abc.com",
  "subdomain": "abc-corporation",
  "modules": ["recruitment", "timekeeping", "leave"]
}
```

Flow:
1. Insert `companies` record → status: `provisioning`
2. Insert `subscriptions` record linked to company
3. Insert `instances` record → status: `provisioning`
4. Fire GitHub Actions workflow via `workflow_dispatch` event with company inputs
5. Return `202 Accepted` + `instance_id` for frontend polling

---

## Phase 2 — GitHub Actions Workflow

File: `.github/workflows/provision-instance.yml`

Triggered by `workflow_dispatch` with inputs:
```yaml
inputs:
  company_id:
  company_slug:     # e.g. abc-corporation
  admin_email:
  plan_id:
  modules:          # comma-separated
```

Jobs (sequential):
| Step | Job | Action |
|------|-----|--------|
| 1 | `build` | `npm run build` on NestJS app |
| 2 | `provision-db` | Create Supabase schema `hris_{company_slug}` |
| 3 | `migrate` | Run migrations scoped to new schema |
| 4 | `seed` | Run seeding scripts with company context |
| 5 | `create-admin` | Call auth endpoint to create first admin user |
| 6 | `configure-domain` | Set subdomain DNS (Cloudflare or Vercel API) |
| 7 | `health-check` | `curl` the new subdomain, verify HTTP 200 |
| 8 | `activate` | `PATCH /internal/instances/{company_id}` → status: `active` |

On failure: `PATCH` status to `failed`, trigger alert email.

---

## Phase 3 — Per-Company Supabase Schema

Supabase supports PostgreSQL schemas natively. Per company:

```sql
CREATE SCHEMA hris_abc_corporation;
SET search_path TO hris_abc_corporation;
-- run all migrations in this schema
```

Add schema-aware provisioning in NestJS:

```ts
// src/provisioning/provisioning.service.ts
async createCompanyInstance(slug: string, companyId: string) {
  await this.supabase.rpc('create_company_schema', { slug });
  await this.runMigrations(slug);
  await this.seedDefaults(slug, companyId);
}
```

Migration files already exist in `sql/` — make them schema-aware by parameterizing `search_path`.

---

## Phase 4 — Seed Default Data

Create `src/provisioning/seeds/`:

| File | Seeds |
|------|-------|
| `default-roles.seed.ts` | Company Admin, HR Manager, Employee |
| `default-departments.seed.ts` | General, IT, HR, Finance |
| `default-leave-types.seed.ts` | Sick Leave, Vacation Leave, Emergency Leave |
| `default-settings.seed.ts` | Attendance window, overtime rules, work schedule |

Each seeder accepts `{ company_id, schema_name }` as context.

---

## Phase 5 — Admin Account Creation

After seeding, call existing auth logic (`src/auth/`):

```ts
await this.authService.createUser({
  email: admin_email,
  role: 'company_admin',
  company_id,
  schema: company_slug,
  send_invite: true,  // sends email invite with temp password
});
```

---

## Phase 6 — Subdomain + Access Link

Options (pick based on hosting):
- **Vercel** — Vercel Domains API: add `{slug}.yourdomain.com`
- **Cloudflare** — API call to create CNAME record → your server
- **Nginx** — Append server block via script, reload nginx

Store access URL in `instances.access_url` column.

---

## Phase 7 — Frontend Status Polling

After `POST /subscription/provision`:
- Frontend polls `GET /subscription/instances/{id}/status` every 3s
- Show progress steps: `Provisioning → Building → Migrating → Active`
- On `active`: show success card with access link + "Admin credentials sent to email"

---

## New Files / Folders Needed

```
src/provisioning/
  provisioning.module.ts
  provisioning.service.ts       # createCompanyInstance() lives here
  provisioning.controller.ts    # internal endpoints for GHA callbacks
  seeds/
    default-roles.seed.ts
    default-departments.seed.ts
    default-leave-types.seed.ts
    default-settings.seed.ts

.github/workflows/
  provision-instance.yml

sql/
  migrations/                   # already exists — make schema-aware
  seeds/                        # new
```

---

## Key Decisions

| Decision | Recommendation | Reason |
|----------|---------------|--------|
| Per-schema vs per-project | Per-schema (one Supabase project) | Simpler, cheaper, works on free/pro tier |
| Provisioning trigger | GitHub Actions `workflow_dispatch` | Already using GitHub, free CI minutes |
| Subdomain strategy | Wildcard DNS + dynamic routing | Scales without manual config per company |
| Failure handling | Retry + alert email + status `failed` | Panelists will ask about error states |

---

## Risk

Supabase free tier limits schema count and connection pool size. If scaling to many companies, consider upgrading to Supabase Pro or migrating to per-project provisioning via Supabase Management API (heavier but more isolated).
