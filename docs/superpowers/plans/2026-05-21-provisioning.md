# Company Instance Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the super admin press a "Provision Instance" button that creates a per-company Supabase schema, seeds default HRIS data, and tracks provisioning status via GitHub Actions.

**Architecture:** Two NestJS backends share one Supabase DB. All provisioning logic lives in `blues-clues-hris-superadmin/backend` (port 5010). GHA workflow lives in the super admin repo, checks out that repo, creates a schema, seeds data, then calls back to the super admin backend to flip the instance status. The main sprint5 backend only needs the `instances` table SQL migration.

**Tech Stack:** NestJS 11, Supabase (PostgreSQL), GitHub Actions, React Query v5, Tailwind CSS, lucide-react

---

## File Map

| File | Action | Repo |
|------|--------|------|
| `sql/2026-05-21_instances_table.sql` | Create | sprint5 |
| `sql/seeds/defaults.sql` | Create | blues-clues-hris-superadmin |
| `.github/workflows/provision-instance.yml` | Create | blues-clues-hris-superadmin |
| `backend/src/subscriptions/subscriptions.service.ts` | Modify | blues-clues-hris-superadmin |
| `backend/src/subscriptions/subscriptions.controller.ts` | Modify | blues-clues-hris-superadmin |
| `backend/src/subscriptions/internal.controller.ts` | Create | blues-clues-hris-superadmin |
| `backend/src/subscriptions/subscriptions.module.ts` | Modify | blues-clues-hris-superadmin |
| `backend/.env.example` | Modify | blues-clues-hris-superadmin |
| `frontend/src/app/super-admin/subscriptions/page.tsx` | Modify | blues-clues-hris-superadmin |

---

## Task 1: Create `instances` Table SQL Migration

**Files:**
- Create: `D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\sprint-5-merged-cicd\sprint5\tribeX-hris-auth-api\sql\2026-05-21_instances_table.sql`

- [ ] **Step 1: Create the SQL file**

```sql
-- 2026-05-21_instances_table.sql
-- Tracks per-company provisioning instances created by GHA

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

- [ ] **Step 2: Run this SQL in your Supabase project**

Open Supabase dashboard → SQL Editor → paste the SQL above → Run.

Verify: Table Editor → confirm `instances` table exists with columns `instance_id`, `company_id`, `status`, `schema_name`, `access_url`, `error_message`, `gha_run_id`, `created_at`, `updated_at`.

- [ ] **Step 3: Commit**

```bash
cd "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\sprint-5-merged-cicd\sprint5"
git add tribeX-hris-auth-api/sql/2026-05-21_instances_table.sql
git commit -m "feat(db): add instances table for company provisioning tracking"
```

---

## Task 2: Create Default Seed SQL (in super admin repo)

**Files:**
- Create: `D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\sql\seeds\defaults.sql`

This file is checked out by GHA in the super admin repo and run via `psql` with `-v company_id=<uuid>`. It seeds default departments and roles into the shared public schema, scoped by `company_id`.

- [ ] **Step 1: Create the seeds directory and SQL file**

```bash
mkdir -p "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\sql\seeds"
```

```sql
-- blues-clues-hris-superadmin/sql/seeds/defaults.sql
-- Seeded by GHA after schema creation.
-- Usage: psql "$SUPABASE_DB_URL" -v company_id=<uuid> -f sql/seeds/defaults.sql

-- Default departments (skip if already exist for this company)
INSERT INTO department (department_name, company_id)
SELECT d.name, :'company_id'::uuid
FROM (VALUES
  ('General'),
  ('IT'),
  ('HR'),
  ('Finance'),
  ('Operations')
) AS d(name)
WHERE NOT EXISTS (
  SELECT 1 FROM department WHERE company_id = :'company_id'::uuid
);

