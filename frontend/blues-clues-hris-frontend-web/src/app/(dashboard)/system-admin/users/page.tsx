"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { getUserInfo } from "@/lib/authStorage";
import {
  getUsers,
  getUserStats,
  getCompanies,
  getDepartments,
  createUser,
  setUserStatus,
  resendSignupLink,
  updateUser,
  type InternalUser,
  type UserStats,
  type Company,
  type UserRole,
  type CreateUserPayload,
} from "@/lib/adminApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Search, Filter, Download, MoreHorizontal,
  X, Copy, Check, ChevronLeft, ChevronRight,
  UserPlus, Lock, Unlock, RefreshCw, Pencil, Link2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: UserRole[] = [
  "HR Officer", "HR Recruiter", "HR Interviewer",
  "Active Employee", "Manager", "Group Head", "Admin",
];

const EXPIRY_OPTIONS = [
  { label: "24 hours", value: 24 },
  { label: "48 hours", value: 48 },
  { label: "72 hours", value: 72 },
];

const STATUS_STYLES: Record<string, string> = {
  active:  "bg-green-100 text-green-700 border-green-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  locked:  "bg-red-100 text-red-700 border-red-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLastLogin(val: string | null) {
  if (!val) return "Never";
  const d = new Date(val);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatExpiry(iso: string) {
  return new Date(iso).toLocaleString();
}

function formatExpiryCountdown(iso: string | null): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "< 1h left";
  if (hrs < 24) return `${hrs}h left`;
  return `${Math.floor(hrs / 24)}d left`;
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

// Row action dropdown
function RowMenu({
  user,
  onLock,
  onUnlock,
  onResend,
  onEdit,
  onCopyLink,
}: {
  user: InternalUser;
  onLock: () => void;
  onUnlock: () => void;
  onResend: () => void;
  onEdit: () => void;
  onCopyLink: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost" size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(v => !v)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-44 bg-card border border-border rounded-lg shadow-lg py-1 text-sm">
          <button
            className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-foreground"
            onClick={() => { onEdit(); setOpen(false); }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit Details
          </button>
          {user.status === "pending" && (
            <button
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-foreground"
              onClick={() => { onCopyLink(); setOpen(false); }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy Sign-up Link
            </button>
          )}
          {user.status === "pending" && (
            <button
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-foreground"
              onClick={() => { onResend(); setOpen(false); }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Resend Link
            </button>
          )}
          {user.status === "active" && (
            <button
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-red-600"
              onClick={() => { onLock(); setOpen(false); }}
            >
              <Lock className="h-3.5 w-3.5" /> Lock Account
            </button>
          )}
          {user.status === "locked" && (
            <button
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-green-600"
              onClick={() => { onUnlock(); setOpen(false); }}
            >
              <Unlock className="h-3.5 w-3.5" /> Unlock Account
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Copy link modal shown after user creation or link resend
function CopyLinkModal({
  link,
  expiresAt,
  onClose,
}: {
  link: string;
  expiresAt: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg text-primary"><Link2 className="h-5 w-5" /></div>
          <div>
            <h3 className="font-bold text-foreground">Sign-up Link Generated</h3>
            <p className="text-xs text-muted-foreground">Share this link with the new user</p>
          </div>
        </div>

        <div className="bg-muted/40 border border-border rounded-lg p-3 flex items-center gap-2 mb-3">
          <p className="text-xs font-mono text-foreground flex-1 truncate">{link}</p>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground mb-5">
          Expires: <span className="font-semibold text-foreground">{formatExpiry(expiresAt)}</span>
        </p>

        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

// Edit user slide-over (role, department, start date — editable before activation)
function EditUserPanel({
  user,
  departments,
  onClose,
  onSave,
}: {
  user: InternalUser;
  departments: string[];
  onClose: () => void;
  onSave: (u: InternalUser) => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [department, setDepartment] = useState(user.department);
  const [startDate, setStartDate] = useState(user.start_date);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateUser(user.user_id, { role, department, start_date: startDate });
      onSave({ ...user, role, department, start_date: startDate });
      toast.success("User details updated.");
    } catch {
      toast.error("Failed to update user.");
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
            <h2 className="font-bold text-lg">Edit User</h2>
            <p className="text-xs text-muted-foreground">{user.first_name} {user.last_name} · {user.employee_id}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Department</label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Start Date</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>

          {user.status !== "pending" && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Note: Only pending (not yet activated) accounts can have role and department changed.
            </p>
          )}
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

// Add User slide-over
function AddUserPanel({
  companies,
  departments,
  onClose,
  onCreated,
}: {
  companies: Company[];
  departments: string[];
  onClose: () => void;
  onCreated: (link: string, expiresAt: string, user: InternalUser) => void;
}) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    role: "" as UserRole | "",
    department: "",
    company_id: "",
    start_date: "",
    link_expiry_hours: 48,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim()) e.last_name = "Required";
    if (!form.username.trim()) e.username = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (!form.role) e.role = "Required";
    if (!form.department) e.department = "Required";
    if (!form.company_id) e.company_id = "Required";
    if (!form.start_date) e.start_date = "Required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const res = await createUser(form as CreateUserPayload);
      onCreated(res.signup_link, res.expires_at, res.user);
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

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">Add New User</h2>
            <p className="text-xs text-muted-foreground">Fill in the details to provision a new account</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {/* Form */}
        <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">

          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            {field("First Name", "first_name", "text", "e.g. Juan")}
            {field("Last Name", "last_name", "text", "e.g. dela Cruz")}
          </div>

          {field("Username", "username", "text", "e.g. juan.delacruz")}
          {field("Email", "email", "email", "e.g. juan@company.com")}

          {/* Role */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Role</label>
            <select
              value={form.role}
              onChange={e => set("role", e.target.value)}
              className={`w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                errors.role ? "border-red-400" : "border-input"
              }`}
            >
              <option value="">Select role...</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.role && <p className="text-xs text-red-500">{errors.role}</p>}
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Department</label>
            <select
              value={form.department}
              onChange={e => set("department", e.target.value)}
              className={`w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                errors.department ? "border-red-400" : "border-input"
              }`}
            >
              <option value="">Select department...</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {errors.department && <p className="text-xs text-red-500">{errors.department}</p>}
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Company</label>
            <select
              value={form.company_id}
              onChange={e => set("company_id", e.target.value)}
              className={`w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                errors.company_id ? "border-red-400" : "border-input"
              }`}
            >
              <option value="">Select company...</option>
              {companies.map(c => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}
            </select>
            {errors.company_id && <p className="text-xs text-red-500">{errors.company_id}</p>}
          </div>

          {field("Start Date", "start_date", "date")}

          {/* Sign-up link expiry */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Sign-up Link Expiry
            </label>
            <div className="flex gap-2">
              {EXPIRY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => set("link_expiry_hours", opt.value)}
                  className={`flex-1 py-2 rounded-md border text-xs font-semibold transition-colors ${
                    form.link_expiry_hours === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-input hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              The sign-up link will expire after the selected duration.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create & Generate Link"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 8;

export default function SystemAdminUsersPage() {
  const user = getUserInfo();
  useWelcomeToast(user?.name || "System Admin", "System Administration");

  const [users, setUsers]           = useState<InternalUser[]>([]);
  const [stats, setStats]           = useState<UserStats | null>(null);
  const [companies, setCompanies]   = useState<Company[]>([]);
  const [departments, setDeps]      = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(1);

  const [showAdd, setShowAdd]       = useState(false);
  const [editUser, setEditUser]     = useState<InternalUser | null>(null);
  const [linkModal, setLinkModal]   = useState<{ link: string; expiresAt: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, s, c, d] = await Promise.all([
        getUsers(), getUserStats(), getCompanies(), getDepartments(),
      ]);
      setUsers(u);
      setStats(s);
      setCompanies(c);
      setDeps(d);
    } catch {
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.employee_id.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleCreated = (link: string, expiresAt: string, newUser: InternalUser) => {
    setUsers(prev => [newUser, ...prev]);
    setStats(prev => prev ? { ...prev, total: prev.total + 1, pending: prev.pending + 1 } : prev);
    setShowAdd(false);
    setLinkModal({ link, expiresAt });
  };

  const handleLock = async (u: InternalUser) => {
    try {
      await setUserStatus(u.user_id, "locked");
      setUsers(prev => prev.map(x => x.user_id === u.user_id ? { ...x, status: "locked" } : x));
      toast.success(`${u.first_name}'s account locked.`);
    } catch { toast.error("Failed to lock account."); }
  };

  const handleUnlock = async (u: InternalUser) => {
    try {
      await setUserStatus(u.user_id, "active");
      setUsers(prev => prev.map(x => x.user_id === u.user_id ? { ...x, status: "active" } : x));
      toast.success(`${u.first_name}'s account unlocked.`);
    } catch { toast.error("Failed to unlock account."); }
  };

  const handleResend = async (u: InternalUser) => {
    try {
      const res = await resendSignupLink(u.user_id, 48);
      setUsers(prev => prev.map(x =>
        x.user_id === u.user_id ? { ...x, signup_link_expires_at: res.expires_at } : x
      ));
      setLinkModal({ link: res.signup_link, expiresAt: res.expires_at });
      toast.success("Sign-up link regenerated.");
    } catch { toast.error("Failed to resend link."); }
  };

  // Fetches a fresh copy of the sign-up link for pending users who haven't activated yet
  const handleCopyLink = async (u: InternalUser) => {
    try {
      const res = await resendSignupLink(u.user_id, 48);
      setLinkModal({ link: res.signup_link, expiresAt: res.expires_at });
    } catch { toast.error("Failed to retrieve sign-up link."); }
  };

  const handleEditSaved = (updated: InternalUser) => {
    setUsers(prev => prev.map(x => x.user_id === updated.user_id ? updated : x));
    setEditUser(null);
  };

  return (
    <div className="space-y-6">

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Users"  value={stats.total}   sub="All accounts"      color="text-foreground" />
          <StatCard label="Active"       value={stats.active}  sub="Logged in at least once" color="text-green-600" />
          <StatCard label="Pending"      value={stats.pending} sub="Awaiting activation" color="text-amber-600" />
          <StatCard label="Locked"       value={stats.locked}  sub="Access revoked"    color="text-red-600" />
        </div>
      )}

      {/* Table Card */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">

        {/* Table toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-base">Internal Users</h2>
            <p className="text-xs text-muted-foreground">Manage all internal accounts</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9 w-full sm:w-60"
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <Filter className="h-4 w-4" />
            </Button>
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
                    Loading users...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              ) : paged.map(u => (
                <tr key={u.user_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/10 shrink-0">
                        {u.first_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground leading-none">
                          {u.first_name} {u.last_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-muted-foreground">{u.employee_id}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-semibold text-foreground">{u.role}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-muted-foreground">{u.department}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border w-fit ${STATUS_STYLES[u.status]}`}>
                        {u.status === "pending" ? "Pending Setup" : u.status}
                      </span>
                      {u.status === "pending" && u.signup_link_expires_at && (() => {
                        const countdown = formatExpiryCountdown(u.signup_link_expires_at);
                        const isExpired = countdown === "Expired";
                        return (
                          <span className={`text-[10px] font-semibold ${isExpired ? "text-red-500" : "text-muted-foreground"}`}>
                            Link {countdown}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-muted-foreground">{formatLastLogin(u.last_login)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <RowMenu
                      user={u}
                      onLock={() => handleLock(u)}
                      onUnlock={() => handleUnlock(u)}
                      onResend={() => handleResend(u)}
                      onEdit={() => setEditUser(u)}
                      onCopyLink={() => handleCopyLink(u)}
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

      {/* Panels & Modals */}
      {showAdd && (
        <AddUserPanel
          companies={companies}
          departments={departments}
          onClose={() => setShowAdd(false)}
          onCreated={handleCreated}
        />
      )}
      {editUser && (
        <EditUserPanel
          user={editUser}
          departments={departments}
          onClose={() => setEditUser(null)}
          onSave={handleEditSaved}
        />
      )}
      {linkModal && (
        <CopyLinkModal
          link={linkModal.link}
          expiresAt={linkModal.expiresAt}
          onClose={() => setLinkModal(null)}
        />
      )}
    </div>
  );
}
