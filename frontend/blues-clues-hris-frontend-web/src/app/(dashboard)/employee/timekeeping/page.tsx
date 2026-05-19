"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, LogIn, LogOut, MapPin,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, CalendarDays, CalendarRange, CalendarClock, List,
  AlertTriangle, X, CheckCircle2, FileX,
  Palmtree, BadgeCheck, Stethoscope, Zap, Home, User, HelpCircle,
  Timer, Sun, MoveRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authFetch, logoutApi, getMyOvertimeSummary, getMyOvertimeRequests, getMyLeaveRequests, getMyNewLeaveBalances, cancelLeaveRevocationApi, type LeaveRequestItem, type LeaveBalanceCategory } from "@/lib/authApi";
import { LEAVE_CATEGORIES } from "@/lib/leaveCategories";
import { API_BASE_URL } from "@/lib/api";
import {
  formatTime,
  formatHoursFromTimestamps,
  todayPST,
  formatGpsLocation,
  type LocationDisplayMode,
} from "@/lib/timekeepingUtils";

// â"€â"€â"€ Types â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

type OtSession = {
  ot_id: string;
  ot_type: "NORMAL" | "REST_DAY" | "HOLIDAY";
  approved_start: string;
  approved_end: string;
  approved_hours: number;
  actual_ot_minutes: number;
  capped_ot_minutes: number;
  in_progress: boolean;
};

type MyStatus = {
  date: string;
  current_status: "time-in" | "time-out" | "absence" | null;
  time_in: { timestamp: string; latitude: number; longitude: number; location_name?: string | null } | null;
  time_out: { timestamp: string; latitude: number; longitude: number; location_name?: string | null } | null;
  ot_session?: OtSession | null;
};

type AbsenceEntry = {
  log_id?: string | null;
  timestamp: string;
  absence_reason: string | null;
  absence_notes: string | null;
  log_status?: string | null;
  review_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
};

type TimesheetEntry = {
  date: string;
  time_in: { timestamp: string; latitude: number | null; longitude: number | null; location_name?: string | null } | null;
  time_out: { timestamp: string; latitude: number | null; longitude: number | null; location_name?: string | null } | null;
  absence: AbsenceEntry | null;
  absence_request?: AbsenceEntry | null;
};

// Display config for absence entries in calendar (read-only, no form logic)
const ABSENCE_REASONS: { value: string; icon: React.ElementType; color: string; bg: string; border: string }[] = [
  { value: "Sick Leave",          icon: Stethoscope, color: "text-rose-600",   bg: "bg-rose-50",   border: "border-rose-200"   },
  { value: "Emergency Leave",     icon: Zap,         color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  { value: "WFH / Remote",        icon: Home,        color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200"   },
  { value: "Personal Leave",      icon: User,        color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  { value: "Vacation Leave",      icon: Palmtree,    color: "text-teal-600",   bg: "bg-teal-50",   border: "border-teal-200"   },
  { value: "On Leave (Approved)", icon: BadgeCheck,  color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200"  },
  { value: "Other",               icon: HelpCircle,  color: "text-slate-500",  bg: "bg-slate-50",  border: "border-slate-200"  },
];

// â"€â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function parseTs(ts: string): Date {
  return new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
}

function formatLiveTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

function formatLiveDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    timeZone: "Asia/Manila",
  });
}

function formatEntryDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatCellTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "—";
  return parseTs(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila",
  });
}

function formatScheduleClock(value: string | null | undefined): string {
  if (!value) return "-";
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hours = Number.parseInt(match[1], 10);
  if (Number.isNaN(hours)) return value;
  const mins = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${mins} ${suffix}`;
}
function formatCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
  locationName: string | null | undefined,
  mode: LocationDisplayMode,
): string {
  return formatGpsLocation(lat, lng, locationName, mode);
}

function calcDuration(from: string, to: Date = new Date()): string {
  const diff = to.getTime() - parseTs(from).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtMins(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatLongDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

type EntryStatus = "on-time" | "late" | "in-progress" | "absent" | "excused" | "rest-day-ot";

function getClockInMinutesPHT(timestamp: string): number | null {
  const clock = parseTs(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
  const [hour, minute] = clock.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function isLateClockIn(entry: TimesheetEntry, schedule?: ScheduleInfo): boolean {
  if (!entry.time_in) return false;

  const clockInMins = getClockInMinutesPHT(entry.time_in.timestamp);
  if (clockInMins == null) return false;

  const scheduledStartMins = parseClockToMinutes(schedule?.start_time);
  if (scheduledStartMins != null) {
    return clockInMins > scheduledStartMins;
  }

  const hourPST = Number.parseInt(
    parseTs(entry.time_in.timestamp).toLocaleString("en-US", {
      hour: "numeric", hour12: false, timeZone: "Asia/Manila",
    }), 10
  );
  return hourPST >= 9;
}

function getEntryStatus(entry: TimesheetEntry, schedule?: ScheduleInfo): EntryStatus {
  if (!entry.time_in) {
    return String(entry.absence?.log_status ?? "").toUpperCase() === "APPROVED"
      ? "excused"
      : "absent";
  }
  if (isLateClockIn(entry, schedule)) return "late";
  if (!entry.time_out) return "in-progress";
  return "on-time";
}

const ENTRY_STATUS_CONFIG: Record<EntryStatus, { label: string; badge: string; dot: string; cell: string }> = {
  "on-time":      { label: "On Time",       badge: "bg-green-100 hover:bg-green-100 text-green-700 border-green-200",     dot: "bg-green-500",  cell: "bg-green-50 border-green-200" },
  "late":         { label: "Late",          badge: "bg-amber-100 hover:bg-amber-100 text-amber-700 border-amber-200",     dot: "bg-amber-500",  cell: "bg-amber-50 border-amber-200" },
  "in-progress":  { label: "In Progress",   badge: "bg-blue-100 hover:bg-blue-100 text-blue-700 border-blue-200",         dot: "bg-blue-500",   cell: "bg-blue-50 border-blue-200" },
  "absent":       { label: "Absent",        badge: "bg-red-100 hover:bg-red-100 text-red-700 border-red-200",             dot: "bg-red-500",    cell: "bg-red-50 border-red-200" },
  "excused":      { label: "Excused",       badge: "bg-purple-100 hover:bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500", cell: "bg-purple-50 border-purple-200" },
  "rest-day-ot":  { label: "Rest Day OT",   badge: "bg-violet-100 hover:bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500", cell: "bg-violet-50 border-violet-200" },
};

function buildDateMap(entries: TimesheetEntry[]): Record<string, TimesheetEntry> {
  return Object.fromEntries(entries.map(e => [e.date, e]));
}

function getDisplayStatus(
  entry: TimesheetEntry,
  schedule: ScheduleInfo,
  wdaySet: Set<string>,
): EntryStatus {
  if (entry.time_in) {
    const dayCode = SCHED_DAY_CODE[new Date(entry.date + "T00:00:00").getDay()];
    if (!wdaySet.has(dayCode)) return "rest-day-ot";
  }
  return getEntryStatus(entry, schedule);
}

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateInputLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function countInclusiveDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

const ITEMS_PER_PAGE = 7;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Must match the canonical 3-letter codes used by the backend (MON/TUE/WED/THU/FRI/SAT/SUN)
const SCHED_DAY_CODE = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function formatSchedTime(t: string | null | undefined): string {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr ?? "0", 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function parseClockToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function computeScheduledHoursPerDay(schedule: ScheduleInfo): number {
  if (!schedule?.start_time || !schedule?.end_time) return 0;
  const startMins = parseClockToMinutes(schedule.start_time);
  const endMins = parseClockToMinutes(schedule.end_time);
  if (startMins == null || endMins == null) return 0;

  let shiftMinutes = endMins - startMins;
  if (schedule.is_nightshift || shiftMinutes < 0) shiftMinutes += 24 * 60;

  const breakStart = parseClockToMinutes(schedule.break_start ?? null);
  const breakEnd = parseClockToMinutes(schedule.break_end ?? null);
  let breakMinutes = 0;
  if (breakStart != null && breakEnd != null) {
    breakMinutes = breakEnd - breakStart;
    if (breakMinutes < 0) breakMinutes += 24 * 60;
  }

  return Math.max(0, (shiftMinutes - breakMinutes) / 60);
}

type AbsenceReviewState = "PENDING" | "APPROVED" | "DENIED" | "ABSENT" | "UNKNOWN";

function normalizeAbsenceReviewState(value: string | null | undefined): AbsenceReviewState {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "PENDING") return "PENDING";
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "DENIED") return "DENIED";
  if (normalized === "ABSENT") return "ABSENT";
  return "UNKNOWN";
}

function getAbsenceReviewMeta(value: string | null | undefined): {
  label: string;
  shortLabel: string;
  badgeClass: string;
  textClass: string;
} {
  const state = normalizeAbsenceReviewState(value);
  if (state === "APPROVED") {
    return {
      label: "Approved",
      shortLabel: "Approved",
      badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
      textClass: "text-purple-700",
    };
  }
  if (state === "PENDING") {
    return {
      label: "Pending HR Review",
      shortLabel: "Pending",
      badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
      textClass: "text-amber-700",
    };
  }
  if (state === "DENIED") {
    return {
      label: "Denied",
      shortLabel: "Denied",
      badgeClass: "bg-red-100 text-red-700 border-red-200",
      textClass: "text-red-700",
    };
  }
  return {
    label: "Unexcused",
    shortLabel: "Absent",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    textClass: "text-red-700",
  };
}

function buildWeekDates(ref: Date): Date[] {
  const sunday = new Date(ref);
  sunday.setDate(ref.getDate() - ref.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

async function executePunch(type: "time-in" | "time-out", coords: { latitude: number; longitude: number }) {
  const res = await authFetch(`${API_BASE_URL}/timekeeping/${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(coords),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string })?.message || `Failed to clock ${type === "time-in" ? "in" : "out"}.`);
  }
}

