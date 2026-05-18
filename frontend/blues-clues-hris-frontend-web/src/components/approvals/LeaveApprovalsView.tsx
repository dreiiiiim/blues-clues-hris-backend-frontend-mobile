"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  getLeaveRequestsForApproval,
  reviewLeaveRequestApi,
  type LeaveRequestForApproval,
} from "@/lib/payrollApi";

function leaveStatusColor(status: string) {
  if (status === "Approved") return "bg-emerald-100 text-emerald-700";
  if (status === "Rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LeaveApprovalsView() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestForApproval[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(true);
  const [leaveFilter, setLeaveFilter] = useState<"all" | "Pending" | "Approved" | "Rejected">("Pending");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  const loadLeaveRequests = async (status?: string) => {
    setLeaveLoading(true);
    try {
      const data = await getLeaveRequestsForApproval(status === "all" ? undefined : status);
      setLeaveRequests(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leave requests");
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    void loadLeaveRequests(leaveFilter);
  }, [leaveFilter]);

  const handleApproveLeave = async (requestId: string) => {
    setReviewingId(requestId);
    try {
      await reviewLeaveRequestApi(requestId, "Approved");
      toast.success("Leave request approved.");
      void loadLeaveRequests(leaveFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve leave");
    } finally {
      setReviewingId(null);
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
      void loadLeaveRequests(leaveFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject leave");
    } finally {
      setSubmittingReject(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {(["Pending", "Approved", "Rejected", "all"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={leaveFilter === f ? "default" : "outline"}
              onClick={() => setLeaveFilter(f)}
              className="h-8"
            >
              {f === "all" ? "All" : f}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold tracking-tight">
              Leave Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaveLoading ? (
              <div className="min-h-40 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading leave requests...</span>
              </div>
            ) : leaveRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave requests found.</p>
            ) : (
              <div className="space-y-3">
                {leaveRequests.map((req) => {
                  const isReviewing = reviewingId === req.request_id;
                  const isPending = req.status === "Pending";
                  return (
                    <div key={req.request_id} className="rounded-lg border p-4 bg-muted/10 space-y-3">
                      <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold">
                            {req.employee
                              ? `${req.employee.first_name} ${req.employee.last_name}`
                              : "Unknown Employee"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {req.employee?.employee_id ?? ""} · {req.leave_type}
                          </p>
                        </div>
                        <Badge className={leaveStatusColor(req.status)}>{req.status}</Badge>
                      </div>

                      <div className="grid gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-md border p-2 bg-background">
                          <p className="text-muted-foreground">From</p>
                          <p className="font-semibold">{formatDate(req.start_date)}</p>
                        </div>
                        <div className="rounded-md border p-2 bg-background">
                          <p className="text-muted-foreground">To</p>
                          <p className="font-semibold">{formatDate(req.end_date)}</p>
                        </div>
                        <div className="rounded-md border p-2 bg-background">
                          <p className="text-muted-foreground">Days</p>
                          <p className="font-semibold">{req.total_days}</p>
                        </div>
                      </div>

                      {req.reason && (
                        <p className="text-xs text-muted-foreground italic">
                          Reason: {req.reason}
                        </p>
                      )}
                      {req.rejection_reason && (
                        <p className="text-xs text-rose-600 italic">
                          Rejection reason: {req.rejection_reason}
                        </p>
                      )}

                      {isPending && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3"
                            disabled={isReviewing}
                            onClick={() => void handleApproveLeave(req.request_id)}
                          >
                            {isReviewing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-200 text-rose-700 hover:bg-rose-50 h-8 px-3"
                            disabled={isReviewing}
                            onClick={() => {
                              setRejectDialogId(req.request_id);
                              setRejectReason("");
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
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

      <Dialog
        open={!!rejectDialogId}
        onOpenChange={(open) => {
          if (!open) setRejectDialogId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejection (optional).
            </p>
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectDialogId(null)}>
                Cancel
              </Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white"
                disabled={submittingReject}
                onClick={() => void handleRejectLeave()}
              >
                {submittingReject ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
