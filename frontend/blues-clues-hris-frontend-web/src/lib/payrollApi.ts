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

const mockPayslips: PayslipEntry[] = [
  {
    payslip_id: "mock-ps-2026-03",
    pay_period: "Mar 16-31, 2026",
    basic_pay: 18500,
    allowances: 2200,
    deductions: 1850,
    tax: 1245,
    net_pay: 17605,
    created_at: "2026-03-31T12:00:00.000Z",
  },
  {
    payslip_id: "mock-ps-2026-02",
    pay_period: "Feb 16-28, 2026",
    basic_pay: 18500,
    allowances: 2200,
    deductions: 1710,
    tax: 1215,
    net_pay: 17775,
    created_at: "2026-02-28T12:00:00.000Z",
  },
];

const mockLedger: PayrollLedgerEntry[] = [
  {
    payroll_id: "mock-pr-001",
    employee_id: "empno-00001",
    employee_name: "Sarah Miller",
    cutoff_date: "2026-03-31",
    gross_pay: 52000,
    deductions: 7200,
    net_pay: 44800,
    status: "processed",
  },
  {
    payroll_id: "mock-pr-002",
    employee_id: "empno-00002",
    employee_name: "John Doe",
    cutoff_date: "2026-03-31",
    gross_pay: 38000,
    deductions: 5200,
    net_pay: 32800,
    status: "draft",
  },
];

export async function getMyPayslips(): Promise<PayslipEntry[]> {
  const res = await authFetch(`${API_BASE_URL}/payroll/me/payslips`);
  const data = await res.json().catch(() => []);

  if (res.status === 404) return mockPayslips;
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to load payslips");
  }
  return data as PayslipEntry[];
}

export async function getPayrollLedger(cutoffDate?: string): Promise<PayrollLedgerEntry[]> {
  const query = cutoffDate ? `?cutoff=${encodeURIComponent(cutoffDate)}` : "";
  const res = await authFetch(`${API_BASE_URL}/payroll/ledger${query}`);
  const data = await res.json().catch(() => []);

  if (res.status === 404) return mockLedger;
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to load payroll ledger");
  }
  return data as PayrollLedgerEntry[];
}

export async function runPayrollCutoff(cutoffDate: string): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE_URL}/payroll/cutoff/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cutoff_date: cutoffDate }),
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 404) {
    throw new Error("Payroll cutoff endpoint is not available yet in backend.");
  }
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to run payroll cutoff");
  }
  return data as { message: string };
}