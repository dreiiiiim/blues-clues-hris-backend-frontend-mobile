'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  Search,
  ShieldOff,
  Clock,
} from 'lucide-react';
import { saApi } from '@/lib/superAdminApi';
import { ConfirmDialog } from '@/components/super-admin/ConfirmDialog';

type Renewal = {
  registration_id: string;
  company_id: string | null;
  company_name: string;
  subscription_plan: string;
  end_date: string;
  days_remaining: number;
  renewal_status: 'Upcoming' | 'Due Soon' | 'Expired';
  email: string;
};

type ConfirmState = {
  action: 'remind' | 'suspend';
  id: string;
  name: string;
  email?: string;
} | null;

function statusStyle(status: Renewal['renewal_status']) {
  if (status === 'Expired') return 'bg-red-50 text-red-600 border-red-200';
  if (status === 'Due Soon') return 'bg-amber-50 text-amber-600 border-amber-200';
  return 'bg-emerald-50 text-emerald-600 border-emerald-200';
}

function daysLabel(days: number) {
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return 'Due today';
  return `${days} days left`;
}

export default function RenewalsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | 'Upcoming' | 'Due Soon' | 'Expired'>('All');
  const [renewModal, setRenewModal] = useState<Renewal | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data: renewals = [], isLoading } = useQuery({
    queryKey: ['sa-renewals'],
    queryFn: () => saApi.get('/renewals').then((r) => r.data as Renewal[]),
  });

  const remind = useMutation({
    mutationFn: (id: string) => saApi.post(`/renewals/${id}/remind`),
    onSuccess: () => setConfirm(null),
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Failed to send reminder');
      setConfirm(null);
    },
  });

  const markRenewed = useMutation({
    mutationFn: ({ id, bc }: { id: string; bc: 'monthly' | 'annual' }) =>
      saApi.patch(`/renewals/${id}/mark-renewed`, { billing_cycle: bc }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-renewals'] });
      setRenewModal(null);
    },
  });

  const suspend = useMutation({
    mutationFn: (id: string) => saApi.patch(`/renewals/${id}/suspend`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-renewals'] });
      setConfirm(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Failed to suspend company');
      setConfirm(null);
    },
  });

  const counts = useMemo(() => {
    const upcoming = renewals.filter((r) => r.renewal_status === 'Upcoming').length;
    const dueSoon = renewals.filter((r) => r.renewal_status === 'Due Soon').length;
    const expired = renewals.filter((r) => r.renewal_status === 'Expired').length;
    return { upcoming, dueSoon, expired };
  }, [renewals]);

  const filteredRenewals = useMemo(() => {
    return renewals.filter((item) => {
      const q = query.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.company_name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        (item.subscription_plan || '').toLowerCase().includes(q);
      const matchesStatus = status === 'All' || item.renewal_status === status;
      return matchesSearch && matchesStatus;
    });
  }, [renewals, query, status]);

  function handleConfirm() {
    if (!confirm) return;
    if (confirm.action === 'remind') remind.mutate(confirm.id);
    else suspend.mutate(confirm.id);
  }

  const isMutating = remind.isPending || suspend.isPending;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Page header */}
      <div className="pb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">
          Subscription Monitoring
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Renewals</h1>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="text-slate-500 tabular-nums">{counts.upcoming} upcoming</span>
            <span className={counts.dueSoon > 0 ? 'text-amber-600 tabular-nums' : 'text-slate-500 tabular-nums'}>
              {counts.dueSoon} due soon
            </span>
            <span className={counts.expired > 0 ? 'text-red-600 tabular-nums' : 'text-slate-500 tabular-nums'}>
              {counts.expired} expired
            </span>
          </div>
        </div>
      </div>

      {/* Urgency banner — only when expired */}
      {counts.expired > 0 && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-700 font-medium">
            {counts.expired} subscription{counts.expired !== 1 ? 's have' : ' has'} expired. Send reminders or suspend to reflect status.
          </span>
        </div>
      )}

      {counts.dueSoon > 0 && counts.expired === 0 && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
          <Clock className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-700 font-medium">
            {counts.dueSoon} subscription{counts.dueSoon !== 1 ? 's are' : ' is'} due soon. Consider sending renewal reminders.
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl text-sm bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button
            onClick={() => setErrorMsg('')}
            className="text-red-400 hover:text-red-600 transition-colors text-xs font-bold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 px-6 py-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search company..."
                className="h-10 w-full sm:w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'All' | 'Upcoming' | 'Due Soon' | 'Expired')}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option>All</option>
              <option>Upcoming</option>
              <option>Due Soon</option>
              <option>Expired</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Current Plan</th>
                <th className="px-6 py-4">Renewal Date</th>
                <th className="px-6 py-4">Days Remaining</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Admin Email</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    {[55, 50, 60, 45, 40, 65, 50].map((w, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 rounded animate-shimmer" style={{ width: `${w}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRenewals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">No renewals found.</td>
                </tr>
              ) : (
                filteredRenewals.map((item) => (
                  <tr
                    key={item.registration_id}
                    className={item.renewal_status === 'Expired' ? 'bg-red-50/30' : 'hover:bg-slate-50'}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-slate-900">{item.company_name}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-600 capitalize">{item.subscription_plan || 'N/A'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {item.end_date ? new Date(item.end_date).toLocaleDateString('en-PH') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 font-medium">{daysLabel(item.days_remaining)}</td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyle(item.renewal_status)}`}
                      >
                        {item.renewal_status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-600">{item.email || 'N/A'}</td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setConfirm({ action: 'remind', id: item.registration_id, name: item.company_name, email: item.email })}
                          disabled={isMutating}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-colors disabled:opacity-50"
                          title="Send reminder"
                        >
                          <Bell className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Remind</span>
                        </button>
                        <button
                          onClick={() => { setRenewModal(item); setBillingCycle('monthly'); }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:scale-[0.98] transition-colors"
                          title="Mark renewed"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Renew</span>
                        </button>
                        {item.renewal_status === 'Expired' && (
                          <button
                            onClick={() => setConfirm({ action: 'suspend', id: item.registration_id, name: item.company_name })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 active:scale-[0.98] transition-colors"
                            title="Suspend"
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Suspend</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/60 text-xs text-slate-500">
          Showing {filteredRenewals.length} renewal records.
        </div>
      </div>

      {renewModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
          style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setRenewModal(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
            <h2 className="font-bold text-slate-900 mb-1">Mark as Renewed</h2>
            <p className="text-xs text-slate-400 mb-5">{renewModal.company_name}</p>
            <div className="mb-5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-3">
                Billing Cycle
              </label>
              <div className="flex gap-3">
                {(['monthly', 'annual'] as const).map((bc) => (
                  <button
                    key={bc}
                    type="button"
                    onClick={() => setBillingCycle(bc)}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl border transition-colors duration-200 capitalize ${
                      billingCycle === bc
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {bc}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-5 p-3 bg-slate-50 rounded-xl">
              Sets payment_date to today — next renewal is recalculated from now.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRenewModal(null)}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => markRenewed.mutate({ id: renewModal.registration_id, bc: billingCycle })}
                disabled={markRenewed.isPending}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-colors duration-200 disabled:opacity-50"
              >
                Confirm Renewal
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.action === 'remind' ? 'Send Renewal Reminder' : 'Suspend Company'}
          message={
            confirm.action === 'remind'
              ? `Send a renewal reminder email to ${confirm.email ?? confirm.name}?`
              : `Suspending ${confirm.name} blocks all user logins immediately. This can be reversed from the Companies page.`
          }
          confirmLabel={confirm.action === 'remind' ? 'Send Reminder' : 'Suspend'}
          confirmStyle={confirm.action === 'suspend' ? 'danger' : 'primary'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          loading={isMutating}
        />
      )}
    </div>
  );
}
