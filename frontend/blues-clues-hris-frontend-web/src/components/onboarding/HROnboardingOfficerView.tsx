import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, Users, FileCheck, ListChecks, Package, Search, Calendar, TrendingUp, Download, MessageSquare, CheckCircle, XCircle, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { OnboardingStatus, ItemStatus } from "@/types/onboarding.types";

interface HRDocumentItem {
  id: string;
  name: string;
  status: ItemStatus;
  fileName?: string;
  uploadedDate?: Date;
  hrRemarks?: string;
}

interface HRTaskItem {
  id: string;
  name: string;
  description: string;
  status: ItemStatus;
  completedDate?: Date;
  hrRemarks?: string;
}

interface HREquipmentItem {
  id: string;
  name: string;
  category: string;
  status: ItemStatus;
  requestedDate?: Date;
  issuedDate?: Date;
  proofOfReceipt?: string;
  hrRemarks?: string;
}

interface EmployeeProfileData {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  civilStatus: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  emergencyContactEmail: string;
  status: ItemStatus;
}

interface HRRemark {
  id: string;
  author: string;
  category: string;
  timestamp: Date;
  text: string;
}

interface EmployeeDetails {
  profile: EmployeeProfileData;
  documents: HRDocumentItem[];
  tasks: HRTaskItem[];
  equipment: HREquipmentItem[];
  remarks: Record<string, HRRemark[]>;
}

interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  startDate: Date;
  deadline: Date;
  progress: number;
  status: OnboardingStatus;
  documentsCompleted: number;
  documentsTotal: number;
  tasksCompleted: number;
  tasksTotal: number;
  equipmentCompleted: number;
  equipmentTotal: number;
}

