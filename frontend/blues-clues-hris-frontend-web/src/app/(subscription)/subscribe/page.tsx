"use client";

import { useState } from "react";
import {
  Building2, CreditCard, FileCheck, CheckCircle2, Upload, X,
  ChevronRight, ChevronLeft, Shield, Briefcase, Phone, Mail,
  MapPin, Hash, Star
} from "lucide-react";

/* ── DESIGN TOKENS (design-inspo-hris: dark blue primary) ── */
// Primary: #1e3a8a | Accent: #2563eb | BG: #eff6ff

const STEPS = [
  { id: 1, label: "Plan",    icon: Briefcase  },
  { id: 2, label: "Company", icon: Building2  },
  { id: 3, label: "Payment", icon: CreditCard },
  { id: 4, label: "Confirm", icon: FileCheck  },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const done   = current > step.id;
        const active = current === step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                done   ? "bg-[#1e3a8a] border-[#1e3a8a] text-white" :
                active ? "bg-white border-[#1e3a8a] text-[#1e3a8a]" :
                         "bg-white border-gray-200 text-gray-400"
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                active || done ? "text-[#1e3a8a]" : "text-gray-400"
              }`}>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`w-16 md:w-24 h-0.5 mb-5 mx-1 transition-colors ${
                current > step.id ? "bg-[#1e3a8a]" : "bg-gray-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileUploadField({ label, name, optional }: { label: string; name: string; optional?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{optional && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
      </label>
      {file ? (
        <div className="flex items-center gap-2 border border-[#1e3a8a] bg-blue-50 rounded-lg px-3 py-2.5">
          <FileCheck className="w-4 h-4 text-[#1e3a8a] flex-shrink-0" />
          <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
          <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg p-5 cursor-pointer hover:border-[#2563eb] hover:bg-blue-50/50 transition-colors group">
          <Upload className="w-5 h-5 text-gray-400 mb-2 group-hover:text-[#2563eb] transition-colors" />
          <span className="text-sm text-gray-500">Click to upload or drag & drop</span>
          <span className="text-xs text-gray-400 mt-1">PDF, JPG, PNG · Max 10MB</span>
          <input type="file" className="hidden" name={name} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
    </div>
  );
}

/* ── STEP 1: PLAN ── */
function Step1Plan({ onNext }: { onNext: () => void }) {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [selected, setSelected] = useState<"starter" | "pro" | "enterprise">("pro");

  const plans = [
    {
      id: "starter" as const,
      name: "Starter",
      monthly: "₱2,499",
      annual: "₱1,999",
      per: "/mo",
      tag: null,
      features: ["Up to 50 employees", "Core HR modules", "Job posting & tracking", "Basic reports", "Email support"],
    },
    {
      id: "pro" as const,
      name: "Professional",
      monthly: "₱4,999",
      annual: "₱3,999",
      per: "/mo",
      tag: "Most Popular",
      features: ["Unlimited employees", "All HR modules", "SFIA assessment", "Advanced analytics", "Priority support"],
    },
    {
      id: "enterprise" as const,
      name: "Enterprise",
      monthly: "Custom",
      annual: "Custom",
      per: "",
      tag: "Contact Sales",
      features: ["Unlimited + multi-entity", "White-label option", "Full API access", "Dedicated CSM", "SLA guarantee"],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Choose your plan</h2>
        <p className="text-sm text-gray-500 mt-1">Annual billing saves 20% vs monthly.</p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center">
        <div className="flex bg-gray-100 rounded-full p-1 gap-1">
          {(["monthly", "annual"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                billing === b ? "bg-[#1e3a8a] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {b === "monthly" ? "Monthly" : "Annual"}
              {b === "annual" && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  billing === "annual" ? "bg-white/20 text-white" : "bg-green-100 text-green-700"
                }`}>−20%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const active = selected === plan.id;
          return (
            <div
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className={`relative rounded-2xl p-5 border-2 cursor-pointer transition-all ${
                active
                  ? "border-[#1e3a8a] bg-gradient-to-br from-blue-50 to-white shadow-md"
                  : "border-gray-200 bg-white hover:border-blue-200"
              }`}
            >
              {plan.tag && (
                <span className={`absolute -top-3 left-4 text-xs font-bold px-3 py-1 rounded-full ${
                  plan.tag === "Most Popular"
                    ? "bg-[#1e3a8a] text-white"
                    : "bg-gray-800 text-white"
                }`}>{plan.tag}</span>
              )}
              <h3 className="font-bold text-gray-900 mt-2">{plan.name}</h3>
              <div className="mt-2 mb-4 flex items-end gap-1">
                <span className={`text-3xl font-bold ${active ? "text-[#1e3a8a]" : "text-gray-900"}`}>
                  {billing === "monthly" ? plan.monthly : plan.annual}
                </span>
                {plan.per && <span className="text-gray-500 text-sm pb-0.5">{plan.per}</span>}
              </div>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${active ? "text-[#1e3a8a]" : "text-gray-400"}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-[#1e3a8a] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#1e40af] transition-colors cursor-pointer"
        >
          Get Started <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── STEP 2: COMPANY ── */
function Step2Company({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Company Details</h2>
        <p className="text-sm text-gray-500 mt-1">All fields required unless marked optional.</p>
      </div>

      {/* Basic Info */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 bg-[#1e3a8a] rounded-full" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Basic Information</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
            <input type="text" placeholder="Acme Corporation" className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
            <select className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all cursor-pointer">
              <option value="">Select industry…</option>
              <option>Information Technology</option>
              <option>Manufacturing</option>
              <option>Healthcare</option>
              <option>Finance & Banking</option>
              <option>Retail</option>
              <option>Education</option>
              <option>Other</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <MapPin className="inline w-3.5 h-3.5 mr-1 text-gray-400" />Company Address
            </label>
            <textarea rows={2} placeholder="Street, City, Province, ZIP Code" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Phone className="inline w-3.5 h-3.5 mr-1 text-gray-400" />Contact Person
            </label>
            <input type="text" placeholder="Full name" className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Number</label>
            <input type="tel" placeholder="+63 9XX XXX XXXX" className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Mail className="inline w-3.5 h-3.5 mr-1 text-gray-400" />Company Email
            </label>
            <input type="email" placeholder="hr@company.com" className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Hash className="inline w-3.5 h-3.5 mr-1 text-gray-400" />TIN (Tax ID Number)
            </label>
            <input type="text" placeholder="XXX-XXX-XXX-XXX" className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nature of Business</label>
            <textarea rows={2} placeholder="Brief description of your business operations…" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all resize-none" />
          </div>
        </div>
      </div>

      {/* Documents */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 bg-[#1e3a8a] rounded-full" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Business Documents</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <FileUploadField label="Business Permit" name="businessPermit" />
          <FileUploadField label="Business Registration Certificate (SEC/DTI/CDA)" name="bizRegCert" />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 bg-[#1e3a8a] rounded-full" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">HR Org Structure</span>
        </div>
        <FileUploadField label="Upload HR Org Chart" name="orgStructure" optional />
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 border border-gray-200 text-gray-500 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onNext} className="flex items-center gap-2 bg-[#1e3a8a] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#1e40af] transition-colors cursor-pointer">
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── STEP 3: PAYMENT ── */
function Step3Payment({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [method, setMethod] = useState<"card" | "bank" | "gcash">("card");
  const [sameAddress, setSameAddress] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Payment</h2>
        <p className="text-sm text-gray-500 mt-1">Select payment method and billing details.</p>
      </div>

      {/* Order summary */}
      <div className="bg-gradient-to-r from-[#eff6ff] to-blue-50 border border-blue-100 rounded-xl p-4 flex justify-between items-center">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Professional Plan — Annual</p>
          <p className="text-xs text-gray-500 mt-0.5">Billed once per year · Includes VAT</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-[#1e3a8a]">₱47,990</p>
          <p className="text-xs text-gray-400 line-through">₱59,988</p>
        </div>
      </div>

      {/* Billing address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Billing Address</label>
        <label className="flex items-center gap-2 mb-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={sameAddress}
            onChange={(e) => setSameAddress(e.target.checked)}
            className="w-4 h-4 accent-[#1e3a8a] cursor-pointer"
          />
          <span className="text-sm text-gray-600">Same as company address</span>
        </label>
        {!sameAddress && (
          <textarea rows={2} placeholder="Street, City, Province, ZIP Code"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] resize-none transition-all" />
        )}
      </div>

      {/* Payment method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method</label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { id: "card"  as const, label: "Credit / Debit Card" },
            { id: "bank"  as const, label: "Bank Transfer"       },
            { id: "gcash" as const, label: "GCash"               },
          ]).map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={`p-3 rounded-xl border-2 text-sm font-medium text-center transition-all cursor-pointer ${
                method === m.id
                  ? "border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]"
                  : "border-gray-200 text-gray-600 hover:border-blue-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {method === "card" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Card Number</label>
            <input type="text" placeholder="1234  5678  9012  3456" className="w-full h-10 border border-gray-200 rounded-lg px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Expiry</label>
            <input type="text" placeholder="MM / YY" className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">CVV</label>
            <input type="password" placeholder="•••" className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cardholder Name</label>
            <input type="text" placeholder="As it appears on card" className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all" />
          </div>
        </div>
      )}

      {(method === "bank" || method === "gcash") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {method === "gcash" ? "GCash Number" : "Bank Account / Reference Number"}
          </label>
          <input type="text" placeholder={method === "gcash" ? "09XX XXX XXXX" : "Account number"} className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all" />
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> Payment instructions sent to your company email.
          </p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 border border-gray-200 text-gray-500 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onNext} className="flex items-center gap-2 bg-[#1e3a8a] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#1e40af] transition-colors cursor-pointer">
          Review Order <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── STEP 4: CONFIRM ── */
function Step4Confirm({ onSubmit, onBack }: { onSubmit: () => void; onBack: () => void }) {
  const [terms, setTerms]     = useState(false);
  const [privacy, setPrivacy] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Review & Confirm</h2>
        <p className="text-sm text-gray-500 mt-1">Check everything before submitting.</p>
      </div>

      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 bg-[#eff6ff]">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">Order Summary</p>
        </div>
        {[
          ["Plan",         "Professional"],
          ["Billing",      "Annual"],
          ["Amount",       "₱47,990 / year"],
          ["Company",      "Acme Corporation"],
          ["Admin Email",  "hr@acme.com"],
          ["Payment",      "Card ending ••••3456"],
        ].map(([k, v]) => (
          <div key={k} className="px-5 py-3 flex justify-between border-t border-gray-100">
            <span className="text-sm text-gray-500">{k}</span>
            <span className="text-sm font-semibold text-gray-900">{v}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3 bg-[#eff6ff] rounded-xl p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#1e3a8a] cursor-pointer" />
          <span className="text-sm text-gray-600">
            I agree to the <a href="/terms" className="text-[#1e3a8a] underline font-medium">Terms and Conditions</a>.
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#1e3a8a] cursor-pointer" />
          <span className="text-sm text-gray-600">
            I consent to data processing per the <a href="/privacy" className="text-[#1e3a8a] underline font-medium">Privacy Policy</a>.
          </span>
        </label>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 border border-gray-200 text-gray-500 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onSubmit}
          disabled={!terms || !privacy}
          className="flex items-center gap-2 bg-[#1e3a8a] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#1e40af] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Shield className="w-4 h-4" /> Confirm & Pay
        </button>
      </div>
    </div>
  );
}

/* ── SUCCESS ── */
function SuccessScreen() {
  return (
    <div className="text-center py-8 space-y-5">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Subscription Confirmed!</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
          Your subscription is active. System admin credentials will be sent to your company email within 24 hours.
        </p>
      </div>
      <div className="inline-block bg-[#eff6ff] border border-blue-100 rounded-xl px-6 py-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-bold">Subscription ID</p>
        <p className="text-sm font-mono font-bold text-[#1e3a8a] mt-1">SUB-2026-00124</p>
      </div>
      <p className="text-xs text-gray-400">
        Questions? <a href="mailto:support@bluetribe.ph" className="text-[#1e3a8a] underline">support@bluetribe.ph</a>
      </p>
    </div>
  );
}

/* ── ROOT PAGE ── */
export default function SubscribePage() {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);

  return (
    <div className="min-h-screen bg-[#eff6ff] flex flex-col">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1e3a8a] rounded-lg flex items-center justify-center">
            <Star className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">BlueTribe HRIS</span>
        </div>
      </header>

      {/* Hero banner */}
      {!done && (
        <div className="bg-gradient-to-r from-[#0f172a] via-[#172554] to-[#134e4a] px-4 md:px-8 py-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full opacity-10 -translate-y-1/2 translate-x-1/4" />
          <div className="max-w-5xl mx-auto relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300 mb-2">Step {step} of 4</p>
            <h1 className="text-xl md:text-2xl font-bold">Subscribe to BlueTribe HRIS</h1>
            <p className="text-white/70 text-sm mt-1">Streamline HR for your entire organization.</p>
          </div>
        </div>
      )}

      {/* Card */}
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          {!done && <StepIndicator current={step} />}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
            {done       ? <SuccessScreen /> :
             step === 1 ? <Step1Plan onNext={() => setStep(2)} /> :
             step === 2 ? <Step2Company onNext={() => setStep(3)} onBack={() => setStep(1)} /> :
             step === 3 ? <Step3Payment onNext={() => setStep(4)} onBack={() => setStep(2)} /> :
                          <Step4Confirm onSubmit={() => setDone(true)} onBack={() => setStep(3)} />}
          </div>
        </div>
      </main>
    </div>
  );
}
