"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Filter,
  MoreHorizontal,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/authApi";
import { getUserInfo } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";

type Employee = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_id: number;
  account_status: string | null;
};

const ITEMS_PER_PAGE = 5;

export default function ManagerDashboardPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const user = getUserInfo();
  const userName = user?.name || "Manager";
  useWelcomeToast(userName, "Management Portal");

  useEffect(() => {
    Promise.all([
      authFetch(`${API_BASE_URL}/users`).then((r) => r.json()),
      authFetch(`${API_BASE_URL}/users/stats`).then((r) => r.json()),
    ])
      .then(([emps, stats]) => {
        setEmployees(Array.isArray(emps) ? emps.filter((e: Employee) => e.email !== user?.email) : []);
        setTotalCount(stats?.total ?? null);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredData = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return employees.filter((e) => {
      const name = `${e.first_name ?? ""} ${e.last_name ?? ""}`.toLowerCase();
      return name.includes(q) || e.email.toLowerCase().includes(q);
    });
  }, [searchTerm, employees]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const currentTableData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const teamSizeDisplay = totalCount !== null ? String(totalCount) : "-";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Management Portal</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Welcome, {userName}</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Stay on top of your team with a cleaner view of attendance, requests, and direct reports.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:w-[320px]">
            <HeroStat label="Team Size" value={teamSizeDisplay} />
            <HeroStat label="Filtered Rows" value={String(filteredData.length)} />
          </div>
        </div>
      </section>

      {/* Welcome card */}
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Manager Dashboard</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Your Team Overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Monitor your direct reports, track attendance, and manage your team from one place.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Team Members</p>
            <p className="mt-1 text-lg font-bold">{totalCount ?? "—"}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard icon={Users}       label="My Team Size"     value={totalCount !== null ? String(totalCount) : "—"} sub="Company Members"    trend={totalCount !== null ? `${totalCount} total` : "Loading..."} />
        {/* TODO: wire to dedicated endpoint when available */}
        <MetricCard icon={Clock}       label="Pending Requests" value="—" sub="Time-off approvals"  trend="Coming soon" isAlert />
        <MetricCard icon={CheckCircle} label="Approvals Needed" value="—" sub="Performance reviews" trend="Coming soon" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))] px-5 py-4">
          <h2 className="text-base font-bold tracking-tight">Management Modules</h2>
          <p className="text-xs text-muted-foreground">Quick access to tools used in daily operations</p>
        </div>
        <div className="p-5">
          <Link
            href="/manager/timekeeping"
            className="group flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Team Timekeeping</p>
                <p className="text-xs text-muted-foreground">Monitor attendance and worked hours</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))] p-5">
          <div>
            <h2 className="text-base font-bold tracking-tight">Direct Reports</h2>
            <p className="text-xs text-muted-foreground">Team members in your company</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search team..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 w-full bg-background pl-9 sm:w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[680px] w-full text-left text-sm">
            <thead className="border-y border-border bg-muted/40 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    Loading team...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-destructive">
                    Failed to load team data. Please refresh or contact support.
                  </td>
                </tr>
              ) : currentTableData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No team members found.
                  </td>
                </tr>
              ) : (
                currentTableData.map((row) => {
                  const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
                  return (
                    <tr key={row.user_id} className="transition-colors hover:bg-primary/5">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full border border-primary/10 bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <p className="font-semibold text-foreground">{name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{row.email}</td>
                      <td className="px-5 py-4">
                        <StatusBadge status={row.account_status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {filteredData.length > 0
              ? `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} to ${Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} of ${filteredData.length}`
              : "No results"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage === 1 || totalPages === 0}
              className="h-8 gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="h-8 gap-1"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">{label}</p>
      <p className="mt-1 text-xl font-bold leading-none">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = status?.toLowerCase();
  if (normalized === "active") {
    return (
      <Badge className="border border-green-200 bg-green-100 text-[9px] text-green-700 hover:bg-green-100">
        Active
      </Badge>
    );
  }

  if (normalized === "inactive") {
    return (
      <Badge className="border border-red-200 bg-red-100 text-[9px] text-red-700 hover:bg-red-100">
        Inactive
      </Badge>
    );
  }

  return (
    <Badge className="border border-amber-200 bg-amber-100 text-[9px] text-amber-700 hover:bg-amber-100">
      Pending
    </Badge>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  isAlert,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  trend: string;
  isAlert?: boolean;
}) {
  return (
    <Card className="border-border/70 bg-[linear-gradient(160deg,rgba(37,99,235,0.05),rgba(15,23,42,0.00))] shadow-sm">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className={`rounded-lg p-2 ${isAlert ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
          <span
            className={`rounded-md px-2 py-1 text-[10px] font-bold ${
              isAlert ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground uppercase"
            }`}
          >
            {trend}
          </span>
        </div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <h2 className="text-2xl font-bold tracking-tight">{value}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
