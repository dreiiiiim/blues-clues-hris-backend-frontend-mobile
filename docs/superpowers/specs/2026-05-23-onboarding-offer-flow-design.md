# Onboarding Offer Accept/Reject Flow — Design Spec
**Date:** 2026-05-23  
**Status:** Approved  
**Scope:** Applicant accept/decline job offer before onboarding tasks unlock; email notification; HR archived view

---

## Problem Summary

Currently when HR marks an applicant as `hired`, an onboarding session is auto-created and tasks are immediately accessible. This ignores the real-world scenario where:
- An applicant applied to multiple jobs and was hired for more than one
- The applicant needs to accept or decline the offer before onboarding begins
- Declined sessions clutter the HR dashboard

---

## Architecture & Data Flow

```
HR sets application status = 'hired'
        ↓
onboarding_session created with offer_status = 'pending'
        ↓
Email sent to applicant: "You have a job offer for [Position] at [Company]"
        ↓
Applicant opens mobile app → EmployeeOnboardingScreen
        ↓
offer_status === 'pending' → show Offer Card (tasks hidden)
        ↓
    ┌─────────────┐
  Accept         Decline
    ↓                ↓
offer_status     offer_status
= 'accepted'     = 'declined'
    +                ↓
auto-decline     session archived
all other        (HR sees in
pending          archived toggle)
sessions
    ↓
Normal onboarding
tasks unlocked
```

---

## Database Change

**When DB team is ready:**
```sql
ALTER TABLE onboarding_sessions
ADD COLUMN offer_status VARCHAR(20) NOT NULL DEFAULT 'accepted';
-- Values: 'pending' | 'accepted' | 'declined'
-- DEFAULT 'accepted' preserves all existing sessions (no migration of data needed)
```

---

## Backend Changes

### New Endpoints

```
POST /onboarding/applicant/session/:sessionId/accept
POST /onboarding/applicant/session/:sessionId/decline
```

Both endpoints require authenticated applicant JWT. Session must belong to the requesting applicant.

#### Accept logic
```ts
// 1. Verify session belongs to applicant and offer_status === 'pending'
// 2. Set offer_status = 'accepted' on this session
// 3. Find all other sessions for same applicant where offer_status = 'pending'
// 4. Set those sessions offer_status = 'declined'
// 5. Return updated session
```

#### Decline logic
```ts
// 1. Verify session belongs to applicant and offer_status === 'pending'
// 2. Set offer_status = 'declined'
// 3. Return updated session
```

#### Error handling
| Scenario | Response |
|---|---|
| Session not found or not owned by applicant | 403 Forbidden |
| Session already accepted/declined | 400 BadRequest: "Offer already responded to" |
| DB failure | 500 InternalServerError |

### Email Notification

Trigger inside `createApplicantSession` (already called when hired, `jobs.service.ts:800`):

```ts
await this.notificationsService.sendOfferEmail({
  applicant_id: applicantId,
  position:     jobPosting.title,
  department:   jobPosting.department,
  company:      company.name,
  deadline:     session.deadline_date,
});
```

Use existing `NotificationsService` pattern (same as status-change notifications at `jobs.service.ts:812`). Email subject: `"You have a job offer — [Position] at [Company]"`.

### Modified HR Sessions Endpoint

`GET /onboarding/hr/sessions` — add optional query param:
```
?include_declined=true   → returns all sessions including declined
?include_declined=false  → default, excludes offer_status = 'declined'
```

### Modified Applicant Session Endpoint

`GET /onboarding/applicant/session` — response includes `offer_status` field.

---

## Mobile Changes

### File: `blues-clues-hris-mobile/src/screens/EmployeeOnboardingScreen.tsx`

#### Add `offer_status` to `OnboardingSession` type
```ts
type OnboardingSession = {
  // ...existing fields...
  offer_status: 'pending' | 'accepted' | 'declined';
};
```

#### Offer Card (shown when `offer_status === 'pending'`)

Replaces tabs + items list. Inserted after the progress card block:

