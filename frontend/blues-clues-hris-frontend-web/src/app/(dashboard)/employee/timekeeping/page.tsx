"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Clock, LogIn, LogOut, MapPin,
  ChevronLeft, ChevronRight, CalendarDays, List,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { formatTime, formatHoursFromTimestamps, todayPST } from "@/lib/timekeepingUtils";

// ─── Backend response types ───────────────────────────────────────────────────

type MyStatus = {
  date: string;
  current_status: "time-in" | "time-out" | null;
  time_in: { timestamp: string; latitude: number; longitude: number } | null;
  time_out: { timestamp: string; latitude: number; longitude: number } | null;
};

type TimesheetEntry = {
  date: string;
  time_in: {
    timestamp: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  time_out: {
    timestamp: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLiveTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
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

// Supabase returns `timestamp without time zone` without Z — force UTC parsing
function parseTs(ts: string): Date {
  return new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
}

// Format time for calendar cell display (shorter format)
function formatCellTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "—";
  return parseTs(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

// Format GPS coordinates for display
function formatCoordinates(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return "No GPS";
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

type EntryStatus = "on-time" | "late" | "in-progress" | "absent";

function getEntryStatus(entry: TimesheetEntry): EntryStatus {
  if (!entry.time_in) return "absent";
  if (!entry.time_out) return "in-progress";
  const hourPST = parseInt(
    parseTs(entry.time_in.timestamp).toLocaleString("en-US", {
      hour: "numeric", hour12: false, timeZone: "Asia/Manila",
    }),
    10
  );
  return hourPST >= 9 ? "late" : "on-time";
}

const ENTRY_STATUS_CONFIG: Record<EntryStatus, { label: string; badge: string; dot: string; cell: string }> = {
  "on-time":     { label: "On Time",     badge: "bg-green-100 hover:bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500",  cell: "bg-green-50 border-green-200" },
  "late":        { label: "Late",        badge: "bg-amber-100 hover:bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-500",  cell: "bg-amber-50 border-amber-200" },
  "in-progress": { label: "In Progress", badge: "bg-blue-100 hover:bg-blue-100 text-blue-700 border-blue-200",      dot: "bg-blue-500",   cell: "bg-blue-50 border-blue-200" },
  "absent":      { label: "Absent",      badge: "bg-red-100 hover:bg-red-100 text-red-700 border-red-200",          dot: "bg-red-500",    cell: "bg-red-50 border-red-200" },
};

function buildDateMap(entries: TimesheetEntry[]): Record<string, TimesheetEntry> {
  return Object.fromEntries(entries.map(e => [e.date, e]));
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

const ITEMS_PER_PAGE = 7;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeTimekeepingPage() {
  const [now, setNow]                     = useState(new Date());
  const [status, setStatus]               = useState<MyStatus | null>(null);
  const [timesheet, setTimesheet]         = useState<TimesheetEntry[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [sheetLoading, setSheetLoading]   = useState(true);
  const [fetchError, setFetchError]       = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]     = useState<string | null>(null);
  const [location, setLocation]           = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [view, setView]       = useState<"calendar" | "list">("calendar");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [page, setPage] = useState(1);

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

  // Fetch status + timesheet on mount
  useEffect(() => {
    authFetch(`${API_BASE_URL}/timekeeping/my-status`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<MyStatus>; })
      .then(setStatus)
      .catch(() => setFetchError(true))
      .finally(() => setStatusLoading(false));

    authFetch(`${API_BASE_URL}/timekeeping/my-timesheet`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<TimesheetEntry[]>; })
      .then(setTimesheet)
      .catch(() => setFetchError(true))
      .finally(() => setSheetLoading(false));
  }, []);

  async function refreshData() {
    const [s, t] = await Promise.all([
      authFetch(`${API_BASE_URL}/timekeeping/my-status`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/timekeeping/my-timesheet`).then(r => r.json()),
    ]);
    setStatus(s);
    setTimesheet(t);
  }

  async function handlePunch(type: "time-in" | "time-out") {
    if (!location) {
      setActionError(locationError || "Location not available. Please allow location access.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/timekeeping/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || `Failed to clock ${type === "time-in" ? "in" : "out"}.`);
      }
      await refreshData();
    } catch (err: any) {
      setActionError(err.message || "Something went wrong.");
    } finally {
      setActionLoading(false);
    }
  }

  const canTimeIn  = !status || status.current_status === null || status.current_status === "time-out";
  const canTimeOut = status?.current_status === "time-in";

  const dateMap  = useMemo(() => buildDateMap(timesheet), [timesheet]);
  const calGrid  = useMemo(() => buildCalendarGrid(calMonth.year, calMonth.month), [calMonth]);
  const calTitle = new Date(calMonth.year, calMonth.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today    = todayPST();

  function prevMonth() {
    setCalMonth(c => c.month === 0
      ? { year: c.year - 1, month: 11 }
      : { year: c.year, month: c.month - 1 });
  }

  function nextMonth() {
    const now = new Date();
    const currentYM = { year: now.getFullYear(), month: now.getMonth() };
    if (calMonth.year === currentYM.year && calMonth.month === currentYM.month) return;
    setCalMonth(c => c.month === 11
      ? { year: c.year + 1, month: 0 }
      : { year: c.year, month: c.month + 1 });
  }

  const totalPages = Math.ceil(timesheet.length / ITEMS_PER_PAGE);
  const paged      = timesheet.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const isCurrentMonth = (() => {
    const n = new Date();
    return calMonth.year === n.getFullYear() && calMonth.month === n.getMonth();
  })();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Timekeeping</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track your attendance and work hours</p>
        </div>
      </div>

      {/* Clock In/Out Card */}
      <Card className="bg-primary text-primary-foreground border-0 overflow-hidden shadow-lg">
        <CardContent className="p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-primary-foreground/70 mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Current Time
              </p>
              <p className="text-5xl font-bold tracking-tight tabular-nums">{formatLiveTime(now)}</p>
              <p className="text-sm text-primary-foreground/70 mt-1">{formatLiveDate(now)}</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                {location ? (
                  <span className="text-primary-foreground/90">
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </span>
                ) : (
                  <span className="text-primary-foreground/50">
                    {locationError ?? "Acquiring location..."}
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => handlePunch("time-in")}
                  disabled={!canTimeIn || actionLoading}
                  className="bg-white text-primary hover:bg-white/90 font-bold gap-2 flex-1"
                >
                  <LogIn className="h-4 w-4" />
                  {actionLoading && canTimeIn ? "Clocking In..." : "Time In"}
                </Button>
                <Button
                  onClick={() => handlePunch("time-out")}
                  disabled={!canTimeOut || actionLoading}
                  variant="outline"
                  className="border-white/40 text-white hover:bg-white/10 font-bold gap-2 flex-1"
                >
                  <LogOut className="h-4 w-4" />
                  {actionLoading && canTimeOut ? "Clocking Out..." : "Time Out"}
                </Button>
              </div>
              {actionError && <p className="text-sm text-red-300 font-medium">{actionError}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's punch summary */}
      {!statusLoading && !fetchError && status && (
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

      {/* Attendance History */}
      <Card className="border-border overflow-hidden">

        <div className="p-6 bg-muted/20 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">Attendance History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your monthly and daily time records</p>
          </div>
          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors ${
                view === "calendar"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors ${
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
        </div>

        {sheetLoading ? (
          <p className="px-6 py-10 text-center text-muted-foreground text-sm">Loading records...</p>
        ) : fetchError ? (
          <p className="px-6 py-10 text-center text-destructive text-sm">Failed to load records. Please refresh or contact support.</p>
        ) : view === "calendar" ? (

          // ─── Calendar View ────────────────────────────────────────────────
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="font-bold text-sm">{calTitle}</p>
              <Button variant="outline" size="icon" className="h-8 w-8"
                onClick={nextMonth} disabled={isCurrentMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-2">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calGrid.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;

                const dateStr  = toDateStr(calMonth.year, calMonth.month, day);
                const entry    = dateMap[dateStr];
                const isToday  = dateStr === today;
                const isFuture = dateStr > today;
                const entryStatus = entry ? getEntryStatus(entry) : null;
                const cfg      = entryStatus ? ENTRY_STATUS_CONFIG[entryStatus] : null;

                return (
                  <div
                    key={dateStr}
                    className={`
                      relative rounded-xl border p-2 min-h-[120px] flex flex-col transition-all
                      ${isToday
                        ? "bg-primary/10 border-primary shadow-md"
                        : isFuture
                        ? "bg-background border-border opacity-50"
                        : cfg
                        ? `${cfg.cell} border`
                        : "bg-background border-border"}
                    `}
                  >
                    {/* Day number */}
                    <div className={`text-sm font-bold mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>
                      {day}
                    </div>

                    {/* Time and location info */}
                    {!isFuture && entry && entry.time_in && (
                      <div className="flex-1 space-y-1 text-[9px] leading-tight">
                        {/* Time In */}
                        <div className="flex items-start gap-1">
                          <LogIn className="h-3 w-3 shrink-0 mt-0.5 text-green-600" />
                          <div>
                            <div className="font-semibold text-foreground">
                              {formatCellTime(entry.time_in.timestamp)}
                            </div>
                            <div className="text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              <span className="truncate text-[8px]">
                                {formatCoordinates(entry.time_in.latitude, entry.time_in.longitude)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Time Out */}
                        {entry.time_out && (
                          <div className="flex items-start gap-1">
                            <LogOut className="h-3 w-3 shrink-0 mt-0.5 text-red-600" />
                            <div>
                              <div className="font-semibold text-foreground">
                                {formatCellTime(entry.time_out.timestamp)}
                              </div>
                              <div className="text-muted-foreground flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                <span className="truncate text-[8px]">
                                  {formatCoordinates(entry.time_out.latitude, entry.time_out.longitude)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Status indicator dot */}
                    {!isToday && !isFuture && cfg && (
                      <div className="mt-auto pt-1">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 flex-wrap">
              {Object.entries(ENTRY_STATUS_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                  <span className="text-[10px] text-muted-foreground font-medium">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>

        ) : (

          // ─── List View ────────────────────────────────────────────────────
          <>
            <div className="divide-y divide-border">
              {timesheet.length === 0 ? (
                <p className="px-6 py-10 text-center text-muted-foreground text-sm">No attendance records found.</p>
              ) : paged.map(entry => {
                const entryStatus = getEntryStatus(entry);
                const cfg = ENTRY_STATUS_CONFIG[entryStatus];
                return (
                  <div key={entry.date} className="px-6 py-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="font-semibold text-sm">{formatEntryDate(entry.date)}</span>
                      </div>
                      <Badge className={`text-[9px] font-bold border ${cfg.badge}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                    {entry.time_in && (
                      <div className="flex items-center gap-6 mt-2 ml-5 text-xs text-muted-foreground">
                        <span>In: <span className="font-semibold text-foreground">{formatTime(entry.time_in.timestamp)}</span></span>
                        {entry.time_out && <span>Out: <span className="font-semibold text-foreground">{formatTime(entry.time_out.timestamp)}</span></span>}
                        {entry.time_out && <span>Hours: <span className="font-semibold text-foreground">{formatHoursFromTimestamps(entry.time_in.timestamp, entry.time_out.timestamp)}</span></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-muted/10 border-t border-border flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {timesheet.length > 0
                  ? `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, timesheet.length)} of ${timesheet.length}`
                  : "No records"}
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
          </>
        )}
      </Card>
    </div>
  );
}
