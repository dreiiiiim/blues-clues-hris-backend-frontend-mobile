"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock, CheckCircle, AlertTriangle, UserMinus, Plus, X, Check,
  KeyRound, DollarSign, Shield, Eye, FileText, Archive, Loader2, Upload, Search, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getHRCases,
  getHRCaseDetail,
  getHRFinalPay,
  getHROffboardingTemplates,
  initiateHROffboarding,
  reviewCase,
  updateChecklistItem,
  revokeSystemAccess,
  recomputeFinalPay,
  updateFinalPay,
  type FinalPayBreakdown,
  releaseFinalPay,
  confirmBankTransfer,
  releaseClearance,
  updateHRCaseStatus,
  updateUserAccountStatus,
  triggerJobPosting,
  resetHRCase,
  fetchCompanyEmployees,
  type OffboardingCaseSummary,
  type OffboardingCaseDetail,
  type ChecklistItem,
  type SystemAccessItem,
  type EmployeeUser,
  type SystemAdminOffboardingTemplate,
} from "@/lib/offboardingApi";

// ── Constants ──────────────────────────────────────────────────────────────────

const OFFBOARDING_TYPES = ["Termination", "End of Contract"];

const INITIATE_REASONS: Record<string, string[]> = {
  Termination:       ["Performance Issues", "Policy Violation", "Redundancy", "Restructuring", "Other"],
  "End of Contract": ["Contract Expired", "Project Completed", "Fixed-Term End", "Other"],
};

type InitiateForm = {
  offboardingType: string;
  details: string;
  lastWorkingDay: string;
  reason: string;
  templateId: string;
};

