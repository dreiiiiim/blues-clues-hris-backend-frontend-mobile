# Onboarding Offer Accept/Reject Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate onboarding tasks behind an applicant accept/decline offer step; auto-decline other pending offers on accept; email notification on offer creation; HR archived view for declined sessions.

**Architecture:** Add `offer_status` column to `onboarding_sessions` (DB team). Set `offer_status='pending'` on session creation. Two new POST endpoints on `ApplicantOnboardingController`. Email via existing `NotificationsService.createApplicantNotification`. Mobile offer card on `EmployeeOnboardingScreen`. HR archived toggle on `HROfficerOnboardingScreen`.

**Tech Stack:** NestJS, Supabase, React Native/Expo, TypeScript

**PREREQUISITE:** DB team must run before any backend code changes:
```sql
ALTER TABLE onboarding_sessions
ADD COLUMN offer_status VARCHAR(20) NOT NULL DEFAULT 'accepted';
```

---

### Task 1: Set offer_status='pending' on session creation + send notification

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/onboarding/onboarding.service.ts` (around line 2305)

- [ ] **Step 1: Add offer_status to session insert**

In `onboarding.service.ts`, find the `supabase.from('onboarding_sessions').insert({` block inside `createApplicantSession` (line ~2305). Add `offer_status: 'pending'` to the insert object:

```ts
const { error: sessionErr } = await supabase
  .from('onboarding_sessions')
  .insert({
    session_id: sessionId,
    account_id: params.applicantId,
    template_id: templateId,
    assigned_position: posting?.title || 'New Hire',
    assigned_department: departmentName,
    status: 'not-started',
    progress_percentage: 0,
    deadline_date: deadline.toISOString(),
    offer_status: 'pending',   // ← add this line
  });
```

- [ ] **Step 2: Send offer notification after session creation**

After the `this.logger.log(...)` line at ~2340 (still inside `createApplicantSession`, after the items insert block), add:

```ts
// Send offer notification to applicant
try {
  await this.notificationsService.createApplicantNotification({
    applicant_id: params.applicantId,
    message: `You have a job offer for ${posting?.title ?? 'a new position'}. Open the app to accept or decline.`,
    notification_type: 'status_update',
    job_posting_id: params.jobPostingId,
  });
} catch (notifErr) {
  this.logger.error(`Failed to send offer notification: ${notifErr}`);
}
```

- [ ] **Step 3: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/onboarding/onboarding.service.ts
git commit -m "feat(onboarding): set offer_status=pending on session creation, send offer notification"
```

---

### Task 2: Add offer_status to getMySession response

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/onboarding/onboarding.service.ts` (around line 141)

- [ ] **Step 1: Find getMySession and include offer_status in select**

In `getMySession` (line ~141), find the Supabase query that selects from `onboarding_sessions`. Add `offer_status` to the select fields. Look for a line like:

```ts
.select('session_id, template_name, ...')
```

Add `offer_status` to that select string, e.g.:

```ts
.select('session_id, offer_status, template_name, ...')
```

- [ ] **Step 2: Ensure offer_status is included in the returned object**

Find where `getMySession` builds its return object. Add `offer_status` to it:

```ts
return {
  session_id: session.session_id,
  offer_status: session.offer_status ?? 'accepted',  // fallback for legacy rows
  // ...rest of fields
};
```

- [ ] **Step 3: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/onboarding/onboarding.service.ts
git commit -m "feat(onboarding): include offer_status in applicant session response"
```

---

### Task 3: Add accept/decline service methods

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/onboarding/onboarding.service.ts`

- [ ] **Step 1: Add acceptOffer method**

At the end of `OnboardingService` class (before the closing `}`), add:

```ts
async acceptOffer(sessionId: string, applicantId: string) {
  const supabase = this.supabaseService.getClient();

  const { data: session, error: fetchErr } = await supabase
    .from('onboarding_sessions')
    .select('session_id, account_id, offer_status')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (fetchErr || !session) {
    throw new ForbiddenException('Session not found.');
  }
  if (session.account_id !== applicantId) {
    throw new ForbiddenException('Access denied.');
  }
  if (session.offer_status !== 'pending') {
    throw new BadRequestException('Offer already responded to.');
  }

  // Accept this session
  const { error: acceptErr } = await supabase
    .from('onboarding_sessions')
    .update({ offer_status: 'accepted' })
    .eq('session_id', sessionId);

  if (acceptErr) throw new InternalServerErrorException(acceptErr.message);

  // Auto-decline all other pending sessions for this applicant
  const { error: declineErr } = await supabase
    .from('onboarding_sessions')
    .update({ offer_status: 'declined' })
    .eq('account_id', applicantId)
    .eq('offer_status', 'pending')
    .neq('session_id', sessionId);

  if (declineErr) {
    this.logger.error(`Failed to auto-decline other sessions: ${declineErr.message}`);
  }

  return { message: 'Offer accepted.' };
}

async declineOffer(sessionId: string, applicantId: string) {
  const supabase = this.supabaseService.getClient();

  const { data: session, error: fetchErr } = await supabase
    .from('onboarding_sessions')
    .select('session_id, account_id, offer_status')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (fetchErr || !session) {
    throw new ForbiddenException('Session not found.');
  }
  if (session.account_id !== applicantId) {
    throw new ForbiddenException('Access denied.');
  }
  if (session.offer_status !== 'pending') {
    throw new BadRequestException('Offer already responded to.');
  }

  const { error } = await supabase
    .from('onboarding_sessions')
    .update({ offer_status: 'declined' })
    .eq('session_id', sessionId);

  if (error) throw new InternalServerErrorException(error.message);

  return { message: 'Offer declined.' };
}
```

- [ ] **Step 2: Verify imports at top of onboarding.service.ts**

`ForbiddenException`, `BadRequestException`, `InternalServerErrorException` must be in the NestJS import. Check line 1. If missing, add them:

```ts
import { Injectable, BadRequestException, NotFoundException, Logger,
  InternalServerErrorException, ForbiddenException } from '@nestjs/common';
```

- [ ] **Step 3: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/onboarding/onboarding.service.ts
git commit -m "feat(onboarding): add acceptOffer and declineOffer service methods"
```

---

### Task 4: Add accept/decline endpoints to controller

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/onboarding/applicant-onboarding.controller.ts`

- [ ] **Step 1: Add two POST endpoints**

At the end of `ApplicantOnboardingController` class (before closing `}`), add:

```ts
@Post('session/:sessionId/accept')
@Roles(...ONBOARDING_USERS)
@ApiOperation({ summary: 'Accept a job offer — unlocks onboarding tasks' })
acceptOffer(
  @Param('sessionId') sessionId: string,
  @Req() req: any,
) {
  return this.onboardingService.acceptOffer(sessionId, req.user.sub_userid);
}

