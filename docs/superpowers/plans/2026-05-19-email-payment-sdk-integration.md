# Email Fix & Payment SDK Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `emailSend()` SDK call params in `mail.service.ts`, add real PayMongo checkout via `@implementsprint/sdk`, and update the subscription frontend to redirect to PayMongo checkout then provision the tenant on success.

**Architecture:** Three subsystems in sequence. (1) A 2-line bugfix in `mail.service.ts` — wrong `to` shape and wrong field name. (2) Backend subscription service gains a `createCheckout` method that calls the SDK and stores `checkout_id`, plus an updated `confirmPayment` that verifies payment status via `paymentGetCheckoutStatus` instead of trusting the webhook body. (3) Frontend subscribe page drops the fake card form and steps 3–4 in favour of a PayMongo redirect; new success/cancel pages close the loop.

**Tech Stack:** NestJS 10, `@implementsprint/sdk` `TribeClient`, Supabase JS client, Next.js 14 App Router, TypeScript, Tailwind CSS, `class-validator`.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `tribeX-hris-auth-api/src/mail/mail.service.ts:213–218` | Fix `to` & `html→body` SDK params |
| Create | `tribeX-hris-auth-api/sql/2026-05-19_add_checkout_id.sql` | Add `checkout_id` column to `company_registrations` |
| Create | `tribeX-hris-auth-api/src/subscription/dto/create-checkout.dto.ts` | DTO for `POST /subscription/payment/create-checkout` |
| Modify | `tribeX-hris-auth-api/src/subscription/dto/payment-confirm.dto.ts` | Simplify to `registration_id` only |
| Inspect + Modify | `tribeX-hris-auth-api/src/subscription/subscription.module.ts` | Import `ApiCenterSdkModule` if not already present |
| Modify | `tribeX-hris-auth-api/src/subscription/subscription.service.ts` | Inject SDK client, add `createCheckout`, rewrite `confirmPayment` |
| Create | `tribeX-hris-auth-api/src/subscription/subscription.service.spec.ts` | Unit tests for new service methods |
| Modify | `tribeX-hris-auth-api/src/subscription/subscription.controller.ts` | Add `POST payment/create-checkout` route |
| Modify | `frontend/blues-clues-hris-frontend-web/src/app/(subscription)/subscribe/page.tsx` | Remove fake card form; call create-checkout after registration; redirect |
| Create | `frontend/blues-clues-hris-frontend-web/src/app/(subscription)/payment/success/page.tsx` | Call confirm endpoint, show provisioning success |
| Create | `frontend/blues-clues-hris-frontend-web/src/app/(subscription)/payment/cancel/page.tsx` | Show cancellation, offer retry link |

---

## Task 1: Fix emailSend SDK parameters

**Files:**
- Modify: `tribeX-hris-auth-api/src/mail/mail.service.ts:209–219`

The SDK contract (from `tribe-sdk-consumption.md`) is:
```typescript
emailSend({ to: string, subject: string, body: string })
```
Current call passes `to: [{ email: to }]` (array of objects) and `html:` (wrong field). Both are wrong.

- [ ] **Step 1: Confirm the bug**

Open `mail.service.ts`. Around line 213 you should see:
```typescript
await this.apiCenterSdkService.getClient().emailSend({
  to: [{ email: to }],
  subject: options.subject,
  html: options.html,
});
```

- [ ] **Step 2: Apply the fix**

Replace those lines with:
```typescript
await this.apiCenterSdkService.getClient().emailSend({
  to,
  subject: options.subject,
  body: options.html,
});
```

The `to` variable is already a `string` (normalized above the loop). The internal `SendMailOptions` type keeps `html: string` — we only translate to `body` at the SDK call boundary. No other callers need changing.

- [ ] **Step 3: TypeScript check**

```bash
cd tribeX-hris-auth-api
npx tsc --noEmit
```

Expected: no errors on `mail.service.ts`.

- [ ] **Step 4: Commit**

```bash
git add tribeX-hris-auth-api/src/mail/mail.service.ts
git commit -m "fix(mail): correct emailSend params to match SDK contract (to: string, body:)"
```

---

## Task 2: SQL migration — add checkout_id to company_registrations

**Files:**
- Create: `tribeX-hris-auth-api/sql/2026-05-19_add_checkout_id.sql`

The `createCheckout` method (Task 6) stores the PayMongo checkout session ID so `confirmPayment` can look it up for verification.

- [ ] **Step 1: Write the migration**

Create `tribeX-hris-auth-api/sql/2026-05-19_add_checkout_id.sql`:

