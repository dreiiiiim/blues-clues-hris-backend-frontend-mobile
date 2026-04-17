"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HROnboardingOfficerView from "@/components/onboarding/HROnboardingOfficerView";
import { ClipboardList, FileText, FilePen } from "lucide-react";
import HRPendingDocumentsView from "@/components/onboarding/HRPendingDocumentsView";
import HRProfileChangeRequestsView from "@/components/onboarding/HRProfileChangeRequestsView";

export default function HROnboardingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Onboarding</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage new hire approvals, track onboarding progress, and review employee documents.
        </p>
      </div>

      <Tabs defaultValue="employee-onboarding">
        <TabsList className="mb-4">
          <TabsTrigger value="employee-onboarding" className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Onboarding Reviews
          </TabsTrigger>
          <TabsTrigger value="pending-documents" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Pending Documents
          </TabsTrigger>
          <TabsTrigger value="profile-changes" className="flex items-center gap-1.5">
            <FilePen className="h-4 w-4" />
            Profile Changes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employee-onboarding">
          <HROnboardingOfficerView />
        </TabsContent>

        <TabsContent value="pending-documents">
          <HRPendingDocumentsView />
        </TabsContent>

        <TabsContent value="profile-changes">
          <HRProfileChangeRequestsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
