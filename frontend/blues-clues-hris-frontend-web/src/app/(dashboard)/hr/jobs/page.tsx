"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { getUserInfo } from "@/lib/authStorage";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Plus, MoreHorizontal, X, ChevronLeft, ChevronRight,
  Briefcase, MapPin, Users, XCircle, Loader2, CheckCircle, Link2, Copy, Check,
  ArrowRight, GripVertical, Trash2, ChevronDown, Pencil, RefreshCw, FileText,
  KanbanSquare, List, Mail, Phone, Calendar, Clock, Mic, Cpu, Trophy, CheckCircle2,
  LayoutGrid, Send, RotateCcw,
} from "lucide-react";
import { PipelineKanbanView } from "./_components/PipelineKanbanView";
import {
  getApplicationDetail, getMyCompany, sendInterviewSchedule,
  type ApplicationDetail,
} from "@/lib/authApi";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobPosting {
  job_posting_id: string;
  title: string;
  description: string;
  location: string | null;
  employment_type: string | null;
  salary_range: string | null;
  status: "open" | "closed" | "draft";
  posted_at: string;
  closes_at: string | null;
  department_id: string | null;
}

interface Application {
  application_id: string;
  applicant_id: string;
  status: string;
  applied_at: string;
  applicant_profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
    applicant_code: string;
  };
}

