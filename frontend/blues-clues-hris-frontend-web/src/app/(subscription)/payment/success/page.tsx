"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Home, LifeBuoy, Loader2, XCircle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const WEBHOOK_SECRET = process.env.NEXT_PUBLIC_SUBSCRIPTION_WEBHOOK_SECRET ?? "";

type Status = "loading" | "success" | "error";

function PaymentSuccessContent() {
  const params = useSearchParams();
  const registrationId = params.get("registration_id");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("Verifying your payment...");

  useEffect(() => {
    if (!registrationId) {
      setStatus("error");
      setMessage("Missing registration ID. Please contact support.");
      return;
    }

    let ignore = false;

    fetch(`${API_BASE}/subscription/payment/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify({ registration_id: registrationId }),
    })
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (ignore) return;
        if (!ok) {
          setStatus("error");
          setMessage((data as { message?: string }).message ?? "Payment verification failed.");
          return;
        }
        setStatus("success");
        setMessage("Your subscription is now active.");
      })
      .catch(() => {
        if (ignore) return;
        setStatus("error");
        setMessage("Network error while verifying payment. Please contact support.");
      });

    return () => {
      ignore = true;
    };
  }, [registrationId]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,#dbeafe_0%,#f8fafc_45%,#f8fafc_100%)] px-4 py-8">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/90 p-7 text-center shadow-[0_24px_90px_rgba(2,6,23,0.10)] backdrop-blur-sm sm:p-8">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#113a6b]" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Verifying Payment</h1>
          <p className="mt-2 text-sm text-slate-500">This usually takes just a moment.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,#fee2e2_0%,#f8fafc_45%,#f8fafc_100%)] px-4 py-8">
        <div className="animate-in fade-in-0 zoom-in-95 w-full max-w-md rounded-3xl border border-red-200 bg-white/90 p-7 text-center shadow-[0_24px_90px_rgba(2,6,23,0.10)] backdrop-blur-sm duration-300 sm:p-8">
          <XCircle className="mx-auto mb-4 h-11 w-11 text-red-500" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Verification Failed</h1>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
          <a href="mailto:support@blueclues.com" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#113a6b] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0f325c]">
            <LifeBuoy className="h-4 w-4" /> Contact Support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,#dcfce7_0%,#f8fafc_45%,#f8fafc_100%)] px-4 py-8">
      <div className="animate-in fade-in-0 zoom-in-95 w-full max-w-md rounded-3xl border border-emerald-200 bg-white/90 p-7 text-center shadow-[0_24px_90px_rgba(2,6,23,0.10)] backdrop-blur-sm duration-300 sm:p-8">
        <CheckCircle2 className="mx-auto mb-4 h-11 w-11 text-emerald-600" />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Payment Confirmed</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <p className="mt-2 text-xs text-slate-500">System admin credentials will be emailed within 24 hours.</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#113a6b] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0f325c]">
          <Home className="h-4 w-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-[#113a6b]" /></div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
