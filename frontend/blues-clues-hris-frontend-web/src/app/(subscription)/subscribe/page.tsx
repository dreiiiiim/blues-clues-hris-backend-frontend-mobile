"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Check,
  ChevronLeft,
  CreditCard,
  Home,
  LifeBuoy,
  Lock,
  Shield,
  Star,
  Upload,
  X,
} from "lucide-react";

const MONTHLY_PRICE = 4999;
const ANNUAL_PRICE = 3999;

const STEPS = [
  { id: 1, label: "Account Setup", icon: Building2 },
  { id: 2, label: "Plan Selection", icon: Briefcase },
  { id: 3, label: "Billing Info", icon: CreditCard },
  { id: 4, label: "Confirmation", icon: BadgeCheck },
] as const;

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

function Sidebar({
  currentStep,
  onStepChange,
}: {
  currentStep: number;
  onStepChange: (step: number) => void;
}) {
  return (
    <aside className="w-full lg:w-72 shrink-0 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:sticky lg:top-6 lg:self-start">
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70">Setup Wizard</p>
        <p className="text-xs text-gray-400 mt-1">{Math.round((currentStep / 4) * 100)}% completed</p>
        <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#1e3a8a] transition-all duration-500"
            style={{ width: `${(currentStep / 4) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const active = currentStep === step.id;
          const done = currentStep > step.id;
          return (
            <button
              key={step.id}
              onClick={() => onStepChange(step.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all duration-200 w-full text-left cursor-pointer ${
                active
                  ? "bg-blue-50 border-blue-100"
                  : done
                  ? "bg-green-50 border-green-100 hover:bg-green-100/60"
                  : "bg-white border-gray-100 hover:bg-gray-50"
              }`}
            >
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                  active
                    ? "bg-[#1e3a8a] text-white"
                    : done
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-[#1e3a8a]/60" : done ? "text-green-600/70" : "text-gray-400"}`}>
                  Step {step.id}
                </p>
                <p className={`text-sm font-semibold leading-tight ${active ? "text-[#1e3a8a]" : done ? "text-green-800" : "text-gray-500"}`}>
                  {step.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-gray-100 bg-[#f8faff] p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <LifeBuoy className="h-4 w-4 text-[#1e3a8a]" />
          <p className="text-xs font-bold text-gray-700">Need Help?</p>
        </div>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">Our team is ready to guide you through setup.</p>
        <button className="w-full rounded-lg bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1e40af] transition-colors cursor-pointer">
          Contact Support
        </button>
      </div>
    </aside>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-2">{label}</p>
  );
}

function SectionTitle({ eyebrow, title, desc }: { eyebrow?: string; title: string; desc: string }) {
  return (
    <div>
      {eyebrow && <SectionEyebrow label={eyebrow} />}
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
      <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function StepPlan({
  billing,
  setBilling,
  onNext,
}: {
  billing: "monthly" | "annual";
  setBilling: (mode: "monthly" | "annual") => void;
  onNext: () => void;
}) {
  const price = billing === "annual" ? ANNUAL_PRICE : MONTHLY_PRICE;

  return (
    <div className="space-y-7">
      <SectionTitle
        eyebrow="Step 1 — Plan Selection"
        title="Choose your plan"
        desc="One plan. Everything included. No hidden fees, no feature gating."
      />

      {/* Billing toggle — matches landing page exactly */}
      <div className="flex items-center justify-center">
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

      {/* Plan card — mirrors landing page pricing card */}
      <div className="relative rounded-2xl border-2 border-[#1e3a8a] bg-gradient-to-br from-blue-50/80 to-white p-8 shadow-lg">
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-[#1e3a8a] text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap">
            All-inclusive Plan
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start mt-3">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Professional</h3>
            <p className="text-sm text-gray-500 mt-1">For growing HR teams — Philippine companies.</p>

            <div className="flex items-end gap-1 mt-5">
              <span className="text-[10px] font-bold text-gray-500 self-start mt-2.5">₱</span>
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
              onClick={onNext}
              className="mt-6 flex items-center gap-2 bg-[#1e3a8a] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#1e40af] transition-colors text-sm cursor-pointer"
            >
              Continue with Professional <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
              <Shield className="w-3 h-3 flex-shrink-0" />
              Credentials delivered within 24 hours
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mb-3">What&apos;s included</p>
            <ul className="space-y-2">
              {PLAN_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="w-4 h-4 rounded-full bg-[#1e3a8a]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
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
  );
}

function FileUpload({ label }: { label: string }) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {file ? (
        <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-3">
          <p className="text-sm text-gray-700 truncate">{file.name}</p>
          <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer ml-2 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-[#f8faff] p-6 text-center hover:border-[#1e3a8a]/30 hover:bg-blue-50/50 transition-all duration-200">
          <Upload className="h-5 w-5 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-600">Click to upload</p>
          <p className="text-xs text-gray-400 mt-0.5">PDF, PNG, JPG — max 10MB</p>
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
    </div>
  );
}

function StepCompany({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const inputClass =
    "h-10 w-full rounded-xl border border-gray-200 bg-[#f8faff] px-3 text-sm text-gray-900 outline-none focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10 transition-all duration-200 placeholder:text-gray-400";

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Step 2 — Company Details"
        title="Tell us about your company"
        desc="Provide legal business information and required documents to proceed."
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5 md:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-6 w-6 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
          <p className="text-sm font-bold text-gray-900">Basic Information</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Company Name</label>
            <input className={inputClass} placeholder="Global Tech Solutions Inc." />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Industry</label>
            <select className={inputClass}>
              <option>Technology and Software</option>
              <option>Finance and Banking</option>
              <option>Manufacturing</option>
              <option>Healthcare</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Company Address</label>
            <input className={inputClass} placeholder="Street, City, Province, Zip" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Contact Person</label>
            <input className={inputClass} placeholder="Full legal name" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Contact Number</label>
            <input className={inputClass} placeholder="+63 900 000 0000" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Company Email</label>
            <input className={inputClass} placeholder="admin@company.com" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">TIN</label>
            <input className={inputClass} placeholder="000-000-000-000" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Nature of Business</label>
            <textarea
              className="w-full rounded-xl border border-gray-200 bg-[#f8faff] p-3 text-sm text-gray-900 outline-none focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10 transition-all duration-200 placeholder:text-gray-400"
              rows={3}
              placeholder="Briefly describe your business operation"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 md:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-6 w-6 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
          <p className="text-sm font-bold text-gray-900">Business Documents</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FileUpload label="Business Permit" />
          <FileUpload label="Business Registration Certificate" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1e40af] transition-colors cursor-pointer"
        >
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StepBilling({
  billing,
  onBack,
  onNext,
}: {
  billing: "monthly" | "annual";
  onBack: () => void;
  onNext: () => void;
}) {
  const [method, setMethod] = useState<"card" | "bank" | "gcash">("card");
  const total = billing === "annual" ? ANNUAL_PRICE * 12 : MONTHLY_PRICE;

  const inputClass =
    "h-10 w-full rounded-xl border border-gray-200 bg-[#f8faff] px-3 text-sm text-gray-900 outline-none focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10 transition-all duration-200 placeholder:text-gray-400";

  const methods = [
    { key: "card" as const, label: "Credit Card" },
    { key: "bank" as const, label: "Bank Transfer" },
    { key: "gcash" as const, label: "GCash" },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Step 3 — Payment & Billing"
        title="Secure checkout"
        desc="256-bit SSL encrypted. Your payment information is never stored."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">Order Summary</p>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1e3a8a]">
                {billing === "annual" ? "Annual Billing" : "Monthly Billing"}
              </span>
            </div>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-gray-900">Professional Plan</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {billing === "annual"
                    ? "Annual subscription — billed once per year"
                    : "Monthly subscription — billed each month"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-extrabold text-[#1e3a8a] tabular-nums">₱{total.toLocaleString()}</p>
                <p className="text-xs text-gray-400">{billing === "annual" ? "/ year" : "/ month"}</p>
              </div>
            </div>
            {billing === "annual" && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-xs font-semibold text-green-700">
                You save ₱{((MONTHLY_PRICE - ANNUAL_PRICE) * 12).toLocaleString()} vs monthly billing
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-sm font-bold text-gray-900 mb-4">Billing Address</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Full Name</label>
                <input className={inputClass} placeholder="Juan dela Cruz" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Street Address</label>
                <input className={inputClass} placeholder="123 Corporate Way" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">City</label>
                <input className={inputClass} placeholder="Taguig City" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Zip Code</label>
                <input className={inputClass} placeholder="1634" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 self-start">
          <p className="text-sm font-bold text-gray-900 mb-3">Payment Method</p>
          <div className="grid grid-cols-3 gap-2">
            {methods.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMethod(key)}
                className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  method === key
                    ? "border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Cardholder Name</label>
              <input className={inputClass} placeholder="Name on card" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Card Number</label>
              <input className={inputClass} placeholder="0000 0000 0000 0000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Expiry</label>
                <input className={inputClass} placeholder="MM/YY" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">CVV</label>
                <input className={inputClass} placeholder="123" />
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-gray-100 pt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between text-gray-500">
              <span>Subtotal</span>
              <span>₱{total.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-gray-500">
              <span>Tax (0%)</span>
              <span>₱0.00</span>
            </div>
            <div className="flex items-center justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
              <span>Total Due</span>
              <span className="text-[#1e3a8a]">₱{total.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={onNext}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e40af] transition-colors cursor-pointer"
          >
            Review Order <ArrowRight className="h-4 w-4" />
          </button>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <Lock className="h-3 w-3" />
            <span>Secure SSL encrypted checkout</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
      </div>
    </div>
  );
}

function StepConfirm({
  billing,
  onBack,
  onSubmit,
}: {
  billing: "monthly" | "annual";
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [agreeTos, setAgreeTos] = useState(false);
  const [agreeComms, setAgreeComms] = useState(false);

  const amount = useMemo(() => {
    if (billing === "annual") return `₱${(ANNUAL_PRICE * 12).toLocaleString()} / year`;
    return `₱${MONTHLY_PRICE.toLocaleString()} / month`;
  }, [billing]);

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Step 4 — Review & Confirm"
        title="Almost there"
        desc="Verify your order details before completing the subscription."
      />

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {/* Header — dark navy like landing hero */}
        <div className="flex items-center justify-between bg-[linear-gradient(135deg,#0f172a_0%,#172554_100%)] px-5 py-4 text-white">
          <p className="text-sm font-semibold">Order Summary</p>
          <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            {billing === "annual" ? "Annual Plan" : "Monthly Plan"}
          </span>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-2">
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Selected Plan</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">Professional</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Billing Cycle</p>
              <p className="font-semibold text-gray-800 mt-0.5">{billing === "annual" ? "Annual Billing — Save 20%" : "Monthly Billing"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Company Name</p>
              <p className="font-semibold text-gray-800 mt-0.5">Acme Corporation</p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Administrator Email</p>
              <p className="font-semibold text-gray-800 mt-0.5">hr@acme.com</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Payment Method</p>
              <p className="font-semibold text-gray-800 mt-0.5">Visa ending in 3456</p>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
              <p className="text-[10px] uppercase tracking-wide text-[#1e3a8a]/70 font-bold">Total Amount</p>
              <p className="mt-1 text-2xl font-extrabold text-[#1e3a8a] tabular-nums">{amount}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-gray-100 bg-[#f8faff] px-5 py-4">
          <label className="flex items-start gap-3 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTos}
              onChange={(e) => setAgreeTos(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1e3a8a] cursor-pointer"
            />
            <span>
              I agree to the{" "}
              <span className="text-[#1e3a8a] font-medium underline underline-offset-2">Terms of Service</span>
              {" "}and{" "}
              <span className="text-[#1e3a8a] font-medium underline underline-offset-2">Privacy Policy</span>.
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Billing
        </button>
        <button
          onClick={onSubmit}
          disabled={!agreeTos}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Confirm &amp; Pay <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SuccessBlock() {
  return (
    <div className="text-center py-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1e3a8a] text-white shadow-lg">
        <Check className="h-7 w-7" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 mt-5 mb-2">Subscription Confirmed</p>
      <h3 className="text-2xl font-bold text-gray-900 tracking-tight">You&apos;re all set!</h3>
      <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
        Your request is processing. Admin credentials will be delivered to your company email within 24 hours.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-3 max-w-sm mx-auto">
        {[
          { label: "Setup started", color: "text-[#1e3a8a] bg-blue-50 border-blue-100" },
          { label: "Email sent",    color: "text-green-700 bg-green-50 border-green-100" },
          { label: "Access ready",  color: "text-gray-700 bg-gray-50 border-gray-100" },
        ].map(({ label, color }) => (
          <div key={label} className={`rounded-xl border px-2 py-2.5 text-xs font-semibold ${color}`}>
            {label}
          </div>
        ))}
      </div>

      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[#1e3a8a] transition-colors cursor-pointer"
      >
        <Home className="h-4 w-4" /> Back to Home
      </Link>
    </div>
  );
}

export default function SubscribePage() {
  const [step, setStep] = useState(1);
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [done, setDone] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#f8faff]">
      {/* Subtle decorative blobs — same opacity as landing */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-blue-400/5 blur-3xl" />
        <div className="absolute top-20 right-0 h-[32rem] w-[32rem] rounded-full bg-[#1e3a8a]/5 blur-3xl" />
      </div>

      {/* Navbar — matches landing page */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-[1800px] mx-auto px-4 md:px-8 xl:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#1e3a8a] rounded-lg flex items-center justify-center flex-shrink-0">
                <Star className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-900 text-[15px] leading-tight">
                Blue&apos;s Clues<span className="text-[#1e3a8a]"> HRIS</span>
              </span>
            </Link>
            <div className="hidden md:block h-5 w-px bg-gray-200" />
            <Link
              href="/"
              className="hidden md:inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1e3a8a] transition-colors font-medium"
            >
              <Home className="h-3.5 w-3.5" />
              Home
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Home"
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#1e3a8a] transition-colors"
            >
              <Home className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-[#1e3a8a] transition-colors px-3 py-1.5"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 pt-24 pb-12 md:px-8 xl:px-12 lg:flex-row">
        {!done && <Sidebar currentStep={step} onStepChange={setStep} />}

        <section className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8 xl:p-10">
          {done ? (
            <SuccessBlock />
          ) : step === 1 ? (
            <StepPlan billing={billing} setBilling={setBilling} onNext={() => setStep(2)} />
          ) : step === 2 ? (
            <StepCompany onBack={() => setStep(1)} onNext={() => setStep(3)} />
          ) : step === 3 ? (
            <StepBilling billing={billing} onBack={() => setStep(2)} onNext={() => setStep(4)} />
          ) : (
            <StepConfirm billing={billing} onBack={() => setStep(3)} onSubmit={() => setDone(true)} />
          )}
        </section>
      </main>
    </div>
  );
}
