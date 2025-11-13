'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  MessageCircle,
  Users,
  LayoutDashboard,
  LogOut,
  Search,
  Bell,
  ArrowLeft,
  Settings,
  BookOpen,
  ClipboardCheck,
  Menu,
  X,
  Activity,
  BookMarked,
} from 'lucide-react';
import { TierBadge } from '@/components/ui/TierBadge';

interface TeacherShellProps {
  tenantSlug?: string;
  userEmail?: string;
  userName?: string;
  preschoolName?: string;
  preschoolId?: string;
  userId?: string;
  unreadCount?: number;
  children: React.ReactNode;
  rightSidebar?: React.ReactNode;
  onOpenDashAI?: () => void;
}

export function TeacherShell({ 
  tenantSlug, 
  userEmail, 
  userName,
  preschoolName,
  preschoolId,
  userId,
  unreadCount = 0, 
  children,
  rightSidebar,
  onOpenDashAI 
}: TeacherShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const avatarLetter = useMemo(() => (userName?.[0] || userEmail?.[0] || 'T').toUpperCase(), [userName, userEmail]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileWidgetsOpen, setMobileWidgetsOpen] = useState(false);
  
  // Count pending notifications/activity
  const activityCount = useMemo(() => {
    return unreadCount > 0 ? unreadCount : 0;
  }, [unreadCount]);

  const nav = [
    { href: '/dashboard/teacher', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/teacher/classes', label: 'My Classes', icon: Users },
    { href: '/dashboard/teacher/assignments', label: 'Assignments', icon: ClipboardCheck },
    { href: '/dashboard/teacher/lessons', label: 'Lesson Plans', icon: BookOpen },
    { href: '/dashboard/teacher/messages', label: 'Messages', icon: MessageCircle, badge: unreadCount },
    { href: '/admin/caps-mapping', label: 'CAPS Mapping', icon: BookMarked },
    { href: '/dashboard/teacher/settings', label: 'Settings', icon: Settings },
  ];

  // Check if we should show back button (not on dashboard home)
  const showBackButton = pathname !== '/dashboard/teacher';

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbarRow topbarEdge">
          <div className="leftGroup">
            <button 
              className="iconBtn mobile-nav-btn" 
              aria-label="Menu" 
              onClick={() => setMobileNavOpen(true)}
              style={{ display: 'none' }}
            >
              <Menu className="icon20" />
            </button>
            {showBackButton && (
              <button className="iconBtn desktop-back-btn" aria-label="Back" onClick={() => router.back()}>
                <ArrowLeft className="icon20" />
              </button>
            )}
            {preschoolName ? (
              <div className="chip" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>🎓</span>
                <span style={{ fontWeight: 600 }}>{preschoolName}</span>
              </div>
            ) : (
              <div className="chip">{tenantSlug ? `/${tenantSlug}` : 'EduDash Pro'}</div>
            )}
          </div>
          <div className="rightGroup" style={{ marginLeft: 'auto' }}>
            {rightSidebar && (
              <button 
                className="iconBtn" 
                aria-label="Activity" 
                onClick={() => setMobileWidgetsOpen(true)}
                style={{ position: 'relative' }}
              >
                <Activity className="icon20" />
                {activityCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 8,
                    height: 8,
                    background: '#dc2626',
                    borderRadius: '50%',
                    border: '2px solid var(--surface-1)',
                  }} />
                )}
              </button>
            )}
            <div className="avatar">{avatarLetter}</div>
          </div>
        </div>
      </header>

      <div className="frame">
        <aside className="sidenav sticky" aria-label="Sidebar">
          <div className="sidenavCol">
            <nav className="nav">
              {nav.map((it) => {
                const Icon = it.icon as any;
                const active = pathname === it.href || pathname?.startsWith(it.href + '/');
                return (
                  <Link key={it.href} href={it.href} className={`navItem ${active ? 'navItemActive' : ''}`} aria-current={active ? 'page' : undefined}>
                    <Icon className="navIcon" />
                    <span>{it.label}</span>
                    {typeof it.badge === 'number' && it.badge > 0 && (
                      <span className="navItemBadge badgeNumber">{it.badge}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="sidenavFooter">
              <button
                className="navItem"
                onClick={async () => { await supabase.auth.signOut(); router.push('/sign-in'); }}
              >
                <LogOut className="navIcon" />
                <span>Sign out</span>
              </button>
              <div className="brandPill w-full text-center">Powered by EduDash Pro</div>
            </div>
          </div>
        </aside>

        <main className="content">
          {children}
        </main>

        {rightSidebar && (
          <aside className="right sticky" aria-label="Activity">
            {rightSidebar}
          </aside>
        )}
      </div>

      {/* Mobile Navigation Drawer (Left Sidebar) */}
      {mobileNavOpen && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              zIndex: 9998,
              display: 'none',
            }}
            className="mobile-nav-overlay"
            onClick={() => setMobileNavOpen(false)}
          />
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '80%',
              maxWidth: 320,
              background: 'var(--surface-1)',
              zIndex: 9999,
              overflowY: 'auto',
              padding: 'var(--space-4)',
              display: 'none',
              animation: 'slideInLeft 0.3s ease-out',
            }}
            className="mobile-nav-drawer"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Menu</h3>
              <button 
                onClick={() => setMobileNavOpen(false)}
                className="iconBtn"
                aria-label="Close"
              >
                <X className="icon20" />
              </button>
            </div>
            
            {/* Navigation Links */}
            <nav className="nav" style={{ display: 'grid', gap: 6 }}>
              {nav.map((it) => {
                const Icon = it.icon as any;
                const active = pathname === it.href || pathname?.startsWith(it.href + '/');
                return (
                  <Link 
                    key={it.href} 
                    href={it.href} 
                    className={`navItem ${active ? 'navItemActive' : ''}`}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <Icon className="navIcon" />
                    <span>{it.label}</span>
                    {typeof it.badge === 'number' && it.badge > 0 && (
                      <span className="navItemBadge badgeNumber">{it.badge}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
            
            {/* Footer */}
            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
              <button
                className="navItem"
                style={{ width: '100%' }}
                onClick={async () => { 
                  await supabase.auth.signOut(); 
                  router.push('/sign-in'); 
                }}
              >
                <LogOut className="navIcon" />
                <span>Sign out</span>
              </button>
              <div className="brandPill" style={{ marginTop: 'var(--space-2)', width: '100%', textAlign: 'center' }}>Powered by EduDash Pro</div>
            </div>
          </div>
        </>
      )}

      {/* Mobile Widgets Drawer (Right Sidebar) */}
      {rightSidebar && mobileWidgetsOpen && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              zIndex: 9998,
              display: 'none',
            }}
            className="mobile-widgets-overlay"
            onClick={() => setMobileWidgetsOpen(false)}
          />
          <div 
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '85%',
              maxWidth: 400,
              background: 'var(--surface-1)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.3s ease-out',
            }}
            className="mobile-widgets-drawer"
          >
            {/* Sticky Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: 'var(--space-4)',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Activity & Updates</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Notifications and recent activity</p>
              </div>
              <button 
                onClick={() => setMobileWidgetsOpen(false)}
                className="iconBtn"
                aria-label="Close"
              >
                <X className="icon20" />
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: 'var(--space-4)',
              WebkitOverflowScrolling: 'touch',
            }}>
              {rightSidebar}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @media (max-width: 1023px) {
          /* Show mobile navigation button */
          .mobile-nav-btn {
            display: grid !important;
          }
          /* Hide desktop back button on mobile, use hamburger instead */
          .desktop-back-btn {
            display: none !important;
          }
          /* Show overlays and drawers */
          .mobile-nav-overlay,
          .mobile-nav-drawer,
          .mobile-widgets-overlay {
            display: block !important;
          }
          /* Mobile widgets drawer needs flex for sticky header */
          .mobile-widgets-drawer {
            display: flex !important;
          }
        }
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
