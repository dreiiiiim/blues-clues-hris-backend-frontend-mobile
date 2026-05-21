"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getUserInfo, type StoredUser } from "@/lib/authStorage";
import { isHrPathAllowed } from "@/lib/hrRoleAccess";
import { logoutApi } from "@/lib/authApi";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  LogOut,
  Users,
  UserPlus,
  UserMinus,
  DollarSign,
  BarChart,
  FileCheck,
  ClipboardCheck,
  Clock,
  Loader2,
  ScrollText,
  Trophy,
  Timer,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ROLE_LABELS: Record<string, string> = {
  hr: "HR Portal",
  manager: "Management Portal",
  employee: "Staff Portal",
  applicant: "Candidate Portal",
  admin: "Admin Portal",
  "system-admin": "System Admin",
};

type PersonaType = "applicant" | "employee" | "hr" | "manager" | "admin" | "system-admin";

type MenuItem = { name: string; href: string; icon: any };
type MenuSection = { group?: string; items: MenuItem[] };

// HR uses grouped sections; other roles use a flat list wrapped in a single section
const MENU_CONFIG: Record<PersonaType, MenuSection[]> = {
  hr: [
    {
      group: "Operations",
      items: [
        { name: "Dashboard",   href: "/hr",             icon: LayoutDashboard },
        { name: "Timekeeping", href: "/hr/timekeeping", icon: Clock },
      ],
    },
    {
      group: "Talent",
      items: [
        { name: "Recruitment", href: "/hr/jobs",       icon: Briefcase },
        { name: "Candidates",  href: "/hr/candidates", icon: Trophy },
        { name: "Onboarding",  href: "/hr/onboarding", icon: UserPlus },
        { name: "Offboarding", href: "/hr/offboarding", icon: LogOut },
        { name: "Approvals",   href: "/hr/approvals",  icon: ShieldCheck },
      ],
    },
    {
      group: "People Mgmt",
      items: [
        { name: "Compensation", href: "/hr/payroll",     icon: DollarSign },
        { name: "Performance",  href: "/hr/performance", icon: BarChart },
      ],
    },
  ],
  manager: [
    {
      items: [
        { name: "Dashboard",   href: "/manager",             icon: LayoutDashboard },
        { name: "Team",        href: "/manager/team",        icon: Users },
        { name: "Performance", href: "/manager/performance", icon: BarChart },
        { name: "Timekeeping", href: "/manager/timekeeping", icon: Clock },
        { name: "Offboarding", href: "/manager/offboarding", icon: LogOut },
        { name: "Approvals",   href: "/manager/approvals",   icon: ClipboardCheck },
      ],
    },
  ],
  applicant: [
    {
      items: [
        { name: "Dashboard",       href: "/applicant/dashboard",    icon: LayoutDashboard },
        { name: "Jobs",            href: "/applicant/jobs",         icon: Briefcase },
        { name: "My Applications", href: "/applicant/applications", icon: FileText },
        { name: "My Profile",      href: "/applicant/profile",      icon: Users },
      ],
    },
  ],
  employee: [
    {
      items: [
        { name: "Dashboard",   href: "/employee",             icon: LayoutDashboard },
        { name: "Timekeeping", href: "/employee/timekeeping", icon: Clock },
        { name: "Performance", href: "/employee/performance", icon: BarChart },
        { name: "Leave",       href: "/employee/leave",       icon: FileText },
        { name: "Overtime",    href: "/employee/overtime",    icon: Timer },
        { name: "My Profile",  href: "/employee/profile",     icon: Users },
        { name: "Payslips",    href: "/employee/payslips",    icon: DollarSign },
        { name: "Offboarding", href: "/employee/offboarding", icon: LogOut },
        { name: "Documents",   href: "/employee/documents",   icon: FileCheck },
      ],
    },
  ],
  admin: [
    {
      items: [
        { name: "Dashboard", href: "/admin",       icon: LayoutDashboard },
        { name: "Users",     href: "/admin/users", icon: Users },
      ],
    },
  ],
  "system-admin": [
    {
      group: "Operations",
      items: [
        { name: "Dashboard",   href: "/system-admin",             icon: LayoutDashboard },
        { name: "Timekeeping", href: "/system-admin/timekeeping", icon: Clock },
      ],
    },
    {
      group: "People",
      items: [
        { name: "Users",      href: "/system-admin/users",      icon: Users },
        { name: "Onboarding", href: "/system-admin/onboarding", icon: UserPlus },
        { name: "Offboarding", href: "/system-admin/offboarding", icon: UserMinus },
        { name: "Approvals",  href: "/system-admin/approvals",  icon: ShieldCheck },
      ],
    },
    {
      group: "System",
      items: [
        { name: "Compensation & Benefits", href: "/system-admin/compensation-settings", icon: DollarSign },
        { name: "Subscription Plans", href: "/system-admin/subscriptions", icon: DollarSign },
        { name: "Performance Settings", href: "/system-admin/performance-settings", icon: BarChart },
        { name: "Role Permissions", href: "/system-admin/settings", icon: SlidersHorizontal },
        { name: "Audit Logs", href: "/system-admin/audit-logs", icon: ScrollText },
      ],
    },
  ],
};

