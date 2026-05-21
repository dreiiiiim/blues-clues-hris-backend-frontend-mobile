"use client";

import { useEffect, useRef, useState } from "react";
import {
  Users, Clock, AlertTriangle, DollarSign,
  Plus, Check, Upload, ChevronDown, ChevronUp, RefreshCw, Paperclip,
  FileText, Target, ClipboardCheck, BadgeDollarSign,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

// ─── Types ───────────────────────────────────────────────────────────────────

type TabType = "All" | "Goals" | "Reviews" | "PIPs" | "Bonuses";

interface ApprovalItem {
  id: string;
  itemType: string;
  type: "Goal" | "Review" | "PIP" | "Bonus" | "Promotion";
  title: string;
  employee: string;
  metadata: string;
  status: "Pending" | "Approved";
}

interface Violation {
  id: string;
  employee: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  date: string;
  avatar: string;
}

interface CBOutcome {
  id: string;
  employee: string;
  type: string;
  current: string;
  amount: string;
  status: "Approved" | "Pushed" | "Pending";
  avatar: string;
}

const SEVERITY_CONFIG: Record<Violation["severity"], { bg: string; text: string }> = {
  LOW:      { bg: "bg-gray-100",   text: "text-gray-600"   },
  MEDIUM:   { bg: "bg-amber-100",  text: "text-amber-700"  },
  HIGH:     { bg: "bg-red-100",    text: "text-red-700"    },
  CRITICAL: { bg: "bg-red-100",    text: "text-red-700"    },
};

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapApproval(a: any): ApprovalItem {
  const type = (a.type ?? "Goal") as ApprovalItem["type"];
  return {
    id: a.id ?? a.perf_goals_id ?? a.perf_eval_id ?? a.perf_pip_id ?? "",
    itemType: type.toLowerCase(),
    type,
    title: a.title ?? `${type} Approval`,
    employee: a.employee ?? a.employee_name ?? "Unknown",
    metadata: a.metadata ?? "",
    status: (a.status === "Approved" || a.status === "APPROVED") ? "Approved" : "Pending",
  };
}

function ApprovalIcon({ type, className }: { type: ApprovalItem["type"]; className?: string }) {
  const Icon =
    type === "Goal" ? Target :
    type === "Review" ? FileText :
    type === "PIP" ? ClipboardCheck :
    BadgeDollarSign;

  return <Icon className={className} />;
}

function mapViolation(v: any): Violation {
  const name = v.employee ?? v.employee_name ?? "Unknown";
  return {
    id: v.id ?? v.perf_viol_id ?? Math.random().toString(),
    employee: name,
    type: v.type ?? v.violation_type ?? "Unknown",
    severity: (v.severity ?? "MEDIUM").toUpperCase() as Violation["severity"],
    date: v.date ?? (v.occured_at ? new Date(v.occured_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"),
    avatar: v.avatar ?? name.split(" ").map((n: string) => n[0] ?? "").join("").toUpperCase().slice(0, 2),
  };
}

function mapReward(r: any): CBOutcome {
  const name = r.employee ?? r.employee_name ?? "Unknown";
  return {
    id: r.id ?? r.perf_rewards_id ?? r.perf_eval_id ?? Math.random().toString(),
    employee: name,
    type: r.type ?? r.reward_type ?? "Bonus",
    current: r.current ?? (r.current_salary ? `₱${Number(r.current_salary).toLocaleString()}/mo` : "—"),
    amount: r.amount ?? (r.amount_value ? `+₱${Number(r.amount_value).toLocaleString()}` : "—"),
    status: r.status ?? (r.is_synced ? "Pushed" : "Approved"),
    avatar: r.avatar ?? name.split(" ").map((n: string) => n[0] ?? "").join("").toUpperCase().slice(0, 2),
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HROfficerPerformancePage() {
  const [activeTab, setActiveTab] = useState<TabType>("All");
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [cbOutcomes, setCbOutcomes] = useState<CBOutcome[]>([]);
  const [hrDashboard, setHrDashboard] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [reviewDocFile, setReviewDocFile] = useState<string | null>(null);
  const [reviewDocUploading, setReviewDocUploading] = useState(false);

  // Modals
  const [violationModalOpen, setViolationModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);
  const [reviewComment, setReviewComment] = useState("");

  // Violation action update
  const [violationActionId, setViolationActionId] = useState<string | null>(null);
  const [violationDisciplinaryAction, setViolationDisciplinaryAction] = useState("");

  // Violation form
  const [expandedPicker, setExpandedPicker] = useState<"employee" | "type" | "severity" | null>(null);
  const [violationForm, setViolationForm] = useState({
    employeeId: "",
    employee: "",
    type: "Attendance",
    severity: "Medium",
    description: "",
    evidenceFile: null as string | null,
  });
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  const employeeNameCounts = employees.reduce<Record<string, number>>((acc, employee) => {
    const name = `${employee.first_name} ${employee.last_name}`.trim();
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});

  const employeePickerOptions = employees.map((employee) => {
    const fullName = `${employee.first_name} ${employee.last_name}`.trim();
    const disambiguator = employee.employee_id || employee.email || employee.user_id;
    return {
      id: String(employee.user_id ?? ""),
      label: employeeNameCounts[fullName] > 1 ? `${fullName} (${disambiguator})` : fullName,
      value: fullName,
    };
  });

  const fetchApprovals = async () => {
    setApprovalsLoading(true);
    try {
      const data = await authFetch(`${API_BASE_URL}/performance/hr/approvals`).then(r => r.json());
      setApprovals(Array.isArray(data) ? data.map(mapApproval) : []);
    } catch {
      toast.error("Failed to refresh approvals");
    } finally {
      setApprovalsLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      authFetch(`${API_BASE_URL}/performance/hr/dashboard`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/hr/approvals`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/violations`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/rewards`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/timekeeping/employees`).then(r => r.json()),
    ])
      .then(([dash, approvalsData, violationsData, rewardsData, empData]) => {
        setHrDashboard(dash);
        setApprovals(Array.isArray(approvalsData) ? approvalsData.map(mapApproval) : []);
        setViolations(Array.isArray(violationsData) ? violationsData.map(mapViolation) : []);
        setCbOutcomes(Array.isArray(rewardsData) ? rewardsData.map(mapReward) : []);
        const emps = Array.isArray(empData) ? empData : [];
        setEmployees(emps);
        if (emps.length > 0) {
          setViolationForm(f => ({
            ...f,
            employeeId: String(emps[0].user_id ?? ""),
            employee: `${emps[0].first_name} ${emps[0].last_name}`,
          }));
        }
      })
      .catch(() => toast.error("Failed to load HR performance data"));
  }, []);

  const pickerOptions = {
    type: ["Tardiness", "Insubordination", "Policy Violation", "Misconduct", "Negligence", "Attendance", "Performance", "Security", "Other"],
    severity: ["Low", "Medium", "High", "Critical"],
  };

  const pendingCount = approvals.filter(a => a.status === "Pending").length;

  const filteredApprovals = approvals.filter(a => {
    if (activeTab === "All")     return true;
    if (activeTab === "Goals")   return a.type === "Goal";
    if (activeTab === "Reviews") return a.type === "Review";
    if (activeTab === "PIPs")    return a.type === "PIP";
    if (activeTab === "Bonuses") return a.type === "Bonus";
    return true;
  });

  const handleApprove = async (id: string) => {
    const item = approvals.find(a => a.id === id);
    if (!item) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/hr/approvals/${id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: "Approved" } : a));
      toast.success("Approved");
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    }
  };

  const handleOpenReview = (item: ApprovalItem) => {
    setSelectedApproval(item);
    setReviewComment("");
    setReviewDocFile(null);
    setReviewModalOpen(true);
  };

  const handleReviewDocUpload = async (file: File) => {
    setReviewDocUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await authFetch(`${API_BASE_URL}/performance/documents/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setReviewDocFile(data.url);
      toast.success("Document uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setReviewDocUploading(false);
    }
  };

  const handleSubmitReview = async (action: "Confirm" | "Reject") => {
    if (!selectedApproval) return;
    try {
      await authFetch(`${API_BASE_URL}/performance/hr/approvals/${selectedApproval.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedApproval.type, action: action === "Confirm" ? "Approve" : "Reject", comment: reviewComment, ...(reviewDocFile && { document_url: reviewDocFile }) }),
      });
      if (action === "Confirm") {
        setApprovals(prev => prev.map(a => a.id === selectedApproval.id ? { ...a, status: "Approved" } : a));
      }
      setReviewModalOpen(false);
      toast.success(action === "Confirm" ? "Signed off" : "Changes requested");
    } catch {
      toast.error("Failed to submit review");
    }
  };

  const handleEvidenceUpload = async (file: File) => {
    setEvidenceUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authFetch(`${API_BASE_URL}/performance/violations/upload-evidence`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setViolationForm(prev => ({ ...prev, evidenceFile: data.url }));
      toast.success("Evidence uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setEvidenceUploading(false);
    }
  };

  const handleLogViolation = async () => {
    if (!violationForm.description.trim()) return;
    const empEntry = employees.find(e => String(e.user_id ?? "") === violationForm.employeeId);
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/violations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: empEntry?.user_id ?? null,
          employee_name: violationForm.employee,
          severity: violationForm.severity.toUpperCase(),
          violation_type: violationForm.type,
          description: violationForm.description,
          evidence: violationForm.evidenceFile ?? "",
          occured_at: new Date().toISOString(),
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.message);
      setViolations(prev => [mapViolation({
        id: created.id,
        employee: violationForm.employee,
        type: violationForm.type,
        severity: violationForm.severity.toUpperCase(),
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        avatar: violationForm.employee.split(" ").map((n: string) => n[0] ?? "").join("").toUpperCase().slice(0, 2),
      }), ...prev]);
      setViolationModalOpen(false);
      setViolationForm({
        employeeId: employees[0] ? String(employees[0].user_id ?? "") : "",
        employee: employees[0] ? `${employees[0].first_name} ${employees[0].last_name}` : "",
        type: "Attendance",
        severity: "Medium",
        description: "",
        evidenceFile: null,
      });
      if (evidenceInputRef.current) evidenceInputRef.current.value = "";
      toast.success("Violation logged");
    } catch (err: any) {
      toast.error(err.message || "Failed to log violation");
    }
  };

  const handlePushToPayslip = async (id: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/rewards/${id}/sync`, { method: "PATCH" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      setCbOutcomes(prev => prev.map(o => o.id === id ? { ...o, status: "Pushed" } : o));
      toast.success("Pushed to payslip");
    } catch (err: any) {
      toast.error(err.message || "Failed to push to payslip");
    }
  };

  const handleApplyAll = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/rewards/sync-all`, { method: "PATCH" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      setCbOutcomes(prev => prev.map(o => ({ ...o, status: "Pushed" as const })));
      toast.success("All outcomes pushed to payroll");
    } catch (err: any) {
      toast.error(err.message || "Failed to apply all");
    }
  };

  const handleUpdatePipStatus = async (pipId: string, status: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/pip/${pipId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pip_status: status }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      toast.success(`PIP marked as ${status.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update PIP status");
    }
  };

  const handleApplyViolationAction = async () => {
    if (!violationActionId || !violationDisciplinaryAction.trim()) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/violations/${violationActionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_status: "Action Taken", disciplinary_action: violationDisciplinaryAction }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      toast.success("Disciplinary action recorded");
      setViolationActionId(null);
      setViolationDisciplinaryAction("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update violation");
    }
  };

  const selectPickerOption = (field: "employee" | "type" | "severity", val: string) => {
    setViolationForm(prev => ({ ...prev, [field]: val }));
    setExpandedPicker(null);
  };

  const selectEmployeePickerOption = (employeeId: string, employeeName: string) => {
    setViolationForm(prev => ({ ...prev, employeeId, employee: employeeName }));
    setExpandedPicker(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-primary via-primary/90 to-blue-600 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-[10px] font-bold tracking-widest uppercase text-white/70 mb-1">
              PERFORMANCE MANAGEMENT
            </p>
            <h1 className="text-2xl font-bold mb-2">Performance Overview — {hrDashboard?.cycle_name ?? "Current Cycle"}</h1>
            <p className="text-sm text-white/85 leading-relaxed max-w-lg">
              System-wide performance across {hrDashboard?.total_employees ?? "—"} employees. {pendingCount} items need your countersignature. {violations.length} total violations logged.
            </p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-center shrink-0">
            <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mb-1">PASS RATE</p>
            <p className="text-4xl font-bold text-green-400">{hrDashboard?.pass_rate ?? "—"}%</p>
            <p className="text-[10px] text-white/80 font-semibold mt-1">{hrDashboard?.cycle_name ?? "Current cycle"}</p>
          </div>
        </div>
      </div>

      {/* ── Metrics ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users,         label: "Total Employees",   value: String(hrDashboard?.total_employees ?? "—"),  sub: "system-wide",           color: "bg-primary/10 text-primary",   alert: false },
          { icon: Clock,         label: "Pending Approval",  value: String(pendingCount),                          sub: "needs your sign-off",   color: "bg-amber-50 text-amber-600",   alert: true  },
          { icon: AlertTriangle, label: "Active Violations", value: String(violations.length),                     sub: "recorded system-wide",  color: "bg-red-50 text-red-600",       alert: true  },
          { icon: DollarSign,    label: "Rewards Pending",   value: String(cbOutcomes.filter(o => o.status !== "Pushed").length), sub: "outcomes", color: "bg-green-50 text-green-600", alert: false },
        ].map(({ icon: Icon, label, value, sub, color, alert }) => (
          <Card key={label} className={`p-5 border-border ${alert ? "border-l-2 border-l-amber-400" : ""}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${color}`}><Icon className="h-4 w-4" /></div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </Card>
        ))}
      </div>

      {/* ── Approval Inbox ────────────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <p className="text-base font-bold">Approval Inbox — Performance</p>
            <button
              onClick={fetchApprovals}
              disabled={approvalsLoading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${approvalsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Countersignature queue for goals, reviews, and PIPs</p>
          <div className="flex gap-2 flex-wrap mt-4">
            {(["All", "Goals", "Reviews", "PIPs", "Bonuses"] as TabType[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors
                  ${activeTab === tab
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}>
                {tab}{tab === "All" ? ` (${pendingCount})` : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border">
          {filteredApprovals.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No approval items.</p>
          ) : filteredApprovals.map(item => (
            <div key={item.id} className="p-5 flex items-start gap-4 hover:bg-muted/20 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ApprovalIcon type={item.type} className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">
                  {item.title} — <span className="text-primary">{item.employee}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.metadata}</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {item.status === "Approved" ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-bold">
                        <Check className="h-3 w-3" /> Approved
                      </span>
                      {item.type === "PIP" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-3 text-green-700 border-green-200 hover:bg-green-50"
                            onClick={() => handleUpdatePipStatus(item.id, "COMPLETED")}>
                            Mark Complete
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-3 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleUpdatePipStatus(item.id, "TERMINATED")}>
                            Mark Terminated
                          </Button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <Button size="sm" className="h-7 text-xs px-3 bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(item.id)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-3"
                        onClick={() => handleOpenReview(item)}>
                        Review
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Violation Log ─────────────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="p-6 border-b border-border flex items-start justify-between">
          <div>
            <p className="text-base font-bold">Violation Log</p>
            <p className="text-xs text-muted-foreground mt-0.5">Recent entries — violations affect performance ratings</p>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setViolationModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Log Violation
          </Button>
        </div>

        <div className="divide-y divide-border">
          {violations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No violations logged.</p>
          ) : violations.map(v => {
            const sev = SEVERITY_CONFIG[v.severity];
            return (
              <div key={v.id} className="px-6 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {v.avatar}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">{v.employee}</p>
                  <p className="text-xs text-muted-foreground">{v.type}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide ${sev.bg} ${sev.text}`}>
                  {v.severity}
                </span>
                <span className="text-xs text-muted-foreground w-12 text-right">{v.date}</span>
                <Button size="sm" variant="outline" className="text-xs h-7 shrink-0"
                  onClick={() => { setViolationActionId(v.id); setViolationDisciplinaryAction(""); }}>
                  Action
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── C&B Outcome Processing ────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <p className="text-base font-bold">C&amp;B Outcome Processing</p>
          <p className="text-xs text-muted-foreground mt-0.5">Approved bonuses and merit increases ready to push to payroll</p>
        </div>

        {cbOutcomes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No reward outcomes yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {cbOutcomes.map(o => (
              <div key={o.id} className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-bold text-sm shrink-0">
                    {o.avatar}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{o.employee}</p>
                    <p className="text-xs text-muted-foreground">{o.type}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border
                    ${o.status === "Approved" ? "bg-green-50 text-green-700 border-green-200"
                    : o.status === "Pushed"   ? "bg-primary/10 text-primary border-primary/20"
                    :                           "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    {o.status}
                  </span>
                </div>
                <div className="flex gap-8 mb-3 px-1">
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-1">CURRENT SALARY</p>
                    <p className="text-sm font-bold">{o.current}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-1">AMOUNT</p>
                    <p className="text-sm font-bold text-green-600">{o.amount}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={o.status === "Approved" ? "default" : "outline"}
                  className="w-full text-xs"
                  disabled={o.status === "Pushed"}
                  onClick={() => handlePushToPayslip(o.id)}
                >
                  {o.status === "Approved" ? "Push to Payslip"
                  : o.status === "Pushed"  ? "In Payroll Record"
                  :                          "Review Outcome"}
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="p-5 border-t border-border">
          <Button className="w-full gap-2" onClick={handleApplyAll}>
            <Upload className="h-4 w-4" />
            Apply All to Salary Records
          </Button>
        </div>
      </Card>

      {/* ── Violation Action Modal ───────────────────────────── */}
      <Dialog open={!!violationActionId} onOpenChange={open => { if (!open) setViolationActionId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply Disciplinary Action</DialogTitle>
            <p className="text-xs text-muted-foreground">Record the action taken on this violation</p>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Disciplinary Action *</label>
              <Textarea
                value={violationDisciplinaryAction}
                onChange={e => setViolationDisciplinaryAction(e.target.value)}
                placeholder="e.g. Written warning issued, suspension pending..."
                className="resize-none h-24"
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleApplyViolationAction} disabled={!violationDisciplinaryAction.trim()}>
                Save Action
              </Button>
              <Button variant="outline" onClick={() => setViolationActionId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Log Violation Modal ───────────────────────────────── */}
      <Dialog open={violationModalOpen} onOpenChange={setViolationModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log New Violation</DialogTitle>
            <p className="text-xs text-muted-foreground">Record policy or behavioral breaches</p>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Employee picker */}
            <div className="relative">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Select Employee</label>
              <button
                onClick={() => setExpandedPicker(expandedPicker === "employee" ? null : "employee")}
                className="w-full flex items-center justify-between px-3 h-10 bg-muted/30 border border-border rounded-lg text-sm font-semibold">
                {violationForm.employee || "Select employee"}
                {expandedPicker === "employee" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedPicker === "employee" && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {employeePickerOptions.map((opt) => (
                    <button key={opt.id} onClick={() => selectEmployeePickerOption(opt.id, opt.value)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 text-sm border-b border-border last:border-0">
                      <span className={violationForm.employeeId === opt.id ? "text-primary font-bold" : "text-foreground"}>{opt.label}</span>
                      {violationForm.employeeId === opt.id && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type + Severity row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Violation Type</label>
                <button
                  onClick={() => setExpandedPicker(expandedPicker === "type" ? null : "type")}
                  className="w-full flex items-center justify-between px-3 h-10 bg-muted/30 border border-border rounded-lg text-sm font-semibold">
                  {violationForm.type}
                  {expandedPicker === "type" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {expandedPicker === "type" && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
                    {pickerOptions.type.map(opt => (
                      <button key={opt} onClick={() => selectPickerOption("type", opt)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 text-sm border-b border-border last:border-0">
                        <span className={violationForm.type === opt ? "text-primary font-bold" : "text-foreground"}>{opt}</span>
                        {violationForm.type === opt && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Severity</label>
                <button
                  onClick={() => setExpandedPicker(expandedPicker === "severity" ? null : "severity")}
                  className="w-full flex items-center justify-between px-3 h-10 bg-muted/30 border border-border rounded-lg text-sm font-semibold">
                  {violationForm.severity}
                  {expandedPicker === "severity" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {expandedPicker === "severity" && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
                    {pickerOptions.severity.map(opt => (
                      <button key={opt} onClick={() => selectPickerOption("severity", opt)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 text-sm border-b border-border last:border-0">
                        <span className={violationForm.severity === opt ? "text-primary font-bold" : "text-foreground"}>{opt}</span>
                        {violationForm.severity === opt && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Description</label>
              <Textarea
                value={violationForm.description}
                onChange={e => setViolationForm({ ...violationForm, description: e.target.value })}
                placeholder="Enter violation details..."
                className="resize-none h-24"
              />
            </div>

            {/* Evidence upload */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Supporting Evidence</label>
              <input
                ref={evidenceInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleEvidenceUpload(f); }}
              />
              <button
                type="button"
                disabled={evidenceUploading}
                onClick={() => evidenceInputRef.current?.click()}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-colors disabled:opacity-60
                  ${violationForm.evidenceFile
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-muted/20 text-muted-foreground hover:border-primary/50"}`}
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold truncate max-w-[220px]">
                  {evidenceUploading
                    ? "Uploading…"
                    : violationForm.evidenceFile
                      ? violationForm.evidenceFile.split("/").pop()
                      : "Upload Image, PDF or Document"}
                </span>
                {violationForm.evidenceFile && !evidenceUploading && <Check className="h-4 w-4 ml-auto shrink-0" />}
              </button>
            </div>

            <Button
              className="w-full"
              onClick={handleLogViolation}
              disabled={!violationForm.description.trim()}
            >
              Submit Violation Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Review Item Modal ─────────────────────────────────── */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Item Review</DialogTitle>
            <p className="text-xs text-muted-foreground">Perform countersignature or request corrections</p>
          </DialogHeader>

          {selectedApproval && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/20 rounded-xl p-4 border border-border">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <ApprovalIcon type={selectedApproval.type} className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{selectedApproval.type}</p>
                    <p className="text-base font-bold">{selectedApproval.title}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="border-b border-border pb-3">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-1">EMPLOYEE</p>
                    <p className="text-sm font-bold">{selectedApproval.employee}</p>
                  </div>
                  <div className="border-b border-border pb-3">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-1">SUBMISSION INFO</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{selectedApproval.metadata}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-1">STATUS</p>
                    <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                      {selectedApproval.status}
                    </span>
                  </div>
                </div>
              </div>

              {(selectedApproval.type === "Review" || selectedApproval.type === "PIP") && (
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
                    Signed Document <span className="text-muted-foreground/60 font-normal normal-case">(optional)</span>
                  </label>
                  <label className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg cursor-pointer transition-colors
                    ${reviewDocFile ? "border-primary/40 bg-primary/5 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"}`}>
                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-xs flex-1">
                      {reviewDocUploading ? "Uploading..." : reviewDocFile ? reviewDocFile.split("/").pop() : "Attach signed form (PDF, image — max 20 MB)"}
                    </span>
                    <input type="file" accept=".pdf,image/*,.doc,.docx" className="sr-only"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleReviewDocUpload(f); }} />
                  </label>
                  {reviewDocFile && (
                    <div className="flex items-center justify-between mt-1">
                      <a href={reviewDocFile} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline">
                        View uploaded document ↗
                      </a>
                      <button onClick={() => setReviewDocFile(null)} className="text-[10px] text-red-500 hover:underline">Remove</button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Reviewer Comments</label>
                <Textarea
                  placeholder="Add your notes or feedback here..."
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  className="resize-none h-24"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => handleSubmitReview("Reject")}>
                  Request Changes
                </Button>
                <Button onClick={() => handleSubmitReview("Confirm")}>
                  Confirm &amp; Sign-off
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
