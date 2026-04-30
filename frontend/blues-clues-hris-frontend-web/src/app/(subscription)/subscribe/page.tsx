"use client";

import { useState, type ReactNode } from "react";
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
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHLY_PRICE = 4999;
const ANNUAL_PRICE = 3999;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const WEBHOOK_SECRET = process.env.NEXT_PUBLIC_SUBSCRIPTION_WEBHOOK_SECRET ?? "";

const PLAN_FEATURES = [
  "Unlimited employees",
  "Advanced analytics and reports",
  "Timekeeping and attendance",
  "Contract renewal tracking",
  "Role-based access control",
  "All HR modules included",
  "SFIA skills assessment",
  "Public careers portal",
  "Approvals and notifications",
  "Priority support",
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

// ─── Background Blobs ─────────────────────────────────────────────────────────

function BackgroundBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(1400px_700px_at_10%_-10%,rgba(30,58,138,0.18),transparent_55%),radial-gradient(900px_550px_at_90%_10%,rgba(59,95,207,0.16),transparent_60%),radial-gradient(700px_450px_at_50%_95%,rgba(30,58,138,0.10),transparent_65%),linear-gradient(180deg,#f8faff_0%,#ffffff_100%)]" />
      <div className="absolute -top-28 -left-20 h-[30rem] w-[30rem] rounded-full bg-[#1e3a8a]/20 blur-[120px]" />
      <div className="absolute top-8 right-[-6rem] h-[34rem] w-[34rem] rounded-full bg-blue-400/20 blur-[130px]" />
      <div className="absolute bottom-[-7rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-[#1e3a8a]/15 blur-[120px]" />
      <div className="absolute inset-0 opacity-[0.045] [background:radial-gradient(circle_at_1px_1px,rgba(30,58,138,0.6)_1px,transparent_0)] [background-size:3px_3px]" />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-100/80 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 xl:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2.5 group" aria-label="Blue's Clues HRIS Home">
            <div className="w-8 h-8 bg-[#1e3a8a] rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#1e40af] transition-colors duration-200">
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

        <div className="flex items-center gap-4">
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
      <ol className="grid grid-cols-4 items-start relative w-full max-w-none mx-auto">
        {/* Progress track */}
        <div className="absolute top-5.5 left-[6%] right-[6%] h-0.5 bg-gray-200" aria-hidden="true" />
        <div
          className="absolute top-5.5 left-[6%] h-0.5 bg-[#1e3a8a] transition-[width] duration-700 ease-in-out"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 88}%` }}
          aria-hidden="true"
        />
        {STEPS.map((step) => {
          const done = currentStep > step.id;
          const active = currentStep === step.id;
          const Icon = step.icon;
          return (
            <li key={step.id} className="flex flex-col items-center gap-2.5 relative z-10 w-full">
              <div
                aria-current={active ? "step" : undefined}
                className={cn(
                  "w-11 h-11 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center transition-all duration-500 shadow-sm",
                  done
                    ? "bg-[#1e3a8a] border-[#1e3a8a] text-white shadow-sm shadow-blue-900/20"
                    : active
                    ? "bg-[#1e3a8a] border-[#1e3a8a] text-white scale-105 shadow-md shadow-blue-900/20"
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
                  "text-[11px] font-bold uppercase tracking-[0.16em] transition-colors duration-300 text-center",
                  active ? "text-[#1e3a8a]" : done ? "text-[#1e3a8a]/60" : "text-gray-400"
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

function SidebarWizard({ currentStep }: { currentStep: number }) {
  return (
    <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24 lg:self-start space-y-4">
      <div className="rounded-2xl border border-blue-100/60 bg-gradient-to-br from-white/95 to-blue-50/20 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#1e3a8a] to-[#3b5fcf]" aria-hidden="true" />
        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-1">Setup Progress</p>
          <p className="text-xs text-gray-500 mb-3">
            {Math.round(((currentStep - 1) / STEPS.length) * 100)}% complete
          </p>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={currentStep - 1} aria-valuemin={0} aria-valuemax={STEPS.length}>
            <div
              className="h-full rounded-full bg-[#1e3a8a] transition-[width] duration-700"
              style={{ width: `${((currentStep - 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <ul className="mt-4 space-y-1.5">
            {STEPS.map((step) => {
              const done = currentStep > step.id;
              const active = currentStep === step.id;
              const Icon = step.icon;
              return (
                <li key={step.id}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all duration-200",
                      active
                        ? "bg-blue-50 border-blue-100"
                        : done
                        ? "bg-green-50 border-green-100"
                        : "bg-white border-gray-100"
                    )}
                    aria-current={active ? "step" : undefined}
                  >
                    <div
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                        active
                          ? "bg-[#1e3a8a] text-white"
                          : done
                          ? "bg-green-600 text-white"
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
                          "text-[10px] font-bold uppercase tracking-wider",
                          active ? "text-[#1e3a8a]/60" : done ? "text-green-600/70" : "text-gray-400"
                        )}
                      >
                        Step {step.id}
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
                      <ChevronRight className="h-3.5 w-3.5 text-green-600 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-[#f8faff] p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <LifeBuoy className="h-4 w-4 text-[#1e3a8a]" aria-hidden="true" />
          <p className="text-xs font-bold text-gray-700">Need Help?</p>
        </div>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          Our team is ready to guide you through setup.
        </p>
        <button
          type="button"
          className="w-full rounded-xl bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1e40af] transition-colors duration-200 cursor-pointer"
        >
          Contact Support
        </button>
      </div>

    </aside>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-blue-100/60 bg-gradient-to-br from-white/95 to-blue-50/20 backdrop-blur-sm shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-[#1e3a8a] to-[#3b5fcf]" aria-hidden="true" />
      <div className="p-5 md:p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-8 w-8 rounded-lg bg-[#1e3a8a]/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-[#1e3a8a]" aria-hidden="true" />
          </div>
          <p className="text-sm font-bold text-gray-900">{title}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Form Helpers ─────────────────────────────────────────────────────────────

const inputCls =
  "h-10 w-full rounded-xl border border-gray-200 bg-[#f8faff] px-3 text-sm text-gray-900 outline-none focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10 transition-all duration-200 placeholder:text-gray-400 cursor-text";

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
          <p className="text-sm text-gray-700 truncate">{value.name}</p>
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
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-[#f8faff] p-6 text-center hover:border-[#1e3a8a]/40 hover:bg-blue-50/50 transition-all duration-200 group focus-within:ring-2 focus-within:ring-[#1e3a8a]/20"
        >
          <Upload className="h-5 w-5 text-gray-300 group-hover:text-[#1e3a8a] transition-colors duration-200" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-gray-600">Click to upload</p>
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
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
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
        className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-blue-900/15 cursor-pointer"
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

  return (
    <div className="space-y-7 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-1.5">
          Step 1 — Plan Selection
        </p>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Choose your plan</h2>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          One plan. Everything included. No hidden fees, no feature gating.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center">
        <div
          className="flex bg-gray-100 rounded-full p-1 gap-1 shadow-inner"
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
                "px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 cursor-pointer",
                billing === b
                  ? "bg-[#1e3a8a] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {b === "monthly" ? "Monthly" : "Annual"}
              {b === "annual" && (
                <span
                  className={cn(
                    "ml-2 text-xs px-1.5 py-0.5 rounded-full font-bold",
                    billing === "annual"
                      ? "bg-white/20 text-white"
                      : "bg-green-100 text-green-700"
                  )}
                >
                  Save 20%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan card */}
      <div className="relative pt-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-[#1e3a8a] text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap shadow-lg">
            All-inclusive Plan
          </span>
        </div>
        <div className="relative rounded-2xl border-2 border-[#1e3a8a] bg-gradient-to-br from-blue-50/60 to-white p-8 shadow-xl shadow-blue-900/8 overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1e3a8a] to-[#3b5fcf]"
            aria-hidden="true"
          />

          <div className="grid gap-8 lg:grid-cols-2 lg:items-start mt-3">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Professional</h3>
            <p className="text-sm text-gray-500 mt-1">For growing HR teams — Philippine companies.</p>

            <div className="flex items-end gap-1 mt-5" aria-label={`Price: ₱${price.toLocaleString()} per month`}>
              <span className="text-[11px] font-bold text-gray-400 self-start mt-2.5" aria-hidden="true">₱</span>
              <span className="text-5xl font-extrabold text-[#1e3a8a] tabular-nums">{price.toLocaleString()}</span>
              <span className="text-gray-400 text-sm pb-1.5">/mo</span>
            </div>

            {billing === "annual" && (
              <p className="text-xs text-gray-400 mt-1.5">
                Billed ₱{(ANNUAL_PRICE * 12).toLocaleString()} per year ·{" "}
                <span className="text-green-600 font-semibold">
                  Save ₱{((MONTHLY_PRICE - ANNUAL_PRICE) * 12).toLocaleString()}
                </span>
              </p>
            )}

            <button
              type="button"
              onClick={onNext}
              className="mt-6 flex items-center gap-2 bg-[#1e3a8a] text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-[#1e40af] transition-all duration-200 text-sm shadow-md hover:shadow-lg hover:shadow-blue-900/20 cursor-pointer group"
            >
              Continue with Professional
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" aria-hidden="true" />
            </button>

            <div className="mt-4 flex flex-wrap gap-4">
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Shield className="w-3 h-3 flex-shrink-0 text-[#1e3a8a]" aria-hidden="true" />
                Credentials within 24 hours
              </p>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Lock className="w-3 h-3 flex-shrink-0 text-[#1e3a8a]" aria-hidden="true" />
                No credit card required upfront
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-3">
              What&apos;s included
            </p>
            <ul className="space-y-2">
              {PLAN_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-gray-700">
                  <div
                    className="w-4 h-4 rounded-full bg-[#1e3a8a]/10 flex items-center justify-center flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    <Check className="w-2.5 h-2.5 text-[#1e3a8a]" />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
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
    <form onSubmit={handleSubmit} noValidate className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-1.5">
          Step 2 — Company Setup
        </p>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Tell us about your company</h2>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          Provide legal business information and required documents to proceed.
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
              onChange={(e) => onChange({ tin: e.target.value })}
            />
            {errors.tin && <p className="mt-1 text-xs text-red-600">{errors.tin}</p>}
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
                "w-full rounded-xl border border-gray-200 bg-[#f8faff] p-3 text-sm text-gray-900 outline-none focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10 transition-all duration-200 placeholder:text-gray-400 cursor-text resize-none",
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

      <Card title="Business Documents" icon={FileText}>
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
        <p className="mt-3 text-xs text-gray-400">
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

  const methods: { key: "card" | "bank" | "gcash"; label: string; icon: LucideIcon }[] = [
    { key: "card", label: "Credit Card", icon: CreditCard },
    { key: "bank", label: "Bank Transfer", icon: Building },
    { key: "gcash", label: "GCash", icon: Smartphone },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
      noValidate
      className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-1.5">
          Step 3 — Billing & Payment
        </p>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Secure checkout</h2>
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
            <div
              className="grid grid-cols-3 gap-2 mb-5"
              role="group"
              aria-label="Select payment method"
            >
              {methods.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ payment_method: key })}
                  aria-pressed={payData.payment_method === key}
                  className={cn(
                    "rounded-xl border px-2 py-3 text-xs font-semibold transition-all duration-200 flex flex-col items-center gap-1.5 cursor-pointer",
                    payData.payment_method === key
                      ? "border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]"
                      : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {label}
                </button>
              ))}
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
                    onChange={(e) => onChange({ card_number: e.target.value })}
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
                      onChange={(e) => onChange({ expiry: e.target.value })}
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
              <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-xs font-bold text-[#1e3a8a] mb-2.5">Bank Transfer Details</p>
                <dl className="space-y-1.5 text-xs text-gray-600">
                  <div className="flex gap-2"><dt className="font-semibold w-28 shrink-0">Bank:</dt><dd>BDO Unibank</dd></div>
                  <div className="flex gap-2"><dt className="font-semibold w-28 shrink-0">Account Name:</dt><dd>Blue&apos;s Clues HRIS Inc.</dd></div>
                  <div className="flex gap-2"><dt className="font-semibold w-28 shrink-0">Account No:</dt><dd>0123-4567-8901</dd></div>
                  <p className="mt-2 text-gray-500 border-t border-blue-100 pt-2">
                    Send proof of transfer to <strong>billing@blueclues.com</strong> after payment.
                  </p>
                </dl>
              </div>
            )}

            {payData.payment_method === "gcash" && (
              <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-xs font-bold text-[#1e3a8a] mb-2.5">GCash Payment</p>
                <dl className="space-y-1.5 text-xs text-gray-600">
                  <div className="flex gap-2"><dt className="font-semibold w-28 shrink-0">GCash Number:</dt><dd>0917-123-4567</dd></div>
                  <div className="flex gap-2"><dt className="font-semibold w-28 shrink-0">Account Name:</dt><dd>Blue&apos;s Clues HRIS</dd></div>
                  <p className="mt-2 text-gray-500 border-t border-blue-100 pt-2">
                    Send reference number to <strong>billing@blueclues.com</strong> after payment.
                  </p>
                </dl>
              </div>
            )}
          </Card>
        </div>

        {/* Right: Order summary */}
        <div className="rounded-2xl border border-blue-100/60 bg-gradient-to-br from-white/95 to-blue-50/20 backdrop-blur-sm shadow-sm overflow-hidden self-start xl:sticky xl:top-24">
          <div className="bg-gradient-to-r from-[#0f172a] to-[#1e3a8a] p-5 text-white">
            <p className="text-sm font-bold">Order Summary</p>
            <p className="text-xs text-blue-200 mt-0.5">HRIS Professional Plan</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#1e3a8a] shrink-0">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Professional Plan</p>
                <p className="text-xs text-gray-500 mt-0.5">Unlimited employees</p>
                <span className="mt-1.5 inline-block px-2 py-0.5 bg-blue-50 text-[#1e3a8a] text-[10px] font-bold rounded uppercase">
                  {billing === "annual" ? "Annual Billing" : "Monthly Billing"}
                </span>
              </div>
            </div>

            <hr className="border-gray-100" />

            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <dt>{billing === "annual" ? `₱${monthlyRate.toLocaleString()} × 12 mo` : "Monthly rate"}</dt>
                <dd>₱{total.toLocaleString()}</dd>
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

            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Due</p>
              <p className="text-2xl font-extrabold text-[#1e3a8a] tabular-nums">₱{total.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{billing === "annual" ? "/ year" : "/ month"}</p>
            </div>

            <div className="bg-[#f8faff] rounded-xl p-3 flex gap-2.5 text-xs text-gray-500 leading-relaxed border border-gray-100">
              <ShieldCheck className="h-4 w-4 text-[#1e3a8a] shrink-0 mt-0.5" aria-hidden="true" />
              Secure 256-bit SSL encrypted. Cancel anytime from your dashboard.
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] py-3 text-sm font-semibold text-white hover:bg-[#1e40af] transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-blue-900/15 cursor-pointer"
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
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
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

  const summaryRows = [
    { label: "Selected Plan", value: "Professional" },
    {
      label: "Billing Cycle",
      value: billing === "annual" ? "Annual Billing — Save 20%" : "Monthly Billing",
    },
    { label: "Company Name", value: company.company_name || "—" },
    { label: "Industry", value: company.industry || "—" },
    { label: "Address", value: company.address || "—" },
    { label: "Contact Person", value: company.contact || "—" },
    { label: "Company Email", value: company.email || "—" },
    { label: "TIN", value: company.tin || "—" },
    { label: "Payment Method", value: payMethodLabel },
    { label: "Billed To", value: payData.full_name || "—" },
  ];

  return (
    <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-1.5">
          Step 4 — Review & Confirm
        </p>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Almost there</h2>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          Verify your order details before completing the subscription.
        </p>
      </div>

      <div className="rounded-2xl border border-blue-100/60 bg-gradient-to-br from-white/95 to-blue-50/20 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="flex items-center justify-between bg-gradient-to-r from-[#0f172a] to-[#172554] px-5 py-4 text-white">
          <p className="text-sm font-semibold">Order Summary</p>
          <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide">
            {billing === "annual" ? "Annual Plan" : "Monthly Plan"}
          </span>
        </div>

        <dl className="grid md:grid-cols-2 gap-0 p-5 md:p-6">
          {summaryRows.map(({ label, value }) => (
            <div key={label} className="py-3 border-b border-gray-50 last:border-0 pr-4">
              <dt className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">{label}</dt>
              <dd className="font-semibold text-gray-800 text-sm mt-0.5">{value}</dd>
            </div>
          ))}
          <div className="md:col-span-2 mt-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#1e3a8a]/70 font-bold">
                  Total Amount
                </p>
                <p className="mt-0.5 text-2xl font-extrabold text-[#1e3a8a] tabular-nums">{total}</p>
              </div>
              <Lock className="h-8 w-8 text-[#1e3a8a]/20" aria-hidden="true" />
            </div>
          </div>
        </dl>

        <div className="space-y-3 border-t border-gray-100 bg-[#f8faff] px-5 py-4">
          <label className="flex items-start gap-3 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTos}
              onChange={(e) => setAgreeTos(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1e3a8a] cursor-pointer"
              required
            />
            <span>
              I agree to the{" "}
              <span className="text-[#1e3a8a] font-medium underline underline-offset-2 cursor-pointer">
                Terms of Service
              </span>{" "}
              and{" "}
              <span className="text-[#1e3a8a] font-medium underline underline-offset-2 cursor-pointer">
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
            I&apos;d like to receive product updates and HR resources via email.
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
    <div className="text-center py-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300" role="status" aria-live="polite">
      <div className="mx-auto mb-8">
        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg">
            <CheckCircle2 size={36} aria-hidden="true" />
          </div>
        </div>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-2">
        Subscription Confirmed
      </p>
      <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">You&apos;re all set!</h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
        Your request is processing. Admin credentials will be delivered to{" "}
        <strong className="text-gray-700">{companyEmail || "your company email"}</strong> within 24
        hours.
      </p>

      <div className="mt-8 max-w-md mx-auto bg-gradient-to-br from-white/95 to-blue-50/30 backdrop-blur-sm rounded-2xl border border-blue-100/60 shadow-xl p-6 text-left">
        <div className="flex items-center justify-between border-b border-gray-50 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-[#1e3a8a]">
              <ClipboardCheck size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                Transaction ID
              </p>
              <p className="text-sm font-bold text-[#1e3a8a] flex items-center gap-1.5 mt-0.5">
                {transactionId || "HRIS-PENDING"}
                <button
                  type="button"
                  onClick={copyId}
                  aria-label="Copy transaction ID"
                  className="text-gray-300 hover:text-[#1e3a8a] transition-colors duration-200 cursor-pointer"
                >
                  <Copy size={13} aria-hidden="true" />
                </button>
              </p>
            </div>
          </div>
          <span
            className={cn(
              "px-3 py-1 text-[10px] font-bold rounded-full border transition-colors duration-200",
              copied
                ? "bg-blue-50 text-[#1e3a8a] border-blue-100"
                : "bg-green-50 text-green-600 border-green-100"
            )}
          >
            {copied ? "COPIED!" : "ACTIVE"}
          </span>
        </div>

        <div className="rounded-xl bg-[#1e3a8a]/5 border border-[#1e3a8a]/10 p-3.5 flex gap-3 text-xs text-[#1e3a8a] leading-relaxed">
          <Info size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            Your workspace is being provisioned. Access credentials will be sent to{" "}
            <strong>{companyEmail || "your email"}</strong> within 24 hours.
          </p>
        </div>
      </div>

      {/* Status chips */}
      <div className="mt-6 grid grid-cols-3 gap-3 max-w-xs mx-auto" aria-hidden="true">
        {[
          { label: "Setup started", cls: "text-[#1e3a8a] bg-blue-50 border-blue-100" },
          { label: "Email sent", cls: "text-green-700 bg-green-50 border-green-100" },
          { label: "Access ready", cls: "text-gray-600 bg-gray-50 border-gray-100" },
        ].map(({ label, cls }) => (
          <div
            key={label}
            className={cn("rounded-xl border px-2 py-2.5 text-xs font-semibold text-center", cls)}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-7 py-3 text-sm font-semibold text-white hover:bg-[#1e40af] transition-colors duration-200 shadow-md hover:shadow-lg hover:shadow-blue-900/15 cursor-pointer"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to Home
        </Link>
        <p className="text-xs text-gray-400">
          Need help?{" "}
          <span className="text-[#1e3a8a] font-medium underline underline-offset-2 cursor-pointer">
            Contact our support team
          </span>
        </p>
      </div>
    </div>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
    >
      <X className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="text-red-400 hover:text-red-600 transition-colors duration-200 cursor-pointer"
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
      setRegistrationId((data as { registration_id?: string }).registration_id ?? null);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmSubmit() {
    if (!registrationId) {
      setError("Missing registration. Please restart the process.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const total = billing === "annual" ? ANNUAL_PRICE * 12 : MONTHLY_PRICE;
      const txnId = `HRIS-${Date.now().toString(36).toUpperCase()}`;

      const planRes = await fetch(`${API_BASE}/subscription/select-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: registrationId,
          subscription_plan: "professional",
          billing_cycle: billing,
        }),
      });
      if (!planRes.ok) {
        const d = await planRes.json().catch(() => ({}));
        throw new Error(
          (d as { message?: string }).message ?? "Plan selection failed. Please try again."
        );
      }

      const payRes = await fetch(`${API_BASE}/subscription/payment/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          registration_id: registrationId,
          transaction_id: txnId,
          amount: total,
          payment_method: payData.payment_method,
          payment_date: new Date().toISOString(),
        }),
      });
      if (!payRes.ok) {
        const d = await payRes.json().catch(() => ({}));
        throw new Error(
          (d as { message?: string }).message ?? "Payment confirmation failed. Please contact support."
        );
      }

      setTransactionId(txnId);
      setDone(true);
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
          className="min-w-0 flex-1 rounded-2xl border border-blue-100/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94)_0%,rgba(248,250,255,0.92)_45%,rgba(239,246,255,0.86)_100%)] backdrop-blur-md p-6 shadow-[0_10px_30px_rgba(30,58,138,0.10),inset_0_1px_0_rgba(255,255,255,0.85)] md:p-8 xl:p-10"
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
                <StepPayment
                  billing={billing}
                  payData={payData}
                  onChange={updatePay}
                  onBack={() => setStep(2)}
                  onNext={() => setStep(4)}
                />
              )}
              {step === 4 && (
                <StepConfirm
                  billing={billing}
                  company={company}
                  payData={payData}
                  onBack={() => setStep(3)}
                  onSubmit={handleConfirmSubmit}
                  loading={loading}
                />
              )}
            </>
          )}
        </section>
      </main>

      <footer className="relative z-10 border-t border-gray-100 bg-white/60 backdrop-blur-sm py-5">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 xl:px-12 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          <span>© 2025 Blue&apos;s Clues HRIS</span>
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
