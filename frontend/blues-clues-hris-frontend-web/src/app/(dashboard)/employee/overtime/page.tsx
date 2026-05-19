"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, AlarmClock, ArrowRight, CalendarDays, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, Info, Loader2, Moon, Plus, Send,
  Timer, Palmtree, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  getMyOvertimeRequests, fileOvertimeRequestApi, getMyOvertimeSummary,
  getMyLeaveRequests, authFetch,
  type OvertimeRequest, type OvertimeType, type LeaveRequestItem,
} from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ─── Apple-style drum time picker ────────────────────────────────────────────

const DRUM_H = 44;

function Drum({ items, value, onChange }: {
  items: Array<{ val: string; label: string }>;
  value: string;
  onChange: (val: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const firing = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.findIndex((i) => i.val === value);
    if (idx >= 0) el.scrollTop = idx * DRUM_H;
  }, [items, value]);

  const onScroll = () => {
    if (firing.current) return;
    firing.current = true;
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        const idx = Math.round(el.scrollTop / DRUM_H);
        const clamped = Math.max(0, Math.min(idx, items.length - 1));
        if (items[clamped]) onChange(items[clamped].val);
      }
      firing.current = false;
    });
  };

  return (
    <div className="relative flex-1" style={{ height: DRUM_H * 5, overflow: "hidden" }}>
      <div className="absolute inset-x-0 bg-muted/50 border-y border-border/60 pointer-events-none z-10 rounded-md"
        style={{ top: DRUM_H * 2, height: DRUM_H }} />
      <div className="absolute inset-x-0 top-0 pointer-events-none z-20"
        style={{ height: DRUM_H * 1.5, background: "linear-gradient(to bottom, hsl(var(--background)) 20%, transparent)" }} />
      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20"
        style={{ height: DRUM_H * 1.5, background: "linear-gradient(to top, hsl(var(--background)) 20%, transparent)" }} />
      <div ref={ref} onScroll={onScroll}
        style={{ height: "100%", overflowY: "scroll", scrollSnapType: "y mandatory", scrollbarWidth: "none" }}>
        <div style={{ height: DRUM_H * 2 }} />
        {items.map((item) => (
          <div key={item.val}
            style={{ height: DRUM_H, scrollSnapAlign: "center" }}
            onClick={() => {
              const idx = items.findIndex((i) => i.val === item.val);
              ref.current?.scrollTo({ top: idx * DRUM_H, behavior: "smooth" });
              onChange(item.val);
            }}
            className={`flex items-center justify-center cursor-pointer select-none transition-all duration-100 ${
              item.val === value ? "text-foreground font-bold text-lg" : "text-muted-foreground text-sm"
            }`}
          >
            {item.label}
          </div>
        ))}
        <div style={{ height: DRUM_H * 2 }} />
      </div>
    </div>
  );
}

function TimePickerDrum({ value, onChange, onClose }: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const parse = (v: string) => {
    if (!v) return { h: "12", m: "00", ap: "AM" as "AM" | "PM" };
    const [h24Str, minStr] = v.split(":");
    const h24 = parseInt(h24Str);
    const min = parseInt(minStr);
    const ap: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
    const h = String(h24 % 12 || 12);
    const m = String(Math.round(min / 5) * 5 % 60).padStart(2, "0");
    return { h, m, ap };
  };

  const init = parse(value);
  const [h, setH] = useState(init.h);
  const [m, setM] = useState(init.m);
  const [ap, setAp] = useState<"AM" | "PM">(init.ap);

  const to24 = (hh: string, mm: string, aap: string) => {
    let h24 = parseInt(hh) % 12;
    if (aap === "PM") h24 += 12;
    return `${String(h24).padStart(2, "0")}:${mm}`;
  };

  const HOURS = Array.from({ length: 12 }, (_, i) => ({ val: String(i + 1), label: String(i + 1) }));
  const MINS  = Array.from({ length: 12 }, (_, i) => { const v = String(i * 5).padStart(2, "0"); return { val: v, label: v }; });
  const AMPMS = [{ val: "AM", label: "AM" }, { val: "PM", label: "PM" }];

  const upd = (nh: string, nm: string, nap: string) => onChange(to24(nh, nm, nap));

  return (
    <div className="rounded-2xl border border-border bg-background shadow-2xl shadow-black/10 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">Select Time</p>
      <div className="flex items-center gap-1">
        <Drum items={HOURS} value={h} onChange={(v) => { setH(v); upd(v, m, ap); }} />
        <span className="text-xl font-bold text-foreground shrink-0">:</span>
        <Drum items={MINS} value={m} onChange={(v) => { setM(v); upd(h, v, ap); }} />
        <div className="w-2 shrink-0" />
        <Drum items={AMPMS} value={ap} onChange={(v) => { const a = v as "AM" | "PM"; setAp(a); upd(h, m, v); }} />
      </div>
      <button type="button" onClick={onClose}
        className="w-full h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer">
        Done
      </button>
    </div>
  );
}