export function Sidebar({
  persona = "applicant",
  additionalItems = [],
}: {
  readonly persona?: PersonaType;
  readonly additionalItems?: { name: string; href: string; icon: React.ElementType }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (globalThis.window) {
      return localStorage.getItem("sidebar_collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    setUser(getUserInfo());
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    if (user?.role === "applicant") {
      const { applicantLogoutApi } = await import("@/lib/authApi");
      await applicantLogoutApi();
      router.push("/applicant/login");
    } else {
      await logoutApi();
      router.push("/login");
    }
  };

  const ROOT_PATHS = new Set(["/system-admin", "/admin", "/hr", "/manager", "/employee"]);

  const isActive = (href: string) =>
    ROOT_PATHS.has(href)
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  const linkStyle = (href: string) => {
    const active = isActive(href);
    return [
      "flex items-center gap-3 rounded-md font-medium text-sm transition-all relative group",
      collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5",
      active
        ? "bg-sidebar-primary text-sidebar-foreground shadow-sm border-l-2 border-white/70"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent border-l-2 border-transparent",
    ].join(" ");
  };

  const sections = MENU_CONFIG[persona] || [];
  // Append additionalItems to the last section
  const allSections: MenuSection[] = additionalItems.length > 0
    ? (() => {
        const lastSection = sections.at(-1);
        if (!lastSection) return sections;
        return [
          ...sections.slice(0, -1),
          {
            ...lastSection,
            items: [...(lastSection.items ?? []), ...additionalItems],
          },
        ];
      })()
    : sections;

  const visibleSections =
    persona === "hr" && user?.role_name
      ? allSections
          .map((section) => ({
            ...section,
            items: section.items.filter((item) => isHrPathAllowed(user.role_name, item.href)),
          }))
          .filter((section) => section.items.length > 0)
      : allSections;

  return (
    <div
      className={[
        "bg-sidebar text-sidebar-foreground flex flex-col min-h-screen shrink-0 border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-16" : "w-64",
      ].join(" ")}
    >
      {/* Logo Section */}
      <div className={["h-16 flex items-center border-b border-sidebar-border/40 mt-0 shrink-0", collapsed ? "justify-center px-1" : "gap-2 px-3"].join(" ")}>
        {collapsed ? (
          <img
            src="/blues-clues-logo.png"
            alt="Blue's Clues HRIS"
            className="h-10 w-10 object-contain shrink-0"
          />
        ) : (
          <>
            <img
              src="/blues-clues-logo.png"
              alt="Blue's Clues HRIS"
              className="h-11 w-11 object-contain shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sidebar-foreground font-bold text-sm leading-none truncate">
                Blue&apos;s Clues <span className="text-emerald-400">HRIS</span>
              </p>
              <p className="text-sidebar-foreground/40 text-[9px] uppercase tracking-widest mt-0.5">
                {ROLE_LABELS[persona]}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Navigation Section */}
      <div className={["flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3"].join(" ")}>
        {visibleSections.map((section, si) => (
          <div key={`${section.group ?? "section"}-${section.items[0]?.href ?? si}`} className={si > 0 ? "mt-4" : ""}>
            {/* Section eyebrow label — hidden when collapsed */}
            {section.group && !collapsed && (
              <p className="text-[9px] font-bold text-sidebar-foreground/35 mb-1.5 px-3 tracking-[0.18em] uppercase">
                {section.group}
              </p>
            )}
            {section.group && collapsed && si > 0 && (
              <div className="my-2 border-t border-sidebar-border/30" />
            )}

            <nav className="space-y-0.5">
              {section.items.map((item) => (
                collapsed ? (
                  /* Collapsed: icon-only with native title tooltip */
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.name}
                    className={linkStyle(item.href)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                  </Link>
                ) : (
                  <Link key={item.href} href={item.href} className={linkStyle(item.href)}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                )
              ))}
            </nav>
          </div>
        ))}
      </div>

      {/* Collapse Toggle + Account Section */}
      <div className={["border-t border-sidebar-border pt-3 pb-2", collapsed ? "px-2" : "px-3"].join(" ")}>
        {!collapsed && (
          <p className="text-[9px] font-bold text-sidebar-foreground/35 mb-1.5 px-3 tracking-[0.18em] uppercase">
            Account
          </p>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              title="Sign Out"
              className={[
                "flex items-center gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md font-medium text-sm w-full transition-colors cursor-pointer border-l-2 border-transparent",
                collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5",
              ].join(" ")}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to log out?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout} variant="destructive">
                Log Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Collapse toggle button */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={[
            "flex items-center gap-3 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md font-medium text-sm w-full transition-colors cursor-pointer mt-1 border-l-2 border-transparent",
            collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5",
          ].join(" ")}
        >
          {collapsed
            ? <PanelLeftOpen className="h-4 w-4 shrink-0" />
            : <><PanelLeftClose className="h-4 w-4 shrink-0" /><span>Collapse</span></>
          }
        </button>
      </div>

      {/* Profile Block */}
      <div className={["bg-black/20 flex items-center gap-3 shrink-0", collapsed ? "p-3 justify-center" : "p-4"].join(" ")}>
        <div className="h-9 w-9 bg-primary/20 rounded-full flex items-center justify-center font-bold text-sm border border-white/10 text-sidebar-foreground shrink-0">
          {user ? user.name.charAt(0) : <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-sidebar-foreground">
              {user?.name || "Loading..."}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase font-bold tracking-widest">
              {user ? (user.role_name ?? ROLE_LABELS[user.role] ?? user.role) : "Loading..."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
