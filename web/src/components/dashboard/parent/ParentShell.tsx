'use client';

import { useMemo, useState, useEffect } from 'react';
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
  Menu,
  X,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface ParentShellProps {
  tenantSlug?: string;
  userEmail?: string;
  userName?: string;
  preschoolName?: string;
  unreadCount?: number;
  hasOrganization?: boolean;
  children: React.ReactNode;
}

export function ParentShell({ tenantSlug, userEmail, userName, preschoolName, unreadCount = 0, hasOrganization: hasOrganizationProp, children }: ParentShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const avatarLetter = useMemo(() => (userEmail?.[0] || 'U').toUpperCase(), [userEmail]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [hasOrganization, setHasOrganization] = useState(hasOrganizationProp || false);

  // Auto-detect if user has organization (if not explicitly provided)
  useEffect(() => {
    if (hasOrganizationProp !== undefined) {
      setHasOrganization(hasOrganizationProp);
      return;
    }

    // Fetch user's preschool_id to determine if they're organization-linked
    const checkOrganization = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', user.id)
        .maybeSingle();

      setHasOrganization(!!profileData?.preschool_id);
    };

    checkOrganization();
  }, [supabase, hasOrganizationProp]);

  // Personalized navigation based on user type
  const nav = useMemo(() => {
    if (hasOrganization) {
      // Organization-linked parents see school-focused nav
      return [
        { href: '/dashboard/parent', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/parent/messages', label: 'Messages', icon: MessageCircle, badge: unreadCount },
        { href: '/dashboard/parent/children', label: 'My Children', icon: Users },
        { href: '/dashboard/parent/settings', label: 'Settings', icon: Settings },
      ];
    } else {
      // Independent parents see learning-focused nav
      return [
        { href: '/dashboard/parent', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/parent/ai-help', label: 'AI Help', icon: Sparkles },
        { href: '/dashboard/parent/children', label: 'My Children', icon: Users },
        { href: '/dashboard/parent/settings', label: 'Settings', icon: Settings },
      ];
    }
  }, [hasOrganization, unreadCount]);

  // Check if we should show back button (not on dashboard home)
  const showBackButton = pathname !== '/dashboard/parent';

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbarRow topbarEdge">
          <div className="leftGroup">
            {/* On subpages: show back button. On dashboard home: show hamburger menu */}
            {showBackButton ? (
              <button 
                className="iconBtn" 
                aria-label="Back" 
                onClick={() => router.push('/dashboard/parent')}
              >
                <ArrowLeft className="icon20" />
              </button>
            ) : (
              <button 
                className="iconBtn mobile-nav-btn" 
                aria-label="Menu" 
                onClick={() => setMobileNavOpen(true)}
                style={{ display: 'none' }}
              >
                <Menu className="icon20" />
              </button>
            )}
            
            {preschoolName ? (
              <div className="chip" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>🎓</span>
                <span style={{ fontWeight: 600 }}>{preschoolName}</span>
              </div>
            ) : (
              <div className="chip">{tenantSlug || 'EduDash Pro'}</div>
            )}
          </div>
          <div className="rightGroup" style={{ marginLeft: 'auto' }}>
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
          .mobile-nav-drawer {
            display: block !important;
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
      `}</style>
    </div>
  );
}
