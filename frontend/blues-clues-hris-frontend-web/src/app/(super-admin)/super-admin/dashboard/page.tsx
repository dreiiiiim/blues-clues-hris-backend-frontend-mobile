"use client";

import { useState } from "react";
import {
  Building2, CheckCircle2, Clock, XCircle, TrendingUp, MoreHorizontal,
  Search, Eye, ShieldCheck, Ban, Bell, LogOut, Settings,
  CreditCard, Calendar, AlertCircle, LayoutDashboard, ChevronDown,
  Users, RefreshCw
} from "lucide-react";

type Status = "active" | "pending" | "suspended" | "expired";

interface Company {
  id: string; name: string; industry: string;
  plan: "monthly" | "annual"; status: Status;
  email: string; submitted: string; renewalDate: string;
}

const COMPANIES: Company[] = [
  { id:"1", name:"Acme Corporation",    industry:"Technology",   plan:"annual",   status:"pending",   email:"hr@acme.com",           submitted:"Apr 18, 2026", renewalDate:"—"            },
  { id:"2", name:"Sunrise Retail Inc.", industry:"Retail",       plan:"monthly",  status:"active",    email:"admin@sunrise.ph",      submitted:"Mar 2, 2026",  renewalDate:"May 2, 2026"  },
  { id:"3", name:"MedCore Health",      industry:"Healthcare",   plan:"annual",   status:"active",    email:"it@medcore.com",        submitted:"Jan 15, 2026", renewalDate:"Jan 15, 2027" },
  { id:"4", name:"BuildRight Const.",   industry:"Construction", plan:"monthly",  status:"suspended", email:"hr@buildright.ph",      submitted:"Feb 10, 2026", renewalDate:"—"            },
  { id:"5", name:"EduFirst Academy",    industry:"Education",    plan:"annual",   status:"pending",   email:"admin@edufirst.edu.ph", submitted:"Apr 19, 2026", renewalDate:"—"            },
  { id:"6", name:"FinServ Group",       industry:"Finance",      plan:"annual",   status:"expired",   email:"ops@finserv.ph",        submitted:"Oct 1, 2025",  renewalDate:"Mar 31, 2026" },
];

