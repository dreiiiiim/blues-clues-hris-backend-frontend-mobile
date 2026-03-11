"use client";

import { useEffect, useState } from "react";
import { getUserInfo } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { getUserStats, getBillingStats } from "@/lib/adminApi";
import type { UserStats, BillingStats } from "@/lib/adminApi";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Building2, DollarSign, ShieldAlert } from "lucide-react";

export default function SystemAdminDashboardPage() {
  const user     = getUserInfo();
  const userName = user?.name || "System Admin";
  useWelcomeToast(userName, "System Administration");

  const [userStats,    setUserStats]    = useState<UserStats | null>(null);
  const [billingStats, setBillingStats] = useState<BillingStats | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState(false);

  useEffect(() => {
    Promise.all([
      getUserStats(),
      getBillingStats(),
    ])
      .then(([uStats, bStats]) => {
        setUserStats(uStats);
        setBillingStats(bStats);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* Welcome Banner */}
      <div className="relative bg-[#dc2626] overflow-hidden rounded-xl p-8 text-white shadow-sm h-48 flex flex-col justify-center">
        <div className="absolute top-0 right-10 w-48 h-48 bg-white/10 rounded-full -translate-y-1/4 translate-x-1/4" />
        <div className="absolute bottom-0 right-32 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-bold mb-3">Welcome, {userName}!</h1>
          <p className="text-white/80 text-sm leading-relaxed">
            You are logged in as System Administrator. Full platform access is available to you.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      {fetchError ? (
        <p className="text-sm text-destructive text-center py-4">
          Failed to load dashboard stats. Please refresh or contact support.
        </p>
      ) : (
        <div className="grid md:grid-cols-4 gap-6">
          <StatCard
            icon={Building2}
            label="Active Subscriptions"
            value={loading ? null : (billingStats?.active_subscriptions ?? null)}
            sub="Tenant organizations"
            color="blue"
          />
          <StatCard
            icon={Users}
            label="Total Users"
            value={loading ? null : (userStats?.total ?? null)}
            sub="Across all tenants"
            color="indigo"
          />
          <StatCard
            icon={DollarSign}
            label="Monthly Revenue"
            value={loading ? null : (billingStats?.total_mrr != null ? `$${billingStats.total_mrr.toLocaleString()}` : null)}
            sub="Recurring"
            color="green"
          />
          <StatCard
            icon={ShieldAlert}
            label="Pending Users"
            value={loading ? null : (userStats?.pending ?? null)}
            sub="Awaiting activation"
            color="amber"
            isAlert={!!userStats?.pending}
          />
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

type Color = "blue" | "indigo" | "green" | "amber";

const colorMap: Record<Color, { icon: string }> = {
  blue:   { icon: "bg-blue-50 text-blue-600"    },
  indigo: { icon: "bg-indigo-50 text-indigo-600" },
  green:  { icon: "bg-green-50 text-green-600"   },
  amber:  { icon: "bg-amber-50 text-amber-600"   },
};

function StatCard({
  icon: Icon, label, value, sub, color, isAlert = false,
}: {
  icon: any;
  label: string;
  value: number | string | null;
  sub: string;
  color: Color;
  isAlert?: boolean;
}) {
  const c = colorMap[color];
  return (
    <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2 rounded-lg ${isAlert ? "bg-destructive/10 text-destructive" : c.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
          {label}
        </p>
        <h2 className="text-2xl font-bold tracking-tight">
          {value === null ? <span className="text-muted-foreground/40">—</span> : value}
        </h2>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
