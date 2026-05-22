# Offer Acceptance Deadline & Multi-Offer Flow

**Date:** 2026-05-23
**Scope:** Recruitment pipeline — offer acceptance window, auto-expiry, multi-offer guard, past candidates view

---

## Summary

When HR hires a candidate, they set an acceptance deadline (default 7 days). The applicant must accept or let it expire. If hired by multiple companies, accepting one auto-declines all others with a named-list warning. A daily cron expires stale offers. Both HR and applicant views gain a "Past" filter showing terminal applications.

---

## Data Model

### DB Migration (run before any code change)

```sql
ALTER TABLE job_applications
  ADD COLUMN offer_deadline TIMESTAMPTZ,
  ADD COLUMN offer_declined_at TIMESTAMPTZ;
-- offer_accepted_at already exists
```

### Status values added

| Status | Trigger |
|---|---|
| `offer_accepted` | Applicant accepts via portal (already exists) |
| `offer_expired` | Cron fires past deadline, OR applicant accepted a different offer |

`offer_expired` rejection_reason field:
- Cron path: `'Offer deadline passed without response'`
- Multi-offer path: `'Applicant accepted another offer'`

### Terminal statuses (stage guard)

Updated `TERMINAL_STATUSES`:
```ts
['rejected', 'withdrawn', 'offer_accepted', 'offer_expired']
```

---

## Backend (`jobs.service.ts` + `jobs.controller.ts`)

### 1. UpdateApplicationStatusDto

Add optional field:
```ts
@IsOptional()
@IsInt()
@Min(1)
@Max(90)
offer_deadline_days?: number;  // only used when status === 'hired', default 7
```

### 2. updateApplicationStatus — hired path

When `status === 'hired'`:
- Compute `offer_deadline = now + (offer_deadline_days ?? 7) days`
- Include in DB update payload alongside `status`

### 3. Stage guard update

Add `offer_accepted` and `offer_expired` to `TERMINAL_STATUSES` constant so nothing can transition out of them.

### 4. acceptOffer method (extend existing)

```
1. Fetch app — verify applicant_id matches, status === 'hired'
2. Check offer_deadline not passed — throw BadRequestException if expired
3. Update this app: status='offer_accepted', offer_accepted_at=now
4. Find all other status='hired' apps for same applicant_id (any company)
5. Bulk-update them: status='offer_expired',
   rejection_reason='Applicant accepted another offer',
   offer_declined_at=now
6. For each auto-declined app: send notification + sendApplicationStatusEmail
   (new status key 'offer_expired' — add to mail method)
```

### 5. Cron job (new)

```ts
@Cron('0 1 * * *', { timeZone: 'Asia/Manila' })
async expireStaleOffers() {
  // SELECT where status='hired' AND offer_deadline < now()
  // Bulk UPDATE to offer_expired,
  //   rejection_reason='Offer deadline passed without response',
  //   offer_declined_at=now
  // For each: createApplicantNotification + sendApplicationStatusEmail
}
```

### 6. getMyApplications response

Include `offer_deadline` field in returned application objects.

### 7. HR getAllApplications / getApplicationsForPosting

Add `include_past` query param (boolean, default false).
- `false`: exclude `offer_accepted`, `offer_expired`, `rejected`, `withdrawn`
- `true`: show all statuses

---

## HR Web Frontend

### Hire Candidate modal

Replace immediate fire with inline deadline picker before confirming:

```
Set offer acceptance deadline
  ○ 7 days   ○ 14 days   ○ 30 days   ○ Custom [__]
  Deadline: June 3, 2026
  [Cancel]                [Confirm & Hire →]
```

Sends `{ status: 'hired', offer_deadline_days: N }` to existing PATCH endpoint.

### Applicant list — Past toggle

Toggle chips above applicant list per job posting:
```
[Active (4)]  [Past (2)]
```
- Active: excludes `offer_accepted`, `offer_expired`, `rejected`, `withdrawn`
- Past: shows only those four statuses

Badges:
- `offer_accepted` → green "Accepted"
- `offer_expired` → red "Expired"

### Hired card — deadline countdown

Below status pill on hired applicant card:
- `Offer expires in 5 days` (amber, <3 days = red)
- `Offer expired` (muted, in past view)

---

## Applicant Web Frontend (`applications/page.tsx`)

### Offer deadline display

In application detail modal, replace job posting "Closes" date with:
```
⏰ Offer expires: June 3, 2026 (5 days left)
```
Amber when ≤3 days remaining, red when same day, hidden when `offer_deadline` is null.

### Accept Offer modal — named list

When applicant has other `status='hired'` applications in state, show:

```
Accept this offer?
  Software Engineer @ Blue's Clues HRIS

  ⚠️ You have 2 other pending offers that will be
  automatically declined:
    • DevOps Engineer @ Acme Corp
    • Data Analyst @ TechStart Inc

  This cannot be undone.

  [Not now]           [Confirm & Accept →]
```

Frontend builds list from already-loaded application state — no extra API call.

### My Applications — Past filter

Add "Past" chip to existing filter row (All / Active / Hired / Not Selected / **Past**).
- Past shows `offer_accepted` + `offer_expired`
- `offer_expired`: red "Offer Expired" badge + "This offer has expired. Please contact HR if you have questions."
- `offer_accepted`: green "Offer Accepted" badge + "Head to Onboarding →" link, Accept button hidden

---

## Mobile

### HR `HROfficerRecruitmentScreen`

- **Hire advance button** (`→ Hire`): replace direct PATCH with Alert/bottom sheet asking deadline:
  ```
  Alert.alert("Set Offer Deadline", "...",
    [{ text: "7 days" }, { text: "14 days" }, { text: "30 days" }])
  ```
  Then fire PATCH with chosen `offer_deadline_days`.
- **Past toggle chip**: same pattern as HR onboarding archived toggle. Shows `offer_accepted` + `offer_expired` + `rejected` + `withdrawn`.
- **Hired card**: show deadline countdown badge.

### Applicant `ApplicantApplicationsScreen`

- **Hired card**: show `Expires Jun 3` in amber/red below status pill.
- **Accept Offer button**: new button on `hired` cards. On press, Alert shows named list of other pending offers, then calls `PATCH /jobs/applications/:id/accept-offer`.
- **`offer_expired` card**: red "Expired" badge, no action button.
- **`offer_accepted` card**: green "Accepted" badge + "Go to Onboarding" button.

---

## Email

Add `offer_expired` case to `sendApplicationStatusEmail`:
```
Subject: "Your Job Offer Has Expired – {jobTitle}"
Body: offer deadline passed, contact HR if interested
```

---

## Out of Scope

- Applicant explicitly declining an offer (no "Decline" button — they either accept or let it expire)
- HR extending a deadline after expiry
- Partial-accept flows
