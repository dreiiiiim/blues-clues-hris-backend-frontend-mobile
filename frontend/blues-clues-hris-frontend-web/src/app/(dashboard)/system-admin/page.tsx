"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getUserInfo } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Building2,
  Clock3,
  CreditCard,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";

interface DashboardStats {
  total: number;
}

interface DashboardCompany {
  company_id: string;
  company_name: string;
}

interface DashboardUser {
  user_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  account_status: "Active" | "Inactive" | "Pending";
  invite_expires_at: string | null;
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await authFetch(`${API_BASE_URL}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "Request failed");
  }
  return data as T;
}

function formatInviteCountdown(expiresAt: string | null, now: number) {
  if (!expiresAt) return "No active invite";

  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return "Unknown";

  const diff = expiry - now;
  if (diff <= 0) return "Expired";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatInviteDeadline(value: string | null) {
  if (!value) return "No deadline";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown deadline";

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-5">
        <div className={`mb-4 inline-flex rounded-xl p-2.5 ${tone}`}>{icon}</div>
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

export default function SystemAdminDashboardPage() {
  const user = getUserInfo();
  const adminName = user?.name || "System Admin";

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [companies, setCompanies] = useState<DashboardCompany[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useWelcomeToast(adminName, "System Administration");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiFetch<DashboardStats>("/users/stats"),
      apiFetch<DashboardUser[]>("/users"),
      apiFetch<DashboardCompany[]>("/users/companies"),
    ])
      .then(([nextStats, nextUsers, nextCompanies]) => {
        if (cancelled) return;
        setStats(nextStats);
        setUsers(nextUsers);
        setCompanies(nextCompanies);
        setFetchError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const companyNameById = (companyId: string | null) => {
    if (!companyId) return "Unassigned";
    return companies.find((company) => company.company_id === companyId)?.company_name ?? companyId;
  };

  const pendingUsers = useMemo(
    () =>
      users
        .filter((item) => item.account_status === "Pending")
        .sort((a, b) => {
          const aTime = a.invite_expires_at ? new Date(a.invite_expires_at).getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.invite_expires_at ? new Date(b.invite_expires_at).getTime() : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        }),
    [users],
  );

  const inactiveUsers = users.filter((item) => item.account_status === "Inactive").length;
  const nextInviteToExpire = pendingUsers.find((item) => item.invite_expires_at);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-8 md:py-9">
        <div className="absolute inset-y-0 right-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_58%)]" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
              Platform Overview
            </Badge>
            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              {adminName}, welcome to {companies[0]?.company_name ?? "your organization"}'s admin panel.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
              Review account health, watch expiring invites, and manage your team from one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[420px]">
            {[
              { label: "Users", value: stats?.total ?? "—" },
              { label: "Pending", value: pendingUsers.length },
              { label: "Inactive", value: inactiveUsers },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">{item.label}</p>
                <p className="mt-2 text-2xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {fetchError && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load dashboard data. Refresh the page or verify the API connection.
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats?.total ?? "—"}
          subtitle="All users across tenants"
          icon={<Users className="h-5 w-5" />}
          tone="bg-sky-100 text-sky-700"
        />
        <StatCard
          title="Active Users"
          value={users.filter(u => u.account_status === "Active").length}
          subtitle="Currently active accounts"
          icon={<Building2 className="h-5 w-5" />}
          tone="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          title="Pending Invites"
          value={pendingUsers.length}
          subtitle="Accounts still awaiting activation"
          icon={<ShieldAlert className="h-5 w-5" />}
          tone="bg-amber-100 text-amber-700"
        />
        <StatCard
          title="Next Expiry"
          value={nextInviteToExpire ? formatInviteCountdown(nextInviteToExpire.invite_expires_at, now) : "None"}
          subtitle={
            nextInviteToExpire
              ? `${nextInviteToExpire.first_name} ${nextInviteToExpire.last_name}`
              : "No pending invites in queue"
          }
          icon={<Clock3 className="h-5 w-5" />}
          tone="bg-rose-100 text-rose-700"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Attention Queue</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pending invites sorted by the soonest expiry deadline.
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {pendingUsers.length} pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                No pending invitations need attention right now.
              </div>
            ) : (
              pendingUsers.slice(0, 5).map((item) => {
                const countdown = formatInviteCountdown(item.invite_expires_at, now);
                const isExpired = countdown === "Expired";

                return (
                  <div
                    key={item.user_id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {item.first_name} {item.last_name}
                        </p>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-[0.18em]">
                          {companyNameById(item.company_id)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Expires on {formatInviteDeadline(item.invite_expires_at)}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className={`text-lg font-bold ${isExpired ? "text-red-600" : "text-amber-600"}`}>{countdown}</p>
                      <p className="text-xs text-muted-foreground">
                        {isExpired ? "Needs a new invite" : "Remaining before expiry"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Move directly into the areas you are likely to use next.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  href: "/system-admin/users",
                  title: "User Management",
                  copy: "Create, edit, and deactivate accounts in your organization.",
                  icon: Users,
                },
                {
                  href: "/system-admin/subscriptions",
                  title: "Subscriptions",
                  copy: "Review plan changes, renewal timing, and tenant billing posture.",
                  icon: CreditCard,
                },
                {
                  href: "/system-admin/settings",
                  title: "Global Settings",
                  copy: "Adjust lifecycle permissions and platform-wide access rules.",
                  icon: Settings,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-start justify-between rounded-2xl border border-border/70 bg-background px-4 py-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="pr-4">
                      <div className="mb-2 inline-flex rounded-xl bg-primary/10 p-2 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.copy}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Control Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                <div className="mb-2 flex items-center gap-2 text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Multi-tenant isolation is active</span>
                </div>
                <p>
                  All user and department data is scoped to your organization. Create and manage accounts from the user
                  management screen.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                <p className="font-semibold text-foreground">Current footprint</p>
                <p className="mt-1">
                  {companies[0]?.company_name ?? "Your organization"} — {stats?.total ?? 0} total user accounts,{" "}
                  {users.filter(u => u.account_status === "Active").length} active, and {pendingUsers.length} invites in
                  activation flow.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
