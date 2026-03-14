"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, MapPin, Clock, Building2, Briefcase,
  DollarSign, SlidersHorizontal, Bookmark, CheckCircle,
  Loader2, Calendar, CalendarX2, ChevronLeft, X,
} from "lucide-react";
import { getApplicantJobs, applyToJob, getMyApplications, type JobPosting } from "@/lib/authApi";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export default function ApplicantJobsPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [locationFilter, setLocationFilter] = useState("All Locations");
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [displayedJob, setDisplayedJob] = useState<JobPosting | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [showCoverLetter, setShowCoverLetter] = useState(false);

  useEffect(() => {
    Promise.all([
      getApplicantJobs().catch(() => [] as JobPosting[]),
      getMyApplications().catch(() => []),
    ]).then(([fetchedJobs, myApps]) => {
      setJobs(fetchedJobs);
      setAppliedJobIds(new Set(myApps.map((a: any) => a.job_posting_id)));
    }).finally(() => setLoading(false));
  }, []);

  const jobTypes = useMemo(() => {
    const types = new Set(jobs.map((j) => j.employment_type).filter(Boolean) as string[]);
    return ["All Types", ...Array.from(types)];
  }, [jobs]);

  const locations = useMemo(() => {
    const locs = new Set(jobs.map((j) => j.location).filter(Boolean) as string[]);
    return ["All Locations", ...Array.from(locs)];
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch =
        !q ||
        job.title.toLowerCase().includes(q) ||
        (job.description ?? "").toLowerCase().includes(q) ||
        (job.employment_type ?? "").toLowerCase().includes(q);
      const matchesType = typeFilter === "All Types" || job.employment_type === typeFilter;
      const matchesLocation =
        locationFilter === "All Locations" || job.location === locationFilter;
      return matchesSearch && matchesType && matchesLocation;
    });
  }, [jobs, search, typeFilter, locationFilter]);

  // clear selection if filtered out
  useEffect(() => {
    if (selectedJob && !filtered.find((j) => j.job_posting_id === selectedJob.job_posting_id)) {
      setDetailVisible(false);
      setTimeout(() => { setSelectedJob(null); setDisplayedJob(null); }, 150);
    }
  }, [filtered]);

  const selectJob = (job: JobPosting) => {
    setSelectedJob(job);
    if (detailVisible) {
      // already open — fade out, swap, fade in
      setDetailVisible(false);
      setTimeout(() => {
        setDisplayedJob(job);
        setShowCoverLetter(false);
        setCoverLetter("");
        requestAnimationFrame(() => requestAnimationFrame(() => setDetailVisible(true)));
      }, 150);
    } else {
      // first open — just fade in
      setDisplayedJob(job);
      setShowCoverLetter(false);
      setCoverLetter("");
      requestAnimationFrame(() => requestAnimationFrame(() => setDetailVisible(true)));
    }
  };

  const handleApply = async () => {
    if (!selectedJob) return;
    setApplying(true);
    try {
      await applyToJob(selectedJob.job_posting_id, coverLetter ? { cover_letter: coverLetter } : undefined);
      setAppliedJobIds((prev) => new Set([...prev, selectedJob.job_posting_id]));
      toast.success("Application submitted!");
      setShowCoverLetter(false);
      setCoverLetter("");
    } catch (err: any) {
      toast.error(err.message || "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isApplied = displayedJob ? appliedJobIds.has(displayedJob.job_posting_id) : false;

  return (
    <div className="space-y-5 max-w-6xl mx-auto animate-in fade-in duration-500">

      {/* Header */}
      <Card className="border-border shadow-sm overflow-hidden bg-card">
        <CardHeader className="bg-muted/20 border-b border-border py-5">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Open Positions</p>
          <CardTitle className="text-2xl font-bold tracking-tight">Find Your Next Opportunity</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading positions…" : `${jobs.length} open position${jobs.length !== 1 ? "s" : ""}`}
          </p>
        </CardHeader>
        <CardContent className="pt-4 pb-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search jobs by title or keywords…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 bg-card border-border focus-visible:ring-primary/20 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Three-column layout */}
      <div className="flex gap-5 items-start">

        {/* Filters */}
        <div className="w-52 shrink-0 space-y-4">
          <Card className="border-border shadow-sm bg-card">
            <CardHeader className="pb-3 pt-5 px-5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-bold tracking-tight">Filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-5">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Job Type</p>
                <div className="space-y-1">
                  {jobTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        typeFilter === t
                          ? "bg-primary/10 text-primary border-primary/40"
                          : "bg-transparent text-muted-foreground border-transparent hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-border" />
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Location</p>
                <div className="space-y-1">
                  {locations.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLocationFilter(l)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        locationFilter === l
                          ? "bg-primary/10 text-primary border-primary/40"
                          : "bg-transparent text-muted-foreground border-transparent hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Job list */}
        <div className="w-72 shrink-0 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1">
                {filtered.length} {filtered.length === 1 ? "job" : "jobs"} found
              </p>
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-12">
                  {jobs.length === 0 ? "No open positions right now." : "No jobs match your filters."}
                </p>
              ) : (
                filtered.map((job) => {
                  const isSelected = selectedJob?.job_posting_id === job.job_posting_id;
                  const applied = appliedJobIds.has(job.job_posting_id);
                  return (
                    <div
                      key={job.job_posting_id}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectJob(job)}
                      onKeyDown={(e) => e.key === "Enter" && selectJob(job)}
                      className={`w-full text-left rounded-xl border p-4 transition-all group cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-primary/30 hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? "border-primary/30 bg-primary/10" : "border-border bg-muted/30 group-hover:bg-primary/5"
                        }`}>
                          <Building2 className={`h-5 w-5 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <h3 className={`font-bold text-sm leading-tight ${isSelected ? "text-primary" : "text-foreground"}`}>
                              {job.title}
                            </h3>
                            <button
                              onClick={(e) => toggleBookmark(job.job_posting_id, e)}
                              className="shrink-0 p-0.5 rounded hover:bg-muted/50"
                            >
                              <Bookmark className={`h-3.5 w-3.5 ${bookmarked.has(job.job_posting_id) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                            </button>
                          </div>
                          {job.employment_type && (
                            <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {job.employment_type}
                            </span>
                          )}
                          {job.location && (
                            <p className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />{job.location}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <p className="text-[11px] text-muted-foreground/70">{timeAgo(job.posted_at)}</p>
                            {applied && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-600 dark:text-green-400">
                                <CheckCircle className="h-3 w-3" /> Applied
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0">
          {/* Empty state */}
          {!displayedJob && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <Briefcase className="h-12 w-12 opacity-20" />
              <p className="text-sm">Select a job to view details</p>
            </div>
          )}

          {/* Animated detail card — opacity fade only, no translate (prevents layout shift) */}
          <div className={`transition-opacity duration-150 ${detailVisible ? 'opacity-100' : 'opacity-0'}`}>
          {displayedJob && (
            <Card className="border-border shadow-sm bg-card overflow-hidden">

              {/* Job header */}
              <div className="border-b border-border p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-xl border border-border bg-muted/30 flex items-center justify-center shrink-0">
                    <Building2 className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-foreground leading-tight">{displayedJob.title}</h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {displayedJob.employment_type && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                          <Briefcase className="h-3 w-3" /> {displayedJob.employment_type}
                        </span>
                      )}
                      {displayedJob.location && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground border border-border">
                          <MapPin className="h-3 w-3" /> {displayedJob.location}
                        </span>
                      )}
                      {displayedJob.salary_range && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground border border-border">
                          <DollarSign className="h-3 w-3" /> {displayedJob.salary_range}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => toggleBookmark(displayedJob.job_posting_id, e)}
                    className="shrink-0 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    aria-label="Bookmark job"
                  >
                    <Bookmark className={`h-4 w-4 ${bookmarked.has(displayedJob.job_posting_id) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  </button>
                </div>

                {/* Dates row */}
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Posted {formatDate(displayedJob.posted_at)}
                  </span>
                  {displayedJob.closes_at && (
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                      <CalendarX2 className="h-3.5 w-3.5" />
                      Deadline {formatDate(displayedJob.closes_at)}
                    </span>
                  )}
                </div>

                {/* Apply actions */}
                <div className="pt-1">
                  {isApplied ? (
                    <Button
                      disabled
                      className="bg-green-600/10 text-green-700 dark:text-green-400 border border-green-600/20 cursor-default hover:bg-green-600/10"
                      variant="outline"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" /> Application Submitted
                    </Button>
                  ) : showCoverLetter ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Cover Letter <span className="text-muted-foreground font-normal">(optional)</span></p>
                        <button onClick={() => setShowCoverLetter(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <Textarea
                        placeholder="Introduce yourself and explain why you're a great fit for this role…"
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        rows={4}
                        className="text-sm resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleApply}
                          disabled={applying}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Application"}
                        </Button>
                        <Button variant="ghost" onClick={() => setShowCoverLetter(false)} disabled={applying}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleApply}
                        disabled={applying}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply Now"}
                      </Button>
                      <Button variant="outline" onClick={() => setShowCoverLetter(true)}>
                        Add Cover Letter
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-7">

                {/* Job description */}
                <section>
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Job Description
                  </h3>
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {displayedJob.description}
                  </div>
                </section>

                {/* Job summary */}
                <section>
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Job Summary
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SummaryRow icon={<Briefcase className="h-4 w-4" />} label="Employment Type" value={displayedJob.employment_type} />
                    <SummaryRow icon={<MapPin className="h-4 w-4" />} label="Location" value={displayedJob.location} />
                    <SummaryRow icon={<DollarSign className="h-4 w-4" />} label="Salary Range" value={displayedJob.salary_range} />
                    <SummaryRow icon={<Calendar className="h-4 w-4" />} label="Date Posted" value={formatDate(displayedJob.posted_at)} />
                    {displayedJob.closes_at && (
                      <SummaryRow icon={<CalendarX2 className="h-4 w-4" />} label="Application Deadline" value={formatDate(displayedJob.closes_at)} />
                    )}
                    <SummaryRow
                      icon={<Clock className="h-4 w-4" />}
                      label="Status"
                      value={
                        <span className={`inline-flex items-center gap-1 font-semibold capitalize ${
                          displayedJob.status === "open" ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${displayedJob.status === "open" ? "bg-green-500" : "bg-muted-foreground"}`} />
                          {displayedJob.status}
                        </span>
                      }
                    />
                  </div>
                </section>

              </div>
            </Card>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode | string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}