```sql
-- Add PayMongo checkout_id to company_registrations
ALTER TABLE company_registrations
  ADD COLUMN IF NOT EXISTS checkout_id TEXT;
```

- [ ] **Step 2: Run the migration**

Apply via the Supabase Dashboard → SQL Editor, or CLI if configured:
```bash
# Via CLI (from the repo root):
# supabase db push
# OR paste into Dashboard → SQL Editor and run
```

Verify:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'company_registrations'
  AND column_name = 'checkout_id';
```
Expected: one row returned.

- [ ] **Step 3: Commit**

```bash
git add tribeX-hris-auth-api/sql/2026-05-19_add_checkout_id.sql
git commit -m "chore(db): add checkout_id column to company_registrations"
```

---

## Task 3: Create CreateCheckoutDto

**Files:**
- Create: `tribeX-hris-auth-api/src/subscription/dto/create-checkout.dto.ts`

- [ ] **Step 1: Write the DTO**

```typescript
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateCheckoutDto {
  @IsUUID()
  @IsNotEmpty()
  registration_id: string;
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd tribeX-hris-auth-api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add tribeX-hris-auth-api/src/subscription/dto/create-checkout.dto.ts
git commit -m "feat(subscription): add CreateCheckoutDto"
```

---

## Task 4: Simplify PaymentConfirmDto

**Files:**
- Modify: `tribeX-hris-auth-api/src/subscription/dto/payment-confirm.dto.ts`

The confirm endpoint now receives only `registration_id`; it looks up `checkout_id` internally and calls the SDK to verify payment. All the old fields (`transaction_id`, `amount`, `payment_method`, `payment_date`) were populated by the fake frontend and are no longer needed.

- [ ] **Step 1: Replace DTO content**

```typescript
import { IsNotEmpty, IsUUID } from 'class-validator';

export class PaymentConfirmDto {
  @IsUUID()
  @IsNotEmpty()
  registration_id: string;
}
```

- [ ] **Step 2: Note on compile error**

`tsc --noEmit` will fail here because `subscription.service.ts` still references `dto.transaction_id`, `dto.amount`, etc. from the old DTO. That's expected and will be fixed in Task 7. Move on.

- [ ] **Step 3: Commit**

```bash
git add tribeX-hris-auth-api/src/subscription/dto/payment-confirm.dto.ts
git commit -m "refactor(subscription): simplify PaymentConfirmDto to registration_id only"
```

---

## Task 5: Import ApiCenterSdkModule into SubscriptionModule

**Files:**
- Inspect + Modify: `tribeX-hris-auth-api/src/subscription/subscription.module.ts`

`SubscriptionService` needs to call `ApiCenterSdkService`. Read the module file first to see what's already imported.

- [ ] **Step 1: Read the module**

Open `tribeX-hris-auth-api/src/subscription/subscription.module.ts`. Look at the `imports` array.

- [ ] **Step 2a: ApiCenterSdkModule NOT in imports — add it**

Find where `ApiCenterSdkModule` is defined. It's likely at `src/api-center/api-center-sdk.module.ts`. Check:

```bash
find tribeX-hris-auth-api/src -name "api-center*.module.ts"
```

Then add it to the subscription module:

```typescript
import { Module } from '@nestjs/common';
import { ApiCenterSdkModule } from '../api-center/api-center-sdk.module'; // adjust path if different
import { MailModule } from '../mail/mail.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [
    SupabaseModule,
    MailModule,
    ApiCenterSdkModule,  // ← add this
  ],
  providers: [SubscriptionService],
  controllers: [SubscriptionController],
})
export class SubscriptionModule {}
```

- [ ] **Step 2b: ApiCenterSdkModule already in imports — skip**

No change needed. Move to Step 3.

- [ ] **Step 3: TypeScript check**

```bash
cd tribeX-hris-auth-api
npx tsc --noEmit
```

Errors from Task 4 (missing DTO fields) are OK here. Confirm no NEW module-import errors.

- [ ] **Step 4: Commit (if changed)**

```bash
git add tribeX-hris-auth-api/src/subscription/subscription.module.ts
git commit -m "feat(subscription): import ApiCenterSdkModule into SubscriptionModule"
```

---

## Task 6: Add createCheckout to SubscriptionService

**Files:**
- Modify: `tribeX-hris-auth-api/src/subscription/subscription.service.ts`
- Create: `tribeX-hris-auth-api/src/subscription/subscription.service.spec.ts`

**What this method does:**
1. Fetches the registration row; validates it exists and is not already paid
2. Determines the plan price in centavos (PayMongo currency unit: ₱1 = 100 centavos)
3. Calls `client.paymentCreateCheckoutSession(...)` with `successUrl`/`cancelUrl` pointing to the new frontend pages
4. Stores `checkout_id` on the registration row
5. Returns `{ checkout_url, checkout_id }`

**Prices (centavos):** Monthly ₱2,999 → `299900`. Annual ₱29,999 → `2999900`.
These come from the backend's authoritative `getPlans()`. Note: the frontend currently shows different display prices (₱4,999/₱3,999) — that discrepancy is out of scope here; the actual charge uses the backend prices.

- [ ] **Step 1: Write the failing test**

Create `tribeX-hris-auth-api/src/subscription/subscription.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { ApiCenterSdkService } from '../api-center/api-center-sdk.service';

