'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saApi } from '@/lib/superAdminApi';
import {
  Shield, Bell, Check, Loader2, Lock, Eye, EyeOff,
  AlertCircle, Activity,
} from 'lucide-react';

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-1 shrink-0"
      style={{ background: checked ? '#2563eb' : '#e2e8f0' }}
    >
      <span
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: iconBg, border: `1px solid ${iconColor}30` }}>
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 text-sm">{title}</h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// ─── Severity badge ────────────────────────────────────────────────────────────

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    INFO:    '#10b981',
    WARN:    '#f59e0b',
    WARNING: '#f59e0b',
    ERROR:   '#ef4444',
  };
  return (
    <span
      className="h-2 w-2 rounded-full shrink-0"
      style={{ background: colors[severity] ?? '#94a3b8' }}
    />
  );
}

// ─── Notification fields ───────────────────────────────────────────────────────

const NOTIF_FIELDS = [
  { key: 'notify_new_signup',  label: 'New company signup',    desc: 'Alert when a new company registers' },
  { key: 'notify_payment',     label: 'Payment received',      desc: 'Alert when a payment is confirmed' },
  { key: 'notify_renewal_due', label: 'Renewal due',           desc: 'Alert 7 days before subscription expires' },
  { key: 'notify_expiry',      label: 'Subscription expired',  desc: 'Alert when a subscription has expired' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient();

  // Profile
  const { data: profile } = useQuery({
    queryKey: ['sa-settings', 'profile'],
    queryFn: () => saApi.get('/settings/profile').then(r => r.data),
  });
  const [name, setName] = useState('');
  useEffect(() => { if (profile?.name) setName(profile.name); }, [profile]);

  const updateProfile = useMutation({
    mutationFn: (n: string) => saApi.patch('/settings/profile', { name: n }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-settings', 'profile'] }),
  });

  // Password
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });

  const changePassword = useMutation({
    mutationFn: (body: { current_password: string; new_password: string; confirm_password: string }) =>
      saApi.patch('/settings/password', body),
    onSuccess: () => {
      setPwForm({ current: '', next: '', confirm: '' });
      setPwError('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setPwError(e.response?.data?.message || 'Password change failed');
    },
  });

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (pwForm.next.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match'); return; }
    changePassword.mutate({
      current_password: pwForm.current,
      new_password: pwForm.next,
      confirm_password: pwForm.confirm,
    });
  }

  // Notifications
  const { data: notifs } = useQuery({
    queryKey: ['sa-settings', 'notifications'],
    queryFn: () => saApi.get('/settings/notifications').then(r => r.data),
  });
  const updateNotifs = useMutation({
    mutationFn: (body: Record<string, boolean>) => saApi.patch('/settings/notifications', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-settings', 'notifications'] }),
  });

  // Audit log
  const { data: auditLog = [] } = useQuery<{
    id: string; action: string; performed_by: string;
    company_id: string | null; severity: string; created_at: string;
  }[]>({
    queryKey: ['sa-settings', 'audit-log'],
    queryFn: () => saApi.get('/settings/audit-log').then(r => r.data),
    refetchInterval: 30_000,
  });

  const pwInput = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none transition-all pr-10';

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header — flat, no gradient: settings is configuration, not a data page */}
      <div className="pb-2 border-b border-slate-200">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1.5">System Settings</p>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your admin profile, security, and notification preferences.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* Profile */}
        <SectionCard
          icon={Shield}
          iconBg="rgba(37,99,235,0.08)"
          iconColor="#2563eb"
          title="Profile"
          subtitle="Your superadmin account details"
        >
          <div className="p-6 space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none transition-all"
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Email Address</label>
              <input
                type="email"
                value={profile?.email ?? ''}
                disabled
                className="w-full border border-slate-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Member Since</label>
              <p className="text-sm text-slate-600 px-4 py-2.5 border border-slate-100 rounded-xl bg-slate-50">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
              </p>
            </div>
            <button
              onClick={() => updateProfile.mutate(name)}
              disabled={updateProfile.isPending}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-colors duration-200 disabled:opacity-50"
            >
              {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : updateProfile.isSuccess ? <Check className="h-4 w-4" /> : null}
              Save Changes
            </button>
          </div>
        </SectionCard>

        {/* Change Password */}
        <SectionCard
          icon={Lock}
          iconBg="rgba(16,185,129,0.08)"
          iconColor="#059669"
          title="Security"
          subtitle="Update your password"
        >
          <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
            {([
              { field: 'current' as const, label: 'Current Password',  show: showPw.current,  key: 'current' as const },
              { field: 'next'    as const, label: 'New Password',      show: showPw.next,     key: 'next'    as const },
              { field: 'confirm' as const, label: 'Confirm Password',  show: showPw.confirm,  key: 'confirm' as const },
            ]).map(({ field, label, show, key }) => (
              <div key={field}>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">{label}</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={pwForm[field]}
                    onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                    className={pwInput}
                    required
                    minLength={field !== 'current' ? 8 : undefined}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}

            {pwError && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {pwError}
              </div>
            )}

            {changePassword.isSuccess && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl text-sm bg-emerald-50 border border-emerald-200 text-emerald-700">
                <Check className="h-4 w-4 shrink-0" />
                Password changed successfully
              </div>
            )}

            <p className="text-xs text-slate-400">Minimum 8 characters. Takes effect on next login.</p>

            <button
              type="submit"
              disabled={changePassword.isPending}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-colors duration-200 disabled:opacity-50"
            >
              {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Change Password
            </button>
          </form>
        </SectionCard>

        {/* Notifications */}
        <SectionCard
          icon={Bell}
          iconBg="rgba(245,158,11,0.08)"
          iconColor="#d97706"
          title="Notifications"
          subtitle="Choose what alerts you receive"
        >
          <div className="divide-y divide-slate-50">
            {NOTIF_FIELDS.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors duration-150">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                <Toggle
                  checked={notifs?.[key] ?? true}
                  onChange={val => updateNotifs.mutate({ ...notifs, [key]: val })}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Audit Log */}
        <SectionCard
          icon={Activity}
          iconBg="rgba(71,85,105,0.08)"
          iconColor="#475569"
          title="Recent Activity"
          subtitle="Last 25 admin actions"
        >
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {auditLog.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No activity recorded yet</div>
            ) : (
              auditLog.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 px-6 py-3.5 hover:bg-slate-50 transition-colors duration-150">
                  <SeverityDot severity={entry.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 leading-relaxed break-all">
                      {entry.action}
                    </p>
                    {entry.company_id && (
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        company: {entry.company_id}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-400 whitespace-nowrap">
                      {entry.created_at
                        ? new Date(entry.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                        : '—'}
                    </p>
                    <p className="text-[10px] text-slate-300">
                      {entry.created_at
                        ? new Date(entry.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          {auditLog.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Showing {auditLog.length} most recent entries · Auto-refreshes every 30s
              </p>
            </div>
          )}
        </SectionCard>

      </div>
    </div>
  );
}
