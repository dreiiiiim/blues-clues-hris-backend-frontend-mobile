"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LifeBuoy, XCircle } from "lucide-react";

function PaymentCancelContent() {
  const params = useSearchParams();
  const registrationId = params.get("registration_id");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,#fee2e2_0%,#f8fafc_45%,#f8fafc_100%)] px-4 py-8">
      <div className="animate-in fade-in-0 zoom-in-95 w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/90 p-7 text-center shadow-[0_24px_90px_rgba(2,6,23,0.10)] backdrop-blur-sm duration-300 sm:p-8">
        <XCircle className="mx-auto mb-4 h-11 w-11 text-rose-500" />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Payment Cancelled</h1>
        <p className="mt-2 text-sm text-slate-600">No charges were made. You can retry checkout anytime.</p>
        {registrationId ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">Ref: {registrationId}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/subscribe" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#113a6b] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0f325c]">
            <ArrowLeft className="h-4 w-4" /> Try Again
          </Link>
          <a href="mailto:support@blueclues.com" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <LifeBuoy className="h-4 w-4" /> Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <PaymentCancelContent />
    </Suspense>
  );
}
