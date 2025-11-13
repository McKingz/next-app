'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { useChildrenData } from '@/lib/hooks/parent/useChildrenData';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { SubPageHeader } from '@/components/dashboard/SubPageHeader';
import { Users, Plus, UserPlus } from 'lucide-react';

export default function ChildrenPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string>();
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/sign-in');
        return;
      }

      setUserEmail(session.user.email);
      setUserId(session.user.id);
      setLoading(false);
    };

    initAuth();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <ParentShell tenantSlug={slug} userEmail={userEmail}>
      <div style={{ margin: 'calc(var(--space-3) * -1) calc(var(--space-2) * -1)', padding: 0 }}>
        <SubPageHeader 
          title="My Children"
          subtitle="Manage your children's profiles and link them to your account"
          icon={<Users size={28} color="white" />}
        />

        <div style={{ width: '100%', padding: '20px' }}>
          {/* Add Child Button Section */}
          <div className="section">
            <ChildrenContent userId={userId} />
          </div>
        </div>
      </div>
    </ParentShell>
  );
}

function ChildrenContent({ userId }: { userId: string | undefined }) {
  const { childrenCards, loading, error, refetch } = useChildrenData(userId);
  const router = useRouter();

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">Loading...</div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/40 border border-red-800 rounded-lg p-4 text-red-200 text-sm">
        {error}
      </div>
    );
  }

  if (!childrenCards || childrenCards.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Children Linked</h3>
        <p className="text-gray-400 text-sm mb-4">
          Search for your child by name to link them to your account. The school will approve your request.
        </p>
        <button
          onClick={() => router.push('/dashboard/parent/claim-child')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Search & Claim Child
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {childrenCards.map((c) => (
        <div key={c.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white font-semibold">{c.firstName} {c.lastName}</div>
            <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 capitalize">{c.status}</span>
          </div>
          <div className="text-sm text-gray-400">Class: {c.className || '—'}</div>
          <div className="text-sm text-gray-400">Upcoming events: {c.upcomingEvents}</div>
          <div className="text-sm text-gray-400">Homework pending: {c.homeworkPending}</div>
        </div>
      ))}
    </div>
  );
}
