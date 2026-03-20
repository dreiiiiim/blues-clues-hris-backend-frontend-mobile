"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserInfo } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { getSubscriptions, type Subscription } from "@/lib/adminApi";
import {
  Users, Building2, Mail, Clock,
  UserPlus, CreditCard, Settings, ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  account_status: "Active" | "Inactive" | "Pending";
  invite_expires_at: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatExpiry(iso: string | null): string {
  if (!iso) return "No expiry set";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function countdown(iso: string | null): { label: string; urgent: boolean; expired: boolean } {
  if (!iso) return { label: "No active invite", urgent: false, expired: false };
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "Expired", urgent: true, expired: true };
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) return { label: `${days}d ${hours}h`, urgent: days <= 1, expired: false };
  if (hours > 0) return { label: `${hours}h ${mins}m`, urgent: true, expired: false };
  return { label: `${mins}m`, urgent: true, expired: false };
}

function nextExpiry(pending: Employee[]): { label: string; name: string } {
  const withExpiry = pending
    .filter(u => u.invite_expires_at)
    .sort((a, b) => new Date(a.invite_expires_at!).getTime() - new Date(b.invite_expires_at!).getTime());

  if (!withExpiry.length) return { label: "—", name: "No pending invites" };
  const first = withExpiry[0];
  const { label } = countdown(first.invite_expires_at);
  return { label, name: `${first.first_name} ${first.last_name}` };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const user      = getUserInfo();
  const adminName = user?.name || "Admin";

  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [totalUsers, setTotalUsers]     = useState<number>(0);
  const [loading, setLoading]           = useState(true);
  const [resendingId, setResendingId]   = useState<string | null>(null);

  useWelcomeToast(adminName, "System Administration");

  useEffect(() => {
    Promise.all([
      authFetch(`${API_BASE_URL}/users/stats`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/users`).then(r => r.json()),
      getSubscriptions().catch(() => [] as Subscription[]),
    ]).then(([stats, users, subs]) => {
      setTotalUsers(stats?.total ?? 0);
      setEmployees(Array.isArray(users) ? users : []);
      setSubscriptions(Array.isArray(subs) ? subs : []);
    }).finally(() => setLoading(false));
  }, []);

  async function handleResendInvite(emp: Employee) {
    setResendingId(emp.user_id);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/${emp.user_id}/resend-invite`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to resend invite.");
      setEmployees(prev => prev.map(e =>
        e.user_id === emp.user_id ? { ...e, invite_expires_at: data.invite_expires_at } : e
      ));
      toast.success(`Invite resent to ${emp.email}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend invite.");
    } finally {
      setResendingId(null);
    }
  }

  const pending  = employees.filter(e => e.account_status === "Pending");
  const inactive = employees.filter(e => e.account_status === "Inactive");
  const companies = subscriptions.length;
  const expiry   = nextExpiry(pending);

  // Attention queue: sort by soonest expiry, those without expiry go last
  const attentionQueue = [...pending].sort((a, b) => {
    if (!a.invite_expires_at && !b.invite_expires_at) return 0;
    if (!a.invite_expires_at) return 1;
    if (!b.invite_expires_at) return -1;
    return new Date(a.invite_expires_at).getTime() - new Date(b.invite_expires_at).getTime();
  });

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Hero card */}
      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-7 py-8 text-white shadow-sm">
        <div className="absolute inset-y-0 right-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="relative z-10">
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] border border-white/20 bg-white/10 text-white/80 rounded-full px-3 py-1 mb-4">
            Platform Overview
          </span>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold leading-snug max-w-xl">
                {adminName}, the platform is live across{" "}
                <span className="text-emerald-300">{loading ? "—" : companies} {companies === 1 ? "company" : "companies"}</span>.
              </h1>
              <p className="mt-3 text-sm text-white/65 max-w-xl">
                Review account health, watch expiring invites, and jump into tenant operations without leaving the control surface.
              </p>
            </div>
            <div className="flex items-stretch gap-3 shrink-0">
              {[
                { label: "Users",    value: totalUsers },
                { label: "Pending",  value: pending.length },
                { label: "Inactive", value: inactive.length },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center justify-center rounded-xl border border-white/15 bg-white/8 px-5 py-3 min-w-[72px] backdrop-blur">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">{label}</p>
                  <p className="text-2xl font-bold">{loading ? "—" : value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: Users,
            color: "bg-blue-50 text-blue-600",
            label: "Total Users",
            value: loading ? "—" : String(totalUsers),
            sub: "All users across tenants",
          },
          {
            icon: Building2,
            color: "bg-emerald-50 text-emerald-600",
            label: "Companies",
            value: loading ? "—" : String(companies),
            sub: "Organizations onboarded",
          },
          {
            icon: Mail,
            color: "bg-amber-50 text-amber-600",
            label: "Pending Invites",
            value: loading ? "—" : String(pending.length),
            sub: "Accounts still awaiting activation",
          },
          {
            icon: Clock,
            color: "bg-red-50 text-red-500",
            label: "Next Expiry",
            value: loading ? "—" : expiry.label,
            sub: expiry.name,
          },
        ].map(({ icon: Icon, color, label, value, sub }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className={`p-2 rounded-lg w-fit mb-4 ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
          </div>
        ))}
      </div>

      {/* Bottom row */}
      <div className="grid md:grid-cols-[1fr_360px] gap-6 items-start">

        {/* Attention Queue */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <h2 className="font-bold text-base">Attention Queue</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Pending invites sorted by the soonest expiry deadline.</p>
            </div>
            {pending.length > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0 mt-0.5">
                {pending.length} pending
              </span>
            )}
          </div>

          <div className="divide-y divide-border">
            {loading ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">Loading...</p>
            ) : attentionQueue.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No pending invitations. All caught up!</p>
            ) : attentionQueue.map(u => {
              const cd = countdown(u.invite_expires_at);
              return (
                <div key={u.user_id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground">
                          {u.first_name} {u.last_name}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                      {u.invite_expires_at && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Expires on {formatExpiry(u.invite_expires_at)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      {cd.expired || !u.invite_expires_at ? (
                        <>
                          <p className={`text-xs font-bold ${cd.expired ? "text-red-500" : "text-muted-foreground"}`}>
                            {cd.expired ? "Expired" : "No active invite"}
                          </p>
                          <button
                            onClick={() => handleResendInvite(u)}
                            disabled={resendingId === u.user_id}
                            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3 w-3 ${resendingId === u.user_id ? "animate-spin" : ""}`} />
                            {resendingId === u.user_id ? "Sending..." : "Resend Invite"}
                          </button>
                        </>
                      ) : (
                        <>
                          <p className={`text-sm font-bold ${cd.urgent ? "text-red-500" : "text-amber-600"}`}>
                            {cd.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Remaining before expiry</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {attentionQueue.length > 0 && (
            <div className="px-6 py-3 border-t border-border bg-muted/10">
              <Link href="/system-admin/users" className="text-xs text-primary font-semibold hover:underline">
                Manage all users →
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="font-bold text-base">Quick Actions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Move directly into the areas you are likely to use next.</p>
          </div>
          <div className="divide-y divide-border">
            {[
              {
                href: "/system-admin/users",
                icon: UserPlus,
                label: "User Management",
                sub: "Create, edit, move, and deactivate accounts across companies.",
              },
              {
                href: "/system-admin/subscriptions",
                icon: CreditCard,
                label: "Subscriptions",
                sub: "Review plan changes, renewal timing, and tenant billing posture.",
              },
              {
                href: "/system-admin/timekeeping",
                icon: Clock,
                label: "Timekeeping",
                sub: "Company-wide attendance records and compliance tracking.",
              },
              {
                href: "/system-admin/settings",
                icon: Settings,
                label: "Global Settings",
                sub: "Configure lifecycle module permissions per role.",
              },
            ].map(({ href, icon: Icon, label, sub }) => (
              <Link key={href} href={href} className="flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors group">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0 mt-0.5">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
