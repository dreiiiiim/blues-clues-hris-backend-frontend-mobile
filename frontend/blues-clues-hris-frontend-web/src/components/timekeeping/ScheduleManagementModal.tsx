"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { X, Building2, Clock, ChevronDown, CheckCircle2, Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApplyScope = "company" | "department" | "employees";

type ScheduleSeed = {
  start_time?: string | null;
  end_time?: string | null;
  break_start?: string | null;
  break_end?: string | null;
  workdays?: string | null;
  is_nightshift?: boolean | null;
};

export type ScheduleTemplate = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  workdays: string[];
  isNightShift: boolean;
};

const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  { id: "standard",   label: "Standard (9:00 AM-6:00 PM)", startTime: "09:00", endTime: "18:00", breakStart: "12:00", breakEnd: "13:00", workdays: ["MON","TUE","WED","THU","FRI"], isNightShift: false },
  { id: "early",      label: "Early (7:00 AM-4:00 PM)", startTime: "07:00", endTime: "16:00", breakStart: "11:00", breakEnd: "12:00", workdays: ["MON","TUE","WED","THU","FRI"], isNightShift: false },
  { id: "late",       label: "Late Shift (12:00 PM-9:00 PM)", startTime: "12:00", endTime: "21:00", breakStart: "15:00", breakEnd: "16:00", workdays: ["MON","TUE","WED","THU","FRI"], isNightShift: false },
  { id: "night",      label: "Night Shift (9:00 PM-6:00 AM)", startTime: "21:00", endTime: "06:00", breakStart: "01:00", breakEnd: "02:00", workdays: ["MON","TUE","WED","THU","FRI"], isNightShift: true  },
  { id: "halfday_am", label: "Half Day AM (9:00 AM-1:00 PM)", startTime: "09:00", endTime: "13:00", breakStart: "11:30", breakEnd: "12:00", workdays: ["MON","TUE","WED","THU","FRI"], isNightShift: false },
  { id: "halfday_pm", label: "Half Day PM (1:00 PM-6:00 PM)", startTime: "13:00", endTime: "18:00", breakStart: "15:30", breakEnd: "16:00", workdays: ["MON","TUE","WED","THU","FRI"], isNightShift: false },
  { id: "custom",     label: "Custom...", startTime: "09:00", endTime: "18:00", breakStart: "12:00", breakEnd: "13:00", workdays: ["MON","TUE","WED","THU","FRI"], isNightShift: false },
];

const WEEKDAYS = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
const WEEKDAY_LABELS: Record<string, string> = {
  MON: "Mo", TUE: "Tu", WED: "We", THU: "Th", FRI: "Fr", SAT: "Sa", SUN: "Su",
};
const WEEKDAY_FULL: Record<string, string> = {
  MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun",
};

function normalizeTimeForInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hh = match[1].padStart(2, "0");
  return `${hh}:${match[2]}`;
}

function parseWorkdaysInput(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map(day => day.trim().toUpperCase())
    .filter(day => WEEKDAYS.includes(day));
}

function getTodayInManila(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}
function getTomorrowInManila(): string {
  const now = new Date();
  const manilaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now);
  const base = new Date(`${manilaToday}T00:00:00+08:00`);
  base.setUTCDate(base.getUTCDate() + 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(base);
}

async function readJsonOrNull<T>(res: Response): Promise<T | null> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as T;
}

function resolveInitialTemplateId(
  schedule: ScheduleSeed | undefined,
  parsedDays: string[],
): string {
  if (!schedule) return "standard";
  const start = normalizeTimeForInput(schedule.start_time);
  const end = normalizeTimeForInput(schedule.end_time);
  const breakStart = normalizeTimeForInput(schedule.break_start);
  const breakEnd = normalizeTimeForInput(schedule.break_end);
  const isNight = Boolean(schedule.is_nightshift);
  if (!start || !end) return "custom";

  const matched = SCHEDULE_TEMPLATES.find((template) =>
    template.id !== "custom" &&
    template.startTime === start &&
    template.endTime === end &&
    template.breakStart === breakStart &&
    template.breakEnd === breakEnd &&
    template.isNightShift === isNight &&
    template.workdays.length === parsedDays.length &&
    template.workdays.every((day) => parsedDays.includes(day))
  );

  return matched?.id ?? "custom";
}

