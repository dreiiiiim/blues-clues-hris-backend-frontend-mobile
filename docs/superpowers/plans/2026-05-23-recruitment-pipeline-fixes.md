# Recruitment Pipeline Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix stage-transition guard, normalize status names across frontend/backend, and add advance+reject buttons for all pipeline stages on mobile.

**Architecture:** Add a forward-only guard in `updateApplicationStatus` in `jobs.service.ts`. Normalize the DTO enum. Fix status name mismatches in two mobile screens. Replace the mobile reject-only button block with advance+reject for all non-terminal stages.

**Tech Stack:** NestJS (backend), React Native/Expo (mobile), TypeScript, Supabase

---

### Task 1: Normalize DTO status enum

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/jobs/dto/update-application-status.dto.ts`

- [ ] **Step 1: Replace the enum**

Open `tribeX-hris-auth-api/apps/api/src/jobs/dto/update-application-status.dto.ts` and replace the full file content:

```ts
import { IsString, IsOptional, IsIn } from 'class-validator';
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
}
```

- [ ] **Step 2: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/jobs/dto/update-application-status.dto.ts
git commit -m "fix(jobs): normalize application status enum, remove deprecated values"
```

---

### Task 2: Add stage-transition guard in jobs.service.ts

**Files:**
- Modify: `tribeX-hris-auth-api/apps/api/src/jobs/jobs.service.ts` (around line 720)

- [ ] **Step 1: Add constants near top of `updateApplicationStatus` method**

In `jobs.service.ts`, find `async updateApplicationStatus(` (line ~720). After the opening brace and the supabase client setup, add these constants and the guard block BEFORE the `app` fetch result check (before `if (app) {`):

```ts
const STAGE_ORDER = [
  'submitted',
  'screening',
  'first_interview',
  'technical_interview',
  'final_interview',
  'hired',
];
const TERMINAL_STATUSES = ['rejected', 'withdrawn'];
```

- [ ] **Step 2: Add guard inside the `if (app)` block**

Inside `if (app) {`, immediately after `await this.findOnePosting(app.job_posting_id, companyId);` (line ~737), add:

```ts
// Block transitions from terminal statuses
if (TERMINAL_STATUSES.includes(app.status)) {
  throw new BadRequestException(
    `Cannot update application: current status '${app.status}' is terminal.`,
  );
}

// Block backward transitions for non-terminal target statuses
if (!TERMINAL_STATUSES.includes(status)) {
  const currentIdx = STAGE_ORDER.indexOf(app.status ?? 'submitted');
  const newIdx = STAGE_ORDER.indexOf(status);
  if (newIdx <= currentIdx) {
    throw new BadRequestException(
      `Invalid stage transition: cannot move from '${app.status}' to '${status}'.`,
    );
  }
}
```

- [ ] **Step 3: Verify the import for BadRequestException exists**

Check line 1 of `jobs.service.ts` — `BadRequestException` must be in the NestJS imports. It should already be there. If not, add it:

```ts
import { ..., BadRequestException } from '@nestjs/common';
```

- [ ] **Step 4: Restart the server and manually test**

```bash
cd tribeX-hris-auth-api
npm run start:dev
```

Test via Swagger or curl — try moving `final_interview → submitted`, expect `400`. Try moving `screening → first_interview`, expect `200`.

- [ ] **Step 5: Commit**

```bash
git add tribeX-hris-auth-api/apps/api/src/jobs/jobs.service.ts
git commit -m "fix(jobs): enforce forward-only stage transitions, block terminal status updates"
```

---

### Task 3: Fix status names in ApplicantApplicationsScreen

**Files:**
- Modify: `blues-clues-hris-mobile/src/screens/ApplicantApplicationsScreen.tsx`

- [ ] **Step 1: Update ApplicationStage type**

Find the `type ApplicationStage` declaration (around line 24) and replace:

```ts
type ApplicationStage =
  | "submitted"
  | "screening"
  | "first_interview"
  | "technical_interview"
  | "final_interview"
  | "hired"
  | "rejected";
```

- [ ] **Step 2: Update STAGE_ORDER**

Find `const STAGE_ORDER: ApplicationStage[]` (around line 65) and replace:

```ts
const STAGE_ORDER: ApplicationStage[] = [
  "submitted",
  "screening",
  "first_interview",
  "technical_interview",
  "final_interview",
  "hired",
];
```

- [ ] **Step 3: Update STAGE_LABELS**

Find `const STAGE_LABELS: Record<ApplicationStage, string>` (around line 74) and replace:

