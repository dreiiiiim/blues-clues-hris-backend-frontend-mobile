"use client";

import { useState, useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  Star, Users, Clock, Briefcase, UserCheck, BarChart3, Globe,
  ChevronRight, Check, Menu, X, ArrowRight, Shield,
  Building2, TrendingUp, Award, Zap, FileText, Bell,
  Search, UserPlus, LogOut,
} from "lucide-react";

/* ─────────────────────────── HOOKS ─────────────────────────── */
function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useCountUp(target: number, duration = 1800, start: boolean, reducedMotion = false) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (reducedMotion) {
      setV(target);
      return;
    }
    let raf: number;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start, reducedMotion]);
  return v;
}

function SectionReveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────── STATS ─────────────────────────── */
const STATS = [
  { end: 500,  format: (n: number) => `${Math.round(n)}+`,   label: "Companies onboarded" },
  { end: 50,   format: (n: number) => `${Math.round(n)}k+`,  label: "Employees managed"   },
  { end: 99.9, format: (n: number) => `${n.toFixed(1)}%`,    label: "Uptime SLA"          },
  { end: 24,   format: (n: number) => `${Math.round(n)} hr`, label: "Credential delivery" },
];

function StatItem({ end, format, label, start }: {
  end: number;
  format: (n: number) => string;
  label: string;
  start: boolean;
}) {
  const v = useCountUp(end, 1800, start, false);
  return (
    <div className="md:px-8">
      <p className="text-2xl md:text-3xl font-bold text-[#1e3a8a] tabular-nums">{format(v)}</p>
      <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{label}</p>
    </div>
  );
}

function MiniCount({ target, start }: { target: number; start: boolean }) {
  const v = useCountUp(target, 1100, start, false);
  return <>{Math.round(v)}</>;
}

function StatsBar() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className="bg-white border-b border-slate-100 px-4 md:px-8 py-8">
      <SectionReveal className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 md:w-40 shrink-0">By the numbers</p>
          <div className="flex flex-wrap md:flex-nowrap flex-1 gap-8 md:gap-0 md:divide-x divide-slate-100">
            {STATS.map((s) => (
              <StatItem key={s.label} end={s.end} format={s.format} label={s.label} start={inView} />
            ))}
          </div>
        </div>
      </SectionReveal>
    </div>
  );
}

