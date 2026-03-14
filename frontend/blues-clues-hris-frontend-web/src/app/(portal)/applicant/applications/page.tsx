"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, MapPin, Briefcase } from "lucide-react";
import { getMyApplications, type MyApplication } from "@/lib/authApi";

const STATUS_STYLES: Record<string, string> = {
  submitted:  "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  reviewing:  "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  interview:  "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  offer:      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  rejected:   "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function ApplicantApplicationsPage() {
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyApplications()
      .then(setApplications)
      .catch((err: any) => toast.error(err.message || "Failed to load applications"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">

      <Card className="border-border shadow-sm bg-card">
        <CardHeader className="bg-muted/20 border-b border-border pb-6">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
            Applications
          </p>
          <CardTitle className="text-2xl font-bold tracking-tight">My Applications</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : `${applications.length} application${applications.length !== 1 ? "s" : ""} submitted`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No applications yet.</p>
              <p className="text-xs">Browse open positions and apply to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {applications.map((app) => (
                <div key={app.application_id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">
                      {app.job_postings?.title ?? "—"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground font-medium">
                      {app.job_postings?.location && (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{app.job_postings.location}</span>
                      )}
                      {app.job_postings?.employment_type && (
                        <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{app.job_postings.employment_type}</span>
                      )}
                      <span>Applied {formatDate(app.applied_at)}</span>
                    </div>
                  </div>

                  <span
                    className={`ml-4 shrink-0 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                      STATUS_STYLES[app.status] ?? "bg-muted/30 text-muted-foreground border-border"
                    }`}
                  >
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
