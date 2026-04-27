"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Clock, Search, Download, ChevronLeft, ChevronRight,
  Users, CheckCircle2, Timer, MapPin, MapPinOff, Calendar, CalendarDays,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { formatGpsLocation, type LocationDisplayMode } from "@/lib/timekeepingUtils";
import { EmployeeScheduleEditModal } from "@/components/timekeeping/EmployeeScheduleEditModal";
import { AttendanceCalendarGrid, type CalendarDayData, type CalendarViewMode } from "@/components/timekeeping/AttendanceCalendarGrid";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRow = {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  schedule?: { workdays?: string | string[] | null; start_time?: string | null } | null;
};

type PunchRow = {
  log_id: string;
  employee_id: string;
  log_type: "time-in" | "time-out";
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  location_name?: string | null;
  ip_address: string | null;
  is_mock_location: string;
  clock_type?: string | null;
  log_status: string;
};

type RosterEntry = {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  status: "present" | "late" | "clocked-in" | "absent" | "rest-day" | "no-schedule";
  gps_verified: boolean;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_in_location_name: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Supabase returns `timestamp without time zone` without Z — force UTC parsing
function parseTs(ts: string): Date {
  return new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
}

function toDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
    timeZone: "Asia/Manila",
  });
}

function isToday(date: Date): boolean {
  return toDateString(date) === toDateString(new Date());
}

