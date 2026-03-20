"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { getUserInfo, getAccessToken, parseJwt } from "@/lib/authStorage";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";
import {
  Users, FileText, UserPlus, MoreHorizontal, Filter, Download,
  Search, ChevronLeft, ChevronRight, X, Eye, Pencil, UserX,
  UserCheck, Mail, Loader2, Building2, Calendar, Shield, Hash, User, Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

interface Role {
  role_id: string;
  role_name: string;
}

interface Employee {
  user_id: string;
  employee_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_id: string | null;
  department_id: string | null;
  start_date: string | null;
  account_status: string | null;
  last_login: string | null;
  invite_expires_at: string | null;
};

type Role = { role_id: string; role_name: string };
type Department = { department_id: string; department_name: string };

type ConfirmAction = {
  type: "deactivate" | "reactivate" | "resend";
  employee: Employee;
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiPatch(path: string, body?: object) {
  const res = await authFetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || "Request failed");
  return data;
}

async function apiDelete(path: string) {
  const res = await authFetch(`${API_BASE_URL}${path}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || "Request failed");
  return data;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HRDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
  const [currentPage, setCurrentPage] = useState(1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Filter state
  const [showFilter, setShowFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [deptFilter, setDeptFilter] = useState("");
  const filterRef = useRef<HTMLDivElement>(null);

  // Panel / modal state
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const itemsPerPage = 5;
  const user = getUserInfo();
  const userName = user?.name || "HR Officer";
  useWelcomeToast(userName, "HR Administration");

  // Sync URL ?q= → local search state
  useEffect(() => {
    setSearchTerm(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Click-outside to close filter dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value); else params.delete("q");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false } as any);
  };

  const toggleStatus = (status: string) => {
    setStatusFilter(prev => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
    setCurrentPage(1);
  };

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch(`${API_BASE_URL}/users`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/users/stats`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/users/roles`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/users/departments`).then(r => r.json()),
    ])
      .then(([emps, stats, roleList, deptList]) => {
        setEmployees(Array.isArray(emps) ? emps : []);
        setTotalCount(stats?.total ?? null);
        setRoles(Array.isArray(roleList) ? roleList : []);
        setDepartments(Array.isArray(deptList) ? deptList : []);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filteredData = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return employees.filter(e => {
      const name = `${e.first_name ?? ""} ${e.last_name ?? ""}`.toLowerCase();
      const matchesSearch = name.includes(q) || e.email.toLowerCase().includes(q);
      const matchesStatus = statusFilter.size === 0 || statusFilter.has(e.account_status ?? "");
      const matchesDept = !deptFilter || e.department_id === deptFilter;
      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [searchTerm, employees, statusFilter, deptFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentTableData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const roleMap = useMemo(() =>
    Object.fromEntries(roles.map(r => [r.role_id, r.role_name])), [roles]);
  const deptMap = useMemo(() =>
    Object.fromEntries(departments.map(d => [d.department_id, d.department_name])), [departments]);

  // ── Confirm action handlers ──

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    const { type, employee } = confirmAction;
    try {
      if (type === "deactivate") {
        await apiDelete(`/users/${employee.user_id}`);
        toast.success(`${employee.first_name ?? employee.email} has been deactivated.`);
      } else if (type === "reactivate") {
        await apiPatch(`/users/${employee.user_id}/reactivate`);
        toast.success(`${employee.first_name ?? employee.email} has been reactivated.`);
      } else if (type === "resend") {
        await apiPatch(`/users/${employee.user_id}/resend-invite`);
        toast.success(`Invite resent to ${employee.email}.`);
      }
      setConfirmAction(null);
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSave = async (updates: Partial<{
    first_name: string; last_name: string; role_id: string; department_id: string; start_date: string;
  }>) => {
    if (!editEmployee) return;
    setActionLoading(true);
    try {
      await apiPatch(`/users/${editEmployee.user_id}`, updates);
      toast.success("Employee updated successfully.");
      setEditEmployee(null);
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update employee.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Welcome card */}
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">HR Administration</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Employee Management &amp; Directory</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Manage your workforce, handle onboarding, and maintain employee records from one place.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Total Employees</p>
            <p className="mt-1 text-lg font-bold">{totalCount ?? "—"}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard icon={Users}    label="Total Headcount"       value={totalCount !== null ? String(totalCount) : "—"} sub="Active Employees" trend={totalCount !== null ? `${totalCount} total` : "Loading..."} />
        <MetricCard icon={FileText} label="Pending Verifications" value="—" sub="Action Required"  trend="Coming soon" isAlert />
        <MetricCard icon={UserPlus} label="New Hires"             value="—" sub="Onboarding"       trend="Coming soon" />
      </div>

      <Card className="border-border overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 bg-muted/20">
          <div>
            <CardTitle className="text-lg font-bold">Employee Directory</CardTitle>
            <p className="text-xs text-muted-foreground">All employees in your company</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 w-64 h-9 bg-background"
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
                        onClick={() => { setDeptFilter(""); setCurrentPage(1); }}
                      >
                        <span>All departments</span>
                        {!deptFilter && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                      {departments.map(d => (
                        <button
                          key={d.department_id}
                          className="flex items-center justify-between px-3 py-2 w-full hover:bg-muted/50 text-sm text-foreground"
                          onClick={() => { setDeptFilter(d.department_id); setCurrentPage(1); }}
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
                        onClick={() => { setStatusFilter(new Set()); setDeptFilter(""); setCurrentPage(1); }}
                      >
                        Clear all filters
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9"><Download className="h-4 w-4" /></Button>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-y border-border uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">Loading employees...</td></tr>
              ) : fetchError ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-destructive text-sm">Failed to load employees. Please refresh.</td></tr>
              ) : currentTableData.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">No employees found.</td></tr>
              ) : currentTableData.map((row) => {
                const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
                const initial = name.charAt(0).toUpperCase();
                return (
                  <tr key={row.user_id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="h-9 w-9 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-xs border border-primary/5 shrink-0">
                        {initial}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground leading-tight">{name}</p>
                        {row.employee_id && <p className="text-[10px] text-muted-foreground">{row.employee_id}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{row.email}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {row.role_id ? (roleMap[row.role_id] ?? row.role_id) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={row.account_status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <EmployeeActionsMenu
                        employee={row}
                        onView={() => setViewEmployee(row)}
                        onEdit={() => setEditEmployee(row)}
                        onDeactivate={() => setConfirmAction({ type: "deactivate", employee: row })}
                        onReactivate={() => setConfirmAction({ type: "reactivate", employee: row })}
                        onResendInvite={() => setConfirmAction({ type: "resend", employee: row })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-muted/10 border-t border-border flex items-center justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {filteredData.length > 0
              ? `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredData.length)} of ${filteredData.length}`
              : "No results"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1 || totalPages === 0} className="h-8 gap-1">
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages || totalPages === 0} className="h-8 gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* View Profile Panel */}
      {viewEmployee && (
        <ViewProfileSheet
          employee={viewEmployee}
          roleMap={roleMap}
          deptMap={deptMap}
          onClose={() => setViewEmployee(null)}
        />
      )}

      {/* Edit Employee Modal */}
      {editEmployee && (
        <EditEmployeeModal
          employee={editEmployee}
          roles={roles}
          departments={departments}
          saving={actionLoading}
          onSave={handleEditSave}
          onClose={() => setEditEmployee(null)}
        />
      )}

      {/* Confirm dialogs */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "deactivate" && "Deactivate Account"}
              {confirmAction?.type === "reactivate" && "Reactivate Account"}
              {confirmAction?.type === "resend" && "Resend Invite"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "deactivate" &&
                `This will immediately revoke access for ${confirmAction.employee.first_name ?? confirmAction.employee.email}. They will be logged out of all sessions.`}
              {confirmAction?.type === "reactivate" &&
                `This will restore access for ${confirmAction.employee.first_name ?? confirmAction.employee.email}.`}
              {confirmAction?.type === "resend" &&
                `A new invite email will be sent to ${confirmAction.employee.email}. The previous link will be invalidated.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction?.type === "deactivate" ? "destructive" : "default"}
              onClick={(e) => { e.preventDefault(); handleConfirm(); }}
              disabled={actionLoading}
            >
              {actionLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : confirmAction?.type === "deactivate" ? "Deactivate"
                : confirmAction?.type === "reactivate" ? "Reactivate"
                : "Resend Invite"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Employee Actions Menu (three-dot dropdown) ───────────────────────────────

function EmployeeActionsMenu({
  employee, onView, onEdit, onDeactivate, onReactivate, onResendInvite,
}: {
  employee: Employee;
  onView: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onResendInvite: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const status = employee.account_status?.toLowerCase();

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 160;
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < menuHeight) {
        setPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
      } else {
        setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      }
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative inline-block">
      <Button
        ref={btnRef}
        variant="ghost" size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-primary"
        onClick={handleToggle}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, bottom: pos.bottom, right: pos.right }}
          className="z-[200] w-52 rounded-xl border border-border bg-popover shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          onClick={() => setOpen(false)}
        >
          <div className="p-1 space-y-0.5">
            <MenuItem icon={Eye} label="View Profile" onClick={() => { setOpen(false); onView(); }} />
            <MenuItem icon={Pencil} label="Edit Employee" onClick={() => { setOpen(false); onEdit(); }} />

            {/* Resend invite — only for pending (no password set yet) */}
            {status === "pending" && (
              <MenuItem icon={Mail} label="Resend Invite" onClick={() => { setOpen(false); onResendInvite(); }} />
            )}

            {/* Separator before status-change actions */}
            <div className="h-px bg-border mx-2 my-1" />

            {/* Deactivate — active or pending */}
            {(status === "active" || status === "pending") && (
              <MenuItem
                icon={UserX} label="Deactivate Account" danger
                onClick={() => { setOpen(false); onDeactivate(); }}
              />
            )}

            {/* Reactivate — inactive only */}
            {status === "inactive" && (
              <MenuItem
                icon={UserCheck} label="Reactivate Account"
                onClick={() => { setOpen(false); onReactivate(); }}
              />
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon, label, onClick, danger = false,
}: {
  icon: React.ElementType; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left
        ${danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted/60"}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

// ─── View Profile Sheet ───────────────────────────────────────────────────────

function ViewProfileSheet({
  employee, roleMap, deptMap, onClose,
}: {
  employee: Employee;
  roleMap: Record<string, string>;
  deptMap: Record<string, string>;
  onClose: () => void;
}) {
  const name = [employee.first_name, employee.last_name].filter(Boolean).join(" ") || employee.email;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative ml-auto h-full w-full max-w-md bg-background shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Employee Profile</p>
            <h2 className="text-lg font-bold text-foreground">{name}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Avatar + status */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl border border-primary/10 shrink-0">
              {initial}
            </div>
            <div>
              <p className="font-bold text-xl">{name}</p>
              <p className="text-sm text-muted-foreground">{employee.email}</p>
              <div className="mt-1.5"><StatusBadge status={employee.account_status} /></div>
            </div>
          </div>

          {/* Info fields */}
          <div className="space-y-3">
            <ProfileField icon={Hash}      label="Employee ID"  value={employee.employee_id} />
            <ProfileField icon={User}      label="Username"     value={employee.username} />
            <ProfileField icon={Shield}    label="Role"         value={employee.role_id ? (roleMap[employee.role_id] ?? employee.role_id) : null} />
            <ProfileField icon={Building2} label="Department"   value={employee.department_id ? (deptMap[employee.department_id] ?? employee.department_id) : null} />
            <ProfileField icon={Calendar}  label="Start Date"   value={employee.start_date ? new Date(employee.start_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : null} />
            <ProfileField icon={Calendar}  label="Last Login"   value={employee.last_login ? new Date(employee.last_login).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "Never"} />
          </div>

          {/* Invite expiry notice */}
          {employee.account_status?.toLowerCase() === "pending" && employee.invite_expires_at && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-0.5">Invite pending</p>
              <p className="text-xs opacity-80">
                Expires {new Date(employee.invite_expires_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value ?? "—"}</p>
      </div>
    </div>
  );
}

// ─── Edit Employee Modal ──────────────────────────────────────────────────────

function EditEmployeeModal({
  employee, roles, departments, saving, onSave, onClose,
}: {
  employee: Employee;
  roles: Role[];
  departments: Department[];
  saving: boolean;
  onSave: (updates: Partial<{ first_name: string; last_name: string; role_id: string; department_id: string; start_date: string }>) => void;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState(employee.first_name ?? "");
  const [lastName, setLastName] = useState(employee.last_name ?? "");
  const [roleId, setRoleId] = useState(employee.role_id ?? "");
  const [departmentId, setDepartmentId] = useState(employee.department_id ?? "");
  const [startDate, setStartDate] = useState(employee.start_date ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: any = {};
    if (firstName.trim() !== (employee.first_name ?? "")) updates.first_name = firstName.trim();
    if (lastName.trim() !== (employee.last_name ?? "")) updates.last_name = lastName.trim();
    if (roleId !== (employee.role_id ?? "")) updates.role_id = roleId;
    if (departmentId !== (employee.department_id ?? "")) updates.department_id = departmentId || undefined;
    if (startDate !== (employee.start_date ?? "")) updates.start_date = startDate || undefined;
    onSave(updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Edit Employee</p>
            <h2 className="text-base font-bold">
              {[employee.first_name, employee.last_name].filter(Boolean).join(" ") || employee.email}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">First Name</label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Last Name</label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Role</label>
            <select
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Select role —</option>
              {roles.map(r => (
                <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Department</label>
            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— No department —</option>
              {departments.map(d => (
                <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Start Date</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string | null }) {
  const s = status?.toLowerCase();
  if (s === "active")
    return <Badge className="text-[9px] bg-green-100 hover:bg-green-100 text-green-700 border border-green-200">Active</Badge>;
  if (s === "inactive")
    return <Badge className="text-[9px] bg-red-100 hover:bg-red-100 text-red-700 border border-red-200">Inactive</Badge>;
  return <Badge className="text-[9px] bg-amber-100 hover:bg-amber-100 text-amber-700 border border-amber-200">Pending</Badge>;
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <Card className="border-border/70 shadow-sm bg-[linear-gradient(160deg,rgba(37,99,235,0.05),rgba(15,23,42,0.00))]">
      <CardContent className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</p>
        <p className={`text-3xl font-bold tracking-tight ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
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

// Row action dropdown — HR can only deactivate or reactivate, not edit
function RowMenu({
  employee,
  onDeactivate,
  onReactivate,
}: {
  employee: Employee;
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

export default function HRDashboardPage() {
  const user = getUserInfo();
  const currentUserId = parseJwt(getAccessToken() ?? "")?.sub_userid as string | undefined;
  useWelcomeToast(user?.name || "HR Officer", "HR Administration");

  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [roles, setRoles]               = useState<Role[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
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
      const [users, rolesData] = await Promise.all([
        apiFetch<Employee[]>("/users"),
        apiFetch<Role[]>("/users/roles"),
      ]);
      setEmployees(users);
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

  const activeCount   = employees.filter(e => e.account_status === "Active").length;
  const pendingCount  = employees.filter(e => e.account_status === "Pending").length;
  const inactiveCount = employees.filter(e => e.account_status === "Inactive").length;

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
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">HR Administration</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Employee Directory and Account Controls</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Manage workforce access quickly with status filtering and direct account actions.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Current Scope</p>
            <p className="mt-1 text-lg font-bold">{employees.length} Users</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Users"  value={employees.length} sub="All accounts"         color="text-foreground" />
        <StatCard label="Active"       value={activeCount}      sub="Currently active"     color="text-green-600" />
        <StatCard label="Pending"      value={pendingCount}     sub="Awaiting activation"  color="text-amber-600" />
        <StatCard label="Inactive"     value={inactiveCount}    sub="Deactivated accounts" color="text-red-600" />
      </div>

      {/* Table Card */}
      <div className="bg-card border border-border/70 rounded-2xl shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))]">
          <div>
            <h2 className="font-bold text-base tracking-tight">Employee Directory</h2>
            <p className="text-xs text-muted-foreground">Manage account status for your company</p>
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
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/40 border-b border-border uppercase tracking-widest">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Employee ID</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    Loading employees...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    No employees found.
                  </td>
                </tr>
              ) : paged.map(e => (
                <tr key={e.user_id} className="hover:bg-primary/5 transition-colors">
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
                  {/* Actions */}
                  <td className="px-5 py-4 text-right">
                    {e.user_id === currentUserId ? (
                      <span className="text-[11px] text-muted-foreground italic px-2">You</span>
                    ) : (
                      <RowMenu
                        employee={e}
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
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

      {/* Deactivate confirmation */}
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
