"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarDays, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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

const SOURCE_BADGE: Record<string, string> = {
  individual: "bg-blue-100 text-blue-700 border-blue-200",
  bulk:       "bg-amber-100 text-amber-700 border-amber-200",
  default:    "bg-slate-100 text-slate-600 border-slate-200",
};

export default function ManagerLeaveBalancesPage() {
  const [roster, setRoster] = useState<EmployeeRosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/leave-balances/employees`);
      const data = await res.json().catch(() => []);
      setRoster(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load leave balances");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = roster.filter(e =>
    search === "" || `${e.first_name} ${e.last_name} ${e.employee_id}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-64 flex items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /><span>Loading leave balances...</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Leave Balances</h1>
        <p className="text-muted-foreground text-sm mt-1">View leave entitlements for your team members. Contact HR to modify balances.</p>
      </div>

      <Card className="bg-card rounded-xl border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Employee Balances
          </CardTitle>
          <input
            placeholder="Search employees..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-background w-48"
          />
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((emp) => (
                <div key={emp.user_id} className="rounded-xl border p-4 space-y-3 hover:bg-primary/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs text-muted-foreground">{emp.employee_id}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {emp.categories.length === 0 ? (
                      <p className="text-xs text-muted-foreground col-span-3">No leave balance data.</p>
                    ) : emp.categories.map((cat) => {
                      const catMeta = LEAVE_CATEGORIES.find(c => c.value === cat.leave_category);
                      const Icon = catMeta?.icon;
                      const pct = cat.entitled_days > 0 ? Math.round((cat.remaining_days / cat.entitled_days) * 100) : 0;
                      const barColor = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-400" : "bg-red-500";
                      return (
                        <div key={cat.leave_category} className="rounded-lg border p-2 bg-background text-xs space-y-1.5">
                          <div className="flex items-center gap-1 mb-1">
                            {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
                            <span className="font-medium truncate">{catMeta?.label ?? cat.leave_category}</span>
                            <Badge className={`ml-auto text-[9px] px-1 py-0 ${SOURCE_BADGE[cat.balance_source]}`}>{cat.balance_source}</Badge>
                          </div>
                          <p className="font-bold text-primary tabular-nums">
                            {cat.remaining_days}
                            <span className="text-muted-foreground font-normal">/{cat.entitled_days}d</span>
                          </p>
                          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
