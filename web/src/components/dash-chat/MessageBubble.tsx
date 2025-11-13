'use client';

import { User, Sparkles, RefreshCw, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useState } from 'react';
import { ChatMessage } from './ChatInterface';
import { exportTextToPDF } from '@/lib/utils/pdf-export';

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [mermaidSvg, setMermaidSvg] = useState<string | null>(null);
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  
  // Detect if message contains downloadable content (exam, flashcards, study guide)
  const hasDownloadableContent = !isUser && message.content && (
    message.content.includes('## SECTION') || 
    message.content.includes('# DEPARTMENT OF BASIC EDUCATION') ||
    message.content.includes('Flashcard') ||
    message.content.includes('Study Plan') ||
    message.content.includes('MARKING MEMORANDUM') ||
    message.content.length > 500 // Long-form content
  );
  
  const handleDownloadPDF = () => {
    // Extract title from content (look for first heading)
    const titleMatch = message.content.match(/^#\s+(.+?)$/m);
    const title = titleMatch ? titleMatch[1] : 'EduDash_Content';
    
    // Download as PDF
    exportTextToPDF(message.content, title);
  };

  // Detect mermaid blocks and render them client-side using dynamic import
  useEffect(() => {
    let cancelled = false;
    const content = message.content || '';
    const mermaidMatch = content.match(/```mermaid\s*([\s\S]*?)```/i);
    if (!mermaidMatch) {
      setMermaidSvg(null);
      setMermaidError(null);
      return;
    }

    const mermaidCode = mermaidMatch[1];

    // Dynamically import mermaid to avoid SSR issues and bundle size for unrelated pages
    (async () => {
      try {
        const mermaid = await import('mermaid');
        // initialize with short security settings
        mermaid.default.initialize({ startOnLoad: false });
        const renderId = `mmd-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const rendered = await mermaid.default.render(renderId, mermaidCode);
  // mermaid.render returns an SVG string (or a Promise that resolves to SVG)
  if (!cancelled) setMermaidSvg(String(rendered));
      } catch (err: any) {
        console.error('Mermaid render failed:', err);
        if (!cancelled) setMermaidError(String(err?.message || err));
      }
    })();

    return () => { cancelled = true };
  }, [message.content]);
  
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        flexDirection: isUser ? 'row-reverse' : 'row',
        paddingLeft: isUser ? 16 : 4,
        paddingRight: isUser ? 4 : 16,
      }}
    >
      {/* Avatar - Smaller, closer to edge */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isUser
            ? 'var(--primary)'
            : 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isUser ? (
          <User size={14} color="white" />
        ) : (
          <Sparkles size={14} color="white" />
        )}
      </div>

      {/* Message Content - Much Wider (85%) */}
      <div
        style={{
          maxWidth: '85%',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Images */}
        {message.images && message.images.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {message.images.map((img, index) => (
              <div
                key={index}
                onClick={() => setExpandedImage(img.preview || img.data)}
                style={{
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '2px solid var(--border)',
                  maxWidth: 200,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <img
                  src={img.preview || img.data}
                  alt={`Attachment ${index + 1}`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                  }}
                />
                {/* Hover overlay */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                    padding: '8px',
                    fontSize: '11px',
                    color: 'white',
                    textAlign: 'center',
                    fontWeight: 500,
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                  }}
                  className="image-hover-text"
                >
                  Click to expand
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Text Content */}
        <div
          style={{
            background: isUser
              ? 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)'
              : 'var(--surface-1)',
            color: isUser ? 'white' : 'var(--text)',
            padding: '12px 16px',
            borderRadius: 16,
            border: isUser ? 'none' : '1px solid var(--border)',
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {isUser ? (
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Mermaid rendering (if present) */}
        {mermaidSvg && (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', padding: 6 }}
            dangerouslySetInnerHTML={{ __html: mermaidSvg }}
          />
        )}
        {mermaidError && (
          <pre style={{ background: 'rgba(0,0,0,0.05)', padding: 8, borderRadius: 8, fontSize: 13 }}>{mermaidError}</pre>
        )}

        {/* Metadata and Retry Button */}
        <div
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            paddingLeft: isUser ? 0 : 8,
            paddingRight: isUser ? 8 : 0,
            justifyContent: isUser ? 'flex-end' : 'flex-start',
          }}
        >
          <span>
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          {message.meta?.tokensUsed && (
            <span>• {message.meta.tokensUsed} tokens</span>
          )}
          {message.isError && onRetry && (
            <>
              <span>•</span>
              <button
                onClick={onRetry}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(124, 58, 237, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <RefreshCw size={12} />
                Retry
              </button>
            </>
          )}
          {hasDownloadableContent && (
            <>
              <span>•</span>
              <button
                onClick={handleDownloadPDF}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(124, 58, 237, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                title="Download as PDF"
              >
                <Download size={12} />
                PDF
              </button>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        .markdown-content {
          font-size: 14px;
          line-height: 1.6;
        }
        
        .markdown-content p {
          margin: 0 0 8px 0;
        }
        
        .markdown-content p:last-child {
          margin-bottom: 0;
        }
        
        .markdown-content ul,
        .markdown-content ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        
        .markdown-content li {
          margin: 4px 0;
        }
        
        .markdown-content code {
          background: rgba(0, 0, 0, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
          font-family: 'Monaco', 'Courier New', monospace;
        }
        
        .markdown-content pre {
          background: rgba(0, 0, 0, 0.05);
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 8px 0;
        }
        
        .markdown-content pre code {
          background: none;
          padding: 0;
        }
        
        .markdown-content strong {
          font-weight: 600;
        }
        
        .markdown-content em {
          font-style: italic;
        }
        
        .markdown-content blockquote {
          border-left: 3px solid var(--primary);
          padding-left: 12px;
          margin: 8px 0;
          color: var(--muted);
        }
        
        .markdown-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
        }
        
        .markdown-content th,
        .markdown-content td {
          border: 1px solid var(--border);
          padding: 6px 10px;
          text-align: left;
        }
        
        .markdown-content th {
          background: var(--surface-2);
          font-weight: 600;
        }
        
        .image-hover-text {
          opacity: 0;
        }
        
        div:hover .image-hover-text {
          opacity: 1;
        }
      `}</style>
      
      {/* Image Expansion Modal */}
      {expandedImage && (
        <div
          onClick={() => setExpandedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={expandedImage}
              alt="Expanded view"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              }}
            />
            <button
              onClick={() => setExpandedImage(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#000',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.background = 'var(--primary)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = '#000';
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
