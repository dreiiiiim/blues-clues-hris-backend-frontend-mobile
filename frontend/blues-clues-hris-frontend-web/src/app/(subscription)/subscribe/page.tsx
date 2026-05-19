"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Check,
  CreditCard,
  FileText,
  Headphones,
  Info,
  Lock,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Plan", icon: Briefcase },
  { id: 2, label: "Company", icon: Building2 },
  { id: 3, label: "Payment", icon: CreditCard },
] as const;

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

const INDUSTRY_OPTIONS = [
  "Technology and Software",
  "Finance and Banking",
  "Manufacturing",
  "Healthcare",
  "Retail and Commerce",
  "Education",
  "Government",
  "Other",
];

// Static fallback prices — matches backend getPlans() + createCheckout centavo amounts.
// Ensures price always renders even when backend is unreachable at page load.
const STATIC_PLANS = [
  { plan_id: "monthly", name: "Monthly Plan", billing_cycle: "monthly", price_php: 2999 },
  { plan_id: "annual", name: "Annual Plan", billing_cycle: "annual", price_php: 29999 },
];

const ANNUAL_SAVINGS = 2999 * 12 - 29999; // ₱5,989

const TRUST_BADGES = [
  { text: "99.9% uptime SLA", Icon: Activity },
  { text: "ISO-ready security", Icon: ShieldCheck },
  { text: "Priority support", Icon: Headphones },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Billing = "monthly" | "annual";

interface Plan {
  plan_id: string;
  name: string;
  billing_cycle: string;
  price_php: number;
}

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

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <nav aria-label="Setup progress" className="mb-8">
      <ol className="relative grid grid-cols-3 gap-2">
        <div
          aria-hidden="true"
          className="absolute top-5 left-[16%] right-[16%] h-[2px] rounded-full bg-border"
        />
        <div
          aria-hidden="true"
          className="absolute top-5 left-[16%] h-[2px] rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${((step - 1) / (STEPS.length - 1)) * 68}%` }}
        />
        {STEPS.map((item) => {
          const Icon = item.icon;
          const active = step === item.id;
          const done = step > item.id;
          return (
            <li key={item.id} className="relative z-10 flex flex-col items-center gap-1.5">
              <div
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : active
                      ? "border-primary bg-primary text-primary-foreground scale-110 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
                      : "border-border bg-background text-muted-foreground"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.14em]",
                  active ? "text-primary" : done ? "text-emerald-600" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── FileUpload ───────────────────────────────────────────────────────────────

function FileUpload({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p id={`${id}-label`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {value ? (
        <div className="flex animate-in fade-in-0 slide-in-from-bottom-2 items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3 duration-200">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-3 w-3 text-primary" />
            </div>
            <p className="truncate text-sm text-foreground">{value.name}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Remove ${label}`}
            className="ml-2 shrink-0 text-muted-foreground transition-colors hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-5 text-center transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/20"
        >
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
            <Upload className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Click to upload</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">PDF, PNG, JPG — max 10 MB</p>
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

// ─── FieldError ───────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubscribePage() {
  const [step, setStep] = useState(1);
  const [billing, setBilling] = useState<Billing>("annual");
  // Seeded with static fallback so price is always visible, even if fetch fails
  const [plans, setPlans] = useState<Plan[]>(STATIC_PLANS);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CompanyFieldErrors>({});

  const [permitFile, setPermitFile] = useState<File | null>(null);
  const [regFile, setRegFile] = useState<File | null>(null);

  const [company, setCompany] = useState<CompanyFormData>({
    company_name: "",
    address: "",
    contact: "",
    email: "",
    industry: "",
    nature_of_business: "",
    tin: "",
  });

  useEffect(() => {
    fetch(`${API_BASE_URL}/subscription/plans`)
      .then((r) => r.json())
      .then((d: Plan[]) => { if (Array.isArray(d) && d.length > 0) setPlans(d); })
      .catch(() => {});
  }, []);

  function updateCompany(field: CompanyField, value: string) {
    setCompany((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function formatTin(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 12);
    const parts: string[] = [];
    if (digits.length > 0) parts.push(digits.slice(0, 3));
    if (digits.length > 3) parts.push(digits.slice(3, 6));
    if (digits.length > 6) parts.push(digits.slice(6, 9));
    if (digits.length > 9) parts.push(digits.slice(9, 12));
    return parts.join("-");
  }

  function validate(data: CompanyFormData): CompanyFieldErrors {
    const errors: CompanyFieldErrors = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.company_name.trim()) errors.company_name = "Company name is required.";
    if (!data.address.trim()) errors.address = "Company address is required.";
    if (!data.contact.trim()) errors.contact = "Contact person is required.";
    if (!data.email.trim()) errors.email = "Company email is required.";
    else if (!emailRe.test(data.email.trim())) errors.email = "Enter a valid email address.";
    if (!data.industry.trim()) errors.industry = "Please select an industry.";
    if (!data.nature_of_business.trim()) errors.nature_of_business = "Nature of business is required.";
    if (!data.tin.trim()) errors.tin = "TIN is required.";
    return errors;
  }

  function mapBackendErrors(raw: unknown): CompanyFieldErrors {
    const items = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
    const next: CompanyFieldErrors = {};
    for (const item of items) {
      const msg = String(item).toLowerCase();
      if (msg.includes("company_name")) next.company_name = "Company name is required.";
      if (msg.includes("address")) next.address = "Company address is required.";
      if (msg.includes("contact")) next.contact = "Contact person is required.";
      if (msg.includes("email") && msg.includes("must be an email")) next.email = "Enter a valid email address.";
      else if (msg.includes("email")) next.email = "Company email is required.";
      if (msg.includes("industry")) next.industry = "Please select an industry.";
      if (msg.includes("nature_of_business")) next.nature_of_business = "Nature of business is required.";
      if (msg.includes("tin")) next.tin = "TIN is required.";
    }
    return next;
  }

  async function handleCompanyNext() {
    const errors = validate(company);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    setFieldErrors({});
    try {
      const registerRes = await fetch(`${API_BASE_URL}/subscription/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...company,
          ...(permitFile ? { business_permit_url: permitFile.name } : {}),
          ...(regFile ? { registration_cert_url: regFile.name } : {}),
        }),
      });
      const registerData = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) {
        const fieldErrs = mapBackendErrors((registerData as { message?: unknown }).message);
        if (Object.keys(fieldErrs).length > 0) {
          setFieldErrors(fieldErrs);
          toast.error("Some details need attention. Check highlighted fields.");
          return;
        }
        throw new Error((registerData as { message?: string }).message ?? "Registration failed.");
      }

      const regId = (registerData as { registration_id?: string }).registration_id;
      if (!regId) throw new Error("Registration ID is missing.");

      const planRes = await fetch(`${API_BASE_URL}/subscription/select-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: regId,
          subscription_plan: billing,
          billing_cycle: billing,
        }),
      });
      const planData = await planRes.json().catch(() => ({}));
      if (!planRes.ok) {
        throw new Error((planData as { message?: string }).message ?? "Plan selection failed.");
      }

      const checkoutRes = await fetch(`${API_BASE_URL}/subscription/payment/create-checkout`, {
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const monthlyPlan = plans.find((p) => p.billing_cycle === "monthly");
  const annualPlan = plans.find((p) => p.billing_cycle === "annual");
  const activePlan = billing === "monthly" ? monthlyPlan : annualPlan;

  return (
    <main className="px-4 py-8 sm:py-10 md:py-14">
      <div className="mx-auto w-full max-w-4xl">
        {/* Card shell */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_8px_32px_-8px_rgba(30,58,138,0.10),0_1px_3px_rgba(0,0,0,0.04)] sm:p-7">
          <Stepper step={step} />

          {/* ─── Step 1 — Plan ────────────────────────────────────────────────── */}
          {step === 1 && (
            <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              {/* Split card */}
              <div className="overflow-hidden rounded-xl border border-border/60 shadow-sm md:grid md:grid-cols-2">

                {/* Left — brand / price panel */}
                <div className="flex flex-col gap-6 bg-primary p-6 text-primary-foreground sm:p-8">
                  <div>
                    {/* Logo + eyebrow */}
                    <div className="mb-5 flex items-center gap-3">
                      <Image
                        src="/blues-clues-logo.png"
                        alt="Blue's Clues HRIS"
                        width={36}
                        height={36}
                        className="rounded-xl"
                      />
                      <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-foreground/80">
                          All-Inclusive Plan
                        </span>
                      </div>
                    </div>

                    {/* Plan name + tagline */}
                    <p className="text-2xl font-bold tracking-tight sm:text-3xl">Professional</p>
                    <p className="mt-1 text-sm text-primary-foreground/60">
                      For growing Philippine HR teams
                    </p>

                    {/* Price */}
                    <div className="mt-5">
                      <p className="text-[3rem] font-extrabold leading-none tracking-tight sm:text-[3.5rem]">
                        <span className="text-2xl font-bold align-top mt-2 inline-block">₱</span>
                        {activePlan ? activePlan.price_php.toLocaleString() : "—"}
                      </p>
                      <p className="mt-1 text-sm text-primary-foreground/60">
                        {billing === "monthly" ? "per month" : "per year"}
                      </p>
                      {billing === "annual" && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                          <Check className="h-3 w-3" />
                          Save ₱{ANNUAL_SAVINGS.toLocaleString()} per year
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Toggle */}
                  <div
                    role="group"
                    aria-label="Billing cycle"
                    className="relative flex w-fit rounded-xl border border-white/15 bg-white/10 p-1 gap-1"
                  >
                    {(["monthly", "annual"] as Billing[]).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBilling(b)}
                        aria-pressed={billing === b}
                        className={cn(
                          "relative rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200",
                          billing === b
                            ? "bg-white text-primary shadow-sm"
                            : "text-primary-foreground/60 hover:text-primary-foreground/90"
                        )}
                      >
                        {b === "monthly" ? "Monthly" : "Annual"}
                        {b === "annual" && billing !== "annual" && (
                          <span className="ml-1.5 rounded-full bg-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                            −{Math.round((1 - 29999 / (2999 * 12)) * 100)}%
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-primary shadow-sm transition-all hover:-translate-y-px hover:shadow-md active:translate-y-0"
                  >
                    Get Started <ArrowRight className="h-4 w-4" />
                  </button>

                  {/* Footer micro-line */}
                  <div className="flex items-center gap-1.5 text-xs text-primary-foreground/40">
                    <Lock className="h-3 w-3" />
                    Secure checkout · Credentials in 24 hrs
                  </div>
                </div>

                {/* Right — features panel */}
                <div className="flex flex-col gap-5 bg-card p-6 sm:p-8">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Everything Included
                  </p>

                  <ul className="grid flex-1 gap-2 sm:grid-cols-2">
                    {PLAN_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Trust badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-4">
                    <div className="flex flex-wrap gap-2">
                      {TRUST_BADGES.map(({ text, Icon }) => (
                        <span
                          key={text}
                          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm"
                        >
                          <Icon className="h-3 w-3 shrink-0 text-primary" />
                          {text}
                        </span>
                      ))}
                    </div>
                    <a
                      href="mailto:support@blueclues.com"
                      className="text-[11px] font-medium text-primary hover:underline whitespace-nowrap"
                    >
                      Need custom SLAs? <span className="font-semibold">Contact sales</span>
                    </a>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ─── Step 2 — Company ─────────────────────────────────────────────── */}
          {step === 2 && (
            <section className="animate-in fade-in-0 slide-in-from-bottom-2 space-y-5 duration-300">
              {/* Plan context chip */}
              <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-medium text-foreground">
                    {billing === "annual" ? "Annual Plan" : "Monthly Plan"}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    ₱{(billing === "annual" ? 29999 : 2999).toLocaleString()}/{billing === "annual" ? "yr" : "mo"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Change
                </button>
              </div>

              <div>
                <h2 className="text-xl font-semibold tracking-tight">Company details</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Tell us about your company so we can set up your workspace.
                </p>
              </div>

              <div className="grid gap-4 rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 sm:p-5 md:grid-cols-2">
                <p className="col-span-2 -mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary" aria-hidden="true" />
                  Business Information
                </p>
                <div>
                  <Label htmlFor="company_name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Company Name
                  </Label>
                  <Input
                    id="company_name"
                    placeholder="Acme Corporation"
                    autoComplete="organization"
                    value={company.company_name}
                    onChange={(e) => updateCompany("company_name", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.company_name)}
                    className={cn(fieldErrors.company_name && "border-destructive focus-visible:ring-destructive/20")}
                  />
                  <FieldError msg={fieldErrors.company_name} />
                </div>

                <div>
                  <Label htmlFor="contact" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contact Person
                  </Label>
                  <Input
                    id="contact"
                    placeholder="Full legal name"
                    autoComplete="name"
                    value={company.contact}
                    onChange={(e) => updateCompany("contact", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.contact)}
                    className={cn(fieldErrors.contact && "border-destructive focus-visible:ring-destructive/20")}
                  />
                  <FieldError msg={fieldErrors.contact} />
                </div>

                <div>
                  <Label htmlFor="company_email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Company Email
                  </Label>
                  <Input
                    id="company_email"
                    type="email"
                    placeholder="admin@company.com"
                    autoComplete="email"
                    value={company.email}
                    onChange={(e) => updateCompany("email", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.email)}
                    className={cn(fieldErrors.email && "border-destructive focus-visible:ring-destructive/20")}
                  />
                  {fieldErrors.email ? (
                    <FieldError msg={fieldErrors.email} />
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Also used as your system admin login email.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="industry" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Industry
                  </Label>
                  <select
                    id="industry"
                    value={company.industry}
                    onChange={(e) => updateCompany("industry", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.industry)}
                    className={cn(
                      "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      fieldErrors.industry && "border-destructive focus:ring-destructive/20",
                      !company.industry && "text-muted-foreground"
                    )}
                  >
                    <option value="">Select industry</option>
                    {INDUSTRY_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <FieldError msg={fieldErrors.industry} />
                </div>

                <div>
                  <Label htmlFor="tin" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    TIN
                  </Label>
                  <Input
                    id="tin"
                    placeholder="000-000-000-000"
                    maxLength={15}
                    value={company.tin}
                    onChange={(e) => updateCompany("tin", formatTin(e.target.value))}
                    aria-invalid={Boolean(fieldErrors.tin)}
                    className={cn(fieldErrors.tin && "border-destructive focus-visible:ring-destructive/20")}
                  />
                  {fieldErrors.tin ? (
                    <FieldError msg={fieldErrors.tin} />
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">BIR-issued format: 000-000-000-000</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Company Address
                  </Label>
                  <Input
                    id="address"
                    placeholder="Street, City, Province, ZIP"
                    autoComplete="street-address"
                    value={company.address}
                    onChange={(e) => updateCompany("address", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.address)}
                    className={cn(fieldErrors.address && "border-destructive focus-visible:ring-destructive/20")}
                  />
                  <FieldError msg={fieldErrors.address} />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="nature_of_business" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nature of Business
                  </Label>
                  <textarea
                    id="nature_of_business"
                    rows={3}
                    placeholder="Briefly describe your business operations"
                    value={company.nature_of_business}
                    onChange={(e) => updateCompany("nature_of_business", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.nature_of_business)}
                    className={cn(
                      "w-full resize-none rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      fieldErrors.nature_of_business && "border-destructive focus:ring-destructive/20"
                    )}
                  />
                  <FieldError msg={fieldErrors.nature_of_business} />
                </div>
              </div>

              {/* Documents */}
              <div className="space-y-4 rounded-xl border border-slate-200/70 bg-slate-100/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Business Documents</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Optional
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FileUpload label="Business Permit" id="permit_file" value={permitFile} onChange={setPermitFile} />
                  <FileUpload label="SEC / DTI Registration" id="reg_file" value={regFile} onChange={setRegFile} />
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 shrink-0" />
                  Documents are optional but may speed up verification.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleCompanyNext} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      Continue to payment <ArrowRight className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </section>
          )}

          {/* ─── Step 3 — Redirect ────────────────────────────────────────────── */}
          {step === 3 && (
            <section className="flex animate-in fade-in-0 flex-col items-center justify-center gap-4 py-20 text-center duration-300">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">
                  Redirecting to secure payment…
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You will be redirected to PayMongo to complete your payment.
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                Secured by PayMongo
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
