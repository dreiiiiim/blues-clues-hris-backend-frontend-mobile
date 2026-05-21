"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Bell, ChevronDown, Loader2, LogOut, Shuffle, User } from "lucide-react";
import { getUserInfo, type StoredUser } from "@/lib/authStorage";
import { logoutApi } from "@/lib/authApi";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { HRNotificationBell } from "@/components/layout/HRNotificationBell";
import { EmployeeNotificationBell } from "@/components/layout/EmployeeNotificationBell";
import { portalLabel } from "@/lib/roleMap";

type PersonaType = "applicant" | "employee" | "hr" | "manager" | "admin" | "system-admin";

const TOPBAR_CONFIG: Record<PersonaType, { role: string }> = {
  hr: { role: "HR Administration" },
  employee: { role: "Internal Staff" },
  applicant: { role: "Job Applicant" },
  manager: { role: "Manager" },
  admin: { role: "Admin" },
  "system-admin": { role: "System Admin" },
};

export function Topbar({ persona = "applicant" }: { readonly persona?: PersonaType }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const config = TOPBAR_CONFIG[persona];

  useEffect(() => {
    const syncUser = () => setUser(getUserInfo());
    syncUser();
    window.addEventListener("user-info-updated", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("user-info-updated", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      if (persona === "applicant") {
        const { applicantLogoutApi } = await import("@/lib/authApi");
        await applicantLogoutApi();
        router.push("/applicant/login");
      } else {
        await logoutApi();
        router.push("/login");
      }
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  };

  const initial = user?.name?.charAt(0)?.toUpperCase() || persona.charAt(0).toUpperCase();
  const availablePortals = Array.isArray(user?.available_portals) ? user.available_portals : [];
  const currentPortal = portalLabel(user?.active_portal);
  const canSwitchPortal = availablePortals.length > 1;

  return (
    <header className="h-16 bg-background border-b border-border flex items-center justify-between px-8 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <Image
          src="/blues-clues-logo.png"
          alt="Blue's Clues HRIS"
          width={36}
          height={36}
          className="object-contain"
          priority
        />
        <div className="leading-none">
          <p className="text-sm font-bold text-foreground">
            Blue&apos;s Clues <span className="text-primary">HRIS</span>
          </p>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">
            {config.role}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {canSwitchPortal && (
          <button
            type="button"
            onClick={() => router.push("/portal-select")}
            className="hidden md:inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-colors"
            title="Switch portal"
          >
            <Shuffle className="h-3.5 w-3.5" />
            {currentPortal}
          </button>
        )}

        {/* Notifications */}
        {persona === "applicant" ? (
          <NotificationBell />
        ) : persona === "employee" ? (
          <EmployeeNotificationBell />
        ) : persona === "hr" || persona === "manager" || persona === "admin" || persona === "system-admin" ? (
          <HRNotificationBell />
        ) : (
          <button
            aria-label="Notifications"
            className="relative h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
          >
            <Bell className="h-5 w-5" />
          </button>
        )}

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
            className="flex items-center gap-3 border-l border-border pl-6 cursor-pointer group"
          >
            <div className="flex flex-col text-right">
              <span className="text-sm font-semibold text-foreground leading-tight">
                {user?.name || "Loading..."}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {user?.role_name || config.role}
              </span>
            </div>

            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 transition-all group-hover:bg-primary group-hover:text-primary-foreground">
              {user ? initial : <Loader2 className="h-4 w-4 animate-spin" />}
            </div>

            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>

          {/* Dropdown */}
          {open && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-background shadow-lg shadow-black/5 overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-150"
            >
              {/* User info header */}
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user?.name || "—"}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {user?.email || user?.role_name || config.role}
                </p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-primary/5 hover:text-primary transition-colors"
                >
                  <User className="h-4 w-4 shrink-0" />
                  My Profile
                </button>
              </div>

              <div className="py-1 border-t border-border">
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
                >
                  {loggingOut
                    ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    : <LogOut className="h-4 w-4 shrink-0" />
                  }
                  {loggingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
