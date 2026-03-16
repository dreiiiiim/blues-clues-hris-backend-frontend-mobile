"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getUserInfo, getAccessToken, parseJwt } from "@/lib/authStorage";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, MoreHorizontal, X,
  ChevronLeft, ChevronRight, Pencil, UserX, UserCheck,
  Filter, Download, Check, Mail, Users,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Role {
  role_id: string;
  role_name: string;
}

interface Department {
  department_id: string;
  department_name: string;
}

interface Employee {
  user_id: string;
  employee_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  company_id: string | null;
  role_id: string | null;
  department_id: string | null;
  start_date: string | null;
  account_status: "Active" | "Inactive" | "Pending";
  last_login: string | null;
  invite_expires_at: string | null;
}

interface Stats {
  total: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 8;

const STATUS_STYLES: Record<string, string> = {
  Active:   "bg-green-100 text-green-700 border-green-200",
  Inactive: "bg-red-100 text-red-700 border-red-200",
  Pending:  "bg-amber-100 text-amber-700 border-amber-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || "Request failed");
  return data as T;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${style}`}>
      {status}
    </span>
  );
}

function formatLastLogin(value: string | null) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatInviteDeadline(value: string | null) {
  if (!value) return "No active invite";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
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
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Row action dropdown
function RowMenu({
  employee,
  onEdit,
  onDeactivate,
  onReactivate,
  onResendInvite,
}: {
  employee: Employee;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onResendInvite: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const insideButton = buttonRef.current?.contains(e.target as Node);
      const insideMenu = menuRef.current?.contains(e.target as Node);
      if (!insideButton && !insideMenu) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(v => !v);
  };

  return (
    <div>
      <Button
        ref={buttonRef}
        variant="ghost" size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={handleOpen}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && menuPos && (
        <div
          ref={menuRef}
          style={{ top: menuPos.top, right: menuPos.right }}
          className="fixed z-50 w-44 bg-card border border-border rounded-lg shadow-lg py-1 text-sm"
        >
          <button
            className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-foreground"
            onClick={() => { onEdit(); setOpen(false); }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit Details
          </button>
          {employee.account_status === "Pending" && (
            <button
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-blue-600"
              onClick={() => { onResendInvite(); setOpen(false); }}
            >
              <Mail className="h-3.5 w-3.5" /> Resend Invite
            </button>
          )}
          {employee.account_status === "Inactive" ? (
            <button
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-green-600"
              onClick={() => { onReactivate(); setOpen(false); }}
            >
              <UserCheck className="h-3.5 w-3.5" /> Reactivate
            </button>
          ) : (
            <button
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-red-600"
              onClick={() => { onDeactivate(); setOpen(false); }}
            >
              <UserX className="h-3.5 w-3.5" /> Deactivate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Edit Employee slide-over
function EditUserPanel({
  employee,
  roles,
  departments,
  onClose,
  onSaved,
}: {
  employee: Employee;
  roles: Role[];
  departments: Department[];
  onClose: () => void;
  onSaved: (updated: Employee) => void;
}) {
  const [form, setForm] = useState({
    first_name: employee.first_name,
    last_name: employee.last_name,
    role_id: employee.role_id ?? "",
    department_id: employee.department_id ?? "",
    start_date: employee.start_date ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim()) e.last_name = "Required";
    if (!form.role_id) e.role_id = "Required";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      await apiFetch(`/users/${employee.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          role_id: form.role_id || null,
          department_id: form.department_id || null,
          start_date: form.start_date || null,
        }),
      });
      onSaved({
        ...employee,
        first_name: form.first_name,
        last_name: form.last_name,
        role_id: form.role_id || null,
        department_id: form.department_id || null,
        start_date: form.start_date || null,
      });
      toast.success("Employee updated.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update employee.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-card w-full max-w-md h-full shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">Edit Employee</h2>
            <p className="text-xs text-muted-foreground">
              {employee.first_name} {employee.last_name} · {employee.employee_id}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Username</label>
            <Input value={employee.username} disabled className="opacity-60 cursor-not-allowed" />
            <p className="text-[11px] text-muted-foreground">Username cannot be changed after account creation.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">First Name</label>
              <Input
                value={form.first_name}
                onChange={e => set("first_name", e.target.value)}
                className={errors.first_name ? "border-red-400 focus-visible:ring-red-300" : ""}
              />
              {errors.first_name && <p className="text-xs text-red-500">{errors.first_name}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Last Name</label>
              <Input
                value={form.last_name}
                onChange={e => set("last_name", e.target.value)}
                className={errors.last_name ? "border-red-400 focus-visible:ring-red-300" : ""}
              />
              {errors.last_name && <p className="text-xs text-red-500">{errors.last_name}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Role</label>
            <select
              value={form.role_id}
              onChange={e => set("role_id", e.target.value)}
              className={`w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                errors.role_id ? "border-red-400" : "border-input"
              }`}
            >
              <option value="">Select role...</option>
              {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
            </select>
            {errors.role_id && <p className="text-xs text-red-500">{errors.role_id}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Department</label>
            <select
              value={form.department_id}
              onChange={e => set("department_id", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select department...</option>
              {departments.length === 0 && <option value="" disabled>No departments available</option>}
              {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Start Date</label>
            <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
          </div>
        </div>

        <div className="px-6 py-5 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Deactivate confirmation dialog
function ConfirmDeactivate({
  employee,
  onClose,
  onConfirm,
}: {
  employee: Employee;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-lg text-red-600">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Deactivate Account</h3>
            <p className="text-xs text-muted-foreground">This will revoke their access immediately</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Are you sure you want to deactivate{" "}
          <span className="font-semibold text-foreground">{employee.first_name} {employee.last_name}</span>?
          They will be logged out and unable to sign in.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>Deactivate</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManagerTeamPage() {
  const user = getUserInfo();
  const currentUserId = parseJwt(getAccessToken() ?? "")?.sub_userid as string | undefined;

  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [roles, setRoles]             = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]         = useState(true);
  const [now, setNow]                 = useState(() => Date.now());
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);

  const [editEmployee, setEditEmployee]   = useState<Employee | null>(null);
  const [confirmDeact, setConfirmDeact]   = useState<Employee | null>(null);
  const [showFilter, setShowFilter]       = useState(false);
  const [statusFilter, setStatusFilter]   = useState<Set<string>>(new Set());
  const [deptFilter, setDeptFilter]       = useState("");
  const filterRef                         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [users, statsData, rolesData] = await Promise.all([
        apiFetch<Employee[]>("/users"),
        apiFetch<Stats>("/users/stats"),
        apiFetch<Role[]>("/users/roles"),
      ]);
      setEmployees(users.filter(u => u.user_id !== currentUserId));
      setStats(statsData);
      setRoles(rolesData);
      try {
        const deptsData = await apiFetch<Department[] | null>("/users/departments");
        setDepartments(Array.isArray(deptsData) ? deptsData : []);
      } catch {
        setDepartments([]);
      }
    } catch {
      toast.error("Failed to load team data.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => { load(); }, [load]);

  const departmentNameById = (id: string | null) => {
    if (!id) return "—";
    return departments.find(d => d.department_id === id)?.department_name ?? id;
  };

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchesSearch =
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.employee_id.toLowerCase().includes(q);
    const matchesStatus = statusFilter.size === 0 || statusFilter.has(e.account_status);
    const matchesDept = !deptFilter || e.department_id === deptFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  const toggleStatus = (status: string) => {
    setStatusFilter(prev => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
    setPage(1);
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const activeCount   = employees.filter(e => e.account_status === "Active").length;
  const pendingCount  = employees.filter(e => e.account_status === "Pending").length;
  const inactiveCount = employees.filter(e => e.account_status === "Inactive").length;

  const handleEditSaved = (updated: Employee) => {
    setEmployees(prev => prev.map(e => e.user_id === updated.user_id ? updated : e));
    setEditEmployee(null);
  };

  const handleResendInvite = async (employee: Employee) => {
    try {
      const res = await apiFetch<{ message: string; invite_expires_at: string }>(
        `/users/${employee.user_id}/resend-invite`, { method: "PATCH" }
      );
      setEmployees(prev => prev.map(e =>
        e.user_id === employee.user_id ? { ...e, invite_expires_at: res.invite_expires_at } : e
      ));
      toast.success(`Invite resent to ${employee.email}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend invite.");
    }
  };

  const handleDeactivate = async (employee: Employee) => {
    setConfirmDeact(null);
    try {
      await apiFetch(`/users/${employee.user_id}`, { method: "DELETE" });
      setEmployees(prev => prev.map(e =>
        e.user_id === employee.user_id ? { ...e, account_status: "Inactive" } : e
      ));
      toast.success(`${employee.first_name}'s account deactivated.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to deactivate account.");
    }
  };

  const handleReactivate = async (employee: Employee) => {
    try {
      const res = await apiFetch<{ message?: string }>(
        `/users/${employee.user_id}/reactivate`, { method: "PATCH" }
      );
      const nextStatus = res.message?.includes("Pending") ? "Pending" : "Active";
      setEmployees(prev => prev.map(e =>
        e.user_id === employee.user_id ? { ...e, account_status: nextStatus } : e
      ));
      toast.success(`${employee.first_name}'s account reactivated as ${nextStatus.toLowerCase()}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to reactivate account.");
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">My Team</h1>
          <p className="text-xs text-muted-foreground">View and manage your team members</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Members" value={stats?.total ?? 0}  sub="All accounts"         color="text-foreground" />
        <StatCard label="Active"        value={activeCount}         sub="Currently active"     color="text-green-600" />
        <StatCard label="Pending"       value={pendingCount}        sub="Awaiting activation"  color="text-amber-600" />
        <StatCard label="Inactive"      value={inactiveCount}       sub="Deactivated accounts" color="text-red-600" />
      </div>

      {/* Table Card */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-base">Team Members</h2>
            <p className="text-xs text-muted-foreground">Manage the accounts of your direct reports</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9 w-full sm:w-60"
              />
            </div>
            <div className="relative shrink-0" ref={filterRef}>
              <Button
                variant="outline" size="icon"
                className={`h-9 w-9 ${(statusFilter.size > 0 || deptFilter) ? "border-primary text-primary" : ""}`}
                onClick={() => setShowFilter(v => !v)}
              >
                <Filter className="h-4 w-4" />
                {(statusFilter.size > 0 || deptFilter) && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {statusFilter.size + (deptFilter ? 1 : 0)}
                  </span>
                )}
              </Button>
              {showFilter && (
                <div className="absolute right-0 top-10 z-50 w-52 bg-card border border-border rounded-lg shadow-lg py-1.5">
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</p>
                  {(["Active", "Inactive", "Pending"] as const).map(s => (
                    <button
                      key={s}
                      className="flex items-center justify-between px-3 py-2 w-full hover:bg-muted/50 text-sm text-foreground"
                      onClick={() => toggleStatus(s)}
                    >
                      <span>{s}</span>
                      {statusFilter.has(s) && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  ))}
                  {departments.length > 0 && (
                    <>
                      <div className="border-t border-border my-1" />
                      <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Department</p>
                      <button
                        className="flex items-center justify-between px-3 py-2 w-full hover:bg-muted/50 text-sm text-foreground"
                        onClick={() => { setDeptFilter(""); setPage(1); }}
                      >
                        <span>All departments</span>
                        {!deptFilter && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                      {departments.map(d => (
                        <button
                          key={d.department_id}
                          className="flex items-center justify-between px-3 py-2 w-full hover:bg-muted/50 text-sm text-foreground"
                          onClick={() => { setDeptFilter(d.department_id); setPage(1); }}
                        >
                          <span className="truncate mr-2">{d.department_name}</span>
                          {deptFilter === d.department_id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      ))}
                    </>
                  )}
                  {(statusFilter.size > 0 || deptFilter) && (
                    <>
                      <div className="border-t border-border my-1" />
                      <button
                        className="px-3 py-2 w-full text-left text-xs text-muted-foreground hover:bg-muted/50"
                        onClick={() => { setStatusFilter(new Set()); setDeptFilter(""); setPage(1); }}
                      >
                        Clear all filters
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-b border-border uppercase tracking-widest">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Employee ID</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Invite Expires In</th>
                <th className="px-5 py-3">Last Login</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                    Loading team...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                    No team members found.
                  </td>
                </tr>
              ) : paged.map(e => (
                <tr key={e.user_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/10 shrink-0">
                        {e.first_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground leading-none">
                          {e.first_name} {e.last_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{e.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-muted-foreground">{e.employee_id}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-semibold text-foreground">
                      {roles.find(r => r.role_id === e.role_id)?.role_name ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-muted-foreground">{departmentNameById(e.department_id)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={e.account_status} />
                  </td>
                  <td className="px-5 py-4">
                    {e.account_status === "Pending" ? (
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {formatInviteCountdown(e.invite_expires_at, now)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatInviteDeadline(e.invite_expires_at)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-muted-foreground">{formatLastLogin(e.last_login)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <RowMenu
                      employee={e}
                      onEdit={() => setEditEmployee(e)}
                      onDeactivate={() => setConfirmDeact(e)}
                      onReactivate={() => handleReactivate(e)}
                      onResendInvite={() => handleResendInvite(e)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {filtered.length > 0
              ? `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length}`
              : "No results"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1"
              onClick={() => setPage(p => p - 1)} disabled={page === 1 || totalPages === 0}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1"
              onClick={() => setPage(p => p + 1)} disabled={page === totalPages || totalPages === 0}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Panels & Dialogs */}
      {editEmployee && (
        <EditUserPanel
          employee={editEmployee}
          roles={roles}
          departments={departments}
          onClose={() => setEditEmployee(null)}
          onSaved={handleEditSaved}
        />
      )}
      {confirmDeact && (
        <ConfirmDeactivate
          employee={confirmDeact}
          onClose={() => setConfirmDeact(null)}
          onConfirm={() => handleDeactivate(confirmDeact)}
        />
      )}
    </div>
  );
}
