"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { getUserInfo, type StoredUser } from "@/lib/authStorage";
import { getApplicantJobs, getMyApplications, type JobPosting, type MyApplication } from "@/lib/authApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const STAGES = [
  { key: "submitted", label: "Submitted" },
  { key: "screening", label: "Screening" },
  { key: "first_interview", label: "1st Interview" },
  { key: "technical_interview", label: "Technical" },
  { key: "final_interview", label: "Final" },
] as const;

const TERMINAL_LABEL: Record<string, string> = {
  hired: "Hired",
  rejected: "Rejected",
};

function stageIndex(status: string): number {
  return STAGES.findIndex((s) => s.key === status);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function statusLabel(status: string) {
  return TERMINAL_LABEL[status] ?? STAGES.find((s) => s.key === status)?.label ?? status;
}

function statusPillClass(status: string) {
  if (status === "hired") return "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400";
  if (status === "rejected") return "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400";
  return "bg-primary/10 border-primary/20 text-primary";
}

function pickPrimaryApplication(apps: MyApplication[]): MyApplication | null {
  const sorted = [...apps].sort(
    (a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime(),
  );
  return sorted.find((a) => !TERMINAL_LABEL[a.status]) ?? sorted[0] ?? null;
}

export default function ApplicantDashboardPage() {
  const [session, setSession] = useState<StoredUser | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(getUserInfo());

    Promise.all([getApplicantJobs(), getMyApplications()])
      .then(([jobList, myApps]) => {
        setJobs(jobList);
        setApplications(myApps);
      })
      .catch((err: Error) => {
        toast.error(err.message || "Failed to load dashboard data");
      })
      .finally(() => setLoading(false));
  }, []);

  useWelcomeToast(session?.name || "Applicant", "Candidate Portal");

  const primaryApplication = useMemo(() => pickPrimaryApplication(applications), [applications]);

  const recentApplications = useMemo(
    () =>
      [...applications]
        .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
        .slice(0, 4),
    [applications],
  );

  const filteredJobs = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return jobs.slice(0, 6);
    return jobs
      .filter(
        (job) =>
          job.title.toLowerCase().includes(q) ||
          (job.description ?? "").toLowerCase().includes(q) ||
          (job.location ?? "").toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [jobs, search]);

  const activeCount = useMemo(
    () => applications.filter((a) => !TERMINAL_LABEL[a.status]).length,
    [applications],
  );

  const interviewCount = useMemo(
    () =>
      applications.filter((a) =>
        ["first_interview", "technical_interview", "final_interview"].includes(a.status),
      ).length,
    [applications],
  );

  const appliedJobIds = useMemo(() => new Set(applications.map((a) => a.job_posting_id)), [applications]);

  const totalStages = STAGES.length;
  const currentStage = primaryApplication ? stageIndex(primaryApplication.status) + 1 : 0;
  const normalizedStage = Math.max(Math.min(currentStage, totalStages), 0);
  const progress = primaryApplication
    ? TERMINAL_LABEL[primaryApplication.status]
      ? 100
      : Math.round((normalizedStage / totalStages) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <Card className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] text-white shadow-sm">
        <div className="absolute inset-y-0 right-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_58%)]" />
        <CardHeader className="relative z-10 border-b border-white/15 pb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-1">Candidate Dashboard</p>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            Welcome back, {session?.name?.split(" ")[0] || "Applicant"}
          </CardTitle>
          <p className="text-sm text-white/75 mt-1">
            Track your applications and discover fresh opportunities in one place.
          </p>
        </CardHeader>
        <CardContent className="relative z-10 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Open Jobs"
            value={loading ? "..." : jobs.length.toString()}
            helper="Roles available now"
            icon={<Briefcase className="h-4 w-4" />}
            inverted
          />
          <MetricCard
            label="Applications"
            value={loading ? "..." : applications.length.toString()}
            helper="Total submitted"
            icon={<FileText className="h-4 w-4" />}
            inverted
          />
          <MetricCard
            label="In Progress"
            value={loading ? "..." : activeCount.toString()}
            helper="Awaiting next step"
            icon={<TrendingUp className="h-4 w-4" />}
            inverted
          />
          <MetricCard
            label="Interviews"
            value={loading ? "..." : interviewCount.toString()}
            helper="Interview stages reached"
            icon={<CalendarClock className="h-4 w-4" />}
            inverted
          />
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm overflow-hidden bg-card">
        <CardHeader className="bg-muted/20 border-b border-border pb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Current Application</p>
              {primaryApplication ? (
                <>
                  <CardTitle className="text-xl font-bold tracking-tight">
                    {primaryApplication.job_postings?.title ?? "Untitled role"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {statusLabel(primaryApplication.status)}  -  Applied {formatDate(primaryApplication.applied_at)}
                  </p>
                </>
              ) : (
                <CardTitle className="text-xl font-bold tracking-tight text-muted-foreground">
                  No applications yet
                </CardTitle>
              )}
            </div>
            {primaryApplication && (
              <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-tight rounded-full border ${statusPillClass(primaryApplication.status)}`}>
                {statusLabel(primaryApplication.status)}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {primaryApplication ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2.5" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {STAGES.map((stage) => {
                  const idx = stageIndex(stage.key) + 1;
                  const isDone = TERMINAL_LABEL[primaryApplication.status]
                    ? true
                    : normalizedStage > idx;
                  const isCurrent = !TERMINAL_LABEL[primaryApplication.status] && normalizedStage === idx;
                  return (
                    <div key={stage.key} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : isCurrent ? (
                        <CircleDot className="h-4 w-4 text-primary" />
                      ) : (
                        <CircleDot className="h-4 w-4 text-muted-foreground/40" />
                      )}
                      <span className={`text-xs font-medium ${isDone || isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm">
              Start by applying to an open role, then track every stage here.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <Card className="xl:col-span-3 border-border shadow-sm bg-card overflow-hidden">
          <CardHeader className="pb-4 bg-[linear-gradient(145deg,rgba(23,37,84,0.09),rgba(15,118,110,0.06))] border-b border-border/70">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Recommended Roles</p>
                <CardTitle className="text-lg font-bold tracking-tight">Latest Open Positions</CardTitle>
              </div>
              <Button asChild variant="ghost" className="text-primary hover:bg-primary/5">
                <Link href="/applicant/jobs">View Jobs</Link>
              </Button>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="text"
                placeholder="Search roles by title, keyword, or location..."
                className="pl-9 h-10 bg-card border-border"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No matching open roles.</p>
            ) : (
              filteredJobs.map((job) => {
                const alreadyApplied = appliedJobIds.has(job.job_posting_id);
                return (
                  <div key={job.job_posting_id} className="rounded-xl border border-border p-4 bg-muted/10 hover:bg-muted/20 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-foreground leading-tight">{job.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {job.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.location}
                            </span>
                          )}
                          {job.employment_type && (
                            <span className="inline-flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {job.employment_type}
                            </span>
                          )}
                          <span>{timeAgo(job.posted_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {alreadyApplied && (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-md border bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400 uppercase tracking-widest">
                            Applied
                          </span>
                        )}
                        <Button asChild size="sm">
                          <Link href="/applicant/jobs">View Role</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 border-border shadow-sm bg-card overflow-hidden">
          <CardHeader className="pb-4 bg-[linear-gradient(145deg,rgba(23,37,84,0.09),rgba(15,118,110,0.06))] border-b border-border/70">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Application Feed</p>
            <CardTitle className="text-lg font-bold tracking-tight">Recent Applications</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Quick view of your latest submissions and status.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentApplications.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No applications yet.</p>
            ) : (
              recentApplications.map((app) => (
                <div key={app.application_id} className="rounded-xl border border-border p-4 bg-muted/10">
                  <p className="font-semibold text-sm truncate text-foreground">
                    {app.job_postings?.title ?? "Untitled role"}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${statusPillClass(app.status)}`}>
                      {statusLabel(app.status)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(app.applied_at)}</span>
                  </div>
                </div>
              ))
            )}

            <div className="pt-1">
              <Button asChild variant="outline" className="w-full">
                <Link href="/applicant/applications">
                  <Sparkles className="h-4 w-4" />
                  Open Full Tracker
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  inverted = false,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  inverted?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${inverted ? "border-white/20 bg-white/10 backdrop-blur" : "border-border bg-muted/20"}`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${inverted ? "text-white/70" : "text-muted-foreground"}`}>{label}</p>
        <span className={`h-7 w-7 rounded-md border flex items-center justify-center ${inverted ? "bg-white/10 border-white/25 text-white" : "bg-primary/10 border-primary/20 text-primary"}`}>
          {icon}
        </span>
      </div>
      <p className={`text-2xl font-bold tracking-tight ${inverted ? "text-white" : "text-foreground"}`}>{value}</p>
      <p className={`text-xs mt-1 ${inverted ? "text-white/70" : "text-muted-foreground"}`}>{helper}</p>
    </div>
  );
}
