import { UserRole } from "../services/auth";

export const MENU_CONFIG: Record<UserRole, { name: string; label: string }[]> = {
  hr: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Timekeeping", label: "Timekeeping" },
    { name: "Jobs", label: "Jobs" },
    { name: "Candidates", label: "Candidates" },
    { name: "Onboarding", label: "Onboarding" },
    { name: "Approvals", label: "Approvals" },
    { name: "Offboarding", label: "Offboarding" },
    { name: "Performance", label: "Performance" },
    { name: "Payroll", label: "Payroll" },
    { name: "Payslips", label: "Payslips" },
  ],
  manager: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Timekeeping", label: "Timekeeping Logs" },
    { name: "Team", label: "Team" },
    { name: "Performance", label: "Performance" },
    { name: "Approvals", label: "Approvals" },
    { name: "Payslips", label: "Payslips" },
    { name: "Offboarding", label: "Offboarding" },
  ],
  employee: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Profile", label: "Profile" },
    { name: "Leave", label: "Leave" },
    { name: "Overtime", label: "Overtime" },
    { name: "Timekeeping", label: "Timekeeping" },
    { name: "Performance", label: "Performance" },
    { name: "Payslips", label: "Payslips" },
    { name: "Documents", label: "Documents" },
    { name: "Onboarding", label: "Onboarding" },
    { name: "Offboarding", label: "Offboarding" },
  ],
  applicant: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Jobs", label: "Browse Jobs" },
    { name: "Applications", label: "My Applications" },
    { name: "Profile", label: "Profile" },
    { name: "Onboarding", label: "Onboarding" },
  ],
  system_admin: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Timekeeping", label: "Timekeeping" },
    { name: "Users", label: "Users" },
    { name: "Onboarding", label: "Onboarding" },
    { name: "Offboarding", label: "Offboarding" },
    { name: "Approvals", label: "Approvals" },
    { name: "Compensation Settings", label: "Compensation Settings" },
    { name: "Subscriptions", label: "Subscriptions" },
    { name: "Performance Settings", label: "Performance Settings" },
    { name: "Settings", label: "Settings" },
    { name: "AuditLogs", label: "Audit Logs" },
  ],
  admin: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Users", label: "Users" },
    { name: "AuditLogs", label: "Audit Logs" },
    { name: "Subscriptions", label: "Subscriptions" },
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  hr: "HR Portal",
  manager: "Management Portal",
  employee: "Staff Portal",
  applicant: "Candidate Portal",
  system_admin: "System Admin",
  admin: "Admin",
};

export const SEARCH_PLACEHOLDERS: Record<UserRole, string> = {
  hr: "Search employees...",
  manager: "Search timekeeping logs...",
  employee: "Search...",
  applicant: "Search jobs...",
  system_admin: "Search...",
  admin: "Search...",
};

export const APP_NAME = "Blue's Clues";
export const APP_SUBTITLE = "HRIS";