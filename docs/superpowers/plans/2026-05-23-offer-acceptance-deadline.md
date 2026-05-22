# Offer Acceptance Deadline & Multi-Offer Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When HR hires a candidate they set an acceptance deadline (default 7 days); applicants with multiple offers must pick one via a named-list warning; a daily cron auto-expires stale offers; both HR and applicant views gain a Past filter.

**Architecture:** Add `offer_deadline` + `offer_declined_at` columns to `job_applications`. Backend enforces deadline on accept, auto-declines other hired offers, runs a cron for expiry. HR web hire modal gets a deadline picker. Applicant web/mobile shows deadline countdown and named-list multi-offer warning. `offer_expired` is a new terminal status joining `offer_accepted` in a "Past" filter on all views.

**Tech Stack:** NestJS (backend), Next.js 14 (HR + applicant web), React Native/Expo (mobile), Supabase, TypeScript

**PREREQUISITE — run this SQL before any code change:**
```sql
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS offer_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offer_declined_at TIMESTAMPTZ;
```

---

### Task 1: Add offer_deadline_days to DTO

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/jobs/dto/update-application-status.dto.ts`

- [ ] **Step 1: Add optional field**

Open the file and add after `rejection_reason`:

```ts
import { IsString, IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const VALID_APPLICATION_STATUSES = [
  'submitted',
  'screening',
  'first_interview',
  'technical_interview',
  'final_interview',
  'hired',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStatus = typeof VALID_APPLICATION_STATUSES[number];

export class UpdateApplicationStatusDto {
  @ApiProperty({
    description: 'New status for the application',
    example: 'screening',
    enum: VALID_APPLICATION_STATUSES,
  })
  @IsString()
  @IsIn(VALID_APPLICATION_STATUSES as unknown as string[])
  status: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Reason for rejection (required when status is rejected)',
    example: 'Skills Mismatch',
  })
  @IsString()
  @IsOptional()
  rejection_reason?: string;

  @ApiPropertyOptional({
    description: 'Days until offer acceptance deadline (only used when status is "hired", default 7)',
    example: 7,
    minimum: 1,
    maximum: 90,
  })
  @IsInt()
  @Min(1)
  @Max(90)
  @IsOptional()
  offer_deadline_days?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/jobs/dto/update-application-status.dto.ts
git commit -m "feat(jobs): add offer_deadline_days to UpdateApplicationStatusDto"
```

---

### Task 2: Backend — stage guard + offer_deadline on hire

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/jobs/jobs.service.ts` (around line 736–763 for guard, line 806–816 for update payload)

- [ ] **Step 1: Extend TERMINAL_STATUSES in stage guard**

Find the guard block (around line 744) and replace:

```ts
const TERMINAL_STATUSES = ['rejected', 'withdrawn'];
```

with:

```ts
const TERMINAL_STATUSES = ['rejected', 'withdrawn', 'offer_accepted', 'offer_expired'];
```

- [ ] **Step 2: Add offer_deadline to update payload when hiring**

Find the `const updatePayload` block (around line 806) and replace:

```ts
      const updatePayload: any = { status };
      if (status.toLowerCase() === 'rejected' && rejectionReason) {
        updatePayload.rejection_reason = rejectionReason;
      }
```

with:

```ts
      const updatePayload: any = { status };
      if (status.toLowerCase() === 'rejected' && rejectionReason) {
        updatePayload.rejection_reason = rejectionReason;
      }
      if (status.toLowerCase() === 'hired') {
        const deadlineDays = (dto as any)?.offer_deadline_days ?? 7;
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + deadlineDays);
        updatePayload.offer_deadline = deadline.toISOString();
      }
```

Note: `updateApplicationStatus` currently receives `status` and `rejectionReason` as separate params. You need to also pass the full `dto` object. Check the method signature at line ~720:

```ts
async updateApplicationStatus(
  applicationId: string,
  status: string,
  companyId: string,
  rejectionReason?: string,
)
```

Add `dto?: UpdateApplicationStatusDto` as a fifth optional param:

```ts
async updateApplicationStatus(
  applicationId: string,
  status: string,
  companyId: string,
  rejectionReason?: string,
  dto?: UpdateApplicationStatusDto,
)
```

Then the controller call site also needs updating. Find `jobs.controller.ts` where `updateApplicationStatus` is called and pass `dto` as the fifth argument:

```ts
return this.jobsService.updateApplicationStatus(
  applicationId,
  dto.status,
  req.user.company_id,
  dto.rejection_reason,
  dto,
);
```

- [ ] **Step 3: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/jobs/jobs.service.ts
git add tribeX-hris-auth-api/apps/api/src/jobs/jobs.controller.ts
git commit -m "feat(jobs): set offer_deadline on hire, add offer_accepted/offer_expired to terminal statuses"
```

---

### Task 3: Backend — extend acceptOffer with multi-offer auto-decline

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/jobs/jobs.service.ts` (around line 2489)

- [ ] **Step 1: Replace acceptOffer method**

Find `async acceptOffer(` (around line 2489) and replace the entire method:

```ts
async acceptOffer(applicationId: string, applicantId: string) {
  const supabase = this.supabaseService.getClient();

  const { data: app, error: fetchErr } = await supabase
    .from('job_applications')
    .select('application_id, applicant_id, status, offer_deadline, job_posting_id')
    .eq('application_id', applicationId)
    .eq('applicant_id', applicantId)
    .maybeSingle();

  if (fetchErr) throw new InternalServerErrorException(fetchErr.message);
  if (!app) throw new NotFoundException('Application not found.');
  if (app.status !== 'hired')
    throw new BadRequestException('Offer can only be accepted when status is "hired".');

  if (app.offer_deadline && new Date(app.offer_deadline) < new Date()) {
    throw new BadRequestException('This offer has expired and can no longer be accepted.');
  }

  // Accept this offer
  const { error: acceptErr } = await supabase
    .from('job_applications')
    .update({ status: 'offer_accepted', offer_accepted_at: new Date().toISOString() })
    .eq('application_id', applicationId);

  if (acceptErr) throw new InternalServerErrorException(acceptErr.message);

  // Auto-decline all other hired offers for this applicant
  const { data: otherOffers } = await supabase
    .from('job_applications')
    .select('application_id, job_posting_id')
    .eq('applicant_id', applicantId)
    .eq('status', 'hired')
    .neq('application_id', applicationId);

  if (otherOffers && otherOffers.length > 0) {
    const otherIds = otherOffers.map((o: any) => o.application_id);

    await supabase
      .from('job_applications')
      .update({
        status: 'offer_expired',
        rejection_reason: 'Applicant accepted another offer',
        offer_declined_at: new Date().toISOString(),
      })
      .in('application_id', otherIds);

    // Notify for each auto-declined offer
    for (const other of otherOffers) {
      try {
        const { data: posting } = await supabase
          .from('job_postings')
          .select('title')
          .eq('job_posting_id', other.job_posting_id)
          .maybeSingle();

        await this.notificationsService.createApplicantNotification({
          applicant_id: applicantId,
          message: `Your offer for ${posting?.title ?? 'another position'} has been automatically declined because you accepted a different offer.`,
          notification_type: 'status_update',
          job_posting_id: other.job_posting_id,
        });

        const { data: profile } = await supabase
          .from('applicant_profile')
          .select('first_name, last_name, email')
          .eq('applicant_id', applicantId)
          .maybeSingle();

        if (profile?.email) {
          const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
          this.mailService.sendApplicationStatusEmail({
            to: profile.email,
            applicantName,
            jobTitle: posting?.title ?? 'the position',
            status: 'offer_expired',
          }).catch((err: Error) => {
            this.logger.error(`offer_expired email failed: ${err?.message}`);
          });
        }
      } catch (notifErr) {
        this.logger.error(`Failed to notify auto-declined offer ${other.application_id}: ${notifErr}`);
      }
    }
  }

  this.logger.log(`[acceptOffer] Application ${applicationId} accepted by applicant ${applicantId}`);
  return { status: 'offer_accepted' };
}
```

- [ ] **Step 2: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/jobs/jobs.service.ts
git commit -m "feat(jobs): acceptOffer checks deadline and auto-declines other hired offers"
```

---

### Task 4: Backend — daily cron to expire stale offers

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/jobs/jobs.service.ts`

- [ ] **Step 1: Add cron method**

Find the existing `@Cron` usages in the file. Add the following method in the same area (near other cron jobs):

```ts
@Cron('0 1 * * *', { timeZone: 'Asia/Manila' })
async expireStaleOffers() {
  this.logger.log('[expireStaleOffers] Running offer expiry check');
  const supabase = this.supabaseService.getClient();

  const { data: expiredOffers, error } = await supabase
    .from('job_applications')
    .select('application_id, applicant_id, job_posting_id')
    .eq('status', 'hired')
    .lt('offer_deadline', new Date().toISOString());

  if (error) {
    this.logger.error(`[expireStaleOffers] Query failed: ${error.message}`);
    return;
  }

  if (!expiredOffers || expiredOffers.length === 0) {
    this.logger.log('[expireStaleOffers] No stale offers found');
    return;
  }

  const ids = expiredOffers.map((o: any) => o.application_id);

  await supabase
    .from('job_applications')
    .update({
      status: 'offer_expired',
      rejection_reason: 'Offer deadline passed without response',
      offer_declined_at: new Date().toISOString(),
    })
    .in('application_id', ids);

  for (const offer of expiredOffers) {
    try {
      const { data: posting } = await supabase
        .from('job_postings')
        .select('title')
        .eq('job_posting_id', offer.job_posting_id)
        .maybeSingle();

      const { data: profile } = await supabase
        .from('applicant_profile')
        .select('first_name, last_name, email')
        .eq('applicant_id', offer.applicant_id)
        .maybeSingle();

      if (profile?.email) {
        const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
        this.mailService.sendApplicationStatusEmail({
          to: profile.email,
          applicantName,
          jobTitle: posting?.title ?? 'the position',
          status: 'offer_expired',
        }).catch(() => {});
      }

      await this.notificationsService.createApplicantNotification({
        applicant_id: offer.applicant_id,
        message: `Your offer for ${posting?.title ?? 'a position'} has expired. Please contact HR if you are still interested.`,
        notification_type: 'status_update',
        job_posting_id: offer.job_posting_id,
      });
    } catch (err) {
      this.logger.error(`[expireStaleOffers] Notify failed for ${offer.application_id}: ${err}`);
    }
  }

  this.logger.log(`[expireStaleOffers] Expired ${ids.length} offers`);
}
```

- [ ] **Step 2: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/jobs/jobs.service.ts
git commit -m "feat(jobs): daily cron to auto-expire stale hired offers past deadline"
```

---

### Task 5: Backend — include offer_deadline in responses + include_past filter

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/jobs/jobs.service.ts` (getApplicationsForJob ~line 431)
- Modify: `tribeX-hris-auth-api/apps/api/src/jobs/jobs.controller.ts`

- [ ] **Step 1: Add offer_deadline to getApplicationsForJob select**

Find the `.select(` block inside `getApplicationsForJob` (around line 438):

```ts
const { data: regularApps, error: regularError } = await supabase
  .from('job_applications')
  .select(`
    application_id,
    status,
    applied_at,
    applicant_id,
    applicant_profile (
      first_name,
      last_name,
      email,
      phone_number,
      applicant_code,
      status
    )
  `)
  .eq('job_posting_id', jobPostingId)
  .order('applied_at', { ascending: false });
```

Replace the select string with:

```ts
const { data: regularApps, error: regularError } = await supabase
  .from('job_applications')
  .select(`
    application_id,
    status,
    applied_at,
    applicant_id,
    offer_deadline,
    applicant_profile (
      first_name,
      last_name,
      email,
      phone_number,
      applicant_code,
      status
    )
  `)
  .eq('job_posting_id', jobPostingId)
  .order('applied_at', { ascending: false });
```

- [ ] **Step 2: Add include_past param to method signature and filter**

Change method signature:

```ts
async getApplicationsForJob(jobPostingId: string, companyId: string, includePast = false) {
```

After the `.order('applied_at', { ascending: false });` line, add a filter for active-only when `includePast` is false:

```ts
  let appsQuery = supabase
    .from('job_applications')
    .select(`
      application_id,
      status,
      applied_at,
      applicant_id,
      offer_deadline,
      applicant_profile (
        first_name,
        last_name,
        email,
        phone_number,
        applicant_code,
        status
      )
    `)
    .eq('job_posting_id', jobPostingId)
    .order('applied_at', { ascending: false });

  if (!includePast) {
    appsQuery = appsQuery.not('status', 'in', '("offer_accepted","offer_expired","rejected","withdrawn")');
  }

  const { data: regularApps, error: regularError } = await appsQuery;
```

- [ ] **Step 3: Update controller to accept include_past query param**

In `jobs.controller.ts`, find the `@Get(':jobPostingId/applications')` handler and add the query param:

```ts
@Get(':jobPostingId/applications')
@Roles('HR Officer', 'HR Recruiter', 'HR Interviewer', 'HR Onboarding Officer', 'Admin', 'System Admin', 'Manager')
@ApiQuery({ name: 'include_past', required: false, type: Boolean })
getApplicationsForJob(
  @Param('jobPostingId') jobPostingId: string,
  @Req() req: any,
  @Query('include_past') includePast?: string,
) {
  return this.jobsService.getApplicationsForJob(
    jobPostingId,
    req.user.company_id,
    includePast === 'true',
  );
}
```

Make sure `Query` is imported from `@nestjs/common` and `ApiQuery` from `@nestjs/swagger` in the controller.

- [ ] **Step 4: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/jobs/jobs.service.ts
git add tribeX-hris-auth-api/apps/api/src/jobs/jobs.controller.ts
git commit -m "feat(jobs): include offer_deadline in applications response, add include_past filter"
```

---

### Task 6: Backend — add offer_expired email case

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/mail/mail.service.ts`

- [ ] **Step 1: Add offer_expired to sendApplicationStatusEmail**

Find the `stageCfg` object inside `sendApplicationStatusEmail`. Add the `offer_expired` key after `hired`:

```ts
      offer_expired: {
        subject:     `Your Job Offer Has Expired – ${opts.jobTitle}`,
        headerTitle: 'Offer Expired',
        message:     `Your offer for <strong>${opts.jobTitle}</strong> has expired because the acceptance deadline passed. Please contact HR directly if you are still interested in this position.`,
      },
```

- [ ] **Step 2: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/mail/mail.service.ts
git commit -m "feat(mail): add offer_expired email case to sendApplicationStatusEmail"
```

---

### Task 7: HR Web — hire modal with deadline picker

**Files:**
- Modify: `frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/hr/jobs/page.tsx`

- [ ] **Step 1: Add offerDeadlineDays state near other state declarations (~line 1897)**

Find the `const [pendingMove, setPendingMove]` line (~line 1897) and add after it:

```ts
const [offerDeadlineDays, setOfferDeadlineDays] = useState<number>(7);
```

- [ ] **Step 2: Update moveTo to accept optional deadline**

Find `const moveTo = async (targetStatus: string, silent = false)` (~line 1953) and replace:

```ts
  const moveTo = async (targetStatus: string, silent = false, deadlineDays?: number) => {
    if (!detail) return;
    setUpdating(true);
    try {
      const body: Record<string, unknown> = { status: targetStatus };
      if (targetStatus === 'hired' && deadlineDays) {
        body.offer_deadline_days = deadlineDays;
      }
      await apiFetch(`/jobs/applications/${applicationId}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setDetail((prev) => prev ? { ...prev, status: targetStatus } : prev);
      onStatusChange(targetStatus);
      if (!silent) {
        toast.success(`Moved to ${APP_STATUSES.find((s) => s.value === targetStatus)?.label ?? targetStatus}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };
```

- [ ] **Step 3: Replace MoveConfirmDialog with deadline picker for hired**

Find the `{pendingMove && detail && (` block (~line 2581) and replace:

```tsx
      {/* ── Forward Move Confirmation ─────────────────────────────────────── */}
      {pendingMove && detail && (
        pendingMove === 'hired' ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
              <div className="px-5 py-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">Confirm Hire</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Set offer acceptance deadline for <strong>{detail.applicant_profile.first_name} {detail.applicant_profile.last_name}</strong>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Acceptance deadline</p>
                  <div className="flex gap-2">
                    {[7, 14, 30].map((d) => (
                      <button
                        key={d}
                        onClick={() => setOfferDeadlineDays(d)}
                        className={`flex-1 h-9 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                          offerDeadlineDays === d
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'border-border text-muted-foreground hover:border-green-400 hover:text-green-600'
                        }`}
                      >
                        {d} days
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Deadline: {new Date(Date.now() + offerDeadlineDays * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPendingMove(null)} disabled={updating} className="flex-1 cursor-pointer">
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      const days = offerDeadlineDays;
                      setPendingMove(null);
                      await moveTo('hired', false, days);
                    }}
                    disabled={updating}
                    className="flex-1 cursor-pointer bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  >
                    {updating && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirm & Hire
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <MoveConfirmDialog
            targetLabel={APP_STATUSES.find((s) => s.value === pendingMove)?.label ?? pendingMove}
            applicantName={`${detail.applicant_profile.first_name} ${detail.applicant_profile.last_name}`}
            isHire={false}
            onConfirm={async () => {
              const target = pendingMove;
              setPendingMove(null);
              await moveTo(target);
            }}
            onCancel={() => setPendingMove(null)}
            updating={updating}
          />
        )
      )}
```

- [ ] **Step 4: Commit**

```bash
git add "frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/hr/jobs/page.tsx"
git commit -m "feat(hr-web): hire modal with offer deadline picker"
```

---

### Task 8: HR Web — Past filter + deadline countdown on hired card

**Files:**
- Modify: `frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/hr/jobs/page.tsx`

- [ ] **Step 1: Add showPast state and re-fetch trigger**

Near the other useState declarations (around line 1897), add:

```ts
const [showPast, setShowPast] = useState(false);
```

- [ ] **Step 2: Find where applications are fetched for a job and add include_past param**

Search for the call to `getApplicationsForJob` or the fetch that hits `/:jobPostingId/applications`. It likely looks like:

```ts
await apiFetch(`/jobs/${jobId}/applications`)
```

Change to:

```ts
await apiFetch(`/jobs/${jobId}/applications${showPast ? '?include_past=true' : ''}`)
```

Also trigger a re-fetch when `showPast` changes. Find the `useEffect` that fetches applications and add `showPast` to its dependency array.

- [ ] **Step 3: Add Active/Past toggle chips above the applicant list**

Find where the applicant list is rendered (the `.map` over applications). Just before it, add:

```tsx
{/* Active / Past toggle */}
<div className="flex gap-2 mb-3">
  <button
    onClick={() => setShowPast(false)}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
      !showPast ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'
    }`}
  >
    Active
  </button>
  <button
    onClick={() => setShowPast(true)}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
      showPast ? 'bg-red-600 text-white border-red-600' : 'border-border text-muted-foreground hover:border-red-400'
    }`}
  >
    Past
  </button>
</div>
```

- [ ] **Step 4: Add deadline countdown to hired applicant card in the list**

Find where the applicant list items are rendered (the card/row per applicant showing name, status, etc.). After the status badge for `hired` applicants, add:

```tsx
{app.status === 'hired' && app.offer_deadline && (() => {
  const daysLeft = Math.ceil((new Date(app.offer_deadline).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return null;
  return (
    <span className={`text-[10px] font-semibold ${daysLeft <= 1 ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
      Offer expires {daysLeft === 0 ? 'today' : `in ${daysLeft}d`}
    </span>
  );
})()}
```

- [ ] **Step 5: Commit**

```bash
git add "frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/hr/jobs/page.tsx"
git commit -m "feat(hr-web): active/past filter and offer deadline countdown on hired applicant cards"
```

---

### Task 9: Applicant Web — offer deadline display + named-list multi-offer warning

**Files:**
- Modify: `frontend/blues-clues-hris-frontend-web/src/app/(portal)/applicant/applications/page.tsx`

- [ ] **Step 1: Add offer_expired to STATUS_CONFIG (~line 34)**

In the `STATUS_CONFIG` object, add after `offer_accepted`:

```ts
  offer_expired: { label: "Offer Expired", badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", darkBadge: "bg-red-500/20 text-red-200 border-red-400/30" },
```

- [ ] **Step 2: Update isTerminal and isActive helpers (~line 48)**

```ts
function isTerminal(s: string) {
  return s === "hired" || s === "rejected" || s === "offer_accepted" || s === "offer_expired";
}
```

- [ ] **Step 3: Add offer deadline display in the application detail modal**

Find the section in the detail modal that shows the "Closes" or deadline date (around the header area, search for `offer_deadline` or the deadline display). The modal component function starts around line 560. Find where job metadata is displayed and add:

```tsx
{/* Offer deadline */}
{detail.offer_deadline && localStatus === 'hired' && (() => {
  const daysLeft = Math.ceil((new Date(detail.offer_deadline).getTime() - Date.now()) / 86400000);
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
      daysLeft <= 0 ? 'bg-red-50 border-red-200 text-red-700' :
      daysLeft <= 3 ? 'bg-amber-50 border-amber-200 text-amber-700' :
      'bg-blue-50 border-blue-200 text-blue-700'
    }`}>
      <Clock className="h-3.5 w-3.5" />
      {daysLeft <= 0 ? 'Offer expired' : `Offer expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
    </div>
  );
})()}
```

Make sure `Clock` is imported from `lucide-react`.

- [ ] **Step 4: Update accept offer confirmation modal to show named list**

The page component receives `applications` (the full list) as a prop or has access to it in scope. Find the `handleAcceptOffer` function (~line 614) and the `showAcceptConfirm` modal (~line 640).

In the parent `ApplicationsPage` component, find where the detail modal is rendered and pass `allApplications` as a prop. Then in the detail modal component, use it to build the other-offers list.

Find the modal JSX (~line 654) and replace the warning paragraph:

```tsx
{/* Other pending offers list */}
{(() => {
  const otherHired = allApplications?.filter(
    (a) => a.status === 'hired' && a.application_id !== detail.application_id
  ) ?? [];
  if (otherHired.length === 0) {
    return (
      <p className="text-sm text-gray-600 leading-relaxed">
        By accepting, you commit to joining. This action cannot be undone.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 leading-relaxed">
        You have <strong>{otherHired.length}</strong> other pending offer{otherHired.length > 1 ? 's' : ''} that will be automatically declined:
      </p>
      <ul className="space-y-1">
        {otherHired.map((o) => (
          <li key={o.application_id} className="flex items-center gap-2 text-xs text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
            <span>{o.job_postings?.title ?? 'Unknown position'}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-red-600 font-semibold">This cannot be undone.</p>
    </div>
  );
})()}
```

You will need to thread `allApplications` from the page level into the detail modal. Find the `ApplicationDetailModal` component call in the page and pass it:

```tsx
<ApplicationDetailModal
  detail={selectedDetail}
  allApplications={applications}
  onClose={...}
  onOfferAccepted={...}
/>
```

And update the component's props type to include:
```ts
allApplications?: Application[];
```

- [ ] **Step 5: Add offer_expired terminal state in applicant card (~line 191)**

Find the terminal banner block (~line 192) and add the `offer_expired` case:

```tsx
{app.status === "offer_expired"
  ? "This offer has expired. Contact HR if you are still interested."
  : app.status === "offer_accepted"
  ? "Offer Accepted — Onboarding in Progress"
  : app.status === "hired"
  ? "Congratulations! You've been hired."
  : "This application was not selected."}
```

- [ ] **Step 6: Commit**

```bash
git add "frontend/blues-clues-hris-frontend-web/src/app/(portal)/applicant/applications/page.tsx"
git commit -m "feat(applicant-web): offer deadline display, named-list multi-offer warning, offer_expired state"
```

---

### Task 10: Applicant Web — Past filter tab

**Files:**
- Modify: `frontend/blues-clues-hris-frontend-web/src/app/(portal)/applicant/applications/page.tsx`

- [ ] **Step 1: Update FilterStatus type (~line 46)**

```ts
type FilterStatus = "all" | "active" | "hired" | "rejected" | "past";
```

- [ ] **Step 2: Update filter logic**

Find where `filterStatus` is applied to the applications array. Add a `past` case:

```ts
const filtered = applications.filter((app) => {
  if (filterStatus === "all")    return true;
  if (filterStatus === "active") return isActive(app.status);
  if (filterStatus === "hired")  return app.status === "hired";
  if (filterStatus === "rejected") return app.status === "rejected";
  if (filterStatus === "past")   return app.status === "offer_accepted" || app.status === "offer_expired";
  return true;
});
```

- [ ] **Step 3: Add Past chip to filter row**

Find the filter chip row (the div with All / Active / Hired / Not Selected chips). Add after the last chip:

```tsx
<button
  onClick={() => setFilterStatus("past")}
  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${
    filterStatus === "past"
      ? "bg-red-100 text-red-700 border-red-200"
      : "border-border text-muted-foreground hover:border-red-300"
  }`}
>
  Past
  <span className="tabular-nums">{applications.filter(a => a.status === 'offer_accepted' || a.status === 'offer_expired').length}</span>
</button>
```

- [ ] **Step 4: Commit**

```bash
git add "frontend/blues-clues-hris-frontend-web/src/app/(portal)/applicant/applications/page.tsx"
git commit -m "feat(applicant-web): add Past filter tab for offer_accepted and offer_expired applications"
```

---

### Task 11: Mobile HR — deadline picker on hire + past toggle

**Files:**
- Modify: `blues-clues-hris-mobile/src/screens/HROfficerRecruitmentScreen.tsx`

- [ ] **Step 1: Add offerDeadlineDays state**

After the existing `useState` declarations (around line 155), add:

```ts
const [offerDeadlineDays, setOfferDeadlineDays] = useState(7);
```

- [ ] **Step 2: Modify handleAdvanceStage for hired status**

Find `handleAdvanceStage` (added in a previous session). Replace it with a version that shows a deadline picker when advancing to `hired`:

```ts
const handleAdvanceStage = async (app: Application, deadlineDays?: number) => {
  const currentIdx = PIPELINE_STAGE_ORDER.indexOf(app.status);
  const nextStatus = PIPELINE_STAGE_ORDER[currentIdx + 1];
  if (!nextStatus) return;

  if (nextStatus === 'hired') {
    // Show deadline picker first
    Alert.alert(
      'Set Offer Deadline',
      'How many days does the applicant have to accept this offer?',
      [
        { text: '7 days',  onPress: () => handleAdvanceStage(app, 7) },
        { text: '14 days', onPress: () => handleAdvanceStage(app, 14) },
        { text: '30 days', onPress: () => handleAdvanceStage(app, 30) },
        { text: 'Cancel',  style: 'cancel' },
      ],
    );
    if (!deadlineDays) return; // wait for selection
  }

  try {
    const body: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === 'hired' && deadlineDays) {
      body.offer_deadline_days = deadlineDays;
    }
    const res = await authFetch(
      `${API_BASE_URL}/jobs/${selectedJob?.job_posting_id}/applications/${app.application_id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) throw new Error('Failed to advance stage');
    if (selectedJob) {
      setLoadingApplications(true);
      await fetchApplications(selectedJob.job_posting_id);
    }
  } catch (e: any) {
    Alert.alert('Error', e?.message || 'Failed to advance stage');
  }
};
```

- [ ] **Step 3: Add showPast state + visibleApplications**

After the `offerDeadlineDays` state, add:

```ts
const [showPast, setShowPast] = useState(false);
```

After the applications state is populated (after `fetchApplications` sets `applications`), add a derived value. Find where `applications.map(app => {` is used in JSX and replace with `visibleApplications.map(app => {`. Also add before the JSX return:

```ts
const PAST_STATUSES = ['offer_accepted', 'offer_expired', 'rejected', 'withdrawn'];
const visibleApplications = applications.filter((app: Application) =>
  showPast
    ? PAST_STATUSES.includes(app.status)
    : !PAST_STATUSES.includes(app.status),
);
```

- [ ] **Step 4: Add Active/Past toggle above applicant list**

Find the applicant list section (where `visibleSessions.map` or `applications.map` was). Just before the map, add:

```tsx
{/* Active / Past toggle */}
<View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
  <Pressable
    style={[
      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
      !showPast ? { backgroundColor: '#1E40AF', borderColor: '#1E40AF' } : { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
    ]}
    onPress={() => setShowPast(false)}
  >
    <Text style={[{ fontSize: 12, fontWeight: '700' }, !showPast ? { color: '#FFFFFF' } : { color: '#64748B' }]}>Active</Text>
  </Pressable>
  <Pressable
    style={[
      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
      showPast ? { backgroundColor: '#DC2626', borderColor: '#DC2626' } : { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
    ]}
    onPress={() => setShowPast(true)}
  >
    <Text style={[{ fontSize: 12, fontWeight: '700' }, showPast ? { color: '#FFFFFF' } : { color: '#64748B' }]}>Past</Text>
  </Pressable>
</View>
```

- [ ] **Step 5: Add offer deadline countdown on hired card**

Find the applicant card JSX (inside `visibleApplications.map`). After the status pill, add:

```tsx
{app.status === 'hired' && (app as any).offer_deadline && (() => {
  const daysLeft = Math.ceil((new Date((app as any).offer_deadline).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return null;
  return (
    <Text style={{ fontSize: 10, color: daysLeft <= 1 ? '#DC2626' : daysLeft <= 3 ? '#D97706' : '#64748B', fontWeight: '600' }}>
      Offer expires {daysLeft === 0 ? 'today' : `in ${daysLeft}d`}
    </Text>
  );
})()}
```

- [ ] **Step 6: Commit**

```bash
git add blues-clues-hris-mobile/src/screens/HROfficerRecruitmentScreen.tsx
git commit -m "feat(mobile-hr): deadline picker on hire, active/past toggle, offer expiry countdown"
```

---

### Task 12: Mobile Applicant — deadline display + Accept Offer button + named list

**Files:**
- Modify: `blues-clues-hris-mobile/src/screens/ApplicantApplicationsScreen.tsx`

- [ ] **Step 1: Add offer_expired to ApplicationStage type and STAGE_LABELS**

Find `type ApplicationStage` (around line 24) and add:

```ts
type ApplicationStage =
  | "submitted"
  | "screening"
  | "first_interview"
  | "technical_interview"
  | "final_interview"
  | "hired"
  | "offer_accepted"
  | "offer_expired"
  | "rejected";
```

In `STAGE_LABELS`:

```ts
const STAGE_LABELS: Record<ApplicationStage, string> = {
  submitted:           "Applied",
  screening:           "Screening",
  first_interview:     "1st Interview",
  technical_interview: "Technical",
  final_interview:     "Final Interview",
  hired:               "Hired",
  offer_accepted:      "Offer Accepted",
  offer_expired:       "Offer Expired",
  rejected:            "Rejected",
};
```

In `getStatusStyle`:

```ts
    case "offer_accepted": return { bg: "#DCFCE7", border: "#BBF7D0", text: "#166534" };
    case "offer_expired":  return { bg: "#FEE2E2", border: "#FECACA", text: "#991B1B" };
```

- [ ] **Step 2: Add offer_deadline to Application type**

Find `type Application` and add:

```ts
offer_deadline?: string | null;
```

- [ ] **Step 3: Add offerAccepting state + handleAcceptOffer**

After the existing state declarations (around line 78), add:

```ts
const [offerAccepting, setOfferAccepting] = useState<string | null>(null);
```

After state declarations, add handler:

```ts
const handleAcceptOffer = async (app: Application, allApps: Application[]) => {
  const otherHired = allApps.filter(
    (a) => a.status === 'hired' && a.application_id !== app.application_id
  );

  const warningMessage = otherHired.length > 0
    ? `You have ${otherHired.length} other pending offer${otherHired.length > 1 ? 's' : ''} that will be automatically declined:\n\n${otherHired.map(o => `• ${o.job_title ?? 'Unknown position'}`).join('\n')}\n\nThis cannot be undone.`
    : 'By accepting, you commit to joining. This action cannot be undone.';

  Alert.alert(
    'Accept this offer?',
    warningMessage,
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Confirm & Accept',
        onPress: async () => {
          setOfferAccepting(app.application_id);
          try {
            const res = await authFetch(
              `${API_BASE_URL}/jobs/applications/${app.application_id}/accept-offer`,
              { method: 'PATCH' },
            );
            if (!res.ok) throw new Error('Failed to accept offer');
            Alert.alert('Offer Accepted!', 'Head to Onboarding to get started.');
            // Refresh
            fetchApplications();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to accept offer. Please try again.');
          } finally {
            setOfferAccepting(null);
          }
        },
      },
    ],
  );
};
```

Note: `fetchApplications` should be the function that re-loads the list. Check what it's called in the existing screen and use the same name.

- [ ] **Step 4: Add offer deadline countdown + Accept Offer button on hired cards**

Find the application card JSX (inside `applications.map`). After the status pill, add:

```tsx
{/* Offer deadline countdown */}
{app.status === 'hired' && app.offer_deadline && (() => {
  const daysLeft = Math.ceil((new Date(app.offer_deadline).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return null;
  return (
    <Text style={{ fontSize: 11, fontWeight: '600', color: daysLeft <= 1 ? '#DC2626' : daysLeft <= 3 ? '#D97706' : '#64748B', marginTop: 2 }}>
      ⏰ Offer expires {daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
    </Text>
  );
})()}

{/* Accept Offer button */}
{app.status === 'hired' && (
  <TouchableOpacity
    style={{
      marginTop: 8,
      backgroundColor: '#15803D',
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 14,
      alignItems: 'center',
      opacity: offerAccepting === app.application_id ? 0.6 : 1,
    }}
    onPress={() => handleAcceptOffer(app, applications)}
    disabled={offerAccepting === app.application_id}
  >
    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>
      {offerAccepting === app.application_id ? 'Processing...' : 'Accept Offer'}
    </Text>
  </TouchableOpacity>
)}

{/* Offer expired state */}
{app.status === 'offer_expired' && (
  <Text style={{ fontSize: 11, color: '#B91C1C', marginTop: 4, fontStyle: 'italic' }}>
    This offer has expired. Contact HR if still interested.
  </Text>
)}
```

Make sure `TouchableOpacity` is imported from `react-native` (it should already be from the onboarding offer flow we added earlier).

- [ ] **Step 5: Commit**

```bash
git add blues-clues-hris-mobile/src/screens/ApplicantApplicationsScreen.tsx
git commit -m "feat(mobile-applicant): offer deadline countdown, accept offer button, named-list multi-offer warning"
```
