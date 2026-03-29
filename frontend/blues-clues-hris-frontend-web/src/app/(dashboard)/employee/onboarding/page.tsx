"use client";

import { useState, useEffect } from "react";
import { WelcomeScreen } from "@/components/onboarding/WelcomeScreen";
import { OnboardingProcess } from "@/components/onboarding/OnboardingProcess";
import { ReviewScreen } from "@/components/onboarding/ReviewScreen";
import { CompletedScreen } from "@/components/onboarding/CompletedScreen";
import { EmployeeAssignment } from "@/types/onboarding.types";
import { mockEmployeeAssignments } from "@/data/mockData";
import { getUserInfo } from "@/lib/authStorage";

type OnboardingStage = "welcome" | "onboarding" | "review" | "completion";

export default function EmployeeOnboardingPage() {
  const [stage, setStage] = useState<OnboardingStage>("welcome");
  const [approvalDate] = useState(new Date());
  
  // Initialize with your mock data
  const [employeeAssignments, setEmployeeAssignments] = useState<EmployeeAssignment[]>(mockEmployeeAssignments);
  
  const currentUser = getUserInfo();
  const currentAssignment = employeeAssignments.find(
    a => a.employeeName === currentUser?.name
  ) ?? employeeAssignments[0];

  const handleStart = () => {
    setStage("onboarding");
  };

  const handleComplete = () => {
    setStage("review");
  };

  const handleUpdateAssignment = (updatedAssignment: EmployeeAssignment) => {
    setEmployeeAssignments(prev => 
      prev.map(a => a.id === updatedAssignment.id ? updatedAssignment : a)
    );
  };

  // Auto-approve after review (for demo purposes)
  useEffect(() => {
    if (stage === "review") {
      const timer = setTimeout(() => {
        setStage("completion");
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [stage]);

  if (!currentAssignment) {
    return <div className="p-8 text-muted-foreground animate-pulse">Loading onboarding data...</div>;
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500">
      {stage === "welcome" && <WelcomeScreen onStart={handleStart} />}

      {stage === "onboarding" && (
        <OnboardingProcess
          assignment={currentAssignment}
          onUpdateAssignment={handleUpdateAssignment}
          onComplete={handleComplete}
        />
      )}

      {stage === "review" && <ReviewScreen />}

      {stage === "completion" && <CompletedScreen approvalDate={approvalDate} />}
    </div>
  );
}