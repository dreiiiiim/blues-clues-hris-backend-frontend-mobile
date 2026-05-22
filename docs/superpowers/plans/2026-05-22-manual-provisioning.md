# Manual Provisioning Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove auto-provisioning from the payment flow so super admin must manually press Provision before a tenant is created and System Admin credentials are sent.

**Architecture:** Four targeted edits across two services, one email template, and the frontend companies table. A new `invite_url` column on `company_registrations` stores the set-password link persistently so super admin can copy it from the table at any time.

**Tech Stack:** NestJS (backend), Next.js 14 App Router (frontend), Supabase/PostgREST, TypeScript

---

## File Map

| File | Change |
|---|---|
| Supabase SQL | Add `invite_url TEXT` column to `company_registrations` |
| `tribeX-hris-auth-api/src/subscription/subscription.service.ts` | Remove `provisionTenant()` calls; set `subscription_status: 'Pending'` on payment |
| `tribeX-hris-auth-api/src/mail/mail.service.ts` | Update `sendPaymentConfirmation()` body text |
| `tribeX-hris-auth-api/src/super-admin/companies/companies.service.ts` | Fix `provision()` column + save `invite_url`; add fields to `list()` SELECT |
| `frontend/.../super-admin/companies/page.tsx` | Update `Company` type; fix Provision condition; add Copy Invite; remove banner |

---

## Task 1: Add `invite_url` column to Supabase

**Files:**
- DB migration via Supabase SQL editor

- [ ] **Step 1: Run migration in Supabase**

Open Supabase → SQL Editor → New query → paste and run:

```sql
ALTER TABLE company_registrations
ADD COLUMN IF NOT EXISTS invite_url TEXT;
```

Expected: "Success. No rows returned."

- [ ] **Step 2: Verify column exists**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'company_registrations'
  AND column_name = 'invite_url';
```

Expected: one row returned with `data_type = 'text'`.

---

## Task 2: Remove auto-provisioning from payment flow

**Files:**
- Modify: `sprint5/tribeX-hris-auth-api/src/subscription/subscription.service.ts`

Context: `confirmPayment()` currently calls `provisionTenant()` twice — once for already-paid idempotency path (line ~233) and once for the normal payment confirmation path (line ~283). Both calls must be removed. The `subscription_status` must stay `'Pending'` after payment (not `'Active'`).

- [ ] **Step 1: Remove provisionTenant from already-paid branch**

Find this block (lines ~225–237):

```typescript
    if (registration.payment_status === 'Paid') {
      if (registration.company_id) {
        return {
          message: 'Already processed',
          registration_id: dto.registration_id,
        };
      }

      await this.provisionTenant(registration);
      return {
        message: 'Payment already marked paid. Tenant provisioning completed.',
        registration_id: dto.registration_id,
      };
    }
```

Replace with:

```typescript
    if (registration.payment_status === 'Paid') {
      return {
        message: 'Payment already recorded. Awaiting super admin provisioning.',
        registration_id: dto.registration_id,
      };
    }
```

- [ ] **Step 2: Remove provisionTenant from main payment path and fix subscription_status**

Find this block (lines ~271–288):

```typescript
    const { error: paymentErr } = await supabase
      .from('company_registrations')
      .update({
        payment_status: 'Paid',
        payment_date: new Date().toISOString(),
        transaction_id: transactionId,
        subscription_status: 'Active',
      })
      .eq('registration_id', dto.registration_id);

    if (paymentErr) throw new InternalServerErrorException(paymentErr.message);

    await this.provisionTenant({ ...registration, payment_status: 'Paid' });

    return {
      message: 'Payment confirmed. Tenant provisioned.',
      registration_id: dto.registration_id,
    };
```

Replace with:

```typescript
    const { error: paymentErr } = await supabase
      .from('company_registrations')
      .update({
        payment_status: 'Paid',
        payment_date: new Date().toISOString(),
        transaction_id: transactionId,
        subscription_status: 'Pending',
      })
      .eq('registration_id', dto.registration_id);

    if (paymentErr) throw new InternalServerErrorException(paymentErr.message);

    this.mailService
      .sendPaymentConfirmation(
        registration.email,
        registration.company_name,
        registration.subscription_plan,
      )
      .catch((err) => {
        this.logger.error(
          `Failed to send payment confirmation to ${registration.email}`,
          err,
        );
      });

    return {
      message: 'Payment confirmed. Awaiting super admin provisioning.',
      registration_id: dto.registration_id,
    };
