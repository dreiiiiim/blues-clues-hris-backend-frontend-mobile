"use client";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { getUserInfo } from "@/lib/authStorage";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import {
  Users, FileText, UserPlus, MoreHorizontal, Filter,
  Download, Search, ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Employee = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_id: number;
  account_status: string | null;
};

export default function HRDashboardPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const itemsPerPage = 5;

  const user = getUserInfo();
  const userName = user?.name || "HR Officer";
  useWelcomeToast(userName, "HR Administration");

  useEffect(() => {
    Promise.all([
      authFetch(`${API_BASE_URL}/users`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/users/stats`).then(r => r.json()),
    ])
      .then(([emps, stats]) => {
        setEmployees(Array.isArray(emps) ? emps : []);
        setTotalCount(stats?.total ?? null);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredData = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return employees.filter(e => {
      const name = `${e.first_name ?? ""} ${e.last_name ?? ""}`.toLowerCase();
      return name.includes(q) || e.email.toLowerCase().includes(q);
    });
  }, [searchTerm, employees]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentTableData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard icon={Users}    label="Total Headcount"       value={totalCount !== null ? String(totalCount) : "—"} sub="Active Employees" trend={totalCount !== null ? `${totalCount} total` : "Loading..."} />
        {/* TODO: wire to dedicated endpoint when available */}
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
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9 w-64 h-9 bg-background"
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9"><Filter className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-9 w-9"><Download className="h-4 w-4" /></Button>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-y border-border uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-sm">Loading employees...</td></tr>
              ) : fetchError ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-destructive text-sm">Failed to load employees. Please refresh or contact support.</td></tr>
              ) : currentTableData.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-sm">No employees found.</td></tr>
              ) : currentTableData.map((row) => {
                const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
                const initial = name.charAt(0).toUpperCase();
                return (
                  <tr key={row.user_id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="h-9 w-9 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-xs border border-primary/5">
                        {initial}
                      </div>
                      <p className="font-semibold text-foreground">{name}</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{row.email}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={row.account_status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
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
              ? `Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, filteredData.length)} of ${filteredData.length}`
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
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = status?.toLowerCase();
  if (s === 'active')
    return <Badge className="text-[9px] bg-green-100 hover:bg-green-100 text-green-700 border border-green-200">Active</Badge>;
  if (s === 'inactive')
    return <Badge className="text-[9px] bg-red-100 hover:bg-red-100 text-red-700 border border-red-200">Inactive</Badge>;
  return <Badge className="text-[9px] bg-amber-100 hover:bg-amber-100 text-amber-700 border border-amber-200">Pending</Badge>;
}

function MetricCard({ icon: Icon, label, value, sub, trend, isAlert }: any) {
  return (
    <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2 rounded-lg ${isAlert ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${isAlert ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground uppercase"}`}>
            {trend}
          </span>
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <h2 className="text-2xl font-bold tracking-tight">{value}</h2>
        <p className="text-xs text-muted-foreground font-medium">{sub}</p>
      </CardContent>
    </Card>
  );
}
