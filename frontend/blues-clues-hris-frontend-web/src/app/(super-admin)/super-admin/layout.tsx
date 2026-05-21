'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSaToken } from '@/lib/superAdminAuth';
import { SuperAdminQueryProvider } from '@/providers/SuperAdminQueryProvider';
import { LayoutDashboard, Building2, CreditCard, RefreshCw, Settings, LogOut, Shield } from 'lucide-react';

const navItems = [
  { href: '/super-admin/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/super-admin/companies',     label: 'Companies',     icon: Building2 },
  { href: '/super-admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/super-admin/renewals',      label: 'Renewals',      icon: RefreshCw },
  { href: '/super-admin/settings',      label: 'Settings',      icon: Settings },
];

function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Login page renders without the sidebar shell
  if (pathname === '/super-admin/login') {
    return <>{children}</>;
  }

  function logout() {
    clearSaToken();
    router.push('/super-admin/login');
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50">
      <aside
        className="w-64 flex flex-col flex-shrink-0 h-full overflow-y-auto"
        style={{ background: '#0c1120', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none tracking-tight">Super Admin</p>
              <p className="text-[10px] mt-0.5 uppercase tracking-widest text-white/40">Blues Clues HRIS</p>
            </div>
          </div>
        </div>

        <div className="px-5 pt-5 pb-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">Navigation</p>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 border ${
                  active
                    ? 'bg-white/10 border-white/10 text-white'
                    : 'border-transparent text-white/45 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-emerald-400' : 'text-white/40'}`} />
                <span className="flex-1">{label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 border border-transparent text-white/40 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/20"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuperAdminQueryProvider>
      <SuperAdminShell>{children}</SuperAdminShell>
    </SuperAdminQueryProvider>
  );
}
