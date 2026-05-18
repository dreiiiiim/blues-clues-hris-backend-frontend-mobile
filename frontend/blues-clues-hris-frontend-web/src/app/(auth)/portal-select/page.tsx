"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, LayoutDashboard, Loader2, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAccessToken, getUserInfo, parseJwt, saveUserInfo } from "@/lib/authStorage";
import { portalToPath, roleToPath } from "@/lib/roleMap";
import { switchRoleApi } from "@/lib/authApi";

type SwitchOption = {
  role_id: string;
  role_name: string;
  portal_key: string;
};

type PortalCard = {
  portal_key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  toneClass: string;
};

const PORTAL_CARDS: PortalCard[] = [
  {
    portal_key: "employee",
    title: "Employee Portal",
    description: "Timekeeping, leave, documents, and personal payroll access.",
    icon: Users,
    toneClass: "border-primary/20 bg-primary/5",
  },
  {
    portal_key: "hr",
    title: "HR Portal",
    description: "Recruitment, onboarding, approvals, and employee administration.",
    icon: ShieldCheck,
    toneClass: "border-slate-200 bg-slate-50",
  },
  {
    portal_key: "manager",
    title: "Manager Portal",
    description: "Team oversight, approvals, performance, and coordination tools.",
    icon: Briefcase,
    toneClass: "border-slate-200 bg-slate-50",
  },
  {
    portal_key: "admin",
    title: "Admin Portal",
    description: "User administration and system-level configuration.",
    icon: Building2,
    toneClass: "border-slate-200 bg-slate-50",
  },
  {
    portal_key: "system-admin",
    title: "System Admin",
    description: "Platform-wide controls, audit logs, modules, and security settings.",
    icon: LayoutDashboard,
    toneClass: "border-slate-200 bg-slate-50",
  },
];

function PortalOptionCard({
  portalKey,
  option,
  activePortal,
  busyRoleId,
  onSelect,
}: {
  readonly portalKey: string;
  readonly option: SwitchOption | undefined;
  readonly activePortal: string;
  readonly busyRoleId: string | null;
  readonly onSelect: (portalKey: string) => void;
}) {
  const config = PORTAL_CARDS.find((card) => card.portal_key === portalKey) ?? PORTAL_CARDS[0];
  const Icon = config.icon;
  const isActive = activePortal === portalKey;
  const isBusy = busyRoleId === option?.role_id;

  return (
    <button
      type="button"
      disabled={!option || !!busyRoleId}
      onClick={() => onSelect(portalKey)}
      className={[
        "group w-full rounded-2xl border p-4 text-left transition-all duration-200",
        "hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        isActive ? "border-primary/30 bg-primary/5 shadow-sm" : config.toneClass,
        option ? "" : "opacity-60",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
            isActive ? "border-primary/20 bg-background text-primary" : "border-border bg-background text-muted-foreground",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tracking-tight text-foreground">{config.title}</span>
            {isActive ? <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-primary">Current</Badge> : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{config.description}</p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {option?.role_name ?? "Role not configured"}
          </p>
        </div>

        <div className="pt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open"}
        </div>
      </div>
    </button>
  );
}

export default function PortalSelectPage() {
  const router = useRouter();
  const [busyRoleId, setBusyRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const portalData = useMemo(() => {
    const token = getAccessToken();
    const payload = token ? parseJwt(token) : null;
    const user = getUserInfo();

    const availablePortals = Array.isArray(payload?.available_portals)
      ? (payload.available_portals as string[])
      : [];

    const switchOptions = Array.isArray(payload?.role_switch_options)
      ? (payload.role_switch_options as SwitchOption[])
      : [];

    return {
      payload,
      user,
      availablePortals,
      switchOptions,
      activePortal: String(payload?.active_portal ?? user?.active_portal ?? "").trim(),
    };
  }, []);

  useEffect(() => {
    if (!portalData.payload) {
      router.replace("/login");
      return;
    }

    if (portalData.availablePortals.length <= 1) {
      const fallbackPath = portalToPath(portalData.activePortal) || roleToPath(portalData.payload.role_name);
      router.replace(fallbackPath);
    }
  }, [portalData, router]);

  const handleChoosePortal = async (portalKey: string) => {
    try {
      setError("");
      const targetOption = portalData.switchOptions.find((option) => option.portal_key === portalKey);

      if (!targetOption) {
        throw new Error("No role is mapped to the selected portal.");
      }

      setBusyRoleId(targetOption.role_id);
      const switched = await switchRoleApi({ role_id: targetOption.role_id });
      const payload = parseJwt(switched.access_token);
      if (!payload) throw new Error("Invalid token after switching role.");

      const rolePath = roleToPath(payload.role_name);
      const role = rolePath.replaceAll("/", "");
      const existingUser = getUserInfo();

      saveUserInfo({
        name: existingUser?.name ?? "",
        email: existingUser?.email ?? "",
        role,
        role_name: String(payload.role_name ?? ""),
        active_portal: payload.active_portal,
        available_portals: Array.isArray(payload.available_portals) ? payload.available_portals : [],
        role_switch_options: Array.isArray(payload.role_switch_options) ? payload.role_switch_options : [],
        user_id: payload.sub_userid,
      });

      router.replace(portalToPath(payload.active_portal) || rolePath);
    } catch (err: any) {
      setError(err?.message || "Unable to switch portal. Please try again.");
    } finally {
      setBusyRoleId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <Card className="overflow-hidden border-border shadow-sm">
            <div className="h-2 bg-gradient-to-r from-primary via-cyan-500 to-emerald-500" />
            <CardHeader className="border-b border-border/70 pb-5">
              <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span>Multi-portal account</span>
              </div>
              <CardTitle className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                Choose where to continue
              </CardTitle>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                This account has more than one role. Select the portal you want to open now. If you only need payroll,
                use the Employee Portal.
              </p>
            </CardHeader>

            <CardContent className="space-y-4 py-6">
              {portalData.availablePortals.map((portalKey) => (
                <PortalOptionCard
                  key={portalKey}
                  portalKey={portalKey}
                  option={portalData.switchOptions.find((row) => row.portal_key === portalKey)}
                  activePortal={portalData.activePortal}
                  busyRoleId={busyRoleId}
                  onSelect={handleChoosePortal}
                />
              ))}

              {error ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm bg-muted/20">
            <CardHeader className="border-b border-border/70 pb-5">
              <CardTitle className="text-xl font-bold tracking-tight text-foreground">What changes here</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Portal access is role-based, but payroll and employee self-service live in the Employee Portal.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 py-6 text-sm leading-6 text-muted-foreground">
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="font-semibold text-foreground">Employee Portal</p>
                <p className="mt-1">Use this for payslips, leave, attendance, documents, and your personal profile.</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="font-semibold text-foreground">HR / Manager Portal</p>
                <p className="mt-1">Used for approvals, team management, and admin work. It does not expose My Payslips.</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="font-semibold text-foreground">Portal switching</p>
                <p className="mt-1">You can switch any time after login without signing in again.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