function normalizeTemplateValue(value?: string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

function matchesTemplateScope(
  template: SystemAdminOffboardingTemplate,
  offboardingType: string,
  roleName?: string | null,
): boolean {
  const normalizedType = normalizeTemplateValue(offboardingType);
  const normalizedRole = normalizeTemplateValue(roleName);
  const applicableTypes = (template.applicable_offboarding_types ?? []).map(normalizeTemplateValue).filter(Boolean);
  const scopeTokens = String(template.employee_type ?? "")
    .split(/[\/,|]/)
    .map(token => normalizeTemplateValue(token))
    .filter(Boolean);

  const typeMatches =
    applicableTypes.length > 0
      ? applicableTypes.includes(normalizedType)
      : scopeTokens.length === 0 || scopeTokens.includes(normalizedType);

  if (!typeMatches) return false;
  if (!normalizedRole) return true;

  const roleTokens = scopeTokens.filter(token => token !== normalizedType);
  return roleTokens.length === 0 || roleTokens.includes(normalizedRole);
}

function sortTemplatesForRole(
  templates: SystemAdminOffboardingTemplate[],
  roleName?: string | null,
): SystemAdminOffboardingTemplate[] {
  const normalizedRole = normalizeTemplateValue(roleName);
  return [...templates].sort((left, right) => {
    const leftTokens = String(left.employee_type ?? "").split(/[\/,|]/).map(token => normalizeTemplateValue(token)).filter(Boolean);
    const rightTokens = String(right.employee_type ?? "").split(/[\/,|]/).map(token => normalizeTemplateValue(token)).filter(Boolean);
    const leftRoleSpecific = normalizedRole ? leftTokens.includes(normalizedRole) : false;
    const rightRoleSpecific = normalizedRole ? rightTokens.includes(normalizedRole) : false;
    if (leftRoleSpecific !== rightRoleSpecific) return leftRoleSpecific ? -1 : 1;
    if (Boolean(left.is_default) !== Boolean(right.is_default)) return left.is_default ? -1 : 1;
    return String(right.created_at ?? "").localeCompare(String(left.created_at ?? ""));
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPay(val: number | undefined): string {
  if (!val || val === 0) return "";
  return new Intl.NumberFormat("en-US").format(val);
}

function parsePay(input: string): number {
  const clean = input.replaceAll(/[^0-9.]/g, "");
  const parts = clean.split(".");
  const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : clean;
  return Number.parseFloat(normalized) || 0;
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString();
}

function getEmployeeBadgeCls(status: string): string {
  if (status === "Completed")            return "bg-green-100 text-green-700 border border-green-200";
  if (status === "Submitted")            return "bg-yellow-100 text-yellow-700 border border-yellow-200";
  return "bg-blue-100 text-blue-700 border border-blue-200";
}

function getEmployeeBadgeLabel(status: string): string {
  if (status === "Completed")            return "Completed";
  if (status === "HR_Accepted")          return "In Progress";
  if (status === "Manager_Acknowledged") return "Manager Acknowledged";
  return "Submitted";
}

function getChecklistStatusBadge(status: string) {
  if (status === "Verified")
    return <Badge className="bg-green-100 text-green-700 border border-green-200">Verified</Badge>;
  if (status === "Disputed")
    return <Badge className="bg-red-100 text-red-500 border border-red-200">Disputed</Badge>;
  if (status === "Submitted")
    return <Badge className="bg-blue-100 text-blue-700 border border-blue-200">Submitted</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-200">Pending</Badge>;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SystemAccessRow({
  item,
  onRevoke,
  isRevoking,
}: {
  readonly item: SystemAccessItem;
  readonly onRevoke: (id: string) => void;
  readonly isRevoking: boolean;
}) {
  const revoked = item.status === "Revoked";
  return (
    <div className={`flex items-center justify-between border rounded-md px-3 py-2.5 ${revoked ? "bg-red-50 border-red-100" : ""}`}>
      <div>
        <p className="text-sm">{item.system_name}</p>
        {revoked && item.revoked_at && (
          <p className="text-xs text-red-400">Revoked on {new Date(item.revoked_at).toLocaleDateString()}</p>
        )}
      </div>
      {revoked ? (
        <Badge variant="outline" className="border-red-200 text-red-500 bg-red-50">Revoked</Badge>
      ) : (
        <Button size="sm" onClick={() => onRevoke(item.access_id)} disabled={isRevoking} className="bg-red-600 hover:bg-red-700 text-white h-7 px-3 text-xs">
          {isRevoking ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
          Revoke
        </Button>
      )}
    </div>
  );
}

function ChecklistRow({
  item,
  employeeName,
  onView,
  onVerify,
  onFlag,
  isVerifying,
  isFlagging,
}: {
  readonly item: ChecklistItem;
  readonly employeeName: string;
  readonly onView: () => void;
  readonly onVerify: (id: string) => void;
  readonly onFlag: (id: string) => void;
  readonly isVerifying: boolean;
  readonly isFlagging: boolean;
}) {
  const canAction = item.status === "Submitted";
  return (
    <div className="flex items-center justify-between border rounded-md px-4 py-3">
      <div>
        <p className="text-sm font-medium">{employeeName}</p>
        <p className={`text-xs mt-0.5 ${item.status === "Submitted" ? "text-blue-500" : "text-slate-400"}`}>{item.item_name}</p>
      </div>
      <div className="flex items-center gap-2">
        {getChecklistStatusBadge(item.status)}
        <Button variant="outline" size="sm" onClick={onView} className="flex items-center gap-1.5 h-8">
          <Eye className="size-3.5" /> View
        </Button>
        {canAction && (
          <>
            <Button size="sm" onClick={() => onVerify(item.item_id)} disabled={isVerifying || isFlagging} className="bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 h-8 px-3 text-xs">
              {isVerifying ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <CheckCircle className="size-3.5 mr-1" />} Verify
            </Button>
            <Button size="sm" onClick={() => onFlag(item.item_id)} disabled={isFlagging || isVerifying} className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-200 h-8 px-3 text-xs">
              {isFlagging ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <AlertTriangle className="size-3.5 mr-1" />} Flag
            </Button>
          </>
        )}
        {item.status === "Disputed" && (
          <Badge className="bg-red-100 text-red-600 border border-red-200 text-xs">Needs Resubmission</Badge>
        )}
      </div>
    </div>
  );
}

// ── Page Component ─────────────────────────────────────────────────────────────

export default function HROffboardingPage() {
  const [cases, setCases]               = useState<OffboardingCaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<OffboardingCaseDetail | null>(null);
  const [showInitiateForm, setShowInitiateForm] = useState(false);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  const [viewItem, setViewItem]         = useState<ChecklistItem | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Reject flow
  const [rejectCaseId, setRejectCaseId]   = useState<string | null>(null);
  const [rejectReason, setRejectReason]   = useState("");

  // Final pay local state (for editing before save)
  const [payEdits, setPayEdits] = useState({ salary_balance: "", leave_encashment: "", additional_pay: "", deductions: "" });
  const [finalPayBreakdown, setFinalPayBreakdown] = useState<FinalPayBreakdown | null>(null);
  const [showBreakdownDialog, setShowBreakdownDialog] = useState(false);

  // HR initiate form
  const [hrDetailsMode, setHrDetailsMode] = useState<"type" | "upload">("type");
  const [hrDetailsFile, setHrDetailsFile] = useState<File | null>(null);
  const [initiateForm, setInitiateForm]   = useState<InitiateForm>({
    offboardingType: "Termination", details: "", lastWorkingDay: "", reason: "", templateId: "",
  });

  // Employee search
  const [allEmployees, setAllEmployees]           = useState<EmployeeUser[]>([]);
  const [employeeSearch, setEmployeeSearch]       = useState("");
  const [selectedEmployee, setSelectedEmployee]   = useState<EmployeeUser | null>(null);
  const [showEmployeeList, setShowEmployeeList]   = useState(false);
  const [employeeLoadError, setEmployeeLoadError] = useState<string | null>(null);
  const [loadingEmployees, setLoadingEmployees]   = useState(false);
  const [templates, setTemplates]                 = useState<SystemAdminOffboardingTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates]   = useState(false);
  const [reviewTemplateId, setReviewTemplateId]   = useState("");

  const fetchCases = useCallback(async () => {
    try {
      const data = await getHRCases();
      setCases(data);
    } catch { /* silently ignore */ }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await getHROffboardingTemplates();
      setTemplates(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load offboarding templates.");
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const fetchDetail = useCallback(async (caseId: string) => {
    setLoadingDetail(true);
    try {
      // Fetch case detail and final pay in parallel — final pay triggers C&B recompute
      const [detail, payResult] = await Promise.allSettled([
        getHRCaseDetail(caseId),
        getHRFinalPay(caseId),
      ]);

      if (detail.status === 'rejected') { setSelectedDetail(null); return; }

      const d = detail.value;
      setSelectedDetail(d);

      if (payResult.status === 'fulfilled') {
        const pay = payResult.value;
        setPayEdits({
          salary_balance:   String(pay.salary_balance   ?? 0),
          leave_encashment: String(pay.leave_encashment ?? 0),
          additional_pay:   String(pay.additional_pay   ?? 0),
          deductions:       String(pay.deductions        ?? 0),
        });
        if (pay.computed_breakdown) setFinalPayBreakdown(pay.computed_breakdown);
        setSelectedDetail(prev => prev ? { ...prev, final_pay: pay } : prev);
      } else if (d.final_pay) {
        setPayEdits({
          salary_balance:   String(d.final_pay.salary_balance   ?? 0),
          leave_encashment: String(d.final_pay.leave_encashment ?? 0),
          additional_pay:   String(d.final_pay.additional_pay   ?? 0),
          deductions:       String(d.final_pay.deductions        ?? 0),
        });
      }
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    fetchTemplates();
  }, [fetchCases, fetchTemplates]);

  useEffect(() => {
    if (showInitiateForm && allEmployees.length === 0 && !loadingEmployees) {
      setLoadingEmployees(true);
      setEmployeeLoadError(null);
      fetchCompanyEmployees()
        .then(setAllEmployees)
        .catch(err => setEmployeeLoadError(err instanceof Error ? err.message : "Failed to load employees."))
        .finally(() => setLoadingEmployees(false));
    }
  }, [showInitiateForm, allEmployees.length, loadingEmployees]);

  useEffect(() => {
    if (!selectedCaseId) { setSelectedDetail(null); setLoadingDetail(false); return; }
    // Clear stale data immediately so previous employee's values don't bleed through
    setSelectedDetail(null);
    setPayEdits({ salary_balance: "", leave_encashment: "", additional_pay: "", deductions: "" });
    setFinalPayBreakdown(null);
    fetchDetail(selectedCaseId);
  }, [selectedCaseId, fetchDetail]);

  const initiateTemplates = sortTemplatesForRole(
    templates.filter((template) => matchesTemplateScope(template, initiateForm.offboardingType, selectedEmployee?.role_name)),
    selectedEmployee?.role_name,
  );

  useEffect(() => {
    if (!showInitiateForm) return;
    const nextTemplateId =
      initiateTemplates.find((template) => template.template_id === initiateForm.templateId)?.template_id
      ?? initiateTemplates[0]?.template_id
      ?? "";
    if (nextTemplateId !== initiateForm.templateId) {
      setInitiateForm((current) => ({ ...current, templateId: nextTemplateId }));
    }
  }, [showInitiateForm, initiateTemplates, initiateForm.templateId]);

  const selectedCase    = cases.find(c => c.case_id === selectedCaseId) ?? null;
  const isPending       = selectedCase?.status === "Manager_Acknowledged" || selectedCase?.status === "Submitted";
  const isInProgress    = selectedCase?.status === "HR_Accepted";
  const isCompleted     = selectedCase?.status === "Completed";
  const hasCase         = isPending || isInProgress || isCompleted;
  const canReview       = selectedCase?.status === "Manager_Acknowledged";
  const showProgress    = isInProgress || isCompleted;

  const totalActive     = cases.filter(c => c.status === "HR_Accepted").length;
  const totalCompleted  = cases.filter(c => c.status === "Completed").length;
  const pendingReview   = cases.filter(c => c.status === "Submitted" || c.status === "Manager_Acknowledged").length;
  const incomingCases   = cases.filter(c => c.status === "Submitted" || c.status === "Manager_Acknowledged");
  const overviewCases   = cases.filter(c => c.status === "HR_Accepted" || c.status === "Completed");

  const checklistItems  = selectedDetail?.checklist_items ?? [];
  const allVerified     = checklistItems.length > 0 && checklistItems.every(i => i.status === "Verified");
  const finalPay        = selectedDetail?.final_pay;
  const paymentReleased = finalPay?.status === "Payment Released" || finalPay?.status === "Transfer Confirmed";
  const canGenerateClearance = paymentReleased && allVerified;
  const clearanceReleased = (selectedDetail?.clearance_documents?.length ?? 0) > 0;
  const jobPostingTriggered = selectedDetail?.vacant_position?.status === "Opened";

  const payTotal = Math.max(0,
    parsePay(payEdits.salary_balance)
    + parsePay(payEdits.leave_encashment)
    + parsePay(payEdits.additional_pay)
    - parsePay(payEdits.deductions)
  );

  const filteredEmployees = employeeSearch.trim().length > 0
    ? allEmployees.filter(e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(employeeSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const initiateFormValid = !!(selectedEmployee && initiateForm.lastWorkingDay && initiateForm.reason);
  const initiateLabel     = initiateForm.offboardingType === "End of Contract" ? "Initiate End of Contract" : "Initiate Termination";
  const reviewTemplates = sortTemplatesForRole(
    templates.filter((template) => matchesTemplateScope(template, selectedCase?.offboarding_type ?? "", selectedDetail?.employee_role_name ?? selectedCase?.employee_role_name)),
    selectedDetail?.employee_role_name ?? selectedCase?.employee_role_name,
  );

  useEffect(() => {
    if (!selectedCaseId) {
      setReviewTemplateId("");
      return;
    }
    const nextTemplateId =
      reviewTemplates.find((template) => template.template_id === reviewTemplateId)?.template_id
      ?? selectedCase?.selected_template_id
      ?? reviewTemplates[0]?.template_id
      ?? "";
    if (nextTemplateId !== reviewTemplateId) {
      setReviewTemplateId(nextTemplateId);
    }
  }, [selectedCaseId, reviewTemplates, selectedCase?.selected_template_id, reviewTemplateId]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  async function handleInitiate() {
    if (!initiateFormValid || !selectedEmployee) return;
    setLoadingAction("initiate");
    setError(null);
    try {
      const created = await initiateHROffboarding({
        employee_id: selectedEmployee.user_id,
        offboarding_type: initiateForm.offboardingType,
        reason: initiateForm.reason,
        termination_details: initiateForm.details || null,
        last_working_day: initiateForm.lastWorkingDay,
        template_id: initiateForm.templateId || null,
      });
      await fetchCases();
      setSelectedCaseId(created.case_id);
      setShowInitiateForm(false);
      setInitiateForm({ offboardingType: "Termination", details: "", lastWorkingDay: "", reason: "", templateId: "" });
      setSelectedEmployee(null);
      setEmployeeSearch("");
      setHrDetailsMode("type");
      setHrDetailsFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate offboarding.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleAccept(id: string) {
    setLoadingAction(`accept-${id}`);
    setError(null);
    try {
      await reviewCase(id, "Accepted", undefined, reviewTemplateId || null);
      await fetchCases();
      setSelectedCaseId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept case.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRejectConfirm() {
    if (!rejectCaseId || !rejectReason.trim()) return;
    setLoadingAction(`reject-${rejectCaseId}`);
    setError(null);
    try {
      await reviewCase(rejectCaseId, "Rejected", rejectReason.trim());
      await fetchCases();
      if (selectedCaseId === rejectCaseId) setSelectedCaseId(null);
      setRejectCaseId(null);
      setRejectReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject case.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleResetCase(caseId: string) {
    const confirmed = window.confirm(
      "Reset this offboarding session? This will delete the current offboarding case and its generated checklist, system access, and final-pay session records.",
    );
    if (!confirmed) return;

    setLoadingAction(`reset-${caseId}`);
    setError(null);
    try {
      await resetHRCase(caseId);
      await fetchCases();
      if (selectedCaseId === caseId) {
        setSelectedCaseId(null);
        setSelectedDetail(null);
      }
      toast.success("Offboarding session reset.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset offboarding case.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRevoke(accessId: string) {
    if (!selectedCaseId) return;
    setLoadingAction(`revoke-${accessId}`);
    setError(null);
    try {
      await revokeSystemAccess(selectedCaseId, accessId);
      await fetchDetail(selectedCaseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke access.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRevokeAll() {
    if (!selectedDetail || !selectedCaseId) return;
    setLoadingAction("revoke-all");
    setError(null);
    try {
      const active = selectedDetail.system_access.filter(a => a.status !== "Revoked");
      await Promise.all(active.map(a => revokeSystemAccess(selectedCaseId, a.access_id)));
      await fetchDetail(selectedCaseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke all access.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSetItemStatus(itemId: string, status: "Verified" | "Disputed") {
    if (!selectedCaseId) return;
    setLoadingAction(`${status.toLowerCase()}-${itemId}`);
    setError(null);
    try {
      await updateChecklistItem(selectedCaseId, itemId, status);
      await fetchDetail(selectedCaseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${status.toLowerCase()} item.`);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSaveFinalPay() {
    if (!selectedCaseId) return;
    setLoadingAction("save-pay");
    setError(null);
    try {
      await updateFinalPay(selectedCaseId, {
        salary_balance:   parsePay(payEdits.salary_balance),
        leave_encashment: parsePay(payEdits.leave_encashment),
        additional_pay:   parsePay(payEdits.additional_pay),
        deductions:       parsePay(payEdits.deductions),
      });
      await fetchDetail(selectedCaseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save final pay.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleReleasePayment() {
    if (!selectedCaseId) return;
    setLoadingAction("release-payment");
    setError(null);
    try {
      await releaseFinalPay(selectedCaseId);
      await fetchDetail(selectedCaseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release payment.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleConfirmBankTransfer() {
    if (!selectedCaseId) return;
    setLoadingAction("confirm-transfer");
    setError(null);
    try {
      await confirmBankTransfer(selectedCaseId);
      await fetchDetail(selectedCaseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm bank transfer.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleConfirmClearance() {
    if (!selectedCaseId) return;
    setLoadingAction("clearance");
    setError(null);
    try {
      await releaseClearance(selectedCaseId);
      await updateHRCaseStatus(selectedCaseId, "Completed");
      await fetchCases();
      await fetchDetail(selectedCaseId);
      setShowClearanceModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete offboarding.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleTriggerJobPosting() {
    if (!selectedCaseId) return;
    setLoadingAction("trigger-job");
    setError(null);
    try {
      await triggerJobPosting(selectedCaseId);
      await fetchDetail(selectedCaseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger job posting.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSetAccountStatus(status: "Inactive" | "Archived") {
    if (!selectedDetail) return;
    const key = status === "Inactive" ? "deactivate" : "archive";
    setLoadingAction(key);
    setError(null);
    try {
      await updateUserAccountStatus(selectedDetail.employee_id, status);
      await fetchDetail(selectedDetail.case_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${key} account.`);
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="p-6 space-y-6">

      {/* ── Final Pay Breakdown Receipt ── */}
      <Dialog open={showBreakdownDialog} onOpenChange={setShowBreakdownDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="size-4 text-green-600" /> Final Pay Breakdown
            </DialogTitle>
            <DialogDescription>
              Review the employee&apos;s final pay summary before releasing it.
            </DialogDescription>
          </DialogHeader>
          {finalPayBreakdown && (
            <FinalPayReceiptView
              breakdown={finalPayBreakdown}
              salaryBalance={parsePay(payEdits.salary_balance)}
              leaveEncashment={parsePay(payEdits.leave_encashment)}
              additionalPay={parsePay(payEdits.additional_pay)}
              deductions={parsePay(payEdits.deductions)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Checklist Item Details Modal ── */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Checklist Item Details</DialogTitle>
            <DialogDescription>
              Review the selected checklist item and update its status if needed.
            </DialogDescription>
          </DialogHeader>
          {viewItem && selectedDetail && (
            <div className="space-y-3 pt-2">
              <div className="border rounded-md px-3 py-2.5">
                <p className="text-xs text-slate-400 mb-0.5">Employee</p>
                <p className="text-sm font-medium">{selectedDetail.employee_name ?? "—"}</p>
              </div>
              <div className="border rounded-md px-3 py-2.5">
                <p className="text-xs text-slate-400 mb-0.5">Checklist Item</p>
                <p className="text-sm font-medium">{viewItem.item_name}</p>
              </div>
              <div className="border rounded-md px-3 py-2.5">
                <p className="text-xs text-slate-400 mb-1">Status</p>
                {getChecklistStatusBadge(viewItem.status)}
              </div>
              {viewItem.status === "Submitted" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Button onClick={() => { handleSetItemStatus(viewItem.item_id, "Verified"); setViewItem(null); }} className="bg-green-100 hover:bg-green-200 text-green-700 border border-green-200">
                    <CheckCircle className="size-4 mr-2" /> Verify
                  </Button>
                  <Button onClick={() => { handleSetItemStatus(viewItem.item_id, "Disputed"); setViewItem(null); }} className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-200">
                    <AlertTriangle className="size-4 mr-2" /> Flag
                  </Button>
                </div>
              )}
              {viewItem.status === "Disputed" && (
                <div className="bg-red-50 border border-red-100 rounded-md px-4 py-3 text-sm text-red-700">
                  This item has been flagged as disputed. Employee must resubmit.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Clearance Confirmation Modal ── */}
      <Dialog open={showClearanceModal} onOpenChange={setShowClearanceModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5 text-green-600" /> Generate Clearance Certificate
            </DialogTitle>
            <DialogDescription>
              Confirm that all offboarding requirements are complete before generating clearance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="border rounded-md px-4 py-5 text-center space-y-3">
              <Shield className="size-10 text-green-500 mx-auto" />
              <p className="font-bold text-sm tracking-widest">CLEARANCE CERTIFICATE</p>
              <hr />
              <p className="text-sm text-slate-600 leading-relaxed">
                This is to certify that <strong>{selectedDetail?.employee_name}</strong> has
                completed all offboarding requirements and returned all company property. All
                financial obligations have been settled.
              </p>
              <p className="text-sm text-slate-600">
                Issued on{" "}
                <strong>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowClearanceModal(false)}>Cancel</Button>
              <Button onClick={handleConfirmClearance} disabled={loadingAction === "clearance"} className="bg-slate-900 hover:bg-slate-800 text-white">
                {loadingAction === "clearance" ? <Loader2 className="size-4 animate-spin mr-2" /> : <Shield className="size-4 mr-2" />}
                Confirm &amp; Generate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reject Reason Modal ── */}
      <Dialog open={!!rejectCaseId} onOpenChange={() => { setRejectCaseId(null); setRejectReason(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Offboarding Case</DialogTitle>
            <DialogDescription>
              Enter a reason that will explain why this offboarding case is being rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Rejection Reason <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Enter the reason for rejection..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="min-h-24 bg-slate-50 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => { setRejectCaseId(null); setRejectReason(""); }}>Cancel</Button>
              <Button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || !!loadingAction}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {loadingAction?.startsWith("reject-") ? <Loader2 className="size-4 animate-spin mr-2" /> : <X className="size-4 mr-2" />}
                Confirm Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Offboarding Management</h1>
        {showInitiateForm ? (
          <Button onClick={() => setShowInitiateForm(false)} className="bg-slate-900 hover:bg-slate-800 text-white">
            <X className="size-4 mr-2" /> Cancel
          </Button>
        ) : (
          <Button onClick={() => setShowInitiateForm(true)} className="bg-slate-900 hover:bg-slate-800 text-white">
            <Plus className="size-4 mr-2" /> Initiate Offboarding
          </Button>
        )}
      </div>

      {/* ── Initiate Offboarding Form ── */}
      {showInitiateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserMinus className="size-5" /> Initiate Offboarding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Offboarding Type</Label>
              <select value={initiateForm.offboardingType} onChange={e => setInitiateForm(f => ({ ...f, offboardingType: e.target.value, reason: "" }))} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background h-10">
                {OFFBOARDING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Employee Search */}
            <div className="space-y-2 relative">
              <Label>Employee</Label>
              {selectedEmployee ? (
                <div className="flex items-center justify-between border rounded-md px-3 py-2.5 bg-slate-50">
                  <div>
                    <p className="text-sm font-medium">{selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                    {selectedEmployee.role_name && <p className="text-xs text-slate-500">{selectedEmployee.role_name}</p>}
                  </div>
                  <button type="button" onClick={() => { setSelectedEmployee(null); setEmployeeSearch(""); }} className="text-slate-400 hover:text-slate-600">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    {loadingEmployees
                      ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 animate-spin" />
                      : <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    }
                    <Input
                      placeholder={loadingEmployees ? "Loading employees..." : "Search employee by name..."}
                      value={employeeSearch}
                      onChange={e => { setEmployeeSearch(e.target.value); setShowEmployeeList(true); }}
                      onFocus={() => setShowEmployeeList(true)}
                      className="pl-9"
                      disabled={loadingEmployees}
                    />
                  </div>
                  {employeeLoadError && (
                    <p className="text-xs text-red-500">{employeeLoadError}</p>
                  )}
                  {showEmployeeList && !loadingEmployees && (
                    filteredEmployees.length > 0 ? (
                      <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {filteredEmployees.map(emp => (
                          <button
                            key={emp.user_id}
                            type="button"
                            onClick={() => { setSelectedEmployee(emp); setEmployeeSearch(""); setShowEmployeeList(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                              {emp.role_name && <span className="text-slate-400 text-xs">{emp.role_name}</span>}
                              {emp.email && <span className="text-slate-400 text-xs">{emp.email}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : employeeSearch.trim().length > 0 ? (
                      <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 px-4 py-3 text-sm text-slate-400">
                        No employees found
                      </div>
                    ) : null
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Offboarding Template</Label>
              <select
                value={initiateForm.templateId}
                onChange={e => setInitiateForm(f => ({ ...f, templateId: e.target.value }))}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background h-10"
                disabled={loadingTemplates || initiateTemplates.length === 0}
              >
                {loadingTemplates && <option value="">Loading templates...</option>}
                {!loadingTemplates && initiateTemplates.length === 0 && <option value="">No matching templates found</option>}
                {!loadingTemplates && initiateTemplates.map(template => (
                  <option key={template.template_id} value={template.template_id}>
                    {template.template_name}{template.employee_type ? ` - ${template.employee_type}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                {selectedEmployee?.role_name
                  ? `Suggested from the employee role (${selectedEmployee.role_name}) and offboarding type.`
                  : "Select an employee to get role-based template suggestions."}
              </p>
            </div>

            <div className="flex">
              <button type="button" onClick={() => setHrDetailsMode("type")} className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-l-md border ${hrDetailsMode === "type" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                <FileText className="size-4" /> Type Manually
              </button>
              <button type="button" onClick={() => setHrDetailsMode("upload")} className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-r-md border-t border-r border-b ${hrDetailsMode === "upload" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                <Upload className="size-4" /> Upload File
              </button>
            </div>
            {hrDetailsMode === "type" ? (
              <div className="space-y-2">
                <Label>{initiateForm.offboardingType} Details</Label>
                <Textarea placeholder={`Enter ${initiateForm.offboardingType.toLowerCase()} details...`} value={initiateForm.details} onChange={e => setInitiateForm(f => ({ ...f, details: e.target.value }))} className="min-h-28 bg-slate-50 resize-none" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Upload Document</Label>
                <label className="flex items-center justify-center gap-2 border border-dashed rounded-md py-5 cursor-pointer hover:bg-slate-50 bg-slate-50">
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => setHrDetailsFile(e.target.files?.[0] ?? null)} />
                  <Upload className="size-4 text-slate-400" />
                  <span className="text-sm text-slate-500">Click to upload or drag and drop</span>
                </label>
                {hrDetailsFile && (
                  <div className="flex items-center justify-between border rounded-md px-3 py-2.5 bg-white">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 text-slate-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{hrDetailsFile.name}</p>
                        <p className="text-xs text-slate-400">{(hrDetailsFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setHrDetailsFile(null)} className="ml-3 text-slate-400 hover:text-slate-600 shrink-0"><X className="size-4" /></button>
                  </div>
                )}
                <p className="text-xs text-slate-400">Supported formats: PDF, DOC, DOCX (Max 10MB)</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Last Working Day</Label>
                <Input type="date" value={initiateForm.lastWorkingDay} onChange={e => setInitiateForm(f => ({ ...f, lastWorkingDay: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <select value={initiateForm.reason} onChange={e => setInitiateForm(f => ({ ...f, reason: e.target.value }))} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background h-10">
                  <option value="">Select a reason</option>
                  {(INITIATE_REASONS[initiateForm.offboardingType] ?? []).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={handleInitiate} disabled={!initiateFormValid || loadingAction === "initiate"} className="w-full bg-rose-400 hover:bg-rose-500 text-white disabled:opacity-50 disabled:cursor-not-allowed">
              {loadingAction === "initiate" ? <Loader2 className="size-4 animate-spin mr-2" /> : <UserMinus className="size-4 mr-2" />}
              {initiateLabel}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Selected Employee (pinned top so HR doesn't scroll) ── */}
      {selectedCaseId && (loadingDetail || (hasCase && selectedCase)) && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserMinus className="size-4 text-blue-600" />
              {selectedCase ? `${selectedCase.employee_name ?? "Employee"} — ${selectedCase.offboarding_type}` : "Loading…"}
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedCase && <Badge className={getEmployeeBadgeCls(selectedCase.status)}>{getEmployeeBadgeLabel(selectedCase.status)}</Badge>}
              <button type="button" onClick={() => { setSelectedCaseId(null); setSelectedDetail(null); }} className="text-slate-400 hover:text-slate-600"><X className="size-4" /></button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDetail ? (
              <div className="flex items-center gap-3 py-6 justify-center text-slate-500">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">Loading case details…</span>
              </div>
            ) : selectedDetail ? (
              <div className="grid grid-cols-4 gap-3">
                {([
                  { label: "Employee", value: selectedDetail.employee_name ?? "—" },
                  { label: "Last Day", value: selectedCase?.last_working_day ?? "—" },
                  { label: "Status",   value: getEmployeeBadgeLabel(selectedCase?.status ?? "") },
                ] as const).map(({ label, value }) => (
                  <div key={label} className="border rounded-md px-3 py-2.5 bg-white">
                    <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                    <p className="text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div><p className="text-sm text-slate-500">Total Offboarding</p><p className="text-3xl font-bold mt-1">{totalActive}</p><p className="text-xs text-slate-400 mt-1">Active cases</p></div>
              <Clock className="size-5 text-blue-400 shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div><p className="text-sm text-slate-500">Completed</p><p className="text-3xl font-bold mt-1">{totalCompleted}</p><p className="text-xs text-slate-400 mt-1">All time</p></div>
              <CheckCircle className="size-5 text-green-400 shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div><p className="text-sm text-slate-500">Pending Review</p><p className="text-3xl font-bold mt-1">{pendingReview}</p><p className="text-xs text-slate-400 mt-1">Require action</p></div>
              <AlertTriangle className="size-5 text-yellow-400 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Incoming Offboarding Requests ── */}
      <Card>
        <CardHeader><CardTitle>Incoming Offboarding Requests</CardTitle></CardHeader>
        <CardContent>
          {incomingCases.length > 0 ? (
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b">
                  {["Employee Name", "Type", "Submitted Date", "Status", "Actions"].map(h => (
                    <th key={h} className={`py-2 px-2 font-semibold text-slate-700 whitespace-nowrap ${h === "Actions" ? "text-right w-28" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incomingCases.map(c => (
                  <tr key={c.case_id} onClick={() => setSelectedCaseId(c.case_id)} className={`border-b last:border-0 cursor-pointer hover:bg-slate-50 ${selectedCaseId === c.case_id ? "bg-slate-50" : ""}`}>
                    <td className="py-3 px-2 font-medium whitespace-nowrap">{c.employee_name ?? "—"}</td>
                    <td className="py-3 px-2"><Badge variant="outline" className="text-slate-500 bg-slate-50">{c.offboarding_type}</Badge></td>
                    <td className="py-3 px-2 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-2">
                      {c.status === "Manager_Acknowledged"
                        ? <Badge className="bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap">Manager Acknowledged</Badge>
                        : <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-200 whitespace-nowrap">Pending Manager Ack.</Badge>
                      }
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={e => { e.stopPropagation(); handleAccept(c.case_id); }} disabled={!!loadingAction || c.status !== "Manager_Acknowledged"} className="h-8 w-8 rounded-full border border-green-200 bg-green-50 flex items-center justify-center hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed">
                          {loadingAction === `accept-${c.case_id}` ? <Loader2 className="size-4 animate-spin text-green-600" /> : <Check className="size-4 text-green-600" />}
                        </button>
                        <button type="button" onClick={e => { e.stopPropagation(); setRejectCaseId(c.case_id); }} disabled={!!loadingAction || c.status !== "Manager_Acknowledged"} className="h-8 w-8 rounded-full border border-red-200 bg-red-50 flex items-center justify-center hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed">
                          <X className="size-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">No pending requests</p>
          )}
        </CardContent>
      </Card>

      {/* ── Selected Employee ── */}
      {hasCase && selectedCase && selectedDetail && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Selected Employee</CardTitle>
            <Badge className={getEmployeeBadgeCls(selectedCase.status)}>{getEmployeeBadgeLabel(selectedCase.status)}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: "Employee", value: selectedDetail.employee_name ?? "—" },
                { label: "Type",     value: selectedCase.offboarding_type },
                { label: "Last Day", value: selectedCase.last_working_day },
              ] as const).map(({ label, value }) => (
                <div key={label} className="border rounded-md px-3 py-2.5">
                  <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
            {isPending && !canReview && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-md px-4 py-3 text-sm text-yellow-700">
                Awaiting manager acknowledgment before HR can review this case.
              </div>
            )}
            {canReview && (
              <div className="space-y-3 pt-1">
                <div className="space-y-2">
                  <Label>Checklist Template</Label>
                  <select
                    value={reviewTemplateId}
                    onChange={e => setReviewTemplateId(e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background h-10"
                    disabled={loadingTemplates || reviewTemplates.length === 0}
                  >
                    {loadingTemplates && <option value="">Loading templates...</option>}
                    {!loadingTemplates && reviewTemplates.length === 0 && <option value="">No matching templates found</option>}
                    {!loadingTemplates && reviewTemplates.map(template => (
                      <option key={template.template_id} value={template.template_id}>
                        {template.template_name}{template.employee_type ? ` - ${template.employee_type}` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    {selectedDetail.employee_role_name
                      ? `Suggested from ${selectedDetail.employee_role_name} and ${selectedCase.offboarding_type}.`
                      : "Choose which template to apply before HR accepts this case."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => handleAccept(selectedCase.case_id)} disabled={!!loadingAction} className="bg-slate-900 hover:bg-slate-800 text-white">
                    {loadingAction === `accept-${selectedCase.case_id}` ? <Loader2 className="size-4 animate-spin mr-2" /> : <Check className="size-4 mr-2" />}
                    Accept Offboarding
                  </Button>
                  <Button onClick={() => setRejectCaseId(selectedCase.case_id)} disabled={!!loadingAction} className="bg-red-600 hover:bg-red-700 text-white">
                    <X className="size-4 mr-2" /> Reject
                  </Button>
                </div>
              </div>
            )}
            {!isCompleted && (
              <div className="border-t pt-3">
                <Button
                  variant="outline"
                  onClick={() => handleResetCase(selectedCase.case_id)}
                  disabled={!!loadingAction}
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {loadingAction === `reset-${selectedCase.case_id}` ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="size-4 mr-2" />
                  )}
                  Reset Offboarding Session
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── System Access + Final Pay ── */}
      {showProgress && selectedDetail && selectedCaseId && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="size-4 text-orange-500" /> System Access Revocation
                </CardTitle>
                {selectedDetail.system_access.some(a => a.status !== "Revoked") && (
                  <Button size="sm" variant="outline" onClick={handleRevokeAll} disabled={loadingAction === "revoke-all"} className="text-xs h-7">
                    {loadingAction === "revoke-all" ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                    Revoke All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDetail.system_access.map(item => (
                <SystemAccessRow key={item.access_id} item={item} onRevoke={handleRevoke} isRevoking={loadingAction === `revoke-${item.access_id}`} />
              ))}
              <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2.5 text-xs text-blue-700">
                Revoke system access immediately to disable employee access to critical systems.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="size-4 text-green-600" /> Final Pay
              </CardTitle>
              {!paymentReleased && !isCompleted && selectedCaseId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={loadingAction === "recompute-pay"}
                  onClick={async () => {
                    setLoadingAction("recompute-pay");
                    setError(null);
                    try {
                      const pay = await recomputeFinalPay(selectedCaseId);
                      setPayEdits({
                        salary_balance:   String(pay.salary_balance   ?? 0),
                        leave_encashment: String(pay.leave_encashment ?? 0),
                        additional_pay:   String(pay.additional_pay   ?? 0),
                        deductions:       String(pay.deductions        ?? 0),
                      });
                      if (pay.computed_breakdown) {
                        setFinalPayBreakdown(pay.computed_breakdown);
                        setShowBreakdownDialog(true);
                      }
                      setSelectedDetail(prev => prev ? { ...prev, final_pay: pay } : prev);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Recompute failed — ensure a salary baseline is set in C&B.");
                    } finally {
                      setLoadingAction(null);
                    }
                  }}
                >
                  {loadingAction === "recompute-pay" ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                  Recompute from C&B
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {(!finalPay || (Number(finalPay.salary_balance) === 0 && Number(finalPay.total_amount) === 0)) && !paymentReleased && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  Final pay is empty. Make sure this employee has a <strong>salary baseline</strong> set in
                  <strong> C&B → Salary Baselines</strong>, then click <strong>Recompute from C&B</strong>.
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Salary Balance</Label>
                <Input type="text" placeholder="0.00" value={payEdits.salary_balance} onChange={e => setPayEdits(p => ({ ...p, salary_balance: e.target.value }))} className="bg-slate-50" disabled={!!isCompleted || paymentReleased} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Leave Encashment</Label>
                <Input type="text" placeholder="0.00" value={payEdits.leave_encashment} onChange={e => setPayEdits(p => ({ ...p, leave_encashment: e.target.value }))} className="bg-slate-50" disabled={!!isCompleted || paymentReleased} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Additional Pay</Label>
                <Input type="text" placeholder="0.00" value={payEdits.additional_pay} onChange={e => setPayEdits(p => ({ ...p, additional_pay: e.target.value }))} className="bg-slate-50" disabled={!!isCompleted || paymentReleased} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Deductions</Label>
                <Input type="text" placeholder="0.00" value={payEdits.deductions} onChange={e => setPayEdits(p => ({ ...p, deductions: e.target.value }))} className="bg-slate-50" disabled={!!isCompleted || paymentReleased} />
              </div>
              <div className="flex items-center justify-between text-sm font-medium pt-1">
                <span className="text-slate-500">Total Amount</span>
                <div className="flex items-center gap-2">
                  {finalPayBreakdown && (
                    <button type="button" onClick={() => setShowBreakdownDialog(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <FileText className="size-3" /> View Breakdown
                    </button>
                  )}
                  <span>${payTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              {finalPay?.settlement_payslip && (
                <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-800 space-y-1">
                  <p className="font-medium">Connected Final Settlement Slip</p>
                  <p>Slip ID: {finalPay.settlement_payslip.payslip_id}</p>
                  <p>Status: {finalPay.settlement_payslip.status}</p>
                  {finalPay.settlement_payslip.period?.payout_date && (
                    <p>Payout Date: {new Date(finalPay.settlement_payslip.period.payout_date).toLocaleDateString()}</p>
                  )}
                  <p>Net Pay: ${Number(finalPay.settlement_payslip.net_pay).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              )}
              {finalPay?.payroll_reference && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 space-y-1">
                  <p className="font-medium">Latest Regular Payroll Reference</p>
                  <p>Slip ID: {finalPay.payroll_reference.payslip_id}</p>
                  <p>Status: {finalPay.payroll_reference.status}</p>
                  {finalPay.payroll_reference.period?.cutoff_start_date && finalPay.payroll_reference.period?.cutoff_end_date && (
                    <p>
                      Coverage: {new Date(finalPay.payroll_reference.period.cutoff_start_date).toLocaleDateString()} to{" "}
                      {new Date(finalPay.payroll_reference.period.cutoff_end_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
              {!paymentReleased && !isCompleted && (
                <Button onClick={handleSaveFinalPay} disabled={loadingAction === "save-pay"} variant="outline" className="w-full text-sm">
                  {loadingAction === "save-pay" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Save Final Pay
                </Button>
              )}
              <div className={`flex items-center justify-between text-sm border rounded-md px-3 py-2.5 ${paymentReleased ? "bg-green-50 border-green-100" : "bg-yellow-50 border-yellow-100"}`}>
                <span className="text-slate-600">{paymentReleased ? "Payment Released" : "Payment Pending"}</span>
                <span className="font-medium">${(finalPay?.total_amount ?? payTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {!paymentReleased && !isCompleted && (
                <Button onClick={handleReleasePayment} disabled={loadingAction === "release-payment"} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                  {loadingAction === "release-payment" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Release Payment
                </Button>
              )}
              {paymentReleased && finalPay?.status !== "Transfer Confirmed" && (
                <Button onClick={handleConfirmBankTransfer} disabled={loadingAction === "confirm-transfer"} className="w-full bg-green-700 hover:bg-green-800 text-white">
                  {loadingAction === "confirm-transfer" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Confirm Bank Transfer
                </Button>
              )}
              {finalPay?.status === "Transfer Confirmed" && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-md px-3 py-2.5 text-sm text-green-700">
                  <CheckCircle className="size-4 shrink-0" /> Bank transfer confirmed.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Checklist Verification ── */}
      {showProgress && selectedDetail && checklistItems.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Checklist Verification</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {checklistItems.map(item => (
              <ChecklistRow
                key={item.item_id}
                item={item}
                employeeName={selectedDetail.employee_name ?? "—"}
                onView={() => setViewItem(item)}
                onVerify={id => handleSetItemStatus(id, "Verified")}
                onFlag={id => handleSetItemStatus(id, "Disputed")}
                isVerifying={loadingAction === `verified-${item.item_id}`}
                isFlagging={loadingAction === `disputed-${item.item_id}`}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Offboarding Overview ── */}
      {overviewCases.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Offboarding Pipeline</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Active and completed cases in one operational view.
                </p>
              </div>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                {overviewCases.length} case{overviewCases.length === 1 ? "" : "s"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Employee</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Last Working Day</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Submitted</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {overviewCases.map(c => {
                    const isActiveSelection = selectedCaseId === c.case_id;
                    return (
                      <tr
                        key={c.case_id}
                        className={`transition-colors ${isActiveSelection ? "bg-slate-50" : "hover:bg-slate-50/80"}`}
                      >
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{c.employee_name ?? "—"}</p>
                            <p className="text-xs text-slate-500">Case ID: {c.case_id.slice(0, 8)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                            {c.offboarding_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{fmtDate(c.last_working_day)}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtDate(c.created_at)}</td>
                        <td className="px-4 py-3">
                          <Badge className={getEmployeeBadgeCls(c.status)}>
                            {getEmployeeBadgeLabel(c.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant={isActiveSelection ? "default" : "outline"}
                            onClick={() => setSelectedCaseId(c.case_id)}
                            className={isActiveSelection ? "bg-slate-900 hover:bg-slate-800 text-white" : ""}
                          >
                            {isActiveSelection ? "Selected" : "View Details"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {false && overviewCases.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Offboarding Overview</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {overviewCases.map(c => (
              <button
                key={c.case_id}
                type="button"
                onClick={() => setSelectedCaseId(c.case_id)}
                className={`w-full text-left border rounded-md px-4 py-3 space-y-1 hover:bg-slate-50 ${selectedCaseId === c.case_id ? "border-slate-400 bg-slate-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.employee_name ?? "—"}</p>
                    <p className="text-xs text-slate-400">{c.offboarding_type}</p>
                  </div>
                  <Badge className={c.status === "Completed" ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200"}>
                    {c.status === "Completed" ? "Completed" : "In Progress"}
                  </Badge>
                </div>
                {c.status !== "Completed" && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Progress</span>
                      <span>In Progress</span>
                    </div>
                    <Progress value={50} className="[&>div]:bg-blue-400" />
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Clearance Certificate ── */}
      {showProgress && selectedDetail && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5 text-blue-500" /> Clearance Certificate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!clearanceReleased && !canGenerateClearance && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-md px-4 py-3 text-sm text-yellow-700">
                Verify all checklist items and release final pay to generate clearance.
              </div>
            )}
            {clearanceReleased && (
              <div className="bg-green-50 border border-green-100 rounded-md px-4 py-3 text-sm text-green-700">
                Clearance certificate has been generated and released to the employee.
              </div>
            )}
            <div className="border rounded-md px-4 py-4 text-sm text-slate-600 text-center leading-relaxed">
              This is to certify that <strong>{selectedDetail.employee_name}</strong> has completed
              all offboarding requirements and returned all company property. All financial obligations have been settled.
            </div>
            {!clearanceReleased && (
              <Button onClick={() => setShowClearanceModal(true)} disabled={!canGenerateClearance} className="w-full bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                <Shield className="size-4 mr-2" /> Generate Clearance
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Account Management ── */}
      {isCompleted && selectedDetail && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserMinus className="size-4 text-orange-500" /> Account Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2.5 text-xs text-blue-600">
              The employee account was deactivated automatically upon offboarding completion.
              You can archive it below to preserve records for compliance.
            </div>
            <Button onClick={() => handleSetAccountStatus("Archived")} disabled={loadingAction === "archive"} className="w-full bg-slate-400 hover:bg-slate-500 text-white">
              {loadingAction === "archive" ? <Loader2 className="size-4 animate-spin mr-2" /> : <Archive className="size-4 mr-2" />}
              Archive Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Job Posting ── */}
      {isCompleted && selectedDetail && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-indigo-500" /> Vacancy &amp; Job Posting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobPostingTriggered ? (
              <div className="bg-green-50 border border-green-100 rounded-md px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                <CheckCircle className="size-4 shrink-0" />
                Job posting has been created. The recruitment team has been notified.
              </div>
            ) : (
              <>
                <div className="bg-yellow-50 border border-yellow-100 rounded-md px-4 py-3 text-sm text-yellow-700">
                  The position vacated by <strong>{selectedDetail.employee_name}</strong> is pending re-opening.
                  Click below to create a job posting and notify the recruitment team.
                </div>
                <Button
                  onClick={handleTriggerJobPosting}
                  disabled={loadingAction === "trigger-job"}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {loadingAction === "trigger-job"
                    ? <Loader2 className="size-4 animate-spin mr-2" />
                    : <Plus className="size-4 mr-2" />
                  }
                  Trigger Job Posting
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}

// ── Final Pay Receipt ────────────────────────────────────────────────────────

function FinalPayReceiptView({
  breakdown,
  salaryBalance,
  leaveEncashment,
  additionalPay,
  deductions,
}: {
  readonly breakdown: FinalPayBreakdown;
  readonly salaryBalance: number;
  readonly leaveEncashment: number;
  readonly additionalPay: number;
  readonly deductions: number;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);

  const grossPay = salaryBalance + leaveEncashment + additionalPay;
  const netPay   = grossPay - deductions;
  const { attendance, statutory, tax } = breakdown;
  const dailyRate = breakdown.monthly_basic_equivalent > 0 ? breakdown.monthly_basic_equivalent / 22 : 0;

  return (
    <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-1">
      <div className="rounded-lg bg-slate-50 border px-3 py-2.5 text-xs space-y-0.5">
        <p className="font-semibold text-slate-700">Coverage Period</p>
        <p className="text-slate-500">
          {new Date(breakdown.covered_period_start).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
          {" – "}
          {new Date(breakdown.covered_period_end).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Attendance</p>
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          {([
            { label: "Scheduled", val: attendance.scheduledDays },
            { label: "Worked",    val: attendance.workedDays },
            { label: "Payable",   val: attendance.payableDays },
          ] as const).map(({ label, val }) => (
            <div key={label} className="border rounded-md px-2 py-1.5 text-center">
              <p className="text-slate-400 text-[10px]">{label}</p>
              <p className="font-semibold">{val}d</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Earnings</p>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span>Pro-rata Basic Pay</span>
            <span className="font-medium">{fmt(salaryBalance)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground text-xs pl-3">
            <span>{fmt(dailyRate)}/day × {attendance.payableDays} payable day(s)</span>
          </div>
          {leaveEncashment > 0 && (
            <>
              <div className="flex justify-between">
                <span>Leave Encashment</span>
                <span className="font-medium">{fmt(leaveEncashment)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs pl-3">
                <span>{breakdown.remaining_leave_days} remaining leave day(s) × {fmt(dailyRate)}/day</span>
              </div>
            </>
          )}
          {additionalPay > 0 && (
            <div className="flex justify-between">
              <span>Benefits &amp; Allowances</span>
              <span className="font-medium">{fmt(additionalPay)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between font-semibold border-t mt-2 pt-2">
          <span>Gross Pay</span>
          <span>{fmt(grossPay)}</span>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Deductions</p>
        <div className="space-y-1.5 text-muted-foreground">
          <div className="flex justify-between"><span>Income Tax (Withheld)</span><span>{fmt(tax)}</span></div>
          <div className="flex justify-between"><span>SSS (Employee Share)</span><span>{fmt(statutory.sss)}</span></div>
          <div className="flex justify-between"><span>PhilHealth (Employee Share)</span><span>{fmt(statutory.philhealth)}</span></div>
          <div className="flex justify-between"><span>Pag-IBIG</span><span>{fmt(statutory.pagibig)}</span></div>
        </div>
        <div className="flex justify-between font-semibold border-t mt-2 pt-2 text-rose-700">
          <span>Total Deductions</span><span>{fmt(deductions)}</span>
        </div>
      </div>

      <div className="rounded-lg bg-emerald-50 border-emerald-200 border p-3 flex justify-between items-center">
        <span className="font-bold text-emerald-900">Net Final Pay</span>
        <span className="font-bold text-emerald-900 text-lg">{fmt(netPay)}</span>
      </div>
    </div>
  );
}
