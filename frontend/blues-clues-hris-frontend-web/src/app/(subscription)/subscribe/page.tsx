"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Briefcase, Building2, CreditCard, Loader2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const STEPS = [
  { id: 1, label: "Plan", icon: Briefcase },
  { id: 2, label: "Setup", icon: Building2 },
  { id: 3, label: "Payment", icon: CreditCard },
] as const;

type Billing = "monthly" | "annual";

type CompanyFormData = {
  company_name: string;
  address: string;
  contact: string;
  email: string;
  industry: string;
  nature_of_business: string;
  tin: string;
};

type CompanyField = keyof CompanyFormData;
type CompanyFieldErrors = Partial<Record<CompanyField, string>>;

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {STEPS.map((item) => {
        const Icon = item.icon;
        const active = step === item.id;
        const done = step > item.id;
        return (
          <li
            key={item.id}
            className={`rounded-2xl border p-3.5 transition-all duration-300 ${
              active
                ? "border-[#113a6b]/30 bg-[#113a6b]/5 shadow-[0_8px_24px_rgba(17,58,107,0.12)]"
                : done
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                  active || done ? "bg-[#113a6b] text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Step {item.id}</p>
                <p className="text-sm font-semibold text-slate-700">{item.label}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function SubscribePage() {
  const [step, setStep] = useState(1);
  const [billing, setBilling] = useState<Billing>("annual");
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

  function updateCompany(field: CompanyField, value: string) {
    setCompany((prev) => ({ ...prev, [field]: value }));
    setCompanyErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validateCompany(data: CompanyFormData): CompanyFieldErrors {
    const errors: CompanyFieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.company_name.trim()) errors.company_name = "Company name is required.";
    if (!data.address.trim()) errors.address = "Company address is required.";
    if (!data.contact.trim()) errors.contact = "Contact person is required.";
    if (!data.email.trim()) errors.email = "Company email is required.";
    else if (!emailRegex.test(data.email.trim())) errors.email = "Enter a valid email address.";
    if (!data.industry.trim()) errors.industry = "Please select an industry.";
    if (!data.nature_of_business.trim()) errors.nature_of_business = "Nature of business is required.";
    if (!data.tin.trim()) errors.tin = "TIN is required.";
    return errors;
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
    try {
      const registerRes = await fetch(`${API_BASE}/subscription/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });
      const registerData = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) {
        throw new Error((registerData as { message?: string }).message ?? "Registration failed.");
      }

      const regId = (registerData as { registration_id?: string }).registration_id;
      if (!regId) throw new Error("Registration ID is missing.");

      setStep(3);

      const planRes = await fetch(`${API_BASE}/subscription/select-plan`, {
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

      const checkoutRes = await fetch(`${API_BASE}/subscription/payment/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: regId }),
      });
      const checkoutData = await checkoutRes.json().catch(() => ({}));
      if (!checkoutRes.ok) {
        throw new Error((checkoutData as { message?: string }).message ?? "Failed to create checkout session.");
      }

      const checkoutUrl = (checkoutData as { checkout_url?: string }).checkout_url;
      if (!checkoutUrl) throw new Error("No checkout URL returned.");
      window.location.href = checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_10%_0%,#dbeafe_0%,#f8fafc_45%,#f8fafc_100%)] px-4 py-8 sm:py-10 md:py-12">
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_90px_rgba(2,6,23,0.10)] backdrop-blur-sm sm:p-6 md:p-8">
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#113a6b]/70">Subscriptions</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Subscription Setup</h1>
          </div>
          <Link href="/" className="inline-flex w-fit items-center rounded-lg px-2 py-1 text-sm font-semibold text-[#113a6b] transition hover:bg-[#113a6b]/10">Back home</Link>
        </div>

        <Stepper step={step} />

        {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {step === 1 && (
          <section className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-5 duration-300">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Choose your billing cycle</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                className={`group rounded-2xl border p-4 text-left transition-all duration-200 ${
                  billing === "monthly"
                    ? "border-[#113a6b]/40 bg-blue-50 shadow-[0_8px_24px_rgba(17,58,107,0.10)]"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
                onClick={() => setBilling("monthly")}
              >
                <p className="text-base font-semibold text-slate-900">Monthly</p>
                <p className="mt-1 text-sm text-slate-500">Billed every month</p>
              </button>
              <button
                className={`group rounded-2xl border p-4 text-left transition-all duration-200 ${
                  billing === "annual"
                    ? "border-[#113a6b]/40 bg-blue-50 shadow-[0_8px_24px_rgba(17,58,107,0.10)]"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
                onClick={() => setBilling("annual")}
              >
                <p className="text-base font-semibold text-slate-900">Annual</p>
                <p className="mt-1 text-sm text-slate-500">Billed yearly</p>
              </button>
            </div>
            <div className="pt-1">
              <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 rounded-xl bg-[#113a6b] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0f325c]">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-4 duration-300">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Company details</h2>
            <div className="grid gap-3.5 md:grid-cols-2">
              {([
                ["company_name", "Company Name"],
                ["address", "Address"],
                ["contact", "Contact Person"],
                ["email", "Company Email"],
                ["industry", "Industry"],
                ["nature_of_business", "Nature of Business"],
                ["tin", "TIN"],
              ] as [CompanyField, string][]).map(([key, label]) => (
                <div key={key} className={key === "nature_of_business" ? "md:col-span-2" : ""}>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</label>
                  <input
                    value={company[key]}
                    onChange={(e) => updateCompany(key, e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#113a6b] focus:bg-white focus:ring-4 focus:ring-[#113a6b]/10"
                  />
                  {companyErrors[key] && <p className="mt-1 text-xs text-red-600">{companyErrors[key]}</p>}
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button disabled={loading} onClick={handleCompanyNext} className="inline-flex items-center gap-2 rounded-xl bg-[#113a6b] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0f325c] disabled:opacity-70">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue to payment
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="flex animate-in fade-in-0 flex-col items-center justify-center gap-4 py-16 text-center duration-300">
            <Loader2 className="h-12 w-12 animate-spin text-[#113a6b]" />
            <p className="text-base font-semibold text-slate-700">Redirecting to secure payment...</p>
            <p className="text-sm text-slate-500">You will be redirected to PayMongo to complete your payment.</p>
          </section>
        )}
      </div>
    </main>
  );
}
