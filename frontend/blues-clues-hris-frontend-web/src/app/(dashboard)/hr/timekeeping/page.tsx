"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Clock, Search, ChevronLeft, ChevronRight, X,
  Users, TrendingUp, Timer, BarChart2, MapPin, MapPinOff,
  FileX, CalendarDays, CalendarRange, LayoutGrid, SlidersHorizontal,
  Download, AlertTriangle, Star, Trophy, Award,
  LogIn, LogOut, CheckCircle2, Shield, Calendar, Building2, Check, Pencil,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { formatGpsLocation, type LocationDisplayMode } from "@/lib/timekeepingUtils";
import { ScheduleManagementModal, type DepartmentOption } from "@/components/timekeeping/ScheduleManagementModal";
import { EmployeeScheduleEditModal } from "@/components/timekeeping/EmployeeScheduleEditModal";
import { AttendanceCalendarGrid, type CalendarDayData, type CalendarViewMode } from "@/components/timekeeping/AttendanceCalendarGrid";
import { ScheduleRosterTable } from "@/components/timekeeping/ScheduleRosterTable";
import { CompanyDefaultScheduleCard } from "@/components/timekeeping/CompanyDefaultScheduleCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRow = {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  department_id: string | null;
  department: { department_name?: string | null } | Array<{ department_name?: string | null }> | null;
  department_name?: string | null;
  schedule?: { workdays?: string | string[] | null; start_time?: string | null } | null;
};

type PunchRow = {
  log_id: string;
  employee_id: string;
  log_type: "time-in" | "time-out" | "absence";
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  location_name?: string | null;
  ip_address: string | null;
  is_mock_location: string;
  clock_type?: string | null;
  log_status: string;
  absence_reason: string | null;
  absence_notes: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_reason?: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
  edit_reason?: string | null;
};

type RosterEntry = {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  department_id: string | null;
  department_name: string | null;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  status: "present" | "late" | "clocked-in" | "absent" | "excused" | "rest-day" | "no-schedule";
  gps_verified: boolean;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_in_location_name: string | null;
  absence_reason: string | null;
  absence_status: string | null;
};

type PeriodEntry = {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  department_id: string | null;
  department_name: string | null;
  days_present: number;
  days_late: number;
  days_absent: number;
  total_hours: number;
  overtime_hours: number;
  compliance_rate: number;
  flagged: boolean;
  flag_reason: string | null;
};

type DetailPunch = {
  log_id: string;
  log_type: "time-in" | "time-out" | "absence";
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  location_name?: string | null;
  clock_type: string | null;
  log_status: string;
  absence_reason?: string | null;
  absence_notes?: string | null;
  review_reason?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  edit_reason?: string | null;
  edited_at?: string | null;
};

type AttendanceAudit = {
  audit_id: string;
  edited_by: string;
  edited_by_name?: string | null;
  edited_at: string;
  edit_reason: string;
};

type EmployeeDetail = {
  first_name: string;
  last_name: string;
  employee_id: string;
  date: string;
  schedule: { 
    start_time: string; 
    end_time: string; 
    workdays: string[] | string; 
    is_nightshift: boolean;
  } | null;
  punches: DetailPunch[];
  attendance_audits?: AttendanceAudit[];
};

type AbsenceRequest = {
  log_id: string;
  user_id: string | null;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  department_name: string | null;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  location_name?: string | null;
  absence_reason: string | null;
  absence_notes: string | null;
  log_status: string;
  review_reason?: string | null;
};

type ViewMode = "day" | "week" | "month" | "custom";
type StatusFilter = RosterEntry["status"] | "all";
type TabMode = "today" | "schedule" | "attendance";
type AttendanceQuickAction = "custom" | "clocked-in" | "present" | "excused" | "absent";

type ScheduleModalPreset = {
  scope: "company" | "department" | "employees";
  departmentId?: string;
  schedule?: {
    start_time?: string | null;
    end_time?: string | null;
    break_start?: string | null;
    break_end?: string | null;
    workdays?: string | null;
    is_nightshift?: boolean | null;
  } | null;
} | null;

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseTs(ts: string): Date {
  return new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
}

function toDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function getCurrentManilaTimeInput(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Manila",
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour === "24" ? "00" : hour}:${minute}`;
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
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila",
  });
}

function toTimeInputValue(timestamp: string | null | undefined): string {
  if (!timestamp) return "";
  const date = parseTs(timestamp);
  const hhRaw = date.toLocaleString("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Manila",
  });
  const hh = String(Number(hhRaw)).padStart(2, "0");
  const mm = date.toLocaleString("en-US", {
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
  return `${hh}:${mm}`;
}

function formatHoursLabel(timeIn: string | null, timeOut: string | null): string {
  if (!timeIn || !timeOut) return "—";
  const diff = (parseTs(timeOut).getTime() - parseTs(timeIn).getTime()) / 3600000;
  return `${diff.toFixed(2)}h`;
}

function formatGpsForMode(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  locationName: string | null | undefined,
  mode: LocationDisplayMode,
): string {
  return formatGpsLocation(latitude, longitude, locationName, mode);
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
  const normalizedClockType = String(clockType ?? "").toUpperCase();
  if (normalizedClockType === "LATE") return true;
  if (normalizedClockType === "ON-TIME") return false;

  const clockInMins = getClockInMinutesPHT(timeIn);
  const scheduledStartMins = parseClockToMinutes(schedule?.start_time);
  if (clockInMins != null && scheduledStartMins != null) {
    return clockInMins > scheduledStartMins;
  }

  const h = Number.parseInt(
    parseTs(timeIn).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Manila" }), 10
  );
  return h >= 9;
}

const WEEKDAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function getScheduleDayStatus(schedule: UserRow["schedule"], date: string): "workday" | "rest-day" | "no-schedule" {
  if (!schedule?.workdays) return "no-schedule";
  const source = Array.isArray(schedule.workdays) ? schedule.workdays : String(schedule.workdays).split(",");
  const workdays = new Set(source.map(day => day.trim().slice(0, 3).toUpperCase()).filter(Boolean));
  if (workdays.size === 0) return "no-schedule";
  return workdays.has(WEEKDAY_KEYS[new Date(`${date}T12:00:00`).getDay()]) ? "workday" : "rest-day";
}

function getWeekRange(offset: number = 0): { from: string; to: string; label: string } {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const dow = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const from = toDateString(mon);
  const to = toDateString(sun);
  const label = `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sun.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  return { from, to, label };
}

function getMonthRange(offset: number = 0): { from: string; to: string; label: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
}

function getCalendarRange(mode: CalendarViewMode, referenceDate: Date): { from: string; to: string } {
  if (mode === "day") {
    const d = toDateString(referenceDate);
    return { from: d, to: d };
  }

  if (mode === "week") {
    const day = referenceDate.getDay();
    const sunday = new Date(referenceDate);
    sunday.setDate(referenceDate.getDate() - day);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    return { from: toDateString(sunday), to: toDateString(saturday) };
  }

  const firstDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  return { from: toDateString(firstDay), to: toDateString(lastDay) };
}

function listDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cursor <= end) {
    dates.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function getWorkDays(from: string, to: string): string[] {
  const days: string[] = [];
  const cur = new Date(from + "T00:00:00");
  const end = new Date(to + "T23:59:59");
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) days.push(toDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function EmployeeAvatar({
  firstName,
  lastName,
  avatarUrl,
  className = "h-9 w-9",
  textClassName = "text-xs",
}: Readonly<{
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  className?: string;
  textClassName?: string;
}>) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = `${firstName?.charAt(0) ?? ""}${lastName?.charAt(0) ?? ""}`.toUpperCase() || "U";
  const canShowImage = !!avatarUrl && !imageFailed;

  return (
    <div
      className={`${className} bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold ${textClassName} border border-primary/10 shrink-0 overflow-hidden`}
    >
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

// ─── Roster builders ──────────────────────────────────────────────────────────

function buildFullRoster(users: UserRow[], punches: PunchRow[], date: string): RosterEntry[] {
  const map: Record<string, { ci: PunchRow | null; co: PunchRow | null; ab: PunchRow | null }> = {};
  for (const p of punches) {
    if (!map[p.employee_id]) map[p.employee_id] = { ci: null, co: null, ab: null };
    if (
      p.log_type === "time-in" &&
      String(p.log_status ?? "").toUpperCase() !== "DENIED" &&
      !map[p.employee_id].ci
    ) map[p.employee_id].ci = p;
    if (
      p.log_type === "time-out" &&
      String(p.log_status ?? "").toUpperCase() !== "DENIED"
    ) map[p.employee_id].co = p;
    if (
      p.log_type === "absence" &&
      String(p.log_status ?? "").toUpperCase() !== "DENIED"
    ) {
      map[p.employee_id].ab = p;
    }
  }

  return users.map(u => {
    const e = map[u.employee_id];
    const ci = e?.ci ?? null;
    const co = e?.co ?? null;
    const ab = e?.ab ?? null;
    const time_in  = ci?.timestamp ?? null;
    const time_out = co?.timestamp ?? null;
    const gps_verified = ci?.latitude != null && ci?.longitude != null;

    const scheduleDayStatus = getScheduleDayStatus(u.schedule, date);
    let status: RosterEntry["status"] = scheduleDayStatus === "workday" ? "absent" : scheduleDayStatus;
    if (time_in && time_out)     status = isLate(time_in, ci?.clock_type, u.schedule) ? "late" : "present";
    else if (time_in)            status = isLate(time_in, ci?.clock_type, u.schedule) ? "late" : "clocked-in";
    else if (ab?.absence_reason && String(ab.log_status ?? "").toUpperCase() === "APPROVED") status = "excused";

    const departmentName =
      (typeof u.department_name === "string" && u.department_name.trim()) ||
      (Array.isArray(u.department)
        ? u.department[0]?.department_name?.trim()
        : u.department?.department_name?.trim()) ||
      null;

    return {
      user_id: u.user_id, employee_id: u.employee_id,
      first_name: u.first_name, last_name: u.last_name,
      avatar_url: u.avatar_url ?? null,
      department_id: u.department_id ?? null,
      department_name: departmentName,
      time_in, time_out, hours_worked: computeHoursDecimal(time_in, time_out),
      status,
      gps_verified,
      clock_in_latitude: ci?.latitude ?? null,
      clock_in_longitude: ci?.longitude ?? null,
      clock_in_location_name: ci?.location_name ?? null,
      absence_reason: ab?.absence_reason ?? null,
      absence_status: ab?.log_status ?? null,
    };
  });
}

function buildPeriodRoster(users: UserRow[], punches: PunchRow[], from: string, to: string): PeriodEntry[] {
  type DayData = { ci: string | null; co: string | null; clockType: string | null };
  const empMap: Record<string, Record<string, DayData>> = {};

  for (const p of punches) {
    const d = p.timestamp.split("T")[0];
    if (!empMap[p.employee_id])    empMap[p.employee_id] = {};
    if (!empMap[p.employee_id][d]) empMap[p.employee_id][d] = { ci: null, co: null, clockType: null };

    if (p.log_type === "time-in" && !empMap[p.employee_id][d].ci) {
      empMap[p.employee_id][d].ci   = p.timestamp;
      empMap[p.employee_id][d].clockType = p.clock_type ?? null;
    }
    if (p.log_type === "time-out") empMap[p.employee_id][d].co = p.timestamp;
  }

  const workDays = getWorkDays(from, to);

  return users.map(u => {
    const dayMap = empMap[u.employee_id] ?? {};
    let total_hours = 0, overtime_hours = 0, days_present = 0, days_late = 0;

    for (const day of workDays) {
      const d = dayMap[day];
      if (d?.ci) {
        days_present++;
        if (isLate(d.ci, d.clockType, u.schedule))  days_late++;
        if (d.co) {
          const h = computeHoursDecimal(d.ci, d.co) ?? 0;
          total_hours += h;
          if (h > 8) overtime_hours += h - 8;
        }
      }
    }

    const days_absent     = workDays.length - days_present;
    const compliance_rate = workDays.length > 0 ? (days_present / workDays.length) * 100 : 0;
    const flagged         = days_absent > 3 || days_late > 2;
    const flag_reason     = flagged
      ? [days_absent > 3 && `${days_absent} absences`, days_late > 2 && `${days_late} late`].filter(Boolean).join(", ")
      : null;

    const departmentName =
      (typeof u.department_name === "string" && u.department_name.trim()) ||
      (Array.isArray(u.department)
        ? u.department[0]?.department_name?.trim()
        : u.department?.department_name?.trim()) ||
      null;

    return {
      user_id: u.user_id, employee_id: u.employee_id,
      first_name: u.first_name, last_name: u.last_name,
      avatar_url: u.avatar_url ?? null,
      department_id: u.department_id ?? null,
      department_name: departmentName,
      days_present, days_late, days_absent,
      total_hours, overtime_hours, compliance_rate, flagged, flag_reason,
    };
  });
}

function computeStats(roster: RosterEntry[]) {
  const total   = roster.length;
  const scheduledTotal = roster.filter(r => r.status !== "rest-day" && r.status !== "no-schedule").length;
  const present = roster.filter(r => r.status === "present" || r.status === "clocked-in").length;
  const late    = roster.filter(r => r.status === "late").length;
  const absent  = roster.filter(r => r.status === "absent" || r.status === "excused").length;
  const totalHours = roster.reduce((s, r) => s + (r.hours_worked ?? 0), 0);
  const attended = present + late;
  const avgHours   = attended > 0 ? totalHours / attended : 0;
  const attendance_rate = scheduledTotal > 0 ? Math.round((attended / scheduledTotal) * 100) : 0;
  return { total, present, late, absent, totalHours, avgHours, attendance_rate };
}

function computePeriodStats(entries: PeriodEntry[]) {
  const total      = entries.length;
  const totalHours = entries.reduce((s, e) => s + e.total_hours, 0);
  const totalOt    = entries.reduce((s, e) => s + e.overtime_hours, 0);
  const avgHours   = total > 0 ? totalHours / total : 0;
  const avgCompliance = total > 0 ? entries.reduce((s, e) => s + e.compliance_rate, 0) / total : 0;
  const flaggedCount  = entries.filter(e => e.flagged).length;
  return { total, totalHours, totalOt, avgHours, avgCompliance, flaggedCount };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function cleanCsvValue(v: string): string {
  // Replace em/en dashes used as "no value" with empty string, escape double quotes
  return String(v).replace(/^[—–]$/, "").replace(/"/g, '""');
}

function downloadCSV(entries: RosterEntry[] | PeriodEntry[], isDayView: boolean, label: string) {
  let csv: string;
  if (isDayView) {
    const rows = entries as RosterEntry[];
    const header = ["Employee", "Employee ID", "Department", "Status", "Time In", "Time Out", "Hours Worked", "GPS Verified", "Absence Reason"];
    const data   = rows.map(r => [
      `${r.first_name} ${r.last_name}`, r.employee_id, r.department_name ?? "",
      r.status.charAt(0).toUpperCase() + r.status.slice(1),
      formatTime(r.time_in), formatTime(r.time_out),
      r.hours_worked ? `${r.hours_worked.toFixed(2)}` : "",
      r.gps_verified ? "Yes" : "No",
      r.absence_reason ?? "",
    ]);
    csv = [header, ...data].map(row => row.map(c => `"${cleanCsvValue(c)}"`).join(",")).join("\n");
  } else {
    const rows = entries as PeriodEntry[];
    const header = ["Employee", "Employee ID", "Department", "Days Present", "Days Absent", "Days Late", "Total Hours", "Overtime Hours", "Compliance %", "Flagged", "Flag Reason"];
    const data   = rows.map(r => [
      `${r.first_name} ${r.last_name}`, r.employee_id, r.department_name ?? "",
      String(r.days_present), String(r.days_absent), String(r.days_late),
      r.total_hours.toFixed(2), r.overtime_hours.toFixed(2),
      `${r.compliance_rate.toFixed(1)}%`, r.flagged ? "Yes" : "No",
      r.flag_reason ?? "",
    ]);
    csv = [header, ...data].map(row => row.map(c => `"${cleanCsvValue(c)}"`).join(",")).join("\n");
  }

  // UTF-8 BOM ensures Excel opens it correctly without garbled characters
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href: url, download: `timekeeping-${label.replace(/[\s/]/g, "-")}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RosterEntry["status"], { label: string; className: string }> = {
  "present":    { label: "Present",    className: "bg-green-100 text-green-700 border border-green-200" },
  "late":       { label: "Late",       className: "bg-amber-100 text-amber-700 border border-amber-200" },
  "clocked-in": { label: "Clocked In", className: "bg-blue-100 text-blue-700 border border-blue-200" },
  "absent":     { label: "Absent",     className: "bg-red-100 text-red-700 border border-red-200" },
  "excused":    { label: "Excused",    className: "bg-purple-100 text-purple-700 border border-purple-200" },
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

function FlagBadge({ reason }: Readonly<{ reason: string | null }>) {
  if (!reason) return null;
  return (
    <span title={`Risk flag: ${reason}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-600 text-[9px] font-bold uppercase tracking-wide">
      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
      Flag
    </span>
  );
}

function CompliancePill({ rate }: Readonly<{ rate: number }>) {
  const color = rate >= 90 ? "bg-green-100 text-green-700" : rate >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${color}`}>
      {rate.toFixed(0)}%
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, colorClass, featured = false }: Readonly<{
  icon: any; label: string; value: string; sub: string; colorClass: string; featured?: boolean;
}>) {
  return (
    <Card className={`p-5 border-border ${featured ? "bg-gradient-to-br from-primary/5 to-transparent" : ""}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClass}`}><Icon className="h-4 w-4" /></div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </Card>
  );
}

// ─── Top Performers Bar ───────────────────────────────────────────────────────

function TopPerformersBar({ entries }: Readonly<{ entries: PeriodEntry[] }>) {
  const top3 = [...entries]
    .filter(e => e.days_present > 0)
    .sort((a, b) => b.compliance_rate - a.compliance_rate)
    .slice(0, 3);

  if (top3.length === 0) return null;

  const medalConfig = [
    { icon: Trophy, iconCls: "text-amber-500", cardCls: "bg-amber-50 border-amber-200 text-amber-800" },
    { icon: Award,  iconCls: "text-slate-400",  cardCls: "bg-slate-50 border-slate-200 text-slate-700" },
    { icon: Star,   iconCls: "text-orange-400", cardCls: "bg-orange-50 border-orange-200 text-orange-700" },
  ];

  return (
    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 rounded-xl mb-4">
      <div className="flex items-center gap-1.5 shrink-0">
        <Trophy className="h-4 w-4 text-amber-500" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Top Attendance</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {top3.map((e, i) => {
          const { icon: MedalIcon, iconCls, cardCls } = medalConfig[i];
          return (
            <span key={e.employee_id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${cardCls}`}>
              <MedalIcon className={`h-3.5 w-3.5 shrink-0 ${iconCls}`} />
              <span>{e.first_name} {e.last_name}</span>
              <span className="opacity-70 font-medium">· {e.compliance_rate.toFixed(0)}%</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Employee Slide-Over — Updated with new tabs ──────────────────────────────

type SliderDay = {
  date: string;
  ci: string | null;
  co: string | null;
  hours: number | null;
  absent: boolean;
  absenceReason: string | null;
  isWeekend: boolean;
  isFuture: boolean;
  isLate: boolean;
  isOutsideRange?: boolean; // For days from adjacent months
  isScheduledWorkday?: boolean; // For non-working days per employee schedule
};

function buildSliderDays(
  punches: PunchRow[],
  employeeId: string,
  from: string,
  to: string,
  schedule?: UserRow["schedule"],
): SliderDay[] {
  const emp = punches.filter((p) => p.employee_id === employeeId);
  const today = toDateString(new Date());
  const result: SliderDay[] = [];
  
  // Start from the Monday of the week containing 'from'
  const startDate = new Date(from + "T12:00:00");
  const startDow = startDate.getDay();
  const firstMonday = new Date(startDate);
  firstMonday.setDate(startDate.getDate() - (startDow === 0 ? 6 : startDow - 1));
  
  // End at the Sunday of the week containing 'to'
  const endDate = new Date(to + "T12:00:00");
  const endDow = endDate.getDay();
  const lastSunday = new Date(endDate);
  lastSunday.setDate(endDate.getDate() + (endDow === 0 ? 0 : 7 - endDow));
  
  const cur = new Date(firstMonday);
  const end = new Date(lastSunday);

  while (cur <= end) {
    const date = toDateString(cur);
    const dp = emp.filter((p) => p.timestamp.split("T")[0] === date);
    const ci = dp.find((p) => p.log_type === "time-in") ?? null;
    const co = dp.find((p) => p.log_type === "time-out") ?? null;
    const ab = dp.find((p) => p.log_type === "absence") ?? null;
    const dow = cur.getDay();
    
    // Check if this date is outside the filter range
    const isOutsideRange = date < from || date > to;

    result.push({
      date,
      ci: ci?.timestamp ?? null,
      co: co?.timestamp ?? null,
      hours: ci && co ? computeHoursDecimal(ci.timestamp, co.timestamp) : null,
      absent: !!ab,
      absenceReason: ab?.absence_reason ?? null,
      isWeekend: dow === 0 || dow === 6,
      isFuture: date > today,
      isLate: ci ? isLate(ci.timestamp, ci.clock_type, schedule) : false,
      isOutsideRange, // New flag for styling
    });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

type WeekGroup = {
  weekNumber: number;
  key: string;
  days: SliderDay[];
  totalHours: number;
  workdayCount: number;
};

function groupIntoWeeks(days: SliderDay[], monthStart: Date): WeekGroup[] {
  const map = new Map<string, WeekGroup>();
  const weekNumbers = new Map<string, number>();

  // Find first Monday of the month
  const firstMonday = new Date(monthStart);
  while (firstMonday.getDay() !== 1) {
    firstMonday.setDate(firstMonday.getDate() + 1);
  }

  for (const day of days) {
    const d = new Date(day.date + "T12:00:00");
    const dow = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const key = toDateString(mon);

    // Calculate week number
    if (!weekNumbers.has(key)) {
      const weeksDiff = Math.floor(
        (mon.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      weekNumbers.set(key, weeksDiff + 1);
    }

    const weekNumber = weekNumbers.get(key)!;

    if (!map.has(key)) {
      map.set(key, {
        weekNumber,
        key,
        days: [],
        totalHours: 0,
        workdayCount: 0,
      });
    }

    const g = map.get(key)!;
    g.days.push(day);
    g.totalHours += day.hours ?? 0;
    if (!day.isWeekend && !day.isFuture) g.workdayCount++;
  }

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ─── Compact Day Row ──────────────────────────────────────────────────────────

function DayCompactRow({ day }: Readonly<{ day: SliderDay }>) {
  const d = new Date(day.date + "T12:00:00");
  const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
  const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const isWeekendEmpty = day.isWeekend && !day.ci && !day.absent && !day.isFuture;
  const isNonWorkingDay = day.isScheduledWorkday === false;

  const dotCls = day.isFuture
    ? "bg-slate-200"
    : day.absent
    ? "bg-purple-400"
    : day.ci && day.isLate
    ? "bg-amber-400"
    : day.ci
    ? "bg-green-500"
    : isWeekendEmpty || isNonWorkingDay
    ? "bg-slate-300"
    : "bg-red-300";

  // Apply visual distinction for days outside the current month range
  const outsideRangeClass = day.isOutsideRange ? "opacity-50" : "";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 ${
        isWeekendEmpty ? "opacity-40" : outsideRangeClass
      }`}
    >
      <div className={`h-2 w-2 rounded-full shrink-0 ${dotCls}`} />
      <div className="w-[68px] shrink-0">
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
          {dayLabel}
        </p>
        <p className="text-xs font-bold leading-snug mt-0.5">{dateLabel}</p>
      </div>

      {isNonWorkingDay && !day.ci && !day.absent ? (
        <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded font-bold uppercase tracking-wide">
          Rest Day
        </span>
      ) : day.isFuture ? (
        <p className="text-xs text-muted-foreground/60 italic">Upcoming</p>
      ) : isWeekendEmpty ? (
        <p className="text-xs text-muted-foreground/50">Weekend</p>
      ) : day.absent ? (
        <p className="text-xs text-purple-600 font-medium">
          {day.absenceReason ?? "Excused absence"}
        </p>
      ) : day.ci ? (
        <div className="flex items-center gap-1.5 flex-1 min-w-0 text-xs">
          <span className="font-semibold tabular-nums">{formatTime(day.ci)}</span>
          <span className="text-muted-foreground text-[10px]">→</span>
          <span className={`font-semibold tabular-nums ${!day.co ? "text-blue-500" : ""}`}>
            {day.co ? formatTime(day.co) : "…"}
          </span>
          {day.hours && (
            <span className="ml-auto shrink-0 text-[10px] font-bold text-muted-foreground tabular-nums">
              {day.hours.toFixed(1)}h
            </span>
          )}
          <div className="flex gap-1 shrink-0">
            {day.isLate && (
              <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-bold">
                Late
              </span>
            )}
            {(day.hours ?? 0) > 8 && (
              <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded font-bold">
                OT
              </span>
            )}
            {isNonWorkingDay && (
              <span className="text-[9px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
                EXTRA DAY
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No record</p>
      )}
    </div>
  );
}

// ─── Attendance Summary Bar ───────────────────────────────────────────────────

function AttendanceSummary({ days }: Readonly<{ days: SliderDay[] }>) {
  const workdays = days.filter((d) => !d.isWeekend && !d.isFuture);
  const present = workdays.filter((d) => d.ci && !d.absent).length;
  const lateCount = workdays.filter((d) => d.ci && d.isLate).length;
  const absentCount = workdays.filter((d) => !d.ci && !d.absent).length;
  const excused = workdays.filter((d) => d.absent).length;
  const compliance =
    workdays.length > 0 ? Math.round((present / workdays.length) * 100) : 0;
  const compCls =
    compliance >= 90 ? "text-green-600" : compliance >= 70 ? "text-amber-600" : "text-red-500";

  return (
    <div className="shrink-0 border-b border-border bg-muted/10">
      <div className="grid grid-cols-5 divide-x divide-border/60">
        {[
          { label: "Present", value: String(present), cls: "text-green-600" },
          { label: "Late", value: String(lateCount), cls: "text-amber-600" },
          { label: "Absent", value: String(absentCount), cls: "text-red-500" },
          { label: "Excused", value: String(excused), cls: "text-purple-600" },
          { label: "Compliance", value: `${compliance}%`, cls: compCls },
        ].map(({ label, value, cls }) => (
          <div key={label} className="flex flex-col items-center py-3 px-1">
            <p className={`text-sm font-bold ${cls}`}>{value}</p>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5 text-center leading-tight">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Employee Slide-Over ──────────────────────────────────────────────────────

function EmployeeSlideOver({
  name,
  employeeId,
  userId,
  avatarUrl,
  dashboardFilter,
  dashboardFrom,
  dashboardTo,
  locationDisplayMode,
  canEditSchedule,
  onClose,
  onEditSchedule,
}: Readonly<{
  name: string;
  employeeId: string;
  userId: string;
  avatarUrl?: string | null;
  dashboardFilter: ViewMode;
  dashboardFrom: string;
  dashboardTo: string;
  locationDisplayMode: LocationDisplayMode;
  canEditSchedule: boolean;
  onClose: () => void;
  onEditSchedule: (employeeId: string, name: string, schedule: any) => void;
}>) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>("today");
  const [todayDetail, setTodayDetail] = useState<EmployeeDetail | null>(null);
  const [allPunches, setAllPunches] = useState<PunchRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [editAttendanceOpen, setEditAttendanceOpen] = useState(false);
  const [editTimeIn, setEditTimeIn] = useState("");
  const [editTimeOut, setEditTimeOut] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editQuickAction, setEditQuickAction] = useState<AttendanceQuickAction>("custom");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const summaryDate = dashboardFilter === "day" ? dashboardFrom : dashboardTo;

  const fetchDayDetail = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/timekeeping/timesheets/${userId}/${summaryDate}`);
    if (!res.ok) return null;
    return (await res.json()) as EmployeeDetail;
  }, [summaryDate, userId]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Fetch detail for selected date (day mode) or range end date (period modes)
  useEffect(() => {
    setFetching(true);
    fetchDayDetail()
      .then((data) => setTodayDetail(data))
      .catch(() => setTodayDetail(null))
      .finally(() => setFetching(false));
  }, [fetchDayDetail]);

  // Fetch range data for Schedule & Attendance Details tabs
  useEffect(() => {
    if (dashboardFilter === "day") return; // No need for range data in day view

    setFetching(true);
    authFetch(`${API_BASE_URL}/timekeeping/timesheets?from=${dashboardFrom}&to=${dashboardTo}`)
      .then((r) => (r.ok ? (r.json() as Promise<PunchRow[]>) : Promise.resolve([])))
      .then((data) => setAllPunches(data))
      .catch(() => setAllPunches([]))
      .finally(() => setFetching(false));
  }, [dashboardFrom, dashboardTo, dashboardFilter]);

  useEffect(() => {
    const punches = (todayDetail?.punches ?? []).filter(
      (p) => String(p.log_status ?? "").toUpperCase() !== "DENIED",
    );
    const timeIn = punches.find((p) => p.log_type === "time-in") ?? null;
    const timeOut = punches.find((p) => p.log_type === "time-out") ?? null;
    setEditTimeIn(toTimeInputValue(timeIn?.timestamp));
    setEditTimeOut(toTimeInputValue(timeOut?.timestamp));
  }, [todayDetail]);

  const handleClose = () => {
    setMounted(false);
    setTimeout(onClose, 260);
  };

  const submitAttendanceEdit = async () => {
    const trimmedReason = editReason.trim();
    if (!trimmedReason) {
      setEditError("Edit reason is required.");
      return;
    }
    if (editQuickAction !== "excused" && editQuickAction !== "absent" && !editTimeIn && !editTimeOut) {
      setEditError("Provide at least a time-in or time-out value.");
      return;
    }

    setEditSubmitting(true);
    setEditError(null);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/timekeeping/attendance/${userId}/${summaryDate}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            time_in: editTimeIn || undefined,
            time_out: editTimeOut || undefined,
            attendance_status: editQuickAction === "custom" ? undefined : editQuickAction,
            absence_reason:
              editQuickAction === "excused"
                ? "Excused by HR"
                : editQuickAction === "absent"
                ? "Marked absent by HR"
                : undefined,
            edit_reason: trimmedReason,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { message?: string }));
        throw new Error(err.message || "Failed to update attendance.");
      }

      const refreshed = await fetchDayDetail();
      setTodayDetail(refreshed);
      setEditAttendanceOpen(false);
      setEditReason("");
      setEditQuickAction("custom");
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Failed to update attendance.",
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const canShowAvatar = !!avatarUrl && !avatarFailed;

  const TABS: { key: TabMode; label: string }[] = dashboardFilter === "day"
    ? [
        { key: "today",    label: "Summary"  },
        { key: "schedule", label: "Schedule" },
      ]
    : [
        { key: "today",      label: "Summary"  },
        { key: "schedule",   label: "Schedule" },
        { key: "attendance", label: "History"  },
      ];

  const formatDateLabel = useCallback((iso: string) => {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    });
  }, []);
  const formatScheduleClock = useCallback((value: string | null | undefined) => {
    if (!value) return "—";
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return value;
    const hours = Number.parseInt(match[1], 10);
    if (Number.isNaN(hours)) return value;
    const mins = match[2];
    const suffix = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${mins} ${suffix}`;
  }, []);

  const summaryDateLabel = formatDateLabel(summaryDate);
  const selectedRangeLabel = `${formatDateLabel(dashboardFrom)} - ${formatDateLabel(dashboardTo)}`;
  const effectiveScheduleLabel = dashboardFilter === "day" ? summaryDateLabel : selectedRangeLabel;

  // Today data - declare schedule first since sliderDays needs it
  const todayPunches = (todayDetail?.punches ?? []).filter(
    (p) => String(p.log_status ?? "").toUpperCase() !== "DENIED",
  );
  const timeIn = todayPunches.find((p) => p.log_type === "time-in") ?? null;
  const timeOut = todayPunches.find((p) => p.log_type === "time-out") ?? null;
  const schedule = todayDetail?.schedule ?? null;
  const scheduleStart = schedule?.start_time?.slice(0, 5) || "09:00";
  const scheduleEnd = schedule?.end_time?.slice(0, 5) || "18:00";

  const applyQuickAction = (action: AttendanceQuickAction) => {
    setEditQuickAction(action);
    setEditError(null);
    if (action === "clocked-in") {
      setEditTimeIn(getCurrentManilaTimeInput());
      setEditTimeOut("");
      setEditReason("HR quick mark: employee is currently clocked in after HR review.");
    } else if (action === "present") {
      setEditTimeIn(scheduleStart);
      setEditTimeOut(scheduleEnd);
      setEditReason("HR quick mark: employee completed workday but attendance logs were missing or incorrect.");
    } else if (action === "excused") {
      setEditTimeIn("");
      setEditTimeOut("");
      setEditReason("HR quick mark: employee excused due to emergency or approved circumstance.");
    } else if (action === "absent") {
      setEditTimeIn("");
      setEditTimeOut("");
      setEditReason("HR quick mark: employee absent after HR review.");
    }
  };
  const scheduleWorkdays = useMemo(() => {
    if (!schedule?.workdays) return [];
    const source = Array.isArray(schedule.workdays)
      ? schedule.workdays
      : schedule.workdays.split(",");
    const map: Record<string, string> = {
      MON: "Mon", TUE: "Tue", TUES: "Tue", WED: "Wed", THU: "Thu", THURS: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun",
    };
    return source
      .map((d) => d.trim().toUpperCase())
      .map((d) => map[d] ?? d)
      .filter(Boolean);
  }, [schedule]);

  // Data for attendance tab
  const allSliderDays =
    dashboardFilter !== "day" ? buildSliderDays(allPunches, employeeId, dashboardFrom, dashboardTo, schedule) : [];
  
  // Mark non-working days based on schedule
  const sliderDays = schedule ? allSliderDays.map((day) => {
    const dayOfWeek = new Date(day.date + "T12:00:00").getDay();
    const workdaysStr = typeof schedule.workdays === "string" ? schedule.workdays : schedule.workdays.join(",");
    const workdayNames = workdaysStr.toUpperCase().split(",");
    const dayMap: Record<string, number> = {
      SUN: 0, MON: 1, TUES: 2, TUE: 2, WED: 3, THURS: 4, THU: 4, FRI: 5, SAT: 6,
    };
    const workdayIndices = workdayNames.map((d) => dayMap[d.trim()]).filter((i) => i !== undefined);
    const isScheduledWorkday = workdayIndices.includes(dayOfWeek);
    
    return {
      ...day,
      isScheduledWorkday, // New flag to identify if this is a scheduled workday
    };
  }) : allSliderDays.map((day) => ({ ...day, isScheduledWorkday: true })); // If no schedule, assume all days are workdays
  
  const monthStart = dashboardFilter === "month" ? new Date(dashboardFrom + "T12:00:00") : new Date();
  const weekGroups = dashboardFilter === "month" ? groupIntoWeeks(sliderDays, monthStart) : [];

  // Calculate worked hours for Schedule tab
  const calculateWorkedHours = (): { totalHours: number; scheduledDays: number } => {
    if (dashboardFilter === "day" || !schedule) {
      return { totalHours: 0, scheduledDays: 0 };
    }

    const workdaysStr =
      typeof schedule.workdays === "string" ? schedule.workdays : schedule.workdays.join(",");
    const workdayNames = workdaysStr.toUpperCase().split(",");
    const dayMap: Record<string, number> = {
      SUN: 0,
      MON: 1,
      TUES: 2,
      TUE: 2,
      WED: 3,
      THURS: 4,
      THU: 4,
      FRI: 5,
      SAT: 6,
    };
    const workdayIndices = workdayNames.map((d) => dayMap[d.trim()]).filter((i) => i !== undefined);

    // Count scheduled days in range
    let scheduledDays = 0;
    const cur = new Date(dashboardFrom + "T12:00:00");
    const end = new Date(dashboardTo + "T12:00:00");
    while (cur <= end) {
      if (workdayIndices.includes(cur.getDay())) scheduledDays++;
      cur.setDate(cur.getDate() + 1);
    }

    // Calculate actual worked hours
    const empPunches = allPunches.filter((p) => p.employee_id === employeeId);
    const dailyLogs = new Map<string, { ci: string | null; co: string | null }>();

    for (const p of empPunches) {
      const date = p.timestamp.split("T")[0];
      if (!dailyLogs.has(date)) dailyLogs.set(date, { ci: null, co: null });
      if (String(p.log_status ?? "").toUpperCase() === "DENIED") continue;
      const log = dailyLogs.get(date)!;
      if (p.log_type === "time-in" && !log.ci) log.ci = p.timestamp;
      if (p.log_type === "time-out") log.co = p.timestamp;
    }

    let totalHours = 0;

    for (const [_, log] of dailyLogs) {
      if (log.ci && log.co) {
        const worked = computeHoursDecimal(log.ci, log.co) ?? 0;
        // Deduct 1 hour for break
        totalHours += Math.max(0, worked - 1);
      }
    }

    return { totalHours, scheduledDays };
  };

  const { totalHours, scheduledDays } = calculateWorkedHours();

  const toggleWeek = (key: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      {editAttendanceOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-bold">Edit Attendance</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {name} · {summaryDate}
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Quick HR Actions
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    {
                      value: "clocked-in",
                      label: "Mark Clocked In",
                      sub: "Current time",
                      idle: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
                      active: "border-blue-600 bg-blue-600 text-white",
                    },
                    {
                      value: "present",
                      label: "Mark Present",
                      sub: "Time-in + out",
                      idle: "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
                      active: "border-green-600 bg-green-600 text-white",
                    },
                    {
                      value: "excused",
                      label: "Mark Excused",
                      sub: "Approved excuse",
                      idle: "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100",
                      active: "border-purple-600 bg-purple-600 text-white",
                    },
                    {
                      value: "absent",
                      label: "Mark Absent",
                      sub: "HR reviewed",
                      idle: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                      active: "border-red-600 bg-red-600 text-white",
                    },
                  ] as const).map((action) => {
                    const active = editQuickAction === action.value;
                    return (
                      <button
                        key={action.value}
                        type="button"
                        onClick={() => applyQuickAction(action.value)}
                        className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                          active ? action.active : action.idle
                        }`}
                      >
                        <span className="block text-xs font-bold">{action.label}</span>
                        <span className={`block text-[10px] mt-0.5 ${active ? "text-white/80" : "opacity-75"}`}>
                          {action.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Time In</label>
                  <Input
                    type="time"
                    value={editTimeIn}
                    onChange={(e) => {
                      setEditQuickAction("custom");
                      setEditTimeIn(e.target.value);
                    }}
                    className="h-9 mt-1"
                    disabled={editQuickAction === "excused" || editQuickAction === "absent"}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Time Out</label>
                  <Input
                    type="time"
                    value={editTimeOut}
                    onChange={(e) => {
                      setEditQuickAction("custom");
                      setEditTimeOut(e.target.value);
                    }}
                    className="h-9 mt-1"
                    disabled={editQuickAction === "excused" || editQuickAction === "absent"}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Edit Reason (required)</label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  maxLength={500}
                  className="mt-1 w-full min-h-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Describe why this attendance correction is needed..."
                />
              </div>
              {editError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {editError}
                </p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditAttendanceOpen(false);
                  setEditError(null);
                  setEditQuickAction("custom");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submitAttendanceEdit()}
                disabled={editSubmitting}
              >
                {editSubmitting ? "Saving..." : "Save Attendance"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity duration-200 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md z-50 bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          mounted ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm border border-primary/10 shrink-0 overflow-hidden">
              {canShowAvatar ? (
                <img
                  src={avatarUrl}
                  alt={name || "Employee avatar"}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                initials
              )}
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{employeeId}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 bg-background">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {fetching ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Loading records…</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {/* ── SUMMARY TAB ────────────────────────────────────────────── */}
            {activeTab === "today" && (
              <div className="p-5 space-y-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {dashboardFilter === "day"
                    ? `Summary for ${summaryDateLabel}`
                    : `Day snapshot: ${summaryDateLabel}`}
                </p>
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => {
                      setEditError(null);
                      setEditQuickAction("custom");
                      setEditAttendanceOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Attendance
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    {
                      label: "Time In",
                      value: formatTime(timeIn?.timestamp ?? null),
                      icon: LogIn,
                      cls: "text-green-600",
                    },
                    {
                      label: "Time Out",
                      value: formatTime(timeOut?.timestamp ?? null),
                      icon: LogOut,
                      cls: "text-red-500",
                    },
                    {
                      label: "Hours",
                      value: formatHoursLabel(timeIn?.timestamp ?? null, timeOut?.timestamp ?? null),
                      icon: Timer,
                      cls: "text-blue-600",
                    },
                  ].map(({ label, value, icon: Icon, cls }) => (
                    <div
                      key={label}
                      className="p-3 rounded-xl border border-border bg-background text-center"
                    >
                      <Icon className={`h-4 w-4 mx-auto mb-1 ${cls}`} />
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                        {label}
                      </p>
                      <p className="font-bold text-sm">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Period summary — shown in week/month/custom views */}
                {dashboardFilter !== "day" && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                      Selected Range
                    </p>
                    <p className="text-[11px] text-muted-foreground mb-2">{selectedRangeLabel}</p>
                    <div className="flex items-baseline gap-2 text-sm flex-wrap">
                      <span className="text-2xl font-bold text-primary">{totalHours.toFixed(1)}h</span>
                      <span className="text-muted-foreground">total</span>
                      <span className="mx-1 text-border">|</span>
                      <span className="text-lg font-bold">{scheduledDays}</span>
                      <span className="text-muted-foreground">scheduled workdays</span>
                    </div>
                  </div>
                )}

                {todayPunches.length > 0 ? (
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
                      Timeline • {summaryDateLabel}
                    </p>
                    <div className="rounded-xl border border-border overflow-hidden">
                      {todayPunches.map((p) => {
                        const isIn = p.log_type === "time-in";
                        const isOut = p.log_type === "time-out";
                        return (
                          <div
                            key={p.log_id}
                            className="flex items-start gap-3 px-4 py-3 border-b border-border/40 last:border-0"
                          >
                            <div
                              className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 border ${
                                isIn
                                  ? "bg-green-100 border-green-200"
                                  : isOut
                                  ? "bg-red-50 border-red-200"
                                  : "bg-purple-50 border-purple-200"
                              }`}
                            >
                              {isIn ? (
                                <LogIn className="h-3 w-3 text-green-600" />
                              ) : isOut ? (
                                <LogOut className="h-3 w-3 text-red-500" />
                              ) : (
                                <FileX className="h-3 w-3 text-purple-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold capitalize">
                                  {p.log_type.replace("-", " ")}
                                </p>
                                <p className="text-xs font-mono text-muted-foreground">
                                  {formatTime(p.timestamp)}
                                </p>
                              </div>
                              {p.latitude != null && p.longitude != null ? (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3 text-green-600" />
                                  {formatGpsForMode(
                                    p.latitude,
                                    p.longitude,
                                    p.location_name,
                                    locationDisplayMode,
                                  )}
                                </p>
                              ) : (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPinOff className="h-3 w-3" /> No GPS
                                </p>
                              )}
                              {p.clock_type && (
                                <span
                                  className={`mt-1 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    p.clock_type === "LATE"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  {p.clock_type}
                                </span>
                              )}
                              {p.log_type === "absence" && (
                                <div className="mt-1.5 space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-purple-100 text-purple-700 border-purple-200">
                                      {p.absence_reason ?? "Absence"}
                                    </span>
                                    {p.log_status && (
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                          p.log_status === "APPROVED"
                                            ? "bg-green-100 text-green-700 border-green-200"
                                            : p.log_status === "PENDING"
                                            ? "bg-amber-100 text-amber-700 border-amber-200"
                                            : p.log_status === "DENIED"
                                            ? "bg-red-100 text-red-700 border-red-200"
                                            : "bg-slate-100 text-slate-600 border-slate-200"
                                        }`}
                                      >
                                        {p.log_status}
                                      </span>
                                    )}
                                  </div>
                                  {(p.reviewed_by_name || p.review_reason) && (
                                    <div className="text-[10px] text-muted-foreground space-y-0.5 pl-1 border-l-2 border-border">
                                      {p.reviewed_by_name && (
                                        <p>Reviewed by <span className="font-semibold text-foreground">{p.reviewed_by_name}</span></p>
                                      )}
                                      {p.review_reason && (
                                        <p className="italic">&ldquo;{p.review_reason}&rdquo;</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      {`No punch records for ${summaryDateLabel}.`}
                    </p>
                    {dashboardFilter !== "day" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Range summary above covers {selectedRangeLabel}.
                      </p>
                    )}
                  </div>
                )}

                {todayDetail?.attendance_audits && todayDetail.attendance_audits.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
                      Attendance Edit Audit
                    </p>
                    <div className="rounded-xl border border-border overflow-hidden">
                      {todayDetail.attendance_audits.map((audit) => (
                        <div
                          key={audit.audit_id}
                          className="px-4 py-3 border-b border-border/40 last:border-b-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold">Correction Applied</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(audit.edited_at).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {audit.edit_reason}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>Edited by</span>
                            <span className="font-semibold text-foreground">
                              {audit.edited_by_name || audit.edited_by || "Unknown"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SCHEDULE TAB ───────────────────────────────────────────── */}
            {activeTab === "schedule" && (
              <div className="p-5 space-y-4">
                {schedule ? (
                  <>
                    <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                          Scheduled Time
                        </p>
                        <span className="text-[9px] px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-bold uppercase tracking-wide">
                          {schedule.is_nightshift ? "Night Shift" : "Day Shift"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-semibold">{formatScheduleClock(schedule.start_time)}</span>
                        <span className="text-muted-foreground text-xs">{'>'}</span>
                        <span className="font-semibold">{formatScheduleClock(schedule.end_time)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Effective: <span className="font-medium text-foreground">{effectiveScheduleLabel}</span>
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border bg-background">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Workdays</p>
                      <div className="flex flex-wrap gap-1.5">
                        {scheduleWorkdays.length > 0 ? (
                          scheduleWorkdays.map((day) => (
                            <span key={day} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold border border-primary/20">
                              {day}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No workdays configured.</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No schedule assigned for this selected period.</p>
                  </div>
                )}
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canEditSchedule}
                    className="w-full h-9 gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                    onClick={() => onEditSchedule(employeeId, name, schedule)}
                  >
                    {canEditSchedule ? "Edit Schedule" : "View Only"}
                  </Button>
                  {!canEditSchedule && (
                    <p className="text-[11px] text-muted-foreground mt-2 text-center">
                      Editing is limited to HR and System Admin.
                    </p>
                  )}
                </div>
              </div>
            )}

{/* ── HISTORY TAB (Week / Month / Custom only) ───────────────── */}
            {activeTab === "attendance" && (
              <>
                {dashboardFilter === "week" ? (
                  // Weekly view - show summary + daily list
                  <>
                    <AttendanceSummary days={sliderDays} />
                    <div>
                      {sliderDays.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">
                          No records this week.
                        </p>
                      ) : (
                        sliderDays.map((day) => <DayCompactRow key={day.date} day={day} />)
                      )}
                    </div>
                  </>
                ) : (
                  // Monthly or Custom view - show summary + weekly groups
                  <>
                    <AttendanceSummary days={sliderDays} />
                    <div className="p-3 space-y-2">
                      {weekGroups.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No records in this period.
                        </p>
                      ) : (
                        weekGroups.map((group) => {
                          const isExpanded = expandedWeeks.has(group.key);
                          const presentDays = group.days.filter(
                            (d) => d.ci && !d.absent && !d.isFuture
                          ).length;
                          return (
                            <div
                              key={group.key}
                              className="rounded-xl border border-border overflow-hidden"
                            >
                              <button
                                onClick={() => toggleWeek(group.key)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5 text-left">
                                  <ChevronRight
                                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${
                                      isExpanded ? "rotate-90" : ""
                                    }`}
                                  />
                                  <div>
                                    <p className="text-xs font-bold">Week {group.weekNumber}</p>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">
                                      {presentDays} present · {group.totalHours.toFixed(1)}h
                                    </p>
                                  </div>
                                </div>
                                {/* Dot strip preview */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {group.days
                                    .filter((d) => !d.isWeekend)
                                    .map((d) => (
                                      <div
                                        key={d.date}
                                        className={`h-2 w-2 rounded-full ${
                                          d.isFuture
                                            ? "bg-slate-200"
                                            : d.absent
                                            ? "bg-purple-400"
                                            : d.ci && d.isLate
                                            ? "bg-amber-400"
                                            : d.ci
                                            ? "bg-green-500"
                                            : "bg-red-300"
                                        }`}
                                      />
                                    ))}
                                </div>
                              </button>
                              {isExpanded && (
                                <div className="bg-background">
                                  {group.days.map((day) => (
                                    <DayCompactRow key={day.date} day={day} />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Filter constants ─────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "present",    label: "Present" },
  { value: "absent",     label: "Absent" },
  { value: "excused",    label: "Excused" },
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
    "excused":    { active: "bg-purple-600 text-white border-purple-600", idle: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" },
    "rest-day":   { active: "bg-sky-600 text-white border-sky-600", idle: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100" },
    "no-schedule":{ active: "bg-slate-600 text-white border-slate-600", idle: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100" },
  };
  return active ? tones[value].active : tones[value].idle;
}

const ITEMS_PER_PAGE = 8;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HRTimekeepingPage() {
  const [viewMode, setViewMode]         = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customFrom, setCustomFrom]     = useState("");
  const [customTo, setCustomTo]         = useState("");
  const [roster, setRoster]             = useState<RosterEntry[]>([]);
  const [periodData, setPeriodData]     = useState<PeriodEntry[]>([]);
  const [users, setUsers]               = useState<UserRow[]>([]);
  const [departments, setDepartments]   = useState<DepartmentOption[]>([]);
  const [allPunches, setAllPunches]     = useState<PunchRow[]>([]);
  const [calendarPunches, setCalendarPunches] = useState<PunchRow[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState(false);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>("all");
  const [deptFilter, setDeptFilter]       = useState<string | null>(null);
  const [showTKFilter, setShowTKFilter]   = useState(false);
  const [tkFilterPos, setTKFilterPos]     = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const tkFilterBtnRef                    = useRef<HTMLButtonElement>(null);
  const tkFilterDropRef                   = useRef<HTMLDivElement>(null);
  const [page, setPage]                   = useState(1);

  // Period navigation offsets
  const [weekOffset, setWeekOffset]   = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  // Live clock for hero banner
  const [liveTime, setLiveTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Manila" })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setLiveTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Manila" }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch departments once on mount
  useEffect(() => {
    authFetch(`${API_BASE_URL}/users/departments`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { department_id: string; department_name: string }[]) => {
        setDepartments(data.map(d => ({ id: d.department_id, name: d.department_name })));
      })
      .catch(() => {});
  }, []);

  // Filter dropdown click-outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!tkFilterBtnRef.current?.contains(t) && !tkFilterDropRef.current?.contains(t))
        setShowTKFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Slide-over
  const [drillUser, setDrillUser] = useState<{
    userId: string;
    employeeId: string;
    name: string;
    avatarUrl?: string | null;
  } | null>(null);

  // Schedule modals
  const [showScheduleModal, setShowScheduleModal]     = useState(false);
  const [scheduleModalPreset, setScheduleModalPreset] = useState<ScheduleModalPreset>(null);
  const [editScheduleUser, setEditScheduleUser]       = useState<{ employeeId: string; name: string; schedule: any; effectiveLabel?: string } | null>(null);
  const [scheduleRosterRefreshKey, setScheduleRosterRefreshKey] = useState(0);
  const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
  const [absenceRequestsLoading, setAbsenceRequestsLoading] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{
    request: AbsenceRequest;
    action: "approve" | "deny";
  } | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Main panel toggle
  const [mainPanel, setMainPanel] = useState<"attendance" | "schedules">("attendance");
  const [locationDisplayMode, setLocationDisplayMode] = useState<LocationDisplayMode>("place");

  // Calendar grid view
  const [calendarMode, setCalendarMode]               = useState<CalendarViewMode>("month");
  const [showCalendar, setShowCalendar]               = useState(false);
  const [calPickerNav, setCalPickerNav]               = useState<Date | null>(null);

  const weekRange  = useMemo(() => getWeekRange(weekOffset),   [weekOffset]);
  const monthRange = useMemo(() => getMonthRange(monthOffset), [monthOffset]);

  const { from, to } = useMemo(() => {
    if (viewMode === "week")   return { from: weekRange.from,  to: weekRange.to };
    if (viewMode === "month")  return { from: monthRange.from, to: monthRange.to };
    if (viewMode === "custom") return { from: customFrom || toDateString(new Date()), to: customTo || toDateString(new Date()) };
    const d = toDateString(selectedDate);
    return { from: d, to: d };
  }, [viewMode, selectedDate, weekRange, monthRange, customFrom, customTo]);
  const effectiveLabel = useMemo(() => {
    const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila",
    });
    return `${fmt(from)} – ${fmt(to)}`;
  }, [from, to]);

  const refreshAbsenceRequests = useCallback(() => {
    setAbsenceRequestsLoading(true);
    return authFetch(`${API_BASE_URL}/timekeeping/absence-requests`)
      .then((r) => (r.ok ? (r.json() as Promise<AbsenceRequest[]>) : Promise.resolve([])))
      .then((rows) => setAbsenceRequests(rows))
      .catch(() => setAbsenceRequests([]))
      .finally(() => setAbsenceRequestsLoading(false));
  }, []);

  const refreshTimekeepingData = useCallback((resetPage: boolean = true) => {
    if (viewMode === "custom" && (!customFrom || !customTo)) return;

    setLoading(true);
    setFetchError(false);
    if (resetPage) setPage(1);

    return Promise.all([
      authFetch(`${API_BASE_URL}/timekeeping/employees?asOf=${from}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<UserRow[]>; }),
      authFetch(`${API_BASE_URL}/timekeeping/timesheets?from=${from}&to=${to}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<PunchRow[]>; }),
    ])
      .then(([u, p]) => {
        setUsers(u);
        setAllPunches(p);
        if (viewMode === "day") {
          setRoster(buildFullRoster(u, p, from));
          setPeriodData([]);
        } else {
          setPeriodData(buildPeriodRoster(u, p, from, to));
          setRoster([]);
        }
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [customFrom, customTo, from, to, viewMode]);

  useEffect(() => {
    void refreshTimekeepingData();
  }, [refreshTimekeepingData]);

  useEffect(() => {
    if (mainPanel !== "attendance") return;
    void refreshAbsenceRequests();
  }, [mainPanel, refreshAbsenceRequests]);

  // Open drill-down panel — slide-over fetches its own data per selected period
  const openDrill = useCallback((
    userId: string,
    employeeId: string,
    name: string,
    avatarUrl?: string | null,
  ) => {
    setDrillUser({ userId, employeeId, name, avatarUrl: avatarUrl ?? null });
  }, []);

  const submitAbsenceReview = useCallback(async () => {
    if (!reviewTarget) return;
    const trimmedReason = reviewReason.trim();
    if (!trimmedReason) return;

    setReviewSubmitting(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/timekeeping/absence-requests/${reviewTarget.request.log_id}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: reviewTarget.action,
            review_reason: trimmedReason,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { message?: string }));
        throw new Error(err.message || "Failed to review absence request.");
      }

      setReviewTarget(null);
      setReviewReason("");
      await Promise.all([refreshAbsenceRequests(), refreshTimekeepingData(false)]);
    } catch (error) {
      console.error(error);
    } finally {
      setReviewSubmitting(false);
    }
  }, [refreshAbsenceRequests, refreshTimekeepingData, reviewReason, reviewTarget]);

  const stats       = useMemo(() => computeStats(roster), [roster]);
  const periodStats = useMemo(() => computePeriodStats(periodData), [periodData]);

  const isDayView  = viewMode === "day";
  const isPeriod   = !isDayView;

  // departments is fetched from /users/departments on mount (see useEffect above)

  const filteredRoster = useMemo(() => {
    const q = search.toLowerCase();
    return roster.filter(r => {
      const name = `${r.first_name} ${r.last_name}`.toLowerCase();
      const matchSearch = name.includes(q) || r.employee_id.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchDept   = deptFilter === null || r.department_id === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [roster, search, statusFilter, deptFilter]);

  const filteredPeriod = useMemo(() => {
    const q = search.toLowerCase();
    return periodData.filter(e => {
      const name = `${e.first_name} ${e.last_name}`.toLowerCase();
      const matchSearch = name.includes(q) || e.employee_id.toLowerCase().includes(q);
      const matchDept   = deptFilter === null || e.department_id === deptFilter;
      return matchSearch && matchDept;
    });
  }, [periodData, search, deptFilter]);

  const calendarReferenceDate = useMemo(() => {
    if (viewMode === "day") return selectedDate;
    if (viewMode === "week") return new Date(`${weekRange.from}T12:00:00`);
    if (viewMode === "month") return new Date(`${monthRange.from}T12:00:00`);
    if (customFrom) return new Date(`${customFrom}T12:00:00`);
    return new Date();
  }, [viewMode, selectedDate, weekRange.from, monthRange.from, customFrom]);

  // When the floating picker navigates, use its nav date for calendar data fetching
  const calEffectiveRef = calPickerNav ?? calendarReferenceDate;
  const calendarRange = useMemo(
    () => getCalendarRange(calendarMode, calEffectiveRef),
    [calendarMode, calEffectiveRef]
  );

  const filteredUsersForCalendar = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const name = `${u.first_name} ${u.last_name}`.toLowerCase();
      const matchSearch = name.includes(q) || u.employee_id.toLowerCase().includes(q);
      const matchDept = deptFilter === null || u.department_id === deptFilter;
      return matchSearch && matchDept;
    });
  }, [users, search, deptFilter]);

  useEffect(() => {
    if (!showCalendar) return;

    let cancelled = false;
    setCalendarLoading(true);

    authFetch(`${API_BASE_URL}/timekeeping/timesheets?from=${calendarRange.from}&to=${calendarRange.to}`)
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<PunchRow[]>;
      })
      .then((rows) => {
        if (!cancelled) setCalendarPunches(rows);
      })
      .catch(() => {
        if (!cancelled) setCalendarPunches([]);
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false);
      });

    return () => { cancelled = true; };
  }, [showCalendar, calendarRange.from, calendarRange.to]);

  const calendarDays = useMemo<CalendarDayData[]>(() => {
    const today = toDateString(new Date());
    const employeeIds = new Set(filteredUsersForCalendar.map((u) => u.employee_id));
    const userMap = new Map(filteredUsersForCalendar.map((user) => [user.employee_id, user]));
    const dateMap: Record<string, { presentIds: Set<string>; lateIds: Set<string>; absentIds: Set<string> }> = {};

    for (const punch of calendarPunches) {
      if (!employeeIds.has(punch.employee_id)) continue;
      const date = punch.timestamp.split("T")[0];
      if (!dateMap[date]) dateMap[date] = { presentIds: new Set(), lateIds: new Set(), absentIds: new Set() };
      if (punch.log_type === "time-in") {
        dateMap[date].presentIds.add(punch.employee_id);
        if (isLate(punch.timestamp, punch.clock_type, userMap.get(punch.employee_id)?.schedule)) {
          dateMap[date].lateIds.add(punch.employee_id);
        }
      }
      if (punch.log_type === "absence") dateMap[date].absentIds.add(punch.employee_id);
    }

    const totalEmployees = filteredUsersForCalendar.length;

    return listDatesInRange(calendarRange.from, calendarRange.to).map((date): CalendarDayData => {
      const day = dateMap[date];
      if (date > today) return { date, status: "future" };
      const presentTotal = day?.presentIds.size ?? 0;
      const late = day?.lateIds.size ?? 0;
      const absent = day?.absentIds.size ?? 0;
      const summary = { present: presentTotal - late, late, absent, total: totalEmployees };
      if (late > 0) return { date, status: "late", summary };
      if (presentTotal > 0) return { date, status: "present", summary };
      if (absent > 0) return { date, status: "absent", summary };
      return { date, status: "no-schedule" };
    });
  }, [calendarPunches, filteredUsersForCalendar, calendarRange.from, calendarRange.to]);

  // Group summary for active department filter
  const deptSummary = useMemo(() => {
    if (deptFilter === null) return null;
    const list = isDayView ? filteredRoster : filteredPeriod;
    if (list.length === 0) return null;
    if (isDayView) {
      const r = filteredRoster;
      const present = r.filter(x => x.status === "present" || x.status === "clocked-in" || x.status === "late").length;
      const totalHours = r.reduce((s, x) => s + (x.hours_worked ?? 0), 0);
      const avgHours = present > 0 ? totalHours / present : 0;
      const rate = r.length > 0 ? Math.round((present / r.length) * 100) : 0;
      return { count: r.length, present, totalHours, avgHours, rate };
    } else {
      const e = filteredPeriod;
      const totalHours = e.reduce((s, x) => s + x.total_hours, 0);
      const avgHours = e.length > 0 ? totalHours / e.length : 0;
      const avgCompliance = e.length > 0 ? e.reduce((s, x) => s + x.compliance_rate, 0) / e.length : 0;
      return { count: e.length, present: 0, totalHours, avgHours, rate: Math.round(avgCompliance) };
    }
  }, [deptFilter, isDayView, filteredRoster, filteredPeriod]);

  const activeList = isDayView ? filteredRoster : filteredPeriod;
  const totalPages = Math.ceil(activeList.length / ITEMS_PER_PAGE);
  const paged      = activeList.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  function goToPrev()  { setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; }); }
  function goToNext()  { setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }); }
  function goToToday() { setSelectedDate(new Date()); }

  const colSpan = isDayView ? 7 : 8;

  const periodLabel = viewMode === "week" ? weekRange.label
    : viewMode === "month" ? monthRange.label
    : viewMode === "custom" && customFrom && customTo ? `${customFrom} → ${customTo}`
    : "";

  // Table rows
  const tableBody = loading ? (
    <tr><td colSpan={colSpan} className="px-6 py-12 text-center text-muted-foreground text-sm">Loading timekeeping data...</td></tr>
  ) : fetchError ? (
    <tr><td colSpan={colSpan} className="px-6 py-12 text-center text-destructive text-sm">Failed to load data. Please refresh or contact support.</td></tr>
  ) : activeList.length === 0 ? (
    <tr><td colSpan={colSpan} className="px-6 py-12 text-center text-muted-foreground text-sm">
      {search ? "No records match your search." : "No entries found for this period."}
    </td></tr>
  ) : isDayView ? (
    (paged as RosterEntry[]).map(row => (
      <tr
        key={row.employee_id}
        className="group hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() =>
          openDrill(
            row.user_id,
            row.employee_id,
            `${row.first_name} ${row.last_name}`,
            row.avatar_url,
          )
        }
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <EmployeeAvatar
              firstName={row.first_name}
              lastName={row.last_name}
              avatarUrl={row.avatar_url}
            />
            <div className="min-w-0">
              <p className="font-semibold">{`${row.first_name} ${row.last_name}`.trim()}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{row.employee_id}</p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
          </div>
        </td>
        <td className="px-6 py-4 text-xs font-medium">{formatTime(row.time_in)}</td>
        <td className="px-6 py-4 text-xs font-medium">{formatTime(row.time_out)}</td>
        <td className="px-6 py-4 text-xs font-medium">{formatHoursLabel(row.time_in, row.time_out)}</td>
        <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={row.status} /></td>
        <td className="px-6 py-4 max-w-[28rem]">
          {row.absence_reason ? (
            <div className="flex items-center gap-1.5 text-purple-600">
              <FileX className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[10px] font-semibold">{row.absence_reason}</span>
              {row.absence_status && (
                <span
                  className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                    row.absence_status === "APPROVED"
                      ? "bg-purple-100 text-purple-700 border-purple-200"
                      : row.absence_status === "PENDING"
                      ? "bg-amber-100 text-amber-700 border-amber-200"
                      : row.absence_status === "DENIED"
                      ? "bg-red-100 text-red-700 border-red-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {row.absence_status}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        <td className="px-6 py-4">
          {row.status === "absent" || row.status === "excused" || row.status === "rest-day" || row.status === "no-schedule" ? (
            <span className="text-muted-foreground text-xs">—</span>
          ) : row.gps_verified ? (
            <div className="flex min-w-0 items-start gap-1.5 text-green-600">
              <MapPin className="h-3.5 w-3.5 shrink-0 translate-y-0.5" />
              <span className="min-w-0 whitespace-normal break-words text-[10px] font-semibold leading-4">
                {formatGpsForMode(
                  row.clock_in_latitude,
                  row.clock_in_longitude,
                  row.clock_in_location_name,
                  locationDisplayMode,
                )}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPinOff className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">No GPS</span>
            </div>
          )}
        </td>
      </tr>
    ))
  ) : (
    (paged as PeriodEntry[]).map(e => (
      <tr
        key={e.employee_id}
        className="group hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() =>
          openDrill(
            e.user_id,
            e.employee_id,
            `${e.first_name} ${e.last_name}`,
            e.avatar_url,
          )
        }
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <EmployeeAvatar
              firstName={e.first_name}
              lastName={e.last_name}
              avatarUrl={e.avatar_url}
            />
            <div className="min-w-0">
              <p className="font-semibold">{`${e.first_name} ${e.last_name}`.trim()}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{e.employee_id}</p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5">{e.days_present}d</span>
            {e.flagged && <FlagBadge reason={e.flag_reason} />}
          </div>
        </td>
        <td className="px-6 py-4">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-0.5">{e.days_absent}d</span>
        </td>
        <td className="px-6 py-4">
          {e.days_late > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">{e.days_late}d</span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-6 py-4 text-sm font-bold">{e.total_hours.toFixed(1)}h</td>
        <td className="px-6 py-4">
          {e.overtime_hours > 0 ? (
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-0.5">+{e.overtime_hours.toFixed(1)}h</span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-6 py-4"><CompliancePill rate={e.compliance_rate} /></td>
        <td className="px-6 py-4 text-xs text-muted-foreground">
          {e.days_present > 0 ? `${(e.total_hours / e.days_present).toFixed(1)}h avg/day` : "—"}
        </td>
      </tr>
    ))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Schedule Management Modals */}
      {showScheduleModal && (
        <ScheduleManagementModal
          employeeCount={users.length}
          departments={departments}
          employees={users.map(u => ({
            user_id: u.user_id,
            employee_id: u.employee_id,
            first_name: u.first_name,
            last_name: u.last_name,
            department_id: u.department_id,
            department_name: u.department_name ??
              (Array.isArray(u.department)
                ? (u.department[0]?.department_name ?? null)
                : (u.department as { department_name?: string | null } | null)?.department_name ?? null),
          }))}
          initialScope={scheduleModalPreset?.scope}
          initialDepartmentId={scheduleModalPreset?.departmentId}
          initialSchedule={scheduleModalPreset?.schedule}
          onClose={() => {
            setShowScheduleModal(false);
            setScheduleModalPreset(null);
          }}
          onApplied={() => {
            setScheduleRosterRefreshKey(v => v + 1);
            void refreshTimekeepingData(false);
          }}
        />
      )}
      {editScheduleUser && (
        <EmployeeScheduleEditModal
          employeeId={editScheduleUser.employeeId}
          employeeName={editScheduleUser.name}
          currentSchedule={editScheduleUser.schedule}
          effectiveLabel={editScheduleUser.effectiveLabel ?? effectiveLabel}
          onClose={() => setEditScheduleUser(null)}
          onSaved={() => {
            setScheduleRosterRefreshKey(v => v + 1);
            void refreshTimekeepingData(false);
          }}
        />
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-bold">
                {reviewTarget.action === "approve" ? "Approve" : "Deny"} Absence Request
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {reviewTarget.request.first_name} {reviewTarget.request.last_name} · {reviewTarget.request.employee_id}
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Reason: <span className="font-semibold text-foreground">{reviewTarget.request.absence_reason ?? "—"}</span>
              </p>
              <textarea
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                maxLength={500}
                placeholder="Enter review reason (required)..."
                className="w-full min-h-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReviewTarget(null);
                  setReviewReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submitAbsenceReview()}
                disabled={reviewSubmitting || reviewReason.trim().length < 3}
                className={reviewTarget.action === "approve" ? "" : "bg-red-600 hover:bg-red-700"}
              >
                {reviewSubmitting
                  ? "Saving..."
                  : reviewTarget.action === "approve"
                  ? "Approve Request"
                  : "Deny Request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Over */}
      {drillUser && (
        <EmployeeSlideOver
          name={drillUser.name}
          employeeId={drillUser.employeeId}
          userId={drillUser.userId}
          avatarUrl={drillUser.avatarUrl}
          dashboardFilter={viewMode}
          dashboardFrom={from}
          dashboardTo={to}
          locationDisplayMode={locationDisplayMode}
          canEditSchedule={true}
          onClose={() => setDrillUser(null)}
          onEditSchedule={(empId, empName, sched) => setEditScheduleUser({
            employeeId: empId,
            name: empName,
            schedule: sched,
            effectiveLabel,
          })}
        />
      )}

      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-6 md:px-8 md:py-7 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 left-20 h-32 w-32 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: title + live clock */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl border border-white/15 shrink-0">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Timekeeping Management</h1>
              <p className="text-xs text-white/60 mt-0.5">Company-wide attendance and compliance tracking</p>
            </div>
          </div>

          {/* Right: live clock + quick summary */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-white font-mono tabular-nums leading-none">{liveTime}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mt-0.5">Asia/Manila</p>
            </div>
            {!loading && (
              <div className="hidden sm:flex items-center gap-2 border-l border-white/15 pl-4">
                {isDayView ? (
                  <>
                    <span className="flex flex-col items-center px-3 py-1 rounded-lg bg-green-500/15 border border-green-400/20">
                      <span className="text-lg font-bold text-green-300 leading-none">{stats.present + stats.late}</span>
                      <span className="text-[9px] text-green-300/70 uppercase tracking-widest font-bold">In</span>
                    </span>
                    <span className="flex flex-col items-center px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-400/20">
                      <span className="text-lg font-bold text-amber-300 leading-none">{stats.late}</span>
                      <span className="text-[9px] text-amber-300/70 uppercase tracking-widest font-bold">Late</span>
                    </span>
                    <span className="flex flex-col items-center px-3 py-1 rounded-lg bg-red-500/15 border border-red-400/20">
                      <span className="text-lg font-bold text-red-300 leading-none">{stats.absent}</span>
                      <span className="text-[9px] text-red-300/70 uppercase tracking-widest font-bold">Absent</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex flex-col items-center px-3 py-1 rounded-lg bg-blue-500/15 border border-blue-400/20">
                      <span className="text-lg font-bold text-blue-300 leading-none">{periodStats.avgCompliance.toFixed(0)}%</span>
                      <span className="text-[9px] text-blue-300/70 uppercase tracking-widest font-bold">Rate</span>
                    </span>
                    <span className="flex flex-col items-center px-3 py-1 rounded-lg bg-red-500/15 border border-red-400/20">
                      <span className="text-lg font-bold text-red-300 leading-none">{periodStats.flaggedCount}</span>
                      <span className="text-[9px] text-red-300/70 uppercase tracking-widest font-bold">Flagged</span>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── View Controls ────────────────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
          {/* Main panel toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background shadow-xs">
            <button
              onClick={() => setMainPanel("attendance")}
              className={`px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                mainPanel === "attendance" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Attendance
            </button>
            <button
              onClick={() => setMainPanel("schedules")}
              className={`px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                mainPanel === "schedules" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Schedules
            </button>
          </div>

          {mainPanel === "attendance" && <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background shadow-xs">
            {([
              { v: "day",    label: "Day",    icon: CalendarDays },
              { v: "week",   label: "Week",   icon: CalendarRange },
              { v: "month",  label: "Month",  icon: LayoutGrid },
              { v: "custom", label: "Custom", icon: SlidersHorizontal },
            ] as { v: ViewMode; label: string; icon: React.ElementType }[]).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                onClick={() => { setViewMode(v); setPage(1); }}
                className={`px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewMode === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>}
          </div>

          {/* Day nav */}
          {mainPanel === "attendance" && viewMode === "day" && (
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={isToday(selectedDate) ? "default" : "outline"}
                className="h-9 px-4 text-xs font-bold"
                onClick={goToToday}
              >
                {isToday(selectedDate) ? "Today" : "Go to Today"}
              </Button>
              <div className="h-9 px-3 flex items-center border border-border rounded-md text-sm font-medium bg-background min-w-40 justify-center">
                {formatDisplayDate(selectedDate)}
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNext} disabled={isToday(selectedDate)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Week nav */}
          {mainPanel === "attendance" && viewMode === "week" && (
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setWeekOffset(o => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="outline" className="h-9 px-3 text-xs font-bold" onClick={() => setWeekOffset(0)}>
                  This Week
                </Button>
              )}
              <div className="h-9 px-3 flex items-center border border-border rounded-md text-sm font-medium bg-background min-w-52 justify-center">
                <CalendarRange className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                {weekRange.label}
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Month nav */}
          {mainPanel === "attendance" && viewMode === "month" && (
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMonthOffset(o => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {monthOffset !== 0 && (
                <Button variant="outline" className="h-9 px-3 text-xs font-bold" onClick={() => setMonthOffset(0)}>
                  This Month
                </Button>
              )}
              <div className="h-9 px-3 flex items-center border border-border rounded-md text-sm font-medium bg-background min-w-36 justify-center">
                <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                {monthRange.label}
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Custom range pickers */}
          {mainPanel === "attendance" && viewMode === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={e => { setCustomFrom(e.target.value); setPage(1); }}
                max={customTo || toDateString(new Date())}
                className="h-9 px-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-muted-foreground text-sm">→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => { setCustomTo(e.target.value); setPage(1); }}
                min={customFrom}
                max={toDateString(new Date())}
                className="h-9 px-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>

        {/* Display + Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {mainPanel === "attendance" && <div className="hidden md:block h-6 w-px bg-border" />}
          {mainPanel === "attendance" && (
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background shadow-xs">
              <button
                onClick={() => setShowCalendar(v => !v)}
                className={`px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  showCalendar ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Calendar
              </button>
            </div>
          )}
          {mainPanel === "attendance" && (
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background shadow-xs">
              <button
                onClick={() => setLocationDisplayMode("place")}
                className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  locationDisplayMode === "place"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                Place
              </button>
              <button
                onClick={() => setLocationDisplayMode("coordinates")}
                className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  locationDisplayMode === "coordinates"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                Coordinates
              </button>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 cursor-pointer"
            onClick={() => {
              setScheduleModalPreset(null);
              setShowScheduleModal(true);
            }}
          >
            <Calendar className="h-3.5 w-3.5" />
            Manage Schedules
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 cursor-pointer border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-400 transition-colors duration-200 disabled:opacity-40"
            disabled={activeList.length === 0 || loading}
            onClick={() => downloadCSV(activeList as any, isDayView, isDayView ? formatDisplayDate(selectedDate) : periodLabel)}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Schedule Roster ─────────────────────────────────────────────────── */}
      {mainPanel === "schedules" && (
        <div className="space-y-4">
          <CompanyDefaultScheduleCard
            refreshKey={scheduleRosterRefreshKey}
            onChanged={() => {
              setScheduleRosterRefreshKey(v => v + 1);
              void refreshTimekeepingData(false);
            }}
          />
          <ScheduleRosterTable
            canEdit
            refreshKey={scheduleRosterRefreshKey}
            onEditEmployee={(userId, name, schedule) =>
              setEditScheduleUser({ employeeId: userId, name, schedule, effectiveLabel })
            }
            onEditDepartment={(departmentId, _departmentName, schedule) => {
              setScheduleModalPreset({
                scope: "department",
                departmentId,
                schedule: schedule
                  ? {
                      start_time: schedule.start_time,
                      end_time: schedule.end_time,
                      break_start: schedule.break_start,
                      break_end: schedule.break_end,
                      workdays: schedule.workdays,
                      is_nightshift: schedule.is_nightshift,
                    }
                  : null,
              });
              setShowScheduleModal(true);
            }}
          />
        </div>
      )}

      {/* ── Attendance panel (stat cards + calendar + table) ───────────────── */}
      {mainPanel === "attendance" && (<>

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      {isDayView ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users}      label="Total Employees"   value={String(stats.total)}               sub="tracked"                              colorClass="bg-primary/10 text-primary" />
          <StatCard icon={TrendingUp} label="Attendance Rate"   value={`${stats.attendance_rate}%`}       sub={`${stats.present + stats.late} present`} colorClass="bg-green-100 text-green-700" featured />
          <StatCard icon={BarChart2}  label="Total Hours"       value={`${stats.totalHours.toFixed(1)}h`} sub={`${stats.avgHours.toFixed(1)}h avg`}  colorClass="bg-blue-50 text-blue-600" />
          <StatCard icon={Timer}      label="Compliance Issues" value={String(stats.late + stats.absent)} sub={`${stats.late} late · ${stats.absent} absent`} colorClass="bg-red-50 text-red-600" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={Users}     label="Employees"      value={String(periodStats.total)}                  sub="in period"          colorClass="bg-primary/10 text-primary" />
          <StatCard icon={BarChart2} label="Total Hours"    value={`${periodStats.totalHours.toFixed(1)}h`}    sub={periodLabel}        colorClass="bg-blue-50 text-blue-600" />
          <StatCard icon={Timer}     label="Avg Per Person" value={`${periodStats.avgHours.toFixed(1)}h`}      sub="across period"      colorClass="bg-green-50 text-green-600" />
          <StatCard icon={TrendingUp} label="Avg Compliance" value={`${periodStats.avgCompliance.toFixed(0)}%`} sub="attendance rate"   colorClass="bg-indigo-100 text-indigo-700" featured />
          <StatCard icon={AlertTriangle} label="Flagged Employees" value={String(periodStats.flaggedCount)} sub=">3 absent or >2 late" colorClass="bg-red-50 text-red-600" />
        </div>
      )}

      {/* ── Pending Absence Requests ────────────────────────────────────────── */}
      {absenceRequestsLoading || absenceRequests.length > 0 ? (
      <Card className="border-border overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-amber-900">Pending Absence Requests</p>
                {!absenceRequestsLoading && absenceRequests.length > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {absenceRequests.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-700/80 mt-0.5">Employee-reported absences awaiting your review</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300 cursor-pointer shrink-0"
            onClick={() => void refreshAbsenceRequests()}
          >
            Refresh
          </Button>
        </div>

        {/* Body */}
        {absenceRequestsLoading ? (
          <div className="px-5 py-6 flex items-center gap-3 text-sm text-muted-foreground">
            <div className="h-4 w-4 rounded-full border-2 border-amber-400/40 border-t-amber-500 animate-spin shrink-0" />
            Loading pending requests...
          </div>
        ) : (
          <div className="divide-y divide-border">
            {absenceRequests.slice(0, 8).map((request) => {
              const initials = `${request.first_name?.[0] ?? ""}${request.last_name?.[0] ?? ""}`.toUpperCase();
              const reasonLower = (request.absence_reason ?? "").toLowerCase();
              const reasonColor = reasonLower.includes("sick") || reasonLower.includes("medical")
                ? "bg-blue-100 text-blue-700 border-blue-200"
                : reasonLower.includes("emergency")
                  ? "bg-red-100 text-red-700 border-red-200"
                  : reasonLower.includes("personal")
                    ? "bg-violet-100 text-violet-700 border-violet-200"
                    : "bg-amber-100 text-amber-700 border-amber-200";

              return (
                <div key={request.log_id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-muted/30 transition-colors">
                  {/* Avatar + info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-full bg-slate-100 border border-border flex items-center justify-center shrink-0 text-xs font-bold text-slate-600">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">
                          {request.first_name} {request.last_name}
                        </p>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {request.employee_id}
                        </span>
                        {request.absence_reason && (
                          <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${reasonColor}`}>
                            {request.absence_reason}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.timestamp).toLocaleString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                            hour: "numeric", minute: "2-digit",
                          })}
                        </p>
                        <span className="text-muted-foreground/40 text-xs">·</span>
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <p className="text-xs text-muted-foreground truncate max-w-40">
                          {formatGpsForMode(
                            request.latitude,
                            request.longitude,
                            request.location_name ?? null,
                            locationDisplayMode,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 cursor-pointer"
                      onClick={() => { setReviewReason(""); setReviewTarget({ request, action: "approve" }); }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-4 text-xs bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5 cursor-pointer"
                      onClick={() => { setReviewReason(""); setReviewTarget({ request, action: "deny" }); }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Deny
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      ) : (
        <div className="min-h-12 rounded-xl border border-border bg-card px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              All caught up <span className="text-muted-foreground font-medium">· 0 pending review</span>
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs cursor-pointer shrink-0"
            onClick={() => void refreshAbsenceRequests()}
          >
            Refresh
          </Button>
        </div>
      )}

      {showCalendar && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Attendance Calendar</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">Company-wide attendance overview - click a day to preview the daily summary</p>
            </div>
          </div>
          <AttendanceCalendarGrid
            mode={calendarMode}
            referenceDate={calEffectiveRef}
            loading={loading || calendarLoading}
            showModeToggle
            onModeChange={setCalendarMode}
            onNavigate={(d) => setCalPickerNav(d)}
            days={calendarDays}
            onDayClick={(date) => {
              setSelectedDate(new Date(date + "T00:00:00"));
              setViewMode("day");
              setShowCalendar(false);
              setCalPickerNav(null);
            }}
          />
        </div>
      )}

      {/* ── Top Performers (period only) ─────────────────────────────────────── */}
      {isPeriod && !loading && periodData.length > 0 && (
        <TopPerformersBar entries={periodData} />
      )}


      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-muted/20 border-b border-border">

          {/* Left: status chips (day) or period label */}
          {isDayView ? (
            <div className="flex gap-1.5 flex-wrap">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors cursor-pointer ${
                    statusFilterClass(opt.value, statusFilter === opt.value)
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {viewMode === "week" ? "Weekly" : viewMode === "month" ? "Monthly" : "Custom"} Summary
              </p>
              {periodStats.flaggedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold">
                  <AlertTriangle className="h-3 w-3" />
                  {periodStats.flaggedCount} flagged
                </span>
              )}
            </div>
          )}

          {/* Right: dept summary pill + search + dept filter button */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Active department pill */}
            {deptFilter !== null && deptSummary !== null && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/20 bg-primary/5 text-xs font-bold text-primary">
                <Building2 className="h-3 w-3" />
                {departments.find(d => d.id === deptFilter)?.name}
                <span className="text-muted-foreground font-normal">·</span>
                <span>{deptSummary.count} emp</span>
                <span className="text-muted-foreground font-normal">·</span>
                <span>{deptSummary.totalHours.toFixed(1)}h</span>
                <span className="text-muted-foreground font-normal">·</span>
                <span className={deptSummary.rate >= 80 ? "text-green-600" : deptSummary.rate >= 60 ? "text-amber-500" : "text-red-500"}>
                  {deptSummary.rate}%
                </span>
                <button onClick={() => { setDeptFilter(null); setPage(1); }} className="ml-0.5 hover:text-foreground cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9 w-48 bg-background"
              />
            </div>

            {/* Department filter button — only shown when departments exist */}
            {departments.length > 0 && (
              <div className="relative shrink-0">
                <button
                  ref={tkFilterBtnRef}
                  onClick={() => {
                    if (tkFilterBtnRef.current) {
                      const rect = tkFilterBtnRef.current.getBoundingClientRect();
                      const spaceBelow = window.innerHeight - rect.bottom;
                      const right = window.innerWidth - rect.right;
                      setTKFilterPos(
                        spaceBelow >= 260
                          ? { top: rect.bottom + 8, right }
                          : { bottom: window.innerHeight - rect.top + 8, right }
                      );
                    }
                    setShowTKFilter(v => !v);
                  }}
                  className={`relative h-9 w-9 flex items-center justify-center rounded-md border transition-colors cursor-pointer ${
                    deptFilter !== null ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary/50 bg-background"
                  }`}
                  title="Filter by department"
                >
                  <Building2 className="h-4 w-4" />
                  {deptFilter !== null && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                      1
                    </span>
                  )}
                </button>

                {showTKFilter && (
                  <div
                    ref={tkFilterDropRef}
                    style={{
                      position: "fixed",
                      top:    tkFilterPos?.top    !== undefined ? tkFilterPos.top    : undefined,
                      bottom: tkFilterPos?.bottom !== undefined ? tkFilterPos.bottom : undefined,
                      right:  tkFilterPos?.right  !== undefined ? tkFilterPos.right  : 0,
                    }}
                    className="z-[200] w-52 bg-card border border-border rounded-lg shadow-lg py-1.5 max-h-[60vh] overflow-y-auto"
                  >
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Department</p>
                    {departments.map(d => (
                      <button
                        key={d.id}
                        className="flex items-center justify-between px-3 py-2 w-full hover:bg-muted/50 text-sm text-foreground cursor-pointer"
                        onClick={() => { setDeptFilter(deptFilter === d.id ? null : d.id); setPage(1); }}
                      >
                        <span className="truncate">{d.name}</span>
                        {deptFilter === d.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                    ))}
                    {deptFilter !== null && (
                      <>
                        <div className="border-t border-border my-1" />
                        <button
                          className="px-3 py-2 w-full text-left text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer"
                          onClick={() => { setDeptFilter(null); setPage(1); setShowTKFilter(false); }}
                        >
                          Clear filter
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-b border-border uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Employee</th>
                {isDayView ? (
                  <>
                    <th className="px-6 py-4">Time In</th>
                    <th className="px-6 py-4">Time Out</th>
                    <th className="px-6 py-4">Hours</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">GPS</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4">Days Present</th>
                    <th className="px-6 py-4">Days Absent</th>
                    <th className="px-6 py-4">Days Late</th>
                    <th className="px-6 py-4">Total Hours</th>
                    <th className="px-6 py-4">Overtime</th>
                    <th className="px-6 py-4">Compliance</th>
                    <th className="px-6 py-4">Average</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tableBody}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-muted/10 border-t border-border flex items-center justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {activeList.length > 0
              ? `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, activeList.length)} of ${activeList.length}`
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

      </>)}
    </div>
  );
}
