"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Download, Eye, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { SecondaryAuthModal } from "@/components/security/SecondaryAuthModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyPayslips, type PayslipEntry } from "@/lib/payrollApi";

const toCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

export default function EmployeePayslipsPage() {
  const [rows, setRows] = useState<PayslipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingViewId, setPendingViewId] = useState<string | null>(null);
  const [unlockedId, setUnlockedId] = useState<string | null>(null);

  useEffect(() => {
    getMyPayslips()
      .then((data) => setRows(data))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load payslips"))
      .finally(() => setLoading(false));
  }, []);

  const selectedPayslip = useMemo(
    () => rows.find((row) => row.payslip_id === unlockedId) ?? null,
    [rows, unlockedId],
  );

  const handleView = (payslipId: string) => {
    setPendingViewId(payslipId);
    setAuthOpen(true);
  };

  const handleDownload = (payslip: PayslipEntry | null) => {
    if (!payslip) return;

    const lines = [
      ["Field", "Value"],
      ["Pay Period", payslip.pay_period],
      ["Basic Pay", payslip.basic_pay.toFixed(2)],
      ["Allowances", payslip.allowances.toFixed(2)],
      ["Deductions", payslip.deductions.toFixed(2)],
      ["Tax", payslip.tax.toFixed(2)],
      ["Net Pay", payslip.net_pay.toFixed(2)],
      ["Generated At", payslip.created_at],
    ];
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payslip-${payslip.pay_period.replaceAll(/\s+/g, "-").toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const totalNetPay = rows.reduce((sum, row) => sum + row.net_pay, 0);

  if (loading) {
    return (
      <div className="min-h-60 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading payslips...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] bg-[linear-gradient(135deg,#0f172a_0%,#075985_54%,#166534_100%)] text-white px-8 py-10 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 mb-2">Employee Self-Service</p>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Payslip History</h1>
        <p className="text-sm text-white/80 max-w-2xl">
          Access your payroll records. Sensitive details are protected with secondary verification.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Payslips</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total Net Pay</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{toCurrency(totalNetPay)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Data Source</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">API with fallback sample</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <BadgeDollarSign className="h-4 w-4 text-primary" /> Latest Payslips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => (
            <div key={row.payslip_id} className="border rounded-lg p-4 bg-muted/20 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">{row.pay_period}</p>
                <p className="text-xs text-muted-foreground">Generated: {new Date(row.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Net: {toCurrency(row.net_pay)}</Badge>
                <Button size="sm" onClick={() => handleView(row.payslip_id)} className="h-8 px-3">
                  <Eye className="h-3.5 w-3.5" />
                  View Details
                </Button>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payslips available yet.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold tracking-tight">Payslip Breakdown</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              disabled={!selectedPayslip}
              onClick={() => handleDownload(selectedPayslip)}
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              disabled={!selectedPayslip}
              onClick={() => globalThis.print()}
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {selectedPayslip ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="border rounded-md p-3 bg-muted/10">
                <p className="text-xs text-muted-foreground">Basic Pay</p>
                <p className="text-sm font-semibold">{toCurrency(selectedPayslip.basic_pay)}</p>
              </div>
              <div className="border rounded-md p-3 bg-muted/10">
                <p className="text-xs text-muted-foreground">Allowances</p>
                <p className="text-sm font-semibold">{toCurrency(selectedPayslip.allowances)}</p>
              </div>
              <div className="border rounded-md p-3 bg-muted/10">
                <p className="text-xs text-muted-foreground">Deductions</p>
                <p className="text-sm font-semibold">{toCurrency(selectedPayslip.deductions)}</p>
              </div>
              <div className="border rounded-md p-3 bg-muted/10">
                <p className="text-xs text-muted-foreground">Tax</p>
                <p className="text-sm font-semibold">{toCurrency(selectedPayslip.tax)}</p>
              </div>
              <div className="border rounded-md p-3 bg-emerald-50 border-emerald-200 sm:col-span-2 lg:col-span-1">
                <p className="text-xs text-emerald-700">Net Pay</p>
                <p className="text-sm font-bold text-emerald-900">{toCurrency(selectedPayslip.net_pay)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Verify your identity and open a payslip to view full compensation details.</p>
          )}
        </CardContent>
      </Card>

      <SecondaryAuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="Unlock Payslip"
        description="Enter your account password to view compensation details."
        onVerified={() => {
          if (pendingViewId) {
            setUnlockedId(pendingViewId);
            setPendingViewId(null);
          }
        }}
      />
    </div>
  );
}