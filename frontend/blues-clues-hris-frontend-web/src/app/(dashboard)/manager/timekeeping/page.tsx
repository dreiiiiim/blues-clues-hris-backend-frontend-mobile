"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Clock, Search, Download,
  ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Timer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";

// ─── Backend response types ───────────────────────────────────────────────────

// GET /users — one row per user in the company
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
  timestamp: string; // ISO datetime
  date: string;      // YYYY-MM-DD (PST)
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
};

type TimekeepingStats = {
  present: number;
  absent: number;
  late: number;
  on_leave: number;
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

// Returns today's date as YYYY-MM-DD in Philippine Standard Time
function todayPST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// Derives attendance status from time-in punch.
// "on-leave" cannot be derived from punches alone — requires a leave endpoint (future sprint).
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

// Builds the full roster by cross-referencing all users with today's punch records.
// Users with no punch record are shown as Absent — fulfilling "all Group Heads" requirement.
function buildFullRoster(users: UserRow[], punches: PunchRow[]): TimekeepingLog[] {
  // Map punch rows by user_id for O(1) lookup
  const punchMap: Record<string, { timeIn: PunchRow | null; timeOut: PunchRow | null }> = {};
  for (const row of punches) {
    if (!punchMap[row.user_id]) {
      punchMap[row.user_id] = { timeIn: null, timeOut: null };
    }
    if (row.punch_type === "TIME_IN")  punchMap[row.user_id].timeIn  = row;
    if (row.punch_type === "TIME_OUT") punchMap[row.user_id].timeOut = row;
  }

  // Build one display row per user — absent if no punch record exists
  return users
    .filter(u => u.account_status?.toLowerCase() !== "inactive") // exclude deactivated accounts
    .map(u => {
      const punched = punchMap[u.user_id] ?? { timeIn: null, timeOut: null };
      const timeInTs  = punched.timeIn?.timestamp  ?? null;
      const timeOutTs = punched.timeOut?.timestamp ?? null;

      let hours_worked: number | null = null;
      if (timeInTs && timeOutTs) {
        hours_worked = (new Date(timeOutTs).getTime() - new Date(timeInTs).getTime()) / 3_600_000;
      }

      return {
        user_id:     u.user_id,
        first_name:  u.first_name  ?? "Unknown",
        last_name:   u.last_name   ?? "",
        time_in:     timeInTs,
        time_out:    timeOutTs,
        hours_worked,
        status: deriveStatus(timeInTs),
      };
    });
}

function computeStats(logs: TimekeepingLog[]): TimekeepingStats {
  return logs.reduce(
    (acc, l) => {
      if (l.status === "on-leave") acc.on_leave++;
      else acc[l.status]++;
      return acc;
    },
    { present: 0, absent: 0, late: 0, on_leave: 0 }
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerTimekeepingPage() {
  const [logs, setLogs]             = useState<TimekeepingLog[]>([]);
  const [stats, setStats]           = useState<TimekeepingStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState<TimekeepingStatus | "all">("all");
  const [page, setPage]             = useState(1);

  useEffect(() => {
    const today = todayPST();

    // Fetch full user roster + today's punch records in parallel.
    // Cross-referencing both ensures absent employees appear in the table.
    Promise.all([
      authFetch(`${API_BASE_URL}/users`).then(r => {
        if (!r.ok) throw new Error("Failed to fetch users");
        return r.json() as Promise<UserRow[]>;
      }),
      authFetch(`${API_BASE_URL}/timekeeping/timesheets?from=${today}&to=${today}`).then(r => {
        if (!r.ok) throw new Error("Failed to fetch timesheets");
        return r.json() as Promise<PunchRow[]>;
      }),
    ])
      .then(([users, punches]) => {
        const roster = buildFullRoster(users, punches);
        setLogs(roster);
        setStats(computeStats(roster));
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(l => {
      const name = `${l.first_name} ${l.last_name}`.toLowerCase();
      const matchSearch = name.includes(q);
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [logs, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Timekeeping</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily attendance logs for all employees in your company
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={CheckCircle2} label="Present"  value={stats.present}  colorClass="bg-green-50 text-green-600" />
          <StatCard icon={XCircle}      label="Absent"   value={stats.absent}   colorClass="bg-red-50 text-red-600" />
          <StatCard icon={Timer}        label="Late"     value={stats.late}     colorClass="bg-amber-50 text-amber-600" />
          <StatCard icon={AlertCircle}  label="On Leave" value={stats.on_leave} colorClass="bg-blue-50 text-blue-600" />
        </div>
      )}

      {/* Table Card */}
      <Card className="border-border overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-6 bg-muted/20 border-b border-border">
          <div>
            <p className="text-lg font-bold">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric", year: "numeric",
                timeZone: "Asia/Manila",
              })}
            </p>
            <p className="text-xs text-muted-foreground">Today's attendance overview</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status filter pills */}
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name..."
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground text-sm">
                    Loading timekeeping data...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-destructive text-sm">
                    Failed to load timekeeping data. Please refresh or contact support.
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground text-sm">
                    No records found{statusFilter !== "all" ? ` for "${STATUS_CONFIG[statusFilter].label}"` : ""}.
                  </td>
                </tr>
              ) : paged.map(log => {
                const name = `${log.first_name} ${log.last_name}`.trim();
                const cfg = STATUS_CONFIG[log.status];
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
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, colorClass }: {
  icon: any; label: string; value: number; colorClass: string;
}) {
  return (
    <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className={`p-2 rounded-lg w-fit mb-3 ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <h2 className="text-2xl font-bold tracking-tight">{value}</h2>
      </CardContent>
    </Card>
  );
}
