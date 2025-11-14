'use client';

import { BookOpen, Zap, AlertTriangle } from 'lucide-react';

interface ExamWeekBannerProps {
  onStartExamPrep: () => void;
}

export function ExamWeekBanner({ onStartExamPrep }: ExamWeekBannerProps) {
  return (
    <div 
      className="card" 
      style={{
        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        color: 'white',
        padding: '16px 20px',
        marginBottom: 16,
        cursor: 'pointer',
        border: '2px solid #93c5fd',
        boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)'
      }} 
      onClick={onStartExamPrep}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <AlertTriangle size={32} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ 
            fontWeight: 800, 
            fontSize: 16, 
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <Zap size={16} />
            EXAM MODE
          </div>
          <div style={{ fontSize: 13, opacity: 0.95, lineHeight: 1.4 }}>
            Practice tests, revision notes & last-minute tips to ace your exams!
          </div>
        </div>
        <button
          style={{
            background: 'white',
            color: '#1d4ed8',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          onClick={(e) => {
            e.stopPropagation();
            onStartExamPrep();
          }}
        >
          <BookOpen size={14} />
          Start Exam Prep
        </button>
      </div>
    </div>
  );
}
