"use client";

import { useEffect, useMemo, useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type HalfDayMode = "none" | "am" | "pm";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEKDAY_LABELS: Record<string, string> = {
  MON: "M", TUE: "T", WED: "W", THU: "T", FRI: "F", SAT: "S", SUN: "S",
};
const WEEKDAY_FULL: Record<string, string> = {
  MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun",
};

type QuickTemplate = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
};

const QUICK_TEMPLATES: QuickTemplate[] = [
  { id: "std",    label: "Standard (9:00 AM–6:00 PM)",    startTime: "09:00", endTime: "18:00", breakStart: "12:00", breakEnd: "13:00" },
  { id: "early",  label: "Early (7:00 AM–4:00 PM)",       startTime: "07:00", endTime: "16:00", breakStart: "11:00", breakEnd: "12:00" },
  { id: "night",  label: "Night Shift (9:00 PM–6:00 AM)", startTime: "21:00", endTime: "06:00", breakStart: "01:00", breakEnd: "02:00" },
  { id: "custom", label: "Custom",                         startTime: "09:00", endTime: "18:00", breakStart: "12:00", breakEnd: "13:00" },
];

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const SELECT_CLS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring cursor-pointer " +
  "disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground disabled:pointer-events-none";

function getTodayInManila(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

// ─── TimePicker ───────────────────────────────────────────────────────────────

function TimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const parts = value.match(/^(\d{1,2}):(\d{2})/) ?? [];
  const h24 = parseInt(parts[1] ?? "9", 10);
  const mm = parts[2] ?? "00";
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const emit = (newH12: number, newMm: string, newPeriod: string) => {
    const h24new = newPeriod === "AM" ? (newH12 === 12 ? 0 : newH12) : (newH12 === 12 ? 12 : newH12 + 12);
    onChange(`${String(h24new).padStart(2, "0")}:${newMm}`);
  };

  const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const MINS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  return (
    <div className="flex items-center gap-1">
      <select
        value={h12}
        onChange={e => emit(parseInt(e.target.value, 10), mm, period)}
        disabled={disabled}
        aria-label="Hour"
        className={`${SELECT_CLS} w-14 text-center`}
      >
        {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}</option>)}
      </select>
      <span className="text-sm font-bold text-muted-foreground select-none">:</span>
      <select
        value={mm}
        onChange={e => emit(h12, e.target.value, period)}
        disabled={disabled}
        aria-label="Minute"
        className={`${SELECT_CLS} w-14 text-center`}
      >
        {MINS.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <div className="flex border border-input rounded-md overflow-hidden h-9 shrink-0">
        {(["AM", "PM"] as const).map(p => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => emit(h12, mm, p)}
            className={`px-2 text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
              period === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── EffectiveDatePicker ──────────────────────────────────────────────────────

function EffectiveDatePicker({
  value,
  onChange,
  min,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  min: string;
  disabled?: boolean;
}) {
  const [y, m, d] = value.split("-");
  const minYear = parseInt(min.split("-")[0] ?? String(new Date().getFullYear()), 10);
  const years = useMemo(() => [minYear, minYear + 1], [minYear]);

  const maxDay = useMemo(
    () => new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate(),
    [y, m],
  );
  const days = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => i + 1),
    [maxDay],
  );

  const emit = (ny: string, nm: string, nd: string) => {
    const md = new Date(parseInt(ny, 10), parseInt(nm, 10), 0).getDate();
    const clamped = Math.min(parseInt(nd, 10), md);
    onChange(`${ny}-${nm.padStart(2, "0")}-${String(clamped).padStart(2, "0")}`);
  };

  const display = useMemo(() => {
    if (!y || !m || !d) return null;
    try {
      return new Date(`${y}-${m}-${d}`).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });
    } catch { return null; }
  }, [y, m, d]);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <select
          value={m}
          onChange={e => emit(y, e.target.value, d)}
          disabled={disabled}
          aria-label="Month"
          className={`${SELECT_CLS} flex-[2]`}
        >
          {MONTHS_SHORT.map((mn, i) => (
            <option key={mn} value={String(i + 1).padStart(2, "0")}>{mn}</option>
          ))}
        </select>
        <select
          value={d}
          onChange={e => emit(y, m, e.target.value)}
          disabled={disabled}
          aria-label="Day"
          className={`${SELECT_CLS} flex-1`}
        >
          {days.map(day => (
            <option key={day} value={String(day).padStart(2, "0")}>{day}</option>
          ))}
        </select>
        <select
          value={y}
          onChange={e => emit(e.target.value, m, d)}
          disabled={disabled}
          aria-label="Year"
          className={`${SELECT_CLS} flex-[1.5]`}
        >
          {years.map(yr => (
            <option key={yr} value={String(yr)}>{yr}</option>
          ))}
        </select>
      </div>
      {display && (
        <p className="text-[10px] text-muted-foreground">Changes apply on {display}.</p>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmployeeScheduleEditModal({
  employeeId,
  employeeName,
  currentSchedule,
  readOnly = false,
  effectiveLabel,
  onClose,
  onSaved,
}: Readonly<{
  employeeId: string;
  employeeName: string;
  currentSchedule: {
    start_time: string;
    end_time: string;
    break_start?: string | null;
    break_end?: string | null;
    workdays: string[] | string;
    is_nightshift: boolean;
    updated_at?: string | null;
    updated_by_name?: string | null;
    schedule_source?: "bulk" | "department" | "individual" | "default" | null;
  } | null;
  readOnly?: boolean;
  effectiveLabel?: string;
  onClose: () => void;
  onSaved?: () => void;
}>) {
  const parseWorkdays = (wd: string[] | string): string[] =>
    typeof wd === "string" ? wd.toUpperCase().split(",").map(s => s.trim()) : wd.map(s => s.toUpperCase().trim());

  const formatScheduleClock = (value: string | null | undefined): string => {
    if (!value) return "-";
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return value;
    const hours = Number.parseInt(match[1], 10);
    if (Number.isNaN(hours)) return value;
    const mins = match[2];
    const suffix = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${mins} ${suffix}`;
  };

  const weekdayFallback = ["MON","TUE","WED","THU","FRI"];
  const todayInManila = useMemo(() => getTodayInManila(), []);

  const [templateId,   setTemplateId]   = useState("custom");
  const [startTime,    setStartTime]    = useState(currentSchedule?.start_time ?? "09:00");
  const [endTime,      setEndTime]      = useState(currentSchedule?.end_time ?? "18:00");
  const [breakStart,   setBreakStart]   = useState(currentSchedule?.break_start ?? "12:00");
  const [breakEnd,     setBreakEnd]     = useState(currentSchedule?.break_end ?? "13:00");
  const [workdays,     setWorkdays]     = useState<string[]>(
    currentSchedule ? parseWorkdays(currentSchedule.workdays) : weekdayFallback,
  );
  const isNightShift = endTime < startTime;
  const [halfDay,      setHalfDay]      = useState<HalfDayMode>("none");
  const [submitting,   setSubmitting]   = useState(false);
  const [resettingToDepartment, setResettingToDepartment] = useState(false);
  const [confirmDepartmentReset, setConfirmDepartmentReset] = useState(false);
  const [done,         setDone]         = useState(false);
  const [doneTitle,    setDoneTitle]    = useState("Schedule Updated");
  const [doneMessage,  setDoneMessage]  = useState<string>(
    `${employeeName}'s schedule has been saved successfully.`,
  );
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(!currentSchedule);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [hasAssignedSchedule, setHasAssignedSchedule] = useState(Boolean(currentSchedule));
  const [updatedAt,    setUpdatedAt]    = useState<string | null>(currentSchedule?.updated_at ?? null);
  const [updatedBy,    setUpdatedBy]    = useState<string | null>(currentSchedule?.updated_by_name ?? null);
  const [scheduleSource, setScheduleSource] = useState<"bulk" | "department" | "individual" | "default" | null>(
    currentSchedule?.schedule_source ?? null,
  );
  const [effectiveDate, setEffectiveDate] = useState(todayInManila);

  const hydrateSchedule = (schedule: {
    start_time?: string | null;
    end_time?: string | null;
    break_start?: string | null;
    break_end?: string | null;
    workdays?: string[] | string | null;
    is_nightshift?: boolean | null;
    updated_at?: string | null;
    updated_by_name?: string | null;
    schedule_source?: "bulk" | "department" | "individual" | "default" | null;
  } | null) => {
    setHasAssignedSchedule(Boolean(schedule));
    setStartTime(schedule?.start_time ?? "09:00");
    setEndTime(schedule?.end_time ?? "18:00");
    setBreakStart(schedule?.break_start ?? "12:00");
    setBreakEnd(schedule?.break_end ?? "13:00");
    setWorkdays(
      schedule?.workdays
        ? parseWorkdays(schedule.workdays).filter(Boolean)
        : weekdayFallback,
    );
    setUpdatedAt(schedule?.updated_at ?? null);
    setUpdatedBy(schedule?.updated_by_name ?? null);
    setScheduleSource(schedule?.schedule_source ?? null);
    setHalfDay("none");
    setTemplateId("custom");
  };

  useEffect(() => {
    setEffectiveDate(todayInManila);
  }, [employeeId, todayInManila]);

  useEffect(() => {
    let cancelled = false;
    if (currentSchedule) {
      hydrateSchedule(currentSchedule);
      setLoadingSchedule(false);
      setLoadError(null);
      return;
    }
    setLoadingSchedule(true);
    setLoadError(null);
    authFetch(`${API_BASE_URL}/timekeeping/employees/${employeeId}/schedule`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({} as { message?: string }));
          throw new Error(err.message || "Failed to load schedule.");
        }
        const raw = await r.text();
        if (!raw) return null;
        try { return JSON.parse(raw) as unknown; } catch { return null; }
      })
      .then((data) => {
        if (cancelled) return;
        hydrateSchedule((data ?? null) as any);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load schedule.");
      })
      .finally(() => { if (!cancelled) setLoadingSchedule(false); });
    return () => { cancelled = true; };
  }, [employeeId, currentSchedule]);

  const formattedUpdatedAt = useMemo(() => {
    if (!updatedAt) return null;
    try {
      return new Date(updatedAt).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      });
    } catch { return null; }
  }, [updatedAt]);

  const applyTemplate = (id: string) => {
    if (readOnly) return;
    setConfirmDepartmentReset(false);
    setTemplateId(id);
    const t = QUICK_TEMPLATES.find(q => q.id === id);
    if (t && id !== "custom") {
      setStartTime(t.startTime);
      setEndTime(t.endTime);
      setBreakStart(t.breakStart);
      setBreakEnd(t.breakEnd);
      setHalfDay("none");
    }
  };

  const applyHalfDay = (mode: HalfDayMode) => {
    if (readOnly) return;
    setConfirmDepartmentReset(false);
    setHalfDay(mode);
    if (mode === "am")   { setStartTime("09:00"); setEndTime("13:00"); setBreakStart("12:00"); setBreakEnd("12:30"); }
    if (mode === "pm")   { setStartTime("13:00"); setEndTime("18:00"); setBreakStart("15:30"); setBreakEnd("16:00"); }
    if (mode === "none") { setStartTime("09:00"); setEndTime("18:00"); setBreakStart("12:00"); setBreakEnd("13:00"); }
  };

  const toggleDay = (day: string) => {
    if (readOnly) return;
    setWorkdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSave = async () => {
    if (readOnly) return;
    if (effectiveDate < todayInManila) {
      setSaveError("Effectivity date cannot be in the past.");
      return;
    }
    setSaveError(null);
    setSubmitting(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/timekeeping/employees/${employeeId}/schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_time: startTime,
            end_time: endTime,
            break_start: breakStart,
            break_end: breakEnd,
            workdays: workdays.join(","),
            is_nightshift: isNightShift,
            effective_date: effectiveDate,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err?.message || "Failed to save schedule.");
      }
      setDoneTitle("Schedule Updated");
      setDoneMessage(`${employeeName}'s schedule has been saved successfully (effective ${effectiveDate}).`);
      setDone(true);
      onSaved?.();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetToDepartment = async () => {
    if (readOnly) return;
    if (effectiveDate < todayInManila) {
      setSaveError("Effectivity date cannot be in the past.");
      return;
    }
    setSaveError(null);
    setResettingToDepartment(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/timekeeping/employees/${employeeId}/schedule/reset-department`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ effective_date: effectiveDate }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err?.message || "Failed to reset schedule to department baseline.");
      }
      setDoneTitle("Department Schedule Applied");
      setDoneMessage(`${employeeName}'s schedule now follows the department schedule (effective ${effectiveDate}).`);
      setDone(true);
      onSaved?.();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setResettingToDepartment(false);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-in fade-in duration-300">
          <div className="h-14 w-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <h3 className="text-lg font-bold mb-1">{doneTitle}</h3>
          <p className="text-sm text-muted-foreground mb-6">{doneMessage}</p>
          <Button onClick={onClose} className="w-full">Done</Button>
        </div>
      </div>
    );
  }

  const busy = loadingSchedule || submitting || resettingToDepartment;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in duration-300 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 gap-3">
          <div>
            <h2 className="text-base font-bold">{readOnly ? "View Schedule" : "Edit Schedule"}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{employeeName} &middot; {employeeId}</p>
          </div>
          {readOnly && (
            <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 rounded-md">
              View only
            </span>
          )}
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer ml-auto">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">

          {/* Info banner */}
          {(effectiveLabel || readOnly || updatedBy || formattedUpdatedAt || scheduleSource) && (
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5">
              {effectiveLabel && (
                <p className="text-xs text-muted-foreground">
                  Viewing period: <span className="font-semibold text-foreground">{effectiveLabel}</span>
                </p>
              )}
              {scheduleSource && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Source:</span>
                  {scheduleSource === "individual" ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 border border-violet-200">Custom (Individual)</span>
                  ) : scheduleSource === "department" ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">Department</span>
                  ) : scheduleSource === "bulk" ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 border border-sky-200">Standard (Bulk)</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">Default</span>
                  )}
                </div>
              )}
              {readOnly && (
                <p className="text-xs text-blue-700">View only: editing is limited to HR and System Admin.</p>
              )}
              {(updatedBy || formattedUpdatedAt) && (
                <p className="text-xs text-muted-foreground">
                  Last updated {formattedUpdatedAt ?? "recently"}{updatedBy ? ` by ${updatedBy}` : ""}
                </p>
              )}
            </div>
          )}

          {/* Effectivity date + Quick Template side by side */}
          {!readOnly && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                  Effective Date
                </p>
                <EffectiveDatePicker
                  value={effectiveDate}
                  onChange={setEffectiveDate}
                  min={todayInManila}
                  disabled={busy}
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                  Quick Template
                </p>
                <Select value={templateId} onValueChange={applyTemplate} disabled={loadingSchedule}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[80]">
                    {QUICK_TEMPLATES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {loadingSchedule && (
            <div className="p-4 rounded-lg border border-border text-sm text-muted-foreground">
              Loading schedule...
            </div>
          )}

          {loadError && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
              {loadError}
            </div>
          )}

          {readOnly && !loadingSchedule && !loadError && !hasAssignedSchedule && (
            <div className="p-4 rounded-lg border border-border text-sm text-muted-foreground">
              No schedule assigned for this employee in the selected period.
            </div>
          )}

          {/* Half-day presets */}
          {!readOnly && (
            <div className="flex items-center gap-1.5">
              {([
                { id: "none", label: "Full Day" },
                { id: "am",   label: "AM Half"  },
                { id: "pm",   label: "PM Half"  },
              ] as const).map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyHalfDay(preset.id)}
                  disabled={loadingSchedule}
                  className={[
                    "px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                    halfDay === preset.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground",
                  ].join(" ")}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {/* Department reset confirmation */}
          {!readOnly && confirmDepartmentReset && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 space-y-2">
              <p className="text-xs font-semibold text-amber-900">
                Apply department schedule for this employee on {effectiveDate}?
              </p>
              <p className="text-[11px] text-amber-800">
                This will replace any custom schedule on the selected effectivity date.
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDepartmentReset(false)}
                >
                  Keep Custom
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await handleResetToDepartment();
                    setConfirmDepartmentReset(false);
                  }}
                  disabled={busy}
                >
                  {resettingToDepartment ? "Applying..." : "Confirm Reset"}
                </Button>
              </div>
            </div>
          )}

          {/* Time fields */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {([
              { label: "Start Time",  value: startTime,  onChange: (v: string) => { setStartTime(v);  setTemplateId("custom"); } },
              { label: "End Time",    value: endTime,    onChange: (v: string) => { setEndTime(v);    setTemplateId("custom"); } },
              { label: "Break Start", value: breakStart, onChange: (v: string) => setBreakStart(v) },
              { label: "Break End",   value: breakEnd,   onChange: (v: string) => setBreakEnd(v)   },
            ] as const).map(field => (
              <div key={field.label}>
                <label className="text-xs text-muted-foreground mb-1.5 block">{field.label}</label>
                <TimePicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={readOnly || loadingSchedule}
                />
              </div>
            ))}
          </div>

          {/* Work days */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Work Days</p>
            <div className="flex gap-1.5">
              {WEEKDAYS.map(d => (
                <button
                  key={d}
                  onClick={() => !readOnly && toggleDay(d)}
                  title={WEEKDAY_FULL[d]}
                  disabled={readOnly || loadingSchedule}
                  className={[
                    "h-9 w-9 rounded-full text-xs font-bold transition-all cursor-pointer border",
                    workdays.includes(d)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50",
                    readOnly ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>


          {/* Schedule preview */}
          <div className="rounded-xl bg-primary/5 border border-primary/15 px-3.5 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
              <span>{formatScheduleClock(startTime)}</span>
              <span className="text-muted-foreground text-xs">&rarr;</span>
              <span>{formatScheduleClock(endTime)}</span>
            </div>
            <span className="text-muted-foreground/40 text-xs hidden sm:inline">|</span>
            <p className="text-xs text-muted-foreground">
              Break {formatScheduleClock(breakStart)} &ndash; {formatScheduleClock(breakEnd)}
            </p>
            <div className="ml-auto flex items-center gap-1 flex-wrap">
              {WEEKDAYS.filter(d => workdays.includes(d)).map(d => (
                <span key={d} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-background border border-border text-foreground">
                  {WEEKDAY_LABELS[d]}
                </span>
              ))}
              <span className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${isNightShift ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-primary/10 text-primary border-primary/30"}`}>
                {isNightShift ? "Night" : "Day"}
              </span>
              {halfDay !== "none" && (
                <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold uppercase">{halfDay} Half</span>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 bg-muted/10 space-y-2">
          {saveError && !readOnly && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {saveError}
            </p>
          )}
          {readOnly ? (
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose} className="cursor-pointer">Close</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setConfirmDepartmentReset(true)}
                disabled={busy}
                className="text-xs text-amber-700 hover:text-amber-800 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Reset to Department
              </button>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={onClose} className="cursor-pointer">Cancel</Button>
                <Button
                  onClick={handleSave}
                  disabled={busy || workdays.length === 0 || !effectiveDate}
                  className="gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <><div className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> Saving...</>
                  ) : "Save Schedule"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