```

- [ ] **Step 3: Verify the backend compiles**

```bash
cd sprint5/tribeX-hris-auth-api
npx tsc --noEmit
```

Expected: no errors.

---

## Task 3: Update payment confirmation email body

**Files:**
- Modify: `sprint5/tribeX-hris-auth-api/src/mail/mail.service.ts`

Context: `sendPaymentConfirmation()` body currently says "Your System Admin credentials are being sent in a separate email." — this is now wrong since credentials only come after manual provisioning.

- [ ] **Step 1: Update body text in sendPaymentConfirmation()**

Find this line inside `sendPaymentConfirmation()` body (around line ~388):

```typescript
        ${bodyText('Your System Admin credentials are being sent in a separate email. Use them to log in and configure your HR system.', '16px')}
```

Replace with:

```typescript
        ${bodyText('Once our team provisions your account, your System Admin credentials will be sent to this email address.', '16px')}
```

Also update the info card `Status` row from `'Active'` to `'Payment Confirmed'`:

Find:

```typescript
          { label: 'Status', value: 'Active' },
```

Replace with:

```typescript
          { label: 'Status', value: 'Payment Confirmed — Provisioning Pending' },
```

- [ ] **Step 2: Verify the backend compiles**

```bash
cd sprint5/tribeX-hris-auth-api
npx tsc --noEmit
```

Expected: no errors.

---

## Task 4: Fix provision() and update list() in companies.service.ts

**Files:**
- Modify: `sprint5/tribeX-hris-auth-api/src/super-admin/companies/companies.service.ts`

Context: `provision()` currently writes `status: 'Provisioned'` (wrong column — silently ignored by Supabase). Must fix to `subscription_status: 'Active'` and also save `invite_url`. `list()` must return `payment_status` and `invite_url` fields.

- [ ] **Step 1: Fix list() SELECT**

Find in `list()`:

```typescript
    let q = db
      .from('company_registrations')
      .select(
        `registration_id, company_id, company_name, email, industry,
         subscription_plan, subscription_status, payment_status,
         billing_cycle, payment_date, transaction_id`,
        { count: 'exact' },
      )
```

Replace with:

```typescript
    let q = db
      .from('company_registrations')
      .select(
        `registration_id, company_id, company_name, email, industry,
         subscription_plan, subscription_status, payment_status,
         billing_cycle, payment_date, transaction_id, invite_url`,
        { count: 'exact' },
      )
```

- [ ] **Step 2: Fix provision() — correct column name and save invite_url**

Find in `provision()`:

```typescript
    await db.from('company_registrations')
      .update({ company_id: companyId, status: 'Provisioned' })
      .eq('registration_id', registrationId);
```

Replace with:

```typescript
    await db.from('company_registrations')
      .update({ company_id: companyId, subscription_status: 'Active' })
      .eq('registration_id', registrationId);
```

- [ ] **Step 3: Save invite_url after generating the invite link**

Find in `provision()`:

```typescript
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    const inviteLink = `${appUrl}/set-password?token=${rawToken}`;

    this.logger.debug(`DEV: System Admin invite for ${reg.email} → ${inviteLink}`);
```

Replace with:

```typescript
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    const inviteLink = `${appUrl}/set-password?token=${rawToken}`;

    this.logger.debug(`DEV: System Admin invite for ${reg.email} → ${inviteLink}`);

    await db.from('company_registrations')
      .update({ invite_url: inviteLink })
      .eq('registration_id', registrationId);
```

- [ ] **Step 4: Verify the backend compiles**

```bash
cd sprint5/tribeX-hris-auth-api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Restart the backend and verify provision endpoint returns slug + invite_link**

Start backend:
```bash
cd sprint5/tribeX-hris-auth-api
npm run start:dev
```