// Mock detailed employee data
const employeeDetails: Record<string, EmployeeDetails> = {
  "emp-1": {
    profile: {
      firstName: "Maria", middleName: "-", lastName: "Santos",
      email: "maria.santos@company.com", phone: "+63 917 123 4567",
      address: "123 Makati Avenue, Makati City, Metro Manila",
      dateOfBirth: "15/05/1995", placeOfBirth: "Manila, Philippines",
      nationality: "Filipino", civilStatus: "Single",
      emergencyContactName: "Maria Garcia", emergencyContactRelationship: "Mother",
      emergencyContactPhone: "+63 917 987 6543", emergencyContactEmail: "maria.garcia@email.com",
      status: "approved",
    },
    remarks: {
      documents: [{ id: "r1", author: "HR Onboarding Officer", category: "Documents", timestamp: new Date("2026-03-20T10:30:00"), text: "Please ensure the BIR form is properly filled out and signed." }],
      tasks: [{ id: "r2", author: "HR Onboarding Officer", category: "Tasks", timestamp: new Date("2026-03-21T11:00:00"), text: "Please ensure you read the entire handbook before acknowledging." }],
      equipment: [{ id: "r3", author: "HR Onboarding Officer", category: "Equipment", timestamp: new Date("2026-03-21T14:00:00"), text: "Your laptop has been issued. Please upload proof of receipt and confirm once received." }],
    },
    documents: [
      { id: "doc-1", name: "Birth Certificate (PSA)", status: "approved", fileName: "birth_cert_santos.pdf", uploadedDate: new Date("2026-03-16"), hrRemarks: "Verified and approved" },
      { id: "doc-2", name: "NBI Clearance", status: "approved", fileName: "nbi_clearance.pdf", uploadedDate: new Date("2026-03-16"), hrRemarks: "Valid until 2027" },
      { id: "doc-3", name: "SSS E-1 Form", status: "for-review", fileName: "sss_e1.pdf", uploadedDate: new Date("2026-03-19") },
      { id: "doc-4", name: "PhilHealth Member Data Record (MDR)", status: "submitted", fileName: "philhealth_mdr.pdf", uploadedDate: new Date("2026-03-19") },
      { id: "doc-5", name: "Pag-IBIG Member's Data Form (MDF)", status: "pending" },
      { id: "doc-6", name: "BIR Form 2316 (Previous Employer)", status: "pending" },
    ],
    tasks: [
      { id: "task-1", name: "Complete Company Orientation", description: "Watch orientation video and complete quiz", status: "approved", completedDate: new Date("2026-03-16"), hrRemarks: "Perfect score on quiz" },
      { id: "task-2", name: "IT Security Training", description: "Complete cybersecurity awareness module", status: "approved", completedDate: new Date("2026-03-17") },
      { id: "task-3", name: "Set Up Email Signature", description: "Configure official email signature", status: "approved", completedDate: new Date("2026-03-18") },
      { id: "task-4", name: "Review Employee Handbook", description: "Read and acknowledge employee handbook", status: "pending" },
      { id: "task-5", name: "Complete Benefits Enrollment", description: "Select health and insurance benefits", status: "pending" },
    ],
    equipment: [
      { id: "equip-1", name: "MacBook Pro M3", category: "Laptop", status: "approved", requestedDate: new Date("2026-03-15"), issuedDate: new Date("2026-03-18"), proofOfReceipt: "receipt_laptop.pdf", hrRemarks: "Asset ID: LT-2026-089" },
      { id: "equip-2", name: "External Monitor (27\")", category: "Monitor", status: "for-review", requestedDate: new Date("2026-03-15"), issuedDate: new Date("2026-03-19"), proofOfReceipt: "receipt_monitor.pdf" },
    ],
  },
  "emp-2": {
    profile: {
      firstName: "Juan", middleName: "D.", lastName: "Dela Cruz",
      email: "juan.delacruz@company.com", phone: "+63 918 234 5678",
      address: "456 BGC Avenue, Taguig City, Metro Manila",
      dateOfBirth: "22/08/1990", placeOfBirth: "Taguig, Philippines",
      nationality: "Filipino", civilStatus: "Married",
      emergencyContactName: "Rosa Dela Cruz", emergencyContactRelationship: "Spouse",
      emergencyContactPhone: "+63 918 876 5432", emergencyContactEmail: "rosa.delacruz@email.com",
      status: "for-review",
    },
    remarks: { documents: [], tasks: [], equipment: [] },
    documents: [
      { id: "doc-1", name: "Birth Certificate (PSA)", status: "approved", fileName: "birth_cert_delaCruz.pdf", uploadedDate: new Date("2026-03-18"), hrRemarks: "Approved" },
      { id: "doc-2", name: "NBI Clearance", status: "approved", fileName: "nbi_clearance.pdf", uploadedDate: new Date("2026-03-18"), hrRemarks: "Valid" },
      { id: "doc-3", name: "SSS E-1 Form", status: "for-review", fileName: "sss_e1.pdf", uploadedDate: new Date("2026-03-20") },
      { id: "doc-4", name: "PhilHealth Member Data Record (MDR)", status: "for-review", fileName: "philhealth_mdr.pdf", uploadedDate: new Date("2026-03-20") },
      { id: "doc-5", name: "Pag-IBIG Member's Data Form (MDF)", status: "for-review", fileName: "pagibig_mdf.pdf", uploadedDate: new Date("2026-03-20") },
      { id: "doc-6", name: "BIR Form 2316 (Previous Employer)", status: "for-review", fileName: "bir_2316.pdf", uploadedDate: new Date("2026-03-20") },
    ],
    tasks: [
      { id: "task-1", name: "Complete Company Orientation", description: "Watch orientation video and complete quiz", status: "approved", completedDate: new Date("2026-03-18") },
      { id: "task-2", name: "IT Security Training", description: "Complete cybersecurity awareness module", status: "approved", completedDate: new Date("2026-03-19") },
      { id: "task-3", name: "Set Up Email Signature", description: "Configure official email signature", status: "for-review", completedDate: new Date("2026-03-20") },
      { id: "task-4", name: "Review Employee Handbook", description: "Read and acknowledge employee handbook", status: "for-review", completedDate: new Date("2026-03-20") },
      { id: "task-5", name: "Complete Benefits Enrollment", description: "Select health and insurance benefits", status: "for-review", completedDate: new Date("2026-03-20") },
    ],
    equipment: [
      { id: "equip-1", name: "MacBook Air M2", category: "Laptop", status: "for-review", requestedDate: new Date("2026-03-18"), issuedDate: new Date("2026-03-20"), proofOfReceipt: "receipt_laptop.pdf" },
      { id: "equip-2", name: "Wireless Mouse", category: "Accessories", status: "for-review", requestedDate: new Date("2026-03-18"), issuedDate: new Date("2026-03-20"), proofOfReceipt: "receipt_mouse.pdf" },
    ],
  },
  "emp-3": {
    profile: {
      firstName: "Ana", middleName: "-", lastName: "Reyes",
      email: "ana.reyes@company.com", phone: "+63 919 345 6789",
      address: "789 Ortigas Center, Pasig City, Metro Manila",
      dateOfBirth: "10/03/1998", placeOfBirth: "Pasig, Philippines",
      nationality: "Filipino", civilStatus: "Single",
      emergencyContactName: "Ben Reyes", emergencyContactRelationship: "Father",
      emergencyContactPhone: "+63 919 654 3210", emergencyContactEmail: "ben.reyes@email.com",
      status: "submitted",
    },
    remarks: { documents: [], tasks: [], equipment: [] },
    documents: [
      { id: "doc-1", name: "Birth Certificate (PSA)", status: "submitted", fileName: "birth_cert_reyes.pdf", uploadedDate: new Date("2026-03-20") },
      { id: "doc-2", name: "NBI Clearance", status: "submitted", fileName: "nbi_clearance.pdf", uploadedDate: new Date("2026-03-20") },
      { id: "doc-3", name: "SSS E-1 Form", status: "pending" },
      { id: "doc-4", name: "PhilHealth Member Data Record (MDR)", status: "pending" },
      { id: "doc-5", name: "Pag-IBIG Member's Data Form (MDF)", status: "pending" },
      { id: "doc-6", name: "BIR Form 2316 (Previous Employer)", status: "pending" },
    ],
    tasks: [
      { id: "task-1", name: "Complete Company Orientation", description: "Watch orientation video and complete quiz", status: "approved", completedDate: new Date("2026-03-20") },
      { id: "task-2", name: "IT Security Training", description: "Complete cybersecurity awareness module", status: "submitted", completedDate: new Date("2026-03-20") },
      { id: "task-3", name: "Set Up Email Signature", description: "Configure official email signature", status: "pending" },
      { id: "task-4", name: "Review Employee Handbook", description: "Read and acknowledge employee handbook", status: "pending" },
      { id: "task-5", name: "Complete Benefits Enrollment", description: "Select health and insurance benefits", status: "pending" },
    ],
    equipment: [
      { id: "equip-1", name: "iPad Pro", category: "Tablet", status: "pending", requestedDate: new Date("2026-03-20") },
      { id: "equip-2", name: "Apple Pencil", category: "Accessories", status: "pending", requestedDate: new Date("2026-03-20") },
    ],
  },
};