@Post('session/:sessionId/decline')
@Roles(...ONBOARDING_USERS)
@ApiOperation({ summary: 'Decline a job offer — archives the session' })
declineOffer(
  @Param('sessionId') sessionId: string,
  @Req() req: any,
) {
  return this.onboardingService.declineOffer(sessionId, req.user.sub_userid);
}
```

- [ ] **Step 2: Restart server and verify routes appear**

```bash
cd tribeX-hris-auth-api
npm run start:dev
```

Expected in startup logs:
```
[RouterExplorer] Mapped {/api/tribeX/auth/v1/.../onboarding/applicant/session/:sessionId/accept, POST}
[RouterExplorer] Mapped {/api/tribeX/auth/v1/.../onboarding/applicant/session/:sessionId/decline, POST}
```

- [ ] **Step 3: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/onboarding/applicant-onboarding.controller.ts
git commit -m "feat(onboarding): add POST accept/decline offer endpoints"
```

---

### Task 5: Add include_declined filter to HR sessions endpoint

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/onboarding/hr-onboarding.controller.ts`
- Modify: `tribeX-hris-auth-api/apps/api/src/onboarding/onboarding.service.ts`

- [ ] **Step 1: Add query param to HR sessions controller**

In `hr-onboarding.controller.ts`, find the `@Get('sessions')` handler (line ~28). Add `@Query` param:

```ts
@Get('sessions')
@Roles('HR Officer', 'HR Recruiter', 'Admin', 'System Admin')
@ApiOperation({ summary: 'List all onboarding sessions with employee names' })
@ApiQuery({ name: 'include_declined', required: false, type: Boolean })
getSessions(
  @Req() req: any,
  @Query('include_declined') includeDeclined?: string,
) {
  return this.onboardingService.getHrSessions(
    req.user.company_id,
    includeDeclined === 'true',
  );
}
```

Check what the existing method name is (`getSessions` or `getHrSessions`) and match it.

- [ ] **Step 2: Update service method signature**

Find the service method called by this controller (search for the method name used above). Add `includeDeclined` parameter and filter:

```ts
async getHrSessions(companyId: string, includeDeclined = false) {
  const supabase = this.supabaseService.getClient();

  let query = supabase
    .from('onboarding_sessions')
    .select('...')  // keep existing select
    .eq('company_id', companyId);  // keep existing filters

  if (!includeDeclined) {
    query = query.neq('offer_status', 'declined');
  }

  // ... rest of existing method
}
```

- [ ] **Step 3: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/onboarding/hr-onboarding.controller.ts
git add tribeX-hris-auth-api/apps/api/src/onboarding/onboarding.service.ts
git commit -m "feat(onboarding): filter declined offer sessions from HR view by default"
```