```ts
const STAGE_LABELS: Record<ApplicationStage, string> = {
  submitted:           "Applied",
  screening:           "Screening",
  first_interview:     "1st Interview",
  technical_interview: "Technical",
  final_interview:     "Final Interview",
  hired:               "Hired",
  rejected:            "Rejected",
};
```

- [ ] **Step 4: Update getStatusStyle**

Find `function getStatusStyle(status: ApplicationStage)` (around line 84) and replace:

```ts
function getStatusStyle(status: ApplicationStage) {
  switch (status) {
    case "hired":             return { bg: "#DCFCE7", border: "#BBF7D0", text: "#166534" };
    case "rejected":          return { bg: "#FEE2E2", border: "#FECACA", text: "#991B1B" };
    case "final_interview":
    case "technical_interview": return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" };
    case "first_interview":
    case "screening":         return { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" };
    default:                  return { bg: "#F3F4F6", border: "#E5E7EB", text: "#374151" };
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add blues-clues-hris-mobile/src/screens/ApplicantApplicationsScreen.tsx
git commit -m "fix(mobile): normalize application stage names to match backend canonical values"
```

---

### Task 4: Add advance + reject buttons to HR recruitment mobile screen

**Files:**
- Modify: `blues-clues-hris-mobile/src/screens/HROfficerRecruitmentScreen.tsx`

- [ ] **Step 1: Add stage constants after the imports block**

After the last import line (around line 21), add:

```ts
const PIPELINE_STAGE_ORDER = [
  'submitted', 'screening', 'first_interview',
  'technical_interview', 'final_interview', 'hired',
];
const PIPELINE_TERMINAL = ['hired', 'rejected', 'withdrawn'];
const NEXT_STAGE_LABEL: Record<string, string> = {
  submitted:           '→ Screening',
  screening:           '→ 1st Interview',
  first_interview:     '→ Technical',
  technical_interview: '→ Final Interview',
  final_interview:     '→ Hire',
};
```

- [ ] **Step 2: Add handleAdvanceStage handler**

Inside `HROfficerRecruitmentScreen`, after the `fetchApplications` function (around line 144), add:

```ts
const handleAdvanceStage = async (app: Application) => {
  const currentIdx = PIPELINE_STAGE_ORDER.indexOf(app.status);
  const nextStatus = PIPELINE_STAGE_ORDER[currentIdx + 1];
  if (!nextStatus) return;
  try {
    const res = await authFetch(
      `${API_BASE_URL}/jobs/${selectedJob?.job_posting_id}/applications/${app.application_id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
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

- [ ] **Step 3: Replace the reject-only button block in applicant card**

Find lines 442–453:
```tsx
{(app.status === "screening" || app.status === "submitted") && (
  <Pressable
    style={styles.rejectButton}
    onPress={() => {
      setSelectedApplicant(app);
      setRejectionReason("");
      setRejectionModalVisible(true);
    }}
  >
    <Text style={styles.rejectButtonText}>Reject</Text>
  </Pressable>
)}
```

Replace with:
```tsx
{!PIPELINE_TERMINAL.includes(app.status) && (
  <View style={styles.actionButtonRow}>
    {NEXT_STAGE_LABEL[app.status] && (
      <Pressable
        style={styles.advanceButton}
        onPress={() => handleAdvanceStage(app)}
      >
        <Text style={styles.advanceButtonText}>
          {NEXT_STAGE_LABEL[app.status]}
        </Text>
      </Pressable>
    )}
    <Pressable
      style={styles.rejectButton}
      onPress={() => {
        setSelectedApplicant(app);
        setRejectionReason("");
        setRejectionModalVisible(true);
      }}
    >
      <Text style={styles.rejectButtonText}>Reject</Text>
    </Pressable>
  </View>
)}
```

- [ ] **Step 4: Add new styles**

In the `StyleSheet.create({...})` block at the bottom, add after `rejectButtonText`:

```ts
actionButtonRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
advanceButton: {
  backgroundColor: '#EFF6FF',
  borderWidth: 1,
  borderColor: '#BFDBFE',
  borderRadius: 6,
  paddingHorizontal: 8,
  paddingVertical: 4,
},
advanceButtonText: { color: '#1D4ED8', fontSize: 10, fontWeight: '700' },
```

- [ ] **Step 5: Commit**

```bash
git add blues-clues-hris-mobile/src/screens/HROfficerRecruitmentScreen.tsx
git commit -m "feat(mobile): add advance-stage and reject buttons for all pipeline stages in HR recruitment"
```
