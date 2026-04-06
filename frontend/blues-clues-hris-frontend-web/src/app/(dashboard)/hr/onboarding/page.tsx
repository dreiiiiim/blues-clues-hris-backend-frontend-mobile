"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HROnboardingOfficerView from "@/components/onboarding/HROnboardingOfficerView";
import HRRecruitmentOnboardingView from "@/components/onboarding/HRRecruitmentOnboardingView";
import { ClipboardList, UserCheck } from "lucide-react";

export default function HROnboardingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Onboarding</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage new hire approvals and track employee onboarding progress.
        </p>
      </div>

      <Tabs defaultValue="new-hires">
        <TabsList className="mb-4">
          <TabsTrigger value="new-hires" className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4" />
            New Hire Approvals
          </TabsTrigger>
          <TabsTrigger value="employee-onboarding" className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Employee Onboarding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new-hires">
          <HRRecruitmentOnboardingView />
        </TabsContent>

        <TabsContent value="employee-onboarding">
          <HROnboardingOfficerView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
