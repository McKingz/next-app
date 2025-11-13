'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { MessageCircle, Send } from 'lucide-react';

export default function MessagesPage() {
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
          <p className="text-slate-400">Loading messages...</p>
        </div>
      </PrincipalShell>
    );
  }

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={profile?.preschoolId}>
      <div className="section">
        <h1 className="h1">Messages</h1>
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <MessageCircle size={48} style={{ margin: '0 auto 16px', color: 'var(--muted)' }} />
          <h3 style={{ marginBottom: 8 }}>Messaging Coming Soon</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
            Send announcements and communicate with parents and teachers
          </p>
          <button className="btn btnPrimary">
            <Send size={18} style={{ marginRight: 8 }} />
            Compose Message
          </button>
        </div>
      </div>
    </PrincipalShell>
  );
}