-- Default roles (HR Manager, Employee, Recruiter — System Admin already seeded by Phase 1)
INSERT INTO role (role_name, company_id)
SELECT r.name, :'company_id'::uuid
FROM (VALUES
  ('HR Manager'),
  ('Employee'),
  ('Recruiter')
) AS r(name)
WHERE NOT EXISTS (
  SELECT 1 FROM role
  WHERE company_id = :'company_id'::uuid AND role_name = r.name
);
```

- [ ] **Step 2: Commit to super admin repo**

```bash
cd "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin"
git add sql/seeds/defaults.sql
git commit -m "feat(seeds): add default departments and roles seed for provisioning"
```

---

## Task 3: Create GitHub Actions Workflow

**Files:**
- Create: `D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\.github\workflows\provision-instance.yml`

This workflow is triggered via `workflow_dispatch` from the super admin backend. It:
1. Creates a PostgreSQL schema `hris_{slug}` in Supabase (underscores, no hyphens)
2. Seeds default data using `sql/seeds/defaults.sql`
3. Calls back to the super admin backend to activate or fail the instance

**IMPORTANT:** The super admin backend must be reachable from the internet (use ngrok for local testing). `INTERNAL_API_URL` must be set as a GitHub Actions secret.

- [ ] **Step 1: Create the workflow file**

```bash
mkdir -p "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\.github\workflows"
```

```yaml
# blues-clues-hris-superadmin/.github/workflows/provision-instance.yml
name: Provision Company Instance

on:
  workflow_dispatch:
    inputs:
      company_id:
        required: true
        description: 'UUID of the company'
      company_slug:
        required: true
        description: 'URL-safe slug e.g. abc-corporation'
      admin_email:
        required: true
        description: 'Company admin email'
      instance_id:
        required: true
        description: 'UUID of the instances row to update on completion'

jobs:
  provision:
    runs-on: ubuntu-latest
    env:
      SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
      INTERNAL_API_URL: ${{ secrets.INTERNAL_API_URL }}
      INTERNAL_API_SECRET: ${{ secrets.INTERNAL_API_SECRET }}

    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Create company schema
        run: |
          SAFE_SLUG=$(echo "${{ inputs.company_slug }}" | tr '-' '_')
          psql "$SUPABASE_DB_URL" -c "CREATE SCHEMA IF NOT EXISTS hris_${SAFE_SLUG};"
          echo "Schema hris_${SAFE_SLUG} created."

      - name: Seed default data
        run: |
          psql "$SUPABASE_DB_URL" \
            -v company_id=${{ inputs.company_id }} \
            -f sql/seeds/defaults.sql
          echo "Default seed complete."

      - name: Activate instance (success)
        if: success()
        run: |
          curl -sf -X PATCH \
            "${INTERNAL_API_URL}/super-admin/internal/instances/${{ inputs.instance_id }}/activate" \
            -H "x-internal-secret: ${INTERNAL_API_SECRET}" \
            -H "Content-Type: application/json"
          echo "Instance ${{ inputs.instance_id }} activated."

      - name: Mark instance failed
        if: failure()
        run: |
          curl -s -X PATCH \
            "${INTERNAL_API_URL}/super-admin/internal/instances/${{ inputs.instance_id }}/fail" \
            -H "x-internal-secret: ${INTERNAL_API_SECRET}" \
            -H "Content-Type: application/json" \
            -d '{"error":"GHA provision job failed — check Actions logs"}'
          echo "Instance ${{ inputs.instance_id }} marked failed."
