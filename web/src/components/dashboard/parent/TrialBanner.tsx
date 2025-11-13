'use client';

import { Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TrialStatus {
  is_trial: boolean;
  days_remaining: number;
  plan_tier: string;
  plan_name: string;
}

interface TrialBannerProps {
  trialStatus: TrialStatus | null;
}

export function TrialBanner({ trialStatus }: TrialBannerProps) {
  const router = useRouter();

  if (!trialStatus?.is_trial || trialStatus.days_remaining === undefined) {
    return null;
  }

  const daysLeft = trialStatus.days_remaining;
  
  // Color based on days remaining
  const backgroundColor = daysLeft <= 3 
    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
    : daysLeft <= 7
    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
  
  const buttonColor = daysLeft <= 3 ? '#dc2626' : '#d97706';

  return (
    <div 
      className="card" 
      style={{
        background: backgroundColor,
        color: 'white',
        marginBottom: 16,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <Clock size={18} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {daysLeft === 0 ? '⏰ Trial Ends Today!' : 
             daysLeft === 1 ? 'Last Day of Trial' :
             `${daysLeft} Days Left • ${trialStatus.plan_name} Trial`}
          </span>
        </div>
      </div>
      {daysLeft <= 7 && (
        <button
          onClick={() => router.push('/pricing')}
          className="btn"
          style={{
            background: 'white',
            color: buttonColor,
            fontWeight: 600,
            border: 'none',
            padding: '6px 14px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            flexShrink: 0
          }}
        >
          Upgrade
        </button>
      )}
    </div>
  );
}
