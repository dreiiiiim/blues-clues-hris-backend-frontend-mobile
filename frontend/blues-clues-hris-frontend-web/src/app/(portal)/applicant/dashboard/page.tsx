"use client";

import { useEffect, useState } from "react";
import { getUserInfo, type StoredUser } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check, Briefcase, MapPin, Clock,
  Search, ChevronRight, Building2
} from "lucide-react";

// TODO: replace with GET /applicant/jobs — fields: title, dept, location, posted_at, type
type JobListing = {
  title: string;
  dept: string;
  location: string;
  time: string;
  type: string;
};

// TODO: replace with GET /applicant/application — fields: status, position, company, current_step, total_steps
type ApplicationStatus = {
  position: string;
  company: string;
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
};

export default function ApplicantDashboardPage() {
  const [session, setSession] = useState<StoredUser | null>(null);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [application, setApplication] = useState<ApplicationStatus | null>(null);
  const [totalJobs, setTotalJobs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(getUserInfo());

    // TODO: wire to real API
    // Promise.all([
    //   authFetch(`${API_BASE_URL}/applicant/jobs`).then(r => r.json()),
    //   authFetch(`${API_BASE_URL}/applicant/application`).then(r => r.json()),
    //   authFetch(`${API_BASE_URL}/applicant/jobs/count`).then(r => r.json()),
    // ]).then(([jobList, app, count]) => {
    //   setJobs(jobList);
    //   setApplication(app);
    //   setTotalJobs(count.total);
    // }).finally(() => setLoading(false));

    setJobs([]);
    setApplication(null);
    setTotalJobs(null);
    setLoading(false);
  }, []);

  useWelcomeToast(session?.name || "Applicant", "Candidate Portal");

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">

      {/* Application Status Tracker */}
      <Card className="border-border shadow-sm overflow-hidden bg-card">
        <CardHeader className="bg-muted/20 border-b border-border pb-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Current Application</p>
              {application ? (
                <>
                  <CardTitle className="text-xl font-bold tracking-tight">
                    Status: Step {application.currentStep} of {application.totalSteps}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> {application.position} at {application.company}
                  </p>
                </>
              ) : (
                <CardTitle className="text-xl font-bold tracking-tight text-muted-foreground">
                  No active application
                </CardTitle>
              )}
            </div>
            {application && (
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-tight rounded-full border border-primary/20">
                Active Phase
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-10">
          {application ? (
            <div className="relative flex items-center justify-between w-full max-w-4xl mx-auto">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted rounded-full z-0" />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full z-0 transition-all duration-1000"
                style={{ width: `${((application.currentStep - 1) / (application.totalSteps - 1)) * 100}%` }}
              />
              {application.stepLabels.map((label, i) => (
                <StepItem
                  key={label}
                  icon={i + 1 < application.currentStep ? <Check className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
                  label={label}
                  active={i + 1 <= application.currentStep}
                  completed={i + 1 < application.currentStep}
                  current={i + 1 === application.currentStep}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm">
              You have no active application. Browse open positions below.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Available Job Roles */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Available Positions</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {totalJobs !== null ? `${totalJobs} open positions` : "Discover roles that match your expertise"}
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="text" placeholder="Search jobs..." className="pl-9 h-10 bg-card border-border focus-visible:ring-primary/20" />
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-8">Loading positions...</p>
        ) : jobs.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No open positions available.</p>
        ) : (
          <>
            <div className="grid gap-3">
              {jobs.map((job, i) => (
                <Card key={i} className="border-border shadow-sm hover:border-primary/40 transition-all group cursor-pointer bg-card">
                  <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full">
                      <div className="h-12 w-12 rounded-xl border border-border bg-muted/30 flex items-center justify-center shrink-0 group-hover:bg-primary/5 transition-colors">
                        <Briefcase className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground text-lg leading-none mb-2 group-hover:text-primary transition-colors">
                          {job.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-semibold uppercase tracking-tight">
                          <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {job.dept}</span>
                          <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {job.location}</span>
                          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {job.time}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                      <span className="text-[10px] font-bold text-muted-foreground border border-border px-3 py-1.5 rounded-lg uppercase tracking-widest bg-muted/20">
                        {job.type}
                      </span>
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 group-hover:translate-x-1 transition-transform">
                        Apply Now <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalJobs !== null && totalJobs > jobs.length && (
              <div className="flex justify-center pt-2">
                {/* TODO: wire to pagination or load-more */}
                <Button variant="ghost" className="text-primary font-bold hover:bg-primary/5 text-sm uppercase tracking-widest">
                  View all {totalJobs} open positions
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StepItem({ icon, label, active, completed, current }: any) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-3 bg-card px-3">
      <div className={`
        h-10 w-10 rounded-full flex items-center justify-center border-4 border-card shadow-md transition-all duration-500
        ${completed ? "bg-primary text-primary-foreground" : ""}
        ${current   ? "bg-card border-primary text-primary ring-4 ring-primary/10" : ""}
        ${!active   ? "bg-muted text-muted-foreground border-muted" : ""}
      `}>
        {icon}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${active ? "text-primary" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}