```tsx
{onboarding.offer_status === 'pending' && (
  <View style={styles.offerCard}>
    <Text style={styles.offerIcon}>🎉</Text>
    <Text style={styles.offerTitle}>You have a job offer!</Text>
    <Text style={styles.offerPosition}>
      {onboarding.assigned_position} • {onboarding.assigned_department}
    </Text>
    <Text style={styles.offerDeadline}>
      Respond before:{' '}
      {new Date(onboarding.deadline_date).toLocaleDateString('en-PH', {
        month: 'long', day: 'numeric', year: 'numeric',
      })}
    </Text>
    <View style={styles.offerButtonRow}>
      <TouchableOpacity
        style={[styles.offerBtn, styles.offerAcceptBtn, offerLoading && styles.offerBtnDisabled]}
        onPress={handleAcceptOffer}
        disabled={offerLoading}
      >
        <Text style={styles.offerBtnText}>
          {offerLoading ? 'Processing...' : 'Accept Offer'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.offerBtn, styles.offerDeclineBtn, offerLoading && styles.offerBtnDisabled]}
        onPress={handleDeclineOffer}
        disabled={offerLoading}
      >
        <Text style={styles.offerDeclineBtnText}>Decline</Text>
      </TouchableOpacity>
    </View>
  </View>
)}
```

#### Offer handlers
```ts
const [offerLoading, setOfferLoading] = useState(false);

const handleAcceptOffer = async () => {
  if (!onboarding) return;
  setOfferLoading(true);
  try {
    await authFetch(
      `${API_BASE_URL}/onboarding/applicant/session/${onboarding.session_id}/accept`,
      { method: 'POST' }
    );
    // Reload session to get offer_status = 'accepted' and unlocked tasks
    const res = await authFetch(`${API_BASE_URL}/onboarding/applicant/session`);
    const data = await res.json();
    setOnboarding(data);
  } catch {
    Alert.alert('Error', 'Failed to accept offer. Please try again.');
  } finally {
    setOfferLoading(false);
  }
};

const handleDeclineOffer = () => {
  Alert.alert(
    'Decline Offer',
    'Are you sure you want to decline this job offer? This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setOfferLoading(true);
          try {
            await authFetch(
              `${API_BASE_URL}/onboarding/applicant/session/${onboarding!.session_id}/decline`,
              { method: 'POST' }
            );
            const res = await authFetch(`${API_BASE_URL}/onboarding/applicant/session`);
            const data = await res.json();
            setOnboarding(data);
          } catch {
            Alert.alert('Error', 'Failed to decline offer. Please try again.');
          } finally {
            setOfferLoading(false);
          }
        },
      },
    ]
  );
};
```

#### Declined state (shown when `offer_status === 'declined'`)
```tsx
{onboarding.offer_status === 'declined' && (
  <View style={styles.declinedBox}>
    <Text style={styles.declinedTitle}>Offer Declined</Text>
    <Text style={styles.declinedText}>
      You have declined this job offer. Please contact HR if this was a mistake.
    </Text>
  </View>
)}
```

#### Guard: only show tabs+items when `offer_status === 'accepted'` (or undefined for legacy)

Wrap the existing tabs + items block:
```tsx
{(onboarding.offer_status === 'accepted' || !onboarding.offer_status) && (
  // ...existing tabs and items rendering...
)}
```

### File: `blues-clues-hris-mobile/src/screens/HROfficerOnboardingScreen.tsx`

#### Add archived toggle state
```ts
const [showArchived, setShowArchived] = useState(false);
```

#### Filter sessions list
```ts
const visibleSessions = sessions.filter(s =>
  showArchived
    ? (s as any).offer_status === 'declined'
    : (s as any).offer_status !== 'declined'
);
```

#### Archived toggle chip (above sessions list)
```tsx
<View style={styles.archivedToggleRow}>
  <Pressable
    style={[styles.archivedToggle, showArchived && styles.archivedToggleActive]}
    onPress={() => setShowArchived(v => !v)}
  >
    <Text style={[styles.archivedToggleText, showArchived && styles.archivedToggleTextActive]}>
      {showArchived
        ? 'Showing Archived'
        : `Archived (${sessions.filter(s => (s as any).offer_status === 'declined').length})`}
    </Text>
  </Pressable>
</View>
```

---

## Error Handling Summary

| Scenario | Behaviour |
|---|---|
| Applicant accepts when already accepted | Backend 400, mobile shows alert |
| Applicant declines — shows confirmation | Alert with destructive confirm before API call |
| Email send fails | Log error, do not block session creation (non-blocking) |
| Network failure on accept/decline | Alert shown, offer card remains |
| Multiple pending sessions — one accepted | All others auto-declined server-side atomically |

---

## Dependencies

- DB team must run `ALTER TABLE onboarding_sessions ADD COLUMN offer_status` before deployment
- `NotificationsService` must support email sending (verify SDK configured)
- Existing `createApplicantSession` call in `jobs.service.ts:800` is the email trigger point

---

## Out of Scope

- Offer letter PDF generation
- Offer expiry / auto-decline after deadline
- Web frontend offer flow (mobile only per requirements)
- Push notifications (email only)
