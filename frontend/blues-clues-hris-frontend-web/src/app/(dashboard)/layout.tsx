"use client";

import { useState, useLayoutEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearAuthStorage, saveUserInfo, getAccessToken, parseJwt } from "@/lib/authStorage";
import { authFetch, logoutApi } from "@/lib/authApi";
import { useIdleTimeout } from "@/lib/useIdleTimeout";
import { API_BASE_URL } from "@/lib/api";
import { roleToPath } from "@/lib/roleMap";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type UserRole = "hr" | "manager" | "employee" | "applicant" | "admin" | "system-admin";

export default function SharedDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const handleIdle = useCallback(async () => {
    await logoutApi();
    router.replace("/login");
  }, [router]);

  useIdleTimeout(handleIdle, role === "system-admin");

  useLayoutEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    const verify = async () => {
      const res = await authFetch(`${API_BASE_URL}/me`);
      if (!res.ok) {
        clearAuthStorage();
        router.replace("/login");
        return;
      }

      const me = await res.json();
      if (!me?.role_name) {
        clearAuthStorage();
        router.replace("/login");
        return;
      }

      const userRole = roleToPath(me.role_name).replace("/", "") as UserRole;

      // Strict Persona Guard: prevents a Manager from viewing /hr pages, etc.
      const isAccessingWrongDashboard =
        (pathname.startsWith("/hr") && userRole !== "hr") ||
        (pathname.startsWith("/manager") && userRole !== "manager") ||
        (pathname.startsWith("/employee") && userRole !== "employee") ||
        (pathname.startsWith("/applicant") && userRole !== "applicant") ||
        (pathname.startsWith("/admin") && !pathname.startsWith("/system-admin") && userRole !== "admin") ||
        (pathname.startsWith("/system-admin") && userRole !== "system-admin");

      if (isAccessingWrongDashboard) {
        router.replace(`/${userRole}`);
        return;
      }

      // overwrite user_info with real server data — corrects any DevTools edits
      const tokenPayload = parseJwt(getAccessToken() ?? "");
      const firstName = tokenPayload?.first_name ?? "";
      const lastName = tokenPayload?.last_name ?? "";
      const name = [firstName, lastName].filter(Boolean).join(" ") || me.username || "";
      saveUserInfo({ name, email: me.email ?? "", role: userRole });

      setRole(userRole);
      setIsAuthorized(true);
    };

    verify();
  }, [pathname, router]);

  if (!isAuthorized || !role) {
    return null;
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar persona={role} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar persona={role} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
