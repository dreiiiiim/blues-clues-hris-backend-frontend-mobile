"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Loader2, FileText, MapPin, Briefcase, CheckCircle2, X, Calendar,
  Mail, Phone, ChevronRight, ClipboardList, Clock, Trophy, Mic, Cpu,
  Search, Filter, SortAsc, SortDesc, TrendingUp, CheckCheck, XCircle,
  RotateCcw, DollarSign, AlarmClock,
} from "lucide-react";
import {
  getMyApplications, getMyApplicationDetail,
  type MyApplication, type ApplicationDetail,
} from "@/lib/authApi";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  { key: "submitted",           label: "Applied",       short: "Applied",  icon: FileText    },
  { key: "screening",           label: "Screening",     short: "Screen",   icon: Search      },
  { key: "first_interview",     label: "1st Interview", short: "1st Int.", icon: Mic         },
  { key: "technical_interview", label: "Technical",     short: "Tech",     icon: Cpu         },
  { key: "final_interview",     label: "Final",         short: "Final",    icon: Trophy      },
] as const;

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string; darkBadge: string }> = {
  submitted:           { label: "Applied",             badge: "bg-blue-100 text-blue-700 border-blue-200",      dot: "bg-blue-500",   darkBadge: "bg-blue-500/20 text-blue-200 border-blue-400/30"    },
  screening:           { label: "Screening",           badge: "bg-amber-100 text-amber-700 border-amber-200",   dot: "bg-amber-500",  darkBadge: "bg-amber-500/20 text-amber-200 border-amber-400/30"  },
  first_interview:     { label: "1st Interview",       badge: "bg-purple-100 text-purple-700 border-purple-200",dot: "bg-purple-500", darkBadge: "bg-purple-500/20 text-purple-200 border-purple-400/30"},
  technical_interview: { label: "Technical Interview", badge: "bg-indigo-100 text-indigo-700 border-indigo-200",dot: "bg-indigo-500", darkBadge: "bg-indigo-500/20 text-indigo-200 border-indigo-400/30"},
  final_interview:     { label: "Final Interview",     badge: "bg-violet-100 text-violet-700 border-violet-200",dot: "bg-violet-500", darkBadge: "bg-violet-500/20 text-violet-200 border-violet-400/30"},
  hired:               { label: "Hired",               badge: "bg-green-100 text-green-700 border-green-200",   dot: "bg-green-500",  darkBadge: "bg-green-500/20 text-green-200 border-green-400/30"  },
  rejected:            { label: "Not Selected",        badge: "bg-red-100 text-red-700 border-red-200",         dot: "bg-red-500",    darkBadge: "bg-red-500/20 text-red-200 border-red-400/30"        },
};

type SortKey = "date_desc" | "date_asc" | "status";
type FilterStatus = "all" | "active" | "hired" | "rejected";

