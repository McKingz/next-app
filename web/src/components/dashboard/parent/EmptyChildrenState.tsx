'use client';

import { UserPlus, BookOpen, GraduationCap, Home, Sparkles } from 'lucide-react';

interface EmptyChildrenStateProps {
  usageType?: 'preschool' | 'k12_school' | 'homeschool' | 'aftercare' | 'supplemental' | 'exploring' | 'independent';
  onAddChild: () => void;
}

export function EmptyChildrenState({ usageType, onAddChild }: EmptyChildrenStateProps) {
  const getContent = () => {
    switch (usageType) {
      case 'homeschool':
        return {
          icon: Home,
          title: 'Start Your Homeschool Journey',
          description: 'Add your children to begin tracking their learning progress, accessing CAPS-aligned curriculum, and using our AI-powered tools.',
          cta: 'Add Your First Learner',
          color: '#10b981'
        };
      
      case 'supplemental':
        return {
          icon: Sparkles,
          title: 'Boost Your Child\'s Learning',
          description: 'Add your children to access extra lessons, practice exams, and personalized learning support.',
          cta: 'Add Child',
          color: '#f59e0b'
        };
      
      case 'exploring':
        return {
          icon: BookOpen,
          title: 'Discover Learning Tools',
          description: 'Add your children to explore our features, from CAPS curriculum to AI tutoring and progress tracking.',
          cta: 'Get Started',
          color: '#06b6d4'
        };
      
      case 'k12_school':
      case 'preschool':
        return {
          icon: GraduationCap,
          title: 'Add Your Children',
          description: 'Connect your children to start viewing their progress, communicating with teachers, and staying updated with school activities.',
          cta: 'Add Child',
          color: '#8b5cf6'
        };
      
      case 'aftercare':
        return {
          icon: UserPlus,
          title: 'Register Your Children',
          description: 'Add your children to access aftercare schedules, daily updates, and communication with staff.',
          cta: 'Add Child',
          color: '#ec4899'
        };
      
      default:
        return {
          icon: UserPlus,
          title: 'Add Your First Child',
          description: 'Start by adding your children to access personalized learning tools, progress tracking, and educational resources.',
          cta: 'Add Child',
          color: '#667eea'
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <div className="section">
      <div 
        className="card" 
        style={{ 
          background: `linear-gradient(135deg, ${content.color}22 0%, ${content.color}11 100%)`,
          border: `2px dashed ${content.color}44`,
          padding: 'var(--space-6)',
          textAlign: 'center'
        }}
      >
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: 80, 
          height: 80,
          borderRadius: '50%',
          background: `${content.color}22`,
          marginBottom: 24
        }}>
          <Icon size={40} style={{ color: content.color }} />
        </div>
        
        <h2 style={{ 
          margin: 0, 
          marginBottom: 12, 
          fontSize: 24, 
          fontWeight: 700,
          color: content.color
        }}>
          {content.title}
        </h2>
        
        <p style={{ 
          margin: 0, 
          marginBottom: 24, 
          fontSize: 15, 
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
          maxWidth: 500,
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          {content.description}
        </p>
        
        <button
          onClick={onAddChild}
          className="btn"
          style={{
            background: `linear-gradient(135deg, ${content.color} 0%, ${content.color}dd 100%)`,
            color: 'white',
            fontWeight: 700,
            padding: '14px 32px',
            fontSize: 16,
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${content.color}44`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10
          }}
        >
          <UserPlus size={20} />
          {content.cta}
        </button>
      </div>
    </div>
  );
}
