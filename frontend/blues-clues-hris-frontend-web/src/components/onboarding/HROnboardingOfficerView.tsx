"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, Users, FileCheck, ListChecks, Package, Search, Calendar, TrendingUp, Download, MessageSquare, CheckCircle, XCircle, FileText, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { OnboardingStatus, ItemStatus, OnboardingSessionSummary, OnboardingSession, Remark } from "@/types/onboarding.types";
import { getAllSessions, getSessionById, updateItemStatus, addRemark, approveSession, rejectSession, updateSessionDeadline } from "@/lib/onboardingApi";
import { toast } from "sonner";

function RemarkSection({
  remarks,
  value,
  onChange,
  onAdd,
  inputId,
}: {
  remarks: Remark[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  inputId: string;
}) {
  return (
    <div className="mt-6 pt-5 border-t border-slate-100">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="size-3.5 text-slate-400 shrink-0" />
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">HR Remarks</p>
        {remarks.length > 0 && (
          <span className="ml-1 text-[10px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 rounded-full px-1.5 py-0.5">{remarks.length}</span>
        )}
      </div>
      <div className="space-y-2 mb-3">
        {remarks.length > 0 ? (
          remarks.map((r) => (
            <div key={r.remark_id} className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-800">{r.author}</span>
                <span className="text-[10px] text-slate-400 tabular-nums">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{r.remark_text}</p>
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-400 italic py-1">No remarks added yet.</p>
        )}
      </div>
      <div className="flex gap-2">
        <Textarea
          id={inputId}
          placeholder="Add a remark..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="resize-none text-sm bg-white border-slate-200 rounded-xl focus-visible:ring-1 focus-visible:ring-zinc-400"
        />
        <Button
          size="sm"
          className="self-end shrink-0 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-all active:scale-[0.98]"
          onClick={onAdd}
          disabled={!value.trim()}
        >
          <MessageSquare className="size-3.5 mr-1.5" />Add
        </Button>
      </div>
    </div>
  );
}
export default function HROnboardingOfficerView() {
  const [sessions, setSessions] = useState<OnboardingSessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<OnboardingSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [changingItems, setChangingItems] = useState<Set<string>>(new Set());
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    confirmClass: string;
    onConfirm: () => void;
  } | null>(null);
  const [pendingReject, setPendingReject] = useState<{
    itemId: string;
    itemTitle?: string;
    onConfirm: (reason: string) => void;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pendingSessionReject, setPendingSessionReject] = useState(false);
  const [sessionRejectReason, setSessionRejectReason] = useState("");
  const [approvingSession, setApprovingSession] = useState(false);
  const [rejectingSession, setRejectingSession] = useState(false);

  const enterChangeMode = (id: string) => setChangingItems(prev => new Set(prev).add(id));
  const exitChangeMode  = (id: string) => setChangingItems(prev => { const s = new Set(prev); s.delete(id); return s; });
  const setItemUpdating = (id: string, isUpdating: boolean) =>
    setUpdatingItems(prev => {
      const next = new Set(prev);
      if (isUpdating) next.add(id);
      else next.delete(id);
      return next;
    });

  const mergeSessionIntoSummary = (session: OnboardingSession) => {
    setSessions(prev =>
      prev.map(s =>
        s.session_id === session.session_id
          ? {
              ...s,
              account_id: session.account_id,
              template_id: session.template_id,
              template_name: session.template_name,
              employee_name: session.employee_name,
              assigned_position: session.assigned_position,
              assigned_department: session.assigned_department,
              status: session.status,
              progress_percentage: session.progress_percentage,
              deadline_date: session.deadline_date,
              completed_at: session.completed_at,
            }
          : s,
      ),
    );
  };

  const refreshSessionsList = async (silent = true) => {
    try {
      const updated = await getAllSessions();
      setSessions(updated);
    } catch (err) {
      console.error(err);
      if (!silent) toast.error("Failed to refresh onboarding sessions.");
    }
  };

  useEffect(() => {
    void refreshSessionsList(false);
  }, []);

  const refreshSession = async (sessionId: string) => {
    const updatedSession = await getSessionById(sessionId);
    setSelectedSession(updatedSession);
    mergeSessionIntoSummary(updatedSession);
    return updatedSession;
  };

  const applyLocalItemStatus = (onboardingItemId: string, status: ItemStatus) => {
    setSelectedSession(prev => {
      if (!prev) return prev;
      const patch = <T extends { onboarding_item_id: string; status: ItemStatus }>(items: T[]) =>
        items.map(item =>
          item.onboarding_item_id === onboardingItemId
            ? { ...item, status }
            : item,
        );

      return {
        ...prev,
        profile_items: patch(prev.profile_items),
        documents: patch(prev.documents),
        hr_forms: patch(prev.hr_forms),
        tasks: patch(prev.tasks),
        equipment: patch(prev.equipment),
      };
    });
  };

  const handleViewSession = async (summary: OnboardingSessionSummary) => {
    setLoadingSession(true);
    setEditingDeadline(false);
    try {
      const full = await getSessionById(summary.session_id);
      setSelectedSession(full);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleApprove = async (onboardingItemId: string) => {
    if (!selectedSession) return;
    if (updatingItems.has(onboardingItemId)) return;
    const sessionId = selectedSession.session_id;
    setItemUpdating(onboardingItemId, true);
    applyLocalItemStatus(onboardingItemId, "approved");
    try {
      await updateItemStatus(onboardingItemId, "approved");
      await refreshSession(sessionId);
      toast.success("Item approved.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to approve item.");
      await refreshSession(sessionId);
    } finally {
      setItemUpdating(onboardingItemId, false);
    }
  };

  const handleReject = async (onboardingItemId: string, reason: string) => {
    if (!selectedSession) return;
    if (updatingItems.has(onboardingItemId)) return;
    const sessionId = selectedSession.session_id;
    setItemUpdating(onboardingItemId, true);
    applyLocalItemStatus(onboardingItemId, "rejected");
    try {
      await updateItemStatus(onboardingItemId, "rejected", reason);
      await refreshSession(sessionId);
      toast.success("Item rejected.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to reject item.");
      await refreshSession(sessionId);
    } finally {
      setItemUpdating(onboardingItemId, false);
    }
  };

  const handleIssue = async (onboardingItemId: string) => {
    if (!selectedSession) return;
    if (updatingItems.has(onboardingItemId)) return;
    const sessionId = selectedSession.session_id;
    setItemUpdating(onboardingItemId, true);
    applyLocalItemStatus(onboardingItemId, "issued");
    try {
      await updateItemStatus(onboardingItemId, "issued");
      await refreshSession(sessionId);
      toast.success("Item issued.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to issue item.");
      await refreshSession(sessionId);
    } finally {
      setItemUpdating(onboardingItemId, false);
    }
  };

  const handleAddRemark = async (tabTag: "Documents" | "Tasks" | "Equipment" | "Profile" | "Forms") => {
    if (!selectedSession || !remarks[tabTag]?.trim()) return;
    try {
      await addRemark(selectedSession.session_id, tabTag, remarks[tabTag].trim());
      setRemarks(prev => ({ ...prev, [tabTag]: "" }));
      await refreshSession(selectedSession.session_id);
      toast.success("Remark added.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to add remark.");
    }
  };

  const handleUpdateDeadline = async () => {
    if (!selectedSession || !deadlineInput) return;
    try {
      await updateSessionDeadline(selectedSession.session_id, deadlineInput);
      setEditingDeadline(false);
      await refreshSession(selectedSession.session_id);
      toast.success("Deadline updated.");
      void refreshSessionsList(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update deadline.");
    }
  };

  const getSessionApprovalBlockReason = (session: OnboardingSession | null): string | null => {
    if (!session) return "No session selected.";

    const pendingTasks = (session.tasks ?? []).filter(
      (task) => !["approved", "confirmed"].includes(task.status),
    );
    if (pendingTasks.length > 0) {
      return `Approve all tasks first (${pendingTasks.length} pending).`;
    }

    const pendingEquipment = (session.equipment ?? []).filter(
      (equip) => !["issued", "approved"].includes(equip.status),
    );
    if (pendingEquipment.length > 0) {
      return `Issue/approve all equipment first (${pendingEquipment.length} pending).`;
    }

    return null;
  };

  const approvalBlockReason = getSessionApprovalBlockReason(selectedSession);
  const canApproveSelectedSession =
    !!selectedSession &&
    selectedSession.status === "for-review" &&
    !approvalBlockReason;

  const handleApproveSession = async () => {
    if (!selectedSession) return;
    if (approvingSession) return;
    if (selectedSession.status !== "for-review") {
      toast.error("Only sessions in For Review can be approved.");
      return;
    }
    const blockReason = getSessionApprovalBlockReason(selectedSession);
    if (blockReason) {
      toast.error(blockReason);
      return;
    }
    setApprovingSession(true);
    try {
      await approveSession(selectedSession.session_id);
      await refreshSession(selectedSession.session_id);
      toast.success("Onboarding session approved.");
      void refreshSessionsList(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to approve onboarding session.");
    } finally {
      setApprovingSession(false);
    }
  };

  const handleRejectSession = async () => {
    if (!selectedSession) return;
    if (rejectingSession) return;
    if (selectedSession.status !== "for-review") {
      toast.error("Only sessions in For Review can be rejected.");
      return;
    }
    const reason = sessionRejectReason.trim();
    if (!reason) {
      toast.error("Rejection reason is required.");
      return;
    }
    setRejectingSession(true);
    try {
      await rejectSession(selectedSession.session_id, reason);
      setPendingSessionReject(false);
      setSessionRejectReason("");
      await refreshSession(selectedSession.session_id);
      toast.success("Onboarding session sent back for corrections.");
      void refreshSessionsList(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to reject onboarding session.");
    } finally {
      setRejectingSession(false);
    }
  };

  /** Renders approve/reject action row with smart decided-state UX */
  const renderItemActions = (
    itemId: string,
    status: ItemStatus,
    onApprove: () => void,
    issueMode?: { onIssue: () => void; issueLabel?: string },
    itemTitle?: string,
  ) => {
    const isDecided = status === "approved" || status === "rejected" || status === "issued";
    const inChangeMode = changingItems.has(itemId);
    const isUpdating = updatingItems.has(itemId);

    if (status === "pending") return null;

    if (isDecided && !inChangeMode) {
      const pill =
        status === "approved" ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />Approved
          </span>
        ) : status === "issued" ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-800 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-0.5">
            <span className="size-1.5 rounded-full bg-violet-500 shrink-0" />Issued
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
            <span className="size-1.5 rounded-full bg-red-500 shrink-0" />Rejected
          </span>
        );
      return (
        <div className="flex items-center gap-2">
          {pill}
          <button
            className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 cursor-pointer transition-colors"
            onClick={() => enterChangeMode(itemId)}
          >
            Change
          </button>
        </div>
      );
    }

    const confirmApprove = () => {
      setPendingConfirm({
        title: itemTitle ? `Approve "${itemTitle}"?` : "Approve this item?",
        description: "Once approved, this item counts toward the applicant's stage completion. The applicant moves to the next stage only after all required items in this stage are approved.",
        confirmLabel: "Approve",
        confirmClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
        onConfirm: () => { onApprove(); exitChangeMode(itemId); },
      });
    };

    const confirmReject = () => {
      setRejectReason("");
      setPendingReject({
        itemId,
        itemTitle,
        onConfirm: (reason: string) => {
          handleReject(itemId, reason);
          exitChangeMode(itemId);
        },
      });
    };

    const confirmIssue = (label: string, handler: () => void) => {
      setPendingConfirm({
        title: itemTitle ? `Issue "${itemTitle}"?` : "Issue this equipment?",
        description: "This marks the equipment as issued to the applicant. The applicant will be able to upload proof of receipt.",
        confirmLabel: label,
        confirmClass: "bg-purple-600 hover:bg-purple-700 text-white",
        onConfirm: () => { handler(); exitChangeMode(itemId); },
      });
    };

    // Undecided (submitted/confirmed/for-review) or in change mode
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all active:scale-[0.97]"
          onClick={confirmReject}
          disabled={isUpdating}>
          {isUpdating ? "Working..." : <><XCircle className="size-3.5 mr-1" />Reject</>}
        </Button>
        {issueMode ? (
          <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-500 text-white transition-all active:scale-[0.97]"
            onClick={() => confirmIssue(issueMode.issueLabel ?? "Issue", issueMode.onIssue)}
            disabled={isUpdating}>
            {isUpdating ? "Working..." : <><CheckCircle className="size-3.5 mr-1" />{issueMode.issueLabel ?? "Issue"}</>}
          </Button>
        ) : (
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-[0.97]"
            onClick={confirmApprove}
            disabled={isUpdating}>
            {isUpdating ? "Working..." : <><CheckCircle className="size-3.5 mr-1" />Approve</>}
          </Button>
        )}
        {inChangeMode && (
          <button className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors" onClick={() => exitChangeMode(itemId)}>
            Cancel
          </button>
        )}
      </div>
    );
  };

  const getItemStatusBadge = (status: ItemStatus) => {
    const config: Record<string, { label: string; dot: string; className: string }> = {
      "pending":    { label: "Pending",    dot: "bg-slate-400",   className: "text-slate-500 border-slate-200 bg-white" },
      "submitted":  { label: "Submitted",  dot: "bg-slate-700",   className: "text-slate-700 border-slate-300 bg-slate-50" },
      "for-review": { label: "For Review", dot: "bg-amber-500",   className: "text-amber-800 border-amber-200 bg-amber-50" },
      "approved":   { label: "Approved",   dot: "bg-emerald-500", className: "text-emerald-800 border-emerald-200 bg-emerald-50" },
      "rejected":   { label: "Rejected",   dot: "bg-red-500",     className: "text-red-700 border-red-200 bg-red-50" },
      "issued":     { label: "Issued",     dot: "bg-violet-500",  className: "text-violet-800 border-violet-200 bg-violet-50" },
      "confirmed":  { label: "Confirmed",  dot: "bg-green-500",   className: "text-green-800 border-green-200 bg-green-50" },
    };
    const cfg = config[status] ?? { label: status, dot: "bg-slate-400", className: "" };
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold border rounded-full px-2.5 py-0.5 ${cfg.className}`}>
        <span className={`size-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  };

  const getItemCardClass = (status: ItemStatus) => {
    const accents: Record<ItemStatus, string> = {
      "pending":    "border-l-slate-200",
      "submitted":  "border-l-slate-500",
      "for-review": "border-l-amber-400",
      "approved":   "border-l-emerald-500",
      "rejected":   "border-l-red-400",
      "issued":     "border-l-violet-500",
      "confirmed":  "border-l-emerald-500",
    };
    return `rounded-xl border border-slate-200/80 border-l-4 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-200 ${accents[status] ?? "border-l-slate-200"}`;
  };

  const getStatusBadge = (status: OnboardingStatus, darkBg = false) => {
    if (darkBg) {
      const dark: Record<OnboardingStatus, { label: string; className: string }> = {
        "not-started": { label: "Not Started", className: "bg-white/10 text-white/90 border-white/30" },
        "in-progress": { label: "In Progress", className: "bg-blue-500/20 text-blue-100 border-blue-400/40" },
        "for-review":  { label: "For Review",  className: "bg-amber-500/20 text-amber-100 border-amber-400/40" },
        "approved":    { label: "Approved",    className: "bg-teal-500/20 text-teal-100 border-teal-400/40" },
        "overdue":     { label: "Overdue",     className: "bg-red-500/20 text-red-100 border-red-400/40" },
      };
      const { label, className } = dark[status];
      return <Badge variant="outline" className={className}>{label}</Badge>;
    }
    const light: Record<OnboardingStatus, { label: string; className: string }> = {
      "not-started": { label: "Not Started", className: "bg-slate-100 text-slate-600 border-slate-200" },
      "in-progress": { label: "In Progress", className: "bg-blue-100 text-blue-800 border-blue-200" },
      "for-review":  { label: "For Review",  className: "bg-amber-100 text-amber-800 border-amber-200" },
      "approved":    { label: "Approved",    className: "bg-teal-100 text-teal-800 border-teal-200" },
      "overdue":     { label: "Overdue",     className: "bg-red-100 text-red-700 border-red-200" },
    };
    const { label, className } = light[status];
    return <Badge variant="outline" className={className}>{label}</Badge>;
  };

  const getDeadlineColor = (deadlineDate: string, status: OnboardingStatus) => {
    if (status === "approved") return "text-green-600";
    const daysLeft = Math.ceil((new Date(deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return "text-red-600 font-semibold";
    if (daysLeft <= 2) return "text-orange-600 font-semibold";
    return "text-slate-600";
  };

  const filteredSessions = sessions.filter((s) => {
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesDepartment = departmentFilter === "all" || s.assigned_department === departmentFilter;
    const matchesSearch =
      (s.employee_name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.assigned_position.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesDepartment && matchesSearch;
  });

  const totalEmployees = sessions.length;
  const inProgressCount = sessions.filter(s => s.status === "in-progress").length;
  const forReviewCount = sessions.filter(s => s.status === "for-review").length;
  const overdueCount = sessions.filter(s => s.status === "overdue").length;
  const avgProgress = totalEmployees > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.progress_percentage, 0) / totalEmployees)
    : 0;

  const departments = Array.from(new Set(sessions.map(s => s.assigned_department)));

  return (
    <div className="space-y-6">
        {/* Onboarding Overview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-0 flex-wrap divide-x divide-slate-200">
            <div className="flex items-center gap-3 pr-6">
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Users className="size-4 text-slate-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 leading-none tabular-nums">{totalEmployees}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">Total</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-6">
              <div className="size-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <TrendingUp className="size-4 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 leading-none tabular-nums">{inProgressCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">In Progress</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-6">
              <div className="size-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <FileCheck className="size-4 text-amber-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 leading-none tabular-nums">{forReviewCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">For Review</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pl-6">
              <div className="size-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <ListChecks className="size-4 text-emerald-500" />
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-900 leading-none tabular-nums">{avgProgress}%</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">Avg Progress</p>
                </div>
                <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${avgProgress}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {(overdueCount > 0 || forReviewCount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {overdueCount > 0 && (
              <Card className="border-red-100 bg-red-50/60 shadow-sm">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                      <Calendar className="size-4 text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-red-800">{overdueCount} Overdue Employee{overdueCount > 1 ? "s" : ""}</p>
                      <p className="text-xs text-red-600/80 mt-0.5">Requires immediate attention</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {forReviewCount > 0 && (
              <Card className="border-amber-100 bg-amber-50/60 shadow-sm">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <FileCheck className="size-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-amber-800">{forReviewCount} Pending Review</p>
                      <p className="text-xs text-amber-600/80 mt-0.5">Waiting for your approval</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Employee Overview Table */}
        <Card>
          <CardHeader>
            <CardTitle>New Hires in Onboarding</CardTitle>
            <div className="flex flex-col md:flex-row gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-45">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="not-started">Not Started</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="for-review">For Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full md:w-45">
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => {
                  const daysLeft = Math.ceil((new Date(session.deadline_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <TableRow key={session.session_id}>
                      <TableCell className="font-medium">{session.employee_name ?? "-"}</TableCell>
                      <TableCell>{session.assigned_position}</TableCell>
                      <TableCell>{session.assigned_department}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={session.progress_percentage} className="w-20 h-1.5" />
                          <span className="text-xs text-slate-600 tabular-nums">{session.progress_percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell>
                        <div className={getDeadlineColor(session.deadline_date, session.status)}>
                          {new Date(session.deadline_date).toLocaleDateString()}
                          {session.status !== "approved" && (() => {
                            const absDays = Math.abs(daysLeft);
                            const label = daysLeft >= 0
                              ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                              : `${absDays} day${absDays === 1 ? "" : "s"} overdue`;
                            return <div className="text-xs">{label}</div>;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewSession(session)}
                          disabled={loadingSession}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredSessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      No employees found matching your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      {/* Employee Detail Modal - Redesigned */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="sm:max-w-4xl lg:max-w-5xl max-w-[96vw] w-full p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border-zinc-200/60 shadow-2xl shadow-zinc-950/20">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedSession?.employee_name ?? "Onboarding"} - Onboarding Details</DialogTitle>
            <DialogDescription>Review and manage onboarding checklist items</DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="flex flex-col overflow-hidden" style={{ maxHeight: "88vh" }}>

              {/* -- HERO HEADER -- */}
              <div className="relative bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 pt-6 pb-5 shrink-0 overflow-hidden rounded-t-2xl">
                {/* Subtle dot mesh */}
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.035) 1px, transparent 0)', backgroundSize: '22px 22px' }} />
                <div className="absolute -top-16 -right-8 w-64 h-64 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 left-20 w-48 h-48 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />

                {/* Identity row */}
                <div className="flex items-start justify-between gap-4 relative">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="size-12 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-600 flex items-center justify-center font-bold text-lg text-white shrink-0 shadow-lg shadow-blue-950/60 ring-2 ring-white/10">
                      {selectedSession.employee_name?.charAt(0).toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-white font-semibold text-[17px] leading-snug tracking-tight truncate">{selectedSession.employee_name ?? "-"}</h2>
                      <p className="text-zinc-400 text-xs mt-0.5 truncate">{selectedSession.assigned_position}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-medium text-blue-200/60 bg-white/8 border border-white/10 rounded px-1.5 py-0.5 tracking-wide">{selectedSession.assigned_department}</span>
                        {selectedSession.template_name && (
                          <span className="text-[10px] font-medium text-blue-200/60 bg-white/8 border border-white/10 rounded px-1.5 py-0.5 tracking-wide truncate max-w-[12rem]">{selectedSession.template_name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-start">
                    {selectedSession.status === "for-review" && (
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 h-8 text-xs font-semibold"
                            disabled={approvingSession || rejectingSession}
                            onClick={() => {
                              setSessionRejectReason("");
                              setPendingSessionReject(true);
                            }}
                          >
                            <XCircle className="size-3.5 mr-1.5" />Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white h-8 text-xs font-semibold shadow-lg shadow-emerald-950/40 transition-all duration-150 active:scale-[0.98]"
                            onClick={handleApproveSession}
                            disabled={!canApproveSelectedSession || approvingSession || rejectingSession}
                            title={!canApproveSelectedSession ? (approvalBlockReason ?? "Complete tasks and equipment first.") : undefined}
                          >
                            <CheckCircle className="size-3.5 mr-1.5" />{approvingSession ? "Approving..." : "Approve"}
                          </Button>
                        </div>
                        {!canApproveSelectedSession && approvalBlockReason && (
                          <span className="text-[10px] text-amber-400/70 max-w-[13rem] text-right leading-tight">
                            {approvalBlockReason}
                          </span>
                        )}
                      </div>
                    )}
                    {selectedSession.status === "approved" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-900/30 border border-emerald-700/40 rounded-full px-3 py-1">
                        <CheckCircle className="size-3.5" />Approved
                      </span>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-white/10 relative">
                  {getStatusBadge(selectedSession.status, true)}

                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-500 transition-all duration-500 ease-out" style={{ width: `${selectedSession.progress_percentage}%` }} />
                    </div>
                    <span className="text-xs font-mono text-zinc-400 tabular-nums">{selectedSession.progress_percentage}%</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-zinc-600 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Deadline</span>
                    {editingDeadline ? (
                      <span className="flex items-center gap-1.5">
                        <Input type="date" value={deadlineInput} onChange={(e) => setDeadlineInput(e.target.value)}
                          className="h-6 text-xs bg-white/10 border-white/20 text-white px-2 py-0 w-32 rounded" />
                        <button className="text-blue-400 hover:text-blue-300 text-xs cursor-pointer transition-colors" onClick={handleUpdateDeadline}>Save</button>
                        <button className="text-zinc-600 hover:text-zinc-400 text-xs cursor-pointer transition-colors" onClick={() => setEditingDeadline(false)}>Cancel</button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-400">{new Date(selectedSession.deadline_date).toLocaleDateString()}</span>
                        {selectedSession.status !== "approved" && (
                          <button className="text-blue-500 hover:text-blue-400 text-xs cursor-pointer transition-colors"
                            onClick={() => { setDeadlineInput(selectedSession.deadline_date.slice(0, 10)); setEditingDeadline(true); }}>
                            Edit
                          </button>
                        )}
                      </span>
                    )}
                  </div>

                  {selectedSession.status === "overdue" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-300 bg-red-900/20 border border-red-800/30 rounded-full px-2.5 py-0.5">
                      <AlertCircle className="size-3" />Overdue
                    </span>
                  )}
                </div>
              </div>

              {/* -- TABS -- */}
              <Tabs defaultValue="profile" className="flex flex-col flex-1 overflow-hidden">
                {/* Tab bar */}
                <div className="bg-white border-b border-slate-200 shrink-0 px-1">
                  <TabsList className="flex h-11 gap-0 p-0 bg-transparent rounded-none w-full overflow-x-auto shadow-none">
                    {([
                      { value: "profile",   icon: Users,       label: "Profile"   },
                      { value: "documents", icon: FileCheck,   label: "Documents" },
                      { value: "forms",     icon: FileText,    label: "HR Forms"  },
                      { value: "tasks",     icon: ListChecks,  label: "Tasks"     },
                      { value: "equipment", icon: Package,     label: "Equipment" },
                    ] as const).map(({ value, icon: Icon, label }) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="flex items-center justify-center gap-1.5 px-4 h-full text-xs font-medium !rounded-none !border-t-0 !border-x-0 border-b-2 border-b-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50/60 data-[state=active]:text-zinc-900 data-[state=active]:border-b-zinc-900 data-[state=active]:font-semibold data-[state=active]:!bg-transparent !shadow-none transition-all duration-150 whitespace-nowrap !outline-none"
                      >
                        <Icon className="size-3.5 shrink-0" />{label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                  {/* Scrollable tab bodies */}
                  <div className="flex-1 overflow-y-auto">

                    {/* -- PROFILE TAB -- */}
                    <TabsContent value="profile" className="mt-0 p-6 space-y-4">
                      {selectedSession.profile ? (() => {
                        const profileItem = selectedSession.profile_items?.[0];
                        const profileItemStatus = profileItem?.status;
                        const contacts = selectedSession.profile!.emergency_contacts?.length
                          ? selectedSession.profile!.emergency_contacts
                          : selectedSession.profile!.contact_name
                            ? [{ contact_name: selectedSession.profile!.contact_name, relationship: selectedSession.profile!.relationship, emergency_phone_number: selectedSession.profile!.emergency_phone_number, emergency_email_address: selectedSession.profile!.emergency_email_address }]
                            : [];
                        return (
                          <div className="space-y-4">
                            {/* Action bar */}
                            {profileItem && profileItemStatus !== "pending" && (
                              <div className="bg-white rounded-xl border border-slate-200/80 px-4 py-3 flex items-center gap-3 flex-wrap shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                                {(profileItemStatus === "submitted" || profileItemStatus === "confirmed" || profileItemStatus === "for-review") &&
                                  !changingItems.has(profileItem.onboarding_item_id) && (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                                    <span className="size-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />Awaiting review
                                  </span>
                                )}
                                {renderItemActions(
                                  profileItem.onboarding_item_id,
                                  profileItemStatus!,
                                  () => handleApprove(profileItem.onboarding_item_id),
                                  undefined,
                                  profileItem.title,
                                )}
                              </div>
                            )}

                            {/* Personal Info */}
                            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-4">Personal Information</p>
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                                {[
                                  { label: "Full Name", value: `${selectedSession.profile!.first_name ?? ""} ${selectedSession.profile!.middle_name ? selectedSession.profile!.middle_name + " " : ""}${selectedSession.profile!.last_name ?? ""}`.trim() },
                                  { label: "Email", value: selectedSession.profile!.email_address, breakAll: true },
                                  { label: "Phone", value: selectedSession.profile!.phone_number },
                                  { label: "Date of Birth", value: selectedSession.profile!.date_of_birth },
                                  { label: "Place of Birth", value: selectedSession.profile!.place_of_birth },
                                  { label: "Civil Status", value: selectedSession.profile!.civil_status },
                                  { label: "Nationality", value: selectedSession.profile!.nationality },
                                  { label: "Address", value: selectedSession.profile!.complete_address, wide: true },
                                ].map(({ label, value, breakAll, wide }) => (
                                  <div key={label} className={`min-w-0 ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">{label}</p>
                                    <p className={`text-sm text-slate-800 leading-snug ${breakAll ? "break-all" : ""}`}>{value || "-"}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Emergency Contacts */}
                            {contacts.length > 0 && (
                              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-4">Emergency Contacts</p>
                                <div className="space-y-4">
                                  {contacts.map((c, i) => (
                                    <div key={i} className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Name</p>
                                        <p className="text-sm text-slate-800">{c.contact_name || "-"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Relationship</p>
                                        <p className="text-sm text-slate-800">{c.relationship || "-"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Phone</p>
                                        <p className="text-sm text-slate-800">{c.emergency_phone_number || "-"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Email</p>
                                        <p className="text-sm text-slate-800 break-all">{c.emergency_email_address || "-"}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        <div className="flex flex-col items-center justify-center py-14 text-slate-400">
                          <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                            <Users className="size-5 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600">No profile submitted yet</p>
                          <p className="text-xs text-slate-400 mt-1">The applicant has not completed their profile</p>
                        </div>
                      )}

                      <RemarkSection
                        remarks={selectedSession.remarks.filter(r => r.tab_tag === "Profile")}
                        value={remarks["Profile"] || ""}
                        onChange={(v) => setRemarks(prev => ({ ...prev, Profile: v }))}
                        onAdd={() => handleAddRemark("Profile")}
                        inputId="remark-profile"
                      />
                    </TabsContent>

                    {/* -- DOCUMENTS TAB -- */}
                    <TabsContent value="documents" className="mt-0 p-6 space-y-3">
                      {selectedSession.documents.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-14 text-slate-400">
                          <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                            <FileCheck className="size-5 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600">No documents assigned</p>
                          <p className="text-xs text-slate-400 mt-1">Documents will appear once added to the template</p>
                        </div>
                      )}
                      {selectedSession.documents.map((doc) => (
                        <div key={doc.onboarding_item_id} className={getItemCardClass(doc.status)}>
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="min-w-0 pr-4">
                              <p className="font-semibold text-slate-800 text-sm">{doc.title}</p>
                              {doc.files[0]
                                ? <p className="text-xs text-slate-500 mt-0.5">Uploaded {new Date(doc.files[0].uploaded_at).toLocaleDateString()}</p>
                                : <p className="text-xs text-slate-400 mt-0.5">No file uploaded yet</p>
                              }
                            </div>
                            {getItemStatusBadge(doc.status)}
                          </div>
                          {(doc.files[0] || doc.status !== "pending") && (
                            <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100/80 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                {doc.files[0] && (
                                  <>
                                    <FileText className="size-4 text-slate-400 shrink-0" />
                                    <span className="text-sm text-slate-600 truncate">{doc.files[0].file_name}</span>
                                    <Button variant="outline" size="sm" asChild className="shrink-0 h-7">
                                      <a href={doc.files[0].file_url} target="_blank" rel="noreferrer">
                                        <Download className="size-3 mr-1" />View
                                      </a>
                                    </Button>
                                  </>
                                )}
                              </div>
                              <div className="shrink-0">
                                {renderItemActions(
                                  doc.onboarding_item_id,
                                  doc.status,
                                  () => handleApprove(doc.onboarding_item_id),
                                  undefined,
                                  doc.title,
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <RemarkSection
                        remarks={selectedSession.remarks.filter(r => r.tab_tag === "Documents")}
                        value={remarks["Documents"] || ""}
                        onChange={(v) => setRemarks(prev => ({ ...prev, Documents: v }))}
                        onAdd={() => handleAddRemark("Documents")}
                        inputId="remark-documents"
                      />
                    </TabsContent>

                    {/* -- HR FORMS TAB -- */}
                    <TabsContent value="forms" className="mt-0 p-6 space-y-3">
                      {selectedSession.hr_forms.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-14 text-slate-400">
                          <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                            <FileText className="size-5 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600">No HR forms assigned</p>
                          <p className="text-xs text-slate-400 mt-1">Forms will appear once added to the template</p>
                        </div>
                      )}
                      {selectedSession.hr_forms.map((form) => (
                        <div key={form.onboarding_item_id} className={getItemCardClass(form.status)}>
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="min-w-0 pr-4">
                              <p className="font-semibold text-slate-800 text-sm">{form.title}</p>
                              {form.description && <p className="text-xs text-slate-500 mt-0.5">{form.description}</p>}
                            </div>
                            {getItemStatusBadge(form.status)}
                          </div>
                          {form.status !== "pending" && (
                            <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100/80 flex justify-end">
                              {renderItemActions(
                                form.onboarding_item_id,
                                form.status,
                                () => handleApprove(form.onboarding_item_id),
                                undefined,
                                form.title,
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      <RemarkSection
                        remarks={selectedSession.remarks.filter(r => r.tab_tag === "Forms")}
                        value={remarks["Forms"] || ""}
                        onChange={(v) => setRemarks(prev => ({ ...prev, Forms: v }))}
                        onAdd={() => handleAddRemark("Forms")}
                        inputId="remark-forms"
                      />
                    </TabsContent>

                    {/* -- TASKS TAB -- */}
                    <TabsContent value="tasks" className="mt-0 p-6 space-y-3">
                      {selectedSession.tasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-14 text-slate-400">
                          <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                            <ListChecks className="size-5 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600">No tasks assigned</p>
                          <p className="text-xs text-slate-400 mt-1">Tasks will appear once added to the template</p>
                        </div>
                      )}
                      {selectedSession.tasks.map((task) => (
                        <div key={task.onboarding_item_id} className={getItemCardClass(task.status)}>
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="min-w-0 pr-4">
                              <p className="font-semibold text-slate-800 text-sm">{task.title}</p>
                              {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}
                            </div>
                            {getItemStatusBadge(task.status)}
                          </div>
                          {task.status !== "pending" && (
                            <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100/80 flex justify-end">
                              {renderItemActions(
                                task.onboarding_item_id,
                                task.status,
                                () => handleApprove(task.onboarding_item_id),
                                undefined,
                                task.title,
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      <RemarkSection
                        remarks={selectedSession.remarks.filter(r => r.tab_tag === "Tasks")}
                        value={remarks["Tasks"] || ""}
                        onChange={(v) => setRemarks(prev => ({ ...prev, Tasks: v }))}
                        onAdd={() => handleAddRemark("Tasks")}
                        inputId="remark-tasks"
                      />
                    </TabsContent>

                    {/* -- EQUIPMENT TAB -- */}
                    <TabsContent value="equipment" className="mt-0 p-6 space-y-3">
                      {selectedSession.equipment.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-14 text-slate-400">
                          <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                            <Package className="size-5 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600">No equipment assigned</p>
                          <p className="text-xs text-slate-400 mt-1">Equipment will appear once added to the template</p>
                        </div>
                      )}
                      {selectedSession.equipment.map((equip) => (
                        <div key={equip.onboarding_item_id} className={getItemCardClass(equip.status)}>
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="min-w-0 pr-4">
                              <p className="font-semibold text-slate-800 text-sm">{equip.title}</p>
                              {equip.description && <p className="text-xs text-slate-500 mt-0.5">{equip.description}</p>}
                              {equip.delivery_method && (
                                <span className="inline-flex items-center mt-1 text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                                  {equip.delivery_method === "office" ? "Office Pickup" : `Delivery${equip.delivery_address ? ` — ${equip.delivery_address}` : ""}`}
                                </span>
                              )}
                            </div>
                            {getItemStatusBadge(equip.status)}
                          </div>
                          {(equip.proof_of_receipt[0] || equip.status !== "pending") && (
                            <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100/80 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                {equip.proof_of_receipt[0] && (
                                  <>
                                    <FileText className="size-4 text-purple-500 shrink-0" />
                                    <span className="text-sm text-slate-600 truncate">{equip.proof_of_receipt[0].file_name}</span>
                                    <Button variant="outline" size="sm" asChild className="shrink-0 h-7">
                                      <a href={equip.proof_of_receipt[0].file_url} target="_blank" rel="noreferrer">
                                        <Download className="size-3 mr-1" />View
                                      </a>
                                    </Button>
                                  </>
                                )}
                              </div>
                              <div className="shrink-0">
                                {renderItemActions(
                                  equip.onboarding_item_id,
                                  equip.status,
                                  () => handleApprove(equip.onboarding_item_id),
                                  { onIssue: () => handleIssue(equip.onboarding_item_id), issueLabel: "Issue" },
                                  equip.title,
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <RemarkSection
                        remarks={selectedSession.remarks.filter(r => r.tab_tag === "Equipment")}
                        value={remarks["Equipment"] || ""}
                        onChange={(v) => setRemarks(prev => ({ ...prev, Equipment: v }))}
                        onAdd={() => handleAddRemark("Equipment")}
                        inputId="remark-equipment"
                      />
                    </TabsContent>

                  </div>
                </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval / Issue confirmation */}
      <AlertDialog open={!!pendingConfirm} onOpenChange={(open) => !open && setPendingConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingConfirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingConfirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={pendingConfirm?.confirmClass}
              onClick={() => { pendingConfirm?.onConfirm(); setPendingConfirm(null); }}
            >
              {pendingConfirm?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject confirmation with required reason */}
      <AlertDialog
        open={!!pendingReject}
        onOpenChange={(open) => {
          if (!open) {
            setPendingReject(null);
            setRejectReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingReject?.itemTitle ? `Reject "${pendingReject.itemTitle}"?` : "Reject this item?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Provide a rejection reason for the applicant. This is required before submitting the rejection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="reject-reason" className="text-xs font-semibold text-slate-600">Reason (required)</label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Enter the reason for rejection..."
              className="resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingReject(null);
                setRejectReason("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!rejectReason.trim()}
              onClick={() => {
                if (!pendingReject || !rejectReason.trim()) return;
                pendingReject.onConfirm(rejectReason.trim());
                setPendingReject(null);
                setRejectReason("");
              }}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full session reject confirmation */}
      <AlertDialog
        open={pendingSessionReject}
        onOpenChange={(open) => {
          if (!open) {
            setPendingSessionReject(false);
            setSessionRejectReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Full Onboarding Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will return the onboarding to the applicant for corrections. A reason is required and will be shown to the applicant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="session-reject-reason" className="text-xs font-semibold text-slate-600">Reason (required)</label>
            <Textarea
              id="session-reject-reason"
              value={sessionRejectReason}
              onChange={(e) => setSessionRejectReason(e.target.value)}
              rows={3}
              placeholder="Enter the reason for rejecting this onboarding..."
              className="resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingSessionReject(false);
                setSessionRejectReason("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!sessionRejectReason.trim() || rejectingSession}
              onClick={handleRejectSession}
            >
              {rejectingSession ? "Rejecting..." : "Reject Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
