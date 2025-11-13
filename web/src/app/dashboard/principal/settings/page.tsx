'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { Settings, User, Lock, Bell, Globe, CreditCard } from 'lucide-react';

export default function SettingsPage() {
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
          <p className="text-slate-400">Loading settings...</p>
        </div>
      </PrincipalShell>
    );
  }

  const settingSections = [
    {
      title: 'Account Settings',
      icon: User,
      items: [
        { label: 'Profile Information', value: profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Not set' : 'Not set' },
        { label: 'Email', value: profile?.email || 'Not set' },
        { label: 'Role', value: profile?.role || 'principal' },
      ],
    },
    {
      title: 'Security & Privacy',
      icon: Lock,
      items: [
        { label: 'Password', value: '••••••••' },
        { label: 'Two-Factor Authentication', value: 'Disabled' },
        { label: 'Data Protection', value: 'Enabled' },
      ],
    },
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        { label: 'Email Notifications', value: 'Enabled' },
        { label: 'Push Notifications', value: 'Enabled' },
        { label: 'SMS Alerts', value: 'Disabled' },
      ],
    },
    {
      title: 'Regional Settings',
      icon: Globe,
      items: [
        { label: 'Language', value: 'English (South Africa)' },
        { label: 'Timezone', value: 'Africa/Johannesburg' },
        { label: 'Currency', value: 'ZAR (R)' },
      ],
    },
    {
      title: 'Billing & Subscription',
      icon: CreditCard,
      items: [
        { label: 'Current Plan', value: 'Professional' },
        { label: 'Billing Cycle', value: 'Monthly' },
        { label: 'Next Invoice', value: 'Not available' },
      ],
    },
  ];

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={profile?.preschoolId}>
      <div className="section">
        <h1 className="h1">Settings</h1>

        <div style={{ display: 'grid', gap: 24 }}>
          {settingSections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <Icon size={24} style={{ color: 'var(--primary)' }} />
                  <h3>{section.title}</h3>
                </div>
                <div style={{ display: 'grid', gap: 16 }}>
                  {section.items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: idx < section.items.length - 1 ? 16 : 0,
                        borderBottom:
                          idx < section.items.length - 1 ? '1px solid var(--divider)' : 'none',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{item.label}</span>
                      <span style={{ color: 'var(--muted)' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Settings size={24} style={{ color: 'var(--muted)' }} />
            <h3>About & Support</h3>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 500 }}>App Version</span>
              <span style={{ color: 'var(--muted)' }}>1.0.0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 500 }}>Terms of Service</span>
              <a href="#" style={{ color: 'var(--primary)' }}>View</a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 500 }}>Privacy Policy</span>
              <a href="#" style={{ color: 'var(--primary)' }}>View</a>
            </div>
          </div>
        </div>
      </div>
    </PrincipalShell>
  );
}
