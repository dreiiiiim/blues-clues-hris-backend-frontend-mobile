'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Shield, AlertCircle, Loader2, Lock, Users, Activity } from 'lucide-react';
import { saApi } from '@/lib/superAdminApi';
import { setSaToken } from '@/lib/superAdminAuth';

const FEATURES = [
  { icon: Shield,   label: 'Role-gated access',  desc: 'JWT-verified super_admin sessions only' },
  { icon: Users,    label: 'Tenant oversight',    desc: 'Provision, suspend, and manage all companies' },
  { icon: Activity, label: 'Live audit trail',    desc: 'Every admin action is logged in real time' },
];

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await saApi.post('/auth/login', { email, password });
      setSaToken(data.access_token);
      router.push('/super-admin/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row overflow-hidden">
      {/* Left panel */}
      <div
        className="relative hidden md:flex flex-col justify-between w-[44%] shrink-0 min-h-[100dvh] px-12 py-14 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #080d18 0%, #0c1422 55%, #091410 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(37,99,235,0.1)' }} />
        <div className="absolute bottom-8 -left-24 h-72 w-72 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(16,185,129,0.07)' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">Blues Clues HRIS</span>
        </div>

        <div className="relative z-10 space-y-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-400 mb-4">Super Admin Portal</p>
            <h1 className="text-[2.4rem] font-bold text-white leading-[1.15] tracking-tight">
              The control plane<br /><span className="text-slate-500">for every tenant.</span>
            </h1>
            <p className="mt-4 text-sm text-slate-500 leading-relaxed max-w-[30ch]">
              Provision companies, manage subscriptions, and track renewals across the entire platform.
            </p>
          </div>

          <ul className="space-y-5">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-blue-400" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200 leading-none mb-1">{label}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[10px] uppercase tracking-widest text-slate-700">
          © 2026 Blues Clues HRIS · All rights reserved
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-white min-h-[100dvh] px-6 py-14">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-3 mb-10 md:hidden">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Shield className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900 tracking-tight">Blues Clues HRIS</span>
          </div>

          <div className="mb-9">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in</h2>
            <p className="text-sm text-slate-400 mt-1.5">Restricted to super_admin accounts.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Email address</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@bluesclues.com" disabled={loading}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" disabled={loading}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all disabled:opacity-50"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                <span className="text-sm text-red-700 leading-snug">{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
                : <><Lock className="h-3.5 w-3.5" /> Access Portal</>
              }
            </button>
          </form>

          <p className="mt-8 text-xs text-slate-400 leading-relaxed">
            Authorized personnel only. Unauthorized access attempts are logged.
          </p>
        </div>
      </div>
    </div>
  );
}
