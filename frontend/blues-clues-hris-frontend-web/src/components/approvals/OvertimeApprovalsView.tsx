"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  getOvertimeRequestsForApproval,
  reviewOvertimeRequestApi,
  type OvertimeRequestForApproval,
} from "@/lib/payrollApi";

const OT_TYPE_LABELS: Record<string, string> = {
  NORMAL: "Normal OT",
  REST_DAY: "Rest Day OT",
  HOLIDAY: "Holiday OT",
};

function statusColor(s: string) {
  if (s === "APPROVED") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (s === "DENIED") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

function typeColor(t: string) {
  if (t === "REST_DAY") return "bg-amber-50 border-amber-200 text-amber-700";
  if (t === "HOLIDAY") return "bg-purple-50 border-purple-200 text-purple-700";
  return "bg-slate-50 border-slate-200 text-slate-700";
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });
}

type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "DENIED";
type TypeFilter = "ALL" | "NORMAL" | "REST_DAY" | "HOLIDAY";

export default function OvertimeApprovalsView() {
  const [requests, setRequests] = useState<OvertimeRequestForApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [denyDialogId, setDenyDialogId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [submittingDeny, setSubmittingDeny] = useState(false);

  const load = async (s: StatusFilter, t: TypeFilter) => {
    setLoading(true);
    try {
      const data = await getOvertimeRequestsForApproval(
        s === "ALL" ? undefined : s,
        t === "ALL" ? undefined : t,
      );
      setRequests(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load overtime requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(statusFilter, typeFilter); }, [statusFilter, typeFilter]);

  const handleApprove = async (otId: string) => {
    setReviewingId(otId);
    try {
      await reviewOvertimeRequestApi(otId, "approve");
      toast.success("Overtime request approved.");
      void load(statusFilter, typeFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setReviewingId(null);
    }
  };

  const handleDeny = async () => {
    if (!denyDialogId) return;
    if (!denyReason || denyReason.trim().length < 3) {
      toast.error("Reason must be at least 3 characters.");
      return;
    }
    setSubmittingDeny(true);
    try {
      await reviewOvertimeRequestApi(denyDialogId, "deny", denyReason);
      toast.success("Overtime request denied.");
      setDenyDialogId(null);
      setDenyReason("");
      void load(statusFilter, typeFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deny");
    } finally {
      setSubmittingDeny(false);
    }
  };

  return (
    <>
      <div className="space-y-4 animate-in fade-in duration-500">
        <div className="flex flex-wrap gap-2">
          {(["PENDING", "APPROVED", "DENIED", "ALL"] as StatusFilter[]).map((f) => (
            <Button key={f} size="sm" variant={statusFilter === f ? "default" : "outline"}
              onClick={() => setStatusFilter(f)} className="h-8">
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </Button>
          ))}
          <span className="ml-2 text-muted-foreground text-xs self-center">Type:</span>
          {(["ALL", "NORMAL", "REST_DAY", "HOLIDAY"] as TypeFilter[]).map((t) => (
            <Button key={t} size="sm" variant={typeFilter === t ? "secondary" : "outline"}
              onClick={() => setTypeFilter(t)} className="h-8">
              {t === "ALL" ? "All" : OT_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-600" />
              Overtime Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="min-h-40 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading overtime requests...</span>
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overtime requests found.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => {
                  const isPending = req.log_status === "PENDING";
                  const isProcessing = reviewingId === req.ot_id;
                  return (
                    <div key={req.ot_id} className="rounded-xl border p-4 bg-muted/10 space-y-3 hover:bg-primary/5 transition-colors">
                      <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold">
                            {req.employee ? `${req.employee.first_name} ${req.employee.last_name}` : "Unknown Employee"}
                          </p>
                          <p className="text-xs text-muted-foreground">{req.employee?.employee_id ?? ""}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={typeColor(req.ot_type)}>{OT_TYPE_LABELS[req.ot_type]}</Badge>
                          <Badge className={statusColor(req.log_status)}>
                            {req.log_status.charAt(0) + req.log_status.slice(1).toLowerCase()}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-md border p-2 bg-background">
                          <p className="text-muted-foreground">OT Date</p>
                          <p className="font-semibold">{formatDate(req.ot_date)}</p>
                        </div>
                        <div className="rounded-md border p-2 bg-background">
                          <p className="text-muted-foreground">Time Window</p>
                          <p className="font-semibold">{req.start_time} – {req.end_time}</p>
                        </div>
                        <div className="rounded-md border p-2 bg-sky-50 border-sky-200">
                          <p className="text-sky-600 text-muted-foreground">Planned Hours</p>
                          <p className="font-bold text-sky-700">{req.planned_hours}h</p>
                        </div>
                      </div>

                      {req.reason && (
                        <p className="text-xs text-muted-foreground italic">Reason: {req.reason}</p>
                      )}
                      {req.review_reason && (
                        <p className="text-xs text-rose-600 italic">Review note: {req.review_reason}</p>
                      )}

                      {isPending && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3"
                            disabled={isProcessing} onClick={() => void handleApprove(req.ot_id)}>
                            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                            Approve
                          </Button>
                          <Button size="sm" variant="outline"
                            className="border-rose-200 text-rose-700 hover:bg-rose-50 h-8 px-3"
                            disabled={isProcessing}
                            onClick={() => { setDenyDialogId(req.ot_id); setDenyReason(""); }}>
                            <XCircle className="h-3.5 w-3.5" /> Deny
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!denyDialogId} onOpenChange={(open) => { if (!open) setDenyDialogId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deny Overtime Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Provide a reason for denial (required, min 3 chars).</p>
            <Textarea placeholder="Reason for denial..." value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)} rows={3} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDenyDialogId(null)}>Cancel</Button>
              <Button className="bg-rose-600 hover:bg-rose-700 text-white"
                disabled={submittingDeny} onClick={() => void handleDeny()}>
                {submittingDeny ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm Deny
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
