"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Clock, Search, Download, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Timer, Users, MapPin, MapPinOff,
  TrendingUp, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";

// ─── Backend response types ───────────────────────────────────────────────────

// GET /users — one row per active user in the company
type UserRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  account_status: string | null;
};

// GET /timekeeping/timesheets?from=DATE&to=DATE
// One row per punch event (TIME_IN or TIME_OUT). Multiple rows per employee per day.
type PunchRow = {
  log_id: string;
  punch_type: "TIME_IN" | "TIME_OUT";
  timestamp: string;   // ISO datetime
  date: string;        // YYYY-MM-DD (PST)
  latitude: number | null;
  longitude: number | null;
  user_id: string;
  employee_id: string | null;
  user_profile: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

// ─── Display types ────────────────────────────────────────────────────────────

type TimekeepingStatus = "present" | "absent" | "late" | "on-leave";

type TimekeepingLog = {
  user_id: string;
  first_name: string;
  last_name: string;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  status: TimekeepingStatus;
  gps_verified: boolean; // true if TIME_IN punch has valid lat/lng
};

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TimekeepingStatus, { label: string; className: string }> = {
  present:    { label: "Present",  className: "bg-green-100 text-green-700 border-green-200" },
  absent:     { label: "Absent",   className: "bg-red-100 text-red-700 border-red-200" },
  late:       { label: "Late",     className: "bg-amber-100 text-amber-700 border-amber-200" },
  "on-leave": { label: "On Leave", className: "bg-blue-100 text-blue-700 border-blue-200" },
};

const FILTER_OPTIONS: { value: TimekeepingStatus | "all"; label: string }[] = [
  { value: "all",      label: "All" },
  { value: "present",  label: "Present" },
  { value: "absent",   label: "Absent" },
  { value: "late",     label: "Late" },
  { value: "on-leave", label: "On Leave" },
];

// Employees who punch in at or after this hour (PST) are considered late
const LATE_THRESHOLD_HOUR_PST = 9;
const ITEMS_PER_PAGE = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila",
  });
}

function formatHours(hours: number | null) {
  if (hours === null) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function toDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); // YYYY-MM-DD
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    timeZone: "Asia/Manila",
  });
}

function isToday(date: Date): boolean {
  return toDateString(date) === toDateString(new Date());
}

function deriveStatus(timeIn: string | null): TimekeepingStatus {
  if (!timeIn) return "absent";
  const hourPST = parseInt(
    new Date(timeIn).toLocaleString("en-US", {
      hour: "numeric", hour12: false, timeZone: "Asia/Manila",
    }),
    10
  );
  return hourPST >= LATE_THRESHOLD_HOUR_PST ? "late" : "present";
}

