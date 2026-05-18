"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import { CalendarDays, Clock, Coffee, Loader2, Palmtree, Plus, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  fileOvertimeRequestApi,
  getMyOvertimeRequests,
  getMyOvertimeSummary,
  type OvertimeRequest,
  type OvertimeType,
} from "@/lib/authApi";

const OT_TYPES: { value: OvertimeType; icon: ElementType; label: string; desc: string }[] = [
  { value: "NORMAL", icon: Clock, label: "Normal OT", desc: "Overtime on a scheduled workday" },
  { value: "REST_DAY", icon: Coffee, label: "Rest Day OT", desc: "Overtime on your rest day" },
  { value: "HOLIDAY", icon: Palmtree, label: "Holiday OT", desc: "Overtime on a holiday" },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  DENIED: "bg-rose-100 text-rose-700 border-rose-200",
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPlannedHours(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  if (Number.isNaN(startTotal) || Number.isNaN(endTotal) || endTotal <= startTotal) return null;
  return (endTotal - startTotal) / 60;
}

export default function EmployeeOvertimePage() {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [summary, setSummary] = useState({ approved_planned_hours: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [otType, setOtType] = useState<OvertimeType>("NORMAL");
  const [otDate, setOtDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");

  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split("T")[0];
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [requestRows, summaryRow] = await Promise.all([
        getMyOvertimeRequests(),
        getMyOvertimeSummary(),
      ]);
      setRequests(requestRows);
      setSummary(summaryRow);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load overtime data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function resetForm() {
    setOtType("NORMAL");
    setOtDate("");
    setStartTime("");
    setEndTime("");
    setReason("");
  }

  async function handleSubmit() {
    if (!otDate) {
      toast.error("Select a date.");
      return;
    }
    if (!startTime || !endTime) {
      toast.error("Enter start and end time.");
      return;
    }

    const plannedHours = getPlannedHours(startTime, endTime);
    if (!plannedHours) {
      toast.error("End time must be after start time.");
      return;
    }

    let latitude = 0;
    let longitude = 0;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
      });
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
    } catch {
      toast.error("Location required for overtime request.");
      return;
    }

    setSubmitting(true);
    try {
      await fileOvertimeRequestApi({
        ot_type: otType,
        ot_date: otDate,
        start_time: startTime,
        end_time: endTime,
        latitude,
        longitude,
        reason: reason || undefined,
      });
      toast.success("Overtime request submitted.");
      resetForm();
      setModalOpen(false);
      void loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit overtime request");
    } finally {
      setSubmitting(false);
    }
  }

  const plannedHours = getPlannedHours(startTime, endTime);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overtime Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Submit and track your overtime requests.</p>
        </div>
        <Dialog
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Request OT
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New Overtime Request</DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {OT_TYPES.map(({ value, icon: Icon, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOtType(value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      otType === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <Icon className={`mb-1 h-4 w-4 ${otType === value ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Date</label>
                <input
                  type="date"
                  min={tomorrow}
                  value={otDate}
                  onChange={(event) => setOtDate(event.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {plannedHours ? (
                <p className="text-xs font-medium text-sky-600">Planned: {plannedHours}h</p>
              ) : null}

              <div className="space-y-1">
                <label className="text-xs font-medium">Reason (optional)</label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Reason for overtime..."
                  className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>

              <Button className="w-full gap-2" disabled={submitting} onClick={() => void handleSubmit()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{summary.approved_planned_hours}h</p>
          <p className="text-xs text-muted-foreground">Approved overtime planned hours</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
            <Timer className="h-4 w-4 text-sky-600" />
            My Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overtime requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.ot_id} className="space-y-1.5 rounded-lg border bg-muted/10 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold">{formatDate(request.ot_date)}</span>
                    </div>
                    <Badge className={STATUS_STYLE[request.log_status] ?? ""}>
                      {request.log_status.charAt(0) + request.log_status.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {request.start_time} to {request.end_time} | {request.planned_hours}h | {request.ot_type.replace("_", " ")}
                  </p>
                  {request.reason ? <p className="text-xs italic text-muted-foreground">{request.reason}</p> : null}
                  {request.review_reason ? (
                    <p className="text-xs text-rose-600">HR note: {request.review_reason}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