// ─── Exported types ───────────────────────────────────────────────────────────

export type DepartmentOption = { id: string; name: string };

export type EmployeeOption = {
  user_id?: string | null;
  employee_id: string;
  first_name: string;
  last_name: string;
  department_id: string | null;
  department_name: string | null;
};

// ─── Time Picker Wheel ────────────────────────────────────────────────────────

const DRUM_ITEM_H     = 44;
const DRUM_VISIBLE    = 5;
const DRUM_H          = DRUM_ITEM_H * DRUM_VISIBLE;  // 220px total
const DRUM_PAD        = DRUM_ITEM_H * 2;             // 88px top/bottom spacer

const DRUM_HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const DRUM_MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const DRUM_AMPM    = ["AM", "PM"];

function ScrollDrum({
  items,
  selectedIndex,
  onSelect,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: selectedIndex * DRUM_ITEM_H, behavior: "instant" as ScrollBehavior });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const i = Math.max(0, Math.min(Math.round(el.scrollTop / DRUM_ITEM_H), items.length - 1));
      el.scrollTo({ top: i * DRUM_ITEM_H, behavior: "smooth" });
      onSelect(i);
    }, 140);
  };

  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current); }, []);

  return (
    <div className="relative flex-1 overflow-hidden" style={{ height: DRUM_H }}>

      {/* Center highlight pill */}
      <div
        className="absolute inset-x-1 rounded-xl pointer-events-none z-10 bg-muted"
        style={{ top: DRUM_PAD, height: DRUM_ITEM_H }}
      />

      {/* Top fade */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none z-20"
        style={{
          height: DRUM_PAD,
          background: "linear-gradient(to bottom, hsl(var(--background)) 20%, transparent 100%)",
        }}
      />
      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none z-20"
        style={{
          height: DRUM_PAD,
          background: "linear-gradient(to top, hsl(var(--background)) 20%, transparent 100%)",
        }}
      />

      {/* Scroll container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-scroll"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" } as React.CSSProperties}
      >
        <div style={{ height: DRUM_PAD }} aria-hidden />

        {items.map((item, i) => (
          <div
            key={item}
            style={{ height: DRUM_ITEM_H, scrollSnapAlign: "center" } as React.CSSProperties}
            onClick={() => {
              scrollRef.current?.scrollTo({ top: i * DRUM_ITEM_H, behavior: "smooth" });
              onSelect(i);
            }}
            className={[
              "relative z-30 flex items-center justify-center cursor-pointer select-none transition-all duration-150",
              i === selectedIndex
                ? "text-foreground font-semibold text-base"
                : "text-muted-foreground font-normal text-sm",
            ].join(" ")}
          >
            {item}
          </div>
        ))}

        <div style={{ height: DRUM_PAD }} aria-hidden />
      </div>
    </div>
  );
}

function TimePickerWheel({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selHr,  setSelHr]  = useState(0);
  const [selMin, setSelMin] = useState(0);
  const [selAP,  setSelAP]  = useState(0);

  const parseValue = (v: string) => {
    const parts = v.split(":");
    const h24 = Number.parseInt(parts[0] ?? "9", 10);
    const m   = Number.parseInt(parts[1] ?? "0", 10);
    return {
      h24,
      m,
      h12:  h24 % 12 === 0 ? 12 : h24 % 12,
      isPm: h24 >= 12,
    };
  };

  const { h12, m, isPm } = parseValue(value);
  const displayValue = `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${isPm ? "PM" : "AM"}`;

  const handleOpen = () => {
    const { h12: ch, m: cm, isPm: cp } = parseValue(value);
    setSelHr(ch - 1);
    setSelMin(cm);
    setSelAP(cp ? 1 : 0);
    setOpen(true);
  };

  const handleDone = () => {
    const hr12 = selHr + 1;
    let hr24   = hr12 % 12;
    if (selAP === 1) hr24 += 12;
    onChange(`${String(hr24).padStart(2, "0")}:${String(selMin).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <div className="relative">
      {label && <label className="text-xs text-muted-foreground mb-1 block">{label}</label>}

      <button
        type="button"
        onClick={handleOpen}
        className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-primary/40 transition-colors"
      >
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium text-foreground">{displayValue}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-[71] bg-background border border-border/60 rounded-2xl shadow-2xl overflow-hidden w-52 animate-in fade-in slide-in-from-top-2 duration-150">

            {/* Header */}
            <p className="pt-4 pb-1 text-center text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase select-none">
              Select Time
            </p>

            {/* Drum columns */}
            <div className="flex items-center px-2">
              <ScrollDrum items={DRUM_HOURS}   selectedIndex={selHr}  onSelect={setSelHr}  />
              <span className="shrink-0 select-none text-lg font-bold text-muted-foreground mb-0.5 px-0.5">:</span>
              <ScrollDrum items={DRUM_MINUTES} selectedIndex={selMin} onSelect={setSelMin} />
              <ScrollDrum items={DRUM_AMPM}    selectedIndex={selAP}  onSelect={setSelAP}  />
            </div>

            {/* Done */}
            <div className="px-3 pb-4 pt-2">
              <button
                type="button"
                onClick={handleDone}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all duration-100"
              >
                Done
              </button>
            </div>

          </div>
        </>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleManagementModal({
  employeeCount,
  departments,
  employees = [],
  initialScope,
  initialDepartmentId,
  initialSchedule,
  onClose,
  onApplied,
}: Readonly<{
  employeeCount: number;
  departments: DepartmentOption[];
  employees?: EmployeeOption[];
  initialScope?: ApplyScope;
  initialDepartmentId?: string;
  initialSchedule?: ScheduleSeed | null;
  onClose: () => void;
  onApplied?: () => void;
}>) {
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

  const initialDeptId =
    initialDepartmentId && departments.some(d => d.id === initialDepartmentId)
      ? initialDepartmentId
      : (departments[0]?.id ?? "");
  const initialDeptName = departments.find(d => d.id === initialDeptId)?.name ?? "";
  const initialParsedDays = parseWorkdaysInput(initialSchedule?.workdays).length > 0
    ? parseWorkdaysInput(initialSchedule?.workdays)
    : ["MON","TUE","WED","THU","FRI"];
  const initialTemplateId = resolveInitialTemplateId(initialSchedule ?? undefined, initialParsedDays);

  const [scope, setScope]                     = useState<ApplyScope>(initialScope === "company" ? "department" : (initialScope ?? "department"));
  const [selectedDept, setSelectedDept]       = useState(initialDeptName);
  const [selectedDeptId, setSelectedDeptId]   = useState(initialDeptId);
  const [skipIndividual, setSkipIndividual]   = useState(true); // default: skip individually-set schedules
  const [templateId, setTemplateId]           = useState(initialTemplateId);
  const [effectiveDate, setEffectiveDate]     = useState(() => getTomorrowInManila());
  const [confirmed, setConfirmed]             = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [done, setDone]                       = useState(false);
  const [applyError, setApplyError]           = useState<string | null>(null);
  const [affectedResult, setAffectedResult]   = useState<number | null>(null);
  const todayInManila = useMemo(() => getTodayInManila(), []);
  const tomorrowInManila = useMemo(() => getTomorrowInManila(), []);

  // Custom template overrides
  const [customStart,      setCustomStart]      = useState(normalizeTimeForInput(initialSchedule?.start_time) ?? "09:00");
  const [customEnd,        setCustomEnd]        = useState(normalizeTimeForInput(initialSchedule?.end_time) ?? "18:00");
  const [customBreakStart, setCustomBreakStart] = useState(normalizeTimeForInput(initialSchedule?.break_start) ?? "12:00");
  const [customBreakEnd,   setCustomBreakEnd]   = useState(normalizeTimeForInput(initialSchedule?.break_end) ?? "13:00");
  const [customDays,       setCustomDays]       = useState<string[]>(initialParsedDays);

  // Employees scope state
  const [empSearch,        setEmpSearch]        = useState("");
  const [empDeptFilter,    setEmpDeptFilter]    = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());

  const isCustom = templateId === "custom";
  const template = SCHEDULE_TEMPLATES.find(t => t.id === templateId) ?? SCHEDULE_TEMPLATES[0];

  const previewStart      = isCustom ? customStart      : template.startTime;
  const previewEnd        = isCustom ? customEnd        : template.endTime;
  const previewBreakStart = isCustom ? customBreakStart : template.breakStart;
  const previewBreakEnd   = isCustom ? customBreakEnd   : template.breakEnd;
  const previewDays       = isCustom ? customDays       : template.workdays;
  const previewNight      = isCustom ? customEnd < customStart : template.isNightShift;

  // Filtered employees for the employee picker
  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (empDeptFilter) list = list.filter(e => e.department_id === empDeptFilter);
    if (empSearch.trim()) {
      const q = empSearch.toLowerCase();
      list = list.filter(e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        e.employee_id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, empDeptFilter, empSearch]);

  const allVisibleSelected =
    filteredEmployees.length > 0 &&
    filteredEmployees.every(e => selectedEmployeeIds.has(e.employee_id));

  const someVisibleSelected =
    filteredEmployees.some(e => selectedEmployeeIds.has(e.employee_id)) && !allVisibleSelected;

  const toggleSelectAll = () => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredEmployees.forEach(e => next.delete(e.employee_id));
      } else {
        filteredEmployees.forEach(e => next.add(e.employee_id));
      }
      return next;
    });
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  const departmentEmployeeCount = useMemo(() => {
    if (!selectedDeptId) return 0;
    return employees.filter(e => e.department_id === selectedDeptId).length;
  }, [employees, selectedDeptId]);

  const affectedCount =
    scope === "department" ? departmentEmployeeCount :
    selectedEmployeeIds.size;

  const toggleDay = (day: string) => {
    setCustomDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleApply = async () => {
    if (!confirmed) { setConfirmed(true); return; }
    if (effectiveDate < tomorrowInManila) {
      setApplyError("Effectivity date must be tomorrow or later.");
      setConfirmed(false);
      return;
    }
    setApplyError(null);
    setSubmitting(true);
    try {
      const selectedEmployees = employees.filter(e => selectedEmployeeIds.has(e.employee_id));
      const selectedUserIds = selectedEmployees
        .map(e => e.user_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      const selectedEmployeeIdsPayload = selectedEmployees.map(e => e.employee_id);

      const res = await authFetch(`${API_BASE_URL}/timekeeping/schedules/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          department_id:   scope === "department" ? selectedDeptId : undefined,
          user_ids:        scope === "employees" ? selectedUserIds : undefined,
          employee_ids:    scope === "employees" ? selectedEmployeeIdsPayload : undefined,
          skip_individual: scope !== "employees" ? skipIndividual : undefined,
          schedule: {
            start_time:    previewStart,
            end_time:      previewEnd,
            break_start:   previewBreakStart,
            break_end:     previewBreakEnd,
            workdays:      previewDays.join(","),
            is_nightshift: previewNight,
          },
          effective_date: effectiveDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err?.message || "Failed to apply schedule.");
      }
      const result = await readJsonOrNull<{ affected: number }>(res);
      setAffectedResult(result?.affected ?? 0);
      onApplied?.();
      setDone(true);
    } catch (e: unknown) {
      setApplyError(e instanceof Error ? e.message : "An error occurred.");
      setConfirmed(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────

  if (done) {
    const scopeLabel =
      scope === "department" ? `${selectedDept} department has` :
      `${affectedResult ?? selectedEmployeeIds.size} selected employee${(affectedResult ?? selectedEmployeeIds.size) !== 1 ? "s have" : " has"}`;

    return (
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-in fade-in duration-300">
          <div className="h-14 w-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <h3 className="text-lg font-bold mb-1">Schedule Applied</h3>
          <p className="text-sm text-muted-foreground mb-2">
            {scopeLabel} been assigned the <strong>{isCustom ? "Custom" : template.label}</strong> schedule, effective {effectiveDate}.
          </p>
          {affectedResult != null && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
              {affectedResult} employee{affectedResult !== 1 ? "s" : ""} updated.
            </p>
          )}
          <Button onClick={onClose} className="w-full mt-2">Done</Button>
        </div>
      </div>
    );
  }

  // ── Main modal ──────────────────────────────────────────────────────────────

  const applyDisabled =
    submitting ||
    effectiveDate < tomorrowInManila ||
    (scope === "department" && !selectedDeptId) ||
    (scope === "employees" && selectedEmployeeIds.size === 0);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in fade-in duration-300 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold">Assign Schedule</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Apply a work schedule to employees in your company</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* ── Scope selector ────────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Apply To</p>
            <div className="flex p-0.5 bg-muted rounded-lg border border-border">
              {([
                { id: "department", label: "Department", icon: Building2 },
                { id: "employees",  label: "Employees",  icon: Users     },
              ] as { id: ApplyScope; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setScope(id)}
                  className={[
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    scope === id
                      ? "bg-background text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Department picker ─────────────────────────────────────────── */}
          {scope === "department" && departments.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Department</p>
              <div className="relative">
                <select
                  value={selectedDeptId}
                  onChange={e => {
                    const opt = departments.find(d => d.id === e.target.value);
                    setSelectedDeptId(e.target.value);
                    setSelectedDept(opt?.name ?? "");
                  }}
                  className="w-full h-9 pl-3 pr-8 text-sm border border-border rounded-md bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* ── Employee picker ───────────────────────────────────────────── */}
          {scope === "employees" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Employees</p>
                {selectedEmployeeIds.size > 0 && (
                  <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 font-bold">
                    {selectedEmployeeIds.size} selected
                  </span>
                )}
              </div>

              {/* Filters row */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search name or ID..."
                    value={empSearch}
                    onChange={e => setEmpSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                {departments.length > 0 && (
                  <div className="relative w-40 shrink-0">
                    <select
                      value={empDeptFilter}
                      onChange={e => setEmpDeptFilter(e.target.value)}
                      className="w-full h-8 pl-2.5 pr-7 text-xs border border-border rounded-md bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      <option value="">All departments</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Employee list */}
              <div className="border border-border rounded-xl overflow-hidden">

                {/* Select-all header */}
                <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 border-b border-border">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={el => { if (el) el.indeterminate = someVisibleSelected; }}
                    onChange={toggleSelectAll}
                    disabled={filteredEmployees.length === 0}
                    className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                  />
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {filteredEmployees.length === 0
                      ? "No employees found"
                      : `Select all (${filteredEmployees.length})`}
                  </span>
                </div>

                {/* Scrollable rows */}
                <div className="max-h-48 overflow-y-auto divide-y divide-border">
                  {filteredEmployees.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No employees match your filter.
                    </div>
                  ) : (
                    filteredEmployees.map(emp => {
                      const checked = selectedEmployeeIds.has(emp.employee_id);
                      return (
                        <label
                          key={emp.user_id ?? emp.employee_id}
                          className={[
                            "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                            checked ? "bg-primary/5" : "hover:bg-muted/30",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleEmployee(emp.employee_id)}
                            className="h-4 w-4 rounded border-border cursor-pointer accent-primary shrink-0"
                          />
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 select-none">
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {emp.first_name} {emp.last_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">{emp.employee_id}</p>
                          </div>
                          {emp.department_name && (
                            <span className="text-[10px] bg-muted text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0 max-w-[80px] truncate">
                              {emp.department_name}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Inline validation */}
              {selectedEmployeeIds.size === 0 && (
                <p className="text-[11px] text-amber-600 mt-1.5">Select at least one employee to apply the schedule.</p>
              )}
            </div>
          )}

          {/* ── Skip individual schedules option (company / dept scope only) ── */}
          {scope !== "employees" && (
            <label className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={skipIndividual}
                onChange={e => setSkipIndividual(e.target.checked)}
                className="h-4 w-4 rounded border-border cursor-pointer accent-primary mt-0.5 shrink-0"
              />
              <div>
                <p className="text-xs font-semibold text-foreground">Skip individually-assigned schedules</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Employees whose schedules were manually set by HR will not be overridden. Uncheck to apply to everyone.
                </p>
              </div>
            </label>
          )}

          {/* ── Template picker ───────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Schedule Template</p>
            <div className="relative">
              <select
                value={templateId}
                onChange={e => setTemplateId(e.target.value)}
                className="w-full h-9 pl-3 pr-8 text-sm border border-border rounded-md bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {SCHEDULE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* ── Custom template fields ────────────────────────────────────── */}
          {isCustom && (
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Custom Schedule</p>

              <div className="grid grid-cols-2 gap-3">
                <TimePickerWheel label="Start Time"  value={customStart}      onChange={setCustomStart}      />
                <TimePickerWheel label="End Time"    value={customEnd}        onChange={setCustomEnd}        />
                <TimePickerWheel label="Break Start" value={customBreakStart} onChange={setCustomBreakStart} />
                <TimePickerWheel label="Break End"   value={customBreakEnd}   onChange={setCustomBreakEnd}   />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Work Days</label>
                <div className="flex gap-1.5">
                  {WEEKDAYS.map(d => (
                    <button
                      key={d}
                      onClick={() => toggleDay(d)}
                      title={WEEKDAY_FULL[d]}
                      className={[
                        "h-8 w-8 rounded-full text-xs font-bold transition-all cursor-pointer border",
                        customDays.includes(d)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50",
                      ].join(" ")}
                    >
                      {WEEKDAY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── Schedule preview ──────────────────────────────────────────── */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <span className="text-base font-bold text-foreground">
                {formatScheduleClock(previewStart)} – {formatScheduleClock(previewEnd)}
              </span>
              {previewNight && <span className="text-[9px] bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">Night</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              Break: {formatScheduleClock(previewBreakStart)} – {formatScheduleClock(previewBreakEnd)}
            </p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map(d => (
                <span
                  key={d}
                  className={[
                    "rounded-md text-[10px] font-bold flex items-center justify-center py-1",
                    previewDays.includes(d) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {WEEKDAY_LABELS[d]}
                </span>
              ))}
            </div>
          </div>

          {/* ── Effective date ────────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Effective Date</p>
            <Input
              type="date"
              value={effectiveDate}
              min={tomorrowInManila}
              onChange={e => setEffectiveDate(e.target.value)}
              className="h-9 text-sm w-full"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              For attendance and payroll consistency, schedule changes take effect starting tomorrow.
            </p>
          </div>

          {/* ── Confirm warning ───────────────────────────────────────────── */}
          {confirmed && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
              Update schedule for{" "}
              <strong>
                {scope === "company"
                  ? `all ${employeeCount} employees`
                  : scope === "department"
                  ? `${selectedDept} dept`
                  : `${selectedEmployeeIds.size} employee${selectedEmployeeIds.size !== 1 ? "s" : ""}`}
              </strong>{" "}effective <strong>{effectiveDate}</strong>. Cannot be undone.
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-border shrink-0 bg-muted/10 space-y-2">
          {applyError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {applyError}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={onClose} className="cursor-pointer">Cancel</Button>
            <Button
              onClick={handleApply}
              disabled={applyDisabled}
              className="gap-2 cursor-pointer"
            >
              {submitting ? (
                <><div className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> Applying...</>
              ) : confirmed ? (
                <>Confirm - Apply to {affectedCount} {affectedCount === 1 ? "employee" : "employees"}</>
              ) : (
                <>Apply to {affectedCount} {affectedCount === 1 ? "employee" : "employees"} -&gt;</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
