"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Home, LifeBuoy, Loader2, Mail, Server, XCircle } from "lucide-react";

import { API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Status = "loading" | "success" | "error";

export default function PaymentSuccessContent() {
  const params = useSearchParams();
  const registrationId = params.get("registration_id");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("Verifying your payment…");

  useEffect(() => {
    if (!registrationId) {
      setStatus("error");
      setMessage("Missing registration ID. Please contact support.");
      return;
    }

    let ignore = false;

    fetch(`${API_BASE_URL}/subscription/payment/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-white p-8 text-center shadow-[0_8px_32px_-8px_rgba(30,58,138,0.10),0_1px_3px_rgba(0,0,0,0.04)]">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
          <h1 className="text-xl font-bold tracking-tight">Verifying Payment</h1>
          <p className="mt-2 text-sm text-muted-foreground">This usually takes just a moment.</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-8">
        <div className="animate-in fade-in-0 zoom-in-95 w-full max-w-md rounded-2xl border border-destructive/30 bg-white p-8 text-center shadow-[0_8px_32px_-8px_rgba(30,58,138,0.10),0_1px_3px_rgba(0,0,0,0.04)] duration-300">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Verification Failed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <Button asChild className="mt-6">
            <a href="mailto:bluesclueshrissuperadmin@gmail.com">
              <LifeBuoy className="mr-1.5 h-4 w-4" /> Contact Support
            </a>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-8">
      <div className="animate-in fade-in-0 zoom-in-95 w-full max-w-md overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[0_8px_32px_-8px_rgba(30,58,138,0.10),0_1px_3px_rgba(0,0,0,0.04)] duration-300">

        <div className="bg-emerald-50/60 px-8 py-7 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment Confirmed</h1>
          <p className="mt-1.5 text-sm text-slate-500">{message}</p>
        </div>

        <div className="px-8 py-6">
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Server className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">System provisioning underway</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Your workspace is being configured. Admin credentials will be sent to your registered company email.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5 shrink-0 text-primary/60" />
              <span>Typical setup time: <span className="font-semibold text-slate-700">under 24 hours</span></span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-500">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
              <span>
                Taking longer than 24 hours?{" "}
                <a
                  href="mailto:bluesclueshrissuperadmin@gmail.com"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  bluesclueshrissuperadmin@gmail.com
                </a>
              </span>
            </div>
          </div>

          <Button asChild className="mt-6 w-full">
            <Link href="/">
              <Home className="mr-1.5 h-4 w-4" /> Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
