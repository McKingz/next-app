'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useParentDashboardData } from '@/lib/hooks/useParentDashboardData';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { DashboardHeader } from '@/components/dashboard/parent/DashboardHeader';
import { TrialBanner } from '@/components/dashboard/parent/TrialBanner';
import { OrganizationBanner } from '@/components/dashboard/parent/OrganizationBanner';
import { ExamWeekBanner } from '@/components/dashboard/parent/ExamWeekBanner';
import { EmergencyExamHelp } from '@/components/dashboard/parent/EmergencyExamHelp';
import { QuickSubjectPractice } from '@/components/dashboard/parent/QuickSubjectPractice';
import { ExamTips } from '@/components/dashboard/parent/ExamTips';
import { CAPSExamCalendar } from '@/components/dashboard/parent/CAPSExamCalendar';
import { AllGradesAllSubjects } from '@/components/dashboard/parent/AllGradesAllSubjects';
import { PendingRequestsWidget } from '@/components/dashboard/parent/PendingRequestsWidget';
import { EmptyChildrenState } from '@/components/dashboard/parent/EmptyChildrenState';
import { QuickActionsGrid } from '@/components/dashboard/parent/QuickActionsGrid';
import { CAPSActivitiesWidget } from '@/components/dashboard/parent/CAPSActivitiesWidget';
import { ExamPrepWidget } from '@/components/dashboard/exam-prep/ExamPrepWidget';
import { CollapsibleSection } from '@/components/dashboard/parent/CollapsibleSection';
import { AskAIWidget } from '@/components/dashboard/AskAIWidget';
import { Users, BarChart3, Calendar, BookOpen, GraduationCap, Zap, Target, Lightbulb } from 'lucide-react';