function buildSupabaseChain(overrides: Record<string, jest.Mock> = {}) {
  const chain: any = {};
  const methods = ['from','select','eq','maybeSingle','update','single','insert','upsert','is','ilike','limit','neq'];
  for (const m of methods) {
    chain[m] = overrides[m] ?? jest.fn().mockReturnValue(chain);
  }
  return chain;
}

describe('SubscriptionService.createCheckout', () => {
  let service: SubscriptionService;
  let mockSdkClient: { paymentCreateCheckoutSession: jest.Mock };
  let supabaseChain: ReturnType<typeof buildSupabaseChain>;

  beforeEach(async () => {
    mockSdkClient = {
      paymentCreateCheckoutSession: jest.fn().mockResolvedValue({
        checkoutId: 'chk_test_123',
        checkoutUrl: 'https://pm.link/chk_test_123',
      }),
    };

    supabaseChain = buildSupabaseChain({
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          registration_id: 'reg-uuid',
          payment_status: 'Pending',
          subscription_plan: 'monthly',
          billing_cycle: 'monthly',
          company_name: 'Test Co',
        },
        error: null,
      }),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: SupabaseService, useValue: { getClient: jest.fn().mockReturnValue(supabaseChain) } },
        { provide: MailService, useValue: { sendRegistrationConfirmation: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://localhost:3000') } },
        { provide: ApiCenterSdkService, useValue: { getClient: jest.fn().mockReturnValue(mockSdkClient) } },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it('returns checkout_url and checkout_id', async () => {
    const result = await service.createCheckout({ registration_id: 'reg-uuid' });
    expect(result.checkout_url).toBe('https://pm.link/chk_test_123');
    expect(result.checkout_id).toBe('chk_test_123');
  });

  it('passes correct successUrl and cancelUrl to SDK', async () => {
    await service.createCheckout({ registration_id: 'reg-uuid' });
    expect(mockSdkClient.paymentCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: 'reg-uuid',
        successUrl: 'http://localhost:3000/payment/success?registration_id=reg-uuid',
        cancelUrl: 'http://localhost:3000/payment/cancel?registration_id=reg-uuid',
      }),
    );
  });

  it('throws NotFoundException when registration not found', async () => {
    supabaseChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(service.createCheckout({ registration_id: 'bad-uuid' })).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when already paid', async () => {
    supabaseChain.maybeSingle.mockResolvedValueOnce({
      data: { registration_id: 'reg-uuid', payment_status: 'Paid' },
      error: null,
    });
    await expect(service.createCheckout({ registration_id: 'reg-uuid' })).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tribeX-hris-auth-api
npx jest subscription.service.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `service.createCheckout is not a function`.

- [ ] **Step 3: Add injection and createCheckout to SubscriptionService**

At the top of `subscription.service.ts`, add the import:

```typescript
import { ApiCenterSdkService } from '../api-center/api-center-sdk.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
```

Update the constructor to inject `ApiCenterSdkService`:

```typescript
constructor(
  private readonly supabaseService: SupabaseService,
  private readonly mailService: MailService,
  private readonly config: ConfigService,
  private readonly apiCenterSdkService: ApiCenterSdkService,
) {}
```

Add this method after `getRegistrationStatus`:

```typescript
async createCheckout(dto: CreateCheckoutDto): Promise<{ checkout_url: string; checkout_id: string }> {
  const supabase = this.supabaseService.getClient();

  const { data: registration, error: fetchErr } = await supabase
    .from('company_registrations')
    .select('registration_id, payment_status, subscription_plan, billing_cycle, company_name')
    .eq('registration_id', dto.registration_id)
    .maybeSingle();

  if (fetchErr) throw new InternalServerErrorException(fetchErr.message);
  if (!registration) throw new NotFoundException('Registration not found');
  if (registration.payment_status === 'Paid') {
    throw new BadRequestException('Payment already completed for this registration');
  }

  const isAnnual = (registration.subscription_plan ?? registration.billing_cycle) === 'annual';
  const amountCentavos = isAnnual ? 2999900 : 299900; // ₱29,999 or ₱2,999
  const planName = isAnnual ? 'Annual Plan' : 'Monthly Plan';

  const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
  const successUrl = `${appUrl}/payment/success?registration_id=${dto.registration_id}`;
  const cancelUrl = `${appUrl}/payment/cancel?registration_id=${dto.registration_id}`;

  const session = await this.apiCenterSdkService.getClient().paymentCreateCheckoutSession({
    referenceId: dto.registration_id,
    successUrl,
    cancelUrl,
    lineItems: [
      {
        name: planName,
        quantity: 1,
        amount: { value: amountCentavos, currency: 'PHP' },
      },
    ],
  });

  const { error: updateErr } = await supabase
    .from('company_registrations')
    .update({ checkout_id: session.checkoutId })
    .eq('registration_id', dto.registration_id);

  if (updateErr) throw new InternalServerErrorException(updateErr.message);

  return {
    checkout_url: session.checkoutUrl,
    checkout_id: session.checkoutId,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd tribeX-hris-auth-api
npx jest subscription.service.spec.ts --no-coverage --testNamePattern "createCheckout"
```

Expected: all `createCheckout` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tribeX-hris-auth-api/src/subscription/subscription.service.ts \
        tribeX-hris-auth-api/src/subscription/subscription.service.spec.ts
git commit -m "feat(subscription): add createCheckout via paymentCreateCheckoutSession SDK"
```

---

## Task 7: Rewrite confirmPayment to verify via paymentGetCheckoutStatus

**Files:**
- Modify: `tribeX-hris-auth-api/src/subscription/subscription.service.ts`
- Modify: `tribeX-hris-auth-api/src/subscription/subscription.service.spec.ts`

**New flow:**
1. Validate webhook secret (keep for security)
2. Fetch registration; if no `checkout_id`, reject with 400
3. Call `client.paymentGetCheckoutStatus(checkout_id)` — verify `status === 'paid'`
4. Extract `transactionId` from status response (`paymentId ?? referenceId ?? checkout_id`)
5. Update DB and provision tenant (existing `provisionTenant` unchanged)

> **Important:** `paymentGetCheckoutStatus` return type is not fully documented in the SDK readme. Before running, check `node_modules/@implementsprint/sdk/dist/index.d.ts` for the exact field names for payment status (`status`) and payment ID (`paymentId`/`referenceId`). The code below uses type assertion (`as any`) — replace once confirmed.

- [ ] **Step 1: Add tests for the updated confirmPayment**

Append this describe block to `subscription.service.spec.ts`:

```typescript
describe('SubscriptionService.confirmPayment', () => {
  let service: SubscriptionService;
  let mockSdkClient: { paymentGetCheckoutStatus: jest.Mock };
  let supabaseChain: ReturnType<typeof buildSupabaseChain>;

  const baseRegistration = {
    registration_id: 'reg-uuid',
    payment_status: 'Pending',
    checkout_id: 'chk_test_123',
    company_name: 'Test Co',
    email: 'admin@test.com',
    subscription_plan: 'monthly',
    company_id: null,
  };

  beforeEach(async () => {
    mockSdkClient = {
      paymentGetCheckoutStatus: jest.fn().mockResolvedValue({
        status: 'paid',
        paymentId: 'pay_abc',
      }),
    };

    supabaseChain = buildSupabaseChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: baseRegistration, error: null }),
      single: jest.fn().mockResolvedValue({ data: { registration_id: 'reg-uuid' }, error: null }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: SupabaseService, useValue: { getClient: jest.fn().mockReturnValue(supabaseChain) } },
        {
          provide: MailService,
          useValue: {
            sendPaymentConfirmation: jest.fn().mockResolvedValue(undefined),
            sendSystemAdminCredentials: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const map: Record<string, string> = {
                SUBSCRIPTION_WEBHOOK_SECRET: 'test-secret',
                APP_URL: 'http://localhost:3000',
                NODE_ENV: 'test',
              };
              return map[key] ?? undefined;
            }),
          },
        },
        { provide: ApiCenterSdkService, useValue: { getClient: jest.fn().mockReturnValue(mockSdkClient) } },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it('rejects invalid webhook secret', async () => {
    await expect(
      service.confirmPayment({ registration_id: 'reg-uuid' }, 'wrong-secret'),
    ).rejects.toThrow('Invalid webhook secret');
  });

  it('rejects when no checkout_id on registration', async () => {
    supabaseChain.maybeSingle.mockResolvedValueOnce({
      data: { ...baseRegistration, checkout_id: null },
      error: null,
    });
    await expect(
      service.confirmPayment({ registration_id: 'reg-uuid' }, 'test-secret'),
    ).rejects.toThrow('No checkout session found');
  });

  it('rejects when payment status is not paid', async () => {
    mockSdkClient.paymentGetCheckoutStatus.mockResolvedValueOnce({ status: 'pending' });
    await expect(
      service.confirmPayment({ registration_id: 'reg-uuid' }, 'test-secret'),
    ).rejects.toThrow('Payment not yet completed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd tribeX-hris-auth-api
npx jest subscription.service.spec.ts --no-coverage --testNamePattern "confirmPayment"
```

Expected: FAIL — old signature accepts extra fields the new DTO doesn't have.

- [ ] **Step 3: Replace the confirmPayment implementation**

In `subscription.service.ts`, replace the entire `confirmPayment` method with:

```typescript
async confirmPayment(dto: PaymentConfirmDto, webhookSecret: string) {
  const expectedSecret = this.config.get<string>('SUBSCRIPTION_WEBHOOK_SECRET') ?? '';
  let secretValid = false;
  try {
    secretValid = crypto.timingSafeEqual(
      Buffer.from(webhookSecret ?? ''),
      Buffer.from(expectedSecret),
    );
  } catch {
    secretValid = false;
  }
  if (!secretValid) throw new UnauthorizedException('Invalid webhook secret');

  const supabase = this.supabaseService.getClient();

  const { data: registration, error: fetchErr } = await supabase
    .from('company_registrations')
    .select('*')
    .eq('registration_id', dto.registration_id)
    .maybeSingle();

  if (fetchErr) throw new InternalServerErrorException(fetchErr.message);
  if (!registration) throw new NotFoundException('Registration not found');

  if (!registration.checkout_id) {
    throw new BadRequestException('No checkout session found for this registration');
  }

  if (registration.payment_status === 'Paid') {
    if (registration.company_id) {
      return { message: 'Already processed', registration_id: dto.registration_id };
    }
    await this.provisionTenant(registration);
    return {
      message: 'Payment already marked paid. Tenant provisioning completed.',
      registration_id: dto.registration_id,
    };
  }

  // Verify with PayMongo via SDK
  // NOTE: cast to `any` until SDK types are confirmed in node_modules/@implementsprint/sdk/dist/index.d.ts
  // Expected fields: status ('paid' | 'pending' | 'expired'), paymentId or referenceId
  const checkoutStatus = await this.apiCenterSdkService
    .getClient()
    .paymentGetCheckoutStatus(registration.checkout_id) as any;

  if (checkoutStatus?.status !== 'paid') {
    throw new BadRequestException(
      `Payment not yet completed. Status: ${checkoutStatus?.status ?? 'unknown'}`,
    );
  }

  const transactionId: string =
    checkoutStatus.paymentId ??
    checkoutStatus.referenceId ??
    registration.checkout_id;

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
}
```

- [ ] **Step 4: Run all service tests**

```bash
cd tribeX-hris-auth-api
npx jest subscription.service.spec.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add tribeX-hris-auth-api/src/subscription/subscription.service.ts \
        tribeX-hris-auth-api/src/subscription/subscription.service.spec.ts
git commit -m "feat(subscription): verify payment via paymentGetCheckoutStatus before provisioning"
```

---

## Task 8: Add create-checkout route to SubscriptionController

**Files:**
- Modify: `tribeX-hris-auth-api/src/subscription/subscription.controller.ts`

- [ ] **Step 1: Add import and route**

In `subscription.controller.ts`, add:

```typescript
import { CreateCheckoutDto } from './dto/create-checkout.dto';
```

Inside the `SubscriptionController` class, after the `selectPlan` route:

```typescript
@Post('payment/create-checkout')
createCheckout(@Body() dto: CreateCheckoutDto) {
  return this.subscriptionService.createCheckout(dto);
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd tribeX-hris-auth-api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke test (if backend running)**

```bash
curl -s -X POST http://localhost:3001/subscription/payment/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"registration_id":"<real uuid from company_registrations>"}' | npx json
```

Expected: `{ "checkout_url": "https://...", "checkout_id": "chk_..." }` — or a structured error if AP Center is not reachable in dev (which is fine).

- [ ] **Step 4: Commit**

```bash
git add tribeX-hris-auth-api/src/subscription/subscription.controller.ts
git commit -m "feat(subscription): add POST /subscription/payment/create-checkout endpoint"
```

---

## Task 9: Update subscribe page — PayMongo redirect flow

**Files:**
- Modify: `frontend/blues-clues-hris-frontend-web/src/app/(subscription)/subscribe/page.tsx`

**Current flow:** Plan → Company (register) → Fake card form → Confirm & Pay
**New flow:** Plan → Company (register → create-checkout → `window.location.href = checkout_url`) → [PayMongo handles payment] → success/cancel pages

Changes needed in the file:
1. Shrink `STEPS` from 4 to 3
2. Extend `handleCompanyNext` to call `create-checkout` after registration and redirect
3. Replace step 3 & 4 render with a redirect spinner
4. Remove `StepPayment`, `StepConfirm`, `PaymentFormData`, `payData` state, `updatePay`, `handleConfirmSubmit`, `WEBHOOK_SECRET`

- [ ] **Step 1: Update STEPS and STEP_TIMES constants**

Find and replace:
```typescript
const STEPS = [
  { id: 1, label: "Plan", icon: Briefcase },
  { id: 2, label: "Setup", icon: Building2 },
  { id: 3, label: "Payment", icon: CreditCard },
  { id: 4, label: "Confirm", icon: BadgeCheck },
] as const;
```
With:
```typescript
const STEPS = [
  { id: 1, label: "Plan", icon: Briefcase },
  { id: 2, label: "Setup", icon: Building2 },
  { id: 3, label: "Payment", icon: CreditCard },
] as const;
```

And replace:
```typescript
const STEP_TIMES = ["2 min", "3 min", "2 min", "1 min"];
```
With:
```typescript
const STEP_TIMES = ["2 min", "3 min", "redirecting"];
```

- [ ] **Step 2: Remove WEBHOOK_SECRET**

Delete the line:
```typescript
const WEBHOOK_SECRET = process.env.NEXT_PUBLIC_SUBSCRIPTION_WEBHOOK_SECRET ?? "";
```

- [ ] **Step 3: Replace handleCompanyNext with the checkout-redirect version**

Find the `handleCompanyNext` function. Replace the entire function with:

```typescript
async function handleCompanyNext() {
  const clientErrors = validateCompany(company);
  if (Object.keys(clientErrors).length > 0) {
    setCompanyErrors(clientErrors);
    setError("Please fix the highlighted fields before continuing.");
    return;
  }

  setLoading(true);
  setError(null);
  setCompanyErrors({});
  try {
    const res = await fetch(`${API_BASE}/subscription/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: company.company_name,
        address: company.address,
        contact: company.contact,
        email: company.email,
        industry: company.industry,
        nature_of_business: company.nature_of_business,
        tin: company.tin,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fieldErrors = mapBackendCompanyErrors((data as { message?: unknown }).message);
      if (Object.keys(fieldErrors).length > 0) {
        setCompanyErrors(fieldErrors);
        setError("Some details need your attention. Please review the highlighted fields.");
        return;
      }
      throw new Error(
        (data as { message?: string }).message ?? "Registration failed. Please try again."
      );
    }

    const regId = (data as { registration_id?: string }).registration_id ?? null;
    setRegistrationId(regId);
    setStep(3); // show redirect spinner

    // Create PayMongo checkout session
    const checkoutRes = await fetch(`${API_BASE}/subscription/payment/create-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registration_id: regId }),
    });
    const checkoutData = await checkoutRes.json().catch(() => ({}));
    if (!checkoutRes.ok) {
      throw new Error(
        (checkoutData as { message?: string }).message ??
          "Failed to create payment session. Please try again."
      );
    }

    const checkoutUrl = (checkoutData as { checkout_url?: string }).checkout_url;
    if (!checkoutUrl) {
      throw new Error("No checkout URL returned. Please contact support.");
    }

    // Redirect to PayMongo — page navigates away from here
    window.location.href = checkoutUrl;
  } catch (err) {
    setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    setStep(2); // return to form on error
  } finally {
    setLoading(false);
  }
}
```

- [ ] **Step 4: Remove unused state and functions**

Delete from `SubscribePage`:
- `const [payData, setPayData] = useState<PaymentFormData>({...})` and the entire initializer object
- `function updatePay(d: Partial<PaymentFormData>) {...}`
- `async function handleConfirmSubmit() {...}` (the entire function)

- [ ] **Step 5: Replace step 3 and 4 in the render tree**

Find the section that renders steps:
```tsx
{step === 3 && (
  <StepPayment ... />
)}
{step === 4 && (
  <StepConfirm ... />
)}
```

Replace with:
```tsx
{step === 3 && (
  <div className="flex flex-col items-center justify-center py-20 gap-5">
    <div
      className="h-12 w-12 rounded-full border-4 border-[#1e3a8a]/15 border-t-[#1e3a8a] animate-spin"
      aria-label="Redirecting to payment"
    />
    <p className="text-sm font-semibold text-gray-600">Redirecting to secure payment…</p>
    <p className="text-xs text-gray-400">You will be redirected to PayMongo to complete your payment.</p>
  </div>
)}
```

- [ ] **Step 6: Remove StepPayment and StepConfirm component definitions**

Delete the entire `StepPayment` function component (~lines 900–1241 in the original file) and the entire `StepConfirm` function component (~lines 1243–1411).

- [ ] **Step 7: Remove unused type and icon imports**

Delete `PaymentFormData` interface. Remove these Lucide imports that were only used in the removed components (check each before deleting — some may still be used in remaining components):
- `BadgeCheck` — was used in STEPS (now removed from STEPS) and StepConfirm header
- `Smartphone` — was used in StepPayment payment methods
- `Copy` — was used in SuccessBlock (keep if SuccessBlock still exists)
- `Star` — used in StepPlan bottom bar (keep)

Run TypeScript to find remaining unused imports:
```bash
cd frontend/blues-clues-hris-frontend-web
npx tsc --noEmit 2>&1 | grep "subscribe"
```

Fix all reported errors.

- [ ] **Step 8: Commit**

```bash
git add "frontend/blues-clues-hris-frontend-web/src/app/(subscription)/subscribe/page.tsx"
git commit -m "feat(subscribe): replace fake card form with PayMongo checkout redirect"
```

---

## Task 10: Add payment/success page

**Files:**
- Create: `frontend/blues-clues-hris-frontend-web/src/app/(subscription)/payment/success/page.tsx`

> **Note:** Use the `design-taste-frontend` skill for visual polish on this page if more refined styling is needed beyond the base implementation below.

This page fires once on mount: reads `?registration_id` from URL, calls `POST /subscription/payment/confirm`, shows loading → success or error.

`useSearchParams()` in Next.js 14 App Router requires a `<Suspense>` boundary — the implementation splits into an inner component that uses the hook and a default export that wraps it.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, Home, LifeBuoy } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const WEBHOOK_SECRET = process.env.NEXT_PUBLIC_SUBSCRIPTION_WEBHOOK_SECRET ?? "";

type PageState = "loading" | "success" | "error";

function PaymentSuccessContent() {
  const params = useSearchParams();
  const registrationId = params.get("registration_id");
  const [state, setState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!registrationId) {
      setState("error");
      setErrorMsg("Missing registration ID. Please contact support.");
      return;
    }

    let cancelled = false;

    fetch(`${API_BASE}/subscription/payment/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify({ registration_id: registrationId }),
    })
      .then((res) => res.json().then((d: unknown) => ({ ok: res.ok, data: d })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setState("error");
          setErrorMsg(
            (data as { message?: string }).message ??
              "Payment verification failed. Please contact support."
          );
        } else {
          setState("success");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState("error");
          setErrorMsg("Network error. Please contact support.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [registrationId]);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[#f8faff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <Loader2 className="h-10 w-10 text-[#1e3a8a] animate-spin" />
          <p className="text-sm font-semibold text-gray-600">Verifying your payment…</p>
          <p className="text-xs text-gray-400">This usually takes just a moment.</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-[#f8faff] flex items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-2xl border border-red-100 bg-white shadow-sm p-8 text-center">
          <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Verification Failed</h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">{errorMsg}</p>
          <a
            href="mailto:support@blueclues.com"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1e40af] transition-colors duration-200"
          >
            <LifeBuoy className="h-4 w-4" />
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faff] flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-2xl border border-green-100 bg-white shadow-sm p-8 text-center">
        <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4 ring-4 ring-green-100">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Confirmed!</h1>
        <p className="text-sm text-gray-500 mb-1 leading-relaxed">
          Your subscription is now active.
        </p>
        <p className="text-xs text-gray-400 mb-6 leading-relaxed">
          System Admin credentials will arrive at your company email within 24 hours.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1e40af] transition-colors duration-200 shadow-sm"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8faff] flex items-center justify-center">
          <Loader2 className="h-10 w-10 text-[#1e3a8a] animate-spin" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend/blues-clues-hris-frontend-web
npx tsc --noEmit 2>&1 | grep "success"
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add "frontend/blues-clues-hris-frontend-web/src/app/(subscription)/payment/success/page.tsx"
git commit -m "feat(subscription): add payment success page — calls confirm, provisions tenant"
```

---

## Task 11: Add payment/cancel page

**Files:**
- Create: `frontend/blues-clues-hris-frontend-web/src/app/(subscription)/payment/cancel/page.tsx`

> **Note:** Use the `design-taste-frontend` skill for visual polish if more refined styling is needed.

No backend call needed. Just shows cancellation state and lets the user retry.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { XCircle, ArrowLeft, LifeBuoy } from "lucide-react";

function PaymentCancelContent() {
  const params = useSearchParams();
  const registrationId = params.get("registration_id");

  // Retry goes back to subscribe; registration is preserved so the user doesn't
  // need to re-enter company details (they can simply re-select-plan and retry payment).
  const retryUrl = "/subscribe";

  return (
    <div className="min-h-screen bg-[#f8faff] flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-2xl border border-slate-200 bg-white shadow-sm p-8 text-center">
        <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <XCircle className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Your payment was not completed. No charges have been made. You can try again or contact support.
        </p>
        {registrationId && (
          <p className="text-xs text-gray-400 mb-4 font-mono bg-gray-50 rounded-lg px-3 py-2">
            Ref: {registrationId}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={retryUrl}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1e40af] transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Try Again
          </Link>
          <a
            href="mailto:support@blueclues.com"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-200"
          >
            <LifeBuoy className="h-4 w-4" />
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8faff]" />}>
      <PaymentCancelContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend/blues-clues-hris-frontend-web
npx tsc --noEmit 2>&1 | grep "cancel"
```

- [ ] **Step 3: Commit**

```bash
git add "frontend/blues-clues-hris-frontend-web/src/app/(subscription)/payment/cancel/page.tsx"
git commit -m "feat(subscription): add payment cancel page"
```

---

## Self-Review

### Spec Coverage
| Requirement | Task |
|---|---|
| Fix `emailSend` wrong params (`to: [{ email }]` → `to: string`, `html` → `body`) | Task 1 |
| New endpoint `POST /subscription/payment/create-checkout` | Tasks 3, 6, 8 |
| Call `client.paymentCreateCheckoutSession()` | Task 6 |
| Store `checkout_id` in `company_registrations` | Tasks 2, 6 |
| Update confirm handler to verify via `client.paymentGetCheckoutStatus()` | Tasks 4, 7 |
| Frontend redirect to PayMongo checkout URL after plan selection | Task 9 |
| Success page | Task 10 |
| Cancel page | Task 11 |
| Use `design-taste-frontend` skill for new pages | Noted in Tasks 10, 11 |

### Placeholder Scan
All code blocks contain complete, runnable code. No "TBD", "similar to", or "add appropriate handling" patterns used.

### Type Consistency
- `CreateCheckoutDto` defined in Task 3 — imported in Task 6 (`subscription.service.ts`) and Task 8 (`subscription.controller.ts`) ✓
- `PaymentConfirmDto` redefined in Task 4 to `{ registration_id: string }` — `confirmPayment(dto: PaymentConfirmDto, ...)` in Task 7 uses only `dto.registration_id` ✓
- `ApiCenterSdkService` injected in Task 5/6 — used in Task 7 via `this.apiCenterSdkService.getClient().paymentGetCheckoutStatus(...)` ✓
- `session.checkoutId` / `session.checkoutUrl` used in Task 6 service code and matches mock return shape in Task 6 tests ✓
- `buildSupabaseChain` helper defined once in Task 6 spec, reused in Task 7 spec (both in same file) ✓

### Known Risks

1. **SDK response shape for `paymentGetCheckoutStatus`** — The `status`, `paymentId`, `referenceId` field names used in Task 7 are assumptions. Before merging, inspect `node_modules/@implementsprint/sdk/dist/index.d.ts` and adjust field names if they differ.

2. **`paymentCreateCheckoutSession` return shape** — Task 6 assumes `{ checkoutId, checkoutUrl }`. Same: verify against SDK types.

3. **Frontend display price vs. backend charge price** — Frontend `subscribe/page.tsx` displays ₱4,999/mo and ₱3,999/mo (annual). Backend `getPlans()` and Task 6 charge ₱2,999/mo and ₱29,999/yr. These need reconciling in a follow-up; Task 6 uses the authoritative backend prices.

4. **Subscribe page `select-plan` call** — The existing `handleCompanyNext` does NOT call `select-plan` before creating checkout. Plan selection (`subscription_plan`, `billing_cycle`) is captured in the `company_registrations` insert via a different flow. Verify that `subscription_plan` / `billing_cycle` is set before `createCheckout` runs, or add a `select-plan` call in `handleCompanyNext` after registration (before `create-checkout`). If the registration insert doesn't include these fields, `createCheckout` will default to `monthly`.
