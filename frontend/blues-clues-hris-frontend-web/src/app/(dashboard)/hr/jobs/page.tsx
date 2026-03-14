"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { getUserInfo } from "@/lib/authStorage";
import { authFetch } from "@/lib/authApi";
import { getApplicationDetail, type ApplicationDetail } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Plus, MoreHorizontal, X, ChevronLeft, ChevronRight,
  Briefcase, MapPin, Users, XCircle, Loader2, CheckCircle, Link2, Copy, Check,
  ArrowLeft, ArrowRight, GripVertical, Trash2, ChevronDown,
} from "lucide-react";
import { getMyCompany } from "@/lib/authApi";
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
  id: string; // local draft id
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || "Request failed");
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

function StatCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
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
}: {
  questions: Question[];
  onChange: (qs: Question[]) => void;
}) {
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
              {/* Question text */}
              <Input
                placeholder={`Question ${qi + 1}`}
                value={q.question_text}
                onChange={(e) => updateQ(q.id, { question_text: e.target.value })}
                className="h-9"
              />
              {/* Type + required row */}
              <div className="flex gap-2 items-center">
                <select
                  value={q.question_type}
                  onChange={(e) =>
                    updateQ(q.id, {
                      question_type: e.target.value as Question["question_type"],
                      options: e.target.value === "text" ? [] : q.options.length ? q.options : [""],
                    })
                  }
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
                  />
                  Required
                </label>
              </div>
              {/* Options for MC/Checkbox */}
              {(q.question_type === "multiple_choice" || q.question_type === "checkbox") && (
                <div className="space-y-2 pl-1">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
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
}: {
  onClose: () => void;
  onCreate: (job: JobPosting) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [createdJob, setCreatedJob] = useState<JobPosting | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", location: "",
    employment_type: "", salary_range: "", closes_at: "",
  });

  // Step 1: Create posting
  const handleCreatePosting = async (e: React.FormEvent) => {
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

  // Step 2: Save questions (optional) then finish
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {step === 1 ? (
            <form id="step1-form" onSubmit={handleCreatePosting} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Job Title *</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Senior Software Engineer"
                  required className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  required rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</label>
                  <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Manila" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Employment Type</label>
                  <select
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Salary Range</label>
                  <Input value={form.salary_range} onChange={(e) => setForm((f) => ({ ...f, salary_range: e.target.value }))} placeholder="e.g. ₱50k – ₱80k" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Closes On</label>
                  <Input type="date" value={form.closes_at} onChange={(e) => setForm((f) => ({ ...f, closes_at: e.target.value }))} className="h-10" />
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

// ─── Application Detail Modal ─────────────────────────────────────────────────

function ApplicationDetailModal({
  applicationId,
  onClose,
  onStatusChange,
}: {
  applicationId: string;
  onClose: () => void;
  onStatusChange: (newStatus: string) => void;
}) {
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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
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
          ) : !detail ? null : (
            <>
              {/* Status */}
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

              {/* Applicant info */}
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

              {/* Answers */}
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
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Applicants Modal ─────────────────────────────────────────────────────────

function ApplicantsModal({
  job,
  onClose,
}: {
  job: JobPosting;
  onClose: () => void;
}) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Application[]>(`/jobs/${job.job_posting_id}/applications`)
      .then(setApplications)
      .catch((err: any) => toast.error(err.message || "Failed to load applications"))
      .finally(() => setLoading(false));
  }, [job.job_posting_id]);

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl p-6 mx-4 max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between mb-5 shrink-0">
            <div>
              <h3 className="font-bold text-foreground text-lg">{job.title}</h3>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading..." : `${applications.length} applicant${applications.length !== 1 ? "s" : ""}`}
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
            ) : applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <Users className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">No applications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {applications.map((app) => {
                  const stageLabel = APP_STATUSES.find((s) => s.value === app.status)?.label ?? app.status;
                  return (
                    <div
                      key={app.application_id}
                      className="flex items-center justify-between py-4 px-1 gap-4 hover:bg-muted/20 rounded-lg transition-colors cursor-pointer"
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
                    </div>
                  );
                })}
              </div>
            )}
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
}: {
  job: JobPosting;
  onViewApplicants: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
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
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-[200] w-48 bg-card border border-border rounded-lg shadow-lg py-1 text-sm"
          onClick={() => setOpen(false)}
        >
          <button className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-foreground" onClick={onViewApplicants}>
            <Users className="h-3.5 w-3.5" /> View Applicants
          </button>
          {job.status === "open" && (
            <button className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-red-600" onClick={onClose}>
              <XCircle className="h-3.5 w-3.5" /> Close Posting
            </button>
          )}
          {job.status === "closed" && (
            <span className="flex items-center gap-2 px-3 py-2 w-full text-muted-foreground/50 cursor-not-allowed text-xs">
              <CheckCircle className="h-3.5 w-3.5" /> Already Closed
            </span>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HRJobsPage() {
  const user = getUserInfo();
  useWelcomeToast(user?.name || "HR Officer", "Recruitment");

  const [jobs, setJobs]                     = useState<JobPosting[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [page, setPage]                     = useState(1);
  const [showCreate, setShowCreate]         = useState(false);
  const [viewApplicants, setViewApplicants] = useState<JobPosting | null>(null);
  const [closingId, setClosingId]           = useState<string | null>(null);
  const [careersUrl, setCareersUrl]         = useState<string | null>(null);
  const [copied, setCopied]                 = useState(false);

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

  useEffect(() => {
    getMyCompany()
      .then((company) => {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
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

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    return !q || j.title.toLowerCase().includes(q) || (j.location ?? "").toLowerCase().includes(q) || (j.employment_type ?? "").toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const openCount   = jobs.filter((j) => j.status === "open").length;
  const closedCount = jobs.filter((j) => j.status === "closed").length;

  return (
    <div className="space-y-6">
      {/* Careers Page Banner */}
      {careersUrl && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-border rounded-xl px-5 py-4 shadow-sm">
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
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-base">Job Postings</h2>
            <p className="text-xs text-muted-foreground">Manage open positions for your company</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search postings..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9 w-full sm:w-60" />
            </div>
            <Button className="shrink-0 h-9 gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New Job
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-b border-border uppercase tracking-widest">
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
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">Loading job postings...</td></tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Briefcase className="h-10 w-10 opacity-20" />
                      <p className="text-sm font-medium">{jobs.length === 0 ? "No job postings yet. Create your first one!" : "No postings match your search."}</p>
                      {jobs.length === 0 && <Button size="sm" className="mt-1 gap-1" onClick={() => setShowCreate(true)}><Plus className="h-3.5 w-3.5" /> Create Job Posting</Button>}
                    </div>
                  </td>
                </tr>
              ) : paged.map((job) => (
                <tr key={job.job_posting_id} className="hover:bg-muted/20 transition-colors">
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
                    {closingId === job.job_posting_id
                      ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      : <StatusBadge status={job.status} />}
                  </td>
                  <td className="px-5 py-4"><span className="text-xs text-muted-foreground">{formatDate(job.posted_at)}</span></td>
                  <td className="px-5 py-4"><span className="text-xs text-muted-foreground">{job.closes_at ? formatDate(job.closes_at) : "—"}</span></td>
                  <td className="px-5 py-4 text-right">
                    <JobRowMenu job={job} onViewApplicants={() => setViewApplicants(job)} onClose={() => handleClosePosting(job)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
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

      {showCreate && (
        <CreateJobModal
          onClose={() => setShowCreate(false)}
          onCreate={(job) => { setJobs((prev) => [job, ...prev]); setShowCreate(false); }}
        />
      )}

      {viewApplicants && (
        <ApplicantsModal job={viewApplicants} onClose={() => setViewApplicants(null)} />
      )}
    </div>
  );
}