```

- [ ] **Step 2: Commit**

```bash
cd "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin"
git add .github/workflows/provision-instance.yml
git commit -m "feat(ci): add provision-instance GHA workflow"
```

- [ ] **Step 3: Push to GitHub so the workflow exists in the repo**

```bash
git push origin main
```

Verify: Open https://github.com/dreiiiiim/blues-clues-hris-superadmin → Actions tab → you should see "Provision Company Instance" workflow listed.

---

## Task 4: Update super admin backend `.env.example`

**Files:**
- Modify: `D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\backend\.env.example`

- [ ] **Step 1: Add provisioning env vars to .env.example**

Open the file and append these lines at the end:

```
# Provisioning (GitHub Actions)
GH_PAT=ghp_your_personal_access_token_here
GH_OWNER=dreiiiiim
GH_REPO=blues-clues-hris-superadmin
INTERNAL_API_SECRET=replace-with-any-random-string
```

- [ ] **Step 2: Add the same vars to your actual backend `.env` file**

In `blues-clues-hris-superadmin/backend/.env` (this file is gitignored — never commit it):

```
GH_PAT=ghp_xxxx              # Your real PAT from GitHub Settings → Developer Settings → Personal access tokens → Classic
GH_OWNER=dreiiiiim           # Your GitHub username
GH_REPO=blues-clues-hris-superadmin
INTERNAL_API_SECRET=my-super-secret-internal-key-123
```

**How to get a GitHub PAT:**
1. GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token → select scopes: `repo` (full) + `workflow`
3. Copy the token → paste as `GH_PAT`

- [ ] **Step 3: Commit .env.example only**

```bash
cd "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin"
git add backend/.env.example
git commit -m "chore: add provisioning env vars to .env.example"
```

---

## Task 5: Add provisioning methods to SubscriptionsService

**Files:**
- Modify: `D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\backend\src\subscriptions\subscriptions.service.ts`

Replace the entire file with the version below. All existing methods are preserved. Five new methods are added at the bottom.

- [ ] **Step 1: Replace subscriptions.service.ts**

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private computeEndDate(paymentDate: string, billingCycle: string): string {
    if (!paymentDate) return '';
    const d = new Date(paymentDate);
    if (billingCycle === 'annual') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  }

  async list(query: { status?: string; billing_cycle?: string; page?: number; limit?: number }) {
    const db = this.supabase.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    let q = db
      .from('company_registrations')
      .select(
        'registration_id, company_id, company_name, subscription_plan, billing_cycle, subscription_status, payment_status, payment_date, transaction_id',
        { count: 'exact' },
      )
      .range(offset, offset + limit - 1)
      .order('payment_date', { ascending: false });

    if (query.status) q = q.ilike('subscription_status', query.status);
    if (query.billing_cycle) q = q.eq('billing_cycle', query.billing_cycle);

    const { data, error, count } = await q;
    if (error) throw new BadRequestException(error.message);

    const enriched = (data ?? []).map(r => ({
      ...r,
      start_date: r.payment_date,
      end_date: this.computeEndDate(r.payment_date, r.billing_cycle),
    }));

    return { data: enriched, total: count, page, limit };
  }

  async detail(registrationId: string) {
    const db = this.supabase.getClient();
    const { data, error } = await db
      .from('company_registrations')
      .select('*')
      .eq('registration_id', registrationId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Subscription not found');
    return {
      ...data,
      start_date: data.payment_date,
      end_date: this.computeEndDate(data.payment_date, data.billing_cycle),
    };
  }

  async updateStatus(registrationId: string, subscriptionStatus: string, performedBy: string) {
    const db = this.supabase.getClient();
    const { error } = await db
      .from('company_registrations')
      .update({ subscription_status: subscriptionStatus })
      .eq('registration_id', registrationId);
    if (error) throw new BadRequestException(error.message);

    await db.from('admin_audit_logs').insert({
      action: `SUBSCRIPTION_STATUS_UPDATE: ${registrationId} → ${subscriptionStatus}`,
      performed_by: performedBy,
      severity: 'INFO',
    });
    return { success: true };
  }

  async paymentHistory(registrationId: string) {
    const db = this.supabase.getClient();
    const { data, error } = await db
      .from('company_registrations')
      .select('registration_id, payment_status, payment_date, transaction_id, billing_cycle, subscription_plan')
      .eq('registration_id', registrationId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Subscription not found');
    return { records: [data], total: 1 };
  }

  // ─── Provisioning ────────────────────────────────────────────────────────────

  async provision(registrationId: string) {
    const db = this.supabase.getClient();

    const { data: reg, error: regErr } = await db
      .from('company_registrations')
      .select('registration_id, company_id, company_name, email, payment_status')
      .eq('registration_id', registrationId)
      .maybeSingle();

    if (regErr || !reg) throw new NotFoundException('Subscription not found');
    if (reg.payment_status !== 'Paid') {
      throw new BadRequestException('Cannot provision: payment not confirmed (status must be Paid)');
    }
    if (!reg.company_id) {
      throw new BadRequestException('Cannot provision: company not yet created (Phase 1 may not have run)');
    }

    const { data: company, error: companyErr } = await db
      .from('company')
      .select('company_id, slug')
      .eq('company_id', reg.company_id)
      .maybeSingle();

    if (companyErr || !company) throw new NotFoundException('Company record not found');

    const { data: existing } = await db
      .from('instances')
      .select('instance_id, status')
      .eq('company_id', reg.company_id)
      .maybeSingle();

    if (existing) {
      throw new ConflictException(`Instance already exists with status: ${existing.status}`);
    }

    const schemaName = `hris_${company.slug.replace(/-/g, '_')}`;

    const { data: instance, error: instanceErr } = await db
      .from('instances')
      .insert({
        company_id: reg.company_id,
        status: 'provisioning',
        schema_name: schemaName,
      })
      .select('instance_id')
      .single();

    if (instanceErr || !instance) {
      throw new InternalServerErrorException('Failed to create instance record');
    }

    try {
      await this.triggerGHAWorkflow({
        company_id: reg.company_id,
        company_slug: company.slug,
        admin_email: reg.email,
        instance_id: instance.instance_id,
      });
    } catch (err) {
      this.logger.error('GHA workflow_dispatch failed — instance created but pipeline not started', err);
    }

    return { instance_id: instance.instance_id, status: 'provisioning', schema_name: schemaName };
  }

  private async triggerGHAWorkflow(inputs: {
    company_id: string;
    company_slug: string;
    admin_email: string;
    instance_id: string;
  }): Promise<void> {
    const owner = this.config.get<string>('GH_OWNER');
    const repo = this.config.get<string>('GH_REPO');
    const pat = this.config.get<string>('GH_PAT');

    if (!owner || !repo || !pat) {
      throw new Error('GitHub provisioning env vars (GH_OWNER, GH_REPO, GH_PAT) not configured');
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/provision-instance.yml/dispatches`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'main', inputs }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status}: ${body}`);
    }
  }

  async getInstance(registrationId: string) {
    const db = this.supabase.getClient();

    const { data: reg } = await db
      .from('company_registrations')
      .select('company_id')
      .eq('registration_id', registrationId)
      .maybeSingle();

    if (!reg?.company_id) return null;

    const { data } = await db
      .from('instances')
      .select('instance_id, status, schema_name, access_url, error_message, created_at, updated_at')
      .eq('company_id', reg.company_id)
      .maybeSingle();

    return data ?? null;
  }

  async markActive(instanceId: string) {
    const db = this.supabase.getClient();
    const { error } = await db
      .from('instances')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('instance_id', instanceId);
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }

  async markFailed(instanceId: string, errorMessage: string) {
    const db = this.supabase.getClient();
    const { error } = await db
      .from('instances')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('instance_id', instanceId);
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }
}
```

