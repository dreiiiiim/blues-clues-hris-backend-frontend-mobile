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
  KanbanSquare, List, Mail, Phone, Calendar, Mic, Cpu, Trophy, CheckCircle2,
  LayoutGrid,
} from "lucide-react";
import { PipelineKanbanView } from "./_components/PipelineKanbanView";
import { getApplicationDetail, getMyCompany, type ApplicationDetail } from "@/lib/authApi";
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
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getApplicationDetail(applicationId)
      .then((d) => { setDetail(d); setStatus(d.status); })
      .catch((err: any) => toast.error(err.message || "Failed to load details"))
      .finally(() => setLoading(false));
  }, [applicationId]);

  const handleStatusSave = async () => {
    if (!detail || status === detail.status) return;
    setUpdating(true);
    try {
      await apiFetch(`/jobs/applications/${applicationId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      onStatusChange(status);
      toast.success("Status updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const formatAnswer = (answer: ApplicationDetail["answers"][number]) => {
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
  };

  const detailContent = detail ? (
    <>
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Application Stage</p>
        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`flex-1 h-9 rounded-md border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${APP_STATUS_STYLES[status] ?? "border-border bg-background text-foreground"}`}
          >
            {APP_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <Button onClick={handleStatusSave} disabled={updating || status === detail.status} size="sm" className="h-9">
            {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Applicant Info</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <p className="text-[10px] text-muted-foreground font-semibold">Code</p>
            <p className="font-mono font-bold">{detail.applicant_profile.applicant_code}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <p className="text-[10px] text-muted-foreground font-semibold">Applied</p>
            <p className="font-semibold">{formatDate(detail.applied_at)}</p>
          </div>
          {detail.applicant_profile.phone_number && (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 col-span-2">
              <p className="text-[10px] text-muted-foreground font-semibold">Phone</p>
              <p className="font-semibold">{detail.applicant_profile.phone_number}</p>
            </div>
          )}
        </div>
      </div>

      {detail.answers.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Application Answers</p>
          {detail.answers
            .slice()
            .sort((a, b) => (a.application_questions.sort_order ?? 0) - (b.application_questions.sort_order ?? 0))
            .map((ans) => (
              <div key={ans.answer_id} className="rounded-xl border border-border bg-muted/10 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-foreground">{ans.application_questions.question_text}</p>
                <p className="text-sm text-foreground">{formatAnswer(ans)}</p>
              </div>
            ))}
        </div>
      )}
    </>
  ) : null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h3 className="font-bold text-lg">Application Detail</h3>
            {detail && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {detail.applicant_profile.first_name} {detail.applicant_profile.last_name} · {detail.applicant_profile.email}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detailContent}
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

// ─── Pipeline Detail Modal ────────────────────────────────────────────────────

function PipelineDetailModal({
  detail,
  onClose,
  onStatusChange,
  updating,
}: Readonly<{
  detail: ApplicationDetail;
  onClose: () => void;
  onStatusChange: (appId: string, status: string) => Promise<void>;
  updating: boolean;
}>) {
  const [showStageMenu, setShowStageMenu] = useState(false);
  const p = detail.applicant_profile;
  const initials = `${p.first_name.charAt(0)}${p.last_name.charAt(0)}`.toUpperCase();
  const currentStage = PIPELINE_STAGES.find((s) => s.value === detail.status) ?? PIPELINE_STAGES[0];

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 animate-in fade-in duration-200 p-4"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') { onClose(); } }}
    >
      <dialog
        open
        aria-modal="true"
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 m-0 p-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.06),transparent)]">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-[linear-gradient(135deg,#1e3a8a,#2563eb)] flex items-center justify-center text-white font-bold shadow-sm shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground leading-tight">{p.first_name} {p.last_name}</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mt-0.5">{p.applicant_code}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted/60 flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">Contact Info</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>{p.email}</span></div>
              {p.phone_number && <div className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span>{p.phone_number}</span></div>}
              <div className="flex items-center gap-3 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" /><span>Applied {new Date(detail.applied_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">Application Stage</p>
            <div className="relative">
              <button
                onClick={() => setShowStageMenu((v) => !v)}
                disabled={updating}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wide cursor-pointer transition-all ${currentStage.badge} hover:opacity-80`}
              >
                {updating && <Loader2 className="h-3 w-3 animate-spin" />}
                {APP_STATUSES.find((s) => s.value === detail.status)?.label ?? detail.status}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showStageMenu && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-45">
                  {APP_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      onClick={async () => { setShowStageMenu(false); await onStatusChange(detail.application_id, s.value); }}
                      className={`flex items-center gap-2 px-3 py-2 w-full text-left text-sm hover:bg-muted/50 transition-colors ${detail.status === s.value ? "font-semibold text-primary" : "text-foreground"}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${PIPELINE_STAGES.find((ps) => ps.value === s.value)?.dot ?? "bg-gray-400"}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {detail.answers.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">Application Answers</p>
              <div className="space-y-4">
                {[...detail.answers]
                  .sort((a, b) => a.application_questions.sort_order - b.application_questions.sort_order)
                  .map((ans) => (
                    <div key={ans.answer_id} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                      <p className="text-xs font-semibold text-foreground mb-1">{ans.application_questions.question_text}</p>
                      <p className="text-sm text-muted-foreground">{ans.answer_value || <span className="italic opacity-50">No answer</span>}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}

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
  const [pipelineDetail, setPipelineDetail]   = useState<ApplicationDetail | null>(null);
  const [pipelineDetailLoading, setPipelineDetailLoading] = useState(false);
  const [pipelineUpdating, setPipelineUpdating]           = useState(false);

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
    setPipelineUpdating(true);
    try {
      await apiFetch(`/jobs/applications/${appId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setPipelineApps((prev) => prev.map((a) => a.application_id === appId ? { ...a, status: newStatus } : a));
      if (pipelineDetail?.application_id === appId) {
        setPipelineDetail((d) => d ? { ...d, status: newStatus } : d);
      }
      toast.success("Stage updated");
    } catch {
      toast.error("Failed to update stage");
    } finally {
      setPipelineUpdating(false);
    }
  };

  const handleOpenPipelineDetail = async (appId: string) => {
    setPipelineDetailLoading(true);
    try {
      const d = await getApplicationDetail(appId);
      setPipelineDetail(d);
    } catch {
      toast.error("Failed to load application details");
    } finally {
      setPipelineDetailLoading(false);
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
                      disabled={pipelineUpdating}
                      onChange={(e) => handlePipelineStatusChange(app.application_id, e.target.value)}
                      className="flex-1 h-7 rounded-md border border-border bg-background text-xs px-2 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      {APP_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" className="h-7 px-3 text-xs shrink-0" onClick={() => handleOpenPipelineDetail(app.application_id)}>
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
                  onViewDetail={handleOpenPipelineDetail}
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

      {/* Pipeline detail modal */}
      {pipelineDetailLoading && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/30 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading details…</p>
          </div>
        </div>
      )}

      {pipelineDetail && !pipelineDetailLoading && (
        <PipelineDetailModal
          detail={pipelineDetail}
          onClose={() => setPipelineDetail(null)}
          onStatusChange={handlePipelineStatusChange}
          updating={pipelineUpdating}
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
