"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { getUserInfo, getAccessToken, parseJwt } from "@/lib/authStorage";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, UserPlus, MoreHorizontal, X,
  ChevronLeft, ChevronRight, Pencil, UserX, UserCheck,
  Filter, Download, Check,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Role {
  role_id: string;
  role_name: string;
}

interface Employee {
  user_id: string;
  employee_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role_id: string | null;
  department_id: string | null;
  start_date: string | null;
  account_status: "Active" | "Inactive" | "Pending";
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
  if (!res.ok) throw new Error(data?.message || "Request failed");
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

// Row action dropdown
function RowMenu({
  employee,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  employee: Employee;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const insideButton = buttonRef.current?.contains(e.target as Node);
      const insideMenu = menuRef.current?.contains(e.target as Node);
      if (!insideButton && !insideMenu) {
        setOpen(false);
      }
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

// Add User slide-over
function AddUserPanel({
  roles,
  onClose,
  onCreated,
}: {
  roles: Role[];
  onClose: () => void;
  onCreated: (employee: Employee) => void;
}) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    role_id: "",
    department_id: "",
    start_date: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim()) e.last_name = "Required";
    if (!form.username.trim()) e.username = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (!form.role_id) e.role_id = "Required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const payload: Record<string, string> = {
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username,
        email: form.email,
        role_id: form.role_id,
      };
      if (form.department_id.trim()) payload.department_id = form.department_id.trim();
      if (form.start_date) payload.start_date = form.start_date;

      const res = await apiFetch<{ user_id: string; employee_id: string; email: string; username: string }>("/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const newEmployee: Employee = {
        user_id: res.user_id,
        employee_id: res.employee_id,
        username: res.username,
        first_name: form.first_name,
        last_name: form.last_name,
        email: res.email,
        role_id: form.role_id,
        department_id: form.department_id.trim() || null,
        start_date: form.start_date || null,
        account_status: "Pending",
      };

