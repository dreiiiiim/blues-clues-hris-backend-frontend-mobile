"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";

type VerifyState = "loading" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [state, setState] = useState<VerifyState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setErrorMessage("No verification token found in the link.");
      setState("error");
      return;
    }

    fetch(`${API_BASE_URL}/applicants/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setState("success");
        } else {
          const body = await res.json().catch(() => ({}));
          setErrorMessage(body.message ?? "Verification failed. Please try again.");
          setState("error");
        }
      })
      .catch(() => {
        setErrorMessage("Could not reach the server. Please check your connection.");
        setState("error");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-6">
          <p className="text-sm font-semibold tracking-widest text-primary uppercase">
            Blue&apos;s Clues HRIS
          </p>
          <p className="text-xs text-muted-foreground mt-1">Applicant Portal</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center space-y-6">
          {state === "loading" && (
            <>
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <div className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground">
                  Verifying your email...
                </h1>
                <p className="text-sm text-muted-foreground">
                  Please wait a moment.
                </p>
              </div>
            </>
          )}

          {state === "success" && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  Email Verified!
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your account is now active. You can sign in to your
                  applicant portal and start tracking your applications.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => router.push("/applicant/login")}
              >
                Go to Sign In
              </Button>
            </>
          )}

          {state === "error" && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-9 w-9 text-destructive" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  Verification Failed
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {errorMessage || "This link is invalid, expired, or has already been used."}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/applicant/login")}
              >
                Back to Sign In
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