// Builds full roster by cross-referencing all users with punch records for the selected date.
// Users with no punch record are shown as Absent.
function buildFullRoster(users: UserRow[], punches: PunchRow[]): TimekeepingLog[] {
  const punchMap: Record<string, { timeIn: PunchRow | null; timeOut: PunchRow | null }> = {};
  for (const row of punches) {
    if (!punchMap[row.user_id]) {
      punchMap[row.user_id] = { timeIn: null, timeOut: null };
    }
    if (row.punch_type === "TIME_IN")  punchMap[row.user_id].timeIn  = row;
    if (row.punch_type === "TIME_OUT") punchMap[row.user_id].timeOut = row;
  }

  return users
    .filter(u => u.account_status?.toLowerCase() !== "inactive")
    .map(u => {
      const punched   = punchMap[u.user_id] ?? { timeIn: null, timeOut: null };
      const timeInTs  = punched.timeIn?.timestamp  ?? null;
      const timeOutTs = punched.timeOut?.timestamp ?? null;

      let hours_worked: number | null = null;
      if (timeInTs && timeOutTs) {
        hours_worked = (new Date(timeOutTs).getTime() - new Date(timeInTs).getTime()) / 3_600_000;
      }

      // GPS verified if TIME_IN punch has both lat and lng
      const gps_verified = !!(
        punched.timeIn &&
        punched.timeIn.latitude != null &&
        punched.timeIn.longitude != null
      );

      return {
        user_id:    u.user_id,
        first_name: u.first_name ?? "Unknown",
        last_name:  u.last_name  ?? "",
        time_in:    timeInTs,
        time_out:   timeOutTs,
        hours_worked,
        status: deriveStatus(timeInTs),
        gps_verified,
      };
    });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerTimekeepingPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [logs, setLogs]                 = useState<TimekeepingLog[]>([]);
  const [totalUsers, setTotalUsers]     = useState(0);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState(false);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<TimekeepingStatus | "all">("all");
  const [page, setPage]                 = useState(1);

  // Re-fetch whenever selected date changes
  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    setPage(1);

    const dateStr = toDateString(selectedDate);

    // Fetch full user roster + punch records for selected date in parallel.
    // Cross-referencing both ensures absent employees appear in the table.
    Promise.all([
      authFetch(`${API_BASE_URL}/users`).then(r => {
        if (!r.ok) throw new Error("Failed to fetch users");
        return r.json() as Promise<UserRow[]>;
      }),
      authFetch(`${API_BASE_URL}/timekeeping/timesheets?from=${dateStr}&to=${dateStr}`).then(r => {
        if (!r.ok) throw new Error("Failed to fetch timesheets");
        return r.json() as Promise<PunchRow[]>;
      }),
    ])
      .then(([users, punches]) => {
        const activeUsers = users.filter(u => u.account_status?.toLowerCase() !== "inactive");
        setTotalUsers(activeUsers.length);
        setLogs(buildFullRoster(users, punches));
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  // ─── Derived stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const present  = logs.filter(l => l.status === "present").length;
    const absent   = logs.filter(l => l.status === "absent").length;
    const late     = logs.filter(l => l.status === "late").length;
    const on_leave = logs.filter(l => l.status === "on-leave").length;
    const attended = present + late; // present + late counts as attended
    const attendanceRate = totalUsers > 0 ? Math.round((attended / totalUsers) * 100) : 0;

    const workedHours = logs.filter(l => l.hours_worked !== null).map(l => l.hours_worked as number);
    const avgHours = workedHours.length > 0
      ? workedHours.reduce((a, b) => a + b, 0) / workedHours.length
      : 0;

    return { present, absent, late, on_leave, attendanceRate, avgHours };
  }, [logs, totalUsers]);

  // ─── Filtered + paginated data ──────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(l => {
      const name = `${l.first_name} ${l.last_name}`.toLowerCase();
      return name.includes(q) && (statusFilter === "all" || l.status === statusFilter);
    });
  }, [logs, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // ─── Date navigation ────────────────────────────────────────────────────────

  function goToPrev() {
    setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  }
  function goToNext() {
    setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
  }
  function goToToday() {
    setSelectedDate(new Date());
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header + Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Team Timekeeping</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Monitor attendance and track work hours</p>
          </div>
        </div>

        {/* Date navigator */}
        <div className="flex items-center gap-2">
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
          <div className="h-9 px-4 flex items-center border border-border rounded-md text-sm font-medium bg-background min-w-[160px] justify-center">
            {formatDisplayDate(selectedDate)}
          </div>
          <Button
            variant="outline" size="icon" className="h-9 w-9"
            onClick={goToNext}
            disabled={isToday(selectedDate)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Team"
          value={String(totalUsers)}
          sub="employees"
          colorClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={CheckCircle2}
          label="Present Today"
          value={String(stats.present)}
          sub={`${stats.attendanceRate}% attendance`}
          colorClass="bg-green-50 text-green-600"
        />
        <StatCard
          icon={Timer}
          label="Late Arrivals"
          value={String(stats.late)}
          sub="needs attention"
          colorClass="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={Clock}
          label="Avg Hours"
          value={stats.avgHours.toFixed(1)}
          sub="per employee"
          colorClass="bg-blue-50 text-blue-600"
        />
      </div>

      {/* Table Card */}
      <Card className="border-border overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-6 bg-muted/20 border-b border-border">
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                  statusFilter === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-b border-border uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Time In</th>
                <th className="px-6 py-4">Time Out</th>
                <th className="px-6 py-4">Hours Worked</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">GPS Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground text-sm">
                    Loading timekeeping data...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-destructive text-sm">
                    Failed to load timekeeping data. Please refresh or contact support.
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground text-sm">
                    {search || statusFilter !== "all"
                      ? "No records match your search."
                      : "No entries found for this date."}
                  </td>
                </tr>
              ) : paged.map(log => {
                const name = `${log.first_name} ${log.last_name}`.trim();
                const cfg  = STATUS_CONFIG[log.status];
                return (
                  <tr key={log.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-xs border border-primary/5 shrink-0">
                          {log.first_name.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-semibold text-foreground">{name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-xs">{formatTime(log.time_in)}</td>
                    <td className="px-6 py-4 font-medium text-xs">{formatTime(log.time_out)}</td>
                    <td className="px-6 py-4 font-medium text-xs">{formatHours(log.hours_worked)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex text-[9px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wide ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {log.status === "absent" ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : log.gps_verified ? (
                        <div className="flex items-center gap-1.5 text-green-600">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wide">Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPinOff className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wide">No GPS</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {/* Bottom Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Attendance Rate */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-50 text-green-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="font-semibold text-sm">Attendance Rate</p>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.attendanceRate}%</p>
            <p className="text-xs text-muted-foreground mb-3">
              {stats.present + stats.late} of {totalUsers} employees
            </p>
            <Progress value={stats.attendanceRate} className="h-2" />
          </CardContent>
        </Card>

        {/* Average Hours */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Clock className="h-4 w-4" />
              </div>
              <p className="font-semibold text-sm">Average Hours</p>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.avgHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground mb-3">Per employee today</p>
            <Progress value={(stats.avgHours / 8) * 100} className="h-2" />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">8h goal</p>
          </CardContent>
        </Card>

        {/* Issues */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <AlertCircle className="h-4 w-4" />
              </div>
              <p className="font-semibold text-sm">Issues</p>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Late arrivals</span>
                <span className={`font-bold ${stats.late > 0 ? "text-amber-600" : "text-foreground"}`}>
                  {stats.late}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Absences</span>
                <span className={`font-bold ${stats.absent > 0 ? "text-red-600" : "text-foreground"}`}>
                  {stats.absent}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between text-sm">
                <span className="font-semibold">Total issues</span>
                <span className={`font-bold ${(stats.late + stats.absent) > 0 ? "text-destructive" : "text-foreground"}`}>
                  {stats.late + stats.absent}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, colorClass }: {
  icon: any; label: string; value: string; sub: string; colorClass: string;
}) {
  return (
    <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className={`p-2 rounded-lg w-fit mb-3 ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <h2 className="text-2xl font-bold tracking-tight">{value}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
