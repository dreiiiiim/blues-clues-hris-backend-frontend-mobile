"use client";

import { useEffect, useState } from "react";
import {
  Users, CheckCircle2, AlertTriangle, Clock,
  Plus, ChevronRight, X, Check, AlertOctagon, Pencil, Trash2,
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

// ─── Types ──────────────────────────────────────────────────────────────────

type TeamStatus = "On Track" | "Exceeding" | "At Risk" | "PIP" | "Pending Review";
type BSCCategory = "FINANCIAL" | "CUSTOMER" | "INTERNAL" | "LEARNING";
type Priority = "High" | "Medium" | "Low";

const BSC_CATEGORIES: BSCCategory[] = ["FINANCIAL", "CUSTOMER", "INTERNAL", "LEARNING"];
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

const STATUS_CONFIG: Record<TeamStatus, { color: string; bg: string; border: string }> = {
  "On Track":      { color: "text-primary",     bg: "bg-primary/10",   border: "border-primary/30"   },
  "Exceeding":     { color: "text-green-700",   bg: "bg-green-50",     border: "border-green-200"    },
  "At Risk":       { color: "text-amber-700",   bg: "bg-amber-50",     border: "border-amber-200"    },
  "PIP":           { color: "text-red-700",     bg: "bg-red-50",       border: "border-red-200"      },
  "Pending Review":{ color: "text-gray-600",    bg: "bg-gray-50",      border: "border-gray-200"     },
};

const PRIORITY_COLORS: Record<Priority, string> = {
  High:   "bg-red-500",
  Medium: "bg-amber-500",
  Low:    "bg-primary",
};

function mapPerfStatus(status: string): TeamStatus {
  if (status === "ON_TRACK" || status === "In Progress") return "On Track";
  if (status === "EXCEEDING")    return "Exceeding";
  if (status === "AT_RISK")      return "At Risk";
  if (status === "PIP")          return "PIP";
  return "Pending Review";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TeamStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />
      {status}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ManagerPerformancePage() {
  const [team, setTeam] = useState<any[]>([]);
  const [managerDashboard, setManagerDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState("All");
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  // Goal form
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [goalForm, setGoalForm] = useState({
    title: "", category: "FINANCIAL" as BSCCategory,
    kpi: "", target: "", deadline: "", priority: "Medium" as Priority,
  });

  // Review form
  const [reviewGoals, setReviewGoals] = useState<{ id: string; title: string; category: string; completed: boolean; desc: string }[]>([]);
  const [rating, setRating] = useState(4);
  const [comments, setComments] = useState("");
  const [recommendations, setRecommendations] = useState({ promotion: false, bonus: false, merit: false });
  const [existingEvalId, setExistingEvalId] = useState<string | null>(null);
  const [teamEvaluations, setTeamEvaluations] = useState<any[]>([]);

  // PIP creation
  const [pipModalOpen, setPipModalOpen] = useState(false);
  const [pipTargetMember, setPipTargetMember] = useState<any | null>(null);
  const [pipForm, setPipForm] = useState({ deadline: "", goals: ["", "", ""] });

  // PIP update review
  const [pipReviewOpen, setPipReviewOpen] = useState(false);
  const [pipReviewMember, setPipReviewMember] = useState<any | null>(null);
  const [pipReviewUpdates, setPipReviewUpdates] = useState<any[]>([]);
  const [pipReviewNotes, setPipReviewNotes] = useState<Record<string, string>>({});

  // Self-assessment (shown inside review modal)
  const [memberSelfAssessment, setMemberSelfAssessment] = useState<any | null>(null);
  const [selfAssessmentExpanded, setSelfAssessmentExpanded] = useState(false);

  // Rating labels (from settings)
  const [ratingLabels, setRatingLabels] = useState<string[]>(["Below Exp.", "Below Exp.", "Meets Exp.", "Above Avg.", "Excellent"]);

  // Goal edit/delete
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalForm, setEditGoalForm] = useState({ title: "", category: "FINANCIAL" as BSCCategory, kpi: "", target: "", deadline: "", priority: "Medium" as Priority });

  // New Goal (inside review modal)
  const [reviewGoalForm, setReviewGoalForm] = useState({
    title: "", category: "INTERNAL" as BSCCategory,
    kpi: "", target: "", deadline: "", priority: "High" as Priority,
  });

  useEffect(() => {
    Promise.all([
      authFetch(`${API_BASE_URL}/performance/manager/dashboard`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/manager/team`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/evaluations/team`).then(r => r.json()),
    ])
      .then(([dash, teamData, evalsData]) => {
        setManagerDashboard(dash);
        const members = Array.isArray(teamData) ? teamData : [];
        setTeam(members);
        if (members.length > 0) setSelectedEmp(members[0].id);
        if (Array.isArray(evalsData)) setTeamEvaluations(evalsData);
      })
      .catch(() => toast.error("Failed to load team data"))
      .finally(() => setLoading(false));

    authFetch(`${API_BASE_URL}/performance/settings/labels`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d) && d.length === 5) setRatingLabels(d); })
      .catch(() => {});
  }, []);

  const filteredTeam = team.filter(m => {
    if (filter === "All")      return true;
    if (filter === "On Track") return m.status === "On Track";
    if (filter === "At Risk")  return m.status === "At Risk";
    if (filter === "In PIP")   return m.status === "PIP";
    if (filter === "Pending")  return m.status === "Pending Review";
    return true;
  });

  const openReview = async (member: any) => {
    setSelectedMember(member);
    setReviewModalOpen(true);
    setReviewGoals([]);
    setRating(4);
    setComments("");
    setRecommendations({ promotion: false, bonus: false, merit: false });
    setExistingEvalId(null);
    setMemberSelfAssessment(null);
    setSelfAssessmentExpanded(false);

    // Pre-populate from existing evaluation if one exists for this cycle
    const existing = teamEvaluations.find((e: any) => e.user_id === member.id || e.employee_id === member.id);
    if (existing) {
      setExistingEvalId(existing.perf_eval_id ?? existing.id ?? null);
      setRating(existing.scale_rating ?? 4);
      setComments(existing.perf_comments ?? "");
      if (existing.recommendations) setRecommendations(existing.recommendations);
    }
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/goals/team`);
      const allGoals = await res.json();
      if (Array.isArray(allGoals)) {
        const memberGoals = allGoals.filter((g: any) => g.user_id === member.id);
        setReviewGoals(memberGoals.map((g: any) => ({
          id: g.id,
          title: g.title,
          category: g.category,
          completed: g.status === "Achieved",
          desc: g.desc ?? "",
        })));
      }
    } catch {
      toast.error("Failed to load employee goals");
    }
    try {
      const saRes = await authFetch(`${API_BASE_URL}/performance/self-assessment/user/${member.id}`);
      const saData = await saRes.json();
      if (saData && !saData.message && !saData.error) setMemberSelfAssessment(saData);
    } catch { /* stays null */ }
  };

  const handleCreateGoal = async () => {
    if (!goalForm.title.trim()) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedEmp,
          title: goalForm.title,
          category: goalForm.category,
          kpi: goalForm.kpi,
          target: goalForm.target,
          deadline: goalForm.deadline || null,
          priority: goalForm.priority,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Goal assigned — pending HR approval");
      setGoalModalOpen(false);
      setGoalForm({ title: "", category: "FINANCIAL", kpi: "", target: "", deadline: "", priority: "Medium" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create goal");
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedMember) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedMember.id,
          review_type: "MANAGER",
          scale_rating: rating,
          rating_status: rating >= 3 ? "PASS" : "FAIL",
          review_period: "MID_YEAR",
          perf_comments: comments,
          recommendations: {
            promotion: recommendations.promotion,
            bonus: recommendations.bonus,
            merit: recommendations.merit,
          },
          goal_results: reviewGoals.map(g => ({ perf_goals_id: g.id, completed: g.completed })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Review submitted for HR approval");
      setReviewModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    }
  };

  const handleCreatePip = async () => {
    if (!pipTargetMember || !pipForm.deadline) return;
    const goals = pipForm.goals.filter(g => g.trim()).map(g => ({ goal: g }));
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/pip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: pipTargetMember.id,
          deadline: pipForm.deadline,
          pip_goals: goals,
          attempt_num: 1,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success(`PIP initiated for ${pipTargetMember.name} — pending HR approval`);
      setPipModalOpen(false);
      setPipForm({ deadline: "", goals: ["", "", ""] });
      setTeam(prev => prev.map(m => m.id === pipTargetMember.id ? { ...m, status: "PIP" } : m));
    } catch (err: any) {
      toast.error(err.message || "Failed to create PIP");
    }
  };

  const openPipReview = async (member: any) => {
    setPipReviewMember(member);
    setPipReviewUpdates([]);
    setPipReviewNotes({});
    setPipReviewOpen(true);
    try {
      const teamPips = await authFetch(`${API_BASE_URL}/performance/pip/team`).then(r => r.json());
      const memberPip = Array.isArray(teamPips) ? teamPips.find((p: any) => p.user_id === member.id) : null;
      if (memberPip) {
        const updates = await authFetch(`${API_BASE_URL}/performance/pip/${memberPip.perf_pip_id}/updates`).then(r => r.json());
        setPipReviewUpdates(Array.isArray(updates) ? updates : []);
      }
    } catch {
      toast.error("Failed to load PIP updates");
    }
  };

  const handleReviewPipUpdate = async (updateId: string, status: "APPROVED" | "NEEDS_REVISION") => {
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/pip-updates/${updateId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, manager_notes: pipReviewNotes[updateId] ?? "" }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success(status === "APPROVED" ? "Update approved" : "Revision requested");
      setPipReviewUpdates(prev => prev.map(u => u.perf_pip_update_id === updateId ? { ...u, status } : u));
    } catch (err: any) {
      toast.error(err.message || "Failed to review update");
    }
  };

  const handleReviewGoalSubmit = async () => {
    if (!reviewGoalForm.title.trim() || !selectedMember) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedMember.id,
          title: reviewGoalForm.title,
          category: reviewGoalForm.category,
          kpi: reviewGoalForm.kpi,
          target: reviewGoalForm.target,
          deadline: reviewGoalForm.deadline || null,
          priority: reviewGoalForm.priority,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.message);
      // Immediately surface the new goal in the checklist above
      setReviewGoals(prev => [...prev, {
        id: created.id ?? Date.now().toString(),
        title: reviewGoalForm.title,
        category: reviewGoalForm.category,
        completed: false,
        desc: reviewGoalForm.kpi,
      }]);
      toast.success("Goal submitted — pending HR approval");
      setReviewGoalForm({ title: "", category: "INTERNAL", kpi: "", target: "", deadline: "", priority: "High" });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit goal");
    }
  };

  const handleEditGoalSave = async (goalId: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editGoalForm.title,
          category: editGoalForm.category,
          kpi: editGoalForm.kpi,
          target: editGoalForm.target,
          deadline: editGoalForm.deadline || null,
          priority: editGoalForm.priority,
        }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.message);
      setReviewGoals(prev => prev.map(g => g.id === goalId ? { ...g, title: editGoalForm.title, category: editGoalForm.category, desc: editGoalForm.kpi } : g));
      setEditingGoalId(null);
      toast.success("Goal updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update goal");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm("Delete this goal? This cannot be undone.")) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/goals/${goalId}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      setReviewGoals(prev => prev.filter(g => g.id !== goalId));
      toast.success("Goal deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete goal");
    }
  };

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Loading team data...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-primary via-primary/90 to-blue-600 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-[10px] font-bold tracking-widest uppercase text-white/70 mb-1">
              TEAM PERFORMANCE DASHBOARD
            </p>
            <h1 className="text-2xl font-bold mb-2">{managerDashboard?.cycle_name ?? "Current Cycle"} — {team.length} Direct Reports</h1>
            <p className="text-sm text-white/85 leading-relaxed max-w-lg">
              {managerDashboard?.on_track_count ?? 0} on track for year-end. {managerDashboard?.at_risk_count ?? 0} at risk. {managerDashboard?.active_pip_count ?? 0} active PIP.
            </p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-center shrink-0">
            <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mb-1">TEAM AVG RATING</p>
            <p className="text-4xl font-bold">{managerDashboard?.team_avg_rating ?? "—"}</p>
            <p className="text-[10px] text-white/80 font-semibold mt-1">{managerDashboard?.cycle_stage?.replace("_", " ") ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* ── Metrics ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users,         label: "Direct Reports", value: String(managerDashboard?.team_count ?? team.length), sub: "all assigned goals",  color: "bg-primary/10 text-primary"   },
          { icon: CheckCircle2,  label: "On Track",       value: String(managerDashboard?.on_track_count ?? 0),          sub: "of team",             color: "bg-green-50 text-green-600"   },
          { icon: AlertTriangle, label: "At Risk",        value: String(managerDashboard?.at_risk_count ?? 0),           sub: "coaching needed",     color: "bg-amber-50 text-amber-600"   },
          { icon: Clock,         label: "Active PIPs",    value: String(managerDashboard?.active_pip_count ?? 0),        sub: "this cycle",          color: "bg-red-50 text-red-600"       },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <Card key={label} className="p-5 border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${color}`}><Icon className="h-4 w-4" /></div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </Card>
        ))}
      </div>

      {/* ── Team Overview Table ───────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-base font-bold">Team Overview</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click Review to conduct evaluation or add comments</p>
            </div>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setGoalModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Set New Goal
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["All", "On Track", "At Risk", "In PIP", "Pending"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors
                  ${filter === f
                    ? "bg-primary text-white border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border">
          {filteredTeam.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No team members found.</p>
          ) : filteredTeam.map(member => {
            const displayStatus = (member.status as TeamStatus) ?? "Pending Review";
            return (
              <div key={member.id} className="p-5 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-48">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {member.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-1 flex-wrap">
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">STAGE</p>
                      <p className="text-xs font-semibold">{member.stage ?? managerDashboard?.cycle_stage?.replace("_", " ") ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">GOALS</p>
                      <p className="text-xs font-semibold">
                        {member.goals ?? 0} goals{" "}
                        <span className="text-green-600">({member.achieved ?? 0} achieved)</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">RATING</p>
                      <p className="text-xs font-bold">{member.rating ?? "—"} <span className="text-muted-foreground font-normal">/ 5</span></p>
                    </div>
                    <StatusBadge status={displayStatus} />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {displayStatus === "At Risk" && (
                      <Button
                        variant="outline" size="sm"
                        className="gap-1 text-xs border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => { setPipTargetMember(member); setPipModalOpen(true); }}
                      >
                        <AlertOctagon className="h-3.5 w-3.5" /> Start PIP
                      </Button>
                    )}
                    <Button
                      variant="outline" size="sm"
                      className="gap-1 text-xs"
                      onClick={() => displayStatus === "PIP" ? openPipReview(member) : openReview(member)}
                    >
                      {displayStatus === "PIP" ? "Check-in" : "Review"}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Set New Goal Modal ────────────────────────────────── */}
      <Dialog open={goalModalOpen} onOpenChange={v => {
        setGoalModalOpen(v);
        if (!v) {
          setEmpSearch("");
          if (team.length > 0) setSelectedEmp(team[0].id);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Set New Goal</DialogTitle>
            <p className="text-xs text-muted-foreground">Assign a performance objective to a direct report</p>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Select Employee</label>
              <Input
                placeholder="Search employee by name..."
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
                className="mb-2"
              />
              <div className="border border-border rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                {team.filter(emp => emp.name?.toLowerCase().includes(empSearch.toLowerCase())).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No employees found.</p>
                ) : (
                  team
                    .filter(emp => emp.name?.toLowerCase().includes(empSearch.toLowerCase()))
                    .map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => { setSelectedEmp(emp.id); setEmpSearch(emp.name); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-border last:border-0
                          ${selectedEmp === emp.id ? "bg-primary/10" : "hover:bg-muted/40"}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                          ${selectedEmp === emp.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                          {emp.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${selectedEmp === emp.id ? "text-primary" : "text-foreground"}`}>
                            {emp.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">{emp.role}</p>
                        </div>
                        {selectedEmp === emp.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                    ))
                )}
              </div>
              {selectedEmp && (() => {
                const sel = team.find(e => e.id === selectedEmp);
                return sel ? (
                  <p className="text-[10px] text-muted-foreground mt-1.5 pl-1">
                    Selected: <span className="font-bold text-foreground">{sel.name}</span> — {sel.role}
                  </p>
                ) : null;
              })()}
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Goal Title</label>
              <Input placeholder="e.g. Optimize Database Performance"
                value={goalForm.title} onChange={e => setGoalForm({ ...goalForm, title: e.target.value })} />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">BSC Category</label>
              <div className="flex flex-wrap gap-2">
                {BSC_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setGoalForm({ ...goalForm, category: cat })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors
                      ${goalForm.category === cat ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/50"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">KPI Description</label>
              <Textarea placeholder="Describe how success will be measured..."
                value={goalForm.kpi} onChange={e => setGoalForm({ ...goalForm, kpi: e.target.value })}
                className="resize-none h-20" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Target Value</label>
                <Input placeholder="e.g. 20% improvement"
                  value={goalForm.target} onChange={e => setGoalForm({ ...goalForm, target: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Deadline</label>
                <Input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={goalForm.deadline}
                  onChange={e => setGoalForm({ ...goalForm, deadline: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button key={p} onClick={() => setGoalForm({ ...goalForm, priority: p })}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors
                      ${goalForm.priority === p ? `${PRIORITY_COLORS[p]} text-white border-transparent` : "bg-muted text-muted-foreground border-border"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={handleCreateGoal} disabled={!goalForm.title.trim()}>
              Create &amp; Assign Goal → Pending HR Approval
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Review Modal ──────────────────────────────────────── */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Year-End Review — {selectedMember?.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">{selectedMember?.role} • Checklist-style evaluation</p>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Goal Checklist */}
            <div className="bg-muted/20 rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wide">Goal Checklist</p>
                <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[9px] font-bold border border-violet-200">DRAFT</span>
              </div>
              {reviewGoals.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-4">No goals found for this employee.</p>
                : (
                  <div className="space-y-3">
                    {reviewGoals.map(g => (
                      <div key={g.id}>
                        {editingGoalId === g.id ? (
                          // Inline edit form
                          <div className="bg-white border border-primary/30 rounded-xl p-3 space-y-2">
                            <Input
                              value={editGoalForm.title}
                              onChange={e => setEditGoalForm(p => ({ ...p, title: e.target.value }))}
                              placeholder="Goal title"
                              className="text-sm h-8"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-wrap gap-1">
                                {BSC_CATEGORIES.map(cat => (
                                  <button key={cat} onClick={() => setEditGoalForm(p => ({ ...p, category: cat }))}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors
                                      ${editGoalForm.category === cat ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-border"}`}>
                                    {cat}
                                  </button>
                                ))}
                              </div>
                              <Input
                                value={editGoalForm.target}
                                onChange={e => setEditGoalForm(p => ({ ...p, target: e.target.value }))}
                                placeholder="Target value"
                                className="text-xs h-8"
                              />
                            </div>
                            <Textarea
                              value={editGoalForm.kpi}
                              onChange={e => setEditGoalForm(p => ({ ...p, kpi: e.target.value }))}
                              placeholder="KPI description"
                              className="resize-none h-14 text-xs"
                            />
                            <div className="flex gap-1.5">
                              <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleEditGoalSave(g.id)}>Save</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingGoalId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          // Read-only row with checkbox + actions
                          <div className="flex items-start gap-3">
                            <button onClick={() => setReviewGoals(prev => prev.map(x => x.id === g.id ? { ...x, completed: !x.completed } : x))}
                              className="shrink-0 mt-0.5">
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
                                ${g.completed ? "bg-primary border-primary" : "border-border bg-white"}`}>
                                {g.completed && <Check className="h-3 w-3 text-white" />}
                              </div>
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${g.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {g.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">{g.desc}</p>
                            </div>
                            <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                              {g.category}
                            </span>
                            <button
                              onClick={() => { setEditingGoalId(g.id); setEditGoalForm({ title: g.title, category: g.category as BSCCategory, kpi: g.desc, target: "", deadline: "", priority: "Medium" }); }}
                              className="shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteGoal(g.id)}
                              className="shrink-0 p-1 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              }
            </div>

            {/* Employee Self-Assessment (collapsible) */}
            {memberSelfAssessment && (
              <div className="bg-muted/20 rounded-xl border border-border overflow-hidden">
                <button className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => setSelfAssessmentExpanded(v => !v)}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">Employee Self-Assessment</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Submitted by employee for this cycle</p>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${selfAssessmentExpanded ? "rotate-90" : ""}`} />
                </button>
                {selfAssessmentExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {Array.isArray(memberSelfAssessment.goal_results) && memberSelfAssessment.goal_results.length > 0
                      ? memberSelfAssessment.goal_results.map((gr: any, i: number) => (
                          <div key={i} className="bg-white rounded-lg p-3 border border-border">
                            <p className="text-xs font-bold mb-1">{gr.title ?? `Goal ${i + 1}`}</p>
                            <p className="text-xs text-muted-foreground">{gr.rating ?? "(no rating provided)"}</p>
                          </div>
                        ))
                      : <p className="text-xs text-muted-foreground">No per-goal ratings provided.</p>
                    }
                    {memberSelfAssessment.self_comments && (
                      <div className="bg-white rounded-lg p-3 border border-border">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-1">OVERALL COMMENTS</p>
                        <p className="text-xs text-muted-foreground italic">&ldquo;{memberSelfAssessment.self_comments}&rdquo;</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Overall Rating */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3 block">Overall Rating</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(v => (
                  <button key={v} onClick={() => setRating(v)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-colors
                      ${rating === v ? "bg-primary/10 border-primary" : "bg-muted border-border hover:border-primary/50"}`}>
                    <span className={`text-base font-bold ${rating === v ? "text-primary" : "text-muted-foreground"}`}>{v}</span>
                    <span className={`text-[8px] font-bold text-center leading-tight ${rating === v ? "text-primary" : "text-muted-foreground"}`}>
                      {ratingLabels[v - 1]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Manager Comments</label>
              <Textarea value={comments} onChange={e => setComments(e.target.value)}
                placeholder="Enter your feedback here..." className="resize-none h-24" />
            </div>

            <Button className="w-full gap-2" onClick={handleSubmitReview}>
              {existingEvalId ? "Update Review" : "Submit for HR Approval"}
            </Button>

            {/* New Goal Form */}
            <div className="bg-muted/20 rounded-xl p-4 border border-border space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide">New Goal — {selectedMember?.name?.split(" ")[0]}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Goal Setting Form</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Goal Title</label>
                <Input
                  placeholder="e.g. Migrate HR microservices"
                  value={reviewGoalForm.title}
                  onChange={e => setReviewGoalForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">BSC Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {BSC_CATEGORIES.map(cat => (
                      <button key={cat}
                        onClick={() => setReviewGoalForm(prev => ({ ...prev, category: cat }))}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors
                          ${reviewGoalForm.category === cat ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-border"}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Deadline</label>
                  <Input
                    placeholder="YYYY-MM-DD"
                    value={reviewGoalForm.deadline}
                    onChange={e => setReviewGoalForm(prev => ({ ...prev, deadline: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">KPI Description</label>
                <Textarea
                  placeholder="Describe success metrics..."
                  value={reviewGoalForm.kpi}
                  onChange={e => setReviewGoalForm(prev => ({ ...prev, kpi: e.target.value }))}
                  className="resize-none h-16"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Target Value</label>
                  <Input
                    placeholder="e.g. 3 instances"
                    value={reviewGoalForm.target}
                    onChange={e => setReviewGoalForm(prev => ({ ...prev, target: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Priority</label>
                  <div className="flex gap-1.5">
                    {PRIORITIES.map(p => (
                      <button key={p}
                        onClick={() => setReviewGoalForm(prev => ({ ...prev, priority: p }))}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-colors
                          ${reviewGoalForm.priority === p
                            ? `${PRIORITY_COLORS[p]} text-white border-transparent`
                            : "bg-muted text-muted-foreground border-border"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                variant="outline"
                disabled={!reviewGoalForm.title.trim()}
                onClick={handleReviewGoalSubmit}
              >
                Submit → Pending HR Approval
              </Button>
            </div>

            {/* Outcome Recommendations */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3 block">
                Outcome Recommendations — Based on rating {rating}.0
              </label>
              <div className="space-y-2">
                {[
                  { key: "promotion", label: "Recommend for Promotion",        sub: "Promote to next level"                        },
                  { key: "bonus",     label: "Recommend for Performance Bonus", sub: "System computed based on rating"              },
                  { key: "merit",     label: "Recommend for Merit Increase",    sub: "Suggested based on bonus rules"               },
                ].map(rec => (
                  <button key={rec.key}
                    onClick={() => setRecommendations(prev => ({ ...prev, [rec.key]: !prev[rec.key as keyof typeof prev] }))}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left
                      ${recommendations[rec.key as keyof typeof recommendations]
                        ? "bg-primary/5 border-primary/30"
                        : "bg-white border-border hover:border-primary/30"}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
                      ${recommendations[rec.key as keyof typeof recommendations] ? "bg-primary border-primary" : "border-border"}`}>
                      {recommendations[rec.key as keyof typeof recommendations] && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{rec.label}</p>
                      <p className="text-xs text-muted-foreground">{rec.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={() => setReviewModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PIP Check-in Review Modal ─────────────────────────── */}
      <Dialog open={pipReviewOpen} onOpenChange={setPipReviewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-red-600" />
              PIP Check-in — {pipReviewMember?.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">{pipReviewMember?.role} · Review submitted progress updates</p>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {pipReviewUpdates.length === 0 ? (
              <div className="text-center py-8">
                <AlertOctagon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No updates submitted yet.</p>
                <p className="text-xs text-muted-foreground mt-1">The employee has not submitted any progress updates.</p>
              </div>
            ) : (
              pipReviewUpdates.map((update: any) => {
                const uid = update.perf_pip_update_id;
                const isReviewed = update.status === "APPROVED" || update.status === "NEEDS_REVISION";
                return (
                  <div key={uid} className={`rounded-xl border p-4 space-y-3 ${
                    update.status === "APPROVED" ? "border-green-200 bg-green-50"
                    : update.status === "NEEDS_REVISION" ? "border-amber-200 bg-amber-50"
                    : "border-border bg-muted/20"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-foreground">{update.milestone_label ?? "Progress Update"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {update.submitted_at ? new Date(update.submitted_at).toLocaleDateString() : "Recently submitted"}
                        </p>
                      </div>
                      {isReviewed && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          update.status === "APPROVED"
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }`}>
                          {update.status === "APPROVED" ? "Approved" : "Needs Revision"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{update.progress_summary ?? update.notes}</p>
                    {!isReviewed && (
                      <div className="space-y-2 pt-1">
                        <Textarea
                          placeholder="Manager notes (optional)..."
                          className="resize-none h-16 text-xs"
                          value={pipReviewNotes[uid] ?? ""}
                          onChange={e => setPipReviewNotes(prev => ({ ...prev, [uid]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm" className="flex-1 gap-1 bg-green-600 hover:bg-green-700"
                            onClick={() => handleReviewPipUpdate(uid, "APPROVED")}
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm" variant="outline" className="flex-1 gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => handleReviewPipUpdate(uid, "NEEDS_REVISION")}
                          >
                            <X className="h-3.5 w-3.5" /> Request Revision
                          </Button>
                        </div>
                      </div>
                    )}
                    {isReviewed && update.manager_notes && (
                      <p className="text-xs italic text-muted-foreground border-t border-border pt-2">
                        Manager note: {update.manager_notes}
                      </p>
                    )}
                  </div>
                );
              })
            )}
            <Button variant="outline" className="w-full" onClick={() => setPipReviewOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Start PIP Modal ───────────────────────────────────── */}
      <Dialog open={pipModalOpen} onOpenChange={setPipModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-red-600" />
              Initiate PIP — {pipTargetMember?.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">{pipTargetMember?.role} · Requires HR approval</p>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">PIP Deadline *</label>
              <Input type="date" value={pipForm.deadline}
                onChange={e => setPipForm(p => ({ ...p, deadline: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Improvement Goals</label>
              <div className="space-y-2">
                {pipForm.goals.map((g, i) => (
                  <Input key={i} value={g} placeholder={`Goal ${i + 1}`}
                    onChange={e => setPipForm(p => {
                      const goals = [...p.goals];
                      goals[i] = e.target.value;
                      return { ...p, goals };
                    })} />
                ))}
              </div>
              <button
                onClick={() => setPipForm(p => ({ ...p, goals: [...p.goals, ""] }))}
                className="mt-2 text-[10px] font-bold text-primary flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add goal
              </button>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-800">This will be sent to HR for approval. The employee will be notified once approved.</p>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleCreatePip}
                disabled={!pipForm.deadline || pipForm.goals.every(g => !g.trim())}>
                Submit PIP for HR Approval
              </Button>
              <Button variant="outline" onClick={() => setPipModalOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
