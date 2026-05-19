# Overtime Dashboard — Tabs, Filters & Today's OT Notice

**Date:** 2026-05-19  
**Status:** Approved  
**File:** `frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/employee/overtime/page.tsx`

---

## Problem

The employee overtime page (`/employee/overtime`) shows a flat, unfiltered list of all OT requests. There is no way to distinguish upcoming from past requests, and no way to filter by type or status. Employees with Rest Day or Holiday OT today have no indication that they need to go to the Timekeeping page to clock in.

---

## What We're Building

Three additions to the existing overtime page — all frontend-only, no backend changes required:

1. **Two filter dropdowns** above the tab bar
2. **Underline tab navigation** (Upcoming / Past)
3. **Today's OT notice banner** for approved Rest Day / Holiday OT

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Tab style | Underline nav (not segmented pill) | Matches existing HRIS design patterns |
| Filter placement | Two dropdowns above tabs | Independent Type + Status filters, always visible |
| Clock-in location | Timekeeping page only | Single source of truth for attendance; no split logic |
| Banner scope | REST_DAY + HOLIDAY only | NORMAL OT uses regular shift clock-in; no action needed on OT page |

---

## Component Design

### Filter Dropdowns

Two `<select>` elements (or custom dropdowns matching existing HRIS style) rendered above the tab bar in a two-column flex row:

- **Type filter:** All Types / Normal OT / Rest Day / Holiday OT  
  → maps to `ot_type` values: `NORMAL`, `REST_DAY`, `HOLIDAY`
- **Status filter:** All Status / Pending / Approved / Denied  
  → maps to `log_status` values: `PENDING`, `APPROVED`, `DENIED`

Both filters apply to whichever tab is active.

### Tab Navigation

```
[ Upcoming ]  Past
─────────────────
```

- **Upcoming:** `ot_date >= today` (Manila date, `YYYY-MM-DD`)
- **Past:** `ot_date < today`
- Today's date computed as `new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())` — Manila timezone, matches backend `getManilaDateString()` pattern
- Active tab stored in `useState<'upcoming' | 'past'>` defaulting to `'upcoming'`
- Filtered lists are `useMemo` derived from `requests`, `activeTab`, `filterType`, `filterStatus`

### Today's OT Notice Banner

Conditions for banner to appear (all must be true):
1. Active tab is `'upcoming'`
2. There exists a request where `ot_date === today`
3. That request's `log_status === 'APPROVED'`
4. That request's `ot_type === 'REST_DAY'` or `ot_type === 'HOLIDAY'`

Banner content:
- Dark gradient background (matches existing monthly summary banner style)
- Top row: `TODAY · {OT_TYPE} · APPROVED` label + amber `TODAY` badge
- Time range + planned hours (bold)
- Subtext: `"Go to Timekeeping to clock in and out for this OT."`
- CTA button: `"Open Timekeeping →"` → `router.push('/employee/timekeeping')`

Banner only shows once per day (if today has multiple approved OT it won't happen — same-day duplicate fix already shipped).

### Today Badge on Cards

For any card in the Upcoming list where `ot_date === today` and `ot_type === 'REST_DAY' | 'HOLIDAY'`:
- Card border: amber (`border-amber-300`)
- Date column background: `bg-yellow-50`
- Small text below time range: `"⏰ Clock in via Timekeeping today"`

For NORMAL OT today: no special treatment (employee clocks in through regular shift).

---

## Data Flow

```
loadData()
  └─ getMyOvertimeRequests() → requests[]

useMemo: todayOt
  └─ requests.find(r => r.ot_date === today && r.log_status === 'APPROVED'
                     && (r.ot_type === 'REST_DAY' || r.ot_type === 'HOLIDAY'))

useMemo: filteredRequests
  └─ requests
       .filter(tab: upcoming/past by ot_date vs today)
       .filter(filterType: ALL | NORMAL | REST_DAY | HOLIDAY)
       .filter(filterStatus: ALL | PENDING | APPROVED | DENIED)
```

No new API calls. All derived from existing `getMyOvertimeRequests()` response.

---

## State

New state added to existing component:

```typescript
const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
const [filterType, setFilterType] = useState<'ALL' | OvertimeType>('ALL');
const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'DENIED'>('ALL');
```

---

## What Does NOT Change

- Monthly summary banner (keep as-is)
- Request OT button and submission modal (keep as-is)
- OT card layout and styling (keep as-is, only add Today badge for REST_DAY/HOLIDAY today)
- Backend — no changes needed
- Timekeeping page — no changes needed (already supports OT clock-in via `isOtDay` flag)

---

## Files Modified

| File | Change |
|---|---|
| `frontend/.../employee/overtime/page.tsx` | Add tabs, dropdowns, banner, today badge |

---

## Out of Scope

- HR-side overtime dashboard (separate feature)
- OT clock-in from overtime page (deferred — stays in timekeeping)
- Mobile app (separate codebase)
