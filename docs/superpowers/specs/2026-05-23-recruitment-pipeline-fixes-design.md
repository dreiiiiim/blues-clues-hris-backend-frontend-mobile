# Recruitment Pipeline Fixes — Design Spec
**Date:** 2026-05-23  
**Status:** Approved  
**Scope:** Backend stage-transition guard + mobile advance/reject buttons + status name normalization

---

## Problem Summary

Four bugs in the recruitment pipeline:

1. **No stage-transition guard** — backend accepts any status string, allowing backward moves (e.g. `final_interview` → `submitted`)
2. **Reject button missing for interview stages** — mobile only shows Reject for `submitted` and `screening`
3. **No advance-stage button on mobile** — HR cannot move candidates forward from mobile at all
4. **Status name mismatch** — `interview_1` (ApplicantApplicationsScreen), `shortlisted` (DTO), and `first_interview` (HR screen) refer to the same stage

---

## Architecture

### Canonical Stage Order

```
submitted → screening → first_interview → technical_interview → final_interview → hired
```

Terminal statuses (no further transitions allowed):
- `rejected` — reachable from any non-terminal stage
- `withdrawn` — reachable from any non-terminal stage

Retired statuses (remove from DTO, normalize in frontend):
- `shortlisted` → maps to `screening`
- `under_review`, `hold`, `pending` → removed
- `interview_1` (ApplicantApplicationsScreen) → rename to `first_interview`

---

## Backend Changes

### File: `apps/api/src/jobs/dto/update-application-status.dto.ts`

Replace enum with normalized set:
```ts
enum: [
  'submitted', 'screening', 'first_interview',
  'technical_interview', 'final_interview',
  'hired', 'rejected', 'withdrawn'
]
```

### File: `apps/api/src/jobs/jobs.service.ts` — `updateApplicationStatus`

Add stage-transition guard before the update payload (before line 780):

```ts
const STAGE_ORDER = [
  'submitted', 'screening', 'first_interview',
  'technical_interview', 'final_interview', 'hired',
];
const TERMINAL_STATUSES = ['rejected', 'withdrawn'];

// Block transitions from terminal statuses
if (TERMINAL_STATUSES.includes(app.status)) {
  throw new BadRequestException(
    `Cannot update application: current status '${app.status}' is terminal.`
  );
}

// Block backward transitions for non-terminal target statuses
if (!TERMINAL_STATUSES.includes(status)) {
  const currentIdx = STAGE_ORDER.indexOf(app.status ?? 'submitted');
  const newIdx = STAGE_ORDER.indexOf(status);
  if (newIdx <= currentIdx) {
    throw new BadRequestException(
      `Invalid stage transition: cannot move from '${app.status}' to '${status}'.`
    );
  }
}
```

**Error handling:**
- `400 BadRequestException` for backward moves and terminal-status updates
- Existing `hired` duplicate-check logic unchanged
- Existing notification logic unchanged

---

## Mobile Changes

### File: `blues-clues-hris-mobile/src/screens/HROfficerRecruitmentScreen.tsx`

#### Stage constants (add near top of file)

```ts
const STAGE_ORDER = [
  'submitted', 'screening', 'first_interview',
  'technical_interview', 'final_interview', 'hired',
];
const TERMINAL_STATUSES = ['hired', 'rejected', 'withdrawn'];

const NEXT_STAGE_LABEL: Record<string, string> = {
  submitted:           '→ Screening',
  screening:           '→ 1st Interview',
  first_interview:     '→ Technical',
  technical_interview: '→ Final Interview',
  final_interview:     '→ Hire',
};
```

#### Applicant card — replace reject-only block

Old (lines 442–453):
```tsx
{(app.status === "screening" || app.status === "submitted") && (
  <Pressable style={styles.rejectButton} onPress={...}>
    <Text>Reject</Text>
  </Pressable>
)}
```

New:
```tsx
{!TERMINAL_STATUSES.includes(app.status) && (
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

#### New handler: `handleAdvanceStage`

```ts
const handleAdvanceStage = async (app: Application) => {
  const currentIdx = STAGE_ORDER.indexOf(app.status);
  const nextStatus = STAGE_ORDER[currentIdx + 1];
  if (!nextStatus) return;

  try {
    const res = await authFetch(
      `${API_BASE_URL}/jobs/${selectedJob?.job_posting_id}/applications/${app.application_id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      }
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

#### New styles

```ts
actionButtonRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
advanceButton: {
  backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
  borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
},
advanceButtonText: { color: '#1D4ED8', fontSize: 10, fontWeight: '700' },
```

### File: `blues-clues-hris-mobile/src/screens/ApplicantApplicationsScreen.tsx`

Rename `interview_1` → `first_interview` and `technical` → `technical_interview` in `STAGE_ORDER`, `STAGE_LABELS`, and `ApplicationStage` type:

```ts
const STAGE_ORDER: ApplicationStage[] = [
  'submitted', 'screening', 'first_interview',
  'technical_interview', 'final_interview', 'hired',
];

const STAGE_LABELS: Record<ApplicationStage, string> = {
  submitted:            'Applied',
  screening:            'Screening',
  first_interview:      '1st Interview',
  technical_interview:  'Technical',
  final_interview:      'Final Interview',
  hired:                'Hired',
  rejected:             'Rejected',
};

type ApplicationStage =
  | 'submitted' | 'screening' | 'first_interview'
  | 'technical_interview' | 'final_interview'
  | 'hired' | 'rejected';
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| HR tries backward move via mobile | Button not shown (NEXT_STAGE_LABEL guard) + backend 400 as double-guard |
| HR tries to update terminal status | Backend 400: "current status is terminal" |
| Network failure on advance | Alert shown, list not refreshed |
| Rejection without reason | Alert: "Required" — submit button disabled |

---

## Out of Scope

- Web frontend status normalization (separate concern, different team)
- Bulk stage transitions
- Stage transition audit log
