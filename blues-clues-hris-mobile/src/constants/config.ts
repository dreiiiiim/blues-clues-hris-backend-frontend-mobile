import { UserRole } from "../services/auth";

export const MENU_CONFIG: Record<UserRole, { name: string; label: string }[]> = {
  hr: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Recruitment", label: "Recruitment" },
    { name: "Onboarding", label: "Onboarding" },
    { name: "Compensation", label: "Compensation" },
    { name: "Performance", label: "Performance" },
  ],
  manager: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Timekeeping", label: "Timekeeping Logs" },
    { name: "Team", label: "Team" },
    { name: "Approvals", label: "Approvals" },
  ],
  employee: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Profile", label: "My Profile" },
    { name: "Documents", label: "Documents" },
  ],
  applicant: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Jobs", label: "Jobs" },
    { name: "Applications", label: "My Apps" },
  ],
  system_admin: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Users", label: "Users" },
    { name: "Billing", label: "Billing" },
  ],
  admin: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Users", label: "Users" },
    { name: "Billing", label: "Billing" },
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