export default function ParentDashboard() {
  const router = useRouter();
  const supabase = createClient();
  
  // Get all data from custom hook
  const {
    userId,
    profile,
    userName,
    preschoolName,
    usageType,
    hasOrganization,
    tenantSlug,
    childrenCards,
    activeChildId,
    setActiveChildId,
    childrenLoading,
    metrics,
    unreadCount,
    trialStatus,
    loading,
  } = useParentDashboardData();
  
  // Local state
  const [greeting, setGreeting] = useState('');
  const [showAskAI, setShowAskAI] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [aiDisplay, setAIDisplay] = useState('');
  const [aiLanguage, setAILanguage] = useState('en-ZA');
  const [aiInteractive, setAIInteractive] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  // Auth guard
  useEffect(() => {
    if (!loading && !userId) {
      router.push('/sign-in');
    }
  }, [loading, userId, router]);

  // Handle AI interactions
  const handleAskFromActivity = async (
    prompt: string, 
    display: string, 
    language?: string, 
    enableInteractive?: boolean
  ) => {
    setAIPrompt(prompt);
    setAIDisplay(display);
    setAILanguage(language || 'en-ZA');
    setAIInteractive(enableInteractive || false);
    setShowAskAI(true);
  };

  const handleCloseAI = () => {
    setShowAskAI(false);
    setAIPrompt('');
    setAIDisplay('');
    setAILanguage('en-ZA');
    setAIInteractive(false);
  };

  // Handle exam prep navigation
  const handleStartExamPrep = () => {
    // Scroll to exam prep widget or show AI with exam context
    setAIPrompt('I need help preparing for my exams next week. Can you help me create a study plan?');
    setAIDisplay('Exam Preparation Assistant');
    setShowAskAI(true);
  };

  const handleSubjectPractice = (subject: string, grade?: string) => {
    const gradeInfo = grade ? ` for ${grade}` : '';
    setAIPrompt(`Generate a CAPS-aligned practice test for ${subject}${gradeInfo}. Include questions with a detailed memorandum. Make it exam-standard quality.`);
    setAIDisplay(`${subject} Practice Test${gradeInfo}`);
    setShowAskAI(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // Active child
  const activeChild = childrenCards.find((c) => c.id === activeChildId);

  return (
    <ParentShell
      tenantSlug={tenantSlug}
      userEmail={profile?.email}
      userName={userName}
      preschoolName={preschoolName}
      unreadCount={unreadCount}
      hasOrganization={hasOrganization}
    >
      <div className="container">
        {/* Header */}
        <DashboardHeader userName={userName} greeting={greeting} />

        {/* Trial Banner */}
        <TrialBanner trialStatus={trialStatus} />

        {/* CRITICAL: Exam Banner - ALWAYS SHOW (Exams in Progress!) */}
        <ExamWeekBanner onStartExamPrep={handleStartExamPrep} />

        {/* Organization Banner (ONLY if has organization) */}
        <OrganizationBanner
          hasOrganization={hasOrganization}
          preschoolName={preschoolName}
          userId={userId}
        />

        {/* Pending Requests (ONLY for organization-linked parents) */}
        {hasOrganization && <PendingRequestsWidget userId={userId} />}

        {/* Children Section */}
        {childrenCards.length === 0 && !childrenLoading && (
          <EmptyChildrenState
            usageType={usageType}
            onAddChild={() => {
              // If parent has organization, they should claim/link children
              // If independent parent, they should register children
              if (hasOrganization) {
                router.push('/dashboard/parent/claim-child');
              } else {
                router.push('/dashboard/parent/register-child');
              }
            }}
          />
        )}

        {childrenCards.length > 0 && (
          <CollapsibleSection 
            title="My Children" 
            icon={Users} 
            isOpen={openSection === 'children'}
            onToggle={() => setOpenSection(openSection === 'children' ? null : 'children')}
          >
            <div className="flex gap-3 overflow-x-auto" style={{ paddingBottom: 'var(--space-2)' }}>
              {childrenCards.map((child) => (
                <div
                  key={child.id}
                  className="card card-interactive"
                  style={{
                    border: activeChildId === child.id ? '2px solid var(--primary)' : undefined,
                    minWidth: '280px',
                    flexShrink: 0
                  }}
                  onClick={() => setActiveChildId(child.id)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="avatar" style={{ width: 48, height: 48, fontSize: 20 }}>
                      {child.firstName[0]}{child.lastName[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold" style={{ fontSize: 16 }}>
                        {child.firstName} {child.lastName}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        {child.grade}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      <div className="font-semibold" style={{ fontSize: 16 }}>{child.homeworkPending}</div>
                      Homework
                    </div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      <div className="font-semibold" style={{ fontSize: 16 }}>{child.upcomingEvents}</div>
                      Events
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Quick Actions Grid */}
        <QuickActionsGrid usageType={usageType} hasOrganization={hasOrganization} />

        {/* Emergency Exam Help - Priority Access to AI Tutor */}
        <CollapsibleSection 
          title="Emergency Exam Help" 
          icon={Zap} 
          isOpen={openSection === 'emergency'}
          onToggle={() => setOpenSection(openSection === 'emergency' ? null : 'emergency')}
        >
          <EmergencyExamHelp onClick={handleStartExamPrep} />
        </CollapsibleSection>

        {/* CAPS Exam Calendar - Real Exam Schedule */}
        <CollapsibleSection 
          title="CAPS Exam Calendar" 
          icon={Calendar} 
          isOpen={openSection === 'calendar'}
          onToggle={() => setOpenSection(openSection === 'calendar' ? null : 'calendar')}
        >
          <CAPSExamCalendar 
            childGrade={activeChild ? `Grade ${Math.floor(10 + (activeChild.progressScore / 20))}` : undefined}
            usageType={usageType}
          />
        </CollapsibleSection>

        {/* Quick Subject Practice - One-Click Practice Tests */}
        {activeChild && (
          <CollapsibleSection 
            title="Quick Subject Practice" 
            icon={Target} 
            isOpen={openSection === 'practice'}
            onToggle={() => setOpenSection(openSection === 'practice' ? null : 'practice')}
          >
            <QuickSubjectPractice
              childAge={activeChild.progressScore > 80 ? 15 : 10}
              onSelectSubject={handleSubjectPractice}
            />
          </CollapsibleSection>
        )}

        {/* All Grades & Subjects - Complete CAPS Coverage */}
        <CollapsibleSection 
          title="All Grades & Subjects" 
          icon={BookOpen} 
          isOpen={openSection === 'grades'}
          onToggle={() => setOpenSection(openSection === 'grades' ? null : 'grades')}
        >
          <AllGradesAllSubjects onSelectSubject={handleSubjectPractice} />
        </CollapsibleSection>

        {/* Exam Tips - Study Best Practices */}
        <CollapsibleSection 
          title="Exam Tips & Study Strategies" 
          icon={Lightbulb} 
          isOpen={openSection === 'tips'}
          onToggle={() => setOpenSection(openSection === 'tips' ? null : 'tips')}
        >
          <ExamTips />
        </CollapsibleSection>

        {/* CAPS Exam Preparation Builder - Continuous Conversational Process */}
        <CollapsibleSection 
          title="CAPS Exam Preparation" 
          icon={GraduationCap} 
          isOpen={openSection === 'exam-prep'}
          onToggle={() => setOpenSection(openSection === 'exam-prep' ? null : 'exam-prep')}
        >
          <ExamPrepWidget
            onAskDashAI={(prompt, display, language, enableInteractive) => 
              handleAskFromActivity(prompt, display, language, enableInteractive)
            }
            guestMode={false}
          />
        </CollapsibleSection>

        {/* Overview Section (ONLY for organization-linked parents) */}
        {hasOrganization && (
          <CollapsibleSection 
            title="Overview" 
            icon={BarChart3} 
            isOpen={openSection === 'overview'}
            onToggle={() => setOpenSection(openSection === 'overview' ? null : 'overview')}
          >
            <div className="grid2">
              <div className="card tile">
                <div className="metricValue">{unreadCount}</div>
                <div className="metricLabel">Unread Messages</div>
              </div>
              <div className="card tile">
                <div className="metricValue">{activeChild ? metrics.pendingHomework : 0}</div>
                <div className="metricLabel">Homework Pending</div>
              </div>
              <div className="card tile">
                <div className="metricValue">0%</div>
                <div className="metricLabel">Attendance Rate</div>
              </div>
              <div className="card tile">
                <div className="metricValue">{childrenCards.length}</div>
                <div className="metricLabel">Total Children</div>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* CAPS Activities Widget */}
        {activeChild && (
          <CollapsibleSection 
            title="Learning Activities" 
            icon={GraduationCap} 
            isOpen={openSection === 'activities'}
            onToggle={() => setOpenSection(openSection === 'activities' ? null : 'activities')}
          >
            <CAPSActivitiesWidget
              childAge={activeChild.progressScore > 80 ? 6 : 5}
              childName={activeChild.firstName}
              onAskDashAI={(prompt, display) => handleAskFromActivity(prompt, display)}
            />
          </CollapsibleSection>
        )}
      </div>

      {/* AI Widget Modal */}
      {showAskAI && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{ width: '100%', maxWidth: 800, position: 'relative' }}>
            <button
              onClick={handleCloseAI}
              style={{
                position: 'absolute',
                top: -40,
                right: 0,
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: 8,
                padding: 8,
                cursor: 'pointer',
                color: 'white'
              }}
            >
              Close
            </button>
            <AskAIWidget
              fullscreen={true}
              initialPrompt={aiPrompt}
              displayMessage={aiDisplay}
              language={aiLanguage}
              enableInteractive={aiInteractive}
              onClose={handleCloseAI}
            />
          </div>
        </div>
      )}
    </ParentShell>
  );
}
