"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";
import {
  ScrollText, Briefcase, ClipboardList, Shield,
  Activity, UserCheck, Search, ChevronLeft, ChevronRight,
  RefreshCw, Loader2, ArrowLeft,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditLog = {
  log_id: string;
  action: string;
  performed_by: string;
  target_user_id: string | null;
  timestamp: string;
};

const PAGE_SIZE = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActionMeta(action: string): { icon: any; bg: string; text: string; category: string } {
  const l = action.toLowerCase();
  if (l.includes("job posting"))  return { icon: Briefcase,     bg: "bg-blue-50",   text: "text-blue-600",   category: "Job"         };
  if (l.includes("application"))  return { icon: ClipboardList, bg: "bg-purple-50", text: "text-purple-600", category: "Application" };
  if (l.includes("user") || l.includes("invite") || l.includes("account"))
                                   return { icon: UserCheck,     bg: "bg-green-50",  text: "text-green-600",  category: "User"        };
  if (l.includes("role"))          return { icon: Shield,        bg: "bg-amber-50",  text: "text-amber-600",  category: "Role"        };
  return                                  { icon: Activity,      bg: "bg-muted",     text: "text-muted-foreground", category: "System" };
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function shortId(uuid: string) {
  return uuid.slice(0, 8).toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [logs, setLogs]         = useState<AuditLog[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchLogs = useCallback(async (pageNum: number, showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [logsRes, countRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/audit/logs?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`),
        authFetch(`${API_BASE_URL}/audit/logs/count`),
      ]);
      const [logsData, countData] = await Promise.all([logsRes.json(), countRes.json()]);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setTotal(countData?.count ?? 0);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLogs(page); }, [page, fetchLogs]);

  const displayed = search.trim()
    ? logs.filter((l) => l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.performed_by.toLowerCase().includes(search.toLowerCase()))
    : logs;

  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in duration-500">

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-7 py-7 text-white shadow-sm">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.10),transparent_60%)]" />
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Link href="/system-admin" className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80 transition-colors">
                <ArrowLeft className="h-3 w-3" /> Dashboard
              </Link>
              <span className="text-white/20">/</span>
              <span className="text-[11px] text-white/70 font-medium">Audit Logs</span>
            </div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-white/10 border border-white/15">
                <ScrollText className="h-5 w-5 text-white/80" />
              </div>
              <h1 className="text-2xl font-bold">Audit Logs</h1>
            </div>
            <p className="text-sm text-white/60 mt-1 max-w-xl">
              A chronological record of all system actions — user management, job postings, applications, and role changes.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/15 bg-white/8 px-6 py-4 text-center shrink-0 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Total Events</p>
            <p className="text-3xl font-bold">{loading ? "—" : total.toLocaleString()}</p>
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by action or user ID…"
            className="h-9 w-full pl-9 pr-3 rounded-lg border border-border bg-card text-sm shadow-xs focus:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all"
          />
        </div>
        <button
          onClick={() => fetchLogs(page, true)}
          disabled={refreshing}
          className="h-9 px-3 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors inline-flex items-center gap-2 text-sm font-medium"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          Page <span className="font-bold text-foreground">{page + 1}</span> of <span className="font-bold text-foreground">{totalPages}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-5 py-3 border-b border-border bg-muted/30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-8">Type</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Action</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-24 text-center">Performed By</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-28 text-right">Time</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          displayed.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
              <ScrollText className="h-8 w-8 opacity-20" />
              <p className="text-sm">{search ? "No logs match your search." : "No audit logs recorded yet."}</p>
            </div>
          ) : (
          <div className="divide-y divide-border">
            {displayed.map((log) => {
              const meta = getActionMeta(log.action);
              const Icon = meta.icon;
              return (
                <div
                  key={log.log_id}
                  className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-start px-5 py-3.5 hover:bg-muted/20 transition-colors"
                >
                  {/* Icon */}
                  <div className={`p-1.5 rounded-lg w-8 h-8 flex items-center justify-center shrink-0 ${meta.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${meta.text}`} />
                  </div>

                  {/* Action */}
                  <div className="min-w-0">
                    <p className="text-sm text-foreground leading-snug">{log.action}</p>
                    <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.bg} ${meta.text}`}>
                      {meta.category}
                    </span>
                  </div>

                  {/* Performer */}
                  <div className="w-24 text-center">
                    <span className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      {log.performed_by ? shortId(log.performed_by) : "—"}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="w-28 text-right">
                    <p className="text-xs font-medium text-foreground">{relativeTime(log.timestamp)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDateTime(log.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          )
        )}

        {/* Pagination footer */}
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()} entries
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-8 w-8 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-8 w-8 rounded-lg border text-xs font-bold transition-colors ${
                      p === page
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {p + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="h-8 w-8 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
