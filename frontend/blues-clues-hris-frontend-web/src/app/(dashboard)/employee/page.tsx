"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link"; // <-- ADDED THIS
import { getUserInfo, type StoredUser } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // <-- ADDED THIS
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Shield,
  Upload,
  User,
  type LucideIcon,
} from "lucide-react";

type ChecklistItemData = {
  title: string;
  status: string;
  icon: LucideIcon;
  locked: boolean;
};

export default function EmployeeDashboardPage() {
  const [session, setSession] = useState<StoredUser | null>(null);

  useEffect(() => {
    setSession(getUserInfo());
  }, []);

  useWelcomeToast(session?.name || "Employee", "Staff Portal");

  const checklist: ChecklistItemData[] = [
    { title: "Upload Identification Documents", status: "Pending", icon: Upload, locked: false },
    { title: "Review Employee Handbook", status: "Pending", icon: FileText, locked: false },
    { title: "Complete Tax Forms", status: "Pending", icon: FileText, locked: false },
    { title: "Set Up Direct Deposit", status: "Pending", icon: Briefcase, locked: false },
    { title: "IT Security Training", status: "Locked", icon: Shield, locked: true },
  ];

  const completion = 0;
  const pendingCount = useMemo(
    () => checklist.filter((item) => !item.locked && item.status !== "Completed").length,
    [checklist],
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Employee Portal</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Welcome, {session?.name || "Employee"}!</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/75">
            Here&apos;s a quick overview of your profile and onboarding progress. Complete your checklist to get started.
          </p>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-[1fr_1.5fr] items-start">
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
            <ProfileField label="Full Name" value={session?.name || "-"} />
            <ProfileField label="Role" value={session?.role === "employee" ? "Internal Staff" : session?.role || "-"} />
            <ProfileField label="Member Since" value="-" />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm rounded-2xl bg-card overflow-hidden">
          <CardHeader className="pb-3 bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))] border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 text-green-600 rounded-lg">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg font-bold tracking-tight">Onboarding Progress</CardTitle>
              </div>
              {/* <-- ADDED LINK TO ONBOARDING PAGE --> */}
              <Link href="/employee/onboarding">
                <Button size="sm" variant="outline" className="h-8">
                  Resume Onboarding
                </Button>
              </Link>
            </div>
            <Progress value={completion} className="mt-5 h-2.5" />
          </CardHeader>
          <CardContent className="mt-1 p-5 space-y-3">
            {checklist.map((item) => (
              /* <-- WRAPPED ITEM IN LINK --> */
              <Link href="/employee/onboarding" key={item.title} className="block group">
                <ChecklistItem item={item} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-muted/20 transition-colors hover:bg-muted/30">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] mb-1">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ChecklistItem({ item }: { item: ChecklistItemData }) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
        item.locked
          ? "bg-muted/20 border-border opacity-60"
          : "bg-card border-border group-hover:border-primary/40 group-hover:bg-primary/5" // <-- updated hover
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={`p-2 rounded-lg ${item.locked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
          <item.icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <span className={`font-semibold block truncate ${item.locked ? "text-muted-foreground" : "text-foreground"}`}>
            {item.title}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">Requirement</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
            item.locked
              ? "text-muted-foreground bg-muted border-border"
              : "text-amber-700 bg-amber-50 border-amber-200"
          }`}
        >
          {!item.locked && <Clock className="h-3 w-3" />}
          {item.status}
        </div>
        {!item.locked && <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />}
      </div>
    </div>
  );
}