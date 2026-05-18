export const HR_ROLE_NAMES = [
  "HR Officer",
  "HR Recruiter",
  "HR Interviewer",
  "HR Compensation and Benefits Officer",
  "HR Offboarding Officer/Coordinator",
  "HR Onboarding Officer",
  "HR Performance Management Officer",
] as const;

export type HrRoleName = (typeof HR_ROLE_NAMES)[number];

const ALL_HR_SELF_SERVICE_PATHS = new Set(["/hr/payslips"]);

const HR_ALLOWED_PATHS: Record<HrRoleName, string[]> = {
  "HR Officer": [
    "/hr",
    "/hr/timekeeping",
    "/hr/payslips",
    "/hr/jobs",
    "/hr/candidates",
    "/hr/onboarding",
    "/hr/offboarding",
    "/hr/approvals",
    "/hr/payroll",
    "/hr/performance",
  ],
  "HR Recruiter": [
    "/hr/timekeeping",
    "/hr/jobs",
    "/hr/candidates",
    "/hr/onboarding",
    "/hr/approvals",
    "/hr/payslips",
  ],
  "HR Interviewer": [
    "/hr/timekeeping",
    "/hr/jobs",
    "/hr/candidates",
    "/hr/approvals",
    "/hr/payslips",
  ],
  "HR Compensation and Benefits Officer": [
    "/hr/timekeeping",
    "/hr/payroll",
    "/hr/approvals",
    "/hr/payslips",
  ],
  "HR Offboarding Officer/Coordinator": [
    "/hr/timekeeping",
    "/hr/offboarding",
    "/hr/approvals",
    "/hr/payslips",
  ],
  "HR Onboarding Officer": [
    "/hr/timekeeping",
    "/hr/onboarding",
    "/hr/approvals",
    "/hr/payslips",
  ],
  "HR Performance Management Officer": [
    "/hr/timekeeping",
    "/hr/performance",
    "/hr/approvals",
    "/hr/payslips",
  ],
};

export function isHrRoleName(roleName?: string): roleName is HrRoleName {
  return HR_ROLE_NAMES.includes(roleName as HrRoleName);
}

export function getDefaultPathForRole(roleName?: string): string {
  switch (roleName) {
    case "HR Recruiter":
    case "HR Interviewer":
      return "/hr/jobs";
    case "HR Compensation and Benefits Officer":
      return "/hr/payroll";
    case "HR Offboarding Officer/Coordinator":
      return "/hr/offboarding";
    case "HR Onboarding Officer":
      return "/hr/onboarding";
    case "HR Performance Management Officer":
      return "/hr/performance";
    default:
      return "/hr";
  }
}

export function isHrPathAllowed(roleName: string | undefined, pathname: string): boolean {
  if (!roleName || !isHrRoleName(roleName)) return false;

  if (ALL_HR_SELF_SERVICE_PATHS.has(pathname)) return true;

  const allowedRoots = HR_ALLOWED_PATHS[roleName] ?? [];
  return allowedRoots.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}