In Supabase, find a registration with `payment_status = 'Paid'` and `company_id IS NULL`. Note its `registration_id`.

Call via curl or Postman (replace token with a valid super admin JWT):
```bash
curl -X POST http://localhost:5000/super-admin/companies/<registration_id>/provision \
  -H "Authorization: Bearer <super-admin-token>"
```

Expected response:
```json
{
  "company_id": "<uuid>",
  "slug": "<slug>",
  "invite_link": "http://localhost:3001/set-password?token=<hex>"
}
```

Verify in Supabase `company_registrations`:
- `company_id` is now set
- `subscription_status = 'Active'`
- `invite_url` is set to the same URL as `invite_link` in response

---

## Task 5: Update frontend companies table

**Files:**
- Modify: `sprint5/frontend/blues-clues-hris-frontend-web/src/app/(super-admin)/super-admin/companies/page.tsx`

Context: Must (1) add `payment_status` and `invite_url` to Company type, (2) show Provision button only for paid+unprovisioned rows, (3) add Copy Invite button for provisioned rows, (4) remove the post-provision green banner state entirely.

- [ ] **Step 1: Update Company type**

Find:

```typescript
type Company = {
  registration_id: string;
  company_id: string | null;
  company_name: string;
  email: string;
  industry: string;
  subscription_plan: string;
  subscription_status: string;
  payment_date: string;
  billing_cycle: string;
};
```

Replace with:

```typescript
type Company = {
  registration_id: string;
  company_id: string | null;
  company_name: string;
  email: string;
  industry: string;
  subscription_plan: string;
  subscription_status: string;
  payment_status: string;
  payment_date: string;
  billing_cycle: string;
  invite_url: string | null;
};
```

- [ ] **Step 2: Remove provisionedUrl and copied state, add inviteCopied state**

Find:

```typescript
  const [provisionedUrl, setProvisionedUrl] = useState<{ url: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
```

Replace with:

```typescript
  const [inviteCopied, setInviteCopied] = useState<string | null>(null);
```

- [ ] **Step 3: Update provision mutation — remove banner logic**

Find:

```typescript
  const provision = useMutation({
    mutationFn: (id: string) => saApi.post(`/companies/${id}/provision`).then(r => ({ ...r, _id: id })),
    onSuccess: (res, id) => {
      qc.invalidateQueries({ queryKey: ['sa-companies'] });
      setConfirm(null);
      const slug: string | undefined = res.data?.slug;
      const name: string = confirm?.name ?? 'Company';
      if (slug) setProvisionedUrl({ url: `http://${slug}.localhost:3001/login`, name });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Provisioning failed');
    },
  });
```

Replace with:

```typescript
  const provision = useMutation({
    mutationFn: (id: string) => saApi.post(`/companies/${id}/provision`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-companies'] });
      setConfirm(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Provisioning failed');
    },
  });
```

- [ ] **Step 4: Update handleCopy to use inviteCopied**

Find:

```typescript
  function handleCopy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
```

Replace with:

```typescript
  function handleCopyInvite(registrationId: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setInviteCopied(registrationId);
      setTimeout(() => setInviteCopied(null), 2000);
    });
  }