const STATUS: Record<Status, { label: string; cls: string; Icon: React.ElementType }> = {
  active:    { label:"Active",    cls:"bg-green-100 text-green-700 border-green-200",   Icon: CheckCircle2 },
  pending:   { label:"Pending",   cls:"bg-amber-100 text-amber-700 border-amber-200",   Icon: Clock        },
  suspended: { label:"Suspended", cls:"bg-orange-100 text-orange-700 border-orange-200",Icon: Ban          },
  expired:   { label:"Expired",   cls:"bg-red-100 text-red-700 border-red-200",         Icon: XCircle      },
};

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS[status];
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, iconBg }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${iconBg}`}><Icon className="w-5 h-5" /></div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { label:"Dashboard",     icon: LayoutDashboard, active: true  },
  { label:"Companies",     icon: Building2,       active: false },
  { label:"Subscriptions", icon: CreditCard,      active: false },
  { label:"Renewals",      icon: Calendar,        active: false },
  { label:"Settings",      icon: Settings,        active: false },
];

export default function SuperAdminDashboard() {
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<Status | "all">("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);

  const filtered = COMPANIES.filter(c => {
    const q = search.toLowerCase();
    return (filter === "all" || c.status === filter) &&
           (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  });

  const pending = COMPANIES.filter(c => c.status === "pending");
  const active  = COMPANIES.filter(c => c.status === "active").length;

  return (
    <div className="min-h-screen bg-[#eff6ff] flex">

      {/* ── SIDEBAR ── */}
      <aside className="w-64 bg-gradient-to-b from-[#0f172a] to-[#172554] flex-col min-h-screen fixed left-0 top-0 z-20 hidden md:flex">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#2563eb] rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">BlueTribe</p>
              <p className="text-white/40 text-xs">Super Admin Portal</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ label, icon: Icon, active }) => (
            <button key={label} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              active ? "bg-[#2563eb] text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />{label}
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer">
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="md:ml-64 flex-1 flex flex-col min-h-screen">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-4 sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">Subscription Dashboard</h1>
            <p className="text-xs text-gray-400">April 20, 2026</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
              <Bell className="w-5 h-5 text-gray-500" />
              {pending.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-gray-100">
              <div className="w-8 h-8 bg-[#1e3a8a] rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">BT</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">BlueTribe Admin</p>
                <p className="text-xs text-gray-400">admin@bluetribe.ph</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Building2}    label="Total Companies"    value={COMPANIES.length} sub="All time"               iconBg="bg-blue-100 text-blue-600"   />
            <StatCard icon={CheckCircle2} label="Active"             value={active}           sub="Currently subscribed"  iconBg="bg-green-100 text-green-600" />
            <StatCard icon={Clock}        label="Pending Approvals"  value={pending.length}   sub="Awaiting review"       iconBg="bg-amber-100 text-amber-600" />
            <StatCard icon={TrendingUp}   label="Monthly Revenue"    value="₱87,460"          sub="From active subs"      iconBg="bg-indigo-100 text-indigo-600"/>
          </div>

          {/* Pending warning */}
          {pending.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">
                  {pending.length} {pending.length === 1 ? "company" : "companies"} pending approval
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {pending.map(c => c.name).join(", ")} — review and approve to provision access.
                </p>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Table header */}
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">All Companies</h2>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search company or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all"
                  />
                </div>
                {/* Filter */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilter(!showFilter)}
                    className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {filter === "all" ? "All Status" : STATUS[filter].label}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {showFilter && (
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                      {(["all","active","pending","suspended","expired"] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => { setFilter(s); setShowFilter(false); }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 capitalize cursor-pointer ${filter===s?"font-semibold text-[#1e3a8a]":"text-gray-700"}`}
                        >{s === "all" ? "All Status" : s}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Table (desktop) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#eff6ff] border-b border-blue-100">
                    {["Company","Industry","Plan","Status","Admin Email","Renewal",""].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.12em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(co => (
                    <tr key={co.id} className="hover:bg-[#eff6ff]/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-[#1e3a8a]" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{co.name}</p>
                            <p className="text-xs text-gray-400">Submitted {co.submitted}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{co.industry}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          co.plan === "annual" ? "bg-blue-100 text-[#1e3a8a]" : "bg-gray-100 text-gray-600"
                        }`}>
                          {co.plan === "annual" ? "Annual" : "Monthly"}
                        </span>
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={co.status} /></td>
                      <td className="px-6 py-4 text-gray-600 text-xs">{co.email}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">{co.renewalDate}</td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenu(openMenu === co.id ? null : co.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenu === co.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 cursor-pointer">
                                <Eye className="w-4 h-4" /> View Details
                              </button>
                              {co.status === "pending" && <>
                                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-green-50 text-green-700 cursor-pointer">
                                  <CheckCircle2 className="w-4 h-4" /> Approve
                                </button>
                                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50 text-red-600 cursor-pointer">
                                  <XCircle className="w-4 h-4" /> Reject
                                </button>
                              </>}
                              {co.status === "active" && (
                                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-orange-50 text-orange-600 cursor-pointer">
                                  <Ban className="w-4 h-4" /> Suspend
                                </button>
                              )}
                              <div className="border-t border-gray-100 mt-1 pt-1">
                                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-blue-50 text-[#1e3a8a] cursor-pointer">
                                  <ShieldCheck className="w-4 h-4" /> Provision Credentials
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <Building2 className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No companies match your search.</p>
                </div>
              )}
            </div>

            {/* Cards (mobile) */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map(co => (
                <div key={co.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-[#1e3a8a]" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{co.name}</p>
                        <p className="text-xs text-gray-400">{co.industry}</p>
                      </div>
                    </div>
                    <StatusBadge status={co.status} />
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className={`px-2 py-0.5 rounded-full font-bold ${co.plan==="annual"?"bg-blue-100 text-[#1e3a8a]":"bg-gray-100 text-gray-600"}`}>
                      {co.plan === "annual" ? "Annual" : "Monthly"}
                    </span>
                    <span>{co.email}</span>
                    {co.renewalDate !== "—" && <span>Renews {co.renewalDate}</span>}
                  </div>
                  {co.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <button className="flex-1 py-2 rounded-lg bg-green-100 text-green-700 text-xs font-bold cursor-pointer hover:bg-green-200 transition-colors">
                        Approve
                      </button>
                      <button className="flex-1 py-2 rounded-lg bg-red-100 text-red-600 text-xs font-bold cursor-pointer hover:bg-red-200 transition-colors">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">Showing {filtered.length} of {COMPANIES.length}</p>
              <div className="flex gap-1">
                {["←","1","2","3","→"].map((p, i) => (
                  <button key={i} className={`w-8 h-8 text-xs rounded-lg cursor-pointer transition-colors ${
                    p==="1" ? "bg-[#1e3a8a] text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>{p}</button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
