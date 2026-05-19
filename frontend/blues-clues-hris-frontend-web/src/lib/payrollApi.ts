import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/authApi";

export type PayslipEntry = {
  payslip_id: string;
  pay_period: string;
  basic_pay: number;
  allowances: number;
  deductions: number;
  tax: number;
  net_pay: number;
  created_at: string;
};

export type PayrollLedgerEntry = {
  payroll_id: string;
  employee_id: string;
  employee_name: string;
  cutoff_date: string;
  gross_pay: number;
  deductions: number;
  net_pay: number;
  status: "draft" | "processed" | "released";
};

export type SalaryBaseline = {
  baseline_id: string;
  user_id: string;
  company_id: string;
  pay_frequency: string;
  basic_salary: number;
  effective_date: string;
};

export type SalaryBaselineOverview = {
  baseline_id: string;
  user_id: string;
  employee_id: string | null;
  first_name: string | null;
  last_name: string | null;
  basic_salary: string;
  pay_frequency: string;
  effective_date: string;
};

export type BenefitCatalogItem = {
  benefit_id: string;
  company_id: string;
  benefit_name: string;
  benefit_type: string;
  taxable: boolean;
  default_amount: number;
  is_active?: boolean;
  updated_at?: string;
};

export type PayslipDetail = {
  payslip_id: string;
  user_id: string;
  company_id: string;
  basic_pay_earned: string;
  total_allowances: string;
  gross_pay: string;
  tax_deduction: string;
  statutory_deductions: string;
  other_deductions: string | null;
  total_deductions: string;
  net_pay: string;
  status: string;
  employee_ack_status: string;
  acknowledged_at: string | null;
  created_at: string;
  period: {
    period_id: string;
    cutoff_start_date: string;
    cutoff_end_date: string;
    payout_date: string;
    status: string;
  } | null;
  breakdown?: PayslipBreakdown | null;
  benefits: EmployeeBenefitItem[];
  employee?: {
    user_id: string;
    first_name: string;
    last_name: string;
    employee_id: string | null;
    email?: string | null;
  } | null;
  company?: {
    company_id: string;
    company_name: string;
  } | null;
};

export type LeaveRequestForApproval = {
  request_id: string;
  user_id: string;
  company_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  attachment_url?: string | null;
  revocation_reason?: string | null;
  created_at: string;
  employee: {
    user_id: string;
    first_name: string;
    last_name: string;
    employee_id: string | null;
    email: string;
  } | null;
};

export type ThirteenthMonthResult = {
  year: number;
  pay_frequency?: string;
  monthly_salary: number;
  months_eligible: number;
  thirteenth_month_pay: number;
  note?: string;
};

export type SalaryAnnualizationResult = {
  pay_frequency: string | null;
  annual_rate_percent: number;
  years: number;
  schedule: Array<{
    year: number;
    pay_frequency: string;
    per_period_salary: number;
    monthly_equivalent: number;
    annual_equivalent: number;
  }>;
  note?: string;
};

export type PayrollPeriod = {
  period_id: string;
  company_id: string;
  cutoff_start_date: string;
  cutoff_end_date: string;
  payout_date: string;
  status: string;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
};

export type PayslipBreakdown = {
  sss: number;
  philhealth: number;
  pagibig: number;
  coveredPeriodStart?: string;
  coveredPeriodEnd?: string;
  firstPayrollAccumulation?: boolean;
  payFrequency?: string;
  basicPay?: {
    units: number;
    scheduledUnits: number;
    unitLabel: string;
    rate: number | null;
  };
  benefits: Array<{ name: string | null; type: string | null; amount: number }>;
  attendance?: {
    scheduledDays: number;
    workedDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    payableDays: number;
  };
  deductionDefaults?: {
    sss?: { type: string; value: number };
    philhealth?: { type: string; value: number };
    pagibig?: { type: string; value: number };
    [key: string]: unknown;
  };
};

