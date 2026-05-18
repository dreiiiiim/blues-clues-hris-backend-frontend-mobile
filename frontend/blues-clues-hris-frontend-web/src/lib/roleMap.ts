export function roleToPath(roleName?: string) {
  switch (roleName) {
    case "System Admin":
      return "/system-admin";
    case "Admin":
      return "/admin";
    case "HR Officer":
    case "HR Recruiter":
    case "HR Interviewer":
    case "HR Compensation and Benefits Officer":
    case "HR Offboarding Officer/Coordinator":
    case "HR Onboarding Officer":
    case "HR Performance Management Officer":
      return "/hr";
    case "Active Employee":
      case "Employee":
      return "/employee";
    case "Applicant":
      return "/applicant";
    case "Manager":
    case "Group Head":
      return "/manager";
    default:
      return "/login";
  }
}
