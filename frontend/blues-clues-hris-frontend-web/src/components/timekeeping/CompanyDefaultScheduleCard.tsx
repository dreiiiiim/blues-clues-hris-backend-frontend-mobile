"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Pencil, RefreshCw, Save, X } from "lucide-react";
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

type ScheduleDraft = {
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  workdays: string[];
  effectiveDate: string;
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

function formatDateLabel(value: string): string {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const [isEditing, setIsEditing] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"edit" | "save" | "discard" | null>(null);

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [workdays, setWorkdays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [savedDraft, setSavedDraft] = useState<ScheduleDraft>({
    startTime: "09:00",
    endTime: "18:00",
    breakStart: "12:00",
    breakEnd: "13:00",
    workdays: ["MON", "TUE", "WED", "THU", "FRI"],
    effectiveDate: today,
  });
  const previewSummary = `${formatClock(savedDraft.startTime)} - ${formatClock(savedDraft.endTime)} - ${savedDraft.workdays.join(", ")}`;
  const breakSummary = `${formatClock(savedDraft.breakStart)} - ${formatClock(savedDraft.breakEnd)}`;

  const captureCurrentDraft = (): ScheduleDraft => ({
    startTime,
    endTime,
    breakStart,
    breakEnd,
    workdays: [...workdays],
    effectiveDate,
  });

  const restoreDraft = (draft: ScheduleDraft) => {
    setStartTime(draft.startTime);
    setEndTime(draft.endTime);
    setBreakStart(draft.breakStart);
    setBreakEnd(draft.breakEnd);
    setWorkdays([...draft.workdays]);
    setEffectiveDate(draft.effectiveDate);
  };

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
          const loadedDraft = {
            startTime: normalizeTime(schedule.start_time, "09:00"),
            endTime: normalizeTime(schedule.end_time, "18:00"),
            breakStart: normalizeTime(schedule.break_start, "12:00"),
            breakEnd: normalizeTime(schedule.break_end, "13:00"),
            workdays: parseWorkdays(schedule.workdays),
            effectiveDate: schedule.effective_from ?? today,
          };
          setSavedDraft(loadedDraft);
          restoreDraft(loadedDraft);
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
      return false;
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
      setSavedDraft(captureCurrentDraft());
      setHasSavedDefault(true);
      setMessage("Company default schedule saved.");
      onChanged?.();
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save company default schedule.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmEdit = () => {
    setMessage(null);
    setError(null);
    restoreDraft(savedDraft);
    setIsEditing(true);
    setConfirmMode(null);
  };

  const confirmDiscard = () => {
    restoreDraft(savedDraft);
    setMessage("Schedule edits discarded.");
    setError(null);
    setIsEditing(false);
    setConfirmMode(null);
  };

  const confirmSave = async () => {
    setConfirmMode(null);
    const saved = await saveDefault();
    if (saved) setIsEditing(false);
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

  const confirmDetails = {
    edit: {
      title: "Edit whole company schedule?",
      body: "This opens the full schedule editor. Department schedules will still override the company default.",
      action: "Continue Editing",
      onConfirm: confirmEdit,
    },
    save: {
      title: "Save company schedule changes?",
      body: "New employees without a department will use this updated company default schedule.",
      action: saving ? "Saving..." : "Save Changes",
      onConfirm: () => void confirmSave(),
    },
    discard: {
      title: "Discard schedule edits?",
      body: "Your unsaved changes will be removed and the card will return to the saved company schedule.",
      action: "Discard Changes",
      onConfirm: confirmDiscard,
    },
  } as const;
  const activeConfirm = confirmMode ? confirmDetails[confirmMode] : null;

  return (
    <section className="border border-border rounded-xl bg-card overflow-hidden">
      {activeConfirm && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">{activeConfirm.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-5">{activeConfirm.body}</p>
              </div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setConfirmMode(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9"
                onClick={activeConfirm.onConfirm}
                disabled={saving}
              >
                {activeConfirm.action}
              </Button>
            </div>
          </div>
        </div>
      )}
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden sm:inline-flex rounded-md border border-border bg-muted/30 px-2 py-1 text-xs font-semibold text-muted-foreground">
            {previewSummary}
          </span>
          {hasSavedDefault && (
            <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active
            </span>
          )}
          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setConfirmMode("edit")}
              disabled={loading}
            >
              <Pencil className="h-3.5 w-3.5" />
              {hasSavedDefault ? "Edit Whole Company Schedule" : "Set Company Schedule"}
            </Button>
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

      {!isEditing ? (
        <div className="p-4 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Working Hours</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {hasSavedDefault ? `${formatClock(savedDraft.startTime)} - ${formatClock(savedDraft.endTime)}` : "No company schedule set"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Break {breakSummary}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workdays</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => {
                const active = savedDraft.workdays.includes(day);
                return (
                  <span
                    key={day}
                    className={`inline-flex h-7 min-w-10 items-center justify-center rounded-md border px-2 text-[10px] font-bold ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {day}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Effective From</p>
            <p className="mt-1 text-sm font-bold text-foreground">{formatDateLabel(savedDraft.effectiveDate)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasSavedDefault ? "Shown to employees without department overrides." : "Create one to auto-assign new employees."}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 grid gap-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Editing company default</p>
              <p className="text-xs text-blue-700/80 mt-0.5">Save or discard to return to the compact schedule view.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-100"
              onClick={() => setConfirmMode("discard")}
              disabled={saving || loading}
            >
              <X className="h-3.5 w-3.5" />
              Discard
            </Button>
          </div>
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
              <Button type="button" className="h-10 gap-1.5 md:min-w-36" onClick={() => setConfirmMode("save")} disabled={saving || loading}>
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save Default"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
