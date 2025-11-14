/**
 * Chat Interface Demo Page
 * Accessible without authentication - for testing and development
 * Access at: http://localhost:3000/chat-demo
 */

'use client';

import { ChatInterface } from '@/components/dash-chat/ChatInterface';

export default function ChatDemoPage() {
  const conversationId = `demo-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Responsive demo info bar */}
      <div style={{
        padding: '12px 20px',
        background: '#1a1a2e',
        color: '#fff',
        fontSize: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>🧪 Chat Interface Demo - Desktop Responsiveness Test</span>
        <span id="resolution" style={{ fontWeight: 'bold' }}>
          {typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}px` : 'Loading...'}
        </span>
      </div>

      {/* Chat Interface */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ChatInterface conversationId={conversationId} />
      </div>

      <script dangerouslySetInnerHTML={{
        __html: `
          function updateResolution() {
            const elem = document.getElementById('resolution');
            if (elem) {
              elem.textContent = window.innerWidth + 'x' + window.innerHeight + 'px';
            }
          }
          window.addEventListener('resize', updateResolution);
          updateResolution();
        `
      }} />
    </div>
  );
}
