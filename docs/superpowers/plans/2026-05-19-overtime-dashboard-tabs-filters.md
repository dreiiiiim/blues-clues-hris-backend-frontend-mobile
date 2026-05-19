# Overtime Dashboard — Tabs, Filters & Today OT Notice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Upcoming/Past tabs, Type + Status filter dropdowns, and a "Go to Timekeeping" banner for today's approved Rest Day / Holiday OT to the employee overtime page.

**Architecture:** All changes are frontend-only in a single file. New state (`activeTab`, `filterType`, `filterStatus`) drives two `useMemo` derivations (`todayOt`, `filteredRequests`). The request list section is replaced with the tabbed/filtered UI. No backend changes required.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, lucide-react

---

## Files Modified

| File | What changes |
|---|---|
| `frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/employee/overtime/page.tsx` | Add imports, state, memos, replace request list section |

---

## Task 1: Add imports, router, state, and computed values

**Files:**
- Modify: `frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/employee/overtime/page.tsx:1-12`

- [ ] **Step 1: Add `useRouter` import and `ArrowRight` icon**

Replace lines 3–4:

```typescript
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Clock, Info, Loader2, Moon, Plus, Send, Timer, Palmtree, Lock } from "lucide-react";
```

Add after line 11 (`import { toast } from "sonner";`):

```typescript
import { useRouter } from "next/navigation";
```

- [ ] **Step 2: Instantiate the router inside the component**

After line 192 (`export default function EmployeeOvertimePage() {`), add as the first line of the function body:

```typescript
  const router = useRouter();
```

- [ ] **Step 3: Add `today` memo after the existing `currentMonth` memo (line 241)**

```typescript
  const today = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()),
    [],
  );
```

- [ ] **Step 4: Add tab and filter state after the `today` memo**

```typescript
  const [activeTab, setActiveTab]     = useState<'upcoming' | 'past'>('upcoming');
  const [filterType, setFilterType]   = useState<'ALL' | OvertimeType>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'DENIED'>('ALL');
```

- [ ] **Step 5: Add `todayOt` memo after the filter state**

```typescript
  const todayOt = useMemo(
    () =>
      requests.find(
        r =>
          r.ot_date === today &&
          r.log_status === 'APPROVED' &&
          (r.ot_type === 'REST_DAY' || r.ot_type === 'HOLIDAY'),
      ) ?? null,
    [requests, today],
  );
```

- [ ] **Step 6: Add `filteredRequests` memo after `todayOt`**

```typescript
  const filteredRequests = useMemo(
    () =>
      requests.filter(r => {
        const isUpcoming = r.ot_date >= today;
        if (activeTab === 'upcoming' && !isUpcoming) return false;
        if (activeTab === 'past'     &&  isUpcoming) return false;
        if (filterType   !== 'ALL' && r.ot_type    !== filterType)   return false;
        if (filterStatus !== 'ALL' && r.log_status !== filterStatus) return false;
        return true;
      }),
    [requests, today, activeTab, filterType, filterStatus],
  );
```

- [ ] **Step 7: Commit**

```bash
git add frontend/blues-clues-hris-frontend-web/src/app/\(dashboard\)/employee/overtime/page.tsx
git commit -m "feat(overtime): add tab/filter state and today OT memo"
```

---

## Task 2: Replace request list section with tabbed/filtered UI

**Files:**
- Modify: `frontend/blues-clues-hris-frontend-web/src/app/(dashboard)/employee/overtime/page.tsx:496-598`

- [ ] **Step 1: Replace the entire request list section**

Replace from the comment `{/* ── Request list ──` (line 496) through the closing `</div>` at line 598 with:

