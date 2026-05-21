import { API_BASE_URL } from "./api";
import { authFetch } from "./authApi";

export type DeductionType = "percentage" | "fixed_amount";

export type StatutoryRate = {
  type: DeductionType;
  value: number;
};

export type StatutoryDeductionConfig = {
  company_id: string;
  sss: StatutoryRate;
  philhealth: StatutoryRate;
  pagibig: StatutoryRate;
  notes?: string | null;
  updated_at?: string | null;
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

export type TenantPayrollSettings = {
  working_days_per_year: number;
  overtime_multiplier: number;
  late_deduction_per_hour: number;
  night_shift_diff_multiplier: number;
};

export type TenantConfigResponse = {
  company_id: string;
  payroll_settings: TenantPayrollSettings;
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function getTenantPayrollConfig(): Promise<TenantConfigResponse> {
  const res = await authFetch(`${API_BASE_URL}/users/tenant-config`);
  return parseJson<TenantConfigResponse>(res);
}

export async function updateTenantPayrollConfig(payroll_settings: TenantPayrollSettings): Promise<TenantConfigResponse> {
  const res = await authFetch(`${API_BASE_URL}/users/tenant-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payroll_settings }),
  });
  return parseJson<TenantConfigResponse>(res);
}

export async function getStatutoryDeductionConfig(): Promise<StatutoryDeductionConfig> {
  const res = await authFetch(`${API_BASE_URL}/cnb/statutory-deduction-config`);
  return parseJson<StatutoryDeductionConfig>(res);
}

export async function saveStatutoryDeductionConfig(payload: {
  sss?: StatutoryRate;
  philhealth?: StatutoryRate;
  pagibig?: StatutoryRate;
  notes?: string;
}): Promise<StatutoryDeductionConfig> {
  const res = await authFetch(`${API_BASE_URL}/cnb/statutory-deduction-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<StatutoryDeductionConfig>(res);
}

export async function getTaxBrackets(year?: number): Promise<TaxBracket[]> {
  const params = year ? `?year=${year}` : "";
  const res = await authFetch(`${API_BASE_URL}/cnb/tax-brackets${params}`);
  return parseJson<TaxBracket[]>(res);
}

export async function createTaxBracket(payload: {
  effective_year: number;
  min_salary: number;
  max_salary: number;
  base_tax_amount: number;
  excess_percentage: number;
}): Promise<TaxBracket> {
  const res = await authFetch(`${API_BASE_URL}/cnb/tax-brackets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<TaxBracket>(res);
}

export async function deleteTaxBracket(bracketId: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/cnb/tax-brackets/${bracketId}`, {
    method: "DELETE",
  });
  await parseJson<Record<string, unknown>>(res);
}
