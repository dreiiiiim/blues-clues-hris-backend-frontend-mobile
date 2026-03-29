// Shared types for the entire onboarding system

export type OnboardingStatus = "not-started" | "in-progress" | "for-review" | "approved" | "overdue";
export type ItemStatus = "pending" | "submitted" | "for-review" | "approved" | "rejected" | "issued";

export interface Remark {
  id: string;
  message: string;
  date: Date;
  author: string;
  category: "Documents" | "Tasks" | "Equipment" | "Profile" | "Forms";
}

export interface OnboardingItem {
  id: string;
  title: string;
  status: ItemStatus;
  feedback?: string;
  required: boolean;
  remarksHistory?: Remark[];
}

export interface FileUpload {
  id: string;
  name: string;
  size: number;
  uploadDate: Date;
  status: "uploaded" | "approved" | "rejected";
}

export interface DocumentItem extends OnboardingItem {
  files: FileUpload[];
  uploadHistory: FileUpload[];
  sampleUrl?: string;
}

export interface TaskItem extends OnboardingItem {
  description: string;
  completed: boolean;
  contentType: "document" | "video" | "form" | "acknowledgment";
  content?: {
    url?: string;
    text?: string;
    fields?: FormField[];
  };
}

export interface FormField {
  label: string;
  type: string;
  required: boolean;
}

export interface EquipmentItem extends OnboardingItem {
  description: string;
  quantity: number;
  proofOfReceipt: FileUpload[];
  receiptConfirmed?: boolean;
  deliveryMethod?: "office" | "delivery";
  deliveryAddress?: string;
}

// New: HR Forms (separate from documents)
export interface HRFormItem extends OnboardingItem {
  description: string;
  formType: "personal-info" | "emergency-contact" | "tax-form" | "benefits" | "direct-deposit";
  fields: FormField[];
  formData?: Record<string, any>;
}

// New: Profile data
export interface ProfileData {
  photo?: FileUpload;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phoneNumber: string;
  address: string;
  dateOfBirth?: Date;
  placeOfBirth?: string;
  nationality?: string;
  civilStatus?: string;
  status: ItemStatus;
  remarksHistory?: Remark[];
}

// Template system
export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  department: string;
  position: string;
  documents: DocumentItem[];
  tasks: TaskItem[];
  equipment: EquipmentItem[];
  hrForms: HRFormItem[];
  deadline: number; // days from start
  isActive: boolean;
  createdBy: string;
  createdDate: Date;
  lastModified: Date;
}

// Employee assignment
export interface EmployeeAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  templateId: string;
  templateName: string;
  department: string;
  position: string;
  startDate: Date;
  deadline: Date;
  status: OnboardingStatus;
  assignedBy: string;
  assignedDate: Date;
  documents: DocumentItem[];
  tasks: TaskItem[];
  equipment: EquipmentItem[];
  hrForms: HRFormItem[];
  profile: ProfileData;
  overallProgress: number;
  finalApprovalStatus: "pending" | "submitted-for-approval" | "approved" | "rejected";
  finalApprovalDate?: Date;
  finalApprovalBy?: string;
  finalRemarks?: string;
}

// Notification system
export interface Notification {
  id: string;
  type: "template-ready" | "employee-assigned" | "submission-review" | "approval-complete" | "rejection";
  title: string;
  message: string;
  from: string;
  to: string;
  date: Date;
  read: boolean;
  relatedId?: string; // template ID or employee ID
}
