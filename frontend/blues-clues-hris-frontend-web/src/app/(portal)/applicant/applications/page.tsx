"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, MapPin, Briefcase, CheckCircle2 } from "lucide-react";
import { getMyApplications, type MyApplication } from "@/lib/authApi";

// ─── Stages ───────────────────────────────────────────────────────────────────

const STAGES = [
  { key: "submitted",           label: "Submitted" },
  { key: "screening",           label: "Screening" },
  { key: "first_interview",     label: "1st Interview" },
  { key: "technical_interview", label: "Technical" },
  { key: "final_interview",     label: "Final" },
];

const TERMINAL: Record<string, { label: string; color: string; bg: string; border: string }> = {
  hired:    { label: "Hired",    color: "text-green-700 dark:text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  rejected: { label: "Rejected", color: "text-red-700 dark:text-red-400",    bg: "bg-red-500/10",   border: "border-red-500/20" },
};

function stageIndex(status: string): number {
  return STAGES.findIndex((s) => s.key === status);
}

function isTerminal(status: string): boolean {
  return status === "hired" || status === "rejected";
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function StageTimeline({ status }: { status: string }) {
  const terminal = TERMINAL[status];
  const currentIdx = stageIndex(status);

  // If terminal, all STAGES are considered "done"
  const effectiveIdx = terminal ? STAGES.length : currentIdx;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-0">
        {STAGES.map((stage, i) => {
          const done    = i < effectiveIdx;
          const current = i === currentIdx && !terminal;

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              {/* Node */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all
                    ${done    ? "bg-primary border-primary"                          : ""}
                    ${current ? "bg-background border-primary ring-2 ring-primary/20" : ""}
                    ${!done && !current ? "bg-muted/30 border-border"               : ""}
                  `}
                >
                  {done && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                  {current && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <span
                  className={`mt-1.5 text-[10px] font-semibold text-center leading-tight max-w-[56px] truncate
                    ${done || current ? "text-foreground" : "text-muted-foreground/60"}
                  `}
                >
                  {stage.label}
                </span>
              </div>
              {/* Connector */}
              {i < STAGES.length - 1 && (
                <div className={`h-0.5 flex-1 -mt-5 mx-0.5 transition-colors ${i < effectiveIdx - 1 ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          );
        })}

        {/* Terminal node */}
        <div className="flex items-center flex-1 min-w-0">
          <div className={`h-0.5 flex-1 -mt-5 mx-0.5 transition-colors ${terminal ? "bg-primary" : "bg-border"}`} />
          <div className="flex flex-col items-center shrink-0">
            <div
              className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all
                ${terminal
                  ? status === "hired"
                    ? "bg-green-500 border-green-500"
                    : "bg-red-400 border-red-400"
                  : "bg-muted/30 border-border"
                }
              `}
            >
              {terminal && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
            </div>
            <span className={`mt-1.5 text-[10px] font-semibold text-center leading-tight max-w-[56px] truncate ${terminal ? (status === "hired" ? "text-green-600" : "text-red-500") : "text-muted-foreground/60"}`}>
              {status === "hired" ? "Hired" : status === "rejected" ? "Rejected" : "Decision"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function currentStageLabel(status: string): string {
  const terminal = TERMINAL[status];
  if (terminal) return terminal.label;
  return STAGES.find((s) => s.key === status)?.label ?? status;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicantApplicationsPage() {
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyApplications()
      .then(setApplications)
      .catch((err: any) => toast.error(err.message || "Failed to load applications"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <Card className="border-border shadow-sm bg-card">
        <CardHeader className="bg-muted/20 border-b border-border pb-6">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Applications</p>
          <CardTitle className="text-2xl font-bold tracking-tight">My Applications</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : `${applications.length} application${applications.length !== 1 ? "s" : ""} submitted`}
          </p>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No applications yet.</p>
              <p className="text-xs">Browse open positions and apply to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {applications.map((app) => {
                const terminal = TERMINAL[app.status];
                return (
                  <div key={app.application_id} className="px-6 py-5">
                    {/* Top row: job info + stage badge */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="font-bold text-foreground truncate text-base">{app.job_postings?.title ?? "—"}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground font-medium">
                          {app.job_postings?.location && (
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{app.job_postings.location}</span>
                          )}
                          {app.job_postings?.employment_type && (
                            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{app.job_postings.employment_type}</span>
                          )}
                          <span>Applied {formatDate(app.applied_at)}</span>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                          terminal
                            ? `${terminal.bg} ${terminal.border} ${terminal.color}`
                            : "bg-primary/10 border-primary/20 text-primary"
                        }`}
                      >
                        {currentStageLabel(app.status)}
                      </span>
                    </div>

                    {/* Stage timeline */}
                    <StageTimeline status={app.status} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
