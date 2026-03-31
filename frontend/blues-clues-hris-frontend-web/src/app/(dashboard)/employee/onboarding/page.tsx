"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WelcomeScreen } from "@/components/onboarding/WelcomeScreen";
import { OnboardingProcess } from "@/components/onboarding/OnboardingProcess";
import { ReviewScreen } from "@/components/onboarding/ReviewScreen";
import { CompletedScreen } from "@/components/onboarding/CompletedScreen";
import { OnboardingSession } from "@/types/onboarding.types";
import { getMySession, confirmTask } from "@/lib/onboardingApi";

type OnboardingStage = "welcome" | "onboarding" | "review" | "completion";

export default function EmployeeOnboardingPage() {
  const router = useRouter();
  const [stage, setStage] = useState<OnboardingStage>("welcome");
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMySession()
      .then((data) => {
        setSession(data);
        if (data?.status === "for-review") setStage("review");
        else if (data?.status === "approved") setStage("completion");
        else if (data && (data.status === "in-progress" || data.status === "overdue" || data.progress_percentage > 0)) setStage("onboarding");
      })
      .catch(() => {
        setError("Failed to load onboarding data.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleStart = async () => {
    if (session?.welcome && session.welcome.length > 0) {
      const pending = session.welcome.filter(w => w.status === 'pending');
      await Promise.all(pending.map(w => confirmTask(w.onboarding_item_id)));
      setSession(prev => prev ? {
        ...prev,
        welcome: prev.welcome.map(w => ({ ...w, status: 'confirmed' as const })),
      } : prev);
    }
    setStage("onboarding");
  };

  const handleComplete = () => {
    setStage("review");
  };

  const handleUpdateSession = (updatedSession: OnboardingSession) => {
    setSession(updatedSession);
  };

  const handleGoToDashboard = () => {
    localStorage.setItem("onboarding_dismissed", "true");
    router.push("/employee");
  };

  if (loading) {
    return <div className="p-8 text-muted-foreground animate-pulse">Loading onboarding data...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-semibold text-slate-800">No Onboarding Assigned</h2>
          <p className="text-slate-600">
            You don't have an active onboarding session. Please contact your HR officer to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500">
      {stage === "welcome" && <WelcomeScreen onStart={handleStart} />}

      {stage === "onboarding" && (
        <OnboardingProcess
          session={session}
          onUpdateSession={handleUpdateSession}
          onComplete={handleComplete}
          userRole="employee"
        />
      )}

      {stage === "review" && <ReviewScreen />}

      {stage === "completion" && (
        <CompletedScreen
          approvalDate={session.completed_at || new Date().toISOString()}
          onGoToDashboard={handleGoToDashboard}
        />
      )}
    </div>
  );
}
