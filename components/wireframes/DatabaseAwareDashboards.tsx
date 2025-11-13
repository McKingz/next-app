/**
 * Database-Aware Role-Based Dashboard Examples
 * 
 * This file demonstrates real dashboard implementations that pull data from
 * the actual Supabase tables (enterprise_leads, preschools, profiles, teachers, 
 * students, classes) and handle null values gracefully.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { ScrollView, View, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { detectRoleAndSchool } from '@/lib/routeAfterLogin';
import {
  NavigationShell,
  WireframeCard,
  WireframeMetric,
  WireframeQuickAction,
  WireframeListItem,
  WireframeProgress,
  WireframeEmptyState,
} from './NavigationShells';

// Helper function to safely display values with null fallbacks
const safeDisplay = (value: any, fallback: string = '—'): string => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

// const _safeNumber = (value: any, fallback: number = 0): number => {
//   const num = Number(value);
//   return isNaN(num) ? fallback : num;
// };

/**
 * SuperAdmin Dashboard - Database-Aware
 * Shows real leads and platform metrics from enterprise_leads and preschools tables
 */
export const SuperAdminDashboardDatabase: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [role, setRole] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRole = useCallback(async () => {
    try {
      const { role: detectedRole } = await detectRoleAndSchool(user);
      setRole(detectedRole);
    } catch (e) {
      console.debug('detectRoleAndSchool failed for SuperAdminDashboard', e);
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    if (role !== 'superadmin') return;
    try {
      setLoading(true);
      
      // Fetch recent leads from enterprise_leads table
      const { data: leadsData } = await assertSupabase()
        .from('enterprise_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      // Fetch organization counts from preschools table
      const { data: orgsData } = await assertSupabase()
        .from('preschools')
        .select('id, name, country, created_at')
        .order('created_at', { ascending: false });
      
      setLeads(leadsData || []);
      setOrgs(orgsData || []);
    } catch (error) {
      console.error('Failed to fetch SuperAdmin data:', error);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { loadRole(); }, [loadRole]);
  useEffect(() => { fetchData(); }, [fetchData]);

  if (role !== 'superadmin') {
    return (
      <NavigationShell role="superadmin" activeTab={activeTab} onTabPress={setActiveTab}>
        <WireframeEmptyState
          icon="🚫"
title={t('dashboard.accessDenied', { defaultValue: 'Access Denied' })}
          description="Super admin access required to view this dashboard"
        />
      </NavigationShell>
    );
  }

  const renderDashboard = () => (
    <ScrollView style={{ flex: 1 }}>
<WireframeCard title={t('wireframes.global_overview', { defaultValue: 'Global Platform Overview' })}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <WireframeMetric 
            label="Schools" 
            value={orgs.length} 
            subtext={orgs.length === 0 ? 'No schools yet' : 'Active tenants'}
            trend={orgs.length > 0 ? 'up' : 'neutral'} 
          />
          <WireframeMetric 
            label="Leads" 
            value={leads.length}
            subtext={leads.length === 0 ? 'No leads yet' : 'In pipeline'}
            trend={leads.filter(l => l.status === 'new').length > 0 ? 'up' : 'neutral'} 
          />
          <WireframeMetric 
            label="Countries" 
            value={new Set(orgs.map(o => o.country).filter(Boolean)).size}
            subtext="Global reach"
            trend="neutral"
          />
        </View>
      </WireframeCard>

      <WireframeCard title="Recent Enterprise Leads">
        {loading ? (
          <WireframeListItem 
            icon="⏳" 
title={t('screens.loading', { defaultValue: 'Loading...' })}
subtitle={t('common.loading', { defaultValue: 'Loading...' })}
          />
        ) : leads.length === 0 ? (
          <WireframeEmptyState
            icon="📊"
title={t('wireframes.no_leads_yet', { defaultValue: 'No Leads Yet' })}
            description="Enterprise leads will appear here when submitted from the contact form"
            actionLabel="View Lead Form"
            onActionPress={() => Alert.alert('Navigate to Contact Sales Form')}
          />
        ) : (
          leads.slice(0, 3).map((lead) => (
            <WireframeListItem
              key={lead.id}
              icon={lead.status === 'new' ? '🆕' : lead.status === 'qualified' ? '⭐' : '📊'}
              title={safeDisplay(lead.organization_name, 'Unnamed Organization')}
              subtitle={`${safeDisplay(lead.contact_name)} • ${safeDisplay(lead.contact_email)}`}
              metadata={`${safeDisplay(lead.country)} • ${safeDisplay(lead.school_size)} students`}
              badge={safeDisplay(lead.status)}
            />
          ))
        )}
        {leads.length > 3 && (
          <WireframeListItem
            icon="➕"
title={t('wireframes.view_more_leads', { count: leads.length - 3, defaultValue: 'View {{count}} more leads' })}
            onPress={() => setActiveTab('sales')}
          />
        )}
      </WireframeCard>

<WireframeCard title={t('wireframes.schools_by_region', { defaultValue: 'Schools by Region' })}>
        {orgs.length === 0 ? (
          <WireframeListItem
            icon="🌍"
title={t('wireframes.no_schools_yet', { defaultValue: 'No schools registered yet' })}
            subtitle="Schools will appear here after lead conversion"
          />
        ) : (
          Object.entries(
            orgs.reduce((acc: Record<string, number>, org) => {
              const country = org.country || 'Unknown';
              acc[country] = (acc[country] || 0) + 1;
              return acc;
            }, {})
          ).map(([country, count]) => (
            <WireframeListItem
              key={country}
              icon="🏫"
              title={country}
              subtitle={`${Number(count)} school${Number(count) > 1 ? 's' : ''}`}
            />
          ))
        )}
      </WireframeCard>
    </ScrollView>
  );

  const renderSales = () => (
    <ScrollView style={{ flex: 1 }}>
      <WireframeCard title="Sales Pipeline">
        {leads.map((lead) => (
          <WireframeListItem
            key={lead.id}
            icon={lead.status === 'new' ? '🆕' : lead.status === 'qualified' ? '⭐' : '📊'}
            title={safeDisplay(lead.organization_name, 'Unnamed Organization')}
            subtitle={`${safeDisplay(lead.contact_name)} • ${safeDisplay(lead.role, 'Unknown role')}`}
            metadata={`${safeDisplay(lead.phone, 'No phone')} • ${new Date(lead.created_at).toLocaleDateString()}`}
            badge={safeDisplay(lead.status)}
          />
        ))}
        {leads.length === 0 && (
          <WireframeEmptyState
            icon="📈"
            title="No Leads in Pipeline"
            description="Enterprise leads from the contact form will appear here"
          />
        )}
      </WireframeCard>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'tenants':
        return (
          <ScrollView style={{ flex: 1 }}>
            <WireframeCard title="Organizations">
              {orgs.map((org) => (
                <WireframeListItem
                  key={org.id}
                  icon="🏫"
                  title={safeDisplay(org.name, 'Unnamed School')}
                  subtitle={safeDisplay(org.country, 'Unknown location')}
                  metadata={new Date(org.created_at).toLocaleDateString()}
                />
              ))}
              {orgs.length === 0 && (
                <WireframeEmptyState
                  icon="🏢"
                  title="No Organizations"
                  description="Schools will appear here after being created from leads"
                />
              )}
            </WireframeCard>
          </ScrollView>
        );
      case 'sales':
        return renderSales();
      case 'settings':
        return (
          <WireframeEmptyState
            icon="⚙️"
            title="Platform Settings"
            description="Global configuration and feature flag management"
            actionLabel="Manage Settings"
            onActionPress={() => Alert.alert('Feature Coming Soon')}
          />
        );
      default:
        return renderDashboard();
    }
  };

  return (
    <NavigationShell role="superadmin" activeTab={activeTab} onTabPress={setActiveTab}>
      {renderContent()}
      {activeTab === 'dashboard' && (
        <WireframeQuickAction
          label="Alert"
          icon="🚨"
          role="superadmin"
          onPress={() => Alert.alert('Create Alert')}
        />
      )}
    </NavigationShell>
  );
};

/**
 * Principal/Admin Dashboard - Database-Aware
 * Shows real school metrics from teachers, students, and classes tables
 */
export const PrincipalDashboardDatabase: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [role, setRole] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [counts, setCounts] = useState<{teachers: number|null; students: number|null; classes: number|null}>({
    teachers: null, 
    students: null, 
    classes: null
  });
  const [loading, setLoading] = useState(false);

  const loadRoleAndSchool = useCallback(async () => {
    try {
      const { role: detectedRole, school } = await detectRoleAndSchool(user);
      setRole(detectedRole);
      setSchoolId(school);
    } catch (e) {
      console.debug('detectRoleAndSchool failed for PrincipalDashboard', e);
    }
  }, [user]);

  const fetchCounts = useCallback(async () => {
    if (!schoolId || (role !== 'principal' && role !== 'admin')) return;
    
    try {
      setLoading(true);
      
      // Query actual database tables as used in principal-dashboard.tsx
      const queryTable = async (table: string): Promise<number|null> => {
        const { count, error } = await assertSupabase()
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', schoolId);
        
        if (error) {
          console.error(`Error querying ${table}:`, error);
          return null;
        }
        return typeof count === 'number' ? count : null;
      };

      const [teachers, students, classes] = await Promise.all([
        queryTable('teachers'),
        queryTable('students'), 
        queryTable('classes')
      ]);
      
      setCounts({ teachers, students, classes });
    } catch (error) {
      console.error('Failed to fetch school counts:', error);
    } finally {
      setLoading(false);
    }
  }, [schoolId, role]);

  useEffect(() => { loadRoleAndSchool(); }, [loadRoleAndSchool]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  if (role !== 'principal' && role !== 'admin') {
    return (
      <NavigationShell role="principal" activeTab={activeTab} onTabPress={setActiveTab}>
        <WireframeEmptyState
          icon="🚫"
title={t('dashboard.accessDenied', { defaultValue: 'Access Denied' })}
          description="Principal or admin access required to view this dashboard"
        />
      </NavigationShell>
    );
  }

  const renderDashboard = () => (
    <ScrollView style={{ flex: 1 }}>
<WireframeCard title={schoolId ? t('dashboard.school_overview', { defaultValue: 'School Overview' }) : t('wireframes.no_school_selected', { defaultValue: 'No School Selected' })}>
        {loading ? (
          <WireframeListItem 
            icon="⏳" 
title={t('dashboard.loading', { defaultValue: 'Loading dashboard...' })}
            subtitle="Fetching from database"
          />
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <WireframeMetric 
              label="Teachers" 
              value={safeDisplay(counts.teachers)}
              subtext={counts.teachers === null ? 'Unable to load' : counts.teachers === 0 ? 'No teachers' : undefined}
            />
            <WireframeMetric 
              label="Students" 
              value={safeDisplay(counts.students)}
              subtext={counts.students === null ? 'Unable to load' : counts.students === 0 ? 'No students' : undefined}
            />
            <WireframeMetric 
              label="Classes" 
              value={safeDisplay(counts.classes)}
              subtext={counts.classes === null ? 'Unable to load' : counts.classes === 0 ? 'No classes' : undefined}
            />
          </View>
        )}
      </WireframeCard>

      {!schoolId ? (
        <WireframeCard title="Setup Required">
          <WireframeEmptyState
            icon="🏫"
            title="No School Associated"
            description="Your account needs to be linked to a school to view dashboard metrics"
            actionLabel="Contact Support"
            onActionPress={() => Alert.alert('Please contact support to link your school')}
          />
        </WireframeCard>
      ) : (
        <>
          <WireframeCard title="Quick Actions">
            <WireframeListItem
              icon="📹"
              title="Principal Meeting Room"
              subtitle="Start or join a video meeting with staff"
              onPress={() => setActiveTab('hub')}
            />
            <WireframeListItem
              icon="👥"
              title="Manage Teachers"
              subtitle={counts.teachers ? `${counts.teachers} teachers enrolled` : 'No teachers yet'}
              onPress={() => setActiveTab('teachers')}
            />
            <WireframeListItem
              icon="📊"
              title="View Reports"
              subtitle="Generate weekly or monthly school reports"
              onPress={() => Alert.alert('Feature Coming Soon', 'Report generation will be available soon')}
            />
          </WireframeCard>

          {(counts.teachers === 0 || counts.students === 0 || counts.classes === 0) && (
            <WireframeCard title="Setup Checklist">
              {counts.teachers === 0 && (
                <WireframeListItem
                  icon="👥"
                  title="Add Teachers"
                  subtitle="Invite teaching staff to join your school"
                  badge="Todo"
                />
              )}
              {counts.students === 0 && (
                <WireframeListItem
                  icon="🎓"
                  title="Enroll Students"
                  subtitle="Add student records to your school"
                  badge="Todo"
                />
              )}
              {counts.classes === 0 && (
                <WireframeListItem
                  icon="📚"
                  title="Create Classes"
                  subtitle="Set up class schedules and assignments"
                  badge="Todo"
                />
              )}
            </WireframeCard>
          )}
        </>
      )}
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'hub':
        return (
          <WireframeEmptyState
            icon="🎥"
            title="Principal Meeting Room"
            description="Video collaboration space for school leadership team meetings"
            actionLabel="Start New Meeting"
            onActionPress={() => Alert.alert('Feature Coming Soon', 'Video meetings will be available soon')}
          />
        );
      case 'teachers':
        return (
          <WireframeEmptyState
            icon="👥"
            title="Teacher Management"
            description="Staff directory, performance tracking, and professional development"
            actionLabel="Invite Teachers"
            onActionPress={() => Alert.alert('Feature Coming Soon', 'Teacher management will be available soon')}
          />
        );
      case 'resources':
        return (
          <WireframeEmptyState
            icon="📁"
            title="Resource Portal"
            description="School-wide content library and teaching materials"
            actionLabel="Browse Resources"
            onActionPress={() => Alert.alert('Feature Coming Soon', 'Resource portal will be available soon')}
          />
        );
      case 'settings':
        return (
          <WireframeEmptyState
            icon="⚙️"
            title="School Settings"
            description="Configure school policies, integrations, and preferences"
            actionLabel="Manage Settings"
            onActionPress={() => Alert.alert('Feature Coming Soon', 'Settings will be available soon')}
          />
        );
      default:
        return renderDashboard();
    }
  };

  return (
    <NavigationShell role="principal" activeTab={activeTab} onTabPress={setActiveTab}>
      {renderContent()}
      {activeTab === 'dashboard' && schoolId && (
        <WireframeQuickAction
          label="Report"
          icon="📊"
          role="principal"
          onPress={() => Alert.alert('Generate Report')}
        />
      )}
    </NavigationShell>
  );
};

/**
 * Teacher Dashboard - Database-Aware
 * Shows realistic teacher interface with profile data from database
 */
export const TeacherDashboardDatabase: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [role, setRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { role: detectedRole } = await detectRoleAndSchool(user);
      setRole(detectedRole);
      
      if (user) {
        // Try to get user profile from profiles table
        const { data: profileData } = await assertSupabase()
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Failed to fetch teacher data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (role !== 'teacher') {
    return (
      <NavigationShell role="teacher" activeTab={activeTab} onTabPress={setActiveTab}>
        <WireframeEmptyState
          icon="🚫"
title={t('dashboard.accessDenied', { defaultValue: 'Access Denied' })}
          description="Teacher access required to view this dashboard"
        />
      </NavigationShell>
    );
  }

  const teacherName = profile ? 
    `${safeDisplay(profile.first_name, 'Teacher')} ${safeDisplay(profile.last_name, '')}`.trim() : 
    'Teacher';

  const renderDashboard = () => (
    <ScrollView style={{ flex: 1 }}>
      <WireframeCard title={`Welcome back, ${teacherName}`}>
        {loading ? (
          <WireframeListItem 
            icon="⏳" 
            title="Loading your data..." 
            subtitle="Fetching classes and assignments"
          />
        ) : (
          <WireframeListItem
            icon="👋"
            title="Good to see you!"
            subtitle={profile?.email ? `Logged in as ${profile.email}` : 'Your teaching dashboard is ready'}
          />
        )}
      </WireframeCard>

      <WireframeCard title="Today's Schedule">
        <WireframeEmptyState
          icon="📅"
          title="No Classes Scheduled"
          description="Your class schedule will appear here once classes are created"
          actionLabel="Create First Class"
          onActionPress={() => Alert.alert('Feature Coming Soon', 'Class creation will be available soon')}
        />
      </WireframeCard>

      <WireframeCard title="AI Teaching Tools">
        <WireframeListItem
          icon="🎯"
          title="Generate Lesson Plan"
          subtitle="AI-powered lesson planning for your subjects"
          onPress={() => router.push('/screens/ai-lesson-generator')}
        />
        <WireframeListItem
          icon="📝"
          title="Grade Assignments"
          subtitle="AI-assisted grading with rubric support"
          onPress={() => router.push('/screens/ai-homework-grader-live')}
        />
        <WireframeListItem
          icon="🧪"
          title="STEM Activities"
          subtitle="Generate hands-on science activities"
          onPress={() => router.push('/screens/teacher-reports')}
        />
      </WireframeCard>

      <WireframeCard title="Quick Stats">
        <WireframeListItem
          icon="📊"
          title="Classes Taught"
          subtitle="No classes assigned yet"
        />
        <WireframeListItem
          icon="✅"
          title="Assignments Graded"
          subtitle="No assignments to grade"
        />
        <WireframeListItem
          icon="👨‍👩‍👧‍👦"
          title="Students Taught"
          subtitle="No students enrolled yet"
        />
      </WireframeCard>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'ai-tools':
        return (
          <WireframeEmptyState
            icon="✨"
            title="AI Teaching Assistant"
            description="Generate lessons, create quizzes, and build STEM activities with AI"
            actionLabel="Start Creating"
            onActionPress={() => Alert.alert('Feature Coming Soon', 'AI tools will be available soon')}
          />
        );
      case 'assignments':
        return (
          <WireframeEmptyState
            icon="📋"
            title="Assignment Manager"
            description="Create, distribute, and grade assignments across all your classes"
            actionLabel="New Assignment"
            onActionPress={() => Alert.alert('Feature Coming Soon', 'Assignment creation will be available soon')}
          />
        );
      case 'resources':
        return (
          <WireframeEmptyState
            icon="📁"
            title="Teaching Resources"
            description="Access curriculum materials, lesson plans, and teaching aids"
            actionLabel="Browse Library"
            onActionPress={() => Alert.alert('Feature Coming Soon', 'Resource library will be available soon')}
          />
        );
      case 'messages':
        return (
          <WireframeEmptyState
            icon="💬"
            title="Parent Communication"
            description="Message parents about student progress and classroom updates"
            actionLabel="New Message"
            onActionPress={() => Alert.alert('Feature Coming Soon', 'Messaging will be available soon')}
          />
        );
      default:
        return renderDashboard();
    }
  };

  return (
    <NavigationShell role="teacher" activeTab={activeTab} onTabPress={setActiveTab}>
      {renderContent()}
      {activeTab === 'dashboard' && (
        <WireframeQuickAction
          label="Lesson"
          icon="🎯"
          role="teacher"
          onPress={() => Alert.alert('Generate Lesson')}
        />
      )}
    </NavigationShell>
  );
};

/**
 * Parent Dashboard - Database-Aware
 * Shows parent interface with real profile data
 */
export const ParentDashboardDatabase: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [role, setRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { role: detectedRole } = await detectRoleAndSchool(user);
      setRole(detectedRole);
      
      if (user) {
        // Try to get user profile
        const { data: profileData } = await assertSupabase()
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Failed to fetch parent data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (role !== 'parent') {
    return (
      <NavigationShell role="parent" activeTab={activeTab} onTabPress={setActiveTab}>
        <WireframeEmptyState
          icon="🚫"
          title="Access Denied"
          description="Parent access required to view this dashboard"
        />
      </NavigationShell>
    );
  }

  const parentName = profile ? 
    `${safeDisplay(profile.first_name, 'Parent')} ${safeDisplay(profile.last_name, '')}`.trim() : 
    'Parent';

  const renderDashboard = () => (
    <ScrollView style={{ flex: 1 }}>
      <WireframeCard title={`${parentName}'s Dashboard`}>
        {loading ? (
          <WireframeListItem 
            icon="⏳" 
            title="Loading your child's progress..." 
            subtitle="Fetching assignments and grades"
          />
        ) : (
          <WireframeListItem
            icon="👋"
            title="Welcome!"
            subtitle={profile?.email ? `Logged in as ${profile.email}` : 'Track your child\'s academic progress'}
          />
        )}
      </WireframeCard>

      <WireframeCard title="Children">
        <WireframeEmptyState
          icon="👨‍👩‍👧‍👦"
          title="No Children Enrolled"
          description="Your children's academic progress will appear here once they are enrolled in classes"
          actionLabel="Contact School"
          onActionPress={() => Alert.alert('Contact School', 'Please contact your school to enroll your children')}
        />
      </WireframeCard>

      <WireframeCard title="AI Homework Helper">
        <WireframeListItem
          icon="💡"
          title="Get Homework Help"
          subtitle="AI-powered assistance for your child's assignments"
          onPress={() => setActiveTab('homework')}
        />
        <WireframeProgress 
          label="Monthly Usage" 
          current={0} 
          total={10} 
          color="#00f5ff" 
        />
        <WireframeListItem
          icon="📸"
          title="Photo Math Problems"
          subtitle="Take a photo of math homework for instant help"
          onPress={() => Alert.alert('Feature Coming Soon', 'Photo math will be available soon')}
        />
      </WireframeCard>

      <WireframeCard title="Communication">
        <WireframeListItem
          icon="💬"
          title="Teacher Messages"
          subtitle="No messages from teachers yet"
          onPress={() => setActiveTab('messages')}
        />
        <WireframeListItem
          icon="📞"
          title="School Contact"
          subtitle="Reach out to school administration"
          onPress={() => router.push('/screens/teacher-messages')}
        />
      </WireframeCard>

      <WireframeCard title="School Upgrade">
        <WireframeListItem
          icon="🎯"
          title="Help Your School Go Premium"
          subtitle="Advocate for advanced AI tools and features"
          badge="New"
          onPress={() => Alert.alert('School Upgrade', 'Contact your principal to learn about premium features')}
        />
      </WireframeCard>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'homework':
        return (
          <WireframeEmptyState
            icon="📚"
            title="AI Homework Helper"
            description="Get step-by-step guidance on homework problems. Take a photo or type your question!"
            actionLabel="Start Homework Help"
            onActionPress={() => Alert.alert('Feature Coming Soon', 'AI homework helper will be available soon')}
          />
        );
      case 'messages':
        return (
          <WireframeEmptyState
            icon="💬"
            title="Teacher Messages"
            description="Communication hub for all your child's teachers"
            actionLabel="No Messages"
            onActionPress={() => Alert.alert('No messages from teachers yet')}
          />
        );
      case 'calendar':
        return (
          <WireframeEmptyState
            icon="📅"
            title="School Calendar"
            description="Important dates, events, and assignment due dates"
            actionLabel="No Events"
            onActionPress={() => Alert.alert('No upcoming events')}
          />
        );
      case 'settings':
        return (
          <WireframeEmptyState
            icon="⚙️"
            title="Account Settings"
            description="Manage notifications, privacy, and account preferences"
            actionLabel="Manage Settings"
            onActionPress={() => Alert.alert('Feature Coming Soon', 'Settings will be available soon')}
          />
        );
      default:
        return renderDashboard();
    }
  };

  return (
    <NavigationShell role="parent" activeTab={activeTab} onTabPress={setActiveTab}>
      {renderContent()}
      {activeTab === 'homework' && (
        <WireframeQuickAction
          label="Photo"
          icon="📸"
          role="parent"
          onPress={() => Alert.alert('Photo Homework Problem')}
        />
      )}
    </NavigationShell>
  );
};
