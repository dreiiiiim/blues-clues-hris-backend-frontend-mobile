"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/authStorage";
import { refreshApi } from "@/lib/authApi";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname.includes("/login");
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (isLoginPage) {
      setReady(true);
      return;
    }

    // Access token is in-memory only — always lost on page reload.
    // Attempt a silent refresh via the HttpOnly cookie before redirecting.
    if (getAccessToken()) {
      setReady(true);
      return;
    }

    refreshApi()
      .then(() => setReady(true))
      .catch(() => router.replace("/applicant/login"));
  }, [isLoginPage, router]);

  if (isLoginPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (!ready) return null;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar persona="applicant" />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar persona="applicant" />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
