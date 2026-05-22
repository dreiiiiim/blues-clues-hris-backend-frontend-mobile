'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saApi } from '@/lib/superAdminApi';
import { StatusBadge } from '@/components/super-admin/StatusBadge';
import { ConfirmDialog } from '@/components/super-admin/ConfirmDialog';
import { AlertCircle, Building2, Search, ChevronLeft, ChevronRight, Zap, ShieldOff, Copy, CheckCheck } from 'lucide-react';

type Company = {
  registration_id: string;
  company_id: string | null;
  company_name: string;
  email: string;
  industry: string;
  subscription_plan: string;
  subscription_status: string;
  payment_status: string;
  payment_date: string;
  billing_cycle: string;
  invite_url: string | null;
};

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const STATUS_FILTERS = ['Active', 'Pending', 'Suspended', 'Expired'];
type ConfirmState = { action: 'provision' | 'suspend'; id: string; name: string } | null;

export default function CompaniesPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: '', plan: '', industry: '', search: '', page: 1 });
  const [selected, setSelected] = useState<Company | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [inviteCopied, setInviteCopied] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sa-companies', filters],
    queryFn: () => saApi.get('/companies', { params: filters }).then(r => r.data),
  });

  const suspend = useMutation({
    mutationFn: (id: string) => saApi.patch(`/companies/${id}/status`, { subscription_status: 'Suspended' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-companies'] }); setConfirm(null); },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Failed to suspend');
      setConfirm(null);
    },
  });

  const provision = useMutation({
    mutationFn: (id: string) => saApi.post(`/companies/${id}/provision`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-companies'] });
      setConfirm(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Provisioning failed');
      setConfirm(null);
    },
  });

  const companies: Company[] = data?.data ?? [];

  function computeEndDate(paymentDate: string, billingCycle: string) {
    if (!paymentDate) return '—';
    const d = new Date(paymentDate);
    if (billingCycle === 'annual') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function initials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  function handleConfirm() {
    if (!confirm) return;
    if (confirm.action === 'provision') provision.mutate(confirm.id);
    else suspend.mutate(confirm.id);
  }

  function handleCopyInvite(registrationId: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setInviteCopied(registrationId);
      setTimeout(() => setInviteCopied(null), 2000);
    });
  }

  const isMutating = provision.isPending || suspend.isPending;

  return (
    <div className="space-y-6">

      <div className="pb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Tenant Management</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Companies</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Building2 className="h-4 w-4 text-slate-400" />
            <span className="font-bold text-slate-700 tabular-nums">{data?.total ?? '—'}</span>
            <span>total</span>
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

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button key={s}
              onClick={() => setFilters(f => ({ ...f, status: f.status === s ? '' : s, page: 1 }))}
              className={`px-3.5 py-1.5 rounded-xl text-sm font-bold border transition-colors duration-200 ${
                filters.status === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >{s}</button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search company or industry…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
            className="h-10 w-72 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-shadow"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Company', 'Industry', 'Plan', 'Status', 'Renewal Date', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    {[55, 70, 45, 40, 60, 50].map((w, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${w}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-8 w-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">No companies found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map(c => (
                  <tr key={c.registration_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <button onClick={() => { setSelected(c); setShowDetail(true); }} className="flex items-center gap-3 group text-left">
                        <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                          <span className="text-xs font-bold text-blue-600">{initials(c.company_name)}</span>
                        </div>
                        <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{c.company_name}</span>
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{c.industry}</td>
                    <td className="px-5 py-3.5">
                      <span className="capitalize bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-lg">{c.subscription_plan}</span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={c.subscription_status} /></td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">{computeEndDate(c.payment_date, c.billing_cycle)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {c.company_id && (
                          <a
                            href={`http://${toSlug(c.company_name)}.localhost:3001/login`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          >
                            Open Instance
                          </a>
                        )}
                        {c.company_id && c.invite_url && (
                          <button
                            onClick={() => handleCopyInvite(c.registration_id, c.invite_url!)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
                          >
                            {inviteCopied === c.registration_id
                              ? <><CheckCheck className="h-3 w-3" /> Copied!</>
                              : <><Copy className="h-3 w-3" /> Copy Invite</>
                            }
                          </button>
                        )}
                        {!c.company_id && c.payment_status === 'Paid' && (
                          <button
                            onClick={() => setConfirm({ action: 'provision', id: c.registration_id, name: c.company_name })}
                            disabled={isMutating}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                          >
                            <Zap className="h-3 w-3" /> Provision
                          </button>
                        )}
                        {c.subscription_status !== 'Suspended' && (
                          <button
                            onClick={() => setConfirm({ action: 'suspend', id: c.registration_id, name: c.company_name })}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <ShieldOff className="h-3 w-3" /> Suspend
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

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
          <span className="text-xs text-slate-400">Total: {data?.total ?? 0} companies</span>
          <div className="flex items-center gap-2">
            <button disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-600 min-w-8 text-center">{filters.page}</span>
            <button disabled={companies.length < 20} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showDetail && selected && (
        <CompanyDetailModal company={selected} onClose={() => setShowDetail(false)} />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.action === 'provision' ? 'Provision Company' : 'Suspend Company'}
          message={confirm.action === 'provision'
            ? `This will create the HRIS tenant for ${confirm.name}. The company gains system access immediately.`
            : `Suspending ${confirm.name} blocks all user logins. You can reactivate from this page.`}
          confirmLabel={confirm.action === 'provision' ? 'Provision' : 'Suspend'}
          confirmStyle={confirm.action === 'suspend' ? 'danger' : 'primary'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          loading={isMutating}
        />
      )}
    </div>
  );
}

function CompanyDetailModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sa-company-detail', company.company_id],
    queryFn: () => saApi.get(`/companies/${company.company_id}`).then(r => r.data),
    enabled: !!company.company_id,
  });

  function initials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-4 p-6 border-b border-slate-100">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-blue-600">{initials(company.company_name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-900 truncate">{company.company_name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{company.email}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-3 text-sm">
          {[
            { label: 'Registration ID', value: company.registration_id },
            { label: 'Plan', value: company.subscription_plan, capitalize: true },
            { label: 'Industry', value: company.industry },
            { label: 'Billing', value: company.billing_cycle, capitalize: true },
          ].map(({ label, value, capitalize }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
              <span className={`text-slate-800 font-medium ${capitalize ? 'capitalize' : 'font-mono text-xs'}`}>{value}</span>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-slate-400">
              <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
              Loading config…
            </div>
          )}

          {data?.config && (
            <div className="pt-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-3">Tenant Config</p>
              {[
                { label: 'Timezone', value: data.config.timezone },
                { label: 'Currency', value: data.config.currency },
                { label: 'Date Format', value: data.config.date_format },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
                  <span className="text-slate-700 text-xs">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
