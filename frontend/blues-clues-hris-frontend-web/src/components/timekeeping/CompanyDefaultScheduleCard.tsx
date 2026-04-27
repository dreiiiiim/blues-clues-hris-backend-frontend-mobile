"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";

type CompanyDefaultSchedule = {
  company_id?: string;
  start_time: string | null;
  end_time: string | null;
  break_start: string | null;
  break_end: string | null;
  workdays: string | null;
  is_nightshift: boolean | null;
  effective_from?: string | null;
  updated_by_name?: string | null;
  updated_at?: string | null;
};

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function getTodayInManila(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

function normalizeTime(value: string | null | undefined, fallback: string): string {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function parseWorkdays(value: string | null | undefined): string[] {
  if (!value) return ["MON", "TUE", "WED", "THU", "FRI"];
  const parsed = value
    .split(",")
    .map((day) => day.trim().toUpperCase())
    .filter((day) => WEEKDAYS.includes(day));
  return parsed.length > 0 ? parsed : ["MON", "TUE", "WED", "THU", "FRI"];
}

function formatClock(value: string): string {
  const [hRaw, mins] = value.split(":");
  const h = Number.parseInt(hRaw, 10);
  if (Number.isNaN(h)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mins} ${suffix}`;
}

async function readJsonOrNull<T>(res: Response): Promise<T | null> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as T;
}

export function CompanyDefaultScheduleCard({
  refreshKey,
  onChanged,
}: Readonly<{
  refreshKey?: number;
  onChanged?: () => void;
}>) {
  const today = useMemo(() => getTodayInManila(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedDefault, setHasSavedDefault] = useState(false);

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [workdays, setWorkdays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [effectiveDate, setEffectiveDate] = useState(today);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    authFetch(`${API_BASE_URL}/timekeeping/schedules/company-default`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load company default schedule.");
        return readJsonOrNull<CompanyDefaultSchedule>(res);
      })
      .then((schedule) => {
        if (cancelled) return;
        setHasSavedDefault(Boolean(schedule));
        if (schedule) {
          setStartTime(normalizeTime(schedule.start_time, "09:00"));
          setEndTime(normalizeTime(schedule.end_time, "18:00"));
          setBreakStart(normalizeTime(schedule.break_start, "12:00"));
          setBreakEnd(normalizeTime(schedule.break_end, "13:00"));
          setWorkdays(parseWorkdays(schedule.workdays));
          setEffectiveDate(schedule.effective_from ?? today);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load company default schedule.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, today]);

  const toggleDay = (day: string) => {
    setWorkdays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day],
    );
  };

  const saveDefault = async () => {
    if (workdays.length === 0) {
      setError("Select at least one workday.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/timekeeping/schedules/company-default`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: startTime,
          end_time: endTime,
          break_start: breakStart,
          break_end: breakEnd,
          workdays: workdays.join(","),
          is_nightshift: endTime < startTime,
          effective_date: effectiveDate,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Failed to save company default schedule.");
      }
      setHasSavedDefault(true);
      setMessage("Company default schedule saved.");
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save company default schedule.");
    } finally {
      setSaving(false);
    }
  };

  const backfillDefault = async () => {
    setBackfilling(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/timekeeping/schedules/company-default/backfill`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Failed to apply company default schedule.");
      }
      const data = await readJsonOrNull<{ affected: number }>(res);
      const affected = data?.affected ?? 0;
      setMessage(`Applied to ${affected} unscheduled employee${affected === 1 ? "" : "s"}.`);
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to apply company default schedule.");
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <section className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-blue-700" />
          </div>
          <div>
            <h2 className="text-sm font-bold">Company Default Schedule</h2>
            <p className="text-xs text-muted-foreground">
              Auto-applies to new employees without a department. Department schedules override it.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasSavedDefault && (
            <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void backfillDefault()}
            disabled={!hasSavedDefault || backfilling || loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${backfilling ? "animate-spin" : ""}`} />
            Apply to Unscheduled
          </Button>
        </div>
      </div>

      <div className="p-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Start</span>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={loading} />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">End</span>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={loading} />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Break Start</span>
            <Input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} disabled={loading} />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Break End</span>
            <Input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} disabled={loading} />
          </label>

          <div className="sm:col-span-2 lg:col-span-4 flex flex-col md:flex-row md:items-end gap-3">
            <div className="space-y-1 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workdays</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => {
                  const active = workdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      disabled={loading}
                      className={`h-8 min-w-11 rounded-md border px-2 text-xs font-bold transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="space-y-1 min-w-44">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Effective</span>
              <Input
                type="date"
                value={effectiveDate}
                min={today}
                onChange={(e) => setEffectiveDate(e.target.value)}
                disabled={loading}
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Preview</p>
            <p className="text-lg font-bold mt-1">{formatClock(startTime)} - {formatClock(endTime)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Break {formatClock(breakStart)} - {formatClock(breakEnd)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">{workdays.join(", ")}</p>
          </div>
          <Button type="button" className="w-full gap-1.5" onClick={() => void saveDefault()} disabled={saving || loading}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Default"}
          </Button>
        </div>
      </div>

      {(message || error) && (
        <div className="px-4 pb-4">
          <p className={`rounded-md border px-3 py-2 text-xs font-semibold ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}>
            {error ?? message}
          </p>
        </div>
      )}
    </section>
  );
}