export type ComputedPayslip = {
  payslip_id: string;
  user_id: string;
  company_id: string;
  basic_pay_earned: string;
  total_allowances: string;
  gross_pay: string;
  tax_deduction: string;
  statutory_deductions: string;
  other_deductions: string | null;
  total_deductions: string;
  net_pay: string;
  status: string;
  employee_ack_status: string;
  created_at: string;
  period?: {
    period_id: string;
    cutoff_start_date: string;
    cutoff_end_date: string;
    payout_date: string;
    status: string;
  } | null;
  breakdown: PayslipBreakdown | null;
  benefits: EmployeeBenefitItem[];
  employee?: {
    user_id: string;
    first_name: string;
    last_name: string;
    employee_id: string | null;
  } | null;
};

export type PayrollRunResult = {
  period_id: string;
  cutoff_start_date: string;
  cutoff_end_date: string;
  payout_date: string;
  total_employees: number;
  computed: number;
  skipped: number;
  results: Array<{
    user_id: string;
    name: string;
    employee_id: string | null;
    payslip?: ComputedPayslip;
    error?: string;
  }>;
};

export type EmployeeBenefitItem = {
  mapping_id: string;
  user_id: string;
  company_id?: string;
  benefit_id: string;
  amount: number;
  effective_date: string;
  benefit_name: string | null;
  benefit_type: string | null;
  taxable: boolean | null;
};

export type StatutoryIds = {
  statutory_id?: string;
  user_id: string;
  company_id: string;
  tin_number: string | null;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
};

export type TaxBracket = {
  bracket_id: string;
  company_id: string;
  effective_year: number;
  min_salary: number;
  max_salary: number;
  base_tax_amount: number;
  excess_percentage: number;
};

export type BenefitDefaults = {
  config_id?: string;
  company_id: string;
  sss: { type: "percentage" | "fixed_amount"; value: number };
  philhealth: { type: "percentage" | "fixed_amount"; value: number };
  pagibig: { type: "percentage" | "fixed_amount"; value: number };
  sss_amount: number;
  philhealth_amount: number;
  pagibig_amount: number;
  other_statutory_amount: number;
  notes?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CompensationPackage = {
  salary: SalaryBaseline | null;
  benefits: EmployeeBenefitItem[];
  statutory: StatutoryIds | null;
};

export async function getMyPayslips(): Promise<PayslipEntry[]> {
  const res = await authFetch(`${API_BASE_URL}/payroll/me/payslips`);
  const data = await res.json().catch(() => []);

  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to load payslips");
  }
  return data as PayslipEntry[];
}

export async function getPayrollLedger(cutoffDate?: string): Promise<PayrollLedgerEntry[]> {
  const query = cutoffDate ? `?cutoff=${encodeURIComponent(cutoffDate)}` : "";
  const res = await authFetch(`${API_BASE_URL}/payroll/ledger${query}`);
  const data = await res.json().catch(() => []);

  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to load payroll ledger");
  }
  return data as PayrollLedgerEntry[];
}


export async function reviewPayslip(
  payslipId: string,
  status: "Approved" | "Correction Needed",
): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/cnb/payslips/${payslipId}/review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || "Failed to review payslip");
  }
}

export async function getAllSalaryBaselines(): Promise<SalaryBaselineOverview[]> {
  const res = await authFetch(`${API_BASE_URL}/cnb/salary-baselines`);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load salary baselines");
  return (data as SalaryBaselineOverview[]) ?? [];
}

export async function getSalaryBaseline(userId: string): Promise<SalaryBaseline | null> {
  const res = await authFetch(`${API_BASE_URL}/cnb/salary-baselines/${userId}`);
  if (res.status === 404) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load salary baseline");
  return (data as SalaryBaseline | null) ?? null;
}