function formatTime(timestamp: string | null): string {
  if (!timestamp) return "—";
  return parseTs(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

function formatHours(timeIn: string | null, timeOut: string | null): string {
  if (!timeIn || !timeOut) return "—";
  const diff = (parseTs(timeOut).getTime() - parseTs(timeIn).getTime()) / 3600000;
  return `${diff.toFixed(2)}h`;
}

function computeHoursDecimal(timeIn: string | null, timeOut: string | null): number | null {
  if (!timeIn || !timeOut) return null;
  return (parseTs(timeOut).getTime() - parseTs(timeIn).getTime()) / 3600000;
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

function isLate(timeIn: string, clockType?: string | null, schedule?: UserRow["schedule"]): boolean {
  if (String(clockType ?? "").toUpperCase() === "LATE") return true;

  const clockInMins = getClockInMinutesPHT(timeIn);
  const scheduledStartMins = parseClockToMinutes(schedule?.start_time);
  if (clockInMins != null && scheduledStartMins != null) {
    return clockInMins > scheduledStartMins;
  }

  const hourPST = Number.parseInt(
    parseTs(timeIn).toLocaleString("en-US", {
      hour: "numeric", hour12: false, timeZone: "Asia/Manila",
    }), 10
  );
  return hourPST >= 9;
}

const WEEKDAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function getScheduleDayStatus(schedule: UserRow["schedule"], date: string): "workday" | "rest-day" | "no-schedule" {
  if (!schedule?.workdays) return "no-schedule";
  const source = Array.isArray(schedule.workdays) ? schedule.workdays : String(schedule.workdays).split(",");
  const workdays = new Set(source.map(day => day.trim().slice(0, 3).toUpperCase()).filter(Boolean));
  if (workdays.size === 0) return "no-schedule";
  return workdays.has(WEEKDAY_KEYS[new Date(`${date}T12:00:00`).getDay()]) ? "workday" : "rest-day";
}

function buildFullRoster(users: UserRow[], punches: PunchRow[], date: string): RosterEntry[] {
  const punchMap: Record<string, { clockIn: PunchRow | null; clockOut: PunchRow | null }> = {};

  for (const punch of punches) {
    if (!punchMap[punch.employee_id]) {
      punchMap[punch.employee_id] = { clockIn: null, clockOut: null };
    }
    if (punch.log_type === "time-in" && !punchMap[punch.employee_id].clockIn) {
      punchMap[punch.employee_id].clockIn = punch;
    }
    if (punch.log_type === "time-out") {
      punchMap[punch.employee_id].clockOut = punch;
    }
  }

  return users.map(user => {
    const entry    = punchMap[user.employee_id];
    const clockIn  = entry?.clockIn  ?? null;
    const clockOut = entry?.clockOut ?? null;

    const time_in  = clockIn?.timestamp  ?? null;
    const time_out = clockOut?.timestamp ?? null;
    const gps_verified = clockIn?.latitude != null && clockIn?.longitude != null;

    const scheduleDayStatus = getScheduleDayStatus(user.schedule, date);
    let status: RosterEntry["status"] = scheduleDayStatus === "workday" ? "absent" : scheduleDayStatus;
    if (time_in && time_out) {
      status = isLate(time_in, clockIn?.clock_type, user.schedule) ? "late" : "present";
    } else if (time_in && !time_out) {
      status = isLate(time_in, clockIn?.clock_type, user.schedule) ? "late" : "clocked-in";
    }

    return {
      user_id: user.user_id,
      employee_id: user.employee_id,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_url: user.avatar_url ?? null,
      time_in,
      time_out,
      hours_worked: computeHoursDecimal(time_in, time_out),
      status,
      gps_verified,
      clock_in_latitude: clockIn?.latitude ?? null,
      clock_in_longitude: clockIn?.longitude ?? null,
      clock_in_location_name: clockIn?.location_name ?? null,
    };
  });
}

function EmployeeAvatar({
  firstName,
  lastName,
  avatarUrl,
}: Readonly<{
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}>) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = `${firstName?.charAt(0) ?? ""}${lastName?.charAt(0) ?? ""}`.toUpperCase() || "U";
  const canShowImage = !!avatarUrl && !imageFailed;

  return (
    <div className="h-9 w-9 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-xs border border-primary/5 shrink-0 overflow-hidden">
      {canShowImage ? (
        <img
          src={avatarUrl}
          alt={`${firstName} ${lastName}`.trim() || "Employee avatar"}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

function computeStats(roster: RosterEntry[]) {
  const total    = roster.length;
  const scheduledTotal = roster.filter(r => r.status !== "rest-day" && r.status !== "no-schedule").length;
  const present  = roster.filter(r => r.status === "present" || r.status === "clocked-in").length;
  const late     = roster.filter(r => r.status === "late").length;
  const absent   = roster.filter(r => r.status === "absent").length;
  const totalHours = roster.reduce((sum, r) => sum + (r.hours_worked ?? 0), 0);
  const attended = present + late;
  const avg_hours  = attended > 0 ? totalHours / attended : 0;
  const attendance_rate = scheduledTotal > 0 ? Math.round((attended / scheduledTotal) * 100) : 0;
  return { total, present, late, absent, totalHours, avg_hours, attendance_rate };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RosterEntry["status"], { label: string; className: string }> = {
  "present":    { label: "Present",    className: "bg-green-100 text-green-700 border border-green-200" },
  "late":       { label: "Late",       className: "bg-amber-100 text-amber-700 border border-amber-200" },
  "clocked-in": { label: "Clocked In", className: "bg-blue-100 text-blue-700 border border-blue-200" },
  "absent":     { label: "Absent",     className: "bg-red-100 text-red-700 border border-red-200" },
  "rest-day":   { label: "Rest Day",   className: "bg-sky-100 text-sky-700 border border-sky-200" },
  "no-schedule":{ label: "No Schedule",className: "bg-slate-100 text-slate-700 border border-slate-200" },
};

function StatusBadge({ status }: Readonly<{ status: RosterEntry["status"] }>) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex w-max shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, colorClass,
}: Readonly<{
  icon: any; label: string; value: string; sub: string; colorClass: string;
}>) {
  return (
    <Card className="p-5 border-border">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </Card>
  );
}

// ─── Filter options ───────────────────────────────────────────────────────────

type StatusFilter = RosterEntry["status"] | "all";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "present",    label: "Present" },
  { value: "absent",     label: "Absent" },
  { value: "rest-day",   label: "Rest Day" },
  { value: "no-schedule",label: "No Schedule" },
  { value: "late",       label: "Late" },
  { value: "clocked-in", label: "Clocked In" },
];

function statusFilterClass(value: StatusFilter, active: boolean): string {
  if (value === "all") return active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50";
  const tones: Record<RosterEntry["status"], { active: string; idle: string }> = {
    "present":    { active: "bg-green-600 text-white border-green-600", idle: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" },
    "late":       { active: "bg-amber-500 text-white border-amber-500", idle: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
    "clocked-in": { active: "bg-blue-600 text-white border-blue-600", idle: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
    "absent":     { active: "bg-red-600 text-white border-red-600", idle: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" },
    "rest-day":   { active: "bg-sky-600 text-white border-sky-600", idle: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100" },
    "no-schedule":{ active: "bg-slate-600 text-white border-slate-600", idle: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100" },
  };
  return active ? tones[value].active : tones[value].idle;
}

const ITEMS_PER_PAGE = 8;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerTimekeepingPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [users, setUsers]               = useState<UserRow[]>([]);
  const [allPunches, setAllPunches]     = useState<PunchRow[]>([]);
  const [roster, setRoster]             = useState<RosterEntry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState(false);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage]                 = useState(1);
  const [locationDisplayMode, setLocationDisplayMode] = useState<LocationDisplayMode>("place");

  // Calendar
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState<CalendarViewMode>("month");
  const [calPickerNav, setCalPickerNav] = useState<Date | null>(null);

  // Schedule view modal (manager is view-only)
  const [editScheduleFor, setEditScheduleFor]     = useState<{ userId: string; name: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    setPage(1);

    const dateStr = toDateString(selectedDate);

    Promise.all([
      authFetch(`${API_BASE_URL}/timekeeping/employees?asOf=${dateStr}`)
        .then(r => { if (!r.ok) { throw new Error('Unexpected error'); } return r.json() as Promise<UserRow[]>; }),
      authFetch(`${API_BASE_URL}/timekeeping/timesheets?from=${dateStr}&to=${dateStr}`)
        .then(r => { if (!r.ok) { throw new Error('Unexpected error'); } return r.json() as Promise<PunchRow[]>; }),
    ])
      .then(([u, punches]) => { setUsers(u); setAllPunches(punches); setRoster(buildFullRoster(u, punches, dateStr)); })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const stats = useMemo(() => computeStats(roster), [roster]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return roster.filter(r => {
      const name = `${r.first_name} ${r.last_name}`.toLowerCase();
      const matchSearch = name.includes(q) || r.employee_id.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [roster, search, statusFilter]);

  const effectiveLabel = useMemo(() => {
    return formatDisplayDate(selectedDate);
  }, [selectedDate]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged      = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const goToPrev  = useCallback(() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; }), []);
  const goToNext  = useCallback(() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }), []);
  const goToToday = useCallback(() => setSelectedDate(new Date()), []);

  const calendarDays = useMemo<CalendarDayData[]>(() => {
    const today = toDateString(new Date());
    const userMap = new Map(users.map((user) => [user.employee_id, user]));
    const dateMap: Record<string, { presentIds: Set<string>; lateIds: Set<string> }> = {};
    for (const p of allPunches) {
      const d = p.timestamp.split("T")[0];
      if (!dateMap[d]) dateMap[d] = { presentIds: new Set(), lateIds: new Set() };
      if (p.log_type === "time-in") {
        dateMap[d].presentIds.add(p.employee_id);
        if (isLate(p.timestamp, p.clock_type, userMap.get(p.employee_id)?.schedule)) {
          dateMap[d].lateIds.add(p.employee_id);
        }
      }
      if (p.log_type === "time-out") {/* skip */}
    }
    return Object.entries(dateMap).map(([date, s]): CalendarDayData => {
      const presentTotal = s.presentIds.size;
      const late = s.lateIds.size;
      const absent = Math.max(users.length - presentTotal, 0);
      return {
        date,
        status: date > today ? "future" : late > 0 ? "late" : presentTotal > 0 ? "present" : "absent",
        summary: date > today ? undefined : { present: presentTotal - late, late, absent, total: users.length },
      };
    });
  }, [allPunches, users]);

  const emptyMessage = (search || statusFilter !== "all") ? "No records match your search." : "No entries found for this date.";
  const tableBodyPlaceholder = loading ? (
    <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground text-sm">Loading timekeeping data...</td></tr>
  ) : fetchError ? (
    <tr><td colSpan={7} className="px-6 py-10 text-center text-destructive text-sm">Failed to load data. Please refresh or contact support.</td></tr>
  ) : (
    <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground text-sm">{emptyMessage}</td></tr>
  );
  const tableBody = loading || fetchError || paged.length === 0 ? tableBodyPlaceholder : paged.map(log => (
    <tr key={log.employee_id} className="hover:bg-primary/5 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <EmployeeAvatar
            firstName={log.first_name}
            lastName={log.last_name}
            avatarUrl={log.avatar_url}
          />
          <div>
            <p className="font-semibold">{`${log.first_name} ${log.last_name}`.trim()}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{log.employee_id}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-xs font-medium">{formatTime(log.time_in)}</td>
      <td className="px-6 py-4 text-xs font-medium">{formatTime(log.time_out)}</td>
      <td className="px-6 py-4 text-xs font-medium">{formatHours(log.time_in, log.time_out)}</td>
      <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={log.status} /></td>
      <td className="px-6 py-4 max-w-[28rem]">
        {log.status === "absent" || log.status === "rest-day" || log.status === "no-schedule" ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          log.gps_verified ? (
            <div className="flex min-w-0 items-start gap-1.5 text-green-600">
              <MapPin className="h-3.5 w-3.5 shrink-0 translate-y-0.5" />
              <span className="min-w-0 whitespace-normal break-words text-[10px] font-semibold leading-4">
                {formatGpsLocation(
                  log.clock_in_latitude,
                  log.clock_in_longitude,
                  log.clock_in_location_name,
                  locationDisplayMode,
                )}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPinOff className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">No GPS</span>
            </div>
          )
        )}
      </td>
      <td className="px-6 py-4">
        <button
          onClick={() => setEditScheduleFor({ userId: log.user_id, name: `${log.first_name} ${log.last_name}` })}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          View Schedule
        </button>
      </td>
    </tr>
  ));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Schedule Modal */}
      {editScheduleFor && (
        <EmployeeScheduleEditModal
          employeeId={editScheduleFor.userId}
          employeeName={editScheduleFor.name}
          currentSchedule={null}
          readOnly
          effectiveLabel={effectiveLabel}
          onClose={() => setEditScheduleFor(null)}
        />
      )}

      {/* Header + Date Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Team Timekeeping</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Monitor your team&apos;s daily attendance and schedule</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Calendar toggle */}
          <button
            onClick={() => setShowCalendar(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              showCalendar ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Calendar
          </button>
          <span className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground">
            Schedule access: view only
          </span>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={isToday(selectedDate) ? "default" : "outline"}
            className="h-9 px-4 text-sm font-semibold"
            onClick={goToToday}
          >
            {isToday(selectedDate) ? "Today" : "Go to Today"}
          </Button>
          <div className="h-9 px-4 flex items-center border border-border rounded-md text-sm font-medium bg-background min-w-40 justify-center">
            {formatDisplayDate(selectedDate)}
          </div>
          <Button
            variant="outline" size="icon" className="h-9 w-9"
            onClick={goToNext} disabled={isToday(selectedDate)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Manager stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users}        label="Total Team"    value={String(stats.total)}              sub="employees"                              colorClass="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} label="Present Today" value={String(stats.present + stats.late)} sub={`${stats.attendance_rate}% attendance`} colorClass="bg-green-50 text-green-600" />
        <StatCard icon={Timer}        label="Late Arrivals" value={String(stats.late)}               sub="needs follow-up"                        colorClass="bg-amber-50 text-amber-600" />
        <StatCard icon={Clock}        label="Avg Hours"     value={`${stats.avg_hours.toFixed(1)}h`} sub="per employee"                           colorClass="bg-blue-50 text-blue-600" />
      </div>

      {/* Calendar Grid View */}
      {showCalendar && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm animate-in fade-in duration-300">
          <div className="mb-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Team Calendar</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">Click a day to preview the team summary</p>
          </div>
          <AttendanceCalendarGrid
            mode={calendarMode}
            referenceDate={calPickerNav ?? selectedDate}
            days={calendarDays}
            loading={loading}
            showModeToggle
            onModeChange={setCalendarMode}
            onNavigate={(d) => setCalPickerNav(d)}
            onDayClick={(date) => {
              setSelectedDate(new Date(date + "T00:00:00"));
              setShowCalendar(false);
              setCalPickerNav(null);
            }}
          />
        </div>
      )}

      {/* Table */}
      <Card className="border-border overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-6 bg-muted/20 border-b border-border">
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                  statusFilterClass(opt.value, statusFilter === opt.value)
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
              <button
                onClick={() => setLocationDisplayMode("place")}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                  locationDisplayMode === "place"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Place
              </button>
              <button
                onClick={() => setLocationDisplayMode("coordinates")}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                  locationDisplayMode === "coordinates"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Coordinates
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9 w-52 bg-background"
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-b border-border uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Time In</th>
                <th className="px-6 py-4">Time Out</th>
                <th className="px-6 py-4">Hours</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">GPS</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tableBody}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-muted/10 border-t border-border flex items-center justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {filtered.length > 0
              ? `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length}`
              : "No results"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1"
              onClick={() => setPage(p => p - 1)} disabled={page === 1 || totalPages === 0}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1"
              onClick={() => setPage(p => p + 1)} disabled={page === totalPages || totalPages === 0}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}


