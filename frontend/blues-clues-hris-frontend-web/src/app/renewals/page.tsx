"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Search,
  ShieldOff,
  TimerReset,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

const renewals = [
  {
    company: "Bluewave Logistics",
    plan: "Enterprise",
    renewalDate: "2026-05-05",
    daysRemaining: 7,
    status: "Due Soon",
    email: "admin@bluewave.com",
  },
  {
    company: "Northstar Retail",
    plan: "Premium",
    renewalDate: "2026-05-20",
    daysRemaining: 22,
    status: "Upcoming",
    email: "admin@northstar.com",
  },
  {
    company: "MetroCare Services",
    plan: "Standard",
    renewalDate: "2026-04-20",
    daysRemaining: -8,
    status: "Expired",
    email: "admin@metrocare.com",
  },
  {
    company: "BrightPath Solutions",
    plan: "Premium",
    renewalDate: "2026-05-01",
    daysRemaining: 3,
    status: "Due Soon",
    email: "admin@brightpath.com",
  },
];

function statusStyle(status: string) {
  if (status === "Expired") return "bg-red-50 text-red-600 border-red-200";
  if (status === "Due Soon") return "bg-amber-50 text-amber-600 border-amber-200";
  return "bg-emerald-50 text-emerald-600 border-emerald-200";
}

function daysLabel(days: number) {
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return "Due today";
  return `${days} days left`;
}

export default function RenewalsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const filteredRenewals = useMemo(() => {
    return renewals.filter((item) => {
      const matchesSearch =
        item.company.toLowerCase().includes(query.toLowerCase()) ||
        item.email.toLowerCase().includes(query.toLowerCase()) ||
        item.plan.toLowerCase().includes(query.toLowerCase());

      const matchesStatus = status === "All" || item.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [query, status]);

  const upcoming = renewals.filter((item) => item.status === "Upcoming").length;
  const dueSoon = renewals.filter((item) => item.status === "Due Soon").length;
  const expired = renewals.filter((item) => item.status === "Expired").length;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar
        persona="system-admin"
        additionalItems={[
          {
            name: "Renewals",
            href: "/renewals",
            icon: TimerReset,
          },
        ]}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar persona="system-admin" />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/10">
          <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <section className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-7 py-8 text-white shadow-sm">
              <div className="absolute -top-16 -right-16 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="absolute -bottom-12 right-48 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />

              <div className="relative z-10">
                <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] border border-white/20 bg-white/10 text-white/80 rounded-full px-3 py-1 mb-4">
                  Subscription Monitoring
                </span>

                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold leading-snug">
                      Renewals Management
                    </h1>
                    <p className="mt-3 text-sm text-white/65 max-w-xl">
                      Track upcoming, due soon, and expired company subscriptions.
                    </p>
                  </div>

                  <div className="flex items-stretch gap-3 shrink-0">
                    {[
                      { label: "Upcoming", value: upcoming },
                      { label: "Due Soon", value: dueSoon },
                      { label: "Expired", value: expired },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-5 py-3 min-w-18 backdrop-blur-sm"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">
                          {item.label}
                        </p>
                        <p className="text-2xl font-bold text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: "Upcoming Renewals",
                  value: upcoming,
                  icon: Clock,
                  color: "bg-emerald-100 text-emerald-600",
                  bar: "bg-emerald-500",
                },
                {
                  label: "Due Soon",
                  value: dueSoon,
                  icon: Bell,
                  color: "bg-amber-100 text-amber-600",
                  bar: "bg-amber-500",
                },
                {
                  label: "Expired",
                  value: expired,
                  icon: ShieldOff,
                  color: "bg-red-100 text-red-600",
                  bar: "bg-red-500",
                },
              ].map(({ label, value, icon: Icon, color, bar }) => (
                <div key={label} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className={`h-1 w-full ${bar}`} />
                  <div className="p-5">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      {label}
                    </p>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Based on current subscription records
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 border-b border-border">
                <div>
                  <h2 className="font-bold text-base">Company Renewal List</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Review renewal status and take quick actions.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search company..."
                      className="h-10 w-full sm:w-64 rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option>All</option>
                    <option>Upcoming</option>
                    <option>Due Soon</option>
                    <option>Expired</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <th className="px-6 py-4">Company</th>
                      <th className="px-6 py-4">Current Plan</th>
                      <th className="px-6 py-4">Renewal Date</th>
                      <th className="px-6 py-4">Days Remaining</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Admin Email</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {filteredRenewals.map((item) => (
                      <tr
                        key={item.company}
                        className={item.status === "Expired" ? "bg-red-50/30" : "hover:bg-muted/20"}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-foreground">{item.company}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-muted-foreground">{item.plan}</td>
                        <td className="px-6 py-4 text-muted-foreground">{item.renewalDate}</td>
                        <td className="px-6 py-4 font-medium">{daysLabel(item.daysRemaining)}</td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyle(item.status)}`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-muted-foreground">{item.email}</td>

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button className="h-8 w-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center" title="Send reminder">
                              <Bell className="h-4 w-4" />
                            </button>
                            <button className="h-8 w-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center" title="Mark renewed">
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            {item.status === "Expired" && (
                              <button className="h-8 w-8 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center" title="Suspend">
                                <ShieldOff className="h-4 w-4" />
                              </button>
                            )}
                            <button className="h-8 w-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center" title="View company">
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-3 border-t border-border bg-muted/10 text-xs text-muted-foreground">
                Showing {filteredRenewals.length} renewal records.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}