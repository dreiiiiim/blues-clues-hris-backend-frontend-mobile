import {
  Stethoscope, Palmtree, User, Zap, Baby, UserPlus,
} from "lucide-react";

export const LEAVE_CATEGORIES = [
  { value: "Sick Leave",      label: "Sick Leave",      icon: Stethoscope },
  { value: "Vacation Leave",  label: "Vacation Leave",  icon: Palmtree },
  { value: "Personal Leave",  label: "Personal Leave",  icon: User },
  { value: "Emergency Leave", label: "Emergency Leave", icon: Zap },
  { value: "Maternity Leave", label: "Maternity Leave", icon: Baby },
  { value: "Paternity Leave", label: "Paternity Leave", icon: UserPlus },
] as const;

export type LeaveCategoryValue = (typeof LEAVE_CATEGORIES)[number]["value"];