---

### Task 6: Mobile — offer card on EmployeeOnboardingScreen

**Files:**
- Modify: `blues-clues-hris-mobile/src/screens/EmployeeOnboardingScreen.tsx`

- [ ] **Step 1: Add offer_status to OnboardingSession type**

Find `type OnboardingSession` (line ~18). Add the field:

```ts
type OnboardingSession = {
  session_id: string;
  template_name: string | null;
  employee_name: string | null;
  assigned_position: string;
  assigned_department: string;
  status: string;
  offer_status: 'pending' | 'accepted' | 'declined';  // ← add
  progress_percentage: number;
  deadline_date: string;
  completed_at?: string | null;
  documents: OnboardingItem[];
  tasks: OnboardingItem[];
  equipment: OnboardingItem[];
  hr_forms: OnboardingItem[];
  profile_items: OnboardingItem[];
  welcome: OnboardingItem[];
};
```

- [ ] **Step 2: Add offerLoading state**

Inside `EmployeeOnboardingScreen`, after the existing `useState` declarations (around line 78), add:

```ts
const [offerLoading, setOfferLoading] = useState(false);
```

- [ ] **Step 3: Add offer handlers**

After the `useEffect` block (around line 86), add:

```ts
const handleAcceptOffer = async () => {
  if (!onboarding) return;
  setOfferLoading(true);
  try {
    await authFetch(
      `${API_BASE_URL}/onboarding/applicant/session/${onboarding.session_id}/accept`,
      { method: 'POST' },
    );
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
          if (!onboarding) return;
          setOfferLoading(true);
          try {
            await authFetch(
              `${API_BASE_URL}/onboarding/applicant/session/${onboarding.session_id}/decline`,
              { method: 'POST' },
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
    ],
  );
};
```

- [ ] **Step 4: Add Alert import**

Find the React Native imports at line 2. Add `Alert, TouchableOpacity` if not present:

```ts
import {
  ActivityIndicator,
  Alert,             // ← add
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,  // ← add
  View,
  useWindowDimensions,
} from "react-native";
```

- [ ] **Step 5: Add offer card and declined state in JSX**

Inside the `{onboarding && (<>` block, after the progress card (`</View>`) and before the overdue warning, add:

```tsx
{/* Offer Pending Card */}
{onboarding.offer_status === 'pending' && (
  <View style={styles.offerCard}>
    <Text style={styles.offerIcon}>🎉</Text>
    <Text style={styles.offerTitle}>You have a job offer!</Text>
    <Text style={styles.offerPosition}>
      {onboarding.assigned_position} • {onboarding.assigned_department}
    </Text>
    <Text style={styles.offerDeadline}>
      {'Respond before: '}
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

{/* Offer Declined State */}
{onboarding.offer_status === 'declined' && (
  <View style={styles.declinedBox}>
    <Text style={styles.declinedTitle}>Offer Declined</Text>
    <Text style={styles.declinedText}>
      You have declined this job offer. Please contact HR if this was a mistake.
    </Text>
  </View>
)}
```

- [ ] **Step 6: Guard tabs+items block**