- [ ] **Step 2: Verify the module imports ConfigService**

The module needs `ConfigService` injected into the service. Since `ConfigModule.forRoot({ isGlobal: true })` is in `AppModule`, `ConfigService` is available everywhere without extra imports. No module change needed here.

- [ ] **Step 3: Commit**

```bash
cd "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin"
git add backend/src/subscriptions/subscriptions.service.ts
git commit -m "feat(subscriptions): add provisioning methods — provision, getInstance, markActive, markFailed"
```

---

## Task 6: Add Provision + Instance Endpoints to SubscriptionsController

**Files:**
- Modify: `D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\backend\src\subscriptions\subscriptions.controller.ts`

Two new endpoints added: `POST :id/provision` and `GET :id/instance`. Both protected by `SuperAdminGuard` via the class-level decorator.

- [ ] **Step 1: Replace subscriptions.controller.ts**

```typescript
import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { SubscriptionsService } from './subscriptions.service';
import { UpdateSubscriptionStatusDto } from './dto/update-subscription-status.dto';

@Controller('subscriptions')
@UseGuards(SuperAdminGuard)
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.service.list({
      status: query.status,
      billing_cycle: query.billing_cycle,
      page: query.page ? +query.page : 1,
      limit: query.limit ? +query.limit : 20,
    });
  }

  @Get(':registration_id')
  detail(@Param('registration_id') id: string) {
    return this.service.detail(id);
  }

  @Patch(':registration_id/status')
  updateStatus(
    @Param('registration_id') id: string,
    @Body() dto: UpdateSubscriptionStatusDto,
    @Req() req: any,
  ) {
    return this.service.updateStatus(id, dto.subscription_status, req.user.sub);
  }

  @Get(':registration_id/payment-history')
  paymentHistory(@Param('registration_id') id: string) {
    return this.service.paymentHistory(id);
  }

  @Post(':registration_id/provision')
  provision(@Param('registration_id') id: string) {
    return this.service.provision(id);
  }

  @Get(':registration_id/instance')
  getInstance(@Param('registration_id') id: string) {
    return this.service.getInstance(id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin"
git add backend/src/subscriptions/subscriptions.controller.ts
git commit -m "feat(subscriptions): add provision and getInstance endpoints"
```

---

## Task 7: Create InternalController (GHA callbacks)

**Files:**
- Create: `D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\backend\src\subscriptions\internal.controller.ts`
- Modify: `D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\backend\src\subscriptions\subscriptions.module.ts`

