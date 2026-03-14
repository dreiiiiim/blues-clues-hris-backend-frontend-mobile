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

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 8;

const JOB_STATUS_STYLES: Record<string, string> = {
  open:   "bg-green-100 text-green-700 border-green-200",
  closed: "bg-red-100 text-red-700 border-red-200",
  draft:  "bg-amber-100 text-amber-700 border-amber-200",
};

const APP_STATUS_STYLES: Record<string, string> = {
  submitted:  "bg-blue-100 text-blue-700 border-blue-200",
  reviewing:  "bg-yellow-100 text-yellow-700 border-yellow-200",
  interview:  "bg-purple-100 text-purple-700 border-purple-200",
  offer:      "bg-green-100 text-green-700 border-green-200",
  rejected:   "bg-red-100 text-red-700 border-red-200",
};

const APP_STATUSES = ["submitted", "reviewing", "interview", "offer", "rejected"];

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

// ─── Create Job Modal ─────────────────────────────────────────────────────────

function CreateJobModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (job: JobPosting) => void;
}) {
  const [form, setForm] = useState({
    title: "", description: "", location: "",
    employment_type: "", salary_range: "", closes_at: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = { title: form.title, description: form.description };
      if (form.location.trim())       payload.location = form.location.trim();
      if (form.employment_type)       payload.employment_type = form.employment_type;
      if (form.salary_range.trim())   payload.salary_range = form.salary_range.trim();
      if (form.closes_at)             payload.closes_at = new Date(form.closes_at).toISOString();

      const job = await apiFetch<JobPosting>("/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Job posting created!");
      onCreate(job);
    } catch (err: any) {
      toast.error(err.message || "Failed to create job posting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-foreground text-lg">Create Job Posting</h3>
            <p className="text-xs text-muted-foreground">Fill in the details for the new position</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Job Title *</label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Senior Software Engineer"
              required
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description *</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the role, responsibilities, and requirements..."
              required
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</label>
              <Input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Manila"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Employment Type</label>
              <select
                value={form.employment_type}
                onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}
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
              <Input
                value={form.salary_range}
                onChange={e => setForm(f => ({ ...f, salary_range: e.target.value }))}
                placeholder="e.g. ₱50k – ₱80k"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Closes On</label>
              <Input
                type="date"
                value={form.closes_at}
                onChange={e => setForm(f => ({ ...f, closes_at: e.target.value }))}
                className="h-10"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Posting"}
            </Button>
          </div>
        </form>
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
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Application[]>(`/jobs/${job.job_posting_id}/applications`)
      .then(setApplications)
      .catch((err: any) => toast.error(err.message || "Failed to load applications"))
      .finally(() => setLoading(false));
  }, [job.job_posting_id]);

  const handleStatusChange = async (appId: string, status: string) => {
    setUpdatingId(appId);
    try {
      await apiFetch(`/jobs/applications/${appId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setApplications(prev =>
        prev.map(a => a.application_id === appId ? { ...a, status } : a)
      );
      toast.success("Status updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
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
              {applications.map(app => (
                <div key={app.application_id} className="flex items-center justify-between py-4 px-1 gap-4">
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
                    <select
                      value={app.status}
                      disabled={updatingId === app.application_id}
                      onChange={e => handleStatusChange(app.application_id, e.target.value)}
                      className={`text-[10px] font-bold uppercase border rounded-full px-2 py-1 cursor-pointer focus-visible:outline-none ${
                        APP_STATUS_STYLES[app.status] ?? "bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                    >
                      {APP_STATUSES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(v => !v);
  };

  // Close on outside click — exclude both the trigger button and the portal menu
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div>
      <Button
        ref={btnRef}
        variant="ghost" size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={handleToggle}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-[200] w-48 bg-card border border-border rounded-lg shadow-lg py-1 text-sm"
          onClick={() => setOpen(false)}
        >
          <button
            className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-foreground"
            onClick={onViewApplicants}
          >
            <Users className="h-3.5 w-3.5" /> View Applicants
          </button>
          {job.status === "open" && (
            <button
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-red-600"
              onClick={onClose}
            >
              <XCircle className="h-3.5 w-3.5" /> Close Posting
            </button>
          )}
          {job.status === "closed" && (
            <span className="flex items-center gap-2 px-3 py-2 w-full text-muted-foreground/50 cursor-not-allowed text-xs">
              <CheckCircle className="h-3.5 w-3.5" /> Already Closed
            </span>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HRJobsPage() {
  const user = getUserInfo();
  useWelcomeToast(user?.name || "HR Officer", "Recruitment");

  const [jobs, setJobs]                   = useState<JobPosting[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [page, setPage]                   = useState(1);
  const [showCreate, setShowCreate]       = useState(false);
  const [viewApplicants, setViewApplicants] = useState<JobPosting | null>(null);
  const [closingId, setClosingId]         = useState<string | null>(null);
  const [careersUrl, setCareersUrl]       = useState<string | null>(null);
  const [copied, setCopied]               = useState(false);

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
      .then(company => {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        setCareersUrl(`${origin}/careers/${company.slug}`);
      })
      .catch(() => {}); // non-critical — banner simply won't show
  }, []);

  const handleClosePosting = async (job: JobPosting) => {
    setClosingId(job.job_posting_id);
    try {
      await apiFetch(`/jobs/${job.job_posting_id}/close`, { method: "PATCH" });
      setJobs(prev => prev.map(j =>
        j.job_posting_id === job.job_posting_id ? { ...j, status: "closed" as const } : j
      ));
      toast.success(`"${job.title}" has been closed.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to close posting");
    } finally {
      setClosingId(null);
    }
  };

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    return (
      !q ||
      j.title.toLowerCase().includes(q) ||
      (j.location ?? "").toLowerCase().includes(q) ||
      (j.employment_type ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const openCount   = jobs.filter(j => j.status === "open").length;
  const closedCount = jobs.filter(j => j.status === "closed").length;

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
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 h-8 gap-1.5"
            onClick={() => {
              navigator.clipboard.writeText(careersUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
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
        <StatCard label="Drafts"         value={jobs.filter(j => j.status === "draft").length} sub="Not yet published" color="text-amber-600" />
      </div>

      {/* Table Card */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-base">Job Postings</h2>
            <p className="text-xs text-muted-foreground">Manage open positions for your company</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search postings..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9 w-full sm:w-60"
              />
            </div>
            <Button
              className="shrink-0 h-9 gap-2"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" /> New Job
            </Button>
          </div>
        </div>

        {/* Table */}
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
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    Loading job postings...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Briefcase className="h-10 w-10 opacity-20" />
                      <p className="text-sm font-medium">
                        {jobs.length === 0 ? "No job postings yet. Create your first one!" : "No postings match your search."}
                      </p>
                      {jobs.length === 0 && (
                        <Button size="sm" className="mt-1 gap-1" onClick={() => setShowCreate(true)}>
                          <Plus className="h-3.5 w-3.5" /> Create Job Posting
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : paged.map(job => (
                <tr key={job.job_posting_id} className="hover:bg-muted/20 transition-colors">
                  {/* Title */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground leading-none">{job.title}</p>
                        {job.salary_range && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{job.salary_range}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Location */}
                  <td className="px-5 py-4">
                    {job.location ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />{job.location}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  {/* Type */}
                  <td className="px-5 py-4">
                    <span className="text-xs font-semibold text-foreground">{job.employment_type ?? "—"}</span>
                  </td>
                  {/* Status */}
                  <td className="px-5 py-4">
                    {closingId === job.job_posting_id
                      ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      : <StatusBadge status={job.status} />
                    }
                  </td>
                  {/* Posted */}
                  <td className="px-5 py-4">
                    <span className="text-xs text-muted-foreground">{formatDate(job.posted_at)}</span>
                  </td>
                  {/* Closes */}
                  <td className="px-5 py-4">
                    <span className="text-xs text-muted-foreground">
                      {job.closes_at ? formatDate(job.closes_at) : "—"}
                    </span>
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-4 text-right">
                    <JobRowMenu
                      job={job}
                      onViewApplicants={() => setViewApplicants(job)}
                      onClose={() => handleClosePosting(job)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {filtered.length > 0
              ? `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length}`
              : "No results"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1"
              onClick={() => setPage(p => p - 1)} disabled={page === 1 || totalPages === 0}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1"
              onClick={() => setPage(p => p + 1)} disabled={page === totalPages || totalPages === 0}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateJobModal
          onClose={() => setShowCreate(false)}
          onCreate={(job) => {
            setJobs(prev => [job, ...prev]);
            setShowCreate(false);
          }}
        />
      )}

      {viewApplicants && (
        <ApplicantsModal
          job={viewApplicants}
          onClose={() => setViewApplicants(null)}
        />
      )}
    </div>
  );
}
