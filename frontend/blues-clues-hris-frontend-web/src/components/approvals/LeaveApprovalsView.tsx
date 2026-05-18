"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Baby, CalendarDays, CheckCircle, ChevronDown, ChevronRight, Clock,
  ExternalLink, Heart, HelpCircle, Home, Loader2,
  Palmtree, Paperclip, RotateCcw, Search, Stethoscope, User, XCircle, Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  getLeaveRequestsForApproval,
  reviewLeaveRequestApi,
  reviewLeaveRevocationApi,
  type LeaveRequestForApproval,
} from "@/lib/payrollApi";

const LEAVE_TYPE_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}> = {
  "Sick Leave":      { icon: Stethoscope, color: "text-rose-600",   bg: "bg-rose-50",   border: "border-rose-200"   },
  "Emergency Leave": { icon: Zap,         color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  "WFH / Remote":    { icon: Home,        color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200"   },
  "Personal Leave":  { icon: User,        color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  "Vacation Leave":  { icon: Palmtree,    color: "text-teal-600",   bg: "bg-teal-50",   border: "border-teal-200"   },
  "Maternity Leave": { icon: Baby,        color: "text-pink-600",   bg: "bg-pink-50",   border: "border-pink-200"   },
  "Paternity Leave": { icon: Heart,       color: "text-sky-600",    bg: "bg-sky-50",    border: "border-sky-200"    },
  "Other":           { icon: HelpCircle,  color: "text-slate-500",  bg: "bg-slate-50",  border: "border-slate-200"  },
};

function getLeaveConfig(leaveType: string) {
  return LEAVE_TYPE_CONFIG[leaveType] ?? LEAVE_TYPE_CONFIG["Other"];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function employeeInitials(req: LeaveRequestForApproval) {
  if (!req.employee) return "?";
  return `${req.employee.first_name[0] ?? ""}${req.employee.last_name[0] ?? ""}`.toUpperCase();
}

function statusBadgeClass(status: string) {
  if (status === "Approved") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  if (status === "Rejected") return "bg-rose-100 text-rose-700 border border-rose-200";
  if (status === "revocation_requested") return "bg-purple-100 text-purple-700 border border-purple-200";
  return "bg-amber-100 text-amber-700 border border-amber-200";
}

function statusLabel(status: string) {
  if (status === "revocation_requested") return "Revocation Requested";
  return status;
}

const FILTERS = ["Pending", "revocation_requested", "Approved", "Rejected", "all"] as const;
type Filter = typeof FILTERS[number];

export default function LeaveApprovalsView() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestForApproval[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(true);
  const [leaveFilter, setLeaveFilter] = useState<Filter>("Pending");
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestForApproval | null>(null);
  const [approveDialogId, setApproveDialogId] = useState<string | null>(null);
  const [submittingApprove, setSubmittingApprove] = useState(false);
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);
  const [revocationDialogId, setRevocationDialogId] = useState<string | null>(null);
  const [revocationAction, setRevocationAction] = useState<"approve" | "reject" | null>(null);
  const [submittingRevocation, setSubmittingRevocation] = useState(false);
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>("all");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const loadLeaveRequests = async () => {
    setLeaveLoading(true);
    try {
      const data = await getLeaveRequestsForApproval(undefined);
      setLeaveRequests(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leave requests");
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    void loadLeaveRequests();
  }, []);

  const handleApproveLeave = async () => {
    if (!approveDialogId) return;
    setSubmittingApprove(true);
    try {
      await reviewLeaveRequestApi(approveDialogId, "Approved");
      toast.success("Leave request approved.");
      setApproveDialogId(null);
      setSelectedRequest(null);
      void loadLeaveRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve leave");
    } finally {
      setSubmittingApprove(false);
    }
  };

  const handleRejectLeave = async () => {
    if (!rejectDialogId) return;
    setSubmittingReject(true);
    try {
      await reviewLeaveRequestApi(rejectDialogId, "Rejected", rejectReason || undefined);
      toast.success("Leave request rejected.");
      setRejectDialogId(null);
      setRejectReason("");
      setSelectedRequest(null);
      void loadLeaveRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject leave");
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleRevocationReview = async () => {
    if (!revocationDialogId || !revocationAction) return;
    setSubmittingRevocation(true);
    try {
      await reviewLeaveRevocationApi(revocationDialogId, revocationAction);
      toast.success(revocationAction === "approve" ? "Revocation approved." : "Revocation rejected.");
      setRevocationDialogId(null);
      setRevocationAction(null);
      setSelectedRequest(null);
      void loadLeaveRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process revocation");
    } finally {
      setSubmittingRevocation(false);
    }
  };

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const activeAll = useMemo(() => leaveRequests.filter(r => r.end_date >= today), [leaveRequests, today]);

  /* Group requests by employee */
  function groupByEmployee(
    reqs: LeaveRequestForApproval[],
  ): { employee: LeaveRequestForApproval["employee"]; requests: LeaveRequestForApproval[] }[] {
    const map = new Map<string, { employee: LeaveRequestForApproval["employee"]; requests: LeaveRequestForApproval[] }>();
    for (const req of reqs) {
      if (!map.has(req.user_id)) map.set(req.user_id, { employee: req.employee, requests: [] });
      map.get(req.user_id)!.requests.push(req);
    }
    return Array.from(map.values());
  }

  /* Active tab: future/ongoing only, status + type + employee search filtered */
  const grouped = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    const filtered = activeAll.filter(r => {
      if (leaveFilter !== "all" && r.status !== leaveFilter) return false;
      if (leaveTypeFilter !== "all" && r.leave_type !== leaveTypeFilter) return false;
      if (q) {
        const name = `${r.employee?.first_name ?? ""} ${r.employee?.last_name ?? ""}`.toLowerCase();
        const empId = (r.employee?.employee_id ?? "").toLowerCase();
        if (!name.includes(q) && !empId.includes(q)) return false;
      }
      return true;
    });
    return groupByEmployee(filtered);
  }, [activeAll, leaveFilter, leaveTypeFilter, employeeSearch]);

  /* Past tab: only past requests, type + employee search filtered, sorted by date desc */
  const pastGrouped = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    const filtered = leaveRequests
      .filter(r => {
        if (r.end_date >= today) return false;
        if (leaveTypeFilter !== "all" && r.leave_type !== leaveTypeFilter) return false;
        if (q) {
          const name = `${r.employee?.first_name ?? ""} ${r.employee?.last_name ?? ""}`.toLowerCase();
          const empId = (r.employee?.employee_id ?? "").toLowerCase();
          if (!name.includes(q) && !empId.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
    return groupByEmployee(filtered).sort((a, b) => {
      const aName = `${a.employee?.first_name ?? ""} ${a.employee?.last_name ?? ""}`;
      const bName = `${b.employee?.first_name ?? ""} ${b.employee?.last_name ?? ""}`;
      return aName.localeCompare(bName);
    });
  }, [leaveRequests, today, leaveTypeFilter, employeeSearch]);

  const [viewTab, setViewTab] = useState<"active" | "past">("active");

  const pendingCount = activeAll.filter(r => r.status === "Pending").length;
  const approvedCount = activeAll.filter(r => r.status === "Approved").length;
  const rejectedCount = activeAll.filter(r => r.status === "Rejected").length;
  const revocationCount = activeAll.filter(r => r.status === "revocation_requested").length;

  /* Shared leave request card renderer */
  function renderRequestCard(req: LeaveRequestForApproval) {
    const cfg = getLeaveConfig(req.leave_type);
    const Icon = cfg.icon;
    const hasAttachment = !!req.attachment_url;
    return (
      <button
        key={req.request_id}
        type="button"
        onClick={() => setSelectedRequest(req)}
        className="w-full text-left rounded-xl border bg-background px-3.5 py-3 flex items-center gap-3 hover:bg-muted/30 hover:border-primary/20 transition-all duration-150 cursor-pointer group"
      >
        <div className={`shrink-0 p-1.5 rounded-lg ${cfg.bg} border ${cfg.border}`}>
          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{req.leave_type}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(req.start_date)}
            {req.end_date !== req.start_date ? ` – ${formatDate(req.end_date)}` : ""}
            {" · "}{req.total_days}d
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasAttachment && <Paperclip className="h-3 w-3 text-muted-foreground/50" />}
          <Badge className={statusBadgeClass(req.status)}>{statusLabel(req.status)}</Badge>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        </div>
      </button>
    );
  }

  function renderEmployeeGroup(
    { employee, requests }: { employee: LeaveRequestForApproval["employee"]; requests: LeaveRequestForApproval[] },
    showActionableBadge = true,
  ) {
    const empName = employee ? `${employee.first_name} ${employee.last_name}` : "Unknown Employee";
    const empId = employee?.employee_id;
    const actionable = requests.filter(r => r.status === "Pending" || r.status === "revocation_requested").length;
    return (
      <div key={employee?.user_id ?? empName} className="space-y-2">
        <div className="flex items-center gap-2.5 px-1">
          <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">
              {employee ? `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase() : "?"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{empName}</p>
            {empId && (
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                {empId}
              </span>
            )}
          </div>
          {showActionableBadge && actionable > 0 && (
            <span className="shrink-0 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
              {actionable} pending
            </span>
          )}
          {!showActionableBadge && (
            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
              {requests.length} request{requests.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="space-y-1.5 pl-9">
          {requests.map(req => renderRequestCard(req))}
        </div>
      </div>
    );
  }

  /* Shared type dropdown — rendered in both tabs */
  function renderTypeDropdown() {
    const activeCfg = LEAVE_TYPE_CONFIG[leaveTypeFilter];
    const ActiveIcon = activeCfg?.icon;
    return (
      <div className="relative" ref={typeDropdownRef}>
        <button
          type="button"
          onClick={() => setTypeDropdownOpen(o => !o)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-150 cursor-pointer ${
            leaveTypeFilter !== "all"
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
          }`}
        >
          {ActiveIcon && <ActiveIcon className="h-3 w-3 shrink-0" />}
          {leaveTypeFilter === "all" ? "Type" : leaveTypeFilter}
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${typeDropdownOpen ? "rotate-180" : ""}`} />
        </button>
        {typeDropdownOpen && (
          <div className="absolute top-full right-0 mt-1.5 z-50 w-56 rounded-2xl border border-border bg-background shadow-xl py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
            {["all", ...Object.keys(LEAVE_TYPE_CONFIG)].map((t) => {
              const cfg = LEAVE_TYPE_CONFIG[t];
              const Icon = cfg?.icon;
              const isActive = leaveTypeFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setLeaveTypeFilter(t); setTypeDropdownOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors cursor-pointer ${
                    isActive ? "font-bold text-foreground" : "font-semibold text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                  }`}
                >
                  {Icon ? <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} /> : <span className="h-3.5 w-3.5 shrink-0" />}
                  {t === "all" ? "All Types" : t}
                  {isActive && <CheckCircle className="h-3 w-3 ml-auto text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5 animate-in fade-in duration-500">

        {/* Stats — active requests only */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Pending",              value: pendingCount,    color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200",  icon: Clock       },
            { label: "revocation_requested", value: revocationCount, color: "text-purple-600", bg: "bg-purple-50",  border: "border-purple-200", icon: RotateCcw   },
            { label: "Approved",             value: approvedCount,   color: "text-emerald-600",bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle },
            { label: "Rejected",             value: rejectedCount,   color: "text-rose-600",   bg: "bg-rose-50",    border: "border-rose-200",   icon: XCircle     },
          ].map(({ label, value, color, bg, border, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => { setViewTab("active"); setLeaveFilter(label as Filter); }}
              className={`rounded-xl border px-4 py-3 flex items-center gap-3 text-left transition-all duration-150 cursor-pointer ${
                viewTab === "active" && leaveFilter === label
                  ? `${bg} ${border} ring-2 ring-offset-1 ${border.replace("border", "ring")}`
                  : `bg-background border-border hover:${bg}`
              }`}
            >
              <div className={`p-1.5 rounded-lg ${bg} border ${border}`}>
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {label === "revocation_requested" ? "Revocation" : label}
                </p>
                <p className={`text-xl font-bold tracking-tight ${color}`}>
                  {leaveLoading ? "—" : value}
                </p>
              </div>
            </button>
          ))}
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="pb-0">
            {/* Tab switcher */}
            <div className="flex items-center gap-1 border-b border-border pb-0">
              {(["active", "past"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setViewTab(tab); setEmployeeSearch(""); setLeaveTypeFilter("all"); setTypeDropdownOpen(false); }}
                  className={`relative px-4 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                    viewTab === tab
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "active" ? "Active Requests" : "Past / History"}
                  {tab === "active" && !leaveLoading && activeAll.length > 0 && (
                    <span className="ml-2 text-[10px] font-bold bg-foreground text-background rounded-full px-1.5 py-0.5">
                      {activeAll.length}
                    </span>
                  )}
                  {viewTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {/* ── ACTIVE TAB ── */}
            {viewTab === "active" && (
              <>
                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {FILTERS.map((f) => {
                    const countMap: Record<string, number> = {
                      Pending: pendingCount, revocation_requested: revocationCount,
                      Approved: approvedCount, Rejected: rejectedCount,
                    };
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setLeaveFilter(f)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-150 cursor-pointer ${
                          leaveFilter === f
                            ? "bg-foreground text-background border-foreground"
                            : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                        }`}
                      >
                        {f === "all" ? "All" : f === "revocation_requested" ? "Revocation" : f}
                        {f !== "all" && !leaveLoading && (
                          <span className="ml-1.5 opacity-60">{countMap[f] ?? 0}</span>
                        )}
                      </button>
                    );
                  })}
                  <div className="relative flex items-center ml-auto">
                    <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={employeeSearch}
                      onChange={e => setEmployeeSearch(e.target.value)}
                      placeholder="Search employee…"
                      className="h-8 w-44 rounded-full border border-border bg-background pl-8 pr-3 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-150"
                    />
                    {employeeSearch && (
                      <button type="button" onClick={() => setEmployeeSearch("")} className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {renderTypeDropdown()}
                </div>

                {leaveLoading ? (
                  <div className="min-h-40 flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : grouped.length === 0 ? (
                  <div className="min-h-36 flex flex-col items-center justify-center gap-2 text-center">
                    <div className="p-3 rounded-full bg-muted/40">
                      <CalendarDays className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No active requests</p>
                    <p className="text-xs text-muted-foreground/60">
                      {leaveFilter === "Pending" ? "All caught up — no pending requests." : "No matching requests."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {grouped.map(g => renderEmployeeGroup(g, true))}
                  </div>
                )}
              </>
            )}

            {/* ── PAST TAB ── */}
            {viewTab === "past" && (
              <>
                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <div className="relative flex items-center">
                    <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={employeeSearch}
                      onChange={e => setEmployeeSearch(e.target.value)}
                      placeholder="Search employee…"
                      className="h-8 w-52 rounded-full border border-border bg-background pl-8 pr-3 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-150"
                    />
                    {employeeSearch && (
                      <button type="button" onClick={() => setEmployeeSearch("")} className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="ml-auto">{renderTypeDropdown()}</div>
                  {!leaveLoading && (
                    <span className="text-xs text-muted-foreground">
                      {pastGrouped.reduce((s, g) => s + g.requests.length, 0)} records · {pastGrouped.length} employee{pastGrouped.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {leaveLoading ? (
                  <div className="min-h-40 flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : pastGrouped.length === 0 ? (
                  <div className="min-h-36 flex flex-col items-center justify-center gap-2 text-center">
                    <div className="p-3 rounded-full bg-muted/40">
                      <CalendarDays className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No past records</p>
                    <p className="text-xs text-muted-foreground/60">Past leave history will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {pastGrouped.map(g => renderEmployeeGroup(g, false))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail + action modal */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) setSelectedRequest(null); }}>
        <DialogContent className="max-w-lg overflow-y-auto max-h-[90vh] rounded-2xl">
          {selectedRequest && (() => {
            const cfg = getLeaveConfig(selectedRequest.leave_type);
            const Icon = cfg.icon;
            const isPending = selectedRequest.status === "Pending";
            const isApproved = selectedRequest.status === "Approved";
            const isRejected = selectedRequest.status === "Rejected";
            const isRevocationRequested = selectedRequest.status === "revocation_requested";
            const isImage = selectedRequest.attachment_url && /\.(jpe?g|png|webp)$/i.test(selectedRequest.attachment_url);
            const isPdf = selectedRequest.attachment_url && /\.pdf$/i.test(selectedRequest.attachment_url);

            return (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl ${cfg.bg} border ${cfg.border} shrink-0`}>
                      <Icon className={`h-5 w-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-base font-bold">{selectedRequest.leave_type}</DialogTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedRequest.employee
                          ? `${selectedRequest.employee.first_name} ${selectedRequest.employee.last_name}`
                          : "Unknown Employee"}
                        {selectedRequest.employee?.employee_id ? ` · ${selectedRequest.employee.employee_id}` : ""}
                      </p>
                    </div>
                    <Badge className={`${statusBadgeClass(selectedRequest.status)} shrink-0`}>
                      {statusLabel(selectedRequest.status)}
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-4 pt-1">
                  {/* Date + days */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "From", value: formatDate(selectedRequest.start_date) },
                      { label: "To",   value: formatDate(selectedRequest.end_date)   },
                      { label: "Days", value: String(selectedRequest.total_days)     },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border bg-muted/20 px-3 py-2.5">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
                        <p className="text-sm font-semibold mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  {selectedRequest.reason && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Description</p>
                      <p className="text-sm text-foreground bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-200">
                        {selectedRequest.reason}
                      </p>
                    </div>
                  )}

                  {/* Attachment */}
                  {selectedRequest.attachment_url && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                        Proof / Attachment
                      </p>
                      {isImage ? (
                        <a href={selectedRequest.attachment_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={selectedRequest.attachment_url}
                            alt="Leave proof"
                            className="w-full rounded-xl border object-cover max-h-64 hover:opacity-90 transition-opacity cursor-zoom-in"
                          />
                        </a>
                      ) : isPdf ? (
                        <a
                          href={selectedRequest.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <div className="p-2 bg-rose-100 rounded-lg shrink-0">
                            <Paperclip className="h-4 w-4 text-rose-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">View PDF Document</p>
                            <p className="text-xs text-muted-foreground">Opens in new tab</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </a>
                      ) : (
                        <a
                          href={selectedRequest.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          View Attachment
                        </a>
                      )}
                    </div>
                  )}

                  {/* Review result */}
                  {(isApproved || isRejected) && (
                    <div className={`rounded-xl border px-4 py-3 space-y-1.5 ${
                      isApproved ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
                    }`}>
                      <div className={`flex items-center gap-1.5 text-sm font-semibold ${isApproved ? "text-emerald-700" : "text-rose-700"}`}>
                        {isApproved ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {isApproved ? "Approved" : "Rejected"}
                      </div>
                      {selectedRequest.reviewed_at && (
                        <p className={`text-xs ${isApproved ? "text-emerald-600" : "text-rose-600"}`}>
                          {formatDate(selectedRequest.reviewed_at.split("T")[0])}
                        </p>
                      )}
                      {isRejected && selectedRequest.rejection_reason && (
                        <p className="text-xs text-rose-700 pt-1.5 border-t border-rose-200">
                          <span className="font-semibold">Reason: </span>{selectedRequest.rejection_reason}
                        </p>
                      )}
                    </div>
                  )}

                  {isPending && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                      <p className="text-xs font-semibold text-amber-700">Awaiting HR review</p>
                    </div>
                  )}

                  {isRevocationRequested && (
                    <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-purple-700">
                        <RotateCcw className="h-4 w-4" />
                        Employee requested revocation
                      </div>
                      {selectedRequest.revocation_reason && (
                        <p className="text-xs text-purple-700 pt-1 border-t border-purple-200">
                          <span className="font-semibold">Reason: </span>{selectedRequest.revocation_reason}
                        </p>
                      )}
                    </div>
                  )}

                  {isRevocationRequested && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        onClick={() => { setRevocationDialogId(selectedRequest.request_id); setRevocationAction("approve"); }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                        Approve Revocation
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                        onClick={() => { setRevocationDialogId(selectedRequest.request_id); setRevocationAction("reject"); }}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        Reject Revocation
                      </Button>
                    </div>
                  )}

                  {isPending && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        onClick={() => setApproveDialogId(selectedRequest.request_id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                        onClick={() => {
                          setRejectDialogId(selectedRequest.request_id);
                          setRejectReason("");
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Approve confirmation */}
      <Dialog open={!!approveDialogId} onOpenChange={(open) => { if (!open) setApproveDialogId(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Approve this leave request? Employee will be notified and leave balance deducted.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setApproveDialogId(null)} className="cursor-pointer">Cancel</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                disabled={submittingApprove}
                onClick={() => void handleApproveLeave()}
              >
                {submittingApprove
                  ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  : <CheckCircle className="h-4 w-4 mr-1" />}
                Confirm Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revocation review dialog */}
      <Dialog
        open={!!revocationDialogId}
        onOpenChange={(open) => { if (!open) { setRevocationDialogId(null); setRevocationAction(null); } }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {revocationAction === "approve" ? "Approve Revocation" : "Reject Revocation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {revocationAction === "approve"
                ? "Approve this revocation? The leave will be cancelled and balance restored."
                : "Reject this revocation? The approved leave will remain in effect."}
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => { setRevocationDialogId(null); setRevocationAction(null); }}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                className={revocationAction === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  : "bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"}
                disabled={submittingRevocation}
                onClick={() => void handleRevocationReview()}
              >
                {submittingRevocation
                  ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  : revocationAction === "approve"
                    ? <CheckCircle className="h-4 w-4 mr-1" />
                    : <XCircle className="h-4 w-4 mr-1" />}
                Confirm {revocationAction === "approve" ? "Approve" : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialogId} onOpenChange={(open) => { if (!open) setRejectDialogId(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejection (optional). Employee will be notified by email.
            </p>
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectDialogId(null)} className="cursor-pointer">Cancel</Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                disabled={submittingReject}
                onClick={() => void handleRejectLeave()}
              >
                {submittingReject ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                Confirm Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
