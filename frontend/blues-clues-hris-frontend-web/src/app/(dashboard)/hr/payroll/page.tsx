"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, Loader2, Lock, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { SecondaryAuthModal } from "@/components/security/SecondaryAuthModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPayrollLedger, runPayrollCutoff, type PayrollLedgerEntry } from "@/lib/payrollApi";

const toCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const getStatusColor = (status: PayrollLedgerEntry["status"]) => {
  if (status === "released") return "bg-emerald-100 text-emerald-700";
  if (status === "processed") return "bg-sky-100 text-sky-700";
  return "bg-amber-100 text-amber-700";
};

export default function HRPayrollPage() {
  const [rows, setRows] = useState<PayrollLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [cutoffDate, setCutoffDate] = useState(() => new Date().toISOString().slice(0, 10));

  const loadLedger = (cutoff?: string) => {
    setLoading(true);
    getPayrollLedger(cutoff)
      .then((data) => setRows(data))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load payroll ledger"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLedger();
  }, []);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.gross += row.gross_pay;
          acc.deductions += row.deductions;
          acc.net += row.net_pay;
          return acc;
        },
        { gross: 0, deductions: 0, net: 0 },
      ),
    [rows],
  );

  const handleRunCutoff = async () => {
    setRunning(true);
    try {
      const result = await runPayrollCutoff(cutoffDate);
      toast.success(result.message || "Payroll cutoff executed.");
      loadLedger(cutoffDate);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run payroll cutoff");
    } finally {
      setRunning(false);
    }
  };

  let compensationBody: React.ReactNode;
  if (loading) {
    compensationBody = (
      <div className="min-h-45 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading payroll records...</span>
      </div>
    );
  } else if (locked) {
    compensationBody = (
      <p className="text-sm text-muted-foreground">Unlock with secondary authentication to view employee compensation values.</p>
    );
  } else {
    compensationBody = (
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.payroll_id} className="border rounded-lg p-4 bg-muted/20">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">{row.employee_name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.employee_id} · Cutoff {new Date(row.cutoff_date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(row.status)}>{row.status}</Badge>
                <Badge variant="outline">Net {toCurrency(row.net_pay)}</Badge>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
              <div className="rounded-md border p-2 bg-background">Gross: {toCurrency(row.gross_pay)}</div>
              <div className="rounded-md border p-2 bg-background">Deductions: {toCurrency(row.deductions)}</div>
              <div className="rounded-md border p-2 bg-background">Net: {toCurrency(row.net_pay)}</div>
            </div>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No payroll records found.</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] text-white px-8 py-10 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/65 mb-2">HR Operations</p>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Payroll Ledger</h1>
        <p className="text-sm text-white/75 max-w-2xl">
          Run payroll cutoffs and review compensation data across employee records.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold tracking-tight">Run Payroll Cutoff</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full md:w-65">
            <label htmlFor="payroll-cutoff-date" className="text-xs font-semibold text-muted-foreground">Cutoff Date</label>
            <Input
              id="payroll-cutoff-date"
              type="date"
              value={cutoffDate}
              onChange={(event) => setCutoffDate(event.target.value)}
              className="mt-1"
            />
          </div>
          <Button onClick={() => void handleRunCutoff()} disabled={running || !cutoffDate} className="h-10 px-4">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Run Cutoff
          </Button>
          <Button variant="outline" onClick={() => loadLedger(cutoffDate)} className="h-10 px-4">
            Refresh Ledger
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Gross Payroll</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{toCurrency(totals.gross)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total Deductions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{toCurrency(totals.deductions)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Net Payroll</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{toCurrency(totals.net)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Compensation Data
          </CardTitle>
          {locked ? (
            <Button size="sm" className="h-8 px-3" onClick={() => setAuthOpen(true)}>
              <Lock className="h-3.5 w-3.5" /> Unlock
            </Button>
          ) : (
            <Badge variant="secondary">Unlocked for this session</Badge>
          )}
        </CardHeader>
        <CardContent>
          {compensationBody}
        </CardContent>
      </Card>

      <SecondaryAuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="Unlock Compensation Data"
        description="Re-enter your password to access payroll amounts."
        onVerified={() => setLocked(false)}
      />
    </div>
  );
}