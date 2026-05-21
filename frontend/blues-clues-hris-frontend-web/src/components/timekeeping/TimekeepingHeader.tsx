"use client";

import { Clock, AlertTriangle, Users, UserCheck, UserX, Timer, TrendingUp, UserMinus } from "lucide-react";

export function TimekeepingHeader({ liveTime }: Readonly<{ liveTime: string }>) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-border">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Timekeeping</h1>
        <p className="text-sm text-muted-foreground">Attendance and schedule management</p>
      </div>
      <div className="flex items-baseline gap-2 text-right">
        <span className="font-mono tabular-nums text-lg font-bold text-foreground leading-none">{liveTime}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Asia/Manila</span>
      </div>
    </div>
  );
}

// ── Shared chip primitive ─────────────────────────────────────────────────────

function StatChip({
  icon: Icon,
  value,
  label,
  tone = "neutral",
}: Readonly<{
  icon: React.ElementType;
  value: string | number;
  label: string;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}>) {
  const toneClass: Record<typeof tone, string> = {
    neutral: "bg-muted/50 border-border text-muted-foreground",
    green:   "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber:   "bg-amber-50  border-amber-200  text-amber-800",
    red:     "bg-red-50    border-red-200    text-red-800",
    blue:    "bg-blue-50   border-blue-200   text-blue-800",
  };
  const iconTone: Record<typeof tone, string> = {
    neutral: "text-muted-foreground",
    green:   "text-emerald-600",
    amber:   "text-amber-600",
    red:     "text-red-600",
    blue:    "text-blue-600",
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${toneClass[tone]}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconTone[tone]}`} />
      <span className="font-bold tabular-nums">{value}</span>
      <span className="font-normal opacity-75">{label}</span>
    </div>
  );
}

// ── Day view stat row ─────────────────────────────────────────────────────────

export function DayStatRow({
  total,
  inCount,
  late,
  absent,
  totalHours,
  rate,
  dayStarted,
  firstShiftLabel,
}: Readonly<{
  total: number;
  inCount: number;
  late: number;
  absent: number;
  totalHours: number;
  rate: number;
  dayStarted: boolean;
  firstShiftLabel: string | null;
}>) {
  const displayAbsent = dayStarted ? absent : 0;
  const absentTone    = dayStarted && absent > 0 ? "red" : "neutral";
  const inTone        = inCount > 0 ? "green" : "neutral";
  const lateTone      = late > 0 ? "amber" : "neutral";
  const rateTone      = rate >= 80 ? "green" : rate >= 50 ? "amber" : dayStarted ? "red" : "neutral";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Attendance group */}
      <StatChip icon={Users}     value={total}        label="tracked"  tone="neutral"   />
      <StatChip icon={UserCheck} value={inCount}      label="attended" tone={inTone}    />
      {late > 0 && (
        <StatChip icon={Clock}   value={late}         label="late"     tone={lateTone}  />
      )}
      <StatChip icon={UserX}     value={displayAbsent} label="absent"  tone={absentTone} />

      {/* Divider */}
      <span className="h-4 w-px bg-border mx-0.5 self-center" />

      {/* Hours / rate group */}
      <StatChip icon={Timer}     value={`${totalHours.toFixed(1)}h`} label="total"    tone="neutral" />
      <StatChip icon={TrendingUp} value={`${rate}%`}                 label="rate"     tone={rateTone} />

      {/* Pre-shift label */}
      {!dayStarted && firstShiftLabel && (
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 border border-border rounded-lg px-2.5 py-1">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          First shift at <span className="font-semibold text-foreground">{firstShiftLabel}</span>
        </span>
      )}
    </div>
  );
}

// ── Period (week / month / custom) stat row ───────────────────────────────────

export function PeriodStatRow({
  total,
  totalHours,
  avgHours,
  avgCompliance,
  flaggedCount,
  periodLabel,
}: Readonly<{
  total: number;
  totalHours: number;
  avgHours: number;
  avgCompliance: number;
  flaggedCount: number;
  periodLabel: string;
}>) {
  const complianceTone = avgCompliance >= 80 ? "green" : avgCompliance >= 50 ? "amber" : "red";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatChip icon={Users}      value={total}                       label="employees"   tone="neutral"        />
      <StatChip icon={Timer}      value={`${totalHours.toFixed(1)}h`} label="total"       tone="neutral"        />
      <StatChip icon={UserCheck}  value={`${avgHours.toFixed(1)}h`}   label="avg/person"  tone="neutral"        />
      <StatChip icon={TrendingUp} value={`${avgCompliance.toFixed(0)}%`} label="compliance" tone={complianceTone} />

      {flaggedCount > 0 && (
        <StatChip icon={AlertTriangle} value={flaggedCount} label="flagged" tone="red" />
      )}

      {periodLabel && (
        <span className="ml-auto text-[11px] text-muted-foreground italic">{periodLabel}</span>
      )}
    </div>
  );
}
