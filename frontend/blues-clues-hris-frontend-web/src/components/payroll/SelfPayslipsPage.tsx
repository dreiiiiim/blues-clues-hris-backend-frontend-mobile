"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Download, Eye, FileText, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { SecondaryAuthModal } from "@/components/security/SecondaryAuthModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getMyCompensation,
  getMyPayslipsFromCnb,
  type CompensationPackage,
  type PayslipBreakdown,
  type PayslipDetail,
} from "@/lib/payrollApi";
import { getUserInfo } from "@/lib/authStorage";
import { downloadPayslipPdf as exportPayslipPdf } from "@/components/payroll/payslipPdf";

const toCurrency = (value: number | string) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value));

const toCurrencyNumber = (value: number | string) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));

function escapePdfText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function maskId(value?: string | null) {
  if (!value) return "Not set";
  const plain = value.replace(/\s+/g, "");
  const tail = plain.slice(-4);
  const hiddenCount = Math.max(0, plain.length - 4);
  return `${"*".repeat(hiddenCount)}${tail}`;
}

function formatPeriod(payslip: PayslipDetail) {
  if (payslip.period) {
    const start = new Date(payslip.period.cutoff_start_date).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    const end = new Date(payslip.period.cutoff_end_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    return `${start} - ${end}`;
  }
  return new Date(payslip.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

type PayslipExportContext = {
  companyName: string;
  employeeName: string;
  employeeEmail: string;
  employeeId: string | null;
  payFrequency: string | null;
};

function downloadPayslipPdf(payslip: PayslipDetail, context: PayslipExportContext) {
  return exportPayslipPdf(payslip, context);
}

function PayslipReceiptView({ payslip }: Readonly<{ payslip: PayslipDetail }>) {
  const breakdown = payslip.breakdown as PayslipBreakdown | null;
  const currentUser = getUserInfo();
  const employeeName =
    [payslip.employee?.first_name, payslip.employee?.last_name]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ") ||
    currentUser?.name ||
    "Employee";
  const exportContext: PayslipExportContext = {
    companyName:
      payslip.company?.company_display_name ??
      payslip.company?.company_name ??
      "Company",
    employeeName,
    employeeEmail: payslip.employee?.email ?? currentUser?.email ?? "",
    employeeId: payslip.employee?.employee_id ?? null,
    payFrequency: breakdown?.payFrequency ?? null,
  };


  const handleDownload = () => {
    downloadPayslipPdf(payslip, exportContext);
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg bg-slate-50 border p-3 text-xs text-muted-foreground">
        Pay Period: <span className="font-semibold text-foreground">{formatPeriod(payslip)}</span>
        {" · "}Slip ID: <span className="font-semibold text-foreground">{payslip.payslip_code ?? payslip.payslip_id}</span>
        {payslip.period?.payout_date && (
          <> {" - "}Payout: <span className="font-semibold text-foreground">
            {new Date(payslip.period.payout_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
          </span></>
        )}
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Earnings</p>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span>Basic Pay</span>
            <span className="font-medium">{toCurrency(payslip.basic_pay_earned)}</span>
          </div>
          {breakdown?.benefits?.map((b, i) => (
            <div key={i} className="flex justify-between text-muted-foreground">
              <span>{b.name ?? b.type ?? "Benefit"}</span>
              <span>{toCurrency(b.amount)}</span>
            </div>
          ))}
          {!breakdown?.benefits?.length && Number(payslip.total_allowances) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Total Allowances</span>
              <span>{toCurrency(payslip.total_allowances)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between font-semibold border-t mt-2 pt-2">
          <span>Gross Pay</span>
          <span>{toCurrency(payslip.gross_pay)}</span>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Deductions</p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-muted-foreground">
            <span>Income Tax (Withheld)</span>
            <span>{toCurrency(payslip.tax_deduction)}</span>
          </div>
          {breakdown?.sss != null ? (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>SSS (Employee Share)</span>
                <span>{toCurrency(breakdown.sss)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>PhilHealth (Employee Share)</span>
                <span>{toCurrency(breakdown.philhealth)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pag-IBIG</span>
                <span>{toCurrency(breakdown.pagibig)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-muted-foreground">
              <span>Statutory Deductions (SSS / PhilHealth / Pag-IBIG)</span>
              <span>{toCurrency(payslip.statutory_deductions)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between font-semibold border-t mt-2 pt-2 text-rose-700">
          <span>Total Deductions</span>
          <span>{toCurrency(payslip.total_deductions)}</span>
        </div>
      </div>

      <div className="rounded-lg bg-emerald-50 border-emerald-200 border p-3 flex justify-between items-center">
        <span className="font-bold text-emerald-900">Net Pay</span>
        <span className="font-bold text-emerald-900 text-lg">{toCurrency(payslip.net_pay)}</span>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" /> Download PDF
        </Button>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
}: Readonly<{
  label: string;
  value: string | number;
  hint: string;
}>) {
  return (
    <Card className="border-transparent bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_18px_40px_rgba(15,23,42,0.07),0_3px_12px_rgba(15,23,42,0.04)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-500">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight text-slate-950 [font-variant-numeric:tabular-nums]">
          {value}
        </p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function SelfPayslipsPage({ personaLabel }: Readonly<{ personaLabel: string }>) {
  const [payslips, setPayslips] = useState<PayslipDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingReceiptId, setPendingReceiptId] = useState<string | null>(null);
  const [receiptPayslip, setReceiptPayslip] = useState<PayslipDetail | null>(null);
  const [activeTab, setActiveTab] = useState("payslips");
  const [packageUnlocked, setPackageUnlocked] = useState(false);
  const [loadingPackage, setLoadingPackage] = useState(false);
  const [myPackage, setMyPackage] = useState<CompensationPackage | null>(null);

  useEffect(() => {
    getMyPayslipsFromCnb()
      .then((data) => setPayslips(data))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load payslips"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "my-package" || !packageUnlocked || myPackage || loadingPackage) return;
    setLoadingPackage(true);
    getMyCompensation()
      .then((data) => setMyPackage(data))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load compensation package"))
      .finally(() => setLoadingPackage(false));
  }, [activeTab, packageUnlocked, myPackage, loadingPackage]);

  const currentYear = new Date().getFullYear();
  const totalNetPayThisYear = useMemo(
    () =>
      payslips.reduce((sum, payslip) => {
        const referenceDate = payslip.period?.payout_date ?? payslip.created_at ?? null;
        if (!referenceDate) return sum;
        const year = new Date(referenceDate).getFullYear();
        return year === currentYear ? sum + Number(payslip.net_pay) : sum;
      }, 0),
    [currentYear, payslips],
  );

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
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(140deg,#08111f_0%,#0f2850_48%,#123d34_100%)] px-8 py-10 text-white shadow-sm">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_62%)]" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">{personaLabel}</p>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Payslips & Compensation</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/78">
              Review released payroll records, then unlock your compensation package only when you need to inspect salary, benefits, or statutory details.
            </p>
          </div>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3 rounded-2xl bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_14px_30px_rgba(8,17,31,0.18)] backdrop-blur-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Records</p>
              <p className="mt-2 text-2xl font-bold [font-variant-numeric:tabular-nums]">{payslips.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Net total {currentYear}</p>
              <p className="mt-2 text-lg font-bold [font-variant-numeric:tabular-nums]">{toCurrency(totalNetPayThisYear)}</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-2xl bg-slate-100/90 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <TabsTrigger
            value="payslips"
            className="rounded-xl border border-transparent text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-[0_10px_22px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.05)]"
          >
            Payslips
          </TabsTrigger>
          <TabsTrigger
            value="my-package"
            className="rounded-xl border border-transparent text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-[0_10px_22px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.05)]"
          >
            My Package
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payslips" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryStat label="Payslips" value={payslips.length} hint="Released payroll receipts on file." />
            <SummaryStat label={`Total net pay (${currentYear})`} value={toCurrency(totalNetPayThisYear)} hint="Combined take-home pay across listed records for the current year." />
            <SummaryStat label="Status" value={payslips.length > 0 ? "Ready" : "Empty"} hint={payslips.length > 0 ? "Generated from the payroll engine." : "No payroll records generated yet."} />
          </div>

          <Card className="overflow-hidden border-transparent bg-white shadow-[0_22px_50px_rgba(15,23,42,0.08),0_4px_14px_rgba(15,23,42,0.04)]">
            <CardHeader className="bg-[linear-gradient(180deg,#f8fafc_0%,#f8fafc_62%,rgba(248,250,252,0)_100%)]">
              <CardTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <BadgeDollarSign className="h-4 w-4 text-primary" /> Payslips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {payslips.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                  No payslips yet. Your HR team will generate payslips after running the payroll cutoff.
                </div>
              ) : (
                payslips.map((payslip) => (
                  <div
                    key={payslip.payslip_id}
                    className="rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06),0_3px_10px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08),0_4px_12px_rgba(15,23,42,0.05)] md:p-6"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <p className="text-lg font-semibold tracking-tight text-slate-950">{formatPeriod(payslip)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Generated: {new Date(payslip.created_at).toLocaleDateString()} · {payslip.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                      <Badge variant="outline" className="rounded-full border-transparent bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-900 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.14)]">Net {toCurrency(payslip.net_pay)}</Badge>
                      <Button
                        size="sm"
                        onClick={() => {
                          setPendingReceiptId(payslip.payslip_id);
                          setAuthOpen(true);
                        }}
                        className="h-10 rounded-full px-4 shadow-[0_10px_24px_rgba(37,99,235,0.18)]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View Receipt
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-package" className="space-y-4">
          {!packageUnlocked ? (
            <Card className="overflow-hidden border-transparent bg-white shadow-[0_22px_50px_rgba(15,23,42,0.08),0_4px_14px_rgba(15,23,42,0.04)]">
              <CardHeader className="bg-[linear-gradient(180deg,#f8fafc_0%,#f8fafc_62%,rgba(248,250,252,0)_100%)]">
                <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <Lock className="h-4 w-4" /> My Package
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <p className="text-sm leading-6 text-slate-500">
                  Verify your identity to view your salary, benefits, and statutory IDs.
                </p>
                <Button onClick={() => setAuthOpen(true)} className="rounded-xl px-4">Unlock My Package</Button>
              </CardContent>
            </Card>
          ) : loadingPackage ? (
            <div className="min-h-40 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading compensation package...</span>
            </div>
          ) : (
            <>
              <Card className="overflow-hidden border-transparent bg-white shadow-[0_22px_50px_rgba(15,23,42,0.08),0_4px_14px_rgba(15,23,42,0.04)]">
                <CardHeader className="bg-[linear-gradient(180deg,#f8fafc_0%,#f8fafc_62%,rgba(248,250,252,0)_100%)]">
                  <CardTitle className="text-base font-bold tracking-tight">Salary</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  {myPackage?.salary ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_14px_28px_rgba(15,23,42,0.06),0_2px_8px_rgba(15,23,42,0.04)]">
                        <p className="text-xs text-slate-500">Basic Salary</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">{toCurrency(myPackage.salary.basic_salary)}</p>
                      </div>
                      <div className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_14px_28px_rgba(15,23,42,0.06),0_2px_8px_rgba(15,23,42,0.04)]">
                        <p className="text-xs text-slate-500">Pay Frequency</p>
                        <p className="mt-2 text-lg font-semibold capitalize text-slate-950">{myPackage.salary.pay_frequency}</p>
                      </div>
                      <div className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_14px_28px_rgba(15,23,42,0.06),0_2px_8px_rgba(15,23,42,0.04)]">
                        <p className="text-xs text-slate-500">Effective Date</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">{new Date(myPackage.salary.effective_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Your salary record has not been set up yet. Contact HR.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-transparent bg-white shadow-[0_22px_50px_rgba(15,23,42,0.08),0_4px_14px_rgba(15,23,42,0.04)]">
                <CardHeader className="bg-[linear-gradient(180deg,#f8fafc_0%,#f8fafc_62%,rgba(248,250,252,0)_100%)]">
                  <CardTitle className="text-base font-bold tracking-tight">Benefits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-5">
                  {myPackage?.benefits?.length ? (
                    myPackage.benefits.map((benefit) => (
                      <div key={benefit.mapping_id} className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 flex flex-col gap-1 shadow-[0_14px_28px_rgba(15,23,42,0.06),0_2px_8px_rgba(15,23,42,0.04)] md:flex-row md:items-center md:justify-between">
                        <p className="text-sm font-semibold">{benefit.benefit_name ?? "Unknown Benefit"}</p>
                        <p className="text-sm text-muted-foreground">
                          {benefit.benefit_type ?? "N/A"} · {toCurrency(benefit.amount)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No assigned benefits.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-transparent bg-white shadow-[0_22px_50px_rgba(15,23,42,0.08),0_4px_14px_rgba(15,23,42,0.04)]">
                <CardHeader className="bg-[linear-gradient(180deg,#f8fafc_0%,#f8fafc_62%,rgba(248,250,252,0)_100%)]">
                  <CardTitle className="text-base font-bold tracking-tight">Statutory IDs</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 p-5 md:grid-cols-2">
                  {[
                    { label: "TIN", value: myPackage?.statutory?.tin_number },
                    { label: "SSS", value: myPackage?.statutory?.sss_number },
                    { label: "PhilHealth", value: myPackage?.statutory?.philhealth_number },
                    { label: "Pag-IBIG", value: myPackage?.statutory?.pagibig_number },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_14px_28px_rgba(15,23,42,0.06),0_2px_8px_rgba(15,23,42,0.04)]">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold">{maskId(value)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <SecondaryAuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="Unlock Payslip"
        description="Enter your account password to view payslip details."
        onVerified={() => {
          if (activeTab === "my-package") {
            setPackageUnlocked(true);
            return;
          }
          if (!pendingReceiptId) return;
          const found = payslips.find((payslip) => payslip.payslip_id === pendingReceiptId) ?? null;
          setReceiptPayslip(found);
          setPendingReceiptId(null);
        }}
      />

      <Dialog open={!!receiptPayslip} onOpenChange={(open) => { if (!open) setReceiptPayslip(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Payslip Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptPayslip && <PayslipReceiptView payslip={receiptPayslip} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