Find the `{!isApproved ? (<>` block that renders the tabs and items. Wrap the tabs+items with an offer_status check. Find the line that starts the tabs `<ScrollView horizontal...` and the items list. They should only render when offer is accepted. Change the outer condition from:

```tsx
) : (
  <>
    {/* Tabs */}
    <ScrollView horizontal ...
```

to:

```tsx
) : onboarding.offer_status === 'accepted' || !onboarding.offer_status ? (
  <>
    {/* Tabs */}
    <ScrollView horizontal ...
```

- [ ] **Step 7: Add styles**

In `StyleSheet.create({...})` at the bottom, add:

```ts
offerCard: {
  backgroundColor: '#EFF6FF', borderRadius: 16, padding: 24,
  alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE',
},
offerIcon: { fontSize: 36, marginBottom: 8 },
offerTitle: { fontSize: 20, fontWeight: '800', color: '#1E3A8A', marginBottom: 4 },
offerPosition: { fontSize: 14, color: '#475569', marginBottom: 4 },
offerDeadline: { fontSize: 13, color: '#64748B', marginBottom: 16 },
offerButtonRow: { flexDirection: 'row', gap: 10, width: '100%' },
offerBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
offerAcceptBtn: { backgroundColor: '#15803D' },
offerDeclineBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
offerBtnDisabled: { opacity: 0.5 },
offerBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
offerDeclineBtnText: { color: '#475569', fontWeight: '700', fontSize: 14 },
declinedBox: {
  backgroundColor: '#FEF2F2', borderRadius: 12, padding: 20,
  alignItems: 'center', borderWidth: 1, borderColor: '#FECACA',
},
declinedTitle: { fontSize: 16, fontWeight: '700', color: '#991B1B', marginBottom: 6 },
declinedText: { fontSize: 13, color: '#B91C1C', textAlign: 'center', lineHeight: 18 },
```

- [ ] **Step 8: Commit**

```bash
git add blues-clues-hris-mobile/src/screens/EmployeeOnboardingScreen.tsx
git commit -m "feat(mobile): add offer accept/decline card to employee onboarding screen"
```

---

### Task 7: Mobile — HR archived view toggle

**Files:**
- Modify: `blues-clues-hris-mobile/src/screens/HROfficerOnboardingScreen.tsx`

- [ ] **Step 1: Add showArchived state**

Inside `HROfficerOnboardingScreen`, after the existing `useState` declarations (around line 130), add:

```ts
const [showArchived, setShowArchived] = useState(false);
```

- [ ] **Step 2: Add visibleSessions derived value**

After the stats calculation block (around line 269), add:

```ts
const visibleSessions = sessions.filter((s) =>
  showArchived
    ? (s as any).offer_status === 'declined'
    : (s as any).offer_status !== 'declined',
);
const declinedCount = sessions.filter(
  (s) => (s as any).offer_status === 'declined',
).length;
```

- [ ] **Step 3: Add archived toggle chip above session list**

Find where `{sessions.map(s => {` renders the session cards (around line 488). Just before that map call, add:

```tsx
{/* Archived toggle */}
<View style={styles.archivedToggleRow}>
  <Pressable
    style={[styles.archivedToggle, showArchived && styles.archivedToggleActive]}
    onPress={() => setShowArchived((v) => !v)}
  >
    <Text style={[styles.archivedToggleText, showArchived && styles.archivedToggleTextActive]}>
      {showArchived
        ? 'Showing Archived'
        : `Archived (${declinedCount})`}
    </Text>
  </Pressable>
</View>
```

- [ ] **Step 4: Replace sessions.map with visibleSessions.map**

Change:
```tsx
{sessions.map(s => {
```
to:
```tsx
{visibleSessions.map(s => {
```

- [ ] **Step 5: Add styles**

In `StyleSheet.create({...})`, add:

```ts
archivedToggleRow: { flexDirection: 'row', marginBottom: 4 },
archivedToggle: {
  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
},
archivedToggleActive: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
archivedToggleText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
archivedToggleTextActive: { color: '#B91C1C' },
```

- [ ] **Step 6: Commit**

```bash
git add blues-clues-hris-mobile/src/screens/HROfficerOnboardingScreen.tsx
git commit -m "feat(mobile): add archived sessions toggle to HR onboarding dashboard"
```
