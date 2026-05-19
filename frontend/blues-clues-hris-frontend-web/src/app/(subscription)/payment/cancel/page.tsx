"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LifeBuoy, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

function PaymentCancelContent() {
  const params = useSearchParams();
  const registrationId = params.get("registration_id");

  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-8">
      <div className="animate-in fade-in-0 zoom-in-95 w-full max-w-md rounded-2xl border border-destructive/30 bg-white p-8 text-center shadow-[0_8px_32px_-8px_rgba(30,58,138,0.10),0_1px_3px_rgba(0,0,0,0.04)] duration-300">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Payment Cancelled</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No charges were made. You can retry checkout anytime.
        </p>
        {registrationId ? (
          <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            Ref: {registrationId}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/subscribe">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Try Again
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="mailto:support@blueclues.com">
              <LifeBuoy className="mr-1.5 h-4 w-4" /> Contact Support
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PaymentCancelContent />
    </Suspense>
  );
}
