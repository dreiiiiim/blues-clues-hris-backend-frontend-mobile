"use client";

import { useState, type ReactNode } from "react";
import { API_BASE_URL } from "@/lib/api";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Building,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  CreditCard,
  FileText,
  Home,
  Info,
  LifeBuoy,
  Lock,
  Shield,
  ShieldCheck,
  Smartphone,
  Star,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHLY_PRICE = 4999;
const ANNUAL_PRICE = 3999;

const API_BASE = API_BASE_URL;
const WEBHOOK_SECRET = process.env.NEXT_PUBLIC_SUBSCRIPTION_WEBHOOK_SECRET ?? "";

const PLAN_FEATURES = [
  "Unlimited employees",
  "All HR modules included",
  "Job posting and applicant tracking",
  "SFIA skills assessment",
  "Advanced analytics and reports",
  "Employee self-service portal",
  "Custom onboarding workflows",
  "Contract renewal tracking",
  "Role-based access control",
  "Priority email and chat support",
  "API access",
  "Dedicated account manager",
];

const STEPS = [
  { id: 1, label: "Plan", icon: Briefcase },
  { id: 2, label: "Setup", icon: Building2 },
  { id: 3, label: "Payment", icon: CreditCard },
  { id: 4, label: "Confirm", icon: BadgeCheck },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyFormData {
  company_name: string;
  address: string;
  contact: string;
  email: string;
  industry: string;
  nature_of_business: string;
  tin: string;
}

type CompanyField = keyof CompanyFormData;
type CompanyFieldErrors = Partial<Record<CompanyField, string>>;

interface PaymentFormData {
  full_name: string;
  street: string;
  city: string;
  zip: string;
  card_name: string;
  card_number: string;
  expiry: string;
  cvv: string;
  payment_method: "card" | "bank" | "gcash";
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Background ───────────────────────────────────────────────────────────────

function BackgroundBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
      <div className="absolute inset-0 bg-[#f8faff]" />
      <div className="absolute -top-48 -left-48 h-[40rem] w-[40rem] rounded-full bg-[#1e3a8a]/7 blur-[160px]" />
      <div className="absolute -bottom-32 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#1e3a8a]/4 blur-[130px]" />
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(30,58,138,0.9) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 xl:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2.5 group" aria-label="Blue's Clues HRIS Home">
            <div className="w-8 h-8 bg-[#1e3a8a] rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#1e40af] transition-colors duration-200 shadow-sm shadow-blue-900/20">
              <Star className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-bold text-gray-900 text-[15px] leading-tight">
              Blue&apos;s Clues<span className="text-[#1e3a8a]"> HRIS</span>
            </span>
          </Link>
          <div className="hidden md:block h-5 w-px bg-gray-200" aria-hidden="true" />
          <Link
            href="/"
            className="hidden md:inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1e3a8a] transition-colors duration-200 font-medium"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            Home
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1.5 rounded-full">
            <Lock className="h-3 w-3 text-[#1e3a8a]/60" aria-hidden="true" />
            Secure checkout
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-[#1e3a8a] transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 cursor-pointer"
          >
            Sign In
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Top Stepper ──────────────────────────────────────────────────────────────

function TopStepper({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Subscription setup progress" className="mb-9 px-0 sm:px-1">
      <ol className="grid grid-cols-4 items-start relative w-full mx-auto">
        {/* Track */}
        <div className="absolute top-[22px] left-[8%] right-[8%] h-[2px] bg-gray-100 rounded-full" aria-hidden="true" />
        <div
          className="absolute top-[22px] left-[8%] h-[2px] bg-[#1e3a8a] rounded-full transition-[width] duration-700 ease-in-out"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 84}%` }}
          aria-hidden="true"
        />
        {STEPS.map((step) => {
          const done = currentStep > step.id;
          const active = currentStep === step.id;
          const Icon = step.icon;
          return (
            <li key={step.id} className="flex flex-col items-center gap-2 relative z-10 w-full">
              <div
                aria-current={active ? "step" : undefined}
                className={cn(
                  "w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all duration-500",
                  done
                    ? "bg-[#1e3a8a] border-[#1e3a8a] text-white shadow-sm shadow-blue-900/20"
                    : active
                    ? "bg-[#1e3a8a] border-[#1e3a8a] text-white scale-110 shadow-[0_0_0_5px_rgba(30,58,138,0.1),0_4px_12px_rgba(30,58,138,0.25)]"
                    : "bg-white border-gray-200 text-gray-400"
                )}
              >
                {done ? (
                  <CheckCircle2 size={18} aria-hidden="true" />
                ) : (
                  <Icon size={16} aria-hidden="true" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-bold uppercase tracking-[0.14em] transition-colors duration-300 text-center",
                  active ? "text-[#1e3a8a]" : done ? "text-[#1e3a8a]/50" : "text-gray-400"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Sidebar Wizard ───────────────────────────────────────────────────────────

const STEP_TIMES = ["2 min", "3 min", "2 min", "1 min"];

function SidebarWizard({ currentStep }: { currentStep: number }) {
  const progressPct = Math.round(((currentStep - 1) / STEPS.length) * 100);

  return (
    <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24 lg:self-start space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="bg-gradient-to-r from-[#0f172a] to-[#1e3a8a] px-5 py-4">
          <p className="text-xs font-bold text-white/90">Subscription Setup</p>
          <p className="text-[10px] text-blue-200/60 mt-0.5 font-medium">
            Complete all steps to activate
          </p>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/60">Progress</p>
            <p className="text-[10px] font-bold text-[#1e3a8a]">{progressPct}%</p>
          </div>
          <div
            className="h-1.5 rounded-full bg-gray-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={currentStep - 1}
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1e3a8a] to-[#3b82f6] transition-[width] duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <ul className="mt-4 space-y-1.5">
            {STEPS.map((step, idx) => {
              const done = currentStep > step.id;
              const active = currentStep === step.id;
              const Icon = step.icon;
              return (
                <li key={step.id}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all duration-200",
                      active
                        ? "bg-blue-50 border-blue-200/80 shadow-[0_1px_3px_rgba(30,58,138,0.08)]"
                        : done
                        ? "bg-green-50/80 border-green-100"
                        : "bg-white border-gray-100"
                    )}
                    aria-current={active ? "step" : undefined}
                  >
                    <div
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
                        active
                          ? "bg-[#1e3a8a] text-white shadow-sm shadow-blue-900/20"
                          : done
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 text-gray-400"
                      )}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider leading-none mb-0.5",
                          active ? "text-[#1e3a8a]/60" : done ? "text-green-600/70" : "text-gray-400"
                        )}
                      >
                        Step {step.id} · {STEP_TIMES[idx]}
                      </p>
                      <p
                        className={cn(
                          "text-sm font-semibold leading-tight",
                          active ? "text-[#1e3a8a]" : done ? "text-green-800" : "text-gray-500"
                        )}
                      >
                        {step.label}
                      </p>
                    </div>
                    {done && (
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" aria-hidden="true" />
                    )}
                    {active && (
                      <ChevronRight className="h-3.5 w-3.5 text-[#1e3a8a]/40 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Trust block */}
      <div className="rounded-2xl border border-blue-100/60 bg-gradient-to-br from-white to-blue-50/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#1e3a8a]/8 flex items-center justify-center">
            <ShieldCheck className="h-3.5 w-3.5 text-[#1e3a8a]" aria-hidden="true" />
          </div>
          <p className="text-xs font-bold text-gray-800">Secure & Private</p>
        </div>
        <ul className="space-y-1.5 text-[11px] text-gray-500 leading-relaxed">
          <li className="flex items-center gap-1.5">
            <Check className="h-3 w-3 text-green-500 shrink-0" aria-hidden="true" />
            256-bit SSL encrypted
          </li>
          <li className="flex items-center gap-1.5">
            <Check className="h-3 w-3 text-green-500 shrink-0" aria-hidden="true" />
            Data never sold to third parties
          </li>
          <li className="flex items-center gap-1.5">
            <Check className="h-3 w-3 text-green-500 shrink-0" aria-hidden="true" />
            Cancel anytime, no penalties
          </li>
        </ul>
      </div>

      {/* Help block */}
      <div className="rounded-2xl border border-gray-100 bg-[#f8faff] p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <LifeBuoy className="h-4 w-4 text-[#1e3a8a]" aria-hidden="true" />
          <p className="text-xs font-bold text-gray-700">Need Help?</p>
        </div>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          Our team is ready to guide you through setup.
        </p>
        <a
          href="mailto:support@blueclues.com"
          className="block w-full rounded-xl bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1e40af] transition-colors duration-200 text-center"
        >
          Contact Support
        </a>
      </div>
    </aside>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({
  title,
  icon: Icon,
  children,
  optional,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 md:px-6 bg-slate-50/50">
        <div className="h-7 w-7 rounded-lg bg-[#1e3a8a]/8 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-[#1e3a8a]" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {optional && (
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            Optional
          </span>
        )}
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </div>
  );
}

// ─── Form Helpers ─────────────────────────────────────────────────────────────

const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-[#f8faff] px-3.5 text-sm text-gray-900 outline-none hover:border-gray-300 focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10 transition-all duration-200 placeholder:text-gray-400 cursor-text";

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── File Upload ──────────────────────────────────────────────────────────────

function FileUpload({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-2">
      <p id={`${id}-label`} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      {value ? (
        <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-lg bg-[#1e3a8a]/10 flex items-center justify-center shrink-0">
              <FileText className="h-3 w-3 text-[#1e3a8a]" aria-hidden="true" />
            </div>
            <p className="text-sm text-gray-700 truncate">{value.name}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Remove ${label}`}
            className="text-gray-400 hover:text-red-500 transition-colors duration-200 ml-2 shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-[#f8faff] p-6 text-center hover:border-[#1e3a8a]/40 hover:bg-blue-50/40 transition-all duration-200 group focus-within:ring-2 focus-within:ring-[#1e3a8a]/20"
        >
          <div className="h-10 w-10 rounded-xl bg-gray-100 group-hover:bg-[#1e3a8a]/8 flex items-center justify-center mb-3 transition-colors duration-200">
            <Upload className="h-5 w-5 text-gray-400 group-hover:text-[#1e3a8a] transition-colors duration-200" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-gray-600 group-hover:text-[#1e3a8a] transition-colors duration-200">
            Click to upload
          </p>
          <p className="text-xs text-gray-400 mt-0.5">PDF, PNG, JPG — max 10MB</p>
          <input
            id={id}
            type="file"
            className="sr-only"
            accept=".pdf,.png,.jpg,.jpeg"
            aria-labelledby={`${id}-label`}
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}

// ─── Nav Buttons ──────────────────────────────────────────────────────────────

function NavButtons({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextIcon: NextIcon = ArrowRight,
  loading = false,
  disabled = false,
  submitType = false,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  submitType?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
      ) : (
        <div />
      )}
      <button
        type={submitType ? "submit" : "button"}
        onClick={!submitType ? onNext : undefined}
        disabled={loading || disabled}
        className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-7 py-2.5 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_2px_8px_rgba(30,58,138,0.2)] hover:shadow-[0_4px_16px_rgba(30,58,138,0.25)] hover:-translate-y-px active:translate-y-0 cursor-pointer"
      >
        {loading ? (
          <>
            <span
              className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
              aria-hidden="true"
            />
            <span>Processing…</span>
          </>
        ) : (
          <>
            {nextLabel}
            <NextIcon className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}

// ─── Step 1: Plan Selection ───────────────────────────────────────────────────

function StepPlan({
  billing,
  setBilling,
  onNext,
}: {
  billing: "monthly" | "annual";
  setBilling: (b: "monthly" | "annual") => void;
  onNext: () => void;
}) {
  const price = billing === "annual" ? ANNUAL_PRICE : MONTHLY_PRICE;
  const annualSavings = (MONTHLY_PRICE - ANNUAL_PRICE) * 12;

  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-3 duration-400">
      {/* Heading */}
      <div>
        <div className="inline-flex items-center gap-1.5 bg-[#1e3a8a]/8 text-[#1e3a8a] text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full mb-3">
          <Zap className="h-3 w-3" aria-hidden="true" />
          Step 1 — Plan Selection
        </div>
        <h2 className="text-[28px] font-extrabold text-gray-900 tracking-tight leading-tight">
          One plan. Everything included.
        </h2>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          No feature gating. No hidden fees. Full HR suite from day one.
        </p>
      </div>

      {/* Plan card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.07)] overflow-hidden">
        {/* Dark header */}
        <div className="relative bg-[linear-gradient(135deg,#0a0f1e_0%,#0f172a_40%,#172554_80%,#1e3a5c_100%)] px-6 py-6 overflow-hidden">
          {/* Decorative orb */}
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/4 blur-2xl pointer-events-none" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 h-24 w-48 bg-[#1e3a8a]/20 blur-3xl pointer-events-none" aria-hidden="true" />

          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-2.5 py-1 mb-2.5">
                <Star className="h-3 w-3 text-amber-400" aria-hidden="true" />
                <span className="text-[10px] font-bold text-white/80 uppercase tracking-[0.12em]">Professional Plan</span>
              </div>
              <p className="text-white font-semibold text-sm leading-snug max-w-xs">
                Complete HR management for Philippine companies
              </p>
            </div>

            {/* Billing toggle */}
            <div
              className="flex bg-white/10 border border-white/15 rounded-xl p-1 gap-1 w-fit shrink-0"
              role="group"
              aria-label="Billing cycle"
            >
              {(["monthly", "annual"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBilling(b)}
                  aria-pressed={billing === b}
                  className={cn(
                    "px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap relative",
                    billing === b
                      ? "bg-white text-[#1e3a8a] shadow-sm"
                      : "text-white/60 hover:text-white/90"
                  )}
                >
                  {b === "monthly" ? "Monthly" : "Annual"}
                  {b === "annual" && (
                    <span className={cn(
                      "ml-1.5 text-[9px] font-extrabold transition-colors duration-200",
                      billing === "annual" ? "text-green-600" : "text-green-400"
                    )}>
                      −20%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
          {/* Left: price + CTA */}
          <div className="p-6 md:p-8 border-b lg:border-b-0 lg:border-r border-slate-100">
            <div className="flex items-end gap-1.5" aria-label={`Price: ₱${price.toLocaleString()} per month`}>
              <span className="text-sm font-bold text-slate-400 self-start mt-1.5" aria-hidden="true">₱</span>
              <span className="text-[52px] font-black text-[#1e3a8a] tabular-nums tracking-tighter leading-none">
                {price.toLocaleString()}
              </span>
              <span className="text-slate-400 text-sm pb-2 ml-1">/mo</span>
            </div>

            {billing === "annual" ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  Billed ₱{(ANNUAL_PRICE * 12).toLocaleString()} annually
                </span>
                <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Check className="h-2.5 w-2.5" aria-hidden="true" />
                  Save ₱{annualSavings.toLocaleString()}/yr
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-2">
                Switch to annual and save{" "}
                <span className="font-semibold text-green-600">
                  ₱{annualSavings.toLocaleString()}/yr
                </span>
              </p>
            )}

            <button
              type="button"
              onClick={onNext}
              className="mt-7 flex items-center gap-2 bg-[#1e3a8a] text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-[#1e40af] active:scale-[0.98] transition-all duration-200 text-sm shadow-[0_4px_14px_rgba(30,58,138,0.25)] hover:shadow-[0_6px_20px_rgba(30,58,138,0.3)] hover:-translate-y-px cursor-pointer group"
            >
              Get Started Now
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" aria-hidden="true" />
            </button>

            <div className="mt-5 grid gap-1.5">
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3 h-3 flex-shrink-0 text-[#1e3a8a]/60" aria-hidden="true" />
                Admin credentials delivered within 24 hours
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3 h-3 flex-shrink-0 text-[#1e3a8a]/60" aria-hidden="true" />
                Cancel anytime — no penalties
              </p>
            </div>
          </div>

          {/* Right: features */}
          <div className="p-6 bg-slate-50/40">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
              Everything included
            </p>
            <ul className="grid grid-cols-1 gap-2">
              {PLAN_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700 group">
                  <div
                    className="w-4.5 h-4.5 rounded-full bg-[#1e3a8a]/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#1e3a8a]/15 transition-colors duration-150"
                    aria-hidden="true"
                  >
                    <Check className="w-2.5 h-2.5 text-[#1e3a8a]" />
                  </div>
                  <span className="leading-snug">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-100 bg-slate-50/40 px-6 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
          {[
            { icon: Users, label: "Trusted by growing PH companies" },
            { icon: ShieldCheck, label: "SOC-2 compliant infrastructure" },
            { icon: Star, label: "Priority support included" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <Icon className="h-3.5 w-3.5 text-[#1e3a8a]/60" aria-hidden="true" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Company Setup ────────────────────────────────────────────────────

function StepCompany({
  data,
  errors,
  onChange,
  onBack,
  onNext,
  loading,
}: {
  data: CompanyFormData;
  errors: CompanyFieldErrors;
  onChange: (d: Partial<CompanyFormData>) => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  const [permitFile, setPermitFile] = useState<File | null>(null);
  const [regFile, setRegFile] = useState<File | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-3 duration-400">
      <div>
        <div className="inline-flex items-center gap-1.5 bg-[#1e3a8a]/8 text-[#1e3a8a] text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full mb-3">
          <Building2 className="h-3 w-3" aria-hidden="true" />
          Step 2 — Company Setup
        </div>
        <h2 className="text-[28px] font-extrabold text-gray-900 tracking-tight leading-tight">
          Tell us about your company
        </h2>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          Legal business details for your account. Takes about 2 minutes — everything can be updated after signup.
        </p>
      </div>

      <Card title="Basic Information" icon={Building2}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Company Name" id="company_name">
            <input
              id="company_name"
              required
              aria-invalid={Boolean(errors.company_name)}
              className={cn(inputCls, errors.company_name && "border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20")}
              placeholder="Global Tech Solutions Inc."
              value={data.company_name}
              onChange={(e) => onChange({ company_name: e.target.value })}
              autoComplete="organization"
            />
            {errors.company_name && <p className="mt-1 text-xs text-red-600">{errors.company_name}</p>}
          </Field>
          <Field label="Industry" id="industry">
            <select
              id="industry"
              required
              aria-invalid={Boolean(errors.industry)}
              className={cn(inputCls, errors.industry && "border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20")}
              value={data.industry}
              onChange={(e) => onChange({ industry: e.target.value })}
            >
              <option value="">Select industry</option>
              <option>Technology and Software</option>
              <option>Finance and Banking</option>
              <option>Manufacturing</option>
              <option>Healthcare</option>
              <option>Retail and Commerce</option>
              <option>Education</option>
              <option>Government</option>
              <option>Other</option>
            </select>
            {errors.industry && <p className="mt-1 text-xs text-red-600">{errors.industry}</p>}
          </Field>
          <div className="md:col-span-2">
            <Field label="Company Address" id="address">
              <input
                id="address"
                required
                aria-invalid={Boolean(errors.address)}
                className={cn(inputCls, errors.address && "border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20")}
                placeholder="Street, City, Province, ZIP"
                value={data.address}
                onChange={(e) => onChange({ address: e.target.value })}
                autoComplete="street-address"
              />
              {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
            </Field>
          </div>
          <Field label="Contact Person" id="contact">
            <input
              id="contact"
              required
              aria-invalid={Boolean(errors.contact)}
              className={cn(inputCls, errors.contact && "border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20")}
              placeholder="Full legal name"
              value={data.contact}
              onChange={(e) => onChange({ contact: e.target.value })}
              autoComplete="name"
            />
            {errors.contact && <p className="mt-1 text-xs text-red-600">{errors.contact}</p>}
          </Field>
          <Field label="Company Email" id="company_email">
            <input
              id="company_email"
              required
              type="email"
              aria-invalid={Boolean(errors.email)}
              className={cn(inputCls, errors.email && "border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20")}
              placeholder="admin@company.com"
              value={data.email}
              onChange={(e) => onChange({ email: e.target.value })}
              autoComplete="email"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </Field>
          <Field label="TIN" id="tin">
            <input
              id="tin"
              required
              aria-invalid={Boolean(errors.tin)}
              className={cn(inputCls, errors.tin && "border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20")}
              placeholder="000-000-000-000"
              value={data.tin}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 12);
                const parts: string[] = [];
                if (raw.length > 0) parts.push(raw.slice(0, 3));
                if (raw.length > 3) parts.push(raw.slice(3, 6));
                if (raw.length > 6) parts.push(raw.slice(6, 9));
                if (raw.length > 9) parts.push(raw.slice(9, 12));
                onChange({ tin: parts.join("-") });
              }}
              maxLength={15}
            />
            {errors.tin
              ? <p className="mt-1 text-xs text-red-600">{errors.tin}</p>
              : <p className="mt-1 text-xs text-gray-400">BIR-issued format: 000-000-000-000</p>
            }
          </Field>
          <div className="md:col-span-2">
            <label
              htmlFor="nature_of_business"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Nature of Business
            </label>
            <textarea
              id="nature_of_business"
              required
              rows={3}
              aria-invalid={Boolean(errors.nature_of_business)}
              className={cn(
                "w-full rounded-xl border border-gray-200 bg-[#f8faff] px-3.5 py-3 text-sm text-gray-900 outline-none hover:border-gray-300 focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10 transition-all duration-200 placeholder:text-gray-400 cursor-text resize-none",
                errors.nature_of_business && "border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20"
              )}
              placeholder="Briefly describe your business operations"
              value={data.nature_of_business}
              onChange={(e) => onChange({ nature_of_business: e.target.value })}
            />
            {errors.nature_of_business && (
              <p className="mt-1 text-xs text-red-600">{errors.nature_of_business}</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Business Documents" icon={FileText} optional>
        <div className="grid gap-4 md:grid-cols-2">
          <FileUpload
            label="Business Permit"
            id="permit_file"
            value={permitFile}
            onChange={setPermitFile}
          />
          <FileUpload
            label="SEC / DTI Registration"
            id="reg_file"
            value={regFile}
            onChange={setRegFile}
          />
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
          <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
          Documents are optional but may speed up verification.
        </p>
      </Card>

      <NavButtons onBack={onBack} loading={loading} submitType />
    </form>
  );
}

// ─── Step 3: Billing & Payment ────────────────────────────────────────────────

function StepPayment({
  billing,
  payData,
  onChange,
  onBack,
  onNext,
}: {
  billing: "monthly" | "annual";
  payData: PaymentFormData;
  onChange: (d: Partial<PaymentFormData>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const total = billing === "annual" ? ANNUAL_PRICE * 12 : MONTHLY_PRICE;
  const monthlyRate = billing === "annual" ? ANNUAL_PRICE : MONTHLY_PRICE;

  const methods: {
    key: "card" | "bank" | "gcash";
    label: string;
    sublabel: string;
    icon: LucideIcon;
  }[] = [
    { key: "card", label: "Credit / Debit Card", sublabel: "Visa, Mastercard, JCB", icon: CreditCard },
    { key: "bank", label: "Bank Transfer", sublabel: "BDO, BPI, Metrobank", icon: Building },
    { key: "gcash", label: "GCash", sublabel: "Instant mobile payment", icon: Smartphone },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
      noValidate
      className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-3 duration-400"
    >
      <div>
        <div className="inline-flex items-center gap-1.5 bg-[#1e3a8a]/8 text-[#1e3a8a] text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full mb-3">
          <CreditCard className="h-3 w-3" aria-hidden="true" />
          Step 3 — Billing & Payment
        </div>
        <h2 className="text-[28px] font-extrabold text-gray-900 tracking-tight leading-tight">
          Secure checkout
        </h2>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          256-bit SSL encrypted. Your payment information is never stored.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="space-y-5">
          <Card title="Billing Address" icon={Building}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Full Name" id="billing_name">
                  <input
                    id="billing_name"
                    required
                    className={inputCls}
                    placeholder="Juan dela Cruz"
                    value={payData.full_name}
                    onChange={(e) => onChange({ full_name: e.target.value })}
                    autoComplete="name"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Street Address" id="billing_street">
                  <input
                    id="billing_street"
                    required
                    className={inputCls}
                    placeholder="123 Corporate Way"
                    value={payData.street}
                    onChange={(e) => onChange({ street: e.target.value })}
                    autoComplete="street-address"
                  />
                </Field>
              </div>
              <Field label="City" id="billing_city">
                <input
                  id="billing_city"
                  required
                  className={inputCls}
                  placeholder="Taguig City"
                  value={payData.city}
                  onChange={(e) => onChange({ city: e.target.value })}
                  autoComplete="address-level2"
                />
              </Field>
              <Field label="ZIP Code" id="billing_zip">
                <input
                  id="billing_zip"
                  required
                  className={inputCls}
                  placeholder="1634"
                  value={payData.zip}
                  onChange={(e) => onChange({ zip: e.target.value })}
                  autoComplete="postal-code"
                />
              </Field>
            </div>
          </Card>

          <Card title="Payment Method" icon={CreditCard}>
            <div className="flex flex-col gap-2.5 mb-5" role="group" aria-label="Select payment method">
              {methods.map(({ key, label, sublabel, icon: Icon }) => {
                const active = payData.payment_method === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChange({ payment_method: key })}
                    aria-pressed={active}
                    className={cn(
                      "rounded-xl border px-4 py-3.5 text-sm font-medium transition-all duration-200 flex items-center gap-3.5 cursor-pointer text-left",
                      active
                        ? "border-[#1e3a8a] bg-blue-50/60 shadow-[0_0_0_1px_#1e3a8a] text-[#1e3a8a]"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/80 bg-white"
                    )}
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
                        active ? "bg-[#1e3a8a] text-white shadow-sm shadow-blue-900/20" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight">{label}</p>
                      <p className={cn("text-[11px] mt-0.5", active ? "text-[#1e3a8a]/60" : "text-slate-400")}>
                        {sublabel}
                      </p>
                    </div>
                    {active && (
                      <div className="h-5 w-5 rounded-full bg-[#1e3a8a] flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-white" aria-hidden="true" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {payData.payment_method === "card" && (
              <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                <Field label="Cardholder Name" id="card_name">
                  <input
                    id="card_name"
                    className={inputCls}
                    placeholder="Name as on card"
                    value={payData.card_name}
                    onChange={(e) => onChange({ card_name: e.target.value })}
                    autoComplete="cc-name"
                  />
                </Field>
                <Field label="Card Number" id="card_number">
                  <input
                    id="card_number"
                    className={inputCls}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                    value={payData.card_number}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
                      const formatted = raw.match(/.{1,4}/g)?.join(" ") ?? raw;
                      onChange({ card_number: formatted });
                    }}
                    autoComplete="cc-number"
                    inputMode="numeric"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Expiry (MM/YY)" id="expiry">
                    <input
                      id="expiry"
                      className={inputCls}
                      placeholder="MM/YY"
                      maxLength={5}
                      value={payData.expiry}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
                        const formatted = raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw;
                        onChange({ expiry: formatted });
                      }}
                      autoComplete="cc-exp"
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="CVV" id="cvv">
                    <input
                      id="cvv"
                      className={inputCls}
                      placeholder="123"
                      type="password"
                      maxLength={4}
                      value={payData.cvv}
                      onChange={(e) => onChange({ cvv: e.target.value })}
                      autoComplete="cc-csc"
                      inputMode="numeric"
                    />
                  </Field>
                </div>
              </div>
            )}

            {payData.payment_method === "bank" && (
              <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-xl border border-blue-100 bg-blue-50/60 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-blue-100 flex items-center gap-2">
                  <Building className="h-3.5 w-3.5 text-[#1e3a8a]" aria-hidden="true" />
                  <p className="text-xs font-bold text-[#1e3a8a]">Bank Transfer Details</p>
                </div>
                <dl className="px-4 py-3.5 space-y-2 text-xs text-gray-600">
                  <div className="flex gap-2">
                    <dt className="font-semibold w-28 shrink-0 text-gray-500">Bank</dt>
                    <dd className="font-medium">BDO Unibank</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold w-28 shrink-0 text-gray-500">Account Name</dt>
                    <dd className="font-medium">Blue&apos;s Clues HRIS Inc.</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold w-28 shrink-0 text-gray-500">Account No</dt>
                    <dd className="font-mono font-bold text-[#1e3a8a]">0123-4567-8901</dd>
                  </div>
                  <p className="mt-2 text-gray-500 border-t border-blue-100 pt-2 leading-relaxed">
                    Send proof of transfer to{" "}
                    <strong className="text-[#1e3a8a]">billing@blueclues.com</strong> after payment.
                  </p>
                </dl>
              </div>
            )}

            {payData.payment_method === "gcash" && (
              <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-xl border border-blue-100 bg-blue-50/60 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-blue-100 flex items-center gap-2">
                  <Smartphone className="h-3.5 w-3.5 text-[#1e3a8a]" aria-hidden="true" />
                  <p className="text-xs font-bold text-[#1e3a8a]">GCash Payment</p>
                </div>
                <dl className="px-4 py-3.5 space-y-2 text-xs text-gray-600">
                  <div className="flex gap-2">
                    <dt className="font-semibold w-28 shrink-0 text-gray-500">GCash Number</dt>
                    <dd className="font-mono font-bold text-[#1e3a8a]">0917-123-4567</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold w-28 shrink-0 text-gray-500">Account Name</dt>
                    <dd className="font-medium">Blue&apos;s Clues HRIS</dd>
                  </div>
                  <p className="mt-2 text-gray-500 border-t border-blue-100 pt-2 leading-relaxed">
                    Send reference number to{" "}
                    <strong className="text-[#1e3a8a]">billing@blueclues.com</strong> after payment.
                  </p>
                </dl>
              </div>
            )}
          </Card>
        </div>

        {/* Right: Order summary */}
        <div className="rounded-2xl border border-blue-100/70 bg-white shadow-[0_2px_16px_rgba(30,58,138,0.06)] overflow-hidden self-start xl:sticky xl:top-24">
          <div className="bg-gradient-to-r from-[#0f172a] to-[#1e3a8a] px-5 py-4 text-white">
            <p className="text-sm font-bold">Order Summary</p>
            <p className="text-xs text-blue-200/60 mt-0.5">Professional Plan</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 p-3 bg-[#f8faff] rounded-xl border border-gray-100">
              <div className="h-10 w-10 rounded-xl bg-[#1e3a8a]/8 flex items-center justify-center text-[#1e3a8a] shrink-0">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Professional Plan</p>
                <p className="text-xs text-gray-500 mt-0.5">Unlimited employees</p>
                <span className="mt-1.5 inline-block px-2 py-0.5 bg-[#1e3a8a]/8 text-[#1e3a8a] text-[10px] font-bold rounded-full uppercase tracking-wide">
                  {billing === "annual" ? "Annual Billing" : "Monthly Billing"}
                </span>
              </div>
            </div>

            <hr className="border-gray-100" />

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <dt>{billing === "annual" ? `₱${monthlyRate.toLocaleString()} × 12 mo` : "Monthly rate"}</dt>
                <dd className="font-medium text-gray-700">₱{total.toLocaleString()}</dd>
              </div>
              {billing === "annual" && (
                <div className="flex justify-between text-green-600 font-medium text-xs">
                  <dt>Annual savings</dt>
                  <dd>−₱{((MONTHLY_PRICE - ANNUAL_PRICE) * 12).toLocaleString()}</dd>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <dt>Tax (0%)</dt>
                <dd>₱0.00</dd>
              </div>
            </dl>

            <hr className="border-gray-100" />

            <div className="bg-gradient-to-br from-[#1e3a8a]/4 to-[#1e3a8a]/8 rounded-xl p-4 border border-[#1e3a8a]/10">
              <p className="text-[10px] font-bold text-[#1e3a8a]/60 uppercase tracking-wider mb-0.5">Total Due Today</p>
              <p className="text-3xl font-black text-[#1e3a8a] tabular-nums tracking-tight">
                ₱{total.toLocaleString()}
              </p>
              <p className="text-xs text-[#1e3a8a]/50 mt-0.5">{billing === "annual" ? "/ year" : "/ month"}</p>
            </div>

            <div className="bg-[#f8faff] rounded-xl p-3 flex gap-2.5 text-xs text-gray-500 leading-relaxed border border-gray-100">
              <ShieldCheck className="h-4 w-4 text-[#1e3a8a] shrink-0 mt-0.5" aria-hidden="true" />
              Secure 256-bit SSL encrypted. Cancel anytime from your dashboard.
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] py-3.5 text-sm font-semibold text-white hover:bg-[#1e40af] transition-all duration-200 shadow-[0_2px_8px_rgba(30,58,138,0.2)] hover:shadow-[0_4px_16px_rgba(30,58,138,0.25)] hover:-translate-y-px active:translate-y-0 cursor-pointer"
            >
              Review Order
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>Secure SSL encrypted checkout</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
      </div>
    </form>
  );
}

// ─── Step 4: Review & Confirm ─────────────────────────────────────────────────

function StepConfirm({
  billing,
  company,
  payData,
  onBack,
  onSubmit,
  loading,
}: {
  billing: "monthly" | "annual";
  company: CompanyFormData;
  payData: PaymentFormData;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const [agreeTos, setAgreeTos] = useState(false);
  const [agreeComms, setAgreeComms] = useState(false);

  const total =
    billing === "annual"
      ? `₱${(ANNUAL_PRICE * 12).toLocaleString()} / year`
      : `₱${MONTHLY_PRICE.toLocaleString()} / month`;

  const payMethodLabel =
    payData.payment_method === "card"
      ? "Credit Card"
      : payData.payment_method === "bank"
      ? "Bank Transfer"
      : "GCash";

  const companyRows = [
    { label: "Company Name", value: company.company_name || "—" },
    { label: "Industry", value: company.industry || "—" },
    { label: "Address", value: company.address || "—" },
    { label: "Contact Person", value: company.contact || "—" },
    { label: "Company Email", value: company.email || "—" },
    { label: "TIN", value: company.tin || "—" },
  ];

  const billingRows = [
    { label: "Selected Plan", value: "Professional" },
    {
      label: "Billing Cycle",
      value: billing === "annual" ? "Annual — Save 20%" : "Monthly",
    },
    { label: "Payment Method", value: payMethodLabel },
    { label: "Billed To", value: payData.full_name || "—" },
  ];

  return (
    <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-3 duration-400">
      <div>
        <div className="inline-flex items-center gap-1.5 bg-[#1e3a8a]/8 text-[#1e3a8a] text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full mb-3">
          <BadgeCheck className="h-3 w-3" aria-hidden="true" />
          Step 4 — Review & Confirm
        </div>
        <h2 className="text-[28px] font-extrabold text-gray-900 tracking-tight leading-tight">
          Almost there
        </h2>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          Verify your order details before completing the subscription.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.04)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-[#0f172a] to-[#172554] px-5 py-4 text-white">
          <p className="text-sm font-bold">Order Summary</p>
          <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide">
            {billing === "annual" ? "Annual Plan" : "Monthly Plan"}
          </span>
        </div>

        {/* Company section */}
        <div className="px-5 pt-5 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-3 flex items-center gap-1.5">
            <Building2 className="h-3 w-3" aria-hidden="true" />
            Company Information
          </p>
          <dl className="grid md:grid-cols-2 gap-x-4 gap-y-0">
            {companyRows.map(({ label, value }) => (
              <div key={label} className="py-2.5 border-b border-gray-50 last:border-0">
                <dt className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">{label}</dt>
                <dd className="font-semibold text-gray-800 text-sm mt-0.5 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mx-5 border-t border-gray-100" />

        {/* Billing section */}
        <div className="px-5 pt-4 pb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-3 flex items-center gap-1.5">
            <CreditCard className="h-3 w-3" aria-hidden="true" />
            Billing Information
          </p>
          <dl className="grid md:grid-cols-2 gap-x-4 gap-y-0">
            {billingRows.map(({ label, value }) => (
              <div key={label} className="py-2.5 border-b border-gray-50 last:border-0">
                <dt className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">{label}</dt>
                <dd className="font-semibold text-gray-800 text-sm mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Total */}
          <div className="mt-4 rounded-xl bg-gradient-to-br from-[#1e3a8a]/6 to-[#1e3a8a]/10 border border-[#1e3a8a]/10 p-4 flex justify-between items-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#1e3a8a]/60 font-bold">
                Total Amount Due
              </p>
              <p className="mt-0.5 text-2xl font-extrabold text-[#1e3a8a] tabular-nums">{total}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-[#1e3a8a]/8 flex items-center justify-center">
              <Lock className="h-5 w-5 text-[#1e3a8a]/40" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Agreements */}
        <div className="space-y-3 border-t border-gray-100 bg-[#f8faff] px-5 py-4">
          <label className="flex items-start gap-3 text-sm text-gray-600 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreeTos}
              onChange={(e) => setAgreeTos(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1e3a8a] cursor-pointer"
              required
            />
            <span className="leading-relaxed">
              I agree to the{" "}
              <span className="text-[#1e3a8a] font-medium underline underline-offset-2 cursor-pointer hover:text-[#1e40af]">
                Terms of Service
              </span>{" "}
              and{" "}
              <span className="text-[#1e3a8a] font-medium underline underline-offset-2 cursor-pointer hover:text-[#1e40af]">
                Privacy Policy
              </span>
              .
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeComms}
              onChange={(e) => setAgreeComms(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1e3a8a] cursor-pointer"
            />
            <span className="leading-relaxed">
              I&apos;d like to receive product updates and HR resources via email.
            </span>
          </label>
        </div>
      </div>

      <NavButtons
        onBack={onBack}
        onNext={onSubmit}
        nextLabel="Confirm & Pay"
        nextIcon={Lock}
        loading={loading}
        disabled={!agreeTos}
      />
    </div>
  );
}

// ─── Success ──────────────────────────────────────────────────────────────────

function SuccessBlock({
  transactionId,
  companyEmail,
}: {
  transactionId: string;
  companyEmail: string;
}) {
  const [copied, setCopied] = useState(false);

  function copyId() {
    navigator.clipboard.writeText(transactionId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div role="status" aria-live="polite">
      <style>{`
        @keyframes success-pop {
          0%   { transform: scale(0.4) rotate(-8deg); opacity: 0; }
          65%  { transform: scale(1.12) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .success-icon-anim { animation: success-pop 0.55s cubic-bezier(0.16,1,0.3,1) forwards; }
        .stagger-1 { opacity: 0; animation: fade-up 0.4s ease forwards 0.15s; }
        .stagger-2 { opacity: 0; animation: fade-up 0.4s ease forwards 0.3s; }
        .stagger-3 { opacity: 0; animation: fade-up 0.4s ease forwards 0.45s; }
        .stagger-4 { opacity: 0; animation: fade-up 0.4s ease forwards 0.6s; }
        .stagger-5 { opacity: 0; animation: fade-up 0.4s ease forwards 0.75s; }
      `}</style>

      {/* Success header */}
      <div className="rounded-2xl bg-[linear-gradient(135deg,#0a0f1e_0%,#0f172a_40%,#172554_80%,#1e3a5c_100%)] px-6 py-8 text-white mb-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-white/3 blur-2xl pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 h-20 w-60 bg-green-500/10 blur-3xl pointer-events-none" aria-hidden="true" />

        <div className="relative flex items-start gap-5">
          <div className="success-icon-anim shrink-0">
            <div className="h-14 w-14 rounded-2xl bg-green-500/15 border border-green-400/25 flex items-center justify-center shadow-lg shadow-green-500/10">
              <CheckCircle2 className="h-7 w-7 text-green-400" aria-hidden="true" />
            </div>
          </div>
          <div className="stagger-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200/50 mb-1">
              Subscription Confirmed
            </p>
            <h2 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
              You&apos;re all set.
            </h2>
            <p className="text-sm text-white/55 mt-2 leading-relaxed max-w-sm">
              Admin credentials for{" "}
              <strong className="text-white/80">{companyEmail || "your company email"}</strong>{" "}
              will arrive within 24 hours.
            </p>
          </div>
        </div>
      </div>

      {/* Transaction receipt */}
      <div className="stagger-2 rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.04)] overflow-hidden mb-4">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#1e3a8a]/8 flex items-center justify-center">
              <ClipboardCheck className="h-3.5 w-3.5 text-[#1e3a8a]" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Transaction Receipt</p>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100 uppercase tracking-wide flex items-center gap-1">
            <Check className="h-2.5 w-2.5" aria-hidden="true" />
            Confirmed
          </span>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Transaction ID</p>
            <p className="text-sm font-bold text-[#1e3a8a] mt-0.5 font-mono">{transactionId || "HRIS-PENDING"}</p>
          </div>
          <button
            type="button"
            onClick={copyId}
            aria-label="Copy transaction ID"
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer",
              copied
                ? "bg-blue-50 text-[#1e3a8a] border-blue-200"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
            )}
          >
            {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* What happens next */}
      <div className="stagger-3 rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.04)] overflow-hidden mb-6">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center gap-2.5 bg-slate-50/50">
          <div className="h-7 w-7 rounded-lg bg-[#1e3a8a]/8 flex items-center justify-center">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#1e3a8a]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-slate-800">What happens next</p>
        </div>
        <div className="divide-y divide-slate-50/80 p-2">
          {[
            {
              step: "1",
              label: "Registration confirmed",
              detail: "Your company details have been recorded.",
              done: true,
              delay: "stagger-4",
            },
            {
              step: "2",
              label: "Workspace provisioned",
              detail: "Your HRIS environment is being set up now.",
              done: true,
              delay: "stagger-4",
            },
            {
              step: "3",
              label: "Credentials emailed",
              detail: `Admin login sent to ${companyEmail || "your email"} within 24 hours.`,
              done: false,
              delay: "stagger-5",
            },
            {
              step: "4",
              label: "Start managing HR",
              detail: "Log in and add your team to get started.",
              done: false,
              delay: "stagger-5",
            },
          ].map(({ step, label, detail, done: isDone }) => (
            <div key={step} className="flex items-start gap-4 p-3.5 rounded-xl">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 transition-all",
                  isDone
                    ? "bg-green-100 text-green-600 ring-2 ring-green-100 ring-offset-1"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : step}
              </div>
              <div>
                <p className={cn("text-sm font-semibold", isDone ? "text-slate-800" : "text-slate-500")}>
                  {label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="stagger-5 flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1e40af] active:scale-[0.98] transition-all duration-200 shadow-[0_4px_14px_rgba(30,58,138,0.2)] hover:shadow-[0_6px_20px_rgba(30,58,138,0.25)] hover:-translate-y-px cursor-pointer"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to Home
        </Link>
        <a
          href="mailto:support@blueclues.com"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
        >
          <LifeBuoy className="h-4 w-4" aria-hidden="true" />
          Contact Support
        </a>
      </div>
    </div>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5 text-sm text-red-700 flex items-center gap-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
    >
      <div className="h-6 w-6 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
        <X className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
      </div>
      <span className="flex-1 font-medium">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="text-red-400 hover:text-red-600 transition-colors duration-200 cursor-pointer ml-1"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubscribePage() {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyErrors, setCompanyErrors] = useState<CompanyFieldErrors>({});

  const [company, setCompany] = useState<CompanyFormData>({
    company_name: "",
    address: "",
    contact: "",
    email: "",
    industry: "",
    nature_of_business: "",
    tin: "",
  });

  const [payData, setPayData] = useState<PaymentFormData>({
    full_name: "",
    street: "",
    city: "",
    zip: "",
    card_name: "",
    card_number: "",
    expiry: "",
    cvv: "",
    payment_method: "card",
  });

  function updateCompany(d: Partial<CompanyFormData>) {
    setCompany((prev) => ({ ...prev, ...d }));
    const keys = Object.keys(d) as CompanyField[];
    if (keys.length > 0) {
      setCompanyErrors((prev) => {
        const next = { ...prev };
        for (const key of keys) {
          if (d[key] !== undefined) delete next[key];
        }
        return next;
      });
    }
  }

  function updatePay(d: Partial<PaymentFormData>) {
    setPayData((prev) => ({ ...prev, ...d }));
  }

  function validateCompany(data: CompanyFormData): CompanyFieldErrors {
    const errors: CompanyFieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!data.company_name.trim()) errors.company_name = "Company name is required.";
    if (!data.address.trim()) errors.address = "Company address is required.";
    if (!data.contact.trim()) errors.contact = "Contact person is required.";
    if (!data.email.trim()) {
      errors.email = "Company email is required.";
    } else if (!emailRegex.test(data.email.trim())) {
      errors.email = "Enter a valid email address (example: admin@company.com).";
    }
    if (!data.industry.trim()) errors.industry = "Please select an industry.";
    if (!data.nature_of_business.trim()) errors.nature_of_business = "Nature of business is required.";
    if (!data.tin.trim()) errors.tin = "TIN is required.";

    return errors;
  }

  function mapBackendCompanyErrors(raw: unknown): CompanyFieldErrors {
    const items = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
    const next: CompanyFieldErrors = {};
    const fieldMap: Record<CompanyField, string> = {
      company_name: "Company name is required.",
      address: "Company address is required.",
      contact: "Contact person is required.",
      email: "Company email is required.",
      industry: "Please select an industry.",
      nature_of_business: "Nature of business is required.",
      tin: "TIN is required.",
    };

    for (const item of items) {
      const message = String(item).toLowerCase();
      for (const key of Object.keys(fieldMap) as CompanyField[]) {
        if (message.includes(key)) {
          if (key === "email" && message.includes("must be an email")) {
            next.email = "Enter a valid email address (example: admin@company.com).";
          } else {
            next[key] = fieldMap[key];
          }
        }
      }
    }
    return next;
  }

  async function handleCompanyNext() {
    const clientErrors = validateCompany(company);
    if (Object.keys(clientErrors).length > 0) {
      setCompanyErrors(clientErrors);
      setError("Please fix the highlighted fields before continuing.");
      return;
    }

    setLoading(true);
    setError(null);
    setCompanyErrors({});
    try {
      const res = await fetch(`${API_BASE}/subscription/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: company.company_name,
          address: company.address,
          contact: company.contact,
          email: company.email,
          industry: company.industry,
          nature_of_business: company.nature_of_business,
          tin: company.tin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fieldErrors = mapBackendCompanyErrors((data as { message?: unknown }).message);
        if (Object.keys(fieldErrors).length > 0) {
          setCompanyErrors(fieldErrors);
          setError("Some details need your attention. Please review the highlighted fields.");
          return;
        }
        throw new Error(
          (data as { message?: string }).message ?? "Registration failed. Please try again."
        );
      }
      const regId = (data as { registration_id?: string }).registration_id ?? null;
      setRegistrationId(regId);

      if (!regId) throw new Error("No registration ID returned. Please try again.");

      // Select plan
      const planRes = await fetch(`${API_BASE}/subscription/select-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: regId,
          subscription_plan: billing === "annual" ? "annual" : "monthly",
          billing_cycle: billing,
        }),
      });
      if (!planRes.ok) {
        const d = await planRes.json().catch(() => ({}));
        throw new Error((d as { message?: string }).message ?? "Plan selection failed.");
      }

      // Create PayMongo checkout session
      const checkoutRes = await fetch(`${API_BASE}/subscription/payment/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: regId }),
      });
      const checkoutData = await checkoutRes.json().catch(() => ({}));
      if (!checkoutRes.ok) {
        throw new Error(
          (checkoutData as { message?: string }).message ?? "Failed to create checkout session."
        );
      }

      const checkoutUrl = (checkoutData as { checkout_url?: string }).checkout_url;
      if (!checkoutUrl) throw new Error("No checkout URL returned.");

      setStep(3);
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#f8faff]">
      <BackgroundBlobs />
      <Header />

      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 pt-24 pb-16 md:px-8 xl:px-12 lg:flex-row lg:items-start">
        {!done && <SidebarWizard currentStep={step} />}

        <section
          className="min-w-0 flex-1 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_6px_rgba(15,23,42,0.06)] md:p-8 xl:p-10"
          aria-label="Subscription setup"
        >
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          {done ? (
            <SuccessBlock transactionId={transactionId} companyEmail={company.email} />
          ) : (
            <>
              <TopStepper currentStep={step} />

              {step === 1 && (
                <StepPlan
                  billing={billing}
                  setBilling={setBilling}
                  onNext={() => setStep(2)}
                />
              )}
              {step === 2 && (
                <StepCompany
                  data={company}
                  errors={companyErrors}
                  onChange={updateCompany}
                  onBack={() => setStep(1)}
                  onNext={handleCompanyNext}
                  loading={loading}
                />
              )}
              {step === 3 && (
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <svg className="h-7 w-7 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-800">Redirecting to secure payment…</h2>
                  <p className="text-sm text-slate-500">You will be redirected to PayMongo to complete your payment.</p>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="relative z-10 border-t border-gray-100 bg-white/60 backdrop-blur-sm py-5">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 xl:px-12 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          <span>© 2026 Blue&apos;s Clues HRIS</span>
          <nav aria-label="Footer links">
            <ul className="flex gap-6">
              {["Privacy Policy", "Terms of Service", "Support"].map((item) => (
                <li key={item}>
                  <span className="hover:text-[#1e3a8a] cursor-pointer transition-colors duration-200">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
