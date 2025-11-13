'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

export default function FinancialsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);

  const { profile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const preschoolName = profile?.preschoolName;

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
      setLoading(false);
    };
    initAuth();
  }, [router, supabase]);

  if (loading) {
    return (
      <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={profile?.preschoolId}>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400">Loading financials...</p>
        </div>
      </PrincipalShell>
    );
  }

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={profile?.preschoolId}>
      <div className="section">
        <h1 className="h1">Financial Dashboard</h1>

        <div className="grid2" style={{ marginBottom: 24 }}>
          <div className="card tile">
            <div className="metricValue" style={{ color: '#10b981' }}>R45,750</div>
            <div className="metricLabel">Revenue This Month</div>
          </div>
          <div className="card tile">
            <div className="metricValue" style={{ color: '#f59e0b' }}>R12,300</div>
            <div className="metricLabel">Outstanding Payments</div>
          </div>
          <div className="card tile">
            <div className="metricValue">R38,200</div>
            <div className="metricLabel">Expenses This Month</div>
          </div>
          <div className="card tile">
            <div className="metricValue" style={{ color: '#10b981' }}>R7,550</div>
            <div className="metricLabel">Net Income</div>
          </div>
        </div>

        <div className="sectionTitle">Recent Transactions</div>
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <DollarSign size={48} style={{ margin: '0 auto 16px', color: 'var(--muted)' }} />
          <h3 style={{ marginBottom: 8 }}>Financial Tracking Coming Soon</h3>
          <p style={{ color: 'var(--muted)' }}>
            Track payments, expenses, and generate financial reports
          </p>
        </div>
      </div>
    </PrincipalShell>
  );
}
