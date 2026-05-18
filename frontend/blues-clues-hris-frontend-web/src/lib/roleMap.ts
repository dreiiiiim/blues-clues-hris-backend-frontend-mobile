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

export function portalToPath(portalKey?: string) {
  switch (portalKey) {
    case "system-admin":
      return "/system-admin";
    case "admin":
      return "/admin";
    case "hr":
      return "/hr";
    case "manager":
      return "/manager";
    case "employee":
      return "/employee";
    case "applicant":
      return "/applicant";
    default:
      return "/login";
  }
}

export function portalLabel(portalKey?: string) {
  switch (portalKey) {
    case "system-admin":
      return "System Admin Portal";
    case "admin":
      return "Admin Portal";
    case "hr":
      return "HR Portal";
    case "manager":
      return "Manager Portal";
    case "employee":
      return "Employee Portal";
    case "applicant":
      return "Applicant Portal";
    default:
      return "Portal";
  }
}
