'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useParentDashboardData } from '@/lib/hooks/useParentDashboardData';
import { useChildCalendarEvents } from '@/lib/hooks/parent/useCalendar';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { Calendar as CalendarIcon, Clock, BookOpen, School, Users, Sparkles } from 'lucide-react';

// Group events by date
const groupEventsByDate = (events: any[]) => {
  const grouped: Record<string, any[]> = {};
  
  events.forEach(event => {
    const date = new Date(event.start_time).toISOString().split('T')[0];
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(event);
  });
  
  return grouped;
};

// Format date for display
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateOnly = date.toISOString().split('T')[0];
  const todayOnly = today.toISOString().split('T')[0];
  const tomorrowOnly = tomorrow.toISOString().split('T')[0];
  
  if (dateOnly === todayOnly) return 'Today';
  if (dateOnly === tomorrowOnly) return 'Tomorrow';
  
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

// Format time
const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Get event icon
const getEventIcon = (type: string) => {
  switch (type) {
    case 'homework': return BookOpen;
    case 'exam': return BookOpen;
    case 'class': return Users;
    case 'school': return School;
    default: return CalendarIcon;
  }
};

export default function CalendarPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  
  // Get parent dashboard data
  const {
    userName,
    preschoolName,
    hasOrganization,
    tenantSlug,
    childrenCards,
    activeChildId,
    setActiveChildId,
  } = useParentDashboardData();
  
  // Get calendar events for active child
  const { data: events, isLoading: eventsLoading, error } = useChildCalendarEvents(activeChildId || undefined, userId);
  
  // Group events by date
  const groupedEvents = useMemo(() => {
    if (!events) return {};
    return groupEventsByDate(events);
  }, [events]);
  
  const sortedDates = useMemo(() => {
    return Object.keys(groupedEvents).sort();
  }, [groupedEvents]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/sign-in'); return; }
      setUserId(session.user.id);
      setLoading(false);
    })();
  }, [router, supabase.auth]);

  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <ParentShell
      tenantSlug={tenantSlug}
      userEmail={userId}
      userName={userName}
      preschoolName={preschoolName}
      hasOrganization={hasOrganization}
    >
      <div className="container">
        {/* Header */}
        <div className="section">
          <h1 className="h1">Calendar</h1>
          <p className="muted">
            {hasOrganization 
              ? 'View upcoming school events and important dates' 
              : 'Plan your learning schedule and study sessions'}
          </p>
        </div>

        {/* Child Selector */}
        {childrenCards.length > 1 && (
          <div className="section">
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
              {childrenCards.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setActiveChildId(child.id)}
                  className="chip"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 20,
                    border: activeChildId === child.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: activeChildId === child.id ? 'var(--primary-subtle)' : 'var(--surface-1)',
                    color: activeChildId === child.id ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: activeChildId === child.id ? 600 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {child.firstName} {child.lastName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* School Calendar (For hasOrganization) */}
        {hasOrganization && (
          <>
            {eventsLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
              </div>
            )}

            {error && (
              <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ color: 'var(--danger)', marginBottom: 12 }}>Failed to load calendar events</p>
              </div>
            )}

            {!eventsLoading && !error && events && events.length > 0 && (
              <div className="section">
                {sortedDates.map(dateStr => {
                  const dayEvents = groupedEvents[dateStr];
                  const formattedDate = formatDate(dateStr);
                  
                  return (
                    <div key={dateStr} style={{ marginBottom: 32 }}>
                      <h2 style={{ 
                        fontSize: 16, 
                        fontWeight: 600, 
                        marginBottom: 12,
                        color: formattedDate.startsWith('Today') || formattedDate.startsWith('Tomorrow') ? 'var(--primary)' : 'var(--text-primary)'
                      }}>
                        {formattedDate}
                      </h2>
                      
                      {dayEvents.map(event => {
                        const Icon = getEventIcon(event.event_type);
                        const isHomework = event.event_type === 'homework';
                        
                        return (
                          <div 
                            key={event.id} 
                            className="card" 
                            style={{ 
                              padding: 16, 
                              marginBottom: 12,
                              borderLeft: isHomework ? '4px solid var(--warning)' : '4px solid var(--primary)',
                              display: 'flex',
                              alignItems: 'start',
                              gap: 12
                            }}
                          >
                            <div style={{
                              width: 40,
                              height: 40,
                              borderRadius: 8,
                              background: isHomework ? 'var(--warning-subtle)' : 'var(--primary-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Icon size={20} color={isHomework ? 'var(--warning)' : 'var(--primary)'} />
                            </div>
                            
                            <div style={{ flex: 1 }}>
                              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                                {event.title}
                              </h3>
                              
                              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                                <Clock size={14} style={{ display: 'inline', marginRight: 4 }} />
                                {formatTime(event.start_time)}
                                {event.end_time && ` - ${formatTime(event.end_time)}`}
                              </div>
                              
                              {event.class && (
                                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                                  📚 {event.class.name}
                                </div>
                              )}
                              
                              {event.description && (
                                <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, marginBottom: 0 }}>
                                  {event.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {!eventsLoading && !error && (!events || events.length === 0) && (
              <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                <CalendarIcon size={64} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No upcoming events</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                  When your child's school schedules events, they will appear here.
                </p>
              </div>
            )}
          </>
        )}

        {/* Standalone Parent View (No School) */}
        {!hasOrganization && (
          <div className="section">
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <Sparkles size={64} color="var(--primary)" style={{ margin: '0 auto 24px' }} />
              <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Personal Learning Calendar</h3>
              <p style={{ color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
                Stay organized with your child's learning schedule:
              </p>
              <ul style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.8 }}>
                <li>📅 Plan study sessions</li>
                <li>⏰ Set homework reminders</li>
                <li>📝 Track practice schedules</li>
                <li>🎯 Monitor learning goals</li>
                <li>✅ Review completed activities</li>
              </ul>
              <div style={{
                padding: 16,
                background: 'var(--surface-2)',
                borderRadius: 12,
                marginTop: 24
              }}>
                <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
                  💡 <strong>Coming soon:</strong> Create custom study schedules and set automated reminders!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ParentShell>
  );
}
