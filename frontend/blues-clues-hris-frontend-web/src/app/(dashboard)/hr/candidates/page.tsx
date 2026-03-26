"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Briefcase, ChevronDown, ChevronUp, GripVertical,
  Star, TrendingUp, Users, Trophy,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
// (backend): Replace with API response types from GET /jobs/{job_id}/candidates/ranked

type RankingMode = "sfia" | "manual";

interface SFIAPillar {
  name: string;
  demand: number;  // 0–100: how much the job requires this skill
  supply: number;  // 0–100: candidate's assessed score for this skill
  weight: number;  // contribution to overall fit score (all weights sum to 1.0)
}

interface RankedCandidate {
  application_id: string;
  first_name: string;
  last_name: string;
  email: string;
  applied_at: string;
  status: string;
  fit_percentage: number;  // computed: Σ(weight × min(supply/demand, 1)) × 100
  sfia_rank: number;       // server-computed rank by SFIA pillars
  manual_rank: number;     // HR-defined rank (defaults to sfia_rank)
  pillars: SFIAPillar[];
}

interface JobOption {
  job_posting_id: string;
  title: string;
  department: string;
  total_applicants: number;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────
// (backend): Replace MOCK_JOBS with GET /jobs?status=open
// (backend): Replace generateMockCandidates with GET /jobs/{job_id}/candidates/ranked

const MOCK_JOBS: JobOption[] = [
  { job_posting_id: "j1", title: "Senior Software Engineer", department: "Engineering", total_applicants: 48 },
  { job_posting_id: "j2", title: "Product Manager",          department: "Product",     total_applicants: 35 },
  { job_posting_id: "j3", title: "UX Designer",              department: "Design",      total_applicants: 22 },
];

// SFIA pillar definitions with weights (must sum to 1.0)
const SFIA_PILLARS = [
  { name: "Technical Proficiency", weight: 0.3 },
  { name: "Problem Solving",       weight: 0.2 },
  { name: "Communication",         weight: 0.2 },
  { name: "Collaboration",         weight: 0.15 },
  { name: "Leadership",            weight: 0.1 },
  { name: "Adaptability",          weight: 0.05 },
];

// Demand scores per job (what the company needs per pillar)
const JOB_DEMAND: Record<string, number[]> = {
  j1: [90, 85, 70, 65, 60, 75],
  j2: [60, 80, 85, 75, 80, 70],
  j3: [75, 70, 80, 70, 55, 80],
};

const MOCK_NAMES = [
  ["James", "Rivera"],    ["Sofia", "Chen"],      ["Marcus", "Okafor"],
  ["Elena", "Patel"],     ["Lucas", "Fernandez"], ["Aisha", "Johnson"],
  ["Noah", "Kim"],        ["Priya", "Sharma"],    ["Ethan", "Williams"],
  ["Chloe", "Martinez"],  ["Liam", "Nguyen"],     ["Zara", "Thompson"],
  ["Oliver", "Lee"],      ["Maya", "Anderson"],   ["Kai", "Brown"],
  ["Nadia", "Davis"],     ["Finn", "Wilson"],     ["Layla", "Garcia"],
  ["Mateo", "Taylor"],    ["Jade", "Moore"],      ["Soren", "Jackson"],
  ["Amara", "White"],     ["Dylan", "Harris"],    ["Yuki", "Clark"],
];

const MOCK_STATUSES = ["Final Interview", "Final Interview", "Technical", "Technical",
  "Technical", "Screening", "Screening", "Screening", "Screening", "Screening",
  "Submitted", "Submitted", "Submitted", "Submitted", "Submitted",
  "Submitted", "Submitted", "Submitted", "Submitted", "Submitted",
  "Submitted", "Submitted", "Submitted", "Submitted"];

function generateMockCandidates(jobId: string): RankedCandidate[] {
  const demands = JOB_DEMAND[jobId] ?? [75, 75, 75, 75, 75, 75];
  const seed = jobId.codePointAt(1) ?? 0;

  const candidates = MOCK_NAMES.map(([first, last], i) => {
    const base = 88 - i * 2.2 + (seed % 5);
    const pillars: SFIAPillar[] = SFIA_PILLARS.map((p, pi) => {
      const variance = ((i * 7 + pi * 13 + seed) % 25) - 12;
      const supply = Math.max(30, Math.min(100, Math.round(base + variance)));
      return { name: p.name, demand: demands[pi], supply, weight: p.weight };
    });

    const fit = Math.round(
      pillars.reduce((sum, p) => sum + p.weight * Math.min(p.supply / p.demand, 1) * 100, 0)
    );

    return {
      application_id: `app-${jobId}-${i}`,
      first_name: first,
      last_name: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@email.com`,
      applied_at: new Date(Date.now() - i * 86_400_000 * 2).toISOString(),
      status: MOCK_STATUSES[i] ?? "Submitted",
      fit_percentage: fit,
      sfia_rank: 0,
      manual_rank: 0,
      pillars,
    };
  });

  const sorted = candidates.toSorted((a, b) => b.fit_percentage - a.fit_percentage);
  return sorted.map((c, i) => ({ ...c, sfia_rank: i + 1, manual_rank: i + 1 }));
}

// ── Style Helpers ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  "Final Interview": "bg-purple-100 text-purple-700 border-purple-200",
  "Technical":       "bg-blue-100 text-blue-700 border-blue-200",
  "Screening":       "bg-amber-100 text-amber-700 border-amber-200",
  "Submitted":       "bg-gray-100 text-gray-600 border-gray-200",
  "Hired":           "bg-green-100 text-green-700 border-green-200",
  "Rejected":        "bg-red-100 text-red-700 border-red-200",
};

function fitTextColor(pct: number) {
  if (pct >= 80) return "text-green-600";
  if (pct >= 60) return "text-amber-600";
  return "text-red-500";
}

function rankBadgeStyle(rank: number) {
  if (rank === 1) return "bg-amber-100 text-amber-700 border border-amber-300";
  if (rank === 2) return "bg-slate-100 text-slate-600 border border-slate-300";
  if (rank === 3) return "bg-orange-50 text-orange-600 border border-orange-200";
  return "bg-muted text-muted-foreground border border-border";
}

// ── Fit Visualization ──────────────────────────────────────────────────────────

function FitVisualization({ pillars }: Readonly<{ pillars: SFIAPillar[] }>) {
  return (
    <div className="mt-4 space-y-3.5 border-t border-border pt-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Skill Demand vs Supply — per SFIA Pillar
      </p>

      {pillars.map((p) => {
        const hasGap = p.supply < p.demand;
        return (
          <div key={p.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-foreground">{p.name}</span>
              <span className={`text-xs font-bold ${hasGap ? "text-red-500" : "text-green-600"}`}>
                {p.supply} / {p.demand}
              </span>
            </div>

            {/* Demand bar */}
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] text-muted-foreground w-14 text-right shrink-0">Demand</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-slate-400 rounded-full" style={{ width: `${p.demand}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground w-6 shrink-0">{p.demand}</span>
            </div>

            {/* Supply bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-14 text-right shrink-0">Supply</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${hasGap ? "bg-red-400" : "bg-green-500"}`}
                  style={{ width: `${p.supply}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-6 shrink-0">{p.supply}</span>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-4 rounded-full bg-slate-400" />
          <span className="text-[10px] text-muted-foreground">Company Demand</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-4 rounded-full bg-green-500" />
          <span className="text-[10px] text-muted-foreground">Supply (met)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-4 rounded-full bg-red-400" />
          <span className="text-[10px] text-muted-foreground">Supply (gap)</span>
        </div>
      </div>
    </div>
  );
}

function rankStarClass(rank: number) {
  if (rank === 1) return "fill-amber-500 text-amber-500";
  if (rank === 2) return "fill-slate-400 text-slate-400";
  return "fill-orange-400 text-orange-400";
}

function podiumBg(i: number) {
  if (i === 0) return "bg-amber-100";
  if (i === 1) return "bg-slate-100";
  return "bg-orange-50";
}

function podiumIconColor(i: number) {
  if (i === 0) return "text-amber-600";
  if (i === 1) return "text-slate-500";
  return "text-orange-500";
}

// ── Candidate Card ─────────────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  rank,
  mode,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Readonly<{
  candidate: RankedCandidate;
  rank: number;
  mode: RankingMode;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}>) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_STYLES[candidate.status] ?? "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <div
      draggable={mode === "manual"}
      onDragStart={mode === "manual" ? onDragStart : undefined}
      onDragOver={mode === "manual" ? onDragOver : undefined}
      onDrop={mode === "manual" ? onDrop : undefined}
      onDragEnd={mode === "manual" ? onDragEnd : undefined}
      className={[
        "bg-card border rounded-xl p-4 transition-all select-none",
        isDragOver ? "border-primary border-dashed bg-primary/5 scale-[1.01]" : "border-border/70",
        isDragging ? "opacity-40" : "opacity-100",
        mode === "manual" ? "cursor-grab active:cursor-grabbing" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">

        {/* Rank badge */}
        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${rankBadgeStyle(rank)}`}>
          {rank <= 3
            ? <Star className={`h-3.5 w-3.5 ${rankStarClass(rank)}`} />
            : `#${rank}`}
        </div>

        {/* Drag handle — manual mode only */}
        {mode === "manual" && (
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/10 shrink-0">
          {candidate.first_name.charAt(0)}{candidate.last_name.charAt(0)}
        </div>

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground leading-none">
            {candidate.first_name} {candidate.last_name}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{candidate.email}</p>
        </div>

        {/* Stage badge */}
        <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusStyle} shrink-0`}>
          {candidate.status}
        </span>

        {/* Fit percentage */}
        <div className="text-right shrink-0">
          <p className={`text-lg font-bold leading-none ${fitTextColor(candidate.fit_percentage)}`}>
            {candidate.fit_percentage}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Fit Score</p>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && <FitVisualization pillars={candidate.pillars} />}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CandidateEvaluationPage() {
  const [selectedJob, setSelectedJob] = useState<JobOption>(MOCK_JOBS[0]);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [mode, setMode] = useState<RankingMode>("sfia");
  const [showAll, setShowAll] = useState(false);

  // Manual ranking state — persists reorder within session
  const [manualCandidates, setManualCandidates] = useState<RankedCandidate[]>(
    () => generateMockCandidates(MOCK_JOBS[0].job_posting_id)
  );

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // SFIA list is always sorted by fit_percentage descending
  const sfiaSorted = [...manualCandidates].sort((a, b) => a.sfia_rank - b.sfia_rank);
  const activeList = mode === "sfia" ? sfiaSorted : manualCandidates;
  const visibleList = showAll ? activeList : activeList.slice(0, 20);

  const top3 = sfiaSorted.slice(0, 3);
  const avgFitTop20 = Math.round(
    sfiaSorted.slice(0, 20).reduce((s, c) => s + c.fit_percentage, 0) / 20
  );

  function handleJobSelect(job: JobOption) {
    setSelectedJob(job);
    setManualCandidates(generateMockCandidates(job.job_posting_id));
    setJobDropdownOpen(false);
    setShowAll(false);
  }

  function handleDrop(toIndex: number) {
    if (dragIndex === null || dragIndex === toIndex) return;
    const reordered = [...manualCandidates];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setManualCandidates(reordered.map((c, i) => ({ ...c, manual_rank: i + 1 })));
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleSaveManualRank() {
    // (backend): PATCH /jobs/{selectedJob.job_posting_id}/candidates/manual-rank
    // Payload: { rankings: [{ application_id, rank }] }
    const _payload = manualCandidates.map((c, i) => ({
      application_id: c.application_id,
      rank: i + 1,
    }));
  }

  return (
    <div className="space-y-6">

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">HR Recruitment</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
              Candidate Evaluation Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Top 20 candidates ranked by SFIA skill pillars. Switch to Manual to reorder by judgment.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Top 20 Avg Fit</p>
            <p className="mt-1 text-lg font-bold">{avgFitTop20}%</p>
          </div>
        </div>
      </section>

      {/* Job selector + top 3 podium */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">

        {/* Job selector dropdown */}
        <div className="relative shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            Job Posting
          </p>
          <button
            onClick={() => setJobDropdownOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold hover:bg-muted/50 transition-colors min-w-[260px]"
          >
            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-left truncate">{selectedJob.title}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
          {jobDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 w-full bg-card border border-border rounded-xl shadow-lg py-1">
              {MOCK_JOBS.map((job) => (
                <button
                  key={job.job_posting_id}
                  onClick={() => handleJobSelect(job)}
                  className={`flex flex-col px-4 py-2.5 w-full text-left hover:bg-muted/50 transition-colors ${
                    job.job_posting_id === selectedJob.job_posting_id ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">{job.title}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {job.department} · {job.total_applicants} applicants
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Top 3 podium cards */}
        <div className="flex gap-3 flex-wrap">
          {top3.map((c, i) => (
            <Card key={c.application_id} className="border-border/70 shadow-sm">
              <CardContent className="px-4 py-3 flex items-center gap-3">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${podiumBg(i)}`}>
                  <Trophy className={`h-3.5 w-3.5 ${podiumIconColor(i)}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground leading-none">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className={`text-sm font-bold mt-0.5 ${fitTextColor(c.fit_percentage)}`}>
                    {c.fit_percentage}% fit
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Candidate list card */}
      <div className="bg-card border border-border/70 rounded-2xl shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))]">
          <div>
            <h2 className="font-bold text-base tracking-tight">
              {showAll ? `All ${activeList.length} Candidates` : "Top 20 Candidates"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {mode === "sfia"
                ? "Sorted by SFIA pillar fit score — read-only"
                : "Manual mode — drag cards to reorder, then save"}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">

            {/* Show all / show top 20 */}
            {activeList.length > 20 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {showAll ? "Show Top 20 only" : `Show all ${activeList.length}`}
              </button>
            )}

            {/* Ranking mode toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setMode("sfia")}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                  mode === "sfia"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                SFIA Ranking
              </button>
              <button
                onClick={() => setMode("manual")}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                  mode === "manual"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Users className="h-3.5 w-3.5" />
                Manual Ranking
              </button>
            </div>

            {/* Save button — manual mode only */}
            {mode === "manual" && (
              <Button size="sm" className="h-8" onClick={handleSaveManualRank}>
                Save Order
              </Button>
            )}
          </div>
        </div>

        {/* Mode description banner */}
        {mode === "manual" && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 font-medium flex items-center gap-2">
            <GripVertical className="h-3.5 w-3.5 shrink-0" />
            Drag-and-drop is active. Reorder candidates then click <strong className="font-bold">Save Order</strong> to persist.
          </div>
        )}

        {/* Candidate list */}
        <div className="p-5 space-y-3">
          {visibleList.map((candidate, index) => (
            <CandidateCard
              key={candidate.application_id}
              candidate={candidate}
              rank={index + 1}
              mode={mode}
              isDragging={dragIndex === index}
              isDragOver={dragOverIndex === index}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
            />
          ))}
        </div>

        {/* Footer count */}
        <div className="px-5 py-3 border-t border-border bg-muted/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {visibleList.length > 0
              ? `Showing ${visibleList.length} of ${activeList.length} candidates`
              : "No candidates found"}
          </p>
        </div>
      </div>
    </div>
  );
}
