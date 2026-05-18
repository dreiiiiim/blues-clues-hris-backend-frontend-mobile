"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createTaxBracket,
  deleteTaxBracket,
  getStatutoryDeductionConfig,
  getTaxBrackets,
  getTenantPayrollConfig,
  saveStatutoryDeductionConfig,
  updateTenantPayrollConfig,
  type DeductionType,
  type StatutoryRate,
  type TaxBracket,
  type TenantPayrollSettings,
} from "@/lib/cnbAdminApi";
import { Calculator, Loader2, Percent, PiggyBank, Plus, Save, Trash2 } from "lucide-react";

type StatutoryFormState = {
  sss: StatutoryRate;
  philhealth: StatutoryRate;
  pagibig: StatutoryRate;
  notes: string;
};

type TaxBracketFormState = {
  effective_year: string;
  min_salary: string;
  max_salary: string;
  base_tax_amount: string;
  excess_percentage: string;
};

const EMPTY_BRACKET: TaxBracketFormState = {
  effective_year: String(new Date().getFullYear()),
  min_salary: "",
  max_salary: "",
  base_tax_amount: "",
  excess_percentage: "",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function CompensationSettingsPage() {
  const [payrollSettings, setPayrollSettings] = useState<TenantPayrollSettings>({
    working_days_per_year: 260,
    overtime_multiplier: 1.25,
    late_deduction_per_hour: 50,
    night_shift_diff_multiplier: 1.1,
  });
  const [statutoryForm, setStatutoryForm] = useState<StatutoryFormState>({
    sss: { type: "percentage", value: 4.5 },
    philhealth: { type: "percentage", value: 2.5 },
    pagibig: { type: "percentage", value: 2.0 },
    notes: "",
  });
  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[]>([]);
  const [taxForm, setTaxForm] = useState<TaxBracketFormState>(EMPTY_BRACKET);
  const [loading, setLoading] = useState(true);
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [savingStatutory, setSavingStatutory] = useState(false);
  const [savingBracket, setSavingBracket] = useState(false);
  const [deletingBracketId, setDeletingBracketId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantConfig, statutoryConfig, bracketData] = await Promise.all([
        getTenantPayrollConfig(),
        getStatutoryDeductionConfig(),
        getTaxBrackets(),
      ]);

      setPayrollSettings(tenantConfig.payroll_settings);
      setStatutoryForm({
        sss: statutoryConfig.sss,
        philhealth: statutoryConfig.philhealth,
        pagibig: statutoryConfig.pagibig,
        notes: statutoryConfig.notes ?? "",
      });
      setTaxBrackets(bracketData);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load compensation settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const activeYearBrackets = taxBrackets.filter((bracket) => bracket.effective_year === currentYear).length;
    return {
      totalBrackets: taxBrackets.length,
      activeYearBrackets,
      overtimeMultiplier: payrollSettings.overtime_multiplier,
      lateRate: payrollSettings.late_deduction_per_hour,
    };
  }, [payrollSettings, taxBrackets]);

  async function handleSavePayroll() {
    setSavingPayroll(true);
    try {
      const payload: TenantPayrollSettings = {
        working_days_per_year: Number(payrollSettings.working_days_per_year),
        overtime_multiplier: Number(payrollSettings.overtime_multiplier),
        late_deduction_per_hour: Number(payrollSettings.late_deduction_per_hour),
        night_shift_diff_multiplier: Number(payrollSettings.night_shift_diff_multiplier),
      };
      const data = await updateTenantPayrollConfig(payload);
      setPayrollSettings(data.payroll_settings);
      toast.success("Payroll settings updated.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save payroll settings.");
    } finally {
      setSavingPayroll(false);
    }
  }

  async function handleSaveStatutory() {
    setSavingStatutory(true);
    try {
      const data = await saveStatutoryDeductionConfig({
        sss: { ...statutoryForm.sss, value: Number(statutoryForm.sss.value) },
        philhealth: { ...statutoryForm.philhealth, value: Number(statutoryForm.philhealth.value) },
        pagibig: { ...statutoryForm.pagibig, value: Number(statutoryForm.pagibig.value) },
        notes: statutoryForm.notes.trim() || undefined,
      });
      setStatutoryForm({
        sss: data.sss,
        philhealth: data.philhealth,
        pagibig: data.pagibig,
        notes: data.notes ?? "",
      });
      toast.success("Statutory deduction settings updated.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save statutory deductions.");
    } finally {
      setSavingStatutory(false);
    }
  }

  async function handleCreateBracket() {
    setSavingBracket(true);
    try {
      await createTaxBracket({
        effective_year: Number(taxForm.effective_year),
        min_salary: Number(taxForm.min_salary),
        max_salary: Number(taxForm.max_salary),
        base_tax_amount: Number(taxForm.base_tax_amount),
        excess_percentage: Number(taxForm.excess_percentage),
      });
      setTaxForm(EMPTY_BRACKET);
      setTaxBrackets(await getTaxBrackets());
      toast.success("Tax bracket added.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to create tax bracket.");
    } finally {
      setSavingBracket(false);
    }
  }

  async function handleDeleteBracket(bracketId: string) {
    setDeletingBracketId(bracketId);
    try {
      await deleteTaxBracket(bracketId);
      setTaxBrackets((current) => current.filter((bracket) => bracket.bracket_id !== bracketId));
      toast.success("Tax bracket deleted.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete tax bracket.");
    } finally {
      setDeletingBracketId(null);
    }
  }

  function updateRate(key: keyof Omit<StatutoryFormState, "notes">, patch: Partial<StatutoryRate>) {
    setStatutoryForm((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading compensation settings...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">System Administration</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Compensation &amp; Benefits Settings</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Configure payroll multipliers, company deduction defaults, and tax bracket rules used during payroll computation.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Current Overtime Multiplier</p>
            <p className="mt-1 text-lg font-bold">{stats.overtimeMultiplier.toFixed(2)}x</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tax Brackets</p><p className="mt-2 text-2xl font-bold">{stats.totalBrackets}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current Year</p><p className="mt-2 text-2xl font-bold text-blue-600">{stats.activeYearBrackets}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Late Deduction/Hour</p><p className="mt-2 text-2xl font-bold text-amber-600">{formatMoney(stats.lateRate)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payroll Days/Year</p><p className="mt-2 text-2xl font-bold text-emerald-600">{payrollSettings.working_days_per_year}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="rounded-[28px] border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Payroll Multipliers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Working Days Per Year</Label><Input type="number" value={payrollSettings.working_days_per_year} onChange={(e) => setPayrollSettings((prev) => ({ ...prev, working_days_per_year: Number(e.target.value) }))} /></div>
              <div><Label>Overtime Multiplier</Label><Input type="number" step="0.01" value={payrollSettings.overtime_multiplier} onChange={(e) => setPayrollSettings((prev) => ({ ...prev, overtime_multiplier: Number(e.target.value) }))} /></div>
              <div><Label>Late Deduction Per Hour</Label><Input type="number" step="0.01" value={payrollSettings.late_deduction_per_hour} onChange={(e) => setPayrollSettings((prev) => ({ ...prev, late_deduction_per_hour: Number(e.target.value) }))} /></div>
              <div><Label>Night Shift Diff Multiplier</Label><Input type="number" step="0.01" value={payrollSettings.night_shift_diff_multiplier} onChange={(e) => setPayrollSettings((prev) => ({ ...prev, night_shift_diff_multiplier: Number(e.target.value) }))} /></div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => void handleSavePayroll()} disabled={savingPayroll}>
                {savingPayroll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Payroll Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Statutory Deduction Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {(["sss", "philhealth", "pagibig"] as const).map((key) => (
              <div key={key} className="rounded-2xl border border-border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-primary" />
                  <p className="font-semibold uppercase">{key}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Type</Label>
                    <Select value={statutoryForm[key].type} onValueChange={(value) => updateRate(key, { type: value as DeductionType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{statutoryForm[key].type === "percentage" ? "Percentage %" : "Fixed PHP Amount"}</Label>
                    <Input type="number" step="0.01" value={statutoryForm[key].value} onChange={(e) => updateRate(key, { value: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
            ))}
            <div>
              <Label>Notes</Label>
              <Textarea value={statutoryForm.notes} onChange={(e) => setStatutoryForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Updated statutory defaults for this payroll cycle." />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => void handleSaveStatutory()} disabled={savingStatutory}>
                {savingStatutory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Percent className="mr-2 h-4 w-4" />}
                Save Deduction Defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Tax Brackets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div><Label>Year</Label><Input type="number" value={taxForm.effective_year} onChange={(e) => setTaxForm((prev) => ({ ...prev, effective_year: e.target.value }))} /></div>
            <div><Label>Min Salary</Label><Input type="number" step="0.01" value={taxForm.min_salary} onChange={(e) => setTaxForm((prev) => ({ ...prev, min_salary: e.target.value }))} /></div>
            <div><Label>Max Salary</Label><Input type="number" step="0.01" value={taxForm.max_salary} onChange={(e) => setTaxForm((prev) => ({ ...prev, max_salary: e.target.value }))} /></div>
            <div><Label>Base Tax</Label><Input type="number" step="0.01" value={taxForm.base_tax_amount} onChange={(e) => setTaxForm((prev) => ({ ...prev, base_tax_amount: e.target.value }))} /></div>
            <div><Label>Excess %</Label><Input type="number" step="0.0001" value={taxForm.excess_percentage} onChange={(e) => setTaxForm((prev) => ({ ...prev, excess_percentage: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void handleCreateBracket()} disabled={savingBracket}>
              {savingBracket ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Tax Bracket
            </Button>
          </div>

          <div className="space-y-3">
            {taxBrackets.map((bracket) => (
              <div key={bracket.bracket_id} className="flex flex-col gap-4 rounded-2xl border border-border p-4 md:flex-row md:items-center md:justify-between">
                <div className="grid flex-1 gap-3 md:grid-cols-5">
                  <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Year</p><p className="mt-1 font-semibold">{bracket.effective_year}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Min Salary</p><p className="mt-1 font-semibold">{formatMoney(Number(bracket.min_salary))}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Max Salary</p><p className="mt-1 font-semibold">{formatMoney(Number(bracket.max_salary))}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Base Tax</p><p className="mt-1 font-semibold">{formatMoney(Number(bracket.base_tax_amount))}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Excess %</p><p className="mt-1 font-semibold">{Number(bracket.excess_percentage)}%</p></div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => void handleDeleteBracket(bracket.bracket_id)} disabled={deletingBracketId === bracket.bracket_id}>
                  {deletingBracketId === bracket.bracket_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
                </Button>
              </div>
            ))}
            {taxBrackets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                No tax brackets configured yet.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
