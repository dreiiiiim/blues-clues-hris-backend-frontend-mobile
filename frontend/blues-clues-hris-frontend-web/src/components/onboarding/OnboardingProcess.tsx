import { useState, useEffect } from "react";
import { Clock, AlertCircle, CheckCircle, User as UserIcon, FileText, ClipboardList, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DocumentUpload } from "./DocumentUpload";
import { TaskChecklist } from "./TaskChecklist";
import { EquipmentRequest } from "./EquipmentRequest";
import { ProfileSetup } from "./ProfileSetup";
import { HRForms } from "./HRForms";
import { EmployeeAssignment, DocumentItem, TaskItem, EquipmentItem, HRFormItem, ProfileData } from "@/types/onboarding.types";

interface OnboardingProcessProps {
  assignment: EmployeeAssignment;
  onUpdateAssignment: (assignment: EmployeeAssignment) => void;
  onComplete: () => void;
}

export function OnboardingProcess({
  assignment,
  onUpdateAssignment,
  onComplete,
}: Readonly<OnboardingProcessProps>) {
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    const today = new Date();
    const diffTime = assignment.deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysRemaining(diffDays);
  }, [assignment.deadline]);

  const calculateProgress = () => {
    let totalItems = 0;
    let completedItems = 0;

    // Profile (required)
    totalItems += 1;
    if (assignment.profile.status === "submitted" || assignment.profile.status === "approved") {
      completedItems += 1;
    }

    // Required documents
    const requiredDocs = assignment.documents.filter(d => d.required);
    totalItems += requiredDocs.length;
    completedItems += requiredDocs.filter(d =>
      d.status === "submitted" || d.status === "for-review" || d.status === "approved"
    ).length;

    // All tasks
    totalItems += assignment.tasks.length;
    completedItems += assignment.tasks.filter(t =>
      t.status === "submitted" || t.status === "for-review" || t.status === "approved"
    ).length;

    // Equipment with receipt confirmed
    totalItems += assignment.equipment.length;
    completedItems += assignment.equipment.filter(e => e.status === "approved").length;

    // HR Forms
    totalItems += assignment.hrForms.length;
    completedItems += assignment.hrForms.filter(f =>
      f.status === "submitted" || f.status === "for-review" || f.status === "approved"
    ).length;

    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  };

  const progress = calculateProgress();

  const handleUpdateDocuments = (docs: DocumentItem[]) => {
    onUpdateAssignment({ ...assignment, documents: docs });
  };

  const handleUpdateTasks = (tasks: TaskItem[]) => {
    onUpdateAssignment({ ...assignment, tasks: tasks });
  };

  const handleUpdateEquipment = (equipment: EquipmentItem[]) => {
    onUpdateAssignment({ ...assignment, equipment: equipment });
  };

  const handleUpdateHRForms = (forms: HRFormItem[]) => {
    onUpdateAssignment({ ...assignment, hrForms: forms });
  };

  const handleUpdateProfile = (profile: ProfileData) => {
    onUpdateAssignment({ ...assignment, profile: profile });
  };

  const handleSubmitForReview = () => {
    if (progress < 100) {
      alert("Please complete all required items before submitting for review");
      return;
    }

    onUpdateAssignment({
      ...assignment,
      status: "for-review",
      finalApprovalStatus: "submitted-for-approval",
    });

    alert("Your onboarding has been submitted for final review!");
    onComplete();
  };


  const getDeadlineAlert = () => {
    if (daysRemaining <= 0) {
      return (
        <Alert className="border-red-500 bg-red-50">
          <AlertCircle className="size-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Overdue!</strong> Your onboarding deadline has passed.
          </AlertDescription>
        </Alert>
      );
    } else if (daysRemaining <= 3) {
      return (
        <Alert className="border-orange-500 bg-orange-50">
          <AlertCircle className="size-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Urgent!</strong> Only {daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining until your deadline.
          </AlertDescription>
        </Alert>
      );
    } else if (daysRemaining <= 7) {
      return (
        <Alert className="border-yellow-500 bg-yellow-50">
          <Clock className="size-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            {daysRemaining} days remaining. Please complete all items soon.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl mb-2">Employee Onboarding</h1>
          <p className="text-slate-600">
            {assignment.position} • {assignment.department}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Deadline: {assignment.deadline.toLocaleDateString()}
          </p>
        </div>

        {/* Deadline Alert */}
        {getDeadlineAlert()}

        {/* Progress Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Overall Progress</CardTitle>
              <Badge variant={progress === 100 ? "default" : "secondary"}>{progress}% Complete</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-3" />
            <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-green-600" />
                <span>
                  {[
                    assignment.profile.status === "approved" ? 1 : 0,
                    ...assignment.documents.filter(d => d.status === "approved"),
                    ...assignment.tasks.filter(t => t.status === "approved"),
                    ...assignment.equipment.filter(e => e.status === "approved"),
                    ...assignment.hrForms.filter(f => f.status === "approved"),
                  ].filter(Boolean).length} approved
                </span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-orange-600" />
                <span>
                  {[
                    ...assignment.documents.filter(d => d.status === "for-review"),
                    ...assignment.tasks.filter(t => t.status === "for-review"),
                    ...assignment.equipment.filter(e => e.status === "for-review"),
                    ...assignment.hrForms.filter(f => f.status === "for-review"),
                  ].length} under review
                </span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-slate-600" />
                <span>
                  {[
                    assignment.profile.status === "pending" || assignment.profile.status === "rejected" ? 1 : 0,
                    ...assignment.documents.filter(d => d.status === "pending" || d.status === "rejected"),
                    ...assignment.tasks.filter(t => t.status === "pending" || t.status === "rejected"),
                    ...assignment.equipment.filter(e => e.status === "pending" || e.status === "rejected"),
                    ...assignment.hrForms.filter(f => f.status === "pending" || f.status === "rejected"),
                  ].filter(Boolean).length} remaining
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Onboarding Content */}
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Checklist</CardTitle>
            <CardDescription>Complete all required sections below</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <UserIcon className="size-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  <FileText className="size-4" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="forms" className="flex items-center gap-2">
                  <ClipboardList className="size-4" />
                  HR Forms
                </TabsTrigger>
                <TabsTrigger value="tasks" className="flex items-center gap-2">
                  <CheckCircle className="size-4" />
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="equipment" className="flex items-center gap-2">
                  <Monitor className="size-4" />
                  Equipment
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile">
                <ProfileSetup
                  profile={assignment.profile}
                  onUpdate={handleUpdateProfile}
                />
              </TabsContent>

              <TabsContent value="documents">
                <DocumentUpload
                  documents={assignment.documents}
                  onUpdate={handleUpdateDocuments}
                />
              </TabsContent>

              <TabsContent value="forms">
                <HRForms
                  forms={assignment.hrForms}
                  onUpdate={handleUpdateHRForms}
                />
              </TabsContent>

              <TabsContent value="tasks">
                <TaskChecklist
                  tasks={assignment.tasks}
                  onUpdateTasks={handleUpdateTasks}
                />
              </TabsContent>

              <TabsContent value="equipment">
                <EquipmentRequest
                  equipment={assignment.equipment}
                  onUpdateEquipment={handleUpdateEquipment}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Submit Button */}
        {progress === 100 && assignment.finalApprovalStatus === "pending" && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-green-900">Ready to Submit</h3>
                  <p className="text-sm text-green-700">You've completed all requirements. Submit for final review.</p>
                </div>
                <Button onClick={handleSubmitForReview} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="size-4 mr-2" />
                  Submit for Final Review
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
