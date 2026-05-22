"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Lock,
  PencilLine,
  PlayCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SecondaryAuthModal } from "@/components/security/SecondaryAuthModal";
import { downloadPayslipPdf, type PayslipExportContext } from "@/components/payroll/payslipPdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDirectorySnapshot, type DirectoryUser } from "@/lib/hrDirectoryApi";
import {
  assignEmployeeBenefit,
  computeSalaryAnnualization,
  createBenefitCatalogItem,
  getAllSalaryBaselines,
  getBenefitsCatalog,
  getEmployeeBenefits,
  getPayslipsForPeriod,
  getSalaryBaseline,
  getStatutoryIds,
  removeEmployeeBenefit,
  reviewPayslip,
  runPayrollCutoff,
  saveStatutoryIds,
  setSalaryBaseline,
  updateBenefitCatalogItem,
  type BenefitCatalogItem,
  type ComputedPayslip,
  type EmployeeBenefitItem,
  type PayslipBreakdown,
  type PayrollRunResult,
  type SalaryBaseline,
  type SalaryAnnualizationResult,
  type SalaryBaselineOverview,
  type StatutoryIds,
} from "@/lib/payrollApi";

const toCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const BENEFIT_TYPE_OPTIONS = new Set([
  "allowance",
  "incentive",
  "one_time_incentive",
  "13th_month",
  "retirement",
]);

const normalizeBenefitTypeValue = (value: string) => {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();

  const aliases: Record<string, string> = {
    allowance: "allowance",
    incentive: "incentive",
    "one-time incentive": "one_time_incentive",
    "one time incentive": "one_time_incentive",
    one_time_incentive: "one_time_incentive",
    "13th month pay": "13th_month",
    "13th_month": "13th_month",
    retirement: "retirement",
    "retirement benefit": "retirement",
  };

  return aliases[normalized] ?? trimmed;
};

const getStatusColor = (status: string) => {
  if (status === "released" || status === "Approved") return "bg-emerald-100 text-emerald-700";
  if (status === "processed") return "bg-sky-100 text-sky-700";
  if (status === "Correction Needed") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
};

type StatutoryForm = {
  tin_number: string;
  sss_number: string;
  philhealth_number: string;
  pagibig_number: string;
};

type StatutoryFieldKey = keyof StatutoryForm;

const STATUTORY_FIELD_CONFIG: Record<
  StatutoryFieldKey,
  { label: string; digits: number; maxLength: number; placeholder: string; format: (digits: string) => string }
> = {
  tin_number: {
    label: "TIN",
    digits: 12,
    maxLength: 15,
    placeholder: "123-456-789-000",
    format: (digits) => {
      const value = digits.slice(0, 12);
      const groups = [value.slice(0, 3), value.slice(3, 6), value.slice(6, 9), value.slice(9, 12)];
      return groups.filter(Boolean).join("-");
    },
  },
  sss_number: {
    label: "SSS",
    digits: 10,
    maxLength: 12,
    placeholder: "12-3456789-0",
    format: (digits) => {
      const value = digits.slice(0, 10);
      const groups = [value.slice(0, 2), value.slice(2, 9), value.slice(9, 10)];
      return groups.filter(Boolean).join("-");
    },
  },
  philhealth_number: {
    label: "PhilHealth",
    digits: 12,
    maxLength: 15,
    placeholder: "12-345678901-2",
    format: (digits) => {
      const value = digits.slice(0, 12);
      const groups = [value.slice(0, 2), value.slice(2, 11), value.slice(11, 12)];
      return groups.filter(Boolean).join("-");
    },
  },
  pagibig_number: {
    label: "Pag-IBIG",
    digits: 12,
    maxLength: 15,
    placeholder: "1234-5678-9012",
    format: (digits) => {
      const value = digits.slice(0, 12);
      const groups = [value.slice(0, 4), value.slice(4, 8), value.slice(8, 12)];
      return groups.filter(Boolean).join("-");
    },
  },
};

function formatStatutoryValue(field: StatutoryFieldKey, rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");
  return STATUTORY_FIELD_CONFIG[field].format(digits);
}

function getStatutoryDigitCount(value: string) {
  return value.replace(/\D/g, "").length;
}

