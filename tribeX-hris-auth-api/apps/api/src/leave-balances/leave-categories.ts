export enum LeaveCategory {
  SICK      = 'Sick Leave',
  VACATION  = 'Vacation Leave',
  PERSONAL  = 'Personal Leave',
  EMERGENCY = 'Emergency Leave',
  MATERNITY = 'Maternity Leave',
  PATERNITY = 'Paternity Leave',
}

export const LEAVE_CATEGORIES: LeaveCategory[] = [
  LeaveCategory.SICK,
  LeaveCategory.VACATION,
  LeaveCategory.PERSONAL,
  LeaveCategory.EMERGENCY,
  LeaveCategory.MATERNITY,
  LeaveCategory.PATERNITY,
];
