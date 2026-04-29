"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
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

function useCountUp(target: number, duration = 1800, start: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
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
  }, [target, duration, start]);
  return v;
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
  const v = useCountUp(end, 1800, start);
  return (
    <div className="text-center md:px-8">
      <p className="text-2xl md:text-3xl font-bold text-[#1e3a8a] tabular-nums">{format(v)}</p>
      <p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
    </div>
  );
}

function StatsBar() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className="bg-[#f8faff] border-b border-gray-100 px-4 md:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x divide-gray-200">
          {STATS.map((s) => (
            <StatItem key={s.label} end={s.end} format={s.format} label={s.label} start={inView} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── NAVBAR ─────────────────────────── */
function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1e3a8a] rounded-lg flex items-center justify-center flex-shrink-0">
            <Star className="w-4 h-4 text-white" />
          </div>
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
        <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
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
    <section className="pt-16">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-4 md:px-8 pt-20 pb-28">
        {/* Decorative blobs */}
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-blue-500 rounded-full opacity-[0.07] -translate-y-1/2 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500 rounded-full opacity-[0.07] -translate-y-1/4 translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 rounded-full opacity-[0.08] translate-y-1/3 -translate-x-1/4 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200">HR Management Platform</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight">
              Modern HR,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-teal-300">
                built for Philippine companies.
              </span>
            </h1>

            <p className="mt-6 text-base md:text-lg text-white/70 max-w-xl leading-relaxed">
              Blue&apos;s Clues HRIS centralizes your entire HR operation — from hiring and onboarding to timekeeping, payroll, and performance — in one clean, modern platform.
            </p>

            <div className="mt-8">
              <a
                href="#features"
                className="inline-flex items-center gap-2 bg-white text-[#1e3a8a] font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors text-sm"
              >
                Explore Features <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <p className="mt-5 text-xs text-white/40 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 flex-shrink-0" />
              Setup in 24 hours · No long-term contracts
            </p>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 64" className="w-full" preserveAspectRatio="none" height="64">
            <path d="M0,32 C360,64 1080,0 1440,32 L1440,64 L0,64 Z" fill="#f8faff" />
          </svg>
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

function FeaturesSection() {
  return (
    <section id="features" className="px-4 md:px-8 py-20 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 animate-in fade-in duration-500">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-3">Everything HR Needs</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">Built for modern HR teams</h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
            All the tools your HR department needs — no juggling spreadsheets, no switching apps.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="group rounded-2xl border border-gray-100 bg-white p-6 hover:shadow-md hover:border-blue-100 transition-all duration-200"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-gray-900 text-[15px] mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
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
  return (
    <section id="lifecycle" className="px-4 md:px-8 py-20 bg-[#f8faff]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-3">Complete Employee Lifecycle</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            One platform for every HR stage
          </h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
            From the first job posting to the final exit interview — manage every moment that matters.
          </p>
        </div>

        {/* Timeline wrapper */}
        <div className="relative">
          {/* Connecting line — desktop only */}
          <div className="hidden lg:block absolute top-[52px] left-[calc(10%+20px)] right-[calc(10%+20px)] h-0.5 bg-gradient-to-r from-violet-200 via-teal-200 to-rose-200 z-0" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 relative z-10">
            {LIFECYCLE_STAGES.map(({ num, icon: Icon, title, desc, modules, color, ring }) => (
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
                <div className="bg-white rounded-2xl border border-gray-100 p-5 w-full hover:shadow-md hover:border-blue-100 transition-all duration-200 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold tracking-[0.15em] text-gray-400">{num}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${color}`}>
                      Stage
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
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── WHY US ─────────────────────────── */
function WhySection() {
  return (
    <section id="why" className="px-4 md:px-8 py-20 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div className="animate-in fade-in duration-500">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-3">Why Blue&apos;s Clues</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight">
              HR software that actually works for your team.
            </h2>
            <p className="mt-5 text-gray-500 text-sm leading-relaxed">
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
          <div className="hidden md:block animate-in fade-in slide-in-from-right-4 duration-700">
            <div className="rounded-[26px] overflow-hidden border border-slate-200 bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))] p-6 shadow-sm">
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
                    { label: "Present",  value: "142", dot: "bg-green-500" },
                    { label: "On Leave", value: "8",   dot: "bg-blue-400"  },
                    { label: "Late",     value: "5",   dot: "bg-amber-400" },
                    { label: "Absent",   value: "3",   dot: "bg-red-400"   },
                  ].map(({ label, value, dot }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-2 h-2 rounded-full ${dot}`} />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-4 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Pending Actions</p>
                  {[
                    { label: "Leave approvals",   count: 3, color: "text-amber-600 bg-amber-50" },
                    { label: "New applicants",    count: 7, color: "text-blue-600 bg-blue-50"   },
                    { label: "Contract renewals", count: 2, color: "text-rose-600 bg-rose-50"   },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700">{label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
    <section id="pricing" className="px-4 md:px-8 py-20 bg-[#f8faff]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-3">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            Simple, transparent pricing.
          </h2>
          <p className="mt-4 text-gray-500 max-w-md mx-auto text-sm leading-relaxed">
            One plan. Everything included. No hidden fees, no feature gating.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center mt-8">
            <div className="flex bg-gray-100 rounded-full p-1 gap-1">
              {(["monthly", "annual"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                    billing === b ? "bg-[#1e3a8a] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {b === "monthly" ? "Monthly" : "Annual"}
                  {b === "annual" && (
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      billing === "annual" ? "bg-white/20 text-white" : "bg-green-100 text-green-700"
                    }`}>
                      Save 20%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Single plan card */}
        <div className="max-w-lg mx-auto">
          <div className="relative rounded-2xl border-2 border-[#1e3a8a] bg-gradient-to-br from-blue-50/80 to-white p-8 shadow-lg">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="bg-[#1e3a8a] text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap">
                All-inclusive Plan
              </span>
            </div>

            <div className="text-center mb-7 mt-2">
              <h3 className="text-xl font-bold text-gray-900">Professional</h3>
              <p className="text-sm text-gray-500 mt-1 mb-6">For growing HR teams</p>

              <div className="flex items-end justify-center gap-1">
                <span className="text-[10px] font-bold text-gray-500 self-start mt-2.5">₱</span>
                <span className="text-5xl font-extrabold text-[#1e3a8a] tabular-nums">
                  {billing === "monthly" ? monthlyPrice.toLocaleString() : annualPrice.toLocaleString()}
                </span>
                <span className="text-gray-400 text-sm pb-1.5">/mo</span>
              </div>

              {billing === "annual" && (
                <p className="text-xs text-gray-400 mt-2">
                  Billed ₱{(annualPrice * 12).toLocaleString()} per year ·{" "}
                  <span className="text-green-600 font-semibold">
                    Save ₱{((monthlyPrice - annualPrice) * 12).toLocaleString()}
                  </span>
                </p>
              )}
            </div>

            <ul className="space-y-2.5 mb-8">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-full bg-[#1e3a8a]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 text-[#1e3a8a]" />
                  </div>
                  <span className="text-sm text-gray-700">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/subscribe"
              className="flex items-center justify-center gap-2 w-full bg-[#1e3a8a] text-white font-semibold py-3 rounded-xl hover:bg-[#1e40af] transition-colors text-sm"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>

            <p className="text-xs text-gray-400 text-center mt-4 flex items-center justify-center gap-1.5">
              <Shield className="w-3 h-3" />
              Secure checkout · Credentials in 24 hours
            </p>
          </div>

          <div className="mt-5 text-center">
            <p className="text-sm text-gray-500">
              Need multi-entity or custom SLAs?{" "}
              <a href="mailto:sales@bluetribe.ph" className="text-[#1e3a8a] font-medium hover:underline">
                Contact sales
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── CTA BANNER ─────────────────────────── */
function CtaBanner() {
  return (
    <section className="px-4 md:px-8 py-16 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-[26px] overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#172554_55%,#134e4a_100%)] px-8 md:px-14 py-12 text-center">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400 rounded-full opacity-10 blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-teal-400 rounded-full opacity-10 blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300 mb-4">Get Started Today</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
              Ready to modernize your HR operations?
            </h2>
            <p className="mt-4 text-white/60 text-sm max-w-md mx-auto leading-relaxed">
              Join hundreds of companies using Blue&apos;s Clues HRIS to simplify their HR. Setup takes 24 hours.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/subscribe"
                className="inline-flex items-center justify-center gap-2 bg-white text-[#1e3a8a] font-semibold px-7 py-3 rounded-xl hover:bg-blue-50 transition-colors text-sm"
              >
                Subscribe Now <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-medium px-7 py-3 rounded-xl hover:bg-white/15 transition-colors text-sm"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── FOOTER ─────────────────────────── */
function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 px-4 md:px-8 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#1e3a8a] rounded-lg flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-white" />
            </div>
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
      </div>
    </footer>
  );
}

/* ─────────────────────────── PAGE ─────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <LifecycleSection />
      <WhySection />
      <PricingSection />
      <CtaBanner />
      <Footer />
    </div>
  );
}
