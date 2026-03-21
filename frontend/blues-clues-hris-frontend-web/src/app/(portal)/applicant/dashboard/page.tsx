"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserInfo, getAccessToken, parseJwt, type StoredUser } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import {
  getApplicantJobs, applyToJob, getMyApplications, getJobQuestions,
  type JobPosting, type ApplicationQuestion, type MyApplication,
} from "@/lib/authApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Check, Briefcase, MapPin, Clock,
  Search, ChevronRight, Building2, X, Loader2, CheckCircle,
  DollarSign, FileText, TrendingUp, CalendarClock, Sparkles,
} from "lucide-react";

// ─── Application Form Modal (same as in /applicant/jobs) ─────────────────────

function ApplicationForm({
  job,
  onClose,
  onApplied,
}: {
  job: JobPosting;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingQ, setLoadingQ] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const jwt = parseJwt(getAccessToken() ?? "");
  const userInfo = getUserInfo();
  const autoFill = {
    first_name:   jwt?.first_name   ?? "",
    last_name:    jwt?.last_name    ?? "",
    email:        userInfo?.email   ?? jwt?.email ?? "",
    phone_number: jwt?.phone_number ?? "",
  };

  useEffect(() => {
    getJobQuestions(job.job_posting_id)
      .then(setQuestions)
      .catch(() => {})
      .finally(() => setLoadingQ(false));
  }, [job.job_posting_id]);

  const setAnswer = (qId: string, val: string) =>
    setAnswers((p) => ({ ...p, [qId]: val }));

  const toggleCheckbox = (qId: string, idx: number) => {
    const current: number[] = (() => {
      try { return JSON.parse(answers[qId] ?? "[]"); }
      catch { return []; }
    })();
    const next = current.includes(idx) ? current.filter((i) => i !== idx) : [...current, idx];
    setAnswer(qId, JSON.stringify(next));
  };

  const checkedIndices = (qId: string): number[] => {
    try { return JSON.parse(answers[qId] ?? "[]"); }
    catch { return []; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const q of questions) {
      if (!q.is_required) continue;
      const val = answers[q.question_id];
      if (!val || (q.question_type === "checkbox" && JSON.parse(val ?? "[]").length === 0)) {
        toast.error(`Please answer: "${q.question_text}"`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = questions.map((q) => {
        let answer_value = answers[q.question_id] ?? "";
        if (q.question_type === "multiple_choice" && answer_value) {
          answer_value = q.options?.[parseInt(answer_value, 10)] ?? answer_value;
        }
        if (q.question_type === "checkbox" && answer_value) {
          try {
            const indices = JSON.parse(answer_value) as number[];
            answer_value = JSON.stringify(indices.map((i) => q.options?.[i] ?? "").filter(Boolean));
          } catch { answer_value = ""; }
        }
        return { question_id: q.question_id, answer_value };
      }).filter((a) => a.answer_value !== "");

      await applyToJob(job.job_posting_id, payload.length ? { answers: payload } : undefined);
      toast.success("Application submitted!");
      onApplied();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h3 className="font-bold text-lg">Apply — {job.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Complete the form below to submit your application</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Auto-filled info */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Your Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">First Name</label>
                <Input value={autoFill.first_name} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Last Name</label>
                <Input value={autoFill.last_name} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed" />
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Email</label>
              <Input value={autoFill.email} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed" />
            </div>
            {autoFill.phone_number && (
              <div className="mt-3 space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Phone Number</label>
                <Input value={autoFill.phone_number} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed" />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">Pulled from your account.</p>
          </div>

          {/* Dynamic questions */}
          {loadingQ ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : questions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Application Questions</p>
              <div className="space-y-5">
                {questions.map((q) => (
                  <div key={q.question_id} className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">
                      {q.question_text}
                      {q.is_required && <span className="text-destructive ml-1">*</span>}
                    </label>
                    {q.question_type === "text" && (
                      <textarea
                        value={answers[q.question_id] ?? ""}
                        onChange={(e) => setAnswer(q.question_id, e.target.value)}
                        placeholder="Your answer..."
                        required={q.is_required}
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    )}
                    {q.question_type === "multiple_choice" && q.options && (
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                              type="radio"
                              name={q.question_id}
                              value={String(oi)}
                              checked={answers[q.question_id] === String(oi)}
                              onChange={() => setAnswer(q.question_id, String(oi))}
                              required={q.is_required}
                              className="h-4 w-4 text-primary"
                            />
                            <span className="text-sm text-foreground group-hover:text-primary transition-colors">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {q.question_type === "checkbox" && q.options && (
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={checkedIndices(q.question_id).includes(oi)}
                              onChange={() => toggleCheckbox(q.question_id, oi)}
                              className="h-4 w-4 rounded text-primary"
                            />
                            <span className="text-sm text-foreground group-hover:text-primary transition-colors">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2 pb-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Application"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const STAGE_LABELS = ["Submitted", "Screening", "1st Interview", "Technical", "Final"];
const STAGE_KEYS   = ["submitted", "screening", "first_interview", "technical_interview", "final_interview"];

function stageIndex(status: string) {
  const i = STAGE_KEYS.indexOf(status);
  return i === -1 ? 0 : i;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicantDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<StoredUser | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [applyingJob, setApplyingJob] = useState<JobPosting | null>(null);
  const [latestApp, setLatestApp] = useState<MyApplication | null>(null);

  useEffect(() => {
    setSession(getUserInfo());
    Promise.all([
      getApplicantJobs().catch(() => [] as JobPosting[]),
      getMyApplications().catch(() => [] as MyApplication[]),
    ]).then(([jobList, myApps]) => {
      setJobs(jobList);
      setAppliedJobIds(new Set(myApps.map((a) => a.job_posting_id)));
      // Show the most recently applied job for the tracker
      if (myApps.length > 0) {
        const sorted = [...myApps].sort(
          (a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
        );
        setLatestApp(sorted[0]);
      }
    }).finally(() => setLoading(false));
  }, []);

  useWelcomeToast(session?.name || "Applicant", "Candidate Portal");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q) ||
        (j.employment_type ?? "").toLowerCase().includes(q)
    );
  }, [jobs, search]);

  const currentStep = latestApp ? stageIndex(latestApp.status) + 1 : 0;

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
              {latestApp ? (
                <>
                  <CardTitle className="text-xl font-bold tracking-tight">
                    {latestApp.job_postings?.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {STAGE_LABELS[stageIndex(latestApp.status)] ?? latestApp.status}
                    {latestApp.job_postings?.location && ` · ${latestApp.job_postings.location}`}
                  </p>
                </>
              ) : (
                <CardTitle className="text-xl font-bold tracking-tight text-muted-foreground">
                  No applications yet
                </CardTitle>
              )}
            </div>
            {latestApp && (
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-tight rounded-full border border-primary/20">
                Active Phase
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-10">
          {latestApp ? (
            <div className="relative flex items-center justify-between w-full max-w-4xl mx-auto">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted rounded-full z-0" />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full z-0 transition-all duration-1000"
                style={{ width: `${((currentStep - 1) / (STAGE_LABELS.length - 1)) * 100}%` }}
              />
              {STAGE_LABELS.map((label, i) => (
                <StepItem
                  key={label}
                  icon={i + 1 < currentStep ? <Check className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
                  label={label}
                  active={i + 1 <= currentStep}
                  completed={i + 1 < currentStep}
                  current={i + 1 === currentStep}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm">
              Start by applying to an open role, then track every stage here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Available Job Roles */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Available Positions</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {loading ? "Loading…" : `${jobs.length} open position${jobs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-card border-border focus-visible:ring-primary/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            {jobs.length === 0 ? "No open positions available." : "No jobs match your search."}
          </p>
        ) : (
          <>
            <div className="grid gap-3">
              {filtered.slice(0, 5).map((job) => {
                const applied = appliedJobIds.has(job.job_posting_id);
                return (
                  <Card
                    key={job.job_posting_id}
                    className="border-border shadow-sm hover:border-primary/40 transition-all group cursor-pointer bg-card"
                    onClick={() => router.push("/applicant/jobs")}
                  >
                    <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4 w-full">
                        <div className="h-12 w-12 rounded-xl border border-border bg-muted/30 flex items-center justify-center shrink-0 group-hover:bg-primary/5 transition-colors">
                          <Briefcase className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-foreground text-lg leading-none mb-2 group-hover:text-primary transition-colors">
                            {job.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-semibold uppercase tracking-tight">
                            {job.location && (
                              <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{job.location}</span>
                            )}
                            {job.employment_type && (
                              <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{job.employment_type}</span>
                            )}
                            {job.salary_range && (
                              <span className="flex items-center gap-1.5"><DollarSign className="h-3 w-3" />{job.salary_range}</span>
                            )}
                            <span className="flex items-center gap-1.5 normal-case font-normal">
                              {timeAgo(job.posted_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {applied ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-green-600 dark:text-green-400 border border-green-600/20 bg-green-500/10 px-3 py-1.5 rounded-lg">
                            <CheckCircle className="h-3.5 w-3.5" /> Applied
                          </span>
                        ) : (
                          <Button
                            className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6"
                            onClick={() => setApplyingJob(job)}
                          >
                            Apply Now <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {jobs.length > 5 && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="ghost"
                  className="text-primary font-bold hover:bg-primary/5 text-sm uppercase tracking-widest"
                  onClick={() => router.push("/applicant/jobs")}
                >
                  View all {jobs.length} open positions
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Card className="border-border shadow-sm bg-card overflow-hidden">
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

      {/* Application form modal */}
      {applyingJob && (
        <ApplicationForm
          job={applyingJob}
          onClose={() => setApplyingJob(null)}
          onApplied={() => {
            setAppliedJobIds((prev) => new Set([...prev, applyingJob.job_posting_id]));
            setApplyingJob(null);
            // Refresh applications to update the tracker
            getMyApplications().catch(() => []).then((apps) => {
              if (apps.length > 0) {
                const sorted = [...apps].sort(
                  (a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
                );
                setLatestApp(sorted[0]);
              }
            });
          }}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value, helper, icon, inverted }: {
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

function StepItem({ icon, label, active, completed, current }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  completed: boolean;
  current: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 relative z-10">
      <div className={`h-9 w-9 rounded-full border-2 flex items-center justify-center transition-all
        ${completed ? "bg-primary border-primary text-primary-foreground" :
          current ? "bg-background border-primary text-primary" :
          "bg-background border-border text-muted-foreground"}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest text-center max-w-[72px] leading-tight
        ${active ? "text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}