export default function HRPayrollPage() {
  const [activeTab, setActiveTab] = useState("payroll-run");
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const employees = useMemo(() => users.filter((u) => !!u.employee_id), [users]);

  const [rows, setRows] = useState<ComputedPayslip[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [locked, setLocked] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingLedgerPeriodId, setPendingLedgerPeriodId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [cutoffStartDate, setCutoffStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [cutoffEndDate, setCutoffEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payoutDate, setPayoutDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 5); return d.toISOString().slice(0, 10);
  });
  const [payrollResult, setPayrollResult] = useState<PayrollRunResult | null>(null);
  const [reviewingPayslipId, setReviewingPayslipId] = useState<string | null>(null);
  const [receiptPayslip, setReceiptPayslip] = useState<ComputedPayslip | null>(null);

  const [salaryUserId, setSalaryUserId] = useState<string>("");
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salarySaving, setSalarySaving] = useState(false);
  const [currentSalary, setCurrentSalary] = useState<SalaryBaseline | null>(null);
  const [basicSalary, setBasicSalary] = useState("");
  const [payFrequency, setPayFrequency] = useState<"daily" | "weekly" | "monthly" | "semi-monthly">("monthly");
  const [salaryEffectiveDate, setSalaryEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [allSalaryBaselines, setAllSalaryBaselines] = useState<SalaryBaselineOverview[]>([]);
  const [allSalaryLoading, setAllSalaryLoading] = useState(false);
  const [annualizationRate, setAnnualizationRate] = useState("5");
  const [annualizationYears, setAnnualizationYears] = useState("5");
  const [annualizationLoading, setAnnualizationLoading] = useState(false);
  const [annualizationResult, setAnnualizationResult] = useState<SalaryAnnualizationResult | null>(null);

  const [catalog, setCatalog] = useState<BenefitCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [benefitsUserId, setBenefitsUserId] = useState<string>("");
  const [employeeBenefits, setEmployeeBenefits] = useState<EmployeeBenefitItem[]>([]);
  const [employeeBenefitsLoading, setEmployeeBenefitsLoading] = useState(false);

  const [addCatalogOpen, setAddCatalogOpen] = useState(false);
  const [creatingCatalog, setCreatingCatalog] = useState(false);
  const [newBenefitName, setNewBenefitName] = useState("");
  const [newBenefitType, setNewBenefitType] = useState("allowance");
  const [newBenefitCustomType, setNewBenefitCustomType] = useState("");
  const [newBenefitTaxable, setNewBenefitTaxable] = useState(false);
  const [newBenefitDefaultAmount, setNewBenefitDefaultAmount] = useState("");
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [deletingCatalogId, setDeletingCatalogId] = useState<string | null>(null);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningBenefit, setAssigningBenefit] = useState(false);
  const [assignBenefitId, setAssignBenefitId] = useState("");
  const [assignAmount, setAssignAmount] = useState("");
  const [assignEffectiveDate, setAssignEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null);

  const [statutoryUserId, setStatutoryUserId] = useState<string>("");
  const [statutoryLoading, setStatutoryLoading] = useState(false);
  const [statutorySaving, setStatutorySaving] = useState(false);
  const [statutoryData, setStatutoryData] = useState<StatutoryIds | null>(null);
  const [statutoryForm, setStatutoryForm] = useState<StatutoryForm>({
    tin_number: "",
    sss_number: "",
    philhealth_number: "",
    pagibig_number: "",
  });

  const loadUsers = async () => {
    try {
      const snapshot = await getDirectorySnapshot();
      setUsers(snapshot.users);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    }
  };

  const loadAllSalaryBaselines = async () => {
    setAllSalaryLoading(true);
    try {
      const data = await getAllSalaryBaselines();
      setAllSalaryBaselines(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load salary overview");
    } finally {
      setAllSalaryLoading(false);
    }
  };

  const loadPayslipsForPeriod = async (periodId: string) => {
    setLoadingLedger(true);
    try {
      const data = await getPayslipsForPeriod(periodId);
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payslips");
    } finally {
      setLoadingLedger(false);
    }
  };

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const data = await getBenefitsCatalog();
      setCatalog(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load benefits catalog");
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadSalaryBaseline = async (userId: string) => {
    if (!userId) return;
    setSalaryLoading(true);
    try {
      const data = await getSalaryBaseline(userId);
      setCurrentSalary(data);
      if (data) {
        setBasicSalary(String(data.basic_salary));
        setPayFrequency(
          data.pay_frequency === "daily" || data.pay_frequency === "weekly" || data.pay_frequency === "semi-monthly"
            ? data.pay_frequency
            : "monthly",
        );
        setSalaryEffectiveDate(data.effective_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      } else {
        setBasicSalary("");
        setPayFrequency("monthly");
        setSalaryEffectiveDate(new Date().toISOString().slice(0, 10));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load salary baseline");
    } finally {
      setSalaryLoading(false);
    }
  };

  const loadEmployeeBenefits = async (userId: string) => {
    if (!userId) return;
    setEmployeeBenefitsLoading(true);
    try {
      const data = await getEmployeeBenefits(userId);
      setEmployeeBenefits(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load employee benefits");
      setEmployeeBenefits([]);
    } finally {
      setEmployeeBenefitsLoading(false);
    }
  };

  const loadStatutoryIds = async (userId: string) => {
    if (!userId) return;
    setStatutoryLoading(true);
    try {
      const data = await getStatutoryIds(userId);
      setStatutoryData(data);
      setStatutoryForm({
        tin_number: formatStatutoryValue("tin_number", data?.tin_number ?? ""),
        sss_number: formatStatutoryValue("sss_number", data?.sss_number ?? ""),
        philhealth_number: formatStatutoryValue("philhealth_number", data?.philhealth_number ?? ""),
        pagibig_number: formatStatutoryValue("pagibig_number", data?.pagibig_number ?? ""),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load statutory IDs");
      setStatutoryData(null);
    } finally {
      setStatutoryLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadUsers(), loadCatalog(), loadAllSalaryBaselines()]);
  }, []);

  useEffect(() => {
    if (!salaryUserId && employees.length) setSalaryUserId(employees[0].user_id);
    if (!benefitsUserId && employees.length) setBenefitsUserId(employees[0].user_id);
    if (!statutoryUserId && employees.length) setStatutoryUserId(employees[0].user_id);
  }, [employees, salaryUserId, benefitsUserId, statutoryUserId]);

  useEffect(() => {
    setAnnualizationResult(null);
    if (salaryUserId) void loadSalaryBaseline(salaryUserId);
  }, [salaryUserId]);

  useEffect(() => {
    if (benefitsUserId) void loadEmployeeBenefits(benefitsUserId);
  }, [benefitsUserId]);

  useEffect(() => {
    if (statutoryUserId) void loadStatutoryIds(statutoryUserId);
  }, [statutoryUserId]);

  useEffect(() => {
    if (!assignBenefitId) return;
    const selectedBenefit = catalog.find((item) => item.benefit_id === assignBenefitId);
    if (selectedBenefit) {
      setAssignAmount(String(selectedBenefit.default_amount ?? 0));
    }
  }, [assignBenefitId, catalog]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.gross += Number(row.gross_pay);
          acc.deductions += Number(row.total_deductions);
          acc.net += Number(row.net_pay);
          return acc;
        },
        { gross: 0, deductions: 0, net: 0 },
      ),
    [rows],
  );

  const handleRunCutoff = async () => {
    if (!cutoffStartDate || !cutoffEndDate || !payoutDate) {
      toast.error("Please fill in all date fields.");
      return;
    }
    if (cutoffEndDate < cutoffStartDate) {
      toast.error("Cutoff end date cannot be before the start date.");
      return;
    }
    if (payoutDate < cutoffEndDate) {
      toast.error("Payout date cannot be before the cutoff end date.");
      return;
    }
    setRunning(true);
    try {
      const result = await runPayrollCutoff({
        cutoff_start_date: cutoffStartDate,
        cutoff_end_date: cutoffEndDate,
        payout_date: payoutDate,
      });
      setPayrollResult(result);
      setLocked(true);
      setRows([]);
      setPendingLedgerPeriodId(result.period_id);
      toast.success(
        `Payroll computed: ${result.computed} employees processed, ${result.skipped} skipped.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run payroll");
    } finally {
      setRunning(false);
    }
  };

  const handleReviewPayslip = async (
    payslipId: string,
    status: "Approved" | "Correction Needed",
  ) => {
    setReviewingPayslipId(payslipId);
    try {
      await reviewPayslip(payslipId, status);
      toast.success(`Payslip marked as ${status}.`);
      if (payrollResult?.period_id) {
        await loadPayslipsForPeriod(payrollResult.period_id);
      } else {
        setRows((prev) =>
          prev.map((row) =>
            row.payslip_id === payslipId ? { ...row, status } : row,
          ),
        );
        setReceiptPayslip((prev) =>
          prev?.payslip_id === payslipId ? { ...prev, status } : prev,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to review payslip");
    } finally {
      setReviewingPayslipId(null);
    }
  };

  const handleSaveSalary = async () => {
    if (!salaryUserId) {
      toast.error("Select an employee first.");
      return;
    }
    const parsed = Number(basicSalary);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Basic salary must be greater than 0.");
      return;
    }
    if (!salaryEffectiveDate) {
      toast.error("Effective date is required.");
      return;
    }

    setSalarySaving(true);
    try {
      await setSalaryBaseline({
        user_id: salaryUserId,
        pay_frequency: payFrequency,
        basic_salary: parsed,
        effective_date: salaryEffectiveDate,
      });
      toast.success("Salary baseline saved.");
      await Promise.all([loadSalaryBaseline(salaryUserId), loadAllSalaryBaselines()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save salary baseline");
    } finally {
      setSalarySaving(false);
    }
  };

  const handleComputeAnnualization = async () => {
    if (!salaryUserId) {
      toast.error("Select an employee first.");
      return;
    }

    const annualRatePercent = Number(annualizationRate);
    const years = Number(annualizationYears);

    if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) {
      toast.error("Annual increase rate must be 0 or higher.");
      return;
    }
    if (!Number.isInteger(years) || years < 1) {
      toast.error("Projection years must be at least 1.");
      return;
    }

    setAnnualizationLoading(true);
    try {
      const result = await computeSalaryAnnualization(salaryUserId, annualRatePercent, years);
      setAnnualizationResult(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to compute annualization");
    } finally {
      setAnnualizationLoading(false);
    }
  };

  const handleCreateCatalogItem = async () => {
    if (!newBenefitName.trim()) {
      toast.error("Benefit name is required.");
      return;
    }
    const resolvedType =
      newBenefitType === "custom"
        ? newBenefitCustomType.trim()
        : newBenefitType;
    const normalizedType = normalizeBenefitTypeValue(resolvedType);
    if (!resolvedType) {
      toast.error("Custom benefit type name is required.");
      return;
    }
    setCreatingCatalog(true);
    try {
      if (editingCatalogId) {
        await updateBenefitCatalogItem(editingCatalogId, {
          benefit_name: newBenefitName.trim(),
          benefit_type: normalizedType,
          taxable: newBenefitTaxable,
          default_amount: Number(newBenefitDefaultAmount || 0),
        });
        toast.success("Benefit type updated.");
      } else {
        await createBenefitCatalogItem({
          benefit_name: newBenefitName.trim(),
          benefit_type: normalizedType,
          taxable: newBenefitTaxable,
          default_amount: Number(newBenefitDefaultAmount || 0),
        });
        toast.success("Benefit type added.");
      }
      setAddCatalogOpen(false);
      resetCatalogForm();
      await loadCatalog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save benefit type");
    } finally {
      setCreatingCatalog(false);
    }
  };

  const handleEditCatalogItem = (item: BenefitCatalogItem) => {
    const normalizedType = normalizeBenefitTypeValue(item.benefit_type);
    setEditingCatalogId(item.benefit_id);
    setNewBenefitName(item.benefit_name);
    if (BENEFIT_TYPE_OPTIONS.has(normalizedType)) {
      setNewBenefitType(normalizedType);
      setNewBenefitCustomType("");
    } else {
      setNewBenefitType("custom");
      setNewBenefitCustomType(item.benefit_type);
    }
    setNewBenefitTaxable(item.taxable);
    setNewBenefitDefaultAmount(String(item.default_amount ?? 0));
    setAddCatalogOpen(true);
  };

  const handleDeleteCatalogItem = async (item: BenefitCatalogItem) => {
    setDeletingCatalogId(item.benefit_id);
    try {
      await updateBenefitCatalogItem(item.benefit_id, { is_active: false });
      toast.success("Benefit type deleted.");
      await loadCatalog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete benefit type");
    } finally {
      setDeletingCatalogId(null);
    }
  };

  const resetCatalogForm = () => {
    setEditingCatalogId(null);
    setNewBenefitName("");
    setNewBenefitType("allowance");
    setNewBenefitCustomType("");
    setNewBenefitTaxable(false);
    setNewBenefitDefaultAmount("");
  };

  const handleAssignBenefit = async () => {
    if (!benefitsUserId) {
      toast.error("Select an employee first.");
      return;
    }
    if (!assignBenefitId) {
      toast.error("Select a benefit.");
      return;
    }
    const amountValue = assignAmount.trim();
    const amount = amountValue ? Number(assignAmount) : undefined;
    if (amountValue && (!Number.isFinite(amount) || Number(amount) < 0)) {
      toast.error("Amount must be a valid number.");
      return;
    }
    if (!assignEffectiveDate) {
      toast.error("Effective date is required.");
      return;
    }

    setAssigningBenefit(true);
    try {
      await assignEmployeeBenefit({
        user_id: benefitsUserId,
        benefit_id: assignBenefitId,
        amount,
        effective_date: assignEffectiveDate,
      });
      toast.success("Benefit assigned.");
      setAssignDialogOpen(false);
      setAssignBenefitId("");
      setAssignAmount("");
      setAssignEffectiveDate(new Date().toISOString().slice(0, 10));
      await loadEmployeeBenefits(benefitsUserId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign benefit");
    } finally {
      setAssigningBenefit(false);
    }
  };

  const handleDeleteBenefit = async (mappingId: string) => {
    setDeletingMappingId(mappingId);
    try {
      await removeEmployeeBenefit(mappingId);
      toast.success("Benefit removed.");
      if (benefitsUserId) await loadEmployeeBenefits(benefitsUserId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove benefit");
    } finally {
      setDeletingMappingId(null);
    }
  };

  const handleSaveStatutory = async () => {
    if (!statutoryUserId) {
      toast.error("Select an employee first.");
      return;
    }

    for (const field of Object.keys(STATUTORY_FIELD_CONFIG) as StatutoryFieldKey[]) {
      const value = statutoryForm[field].trim();
      const digitCount = getStatutoryDigitCount(value);
      if (digitCount > 0 && digitCount !== STATUTORY_FIELD_CONFIG[field].digits) {
        toast.error(
          `${STATUTORY_FIELD_CONFIG[field].label} must contain exactly ${STATUTORY_FIELD_CONFIG[field].digits} digits.`,
        );
        return;
      }
    }

    setStatutorySaving(true);
    try {
      const saved = await saveStatutoryIds(statutoryUserId, {
        tin_number: statutoryForm.tin_number.trim() || undefined,
        sss_number: statutoryForm.sss_number.trim() || undefined,
        philhealth_number: statutoryForm.philhealth_number.trim() || undefined,
        pagibig_number: statutoryForm.pagibig_number.trim() || undefined,
      });
      setStatutoryData(saved);
      setStatutoryForm({
        tin_number: formatStatutoryValue("tin_number", saved.tin_number ?? ""),
        sss_number: formatStatutoryValue("sss_number", saved.sss_number ?? ""),
        philhealth_number: formatStatutoryValue("philhealth_number", saved.philhealth_number ?? ""),
        pagibig_number: formatStatutoryValue("pagibig_number", saved.pagibig_number ?? ""),
      });
      toast.success("Statutory IDs saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save statutory IDs");
    } finally {
      setStatutorySaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(140deg,#08111f_0%,#132b57_48%,#14403a_100%)] px-8 py-10 text-white shadow-sm">
        <div className="absolute inset-y-0 right-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_62%)]" />
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">HR Operations</p>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Compensation & Benefits</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/76">
              Run payroll, maintain salary baselines, manage benefit assignments, and keep statutory records clean without leaving the workspace.
            </p>
          </div>
          <div className="grid w-full max-w-md grid-cols-3 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Employees</p>
              <p className="mt-2 text-2xl font-bold [font-variant-numeric:tabular-nums]">{employees.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Benefits</p>
              <p className="mt-2 text-2xl font-bold [font-variant-numeric:tabular-nums]">{catalog.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Net ledger</p>
              <p className="mt-2 text-lg font-bold [font-variant-numeric:tabular-nums]">{toCurrency(totals.net)}</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1 lg:grid-cols-4">
          <TabsTrigger value="payroll-run">Payroll Run</TabsTrigger>
          <TabsTrigger value="salary-baselines">Salary Baselines</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="statutory-ids">Statutory IDs</TabsTrigger>
        </TabsList>

        <TabsContent value="payroll-run" className="space-y-4">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-3">
              <CardTitle className="text-base font-bold tracking-tight">Run Payroll Cutoff</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Cutoff Start Date</label>
                  <Input type="date" value={cutoffStartDate} onChange={(e) => setCutoffStartDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Cutoff End Date</label>
                  <Input type="date" value={cutoffEndDate} onChange={(e) => setCutoffEndDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Payout Date</label>
                  <Input type="date" value={payoutDate} onChange={(e) => setPayoutDate(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleRunCutoff()} disabled={running} className="h-10 px-4">
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                  Run Payroll
                </Button>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Review the computed ledger after the cutoff completes. Unlocking still requires secondary verification.
                </div>
              </div>
              {payrollResult && (
                <div className="space-y-2">
                  <div className={`rounded-lg border p-3 text-sm ${payrollResult.computed > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                    Payroll complete — <strong>{payrollResult.computed}</strong> computed,{" "}
                    <strong>{payrollResult.skipped}</strong> skipped.
                  </div>
                  {payrollResult.results.some((r) => r.error) && (
                    <details className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">
                        {payrollResult.skipped} skipped — click to see reasons
                      </summary>
                      <div className="divide-y divide-rose-100 px-3 pb-2">
                        {payrollResult.results.filter((r) => r.error).map((r) => (
                          <div key={r.user_id} className="py-1.5 text-xs">
                            <span className="font-medium">{r.name}</span>
                            <span className="text-rose-600 ml-2">{r.error}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-slate-200 bg-white/90 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500">Gross Payroll</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-slate-950 [font-variant-numeric:tabular-nums]">{toCurrency(totals.gross)}</CardContent>
            </Card>
            <Card className="border-slate-200 bg-white/90 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500">Total Deductions</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-slate-950 [font-variant-numeric:tabular-nums]">{toCurrency(totals.deductions)}</CardContent>
            </Card>
            <Card className="border-slate-200 bg-white/90 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500">Net Payroll</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-slate-950 [font-variant-numeric:tabular-nums]">{toCurrency(totals.net)}</CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/70">
              <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Payroll Ledger
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
              {loadingLedger ? (
                <div className="min-h-45 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading payroll records...</span>
                </div>
              ) : locked ? (
                <div className="space-y-3">
                  {rows.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      {rows.length} payslip{rows.length !== 1 ? "s" : ""} computed and ready. Unlock to view.
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Unlock with secondary authentication to view compensation values.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rows.map((row) => {
                    const empName = row.employee
                      ? `${row.employee.first_name} ${row.employee.last_name}`
                      : row.user_id;
                    const empId = row.employee?.employee_id ?? "";
                    const reviewing = reviewingPayslipId === row.payslip_id;
                    return (
                      <div key={row.payslip_id} className="border rounded-lg p-4 bg-muted/20">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold">{empName}</p>
                            <p className="text-xs text-muted-foreground">{empId}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(row.status as "draft" | "processed" | "released" | string)}>
                              {row.status}
                            </Badge>
                            <Badge variant="outline">Net {toCurrency(Number(row.net_pay))}</Badge>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
                          <div className="rounded-md border p-2 bg-background">Gross: {toCurrency(Number(row.gross_pay))}</div>
                          <div className="rounded-md border p-2 bg-background">Deductions: {toCurrency(Number(row.total_deductions))}</div>
                          <div className="rounded-md border p-2 bg-background">Net: {toCurrency(Number(row.net_pay))}</div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3"
                            onClick={() => setReceiptPayslip(row)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            View Receipt
                          </Button>
                          {row.status === "Pending Review" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3"
                                disabled={reviewing}
                                onClick={() => void handleReviewPayslip(row.payslip_id, "Approved")}
                              >
                                {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-rose-200 text-rose-700 hover:bg-rose-50 h-8 px-3"
                                disabled={reviewing}
                                onClick={() => void handleReviewPayslip(row.payslip_id, "Correction Needed")}
                              >
                                <X className="h-3.5 w-3.5" />
                                Correction Needed
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Run a payroll cutoff above to compute payslips for all active employees.
                    </p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary-baselines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold tracking-tight">Salary Baselines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Employee</p>
                <Select value={salaryUserId} onValueChange={setSalaryUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.user_id} value={employee.user_id}>
                        {employee.first_name} {employee.last_name} ({employee.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {salaryLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading salary baseline...
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  {currentSalary
                    ? `Current salary: ${toCurrency(Number(currentSalary.basic_salary))} (${currentSalary.pay_frequency}) effective ${new Date(currentSalary.effective_date).toLocaleDateString()}`
                    : "No current salary baseline set for this employee."}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Basic Salary (PHP)</p>
                  <Input
                    type="number"
                    min="0"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(e.target.value)}
                    placeholder="e.g. 30000"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Pay Frequency</p>
                  <Select value={payFrequency} onValueChange={(v) => setPayFrequency(v as "daily" | "weekly" | "monthly" | "semi-monthly")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">monthly</SelectItem>
                      <SelectItem value="semi-monthly">semi-monthly</SelectItem>
                      <SelectItem value="weekly">weekly</SelectItem>
                      <SelectItem value="daily">daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Effective Date</p>
                  <Input type="date" value={salaryEffectiveDate} onChange={(e) => setSalaryEffectiveDate(e.target.value)} />
                </div>
              </div>

              <Button onClick={() => void handleSaveSalary()} disabled={salarySaving}>
                {salarySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Salary Baseline
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold tracking-tight">All Employee Salaries</CardTitle>
            </CardHeader>
            <CardContent>
              {allSalaryLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading salary overview...
                </div>
              ) : allSalaryBaselines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No salary baselines set yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Employee</th>
                        <th className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">ID</th>
                        <th className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Basic Salary</th>
                        <th className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Frequency</th>
                        <th className="pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Effective Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSalaryBaselines.map((row) => (
                        <tr
                          key={row.baseline_id}
                          className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                          onClick={() => setSalaryUserId(row.user_id)}
                        >
                          <td className="py-2.5 pr-4 font-medium">
                            {row.first_name} {row.last_name}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{row.employee_id ?? "—"}</td>
                          <td className="py-2.5 pr-4 font-semibold">{toCurrency(Number(row.basic_salary))}</td>
                          <td className="py-2.5 pr-4">
                            <Badge variant="secondary" className="text-xs capitalize">{row.pay_frequency}</Badge>
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {new Date(row.effective_date).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold tracking-tight">Annualization Projection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Model yearly salary growth from the selected employee&apos;s current baseline.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Annual Increase Rate (%)</p>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={annualizationRate}
                    onChange={(e) => setAnnualizationRate(e.target.value)}
                    placeholder="e.g. 5"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Projection Years</p>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={annualizationYears}
                    onChange={(e) => setAnnualizationYears(e.target.value)}
                    placeholder="e.g. 5"
                  />
                </div>
              </div>

              <Button onClick={() => void handleComputeAnnualization()} disabled={annualizationLoading}>
                {annualizationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Compute Annualization
              </Button>

              {annualizationResult?.note ? (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                  {annualizationResult.note}
                </div>
              ) : null}

              {annualizationResult?.schedule?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Year</th>
                        <th className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Frequency</th>
                        <th className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Per Period</th>
                        <th className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Monthly Equivalent</th>
                        <th className="pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Annual Equivalent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annualizationResult.schedule.map((row) => (
                        <tr key={row.year} className="border-b last:border-0">
                          <td className="py-2.5 pr-4 font-medium">{row.year}</td>
                          <td className="py-2.5 pr-4">
                            <Badge variant="secondary" className="text-xs capitalize">{row.pay_frequency}</Badge>
                          </td>
                          <td className="py-2.5 pr-4 font-semibold">{toCurrency(row.per_period_salary)}</td>
                          <td className="py-2.5 pr-4">{toCurrency(row.monthly_equivalent)}</td>
                          <td className="py-2.5 font-semibold text-emerald-700">{toCurrency(row.annual_equivalent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benefits" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold tracking-tight">Catalog</CardTitle>
              <Dialog
                open={addCatalogOpen}
                onOpenChange={(open) => {
                  setAddCatalogOpen(open);
                  if (!open) resetCatalogForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    Add Benefit Type
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCatalogId ? "Edit Benefit Type" : "Add Benefit Type"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Name</p>
                      <Input value={newBenefitName} onChange={(e) => setNewBenefitName(e.target.value)} placeholder="Transport Allowance" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Type</p>
                      <Select value={newBenefitType} onValueChange={(v) => { setNewBenefitType(v); if (v !== "custom") setNewBenefitCustomType(""); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="allowance">Allowance</SelectItem>
                          <SelectItem value="incentive">Incentive</SelectItem>
                          <SelectItem value="one_time_incentive">One-Time Incentive</SelectItem>
                          <SelectItem value="13th_month">13th Month Pay</SelectItem>
                          <SelectItem value="retirement">Retirement Benefit</SelectItem>
                          <SelectItem value="custom">Custom Type…</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newBenefitType === "custom" && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Custom Type Name</p>
                        <Input
                          value={newBenefitCustomType}
                          onChange={(e) => setNewBenefitCustomType(e.target.value)}
                          placeholder="e.g. meal_allowance"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Default Amount</p>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newBenefitDefaultAmount}
                        onChange={(e) => setNewBenefitDefaultAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={newBenefitTaxable} onCheckedChange={(checked) => setNewBenefitTaxable(checked === true)} />
                      Taxable
                    </label>
                    <Button onClick={() => void handleCreateCatalogItem()} disabled={creatingCatalog} className="w-full">
                      {creatingCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {editingCatalogId ? "Save Benefit Type" : "Create Benefit Type"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {catalogLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading benefit catalog...
                </div>
              ) : (
                <div className="space-y-2">
                  {catalog.map((item) => (
                    <div key={item.benefit_id} className="rounded-md border p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{item.benefit_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.benefit_type} · {toCurrency(Number(item.default_amount || 0))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.taxable ? "default" : "secondary"}>
                          {item.taxable ? "Taxable" : "Non-taxable"}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEditCatalogItem(item)}
                        >
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700"
                          disabled={deletingCatalogId === item.benefit_id}
                          onClick={() => void handleDeleteCatalogItem(item)}
                        >
                          {deletingCatalogId === item.benefit_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {catalog.length === 0 ? <p className="text-sm text-muted-foreground">No benefit types yet.</p> : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold tracking-tight">Employee Benefits</CardTitle>
              <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    Assign Benefit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Benefit</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Benefit</p>
                      <Select value={assignBenefitId} onValueChange={setAssignBenefitId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select benefit" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalog.map((item) => (
                            <SelectItem key={item.benefit_id} value={item.benefit_id}>
                              {item.benefit_name} ({item.benefit_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Amount (PHP)</p>
                      <Input type="number" min="0" value={assignAmount} onChange={(e) => setAssignAmount(e.target.value)} />
                      <p className="text-xs text-muted-foreground">
                        Prefilled from the catalog default. Adjust only when this employee needs a different amount.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Effective Date</p>
                      <Input type="date" value={assignEffectiveDate} onChange={(e) => setAssignEffectiveDate(e.target.value)} />
                    </div>
                    <Button onClick={() => void handleAssignBenefit()} disabled={assigningBenefit} className="w-full">
                      {assigningBenefit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Assign
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Employee</p>
                <Select value={benefitsUserId} onValueChange={setBenefitsUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.user_id} value={employee.user_id}>
                        {employee.first_name} {employee.last_name} ({employee.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {employeeBenefitsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading employee benefits...
                </div>
              ) : (
                <div className="space-y-2">
                  {employeeBenefits.map((item) => {
                    const deleting = deletingMappingId === item.mapping_id;
                    return (
                      <div key={item.mapping_id} className="rounded-md border p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{item.benefit_name ?? "Unknown Benefit"}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.benefit_type ?? "N/A"} · {toCurrency(Number(item.amount))} · Effective{" "}
                            {new Date(item.effective_date).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700"
                          disabled={deleting}
                          onClick={() => void handleDeleteBenefit(item.mapping_id)}
                        >
                          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    );
                  })}
                  {employeeBenefits.length === 0 ? <p className="text-sm text-muted-foreground">No assigned benefits.</p> : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statutory-ids" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold tracking-tight">Statutory IDs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Employee</p>
                <Select value={statutoryUserId} onValueChange={setStatutoryUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.user_id} value={employee.user_id}>
                        {employee.first_name} {employee.last_name} ({employee.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {statutoryLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading statutory IDs...
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  {statutoryData ? "Existing statutory records loaded." : "No statutory record yet. Enter values below."}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">TIN Number</p>
                  <Input
                    inputMode="numeric"
                    maxLength={STATUTORY_FIELD_CONFIG.tin_number.maxLength}
                    placeholder={STATUTORY_FIELD_CONFIG.tin_number.placeholder}
                    value={statutoryForm.tin_number}
                    onChange={(e) =>
                      setStatutoryForm((prev) => ({
                        ...prev,
                        tin_number: formatStatutoryValue("tin_number", e.target.value),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">9 digits, auto-formatted as `123-456-789`.</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">SSS Number</p>
                  <Input
                    inputMode="numeric"
                    maxLength={STATUTORY_FIELD_CONFIG.sss_number.maxLength}
                    placeholder={STATUTORY_FIELD_CONFIG.sss_number.placeholder}
                    value={statutoryForm.sss_number}
                    onChange={(e) =>
                      setStatutoryForm((prev) => ({
                        ...prev,
                        sss_number: formatStatutoryValue("sss_number", e.target.value),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">10 digits, auto-formatted as `12-3456789-0`.</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">PhilHealth Number</p>
                  <Input
                    inputMode="numeric"
                    maxLength={STATUTORY_FIELD_CONFIG.philhealth_number.maxLength}
                    placeholder={STATUTORY_FIELD_CONFIG.philhealth_number.placeholder}
                    value={statutoryForm.philhealth_number}
                    onChange={(e) =>
                      setStatutoryForm((prev) => ({
                        ...prev,
                        philhealth_number: formatStatutoryValue("philhealth_number", e.target.value),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">12 digits, auto-formatted as `12-345678901-2`.</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Pag-IBIG MID</p>
                  <Input
                    inputMode="numeric"
                    maxLength={STATUTORY_FIELD_CONFIG.pagibig_number.maxLength}
                    placeholder={STATUTORY_FIELD_CONFIG.pagibig_number.placeholder}
                    value={statutoryForm.pagibig_number}
                    onChange={(e) =>
                      setStatutoryForm((prev) => ({
                        ...prev,
                        pagibig_number: formatStatutoryValue("pagibig_number", e.target.value),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">12 digits, auto-formatted as `1234-5678-9012`.</p>
                </div>
              </div>

              <Button onClick={() => void handleSaveStatutory()} disabled={statutorySaving}>
                {statutorySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Statutory IDs
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SecondaryAuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="Unlock Compensation Data"
        description="Re-enter your password to access payroll amounts."
        onVerified={() => {
          setLocked(false);
          if (pendingLedgerPeriodId) {
            void loadPayslipsForPeriod(pendingLedgerPeriodId);
            setPendingLedgerPeriodId(null);
          }
        }}
      />

      {/* Payslip Receipt Modal */}
      <Dialog open={!!receiptPayslip} onOpenChange={(open) => { if (!open) setReceiptPayslip(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Payslip Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptPayslip && (
            <PayslipReceiptView payslip={receiptPayslip} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayslipReceiptView({ payslip }: { payslip: ComputedPayslip }) {
  const fmt = (n: string | number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(n));

  const breakdown = payslip.breakdown as PayslipBreakdown | null;
  const sss = breakdown?.sss ?? null;
  const philhealth = breakdown?.philhealth ?? null;
  const pagibig = breakdown?.pagibig ?? null;
  const hasItemisedStatutory = sss !== null && philhealth !== null && pagibig !== null;
  const att = breakdown?.attendance;
  const coveredPeriodStart = breakdown?.coveredPeriodStart;
  const coveredPeriodEnd = breakdown?.coveredPeriodEnd;
  const showCoveredPeriod =
    !!coveredPeriodStart &&
    !!coveredPeriodEnd &&
    !!payslip.period &&
    (coveredPeriodStart !== payslip.period.cutoff_start_date ||
      coveredPeriodEnd !== payslip.period.cutoff_end_date);
  const exportContext: PayslipExportContext = {
    companyName: "Company Payroll",
    employeeName: payslip.employee ? `${payslip.employee.first_name} ${payslip.employee.last_name}` : payslip.user_id,
    employeeEmail: "",
    employeeId: payslip.employee?.employee_id ?? null,
    payFrequency: breakdown?.payFrequency ?? null,
  };

  return (
    <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-1">
      {/* Employee + period header */}
      <div className="rounded-lg bg-slate-50 border p-3 space-y-0.5">
        <p className="font-semibold">
          {payslip.employee ? `${payslip.employee.first_name} ${payslip.employee.last_name}` : payslip.user_id}
        </p>
        {payslip.employee?.employee_id && (
          <p className="text-xs text-muted-foreground">{payslip.employee.employee_id}</p>
        )}
        {payslip.period && (
          <p className="text-xs text-muted-foreground mt-1">
            Period:{" "}
            {new Date(payslip.period.cutoff_start_date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
            {" – "}
            {new Date(payslip.period.cutoff_end_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        )}
        {showCoveredPeriod && (
          <p className="text-xs text-emerald-700 mt-1">
            First payroll coverage:{" "}
            {new Date(coveredPeriodStart!).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
            {" â€“ "}
            {new Date(coveredPeriodEnd!).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>

      {/* Attendance */}
      {att && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Attendance</p>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {([
              { label: "Scheduled", val: att.scheduledDays },
              { label: "Worked",    val: att.workedDays },
              { label: "Payable",   val: att.payableDays },
            ] as const).map(({ label, val }) => (
              <div key={label} className="border rounded-md px-2 py-1.5 text-center">
                <p className="text-slate-400 text-[10px]">{label}</p>
                <p className="font-semibold">{val}d</p>
              </div>
            ))}
          </div>
          {(att.paidLeaveDays > 0 || att.unpaidLeaveDays > 0) && (
            <p className="text-xs text-muted-foreground mt-1.5 pl-1">
              {att.paidLeaveDays > 0 && `${att.paidLeaveDays} paid leave day(s)`}
              {att.paidLeaveDays > 0 && att.unpaidLeaveDays > 0 && ", "}
              {att.unpaidLeaveDays > 0 && `${att.unpaidLeaveDays} unpaid leave day(s) deducted`}
            </p>
          )}
        </div>
      )}

      {/* Earnings */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Earnings</p>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span>Basic Pay{att && att.payableDays < att.scheduledDays ? ` (${att.payableDays}/${att.scheduledDays} days)` : ""}</span>
            <span className="font-medium">{fmt(payslip.basic_pay_earned)}</span>
          </div>
          {breakdown?.benefits?.map((b, i) => (
            <div key={i} className="flex justify-between text-muted-foreground">
              <span>{b.name ?? b.type ?? "Benefit"}</span>
              <span>{fmt(b.amount)}</span>
            </div>
          ))}
          {!breakdown?.benefits?.length && Number(payslip.total_allowances) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Total Allowances</span>
              <span>{fmt(payslip.total_allowances)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between font-semibold border-t mt-2 pt-2">
          <span>Gross Pay</span>
          <span>{fmt(payslip.gross_pay)}</span>
        </div>
      </div>

      {/* Deductions */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Deductions</p>
        <div className="space-y-1.5 text-muted-foreground">
          <div className="flex justify-between">
            <span>Income Tax (Withheld)</span>
            <span>{fmt(payslip.tax_deduction)}</span>
          </div>
          {Number(payslip.tax_deduction) === 0 && (
            <p className="text-xs text-amber-600 pl-1">↳ ₱0 — no tax brackets configured.</p>
          )}
          {hasItemisedStatutory ? (
            <>
              <div className="flex justify-between"><span>SSS (Employee Share)</span><span>{fmt(sss!)}</span></div>
              <div className="flex justify-between"><span>PhilHealth (Employee Share)</span><span>{fmt(philhealth!)}</span></div>
              <div className="flex justify-between"><span>Pag-IBIG</span><span>{fmt(pagibig!)}</span></div>
            </>
          ) : (
            <div className="flex justify-between">
              <span>Statutory (SSS / PhilHealth / Pag-IBIG)</span>
              <span>{fmt(payslip.statutory_deductions)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between font-semibold border-t mt-2 pt-2 text-rose-700">
          <span>Total Deductions</span>
          <span>{fmt(payslip.total_deductions)}</span>
        </div>
      </div>

      {/* Net Pay */}
      <div className="rounded-lg bg-emerald-50 border-emerald-200 border p-3 flex justify-between items-center">
        <span className="font-bold text-emerald-900">Net Pay</span>
        <span className="font-bold text-emerald-900 text-lg">{fmt(payslip.net_pay)}</span>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => downloadPayslipPdf(payslip, exportContext)}>
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}