      onCreated(newEmployee);
      toast.success("User created. Invite email sent.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create user.");
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: string, type = "text", placeholder = "") => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
      <Input
        type={type}
        placeholder={placeholder}
        value={(form as any)[key]}
        onChange={e => set(key, e.target.value)}
        className={errors[key] ? "border-red-400 focus-visible:ring-red-300" : ""}
      />
      {errors[key] && <p className="text-xs text-red-500">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-card w-full max-w-md h-full shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">Add New Employee</h2>
            <p className="text-xs text-muted-foreground">Provision a new account for your company</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {field("First Name", "first_name", "text", "e.g. Juan")}
            {field("Last Name", "last_name", "text", "e.g. dela Cruz")}
          </div>
          {field("Username", "username", "text", "e.g. juan.delacruz")}
          {field("Email", "email", "email", "e.g. juan@company.com")}

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

          {field("Department ID", "department_id", "text", "Optional")}
          {field("Start Date", "start_date", "date")}
        </div>

        <div className="px-6 py-5 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create Employee"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Edit User slide-over
function EditUserPanel({
  employee,
  roles,
  onClose,
  onSaved,
}: {
  employee: Employee;
  roles: Role[];
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
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload: Record<string, string | null> = {
        first_name: form.first_name,
        last_name: form.last_name,
        role_id: form.role_id || null,
        department_id: form.department_id.trim() || null,
        start_date: form.start_date || null,
      };

      await apiFetch(`/users/${employee.user_id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      onSaved({
        ...employee,
        first_name: form.first_name,
        last_name: form.last_name,
        role_id: form.role_id || null,
        department_id: form.department_id.trim() || null,
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

        <div className="flex-1 px-6 py-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Username</label>
            <Input value={employee.username} disabled className="opacity-60 cursor-not-allowed" />
            <p className="text-[11px] text-muted-foreground">Username cannot be changed after account creation.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">First Name</label>
              <Input value={form.first_name} onChange={e => set("first_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Last Name</label>
              <Input value={form.last_name} onChange={e => set("last_name", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Role</label>
            <select
              value={form.role_id}
              onChange={e => set("role_id", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select role...</option>
              {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Department ID</label>
            <Input value={form.department_id} onChange={e => set("department_id", e.target.value)} placeholder="Optional" />
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
          Are you sure you want to deactivate <span className="font-semibold text-foreground">{employee.first_name} {employee.last_name}</span>? They will be logged out and unable to sign in.
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

export default function AdminUsersPage() {
  const user = getUserInfo();
  const currentUserId = parseJwt(getAccessToken() ?? "")?.sub_userid as string | undefined;
  useWelcomeToast(user?.name || "Admin", "User Management");

  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [stats, setStats]               = useState<Stats | null>(null);
  const [roles, setRoles]               = useState<Role[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);

  const [showAdd, setShowAdd]           = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [confirmDeact, setConfirmDeact] = useState<Employee | null>(null);
  const [showFilter, setShowFilter]     = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const filterRef                       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [users, statsData, rolesData] = await Promise.all([
        apiFetch<Employee[]>("/users"),
        apiFetch<Stats>("/users/stats"),
        apiFetch<Role[]>("/users/roles"),
      ]);
      setEmployees(users);
      setStats(statsData);
      setRoles(rolesData);
    } catch {
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchesSearch = (
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.employee_id.toLowerCase().includes(q)
    );
    const matchesStatus = statusFilter.size === 0 || statusFilter.has(e.account_status);
    return matchesSearch && matchesStatus;
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

  // Derived stats from employee list
  const activeCount   = employees.filter(e => e.account_status === "Active").length;
  const pendingCount  = employees.filter(e => e.account_status === "Pending").length;
  const inactiveCount = employees.filter(e => e.account_status === "Inactive").length;

  const handleCreated = (employee: Employee) => {
    setEmployees(prev => [employee, ...prev]);
    setStats(prev => prev ? { total: prev.total + 1 } : prev);
    setShowAdd(false);
  };

  const handleEditSaved = (updated: Employee) => {
    setEmployees(prev => prev.map(e => e.user_id === updated.user_id ? updated : e));
    setEditEmployee(null);
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
      await apiFetch(`/users/${employee.user_id}/reactivate`, { method: "PATCH" });
      setEmployees(prev => prev.map(e =>
        e.user_id === employee.user_id ? { ...e, account_status: "Active" } : e
      ));
      toast.success(`${employee.first_name}'s account reactivated.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to reactivate account.");
    }
  };

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Users"  value={stats?.total ?? 0}  sub="All accounts"         color="text-foreground" />
        <StatCard label="Active"       value={activeCount}         sub="Currently active"     color="text-green-600" />
        <StatCard label="Pending"      value={pendingCount}        sub="Awaiting activation"  color="text-amber-600" />
        <StatCard label="Inactive"     value={inactiveCount}       sub="Deactivated accounts" color="text-red-600" />
      </div>

      {/* Table Card */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-base">Internal Users</h2>
            <p className="text-xs text-muted-foreground">Manage all internal accounts</p>
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
            {/* Filter */}
            <div className="relative shrink-0" ref={filterRef}>
              <Button
                variant="outline" size="icon" className={`h-9 w-9 ${statusFilter.size > 0 ? "border-primary text-primary" : ""}`}
                onClick={() => setShowFilter(v => !v)}
              >
                <Filter className="h-4 w-4" />
                {statusFilter.size > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {statusFilter.size}
                  </span>
                )}
              </Button>
              {showFilter && (
                <div className="absolute right-0 top-10 z-50 w-44 bg-card border border-border rounded-lg shadow-lg py-1.5">
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
                  {statusFilter.size > 0 && (
                    <>
                      <div className="border-t border-border my-1" />
                      <button
                        className="px-3 py-2 w-full text-left text-xs text-muted-foreground hover:bg-muted/50"
                        onClick={() => { setStatusFilter(new Set()); setPage(1); }}
                      >
                        Clear filters
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Download (no functionality) */}
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <Download className="h-4 w-4" />
            </Button>
            <Button className="h-9 gap-1.5 shrink-0" onClick={() => setShowAdd(true)}>
              <UserPlus className="h-4 w-4" /> Add User
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
                <th className="px-5 py-3">Last Login</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    Loading employees...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    No employees found.
                  </td>
                </tr>
              ) : paged.map(e => (
                <tr key={e.user_id} className="hover:bg-muted/20 transition-colors">
                  {/* User */}
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
                  {/* Employee ID */}
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-muted-foreground">{e.employee_id}</span>
                  </td>
                  {/* Role */}
                  <td className="px-5 py-4">
                    <span className="text-xs font-semibold text-foreground">
                      {roles.find(r => r.role_id === e.role_id)?.role_name ?? "—"}
                    </span>
                  </td>
                  {/* Department */}
                  <td className="px-5 py-4">
                    <span className="text-xs text-muted-foreground">{e.department_id ?? "—"}</span>
                  </td>
                  {/* Status */}
                  <td className="px-5 py-4">
                    <StatusBadge status={e.account_status} />
                  </td>
                  {/* Last Login */}
                  <td className="px-5 py-4">
                    <span className="text-xs text-muted-foreground">Never</span>
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-4 text-right">
                    {e.user_id === currentUserId ? (
                      <span className="text-[11px] text-muted-foreground italic px-2">You</span>
                    ) : (
                      <RowMenu
                        employee={e}
                        onEdit={() => setEditEmployee(e)}
                        onDeactivate={() => setConfirmDeact(e)}
                        onReactivate={() => handleReactivate(e)}
                      />
                    )}
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
      {showAdd && (
        <AddUserPanel
          roles={roles}
          onClose={() => setShowAdd(false)}
          onCreated={handleCreated}
        />
      )}
      {editEmployee && (
        <EditUserPanel
          employee={editEmployee}
          roles={roles}
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