The GHA workflow calls `PATCH /super-admin/internal/instances/:id/activate` and `PATCH /super-admin/internal/instances/:id/fail`. These endpoints must NOT require a JWT — they use an `x-internal-secret` header instead. A separate controller is used so `SuperAdminGuard` from the class-level decorator on `SubscriptionsController` does not apply.

- [ ] **Step 1: Create internal.controller.ts**

```typescript
import {
  Controller,
  Patch,
  Param,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';

@Controller('internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private readonly service: SubscriptionsService,
    private readonly config: ConfigService,
  ) {}

  private checkSecret(secret: string | undefined) {
    const expected = this.config.get<string>('INTERNAL_API_SECRET');
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid or missing internal secret');
    }
  }

  @Patch('instances/:instance_id/activate')
  activate(
    @Param('instance_id') instanceId: string,
    @Headers('x-internal-secret') secret: string,
  ) {
    this.checkSecret(secret);
    this.logger.log(`Activating instance ${instanceId}`);
    return this.service.markActive(instanceId);
  }

  @Patch('instances/:instance_id/fail')
  fail(
    @Param('instance_id') instanceId: string,
    @Headers('x-internal-secret') secret: string,
    @Body() body: { error?: string },
  ) {
    this.checkSecret(secret);
    this.logger.warn(`Marking instance ${instanceId} failed: ${body.error}`);
    return this.service.markFailed(instanceId, body.error ?? 'GHA job failed');
  }
}
```

- [ ] **Step 2: Register InternalController in subscriptions.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionsController } from './subscriptions.controller';
import { InternalController } from './internal.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [SubscriptionsController, InternalController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
```

- [ ] **Step 3: Verify routes resolve correctly**

With global prefix `super-admin` (from `main.ts`):
- `PATCH /super-admin/internal/instances/:id/activate` ← GHA calls this
- `PATCH /super-admin/internal/instances/:id/fail` ← GHA calls this on failure

- [ ] **Step 4: Commit**

```bash
cd "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin"
git add backend/src/subscriptions/internal.controller.ts backend/src/subscriptions/subscriptions.module.ts
git commit -m "feat(subscriptions): add InternalController for GHA provision callbacks"
```

---

## Task 8: Set GitHub Actions Secrets

Before the workflow can run, add three secrets to the `blues-clues-hris-superadmin` GitHub repo.

- [ ] **Step 1: Get your Supabase DB connection string**

Supabase dashboard → Settings → Database → Connection string → select **URI** mode → select **Transaction pooler** (port 6543, not 5432).

It looks like: `postgresql://postgres.xxxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`

- [ ] **Step 2: Get your ngrok URL for the super admin backend**

The super admin backend runs on port 5010. To make it reachable from GHA:

```bash
# Install ngrok if not installed: https://ngrok.com/download
ngrok http 5010
```

Copy the `https://xxxx.ngrok-free.app` URL. This is your `INTERNAL_API_URL`.

- [ ] **Step 3: Add secrets to GitHub repo**

Go to https://github.com/dreiiiiim/blues-clues-hris-superadmin → Settings → Secrets and variables → Actions → New repository secret

Add these three:

| Name | Value |
|------|-------|
| `SUPABASE_DB_URL` | Your Supabase URI connection string from Step 1 |
| `INTERNAL_API_URL` | Your ngrok URL from Step 2 (no trailing slash) |
| `INTERNAL_API_SECRET` | Same value as `INTERNAL_API_SECRET` in your `.env` |

---

## Task 9: Update Super Admin Frontend — Provision Button + Instance Status Drawer

**Files:**
- Modify: `D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\frontend\src\app\super-admin\subscriptions\page.tsx`

