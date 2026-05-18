"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Coffee, Loader2, Plus, Send, Timer, Palmtree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getMyOvertimeRequests, fileOvertimeRequestApi, getMyOvertimeSummary, type OvertimeRequest, type OvertimeType } from "@/lib/authApi";
import { toast } from "sonner";

const OT_TYPES: { value: OvertimeType; icon: React.ElementType; label: string; desc: string }[] = [
  { value: "NORMAL",   icon: Clock,    label: "Normal OT",   desc: "Overtime on a scheduled workday" },
  { value: "REST_DAY", icon: Coffee,   label: "Rest Day OT", desc: "Overtime on your rest day" },
  { value: "HOLIDAY",  icon: Palmtree, label: "Holiday OT",  desc: "Overtime on a holiday" },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  DENIED:   "bg-rose-100 text-rose-700 border-rose-200",
};

function formatDate(v: string) {
  return new Date(`${v}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EmployeeOvertimePage() {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [summary, setSummary] = useState<{ approved_planned_hours: number }>({ approved_planned_hours: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [otType, setOtType] = useState<OvertimeType>("NORMAL");
  const [otDate, setOtDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");

  const tomorrow = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([getMyOvertimeRequests(), getMyOvertimeSummary()]);
      setRequests(r);
      setSummary(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load overtime data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  function reset() { setOtDate(""); setStartTime(""); setEndTime(""); setReason(""); setOtType("NORMAL"); }

  async function handleSubmit() {
    if (!otDate) { toast.error("Select a date."); return; }
    if (!startTime || !endTime) { toast.error("Enter start and end time."); return; }
    if (endTime <= startTime) { toast.error("End time must be after start time."); return; }

    let latitude = 0, longitude = 0;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch { toast.error("Location required for overtime request."); return; }

    setSubmitting(true);
    try {
      await fileOvertimeRequestApi({ ot_type: otType, ot_date: otDate, start_time: startTime, end_time: endTime, latitude, longitude, reason: reason || undefined });
      toast.success("Overtime request submitted.");
      reset();
      setModalOpen(false);
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overtime Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">Submit and track your overtime requests.</p>
        </div>
        <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Request OT</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New Overtime Request</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-3 gap-2">
                {OT_TYPES.map(({ value, icon: Icon, label, desc }) => (
                  <button key={value} onClick={() => setOtType(value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${otType === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                    <Icon className={`h-4 w-4 mb-1 ${otType === value ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Date (must be future)</label>
                <input type="date" min={tomorrow} value={otDate} onChange={e => setOtDate(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Start Time</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">End Time</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
                </div>
              </div>
              {startTime && endTime && endTime > startTime && (
                <p className="text-xs text-sky-600 font-medium">
                  Planned: {((parseInt(endTime.split(":")[0])*60+parseInt(endTime.split(":")[1])) - (parseInt(startTime.split(":")[0])*60+parseInt(startTime.split(":")[1])))/60}h
                </p>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium">Reason (optional)</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                  placeholder="Reason for overtime..." maxLength={500}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none" />
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
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{summary.approved_planned_hours}h</p>
          <p className="text-xs text-muted-foreground">Approved overtime planned hours</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2">
            <Timer className="h-4 w-4 text-sky-600" /> My Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="min-h-32 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading...</span>
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overtime requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.ot_id} className="rounded-lg border p-3 bg-muted/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold">{formatDate(req.ot_date)}</span>
                    </div>
                    <Badge className={STATUS_STYLE[req.log_status] ?? ""}>{req.log_status.charAt(0)+req.log_status.slice(1).toLowerCase()}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{req.start_time}–{req.end_time} &bull; {req.planned_hours}h &bull; {req.ot_type.replace("_"," ")}</p>
                  {req.reason && <p className="text-xs text-muted-foreground italic">{req.reason}</p>}
                  {req.review_reason && <p className="text-xs text-rose-600">HR note: {req.review_reason}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