// â"€â"€â"€ Confirmation Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function ConfirmModal({ children, onClose }: Readonly<{ children: React.ReactNode; onClose: () => void }>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-border w-full max-w-sm mx-4 animate-in zoom-in-95 duration-150">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

// â"€â"€â"€ Calendar Day Detail Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

type ScheduleInfo = {
  workdays: string | string[] | null;
  start_time: string | null;
  end_time: string | null;
  break_start?: string | null;
  break_end?: string | null;
  is_nightshift: boolean | null;
} | null;

function CancelRevocationButton({ requestId, onSuccess }: { requestId: string; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    try {
      await cancelLeaveRevocationApi(requestId);
      onSuccess();
    } catch (e: unknown) {
      alert((e as Error).message || "Failed to cancel revocation");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handle()}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-violet-300 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors cursor-pointer disabled:opacity-50"
    >
      {loading ? <span className="animate-spin h-3 w-3 border-2 border-violet-400 border-t-transparent rounded-full" /> : <X className="h-3.5 w-3.5" />}
      Cancel Revocation Request
    </button>
  );
}

function CalendarDayModal({
  dateStr, entry, onClose, schedule, locationDisplayMode, leaveRequest, onLeaveChanged,
}: Readonly<{
  dateStr: string;
  entry: TimesheetEntry | null;
  onClose: () => void;
  schedule: ScheduleInfo;
  locationDisplayMode: LocationDisplayMode;
  leaveRequest?: LeaveRequestItem | null;
  onLeaveChanged?: () => void;
}>) {
  const isFuture = dateStr > todayPST();
  const absenceMeta = getAbsenceReviewMeta(entry?.absence?.log_status);

  // Determine if this day is a scheduled workday
  const isWorkday = (() => {
    if (!schedule?.workdays) return false;
    const arr = Array.isArray(schedule.workdays)
      ? schedule.workdays
      : String(schedule.workdays).split(",");
    const workdaySet = new Set(arr.map(d => d.trim().toUpperCase()));
    const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();
    return workdaySet.has(SCHED_DAY_CODE[dayOfWeek]);
  })();

  const isRestDayOt = !isFuture && !isWorkday && !!entry?.time_in;
  const rawStatus = entry ? getEntryStatus(entry, schedule) : null;
  const status: EntryStatus | null = isRestDayOt ? "rest-day-ot" : rawStatus;
  const cfg = status ? ENTRY_STATUS_CONFIG[status] : null;

  const absenceReasonCfg = entry?.absence?.absence_reason
    ? ABSENCE_REASONS.find(r => r.value === entry.absence!.absence_reason)
    : null;

  // Detect auto-absent (no clock-in, no absence report)
  const isAutoAbsent = !isFuture && isWorkday && entry && !entry.time_in && !entry.absence;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl border border-border w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 ${cfg ? `${cfg.cell} border-b` : "border-b border-border"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                {isWorkday ? "Workday" : isRestDayOt ? "Rest Day — Overtime" : "Rest Day"}
              </p>
              <h2 className="text-base font-bold text-foreground leading-tight">{formatLongDate(dateStr)}</h2>
            </div>
            <div className="flex items-center gap-2">
              {cfg && (
                <Badge className={`text-[10px] font-bold border ${cfg.badge}`}>{cfg.label}</Badge>
              )}
              {isFuture && isWorkday && (
                <Badge className="text-[10px] font-bold bg-blue-100 text-blue-700 border-blue-200">Upcoming</Badge>
              )}
              {isFuture && !isWorkday && (
                <Badge className="text-[10px] font-bold bg-slate-100 text-slate-500 border-slate-200">Day Off</Badge>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* â"€â"€ Schedule section (if schedule assigned) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
          {schedule && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Your Schedule</p>
              {isWorkday ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-sm font-semibold text-blue-900">
                      {formatSchedTime(schedule.start_time)} — {formatSchedTime(schedule.end_time)}
                    </span>
                    {schedule.is_nightshift && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">Night</span>
                    )}
                  </div>
                  {(schedule.break_start || schedule.break_end) && (
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="text-xs text-blue-700">
                        Break: {formatSchedTime(schedule.break_start)} — {formatSchedTime(schedule.break_end)}
                      </span>
                    </div>
                  )}
                </div>
              ) : isRestDayOt ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 flex items-center gap-2">
                  <Palmtree className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="text-sm text-violet-700 font-medium">Rest day — worked overtime this day.</span>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-2">
                  <span className="text-sm text-slate-500 font-medium">Rest day — not scheduled to work.</span>
                </div>
              )}
            </div>
          )}

          {/* Approved / revocation-pending leave section */}
          {leaveRequest && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                {leaveRequest.status === 'revocation_requested' ? 'Leave (Revocation Pending)' : 'Approved Leave'}
              </p>
              {(() => {
                const isRevoc = leaveRequest.status === 'revocation_requested';
                const leaveCfg = ABSENCE_REASONS.find(r => r.value === leaveRequest.leave_type) ?? ABSENCE_REASONS.find(r => r.value === "Other")!;
                const LeaveIcon = leaveCfg.icon;
                const startLabel = new Date((leaveRequest.start_date ?? leaveRequest.date) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                const endLabel = leaveRequest.end_date && leaveRequest.end_date !== (leaveRequest.start_date ?? leaveRequest.date)
                  ? new Date(leaveRequest.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : null;
                return (
                  <div className={`rounded-xl border ${isRevoc ? "border-violet-200 bg-violet-50" : `${leaveCfg.border} ${leaveCfg.bg}`} p-3.5 space-y-2`}>
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg bg-white border ${isRevoc ? "border-violet-200" : leaveCfg.border} shrink-0`}>
                        <LeaveIcon className={`h-3.5 w-3.5 ${isRevoc ? "text-violet-600" : leaveCfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">{leaveRequest.leave_type}</p>
                        <p className="text-xs text-muted-foreground">{startLabel}{endLabel ? ` – ${endLabel}` : ""}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${isRevoc ? "bg-violet-100 text-violet-700 border-violet-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
                        {isRevoc ? "Revoc. Req." : "Excused"}
                      </span>
                    </div>
                    {isRevoc && leaveRequest.revocation_reason && (
                      <p className="text-xs text-violet-700 italic px-1">Reason: &ldquo;{leaveRequest.revocation_reason}&rdquo;</p>
                    )}
                    {!isRevoc && leaveRequest.reviewer_name && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium pt-1 border-t border-emerald-200/60">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Approved by {leaveRequest.reviewer_name}
                        {leaveRequest.reviewed_at ? ` · ${new Date(leaveRequest.reviewed_at.split("T")[0] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                      </div>
                    )}
                    {isRevoc && (
                      <div className="pt-1 border-t border-violet-200/60">
                        <p className="text-xs text-violet-600 mb-2">HR is reviewing your revocation request. Cancel to keep the leave approved.</p>
                        <CancelRevocationButton requestId={leaveRequest.request_id} onSuccess={() => { onLeaveChanged?.(); onClose(); }} />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* â"€â"€ Attendance record section â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
          {!isFuture && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Your Record</p>
              {isAutoAbsent ? (
                <div className="flex flex-col items-center py-4 gap-2">
                  <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">You did not clock in this day.</p>
                  <p className="text-xs text-muted-foreground text-center">No clock-in or absence report was recorded.</p>
                </div>
              ) : !entry || (!entry.time_in && !entry.absence) ? (
                <div className="flex flex-col items-center py-4 gap-2">
                  <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No record</p>
                  <p className="text-xs text-muted-foreground text-center">No attendance recorded for this day.</p>
                </div>
              ) : (status === "excused" || status === "absent") && entry.absence ? (
                /* â"€â"€ Absence / Excused â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Review Status
                    </p>
                    <Badge className={`text-[10px] font-bold border ${absenceMeta.badgeClass}`}>
                      {absenceMeta.label}
                    </Badge>
                  </div>
                  <div className={`flex items-center gap-3 p-3 rounded-xl border ${absenceReasonCfg ? `${absenceReasonCfg.bg} ${absenceReasonCfg.border}` : "bg-purple-50 border-purple-200"}`}>
                    {absenceReasonCfg && (
                      <div className="p-2 rounded-lg bg-white/60">
                        <absenceReasonCfg.icon className={`h-4 w-4 ${absenceReasonCfg.color}`} />
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Absence Reason</p>
                      <p className="text-sm font-bold text-foreground">{entry.absence.absence_reason}</p>
                    </div>
                  </div>
                  {entry.absence.absence_notes && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                      <p className="text-sm text-foreground leading-relaxed">{entry.absence.absence_notes}</p>
                    </div>
                  )}
                  {(entry.absence.review_reason || entry.absence.reviewed_by_name) && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      {entry.absence.reviewed_by_name && (
                        <div className="flex items-center gap-1.5">
                          <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            Reviewed by <span className="font-semibold text-foreground">{entry.absence.reviewed_by_name}</span>
                          </p>
                        </div>
                      )}
                      {entry.absence.review_reason && (
                        <>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">HR Note</p>
                          <p className="text-sm text-foreground leading-relaxed">{entry.absence.review_reason}</p>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Timer className="h-3.5 w-3.5" />
                    <span>Reported at {formatCellTime(entry.absence.timestamp)}</span>
                  </div>
                </div>
              ) : (
                /* â"€â"€ Punched In â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
                <div className="space-y-3">
                  {/* Time In */}
                  {entry.time_in && (
                    <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <LogIn className="h-4 w-4 text-green-600" />
                        <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Clock In</p>
                        {cfg && <Badge className={`text-[9px] font-bold border ml-auto ${cfg.badge}`}>{cfg.label}</Badge>}
                      </div>
                      <p className="text-xl font-bold text-foreground tabular-nums">{formatCellTime(entry.time_in.timestamp)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {formatCoordinates(
                          entry.time_in.latitude,
                          entry.time_in.longitude,
                          entry.time_in.location_name,
                          locationDisplayMode,
                        )}
                      </p>
                    </div>
                  )}

                  {/* Time Out */}
                  {entry.time_out ? (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                      <div className="flex items-center gap-2 mb-2">
                        <LogOut className="h-4 w-4 text-red-500" />
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Clock Out</p>
                      </div>
                      <p className="text-xl font-bold text-foreground tabular-nums">{formatCellTime(entry.time_out.timestamp)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {formatCoordinates(
                          entry.time_out.latitude,
                          entry.time_out.longitude,
                          entry.time_out.location_name,
                          locationDisplayMode,
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      <p className="text-sm font-semibold text-blue-700">Shift still in progress</p>
                    </div>
                  )}

                  {/* Hours worked */}
                  {entry.time_in && entry.time_out && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-muted-foreground">Total Hours Worked</p>
                      <p className="text-sm font-bold">{formatHoursFromTimestamps(entry.time_in.timestamp, entry.time_out.timestamp)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* â"€â"€ Future workday placeholder â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
          {isFuture && isWorkday && (
            <div className="flex flex-col items-center py-4 gap-2 text-center">
              <CalendarDays className="h-8 w-8 text-blue-300" />
              <p className="text-sm text-muted-foreground">Upcoming workday — no record yet.</p>
            </div>
          )}

          {/* â"€â"€ Future day off placeholder â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
          {isFuture && !isWorkday && (
            <div className="flex flex-col items-center py-4 gap-2 text-center">
              <span className="text-2xl">ðŸŒ™</span>
              <p className="text-sm text-muted-foreground">Rest day — enjoy your time off.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// â"€â"€â"€ Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export default function EmployeeTimekeepingPage() {
  const router = useRouter();

  const [now, setNow]                       = useState(new Date());
  const [status, setStatus]                 = useState<MyStatus | null>(null);
  const [timesheet, setTimesheet]           = useState<TimesheetEntry[]>([]);
  const [statusLoading, setStatusLoading]   = useState(true);
  const [sheetLoading, setSheetLoading]     = useState(true);
  const [fetchError, setFetchError]         = useState(false);
  const [actionLoading, setActionLoading]   = useState(false);
  const [actionError, setActionError]       = useState<string | null>(null);
  const [location, setLocation]             = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError]   = useState<string | null>(null);
  const [locationDisplayMode, setLocationDisplayMode] = useState<LocationDisplayMode>("place");

  // Modal state
  const [modal, setModal] = useState<null | "time-in" | "time-out" | "rest-day-ot">(null);
  const [approvedOtHours, setApprovedOtHours] = useState(0);
  const [todayRestDayOtApproved, setTodayRestDayOtApproved] = useState(false);
  const [myLeaves, setMyLeaves] = useState<LeaveRequestItem[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceCategory[]>([]);

  // My schedule
  const [mySchedule, setMySchedule] = useState<{
    workdays: string | string[] | null;
    start_time: string | null;
    end_time: string | null;
    break_start?: string | null;
    break_end?: string | null;
    is_nightshift: boolean | null;
  } | null>(null);

  // Calendar / Schedule views
  const [view, setView]           = useState<"calendar" | "list" | "schedule">("calendar");
  const [calMonth, setCalMonth]   = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [page, setPage]           = useState(1);
  const [calDayModal, setCalDayModal] = useState<{ dateStr: string; entry: TimesheetEntry | null; leaveRequest?: LeaveRequestItem | null } | null>(null);
  const [calPickerOpen, setCalPickerOpen] = useState(false);
  const [calPickerYear, setCalPickerYear] = useState(() => new Date().getFullYear());

  // Schedule calendar state
  const [schedMode, setSchedMode]     = useState<"month" | "week" | "day">("week");
  const [schedRefDate, setSchedRefDate] = useState(() => new Date());
  const [schedPickerOpen, setSchedPickerOpen] = useState(false);
  const [schedPickerYear, setSchedPickerYear] = useState(() => new Date().getFullYear());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setLocationError("Location access denied. Please allow location to clock in or out.")
    );
  }, []);

  // Fetch status + timesheet
  useEffect(() => {
    authFetch(`${API_BASE_URL}/timekeeping/my-status`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<MyStatus>; })
      .then(setStatus)
      .catch(() => setFetchError(true))
      .finally(() => setStatusLoading(false));

    authFetch(`${API_BASE_URL}/timekeeping/my-timesheet`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<TimesheetEntry[]>; })
      .then(entries => {
        setTimesheet(entries);
        for (const entry of entries) {
          const abs = entry.absence_request ?? entry.absence;
          if (!abs?.log_id) continue;
          const state = String(abs.log_status ?? "").toUpperCase();
          if (state !== "APPROVED" && state !== "DENIED") continue;
          const key = `seen_absence_review_${abs.log_id}`;
          if (localStorage.getItem(key)) continue;
          localStorage.setItem(key, "1");
          const reviewerLabel = abs.reviewed_by_name ? ` by ${abs.reviewed_by_name}` : "";
          const absDate = new Date(abs.timestamp + (abs.timestamp.includes("T") ? "" : "T12:00:00"))
            .toLocaleDateString("en-US", { month: "short", day: "numeric" });
          if (state === "APPROVED") {
            import("sonner").then(({ toast }) =>
              toast.success(`Absence approved${reviewerLabel}`, {
                description: `Your ${abs.absence_reason ?? "absence"} on ${absDate} was approved.`,
                duration: 8000,
              })
            );
          } else {
            import("sonner").then(({ toast }) =>
              toast.error(`Absence denied${reviewerLabel}`, {
                description: `Your ${abs.absence_reason ?? "absence"} on ${absDate} was denied.`,
                duration: 8000,
              })
            );
          }
        }
      })
      .catch(() => setFetchError(true))
      .finally(() => setSheetLoading(false));

    // My schedule
    authFetch(`${API_BASE_URL}/timekeeping/my-schedule`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setMySchedule(data); })
      .catch(() => {});

    // Approved OT hours for current month + check for today's approved REST_DAY OT
    getMyOvertimeSummary()
      .then(s => setApprovedOtHours((s as any).approved_planned_hours ?? (s as any).approved_ot_hours ?? 0))
      .catch(() => {});

    getMyOvertimeRequests()
      .then(reqs => {
        const todayStr = todayPST();
        setTodayRestDayOtApproved(
          reqs.some(r => r.ot_date === todayStr && r.ot_type === 'REST_DAY' && r.log_status === 'APPROVED'),
        );
      })
      .catch(() => {});

    // Approved + revocation-pending leave requests for calendar overlay
    getMyLeaveRequests()
      .then(data => setMyLeaves(data.filter(r => r.status === 'approved' || r.status === 'revocation_requested')))
      .catch(() => {});

    // Leave balances
    getMyNewLeaveBalances()
      .then(data => setLeaveBalances(data.categories ?? []))
      .catch(() => {});
  }, []);

  async function refreshData() {
    const [s, t] = await Promise.all([
      authFetch(`${API_BASE_URL}/timekeeping/my-status`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/timekeeping/my-timesheet`).then(r => r.json()),
    ]);
    setStatus(s);
    setTimesheet(t);
  }

  async function handleConfirmPunch(type: "time-in" | "time-out", signOut = false) {
    if (!location) {
      setActionError(locationError || "Location not available. Please allow location access.");
      setModal(null);
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await executePunch(type, location);
      setModal(null);
      if (signOut) {
        await logoutApi();
        router.push("/login");
        return;
      }
      await refreshData();
    } catch (err: unknown) {
      setActionError((err as { message?: string })?.message || "Something went wrong.");
      setModal(null);
    } finally {
      setActionLoading(false);
    }
  }


  // Derived — absence + no-schedule both block time-in/out
  const hasReportedAbsence = status?.current_status === "absence";
  const scheduleLoaded     = mySchedule !== null;           // null means "no schedule assigned"
  const hasSchedule        = scheduleLoaded && !!mySchedule?.workdays;
  const canTimeIn  = !status?.time_in && !hasReportedAbsence && hasSchedule;
  const canTimeOut = status?.current_status === "time-in" && hasSchedule;
  const shiftDone  = !!(status?.time_in && status?.time_out);
  const todayAbsence = timesheet.find(e => e.date === todayPST())?.absence ?? null;
  const todayAbsenceRequest = timesheet.find(e => e.date === todayPST())?.absence_request ?? null;

  const dateMap  = useMemo(() => buildDateMap(timesheet), [timesheet]);
  const calGrid  = useMemo(() => buildCalendarGrid(calMonth.year, calMonth.month), [calMonth]);
  const calTitle = new Date(calMonth.year, calMonth.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today    = todayPST();

  // Normalized workday codes for the schedule view
  const workdaySet = useMemo<Set<string>>(() => {
    const raw = mySchedule?.workdays;
    if (!raw) return new Set();
    const arr = Array.isArray(raw) ? raw : String(raw).split(",");
    return new Set(arr.map(d => d.trim().toUpperCase()));
  }, [mySchedule]);

  const isShiftInProgress = Boolean(status?.time_in && !status?.time_out);
  const todayAbsenceMeta = getAbsenceReviewMeta((todayAbsenceRequest ?? todayAbsence)?.log_status);
  const shiftElapsed = status?.time_in ? calcDuration(status.time_in.timestamp, now) : null;

  // True when employee has a schedule but today is not a scheduled workday
  const todayDayCode = SCHED_DAY_CODE[new Date(`${today}T00:00:00`).getDay()];
  const isRestDay = hasSchedule && !workdaySet.has(todayDayCode) && !statusLoading;

  const lateClockInWarning = useMemo(() => {
    if (!mySchedule?.start_time) return null;
    if (!hasSchedule || hasReportedAbsence || status?.time_in || !canTimeIn) return null;
    const todayCode = SCHED_DAY_CODE[new Date(`${today}T00:00:00`).getDay()];
    if (!workdaySet.has(todayCode)) return null;

    const startMins = parseClockToMinutes(mySchedule.start_time);
    if (startMins == null) return null;

    const currentClock = now.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    });
    const [curH, curM] = currentClock.split(":");
    const currentMins = Number.parseInt(curH, 10) * 60 + Number.parseInt(curM, 10);
    const lateMinutes = currentMins - startMins;
    if (lateMinutes <= 0) return null;

    const lateHours = Math.floor(lateMinutes / 60);
    const lateMinsOnly = lateMinutes % 60;
    const lateText =
      lateHours > 0 ? `${lateHours}h ${lateMinsOnly}m` : `${lateMinsOnly}m`;

    return {
      startLabel: formatSchedTime(mySchedule.start_time),
      nowLabel: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      }),
      lateText,
    };
  }, [canTimeIn, hasReportedAbsence, hasSchedule, mySchedule, now, status?.time_in, today, workdaySet]);

  const monthlySummary = useMemo(() => {
    const year = calMonth.year;
    const month = calMonth.month + 1;
    const yearStr = String(year);
    const monthStr = String(month).padStart(2, "0");
    const currentMonthKey = today.slice(0, 7);
    const summaryMonthKey = `${yearStr}-${monthStr}`;
    const currentDay = summaryMonthKey === currentMonthKey
      ? Number.parseInt(today.slice(8, 10), 10)
      : summaryMonthKey < currentMonthKey
        ? new Date(year, month, 0).getDate()
        : 0;

    const scheduledHoursPerDay = computeScheduledHoursPerDay(mySchedule);
    const daysInMonth = new Date(year, month, 0).getDate();

    let scheduledDaysInMonth = 0;
    let remainingWorkdays = 0;
    if (scheduledHoursPerDay > 0 && workdaySet.size > 0) {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
        const code = SCHED_DAY_CODE[new Date(`${dateStr}T00:00:00`).getDay()];
        if (!workdaySet.has(code)) continue;
        scheduledDaysInMonth += 1;
        if (day > currentDay) remainingWorkdays += 1;
      }
    }

    const expectedHours = scheduledDaysInMonth * scheduledHoursPerDay;
    let daysPresent = 0;
    let daysLate = 0;
    let daysAbsent = 0;
    let workedHours = 0;
    let restDayOtDays = 0;
    let restDayOtHours = 0;

    for (const entry of timesheet) {
      if (!entry.date.startsWith(`${yearStr}-${monthStr}-`)) continue;
      const entryDayCode = SCHED_DAY_CODE[new Date(`${entry.date}T00:00:00`).getDay()];
      const isEntryWorkday = workdaySet.has(entryDayCode);

      // Rest day overtime — count separately, not in attendance stats
      if (!isEntryWorkday && entry.time_in) {
        restDayOtDays += 1;
        if (entry.time_out) {
          const diff = parseTs(entry.time_out.timestamp).getTime() - parseTs(entry.time_in.timestamp).getTime();
          if (diff > 0) restDayOtHours += diff / 3_600_000;
        }
        if (entry.time_in && entry.time_out) {
          const diff = parseTs(entry.time_out.timestamp).getTime() - parseTs(entry.time_in.timestamp).getTime();
          if (diff > 0) workedHours += diff / 3_600_000;
        }
        continue;
      }

      const status = getEntryStatus(entry, mySchedule);
      if (status === "late") {
        daysLate += 1;
        daysPresent += 1;
      } else if (status === "on-time" || status === "in-progress") {
        daysPresent += 1;
      } else if (status === "absent") {
        daysAbsent += 1;
      }

      if (entry.time_in && entry.time_out) {
        const diff = parseTs(entry.time_out.timestamp).getTime() - parseTs(entry.time_in.timestamp).getTime();
        if (diff > 0) workedHours += diff / 3_600_000;
      }
    }

    workedHours = Math.round(workedHours * 100) / 100;
    const remainingHours = Math.max(expectedHours - workedHours, 0);
    const progress = expectedHours > 0 ? Math.min((workedHours / expectedHours) * 100, 100) : 0;
    const totalCountedDays = daysPresent + daysAbsent;
    const attendanceRate = totalCountedDays > 0 ? (daysPresent / totalCountedDays) * 100 : 0;

    return {
      attendanceRate,
      daysPresent,
      daysLate,
      daysAbsent,
      expectedHours,
      workedHours,
      remainingHours,
      remainingWorkdays,
      progress,
      restDayOtDays,
      restDayOtHours: Math.round(restDayOtHours * 100) / 100,
    };
  }, [calMonth.month, calMonth.year, mySchedule, timesheet, today, workdaySet]);

  // Map each date in approved leave ranges to the LeaveRequestItem
  const leaveMap = useMemo(() => {
    const map = new Map<string, LeaveRequestItem>();
    for (const leave of myLeaves) {
      const start = leave.start_date ?? leave.date;
      const end = leave.end_date ?? start;
      const d = new Date(start + "T00:00:00");
      const e = new Date(end + "T00:00:00");
      while (d <= e) {
        map.set(d.toISOString().split("T")[0], leave);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [myLeaves]);

  const monthSummaryLabel = useMemo(
    () =>
      new Date(calMonth.year, calMonth.month, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [calMonth.month, calMonth.year],
  );


  function prevMonth() {
    setCalMonth(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 });
  }
  function nextMonth() {
    const n = new Date();
    if (calMonth.year === n.getFullYear() && calMonth.month === n.getMonth()) return;
    setCalMonth(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 });
  }

  const totalPages = Math.ceil(timesheet.length / ITEMS_PER_PAGE);
  const paged      = timesheet.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const isCurrentMonth = (() => {
    const n = new Date();
    return calMonth.year === n.getFullYear() && calMonth.month === n.getMonth();
  })();

  // â"€â"€ Calendar view â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const calendarView = (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { prevMonth(); setCalPickerOpen(false); }}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {/* Clickable month/year — opens inline picker */}
        <button
          onClick={() => { setCalPickerOpen(v => !v); setCalPickerYear(calMonth.year); }}
          className={[
            "font-bold text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
            calPickerOpen ? "bg-primary text-primary-foreground" : "hover:bg-primary/10 hover:text-primary",
          ].join(" ")}
          title="Click to jump to a month/year"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {calTitle}
          {calPickerOpen
            ? <ChevronUp className={`h-3 w-3 ${calPickerOpen ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
            : <ChevronDown className={`h-3 w-3 text-muted-foreground`} />
          }
        </button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { nextMonth(); setCalPickerOpen(false); }} disabled={isCurrentMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Inline month/year picker */}
      {calPickerOpen && (
        <div className="rounded-2xl border border-border bg-muted/10 p-4 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setCalPickerYear(y => y - 1)}
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-bold text-sm text-foreground">{calPickerYear}</span>
            <button
              onClick={() => setCalPickerYear(y => y + 1)}
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => {
              const isSelected = calPickerYear === calMonth.year && i === calMonth.month;
              const isFutureMonth = calPickerYear > new Date().getFullYear() ||
                (calPickerYear === new Date().getFullYear() && i > new Date().getMonth());
              return (
                <button
                  key={m}
                  disabled={isFutureMonth}
                  onClick={() => { setCalMonth({ year: calPickerYear, month: i }); setCalPickerOpen(false); }}
                  className={[
                    "rounded-xl py-2 text-sm font-semibold transition-all duration-150 cursor-pointer",
                    isSelected ? "bg-primary text-primary-foreground shadow-sm" :
                    isFutureMonth ? "text-muted-foreground opacity-40 cursor-not-allowed" :
                    "text-foreground hover:bg-primary/10 hover:text-primary",
                  ].join(" ")}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {calGrid.map((day, idx) => {
          if (!day) return <div key={`empty-${calMonth.year}-${calMonth.month}-${idx}`} />;

          const dateStr     = toDateStr(calMonth.year, calMonth.month, day);
          const entry       = dateMap[dateStr];
          const isToday     = dateStr === today;
          const isFuture    = dateStr > today;

          // Is this day a scheduled workday?
          const dayCode    = SCHED_DAY_CODE[new Date(dateStr + "T00:00:00").getDay()];
          const isDayWork  = workdaySet.has(dayCode);

          const rawEntryStatus = entry ? getEntryStatus(entry, mySchedule) : null;
          // Override: non-workday with clock-in = rest day OT
          const entryStatus: EntryStatus | null = (!isDayWork && !isFuture && entry?.time_in)
            ? "rest-day-ot"
            : rawEntryStatus;
          const cfg         = entryStatus ? ENTRY_STATUS_CONFIG[entryStatus] : null;
          const entryAbsenceMeta = getAbsenceReviewMeta(entry?.absence?.log_status);
          const isAbsent    = entryStatus === "absent" || entryStatus === "excused";
          const isRestDayOtCell = entryStatus === "rest-day-ot";
          const dayLeave = leaveMap.get(dateStr);

          const isRevocPending = dayLeave?.status === 'revocation_requested';
          let cellClass = "bg-background border-border hover:border-primary/30";
          if (dayLeave && !cfg && isRevocPending)  cellClass = "bg-violet-50 border-violet-200 hover:border-violet-400";
          else if (dayLeave && !cfg)               cellClass = "bg-emerald-50 border-emerald-200 hover:border-emerald-400";
          else if (isToday && cfg)        cellClass = `${cfg.cell} border-primary shadow-md ring-2 ring-primary/20`;
          else if (isToday)               cellClass = "bg-primary/10 border-primary shadow-md";
          else if (cfg)                   cellClass = `${cfg.cell} border hover:opacity-90`;
          else if (isFuture && isDayWork)  cellClass = "bg-blue-50/60 border-blue-200/70 opacity-70 hover:opacity-100";
          else if (isFuture)              cellClass = "bg-background border-border opacity-35 hover:opacity-60";
          else if (isDayWork)             cellClass = "bg-blue-50/40 border-blue-100 hover:border-blue-300";
          else if (!isDayWork && !isFuture) cellClass = "bg-slate-50/60 border-slate-200/60 hover:border-slate-300";

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => setCalDayModal({ dateStr, entry: entry ?? null, leaveRequest: leaveMap.get(dateStr) ?? null })}
              className={`relative rounded-xl border p-2 min-h-[5.5rem] flex flex-col transition-all text-left w-full cursor-pointer ${cellClass}`}
            >
              <div className={`text-sm font-bold mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>{day}</div>

              {/* Leave indicator */}
              {dayLeave && (
                <div className="flex-1 mt-0.5 space-y-0.5">
                  {isRevocPending ? (
                    <span className="inline-flex items-center px-1 py-0.5 rounded-md text-[7px] font-bold bg-violet-100 text-violet-700 border border-violet-200 leading-tight">
                      Revoc. Req.
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1 py-0.5 rounded-md text-[7px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 leading-tight">
                      On Leave
                    </span>
                  )}
                  <p className={`text-[7px] font-semibold truncate leading-tight px-0.5 ${isRevocPending ? "text-violet-700" : "text-emerald-700"}`}>
                    {dayLeave.leave_type}
                  </p>
                </div>
              )}

              {/* Workday indicator (for days without attendance record) */}
              {isDayWork && !cfg && !isToday && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-[8px] font-semibold text-blue-600 leading-tight">Work</span>
                </div>
              )}

              {/* Rest day indicator (non-workday, not future, no clock-in) */}
              {!isDayWork && !isFuture && !isRestDayOtCell && !cfg && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isToday ? "bg-primary/40" : "bg-slate-300"}`} />
                  <span className={`text-[8px] font-semibold leading-tight ${isToday ? "text-primary/70" : "text-slate-400"}`}>Rest</span>
                </div>
              )}

              {/* Rest Day OT badge */}
              {isRestDayOtCell && (
                <div className="mt-0.5">
                  <span className="inline-flex items-center px-1 py-0.5 rounded-md text-[7px] font-bold bg-violet-100 text-violet-700 border border-violet-200 leading-tight">
                    Rest OT
                  </span>
                </div>
              )}

              {/* Absence indicator */}
              {!isFuture && isAbsent && entry?.absence && (
                <div className="flex-1 mt-0.5 space-y-0.5">
                  <div
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold border ${entryAbsenceMeta.badgeClass}`}
                  >
                    <FileX className="h-2.5 w-2.5 shrink-0" />
                    {entryAbsenceMeta.shortLabel}
                  </div>
                  {entry.absence.absence_reason && (
                    <p className="text-[8px] font-semibold text-muted-foreground truncate leading-tight px-0.5">
                      {entry.absence.absence_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Punch times */}
              {!isFuture && entry?.time_in && (
                <div className="flex-1 space-y-0.5 text-[8px] leading-tight">
                  <div className="flex items-center gap-0.5 font-semibold text-foreground">
                    <LogIn className="h-2.5 w-2.5 shrink-0 text-green-600" />
                    {formatCellTime(entry.time_in.timestamp)}
                  </div>
                  {entry.time_out && (
                    <div className="flex items-center gap-0.5 font-semibold text-foreground">
                      <LogOut className="h-2.5 w-2.5 shrink-0 text-red-500" />
                      {formatCellTime(entry.time_out.timestamp)}
                    </div>
                  )}
                </div>
              )}

              {/* Status dot */}
              {cfg && (
                <div className="mt-auto pt-1">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-5 flex-wrap">
        {workdaySet.size > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            <span className="text-[10px] text-muted-foreground font-medium">Workday</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="text-[10px] text-muted-foreground font-medium">Rest Day</span>
        </div>
        {Object.entries(ENTRY_STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            <span className="text-[10px] text-muted-foreground font-medium">{cfg.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">Tap any date to see schedule &amp; attendance details</p>
    </div>
  );

  // â"€â"€ Schedule view â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const schedTitle = schedRefDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const schedWeekDates = buildWeekDates(schedRefDate);
  const schedWeekLabel = (() => {
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(schedWeekDates[0])} - ${fmt(schedWeekDates[6])}, ${schedWeekDates[6].getFullYear()}`;
  })();

  const schedMonthGrid = buildCalendarGrid(schedRefDate.getFullYear(), schedRefDate.getMonth());

  const noSchedule = !mySchedule || !mySchedule.workdays;

  // Day-mode helpers
  const schedDayCode   = SCHED_DAY_CODE[schedRefDate.getDay()];
  const isDayWorkday   = workdaySet.has(schedDayCode);
  const isDayToday     = schedRefDate.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) === today;
  const schedDayLabel  = schedRefDate.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  const scheduleView = (
    <div className="p-6">
      {noSchedule ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <CalendarRange className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-muted-foreground">No schedule assigned</p>
          <p className="text-xs text-muted-foreground/70">Contact your HR officer to get a work schedule.</p>
        </div>
      ) : (<>

        {/* â"€â"€ Controls â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          {/* Day / Week / Month mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg border border-border w-fit">
            {([
              { m: "day"   as const, icon: Sun,            label: "Day"   },
              { m: "week"  as const, icon: CalendarRange,  label: "Week"  },
              { m: "month" as const, icon: CalendarDays,   label: "Month" },
            ]).map(({ m, icon: Icon, label }) => (
              <button
                key={m}
                onClick={() => { setSchedMode(m); setSchedPickerOpen(false); }}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                  schedMode === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSchedPickerOpen(false);
                setSchedRefDate(d => {
                  const n = new Date(d);
                  if (schedMode === "month") n.setMonth(n.getMonth() - 1);
                  else if (schedMode === "week") n.setDate(n.getDate() - 7);
                  else n.setDate(n.getDate() - 1);
                  return n;
                });
              }}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted/60 transition-colors cursor-pointer text-muted-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {schedMode === "month" ? (
              <button
                onClick={() => { setSchedPickerOpen(v => !v); setSchedPickerYear(schedRefDate.getFullYear()); }}
                className={[
                  "h-7 px-3 flex items-center gap-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
                  schedPickerOpen ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/60 text-foreground",
                ].join(" ")}
              >
                {schedTitle}
                {schedPickerOpen
                  ? <ChevronUp className={`h-3 w-3 text-primary-foreground/70`} />
                  : <ChevronDown className={`h-3 w-3 text-muted-foreground`} />
                }
              </button>
            ) : schedMode === "week" ? (
              <div className="h-7 px-3 flex items-center rounded-lg border border-border text-xs font-semibold text-foreground bg-background min-w-48 justify-center">
                {schedWeekLabel}
              </div>
            ) : (
              <div className="h-7 px-3 flex items-center gap-1.5 rounded-lg border border-border text-xs font-semibold text-foreground bg-background min-w-40 justify-center">
                {isDayToday && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                {schedDayLabel}
              </div>
            )}

            <button
              onClick={() => {
                setSchedPickerOpen(false);
                setSchedRefDate(d => {
                  const n = new Date(d);
                  if (schedMode === "month") n.setMonth(n.getMonth() + 1);
                  else if (schedMode === "week") n.setDate(n.getDate() + 7);
                  else n.setDate(n.getDate() + 1);
                  return n;
                });
              }}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted/60 transition-colors cursor-pointer text-muted-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* â"€â"€ Inline month/year picker â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        {schedPickerOpen && schedMode === "month" && (
          <div className="rounded-2xl border border-border bg-muted/10 p-4 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setSchedPickerYear(y => y - 1)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-bold text-sm text-foreground">{schedPickerYear}</span>
              <button onClick={() => setSchedPickerYear(y => y + 1)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => {
                const isSelected = schedPickerYear === schedRefDate.getFullYear() && i === schedRefDate.getMonth();
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setSchedRefDate(new Date(schedPickerYear, i, 1));
                      setSchedPickerOpen(false);
                    }}
                    className={[
                      "rounded-xl py-2 text-sm font-semibold transition-all duration-150 cursor-pointer",
                      isSelected ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-primary/10 hover:text-primary",
                    ].join(" ")}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* â"€â"€ Month grid â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        {!schedPickerOpen && schedMode === "month" && (
          <div>
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {schedMonthGrid.map((day, idx) => {
                if (!day) return <div key={`b-${idx}`} className="min-h-[4.5rem]" />;
                const cellDate = new Date(schedRefDate.getFullYear(), schedRefDate.getMonth(), day);
                const code     = SCHED_DAY_CODE[cellDate.getDay()];
                const isWork   = workdaySet.has(code);
                const dateStr  = toDateStr(schedRefDate.getFullYear(), schedRefDate.getMonth(), day);
                const isToday  = dateStr === today;
                return (
                  <div
                    key={dateStr}
                    className={[
                      "relative rounded-xl border p-1.5 min-h-[4.5rem] flex flex-col transition-all",
                      isWork
                        ? "bg-blue-50 border-blue-200 text-blue-900"
                        : "bg-slate-50 border-slate-200 text-slate-400",
                      isToday ? "ring-2 ring-primary ring-offset-1" : "",
                    ].join(" ")}
                  >
                    <span className={`text-xs font-bold leading-none ${isToday ? "text-primary" : ""}`}>{day}</span>
                    {isWork ? (
                      <>
                        <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                          On Duty
                        </span>
                        <span className="mt-0.5 text-[9px] font-medium text-blue-700 leading-tight">
                          {formatSchedTime(mySchedule.start_time)}
                        </span>
                        <span className="text-[9px] font-medium text-blue-700 leading-tight">
                          {formatSchedTime(mySchedule.end_time)}
                        </span>
                      </>
                    ) : (
                      <span className="mt-1 text-[9px] font-semibold text-slate-400">Day Off</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-4 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-[10px] text-muted-foreground font-medium">Workday</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="text-[10px] text-muted-foreground font-medium">Day Off</span>
              </div>
            </div>
          </div>
        )}

        {/* â"€â"€ Week grid â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        {schedMode === "week" && (
          <div className="grid grid-cols-7 gap-2">
            {schedWeekDates.map((d, i) => {
              const code    = SCHED_DAY_CODE[d.getDay()];
              const isWork  = workdaySet.has(code);
              const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
              const isToday = dateStr === today;
              return (
                <div
                  key={dateStr}
                  className={[
                    "flex flex-col items-center rounded-2xl border p-3 min-h-[9rem] transition-all",
                    isWork
                      ? "bg-blue-50 border-blue-200"
                      : dateMap[dateStr]?.time_in
                        ? "bg-violet-50/70 border-violet-200"
                        : "bg-slate-50 border-slate-200",
                    isToday ? "ring-2 ring-primary ring-offset-1" : "",
                  ].join(" ")}
                >
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {WEEKDAYS[i]}
                  </span>
                  <span className={`text-xl font-bold leading-tight mt-0.5 ${isToday ? "text-primary" : isWork ? "text-blue-900" : dateMap[dateStr]?.time_in ? "text-violet-800" : "text-slate-400"}`}>
                    {d.getDate()}
                  </span>

                  {isWork ? (
                    <>
                      <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold border border-blue-200">
                        On Duty
                      </span>
                      <span className="mt-2 text-[10px] font-semibold text-blue-800 leading-snug text-center">
                        {formatSchedTime(mySchedule.start_time)}
                      </span>
                      <span className="text-[10px] text-blue-700 leading-snug">-</span>
                      <span className="text-[10px] font-semibold text-blue-800 leading-snug text-center">
                        {formatSchedTime(mySchedule.end_time)}
                      </span>
                      {(mySchedule.break_start || mySchedule.break_end) && (
                        <span className="mt-1.5 text-[9px] text-blue-600 text-center leading-tight">
                          Break {formatSchedTime(mySchedule.break_start)} - {formatSchedTime(mySchedule.break_end)}
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 w-full mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold border border-slate-200">
                        Rest Day
                      </span>
                      {dateMap[dateStr]?.time_in && (
                        <div className="flex flex-col items-center gap-0.5 mt-1">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[8px] font-bold border border-violet-200">
                            Rest OT
                          </span>
                          <span className="text-[9px] font-semibold text-violet-700 tabular-nums leading-tight">
                            {formatCellTime(dateMap[dateStr].time_in!.timestamp)}
                          </span>
                          {dateMap[dateStr]?.time_out && (
                            <span className="text-[9px] text-violet-600 tabular-nums leading-tight">
                              {formatCellTime(dateMap[dateStr].time_out!.timestamp)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* â"€â"€ Day view â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        {schedMode === "day" && (
          <div className="space-y-3">
            {/* Big day card */}
            <div className={[
              "relative rounded-2xl border p-6 flex flex-col items-center justify-center gap-2 min-h-[14rem] transition-all",
              isDayWorkday ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200",
              isDayToday ? "ring-2 ring-primary ring-offset-2" : "",
            ].join(" ")}>
              {isDayToday && (
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tracking-wider uppercase">
                  Today
                </span>
              )}

              {/* Weekday label */}
              <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${isDayWorkday ? "text-blue-500" : "text-slate-400"}`}>
                {schedRefDate.toLocaleDateString("en-US", { weekday: "long" })}
              </span>

              {/* Large date */}
              <span className={`text-7xl font-black tabular-nums leading-none ${isDayToday ? "text-primary" : isDayWorkday ? "text-blue-900" : "text-slate-300"}`}>
                {schedRefDate.getDate()}
              </span>

              {/* Month + Year */}
              <span className="text-sm font-semibold text-muted-foreground -mt-1">
                {schedRefDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>

              {/* Status pill */}
              <div className="mt-1">
                {isDayWorkday ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" /> On Duty
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold border border-slate-200">
                    Rest Day
                  </span>
                )}
              </div>
            </div>

            {/* Shift detail cards — only for workdays */}
            {isDayWorkday && mySchedule && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Shift Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <LogIn className="h-3.5 w-3.5 text-green-600" />
                      <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Start Time</p>
                    </div>
                    <p className="text-2xl font-black text-foreground tabular-nums leading-none">{formatSchedTime(mySchedule.start_time)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <LogOut className="h-3.5 w-3.5 text-red-500" />
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">End Time</p>
                    </div>
                    <p className="text-2xl font-black text-foreground tabular-nums leading-none">{formatSchedTime(mySchedule.end_time)}</p>
                  </div>
                </div>
                {(mySchedule.break_start || mySchedule.break_end) && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
                    <Timer className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Break Window</p>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {formatSchedTime(mySchedule.break_start)} — {formatSchedTime(mySchedule.break_end)}
                      </p>
                    </div>
                  </div>
                )}
                {mySchedule.is_nightshift && (
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Night Shift</span>
                  </div>
                )}
              </div>
            )}

            {/* Jump-to-today link */}
            {!isDayToday && (
              <div className="flex justify-center pt-1">
                <button
                  onClick={() => setSchedRefDate(new Date())}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer transition-colors"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Jump to today
                </button>
              </div>
            )}
          </div>
        )}

        {/* â"€â"€ Schedule summary pill â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">Days: </span>
            {Array.from(workdaySet).join(", ") || "—"}
          </span>
          <span>
            <span className="font-semibold text-foreground">Hours: </span>
            {formatSchedTime(mySchedule.start_time)} — {formatSchedTime(mySchedule.end_time)}
          </span>
          {mySchedule.is_nightshift && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold">
              Night Shift
            </span>
          )}
        </div>

      </>)}
    </div>
  );

  // â"€â"€ List view â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const listView = (
    <>
      <div className="divide-y divide-border">
        {timesheet.length === 0 ? (
          <p className="px-6 py-10 text-center text-muted-foreground text-sm">No attendance records found.</p>
        ) : paged.map(entry => {
          const entryStatus = getDisplayStatus(entry, mySchedule, workdaySet);
          const cfg = ENTRY_STATUS_CONFIG[entryStatus];
          const entryAbsenceMeta = getAbsenceReviewMeta(entry.absence?.log_status);
          return (
            <button
              key={entry.date}
              type="button"
              onClick={() => setCalDayModal({ dateStr: entry.date, entry })}
              className="w-full text-left px-6 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className="font-semibold text-sm">{formatEntryDate(entry.date)}</span>
                </div>
                <Badge className={`text-[9px] font-bold border ${cfg.badge}`}>{cfg.label}</Badge>
              </div>
              {entry.time_in && (
                <div className="flex items-center gap-6 mt-2 ml-5 text-xs text-muted-foreground">
                  <span>In: <span className="font-semibold text-foreground">{formatTime(entry.time_in.timestamp)}</span></span>
                  {entry.time_out && <span>Out: <span className="font-semibold text-foreground">{formatTime(entry.time_out.timestamp)}</span></span>}
                  {entry.time_out && <span>Hours: <span className="font-semibold text-foreground">{formatHoursFromTimestamps(entry.time_in.timestamp, entry.time_out.timestamp)}</span></span>}
                </div>
              )}
              {!entry.time_in && entry.absence?.absence_reason && (
                <div className="mt-2 ml-5 space-y-1.5">
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${entryAbsenceMeta.badgeClass}`}>
                    {entryAbsenceMeta.label}
                  </div>
                  <div className="flex items-center gap-2">
                    <FileX className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                    <span className="text-xs text-purple-700 font-medium">{entry.absence.absence_reason}</span>
                    {entry.absence.absence_notes && (
                      <span className="text-xs text-muted-foreground truncate">- {entry.absence.absence_notes}</span>
                    )}
                  </div>
                  {entry.absence.review_reason && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      Review note: {entry.absence.review_reason}
                    </p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 bg-muted/10 border-t border-border flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {timesheet.length > 0
            ? `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}-${Math.min(page * ITEMS_PER_PAGE, timesheet.length)} of ${timesheet.length}`
            : "No records"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setPage(p => p - 1)} disabled={page === 1 || totalPages === 0}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setPage(p => p + 1)} disabled={page === totalPages || totalPages === 0}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* â"€â"€ Calendar Day Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {calDayModal && (
        <CalendarDayModal
          dateStr={calDayModal.dateStr}
          entry={calDayModal.entry}
          onClose={() => setCalDayModal(null)}
          schedule={mySchedule}
          locationDisplayMode={locationDisplayMode}
          leaveRequest={calDayModal.leaveRequest ?? null}
          onLeaveChanged={() => {
            getMyLeaveRequests()
              .then(data => setMyLeaves(data.filter(r => r.status === 'approved' || r.status === 'revocation_requested')))
              .catch(() => {});
          }}
        />
      )}


      {/* â"€â"€ Absence Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}

      {/* â"€â"€ Time In Confirmation â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {modal === "time-in" && (
        <ConfirmModal onClose={() => setModal(null)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-green-100">
                <LogIn className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <h2 className="font-bold text-base">Confirm Clock In</h2>
                <p className="text-xs text-muted-foreground">Your attendance will be recorded</p>
              </div>
            </div>
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Time</span>
                <span className="font-semibold tabular-nums">{formatLiveTime(now)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-xs">
                  {location
                    ? formatGpsLocation(
                        location.latitude,
                        location.longitude,
                        null,
                        locationDisplayMode,
                      )
                    : "Not available"}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 cursor-pointer" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                onClick={() => handleConfirmPunch("time-in")}
                disabled={actionLoading}
              >
                {actionLoading ? "Clocking In..." : "Clock In"}
              </Button>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* â"€â"€ Rest Day OT Confirmation â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {modal === "rest-day-ot" && (
        <ConfirmModal onClose={() => setModal(null)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-violet-100">
                <Palmtree className="h-5 w-5 text-violet-700" />
              </div>
              <div>
                <h2 className="font-bold text-base">Clock In — Rest Day</h2>
                <p className="text-xs text-muted-foreground">Recorded as Rest Day Overtime</p>
              </div>
            </div>
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Today is your scheduled <strong>rest day</strong>. Hours worked will be counted as <strong>Rest Day OT</strong>.</p>
            </div>
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Time</span>
                <span className="font-semibold tabular-nums">{formatLiveTime(now)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Type</span>
                <span className="font-bold text-violet-700 text-xs">Rest Day Overtime</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-xs">
                  {location
                    ? formatGpsLocation(location.latitude, location.longitude, null, locationDisplayMode)
                    : "Not available"}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 cursor-pointer" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer font-bold"
                onClick={() => handleConfirmPunch("time-in")}
                disabled={actionLoading}
              >
                {actionLoading ? "Clocking In..." : "Clock In"}
              </Button>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* â"€â"€ Time Out Confirmation â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {modal === "time-out" && (
        <ConfirmModal onClose={() => setModal(null)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-orange-100">
                <LogOut className="h-5 w-5 text-orange-700" />
              </div>
              <div>
                <h2 className="font-bold text-base">Confirm Clock Out</h2>
                <p className="text-xs text-muted-foreground">Your shift will be closed</p>
              </div>
            </div>
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Time</span>
                <span className="font-semibold tabular-nums">{formatLiveTime(now)}</span>
              </div>
              {status?.time_in && (
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-semibold">{calcDuration(status.time_in.timestamp, now)}</span>
                </div>
              )}
              {status?.ot_session && (
                <>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-muted-foreground">OT Rendered</span>
                    <span className="font-semibold text-amber-700">{fmtMins(status.ot_session.capped_ot_minutes)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-muted-foreground">Approved OT</span>
                    <span className="font-semibold text-green-700">{status.ot_session.approved_hours}h ({status.ot_session.approved_start.substring(0, 5)}–{status.ot_session.approved_end.substring(0, 5)})</span>
                  </div>
                </>
              )}
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-xs">
                  {location
                    ? formatGpsLocation(
                        location.latitude,
                        location.longitude,
                        null,
                        locationDisplayMode,
                      )
                    : "Not available"}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 cursor-pointer" onClick={() => setModal(null)}>Cancel</Button>
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white cursor-pointer"
                  onClick={() => handleConfirmPunch("time-out", false)}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Clocking Out..." : "Clock Out"}
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full text-slate-600 hover:text-red-600 hover:border-red-300 cursor-pointer gap-2"
                onClick={() => handleConfirmPunch("time-out", true)}
                disabled={actionLoading}
              >
                <LogOut className="h-4 w-4" />
                Clock Out &amp; Sign Out
              </Button>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* â"€â"€ Clock In/Out Card â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <Card className={`border-0 overflow-hidden shadow-lg text-white relative ${
        isRestDay
          ? "bg-[linear-gradient(135deg,#0f0c29_0%,#302b63_50%,#1e1b4b_100%)]"
          : "bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)]"
      }`}>
        {/* Ambient glow orbs — rest day only */}
        {isRestDay && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/4 h-32 w-32 rounded-full bg-indigo-400/10 blur-2xl" />
          </div>
        )}
        <CardContent className="p-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-white/70 mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Current Time
              </p>
              <p className="text-5xl font-bold tracking-tight tabular-nums">{formatLiveTime(now)}</p>
              <p className="text-sm text-white/70 mt-1">{formatLiveDate(now)}</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 shrink-0" />
                {location ? (
                  <span className="text-white/90">
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </span>
                ) : (
                  <span className="text-white/50">{locationError ?? "Acquiring location..."}</span>
                )}
              </div>

              {!hasSchedule && !statusLoading ? (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/20 border border-amber-400/30 px-4 py-3 text-sm font-semibold text-amber-100">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>No schedule assigned. Contact HR to set up your work schedule.</span>
                </div>
              ) : isRestDay ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 rounded-xl bg-white/10 border border-white/15 px-5 py-4">
                    <div className="h-10 w-10 rounded-full bg-violet-400/20 border border-violet-300/30 flex items-center justify-center shrink-0">
                      <Palmtree className="h-5 w-5 text-violet-200" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white tracking-wide">Rest Day</p>
                      <p className="text-xs text-white/55 mt-0.5">Not scheduled to work today</p>
                    </div>
                  </div>
                  {/* Allow clock-in on rest days as overtime — requires approved OT request */}
                  {!status?.time_in && !hasReportedAbsence && (
                    <div className="flex flex-col gap-1">
                      <Button
                        onClick={() => { setActionError(null); setModal("rest-day-ot"); }}
                        disabled={!location || actionLoading || !todayRestDayOtApproved}
                        className="bg-violet-500/30 border border-violet-300/40 text-white hover:bg-violet-500/50 font-bold gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <LogIn className="h-4 w-4" /> Clock In (Rest Day OT)
                      </Button>
                      {!todayRestDayOtApproved && (
                        <p className="text-[11px] text-amber-300/80 text-center">
                          Requires an approved Rest Day OT request for today
                        </p>
                      )}
                    </div>
                  )}
                  {status?.time_in && !status?.time_out && (
                    <div className="flex gap-2">
                      <div className="flex-1 flex flex-col gap-0.5 rounded-xl bg-violet-500/20 border border-violet-400/30 px-4 py-2.5 text-sm font-semibold text-violet-100">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-violet-300 animate-pulse shrink-0" />
                          Rest Day OT in progress
                        </div>
                        {status.ot_session && (
                          <div className="text-xs font-normal text-violet-300 flex flex-wrap gap-x-2 mt-0.5">
                            <span>{fmtMins(status.ot_session.capped_ot_minutes)} rendered</span>
                            <span>·</span>
                            <span>Approved {status.ot_session.approved_start.substring(0, 5)}–{status.ot_session.approved_end.substring(0, 5)} ({status.ot_session.approved_hours}h)</span>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => { setActionError(null); setModal("time-out"); }}
                        disabled={actionLoading}
                        className="bg-white/10 border border-white/30 text-white hover:bg-white/20 font-bold gap-2 cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" /> Time Out
                      </Button>
                    </div>
                  )}
                  {status?.time_in && status?.time_out && (
                    <div className="flex items-center gap-2 rounded-xl bg-violet-500/20 border border-violet-300/30 px-4 py-3 text-sm font-semibold text-violet-100">
                      <CheckCircle2 className="h-4 w-4 text-violet-300 shrink-0" />
                      Rest Day OT recorded for today.
                    </div>
                  )}
                  {!status?.time_in && (
                    <p className="text-[11px] text-white/40 text-center sm:text-right px-1">Enjoy your time off!</p>
                  )}
                </div>
              ) : hasReportedAbsence ? (
                <div className="flex items-center gap-2 rounded-lg bg-purple-500/20 border border-purple-400/30 px-4 py-3 text-sm font-semibold text-purple-100">
                  <FileX className="h-4 w-4 shrink-0" />
                  Absence reported — clock-in disabled for today.
                </div>
              ) : shiftDone ? (
                <div className="flex items-center gap-2 rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-sm font-semibold text-white/90">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                  Shift complete — attendance recorded for today.
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    onClick={() => { setActionError(null); setModal("time-in"); }}
                    disabled={!canTimeIn || actionLoading}
                    className="bg-white text-slate-900 hover:bg-white/90 font-bold gap-2 flex-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LogIn className="h-4 w-4" /> Time In
                  </Button>
                  <Button
                    onClick={() => { setActionError(null); setModal("time-out"); }}
                    disabled={!canTimeOut || actionLoading}
                    className="bg-white/10 border border-white/40 text-white hover:bg-white/20 font-bold gap-2 flex-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LogOut className="h-4 w-4" /> Time Out
                  </Button>
                </div>
              )}

              {actionError && (
                <p className="text-sm text-red-300 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {actionError}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* â"€â"€ Report Absence â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {!statusLoading && lateClockInWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">You&apos;re clocking in late today</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Your schedule starts at {lateClockInWarning.startLabel}. It is currently {lateClockInWarning.nowLabel} - you are {lateClockInWarning.lateText} late.
              </p>
            </div>
          </div>
        </div>
      )}

      {!statusLoading && isShiftInProgress && status?.time_in && shiftElapsed && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <div>
              <p className="text-base font-semibold text-blue-900">Shift In Progress</p>
              <p className="text-xs text-blue-700">
                Started at {formatTime(status.time_in.timestamp)} - elapsed time: {shiftElapsed}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-blue-900 tabular-nums leading-none">{shiftElapsed}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mt-1">Elapsed</p>
          </div>
        </div>
      )}

      {!statusLoading && !isRestDay && isShiftInProgress && status?.ot_session && status.ot_session.actual_ot_minutes > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <div>
              <p className="text-base font-semibold text-amber-900">OT In Progress</p>
              <p className="text-xs text-amber-700">
                Approved {status.ot_session.approved_start.substring(0, 5)}–{status.ot_session.approved_end.substring(0, 5)} · Cap: {fmtMins(status.ot_session.capped_ot_minutes)} / {status.ot_session.approved_hours}h
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-amber-900 tabular-nums leading-none">{fmtMins(status.ot_session.actual_ot_minutes)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mt-1">OT</p>
          </div>
        </div>
      )}


      {/* â"€â"€ Today's punch summary â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {!statusLoading && !fetchError && status && !hasReportedAbsence && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Time In",  value: formatTime(status.time_in?.timestamp) },
            { label: "Time Out", value: formatTime(status.time_out?.timestamp) },
            { label: "Hours",    value: formatHoursFromTimestamps(status.time_in?.timestamp, status.time_out?.timestamp) },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
              <p className="text-lg font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* â"€â"€ My Schedule â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {mySchedule && (
        <Card className="border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-sm">My Work Schedule</h2>
                <p className="text-xs text-muted-foreground">Assigned shift and workdays</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {mySchedule.is_nightshift && (
                <Badge className="text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  Night Shift
                </Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  const [year, month] = today.split("-").map(Number);
                  setCalMonth({ year, month: month - 1 });
                  setView("calendar");
                }}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Today
              </Button>
            </div>
          </div>
          <div className="p-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-border bg-background p-5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Shift Hours</p>
              <div className="flex flex-wrap items-end gap-5">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">From</p>
                  <p className="text-3xl font-black tabular-nums tracking-tight leading-none">{formatScheduleClock(mySchedule.start_time)}</p>
                </div>
                <MoveRight className="h-4 w-4 mb-1 text-muted-foreground/40 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">To</p>
                  <p className="text-3xl font-black tabular-nums tracking-tight leading-none">{formatScheduleClock(mySchedule.end_time)}</p>
                </div>
              </div>
              {(mySchedule.break_start || mySchedule.break_end) && (
                <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50/60 px-3.5 py-2.5">
                  <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Break</span>
                    <span className="text-sm font-semibold tabular-nums text-amber-900">
                      {formatScheduleClock(mySchedule.break_start)} – {formatScheduleClock(mySchedule.break_end)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-muted/10 p-5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Workdays</p>
              <div className="grid grid-cols-7 gap-1">
                {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(day => {
                  const arr = Array.isArray(mySchedule.workdays)
                    ? (mySchedule.workdays as string[]).map(d => d.trim().toUpperCase())
                    : (mySchedule.workdays ?? "").split(",").map(d => d.trim().toUpperCase());
                  const isActive = arr.includes(day);
                  return (
                    <span
                      key={day}
                      title={day}
                      className={`h-10 rounded-lg text-[10px] font-bold border flex items-center justify-center transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background text-muted-foreground/60 border-border/60"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {!sheetLoading && (
        <Card className="border-border overflow-hidden">
          <div className="p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{monthSummaryLabel} Summary</h2>
                <p className="text-xs text-muted-foreground">
                  {monthlySummary.remainingWorkdays} working day
                  {monthlySummary.remainingWorkdays === 1 ? "" : "s"} remaining this month
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-green-200 bg-green-50 text-green-700 text-xs font-bold w-fit">
                {monthlySummary.attendanceRate.toFixed(1)}% attendance rate
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border bg-green-50 border-green-200">
                <p className="text-3xl font-black text-green-700 leading-none tabular-nums">{monthlySummary.daysPresent}</p>
                <p className="text-[11px] font-bold text-green-700 uppercase tracking-wider mt-2">Days Present</p>
                <p className="text-xs text-muted-foreground mt-1">On time</p>
              </div>
              <div className="p-4 rounded-xl border bg-amber-50 border-amber-200">
                <p className="text-3xl font-black text-amber-700 leading-none tabular-nums">{monthlySummary.daysLate}</p>
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mt-2">Days Late</p>
                <p className="text-xs text-muted-foreground mt-1">Late arrivals</p>
              </div>
              <div className="p-4 rounded-xl border bg-red-50 border-red-200">
                <p className="text-3xl font-black text-red-700 leading-none tabular-nums">{monthlySummary.daysAbsent}</p>
                <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider mt-2">Days Absent</p>
                <p className="text-xs text-muted-foreground mt-1">Unexcused + denied</p>
              </div>
              <div className="p-4 rounded-xl border bg-blue-50 border-blue-200">
                <p className="text-3xl font-black text-blue-700 leading-none tabular-nums">{monthlySummary.workedHours.toFixed(1)}h</p>
                <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mt-2">Total Hours</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {monthlySummary.expectedHours > 0
                    ? `${monthlySummary.expectedHours.toFixed(1)}h expected`
                    : "No expected-hours baseline"}
                </p>
              </div>
            </div>

            {/* Rest Day OT strip — only shown when there's rest day work this month */}
            {monthlySummary.restDayOtDays > 0 && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-violet-200 bg-violet-50">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-violet-800">
                    {monthlySummary.restDayOtDays} Rest Day OT {monthlySummary.restDayOtDays === 1 ? "session" : "sessions"} this month
                  </p>
                  <p className="text-[11px] text-violet-600 mt-0.5">
                    {monthlySummary.restDayOtHours.toFixed(1)}h worked on scheduled days off — counted in Total Hours above
                  </p>
                </div>
              </div>
            )}

            {/* Approved Overtime strip */}
            {(approvedOtHours > 0 || monthlySummary.restDayOtDays > 0) && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-sky-200 bg-sky-50">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-sky-800">
                    Overtime this month
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    <p className="text-[11px] text-sky-700">
                      <span className="font-semibold tabular-nums">{approvedOtHours.toFixed(1)}h</span> approved OT
                    </p>
                    {monthlySummary.restDayOtDays > 0 && (
                      <p className="text-[11px] text-violet-600">
                        <span className="font-semibold tabular-nums">{monthlySummary.restDayOtHours.toFixed(1)}h</span> rest day OT
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
                <span className="text-muted-foreground">Hours Progress</span>
                <span className="text-foreground tabular-nums">
                  {monthlySummary.workedHours.toFixed(1)}h / {monthlySummary.expectedHours.toFixed(1)}h
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${monthlySummary.progress.toFixed(1)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {monthlySummary.remainingHours.toFixed(1)}h remaining to meet expected hours
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* â"€â"€ Attendance History â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {/* ── Leave Balance Card ──────────────────────────────────────────────── */}
      {leaveBalances.length > 0 && (
        <Card className="border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-[linear-gradient(155deg,rgba(16,185,129,0.07),rgba(15,23,42,0.00))] flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm">My Leave Balances</h2>
              <p className="text-xs text-muted-foreground">Remaining entitlements for this year</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {LEAVE_CATEGORIES.map(({ value, label, icon: Icon }) => {
              const bal = leaveBalances.find(b => b.leave_category === value);
              if (!bal) return null;
              const pct = bal.entitled_days > 0 ? Math.round((bal.remaining_days / bal.entitled_days) * 100) : 0;
              const color = pct > 50 ? "text-emerald-700" : pct > 20 ? "text-amber-700" : "text-red-700";
              const barColor = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-400" : "bg-red-500";
              return (
                <div key={value} className="rounded-xl border border-border bg-background p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold truncate">{label}</span>
                  </div>
                  <p className={`text-2xl font-black tabular-nums leading-none ${color}`}>
                    {bal.remaining_days}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/ {bal.entitled_days}d</span>
                  </p>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="border-border overflow-hidden">
        <div className="p-6 bg-muted/20 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-base">Attendance History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your monthly and daily time records</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
              <button
                onClick={() => setLocationDisplayMode("place")}
                className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  locationDisplayMode === "place"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Place
              </button>
              <button
                onClick={() => setLocationDisplayMode("coordinates")}
                className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  locationDisplayMode === "coordinates"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Coordinates
              </button>
            </div>
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
              <button
                onClick={() => setView("calendar")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Calendar
              </button>
              <button
                onClick={() => setView("list")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
              <button
                onClick={() => setView("schedule")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  view === "schedule" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarRange className="h-3.5 w-3.5" /> Schedule
              </button>
            </div>
          </div>
        </div>

        {sheetLoading ? (
          <p className="px-6 py-10 text-center text-muted-foreground text-sm">Loading records...</p>
        ) : fetchError ? (
          <p className="px-6 py-10 text-center text-destructive text-sm">Failed to load records. Please refresh or contact support.</p>
        ) : (
          view === "calendar" ? calendarView : view === "schedule" ? scheduleView : listView
        )}
      </Card>
    </div>
  );
}