function fmt24to12(v: string): string {
  if (!v) return "";
  const [h24Str, minStr] = v.split(":");
  const h24 = parseInt(h24Str);
  const min = parseInt(minStr);
  const ap = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 || 12;
  return `${h}:${String(min).padStart(2, "0")} ${ap}`;
}

// ─── Inline calendar date picker ──────────────────────────────────────────────

function CalendarPicker({
  value,
  onChange,
  min,
  max,
  highlightRestDays = false,
  workdays = [],
}: {
  value: string;
  onChange: (v: string) => void;
  min: string;
  max?: string;
  highlightRestDays?: boolean;
  workdays?: string[];
}) {
  const minDate = useMemo(() => new Date(min + "T00:00:00"), [min]);
  const maxDate = useMemo(() => (max ? new Date(max + "T00:00:00") : null), [max]);
  const todayFloor = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const [viewYear, setViewYear] = useState(() => {
    if (value) return new Date(value + "T00:00:00").getFullYear();
    return minDate.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return new Date(value + "T00:00:00").getMonth();
    return minDate.getMonth();
  });

  const firstDayOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Mon = 0
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const getStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getDow = (day: number) =>
    new Date(viewYear, viewMonth, day)
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase();

  const isRestDay = (day: number): boolean => {
    if (!workdays.length) return false;
    return !workdays.includes(getDow(day));
  };

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (d < minDate) return true;
    if (maxDate && d > maxDate) return true;
    // for REST_DAY mode: disable workdays so only rest days are selectable
    if (highlightRestDays && workdays.length > 0 && !isRestDay(day)) return true;
    return false;
  };
  const isSelected  = (day: number) => value === getStr(day);
  const isTodayCell = (day: number) => new Date(viewYear, viewMonth, day).getTime() === todayFloor.getTime();
  const isRestDayCell = (day: number): boolean => {
    if (!highlightRestDays || !workdays.length) return false;
    return !workdays.includes(getDow(day));
  };

  const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  return (
    <div className="rounded-2xl border border-border/60 bg-background overflow-hidden shadow-[0_2px_8px_-3px_rgba(0,0,0,0.07)]">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-border/40">
        <button
          type="button"
          onClick={prevMonth}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <p className="text-xs font-bold text-foreground tracking-tight">{monthLabel}</p>
        <button
          type="button"
          onClick={nextMonth}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 pb-3 pt-2">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map(d => (
            <div key={d} className="flex items-center justify-center h-6">
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/45">{d}</span>
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`blank-${idx}`} />;
            const disabled  = isDisabled(day);
            const selected  = isSelected(day);
            const isToday   = isTodayCell(day);
            const restDay   = !disabled && isRestDayCell(day);
            return (
              <button
                key={getStr(day)}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onChange(getStr(day))}
                className={[
                  "h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all duration-100",
                  disabled ? "text-slate-300 cursor-not-allowed" : "cursor-pointer",
                  selected ? "bg-primary text-primary-foreground shadow-sm scale-[1.05]" : "",
                  !selected && restDay   ? "bg-violet-100/70 text-violet-700 font-bold hover:bg-violet-200/70" : "",
                  !selected && isToday && !restDay ? "text-primary font-black ring-1 ring-primary/30 ring-inset" : "",
                  !selected && isToday &&  restDay ? "ring-1 ring-violet-400/40 ring-inset" : "",
                  !selected && !disabled && !isToday && !restDay ? "text-foreground hover:bg-muted" : "",
                ].join(" ")}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        {highlightRestDays && workdays.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 px-0.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-violet-100 border border-violet-300/60 shrink-0" />
            <span className="text-[10px] text-violet-600/80 font-semibold">
              Eligible rest days
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── OT Page ──────────────────────────────────────────────────────────────────

const OT_TYPES: {
  value: OvertimeType; icon: React.ElementType; label: string; desc: string;
  activeBg: string; activeRing: string;
}[] = [
  { value: "NORMAL",   icon: Clock,    label: "Normal OT",   desc: "Scheduled workday", activeBg: "bg-blue-600",   activeRing: "ring-blue-500/30" },
  { value: "REST_DAY", icon: Moon,     label: "Rest Day",    desc: "On your rest day",  activeBg: "bg-violet-600", activeRing: "ring-violet-500/30" },
  { value: "HOLIDAY",  icon: Palmtree, label: "Holiday OT",  desc: "On a holiday",      activeBg: "bg-teal-600",   activeRing: "ring-teal-500/30" },
];

const ALL_WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_LABELS: Record<string, string> = { SUN: "Sun", MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat" };

function normalizeWorkdays(raw: unknown): string[] {
  if (!raw) return [];
  const normalize = (d: string) => {
    const s = d.trim().toUpperCase();
    if (s === "TUES") return "TUE";
    if (s === "THURS") return "THU";
    return s;
  };
  if (Array.isArray(raw)) return (raw as string[]).map(normalize);
  return String(raw).split(",").map(normalize);
}

function isWorkdayForDate(dateStr: string, workdays: string[]): boolean {
  if (!workdays.length || !dateStr) return true;
  const dayCode = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Manila" })
    .format(new Date(`${dateStr}T00:00:00+08:00`))
    .toUpperCase();
  return workdays.includes(dayCode);
}

const STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
  PENDING:  { label: "Pending",  className: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DENIED:   { label: "Denied",   className: "bg-rose-50 text-rose-700 border-rose-200" },
};

const OT_TYPE_DISPLAY: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  NORMAL:   { label: "Normal OT",  className: "bg-blue-50 text-blue-700 border-blue-200",     icon: Clock },
  REST_DAY: { label: "Rest Day",   className: "bg-violet-50 text-violet-700 border-violet-200", icon: Moon },
  HOLIDAY:  { label: "Holiday OT", className: "bg-teal-50 text-teal-700 border-teal-200",     icon: Palmtree },
};

const OT_TYPE_STRIP: Record<string, string> = {
  NORMAL:   "bg-blue-500",
  REST_DAY: "bg-violet-500",
  HOLIDAY:  "bg-teal-500",
};

function formatRequestDate(v: string) {
  const d = new Date(`${v}T00:00:00+08:00`);
  return {
    month:   d.toLocaleDateString("en-US", { month: "short",   timeZone: "Asia/Manila" }),
    day:     d.toLocaleDateString("en-US", { day: "numeric",   timeZone: "Asia/Manila" }),
    weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Manila" }),
  };
}

export default function EmployeeOvertimePage() {
  const router = useRouter();
  const [requests, setRequests]       = useState<OvertimeRequest[]>([]);
  const [summary, setSummary]         = useState<{ approved_planned_hours: number }>({ approved_planned_hours: 0 });
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [modalOpen, setModalOpen]     = useState(false);
  const [myWorkdays, setMyWorkdays]   = useState<string[]>([]);

  const [otType, setOtType]                   = useState<OvertimeType>("NORMAL");
  const [otDate, setOtDate]                   = useState("");
  const [startTime, setStartTime]             = useState("");
  const [endTime, setEndTime]                 = useState("");
  const [reason, setReason]                   = useState("");
  const [scheduleEndTime, setScheduleEndTime] = useState<string | null>(null);
  const [endTimePickerOpen, setEndTimePickerOpen] = useState(false);
  const [myApprovedLeaves, setMyApprovedLeaves]   = useState<LeaveRequestItem[]>([]);

  const tomorrow = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  // 30-day cap — far-future OT requests create payroll-cycle noise
  const maxBookable = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  }, []);

  const restDays = useMemo(() => ALL_WEEKDAYS.filter(d => !myWorkdays.includes(d)), [myWorkdays]);

  const dateError = useMemo(() => {
    if (!otDate || !myWorkdays.length || otType === "HOLIDAY") return null;
    const isWorkday = isWorkdayForDate(otDate, myWorkdays);
    if (otType === "REST_DAY" && isWorkday) return "This date is a scheduled workday — select a rest day.";
    if (otType === "NORMAL" && !isWorkday) return "This date is a rest day — select a scheduled workday.";
    return null;
  }, [otDate, otType, myWorkdays]);

  const leaveConflict = useMemo(() => {
    if (!otDate) return null;
    const match = myApprovedLeaves.find(l => l.start_date <= otDate && l.end_date >= otDate);
    return match ? match.leave_type : null;
  }, [otDate, myApprovedLeaves]);

  const sameDayOtConflict = useMemo(() => {
    if (!otDate) return false;
    return requests.some(r =>
      r.ot_date === otDate && (r.log_status === "PENDING" || r.log_status === "APPROVED"),
    );
  }, [otDate, requests]);

  const pendingCount = useMemo(() => requests.filter(r => r.log_status === "PENDING").length, [requests]);
  const deniedCount  = useMemo(() => requests.filter(r => r.log_status === "DENIED").length,  [requests]);
  const currentMonth = useMemo(() => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }), []);

  const today = useMemo(
    () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()),
    [],
  );

  const [activeTab, setActiveTab]       = useState<"upcoming" | "past">("upcoming");
  const [filterType, setFilterType]     = useState<"ALL" | OvertimeType>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "DENIED">("ALL");

  const todayOt = useMemo(
    () =>
      requests.find(r =>
        r.ot_date === today &&
        r.log_status === "APPROVED" &&
        (r.ot_type === "REST_DAY" || r.ot_type === "HOLIDAY"),
      ) ?? null,
    [requests, today],
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter(r => {
        const isUpcoming = r.ot_date >= today;
        if (activeTab === "upcoming" && !isUpcoming) return false;
        if (activeTab === "past"     &&  isUpcoming) return false;
        if (filterType   !== "ALL" && r.ot_type    !== filterType)   return false;
        if (filterStatus !== "ALL" && r.log_status !== filterStatus) return false;
        return true;
      }),
    [requests, today, activeTab, filterType, filterStatus],
  );

  async function loadData() {
    setLoading(true);
    try {
      const [r, s, schedRes, leavesRes] = await Promise.all([
        getMyOvertimeRequests(),
        getMyOvertimeSummary(),
        authFetch(`${API_BASE_URL}/timekeeping/my-schedule`).catch(() => null),
        getMyLeaveRequests().catch(() => [] as LeaveRequestItem[]),
      ]);
      setRequests(r);
      setSummary(s);
      setMyApprovedLeaves((leavesRes as LeaveRequestItem[]).filter(l => l.status === "approved"));
      if (schedRes) {
        const schedData = await schedRes.json().catch(() => null);
        if (schedData?.workdays) setMyWorkdays(normalizeWorkdays(schedData.workdays));
        if (schedData?.end_time) {
          setScheduleEndTime(schedData.end_time);
          setStartTime(schedData.end_time);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load overtime data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  function reset() {
    setOtDate("");
    setStartTime(scheduleEndTime ?? "");
    setEndTime("");
    setEndTimePickerOpen(false);
    setReason("");
    setOtType("NORMAL");
  }

  async function handleSubmit() {
    if (!otDate) { toast.error("Select a date."); return; }
    if (dateError) { toast.error(dateError); return; }
    if (!startTime || !endTime) { toast.error("Enter start and end time."); return; }
    if (endTime <= startTime) { toast.error("End time must be after start time."); return; }

    let latitude = 0, longitude = 0;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
      latitude  = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch { toast.error("Location required for overtime request."); return; }

    setSubmitting(true);
    try {
      await fileOvertimeRequestApi({
        ot_type: otType, ot_date: otDate, start_time: startTime,
        end_time: endTime, latitude, longitude, reason: reason || undefined,
      });
      toast.success("Overtime request submitted.");
      reset();
      setModalOpen(false);
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-400">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50 mb-1.5">
            Employee · Self-Service
          </p>
          <h1
            className="text-[1.6rem] font-black tracking-tight leading-none text-foreground"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Overtime Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Submit and track your overtime requests.
          </p>
        </div>

        {/* ── Dialog ──────────────────────────────────────────────────────── */}
        <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 shrink-0 mt-1 transition-all duration-150 active:scale-[0.97]">
              <Plus className="h-4 w-4" /> Request OT
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-sm p-0 overflow-hidden gap-0">
            {/* ── Dialog header ─────────────────────────────────────────── */}
            <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                  <Timer className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <DialogTitle
                    className="text-[15px] font-black tracking-tight leading-tight"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    New Overtime Request
                  </DialogTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Fill in the details below</p>
                </div>
              </div>
            </DialogHeader>

            {/* ── Scrollable body ───────────────────────────────────────── */}
            <div className="overflow-y-auto max-h-[calc(100dvh-12rem)] px-5 py-4 space-y-5">

              {/* OT Type */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em]">Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {OT_TYPES.map(({ value, icon: Icon, label, desc, activeBg, activeRing }) => {
                    const active = otType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => { setOtType(value); setOtDate(""); }}
                        className={`relative rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer ${
                          active
                            ? `${activeBg} border-transparent shadow-md ring-2 ${activeRing}`
                            : "border-border/60 bg-background hover:bg-muted/50 hover:border-border"
                        }`}
                      >
                        {active && (
                          <CheckCircle2 className="absolute top-2 right-2 h-3 w-3 text-white/70" />
                        )}
                        <Icon className={`h-4 w-4 mb-2 ${active ? "text-white" : "text-muted-foreground"}`} />
                        <p className={`text-[11px] font-bold leading-tight ${active ? "text-white" : "text-foreground"}`}>
                          {label}
                        </p>
                        <p className={`text-[9px] mt-0.5 leading-tight ${active ? "text-white/65" : "text-muted-foreground"}`}>
                          {desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Schedule hint */}
              {myWorkdays.length > 0 && otType !== "HOLIDAY" && (
                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                  otType === "REST_DAY"
                    ? "bg-violet-50 border-violet-200/70 text-violet-700"
                    : "bg-blue-50 border-blue-200/70 text-blue-700"
                }`}>
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {otType === "REST_DAY"
                      ? <>Rest days: <strong>{restDays.map(d => DAY_LABELS[d]).join(", ") || "None"}</strong></>
                      : <>Workdays: <strong>{myWorkdays.map(d => DAY_LABELS[d]).join(", ")}</strong></>
                    }
                  </span>
                </div>
              )}

              {/* Date — inline calendar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em]">
                    Date <span className="text-muted-foreground/40 normal-case font-normal">(future only)</span>
                  </p>
                  {otDate && (
                    <span className="text-[11px] font-bold text-primary">
                      {new Date(otDate + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </span>
                  )}
                </div>

                <CalendarPicker
                  key={`${modalOpen}-${otType}`}
                  value={otDate}
                  onChange={setOtDate}
                  min={tomorrow}
                  max={maxBookable}
                  highlightRestDays={otType === "REST_DAY"}
                  workdays={myWorkdays}
                />

                {(dateError || leaveConflict || sameDayOtConflict) && (
                  <div className="flex items-start gap-1.5 text-xs text-rose-600 font-medium bg-rose-50 border border-rose-200/70 rounded-xl px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      {dateError
                        ?? (leaveConflict
                          ? `Approved ${leaveConflict} leave on this date — OT not allowed.`
                          : "You already have an OT request on this date.")}
                    </span>
                  </div>
                )}
              </div>

              {/* Time fields */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em]">Time</p>

                {/* Start — locked from schedule */}
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground/60 font-semibold">Start</p>
                  <div className="flex items-center gap-2 border border-border/50 rounded-xl px-3 py-2.5 bg-muted/25">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <span className={`text-sm flex-1 ${startTime ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      {startTime ? fmt24to12(startTime) : "No schedule assigned"}
                    </span>
                    {startTime && (
                      <span className="text-[9px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-md font-medium">
                        From schedule
                      </span>
                    )}
                  </div>
                </div>

                {/* End — drum picker */}
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground/60 font-semibold">End</p>
                  <button
                    type="button"
                    onClick={() => setEndTimePickerOpen(p => !p)}
                    className={`w-full h-11 px-3 flex items-center gap-2 rounded-xl border text-sm transition-all duration-150 cursor-pointer ${
                      endTimePickerOpen
                        ? "border-primary ring-2 ring-primary/15 bg-primary/5"
                        : "border-border/60 hover:border-border bg-background"
                    } ${endTime ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    {endTime ? fmt24to12(endTime) : "Pick end time"}
                  </button>
                  {endTimePickerOpen && (
                    <TimePickerDrum
                      value={endTime || startTime}
                      onChange={v => setEndTime(v)}
                      onClose={() => setEndTimePickerOpen(false)}
                    />
                  )}
                </div>

                {/* Duration chip */}
                {startTime && endTime && endTime > startTime && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 border border-sky-200/70">
                    <Timer className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                    <span className="text-xs font-bold text-sky-700 tabular-nums">
                      {fmt24to12(startTime)} &rarr; {fmt24to12(endTime)}
                      {" · "}
                      {(() => {
                        const mins =
                          (parseInt(endTime.split(":")[0]) * 60 + parseInt(endTime.split(":")[1])) -
                          (parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]));
                        const h = Math.floor(mins / 60), m = mins % 60;
                        return `${h}h${m ? ` ${m}m` : ""} planned`;
                      })()}
                    </span>
                  </div>
                )}
                {startTime && endTime && endTime <= startTime && (
                  <p className="text-[11px] text-rose-600 font-medium">End time must be after start time.</p>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em]">
                    Reason
                    <span className="ml-1.5 text-muted-foreground/40 normal-case font-normal">(optional)</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums">{reason.length}/500</span>
                </div>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value.slice(0, 500))}
                  rows={2}
                  placeholder="Why the overtime?"
                  className="w-full border border-border/60 rounded-xl px-3.5 py-2.5 text-sm bg-muted/20 placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 resize-none transition-all duration-150"
                />
              </div>
            </div>

            {/* ── Submit footer ─────────────────────────────────────────── */}
            <div className="px-5 pb-5 pt-3 border-t border-border/40 bg-background">
              <Button
                className="w-full gap-2 h-11 text-sm font-bold transition-all active:scale-[0.98]"
                disabled={submitting || !!dateError || !!leaveConflict || sameDayOtConflict}
                onClick={() => void handleSubmit()}
              >
                {submitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
                {submitting ? "Submitting…" : "Submit Request"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Monthly summary banner ───────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden px-6 py-5 text-white"
        style={{ background: "linear-gradient(135deg, #0c1420 0%, #162357 52%, #0b3d3a 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] pointer-events-none" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 mb-2.5">{currentMonth}</p>
            <div className="flex items-baseline gap-2">
              <span
                className="font-black text-white tabular-nums leading-none"
                style={{ fontSize: "2.6rem", fontFamily: "var(--font-manrope)" }}
              >
                {summary.approved_planned_hours}
                <span className="text-2xl text-white/50 ml-0.5">h</span>
              </span>
              <span className="text-sm text-white/45 font-medium">approved</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-amber-400/12 border border-amber-400/25 text-amber-300 text-[11px] font-bold px-3 py-1.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                {pendingCount} pending
              </span>
            )}
            {deniedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-rose-400/12 border border-rose-400/25 text-rose-300 text-[11px] font-bold px-3 py-1.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 inline-block" />
                {deniedCount} denied
              </span>
            )}
            {!loading && pendingCount === 0 && deniedCount === 0 && requests.length > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-400/12 border border-emerald-400/25 text-emerald-300 text-[11px] font-bold px-3 py-1.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                all clear
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as "ALL" | OvertimeType)}
          className="border border-border rounded-xl px-3 py-2 text-xs font-semibold bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary cursor-pointer shrink-0"
        >
          <option value="ALL">All Types</option>
          <option value="NORMAL">Normal OT</option>
          <option value="REST_DAY">Rest Day</option>
          <option value="HOLIDAY">Holiday OT</option>
        </select>
        <div className="flex flex-1 gap-0.5 p-0.5 bg-muted/60 rounded-xl border border-border/40">
          {(["ALL", "PENDING", "APPROVED", "DENIED"] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`flex-1 py-1.5 rounded-[10px] text-[10px] font-bold uppercase tracking-wide transition-all duration-150 cursor-pointer ${
                filterStatus === s
                  ? "bg-background shadow-sm text-foreground border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border/70">
        {(["upcoming", "past"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-bold capitalize transition-all duration-200 cursor-pointer relative ${
              activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 inset-x-0 h-[2px] bg-foreground rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Today's OT notice ───────────────────────────────────────────────── */}
      {activeTab === "upcoming" && todayOt && (
        <div
          className="relative rounded-2xl overflow-hidden px-5 py-4 text-white"
          style={{ background: "linear-gradient(135deg, #0c1420 0%, #1a2a5e 100%)" }}
        >
          <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                Today &bull; {OT_TYPE_DISPLAY[todayOt.ot_type]?.label ?? todayOt.ot_type} &bull; Approved
              </p>
              <span className="bg-amber-400 text-amber-900 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                Today
              </span>
            </div>
            <p className="text-base font-black mb-0.5">
              {fmt24to12(todayOt.start_time)} &rarr; {fmt24to12(todayOt.end_time)} &bull; {todayOt.planned_hours}h planned
            </p>
            <p className="text-xs text-white/45 mb-3">Go to Timekeeping to clock in and out for this OT.</p>
            <button
              type="button"
              onClick={() => router.push("/employee/timekeeping")}
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/18 border border-white/15 text-white rounded-xl py-2.5 text-sm font-bold transition-all duration-150 active:scale-[0.98] cursor-pointer"
            >
              Open Timekeeping <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── List header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-tight flex items-center gap-2 text-foreground">
          <CalendarDays className="h-4 w-4 text-sky-500" />
          {activeTab === "upcoming" ? "Upcoming" : "Past"} Requests
        </h2>
        {filteredRequests.length > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {filteredRequests.length} {activeTab}
          </p>
        )}
      </div>

      {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="flex overflow-hidden rounded-xl border border-slate-100 bg-white"
              style={{ opacity: 1 - i * 0.18 }}
            >
              <div className="w-1 shrink-0 bg-slate-200 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
              <div className="w-14 shrink-0 bg-slate-50/80 border-r border-slate-100 flex flex-col items-center justify-center py-4 gap-1.5">
                <div className="h-2 bg-slate-200 rounded-full w-6 animate-pulse" />
                <div className="h-6 bg-slate-200 rounded-lg w-9 animate-pulse" style={{ animationDelay: `${i * 80 + 50}ms` }} />
                <div className="h-2 bg-slate-200 rounded-full w-5 animate-pulse" />
              </div>
              <div className="flex-1 px-4 py-3 space-y-2.5">
                <div className="flex justify-between gap-3">
                  <div className="h-4 bg-slate-100 rounded-full w-20 animate-pulse" />
                  <div className="h-4 bg-slate-100 rounded-full w-14 animate-pulse" />
                </div>
                <div className="h-4 bg-slate-100 rounded-full w-44 animate-pulse" style={{ animationDelay: "75ms" }} />
              </div>
            </div>
          ))}
        </div>

      ) : filteredRequests.length === 0 ? (
        <div className="py-14 flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 border border-slate-200/70 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <Timer className="h-6 w-6 text-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-sm">
              {requests.length === 0 ? "No overtime requests yet" : "No requests match filters"}
            </p>
            <p className="text-sm text-slate-400 mt-1 max-w-[180px] mx-auto leading-relaxed">
              {requests.length === 0
                ? "Submit your first OT request above."
                : "Try adjusting the type or status."}
            </p>
          </div>
          {requests.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 mt-1 cursor-pointer transition-all active:scale-[0.97]"
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
                               (req.ot_type === "REST_DAY" || req.ot_type === "HOLIDAY");
            const stripColor = OT_TYPE_STRIP[req.ot_type] ?? "bg-slate-400";

            return (
              <div
                key={req.ot_id}
                className="flex overflow-hidden rounded-xl border border-slate-200/80 bg-white
                  hover:border-slate-300 hover:-translate-y-px hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)]
                  transition-[transform,box-shadow,border-color] duration-200
                  animate-in fade-in fill-mode-both"
                style={{
                  animationDelay: `${i * 55}ms`,
                  animationDuration: "220ms",
                  borderColor: isToday ? "rgba(252,211,77,0.6)" : undefined,
                }}
              >
                <div className={`w-[3px] shrink-0 ${stripColor}`} />
                <div className={`w-14 shrink-0 flex flex-col items-center justify-center py-4 border-r ${
                  isToday ? "bg-amber-50 border-amber-100/80" : "bg-slate-50/70 border-slate-100"
                }`}>
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${isToday ? "text-amber-500" : "text-slate-400"}`}>
                    {dateInfo.month}
                  </p>
                  <p className="text-[1.4rem] font-black text-slate-800 leading-tight tabular-nums">{dateInfo.day}</p>
                  <p className={`text-[9px] font-medium mt-0.5 ${isToday ? "text-amber-500" : "text-slate-400"}`}>
                    {dateInfo.weekday}
                  </p>
                </div>
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
                    <p className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold mt-1">
                      <AlarmClock className="h-3 w-3 shrink-0" />
                      Clock in via Timekeeping today
                    </p>
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
  );
}
