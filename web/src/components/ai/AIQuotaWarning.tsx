'use client';

import { useAIQuota } from '@/lib/hooks/useAIQuota';
import { Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AIQuotaWarningProps {
  requestType: 'exam_generation' | 'explanation' | 'chat_message';
  compact?: boolean;
}

export function AIQuotaWarning({ requestType, compact = false }: AIQuotaWarningProps) {
  const { usage, loading } = useAIQuota();
  const router = useRouter();

  if (loading || !usage) return null;

  const getQuotaInfo = () => {
    switch (requestType) {
      case 'exam_generation':
        return {
          used: usage.exams_generated_this_month,
          label: 'Exams Generated',
          period: 'month',
          icon: Zap
        };
      case 'explanation':
        return {
          used: usage.explanations_requested_this_month,
          label: 'Explanations',
          period: 'month',
          icon: TrendingUp
        };
      case 'chat_message':
        return {
          used: usage.chat_messages_today,
          label: 'Chat Messages',
          period: 'day',
          icon: AlertTriangle
        };
    }
  };

  const quotaInfo = getQuotaInfo();
  const Icon = quotaInfo.icon;

  // Get limits based on tier
  const limits: Record<string, { exams: number; explanations: number; chat: number }> = {
    free: { exams: 3, explanations: 5, chat: 10 },
    trial: { exams: 10, explanations: 20, chat: 50 },
    basic: { exams: 30, explanations: 100, chat: 200 },
    premium: { exams: 100, explanations: 500, chat: 1000 },
  };

  const tierLimits = limits[usage.current_tier] || limits.free;
  let limit = 0;
  
  if (requestType === 'exam_generation') limit = tierLimits.exams;
  if (requestType === 'explanation') limit = tierLimits.explanations;
  if (requestType === 'chat_message') limit = tierLimits.chat;

  const remaining = Math.max(0, limit - quotaInfo.used);
  const percentage = (quotaInfo.used / limit) * 100;
  const isWarning = remaining <= 3 && remaining > 0;
  const isExceeded = remaining === 0;

  // Don't show if plenty of quota remaining
  if (!isWarning && !isExceeded && !compact) return null;

  if (compact) {
    return (
      <div style={{
        padding: 'var(--space-2)',
        background: isExceeded ? 'rgba(255, 69, 58, 0.1)' : isWarning ? 'rgba(255, 159, 10, 0.1)' : 'rgba(52, 199, 89, 0.1)',
        borderRadius: 'var(--radius-1)',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
      }}>
        <Icon size={14} color={isExceeded ? '#FF453A' : isWarning ? '#FF9F0A' : '#34C759'} />
        <span style={{ color: 'var(--text-secondary)' }}>
          {remaining}/{limit} remaining
        </span>
      </div>
    );
  }

  return (
    <div style={{
      padding: 'var(--space-4)',
      background: isExceeded ? 'rgba(255, 69, 58, 0.1)' : 'rgba(255, 159, 10, 0.1)',
      borderRadius: 'var(--radius-2)',
      border: `2px solid ${isExceeded ? '#FF453A' : '#FF9F0A'}`,
      marginBottom: 'var(--space-4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
        <AlertTriangle size={20} color={isExceeded ? '#FF453A' : '#FF9F0A'} />
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
          {isExceeded ? 'Quota Exceeded' : 'Running Low on Quota'}
        </h3>
      </div>

      <p style={{ fontSize: 14, marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
        {isExceeded 
          ? `You've used all ${limit} ${quotaInfo.label.toLowerCase()} this ${quotaInfo.period}.`
          : `Only ${remaining} ${quotaInfo.label.toLowerCase()} left this ${quotaInfo.period}.`
        }
      </p>

      {/* Progress Bar */}
      <div style={{
        width: '100%',
        height: 8,
        background: 'var(--surface-2)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 'var(--space-3)',
      }}>
        <div style={{
          width: `${Math.min(percentage, 100)}%`,
          height: '100%',
          background: isExceeded ? '#FF453A' : '#FF9F0A',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Current Tier */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Current Plan: <strong style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{usage.current_tier}</strong>
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {quotaInfo.used}/{limit} used
        </span>
      </div>

      {/* Upgrade Button */}
      {(usage.current_tier === 'free' || usage.current_tier === 'trial') && (
        <button
          className="btn btnPrimary"
          onClick={() => router.push('/dashboard/parent/upgrade')}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
            border: 'none',
          }}
        >
          <Zap size={16} />
          Upgrade to Continue
        </button>
      )}
    </div>
  );
}
