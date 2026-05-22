"use client";

import { useEffect, useState } from "react";
import {
  Target, CheckCircle2, Clock, Medal,
  Plus, Star, Download, FileText, Check, TrendingUp, AlertOctagon, Hand,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type BSCCategory = "FINANCIAL" | "CUSTOMER" | "INTERNAL" | "LEARNING";

interface Goal {
  id: string;
  category: BSCCategory;
  title: string;
  desc: string;
  progress: number;
  status: string;
  statusColor: string;
  isPending?: boolean;
}

const BSC_CATEGORIES: BSCCategory[] = ["FINANCIAL", "CUSTOMER", "INTERNAL", "LEARNING"];

const CATEGORY_COLORS: Record<BSCCategory, { bg: string; text: string }> = {
  FINANCIAL: { bg: "bg-emerald-50 border border-emerald-200", text: "text-emerald-700" },
  CUSTOMER:  { bg: "bg-blue-50 border border-blue-200",      text: "text-blue-700"    },
  INTERNAL:  { bg: "bg-violet-50 border border-violet-200",  text: "text-violet-700"  },
  LEARNING:  { bg: "bg-amber-50 border border-amber-200",    text: "text-amber-700"   },
};

function statusColor(status: string): string {
  if (status === "ACHIEVED")         return "#10b981";
  if (status === "AT_RISK")          return "#ef4444";
  if (status === "PENDING_APPROVAL") return "#8b5cf6";
  return "#3b82f6";
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StepNode({ label, num, active, completed }: {
  label: string; num: number; active?: boolean; completed?: boolean;
}) {
  return (
    <div className="flex flex-col items-center w-1/4">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 z-10 text-xs font-bold transition-colors
        ${completed ? "bg-primary border-primary text-white"
        : active    ? "bg-white border-primary text-primary"
        :             "bg-white border-border text-muted-foreground"}`}
      >
        {completed ? <Check className="h-3.5 w-3.5" /> : num}
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-wider text-center mt-2 leading-tight
        ${active ? "text-primary" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}

function GoalCard({ goal, onLogProgress }: { goal: Goal; onLogProgress?: (id: string) => void }) {
  const cat = CATEGORY_COLORS[goal.category] ?? CATEGORY_COLORS["FINANCIAL"];
  const canLog = !goal.isPending && goal.status !== "ACHIEVED";
  return (
    <div className="p-4 bg-muted/20 rounded-xl border border-border hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${cat.bg} ${cat.text}`}>
          {goal.category}
        </span>
        <div className="flex items-center gap-2">
          {canLog && onLogProgress && (
            <button
              onClick={() => onLogProgress(goal.id)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold hover:bg-primary/20 transition-colors"
            >
              <TrendingUp className="h-3 w-3" /> Log Progress
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: goal.statusColor }} />
            <span className="text-[10px] font-bold" style={{ color: goal.statusColor }}>{goal.status}</span>
          </div>
        </div>
      </div>
      <p className="text-sm font-bold text-foreground mb-1">{goal.title}</p>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{goal.desc}</p>
      {goal.isPending ? (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold italic text-violet-600">Pending Manager Approval</span>
          <span className="text-[10px] text-muted-foreground">Submitted Just Now</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${goal.progress}%`, backgroundColor: goal.statusColor }}
            />
          </div>
          <span className="text-xs font-bold text-foreground min-w-[36px] text-right">{goal.progress}%</span>
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function EmployeePerformancePage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [history, setHistory] = useState<{ year: string; cycle: string; score: string; label: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  const [pip, setPip] = useState<any | null>(null);
  const [pipUpdateOpen, setPipUpdateOpen] = useState(false);
  const [pipUpdateText, setPipUpdateText] = useState("");
  const [pipMilestone, setPipMilestone] = useState("");

  const [progressOpen, setProgressOpen] = useState(false);
  const [progressGoalId, setProgressGoalId] = useState<string | null>(null);
  const [progressPct, setProgressPct] = useState(50);
  const [progressNotes, setProgressNotes] = useState("");

  const [proposeOpen, setProposeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const [selfAssessment, setSelfAssessment] = useState<any | null>(null);
  const [selfAssessmentOpen, setSelfAssessmentOpen] = useState(false);
  const [saGoalResults, setSaGoalResults] = useState<{ id: string; title: string; rating: string }[]>([]);
  const [saComments, setSaComments] = useState("");
  const [saSubmitting, setSaSubmitting] = useState(false);
  const [ratingLabels, setRatingLabels] = useState<string[]>(["Below Exp.", "Below Exp.", "Meets Exp.", "Above Avg.", "Excellent"]);

  const [newGoal, setNewGoal] = useState({
    title: "", category: "FINANCIAL" as BSCCategory,
    kpi: "", target: "", deadline: "",
  });

  useEffect(() => {
    authFetch(`${API_BASE_URL}/performance/pip/my`).then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length > 0) setPip(data[0]);
      else if (!Array.isArray(data) && data && !data.message && !data.error) setPip(data);
    }).catch(() => {});

    authFetch(`${API_BASE_URL}/performance/self-assessment/my`).then(r => r.json()).then(d => {
      if (d && !d.message && !d.error) setSelfAssessment(d);
    }).catch(() => {});

    authFetch(`${API_BASE_URL}/performance/settings/labels`).then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length === 5) setRatingLabels(d);
    }).catch(() => {});

    Promise.all([
      authFetch(`${API_BASE_URL}/performance/employee/dashboard`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/goals/my`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/evaluations/my`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/evaluations/my/history`).then(r => r.json()),
    ])
      .then(([dash, goalsData, evalData, histData]) => {
        setDashboard(dash);
        setGoals(Array.isArray(goalsData) ? goalsData : []);
        if (Array.isArray(evalData) && evalData.length > 0) {
          const ev = evalData.find((e: any) => e.review_period === "MID_YEAR") || evalData[0];
          setEvaluation(ev);
          setHasAcknowledged(!!ev?.employee_acknowledged_at);
        }
        setHistory(Array.isArray(histData) ? histData : []);
      })
      .catch(() => toast.error("Failed to load performance data"))
      .finally(() => setLoading(false));
  }, []);

  const handleProposeGoal = async () => {
    if (!newGoal.title.trim()) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newGoal.title,
          category: newGoal.category,
          kpi: newGoal.kpi,
          target: newGoal.target,
          deadline: newGoal.deadline || null,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.message);
      setGoals(prev => [{
        id: created.id ?? created.perf_goals_id,
        category: (created.category ?? created.bsc_category) as BSCCategory,
        title: created.title ?? created.goal_name,
        desc: created.desc ?? created.kpi_description ?? "",
        progress: created.progress ?? 0,
        status: created.status,
        statusColor: created.statusColor ?? statusColor(created.status),
        isPending: true,
      }, ...prev]);
      setProposeOpen(false);
      setNewGoal({ title: "", category: "FINANCIAL", kpi: "", target: "", deadline: "" });
      toast.success("Goal submitted for approval");
    } catch (err: any) {
      toast.error(err.message || "Failed to propose goal");
    }
  };

  const handleLogProgress = async () => {
    if (!progressGoalId) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/goals/${progressGoalId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress_pct: progressPct, notes: progressNotes }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setGoals(prev => prev.map(g => g.id === progressGoalId ? { ...g, progress: progressPct } : g));
      setProgressOpen(false);
      setProgressNotes("");
      toast.success("Progress logged");
    } catch (err: any) {
      toast.error(err.message || "Failed to log progress");
    }
  };

  const handleSubmitPipUpdate = async () => {
    if (!pip || !pipUpdateText.trim()) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/pip/${pip.perf_pip_id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress_summary: pipUpdateText, milestone_label: pipMilestone, progress_data: [] }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setPipUpdateOpen(false);
      setPipUpdateText("");
      setPipMilestone("");
      toast.success("PIP update submitted");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit PIP update");
    }
  };

  const handleAcknowledge = async () => {
    if (!evaluation) return;
    try {
      await authFetch(`${API_BASE_URL}/performance/evaluations/${evaluation.perf_eval_id}/acknowledge`, { method: "PATCH" });
      setHasAcknowledged(true);
      setReviewOpen(false);
      toast.success("Review acknowledged");
    } catch {
      toast.error("Failed to acknowledge review");
    }
  };

  const handleSubmitSelfAssessment = async () => {
    setSaSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/self-assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_results: saGoalResults, self_comments: saComments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSelfAssessment(data);
      setSelfAssessmentOpen(false);
      toast.success("Self-assessment submitted");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit self-assessment");
    } finally {
      setSaSubmitting(false);
    }
  };

  const handleDownloadHistory = (h: { year: string; cycle: string; score: string; label: string; status: string }) => {
    const rows = [
      ["Field", "Value"],
      ["Year",          h.year],
      ["Cycle",         h.cycle ?? "ANNUAL"],
      ["Rating Score",  h.score],
      ["Rating Label",  h.label],
      ["Result",        h.status ?? "PASS"],
      ["Employee",      dashboard?.employee_name ?? ""],
      ["Generated",     new Date().toLocaleDateString("en-CA")],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `performance_${h.year}_${(h.cycle ?? "ANNUAL").replace(/\s+/g, "_")}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Loading performance data...</div>;

  const cycleStage = dashboard?.cycle_stage === "MID_YEAR" ? "Mid-Year Checkpoint"
    : dashboard?.cycle_stage === "YEAR_END" ? "Year-End Review"
    : dashboard?.cycle_stage === "GOAL_SETTING" ? "Goal Setting"
    : (dashboard?.cycle_stage ?? "—");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-primary via-primary/90 to-blue-600 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-[10px] font-bold tracking-widest uppercase text-white/70 mb-1">
              MY PERFORMANCE — {dashboard?.cycle_name ?? "CURRENT CYCLE"}
            </p>
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Hand className="h-6 w-6 text-white/85" />
              Welcome back
            </h1>
            <p className="text-sm text-white/85 leading-relaxed max-w-lg">
              You&apos;re at the {cycleStage.toLowerCase()} stage. Keep the momentum — check your goals below.
            </p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-center shrink-0">
            <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mb-1">OVERALL PROGRESS</p>
            <p className="text-4xl font-bold">{dashboard?.overall_progress_pct ?? 0}%</p>
            <p className="text-[10px] text-white/80 font-semibold mt-1">{cycleStage}</p>
          </div>
        </div>
      </div>

      {/* ── Metrics Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Target,       label: "Active Goals",     value: String(dashboard?.active_goals_count ?? goals.length), sub: "BSC categories",  color: "bg-primary/10 text-primary"   },
          { icon: CheckCircle2, label: "Achieved",         value: String(dashboard?.achieved_count ?? 0),                sub: "of this cycle",   color: "bg-green-50 text-green-600"   },
          { icon: Clock,        label: "Days to Year-End", value: String(dashboard?.days_to_year_end ?? 0),              sub: "remaining",       color: "bg-amber-50 text-amber-600"   },
          { icon: Medal,        label: "Mid-Year Rating",  value: `${dashboard?.midyear_rating ?? "—"} / 5`,            sub: "current rating",  color: "bg-violet-50 text-violet-600" },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <Card key={label} className="p-5 border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </Card>
        ))}
      </div>

      {/* ── Performance Cycle Stepper ────────────────────────── */}
      <Card className="p-6 border-border">
        <p className="text-base font-bold mb-0.5">Performance Cycle — {dashboard?.cycle_name ?? "Current Cycle"}</p>
        <p className="text-xs text-muted-foreground mb-6">Your journey through this year&apos;s review cycle</p>
        <div className="relative">
          <div className="absolute top-3.5 left-[12.5%] right-[12.5%] h-0.5 bg-border" />
          <div className="relative flex justify-between">
            <StepNode label="Goal Setting"    num={1} completed={goals.length > 0} />
            <StepNode label="Mid-Year Review" num={2} completed={hasAcknowledged} active={!!evaluation && !hasAcknowledged} />
            <StepNode label="Year-End Review" num={3} active={hasAcknowledged} />
            <StepNode label="Outcomes"        num={4} />
          </div>
        </div>
      </Card>

      {/* ── Main Content Grid ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Goals Dashboard — 2/3 width */}
        <div className="lg:col-span-2">
          <Card className="p-6 border-border">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-base font-bold">My Goals Dashboard</p>
                <p className="text-xs text-muted-foreground mt-0.5">Balanced Scorecard — {dashboard?.cycle_name ?? "Current Cycle"}</p>
              </div>
              <Button
                variant="outline" size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => setProposeOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Propose Goal
              </Button>
            </div>
            <div className="space-y-3">
              {goals.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-8">No goals yet. Propose one or ask your manager to assign goals.</p>
                : goals.map(g => (
                  <GoalCard key={g.id} goal={g} onLogProgress={(id) => {
                    setProgressGoalId(id);
                    setProgressPct(g.progress);
                    setProgressOpen(true);
                  }} />
                ))
              }
            </div>
          </Card>
        </div>

        {/* Right Column — 1/3 width */}
        <div className="space-y-4">

          {/* Mid-Year Rating Card */}
          <Card className="p-6 border-border">
            <p className="text-base font-bold">Mid-Year Rating</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-5">
              {evaluation?.review_by_name ? `Reviewed by ${evaluation.review_by_name}` : "No review yet"}
            </p>
            <div className="flex flex-col items-center py-4 border-b border-border mb-4">
              <div className="text-5xl font-bold">
                {evaluation?.scale_rating ?? "—"}<span className="text-2xl text-muted-foreground font-semibold">/5</span>
              </div>
              <div className="flex gap-1 my-2">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`h-4 w-4 ${s <= (evaluation?.scale_rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-border"}`} />
                ))}
              </div>
              <p className="text-sm font-bold">{evaluation?.rating_status ?? "—"}</p>
              {hasAcknowledged ? (
                <span className="mt-3 px-3 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
                  ACKNOWLEDGED
                </span>
              ) : (
                <span className="mt-3 px-3 py-1 rounded-md bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-wide border border-green-200">
                  ON TRACK
                </span>
              )}
            </div>
            <Button
              variant="outline" size="sm"
              className="w-full gap-2 text-xs"
              onClick={() => setReviewOpen(true)}
              disabled={!evaluation}
            >
              <FileText className="h-3.5 w-3.5" />
              View Review Details
            </Button>
          </Card>

          {/* Self-Assessment */}
          <Card className="p-6 border-border">
            <p className="text-base font-bold">Self-Assessment</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              {selfAssessment ? "Submitted for this cycle" : "Not started yet"}
            </p>
            {selfAssessment ? (
              <div className="space-y-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                  <CheckCircle2 className="h-3 w-3" /> SUBMITTED
                </span>
                {selfAssessment.self_comments && (
                  <p className="text-xs text-muted-foreground italic leading-relaxed mt-2">
                    &ldquo;{selfAssessment.self_comments}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-4">
                Share how you feel you performed this cycle against your goals.
              </p>
            )}
            <Button variant="outline" size="sm" className="w-full gap-2 text-xs"
              onClick={() => {
                setSaGoalResults(goals.map(g => ({ id: g.id, title: g.title, rating: "" })));
                setSaComments(selfAssessment?.self_comments ?? "");
                setSelfAssessmentOpen(true);
              }}>
              <FileText className="h-3.5 w-3.5" />
              {selfAssessment ? "Update Self-Assessment" : "Complete Self-Assessment"}
            </Button>
          </Card>

          {/* Performance History */}
          <Card className="p-6 border-border">
            <p className="text-base font-bold mb-0.5">Performance History</p>
            <p className="text-xs text-muted-foreground mb-5">Past cycles</p>
            <div className="space-y-4">
              {history.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-4">No past cycles yet</p>
                : history.map(h => (
                  <div key={h.year} className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-bold">{h.year}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{h.cycle ?? "ANNUAL"}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-1 mx-4">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary">
                        <span className="text-white text-sm font-bold">{h.score}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold">{h.label}</p>
                        <p className={`text-[9px] font-bold uppercase tracking-wide ${h.status === "FAIL" ? "text-red-600" : "text-green-600"}`}>{h.status ?? "PASS"}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadHistory(h)}
                      className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))
              }
            </div>
          </Card>
        </div>
      </div>

      {/* ── PIP Section ─────────────────────────────────────── */}
      {pip && (
        <Card className="border-red-200 bg-red-50/30 overflow-hidden">
          <div className="p-6 border-b border-red-200 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg border border-red-200">
                <AlertOctagon className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-base font-bold text-red-900">Performance Improvement Plan</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Attempt {pip.attempt_num ?? 1} · Deadline: {pip.deadline ? new Date(pip.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border
                ${pip.pip_status === "In Progress" ? "bg-amber-50 text-amber-700 border-amber-200"
                : pip.pip_status === "Pending Approval" ? "bg-violet-50 text-violet-700 border-violet-200"
                : "bg-green-50 text-green-700 border-green-200"}`}>
                {pip.pip_status}
              </span>
              <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-100"
                onClick={() => setPipUpdateOpen(true)}>
                Submit Update
              </Button>
            </div>
          </div>
          {Array.isArray(pip.pip_goals) && pip.pip_goals.length > 0 && (
            <div className="p-6 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 mb-3">PIP Goals</p>
              {pip.pip_goals.map((g: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-red-100">
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${g.completed ? "bg-red-500 border-red-500" : "border-red-300"}`} />
                  <p className="text-sm text-foreground">{g.goal ?? g.title ?? g}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Propose Goal Modal ───────────────────────────────── */}
      <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Propose New Goal</DialogTitle>
            <p className="text-xs text-muted-foreground">Submit for manager review and approval</p>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Goal Title</label>
              <Input
                placeholder="e.g. Automate Customer Feedback"
                value={newGoal.title}
                onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">BSC Category</label>
              <div className="flex flex-wrap gap-2">
                {BSC_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setNewGoal({ ...newGoal, category: cat })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors
                      ${newGoal.category === cat
                        ? "bg-primary text-white border-primary"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/50"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">KPI Description</label>
              <Textarea
                placeholder="How will this be measured? Describe the target state."
                value={newGoal.kpi}
                onChange={e => setNewGoal({ ...newGoal, kpi: e.target.value })}
                className="resize-none h-20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Target Value</label>
                <Input
                  placeholder="e.g. 95%"
                  value={newGoal.target}
                  onChange={e => setNewGoal({ ...newGoal, target: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Deadline</label>
                <Input
                  placeholder="YYYY-MM-DD"
                  value={newGoal.deadline}
                  onChange={e => setNewGoal({ ...newGoal, deadline: e.target.value })}
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleProposeGoal} disabled={!newGoal.title.trim()}>
              Submit for Approval
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Review Details Modal ─────────────────────────────── */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{cycleStage} Performance Review</DialogTitle>
            <p className="text-xs text-muted-foreground">{dashboard?.cycle_name ?? "Current Cycle"} • {cycleStage}</p>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="bg-muted/20 rounded-xl p-4 border border-border space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide">Goal Checklist</p>
              <div className="space-y-3">
                {(evaluation?.goals_checklist ?? goals.map(g => ({ label: g.title, checked: g.status === "Achieved" }))).map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0
                      ${item.checked ? "bg-green-500 border-green-500" : "border-border bg-white"}`}>
                      {item.checked && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className={`text-sm font-medium ${item.checked ? "text-foreground" : "text-muted-foreground"}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs font-bold uppercase tracking-wide mb-3">Overall Rating</p>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(v => (
                    <div
                      key={v}
                      className={`flex-1 h-11 rounded-xl flex items-center justify-center border text-base font-bold
                        ${v === (evaluation?.scale_rating ?? 0) ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-border"}`}
                    >
                      {v}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{ratingLabels[0]}</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{ratingLabels[2]}</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{ratingLabels[4]}</span>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between mb-4">
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-1">REVIEWER</p>
                    <p className="text-sm font-bold">{evaluation?.review_by_name ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-1">DATE SIGNED</p>
                    <p className="text-sm font-bold">
                      {evaluation?.countersigned_at ? new Date(evaluation.countersigned_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-border">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-2">MANAGER COMMENTS</p>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    &ldquo;{evaluation?.perf_comments ?? "No comments yet."}&rdquo;
                  </p>
                </div>
              </div>
            </div>
            {!hasAcknowledged && evaluation && (
              <Button className="w-full" onClick={handleAcknowledge}>
                Acknowledge Review
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Log Progress Modal ───────────────────────────────── */}
      <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log Goal Progress</DialogTitle>
            <p className="text-xs text-muted-foreground">Update your current progress percentage</p>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
                Progress — {progressPct}%
              </label>
              <input
                type="range" min={0} max={100} value={progressPct}
                onChange={e => setProgressPct(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Notes (optional)</label>
              <Textarea
                value={progressNotes}
                onChange={e => setProgressNotes(e.target.value)}
                placeholder="What did you accomplish?"
                className="resize-none h-20"
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleLogProgress}>Save Progress</Button>
              <Button variant="outline" onClick={() => setProgressOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PIP Update Modal ─────────────────────────────────── */}
      <Dialog open={pipUpdateOpen} onOpenChange={setPipUpdateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit PIP Progress Update</DialogTitle>
            <p className="text-xs text-muted-foreground">Your manager will review this update</p>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Milestone Label</label>
              <Input
                value={pipMilestone}
                onChange={e => setPipMilestone(e.target.value)}
                placeholder="e.g. Week 2 Check-in"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Progress Summary *</label>
              <Textarea
                value={pipUpdateText}
                onChange={e => setPipUpdateText(e.target.value)}
                placeholder="Describe your progress this period..."
                className="resize-none h-24"
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSubmitPipUpdate} disabled={!pipUpdateText.trim()}>Submit Update</Button>
              <Button variant="outline" onClick={() => setPipUpdateOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Self-Assessment Modal ─────────────────────────────── */}
      <Dialog open={selfAssessmentOpen} onOpenChange={setSelfAssessmentOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Self-Assessment</DialogTitle>
            <p className="text-xs text-muted-foreground">Rate yourself on each goal and add overall comments</p>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {saGoalResults.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No active goals to assess.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Goal Self-Ratings</p>
                {saGoalResults.map((g, i) => (
                  <div key={g.id} className="bg-muted/20 rounded-xl p-3 border border-border">
                    <p className="text-sm font-semibold mb-2">{g.title}</p>
                    <Textarea
                      placeholder="Describe your progress on this goal..."
                      className="resize-none h-16 text-xs"
                      value={g.rating}
                      onChange={e => setSaGoalResults(prev =>
                        prev.map((x, idx) => idx === i ? { ...x, rating: e.target.value } : x)
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Overall Comments</label>
              <Textarea
                placeholder="Summarize your performance this cycle..."
                className="resize-none h-24"
                value={saComments}
                onChange={e => setSaComments(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSubmitSelfAssessment} disabled={saSubmitting}>
                {saSubmitting ? "Submitting..." : "Submit Self-Assessment"}
              </Button>
              <Button variant="outline" onClick={() => setSelfAssessmentOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