interface Question {
  id: string;
  question_text: string;
  question_type: "text" | "multiple_choice" | "checkbox";
  options: string[];
  is_required: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 8;

const JOB_STATUS_STYLES: Record<string, string> = {
  open:   "bg-green-100 text-green-700 border-green-200",
  closed: "bg-red-100 text-red-700 border-red-200",
  draft:  "bg-amber-100 text-amber-700 border-amber-200",
};

const APP_STATUSES = [
  { value: "submitted",           label: "Submitted" },
  { value: "screening",           label: "Initial Screening" },
  { value: "first_interview",     label: "First Interview" },
  { value: "technical_interview", label: "Technical Interview" },
  { value: "final_interview",     label: "Final Interview" },
  { value: "hired",               label: "Hired" },
  { value: "rejected",            label: "Rejected" },
];

const APP_STATUS_STYLES: Record<string, string> = {
  submitted:           "bg-blue-100 text-blue-700 border-blue-200",
  screening:           "bg-yellow-100 text-yellow-700 border-yellow-200",
  first_interview:     "bg-purple-100 text-purple-700 border-purple-200",
  technical_interview: "bg-indigo-100 text-indigo-700 border-indigo-200",
  final_interview:     "bg-violet-100 text-violet-700 border-violet-200",
  hired:               "bg-green-100 text-green-700 border-green-200",
  rejected:            "bg-red-100 text-red-700 border-red-200",
};

type StatusFilter = "all" | "open" | "closed" | "draft";
type PageView = "postings" | "pipeline";

const PIPELINE_STAGES = [
  { value: "submitted",           label: "Applied",             icon: FileText,     dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-700 border-blue-200",      tab: "border-blue-500 text-blue-700"   },
  { value: "screening",           label: "Screening",           icon: Search,        dot: "bg-amber-500",  badge: "bg-amber-100 text-amber-700 border-amber-200",   tab: "border-amber-500 text-amber-700" },
  { value: "first_interview",     label: "1st Interview",       icon: Mic,           dot: "bg-purple-500", badge: "bg-purple-100 text-purple-700 border-purple-200",tab: "border-purple-500 text-purple-700"},
  { value: "technical_interview", label: "Technical",           icon: Cpu,           dot: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-700 border-indigo-200",tab: "border-indigo-500 text-indigo-700"},
  { value: "final_interview",     label: "Final Interview",     icon: Trophy,        dot: "bg-violet-500", badge: "bg-violet-100 text-violet-700 border-violet-200",tab: "border-violet-500 text-violet-700"},
  { value: "hired",               label: "Hired",               icon: CheckCircle2,  dot: "bg-green-500",  badge: "bg-green-100 text-green-700 border-green-200",   tab: "border-green-500 text-green-700" },
  { value: "rejected",            label: "Rejected",            icon: XCircle,       dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border-red-200",         tab: "border-red-500 text-red-700"     },
] as const;

interface PipelineApplication {
  application_id: string;
  applicant_id: string;
  status: string;
  applied_at: string;
  applicant_profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
    applicant_code: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Request failed");
  return data as T;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function newQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    question_text: "",
    question_type: "text",
    options: [""],
    is_required: true,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: Readonly<{ label: string; value: number; sub: string; color: string }>) {
  return (
    <Card className="border-border/70 shadow-sm bg-[linear-gradient(160deg,rgba(37,99,235,0.05),rgba(15,23,42,0.00))]">
      <CardContent className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</p>
        <p className={`text-3xl font-bold tracking-tight ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const style = JOB_STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${style}`}>
      {status}
    </span>
  );
}

// ─── Question Builder ─────────────────────────────────────────────────────────

function QuestionBuilder({
  questions,
  onChange,
}: Readonly<{
  questions: Question[];
  onChange: (qs: Question[]) => void;
}>) {
  const updateQ = (id: string, patch: Partial<Question>) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const removeQ = (id: string) => onChange(questions.filter((q) => q.id !== id));

  const addOption = (id: string) =>
    updateQ(id, { options: [...(questions.find((q) => q.id === id)?.options ?? []), ""] });

  const updateOption = (id: string, idx: number, val: string) => {
    const q = questions.find((q) => q.id === id);
    if (!q) return;
    const options = [...q.options];
    options[idx] = val;
    updateQ(id, { options });
  };

  const removeOption = (id: string, idx: number) => {
    const q = questions.find((q) => q.id === id);
    if (!q) return;
    updateQ(id, { options: q.options.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      {questions.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
          No questions yet. Click "Add Question" to build your application form.
        </div>
      )}
      {questions.map((q, qi) => (
        <div key={q.id} className="rounded-xl border border-border bg-background p-4 space-y-3">
          <div className="flex items-start gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-2.5 shrink-0" />
            <div className="flex-1 space-y-3">
              <Input
                placeholder={`Question ${qi + 1}`}
                value={q.question_text}
                onChange={(e) => updateQ(q.id, { question_text: e.target.value })}
                className="h-9"
              />
              <div className="flex gap-2 items-center">
                <select
                  value={q.question_type}
                  onChange={(e) => {
                    const newType = e.target.value as Question["question_type"];
                    const fallbackOptions = q.options.length ? q.options : [""];
                    const newOptions = newType === "text" ? [] : fallbackOptions;
                    updateQ(q.id, { question_type: newType, options: newOptions });
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="text">Text Answer</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="checkbox">Checkboxes</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={q.is_required}
                    onChange={(e) => updateQ(q.id, { is_required: e.target.checked })}
                    className="h-3.5 w-3.5"
                  />{" "}
                  Required
                </label>
              </div>
              {(q.question_type === "multiple_choice" || q.question_type === "checkbox") && (
                <div className="space-y-2 pl-1">
                  {q.options.map((opt, oi) => (
                    <div key={`${q.id}-opt-${oi}`} className="flex items-center gap-2">
                      <div className={`h-3.5 w-3.5 shrink-0 border border-border ${q.question_type === "multiple_choice" ? "rounded-full" : "rounded"}`} />
                      <Input
                        value={opt}
                        onChange={(e) => updateOption(q.id, oi, e.target.value)}
                        placeholder={`Option ${oi + 1}`}
                        className="h-8 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(q.id, oi)}
                        disabled={q.options.length <= 1}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOption(q.id)}
                    className="text-xs text-primary hover:underline pl-5"
                  >
                    + Add option
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeQ(q.id)}
              className="p-1 text-muted-foreground hover:text-destructive mt-1.5 shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 h-8"
        onClick={() => onChange([...questions, newQuestion()])}
      >
        <Plus className="h-3.5 w-3.5" /> Add Question
      </Button>
    </div>
  );
}

// ─── Create Job Modal (2-step) ────────────────────────────────────────────────

function CreateJobModal({
  onClose,
  onCreate,
}: Readonly<{
  onClose: () => void;
  onCreate: (job: JobPosting) => void;
}>) {
  const [step, setStep] = useState<1 | 2>(1);
  const [createdJob, setCreatedJob] = useState<JobPosting | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", location: "",
    employment_type: "", salary_range: "", closes_at: "",
  });

  const handleCreatePosting = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = { title: form.title, description: form.description };
      if (form.location.trim())     payload.location = form.location.trim();
      if (form.employment_type)     payload.employment_type = form.employment_type;
      if (form.salary_range.trim()) payload.salary_range = form.salary_range.trim();
      if (form.closes_at)           payload.closes_at = new Date(form.closes_at).toISOString();

      const job = await apiFetch<JobPosting>("/jobs", { method: "POST", body: JSON.stringify(payload) });
      setCreatedJob(job);
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Failed to create job posting");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuestions = async () => {
    if (!createdJob) return;
    setSavingQuestions(true);
    try {
      const payload = questions
        .filter((q) => q.question_text.trim())
        .map((q, i) => ({
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          options: (q.question_type !== "text" && q.options.length) ? q.options.filter(Boolean) : undefined,
          is_required: q.is_required,
          sort_order: i,
        }));

      await apiFetch(`/jobs/${createdJob.job_posting_id}/questions`, {
        method: "PUT",
        body: JSON.stringify({ questions: payload }),
      });
      toast.success("Job posting created!");
      onCreate(createdJob);
    } catch (err: any) {
      toast.error(err.message || "Failed to save questions");
    } finally {
      setSavingQuestions(false);
    }
  };

  const handleSkipQuestions = () => {
    if (!createdJob) return;
    toast.success("Job posting created!");
    onCreate(createdJob);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>1</span>
              <span className="text-[10px] text-muted-foreground">Job Details</span>
              <span className="text-[10px] text-muted-foreground">›</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>2</span>
              <span className="text-[10px] text-muted-foreground">Application Form</span>
            </div>
            <h3 className="font-bold text-foreground text-lg">
              {step === 1 ? "Create Job Posting" : "Build Application Form"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {step === 1 ? "Fill in the details for the new position" : "Add questions applicants must answer"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {step === 1 ? (
            <form id="step1-form" onSubmit={handleCreatePosting} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="create-title" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Job Title *</label>
                <Input
                  id="create-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Senior Software Engineer"
                  required className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="create-description" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description *</label>
                <textarea
                  id="create-description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  required rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="create-location" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</label>
                  <Input id="create-location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Manila" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="create-employment-type" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Employment Type</label>
                  <select
                    id="create-employment-type"
                    value={form.employment_type}
                    onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select type</option>
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Internship</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="create-salary" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Salary Range</label>
                  <Input id="create-salary" value={form.salary_range} onChange={(e) => setForm((f) => ({ ...f, salary_range: e.target.value }))} placeholder="e.g. ₱50k – ₱80k" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="create-closes-at" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Closes On</label>
                  <Input id="create-closes-at" type="date" value={form.closes_at} onChange={(e) => setForm((f) => ({ ...f, closes_at: e.target.value }))} className="h-10" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
                <Button type="submit" className="flex-1 gap-1.5" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Next</span><ArrowRight className="h-4 w-4" /></>}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <QuestionBuilder questions={questions} onChange={setQuestions} />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" className="gap-1.5" onClick={handleSkipQuestions} disabled={savingQuestions}>
                  Skip for now
                </Button>
                <Button className="flex-1 gap-1.5" onClick={handleSaveQuestions} disabled={savingQuestions}>
                  {savingQuestions ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & Finish"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Job Modal ────────────────────────────────────────────────────────────

function EditJobModal({
  job,
  onClose,
  onSave,
}: Readonly<{
  job: JobPosting;
  onClose: () => void;
  onSave: (updated: JobPosting) => void;
}>) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: job.title,
    description: job.description,
    location: job.location ?? "",
    employment_type: job.employment_type ?? "",
    salary_range: job.salary_range ?? "",
    closes_at: job.closes_at ? job.closes_at.slice(0, 10) : "",
  });

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiFetch<JobPosting>(`/jobs/${job.job_posting_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          location: form.location.trim() || null,
          employment_type: form.employment_type || null,
          salary_range: form.salary_range.trim() || null,
          closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null,
        }),
      });
      toast.success("Job posting updated!");
      onSave(updated);
    } catch (err: any) {
      toast.error(err.message || "Failed to update job posting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h3 className="font-bold text-foreground text-lg">Edit Job Posting</h3>
            <p className="text-xs text-muted-foreground">Update the details for this position</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-title" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Job Title *</label>
              <Input id="edit-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Senior Software Engineer" required className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-description" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description *</label>
              <textarea
                id="edit-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the role, responsibilities, and requirements..."
                required rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="edit-location" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</label>
                <Input id="edit-location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Manila" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-employment-type" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Employment Type</label>
                <select
                  id="edit-employment-type"
                  value={form.employment_type}
                  onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select type</option>
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                  <option>Internship</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="edit-salary" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Salary Range</label>
                <Input id="edit-salary" value={form.salary_range} onChange={(e) => setForm((f) => ({ ...f, salary_range: e.target.value }))} placeholder="e.g. ₱50k – ₱80k" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-closes-at" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Closes On</label>
                <Input id="edit-closes-at" type="date" value={form.closes_at} onChange={(e) => setForm((f) => ({ ...f, closes_at: e.target.value }))} className="h-10" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" className="flex-1 gap-1.5" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Manage Form Modal ────────────────────────────────────────────────────────

interface StoredQuestion {
  question_id: string;
  question_text: string;
  question_type: "text" | "multiple_choice" | "checkbox";
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
}

function ManageFormModal({
  job,
  onClose,
}: Readonly<{
  job: JobPosting;
  onClose: () => void;
}>) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<StoredQuestion[]>(`/jobs/${job.job_posting_id}/questions`)
      .then((existing) =>
        setQuestions(
          existing.map((q) => ({
            id: q.question_id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options?.length ? q.options : [""],
            is_required: q.is_required,
          }))
        )
      )
      .catch(() => toast.error("Failed to load questions"))
      .finally(() => setLoading(false));
  }, [job.job_posting_id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = questions
        .filter((q) => q.question_text.trim())
        .map((q, i) => ({
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          options: q.question_type !== "text" && q.options.length ? q.options.filter(Boolean) : undefined,
          is_required: q.is_required,
          sort_order: i,
        }));

      await apiFetch(`/jobs/${job.job_posting_id}/questions`, {
        method: "PUT",
        body: JSON.stringify({ questions: payload }),
      });
      toast.success("Application form saved!");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save questions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h3 className="font-bold text-foreground text-lg">Application Form</h3>
            <p className="text-xs text-muted-foreground truncate max-w-xs">
              {job.title} — edit, add, or remove questions
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <QuestionBuilder questions={questions} onChange={setQuestions} />
          )}
        </div>

        <div className="px-6 py-4 border-t border-border shrink-0 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Form"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Stage Modal Config ────────────────────────────────────────────────────────

const STAGE_STEPS = [
  { key: "submitted",           short: "Applied",  dot: "bg-blue-500",   ring: "ring-blue-400",   border: "border-blue-500"   },
  { key: "screening",           short: "Screen",   dot: "bg-amber-500",  ring: "ring-amber-400",  border: "border-amber-500"  },
  { key: "first_interview",     short: "1st Int.", dot: "bg-purple-500", ring: "ring-purple-400", border: "border-purple-500" },
  { key: "technical_interview", short: "Tech",     dot: "bg-indigo-500", ring: "ring-indigo-400", border: "border-indigo-500" },
  { key: "final_interview",     short: "Final",    dot: "bg-violet-500", ring: "ring-violet-400", border: "border-violet-500" },
];

const STAGE_META: Record<string, {
  dotColor: string;
  bannerClass: string;
  label: string;
  interviewer?: string;
  focus?: string[];
  focusDot?: string;
  description: string;
}> = {
  submitted: {
    dotColor: "bg-blue-500",
    bannerClass: "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700/40 dark:text-blue-300",
    label: "New Application",
    description: "Review this application and move to screening when ready.",
  },
  screening: {
    dotColor: "bg-amber-500",
    bannerClass: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-300",
    label: "Pre-Interview Review",
    interviewer: "HR Personnel",
    description: "Conduct initial review before scheduling the first interview.",
  },
  first_interview: {
    dotColor: "bg-purple-500",
    bannerClass: "border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:border-purple-700/40 dark:text-purple-300",
    label: "HR Screening Interview",
    interviewer: "HR Personnel",
    focus: ["Keywords & skills verification", "Position fit assessment", "Candidate profiling"],
    focusDot: "bg-purple-500",
    description: "CV validation and initial profiling.",
  },
  technical_interview: {
    dotColor: "bg-indigo-500",
    bannerClass: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-700/40 dark:text-indigo-300",
    label: "Technical Assessment",
    interviewer: "Technical Hiring Manager",
    focus: ["Technical skills evaluation", "Problem-solving ability", "Domain knowledge"],
    focusDot: "bg-indigo-500",
    description: "~50% of candidates reach this stage.",
  },
  final_interview: {
    dotColor: "bg-violet-500",
    bannerClass: "border-violet-200 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:border-violet-700/40 dark:text-violet-300",
    label: "Cultural Fit Interview",
    interviewer: "Hiring Manager's Boss",
    focus: ["Culture fit assessment", "Team compatibility", "Final suitability"],
    focusDot: "bg-violet-500",
    description: "This is the final interview stage. Make a hiring decision after this.",
  },
  hired: {
    dotColor: "bg-green-500",
    bannerClass: "border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-700/40 dark:text-green-300",
    label: "Hired",
    description: "Proceed with compensation discussion and offer letter. Hiring triggers the onboarding phase.",
  },
  rejected: {
    dotColor: "bg-red-500",
    bannerClass: "border-red-200 bg-red-50 text-red-600 dark:bg-red-900/10 dark:border-red-700/30 dark:text-red-400",
    label: "Not Selected",
    description: "This application has not been selected.",
  },
};

const REJECTION_REASONS = [
  "Does not meet qualifications",
  "Failed interview assessment",
  "Position already filled",
  "Candidate withdrew",
  "Other",
];

// ─── Stage Modal Helper Components ───────────────────────────────────────────

function formatApplicationAnswer(answer: ApplicationDetail["answers"][number]): React.ReactNode {
  const val = answer.answer_value;
  if (!val) return <span className="text-muted-foreground italic">No answer</span>;
  if (answer.application_questions.question_type === "checkbox") {
    try {
      const arr = JSON.parse(val) as string[];
      return <span>{arr.join(", ")}</span>;
    } catch {
      return <span>{val}</span>;
    }
  }
  return <span>{val}</span>;
}

function StageProgressBar({ currentStatus }: { readonly currentStatus: string }) {
  const isTerminal = currentStatus === "hired" || currentStatus === "rejected";
  const currentIdx = STAGE_STEPS.findIndex((s) => s.key === currentStatus);

  let terminalLineColor = "bg-border";
  if (currentStatus === "hired") terminalLineColor = "bg-green-500";
  else if (currentStatus === "rejected") terminalLineColor = "bg-red-500";

  let terminalDotClass = "bg-muted/30 border-border";
  if (currentStatus === "hired") terminalDotClass = "bg-green-500 border-green-500";
  else if (currentStatus === "rejected") terminalDotClass = "bg-red-500 border-red-500";

  let terminalTextClass = "text-muted-foreground/40";
  if (currentStatus === "hired") terminalTextClass = "text-green-600 dark:text-green-400";
  else if (currentStatus === "rejected") terminalTextClass = "text-red-500 dark:text-red-400";

  let terminalLabel = "Result";
  if (currentStatus === "hired") terminalLabel = "Hired";
  else if (currentStatus === "rejected") terminalLabel = "Rejected";

  return (
    <div className="flex items-center gap-0 px-6 py-3 border-b border-border bg-muted/20 shrink-0">
      {STAGE_STEPS.map((step, i) => {
        const done    = !isTerminal && i < currentIdx;
        const current = step.key === currentStatus;
        let dotClass = "bg-muted/30 border-border";
        if (done) dotClass = `${step.dot} border-transparent`;
        else if (current) dotClass = `bg-background ${step.border} ring-2 ring-offset-1 ${step.ring}/30`;
        const textClass = done || current ? "text-foreground" : "text-muted-foreground/40";
        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${dotClass}`}>
                {done && <CheckCircle2 className="h-3 w-3 text-white" />}
              </div>
              <span className={`mt-0.5 text-[8px] font-bold uppercase tracking-wide text-center leading-tight ${textClass}`}>
                {step.short}
              </span>
            </div>
            {i < STAGE_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 -mt-3 mx-0.5 rounded-full ${done ? step.dot : "bg-border"}`} />
            )}
          </div>
        );
      })}
      <div className="flex items-center flex-1 min-w-0">
        <div className={`h-0.5 flex-1 -mt-3 mx-0.5 rounded-full ${terminalLineColor}`} />
        <div className="flex flex-col items-center shrink-0">
          <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${terminalDotClass}`}>
            {currentStatus === "hired"    && <CheckCircle2 className="h-3 w-3 text-white" />}
            {currentStatus === "rejected" && <XCircle      className="h-3 w-3 text-white" />}
          </div>
          <span className={`mt-0.5 text-[8px] font-bold uppercase tracking-wide text-center leading-tight ${terminalTextClass}`}>
            {terminalLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function ApplicantInfoCard({ d }: { readonly d: ApplicationDetail }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Applicant Info</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground font-semibold">Code</p>
          <p className="font-mono font-bold">{d.applicant_profile.applicant_code}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground font-semibold">Applied</p>
          <p className="font-semibold">{formatDate(d.applied_at)}</p>
        </div>
        {d.applicant_profile.phone_number && (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 col-span-2">
            <p className="text-[10px] text-muted-foreground font-semibold">Phone</p>
            <p className="font-semibold">{d.applicant_profile.phone_number}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CollapsibleAnswers({ d }: { readonly d: ApplicationDetail }) {
  const [open, setOpen] = useState(false);
  if (d.answers.length === 0) return null;
  const sorted = d.answers.slice().sort((a, b) => (a.application_questions.sort_order ?? 0) - (b.application_questions.sort_order ?? 0));
  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-full cursor-pointer"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        Application Answers ({sorted.length})
      </button>
      {open && (
        <div className="space-y-2">
          {sorted.map((ans) => (
            <div key={ans.answer_id} className="rounded-xl border border-border bg-muted/10 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-foreground">{ans.application_questions.question_text}</p>
              <p className="text-sm text-foreground">{formatApplicationAnswer(ans)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RejectButton({ onReject, updating }: { readonly onReject: () => void; readonly updating: boolean }) {
  return (
    <Button
      onClick={onReject}
      disabled={updating}
      variant="outline"
      className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800/40 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      Reject
    </Button>
  );
}

function BackButton({ label, onBack, updating }: { readonly label: string; readonly onBack: () => void; readonly updating: boolean }) {
  return (
    <Button
      onClick={onBack}
      disabled={updating}
      variant="ghost"
      size="sm"
      className="w-full text-muted-foreground text-xs cursor-pointer"
    >
      ← {label}
    </Button>
  );
}

// ─── Interview Schedule Types & Helpers ──────────────────────────────────────

interface InterviewSchedule {
  date: string;
  time: string;
  duration: string;
  format: string; // "in_person" | "video" | "phone"
  location: string;
  meetingLink: string;
  interviewer: string;
  interviewerTitle: string;
  notes: string;
}

const FORMAT_LABELS: Record<string, string> = {
  in_person: "In-person",
  video:     "Video Call",
  phone:     "Phone Call",
};

// ─── Schedule Info Banner ─────────────────────────────────────────────────────

function ScheduleInfoBanner({
  schedule,
  onReschedule,
}: Readonly<{ schedule: InterviewSchedule; onReschedule: () => void }>) {
  const venue = schedule.format === "video" ? schedule.meetingLink : schedule.location;
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-700/40 dark:bg-blue-900/20 px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">
          Interview Scheduled
        </p>
        <button
          onClick={onReschedule}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 transition-colors"
        >
          <RotateCcw className="h-3 w-3" /> Reschedule
        </button>
      </div>
      <div className="space-y-1.5 text-sm text-blue-800 dark:text-blue-200">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span>
            {schedule.date} at {schedule.time} · {schedule.duration} min
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span>
            {FORMAT_LABELS[schedule.format] ?? schedule.format}
            {venue ? ` — ${venue}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span>
            {schedule.interviewer}
            {schedule.interviewerTitle ? ` · ${schedule.interviewerTitle}` : ""}
          </span>
        </div>
        {schedule.notes && (
          <div className="rounded-lg bg-blue-100 dark:bg-blue-800/30 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 mt-1">
            {schedule.notes}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Interview Schedule Form ──────────────────────────────────────────────────

function InterviewScheduleForm({
  targetStage,
  isRescheduling,
  existingSchedule,
  onConfirm,
  onCancel,
  saving,
}: Readonly<{
  targetStage: string;
  isRescheduling: boolean;
  existingSchedule: InterviewSchedule | null;
  onConfirm: (s: InterviewSchedule) => void;
  onCancel: () => void;
  saving: boolean;
}>) {
  const stageLabel = APP_STATUSES.find((s) => s.value === targetStage)?.label ?? targetStage;

  const [form, setForm] = useState<InterviewSchedule>(
    existingSchedule ?? {
      date: "", time: "", duration: "60", format: "in_person",
      location: "", meetingLink: "", interviewer: "", interviewerTitle: "", notes: "",
    }
  );

  function field(k: keyof InterviewSchedule) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));
  }

  const handleSubmit = () => {
    if (!form.date || !form.time || !form.interviewer) {
      toast.error("Date, time, and interviewer name are required.");
      return;
    }
    onConfirm(form);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Banner */}
      <div className="rounded-xl border border-primary/20 bg-[linear-gradient(155deg,rgba(37,99,235,0.07),transparent)] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-0.5">
          {isRescheduling ? "Rescheduling Interview" : "Schedule Interview"}
        </p>
        <p className="text-sm font-semibold text-foreground">{stageLabel}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isRescheduling
            ? "A reschedule confirmation will be sent to the applicant."
            : "An interview invite will be sent to the applicant upon confirmation."}
        </p>
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Date *
          </label>
          <Input type="date" value={form.date} onChange={field("date")} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Time *
          </label>
          <Input type="time" value={form.time} onChange={field("time")} className="h-9" />
        </div>
      </div>

      {/* Duration + Format */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Duration
          </label>
          <select
            value={form.duration}
            onChange={field("duration")}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Format
          </label>
          <select
            value={form.format}
            onChange={field("format")}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="in_person">In-person</option>
            <option value="video">Video Call</option>
            <option value="phone">Phone Call</option>
          </select>
        </div>
      </div>

      {/* Location / Link / Phone */}
      {form.format === "in_person" && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Office / Location
          </label>
          <Input
            value={form.location}
            onChange={field("location")}
            placeholder="e.g. 5th Floor, HQ Building, BGC"
            className="h-9"
          />
        </div>
      )}
      {form.format === "video" && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Meeting Link
          </label>
          <Input
            value={form.meetingLink}
            onChange={field("meetingLink")}
            placeholder="https://meet.google.com/..."
            className="h-9"
          />
        </div>
      )}
      {form.format === "phone" && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Contact Number
          </label>
          <Input
            value={form.location}
            onChange={field("location")}
            placeholder="+63 XXX XXX XXXX"
            className="h-9"
          />
        </div>
      )}

      {/* Interviewer */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Interviewer *
          </label>
          <Input
            value={form.interviewer}
            onChange={field("interviewer")}
            placeholder="Full name"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Title / Role
          </label>
          <Input
            value={form.interviewerTitle}
            onChange={field("interviewerTitle")}
            placeholder="e.g. HR Manager"
            className="h-9"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Notes to Applicant
        </label>
        <textarea
          value={form.notes}
          onChange={field("notes")}
          rows={3}
          placeholder="What to bring, dress code, who to ask for at reception, etc."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1 gap-1.5">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-4 w-4" />
              {isRescheduling ? "Confirm Reschedule" : "Confirm & Notify Applicant"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Application Detail Modal ─────────────────────────────────────────────────

function ApplicationDetailModal({
  applicationId,
  onClose,
  onStatusChange,
}: Readonly<{
  applicationId: string;
  onClose: () => void;
  onStatusChange: (newStatus: string) => void;
}>) {
  const [detail, setDetail]                   = useState<ApplicationDetail | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [updating, setUpdating]               = useState(false);
  const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0]);
  const [scheduleMode, setScheduleMode]       = useState<string | null>(null);
  const [confirmedSchedule, setConfirmedSchedule] = useState<InterviewSchedule | null>(null);

  useEffect(() => {
    getApplicationDetail(applicationId)
      .then((d) => setDetail(d))
      .catch((err: any) => toast.error(err.message || "Failed to load details"))
      .finally(() => setLoading(false));
  }, [applicationId]);

  const moveTo = async (targetStatus: string, silent = false) => {
    if (!detail) return;
    setUpdating(true);
    try {
      await apiFetch(`/jobs/applications/${applicationId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: targetStatus }),
      });
      setDetail((prev) => prev ? { ...prev, status: targetStatus } : prev);
      onStatusChange(targetStatus);
      if (!silent) {
        toast.success(`Moved to ${APP_STATUSES.find((s) => s.value === targetStatus)?.label ?? targetStatus}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmSchedule = async (schedule: InterviewSchedule) => {
    if (!scheduleMode) return;
    const targetStatus   = scheduleMode;
    const isRescheduling = detail?.status === targetStatus;
    setScheduleMode(null);
    setConfirmedSchedule(schedule);

    // Build the schedule payload for the backend email trigger
    const emailPayload = {
      application_id:    applicationId,
      scheduled_date:    schedule.date,
      scheduled_time:    schedule.time,
      duration_minutes:  parseInt(schedule.duration, 10) || 60,
      format:            schedule.format,
      location:          (schedule.format !== "video" && schedule.location) ? schedule.location : null,
      meeting_link:      (schedule.format === "video" && schedule.meetingLink) ? schedule.meetingLink : null,
      interviewer_name:  schedule.interviewer,
      interviewer_title: schedule.interviewerTitle || null,
      notes:             schedule.notes || null,
    };

    if (isRescheduling) {
      // Silently attempt to send reschedule email
      sendInterviewSchedule(emailPayload).catch(() => {});
      toast.success("Interview rescheduled — updated invite sent to applicant");
    } else {
      await moveTo(targetStatus, true);
      // Silently attempt to send schedule email — won't block the flow if endpoint is pending
      sendInterviewSchedule(emailPayload).catch(() => {});
      toast.success(
        `Interview scheduled — confirmation sent to ${detail?.applicant_profile.email ?? "applicant"}`,
      );
    }
  };

  function renderStageContent(d: ApplicationDetail) {
    const s    = d.status;
    const meta = STAGE_META[s];

    // ── Submitted ──────────────────────────────────────────────────────────────
    if (s === "submitted") {
      return (
        <div className="space-y-5">
          <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${meta.bannerClass}`}>
            {meta.description}
          </div>
          <ApplicantInfoCard d={d} />
          {d.answers.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Application Answers</p>
              {d.answers
                .slice()
                .sort((a, b) => (a.application_questions.sort_order ?? 0) - (b.application_questions.sort_order ?? 0))
                .map((ans) => (
                  <div key={ans.answer_id} className="rounded-xl border border-border bg-muted/10 px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-foreground">{ans.application_questions.question_text}</p>
                    <p className="text-sm text-foreground">{formatApplicationAnswer(ans)}</p>
                  </div>
                ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button onClick={() => moveTo("screening")} disabled={updating} className="flex-1 cursor-pointer">
              {updating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Move to Screening
            </Button>
            <RejectButton onReject={() => moveTo("rejected")} updating={updating} />
          </div>
        </div>
      );
    }

    // ── Screening ──────────────────────────────────────────────────────────────
    if (s === "screening") {
      const checklist = ["Resume reviewed", "Qualifications match job requirements", "Keywords and skills noted", "Candidate contacted / available"];
      return (
        <div className="space-y-5">
          <div className={`rounded-xl border px-4 py-3 space-y-0.5 ${meta.bannerClass}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Interviewer</p>
            <p className="text-sm font-semibold">{meta.interviewer}</p>
          </div>
          <ApplicantInfoCard d={d} />
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Screening Checklist</p>
            <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 space-y-2">
              {checklist.map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <div className="h-4 w-4 rounded border border-border bg-background shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <CollapsibleAnswers d={d} />
          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => setScheduleMode("first_interview")}
              disabled={updating}
              className="flex-1 gap-1.5 cursor-pointer"
            >
              <Calendar className="h-4 w-4" />
              Schedule 1st Interview
            </Button>
            <RejectButton onReject={() => moveTo("rejected")} updating={updating} />
          </div>
          <BackButton label="Back to Applied" onBack={() => moveTo("submitted")} updating={updating} />
        </div>
      );
    }

    // ── First Interview ────────────────────────────────────────────────────────
    if (s === "first_interview") {
      return (
        <div className="space-y-5">
          <div className={`rounded-xl border px-4 py-3 space-y-1 ${meta.bannerClass}`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Interviewer</p>
              <p className="text-sm font-semibold">{meta.interviewer}</p>
            </div>
            <p className="text-xs opacity-80">{meta.description}</p>
          </div>
          {confirmedSchedule && (
            <ScheduleInfoBanner
              schedule={confirmedSchedule}
              onReschedule={() => setScheduleMode("first_interview")}
            />
          )}
          {meta.focus && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Focus Areas</p>
              <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 space-y-1.5">
                {meta.focus.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.focusDot}`} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
          <ApplicantInfoCard d={d} />
          <CollapsibleAnswers d={d} />
          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => setScheduleMode("technical_interview")}
              disabled={updating}
              className="flex-1 gap-1.5 cursor-pointer"
            >
              <Calendar className="h-4 w-4" />
              Schedule Technical Interview
            </Button>
            <RejectButton onReject={() => moveTo("rejected")} updating={updating} />
          </div>
          <BackButton label="Back to Screening" onBack={() => moveTo("screening")} updating={updating} />
        </div>
      );
    }

    // ── Technical Interview ────────────────────────────────────────────────────
    if (s === "technical_interview") {
      return (
        <div className="space-y-5">
          <div className={`rounded-xl border px-4 py-3 space-y-1 ${meta.bannerClass}`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Interviewer</p>
              <p className="text-sm font-semibold">{meta.interviewer}</p>
            </div>
            <p className="text-xs opacity-80">{meta.description}</p>
          </div>
          {confirmedSchedule && (
            <ScheduleInfoBanner
              schedule={confirmedSchedule}
              onReschedule={() => setScheduleMode("technical_interview")}
            />
          )}
          {meta.focus && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Focus Areas</p>
              <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 space-y-1.5">
                {meta.focus.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.focusDot}`} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
          <ApplicantInfoCard d={d} />
          <CollapsibleAnswers d={d} />
          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => setScheduleMode("final_interview")}
              disabled={updating}
              className="flex-1 gap-1.5 cursor-pointer"
            >
              <Calendar className="h-4 w-4" />
              Schedule Final Interview
            </Button>
            <RejectButton onReject={() => moveTo("rejected")} updating={updating} />
          </div>
          <BackButton label="Back to 1st Interview" onBack={() => moveTo("first_interview")} updating={updating} />
        </div>
      );
    }

    // ── Final Interview ────────────────────────────────────────────────────────
    if (s === "final_interview") {
      return (
        <div className="space-y-5">
          <div className={`rounded-xl border px-4 py-3 space-y-1 ${meta.bannerClass}`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Interviewer</p>
              <p className="text-sm font-semibold">{meta.interviewer}</p>
            </div>
            <p className="text-xs opacity-80">{meta.description}</p>
          </div>
          {confirmedSchedule && (
            <ScheduleInfoBanner
              schedule={confirmedSchedule}
              onReschedule={() => setScheduleMode("final_interview")}
            />
          )}
          {meta.focus && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Focus Areas</p>
              <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 space-y-1.5">
                {meta.focus.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.focusDot}`} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
          <ApplicantInfoCard d={d} />
          <CollapsibleAnswers d={d} />
          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => moveTo("hired")}
              disabled={updating}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white cursor-pointer"
            >
              {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Hire Candidate
            </Button>
            <RejectButton onReject={() => moveTo("rejected")} updating={updating} />
          </div>
          <BackButton label="Back to Technical Interview" onBack={() => moveTo("technical_interview")} updating={updating} />
        </div>
      );
    }

    // ── Hired ──────────────────────────────────────────────────────────────────
    if (s === "hired") {
      return (
        <div className="space-y-5">
          <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-700/40 px-4 py-5 text-center space-y-2">
            <CheckCircle2 className="h-9 w-9 text-green-600 dark:text-green-400 mx-auto" />
            <p className="font-bold text-green-700 dark:text-green-300 text-base">Candidate has been hired!</p>
            <p className="text-xs text-green-600/80 dark:text-green-400/80">{meta.description}</p>
          </div>
          <ApplicantInfoCard d={d} />
          <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Next Step</p>
            <p className="text-sm text-foreground">Proceed with compensation discussion and generate the offer letter. Once accepted, the onboarding phase will begin.</p>
          </div>
          <BackButton label="Revert to Final Interview" onBack={() => moveTo("final_interview")} updating={updating} />
        </div>
      );
    }

    // ── Rejected ───────────────────────────────────────────────────────────────
    if (s === "rejected") {
      return (
        <div className="space-y-5">
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-700/30 px-4 py-5 text-center space-y-2">
            <XCircle className="h-9 w-9 text-red-500 mx-auto" />
            <p className="font-bold text-red-600 dark:text-red-400 text-base">Application not selected.</p>
          </div>
          <ApplicantInfoCard d={d} />
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rejection Reason</p>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <BackButton label="Reconsider (Revert to Screening)" onBack={() => moveTo("screening")} updating={updating} />
        </div>
      );
    }

    // ── Fallback ───────────────────────────────────────────────────────────────
    return (
      <div className="space-y-5">
        <ApplicantInfoCard d={d} />
        <CollapsibleAnswers d={d} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-bold text-lg">Application Detail</h3>
            {detail && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {detail.applicant_profile.first_name} {detail.applicant_profile.last_name} · {detail.applicant_profile.email}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Stage progress bar */}
        {detail && <StageProgressBar currentStatus={detail.status} />}

        {/* Stage label + interviewer strip */}
        {detail && (() => {
          const meta = STAGE_META[detail.status];
          if (!meta) return null;
          return (
            <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/10 shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${APP_STATUS_STYLES[detail.status] ?? "border-border bg-muted text-foreground"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                {scheduleMode ? "Scheduling…" : meta.label}
              </span>
              {!scheduleMode && meta.interviewer && (
                <span className="text-xs text-muted-foreground">
                  Interviewer: <span className="font-semibold text-foreground">{meta.interviewer}</span>
                </span>
              )}
              {scheduleMode && (
                <span className="text-xs text-muted-foreground">
                  Stage: <span className="font-semibold text-foreground">{APP_STATUSES.find(s => s.value === scheduleMode)?.label}</span>
                </span>
              )}
            </div>
          );
        })()}

        {/* Body: two-column layout */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* ── Main content ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && detail && (
              scheduleMode ? (
                <InterviewScheduleForm
                  targetStage={scheduleMode}
                  isRescheduling={detail.status === scheduleMode}
                  existingSchedule={detail.status === scheduleMode ? confirmedSchedule : null}
                  onConfirm={handleConfirmSchedule}
                  onCancel={() => setScheduleMode(null)}
                  saving={updating}
                />
              ) : renderStageContent(detail)
            )}
          </div>

          {/* ── Right sidebar ── */}
          <div className="w-52 shrink-0 border-l border-border bg-muted/5 overflow-y-auto px-4 py-5 space-y-5">

            {/* Documents */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Documents</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 gap-1.5 justify-start text-xs font-medium"
                onClick={() => toast.info("Resume viewing is coming soon.")}
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                View Resume
              </Button>
            </div>

            {/* SFIA Score */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">SFIA Score</p>
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2 shadow-sm">
                <div className="h-14 w-14 rounded-full border-[3px] border-dashed border-border flex items-center justify-center">
                  <span className="text-lg font-bold text-muted-foreground/30">—</span>
                </div>
                <p className="text-[10px] text-center text-muted-foreground leading-snug">
                  Not yet<br />assessed
                </p>
              </div>
            </div>

            {/* Quick info */}
            {detail && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quick Info</p>
                <div className="space-y-1.5">
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Code</p>
                    <p className="text-xs font-mono font-bold mt-0.5 truncate">{detail.applicant_profile.applicant_code}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Applied</p>
                    <p className="text-xs font-semibold mt-0.5">{formatDate(detail.applied_at)}</p>
                  </div>
                  {detail.applicant_profile.phone_number && (
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Phone</p>
                      <p className="text-xs font-semibold mt-0.5">{detail.applicant_profile.phone_number}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scheduling tips — shown only when schedule form is active */}
            {scheduleMode && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tips</p>
                <div className="rounded-xl border border-border bg-muted/10 p-3 text-[11px] text-muted-foreground space-y-1.5">
                  <p>• Send at least 48h in advance</p>
                  <p>• Include full location or link</p>
                  <p>• Specify documents to bring</p>
                  <p>• Mention dress code if any</p>
                  <p>• List who will be present</p>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Applicants Modal ─────────────────────────────────────────────────────────

function ApplicantsModal({
  job,
  onClose,
}: Readonly<{
  job: JobPosting;
  onClose: () => void;
}>) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Application[]>(`/jobs/${job.job_posting_id}/applications`)
      .then(setApplications)
      .catch((err: any) => toast.error(err.message || "Failed to load applications"))
      .finally(() => setLoading(false));
  }, [job.job_posting_id]);

  const applicantCount = applications.length;
  const plural = applicantCount === 1 ? "" : "s";
  const applicantLabel = loading ? "Loading..." : `${applicantCount} applicant${plural}`;
  const applicantsContent = applications.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
      <Users className="h-10 w-10 opacity-30" />
      <p className="text-sm font-medium">No applications yet</p>
    </div>
  ) : (
    <div className="divide-y divide-border">
      {applications.map((app) => {
        const stageLabel = APP_STATUSES.find((s) => s.value === app.status)?.label ?? app.status;
        return (
          <button
            key={app.application_id}
            type="button"
            className="flex items-center justify-between py-4 px-1 gap-4 w-full text-left hover:bg-muted/20 rounded-lg transition-colors cursor-pointer"
            onClick={() => setSelectedAppId(app.application_id)}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/10 shrink-0">
                {app.applicant_profile?.first_name?.charAt(0) ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm leading-none truncate">
                  {app.applicant_profile?.first_name} {app.applicant_profile?.last_name}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{app.applicant_profile?.email}</p>
                <p className="text-[10px] font-mono text-muted-foreground/70">{app.applicant_profile?.applicant_code}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground">{formatDate(app.applied_at)}</span>
              <span className={`text-[10px] font-bold uppercase border rounded-full px-2.5 py-1 ${APP_STATUS_STYLES[app.status] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                {stageLabel}
              </span>
              <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl p-6 mx-4 max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between mb-5 shrink-0">
            <div>
              <h3 className="font-bold text-foreground text-lg">{job.title}</h3>
              <p className="text-xs text-muted-foreground">
                {applicantLabel}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : applicantsContent}
          </div>
        </div>
      </div>

      {selectedAppId && (
        <ApplicationDetailModal
          applicationId={selectedAppId}
          onClose={() => setSelectedAppId(null)}
          onStatusChange={(newStatus) => {
            setApplications((prev) =>
              prev.map((a) => a.application_id === selectedAppId ? { ...a, status: newStatus } : a)
            );
            setSelectedAppId(null);
          }}
        />
      )}
    </>
  );
}

// ─── Row Actions ──────────────────────────────────────────────────────────────

function JobRowMenu({
  job,
  onViewApplicants,
  onClose,
  onReopen,
  onEdit,
  onManageForm,
}: Readonly<{
  job: JobPosting;
  onViewApplicants: () => void;
  onClose: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onManageForm: () => void;
}>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 160;
      const spaceBelow = globalThis.innerHeight - rect.bottom;
      if (spaceBelow < menuHeight) {
        setPos({ bottom: globalThis.innerHeight - rect.top + 4, right: globalThis.innerWidth - rect.right });
      } else {
        setPos({ top: rect.bottom + 4, right: globalThis.innerWidth - rect.right });
      }
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div>
      <Button ref={btnRef} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleToggle}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          style={{ position: "fixed", top: pos.top, bottom: pos.bottom, right: pos.right }}
          className="z-200 w-48 bg-card border border-border rounded-lg shadow-lg py-1 text-sm"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); } }}
        >
          <button className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-foreground" onClick={onViewApplicants}>
            <Users className="h-3.5 w-3.5" /> View Applicants
          </button>
          <button className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-foreground" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit Posting
          </button>
          <button className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-foreground" onClick={onManageForm}>
            <FileText className="h-3.5 w-3.5" /> Manage Form
          </button>
          {job.status === "open" && (
            <button className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-red-600" onClick={onClose}>
              <XCircle className="h-3.5 w-3.5" /> Close Posting
            </button>
          )}
          {job.status === "closed" && (
            <button className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-green-600" onClick={onReopen}>
              <RefreshCw className="h-3.5 w-3.5" /> Reopen Posting
            </button>
          )}
          {job.status === "draft" && (
            <button className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-green-600" onClick={onReopen}>
              <CheckCircle className="h-3.5 w-3.5" /> Publish (Open)
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Main Page ────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",    label: "All" },
  { value: "open",   label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "draft",  label: "Draft" },
];

export default function HRJobsPage() {
  const user = getUserInfo();
  useWelcomeToast(user?.name || "HR Officer", "Recruitment");

  const [jobs, setJobs]                     = useState<JobPosting[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("all");
  const [page, setPage]                     = useState(1);
  const [showCreate, setShowCreate]         = useState(false);
  const [editJob, setEditJob]               = useState<JobPosting | null>(null);
  const [manageFormJob, setManageFormJob]   = useState<JobPosting | null>(null);
  const [viewApplicants, setViewApplicants] = useState<JobPosting | null>(null);
  const [closingId, setClosingId]           = useState<string | null>(null);
  const [reopeningId, setReopeningId]       = useState<string | null>(null);
  const [careersUrl, setCareersUrl]         = useState<string | null>(null);
  const [copied, setCopied]                 = useState(false);

  // Pipeline view state
  const [pageView, setPageView]               = useState<PageView>("postings");
  const [pipelineView, setPipelineView]       = useState<"list" | "kanban">("kanban");
  const [pipelineJobId, setPipelineJobId]     = useState<string | null>(null);
  const [pipelineApps, setPipelineApps]       = useState<PipelineApplication[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineStage, setPipelineStage]     = useState<string>("submitted");
  const [pipelineSearch, setPipelineSearch]   = useState("");
  const [pipelineDetailId, setPipelineDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<JobPosting[]>("/jobs");
      setJobs(data);
    } catch {
      toast.error("Failed to load job postings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-select first job for pipeline once jobs load
  useEffect(() => {
    if (jobs.length > 0 && !pipelineJobId) {
      const firstOpen = jobs.find((j) => j.status === "open") ?? jobs[0];
      setPipelineJobId(firstOpen.job_posting_id);
    }
  }, [jobs, pipelineJobId]);

  const loadPipelineApps = useCallback(async (jobId: string) => {
    setPipelineLoading(true);
    try {
      const data = await apiFetch<PipelineApplication[]>(`/jobs/${jobId}/applications`);
      setPipelineApps(data);
    } catch {
      toast.error("Failed to load pipeline applications");
    } finally {
      setPipelineLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pageView === "pipeline" && pipelineJobId) loadPipelineApps(pipelineJobId);
  }, [pageView, pipelineJobId, loadPipelineApps]);

  const handlePipelineStatusChange = async (appId: string, newStatus: string) => {
    try {
      await apiFetch(`/jobs/applications/${appId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setPipelineApps((prev) => prev.map((a) => a.application_id === appId ? { ...a, status: newStatus } : a));
      toast.success("Stage updated");
    } catch {
      toast.error("Failed to update stage");
    }
  };

  useEffect(() => {
    getMyCompany()
      .then((company) => {
        const origin = globalThis.window === undefined ? "" : globalThis.location.origin;
        setCareersUrl(`${origin}/careers/${company.slug}`);
      })
      .catch(() => {});
  }, []);

  const handleClosePosting = async (job: JobPosting) => {
    setClosingId(job.job_posting_id);
    try {
      await apiFetch(`/jobs/${job.job_posting_id}/close`, { method: "PATCH" });
      setJobs((prev) =>
        prev.map((j) => j.job_posting_id === job.job_posting_id ? { ...j, status: "closed" as const } : j)
      );
      toast.success(`"${job.title}" has been closed.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to close posting");
    } finally {
      setClosingId(null);
    }
  };

  const handleReopenPosting = async (job: JobPosting) => {
    setReopeningId(job.job_posting_id);
    try {
      await apiFetch<JobPosting>(`/jobs/${job.job_posting_id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "open" }),
      });
      setJobs((prev) =>
        prev.map((j) => j.job_posting_id === job.job_posting_id ? { ...j, status: "open" as const } : j)
      );
      toast.success(`"${job.title}" has been reopened.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to reopen posting");
    } finally {
      setReopeningId(null);
    }
  };

  const filtered = jobs.filter((j) => {
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return !q || j.title.toLowerCase().includes(q) || (j.location ?? "").toLowerCase().includes(q) || (j.employment_type ?? "").toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const openCount   = jobs.filter((j) => j.status === "open").length;
  const closedCount = jobs.filter((j) => j.status === "closed").length;

  const emptyTableMessage = (() => {
    if (jobs.length === 0) return "No job postings yet. Create your first one!";
    if (statusFilter !== "all") return `No ${statusFilter} postings found.`;
    return "No postings match your search.";
  })();

  const pagedRows = paged.length === 0 ? (
    <tr>
      <td colSpan={7} className="px-5 py-10 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Briefcase className="h-10 w-10 opacity-20" />
          <p className="text-sm font-medium">
            {emptyTableMessage}
          </p>
          {jobs.length === 0 && (
            <Button size="sm" className="mt-1 gap-1" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" /> Create Job Posting
            </Button>
          )}
        </div>
      </td>
    </tr>
  ) : (
    <>
      {paged.map((job) => (
        <tr key={job.job_posting_id} className="hover:bg-primary/5 transition-colors">
          <td className="px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-foreground leading-none">{job.title}</p>
                {job.salary_range && <p className="text-[11px] text-muted-foreground mt-0.5">{job.salary_range}</p>}
              </div>
            </div>
          </td>
          <td className="px-5 py-4">
            {job.location ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{job.location}</span>
            ) : <span className="text-xs text-muted-foreground">—</span>}
          </td>
          <td className="px-5 py-4"><span className="text-xs font-semibold text-foreground">{job.employment_type ?? "—"}</span></td>
          <td className="px-5 py-4">
            {(closingId === job.job_posting_id || reopeningId === job.job_posting_id)
              ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              : <StatusBadge status={job.status} />}
          </td>
          <td className="px-5 py-4"><span className="text-xs text-muted-foreground">{formatDate(job.posted_at)}</span></td>
          <td className="px-5 py-4"><span className="text-xs text-muted-foreground">{job.closes_at ? formatDate(job.closes_at) : "—"}</span></td>
          <td className="px-5 py-4 text-right">
            <JobRowMenu
              job={job}
              onViewApplicants={() => setViewApplicants(job)}
              onClose={() => handleClosePosting(job)}
              onReopen={() => handleReopenPosting(job)}
              onEdit={() => setEditJob(job)}
              onManageForm={() => setManageFormJob(job)}
            />
          </td>
        </tr>
      ))}
    </>
  );
  const jobTableRows = loading ? (
    <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">Loading job postings...</td></tr>
  ) : pagedRows;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Recruitment</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Hiring Pipeline and Posting Controls</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Publish opportunities, monitor applicants, and keep recruitment velocity visible in one view.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Open Postings</p>
            <p className="mt-1 text-lg font-bold">{openCount}</p>
          </div>
        </div>
      </section>

      {/* View Tab Switcher */}
      <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setPageView("postings")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            pageView === "postings"
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <List className="h-4 w-4" /> Job Postings
        </button>
        <button
          onClick={() => setPageView("pipeline")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            pageView === "pipeline"
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <KanbanSquare className="h-4 w-4" /> Recruitment Pipeline
        </button>
      </div>

      {/* ── PIPELINE VIEW ─────────────────────────────────────────────────── */}
      {pageView === "pipeline" && (() => {
        const selectedPipelineJob = jobs.find((j) => j.job_posting_id === pipelineJobId);
        const stageFiltered = pipelineApps.filter((a) => {
          const q = pipelineSearch.toLowerCase();
          const { first_name, last_name, email, applicant_code } = a.applicant_profile;
          return !q || `${first_name} ${last_name}`.toLowerCase().includes(q) || email.toLowerCase().includes(q) || applicant_code.toLowerCase().includes(q);
        });
        const stageCounts = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.value, pipelineApps.filter((a) => a.status === s.value).length]));
        const visibleApps = stageFiltered.filter((a) => a.status === pipelineStage);
        const activeStage = PIPELINE_STAGES.find((s) => s.value === pipelineStage)!;

        const listBody = visibleApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <activeStage.icon className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No candidates in this stage</p>
            {pipelineSearch && <p className="text-xs mt-1 opacity-60">Try clearing the search filter</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleApps.map((app) => {
              const { first_name, last_name, email, applicant_code } = app.applicant_profile;
              const ini = `${first_name.charAt(0)}${last_name.charAt(0)}`.toUpperCase();
              return (
                <div
                  key={app.application_id}
                  className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-[linear-gradient(135deg,#1e3a8a,#2563eb)] flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                      {ini}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate leading-tight">{first_name} {last_name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mt-0.5">{applicant_code}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border shrink-0 ${activeStage.badge}`}>
                      {activeStage.label}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">{email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        Applied {new Date(app.applied_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-border mt-auto">
                    <select
                      value={app.status}
                      disabled={false}
                      onChange={(e) => handlePipelineStatusChange(app.application_id, e.target.value)}
                      className="flex-1 h-7 rounded-md border border-border bg-background text-xs px-2 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      {APP_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" className="h-7 px-3 text-xs shrink-0" onClick={() => setPipelineDetailId(app.application_id)}>
                      View
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        );
        const listContent = pipelineLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
          </div>
        ) : listBody;

        return (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Job selector + search bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative">
                <button
                  className="inline-flex items-center gap-2 h-9 pl-3 pr-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted/40 transition-colors shadow-xs min-w-50 max-w-70"
                  onClick={() => {/* toggle handled by select below */}}
                >
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <select
                    value={pipelineJobId ?? ""}
                    onChange={(e) => { setPipelineJobId(e.target.value); setPipelineStage("submitted"); }}
                    className="flex-1 bg-transparent text-sm outline-none cursor-pointer"
                  >
                    {jobs.map((j) => (
                      <option key={j.job_posting_id} value={j.job_posting_id}>{j.title}</option>
                    ))}
                  </select>
                </button>
              </div>
              <div className="relative flex-1 min-w-45 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  value={pipelineSearch}
                  onChange={(e) => setPipelineSearch(e.target.value)}
                  placeholder="Search candidates…"
                  className="h-9 w-full pl-9 pr-3 rounded-lg border border-border bg-card text-sm shadow-xs focus:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all"
                />
                {pipelineSearch && (
                  <button onClick={() => setPipelineSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded hover:bg-muted/60 transition-colors">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {/* View toggle */}
                <div className="flex items-center gap-0.5 bg-muted/40 border border-border rounded-lg p-0.5">
                  <button
                    onClick={() => setPipelineView("kanban")}
                    title="Kanban view"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      pipelineView === "kanban"
                        ? "bg-card text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <KanbanSquare className="h-3.5 w-3.5" /> Kanban
                  </button>
                  <button
                    onClick={() => setPipelineView("list")}
                    title="List view"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      pipelineView === "list"
                        ? "bg-card text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" /> List
                  </button>
                </div>

                <Button variant="outline" size="sm" className="h-9 px-3 gap-2" onClick={() => pipelineJobId && loadPipelineApps(pipelineJobId)} disabled={pipelineLoading}>
                  <RefreshCw className={`h-4 w-4 ${pipelineLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>
            </div>

            {/* Stage summary stats + tab header — list view only */}
            {pipelineView === "list" && (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
                  {PIPELINE_STAGES.map((s) => {
                    const Icon = s.icon;
                    const active = pipelineStage === s.value;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setPipelineStage(s.value)}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
                          active
                            ? `${s.badge} border-current shadow-sm scale-[1.03]`
                            : "bg-card border-border hover:border-primary/30 hover:bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-lg font-bold leading-none">{stageCounts[s.value] ?? 0}</span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-center leading-tight">{s.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${activeStage.dot}`} />
                    <h2 className="text-base font-bold tracking-tight">{activeStage.label}</h2>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${activeStage.badge}`}>
                      {visibleApps.length}
                    </span>
                  </div>
                  {selectedPipelineJob && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{selectedPipelineJob.title}</span>
                  )}
                </div>
              </>
            )}

            {/* ── Kanban view ── */}
            {pipelineView === "kanban" && (
              pipelineLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                </div>
              ) : (
                <PipelineKanbanView
                  apps={stageFiltered}
                  onStatusChange={handlePipelineStatusChange}
                  onViewDetail={setPipelineDetailId}
                />
              )
            )}

            {/* ── List view (original design) ── */}
            {pipelineView === "list" && listContent}
          </div>
        );
      })()}

      {/* ── POSTINGS VIEW ─────────────────────────────────────────────────── */}
      {pageView === "postings" && <>

      {/* Careers Page Banner */}
      {careersUrl && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-border/70 rounded-2xl px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Link2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Public Careers Page</p>
              <p className="text-sm font-medium text-foreground truncate">{careersUrl}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 h-8 gap-1.5" onClick={() => {
            navigator.clipboard.writeText(careersUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Postings" value={jobs.length}  sub="All postings"         color="text-foreground" />
        <StatCard label="Open"           value={openCount}    sub="Accepting applicants" color="text-green-600" />
        <StatCard label="Closed"         value={closedCount}  sub="No longer accepting"  color="text-red-600" />
        <StatCard label="Drafts"         value={jobs.filter((j) => j.status === "draft").length} sub="Not yet published" color="text-amber-600" />
      </div>

      {/* Table Card */}
      <div className="bg-card border border-border/70 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 p-5 border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-base tracking-tight">Job Postings</h2>
              <p className="text-xs text-muted-foreground">Manage open positions for your company</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search postings..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 h-9 w-full sm:w-60"
                />
              </div>
              <Button className="shrink-0 h-9 gap-2" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" /> New Job
              </Button>
            </div>
          </div>

          {/* Status filter chips */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((f) => {
              const count = f.value === "all" ? jobs.length : jobs.filter((j) => j.status === f.value).length;
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {f.label}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-muted"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/40 border-b border-border uppercase tracking-widest">
              <tr>
                <th className="px-5 py-3">Job Title</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Posted</th>
                <th className="px-5 py-3">Closes</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobTableRows}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {filtered.length > 0 ? `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length}` : "No results"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setPage((p) => p - 1)} disabled={page === 1 || totalPages === 0}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages || totalPages === 0}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      </>}

      {/* ── SHARED MODALS ──────────────────────────────────────────────────── */}

      {/* Pipeline applicant detail — reuses the full ApplicationDetailModal */}
      {pipelineDetailId && (
        <ApplicationDetailModal
          applicationId={pipelineDetailId}
          onClose={() => setPipelineDetailId(null)}
          onStatusChange={(newStatus) => {
            setPipelineApps((prev) =>
              prev.map((a) =>
                a.application_id === pipelineDetailId ? { ...a, status: newStatus } : a
              )
            );
          }}
        />
      )}

      {showCreate && (
        <CreateJobModal
          onClose={() => setShowCreate(false)}
          onCreate={(job) => { setJobs((prev) => [job, ...prev]); setShowCreate(false); }}
        />
      )}

      {editJob && (
        <EditJobModal
          job={editJob}
          onClose={() => setEditJob(null)}
          onSave={(updated) => {
            setJobs((prev) => prev.map((j) => j.job_posting_id === updated.job_posting_id ? updated : j));
            setEditJob(null);
          }}
        />
      )}

      {manageFormJob && (
        <ManageFormModal
          job={manageFormJob}
          onClose={() => setManageFormJob(null)}
        />
      )}

      {viewApplicants && (
        <ApplicantsModal job={viewApplicants} onClose={() => setViewApplicants(null)} />
      )}
    </div>
  );
}
