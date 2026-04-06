"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, Users, FileCheck, ListChecks, Package, Search, Calendar, TrendingUp, Download, MessageSquare, CheckCircle, XCircle, FileText, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { OnboardingStatus, ItemStatus, OnboardingSessionSummary, OnboardingSession, Remark } from "@/types/onboarding.types";
import { getAllSessions, getSessionById, updateItemStatus, addRemark, approveSession, updateSessionDeadline } from "@/lib/onboardingApi";

function RemarkSection({
  remarks,
  value,
  onChange,
  onAdd,
  inputId,
}: {
  remarks: Remark[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  inputId: string;
}) {
  return (
    <div className="mt-6 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">HR Remarks</p>
      {remarks.length > 0 ? (
        <div className="space-y-2">
          {remarks.map((r) => (
            <div key={r.remark_id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-600">{r.author}</span>
                <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-slate-700">{r.remark_text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">No remarks yet.</p>
      )}
      <div className="flex gap-2 pt-1">
        <Textarea
          id={inputId}
          placeholder="Add a remark..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="resize-none text-sm"
        />
        <Button
          size="sm"
          className="self-end shrink-0"
          onClick={onAdd}
          disabled={!value.trim()}
        >
          <MessageSquare className="size-3.5 mr-1.5" />Add
        </Button>
      </div>
    </div>
  );
}

export default function HROnboardingOfficerView() {
  const [sessions, setSessions] = useState<OnboardingSessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<OnboardingSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");

  useEffect(() => {
    getAllSessions().then(setSessions).catch(console.error);
  }, []);

  const refreshSession = async (sessionId: string) => {
    const [updatedSession, updatedSummaries] = await Promise.all([
      getSessionById(sessionId),
      getAllSessions(),
    ]);
    setSelectedSession(updatedSession);
    setSessions(updatedSummaries);
  };

  const handleViewSession = async (summary: OnboardingSessionSummary) => {
    setLoadingSession(true);
    setEditingDeadline(false);
    try {
      const full = await getSessionById(summary.session_id);
      setSelectedSession(full);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleApprove = async (onboardingItemId: string) => {
    if (!selectedSession) return;
    try {
      await updateItemStatus(onboardingItemId, "approved");
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (onboardingItemId: string) => {
    if (!selectedSession) return;
    try {
      await updateItemStatus(onboardingItemId, "rejected");
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleIssue = async (onboardingItemId: string) => {
    if (!selectedSession) return;
    try {
      await updateItemStatus(onboardingItemId, "issued");
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRemark = async (tabTag: "Documents" | "Tasks" | "Equipment" | "Profile" | "Forms") => {
    if (!selectedSession || !remarks[tabTag]?.trim()) return;
    try {
      await addRemark(selectedSession.session_id, tabTag, remarks[tabTag].trim());
      setRemarks(prev => ({ ...prev, [tabTag]: "" }));
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateDeadline = async () => {
    if (!selectedSession || !deadlineInput) return;
    try {
      await updateSessionDeadline(selectedSession.session_id, deadlineInput);
      setEditingDeadline(false);
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveSession = async () => {
    if (!selectedSession) return;
    try {
      await approveSession(selectedSession.session_id);
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const getItemStatusBadge = (status: ItemStatus) => {
    const config: Record<string, { label: string; className: string }> = {
      "pending":    { label: "Pending",    className: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
      "submitted":  { label: "Submitted",  className: "bg-slate-900 text-white hover:bg-slate-900" },
      "for-review": { label: "For Review", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
      "approved":   { label: "Approved",   className: "bg-teal-100 text-teal-800 hover:bg-teal-100" },
      "rejected":   { label: "Rejected",   className: "bg-red-100 text-red-800 hover:bg-red-100" },
      "issued":     { label: "Issued",     className: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
      "confirmed":  { label: "Confirmed",  className: "bg-green-100 text-green-800 hover:bg-green-100" },
    };
    const { label, className } = config[status] ?? { label: status, className: "" };
    return <Badge className={className}>{label}</Badge>;
  };

  const getStatusBadge = (status: OnboardingStatus) => {
    const variants: Record<OnboardingStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      "not-started": { label: "Not Started", variant: "outline" },
      "in-progress": { label: "In Progress", variant: "default" },
      "for-review":  { label: "For Review",  variant: "secondary" },
      "approved":    { label: "Approved",    variant: "secondary" },
      "overdue":     { label: "Overdue",     variant: "destructive" },
    };
    const { label, variant } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getDeadlineColor = (deadlineDate: string, status: OnboardingStatus) => {
    if (status === "approved") return "text-green-600";
    const daysLeft = Math.ceil((new Date(deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return "text-red-600 font-semibold";
    if (daysLeft <= 2) return "text-orange-600 font-semibold";
    return "text-slate-600";
  };

  const filteredSessions = sessions.filter((s) => {
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesDepartment = departmentFilter === "all" || s.assigned_department === departmentFilter;
    const matchesSearch =
      (s.employee_name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.assigned_position.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesDepartment && matchesSearch;
  });

  const totalEmployees = sessions.length;
  const inProgressCount = sessions.filter(s => s.status === "in-progress").length;
  const forReviewCount = sessions.filter(s => s.status === "for-review").length;
  const overdueCount = sessions.filter(s => s.status === "overdue").length;
  const avgProgress = totalEmployees > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.progress_percentage, 0) / totalEmployees)
    : 0;

  const departments = Array.from(new Set(sessions.map(s => s.assigned_department)));

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
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => {
                  const daysLeft = Math.ceil((new Date(session.deadline_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <TableRow key={session.session_id}>
                      <TableCell className="font-medium">{session.employee_name ?? "—"}</TableCell>
                      <TableCell>{session.assigned_position}</TableCell>
                      <TableCell>{session.assigned_department}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={session.progress_percentage} className="w-20" />
                          <span className="text-sm text-slate-600">{session.progress_percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell>
                        <div className={getDeadlineColor(session.deadline_date, session.status)}>
                          {new Date(session.deadline_date).toLocaleDateString()}
                          {session.status !== "approved" && (() => {
                            const absDays = Math.abs(daysLeft);
                            const label = daysLeft >= 0
                              ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                              : `${absDays} day${absDays === 1 ? "" : "s"} overdue`;
                            return <div className="text-xs">{label}</div>;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewSession(session)}
                          disabled={loadingSession}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredSessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
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
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-[98vw] w-full max-h-[95vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-xl">Employee Onboarding Details</DialogTitle>
            <DialogDescription className="text-sm">
              View and manage the onboarding progress of {selectedSession?.employee_name}.
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="space-y-6 pb-4">
                {/* Profile Summary */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Profile Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-500 mb-1">Name</p>
                        <p className="font-semibold truncate">{selectedSession.employee_name ?? "—"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-500 mb-1">Position</p>
                        <p className="font-semibold truncate">{selectedSession.assigned_position}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-500 mb-1">Department</p>
                        <p className="font-semibold truncate">{selectedSession.assigned_department}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-500 mb-1">Status</p>
                        <div className="mt-1">{getStatusBadge(selectedSession.status)}</div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-500 mb-1">Deadline</p>
                        {editingDeadline ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              type="date"
                              value={deadlineInput}
                              onChange={(e) => setDeadlineInput(e.target.value)}
                              className="h-8 text-sm w-36"
                            />
                            <Button size="sm" className="h-8" onClick={handleUpdateDeadline}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingDeadline(false)}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{new Date(selectedSession.deadline_date).toLocaleDateString()}</p>
                            {selectedSession.status !== "approved" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs text-slate-500"
                                onClick={() => {
                                  setDeadlineInput(selectedSession.deadline_date.slice(0, 10));
                                  setEditingDeadline(true);
                                }}
                              >
                                Edit
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-500 mb-1">Overall Progress</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={selectedSession.progress_percentage} className="flex-1" />
                          <span className="font-semibold">{selectedSession.progress_percentage}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Overdue Warning */}
                {selectedSession.status === "overdue" && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-red-900">This onboarding is overdue</p>
                      <p className="text-sm text-red-700 mt-0.5">
                        The deadline has passed. Consider extending the deadline above or following up with the employee.
                      </p>
                    </div>
                  </div>
                )}

                {/* Approve Onboarding */}
                {selectedSession.status === "for-review" && (
                  <div className="flex justify-end">
                    <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleApproveSession}>
                      <CheckCircle className="size-4 mr-2" />
                      Approve Onboarding
                    </Button>
                  </div>
                )}

                {/* Checklist Tracker */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Onboarding Checklist</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">View and manage the onboarding progress of {selectedSession.employee_name}</p>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="profile">
                      <TabsList className="flex flex-wrap h-auto w-full gap-1 justify-start p-1">
                        <TabsTrigger value="profile" className="flex items-center gap-1.5 px-3 py-2 text-sm flex-none">
                          <Users className="size-4 shrink-0" />Profile
                        </TabsTrigger>
                        <TabsTrigger value="documents" className="flex items-center gap-1.5 px-3 py-2 text-sm flex-none">
                          <FileCheck className="size-4 shrink-0" />Documents
                        </TabsTrigger>
                        <TabsTrigger value="forms" className="flex items-center gap-1.5 px-3 py-2 text-sm flex-none">
                          <FileText className="size-4 shrink-0" />HR Forms
                        </TabsTrigger>
                        <TabsTrigger value="tasks" className="flex items-center gap-1.5 px-3 py-2 text-sm flex-none">
                          <ListChecks className="size-4 shrink-0" />Tasks
                        </TabsTrigger>
                        <TabsTrigger value="equipment" className="flex items-center gap-1.5 px-3 py-2 text-sm flex-none">
                          <Package className="size-4 shrink-0" />Equipment
                        </TabsTrigger>
                      </TabsList>

                      {/* Profile Tab */}
                      <TabsContent value="profile" className="mt-6">
                        <div className="space-y-6">
                          {selectedSession.profile ? (
                            <div className="grid grid-cols-2 gap-x-12 gap-y-5">
                              {[
                                { label: "Full Name", value: `${selectedSession.profile.first_name} ${selectedSession.profile.last_name}` },
                                { label: "Email", value: selectedSession.profile.email_address, breakAll: true },
                                { label: "Phone", value: selectedSession.profile.phone_number },
                                { label: "Date of Birth", value: selectedSession.profile.date_of_birth },
                                { label: "Civil Status", value: selectedSession.profile.civil_status },
                                { label: "Address", value: selectedSession.profile.complete_address },
                                { label: "Emergency Contact", value: `${selectedSession.profile.contact_name} (${selectedSession.profile.relationship})` },
                                { label: "Emergency Phone", value: selectedSession.profile.emergency_phone_number },
                              ].map(({ label, value, breakAll }) => (
                                <div key={label} className="min-w-0">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
                                  <p className={`text-sm text-slate-800 ${breakAll ? "break-all" : ""}`}>{value || "—"}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 py-6 text-center">Employee has not submitted profile information yet.</p>
                          )}

                          <RemarkSection
                            remarks={selectedSession.remarks.filter(r => r.tab_tag === "Profile")}
                            value={remarks["Profile"] || ""}
                            onChange={(v) => setRemarks(prev => ({ ...prev, Profile: v }))}
                            onAdd={() => handleAddRemark("Profile")}
                            inputId="remark-profile"
                          />
                        </div>
                      </TabsContent>

                      {/* Documents Tab */}
                      <TabsContent value="documents" className="mt-6">
                        <div className="space-y-3">
                          {selectedSession.documents.map((doc) => (
                            <div key={doc.onboarding_item_id} className="rounded-lg border border-slate-200 overflow-hidden">
                              <div className="flex items-start justify-between px-5 py-4 bg-white">
                                <div className="space-y-0.5 min-w-0 pr-4">
                                  <p className="font-semibold text-slate-800">{doc.title}</p>
                                  {doc.files[0]
                                    ? <p className="text-xs text-slate-500">Uploaded {new Date(doc.files[0].uploaded_at).toLocaleDateString()}</p>
                                    : <p className="text-xs text-slate-400">No file uploaded</p>
                                  }
                                </div>
                                {getItemStatusBadge(doc.status)}
                              </div>
                              {(doc.files[0] || (doc.status === "submitted" || doc.status === "for-review")) && (
                                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                                  {doc.files[0] ? (
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileText className="size-4 text-slate-400 shrink-0" />
                                      <span className="text-sm text-slate-600 truncate">{doc.files[0].file_name}</span>
                                      <Button variant="outline" size="sm" asChild className="shrink-0">
                                        <a href={doc.files[0].file_url} target="_blank" rel="noreferrer">
                                          <Download className="size-3 mr-1" />View
                                        </a>
                                      </Button>
                                    </div>
                                  ) : <span />}
                                  {(doc.status === "submitted" || doc.status === "for-review") && (
                                    <div className="flex gap-2 shrink-0">
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(doc.onboarding_item_id)}>
                                        <CheckCircle className="size-3.5 mr-1.5" />Approve
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => handleReject(doc.onboarding_item_id)}>
                                        <XCircle className="size-3.5 mr-1.5" />Reject
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}

                          <RemarkSection
                            remarks={selectedSession.remarks.filter(r => r.tab_tag === "Documents")}
                            value={remarks["Documents"] || ""}
                            onChange={(v) => setRemarks(prev => ({ ...prev, Documents: v }))}
                            onAdd={() => handleAddRemark("Documents")}
                            inputId="remark-documents"
                          />
                        </div>
                      </TabsContent>

                      {/* HR Forms Tab */}
                      <TabsContent value="forms" className="mt-6">
                        <div className="space-y-3">
                          {selectedSession.hr_forms.map((form) => (
                            <div key={form.onboarding_item_id} className="rounded-lg border border-slate-200 overflow-hidden">
                              <div className="flex items-start justify-between px-5 py-4 bg-white">
                                <div className="space-y-0.5 min-w-0 pr-4">
                                  <p className="font-semibold text-slate-800">{form.title}</p>
                                  {form.description && <p className="text-xs text-slate-500">{form.description}</p>}
                                </div>
                                {getItemStatusBadge(form.status)}
                              </div>
                              {form.status === "for-review" && (
                                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(form.onboarding_item_id)}>
                                    <CheckCircle className="size-3.5 mr-1.5" />Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleReject(form.onboarding_item_id)}>
                                    <XCircle className="size-3.5 mr-1.5" />Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}

                          <RemarkSection
                            remarks={selectedSession.remarks.filter(r => r.tab_tag === "Forms")}
                            value={remarks["Forms"] || ""}
                            onChange={(v) => setRemarks(prev => ({ ...prev, Forms: v }))}
                            onAdd={() => handleAddRemark("Forms")}
                            inputId="remark-forms"
                          />
                        </div>
                      </TabsContent>

                      {/* Tasks Tab */}
                      <TabsContent value="tasks" className="mt-6">
                        <div className="space-y-3">
                          {selectedSession.tasks.map((task) => (
                            <div key={task.onboarding_item_id} className="rounded-lg border border-slate-200 overflow-hidden">
                              <div className="flex items-start justify-between px-5 py-4 bg-white">
                                <div className="space-y-0.5 min-w-0 pr-4">
                                  <p className="font-semibold text-slate-800">{task.title}</p>
                                  {task.description && <p className="text-xs text-slate-500">{task.description}</p>}
                                </div>
                                {getItemStatusBadge(task.status)}
                              </div>
                              {task.status === "for-review" && (
                                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(task.onboarding_item_id)}>
                                    <CheckCircle className="size-3.5 mr-1.5" />Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleReject(task.onboarding_item_id)}>
                                    <XCircle className="size-3.5 mr-1.5" />Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}

                          <RemarkSection
                            remarks={selectedSession.remarks.filter(r => r.tab_tag === "Tasks")}
                            value={remarks["Tasks"] || ""}
                            onChange={(v) => setRemarks(prev => ({ ...prev, Tasks: v }))}
                            onAdd={() => handleAddRemark("Tasks")}
                            inputId="remark-tasks"
                          />
                        </div>
                      </TabsContent>

                      {/* Equipment Tab */}
                      <TabsContent value="equipment" className="mt-6">
                        <div className="space-y-3">
                          {selectedSession.equipment.map((equip) => (
                            <div key={equip.onboarding_item_id} className="rounded-lg border border-slate-200 overflow-hidden">
                              <div className="flex items-start justify-between px-5 py-4 bg-white">
                                <div className="space-y-0.5 min-w-0 pr-4">
                                  <p className="font-semibold text-slate-800">{equip.title}</p>
                                  {equip.description && <p className="text-xs text-slate-500">{equip.description}</p>}
                                  {equip.delivery_method && (
                                    <p className="text-xs text-purple-600">
                                      {equip.delivery_method === "office" ? "Office Pickup" : `Delivery${equip.delivery_address ? ` — ${equip.delivery_address}` : ""}`}
                                    </p>
                                  )}
                                </div>
                                {getItemStatusBadge(equip.status)}
                              </div>
                              {(equip.proof_of_receipt[0] || (equip.status === "submitted" || equip.status === "for-review")) && (
                                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                                  {equip.proof_of_receipt[0] ? (
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileText className="size-4 text-purple-500 shrink-0" />
                                      <span className="text-sm text-slate-600 truncate">{equip.proof_of_receipt[0].file_name}</span>
                                      <Button variant="outline" size="sm" asChild className="shrink-0">
                                        <a href={equip.proof_of_receipt[0].file_url} target="_blank" rel="noreferrer">
                                          <Download className="size-3 mr-1" />View
                                        </a>
                                      </Button>
                                    </div>
                                  ) : <span />}
                                  {(equip.status === "submitted" || equip.status === "for-review") && (
                                    <div className="flex gap-2 shrink-0">
                                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => handleIssue(equip.onboarding_item_id)}>
                                        <CheckCircle className="size-3.5 mr-1.5" />Issue
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => handleReject(equip.onboarding_item_id)}>
                                        <XCircle className="size-3.5 mr-1.5" />Reject
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}

                          <RemarkSection
                            remarks={selectedSession.remarks.filter(r => r.tab_tag === "Equipment")}
                            value={remarks["Equipment"] || ""}
                            onChange={(v) => setRemarks(prev => ({ ...prev, Equipment: v }))}
                            onAdd={() => handleAddRemark("Equipment")}
                            inputId="remark-equipment"
                          />
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