Replace the entire file. All existing functionality is preserved. Added:
- `CompanyInstance` type
- `provisionDrawer` state (tracks which subscription's provision drawer is open)
- `provision` mutation (POST `/subscriptions/:id/provision`)
- Instance polling query (GET `/subscriptions/:id/instance`, refetches every 3s while `provisioning`)
- "Instance" column in the table header + status cell
- "Provision" button in Actions (only when `payment_status === 'Paid'` and no active/provisioning instance)
- Slide-over drawer showing live provisioning status

- [ ] **Step 1: Replace page.tsx**

```typescript
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  CreditCard,
  ChevronLeft,
  ChevronRight,
  X,
  Server,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type Subscription = {
  registration_id: string;
  company_name: string;
  subscription_plan: string;
  billing_cycle: string;
  subscription_status: string;
  payment_status: string;
  start_date: string;
  end_date: string;
  transaction_id: string;
  company_id: string | null;
};

type CompanyInstance = {
  instance_id: string;
  status: 'provisioning' | 'active' | 'failed';
  schema_name: string;
  access_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
} | null;

const STATUSES = ['Active', 'Pending', 'Suspended', 'Expired'];

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: '', billing_cycle: '', page: 1 });
  const [statusModal, setStatusModal] = useState<Subscription | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<Subscription | null>(null);
  const [provisionDrawer, setProvisionDrawer] = useState<Subscription | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusConfirm, setStatusConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', filters],
    queryFn: () => api.get('/subscriptions', { params: filters }).then(r => r.data),
  });

  const { data: history } = useQuery({
    queryKey: ['payment-history', historyDrawer?.registration_id],
    queryFn: () =>
      api.get(`/subscriptions/${historyDrawer!.registration_id}/payment-history`).then(r => r.data),
    enabled: !!historyDrawer,
  });

  const { data: instanceData } = useQuery<CompanyInstance>({
    queryKey: ['instance', provisionDrawer?.registration_id],
    queryFn: () =>
      api
        .get(`/subscriptions/${provisionDrawer!.registration_id}/instance`)
        .then(r => r.data),
    enabled: !!provisionDrawer,
    refetchInterval: (query) =>
      query.state.data?.status === 'provisioning' ? 3000 : false,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/subscriptions/${id}/status`, { subscription_status: status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      setStatusModal(null);
    },
  });

  const provision = useMutation({
    mutationFn: (id: string) => api.post(`/subscriptions/${id}/provision`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instance', provisionDrawer?.registration_id] });
    },
  });

  const subs: Subscription[] = data?.data ?? [];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Page header */}
      <div className="pb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">
          Subscription Management
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subscriptions</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CreditCard className="h-4 w-4 text-slate-400" />
            <span className="font-bold text-slate-700 tabular-nums">{data?.total ?? subs.length}</span>
            <span>subscriptions</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilters(f => ({ ...f, status: f.status === s ? '' : s, page: 1 }))}
              className={`px-3.5 py-1.5 rounded-xl text-sm font-bold border transition-colors duration-200 ${
                filters.status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={filters.billing_cycle}
          onChange={e => setFilters(f => ({ ...f, billing_cycle: e.target.value, page: 1 }))}
          className="ml-auto h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-shadow"
        >
          <option value="">All billing cycles</option>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Company', 'Plan', 'Billing', 'Status', 'Payment', 'Instance', 'Start', 'End', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[60, 45, 40, 50, 50, 40, 55, 55, 80].map((w, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 rounded animate-pulse bg-slate-100" style={{ width: `${w}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : subs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No subscriptions found
                  </td>
                </tr>
              ) : (
                subs.map(s => (
                  <tr key={s.registration_id} className="hover:bg-slate-50 transition-colors duration-150">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{s.company_name}</td>
                    <td className="px-5 py-3.5">
                      <span className="capitalize bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-lg">
                        {s.subscription_plan}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 capitalize text-xs">{s.billing_cycle}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={s.subscription_status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={s.payment_status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setProvisionDrawer(s)}
                        className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1"
                      >
                        <Server className="h-3 w-3" />
                        View
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {s.start_date ? new Date(s.start_date).toLocaleDateString('en-PH') : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {s.end_date ? new Date(s.end_date).toLocaleDateString('en-PH') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setStatusModal(s);
                            setNewStatus(s.subscription_status);
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 active:scale-[0.98] transition-colors duration-200"
                        >
                          Edit Status
                        </button>
                        <button
                          onClick={() => setHistoryDrawer(s)}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-[0.98] transition-colors duration-200"
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-600 min-w-8 text-center">{filters.page}</span>
            <button
              disabled={subs.length < 20}
              onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Change Status Modal */}
      {statusModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
          style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => {
            if (e.target === e.currentTarget) setStatusModal(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-slate-900">Change Status</h2>
                <p className="text-xs text-slate-400 mt-0.5">{statusModal.company_name}</p>
              </div>
              <button
                onClick={() => setStatusModal(null)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm mb-5 focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setStatusModal(null)}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newStatus === 'Suspended' || newStatus === 'Expired') {
                    setStatusConfirm(true);
                  } else {
                    updateStatus.mutate({ id: statusModal.registration_id, status: newStatus });
                  }
                }}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Drawer */}
      {historyDrawer && (
        <div
          className="fixed inset-0 z-50 flex animate-fade-in"
          style={{ background: 'rgba(15,23,42,0.4)' }}
          onClick={e => {
            if (e.target === e.currentTarget) setHistoryDrawer(null);
          }}
        >
          <div className="ml-auto w-96 bg-white h-full shadow-2xl flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900">Payment History</h2>
                <p className="text-xs text-slate-400 mt-0.5">{historyDrawer.company_name}</p>
              </div>
              <button
                onClick={() => setHistoryDrawer(null)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {history?.records?.map(
                (
                  r: {
                    subscription_plan: string;
                    billing_cycle: string;
                    payment_status: string;
                    payment_date: string;
                    transaction_id: string;
                  },
                  i: number,
                ) => (
                  <div
                    key={i}
                    className="border border-slate-100 rounded-2xl p-4 space-y-2.5 text-sm hover:border-slate-200 transition-colors"
                  >
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Plan</span>
                      <span className="font-medium capitalize text-slate-800">{r.subscription_plan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Billing</span>
                      <span className="text-slate-700 capitalize">{r.billing_cycle}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Payment</span>
                      <StatusBadge status={r.payment_status} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Date</span>
                      <span className="text-slate-700 text-xs">
                        {r.payment_date ? new Date(r.payment_date).toLocaleDateString('en-PH') : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">TXN ID</span>
                      <span className="font-mono text-xs text-slate-500 truncate max-w-32">
                        {r.transaction_id || '—'}
                      </span>
                    </div>
                  </div>
                ),
              )}
              {!history?.records?.length && (
                <div className="text-center py-8 text-slate-400 text-sm">No payment history found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Provision Instance Drawer */}
      {provisionDrawer && (
        <div
          className="fixed inset-0 z-50 flex animate-fade-in"
          style={{ background: 'rgba(15,23,42,0.4)' }}
          onClick={e => {
            if (e.target === e.currentTarget) setProvisionDrawer(null);
          }}
        >
          <div className="ml-auto w-[420px] bg-white h-full shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900">Instance Provisioning</h2>
                <p className="text-xs text-slate-400 mt-0.5">{provisionDrawer.company_name}</p>
              </div>
              <button
                onClick={() => setProvisionDrawer(null)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Not provisioned state */}
              {!instanceData && provisionDrawer.payment_status === 'Paid' && (
                <div className="text-center py-10">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                    <Server className="h-6 w-6 text-blue-500" />
                  </div>
                  <p className="font-semibold text-slate-800 mb-1">No instance yet</p>
                  <p className="text-sm text-slate-500 mb-6">
                    Payment confirmed. Press the button below to spin up a dedicated schema and seed default data via GitHub Actions.
                  </p>
                  <button
                    onClick={() => provision.mutate(provisionDrawer.registration_id)}
                    disabled={provision.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {provision.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Server className="h-4 w-4" />
                    )}
                    Provision Instance
                  </button>
                  {provision.isError && (
                    <p className="mt-3 text-xs text-red-500">
                      {(provision.error as any)?.response?.data?.message ?? 'Provision request failed'}
                    </p>
                  )}
                </div>
              )}

              {/* Payment not confirmed */}
              {!instanceData && provisionDrawer.payment_status !== 'Paid' && (
                <div className="text-center py-10">
                  <p className="text-slate-400 text-sm">
                    Provisioning requires payment status to be <strong>Paid</strong>.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Current: <span className="font-semibold">{provisionDrawer.payment_status}</span>
                  </p>
                </div>
              )}

              {/* Provisioning in progress */}
              {instanceData?.status === 'provisioning' && (
                <div className="text-center py-10">
                  <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-500" />
                  <p className="font-semibold text-slate-800">Setting up instance…</p>
                  <p className="text-sm text-slate-500 mt-1">
                    GitHub Actions is running. This takes ~1–2 minutes.
                  </p>
                  <p className="text-xs text-slate-400 mt-3">
                    Schema: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{instanceData.schema_name}</code>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Polling every 3 seconds…</p>
                </div>
              )}

              {/* Active */}
              {instanceData?.status === 'active' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-800">Instance Active</p>
                      <p className="text-xs text-emerald-600">Provisioning completed successfully</p>
                    </div>
                  </div>
                  <div className="border border-slate-100 rounded-2xl p-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Schema</span>
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                        {instanceData.schema_name}
                      </code>
                    </div>
                    {instanceData.access_url && (
                      <div className="flex justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">URL</span>
                        <a
                          href={instanceData.access_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate max-w-48"
                        >
                          {instanceData.access_url}
                        </a>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Activated</span>
                      <span className="text-xs text-slate-500">
                        {new Date(instanceData.updated_at).toLocaleString('en-PH')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Failed */}
              {instanceData?.status === 'failed' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
                    <XCircle className="h-6 w-6 text-red-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-red-800">Provisioning Failed</p>
                      <p className="text-xs text-red-500">
                        {instanceData.error_message ?? 'Unknown error — check GitHub Actions logs'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 text-center">
                    Check the Actions tab in GitHub for detailed logs.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {statusConfirm && statusModal && (
        <ConfirmDialog
          title="Change Subscription Status"
          message={`Setting ${statusModal.company_name} to ${newStatus} will block all their users from logging in. This can be reversed from this page.`}
          confirmLabel={`Set to ${newStatus}`}
          confirmStyle="danger"
          onConfirm={() => {
            setStatusConfirm(false);
            updateStatus.mutate({ id: statusModal.registration_id, status: newStatus });
          }}
          onCancel={() => setStatusConfirm(false)}
          loading={updateStatus.isPending}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin"
git add frontend/src/app/super-admin/subscriptions/page.tsx
git commit -m "feat(frontend): add Provision Instance button and live status drawer"
```

- [ ] **Step 3: Push super admin repo to GitHub**

```bash
git push origin main
```

---

## Task 10: Test End-to-End

Follow these steps in order to verify everything works.

- [ ] **Step 1: Start the super admin backend**

```bash
cd "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\backend"
npm run start:dev
```

Expected: Server starts on port 5010. No errors about missing modules.

- [ ] **Step 2: Start ngrok tunnel**

In a new terminal:
```bash
ngrok http 5010
```

Copy the `https://xxxx.ngrok-free.app` URL. Update the GitHub secret `INTERNAL_API_URL` with this value if it changed.

- [ ] **Step 3: Start the super admin frontend**

```bash
cd "D:\Documents(D)\3rdYR-2nd\BlueTribe_Front_Back_Mobile\blues-clues-hris-superadmin\frontend"
npm run dev
```

Open http://localhost:3000 → login as super admin → go to Subscriptions.

- [ ] **Step 4: Ensure a Paid subscription exists**

If no paid company exists, run the full subscription flow on the main HRIS frontend (register → pay → confirm). Alternatively, manually set `payment_status = 'Paid'` and `company_id` on an existing `company_registrations` row in Supabase SQL editor.

- [ ] **Step 5: Click "View" on a Paid subscription → "Provision Instance"**

Expected:
- Drawer opens showing "No instance yet" + "Provision Instance" button
- Click the button
- Drawer immediately shows spinner "Setting up instance…"
- GitHub Actions tab at https://github.com/dreiiiiim/blues-clues-hris-superadmin/actions shows workflow running

- [ ] **Step 6: Wait for GHA to complete (~1–2 minutes)**

When GHA finishes:
- Supabase → Database → Schemas → `hris_{slug}` schema appears
- Supabase → Table Editor → `instances` table → row shows `status = 'active'`
- Drawer in super admin portal automatically flips to green "Instance Active" card

- [ ] **Step 7: Test failure case**

Temporarily break the seeds SQL (e.g., reference a nonexistent table), trigger provision on a fresh company, verify the drawer shows red "Provisioning Failed" with error message.

---

## Setup Summary (one-time steps for a new developer)

1. **Supabase:** Run `sql/2026-05-21_instances_table.sql` in SQL editor
2. **GitHub PAT:** Generate at GitHub → Settings → Developer Settings → PAT (Classic) with `repo` + `workflow` scope
3. **super admin backend `.env`:** Add `GH_PAT`, `GH_OWNER`, `GH_REPO`, `INTERNAL_API_SECRET`
4. **GitHub Secrets:** Add `SUPABASE_DB_URL`, `INTERNAL_API_URL` (ngrok), `INTERNAL_API_SECRET`
5. **ngrok:** Run `ngrok http 5010` before testing, update `INTERNAL_API_URL` secret each session (ngrok free tier changes URL on restart)
