'use client';

import { useRouter } from 'next/navigation';
import { TierBadge } from '@/components/ui/TierBadge';

interface OrganizationBannerProps {
  hasOrganization: boolean;
  preschoolName?: string;
  userId?: string;
}

export function OrganizationBanner({
  hasOrganization,
  preschoolName,
  userId
}: OrganizationBannerProps) {
  const router = useRouter();

  // Don't render if no organization OR no preschool name
  if (!hasOrganization || !preschoolName) {
    return null;
  }

  return (
    <div
      className="card"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        marginBottom: 12,
        cursor: 'pointer',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap'
      }}
      onClick={() => router.push('/dashboard/parent/preschool')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🏫</span>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {preschoolName}
        </span>
      </div>
      {userId && (
        <div style={{ flexShrink: 0 }}>
          <TierBadge userId={userId} size="sm" showUpgrade />
        </div>
      )}
    </div>
  );
}
