'use client';

import { useRouter } from 'next/navigation';
import { 
  BookOpen, FileText, BarChart3, MessageCircle, Calendar, DollarSign,
  Users, GraduationCap, Sparkles, Search, Settings, Home, Target,
  Lightbulb, Award, Zap, MapPin, Library, FileCheck
} from 'lucide-react';

interface QuickAction {
  icon: any;
  label: string;
  href: string;
  color: string;
}

interface QuickActionsGridProps {
  usageType?: 'preschool' | 'k12_school' | 'homeschool' | 'aftercare' | 'supplemental' | 'exploring' | 'independent';
  hasOrganization: boolean;
}

export function QuickActionsGrid({ usageType, hasOrganization }: QuickActionsGridProps) {
  const router = useRouter();

  const getQuickActions = (): QuickAction[] => {
    // Organization-linked actions (common for all with organization)
    const organizationActions: QuickAction[] = hasOrganization ? [
      { icon: MessageCircle, label: 'Messages', href: '/dashboard/parent/messages', color: '#8b5cf6' },
      { icon: Calendar, label: 'Calendar', href: '/dashboard/parent/calendar', color: '#06b6d4' },
      { icon: BarChart3, label: 'Progress', href: '/dashboard/parent/progress', color: '#10b981' },
      { icon: Library, label: 'E-Books', href: '/dashboard/parent/ebooks', color: '#3b82f6' },
      { icon: FileCheck, label: 'My Exams', href: '/dashboard/parent/my-exams', color: '#10b981' },
      { icon: DollarSign, label: 'Payments', href: '/dashboard/parent/payments', color: '#f59e0b' },
      { icon: Users, label: 'My Children', href: '/dashboard/parent/children', color: '#8b5cf6' },
      { icon: Sparkles, label: 'Chat with Dash', href: '/dashboard/parent/dash-chat', color: '#ec4899' },
    ] : [];

    // Independent parents - all usage types get same simple actions (existing pages only)
    if (!hasOrganization) {
      return [
        { icon: Users, label: 'My Children', href: '/dashboard/parent/children', color: '#8b5cf6' },
        { icon: Sparkles, label: 'Chat with Dash', href: '/dashboard/parent/dash-chat', color: '#ec4899' },
        { icon: FileCheck, label: 'View My Exams', href: '/dashboard/parent/my-exams', color: '#10b981' },
        { icon: Library, label: 'E-Books', href: '/dashboard/parent/ebooks', color: '#06b6d4' },
        { icon: BookOpen, label: 'Lessons', href: '/dashboard/parent/lessons', color: '#10b981' },
        { icon: FileText, label: 'Homework', href: '/dashboard/parent/homework', color: '#f59e0b' },
        { icon: BarChart3, label: 'Progress', href: '/dashboard/parent/progress', color: '#06b6d4' },
        { icon: Settings, label: 'Settings', href: '/dashboard/parent/settings', color: '#6366f1' },
      ];
    }
    
    // Organization-linked parents (k12, preschool, aftercare)
    return organizationActions;
  };

  const actions = getQuickActions();

  return (
    <div className="section">
      <div className="sectionTitle">Quick Actions</div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
      }}
      className="quick-actions-grid"
      >
        {actions.map((action) => {
          const Icon = action.icon;
          const isChatWithDash = action.label === 'Chat with Dash';
          return (
            <button
              key={action.href}
              onClick={() => router.push(action.href)}
              className="qa"
              style={{
                background: isChatWithDash 
                  ? 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)'
                  : 'var(--surface-1)',
                border: isChatWithDash
                  ? '2px solid #ec4899'
                  : '1px solid var(--border)',
                borderRadius: 12,
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
                minHeight: '120px',
                boxShadow: isChatWithDash ? '0 4px 20px rgba(236, 72, 153, 0.5)' : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                if (isChatWithDash) {
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(236, 72, 153, 0.6)';
                } else {
                  e.currentTarget.style.boxShadow = `0 8px 24px ${action.color}22`;
                  e.currentTarget.style.borderColor = action.color;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                if (isChatWithDash) {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(236, 72, 153, 0.5)';
                } else {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: isChatWithDash ? 'rgba(255, 255, 255, 0.2)' : `${action.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon size={24} style={{ color: isChatWithDash ? 'white' : action.color }} />
              </div>
              <span style={{ 
                fontSize: 14, 
                fontWeight: 600,
                color: isChatWithDash ? 'white' : 'var(--text-primary)'
              }}>
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      <style jsx>{`
        @media (min-width: 640px) {
          .quick-actions-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (min-width: 1024px) {
          .quick-actions-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
