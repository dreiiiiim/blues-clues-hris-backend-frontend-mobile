"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Baby, CalendarDays, CheckCircle, CheckCircle2, ChevronDown, ChevronRight, Heart,
  Loader2, Palmtree, Paperclip, Plus, RotateCcw, Send, Stethoscope, User, X, XCircle, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  cancelPendingLeaveApi, fileLeaveRequestApi, getMyLeaveBalances, getMyLeaveRequests, requestLeaveRevocationApi, uploadLeaveAttachmentApi,
  type LeaveBalanceCard, type LeaveReason, type LeaveRequestItem,
} from "@/lib/authApi";
import { toast } from "sonner";

const LEAVE_REASON_CONFIG: {
  value: LeaveReason;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  activeBg: string;
  requiresAttachment?: boolean;
}[] = [
  { value: "Sick Leave",       icon: Stethoscope, color: "text-rose-600",   bg: "bg-rose-50",   border: "border-rose-200",   activeBg: "bg-rose-600",   requiresAttachment: true  },
  { value: "Emergency Leave",  icon: Zap,         color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", activeBg: "bg-orange-600"  },
  { value: "Personal Leave",   icon: User,        color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", activeBg: "bg-violet-600"  },
  { value: "Vacation Leave",   icon: Palmtree,    color: "text-teal-600",   bg: "bg-teal-50",   border: "border-teal-200",   activeBg: "bg-teal-600"    },
  { value: "Maternity Leave",  icon: Baby,        color: "text-pink-600",   bg: "bg-pink-50",   border: "border-pink-200",   activeBg: "bg-pink-600",   requiresAttachment: true  },
  { value: "Paternity Leave",  icon: Heart,       color: "text-sky-600",    bg: "bg-sky-50",    border: "border-sky-200",    activeBg: "bg-sky-600",    requiresAttachment: true  },
];

const BALANCE_CARD_STYLES: Record<string, { ring: string; tint: string; icon: React.ElementType }> = {
  Vacation: { ring: "border-teal-200/80", tint: "from-teal-50 to-white", icon: Palmtree },
  Sick: { ring: "border-rose-200/80", tint: "from-rose-50 to-white", icon: Stethoscope },
  Emergency: { ring: "border-orange-200/80", tint: "from-orange-50 to-white", icon: Zap },
  Personal: { ring: "border-violet-200/80", tint: "from-violet-50 to-white", icon: User },
  Maternity: { ring: "border-pink-200/80", tint: "from-pink-50 to-white", icon: Baby },
  Paternity: { ring: "border-sky-200/80", tint: "from-sky-50 to-white", icon: Heart },
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function EmployeeLeavePage() {
  const [balances, setBalances] = useState<LeaveBalanceCard[]>([]);
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveReason>("Vacation Leave");
  const [reason, setReason] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestItem | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "pending" | "approved" | "rejected" | "revoked" | "cancelled" | "revocation_requested">("all");
  const [historyTab, setHistoryTab] = useState<"active" | "past">("active");
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revocationReason, setRevocationReason] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>("all");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const minSickDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  }, []);
  const selectedConfig = LEAVE_REASON_CONFIG.find(c => c.value === leaveType)!;
  const attachmentRequired = selectedConfig?.requiresAttachment ?? false;
  const retroactiveOnly = leaveType === "Sick Leave";

  const overlapConflict = useMemo(() => {
    if (!startDate || !endDate) return null;
    for (const req of requests) {
      if (req.status === 'rejected' || req.status === 'revoked') continue;
      const rs = req.start_date ?? req.date;
      const re = req.end_date ?? rs;
      if (rs <= endDate && re >= startDate) {
        return { req, isHard: req.status === 'approved' };
      }
    }
    return null;
  }, [startDate, endDate, requests]);

  const loadingBalanceCards: LeaveBalanceCard[] = [
    { type: "Vacation", remaining: null, total: null },
    { type: "Sick", remaining: null, total: null },
    { type: "Emergency", remaining: null, total: null },
    { type: "Personal", remaining: null, total: null },
    { type: "Maternity", remaining: null, total: null },
    { type: "Paternity", remaining: null, total: null },
  ];
  const balanceCards = loading ? loadingBalanceCards : balances;

  function renderBalanceContent(item: LeaveBalanceCard) {
    if (item.remaining == null || item.total == null) {
      return (
        <>
          <div className="h-7 w-20 bg-muted rounded animate-pulse" />
          <div className="mt-3 h-1.5 w-full bg-muted rounded-full" />
        </>
      );
    }
    const used = item.total - item.remaining;
    const pct = item.total > 0 ? Math.round((used / item.total) * 100) : 0;
    const barColor = pct >= 80 ? "bg-rose-500" : pct >= 50 ? "bg-amber-400" : "bg-emerald-500";
    return (
      <>
        <p className="text-2xl font-bold tracking-tight">
          {item.remaining}
          <span className="text-sm text-muted-foreground font-medium"> / {item.total}</span>
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{used} used</p>
        <div className="mt-2.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </>
    );
  }

  async function loadData() {
    setLoading(true);
    try {
      const [b, r] = await Promise.all([getMyLeaveBalances(), getMyLeaveRequests()]);
      setBalances(b);
      setRequests(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leave data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function resetModal() {
    setReason("");
    setStartDate("");
    setEndDate("");
    setLeaveType("Vacation Leave");
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmitLeave() {
    if (!startDate) { toast.error("Please select a start date."); return; }
    if (!endDate) { toast.error("Please select an end date."); return; }
    if (!reason.trim()) { toast.error("Please provide a reason."); return; }
    if (attachmentRequired && !attachmentFile) {
      toast.error(`${leaveType} requires a proof attachment (image or PDF).`);
      return;
    }

    setSubmitting(true);
    try {
      let attachment_url: string | undefined;

      if (attachmentFile) {
        try {
          const result = await uploadLeaveAttachmentApi(attachmentFile);
          attachment_url = result.url;
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to upload attachment.");
          return;
        }
      }

      await fileLeaveRequestApi({
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        attachment_url,
      });
      toast.success("Leave request filed.");
      setModalOpen(false);
      resetModal();
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to file leave");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelPending() {
    if (!selectedRequest) return;
    setRevoking(true);
    try {
      await cancelPendingLeaveApi(selectedRequest.request_id);
      toast.success("Leave request cancelled.");
      setRevokeDialogOpen(false);
      setSelectedRequest(null);
      setRevocationReason("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel leave");
    } finally {
      setRevoking(false);
    }
  }

  async function handleRequestRevocation() {
    if (!selectedRequest) return;
    if (!revocationReason.trim()) { toast.error("Please provide a reason."); return; }
    setRevoking(true);
    try {
      await requestLeaveRevocationApi(selectedRequest.request_id, revocationReason.trim());
      toast.success("Revocation request submitted. HR will review it.");
      setRevokeDialogOpen(false);
      setSelectedRequest(null);
      setRevocationReason("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request revocation");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="rounded-[26px] bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] text-white px-8 py-10 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60 mb-2">Employee Portal</p>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Leave Dashboard</h1>
        <p className="text-sm text-white/70 max-w-xl">Track your leave balances and file a leave request.</p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">Balances</h2>
        <Dialog open={modalOpen} onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetModal();
        }}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer">
              <Plus className="h-4 w-4 mr-2" />
              File a Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>File a Leave Request</DialogTitle>
            </DialogHeader>

            <div className="space-y-5 pt-1">
              {/* Leave type chips */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  Leave Type <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {LEAVE_REASON_CONFIG.map(({ value, icon: Icon, color, bg, border, activeBg, requiresAttachment: req }) => {
                    const isActive = leaveType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setLeaveType(value);
                          setStartDate("");
                          setEndDate("");
                          setAttachmentFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                          isActive
                            ? `${activeBg} border-transparent text-white`
                            : `${bg} ${border} hover:border-slate-300`
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : color}`} />
                        <span className={`text-xs font-bold leading-tight ${isActive ? "text-white" : "text-foreground"}`}>
                          {value}
                          {req && <span className={`ml-1 ${isActive ? "text-white/70" : "text-red-500"}`}>*</span>}
                        </span>
                        {isActive && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-white ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date range */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  Leave Period <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">From</span>
                    <input
                      type="date"
                      {...(retroactiveOnly ? { min: minSickDate, max: today } : { min: today })}
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (endDate && endDate < e.target.value) setEndDate(e.target.value);
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">To</span>
                    <input
                      type="date"
                      {...(retroactiveOnly
                        ? { min: startDate || minSickDate, max: today }
                        : { min: startDate || today })}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                </div>
              </div>

              {/* Overlap conflict warning */}
              {overlapConflict && (
                <div className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border ${
                  overlapConflict.isHard
                    ? "bg-rose-50 border-rose-300"
                    : "bg-amber-50 border-amber-300"
                }`}>
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${overlapConflict.isHard ? "text-rose-600" : "text-amber-600"}`} />
                  <div>
                    <p className={`text-xs font-bold ${overlapConflict.isHard ? "text-rose-700" : "text-amber-700"}`}>
                      {overlapConflict.isHard ? "Cannot file — date conflict" : "Overlapping pending request"}
                    </p>
                    <p className={`text-xs mt-0.5 ${overlapConflict.isHard ? "text-rose-600" : "text-amber-600"}`}>
                      You already have {overlapConflict.isHard ? "an approved" : "a pending"}{" "}
                      <span className="font-semibold">{overlapConflict.req.leave_type}</span>{" "}
                      from {formatDate(overlapConflict.req.start_date ?? overlapConflict.req.date)}
                      {overlapConflict.req.end_date && overlapConflict.req.end_date !== (overlapConflict.req.start_date ?? overlapConflict.req.date)
                        ? ` – ${formatDate(overlapConflict.req.end_date)}` : ""}.
                      {overlapConflict.isHard ? " Revoke it first to re-file." : ""}
                    </p>
                  </div>
                </div>
              )}

              {/* Selected summary chip */}
              {startDate && (
                <div className={`flex items-start gap-3 px-3.5 py-3 rounded-xl ${selectedConfig.bg} ${selectedConfig.border} border`}>
                  <selectedConfig.icon className={`h-4 w-4 mt-0.5 ${selectedConfig.color}`} />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Requesting: <span className={`font-bold ${selectedConfig.color}`}>{leaveType}</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {!endDate || startDate === endDate
                        ? formatDate(startDate)
                        : `${formatDate(startDate)} – ${formatDate(endDate)}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Reason / notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Reason <span className="text-red-500">*</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">{reason.length}/500</p>
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 500))}
                  placeholder="Explain your leave request..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 resize-none transition-colors"
                />
              </div>

              {/* Attachment */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                  Proof / Attachment{attachmentRequired
                    ? <span className="text-red-500 ml-1">* required</span>
                    : <span className="text-slate-400 ml-1">(optional)</span>}
                </p>
                {attachmentFile ? (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                    <Paperclip className="h-4 w-4 text-slate-500 shrink-0" />
                    <span className="text-xs text-foreground font-medium truncate flex-1">{attachmentFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="shrink-0 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                    <Paperclip className="h-5 w-5 text-slate-400" />
                    <span className="text-xs text-slate-500 text-center">
                      Click to upload JPG, PNG, WebP, or PDF (max 5MB)
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>

              <Button onClick={handleSubmitLeave} disabled={submitting || (overlapConflict?.isHard ?? false)} className="w-full cursor-pointer">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {balanceCards.map((item, idx) => (
          <Card
            key={loading ? idx : item.type}
            className={`border shadow-sm bg-gradient-to-br ${
              BALANCE_CARD_STYLES[item.type]?.ring ?? "border-slate-200"
            } ${
              BALANCE_CARD_STYLES[item.type]?.tint ?? "from-slate-50 to-white"
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = BALANCE_CARD_STYLES[item.type]?.icon ?? CalendarDays;
                  return <Icon className="h-3.5 w-3.5 text-slate-500" />;
                })()}
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {loading ? <span className="inline-block h-3 w-16 bg-muted rounded animate-pulse" /> : `${item.type} Leave`}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {renderBalanceContent(item)}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Leave History
              </CardTitle>
              <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
                {(["active", "past"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setHistoryTab(tab)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      historyTab === tab
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "active" ? "Active / Upcoming" : "Past / History"}
                  </button>
                ))}
              </div>
            </div>
            {!loading && requests.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status filter */}
                {(["all", "pending", "approved", "rejected", "revoked", "cancelled", "revocation_requested"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setHistoryFilter(f)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all duration-150 cursor-pointer ${
                      historyFilter === f
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                    }`}
                  >
                    {f === "all" ? "All" : f === "revocation_requested" ? "Revocation" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
                {/* Leave type dropdown */}
                <div className="relative" ref={typeDropdownRef}>
                  {(() => {
                    const activeCfg = LEAVE_REASON_CONFIG.find(c => c.value === leaveTypeFilter);
                    const ActiveIcon = activeCfg?.icon;
                    return (
                      <button
                        type="button"
                        onClick={() => setTypeDropdownOpen(o => !o)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all duration-150 cursor-pointer ${
                          leaveTypeFilter !== "all"
                            ? "bg-foreground text-background border-foreground"
                            : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                        }`}
                      >
                        {ActiveIcon && <ActiveIcon className="h-2.5 w-2.5 shrink-0" />}
                        {leaveTypeFilter === "all" ? "Type" : leaveTypeFilter}
                        <ChevronDown className={`h-2.5 w-2.5 shrink-0 transition-transform duration-200 ${typeDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                    );
                  })()}
                  {typeDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 z-50 w-52 rounded-2xl border border-border bg-background shadow-xl py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                      {["all", ...LEAVE_REASON_CONFIG.map(c => c.value)].map((t) => {
                        const cfg = LEAVE_REASON_CONFIG.find(c => c.value === t);
                        const Icon = cfg?.icon;
                        const isActive = leaveTypeFilter === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => { setLeaveTypeFilter(t); setTypeDropdownOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors cursor-pointer ${
                              isActive
                                ? "font-bold text-foreground"
                                : "font-semibold text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                            }`}
                          >
                            {Icon
                              ? <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg?.color ?? ""}`} />
                              : <span className="h-3.5 w-3.5 shrink-0" />}
                            {t === "all" ? "All Types" : t}
                            {isActive && <CheckCircle className="h-3 w-3 ml-auto text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading requests...
            </div>
          )}
          {!loading && requests.length === 0 && (
            <div className="min-h-32 flex flex-col items-center justify-center gap-2 text-center">
              <div className="p-3 rounded-full bg-muted/40">
                <CalendarDays className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No leave requests yet</p>
              <p className="text-xs text-muted-foreground/60">File your first leave request above.</p>
            </div>
          )}
          {!loading && requests.length > 0 && (() => {
            const filtered = requests
              .filter(r => {
                const end = r.end_date ?? r.date;
                return historyTab === "active" ? end >= today : end < today;
              })
              .filter(r => historyFilter === "all" || r.status === historyFilter)
              .filter(r => leaveTypeFilter === "all" || (r.leave_type ?? r.reason) === leaveTypeFilter)
              .sort((a, b) => {
                if (historyTab === "active") {
                  return (a.start_date ?? a.date).localeCompare(b.start_date ?? b.date);
                }
                return (b.start_date ?? b.date).localeCompare(a.start_date ?? a.date);
              });
            return (
              <div className="space-y-2.5">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No {historyTab === "active" ? "active or upcoming" : "past"} {historyFilter !== "all" ? historyFilter + " " : ""}requests.
                  </p>
                ) : filtered.map((req) => {
                  const cfg = LEAVE_REASON_CONFIG.find(c => c.value === req.leave_type || c.value === req.reason);
                  const Icon = cfg?.icon;
                  const hasAttachment = !!req.attachment_url;
                  const reqEnd = req.end_date ?? req.date;
                  const isPast = reqEnd < today;
                  const isStale = req.status === "pending" && isPast;
                  return (
                    <button
                      key={req.request_id}
                      type="button"
                      onClick={() => setSelectedRequest(req)}
                      className="w-full rounded-xl border p-3.5 flex items-center justify-between gap-3 text-left hover:bg-muted/30 hover:border-primary/20 transition-all duration-150 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {Icon && (
                          <div className={`shrink-0 p-1.5 rounded-lg ${isStale ? "bg-slate-50 border-slate-200" : cfg!.bg} border ${isStale ? "border-slate-200" : cfg!.border}`}>
                            <Icon className={`h-3.5 w-3.5 ${isStale ? "text-slate-400" : cfg!.color}`} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isStale ? "text-muted-foreground" : ""}`}>{req.leave_type ?? req.reason ?? "Leave"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(req.start_date ?? req.date)}
                            {req.end_date && req.end_date !== (req.start_date ?? req.date)
                              ? ` – ${formatDate(req.end_date)}` : ""}
                          </p>
                          {(req.status === "approved" || req.status === "rejected") && !isStale && (
                            <div className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${req.status === "approved" ? "text-emerald-600" : "text-rose-600"}`}>
                              {req.status === "approved"
                                ? <CheckCircle className="h-3 w-3 shrink-0" />
                                : <XCircle className="h-3 w-3 shrink-0" />}
                              <span className="truncate">
                                {req.status === "approved" ? "Approved" : "Rejected"}
                                {req.reviewer_name ? ` by ${req.reviewer_name}` : ""}
                                {req.reviewed_at ? ` · ${formatDate(req.reviewed_at.split("T")[0])}` : ""}
                              </span>
                            </div>
                          )}
                          {req.status === "revocation_requested" && !isStale && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-violet-600">
                              <RotateCcw className="h-3 w-3 shrink-0" />
                              <span className="truncate">Revocation pending HR review</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasAttachment && (
                          <Paperclip className="h-3 w-3 text-muted-foreground/50" />
                        )}
                        <Badge
                          className={
                            isStale
                              ? "bg-slate-100 text-slate-400 border border-slate-200"
                              : req.status === "approved"
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                : req.status === "rejected"
                                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                                  : req.status === "revoked"
                                    ? "bg-slate-100 text-slate-500 border border-slate-200"
                                    : req.status === "revocation_requested"
                                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                                      : "bg-amber-100 text-amber-700 border border-amber-200"
                          }
                        >
                          {isStale ? "Stale"
                            : req.status === "approved" ? "Approved"
                            : req.status === "rejected" ? "Rejected"
                            : req.status === "revoked" ? "Revoked"
                            : req.status === "revocation_requested" ? "Revocation Req."
                            : "Pending"}
                        </Badge>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Leave Request Detail Modal */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) setSelectedRequest(null); }}>
        <DialogContent className="max-w-lg overflow-y-auto max-h-[90vh] rounded-2xl">
          {selectedRequest && (() => {
            const cfg = LEAVE_REASON_CONFIG.find(c => c.value === selectedRequest.leave_type || c.value === selectedRequest.reason);
            const Icon = cfg?.icon;
            const isApproved = selectedRequest.status === "approved";
            const isRejected = selectedRequest.status === "rejected";
            const isPdf = selectedRequest.attachment_url && /\.pdf$/i.test(selectedRequest.attachment_url);
            const isImage = selectedRequest.attachment_url && /\.(jpe?g|png|webp)$/i.test(selectedRequest.attachment_url);
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    {Icon && cfg && (
                      <div className={`p-2 rounded-xl ${cfg.bg} border ${cfg.border}`}>
                        <Icon className={`h-5 w-5 ${cfg.color}`} />
                      </div>
                    )}
                    <div>
                      <DialogTitle className="text-base font-bold">{selectedRequest.leave_type ?? "Leave Request"}</DialogTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(selectedRequest.start_date ?? selectedRequest.date)}
                        {selectedRequest.end_date && selectedRequest.end_date !== (selectedRequest.start_date ?? selectedRequest.date)
                          ? ` – ${formatDate(selectedRequest.end_date)}` : ""}
                      </p>
                    </div>
                    <Badge
                      className={`ml-auto shrink-0 ${
                        isApproved ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : isRejected ? "bg-rose-100 text-rose-700 border border-rose-200"
                        : "bg-amber-100 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {isApproved ? "Approved" : isRejected ? "Rejected" : "Pending"}
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-4 pt-1">
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
                            className="w-full rounded-xl border object-cover max-h-72 hover:opacity-90 transition-opacity cursor-zoom-in"
                          />
                        </a>
                      ) : isPdf ? (
                        <a
                          href={selectedRequest.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <div className="p-2 bg-rose-100 rounded-lg">
                            <Paperclip className="h-4 w-4 text-rose-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">View PDF Document</p>
                            <p className="text-xs text-muted-foreground">Opens in new tab</p>
                          </div>
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

                  {/* Review info */}
                  {(isApproved || isRejected) && (
                    <div className={`rounded-xl border px-4 py-3 space-y-1.5 ${
                      isApproved ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
                    }`}>
                      <div className={`flex items-center gap-1.5 text-sm font-semibold ${isApproved ? "text-emerald-700" : "text-rose-700"}`}>
                        {isApproved
                          ? <CheckCircle className="h-4 w-4" />
                          : <XCircle className="h-4 w-4" />}
                        {isApproved ? "Approved" : "Rejected"}
                        {selectedRequest.reviewer_name ? ` by ${selectedRequest.reviewer_name}` : ""}
                      </div>
                      {selectedRequest.reviewed_at && (
                        <p className={`text-xs ${isApproved ? "text-emerald-600" : "text-rose-600"}`}>
                          {formatDate(selectedRequest.reviewed_at.split("T")[0])}
                        </p>
                      )}
                      {isRejected && selectedRequest.rejection_reason && (
                        <p className="text-xs text-rose-700 mt-1 pt-1 border-t border-rose-200">
                          <span className="font-semibold">Reason: </span>{selectedRequest.rejection_reason}
                        </p>
                      )}
                    </div>
                  )}

                  {selectedRequest.status === "pending" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs font-semibold text-amber-700">Awaiting HR review</p>
                    </div>
                  )}

                  {selectedRequest.status === "revoked" && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500">Leave was revoked and balance refunded.</p>
                    </div>
                  )}

                  {selectedRequest.status === "cancelled" && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500">Request was cancelled before review.</p>
                    </div>
                  )}

                  {selectedRequest.status === "revocation_requested" && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 space-y-1">
                      <p className="text-xs font-bold text-violet-700 flex items-center gap-1.5">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Revocation Pending HR Review
                      </p>
                      {selectedRequest.revocation_reason && (
                        <p className="text-xs text-violet-600">
                          Your reason: &ldquo;{selectedRequest.revocation_reason}&rdquo;
                        </p>
                      )}
                    </div>
                  )}

                  {/* Cancel button — pending only */}
                  {selectedRequest.status === "pending" && (
                    <div className="pt-1 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setRevokeDialogOpen(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-700 hover:bg-rose-50 transition-all duration-150 cursor-pointer"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Cancel Request
                      </button>
                    </div>
                  )}

                  {/* Request Revocation — approved + strictly future dates only */}
                  {selectedRequest.status === "approved" && (() => {
                    const startFuture = (selectedRequest.start_date ?? selectedRequest.date) > today;
                    return startFuture ? (
                      <div className="pt-1 border-t border-border">
                        <button
                          type="button"
                          onClick={() => { setRevocationReason(""); setRevokeDialogOpen(true); }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-all duration-150 cursor-pointer"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Request Revocation
                        </button>
                      </div>
                    ) : (
                      <div className="pt-1 border-t border-border">
                        <p className="text-[11px] text-muted-foreground text-center py-1">
                          Revocation only available for future leave dates.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Cancel / Request Revocation dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={(open) => { if (!open) { setRevokeDialogOpen(false); setRevocationReason(""); } }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRequest?.status === "pending" ? "Cancel Leave Request?" : "Request Leave Revocation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequest?.status === "pending" ? (
              <p className="text-sm text-muted-foreground">
                This cancels your pending request. HR will no longer review it.
              </p>
            ) : (
              <>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Requires HR approval
                  </p>
                  <p className="text-xs text-amber-600">
                    HR will review your request. If approved, your leave is cancelled and balance refunded.
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                    Reason <span className="text-red-500">*</span>
                  </p>
                  <textarea
                    value={revocationReason}
                    onChange={(e) => setRevocationReason(e.target.value.slice(0, 300))}
                    placeholder="Why are you revoking this leave? (e.g. plans changed)"
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 resize-none transition-colors"
                  />
                  <p className="text-[10px] text-muted-foreground text-right mt-1">{revocationReason.length}/300</p>
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 cursor-pointer" onClick={() => { setRevokeDialogOpen(false); setRevocationReason(""); }}>
                Keep
              </Button>
              <Button
                className={`flex-1 text-white cursor-pointer ${selectedRequest?.status === "pending" ? "bg-rose-600 hover:bg-rose-700" : "bg-violet-600 hover:bg-violet-700"}`}
                disabled={revoking || (selectedRequest?.status === "approved" && !revocationReason.trim())}
                onClick={() => void (selectedRequest?.status === "pending" ? handleCancelPending() : handleRequestRevocation())}
              >
                {revoking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                {selectedRequest?.status === "pending" ? "Yes, Cancel" : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
