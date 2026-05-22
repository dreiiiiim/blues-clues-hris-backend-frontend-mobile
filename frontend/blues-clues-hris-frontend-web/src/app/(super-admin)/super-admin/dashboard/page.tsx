'use client';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { saApi } from '@/lib/superAdminApi';
import { ConfirmDialog } from '@/components/super-admin/ConfirmDialog';
import { useState } from 'react';
import {
  Building2, CreditCard, AlertTriangle, CheckCircle2, ShieldOff,
  Clock, TrendingUp, Zap, AlertCircle,
} from 'lucide-react';

type Stats = {
  total_companies: number;
  active_subscriptions: number;
  pending_approvals: number;
  suspended_count: number;
  expired_count: number;
  monthly_revenue: number | null;
};

type PendingApproval = {
  registration_id: string;
  company_id: string | null;
  company_name: string;
  email: string;
  industry: string;
  subscription_plan: string;
  billing_cycle: string;
  registered_date: string;
};

function StatCell({ title, value, icon: Icon, color, bgColor, badge }: {
  title: string; value: string | number; icon: React.ElementType;
  color: string; bgColor: string; badge?: string;
}) {
  return (
    <div className="flex-1 px-5 py-4 flex items-center gap-3 min-w-0">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${bgColor}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">{title}</p>
        <div className="flex items-center gap-2">
          <p className="text-xl font-bold text-slate-900 tabular-nums leading-none mt-0.5">{value}</p>
          {badge && (
            <span className="text-[9px] font-bold uppercase tracking-widest bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 shrink-0 leading-none">
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data: stats } = useQuery<Stats>({
    queryKey: ['sa-dashboard', 'stats'],
    queryFn: () => saApi.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: pending = [], isLoading } = useQuery<PendingApproval[]>({
    queryKey: ['sa-dashboard', 'pending-approvals'],
    queryFn: () => saApi.get('/dashboard/pending-approvals').then(r => r.data),
    refetchInterval: 60_000,
  });

  const provision = useMutation({
    mutationFn: (id: string) => saApi.post(`/companies/${id}/provision`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-dashboard'] }); setConfirmId(null); },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Provisioning failed');
      setConfirmId(null);
    },
  });

  const statCells = [
    { title: 'Total Companies',      value: stats?.total_companies ?? '—',      icon: Building2,    color: 'text-blue-600',    bgColor: 'bg-blue-500/10' },
    { title: 'Active Subscriptions', value: stats?.active_subscriptions ?? '—', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10' },
    { title: 'Pending Approvals',    value: stats?.pending_approvals ?? '—',    icon: AlertTriangle,color: 'text-amber-600',   bgColor: 'bg-amber-500/10',
      badge: (stats?.pending_approvals ?? 0) > 0 ? 'Action needed' : undefined },
    { title: 'Suspended',            value: stats?.suspended_count ?? '—',      icon: ShieldOff,    color: 'text-red-600',     bgColor: 'bg-red-500/10' },
    { title: 'Expired',              value: stats?.expired_count ?? '—',        icon: Clock,        color: 'text-slate-500',   bgColor: 'bg-slate-400/15' },
    { title: 'Monthly Revenue',
      value: stats?.monthly_revenue != null ? `₱${stats.monthly_revenue.toLocaleString()}` : '—',
      icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Superadmin Control Center</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <Zap className="h-3 w-3" /> System Operational
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl text-sm bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 text-xs font-bold shrink-0">Dismiss</button>
        </div>
      )}

      <div className="flex divide-x divide-slate-100 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex-wrap">
        {statCells.map(cell => <StatCell key={cell.title} {...cell} />)}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-slate-900">Pending Approvals</h2>
              {(stats?.pending_approvals ?? 0) > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{stats?.pending_approvals}</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Companies awaiting provisioning</p>
          </div>
          <Link href="/super-admin/companies" className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">View all →</Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Company', 'Email', 'Industry', 'Plan', 'Billing', 'Registered', 'Action'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}>
                    {[60, 100, 80, 50, 60, 70, 50].map((w, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${w}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pending.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                      <p className="text-sm font-medium text-slate-500">All caught up!</p>
                      <p className="text-xs text-slate-400">No pending approvals right now.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pending.map(p => (
                  <tr key={p.registration_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-blue-600">{p.company_name.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <span className="font-semibold text-slate-900">{p.company_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{p.email}</td>
                    <td className="px-5 py-3.5 text-slate-600">{p.industry}</td>
                    <td className="px-5 py-3.5">
                      <span className="capitalize bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-lg">{p.subscription_plan}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 capitalize">{p.billing_cycle}</td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">
                      {p.registered_date ? new Date(p.registered_date).toLocaleDateString('en-PH') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {!p.company_id ? (
                        <button
                          onClick={() => setConfirmId({ id: p.registration_id, name: p.company_name })}
                          disabled={provision.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                        >
                          <Zap className="h-3 w-3" /> Provision
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Provisioned
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pending.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <p className="text-xs text-slate-400">Showing {pending.length} pending registration{pending.length !== 1 ? 's' : ''}</p>
            <Link href="/super-admin/companies" className="text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors">Manage all →</Link>
          </div>
        )}
      </div>

      {confirmId && (
        <ConfirmDialog
          title="Provision Company"
          message={`This will create the HRIS tenant for ${confirmId.name}. The company gains system access immediately.`}
          confirmLabel="Provision"
          onConfirm={() => provision.mutate(confirmId.id)}
          onCancel={() => setConfirmId(null)}
          loading={provision.isPending}
        />
      )}
    </div>
  );
}