const mockEmployees: Employee[] = [
  {
    id: "emp-1",
    name: "Maria Santos",
    position: "Senior Software Engineer",
    department: "Engineering",
    startDate: new Date("2026-03-15"),
    deadline: new Date("2026-03-22"),
    progress: 65,
    status: "in-progress",
    documentsCompleted: 4,
    documentsTotal: 6,
    tasksCompleted: 3,
    tasksTotal: 5,
    equipmentCompleted: 1,
    equipmentTotal: 2,
  },
  {
    id: "emp-2",
    name: "Juan Dela Cruz",
    position: "Product Manager",
    department: "Product",
    startDate: new Date("2026-03-18"),
    deadline: new Date("2026-03-25"),
    progress: 90,
    status: "for-review",
    documentsCompleted: 6,
    documentsTotal: 6,
    tasksCompleted: 5,
    tasksTotal: 5,
    equipmentCompleted: 2,
    equipmentTotal: 2,
  },
  {
    id: "emp-3",
    name: "Ana Reyes",
    position: "UX Designer",
    department: "Design",
    startDate: new Date("2026-03-20"),
    deadline: new Date("2026-03-27"),
    progress: 35,
    status: "in-progress",
    documentsCompleted: 2,
    documentsTotal: 6,
    tasksCompleted: 2,
    tasksTotal: 5,
    equipmentCompleted: 0,
    equipmentTotal: 2,
  },
  {
    id: "emp-4",
    name: "Carlos Bautista",
    position: "Marketing Specialist",
    department: "Marketing",
    startDate: new Date("2026-03-10"),
    deadline: new Date("2026-03-17"),
    progress: 100,
    status: "approved",
    documentsCompleted: 6,
    documentsTotal: 6,
    tasksCompleted: 5,
    tasksTotal: 5,
    equipmentCompleted: 2,
    equipmentTotal: 2,
  },
  {
    id: "emp-5",
    name: "Isabella Garcia",
    position: "Data Analyst",
    department: "Analytics",
    startDate: new Date("2026-03-12"),
    deadline: new Date("2026-03-19"),
    progress: 40,
    status: "overdue",
    documentsCompleted: 2,
    documentsTotal: 6,
    tasksCompleted: 2,
    tasksTotal: 5,
    equipmentCompleted: 1,
    equipmentTotal: 2,
  },
];

