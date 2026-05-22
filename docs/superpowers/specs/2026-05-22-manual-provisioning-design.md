# Manual Provisioning Flow Design

**Date:** 2026-05-22
**Status:** Approved

## Goal

Remove auto-provisioning from the subscription payment flow. Super admin must manually press Provision for each paid subscriber before their tenant is created and they receive System Admin credentials.

## Problem

Currently `subscription.service.ts` calls `provisionTenant()` immediately when payment is confirmed, making companies "Active" without super admin review. This bypasses super admin control and makes it impossible to demo the provisioning step.

## Approach

Surgical removal of `provisionTenant()` from the payment flow. Payment only records payment status and sends a confirmation email. Provisioning (tenant creation, System Admin user, invite link) happens exclusively via the super admin Provision button.

---

## Data Layer

One new column added to `company_registrations`:

```sql
ALTER TABLE company_registrations ADD COLUMN invite_url TEXT;
```

### State Machine

| Event | `payment_status` | `subscription_status` | `company_id` | `invite_url` |
|---|---|---|---|---|
| Subscribed, unpaid | `Unpaid` | `Pending` | null | null |
| Payment confirmed | `Paid` | `Pending` | null | null |
| Super admin provisions | `Paid` | `Active` | set | set |
| Super admin suspends | `Paid` | `Suspended` | set | set |

`company_id` null = tenant does not exist. `payment_status = 'Paid'` + `company_id` null = paid, awaiting manual provisioning.

---

## Backend Changes

### `subscription.service.ts` — `confirmPayment()`

**Remove:** Both `await this.provisionTenant(...)` calls (lines 233 and 283).

**Keep:**
- `payment_status = 'Paid'`
- `subscription_status = 'Pending'` (do NOT set to `'Active'`)
- `sendPaymentConfirmation()` email

**Update** `sendPaymentConfirmation()` body text in `mail.service.ts`:
- Remove: `"Your System Admin credentials are being sent in a separate email."`
- Replace with: `"Once your account is provisioned by our team, your System Admin credentials will be sent to this address."`

**Do not call** `sendSystemAdminCredentials()` from subscription flow.

### `companies.service.ts` — `provision()`

**Add** after generating the invite token and before sending email:
```typescript
await db.from('company_registrations')
  .update({ invite_url: inviteLink })
  .eq('registration_id', registrationId);
```

**Fix** the `company_registrations` update to set `subscription_status: 'Active'` (currently sets `status: 'Provisioned'` which is the wrong column):
```typescript
await db.from('company_registrations')
  .update({ company_id: companyId, subscription_status: 'Active' })
  .eq('registration_id', registrationId);
```

**Return** stays: `{ company_id, slug, invite_link }`.

### `companies.service.ts` — `list()`

Add `invite_url` and `payment_status` to the SELECT:
```typescript
`registration_id, company_id, company_name, email, industry,
 subscription_plan, subscription_status, payment_status,
 billing_cycle, payment_date, transaction_id, invite_url`
```

---

## Frontend Changes

### `Company` type — add fields

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

### Table row — Actions column

**Provision button:** Show only when `payment_status === 'Paid' && !c.company_id`
(Previously: `!c.company_id` — this also showed for unpaid registrations)

**Open Instance link:** Show when `c.company_id` is set (already implemented, uses `toSlug(c.company_name)`)

**Copy Invite button:** Show when `c.company_id` is set AND `c.invite_url` is set
- Copies `c.invite_url` to clipboard
- Shows checkmark confirmation for 2 seconds

**Suspend button:** Show when `c.subscription_status !== 'Suspended'` (no change)

**Remove:** Post-provision green banner (`provisionedUrl` state) — invite URL is now persistent in the table row.

### Login page branding

No changes needed. Already DB-driven:
- `GET /jobs/public/branding/:slug` reads `company_name` from `company` table
- `company` row is inserted at provision time from `company_registrations.company_name`
- Login page shows registered company name dynamically

---

## Email Flow

| Trigger | Email sent | Via |
|---|---|---|
| Payment confirmed | Payment confirmation (updated body) | `subscription.service.ts` |
| Super admin provisions | System Admin credentials + invite link | `companies.service.ts` |

All emails use `MailService` → `ApiCenterSdkService.getClient().emailSend()`. No Brevo.

---

## What Does NOT Change

- Subscription registration flow (unchanged)
- Payment confirmation email (body text update only)
- Login page branding (already DB-driven)
- Suspend/unsuspend flow
- `getPublicBrandingBySlug()` endpoint
- CORS config for `*.localhost`
- Slug computation formula
