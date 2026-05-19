"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { BookOpen, Building2, CalendarRange, Loader2, Pencil, RotateCcw, Save, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { LEAVE_CATEGORIES } from "@/lib/leaveCategories";

type BalanceRow = {
  leave_category: string;
  entitled_days: number;
  used_days: number;
  remaining_days: number;
  balance_source: "individual" | "bulk" | "default";
};

type EmployeeRosterRow = {
  employee_id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  department_id: string | null;
  categories: BalanceRow[];
};

type DefaultRow = { leave_category: string; default_days: number };
type DepartmentRow = { department_id: string; department_name: string };

const SOURCE_BADGE: Record<string, string> = {
  individual: "bg-blue-100 text-blue-700 border-blue-200",
  bulk:       "bg-amber-100 text-amber-700 border-amber-200",
  default:    "bg-slate-100 text-slate-600 border-slate-200",
};

export default function HRLeaveBalancesPage() {
  const normalizeWholeDay = (raw: string): number => {
    const digitsOnly = raw.replace(/[^\d]/g, "");
    if (!digitsOnly) return 0;
    return Math.max(0, Math.round(Number(digitsOnly)));
  };
  const [defaults, setDefaults] = useState<DefaultRow[]>([]);
  const [roster, setRoster] = useState<EmployeeRosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDefaults, setEditingDefaults] = useState(false);
  const [defaultDraft, setDefaultDraft] = useState<Record<string, number>>({});
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [empDraft, setEmpDraft] = useState<Record<string, number>>({});
  const [savingEmp, setSavingEmp] = useState(false);
  const [search, setSearch] = useState("");
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [departmentDefaults, setDepartmentDefaults] = useState<DefaultRow[]>([]);
  const [editingDepartmentDefaults, setEditingDepartmentDefaults] = useState(false);
  const [departmentDraft, setDepartmentDraft] = useState<Record<string, number>>({});
  const [savingDepartmentDefaults, setSavingDepartmentDefaults] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "default" | "bulk" | "individual">("all");
  const [statsView, setStatsView] = useState<"category" | "employee">("employee");
  const [statsHealthFilter, setStatsHealthFilter] = useState<null | "maxed" | "nearMax" | "healthy">(null);
  const [rolloverFromYear, setRolloverFromYear] = useState(() => new Date().getFullYear() - 1);
  const [rolloverToYear, setRolloverToYear] = useState(() => new Date().getFullYear());
  const [rollingOver, setRollingOver] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, rRes, depRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/leave-balances/company-default`),
        authFetch(`${API_BASE_URL}/leave-balances/employees`),
        authFetch(`${API_BASE_URL}/users/departments`),
      ]);
      const dData = await dRes.json().catch(() => []);
      const rData = await rRes.json().catch(() => []);
      const depData = await depRes.json().catch(() => []);
      setDefaults(Array.isArray(dData) ? dData : []);
      setRoster(Array.isArray(rData) ? rData : []);
      const departmentRows = Array.isArray(depData) ? depData : [];
      setDepartments(departmentRows);
      if (!selectedDepartmentId && departmentRows.length > 0) {
        setSelectedDepartmentId(departmentRows[0].department_id);
      }
    } catch (err) {
      toast.error("Failed to load leave balances");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedDepartmentId) {
      setDepartmentDefaults([]);
      return;
    }
    const run = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/leave-balances/departments/${selectedDepartmentId}/default`);
        const data = await res.json().catch(() => []);
        setDepartmentDefaults(Array.isArray(data) ? data : []);
      } catch {
        setDepartmentDefaults([]);
      }
    };
    void run();
  }, [selectedDepartmentId]);

  useEffect(() => { void load(); }, [load]);

  const startEditDefaults = () => {
    const d: Record<string, number> = {};
    defaults.forEach(r => { d[r.leave_category] = r.default_days; });
    LEAVE_CATEGORIES.forEach(c => { if (!(c.value in d)) d[c.value] = 0; });
    setDefaultDraft(d);
    setEditingDefaults(true);
  };

  const handleRollover = async () => {
    if (rolloverToYear <= rolloverFromYear) {
      toast.error("To year must be after From year.");
      return;
    }
    setRollingOver(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/leave-balances/rollover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_year: rolloverFromYear, to_year: rolloverToYear }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string })?.message || "Rollover failed");
      const summary = (data as { employees_processed?: number; summary?: unknown[] });
      toast.success(`Rollover complete — ${summary.employees_processed ?? 0} employees processed, ${summary.summary?.length ?? 0} carryovers applied.`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rollover failed");
    } finally {
      setRollingOver(false);
    }
  };

  const saveDefaults = async () => {
    setSavingDefaults(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/leave-balances/company-default`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: Object.entries(defaultDraft).map(([leave_category, default_days]) => ({ leave_category, default_days })) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).message || "Save failed"); }
      toast.success("Company defaults saved.");
      setEditingDefaults(false);
      void load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally { setSavingDefaults(false); }
  };

  const startEditDepartmentDefaults = () => {
    const d: Record<string, number> = {};
    departmentDefaults.forEach(r => { d[r.leave_category] = r.default_days; });
    LEAVE_CATEGORIES.forEach(c => { if (!(c.value in d)) d[c.value] = 0; });
    setDepartmentDraft(d);
    setEditingDepartmentDefaults(true);
  };

  const saveDepartmentDefaults = async () => {
    if (!selectedDepartmentId) return;
    setSavingDepartmentDefaults(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/leave-balances/departments/${selectedDepartmentId}/default`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: Object.entries(departmentDraft).map(([leave_category, default_days]) => ({ leave_category, default_days })) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).message || "Save failed"); }
      toast.success("Department defaults saved.");
      setEditingDepartmentDefaults(false);
      const data = await res.json().catch(() => []);
      setDepartmentDefaults(Array.isArray(data) ? data : []);
      void load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally { setSavingDepartmentDefaults(false); }
  };

  const startEditEmployee = (emp: EmployeeRosterRow) => {
    const d: Record<string, number> = {};
    emp.categories.forEach(c => { d[c.leave_category] = c.entitled_days; });
    setEmpDraft(d);
    setEditingEmployee(emp.user_id);
  };

  const saveEmployee = async (userId: string) => {
    setSavingEmp(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/leave-balances/employees/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: Object.entries(empDraft).map(([leave_category, entitled_days]) => ({ leave_category, entitled_days })) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).message || "Save failed"); }
      toast.success("Employee balances saved.");
      setEditingEmployee(null);
      void load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally { setSavingEmp(false); }
  };

  const resetToDefault = async (userId: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/leave-balances/employees/${userId}/reset-company-default`, { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      toast.success("Reset to company default.");
      void load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Reset failed"); }
  };

  const filtered = roster.filter((e) => {
    const matchesSearch =
      search === "" || `${e.first_name} ${e.last_name} ${e.employee_id}`.toLowerCase().includes(search.toLowerCase());
    const matchesDepartment =
      departmentFilter === "all" || e.department_id === departmentFilter;
    const matchesSource =
      sourceFilter === "all" || e.categories.some((c) => c.balance_source === sourceFilter);
    return matchesSearch && matchesDepartment && matchesSource;
  });

  const balanceStatsByCategory = useMemo(() => {
    const all = filtered.flatMap((emp) => emp.categories);
    const maxed = all.filter((c) => c.remaining_days <= 0).length;
    const nearMax = all.filter((c) => c.remaining_days > 0 && c.remaining_days <= 2).length;
    const healthy = all.filter((c) => c.remaining_days > 2).length;
    return { total: all.length, maxed, nearMax, healthy };
  }, [filtered]);

  const balanceStatsByEmployee = useMemo(() => {
    const maxed = filtered.filter((emp) => emp.categories.some((c) => c.remaining_days <= 0)).length;
    const nearMax = filtered.filter((emp) =>
      !emp.categories.some((c) => c.remaining_days <= 0) &&
      emp.categories.some((c) => c.remaining_days > 0 && c.remaining_days <= 2),
    ).length;
    const healthy = filtered.filter((emp) => emp.categories.every((c) => c.remaining_days > 2)).length;
    return { total: filtered.length, maxed, nearMax, healthy };
  }, [filtered]);

  const balanceStats = statsView === "employee" ? balanceStatsByEmployee : balanceStatsByCategory;

  const displayedEmployees = useMemo(() => {
    if (!statsHealthFilter) return filtered;
    if (statsHealthFilter === "maxed") return filtered.filter(emp => emp.categories.some(c => c.remaining_days <= 0));
    if (statsHealthFilter === "nearMax") return filtered.filter(emp =>
      !emp.categories.some(c => c.remaining_days <= 0) &&
      emp.categories.some(c => c.remaining_days > 0 && c.remaining_days <= 2),
    );
    if (statsHealthFilter === "healthy") return filtered.filter(emp => emp.categories.every(c => c.remaining_days > 2));
    return filtered;
  }, [filtered, statsHealthFilter]);
  const selectedDepartmentName = useMemo(
    () => departments.find((dep) => dep.department_id === selectedDepartmentId)?.department_name ?? "Department",
    [departments, selectedDepartmentId],
  );

  if (loading) return (
    <div className="min-h-64 flex items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /><span>Loading leave balances...</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-6 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.35)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-blue-200/25 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">HR Administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Leave Balances</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Manage company defaults, department baselines, and employee-specific leave balances in days.</p>
        </div>
      </section>

      <p className="text-xs text-slate-500">Order of setup: company defaults first, then department defaults, then employee overrides only when needed.</p>

      {/* Company defaults */}
      <Card className="bg-card rounded-xl border border-slate-200/80 shadow-[0_16px_32px_-24px_rgba(15,23,42,0.55)]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Company Defaults
          </CardTitle>
          {!editingDefaults ? (
            <Button size="sm" variant="outline" onClick={startEditDefaults}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditingDefaults(false)}>Cancel</Button>
              <Button size="sm" disabled={savingDefaults} onClick={saveDefaults}>
                {savingDefaults ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {LEAVE_CATEGORIES.map(({ value, label, icon: Icon }) => {
              const defaultVal = defaults.find(d => d.leave_category === value)?.default_days ?? 0;
              return (
                <div key={value} className="rounded-lg border border-slate-200/80 p-3 bg-white transition-transform duration-200 hover:-translate-y-[1px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold">{label}</span>
                  </div>
                  {editingDefaults ? (
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={defaultDraft[value] ?? 0}
                      onChange={e => setDefaultDraft(p => ({ ...p, [value]: normalizeWholeDay(e.target.value) }))}
                      onBlur={e => setDefaultDraft(p => ({ ...p, [value]: normalizeWholeDay(e.target.value) }))}
                      className="w-full border rounded px-2 py-1 text-sm bg-background" />
                  ) : (
                    <p className="text-xl font-bold text-primary">{defaultVal}<span className="text-xs font-normal text-muted-foreground ml-1">days</span></p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card rounded-xl border border-slate-200/80 shadow-[0_16px_32px_-24px_rgba(15,23,42,0.55)]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Department Defaults
          </CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={selectedDepartmentId}
              onChange={(e) => {
                setSelectedDepartmentId(e.target.value);
                setEditingDepartmentDefaults(false);
              }}
              className="border rounded-md px-3 py-1.5 text-sm bg-background w-56"
            >
              {departments.map(dep => (
                <option key={dep.department_id} value={dep.department_id}>{dep.department_name}</option>
              ))}
            </select>
            {!editingDepartmentDefaults ? (
              <Button size="sm" variant="outline" disabled={!selectedDepartmentId} onClick={startEditDepartmentDefaults}>
                <Pencil className="h-3.5 w-3.5 mr-1" />Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingDepartmentDefaults(false)}>Cancel</Button>
                <Button size="sm" disabled={savingDepartmentDefaults} onClick={saveDepartmentDefaults}>
                  {savingDepartmentDefaults ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}Save
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedDepartmentId ? (
            <p className="text-sm text-muted-foreground">No departments yet.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                These balances apply by default to employees under <span className="font-semibold text-foreground">{selectedDepartmentName}</span>.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {LEAVE_CATEGORIES.map(({ value, label, icon: Icon }) => {
                  const defaultVal = departmentDefaults.find(d => d.leave_category === value)?.default_days ?? 0;
                  return (
                    <div key={value} className="rounded-lg border border-slate-200/80 p-3 bg-white transition-transform duration-200 hover:-translate-y-[1px]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold">{label}</span>
                      </div>
                      {editingDepartmentDefaults ? (
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={departmentDraft[value] ?? 0}
                          onChange={e => setDepartmentDraft(p => ({ ...p, [value]: normalizeWholeDay(e.target.value) }))}
                          onBlur={e => setDepartmentDraft(p => ({ ...p, [value]: normalizeWholeDay(e.target.value) }))}
                          className="w-full border rounded px-2 py-1 text-sm bg-background" />
                      ) : (
                        <p className="text-xl font-bold text-primary">{defaultVal}<span className="text-xs font-normal text-muted-foreground ml-1">days</span></p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roster */}
      <Card className="bg-card rounded-xl border border-slate-200/80 shadow-[0_16px_32px_-24px_rgba(15,23,42,0.55)]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Employee Balances
          </CardTitle>
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)}
              className="border rounded-md pl-8 pr-3 py-1.5 text-sm bg-background w-52" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <div className="sm:col-span-3 flex items-center gap-2 mb-1">
              <Button
                type="button"
                size="sm"
                variant={statsView === "employee" ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setStatsView("employee")}
              >
                Per Employee
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statsView === "category" ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setStatsView("category")}
              >
                Per Leave Type Row
              </Button>
              <span className="text-[11px] text-muted-foreground ml-auto">
                Total: {balanceStats.total}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStatsHealthFilter(prev => prev === "maxed" ? null : "maxed")}
              className={`rounded-lg border px-3 py-2 text-left transition-all cursor-pointer ${statsHealthFilter === "maxed" ? "border-red-400 bg-red-100 ring-2 ring-red-300" : "border-red-200 bg-red-50 hover:border-red-300"}`}
            >
              <p className="text-[11px] font-semibold text-red-700">No Remaining {statsHealthFilter === "maxed" && "· filtered"}</p>
              <p className="text-xl font-bold text-red-800">{balanceStats.maxed}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatsHealthFilter(prev => prev === "nearMax" ? null : "nearMax")}
              className={`rounded-lg border px-3 py-2 text-left transition-all cursor-pointer ${statsHealthFilter === "nearMax" ? "border-amber-400 bg-amber-100 ring-2 ring-amber-300" : "border-amber-200 bg-amber-50 hover:border-amber-300"}`}
            >
              <p className="text-[11px] font-semibold text-amber-700">Near Limit (≤2 days) {statsHealthFilter === "nearMax" && "· filtered"}</p>
              <p className="text-xl font-bold text-amber-800">{balanceStats.nearMax}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatsHealthFilter(prev => prev === "healthy" ? null : "healthy")}
              className={`rounded-lg border px-3 py-2 text-left transition-all cursor-pointer ${statsHealthFilter === "healthy" ? "border-emerald-400 bg-emerald-100 ring-2 ring-emerald-300" : "border-emerald-200 bg-emerald-50 hover:border-emerald-300"}`}
            >
              <p className="text-[11px] font-semibold text-emerald-700">Healthy {statsHealthFilter === "healthy" && "· filtered"}</p>
              <p className="text-xl font-bold text-emerald-800">{balanceStats.healthy}</p>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge className={SOURCE_BADGE.default}>company default</Badge>
            <Badge className={SOURCE_BADGE.bulk}>department default</Badge>
            <Badge className={SOURCE_BADGE.individual}>employee override</Badge>
            <span className="text-xs text-muted-foreground ml-auto">{displayedEmployees.length} employee(s){statsHealthFilter && ` · filtered`}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border rounded-md px-2.5 py-1.5 text-xs bg-background"
            >
              <option value="all">All departments</option>
              {departments.map((dep) => (
                <option key={dep.department_id} value={dep.department_id}>{dep.department_name}</option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as "all" | "default" | "bulk" | "individual")}
              className="border rounded-md px-2.5 py-1.5 text-xs bg-background"
            >
              <option value="all">All sources</option>
              <option value="default">Company default</option>
              <option value="bulk">Department default</option>
              <option value="individual">Employee override</option>
            </select>
          </div>
          {displayedEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees found.</p>
          ) : (
            <div className="space-y-3">
              {displayedEmployees.map((emp) => {
                const isEditing = editingEmployee === emp.user_id;
                return (
                  <div key={emp.user_id} className="rounded-xl border border-slate-200/80 p-4 space-y-3 bg-white transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_12px_24px_-18px_rgba(15,23,42,0.45)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{emp.first_name} {emp.last_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.employee_id}</p>
                      </div>
                      <div className="flex gap-2">
                        {!isEditing ? (
                          <>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => startEditEmployee(emp)}>
                              <Pencil className="h-3 w-3 mr-1" />Edit
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => void resetToDefault(emp.user_id)}>
                              <RotateCcw className="h-3 w-3 mr-1" />Reset
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setEditingEmployee(null)}>Cancel</Button>
                            <Button size="sm" className="h-7 px-2 text-xs" disabled={savingEmp} onClick={() => void saveEmployee(emp.user_id)}>
                              {savingEmp ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}Save
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {emp.categories.map((cat) => {
                        const catMeta = LEAVE_CATEGORIES.find(c => c.value === cat.leave_category);
                        const Icon = catMeta?.icon;
                        return (
                          <div key={cat.leave_category} className="rounded-lg border border-slate-200/80 p-2 bg-slate-50/40 text-xs">
                            <div className="flex items-center gap-1 mb-1">
                              {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
                              <span className="font-medium truncate">{catMeta?.label ?? cat.leave_category}</span>
                              <Badge className={`ml-auto text-[9px] px-1 py-0 capitalize ${SOURCE_BADGE[cat.balance_source]}`}>
                                {cat.balance_source === "bulk" ? "department" : cat.balance_source}
                              </Badge>
                            </div>
                            {isEditing ? (
                              <input type="text" inputMode="numeric" pattern="[0-9]*" value={empDraft[cat.leave_category] ?? 0}
                                onChange={e => setEmpDraft(p => ({ ...p, [cat.leave_category]: normalizeWholeDay(e.target.value) }))}
                                onBlur={e => setEmpDraft(p => ({ ...p, [cat.leave_category]: normalizeWholeDay(e.target.value) }))}
                                className="w-full border rounded px-1.5 py-0.5 text-xs bg-background" />
                            ) : (
                              <p className="font-bold text-primary">{Math.round(cat.used_days)}<span className="text-muted-foreground font-normal"> / {Math.round(cat.entitled_days)} used</span></p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Yearly Rollover ─────────────────────────────────────────────────── */}
      <Card className="bg-card rounded-xl border border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" /> Yearly Leave Balance Rollover
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Carry unused Vacation, Sick, and Personal leave days from one year into the next.
            Maternity and Paternity leave are excluded (statutory, non-accumulating).
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">From Year</label>
              <input
                type="number"
                min={2020}
                max={new Date().getFullYear()}
                value={rolloverFromYear}
                onChange={e => setRolloverFromYear(Number(e.target.value))}
                className="w-24 border border-border rounded-lg px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">To Year</label>
              <input
                type="number"
                min={2021}
                max={new Date().getFullYear() + 1}
                value={rolloverToYear}
                onChange={e => setRolloverToYear(Number(e.target.value))}
                className="w-24 border border-border rounded-lg px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:border-primary"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={rollingOver}
              onClick={() => void handleRollover()}
              className="gap-2"
            >
              {rollingOver ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="h-3.5 w-3.5" />}
              {rollingOver ? "Processing…" : `Roll Over ${rolloverFromYear} → ${rolloverToYear}`}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Note: Maternity (105 days paid + up to 30 days unpaid extension) and Paternity (7 days paid + up to 30 days unpaid) balances are fixed by law and excluded from carryover.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