export default function HROnboardingOfficerView() {
  const [employees] = useState<Employee[]>(mockEmployees);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const handleApprove = (itemId: string) => {
    alert(`Approved: ${itemId}`);
  };

  const handleReject = (itemId: string) => {
    alert(`Rejected: ${itemId}`);
  };

  const handleAddRemark = (category: string) => {
    if (remarks[category]?.trim()) {
      alert(`General remark added for ${category}: ${remarks[category]}`);
      setRemarks(prev => ({ ...prev, [category]: "" }));
    }
  };

  const getItemStatusBadge = (status: ItemStatus) => {
    const config: Record<ItemStatus, { label: string; className: string }> = {
      "pending": { label: "Pending", className: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
      "submitted": { label: "Submitted", className: "bg-slate-900 text-white hover:bg-slate-900" },
      "for-review": { label: "For Review", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
      "approved": { label: "Approved", className: "bg-teal-100 text-teal-800 hover:bg-teal-100" },
      "rejected": { label: "Rejected", className: "bg-red-100 text-red-800 hover:bg-red-100" },
      "issued": { label: "Issued", className: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
    };

    const { label, className } = config[status];
    return <Badge className={className}>{label}</Badge>;
  };

  const getStatusBadge = (status: OnboardingStatus) => {
    const variants: Record<OnboardingStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      "not-started": { label: "Not Started", variant: "outline" },
      "in-progress": { label: "In Progress", variant: "default" },
      "for-review": { label: "For Review", variant: "secondary" },
      "approved": { label: "Approved", variant: "secondary" },
      "overdue": { label: "Overdue", variant: "destructive" },
    };

    const { label, variant } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getDeadlineColor = (deadline: Date, status: OnboardingStatus) => {
    if (status === "approved") return "text-green-600";
    const today = new Date();
    const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return "text-red-600 font-semibold";
    if (daysLeft <= 2) return "text-orange-600 font-semibold";
    return "text-slate-600";
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesStatus = statusFilter === "all" || emp.status === statusFilter;
    const matchesDepartment = departmentFilter === "all" || emp.department === departmentFilter;
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesDepartment && matchesSearch;
  });

  // Calculate stats
  const totalEmployees = employees.length;
  const inProgressCount = employees.filter(e => e.status === "in-progress").length;
  const forReviewCount = employees.filter(e => e.status === "for-review").length;
  const overdueCount = employees.filter(e => e.status === "overdue").length;
  const avgProgress = Math.round(employees.reduce((sum, emp) => sum + emp.progress, 0) / totalEmployees);

  const departments = Array.from(new Set(employees.map(e => e.department)));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">HR Onboarding Dashboard</h1>
          <p className="text-slate-600">Monitor and manage employee onboarding progress</p>
        </div>

        {/* Mini Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="size-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmployees}</div>
              <p className="text-xs text-slate-500">Currently onboarding</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <TrendingUp className="size-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressCount}</div>
              <p className="text-xs text-slate-500">Active onboarding</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">For Review</CardTitle>
              <FileCheck className="size-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{forReviewCount}</div>
              <p className="text-xs text-slate-500">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Progress</CardTitle>
              <ListChecks className="size-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgProgress}%</div>
              <Progress value={avgProgress} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {(overdueCount > 0 || forReviewCount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {overdueCount > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-5 text-red-600" />
                    <div>
                      <p className="font-semibold text-red-900">{overdueCount} Overdue Employee{overdueCount > 1 ? "s" : ""}</p>
                      <p className="text-sm text-red-700">Requires immediate attention</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {forReviewCount > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <FileCheck className="size-5 text-orange-600" />
                    <div>
                      <p className="font-semibold text-orange-900">{forReviewCount} Pending Review</p>
                      <p className="text-sm text-orange-700">Waiting for your approval</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Employee Overview Table */}
        <Card>
          <CardHeader>
            <CardTitle>Employees in Onboarding</CardTitle>
            
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-45">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="not-started">Not Started</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="for-review">For Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full md:w-45">
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => {
                  const daysLeft = Math.ceil((employee.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell>{employee.startDate.toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={employee.progress} className="w-20" />
                          <span className="text-sm text-slate-600">{employee.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(employee.status)}</TableCell>
                      <TableCell>
                        <div className={getDeadlineColor(employee.deadline, employee.status)}>
                          {employee.deadline.toLocaleDateString()}
                          {employee.status !== "approved" && (() => {
                            const absDays = Math.abs(daysLeft);
                            const leftPlural = daysLeft === 1 ? "" : "s";
                            const overPlural = absDays === 1 ? "" : "s";
                            const label = daysLeft >= 0
                              ? `${daysLeft} day${leftPlural} left`
                              : `${absDays} day${overPlural} overdue`;
                            return <div className="text-xs">{label}</div>;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEmployee(employee)}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      No employees found matching your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Employee Detail Modal */}
      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="w-[95vw] sm:max-w-215 max-h-[95vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-xl">Employee Onboarding Details</DialogTitle>
            <DialogDescription className="text-sm">
              View and manage the onboarding progress of {selectedEmployee?.name}.
            </DialogDescription>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-4 pb-4">
                {/* Profile Summary */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Profile Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Name</p>
                        <p className="font-semibold">{selectedEmployee.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Position</p>
                        <p className="font-semibold">{selectedEmployee.position}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Department</p>
                        <p className="font-semibold">{selectedEmployee.department}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Start Date</p>
                        <p className="font-semibold">{selectedEmployee.startDate.toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Status</p>
                        <div className="mt-1">
                          <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                            {selectedEmployee.status === "in-progress" && "In Progress"}
                            {selectedEmployee.status === "for-review" && "For Review"}
                            {selectedEmployee.status === "approved" && "Approved"}
                            {selectedEmployee.status === "overdue" && "Overdue"}
                            {selectedEmployee.status === "not-started" && "Not Started"}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Overall Progress</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={selectedEmployee.progress} className="flex-1" />
                          <span className="font-semibold">{selectedEmployee.progress}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Checklist Tracker */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Onboarding Checklist</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">View and manage the onboarding progress of {selectedEmployee.name}</p>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="profile">
                      <TabsList className="grid w-full grid-cols-4 h-auto">
                        <TabsTrigger value="profile" className="flex items-center gap-2 py-2 text-xs">
                          <Users className="size-4" />
                          Profile
                        </TabsTrigger>
                        <TabsTrigger value="documents" className="flex items-center gap-2 py-2 text-xs">
                          <FileCheck className="size-4" />
                          Documents
                        </TabsTrigger>
                        <TabsTrigger value="tasks" className="flex items-center gap-2 py-2 text-xs">
                          <ListChecks className="size-4" />
                          Tasks
                        </TabsTrigger>
                        <TabsTrigger value="equipment" className="flex items-center gap-2 py-2 text-xs">
                          <Package className="size-4" />
                          Equipment
                        </TabsTrigger>
                      </TabsList>

                      {/* Profile Tab */}
                      <TabsContent value="profile" className="space-y-4 mt-4">
                        {(() => {
                          const profile = employeeDetails[selectedEmployee.id]?.profile;
                          return (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-semibold">Create Your Profile</h3>
                                  <p className="text-sm text-slate-600">Complete your profile information</p>
                                </div>
                                {profile && getItemStatusBadge(profile.status)}
                              </div>

                              {/* Personal Information */}
                              <Card>
                                <CardContent className="pt-4 space-y-4">
                                  <div>
                                    <p className="font-medium text-sm">Personal Information</p>
                                    <p className="text-xs text-slate-500">Enter your complete personal details</p>
                                  </div>
                                  {profile ? (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-3 gap-3">
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">First Name <span className="text-red-500">*</span></p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.firstName}</div>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">Middle Name</p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.middleName}</div>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">Last Name <span className="text-red-500">*</span></p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.lastName}</div>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">Email Address <span className="text-red-500">*</span></p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.email}</div>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">Phone Number <span className="text-red-500">*</span></p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.phone}</div>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500 mb-1">Complete Address <span className="text-red-500">*</span></p>
                                        <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.address}</div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">Date of Birth</p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.dateOfBirth}</div>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">Place of Birth</p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.placeOfBirth}</div>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">Nationality</p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.nationality}</div>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">Civil Status</p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.civilStatus}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-400">No profile data available.</p>
                                  )}
                                </CardContent>
                              </Card>

                              {/* Emergency Contact */}
                              {profile && (
                                <Card>
                                  <CardContent className="pt-4 space-y-4">
                                    <div>
                                      <p className="font-medium text-sm">Emergency Contact Information</p>
                                      <p className="text-xs text-slate-500">Enter your emergency contact details</p>
                                    </div>
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-3 gap-3">
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">Name <span className="text-red-500">*</span></p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.emergencyContactName}</div>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">Relationship <span className="text-red-500">*</span></p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.emergencyContactRelationship}</div>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">Phone Number <span className="text-red-500">*</span></p>
                                          <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.emergencyContactPhone}</div>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500 mb-1">Email Address</p>
                                        <div className="border rounded px-3 py-1.5 text-sm bg-slate-50">{profile.emergencyContactEmail}</div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Approve / Reject Profile */}
                              <div className="flex gap-3">
                                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleApprove("profile")}>
                                  <CheckCircle className="size-4 mr-2" />Approve Profile
                                </Button>
                                <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleReject("profile")}>
                                  <XCircle className="size-4 mr-2" />Reject Profile
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      </TabsContent>

                      {/* Documents Tab */}
                      <TabsContent value="documents" className="space-y-4 mt-4">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead>Document</TableHead>
                              <TableHead>Current File</TableHead>
                              <TableHead className="w-28">Status</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employeeDetails[selectedEmployee.id]?.documents.map((doc) => (
                              <TableRow key={doc.id}>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium text-sm">{doc.name}</span>
                                    {(doc.status === "pending" || doc.status === "rejected") && (
                                      <span className="text-red-600 font-bold text-xs ml-0.5">*</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {doc.fileName ? (
                                    <div className="flex items-center gap-1.5">
                                      <FileText className="size-3 text-slate-500 shrink-0" />
                                      <span className="text-xs text-slate-700">{doc.fileName}</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">No file uploaded</span>
                                  )}
                                </TableCell>
                                <TableCell>{getItemStatusBadge(doc.status)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {doc.status === "for-review" && (
                                      <>
                                        <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-xs px-2" onClick={() => handleApprove(doc.id)}>
                                          <CheckCircle className="size-3 mr-1" />Approve
                                        </Button>
                                        <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => handleReject(doc.id)}>
                                          <XCircle className="size-3 mr-1" />Reject
                                        </Button>
                                      </>
                                    )}
                                    {doc.fileName && (
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleApprove(doc.id)}>
                                        <Download className="size-4 text-slate-600" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Remarks & Feedback */}
                        <div className="border rounded-lg p-4 space-y-3">
                          <h4 className="font-medium flex items-center gap-2 text-sm">
                            <MessageSquare className="size-4" />
                            Remarks &amp; Feedback
                          </h4>
                          {employeeDetails[selectedEmployee.id]?.remarks.documents?.map((r) => (
                            <div key={r.id} className="border rounded-lg p-3 bg-white space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{r.author}</span>
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">{r.category}</Badge>
                                </div>
                                <span className="text-xs text-slate-400">{r.timestamp.toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-slate-600">{r.text}</p>
                            </div>
                          ))}
                          <Textarea
                            id="remark-documents-general"
                            placeholder="Add a remark for this section..."
                            value={remarks["documents-general"] || ""}
                            onChange={(e) => setRemarks(prev => ({ ...prev, "documents-general": e.target.value }))}
                            className="text-sm bg-slate-50"
                            rows={2}
                          />
                          <Button size="sm" onClick={() => handleAddRemark("documents")} className="bg-blue-600 hover:bg-blue-700">
                            <MessageSquare className="size-3 mr-1" />Add Remark
                          </Button>
                        </div>

                        {/* Info card */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                          <strong>File Requirements:</strong> PDF format only. Maximum file size: 10MB. Only one file per document.
                        </div>
                      </TabsContent>


                      {/* Tasks Tab */}
                      <TabsContent value="tasks" className="space-y-4 mt-4">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead>Task</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="w-32">Status</TableHead>
                              <TableHead className="w-36">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employeeDetails[selectedEmployee.id]?.tasks.map((task) => (
                              <TableRow key={task.id}>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {task.status === "approved" ? (
                                      <CheckCircle className="size-4 text-green-600 shrink-0" />
                                    ) : (
                                      (task.status === "pending" || task.status === "rejected") && (
                                        <span className="text-red-600 font-bold text-xs">*</span>
                                      )
                                    )}
                                    <span className="font-medium text-sm">{task.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">{task.description}</span>
                                </TableCell>
                                <TableCell>{getItemStatusBadge(task.status)}</TableCell>
                                <TableCell>
                                  {task.status === "for-review" && (
                                    <div className="flex gap-1">
                                      <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-xs px-2" onClick={() => handleApprove(task.id)}>
                                        <CheckCircle className="size-3 mr-1" />Approve
                                      </Button>
                                      <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => handleReject(task.id)}>
                                        <XCircle className="size-3 mr-1" />Reject
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Remarks & Feedback */}
                        <div className="border rounded-lg p-4 space-y-3">
                          <h4 className="font-medium flex items-center gap-2 text-sm">
                            <MessageSquare className="size-4" />
                            Remarks &amp; Feedback
                          </h4>
                          {employeeDetails[selectedEmployee.id]?.remarks.tasks?.map((r) => (
                            <div key={r.id} className="border rounded-lg p-3 bg-white space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{r.author}</span>
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">{r.category}</Badge>
                                </div>
                                <span className="text-xs text-slate-400">{r.timestamp.toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-slate-600">{r.text}</p>
                            </div>
                          ))}
                          <Textarea
                            id="remark-tasks-general"
                            placeholder="Add a remark for this section..."
                            value={remarks["tasks-general"] || ""}
                            onChange={(e) => setRemarks(prev => ({ ...prev, "tasks-general": e.target.value }))}
                            className="text-sm bg-slate-50"
                            rows={2}
                          />
                          <Button size="sm" onClick={() => handleAddRemark("tasks")} className="bg-blue-600 hover:bg-blue-700">
                            <MessageSquare className="size-3 mr-1" />Add Remark
                          </Button>
                        </div>
                      </TabsContent>

                      {/* Equipment Tab */}
                      <TabsContent value="equipment" className="space-y-4 mt-4">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="w-8"></TableHead>
                              <TableHead>Equipment</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Delivery Method</TableHead>
                              <TableHead className="w-28">Status</TableHead>
                              <TableHead>Proof of Receipt</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employeeDetails[selectedEmployee.id]?.equipment.map((equip) => (
                              <TableRow key={equip.id}>
                                <TableCell>
                                  {equip.status === "approved" ? (
                                    <CheckCircle className="size-4 text-green-600" />
                                  ) : (
                                    <div className="size-4 border-2 border-slate-300 rounded" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium text-sm">{equip.name}</span>
                                    {equip.status !== "approved" && <span className="text-red-500 text-xs font-bold">*</span>}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">{equip.category}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-500">-</span>
                                </TableCell>
                                <TableCell>{getItemStatusBadge(equip.status)}</TableCell>
                                <TableCell>
                                  <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1">
                                    <Download className="size-3" />Upload
                                  </Button>
                                </TableCell>
                                <TableCell>
                                  {(equip.status === "for-review" || equip.status === "issued") && (
                                    <div className="flex gap-1">
                                      <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-xs px-2" onClick={() => handleApprove(equip.id)}>
                                        <CheckCircle className="size-3 mr-1" />Approve
                                      </Button>
                                      <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => handleReject(equip.id)}>
                                        <XCircle className="size-3 mr-1" />Reject
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Remarks & Feedback */}
                        <div className="border rounded-lg p-4 space-y-3">
                          <h4 className="font-medium flex items-center gap-2 text-sm">
                            <MessageSquare className="size-4" />
                            Remarks &amp; Feedback
                          </h4>
                          {employeeDetails[selectedEmployee.id]?.remarks.equipment?.map((r) => (
                            <div key={r.id} className="border rounded-lg p-3 bg-white space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{r.author}</span>
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">{r.category}</Badge>
                                </div>
                                <span className="text-xs text-slate-400">{r.timestamp.toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-slate-600">{r.text}</p>
                            </div>
                          ))}
                          <Textarea
                            id="remark-equipment-general"
                            placeholder="Add a remark for this section..."
                            value={remarks["equipment-general"] || ""}
                            onChange={(e) => setRemarks(prev => ({ ...prev, "equipment-general": e.target.value }))}
                            className="text-sm bg-slate-50"
                            rows={2}
                          />
                          <Button size="sm" onClick={() => handleAddRemark("equipment")} className="bg-blue-600 hover:bg-blue-700">
                            <MessageSquare className="size-3 mr-1" />Add Remark
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}