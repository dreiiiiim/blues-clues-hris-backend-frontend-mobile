"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell, Calendar, ChevronRight, X, Check, Loader2,
  Mic, Cpu, Trophy,
} from "lucide-react";
import { getMyApplications } from "@/lib/authApi";
import { getUserInfo } from "@/lib/authStorage";

// ─── Constants ────────────────────────────────────────────────────────────────

const INTERVIEW_STAGES = new Set([
  "first_interview",
  "technical_interview",
  "final_interview",
]);

const STAGE_LABELS: Record<string, string> = {
  first_interview:     "1st Interview Scheduled",
  technical_interview: "Technical Interview Scheduled",
  final_interview:     "Final Interview Scheduled",
};

const STAGE_DETAIL: Record<string, string> = {
  first_interview:     "HR Screening · Initial profiling stage",
  technical_interview: "Technical Assessment · Skills evaluation",
  final_interview:     "Cultural Fit · Final hiring decision stage",
};

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  first_interview:     Mic,
  technical_interview: Cpu,
  final_interview:     Trophy,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppNotification {
  id:        string;   // application_id
  jobTitle:  string;
  stage:     string;
  updatedAt: string;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function storageKey(email: string) {
  return `notif_read_v1_${email}`;
}

function loadReadIds(email: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(email));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistReadIds(email: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(email), JSON.stringify([...ids]));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── NotificationBell ─────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen]                       = useState(false);
  const [notifications, setNotifications]     = useState<AppNotification[]>([]);
  const [readIds, setReadIdsState]            = useState<Set<string>>(new Set());
  const [loading, setLoading]                 = useState(true);
  const dropdownRef                           = useRef<HTMLDivElement>(null);
  const btnRef                                = useRef<HTMLButtonElement>(null);

  const userEmail = getUserInfo()?.email ?? "";

  // Fetch applications → derive notifications
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getMyApplications()
      .then((apps) => {
        if (!alive) return;
        const items: AppNotification[] = apps
          .filter((a) => INTERVIEW_STAGES.has(a.status))
          .map((a) => ({
            id:        a.application_id,
            jobTitle:  a.job_postings.title,
            stage:     a.status,
            updatedAt: a.applied_at,
          }));
        setNotifications(items);
        setReadIdsState(loadReadIds(userEmail));
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userEmail]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = useCallback(() => {
    const next = new Set([...readIds, ...notifications.map((n) => n.id)]);
    setReadIdsState(next);
    persistReadIds(userEmail, next);
  }, [notifications, readIds, userEmail]);

  const markOneRead = useCallback(
    (id: string) => {
      if (readIds.has(id)) return;
      const next = new Set(readIds);
      next.add(id);
      setReadIdsState(next);
      persistReadIds(userEmail, next);
    },
    [readIds, userEmail],
  );

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={btnRef}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center border-2 border-background leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Notifications
              </p>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {loading
                  ? "Loading…"
                  : unreadCount > 0
                  ? `${unreadCount} unread`
                  : "All caught up"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && !loading && (
                <button
                  onClick={markAllRead}
                  className="h-7 px-2 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Check className="h-3 w-3" /> All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="h-7 w-7 rounded-lg hover:bg-muted/60 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="h-px bg-border mx-4" />

          {/* Body */}
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-10 gap-2 px-4">
                <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-semibold text-foreground">No notifications</p>
                <p className="text-xs text-muted-foreground text-center">
                  Interview invites will appear here once your application advances.
                </p>
              </div>
            ) : (
              /* Notification list */
              <div className="divide-y divide-border/50">
                {notifications.map((notif) => {
                  const isRead   = readIds.has(notif.id);
                  const StageIcon = STAGE_ICONS[notif.stage] ?? Calendar;
                  return (
                    <button
                      key={notif.id}
                      onClick={() => markOneRead(notif.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer group ${
                        isRead
                          ? "opacity-60 hover:opacity-80 hover:bg-muted/20"
                          : "hover:bg-primary/5"
                      }`}
                    >
                      {/* Stage icon */}
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isRead
                            ? "bg-muted/40 text-muted-foreground"
                            : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        <StageIcon className="h-4 w-4" />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">
                          {STAGE_LABELS[notif.stage] ?? "Interview Update"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {notif.jobTitle}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium uppercase tracking-wide">
                          {STAGE_DETAIL[notif.stage]} · {timeAgo(notif.updatedAt)}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2 group-hover:scale-110 transition-transform" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="h-px bg-border" />
          <div className="px-4 py-3">
            <a
              href="/applicant/applications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              View all applications
              <ChevronRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