/* ─────────────────────────── NAVBAR ─────────────────────────── */
function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-xl border-b border-slate-200/70 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-[70px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5">
          <img src="/blues-clues-logo.png" alt="Blues Clues HRIS" className="h-10 w-10 object-contain" />
          <span className="font-bold text-gray-900 text-[15px] leading-tight">
            Blue&apos;s Clues<span className="text-[#1e3a8a]"> HRIS</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          <a href="#features"   className="text-sm text-gray-600 hover:text-[#1e3a8a] transition-colors font-medium">Features</a>
          <a href="#lifecycle"  className="text-sm text-gray-600 hover:text-[#1e3a8a] transition-colors font-medium">Lifecycle</a>
          <a href="#pricing"    className="text-sm text-gray-600 hover:text-[#1e3a8a] transition-colors font-medium">Pricing</a>
          <a href="#why"        className="text-sm text-gray-600 hover:text-[#1e3a8a] transition-colors font-medium">Why Us</a>
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[#1e3a8a] transition-colors px-3 py-1.5">
            Sign In
          </Link>
          <Link
            href="/subscribe"
            className="flex items-center gap-1.5 bg-[#1e3a8a] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1e40af] transition-colors"
          >
            Get Started <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/30">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white/98 backdrop-blur-sm px-4 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <a href="#features"  onClick={() => setOpen(false)} className="block text-sm font-medium text-gray-700 py-2">Features</a>
          <a href="#lifecycle" onClick={() => setOpen(false)} className="block text-sm font-medium text-gray-700 py-2">Lifecycle</a>
          <a href="#pricing"   onClick={() => setOpen(false)} className="block text-sm font-medium text-gray-700 py-2">Pricing</a>
          <a href="#why"       onClick={() => setOpen(false)} className="block text-sm font-medium text-gray-700 py-2">Why Us</a>
          <div className="pt-2 flex flex-col gap-2.5">
            <Link href="/login" className="text-center text-sm font-medium text-gray-600 border border-gray-200 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">Sign In</Link>
            <Link href="/subscribe" className="text-center text-sm font-semibold bg-[#1e3a8a] text-white py-2.5 rounded-lg">Get Started</Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────── HERO ─────────────────────────── */
function HeroSection() {
  return (
    <section className="pt-[70px]">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-4 md:px-8 pt-14 md:pt-16 pb-16 md:pb-20">
        {/* Subtle dot grid texture */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        {/* Single restrained accent glow */}
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-teal-500 rounded-full opacity-[0.05] blur-[100px] translate-x-1/3 translate-y-1/2 pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid md:grid-cols-[1fr_420px] lg:grid-cols-[1fr_480px] gap-10 md:gap-16 items-center min-h-[420px] md:min-h-[460px]">
            {/* Left: text */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="inline-flex items-center gap-2 bg-white/8 border border-white/12 rounded-full px-3.5 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200/80">HR Platform · Philippines</span>
              </div>

              <h1 className="text-[clamp(2.25rem,_5vw_+_0.5rem,_3.75rem)] font-extrabold text-white leading-[1.06] tracking-tight">
                HR operations,<br />
                <span className="text-blue-200/85">without the overhead.</span>
              </h1>

              <p className="mt-5 text-[15px] text-white/60 max-w-[480px] leading-relaxed">
                Hiring, onboarding, timekeeping, and performance — one platform, no spreadsheets, no patchwork tools.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/subscribe"
                  className="inline-flex items-center gap-2 bg-white text-[#1e3a8a] font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 active:scale-[0.98] transition-all text-sm shadow-[0_6px_20px_rgba(15,23,42,0.20)]"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 border border-white/20 text-white/80 font-medium px-5 py-3 rounded-xl hover:bg-white/8 transition-all text-sm"
                >
                  See features
                </a>
              </div>

              <p className="mt-6 text-[11px] text-white/30 flex items-center gap-2">
                <Shield className="w-3 h-3 flex-shrink-0" />
                Setup in 24 hours · No long-term contracts
              </p>
            </div>

            {/* Right: dashboard mockup */}
            <div className="hidden md:block animate-in fade-in slide-in-from-right-6 duration-700 delay-150">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-[0_24px_64px_rgba(0,0,0,0.32)] overflow-hidden">
                {/* Mockup titlebar */}
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8 bg-white/4">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="ml-3 text-[10px] text-white/30 font-medium">Dashboard · Today</span>
                </div>
                <div className="p-4 space-y-3">
                  {/* Headcount row */}
                  <div className="grid grid-cols-3 gap-2">
                    {[["Present","142","bg-teal-400/20 text-teal-300"],["On Leave","8","bg-blue-400/20 text-blue-300"],["Late","5","bg-amber-400/20 text-amber-300"]].map(([label, val, cls]) => (
                      <div key={label} className="rounded-xl bg-white/6 border border-white/8 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-white/40">{label}</p>
                        <p className={`text-xl font-bold mt-0.5 ${cls.split(' ')[1]}`}>{val}</p>
                      </div>
                    ))}
                  </div>
                  {/* Pending actions */}
                  <div className="rounded-xl bg-white/6 border border-white/8 px-3 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-2.5">Pending Actions</p>
                    {[["Leave approvals","3","text-amber-400"],["New applicants","7","text-blue-300"],["Contract renewals","2","text-rose-400"]].map(([label, count, cls]) => (
                      <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/6 last:border-0">
                        <span className="text-[11px] text-white/55">{label}</span>
                        <span className={`text-xs font-bold ${cls}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                  {/* Mini pipeline */}
                  <div className="rounded-xl bg-white/6 border border-white/8 px-3 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-2.5">Hiring Pipeline</p>
                    <div className="space-y-1.5">
                      {[["Frontend Engineer","Interviewing",68],["HR Generalist","Screening",34],["QA Analyst","Offer",91]].map(([role, stage, pct]) => (
                        <div key={role} className="flex items-center gap-2">
                          <span className="text-[10px] text-white/50 w-28 truncate flex-shrink-0">{role}</span>
                          <div className="flex-1 h-1 rounded bg-white/10 overflow-hidden">
                            <div className="h-1 rounded bg-teal-400/60" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[9px] text-white/30 w-16 text-right flex-shrink-0">{stage}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <StatsBar />
    </section>
  );
}

/* ─────────────────────────── FEATURES ─────────────────────────── */
const FEATURES = [
  {
    icon: Users,
    title: "Employee Management",
    desc: "Centralized employee records, roles, departments, and profile management in one place.",
    color: "bg-blue-50 text-blue-700",
  },
  {
    icon: Clock,
    title: "Timekeeping & Attendance",
    desc: "Automated attendance tracking, leave requests, and daily time records for every employee.",
    color: "bg-teal-50 text-teal-700",
  },
  {
    icon: Briefcase,
    title: "Recruitment & Hiring",
    desc: "Post jobs, screen applicants, and manage your entire hiring pipeline from a single dashboard.",
    color: "bg-violet-50 text-violet-700",
  },
  {
    icon: UserCheck,
    title: "Employee Onboarding",
    desc: "Structured onboarding checklists and automated workflows to get new hires productive fast.",
    color: "bg-amber-50 text-amber-700",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    desc: "Real-time HR dashboards, headcount reports, and workforce analytics to drive decisions.",
    color: "bg-green-50 text-green-700",
  },
  {
    icon: Globe,
    title: "Careers Portal",
    desc: "A public-facing careers page to attract top talent and reflect your employer brand.",
    color: "bg-rose-50 text-rose-700",
  },
  {
    icon: Award,
    title: "SFIA Assessment",
    desc: "Skills Framework for the Information Age — assess and develop your team's competencies.",
    color: "bg-indigo-50 text-indigo-700",
  },
  {
    icon: FileText,
    title: "Contract Renewals",
    desc: "Track employment contract dates and automate renewal reminders before they lapse.",
    color: "bg-cyan-50 text-cyan-700",
  },
  {
    icon: Bell,
    title: "Approvals & Notifications",
    desc: "Role-based approval workflows and real-time notifications keep everyone aligned.",
    color: "bg-orange-50 text-orange-700",
  },
];

type FeatureSnippet = {
  title: string;
  eyebrow: string;
  metric: string;
  chips: string[];
  rows: string[];
  preview: "profiles" | "attendance" | "hiring" | "onboarding" | "analytics" | "careers" | "sfia" | "renewals" | "approvals";
};

// Revert-safe block: remove this map + FeaturesSection popover state/markup to roll back snippet popovers.
const FEATURE_SNIPPETS: Record<string, FeatureSnippet> = {
  "Employee Management": {
    title: "Employee Management",
    eyebrow: "My Team",
    metric: "Active / Pending",
    chips: ["Team Members", "Department", "Role"],
    rows: ["Assign Company Email", "Edit Employee", "Filter Team"],
    preview: "profiles",
  },
  "Timekeeping & Attendance": {
    title: "Timekeeping & Attendance",
    eyebrow: "Timekeeping Management",
    metric: "Attendance Rate",
    chips: ["Present", "Late", "Absent"],
    rows: ["Attendance Calendar", "Edit Attendance", "Pending Absence Requests"],
    preview: "attendance",
  },
  "Recruitment & Hiring": {
    title: "Recruitment & Hiring",
    eyebrow: "Candidate Evaluation Dashboard",
    metric: "Top 20 Candidates",
    chips: ["SFIA Ranking", "Manual", "Jobs"],
    rows: ["Create Job", "Pipeline Details", "Interview Schedule"],
    preview: "hiring",
  },
  "Employee Onboarding": {
    title: "Employee Onboarding",
    eyebrow: "New Hire Approvals",
    metric: "Pending Review",
    chips: ["Onboarding", "Documents", "Status"],
    rows: ["Pending Employee Documents", "For Review", "Approved"],
    preview: "onboarding",
  },
  "Analytics & Reports": {
    title: "Analytics & Reports",
    eyebrow: "Platform Overview",
    metric: "Stats + Trends",
    chips: ["Active", "Pending", "Companies"],
    rows: ["Attendance Rate", "Pending Invites", "Audit Logs"],
    preview: "analytics",
  },
  "Careers Portal": {
    title: "Careers Portal",
    eyebrow: "Jobs",
    metric: "Openings",
    chips: ["Jobs", "Candidates", "Stages"],
    rows: ["Job Posting", "Applications", "Hiring Pipeline"],
    preview: "careers",
  },
  "SFIA Assessment": {
    title: "SFIA Assessment",
    eyebrow: "SFIA Skills",
    metric: "Level Mapping",
    chips: ["Strategy", "Change", "Analytics"],
    rows: ["Configure SFIA Skills", "Top 20 Candidates", "Skill Fit"],
    preview: "sfia",
  },
  "Contract Renewals": {
    title: "Contract Renewals",
    eyebrow: "Subscription Monitoring",
    metric: "Renewals within 7d",
    chips: ["Active", "Trial", "Expired"],
    rows: ["Next Renewal", "Usage & Limits", "Subscription Status"],
    preview: "renewals",
  },
  "Approvals & Notifications": {
    title: "Approvals & Notifications",
    eyebrow: "Document Approvals",
    metric: "Pending",
    chips: ["Approvals", "Notifications", "Unread"],
    rows: ["HRDocumentApprovalsView", "Pending HR Review", "Mark all as read"],
    preview: "approvals",
  },
};

function FeaturePreviewMini({
  snippet,
  tick,
  hiringMode,
  setHiringMode,
  hiringCandidates,
  dragIndex,
  setDragIndex,
  dragOverIndex,
  setDragOverIndex,
  onDropCandidate,
}: {
  snippet: FeatureSnippet;
  tick: number;
  hiringMode: "sfia" | "manual";
  setHiringMode: (mode: "sfia" | "manual") => void;
  hiringCandidates: Array<{ name: string; fit: number }>;
  dragIndex: number | null;
  setDragIndex: (index: number | null) => void;
  dragOverIndex: number | null;
  setDragOverIndex: (index: number | null) => void;
  onDropCandidate: (targetIndex: number) => void;
}) {
  const rotating = tick % 3;

  if (snippet.preview === "profiles") {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 min-h-[340px]">
        <div className="rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] p-3 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Team Management</p>
          <p className="mt-1 font-bold">My Team</p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            ["Total Members", "51"],
            ["Active", "42"],
            ["Pending", "6"],
            ["Inactive", "3"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-xs font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/20">
            <p className="text-xs font-bold">Team Members</p>
          </div>
          <div className="px-3 py-2 text-[11px] text-muted-foreground grid grid-cols-4 uppercase tracking-wide border-b">
            <span>User</span><span>Status</span><span>Department</span><span>Last Login</span>
          </div>
          {[0, 1, 2].map((r) => (
            <div key={r} className="px-3 py-2 text-xs grid grid-cols-4 border-b last:border-b-0">
              <span>Employee {r + 1}</span>
              <span className={r === rotating ? "text-amber-600 font-semibold" : "text-green-600 font-semibold"}>{r === rotating ? "Pending" : "Active"}</span>
              <span>Engineering</span>
              <span className="text-muted-foreground">{r + 1}h ago</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (snippet.preview === "attendance") {
    const tab = tick % 3; // 0=Summary, 1=Schedule, 2=History
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 min-h-[340px]">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
          {["Summary", "Schedule", "History"].map((tab, i) => (
            <span
              key={tab}
              className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                i === (tick % 3) ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
        {tab === 0 && (
          <>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                ["Total Employees", "248"],
                ["Attendance Rate", "94%"],
                ["Total Hours", "1,906h"],
                ["Compliance Issues", "9"],
              ].map(([label, value], i) => (
                <div key={label} className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className={`text-xs font-bold ${i === 1 ? "text-green-600" : "text-foreground"}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs font-bold text-amber-900">Pending Absence Requests</p>
              <p className="text-[11px] text-amber-700/90">Employee-reported absences awaiting review</p>
            </div>
            <div className="mt-3 rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Attendance Calendar</p>
              </div>
              <div className="p-3 grid grid-cols-7 gap-1.5">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-6 rounded border ${i === 2 || i === 8 || i === 12 ? "bg-blue-100 border-blue-200" : "bg-card border-border"}`}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 1 && (
          <div className="mt-3 rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 border-b bg-muted/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Schedule</p>
            </div>
            <div className="px-3 py-2 text-[11px] text-muted-foreground grid grid-cols-5 uppercase tracking-wide border-b">
              <span>Employee</span><span>Shift</span><span>Location</span><span>Status</span><span>Actions</span>
            </div>
            {[
              ["J. Santos", "8:00-17:00", "HQ", "Assigned", "Edit"],
              ["M. Cruz", "9:00-18:00", "Remote", "Assigned", "Edit"],
              ["R. Lim", "Rest Day", "—", "No Schedule", "Assign"],
            ].map((row, i) => (
              <div key={row[0]} className={`px-3 py-2 text-xs grid grid-cols-5 border-b last:border-b-0 ${i === rotating ? "bg-blue-50/50" : ""}`}>
                <span>{row[0]}</span>
                <span>{row[1]}</span>
                <span>{row[2]}</span>
                <span className={row[3] === "No Schedule" ? "text-amber-600 font-semibold" : "text-green-600 font-semibold"}>{row[3]}</span>
                <span className="text-primary font-medium">{row[4]}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 2 && (
          <div className="mt-3 rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 border-b bg-muted/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Attendance History</p>
            </div>
            <div className="px-3 py-2 text-[11px] text-muted-foreground grid grid-cols-6 uppercase tracking-wide border-b">
              <span>Date</span><span>Employee</span><span>Status</span><span>Time In</span><span>Time Out</span><span>Hours</span>
            </div>
            {[
              ["Apr 29", "J. Santos", "Present", "08:01", "17:02", "8.0"],
              ["Apr 29", "M. Cruz", "Late", "09:17", "18:05", "7.5"],
              ["Apr 29", "R. Lim", "Excused", "--", "--", "0.0"],
            ].map((row, i) => (
              <div key={`${row[0]}-${row[1]}`} className={`px-3 py-2 text-xs grid grid-cols-6 border-b last:border-b-0 ${i === rotating ? "bg-blue-50/50" : ""}`}>
                <span>{row[0]}</span>
                <span>{row[1]}</span>
                <span className={row[2] === "Late" ? "text-amber-600 font-semibold" : row[2] === "Present" ? "text-green-600 font-semibold" : "text-purple-600 font-semibold"}>{row[2]}</span>
                <span>{row[3]}</span>
                <span>{row[4]}</span>
                <span>{row[5]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (snippet.preview === "hiring") {
    const manualMode = hiringMode === "manual";

    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 min-h-[340px]">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <p className="text-xs font-bold">Top 20 Candidates</p>
            <p className="text-[11px] text-muted-foreground">
              {manualMode
                ? "Manual mode active — drag cards to reorder, then save"
                : "Sorted by SFIA relevance score (Automatic)"}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setHiringMode("sfia")}
              className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${!manualMode ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              SFIA Ranking (Auto)
            </button>
            <button
              type="button"
              onClick={() => setHiringMode("manual")}
              className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${manualMode ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Manual Ranking
            </button>
          </div>
        </div>
        {manualMode && (
          <div className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700">
            Drag-and-drop is active. Reorder candidates (preview only).
          </div>
        )}
        <div className="mt-3 space-y-2">
          {hiringCandidates.map((candidate, i) => (
            <div
              key={`${candidate.name}-${i}`}
              draggable={manualMode}
              onDragStart={() => {
                if (!manualMode) return;
                setDragIndex(i);
              }}
              onDragOver={(e) => {
                if (!manualMode) return;
                e.preventDefault();
                setDragOverIndex(i);
              }}
              onDrop={() => {
                if (!manualMode) return;
                onDropCandidate(i);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                if (!manualMode) return;
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              className={`rounded-md border px-3 py-2 flex items-center justify-between text-xs transition-all duration-300 ${
                manualMode && dragIndex === i
                  ? "border-blue-300 bg-blue-50/70 shadow-sm opacity-80"
                  : manualMode && dragOverIndex === i
                  ? "border-blue-300 bg-blue-50/40 shadow-sm"
                  : "border-border bg-card"
              }`}
            >
              <span className="text-gray-700 flex items-center gap-2">
                {manualMode && <span className="text-gray-400">::</span>}
                {candidate.name}
              </span>
              <span className="font-bold text-primary">{candidate.fit}% fit</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (snippet.preview === "onboarding") {
    const profileMode = tick % 2 === 1;
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 min-h-[340px]">
        <div className="flex items-center gap-2 rounded-lg bg-muted p-1 w-fit">
          <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${!profileMode ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
            Document Approvals
          </span>
          <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${profileMode ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
            Profile Changes
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground">{profileMode ? "Requests" : "Employees"}</p>
            <p className="text-xs font-bold">{profileMode ? "5" : "6"}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground">Pending Review</p>
            <p className="text-xs font-bold text-amber-600">{profileMode ? "3" : "9"}</p>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 text-[11px] text-muted-foreground grid grid-cols-4 uppercase tracking-wide border-b bg-muted/20">
            <span>{profileMode ? "Employee" : "Employee"}</span>
            <span>{profileMode ? "Field" : "Document"}</span>
            <span>{profileMode ? "Requested Change" : "Type"}</span>
            <span>Status</span>
          </div>
          {profileMode
            ? [
                ["Employee 1", "Legal Name", "Juan Dela Cruz -> Juan M. Dela Cruz", "pending"],
                ["Employee 2", "Address", "Taguig -> Makati", "for-review"],
                ["Employee 3", "Phone Number", "0917-111-2222 -> 0917-555-8888", "approved"],
              ].map(([emp, field, change, status], i) => (
                <div key={`${emp}-${field}`} className="px-3 py-2 text-xs grid grid-cols-4 border-b last:border-b-0">
                  <span>{emp}</span>
                  <span>{field}</span>
                  <span className="truncate" title={change}>{change}</span>
                  <span className={i === 0 ? "text-amber-600 font-semibold" : status === "approved" ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                    {i === 0 ? "Pending Review" : status}
                  </span>
                </div>
              ))
            : ["submitted", "for-review", "approved"].map((s, i) => (
                <div key={s} className="px-3 py-2 text-xs grid grid-cols-4 border-b last:border-b-0">
                  <span>New Hire {i + 1}</span>
                  <span>ID / Contract</span>
                  <span>{i === 1 ? "Government ID" : "Employment Form"}</span>
                  <span className={i === rotating ? "text-amber-600 font-semibold" : s === "approved" ? "text-green-600 font-semibold" : "text-muted-foreground"}>{i === rotating ? "Pending Review" : s}</span>
                </div>
              ))}
        </div>
      </div>
    );
  }

  if (snippet.preview === "analytics") {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 min-h-[340px]">
        <div className="rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] p-3 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Platform Overview</p>
          <p className="mt-1 font-bold">Control Panel</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["Active", "128", "text-green-600"],
            ["Pending Invites", "9", "text-amber-600"],
            ["Companies", "5", "text-blue-600"],
          ].map(([k, v, cls]) => (
            <div key={k} className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground">{k}</p>
              <p className={`text-xs font-bold ${cls}`}>{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/20"><p className="text-xs font-bold">Recent Activity</p></div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-3 py-2 text-xs border-b last:border-b-0 flex items-center justify-between">
              <span>Audit log action #{i + 1}</span><span className="text-muted-foreground">{i + 1}m ago</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (snippet.preview === "careers") {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 min-h-[340px]">
        <div className="rounded-lg border border-border/70 bg-card px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Public Careers Page</p>
            <p className="text-xs font-medium text-foreground truncate">https://.../careers/company-slug</p>
          </div>
          <span className="text-[10px] rounded border border-border px-2 py-1 font-semibold">Copy Link</span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            ["Total Postings", "14"],
            ["Open", "8"],
            ["Closed", "4"],
            ["Drafts", "2"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-xs font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/20">
            <p className="text-xs font-bold">Job Postings</p>
            <p className="text-[10px] text-muted-foreground">Manage open positions for your company</p>
          </div>
          <div className="px-3 py-2 text-[11px] text-muted-foreground grid grid-cols-4 uppercase tracking-wide border-b">
            <span>Title</span><span>Status</span><span>Applicants</span><span>Pipeline</span>
          </div>
          {[
            ["Frontend Engineer", "open", "27", "kanban"],
            ["HR Generalist", "draft", "0", "list"],
            ["QA Analyst", "closed", "11", "kanban"],
          ].map(([title, status, applicants, view], i) => (
            <div key={title} className={`px-3 py-2 text-xs grid grid-cols-4 border-b last:border-b-0 ${i === rotating ? "bg-blue-50/50" : ""}`}>
              <span className="truncate">{title}</span>
              <span className={status === "open" ? "text-green-600 font-semibold" : status === "draft" ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"}>{status}</span>
              <span>{applicants}</span>
              <span className="text-primary font-medium">{view}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (snippet.preview === "sfia") {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 min-h-[340px]">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <p className="text-xs font-bold">Application Detail</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Candidate Evaluation Dashboard</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-primary">SFIA Ranking</span>
        </div>

        <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">Candidate {rotating + 1}</p>
              <p className="text-[10px] text-muted-foreground">Application Stage: Interviewing</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Overall SFIA Fit</p>
              <p className="text-sm font-bold text-primary">{[91, 88, 84][rotating]}%</p>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {["Strategy", "Change", "Analytics"].map((p, i) => (
            <div key={i}>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5"><span>{p}</span><span>L{i + 3}</span></div>
              <div className="h-1.5 rounded bg-blue-100"><div className="h-1.5 rounded bg-primary transition-all duration-700" style={{ width: `${[72, 64, 81][i] - (tick % 2) * 5}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["Communication", "L3"],
            ["Problem Solving", "L4"],
            ["Stakeholder Mgmt", "L3"],
          ].map(([skill, lvl]) => (
            <div key={skill} className="rounded-md border border-border bg-card px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground truncate">{skill}</p>
              <p className="text-xs font-bold text-foreground">{lvl}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (snippet.preview === "renewals") {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 min-h-[340px]">
        <div className="grid grid-cols-4 gap-2">
          {[
            ["Total MRR", "$10,497"],
            ["Active", "3"],
            ["Trials", "1"],
            ["Expiring Soon", "1"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground">{k}</p>
              <p className="text-xs font-bold">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 text-[11px] text-muted-foreground grid grid-cols-4 uppercase tracking-wide border-b bg-muted/20">
            <span>Plan</span><span>Status</span><span>Next Renewal</span><span>Seats</span>
          </div>
          {["Enterprise", "Professional", "Starter"].map((p, i) => (
            <div key={p} className="px-3 py-2 text-xs grid grid-cols-4 border-b last:border-b-0">
              <span>{p}</span>
              <span className={i === rotating ? "text-amber-600 font-semibold" : "text-green-600 font-semibold"}>{i === rotating ? "trial" : "active"}</span>
              <span>{["In 7 days", "In 14 days", "Expired"][i]}</span>
              <span>{[500, 200, 25][i]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 min-h-[340px]">
      <p className="text-xs font-bold">Approvals</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">Document Approvals · Profile Changes</p>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted p-1">
        <span className={`flex-1 rounded-md px-2 py-1 text-[10px] font-bold text-center ${tick % 2 === 0 ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Document Approvals</span>
        <span className={`flex-1 rounded-md px-2 py-1 text-[10px] font-bold text-center ${tick % 2 === 1 ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Profile Changes</span>
      </div>
      {tick % 2 === 0 ? (
        <div className="mt-3 rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 text-[11px] text-muted-foreground grid grid-cols-4 uppercase tracking-wide border-b bg-muted/20">
            <span>Employee</span><span>Document</span><span>Type</span><span>Status</span>
          </div>
          {[
            ["Employee 1", "ID / Contract", "Government ID", "Pending Review"],
            ["Employee 2", "ID / Contract", "Employment Form", "for-review"],
            ["Employee 3", "ID / Contract", "Employment Form", "approved"],
          ].map(([emp, doc, type, status], i) => (
            <div key={`${emp}-${type}`} className="px-3 py-2 text-xs grid grid-cols-4 border-b last:border-b-0">
              <span>{emp}</span>
              <span>{doc}</span>
              <span>{type}</span>
              <span className={i === 0 ? "text-amber-600 font-semibold" : status === "approved" ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                {status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 text-[11px] text-muted-foreground grid grid-cols-4 uppercase tracking-wide border-b bg-muted/20">
            <span>Employee</span><span>Field</span><span>Requested Change</span><span>Status</span>
          </div>
          {[
            ["Employee 1", "Legal Name", "Juan Dela Cruz -> Juan M. Dela Cruz", "Pending Review"],
            ["Employee 2", "Address", "Taguig -> Makati", "for-review"],
            ["Employee 3", "Phone Number", "0917-111-2222 -> 0917-555-8888", "approved"],
          ].map(([emp, field, change, status], i) => (
            <div key={`${emp}-${field}`} className="px-3 py-2 text-xs grid grid-cols-4 border-b last:border-b-0">
              <span>{emp}</span>
              <span>{field}</span>
              <span className="truncate" title={change}>{change}</span>
              <span className={i === 0 ? "text-amber-600 font-semibold" : status === "approved" ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                {status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FEATURE_SPANS = [
  "col-span-12 md:col-span-6 lg:col-span-5",
  "col-span-12 md:col-span-6 lg:col-span-7",
  "col-span-12 sm:col-span-6 lg:col-span-4",
  "col-span-12 sm:col-span-6 lg:col-span-4",
  "col-span-12 sm:col-span-6 lg:col-span-4",
  "col-span-12 sm:col-span-6 lg:col-span-6",
  "col-span-12 sm:col-span-6 lg:col-span-6",
  "col-span-12 sm:col-span-6 lg:col-span-6",
  "col-span-12 sm:col-span-6 lg:col-span-6",
] as const;

function FeaturesSection() {
  const reducedMotion = usePrefersReducedMotion();
  const [isClient, setIsClient] = useState(false);
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);
  const [previewTick, setPreviewTick] = useState<number>(0);
  const [hiringMode, setHiringMode] = useState<"sfia" | "manual">("sfia");
  const [hiringCandidates, setHiringCandidates] = useState<Array<{ name: string; fit: number }>>([
    { name: "Candidate 1", fit: 91 },
    { name: "Candidate 2", fit: 88 },
    { name: "Candidate 3", fit: 84 },
    { name: "Candidate 4", fit: 81 },
  ]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const featureCardsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const modalRef = useRef<HTMLDivElement | null>(null);
  const activeSnippet = activeFeatureId ? FEATURE_SNIPPETS[activeFeatureId] : null;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !activeFeatureId) return;
      const currentId = activeFeatureId;
      setActiveFeatureId(null);
      setTimeout(() => {
        featureCardsRef.current[currentId]?.focus();
      }, 0);
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeFeatureId]);

  useEffect(() => {
    if (!activeFeatureId || reducedMotion) return;
    const timer = window.setInterval(() => {
      setPreviewTick((prev) => prev + 1);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [activeFeatureId, reducedMotion]);

  useEffect(() => {
    if (!activeFeatureId || !modalRef.current) return;
    const modalNode = modalRef.current;
    const focusable = modalNode.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();

    function onTrapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const nodes = modalNode.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onTrapFocus);
    return () => document.removeEventListener("keydown", onTrapFocus);
  }, [activeFeatureId]);

  useEffect(() => {
    if (activeFeatureId !== "Recruitment & Hiring") {
      setHiringMode("sfia");
      setDragIndex(null);
      setDragOverIndex(null);
      setHiringCandidates([
        { name: "Candidate 1", fit: 91 },
        { name: "Candidate 2", fit: 88 },
        { name: "Candidate 3", fit: 84 },
        { name: "Candidate 4", fit: 81 },
      ]);
    }
  }, [activeFeatureId]);

  function onDropCandidate(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setHiringCandidates((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  function toggleFeature(title: string) {
    setActiveFeatureId((prev) => (prev === title ? null : title));
  }

  return (
    <section id="features" className="relative overflow-hidden px-4 md:px-8 py-24 bg-transparent">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-[10%] h-72 w-72 rounded-full bg-blue-200/55 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[8%] h-80 w-80 rounded-full bg-cyan-200/45 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/65 to-transparent" />
      </div>
      <SectionReveal className="max-w-7xl mx-auto">
        <div className="mb-12 md:mb-14 animate-in fade-in duration-500">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/60 mb-3">Platform Modules</p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <h2 className="text-[clamp(1.7rem,_3vw_+_0.75rem,_2.5rem)] font-extrabold text-gray-900 tracking-tight max-w-sm leading-tight">
              One platform.<br />Every HR function.
            </h2>
            <p className="text-gray-500 max-w-xs text-sm leading-relaxed md:text-right pb-1">
              No spreadsheet juggling. No switching apps. Click any module to see it in action.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5 md:gap-6">
          {FEATURES.map(({ icon: Icon, title, desc, color }, index) => {
            const isOpen = activeFeatureId === title;
            const dialogId = "feature-snippet-modal";
            const isFeatured = index === 0;
            const isWide = index === 1;
            return (
              <div className={`relative ${FEATURE_SPANS[index]}`} key={title}>
                <button
                  type="button"
                  ref={(node) => {
                    featureCardsRef.current[title] = node;
                  }}
                  aria-expanded={isOpen}
                  aria-controls={dialogId}
                  onClick={() => toggleFeature(title)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && isOpen) {
                      event.preventDefault();
                      setActiveFeatureId(null);
                    }
                  }}
                  className={`group w-full h-full text-left rounded-2xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/30 focus-visible:border-[#1e3a8a] ${
                    isFeatured
                      ? "border-blue-200 bg-[linear-gradient(145deg,#eef3ff_0%,#f5f8ff_60%,#ffffff_100%)] p-7 hover:shadow-[0_16px_40px_rgba(30,58,138,0.10)] hover:border-blue-300"
                      : "border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-6 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] hover:border-blue-200/80"
                  } ${isWide ? "flex items-start gap-5" : ""}`}
                >
                  <div className={`rounded-xl flex items-center justify-center flex-shrink-0 ${color} ${
                    isFeatured ? "w-12 h-12 mb-5" : isWide ? "w-11 h-11 mt-0.5" : "w-10 h-10 mb-4"
                  }`}>
                    <Icon className={isFeatured ? "w-6 h-6" : "w-5 h-5"} />
                  </div>
                  <div className={isWide ? "flex-1" : ""}>
                    <h3 className={`font-bold text-gray-900 mb-2.5 ${isFeatured ? "text-base" : "text-[15px]"}`}>{title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
                    <div className="mt-4 flex items-center gap-1 text-[#1e3a8a]/60 group-hover:text-[#1e3a8a] transition-colors">
                      <span className="text-[11px] font-semibold uppercase tracking-wide">Preview</span>
                      <ChevronRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {activeSnippet && isClient && createPortal(
          <div
            className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md p-4 md:p-8 flex items-center justify-center"
            onClick={() => setActiveFeatureId(null)}
          >
            <div
              id="feature-snippet-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`${activeSnippet.title} UI preview`}
              className="w-full max-w-[1220px] rounded-2xl border border-blue-200/80 bg-white shadow-[0_34px_90px_rgba(15,23,42,0.42)] overflow-hidden animate-in fade-in duration-200"
              onClick={(e) => e.stopPropagation()}
              ref={modalRef}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-blue-100 bg-[linear-gradient(135deg,#f8faff,#ffffff)] px-5 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1e3a8a]/70">{activeSnippet.eyebrow}</p>
                  <h3 className="text-lg font-bold text-gray-900">{activeSnippet.title}</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Press Esc to close preview</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveFeatureId(null)}
                  className="rounded-md p-2.5 text-gray-500 hover:text-[#1e3a8a] hover:bg-blue-50 transition-colors border border-blue-200/70"
                  aria-label={`Close ${activeSnippet.title} preview`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-[310px_1fr] p-6 bg-[#f8faff] max-h-[84vh] overflow-y-auto">
                <div className="rounded-xl border border-blue-100 bg-white p-5">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#1e3a8a]">
                    {activeSnippet.metric}
                  </span>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#1e3a8a]/70">
                    Includes
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {activeSnippet.chips.map((chip) => (
                      <li key={chip} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#1e3a8a]/70" />
                        <span>{chip}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#1e3a8a]/70">
                    What You Can Do
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {activeSnippet.rows.map((row) => (
                      <li key={row} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#1e3a8a]/55" />
                        <span>{row}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-blue-100 bg-white p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-3">Live Preview Loop</p>
                  <FeaturePreviewMini
                    snippet={activeSnippet}
                    tick={previewTick}
                    hiringMode={hiringMode}
                    setHiringMode={setHiringMode}
                    hiringCandidates={hiringCandidates}
                    dragIndex={dragIndex}
                    setDragIndex={setDragIndex}
                    dragOverIndex={dragOverIndex}
                    setDragOverIndex={setDragOverIndex}
                    onDropCandidate={onDropCandidate}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </SectionReveal>
    </section>
  );
}

/* ─────────────────────────── LIFECYCLE ─────────────────────────── */
const LIFECYCLE_STAGES = [
  {
    num: "01",
    icon: Search,
    title: "Recruitment",
    desc: "Post jobs, screen candidates, and manage your hiring pipeline end-to-end.",
    modules: ["Jobs", "Candidates", "Careers"],
    color: "bg-violet-50 text-violet-700",
    ring: "ring-violet-200",
  },
  {
    num: "02",
    icon: UserPlus,
    title: "Onboarding",
    desc: "Structured checklists and automated workflows to get new hires productive fast.",
    modules: ["Onboarding", "Approvals"],
    color: "bg-blue-50 text-blue-700",
    ring: "ring-blue-200",
  },
  {
    num: "03",
    icon: TrendingUp,
    title: "Development",
    desc: "Track competencies, run SFIA assessments, and support continuous learning.",
    modules: ["SFIA", "Performance"],
    color: "bg-teal-50 text-teal-700",
    ring: "ring-teal-200",
  },
  {
    num: "04",
    icon: Award,
    title: "Retention",
    desc: "Manage attendance, contracts, and recognition to keep your team engaged.",
    modules: ["Timekeeping", "Renewals"],
    color: "bg-amber-50 text-amber-700",
    ring: "ring-amber-200",
  },
  {
    num: "05",
    icon: LogOut,
    title: "Offboarding",
    desc: "Smooth exits with final clearance, document handover, and alumni records.",
    modules: ["Records", "Documents"],
    color: "bg-rose-50 text-rose-700",
    ring: "ring-rose-200",
  },
];

function LifecycleSection() {
  const [tiltByCard, setTiltByCard] = useState<Record<string, { x: number; y: number }>>({});

  function onCardMove(event: MouseEvent<HTMLDivElement>, key: string) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 10;
    const rotateX = (0.5 - py) * 8;
    setTiltByCard((prev) => ({ ...prev, [key]: { x: rotateX, y: rotateY } }));
  }

  function onCardLeave(key: string) {
    setTiltByCard((prev) => ({ ...prev, [key]: { x: 0, y: 0 } }));
  }

  function onCardTouchStart(key: string) {
    setTiltByCard((prev) => ({ ...prev, [key]: { x: -4, y: 4 } }));
  }

  function onCardTouchEnd(key: string) {
    setTimeout(() => onCardLeave(key), 180);
  }

  return (
    <section id="lifecycle" className="relative overflow-hidden px-4 md:px-8 py-24 bg-transparent">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 right-[-8%] h-72 w-72 rounded-full bg-blue-200/50 blur-3xl" />
        <div className="absolute bottom-[-100px] left-[-6%] h-80 w-80 rounded-full bg-teal-200/45 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#f8fbff]/90 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f8fbff]/90 to-transparent" />
      </div>
      <SectionReveal className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/60 mb-3">Complete Employee Lifecycle</p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <h2 className="text-[clamp(1.7rem,_3vw_+_0.75rem,_2.5rem)] font-extrabold text-gray-900 tracking-tight leading-tight max-w-xs">
              Every stage,<br />one platform.
            </h2>
            <p className="text-gray-500 max-w-xs text-sm leading-relaxed md:text-right pb-1">
              From first job post to final exit — without switching tools.
            </p>
          </div>
        </div>

        {/* Timeline wrapper */}
        <div className="relative">
          {/* Connecting line — desktop only */}
          <div className="hidden lg:block absolute top-[52px] left-[calc(10%+20px)] right-[calc(10%+20px)] h-0.5 bg-gradient-to-r from-violet-200 via-teal-200 to-rose-200 z-0" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 md:gap-6 relative z-10">
            {LIFECYCLE_STAGES.map(({ num, icon: Icon, title, desc, modules, color, ring }) => {
              const tilt = tiltByCard[num] ?? { x: 0, y: 0 };
              const isActive = Math.abs(tilt.x) > 0.1 || Math.abs(tilt.y) > 0.1;
              return (
              <div
                key={num}
                className="group flex flex-col items-center text-center"
              >
                {/* Icon circle */}
                <div className={`w-[52px] h-[52px] rounded-full ring-4 ${ring} bg-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                {/* Card */}
                <div
                  onMouseMove={(event) => onCardMove(event, num)}
                  onMouseLeave={() => onCardLeave(num)}
                  onTouchStart={() => onCardTouchStart(num)}
                  onTouchEnd={() => onCardTouchEnd(num)}
                  className="relative bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] rounded-2xl border border-slate-200/80 p-5 w-full hover:shadow-[0_26px_44px_rgba(15,23,42,0.16)] hover:border-blue-300/90 transition-all duration-200 flex-1 flex flex-col will-change-transform"
                  style={{
                    transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isActive ? 1.025 : 1})`,
                    transition: "transform 120ms ease-out, box-shadow 180ms ease-out, border-color 180ms ease-out",
                  }}
                >
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(37,99,235,0.14),transparent_52%)] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold tracking-[0.15em] text-gray-400">{num}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${color}`}>
                      {title}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-2">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed flex-1">{desc}</p>

                  {/* Module chips */}
                  <div className="flex flex-wrap justify-center gap-1.5 mt-4 pt-3 border-t border-gray-50">
                    {modules.map((m) => (
                      <span key={m} className="text-[10px] font-semibold text-[#1e3a8a] bg-blue-50 px-2 py-0.5 rounded-full">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}

/* ─────────────────────────── WHY US ─────────────────────────── */
function WhySection() {
  const { ref: snapshotRef, inView: snapshotInView } = useInView<HTMLDivElement>(0.35);

  return (
    <section id="why" className="relative overflow-hidden px-4 md:px-8 py-24 bg-transparent">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-70px] right-[12%] h-64 w-64 rounded-full bg-indigo-200/45 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-4%] h-80 w-80 rounded-full bg-teal-200/38 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/75 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/75 to-transparent" />
      </div>
      <SectionReveal className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Left: text */}
          <div className="animate-in fade-in duration-500">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/60 mb-3">Why Blue&apos;s Clues</p>
            <h2 className="text-[clamp(1.7rem,_3vw_+_0.75rem,_2.5rem)] font-extrabold text-gray-900 tracking-tight leading-tight">
              Built around how your HR team actually works.
            </h2>
            <p className="mt-5 text-gray-600 text-sm leading-relaxed">
              Designed from the ground up for Philippine companies — local compliance, real-time attendance, and workflows that match how your HR team actually operates.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                { icon: Zap,        title: "Fast setup",           desc: "Up and running in 24 hours. No months-long implementations." },
                { icon: Shield,     title: "Secure by default",    desc: "Role-based access, encrypted data, and audit trails built in." },
                { icon: TrendingUp, title: "Scales with you",      desc: "From 10 to 10,000 employees — same platform, no migration." },
                { icon: Building2,  title: "Philippines-focused",  desc: "Localized for PH labor laws, government reports, and payroll." },
              ].map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-4">
                  <div className="w-9 h-9 bg-[#1e3a8a]/8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-[#1e3a8a]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: visual card */}
          <div ref={snapshotRef} className="hidden md:block animate-in fade-in slide-in-from-right-4 duration-700">
            <div className="rounded-[26px] overflow-hidden border border-slate-200 bg-[linear-gradient(155deg,rgba(37,99,235,0.08),rgba(15,23,42,0.00))] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Workforce Overview</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">Today&apos;s Snapshot</p>
                  </div>
                  <div className="w-8 h-8 bg-[#1e3a8a] rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Present",  value: 142, dot: "bg-green-500" },
                    { label: "On Leave", value: 8,   dot: "bg-blue-400"  },
                    { label: "Late",     value: 5,   dot: "bg-amber-400" },
                    { label: "Absent",   value: 3,   dot: "bg-red-400"   },
                  ].map(({ label, value, dot }) => (
                    <div key={label} className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-2 h-2 rounded-full ${dot}`} />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900"><MiniCount target={value} start={snapshotInView} /></p>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 mt-1 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Pending Actions</p>
                  {[
                    { label: "Leave approvals",   count: 3, color: "text-amber-600 bg-amber-50" },
                    { label: "New applicants",    count: 7, color: "text-blue-600 bg-blue-50"   },
                    { label: "Contract renewals", count: 2, color: "text-rose-600 bg-rose-50"   },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700">{label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}><MiniCount target={count} start={snapshotInView} /></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}

/* ─────────────────────────── PRICING ─────────────────────────── */
const PLAN_FEATURES = [
  "Unlimited employees",
  "All HR modules",
  "Job posting & applicant tracking",
  "SFIA skills assessment",
  "Advanced analytics & reports",
  "Employee self-service portal",
  "Custom onboarding workflows",
  "Contract renewal tracking",
  "Role-based access control",
  "Priority email & chat support",
  "API access",
  "Dedicated account manager",
];

function PricingSection() {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const monthlyPrice = 4999;
  const annualPrice  = 3999;

  return (
    <section id="pricing" className="relative overflow-hidden px-4 md:px-8 py-24 bg-transparent">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-[18%] h-72 w-72 rounded-full bg-blue-200/48 blur-3xl" />
        <div className="absolute bottom-[-90px] right-[14%] h-72 w-72 rounded-full bg-emerald-200/42 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#f8fbff]/88 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f8fbff]/88 to-transparent" />
      </div>
      <SectionReveal className="max-w-7xl mx-auto">
        <div className="mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/60 mb-3">Pricing</p>
          <h2 className="text-[clamp(1.7rem,_3vw_+_0.75rem,_2.5rem)] font-extrabold text-gray-900 tracking-tight leading-tight">
            One plan.<br />Everything included.
          </h2>
        </div>

        {/* Two-column pricing card */}
        <div className="rounded-3xl overflow-hidden shadow-[0_24px_64px_rgba(30,58,138,0.14)] border border-slate-200/60">
          <div className="grid lg:grid-cols-[400px_1fr]">
            {/* Left: price + CTA */}
            <div className="bg-[linear-gradient(160deg,#0f172a_0%,#1e3a8a_100%)] px-8 py-10 flex flex-col justify-between gap-8">
              <div>
                <span className="inline-block bg-white/12 border border-white/15 text-white text-[10px] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full mb-6">
                  All-inclusive Plan
                </span>
                <h3 className="text-2xl font-extrabold text-white mb-1.5">Professional</h3>
                <p className="text-sm text-blue-200/60 mb-8">For growing Philippine HR teams</p>

                <div className="flex items-start gap-1 mb-2">
                  <span className="text-xl font-bold text-white/60 mt-3">₱</span>
                  <span className="text-[72px] font-black text-white tabular-nums leading-none tracking-tight">
                    {billing === "monthly" ? monthlyPrice.toLocaleString() : annualPrice.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-blue-200/50 mb-1">per month{billing === "annual" ? ", billed annually" : ""}</p>
                {billing === "annual" && (
                  <p className="inline-flex items-center gap-1.5 bg-green-500/15 border border-green-400/20 text-green-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <TrendingUp className="w-3 h-3" />
                    Save ₱{((monthlyPrice - annualPrice) * 12).toLocaleString()} per year
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {/* Billing toggle inside card */}
                <div className="flex bg-white/8 border border-white/10 rounded-xl p-1 gap-1">
                  {(["monthly", "annual"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setBilling(b)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        billing === b ? "bg-white text-[#1e3a8a] shadow-sm" : "text-white/55 hover:text-white/80"
                      }`}
                    >
                      {b === "monthly" ? "Monthly" : "Annual"}
                      {b === "annual" && billing !== "annual" && (
                        <span className="ml-1 text-[9px] text-green-400 font-bold">-20%</span>
                      )}
                    </button>
                  ))}
                </div>
                <Link
                  href="/subscribe"
                  className="flex items-center justify-center gap-2 w-full bg-white text-[#1e3a8a] font-bold py-3.5 rounded-xl hover:bg-blue-50 active:scale-[0.98] transition-all text-sm shadow-[0_4px_16px_rgba(255,255,255,0.12)]"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-[11px] text-blue-200/40 text-center flex items-center justify-center gap-1.5">
                  <Shield className="w-3 h-3" /> Secure checkout · Credentials in 24 hrs
                </p>
              </div>
            </div>

            {/* Right: features */}
            <div className="bg-white px-8 py-10 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]/50 mb-5">Everything included</p>
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                  {PLAN_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-[#1e3a8a]/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[#1e3a8a]" />
                      </div>
                      <span className="text-sm text-gray-700 leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {["99.9% uptime SLA", "ISO-ready security", "Priority support"].map((chip) => (
                    <span key={chip} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-500">
                  Need custom SLAs?{" "}
                  <a href="mailto:sales@bluetribe.ph" className="text-[#1e3a8a] font-medium hover:underline">
                    Contact sales
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}

/* ─────────────────────────── CTA BANNER ─────────────────────────── */
function CtaBanner() {
  return (
    <section className="px-4 md:px-8 py-20 bg-white">
      <SectionReveal className="max-w-7xl mx-auto">
        <div className="relative rounded-[24px] overflow-hidden border border-slate-800/20 bg-[linear-gradient(135deg,#0f172a_0%,#172554_55%,#134e4a_100%)] shadow-[0_20px_48px_rgba(15,23,42,0.22)]">
          {/* Dot grid */}
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          {/* Single glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-400 rounded-full opacity-[0.07] blur-[80px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />

          <div className="relative z-10 grid md:grid-cols-[1fr_auto] items-center gap-8 px-8 md:px-12 py-10 md:py-12">
            {/* Left */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300/70 mb-4">Take the next step</p>
              <h2 className="text-[clamp(1.4rem,_2.5vw_+_0.75rem,_2rem)] font-extrabold text-white leading-tight max-w-md">
                HR tools that work as hard as your team does.
              </h2>
              <p className="mt-3 text-white/50 text-sm max-w-sm leading-relaxed">
                Setup takes 24 hours. Credentials delivered same day. No six-month onboarding.
              </p>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-white/35">
                <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> Secure checkout</span>
                <span>·</span>
                <span>No long-term contract</span>
              </div>
            </div>

            {/* Right: CTAs */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:min-w-[180px]">
              <Link
                href="/subscribe"
                className="inline-flex items-center justify-center gap-2 bg-white text-[#1e3a8a] font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 active:scale-[0.98] transition-all text-sm whitespace-nowrap"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-white/8 border border-white/15 text-white/80 font-medium px-6 py-3 rounded-xl hover:bg-white/12 transition-all text-sm whitespace-nowrap"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}

/* ─────────────────────────── FOOTER ─────────────────────────── */
function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200/80 px-4 md:px-8 py-12">
      <SectionReveal className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-1.5">
            <img src="/blues-clues-logo.png" alt="Blues Clues HRIS" className="h-9 w-9 object-contain" style={{ mixBlendMode: "multiply" }} />
            <div>
              <span className="font-bold text-gray-900 text-sm">Blue&apos;s Clues HRIS</span>
              <p className="text-xs text-gray-400 mt-0.5">HR management for Philippine companies</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-5">
            {[
              { label: "Features",   href: "#features"   },
              { label: "Lifecycle",  href: "#lifecycle"  },
              { label: "Pricing",    href: "#pricing"    },
              { label: "Subscribe",  href: "/subscribe"  },
              { label: "Sign In",    href: "/login"      },
              { label: "Privacy",    href: "/privacy"    },
              { label: "Terms",      href: "/terms"      },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="text-xs text-gray-500 hover:text-[#1e3a8a] transition-colors font-medium">
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-400">© 2026 Blue&apos;s Clues Technologies. All rights reserved.</p>
          <p className="text-xs text-gray-400">Made for Philippine HR teams.</p>
        </div>
      </SectionReveal>
    </footer>
  );
}

function StickyMobileCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 rounded-xl border border-slate-200/90 bg-white/96 backdrop-blur px-3 py-2 shadow-[0_12px_28px_rgba(15,23,42,0.16)]">
      <div className="flex items-center gap-2">
        <Link href="/subscribe" className="flex-1 text-center rounded-lg bg-[#1e3a8a] px-3 py-2 text-sm font-semibold text-white">
          Get Started
        </Link>
        <Link href="/login" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
          Sign In
        </Link>
      </div>
    </div>
  );
}

function BackToTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 760);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-5 right-5 z-40 rounded-full border border-slate-300 bg-white/95 p-2 text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.14)] hover:bg-white"
      aria-label="Back to top"
    >
      <ArrowRight className="h-4 w-4 -rotate-90" />
    </button>
  );
}

/* ─────────────────────────── PAGE ─────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7faff_0%,#fbfdff_22%,#f5fbfb_50%,#f8fbff_76%,#f6fbff_100%)] [font-family:var(--font-manrope)]">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <LifecycleSection />
      <WhySection />
      <PricingSection />
      <CtaBanner />
      <Footer />
      <StickyMobileCta />
      <BackToTopButton />
    </div>
  );
}
