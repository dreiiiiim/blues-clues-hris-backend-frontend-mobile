"use client";
import { useState, useEffect } from "react";
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
import type { OnboardingStatus, ItemStatus, OnboardingSessionSummary, OnboardingSession } from "@/types/onboarding.types";
import { getAllSessions, getSessionById, updateItemStatus, addRemark, approveSession } from "@/lib/onboardingApi";

export default function HROnboardingOfficerView() {
  const [sessions, setSessions] = useState<OnboardingSessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<OnboardingSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [remarks, setRemarks] = useState<Record<string, string>>({});

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
                    <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Name</p>
                        <p className="font-semibold">{selectedSession.employee_name ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Position</p>
                        <p className="font-semibold">{selectedSession.assigned_position}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Department</p>
                        <p className="font-semibold">{selectedSession.assigned_department}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Deadline</p>
                        <p className="font-semibold">{new Date(selectedSession.deadline_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Status</p>
                        <div className="mt-1">{getStatusBadge(selectedSession.status)}</div>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Overall Progress</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={selectedSession.progress_percentage} className="flex-1" />
                          <span className="font-semibold">{selectedSession.progress_percentage}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

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
                      <TabsList className="grid w-full grid-cols-5 h-auto">
                        <TabsTrigger value="profile" className="flex flex-col items-center gap-1 py-2 text-xs">
                          <Users className="size-4" />
                          Profile
                        </TabsTrigger>
                        <TabsTrigger value="documents" className="flex flex-col items-center gap-1 py-2 text-xs">
                          <FileCheck className="size-4" />
                          Documents
                        </TabsTrigger>
                        <TabsTrigger value="forms" className="flex flex-col items-center gap-1 py-2 text-xs">
                          <FileText className="size-4" />
                          HR Forms
                        </TabsTrigger>
                        <TabsTrigger value="tasks" className="flex flex-col items-center gap-1 py-2 text-xs">
                          <ListChecks className="size-4" />
                          Tasks
                        </TabsTrigger>
                        <TabsTrigger value="equipment" className="flex flex-col items-center gap-1 py-2 text-xs">
                          <Package className="size-4" />
                          Equipment
                        </TabsTrigger>
                      </TabsList>

                      {/* Profile Tab */}
                      <TabsContent value="profile" className="space-y-4 mt-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold">Employee Profile</h3>
                              <p className="text-sm text-slate-600">Review employee profile information</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={selectedSession.profile ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-700"}
                            >
                              {selectedSession.profile
                                ? <><CheckCircle className="size-3 mr-1 inline" />Complete</>
                                : "Incomplete"}
                            </Badge>
                          </div>

                          {selectedSession.profile ? (
                            <Card className="bg-slate-50">
                              <CardContent className="pt-6">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-xs text-slate-600">Full Name</span>
                                    <p className="font-medium">{selectedSession.profile.first_name} {selectedSession.profile.last_name}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-600">Email</span>
                                    <p className="font-medium">{selectedSession.profile.email_address}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-600">Phone</span>
                                    <p className="font-medium">{selectedSession.profile.phone_number}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-600">Date of Birth</span>
                                    <p className="font-medium">{selectedSession.profile.date_of_birth}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-600">Address</span>
                                    <p className="font-medium">{selectedSession.profile.complete_address}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-600">Civil Status</span>
                                    <p className="font-medium">{selectedSession.profile.civil_status}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-600">Emergency Contact</span>
                                    <p className="font-medium">{selectedSession.profile.contact_name} ({selectedSession.profile.relationship})</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-600">Emergency Phone</span>
                                    <p className="font-medium">{selectedSession.profile.emergency_phone_number}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ) : (
                            <Card className="bg-slate-50">
                              <CardContent className="pt-6 text-center text-sm text-slate-500">
                                Employee has not submitted profile information yet.
                              </CardContent>
                            </Card>
                          )}

                          {selectedSession.remarks.filter(r => r.tab_tag === "Profile").map(r => (
                            <Card key={r.remark_id} className="bg-yellow-50 border-yellow-200">
                              <CardContent className="pt-4 text-sm">
                                <span className="font-semibold">{r.author}:</span> {r.remark_text}
                                <span className="text-xs text-slate-500 ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                              </CardContent>
                            </Card>
                          ))}

                          <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="pt-4">
                              <div className="space-y-2">
                                <label htmlFor="remark-profile" className="text-sm font-medium text-blue-900">Add Remark for Profile</label>
                                <div className="flex gap-2">
                                  <Textarea
                                    id="remark-profile"
                                    placeholder="Add a remark for the profile..."
                                    value={remarks["Profile"] || ""}
                                    onChange={(e) => setRemarks(prev => ({ ...prev, Profile: e.target.value }))}
                                    className="bg-white"
                                  />
                                  <Button variant="default" onClick={() => handleAddRemark("Profile")} className="bg-blue-600 hover:bg-blue-700">
                                    <MessageSquare className="size-4 mr-2" />Add
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </TabsContent>

                      {/* Documents Tab */}
                      <TabsContent value="documents" className="space-y-4 mt-4">
                        <div className="space-y-3">
                          {selectedSession.documents.map((doc) => (
                            <Card key={doc.onboarding_item_id} className="border-l-4 border-l-blue-500">
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold">{doc.title}</h4>
                                    {doc.files[0] && (
                                      <p className="text-xs text-orange-600 mt-1">
                                        Uploaded: {new Date(doc.files[0].uploaded_at).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                  {getItemStatusBadge(doc.status)}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {doc.files[0] ? (
                                  <div className="p-3 bg-slate-50 rounded-lg border">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <FileText className="size-4 text-blue-600" />
                                        <span className="text-sm font-medium">{doc.files[0].file_name}</span>
                                      </div>
                                      <Button variant="outline" size="sm" asChild>
                                        <a href={doc.files[0].file_url} target="_blank" rel="noreferrer">
                                          <Download className="size-3 mr-1" />View
                                        </a>
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-3 bg-slate-50 rounded-lg border text-center text-sm text-slate-500">
                                    No file uploaded
                                  </div>
                                )}
                                {(doc.status === "submitted" || doc.status === "for-review") && (
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="default" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(doc.onboarding_item_id)}>
                                      <CheckCircle className="size-3 mr-1" />Approve
                                    </Button>
                                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleReject(doc.onboarding_item_id)}>
                                      <XCircle className="size-3 mr-1" />Reject
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {selectedSession.remarks.filter(r => r.tab_tag === "Documents").map(r => (
                          <Card key={r.remark_id} className="bg-yellow-50 border-yellow-200">
                            <CardContent className="pt-4 text-sm">
                              <span className="font-semibold">{r.author}:</span> {r.remark_text}
                              <span className="text-xs text-slate-500 ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                            </CardContent>
                          </Card>
                        ))}

                        <Card className="bg-blue-50 border-blue-200">
                          <CardContent className="pt-4">
                            <div className="space-y-2">
                              <label htmlFor="remark-documents" className="text-sm font-medium text-blue-900">Add General Remark for Documents</label>
                              <div className="flex gap-2">
                                <Textarea
                                  id="remark-documents"
                                  placeholder="Add a general remark for all documents..."
                                  value={remarks["Documents"] || ""}
                                  onChange={(e) => setRemarks(prev => ({ ...prev, Documents: e.target.value }))}
                                  className="bg-white"
                                />
                                <Button variant="default" onClick={() => handleAddRemark("Documents")} className="bg-blue-600 hover:bg-blue-700">
                                  <MessageSquare className="size-4 mr-2" />Add
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* HR Forms Tab */}
                      <TabsContent value="forms" className="space-y-4 mt-4">
                        <div className="space-y-3">
                          {selectedSession.hr_forms.map((form) => (
                            <Card key={form.onboarding_item_id} className="border-l-4 border-l-blue-500">
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold">{form.title}</h4>
                                    {form.description && <p className="text-xs text-slate-600 mt-1">{form.description}</p>}
                                  </div>
                                  {getItemStatusBadge(form.status)}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {form.status === "for-review" && (
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="default" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(form.onboarding_item_id)}>
                                      <CheckCircle className="size-3 mr-1" />Approve
                                    </Button>
                                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleReject(form.onboarding_item_id)}>
                                      <XCircle className="size-3 mr-1" />Reject
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {selectedSession.remarks.filter(r => r.tab_tag === "Forms").map(r => (
                          <Card key={r.remark_id} className="bg-yellow-50 border-yellow-200">
                            <CardContent className="pt-4 text-sm">
                              <span className="font-semibold">{r.author}:</span> {r.remark_text}
                              <span className="text-xs text-slate-500 ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                            </CardContent>
                          </Card>
                        ))}

                        <Card className="bg-blue-50 border-blue-200">
                          <CardContent className="pt-4">
                            <div className="space-y-2">
                              <label htmlFor="remark-forms" className="text-sm font-medium text-blue-900">Add General Remark for HR Forms</label>
                              <div className="flex gap-2">
                                <Textarea
                                  id="remark-forms"
                                  placeholder="Add a general remark for all HR forms..."
                                  value={remarks["Forms"] || ""}
                                  onChange={(e) => setRemarks(prev => ({ ...prev, Forms: e.target.value }))}
                                  className="bg-white"
                                />
                                <Button variant="default" onClick={() => handleAddRemark("Forms")} className="bg-blue-600 hover:bg-blue-700">
                                  <MessageSquare className="size-4 mr-2" />Add
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* Tasks Tab */}
                      <TabsContent value="tasks" className="space-y-4 mt-4">
                        <div className="space-y-3">
                          {selectedSession.tasks.map((task) => (
                            <Card key={task.onboarding_item_id} className="border-l-4 border-l-blue-500">
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold">{task.title}</h4>
                                    {task.description && <p className="text-xs text-slate-600 mt-1">{task.description}</p>}
                                  </div>
                                  {getItemStatusBadge(task.status)}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {task.status === "for-review" && (
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="default" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(task.onboarding_item_id)}>
                                      <CheckCircle className="size-3 mr-1" />Approve
                                    </Button>
                                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleReject(task.onboarding_item_id)}>
                                      <XCircle className="size-3 mr-1" />Reject
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {selectedSession.remarks.filter(r => r.tab_tag === "Tasks").map(r => (
                          <Card key={r.remark_id} className="bg-yellow-50 border-yellow-200">
                            <CardContent className="pt-4 text-sm">
                              <span className="font-semibold">{r.author}:</span> {r.remark_text}
                              <span className="text-xs text-slate-500 ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                            </CardContent>
                          </Card>
                        ))}

                        <Card className="bg-green-50 border-green-200">
                          <CardContent className="pt-4">
                            <div className="space-y-2">
                              <label htmlFor="remark-tasks" className="text-sm font-medium text-green-900">Add General Remark for Tasks</label>
                              <div className="flex gap-2">
                                <Textarea
                                  id="remark-tasks"
                                  placeholder="Add a general remark for all tasks..."
                                  value={remarks["Tasks"] || ""}
                                  onChange={(e) => setRemarks(prev => ({ ...prev, Tasks: e.target.value }))}
                                  className="bg-white"
                                />
                                <Button variant="default" onClick={() => handleAddRemark("Tasks")} className="bg-green-600 hover:bg-green-700">
                                  <MessageSquare className="size-4 mr-2" />Add
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* Equipment Tab */}
                      <TabsContent value="equipment" className="space-y-4 mt-4">
                        <div className="space-y-3">
                          {selectedSession.equipment.map((equip) => (
                            <Card key={equip.onboarding_item_id} className="border-l-4 border-l-blue-500">
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold">{equip.title}</h4>
                                    {equip.description && <p className="text-xs text-slate-600 mt-1">{equip.description}</p>}
                                    {equip.delivery_method && (
                                      <p className="text-xs text-purple-600 mt-1">
                                        Delivery: {equip.delivery_method === 'office' ? 'Office Pickup' : 'Delivery'}
                                        {equip.delivery_method === 'delivery' && equip.delivery_address && (
                                          <span className="block text-purple-500">Address: {equip.delivery_address}</span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                  {getItemStatusBadge(equip.status)}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {equip.proof_of_receipt[0] && (
                                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <FileText className="size-4 text-purple-600" />
                                        <div>
                                          <p className="text-sm font-medium text-purple-900">Proof of Receipt</p>
                                          <p className="text-xs text-purple-700">{equip.proof_of_receipt[0].file_name}</p>
                                        </div>
                                      </div>
                                      <Button variant="outline" size="sm" asChild>
                                        <a href={equip.proof_of_receipt[0].file_url} target="_blank" rel="noreferrer">
                                          <Download className="size-3 mr-1" />View
                                        </a>
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {(equip.status === "submitted" || equip.status === "for-review") && (
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="default" className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => handleIssue(equip.onboarding_item_id)}>
                                      <CheckCircle className="size-3 mr-1" />Issue Equipment
                                    </Button>
                                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleReject(equip.onboarding_item_id)}>
                                      <XCircle className="size-3 mr-1" />Reject
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {selectedSession.remarks.filter(r => r.tab_tag === "Equipment").map(r => (
                          <Card key={r.remark_id} className="bg-yellow-50 border-yellow-200">
                            <CardContent className="pt-4 text-sm">
                              <span className="font-semibold">{r.author}:</span> {r.remark_text}
                              <span className="text-xs text-slate-500 ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                            </CardContent>
                          </Card>
                        ))}

                        <Card className="bg-purple-50 border-purple-200">
                          <CardContent className="pt-4">
                            <div className="space-y-2">
                              <label htmlFor="remark-equipment" className="text-sm font-medium text-purple-900">Add General Remark for Equipment</label>
                              <div className="flex gap-2">
                                <Textarea
                                  id="remark-equipment"
                                  placeholder="Add a general remark for all equipment..."
                                  value={remarks["Equipment"] || ""}
                                  onChange={(e) => setRemarks(prev => ({ ...prev, Equipment: e.target.value }))}
                                  className="bg-white"
                                />
                                <Button variant="default" onClick={() => handleAddRemark("Equipment")} className="bg-purple-600 hover:bg-purple-700">
                                  <MessageSquare className="size-4 mr-2" />Add
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
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