```tsx
      {/* ── Filter dropdowns + tabs + list ─────────────────────────────── */}
      <div>

        {/* Two filter dropdowns */}
        <div className="flex gap-2 mb-3">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as 'ALL' | OvertimeType)}
            className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="NORMAL">Normal OT</option>
            <option value="REST_DAY">Rest Day OT</option>
            <option value="HOLIDAY">Holiday OT</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as 'ALL' | 'PENDING' | 'APPROVED' | 'DENIED')}
            className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
          </select>
        </div>

        {/* Underline tab nav */}
        <div className="flex border-b border-border mb-4">
          {(['upcoming', 'past'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-bold capitalize transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'border-b-2 border-foreground text-foreground -mb-px'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Today's OT notice — REST_DAY / HOLIDAY only */}
        {activeTab === 'upcoming' && todayOt && (
          <div className="rounded-2xl overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_100%)] px-5 py-4 text-white mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                Today · {OT_TYPE_DISPLAY[todayOt.ot_type]?.label ?? todayOt.ot_type} · Approved
              </p>
              <span className="bg-amber-400 text-amber-900 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                Today
              </span>
            </div>
            <p className="text-base font-black mb-0.5">
              {fmt24to12(todayOt.start_time)} → {fmt24to12(todayOt.end_time)} · {todayOt.planned_hours}h planned
            </p>
            <p className="text-xs text-white/50 mb-3">Go to Timekeeping to clock in and out for this OT.</p>
            <button
              type="button"
              onClick={() => router.push('/employee/timekeeping')}
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl py-2.5 text-sm font-bold transition-all active:scale-[0.98] cursor-pointer"
            >
              Open Timekeeping <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* List header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold tracking-tight flex items-center gap-2 text-foreground">
            <CalendarDays className="h-4 w-4 text-sky-600" />
            {activeTab === 'upcoming' ? 'Upcoming' : 'Past'} Requests
          </h2>
          {filteredRequests.length > 0 && (
            <p className="text-xs text-muted-foreground">{filteredRequests.length} {activeTab}</p>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-0 rounded-2xl border border-slate-100 bg-white overflow-hidden">
                <div className="w-14 shrink-0 bg-slate-50 border-r border-slate-100 flex flex-col items-center justify-center py-4 gap-1.5">
                  <div className="h-2.5 bg-slate-200 rounded-full w-7" />
                  <div className="h-7 bg-slate-200 rounded-lg w-10" />
                  <div className="h-2 bg-slate-200 rounded-full w-5" />
                </div>
                <div className="flex-1 px-4 py-3 space-y-2.5">
                  <div className="flex justify-between gap-3">
                    <div className="h-4 bg-slate-100 rounded-full w-24" />
                    <div className="h-4 bg-slate-100 rounded-full w-16" />
                  </div>
                  <div className="h-3.5 bg-slate-100 rounded-full w-3/5" />
                  <div className="h-3 bg-slate-100 rounded-full w-2/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Timer className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">
                {requests.length === 0 ? 'No overtime requests yet' : 'No requests match your filters'}
              </p>
              <p className="text-sm text-slate-400 mt-0.5 max-w-[200px] mx-auto">
                {requests.length === 0
                  ? 'Submit a request and it will appear here.'
                  : 'Try adjusting the type or status filter.'}
              </p>
            </div>
            {requests.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 mt-1 cursor-pointer"
                onClick={() => setModalOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Request OT
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRequests.map((req, i) => {
              const dateInfo   = formatRequestDate(req.ot_date);
              const otTypeDisp = OT_TYPE_DISPLAY[req.ot_type];
              const statusConf = STATUS_DISPLAY[req.log_status];
              const OtIcon     = otTypeDisp?.icon ?? Clock;
              const isToday    = req.ot_date === today &&
                                 (req.ot_type === 'REST_DAY' || req.ot_type === 'HOLIDAY');
              return (
                <div
                  key={req.ot_id}
                  className={`flex gap-0 rounded-2xl border bg-white hover:shadow-sm transition-all duration-200 overflow-hidden ${
                    isToday ? 'border-amber-300' : 'border-slate-200 hover:border-slate-300'
                  }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Date column */}
                  <div className={`w-14 shrink-0 flex flex-col items-center justify-center py-4 border-r ${
                    isToday ? 'bg-yellow-50 border-amber-100' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${isToday ? 'text-amber-500' : 'text-slate-400'}`}>
                      {dateInfo.month}
                    </p>
                    <p className="text-2xl font-black text-slate-800 leading-tight tabular-nums">{dateInfo.day}</p>
                    <p className={`text-[9px] font-medium mt-0.5 ${isToday ? 'text-amber-500' : 'text-slate-400'}`}>
                      {dateInfo.weekday}
                    </p>
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-4 py-3 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${otTypeDisp?.className ?? ""}`}>
                        <OtIcon className="h-2.5 w-2.5" />
                        {otTypeDisp?.label ?? req.ot_type.replace("_", " ")}
                      </span>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConf?.className ?? ""}`}>
                        {statusConf?.label ?? req.log_status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {fmt24to12(req.start_time)}
                      <span className="mx-1.5 text-slate-400 font-normal text-xs">to</span>
                      {fmt24to12(req.end_time)}
                      <span className="ml-2.5 text-xs font-bold text-slate-400 tabular-nums">{req.planned_hours}h</span>
                    </p>
                    {isToday && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-1">⏰ Clock in via Timekeeping today</p>
                    )}
                    {req.reason && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1 italic">{req.reason}</p>
                    )}
                    {req.review_reason && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-rose-600 font-medium">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {req.review_reason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd frontend/blues-clues-hris-frontend-web
npx tsc --noEmit
```

Expected: no errors. If you see `Property 'ot_date' does not exist` or similar, check that `OvertimeRequest` type in `src/lib/authApi.ts` includes `ot_date`, `ot_type`, `log_status`, `start_time`, `end_time`, `planned_hours`, `reason`, `review_reason`.

- [ ] **Step 3: Start dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:3000/employee/overtime`.

**Check these cases:**

| Scenario | Expected |
|---|---|
| No requests | Empty state with "No overtime requests yet" on Upcoming tab |
| Switch to Past tab | List updates, header shows "Past Requests" |
| Select "Normal OT" in type dropdown | Only NORMAL requests show |
| Select "Approved" in status dropdown | Only APPROVED requests show |
| Both filters active | Both applied simultaneously |
| Filter produces no results | "No requests match your filters" empty state |
| Today has approved REST_DAY OT | Dark blue banner appears above list with "Open Timekeeping →" |
| Today has approved NORMAL OT | No banner (only amber "Today" badge on card if also REST_DAY/HOLIDAY) |
| Click "Open Timekeeping →" | Navigates to `/employee/timekeeping` |
| Today's REST_DAY/HOLIDAY card | Amber border, yellow date column, "⏰ Clock in via Timekeeping today" line |

- [ ] **Step 4: Commit**

```bash
git add frontend/blues-clues-hris-frontend-web/src/app/\(dashboard\)/employee/overtime/page.tsx
git commit -m "feat(overtime): tabs, type/status filters, today OT timekeeping banner"
```