export async function setSalaryBaseline(body: {
  user_id: string;
  pay_frequency: "daily" | "weekly" | "monthly" | "semi-monthly";
  basic_salary: number;
  effective_date: string;
}): Promise<SalaryBaseline> {
  const res = await authFetch(`${API_BASE_URL}/cnb/salary-baselines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to save salary baseline");
  return data as SalaryBaseline;
}

export async function getBenefitsCatalog(): Promise<BenefitCatalogItem[]> {
  const res = await authFetch(`${API_BASE_URL}/cnb/benefits-catalog`);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load benefits catalog");
  return data as BenefitCatalogItem[];
}

export async function createBenefitCatalogItem(body: {
  benefit_name: string;
  benefit_type: string;
  taxable: boolean;
  default_amount: number;
}): Promise<BenefitCatalogItem> {
  const res = await authFetch(`${API_BASE_URL}/cnb/benefits-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to create benefit type");
  return data as BenefitCatalogItem;
}

export async function updateBenefitCatalogItem(
  benefitId: string,
  body: {
    benefit_name?: string;
    benefit_type?: string;
    taxable?: boolean;
    default_amount?: number;
    is_active?: boolean;
  },
): Promise<BenefitCatalogItem> {
  const res = await authFetch(`${API_BASE_URL}/cnb/benefits-catalog/${benefitId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to update benefit type");
  return data as BenefitCatalogItem;
}

export async function getEmployeeBenefits(userId: string): Promise<EmployeeBenefitItem[]> {
  const res = await authFetch(`${API_BASE_URL}/cnb/employee-benefits/${userId}`);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load employee benefits");
  return data as EmployeeBenefitItem[];
}

export async function assignEmployeeBenefit(body: {
  user_id: string;
  benefit_id: string;
  amount?: number;
  effective_date: string;
}): Promise<EmployeeBenefitItem> {
  const res = await authFetch(`${API_BASE_URL}/cnb/employee-benefits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to assign benefit");
  return data as EmployeeBenefitItem;
}

export async function removeEmployeeBenefit(mappingId: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/cnb/employee-benefits/${mappingId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || "Failed to remove benefit");
  }
}

export async function getStatutoryIds(userId: string): Promise<StatutoryIds | null> {
  const res = await authFetch(`${API_BASE_URL}/cnb/statutory-ids/${userId}`);
  if (res.status === 404) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load statutory IDs");
  return (data as StatutoryIds | null) ?? null;
}

export async function saveStatutoryIds(
  userId: string,
  body: {
    tin_number?: string;
    sss_number?: string;
    philhealth_number?: string;
    pagibig_number?: string;
  },
): Promise<StatutoryIds> {
  const res = await authFetch(`${API_BASE_URL}/cnb/statutory-ids/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to save statutory IDs");
  return data as StatutoryIds;
}

export async function getTaxBrackets(year?: number): Promise<TaxBracket[]> {
  const query = typeof year === "number" ? `?year=${encodeURIComponent(String(year))}` : "";
  const res = await authFetch(`${API_BASE_URL}/cnb/tax-brackets${query}`);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load tax brackets");
  return data as TaxBracket[];
}

export async function createTaxBracket(body: {
  effective_year: number;
  min_salary: number;
  max_salary: number;
  base_tax_amount: number;
  excess_percentage: number;
}): Promise<TaxBracket> {
  const res = await authFetch(`${API_BASE_URL}/cnb/tax-brackets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to create tax bracket");
  return data as TaxBracket;
}

export async function deleteTaxBracket(bracketId: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/cnb/tax-brackets/${bracketId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || "Failed to delete tax bracket");
  }
}

export async function getBenefitDefaults(): Promise<BenefitDefaults> {
  const res = await authFetch(`${API_BASE_URL}/cnb/benefit-defaults`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load benefit defaults");
  return data as BenefitDefaults;
}

export async function setBenefitDefaults(body: {
  sss?: { type: "percentage" | "fixed_amount"; value: number };
  philhealth?: { type: "percentage" | "fixed_amount"; value: number };
  pagibig?: { type: "percentage" | "fixed_amount"; value: number };
  other_statutory_amount?: number;
  notes?: string;
}): Promise<BenefitDefaults> {
  const res = await authFetch(`${API_BASE_URL}/cnb/benefit-defaults`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to configure benefit defaults");
  return data as BenefitDefaults;
}

export async function getMyCompensation(): Promise<CompensationPackage> {
  const res = await authFetch(`${API_BASE_URL}/cnb/me/compensation`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to load compensation package");
  }
  return data as CompensationPackage;
}

export async function getMyPayslipsFromCnb(): Promise<PayslipDetail[]> {
  const res = await authFetch(`${API_BASE_URL}/cnb/me/payslips`);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load payslips");
  return data as PayslipDetail[];
}

export async function getPayslipDetail(payslipId: string): Promise<PayslipDetail> {
  const res = await authFetch(`${API_BASE_URL}/cnb/payslips/${payslipId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load payslip detail");
  return data as PayslipDetail;
}

export async function compute13thMonthPay(userId: string, year?: number): Promise<ThirteenthMonthResult> {
  const query = year ? `?year=${year}` : "";
  const res = await authFetch(`${API_BASE_URL}/cnb/compute/13th-month/${userId}${query}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to compute 13th month pay");
  return data as ThirteenthMonthResult;
}

export async function computeSalaryAnnualization(
  userId: string,
  annualRatePercent: number,
  years = 5,
  startYear?: number,
): Promise<SalaryAnnualizationResult> {
  const params = new URLSearchParams({
    annual_rate_percent: String(annualRatePercent),
    years: String(years),
  });
  if (typeof startYear === "number") params.set("start_year", String(startYear));

  const res = await authFetch(`${API_BASE_URL}/cnb/salary-baselines/${userId}/annualization?${params.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to compute annualization");
  return data as SalaryAnnualizationResult;
}

export async function getLeaveRequestsForApproval(status?: string): Promise<LeaveRequestForApproval[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await authFetch(`${API_BASE_URL}/leave/requests${query}`);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load leave requests");
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    ...row,
    status: String(row.status ?? "Pending").toLowerCase() === "revocationrequested"
      ? "revocation_requested"
      : (row.status ?? "Pending"),
  })) as LeaveRequestForApproval[];
}

export async function reviewLeaveRequestApi(
  requestId: string,
  status: "Approved" | "Rejected",
  rejection_reason?: string,
): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/leave/requests/${requestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, rejection_reason: rejection_reason ?? null }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || "Failed to update leave request");
  }
}

export async function reviewLeaveRevocationApi(
  requestId: string,
  action: 'approve' | 'reject',
): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/leave/requests/${requestId}/review-revocation`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || 'Failed to review revocation');
  }
}

// ---------------------------------------------------------------------------
// Overtime approvals (HR)
// ---------------------------------------------------------------------------

export type OvertimeRequestForApproval = {
  ot_id: string;
  employee_id: string;
  ot_type: 'NORMAL' | 'REST_DAY' | 'HOLIDAY';
  ot_date: string;
  start_time: string;
  end_time: string;
  planned_hours: number;
  reason?: string | null;
  log_status: 'PENDING' | 'APPROVED' | 'DENIED';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_reason?: string | null;
  created_at: string;
  employee?: { first_name: string | null; last_name: string | null; employee_id: string } | null;
};

export async function getOvertimeRequestsForApproval(
  status?: string,
  type?: string,
): Promise<OvertimeRequestForApproval[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await authFetch(`${API_BASE_URL}/overtime/requests${query}`);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load OT requests");
  return data as OvertimeRequestForApproval[];
}

export async function reviewOvertimeRequestApi(
  otId: string,
  action: "approve" | "deny",
  review_reason?: string,
): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/overtime/requests/${otId}/review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, review_reason: review_reason ?? null }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || "Failed to update OT request");
  }
}

export async function runPayrollCutoff(body: {
  cutoff_start_date: string;
  cutoff_end_date: string;
  payout_date: string;
}): Promise<PayrollRunResult> {
  const res = await authFetch(`${API_BASE_URL}/cnb/payroll/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Payroll run failed");
  return data as PayrollRunResult;
}

export async function getPayrollPeriods(): Promise<PayrollPeriod[]> {
  const res = await authFetch(`${API_BASE_URL}/cnb/payroll/periods`);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load payroll periods");
  return data as PayrollPeriod[];
}

export async function getPayslipsForPeriod(periodId: string): Promise<ComputedPayslip[]> {
  const res = await authFetch(`${API_BASE_URL}/cnb/payroll/periods/${periodId}/payslips`);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to load payslips");
  return data as ComputedPayslip[];
}