```

- [ ] **Step 5: Remove the post-provision green banner JSX**

Find and delete this entire block:

```typescript
      {/* Provisioning success banner */}
      {provisionedUrl && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-800 mb-0.5">
              {provisionedUrl.name} provisioned
            </p>
            <p className="text-xs text-emerald-700 font-mono truncate">{provisionedUrl.url}</p>
          </div>
          <button
            onClick={() => handleCopy(provisionedUrl.url)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shrink-0"
          >
            {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied!' : 'Copy URL'}
          </button>
          <a
            href={provisionedUrl.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 transition-colors shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
          <button onClick={() => setProvisionedUrl(null)} className="text-emerald-400 hover:text-emerald-600 ml-1 text-lg leading-none">×</button>
        </div>
      )}
```

- [ ] **Step 6: Update Actions column — fix Provision condition and add Copy Invite**

Find the Actions column JSX:

```typescript
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {c.company_id && (
                          <a
                            href={`http://${toSlug(c.company_name)}.localhost:3001/login`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          >
                            Open Instance
                          </a>
                        )}
                        {!c.company_id && (
                          <button
                            onClick={() => setConfirm({ action: 'provision', id: c.registration_id, name: c.company_name })}
                            disabled={isMutating}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                          >
                            <Zap className="h-3 w-3" /> Provision
                          </button>
                        )}
                        {c.subscription_status !== 'Suspended' && (
                          <button
                            onClick={() => setConfirm({ action: 'suspend', id: c.registration_id, name: c.company_name })}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <ShieldOff className="h-3 w-3" /> Suspend
                          </button>
                        )}
                      </div>
                    </td>
```

Replace with:

```typescript
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {c.company_id && (
                          <a
                            href={`http://${toSlug(c.company_name)}.localhost:3001/login`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          >
                            Open Instance
                          </a>
                        )}
                        {c.company_id && c.invite_url && (
                          <button
                            onClick={() => handleCopyInvite(c.registration_id, c.invite_url!)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
                          >
                            {inviteCopied === c.registration_id
                              ? <><CheckCheck className="h-3 w-3" /> Copied!</>
                              : <><Copy className="h-3 w-3" /> Copy Invite</>
                            }
                          </button>
                        )}
                        {!c.company_id && c.payment_status === 'Paid' && (
                          <button
                            onClick={() => setConfirm({ action: 'provision', id: c.registration_id, name: c.company_name })}
                            disabled={isMutating}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                          >
                            <Zap className="h-3 w-3" /> Provision
                          </button>
                        )}
                        {c.subscription_status !== 'Suspended' && (
                          <button
                            onClick={() => setConfirm({ action: 'suspend', id: c.registration_id, name: c.company_name })}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <ShieldOff className="h-3 w-3" /> Suspend
                          </button>
                        )}
                      </div>
                    </td>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd sprint5/frontend/blues-clues-hris-frontend-web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Start frontend and verify table**

```bash
cd sprint5/frontend/blues-clues-hris-frontend-web
npm run dev
```

Open `http://localhost:3001/super-admin/companies`. Verify:
- Paid + unprovisioned rows show **Provision** button
- Provisioned rows show **Open Instance** + **Copy Invite** buttons
- No green banner appears after provisioning
- Clicking **Copy Invite** copies the invite URL and shows "Copied!" for 2 seconds

---

## Task 6: End-to-end smoke test

- [ ] **Step 1: Subscribe as a new company**

Open `http://localhost:3001/subscribe` in a browser. Fill in:
- Company name: `Demo Company` (or any name)
- Email: use a real email you can check (or note the invite link from the console log)
- Plan: Monthly

Complete payment flow. After redirecting back, check that the confirmation page does NOT say "provisioned" — it should say payment confirmed.

- [ ] **Step 2: Check super admin table shows Provision button**

Open `http://localhost:3001/super-admin/companies` (logged in as super admin).

Find `Demo Company` row. Verify:
- `subscription_status` column shows **Pending** (not Active)
- Actions column shows **Provision** button (blue, with Zap icon)
- No **Open Instance** link yet

- [ ] **Step 3: Press Provision**

Click **Provision** → confirm dialog → **Provision** button.

Expected after refresh:
- **Provision** button disappears
- **Open Instance** link appears (green)
- **Copy Invite** button appears (violet)
- `subscription_status` in table shows **Active**

- [ ] **Step 4: Copy invite link and verify set-password page**

Click **Copy Invite**. Paste URL in a new browser tab.

Expected: `/set-password` page loads (not 404, not expired).

- [ ] **Step 5: Open Instance and verify company branding**

Click **Open Instance** (or paste `http://demo-company.localhost:3001/login` in Chrome).

Expected:
- Login page header shows **Demo Company** (not "Blue's Clues HRIS")
- Left panel shows company name in the logo area

- [ ] **Step 6: Complete set-password flow**

Paste invite URL, set a password, submit.

Expected: redirect to `/login` (or direct login). Login with the subscriber email + new password at `http://demo-company.localhost:3001/login`.

Expected: successful login into the system-admin portal.
