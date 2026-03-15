export type TimekeepingStatus = "present" | "absent" | "late" | "on-leave";

// GET /users response row
export type UserRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  account_status: string | null;
};

// GET /timekeeping/timesheets response row — one per punch event
export type PunchRow = {
  log_id: string;
  punch_type: "TIME_IN" | "TIME_OUT";
  timestamp: string;          // ISO datetime
  date: string;               // YYYY-MM-DD (PST)
  latitude: number | null;
  longitude: number | null;
  user_id: string;
  employee_id: string | null;
  user_profile: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

// Display row after transformation
export type TimekeepingLog = {
  user_id: string;
  first_name: string;
  last_name: string;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  status: TimekeepingStatus;
  gps_verified: boolean;
};

export type TimekeepingStats = {
  total: number;
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  attendance_rate: number;
  avg_hours: number;
};

// Employees who punch in at or after this hour (PST) are considered late
const LATE_THRESHOLD_HOUR_PST = 9;

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila",
  });
}

export function formatHoursFromDecimal(hours: number | null): string {
  if (hours === null) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatHoursFromTimestamps(
  timeIn: string | null | undefined,
  timeOut: string | null | undefined
): string {
  if (!timeIn || !timeOut) return "—";
  const diff = (new Date(timeOut).getTime() - new Date(timeIn).getTime()) / 3_600_000;
  return formatHoursFromDecimal(diff);
}

// Returns today's date as YYYY-MM-DD in Philippine Standard Time
export function todayPST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function toDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function isToday(date: Date): boolean {
  return toDateString(date) === toDateString(new Date());
}

// Derives status from TIME_IN timestamp. "on-leave" requires a future leave endpoint.
export function deriveStatus(timeIn: string | null): TimekeepingStatus {
  if (!timeIn) return "absent";
  const hourPST = parseInt(
    new Date(timeIn).toLocaleString("en-US", {
      hour: "numeric", hour12: false, timeZone: "Asia/Manila",
    }),
    10
  );
  return hourPST >= LATE_THRESHOLD_HOUR_PST ? "late" : "present";
}

// Merges full user roster with punch records — absent employees still appear
export function buildFullRoster(users: UserRow[], punches: PunchRow[]): TimekeepingLog[] {
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

      return {
        user_id:      u.user_id,
        first_name:   u.first_name  ?? "Unknown",
        last_name:    u.last_name   ?? "",
        time_in:      timeInTs,
        time_out:     timeOutTs,
        hours_worked,
        status:       deriveStatus(timeInTs),
        gps_verified: !!(punched.timeIn?.latitude != null && punched.timeIn?.longitude != null),
      };
    });
}

export function computeStats(logs: TimekeepingLog[]): TimekeepingStats {
  const total    = logs.length;
  const present  = logs.filter(l => l.status === "present").length;
  const absent   = logs.filter(l => l.status === "absent").length;
  const late     = logs.filter(l => l.status === "late").length;
  const on_leave = logs.filter(l => l.status === "on-leave").length;
  const attended = present + late;
  const attendance_rate = total > 0 ? Math.round((attended / total) * 100) : 0;

  const worked = logs.filter(l => l.hours_worked !== null).map(l => l.hours_worked as number);
  const avg_hours = worked.length > 0 ? worked.reduce((a, b) => a + b, 0) / worked.length : 0;

  return { total, present, absent, late, on_leave, attendance_rate, avg_hours };
}