function isTerminal(s: string) { return s === "hired" || s === "rejected"; }
function isActive(s: string)   { return !isTerminal(s); }
function fmtDate(iso: string)  {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── Stage Progress ───────────────────────────────────────────────────────────

function StageProgress({ status }: { status: string }) {
  const terminal     = isTerminal(status);
  const currentIdx   = STAGES.findIndex((s) => s.key === status);
  const effectiveIdx = terminal ? STAGES.length : currentIdx;

  return (
    <div className="flex items-start gap-0 mt-3">
      {STAGES.map((stage, i) => {
        const done    = i < effectiveIdx;
        const current = i === currentIdx && !terminal;
        const Icon    = stage.icon;
        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all
                ${done    ? "bg-primary border-primary shadow-sm shadow-primary/20"           : ""}
                ${current ? "bg-background border-primary ring-[3px] ring-primary/15 shadow-sm" : ""}
                ${!done && !current ? "bg-muted/30 border-border"                            : ""}
              `}>
                {done    && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                {current && <Icon className="h-3 w-3 text-primary" />}
                {!done && !current && <Icon className="h-3 w-3 text-muted-foreground/30" />}
              </div>
              <span className={`mt-1 text-[9px] font-bold uppercase tracking-[0.06em] text-center leading-tight max-w-11
                ${done || current ? "text-foreground" : "text-muted-foreground/35"}
              `}>{stage.short}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-0.5 flex-1 -mt-4 mx-0.5 rounded-full ${i < effectiveIdx - 1 ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
      {/* Terminal node */}
      <div className="flex items-center flex-1 min-w-0">
        <div className={`h-0.5 flex-1 -mt-4 mx-0.5 rounded-full ${terminal ? "bg-primary" : "bg-border"}`} />
        <div className="flex flex-col items-center shrink-0">
          <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all
            ${terminal ? (status === "hired" ? "bg-green-500 border-green-500 shadow-sm shadow-green-500/20" : "bg-red-400 border-red-400") : "bg-muted/30 border-border"}
          `}>
            {terminal ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> : <Trophy className="h-3 w-3 text-muted-foreground/30" />}
          </div>
          <span className={`mt-1 text-[9px] font-bold uppercase tracking-[0.06em] text-center leading-tight max-w-11
            ${terminal ? (status === "hired" ? "text-green-600" : "text-red-500") : "text-muted-foreground/35"}
          `}>{status === "hired" ? "Hired" : status === "rejected" ? "Out" : "Result"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Application Card ─────────────────────────────────────────────────────────

function ApplicationCard({ app, onView }: { app: MyApplication; onView: (id: string) => void }) {
  const cfg      = STATUS_CONFIG[app.status] ?? STATUS_CONFIG["submitted"];
  const terminal = isTerminal(app.status);

  return (
    <div className={`bg-card border rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer ${
      app.status === "hired" ? "border-green-200 dark:border-green-800/50" : app.status === "rejected" ? "border-red-200/60 dark:border-red-800/30" : "border-border"
    }`}>
      {/* Status color bar — thicker + gradient for hired/rejected */}
      <div className={`h-1.5 w-full ${
        app.status === "hired" ? "bg-linear-to-r from-green-400 to-emerald-500" :
        app.status === "rejected" ? "bg-linear-to-r from-red-400 to-rose-500" :
        cfg.dot
      }`} />

      <div className="p-5 space-y-3.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              app.status === "hired" ? "bg-green-500/10 text-green-600 border border-green-200/60 dark:border-green-700/40" :
              app.status === "rejected" ? "bg-red-500/10 text-red-500 border border-red-200/60 dark:border-red-700/40" :
              "bg-primary/10 text-primary border border-primary/15"
            }`}>
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground text-base leading-tight truncate">{app.job_postings?.title ?? "—"}</p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1">
                {app.job_postings?.location && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />{app.job_postings.location}
                  </span>
                )}
                {app.job_postings?.employment_type && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />{app.job_postings.employment_type}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>

        {/* Date + time ago */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Applied {fmtDate(app.applied_at)}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground/70">{timeAgo(app.applied_at)}</span>
        </div>

        {/* Progress or terminal banner */}
        {terminal ? (
          <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold ${
            app.status === "hired"
              ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700/40 dark:text-green-300"
              : "bg-red-50/60 border-red-200/70 text-red-600 dark:bg-red-900/10 dark:border-red-700/30 dark:text-red-400"
          }`}>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {app.status === "hired" ? "Congratulations! You've been hired." : "This application was not selected."}
          </div>
        ) : (
          <StageProgress status={app.status} />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            <span className="text-xs text-muted-foreground font-medium">{cfg.label}</span>
          </div>
          <Button
            size="sm" variant="ghost"
            className="h-8 px-3 gap-1.5 text-xs font-semibold text-muted-foreground border border-transparent hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all cursor-pointer"
            onClick={() => onView(app.application_id)}
          >
            View Details <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

type DetailWithJob = ApplicationDetail & {
  job_postings?: {
    title: string;
    description: string | null;
    location: string | null;
    employment_type: string | null;
    salary_range: string | null;
    status: string;
    posted_at: string;
    closes_at: string | null;
  };
};

function DetailModal({ detail, onClose }: { detail: DetailWithJob; onClose: () => void }) {
  const [tab, setTab] = useState<"job" | "answers">("job");
  const cfg    = STATUS_CONFIG[detail.status] ?? STATUS_CONFIG["submitted"];
  const job    = detail.job_postings;
  const sorted = [...detail.answers].sort((a, b) => a.application_questions.sort_order - b.application_questions.sort_order);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 animate-in fade-in duration-200 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>

        {/* Gradient header */}
        <div className="relative overflow-hidden rounded-t-2xl bg-[linear-gradient(135deg,#0f172a_0%,#172554_55%,#134e4a_100%)] px-6 pt-5 pb-0">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-blue-500 blur-3xl opacity-15 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />

          <div className="relative flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                <Briefcase className="h-5 w-5 text-white/70" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">Job Posting</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${cfg.darkBadge}`}>
                    {cfg.label}
                  </span>
                </div>
                <h2 className="text-[15px] font-bold text-white leading-snug">{job?.title ?? "Job Application"}</h2>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {job?.location && (
                    <span className="flex items-center gap-1 text-[11px] text-white/50">
                      <MapPin className="h-3 w-3" />{job.location}
                    </span>
                  )}
                  {job?.employment_type && (
                    <span className="flex items-center gap-1 text-[11px] text-white/50">
                      <Clock className="h-3 w-3" />{job.employment_type}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-white/50">
                    <Calendar className="h-3 w-3" />Applied {fmtDate(detail.applied_at)}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors border border-white/10 shrink-0 mt-0.5 cursor-pointer">
              <X className="h-3.5 w-3.5 text-white/60" />
            </button>
          </div>

          <div className="relative flex items-center gap-0">
            <button
              onClick={() => setTab("job")}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                tab === "job"
                  ? "border-white text-white"
                  : "border-transparent text-white/45 hover:text-white/75"
              }`}
            >
              Job Details
            </button>
            <button
              onClick={() => setTab("answers")}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                tab === "answers"
                  ? "border-white text-white"
                  : "border-transparent text-white/45 hover:text-white/75"
              }`}
            >
              My Answers
              {sorted.length > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === "answers" ? "bg-white/20 text-white" : "bg-white/10 text-white/50"}`}>
                  {sorted.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* ── JOB DETAILS TAB ── */}
          {tab === "job" && (
            <>
              <div className="flex flex-wrap gap-2">
                {job?.salary_range && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold shadow-sm dark:bg-green-900/20 dark:border-green-700/40 dark:text-green-300">
                    <DollarSign className="h-3.5 w-3.5" />{job.salary_range}
                  </span>
                )}
                {job?.employment_type && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-sm dark:bg-blue-900/20 dark:border-blue-700/40 dark:text-blue-300">
                    <Clock className="h-3.5 w-3.5" />{job.employment_type}
                  </span>
                )}
                {job?.location && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground text-xs font-semibold shadow-sm">
                    <MapPin className="h-3.5 w-3.5" />{job.location}
                  </span>
                )}
                {job?.closes_at && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold shadow-sm dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-300">
                    <AlarmClock className="h-3.5 w-3.5" />Closes {fmtDate(job.closes_at)}
                  </span>
                )}
              </div>

              {job?.description ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">Job Description</p>
                  <div className="rounded-xl border border-border bg-muted/20 px-4 py-4 shadow-inner">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{job.description}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-muted-foreground gap-2">
                  <FileText className="h-7 w-7 opacity-20" />
                  <p className="text-xs">No description available for this posting.</p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">Your Application Status</p>
                <div className="rounded-xl border border-border bg-muted/20 px-4 py-4">
                  <div className="mb-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <StageProgress status={detail.status} />
                  {isTerminal(detail.status) && (
                    <div className={`mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold ${
                      detail.status === "hired"
                        ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700/40 dark:text-green-300"
                        : "bg-red-50/60 border-red-200/70 text-red-600 dark:bg-red-900/10 dark:border-red-700/30 dark:text-red-400"
                    }`}>
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {detail.status === "hired" ? "Congratulations! You've been hired." : "This application was not selected."}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── MY ANSWERS TAB ── */}
          {tab === "answers" && (
            sorted.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">These are the answers you submitted with your application.</p>
                {sorted.map((ans, i) => (
                  <div key={ans.answer_id} className="rounded-xl border border-border bg-muted/15 overflow-hidden">
                    <div className="flex items-start gap-2.5 px-4 pt-3 pb-2.5">
                      <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                      <p className="text-xs font-semibold text-foreground leading-snug">{ans.application_questions.question_text}</p>
                    </div>
                    <div className="h-px bg-border mx-4" />
                    <div className="px-4 pb-3 pt-2.5 pl-11">
                      <p className="text-sm text-foreground leading-relaxed">
                        {ans.answer_value || <span className="text-muted-foreground italic text-xs">No answer provided</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-muted-foreground gap-3">
                <ClipboardList className="h-8 w-8 opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">No questions were required</p>
                  <p className="text-xs mt-1">This job posting had no application form questions.</p>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicantApplicationsPage() {
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading]             = useState(true);
  const [detail, setDetail]               = useState<ApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState<FilterStatus>("all");
  const [sort, setSort]                   = useState<SortKey>("date_desc");

  useEffect(() => {
    getMyApplications()
      .then(setApplications)
      .catch((err: any) => toast.error(err.message || "Failed to load applications"))
      .finally(() => setLoading(false));
  }, []);

  const handleViewDetails = async (appId: string) => {
    setDetailLoading(true);
    try {
      const d = await getMyApplicationDetail(appId);
      setDetail(d);
    } catch (err: any) {
      toast.error(err.message || "Failed to load application details");
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total    = applications.length;
  const active   = applications.filter((a) => isActive(a.status)).length;
  const hired    = applications.filter((a) => a.status === "hired").length;
  const rejected = applications.filter((a) => a.status === "rejected").length;
  const inInterview = applications.filter((a) =>
    ["first_interview", "technical_interview", "final_interview"].includes(a.status)
  ).length;

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...applications];

    if (filterStatus === "active")   list = list.filter((a) => isActive(a.status));
    if (filterStatus === "hired")    list = list.filter((a) => a.status === "hired");
    if (filterStatus === "rejected") list = list.filter((a) => a.status === "rejected");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        (a.job_postings?.title ?? "").toLowerCase().includes(q) ||
        (a.job_postings?.location ?? "").toLowerCase().includes(q)
      );
    }

    if (sort === "date_desc") list.sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime());
    if (sort === "date_asc")  list.sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime());
    if (sort === "status") {
      const order = ["submitted","screening","first_interview","technical_interview","final_interview","hired","rejected"];
      list.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    }

    return list;
  }, [applications, filterStatus, search, sort]);

  const filterTabs: { key: FilterStatus; label: string; count: number; icon: any }[] = [
    { key: "all",      label: "All",        count: total,     icon: FileText    },
    { key: "active",   label: "Active",     count: active,    icon: TrendingUp  },
    { key: "hired",    label: "Hired",      count: hired,     icon: CheckCheck  },
    { key: "rejected", label: "Not Selected", count: rejected, icon: XCircle    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">

      {/* ── Hero ── */}
      <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 md:px-7 md:py-7 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-blue-500 blur-[80px] opacity-20 pointer-events-none" />
        <div className="absolute -bottom-8 left-16 h-32 w-32 rounded-full bg-teal-500 blur-[80px] opacity-20 pointer-events-none" />
        <div className="absolute top-1/2 right-1/3 h-28 w-28 rounded-full bg-indigo-400 blur-[80px] opacity-10 pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50 mb-1.5">Candidate Portal</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white/70" />
              </div>
              My Applications
            </h1>
            <p className="text-sm text-white/55 mt-1.5">Track your progress across all roles you&apos;ve applied to</p>
          </div>
          {/* Stat chips */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-center min-w-15">
              <p className="text-xl font-bold text-white leading-none">{total}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">Total</p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-center min-w-15">
              <p className="text-xl font-bold text-white leading-none">{active}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">Active</p>
            </div>
            {inInterview > 0 && (
              <div className="bg-purple-500/20 border border-purple-400/30 rounded-xl px-4 py-2.5 text-center min-w-15">
                <p className="text-xl font-bold text-purple-200 leading-none">{inInterview}</p>
                <p className="text-[10px] text-purple-300/70 uppercase tracking-widest mt-0.5">Interview</p>
              </div>
            )}
            {hired > 0 && (
              <div className="bg-green-500/20 border border-green-400/30 rounded-xl px-4 py-2.5 text-center min-w-15">
                <p className="text-xl font-bold text-green-300 leading-none">{hired}</p>
                <p className="text-[10px] text-green-400/70 uppercase tracking-widest mt-0.5">Hired</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Applied",     value: total,       sub: "total submitted",      dotColor: "bg-blue-500",   borderColor: "border-l-blue-400"   },
            { label: "In Progress", value: active,      sub: "awaiting response",    dotColor: "bg-primary",    borderColor: "border-l-primary"    },
            { label: "Interviews",  value: inInterview, sub: "rounds scheduled",     dotColor: "bg-purple-500", borderColor: "border-l-purple-400" },
            { label: "Hired",       value: hired,       sub: "offers received",      dotColor: "bg-green-500",  borderColor: "border-l-green-400"  },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border border-l-4 ${s.borderColor} border-border bg-card px-4 py-3.5 shadow-sm`}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`h-2 w-2 rounded-full shrink-0 ${s.dotColor}`} />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
              </div>
              <p className="text-2xl font-bold tracking-tight text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters + search ── */}
      {!loading && total > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterTabs.map((f) => {
              const Icon = f.icon;
              const isActive = filterStatus === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {f.label}
                  <span className={`text-[10px] font-bold min-w-4.5 px-1.5 py-0.5 rounded-full text-center ${
                    isActive ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by job title or location…"
                className="h-9 w-full pl-9 pr-3 rounded-lg border border-border bg-card text-sm shadow-xs focus:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded hover:bg-muted/60 cursor-pointer">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg p-0.5">
              {([
                { key: "date_desc", icon: SortDesc, label: "Newest" },
                { key: "date_asc",  icon: SortAsc,  label: "Oldest" },
                { key: "status",    icon: Filter,   label: "Stage"  },
              ] as { key: SortKey; icon: any; label: string }[]).map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSort(s.key)}
                    title={s.label}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      sort === s.key
                        ? "bg-card text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {s.label}
                  </button>
                );
              })}
            </div>

            {(search || filterStatus !== "all" || sort !== "date_desc") && (
              <button
                onClick={() => { setSearch(""); setFilterStatus("all"); setSort("date_desc"); }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-primary/40" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-muted-foreground">
          <div className="relative">
            <div className="h-20 w-20 rounded-3xl bg-linear-to-br from-primary/10 to-muted/30 border border-border flex items-center justify-center">
              <FileText className="h-9 w-9 opacity-25" />
            </div>
            <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Search className="h-3.5 w-3.5 text-primary/50" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-bold text-foreground">No applications yet</p>
            <p className="text-sm text-muted-foreground max-w-60">Browse open positions and submit your first application to get started.</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Search className="h-8 w-8 opacity-20" />
          <p className="text-sm font-medium text-foreground">No results found</p>
          <p className="text-xs">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Showing {filtered.length} of {total} application{total !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((app) => (
              <ApplicationCard key={app.application_id} app={app} onView={handleViewDetails} />
            ))}
          </div>
        </>
      )}

      {/* Loading overlay */}
      {detailLoading && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/30 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading details…</p>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && !detailLoading && (
        <DetailModal detail={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
