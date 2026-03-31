"use client";

import { useEffect, useState } from "react";
import { getUserInfo, type StoredUser } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { getMySession } from "@/lib/onboardingApi";
import { OnboardingSession } from "@/types/onboarding.types";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Monitor,
  Upload,
  User,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

type ChecklistItemData = {
  title: string;
  status: string;
  icon: LucideIcon;
};

const STATUS_STYLES: Record<string, string> = {
  approved:   "text-green-700 bg-green-50 border-green-200",
  confirmed:  "text-green-700 bg-green-50 border-green-200",
  issued:     "text-purple-700 bg-purple-50 border-purple-200",
  submitted:  "text-blue-700 bg-blue-50 border-blue-200",
  "for-review": "text-orange-700 bg-orange-50 border-orange-200",
  rejected:   "text-red-700 bg-red-50 border-red-200",
  pending:    "text-amber-700 bg-amber-50 border-amber-200",
};

const STATUS_LABELS: Record<string, string> = {
  approved:   "Approved",
  confirmed:  "Confirmed",
  issued:     "Issued",
  submitted:  "Submitted",
  "for-review": "Under Review",
  rejected:   "Rejected",
  pending:    "Pending",
};

export default function EmployeeDashboardPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  useEffect(() => {
    setUser(getUserInfo());
    getMySession()
      .then((data) => {
        setSession(data);
        const dismissed = localStorage.getItem("onboarding_dismissed") === "true";
        if (dismissed && data?.status !== "approved") {
          localStorage.removeItem("onboarding_dismissed");
          setOnboardingDismissed(false);
        } else {
          setOnboardingDismissed(dismissed);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useWelcomeToast(user?.name || "Employee", "Staff Portal");

  const buildChecklist = (s: OnboardingSession): ChecklistItemData[] => {
    const items: ChecklistItemData[] = [];

    if (s.profile) {
      items.push({ title: "Personal Profile", status: s.profile.status, icon: User });
    }

    for (const doc of s.documents) {
      items.push({ title: doc.title, status: doc.status, icon: Upload });
    }

    for (const task of s.tasks) {
      items.push({ title: task.title, status: task.status, icon: FileText });
    }

    for (const form of s.hr_forms) {
      items.push({ title: form.title, status: form.status, icon: ClipboardList });
    }

    for (const equip of s.equipment) {
      items.push({ title: equip.title, status: equip.status, icon: Monitor });
    }

    return items;
  };

  const checklist = session ? buildChecklist(session) : [];
  const completion = session?.progress_percentage ?? 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">

      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Employee Portal</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Welcome, {user?.name || "Employee"}!</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/75">
            Here&apos;s a quick overview of your profile and onboarding progress. Complete your checklist to get started.
          </p>
        </div>
      </section>

      <div className={`grid gap-6 items-start ${onboardingDismissed ? "" : "md:grid-cols-[1fr_1.5fr]"}`}>
        <Card className="border-border/70 shadow-sm rounded-2xl bg-card overflow-hidden">
          <CardHeader className="pb-4 bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))] border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <User className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold tracking-tight">Profile Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <ProfileField label="Full Name" value={user?.name || "-"} />
            <ProfileField label="Role" value={user?.role === "employee" ? "Internal Staff" : user?.role || "-"} />
            {session && (
              <>
                <ProfileField label="Position" value={session.assigned_position} />
                <ProfileField label="Department" value={session.assigned_department} />
              </>
            )}
          </CardContent>
        </Card>

        {!onboardingDismissed && <Card className="border-border/70 shadow-sm rounded-2xl bg-card overflow-hidden">
          <CardHeader className="pb-3 bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))] border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 text-green-600 rounded-lg">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg font-bold tracking-tight">Onboarding Progress</CardTitle>
              </div>
              <span className="font-bold text-primary text-xs bg-primary/10 border border-primary/20 px-3 py-1 rounded-full uppercase tracking-wide">
                {completion}% Complete
              </span>
            </div>
            <Progress value={completion} className="mt-5 h-2.5" />
          </CardHeader>
          <CardContent className="mt-1 p-5 space-y-3">
            {loading && (
              <p className="text-sm text-muted-foreground text-center py-4 animate-pulse">Loading checklist...</p>
            )}
            {!loading && !session && (
              <p className="text-sm text-muted-foreground text-center py-4">No onboarding session assigned yet.</p>
            )}
            {!loading && checklist.map((item) => (
              <ChecklistItem key={item.title} item={item} />
            ))}
          </CardContent>
        </Card>}
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-muted/20 transition-colors hover:bg-muted/30">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] mb-1">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ChecklistItem({ item }: { readonly item: ChecklistItemData }) {
  const styleClass = STATUS_STYLES[item.status] ?? STATUS_STYLES["pending"];
  const label = STATUS_LABELS[item.status] ?? item.status;
  const isDone = item.status === "approved" || item.status === "confirmed" || item.status === "issued";

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
      isDone ? "bg-green-50/50 border-green-200/60" : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"
    }`}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={`p-2 rounded-lg ${isDone ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary"}`}>
          <item.icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <span className="font-semibold block truncate text-foreground">{item.title}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">Requirement</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${styleClass}`}>
          {!isDone && <Clock className="h-3 w-3" />}
          {isDone && <CheckCircle2 className="h-3 w-3" />}
          {label}
        </div>
        {!isDone && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  );
}
