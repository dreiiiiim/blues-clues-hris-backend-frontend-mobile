'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saApi } from '@/lib/superAdminApi';
import { StatusBadge } from '@/components/super-admin/StatusBadge';
import { CreditCard, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/super-admin/ConfirmDialog';

type Subscription = {
  registration_id: string;
  company_name: string;
  subscription_plan: string;
  billing_cycle: string;
  subscription_status: string;
  payment_status: string;
  start_date: string;
  end_date: string;
  transaction_id: string;
};

const STATUSES = ['Active', 'Pending', 'Suspended', 'Expired'];

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: '', billing_cycle: '', page: 1 });
  const [statusModal, setStatusModal] = useState<Subscription | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<Subscription | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusConfirm, setStatusConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sa-subscriptions', filters],
    queryFn: () => saApi.get('/subscriptions', { params: filters }).then(r => r.data),
  });

  const { data: history } = useQuery({
    queryKey: ['sa-payment-history', historyDrawer?.registration_id],
    queryFn: () =>
      saApi.get(`/subscriptions/${historyDrawer!.registration_id}/payment-history`).then(r => r.data),
    enabled: !!historyDrawer,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      saApi.patch(`/subscriptions/${id}/status`, { subscription_status: status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-subscriptions'] });
      setStatusModal(null);
    },
  });

  const subs: Subscription[] = data?.data ?? [];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Page header */}
      <div className="pb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">
          Subscription Management
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subscriptions</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CreditCard className="h-4 w-4 text-slate-400" />
            <span className="font-bold text-slate-700 tabular-nums">{data?.total ?? subs.length}</span>
            <span>subscriptions</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilters(f => ({ ...f, status: f.status === s ? '' : s, page: 1 }))}
              className={`px-3.5 py-1.5 rounded-xl text-sm font-bold border transition-colors duration-200 ${
                filters.status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={filters.billing_cycle}
          onChange={e => setFilters(f => ({ ...f, billing_cycle: e.target.value, page: 1 }))}
          className="ml-auto h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-shadow"
        >
          <option value="">All billing cycles</option>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Company', 'Plan', 'Billing', 'Status', 'Payment', 'Start', 'End', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[60, 45, 40, 50, 50, 55, 55, 60].map((w, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 rounded animate-shimmer" style={{ width: `${w}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : subs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">No subscriptions found</td>
                </tr>
              ) : (
                subs.map(s => (
                  <tr key={s.registration_id} className="hover:bg-slate-50 transition-colors duration-150">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{s.company_name}</td>
                    <td className="px-5 py-3.5">
                      <span className="capitalize bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-lg">
                        {s.subscription_plan}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 capitalize text-xs">{s.billing_cycle}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={s.subscription_status} /></td>
                    <td className="px-5 py-3.5"><StatusBadge status={s.payment_status} /></td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {s.start_date ? new Date(s.start_date).toLocaleDateString('en-PH') : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {s.end_date ? new Date(s.end_date).toLocaleDateString('en-PH') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setStatusModal(s); setNewStatus(s.subscription_status); }}
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 active:scale-[0.98] transition-colors duration-200"
                        >
                          Edit Status
                        </button>
                        <button
                          onClick={() => setHistoryDrawer(s)}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-[0.98] transition-colors duration-200"
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-600 min-w-8 text-center">{filters.page}</span>
            <button
              disabled={subs.length < 20}
              onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Change Status Modal */}
      {statusModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
          style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setStatusModal(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-slate-900">Change Status</h2>
                <p className="text-xs text-slate-400 mt-0.5">{statusModal.company_name}</p>
              </div>
              <button
                onClick={() => setStatusModal(null)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm mb-5 focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setStatusModal(null)}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newStatus === 'Suspended' || newStatus === 'Expired') {
                    setStatusConfirm(true);
                  } else {
                    updateStatus.mutate({ id: statusModal.registration_id, status: newStatus });
                  }
                }}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Drawer */}
      {historyDrawer && (
        <div
          className="fixed inset-0 z-50 flex animate-fade-in"
          style={{ background: 'rgba(15,23,42,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setHistoryDrawer(null); }}
        >
          <div className="ml-auto w-96 bg-white h-full shadow-2xl flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900">Payment History</h2>
                <p className="text-xs text-slate-400 mt-0.5">{historyDrawer.company_name}</p>
              </div>
              <button
                onClick={() => setHistoryDrawer(null)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {history?.records?.map(
                (
                  r: {
                    subscription_plan: string;
                    billing_cycle: string;
                    payment_status: string;
                    payment_date: string;
                    transaction_id: string;
                  },
                  i: number,
                ) => (
                  <div key={i} className="border border-slate-100 rounded-2xl p-4 space-y-2.5 text-sm hover:border-slate-200 transition-colors">
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Plan</span>
                      <span className="font-medium capitalize text-slate-800">{r.subscription_plan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Billing</span>
                      <span className="text-slate-700 capitalize">{r.billing_cycle}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Payment</span>
                      <StatusBadge status={r.payment_status} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Date</span>
                      <span className="text-slate-700 text-xs">
                        {r.payment_date ? new Date(r.payment_date).toLocaleDateString('en-PH') : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">TXN ID</span>
                      <span className="font-mono text-xs text-slate-500 truncate max-w-32">
                        {r.transaction_id || '—'}
                      </span>
                    </div>
                  </div>
                ),
              )}
              {!history?.records?.length && (
                <div className="text-center py-8 text-slate-400 text-sm">No payment history found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {statusConfirm && statusModal && (
        <ConfirmDialog
          title="Change Subscription Status"
          message={`Setting ${statusModal.company_name} to ${newStatus} will block all their users from logging in. This can be reversed from this page.`}
          confirmLabel={`Set to ${newStatus}`}
          confirmStyle="danger"
          onConfirm={() => {
            setStatusConfirm(false);
            updateStatus.mutate({ id: statusModal.registration_id, status: newStatus });
          }}
          onCancel={() => setStatusConfirm(false)}
          loading={updateStatus.isPending}
        />
      )}
    </div>
  );
}
