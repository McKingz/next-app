/**
 * MessageBubbleModern Component
 * 
 * Claude/ChatGPT-style message bubbles with markdown support,
 * copy functionality, and smooth animations
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, ActivityIndicator, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/contexts/ThemeContext';
import { DashAvatar } from './DashAvatar';
import { BrandGradients, BrandColors } from '@/components/branding';
import type { DashMessage } from '@/services/dash-ai/types';
import { renderCAPSResults } from '@/lib/caps/parseCAPSResults';

export interface MessageBubbleModernProps {
  message: DashMessage;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onRetry?: () => void; // Retry sending the user message
  onSpeak?: (message: DashMessage) => void;
  isSpeaking?: boolean;
  showActions?: boolean;
  showIcon?: boolean;
  onSendFollowUp?: (question: string) => void; // Send follow-up question directly
}

export function MessageBubbleModern({
  message,
  onCopy,
  onRegenerate,
  onRetry,
  onSpeak,
  isSpeaking = false,
  showActions = true,
  showIcon = false,
  onSendFollowUp,
}: MessageBubbleModernProps) {
  const { theme, isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  const hasAttachments = message.attachments && message.attachments.length > 0;
  
  const CHAR_LIMIT = 600;
  const needsTruncation = message.content.length > CHAR_LIMIT;
  const displayContent = needsTruncation && !isExpanded 
    ? message.content.slice(0, CHAR_LIMIT) + '...'
    : message.content;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering - can be enhanced with react-native-markdown-display
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Headers
      if (line.startsWith('### ')) {
        return (
          <Text key={index} style={[styles.text, styles.h3, { color: theme.text }]}>
            {line.replace('### ', '')}
          </Text>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <Text key={index} style={[styles.text, styles.h2, { color: theme.text }]}>
            {line.replace('## ', '')}
          </Text>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <Text key={index} style={[styles.text, styles.h1, { color: theme.text }]}>
            {line.replace('# ', '')}
          </Text>
        );
      }

      // Bold
      const boldRegex = /\*\*(.*?)\*\*/g;
      if (boldRegex.test(line)) {
        const parts = line.split(boldRegex);
        return (
          <Text key={index} style={[styles.text, { color: theme.text }]}>
            {parts.map((part, i) =>
              i % 2 === 1 ? (
                <Text key={i} style={styles.bold}>{part}</Text>
              ) : (
                part
              )
            )}
          </Text>
        );
      }

      // List items
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <Text key={index} style={[styles.text, styles.listItem, { color: theme.text }]}>
            • {line.replace(/^[-•]\s*/, '')}
          </Text>
        );
      }

      // Code blocks
      if (line.startsWith('```')) {
        return null; // Skip code fence markers
      }

      // Regular text
      return line ? (
        <Text key={index} style={[styles.text, { color: theme.text }]}>
          {line}
        </Text>
      ) : (
        <View key={index} style={styles.lineBreak} />
      );
    });
  };

  return (
    <View style={[styles.container, isUser && styles.containerUser]}>
      {/* Avatar beside bubble for assistant messages (WhatsApp style) */}
      {!isUser && !isSystem && (
        <View style={styles.avatarBeside}>
          <DashAvatar size="sm" />
        </View>
      )}
      
      <View
        style={[
          styles.bubble,
          isUser && styles.bubbleUser,
          isSystem && styles.bubbleSystem,
          !isUser && !isSystem && styles.bubbleAssistant,
        ]}
      >
        {/* Gradient background for user messages */}
        {isUser && (
          <LinearGradient
            colors={BrandGradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBackground}
          />
        )}
        
        {/* Subtle gradient for assistant messages */}
        {!isUser && !isSystem && (
          <LinearGradient
            colors={isDark ? ['#1f2937', '#111827'] : ['#ffffff', '#f8fafc']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.assistantBackground}
          />
        )}
        
        {/* System message background */}
        {isSystem && (
          <View
            style={[
              styles.systemBackground,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          />
        )}
        
        {/* Image attachments */}
        {hasAttachments && (
          <View style={styles.attachmentsContainer}>
            {message.attachments!.map((attachment, index) => (
              <TouchableOpacity
                key={attachment.id}
                style={[styles.imageAttachment, message.attachments!.length > 1 && styles.imageAttachmentMultiple]}
                onPress={() => setExpandedImage(attachment.meta?.publicUrl || attachment.previewUri || '')}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: attachment.meta?.publicUrl || attachment.previewUri }}
                  style={styles.attachmentImage}
                  resizeMode="cover"
                />
                {attachment.status === 'uploading' && (
                  <View style={styles.imageLoadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
                {attachment.status === 'failed' && (
                  <View style={[styles.imageLoadingOverlay, { backgroundColor: 'rgba(220, 38, 38, 0.8)' }]}>
                    <Ionicons name="alert-circle" size={24} color="#fff" />
                    <Text style={styles.errorText}>Failed to load</Text>
                  </View>
                )}
                {/* Expand icon hint */}
                <View style={styles.expandIcon}>
                  <Ionicons name="expand-outline" size={16} color="rgba(255,255,255,0.8)" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        {/* Message content */}
        <View style={styles.content}>
          <View style={{ opacity: 1 }}>
            {displayContent.split('\n').map((line, index) => {
              // Simple rendering with proper color
              if (line.startsWith('### ')) {
                return (
                  <Text selectable={true} key={index} style={[styles.text, styles.h3, { color: isUser ? '#fff' : theme.text }]}>
                    {line.replace('### ', '')}
                  </Text>
                );
              }
              if (line.startsWith('## ')) {
                return (
                  <Text selectable={true} key={index} style={[styles.text, styles.h2, { color: isUser ? '#fff' : theme.text }]}>
                    {line.replace('## ', '')}
                  </Text>
                );
              }
              if (line.startsWith('# ')) {
                return (
                  <Text selectable={true} key={index} style={[styles.text, styles.h1, { color: isUser ? '#fff' : theme.text }]}>
                    {line.replace('# ', '')}
                  </Text>
                );
              }
              
              // Bold
              const boldRegex = /\*\*(.*?)\*\*/g;
              if (boldRegex.test(line)) {
                const parts = line.split(boldRegex);
                return (
                  <Text selectable={true} key={index} style={[styles.text, { color: isUser ? '#fff' : theme.text }]}>
                    {parts.map((part, i) =>
                      i % 2 === 1 ? (
                        <Text key={i} style={styles.bold}>{part}</Text>
                      ) : (
                        part
                      )
                    )}
                  </Text>
                );
              }
              
              // List items
              if (line.startsWith('- ') || line.startsWith('• ')) {
                return (
                  <Text selectable={true} key={index} style={[styles.text, styles.listItem, { color: isUser ? '#fff' : theme.text }]}>
                    • {line.replace(/^[-•]\s*/, '')}
                  </Text>
                );
              }
              
              // Code blocks
              if (line.startsWith('```')) {
                return null;
              }
              
              // Regular text
              return line ? (
                <Text 
                  selectable={true}
                  key={index} 
                  style={[styles.text, { color: isUser ? '#fff' : theme.text }]}
                >
                  {line}
                </Text>
              ) : (
                <View key={index} style={styles.lineBreak} />
              );
            })}
          </View>
          
          {/* Read more/less button */}
          {needsTruncation && (
            <TouchableOpacity 
              onPress={() => setIsExpanded(!isExpanded)}
              style={styles.readMoreButton}
            >
              <Text style={[styles.readMoreText, { color: isUser ? 'rgba(255,255,255,0.9)' : theme.primary }]}>
                {isExpanded ? '▲ Show less' : '▼ Read more'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* CAPS Document Results (for assistant messages with tool results) */}
        {!isUser && !isSystem && message.metadata?.tool_results && (
          <View style={styles.capsResultsContainer}>
            {renderCAPSResults(message.metadata)}
          </View>
        )}

        {/* Timestamp */}
        <Text
          style={[
            styles.timestamp,
            {
              color: isUser
                ? 'rgba(255,255,255,0.7)'
                : isDark
                ? 'rgba(255,255,255,0.5)'
                : 'rgba(0,0,0,0.4)',
            },
          ]}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        {/* Retry button (only for user messages - positioned on left) */}
        {showActions && isUser && onRetry && (
          <View style={styles.actionsUserLeft}>
            <TouchableOpacity
              style={[styles.actionButtonUser, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
              onPress={onRetry}
            >
              <Ionicons name="reload-outline" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={[styles.actionTextUser, { color: 'rgba(255,255,255,0.9)' }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action buttons (only for assistant messages) */}
        {showActions && !isUser && !isSystem && (
          <View style={styles.actions}>
            {/* Speak button */}
            {onSpeak && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: isSpeaking
                      ? theme.primary
                      : theme.surface,
                  },
                ]}
                onPress={() => onSpeak(message)}
              >
                <Ionicons
                  name={isSpeaking ? 'stop' : 'volume-high-outline'}
                  size={14}
                  color={isSpeaking ? (theme.onPrimary || '#fff') : theme.text}
                />
                <Text
                  style={[
                    styles.actionText,
                    {
                      color: isSpeaking
                        ? (theme.onPrimary || '#fff')
                        : theme.text,
                    },
                  ]}
                >
                  {isSpeaking ? 'Stop' : 'Speak'}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Copy button */}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.surface }]}
              onPress={handleCopy}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={14}
                color={theme.text}
              />
              <Text style={[styles.actionText, { color: theme.text }]}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>

            {/* Regenerate button */}
            {onRegenerate && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.surface }]}
                onPress={onRegenerate}
              >
                <Ionicons name="refresh-outline" size={14} color={theme.text} />
                <Text style={[styles.actionText, { color: theme.text }]}>
                  Regenerate
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Follow-up question chips with send buttons (assistant messages only) */}
        {!isUser && !isSystem && message.metadata?.suggested_actions && message.metadata.suggested_actions.length > 0 && onSendFollowUp && (
          <View style={styles.followUpContainer}>
            {message.metadata.suggested_actions.map((question, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.followUpChip, { backgroundColor: theme.surface, borderColor: theme.primary }]}
                onPress={() => onSendFollowUp(question)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Send: ${question}`}
              >
                <Text style={[styles.followUpText, { color: theme.text }]}> 
                  {question}
                </Text>
                <View pointerEvents="none" style={[styles.followUpFab, { backgroundColor: theme.primary }]}> 
                  <Ionicons name="send" size={16} color="#fff" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      
      {/* Image Fullscreen Modal */}
      <Modal
        visible={expandedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setExpandedImage(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setExpandedImage(null)}
        >
          <View style={styles.modalContent}>
            <Image
              source={{ uri: expandedImage || undefined }}
              style={styles.expandedImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.surface }]}
              onPress={() => setExpandedImage(null)}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignItems: 'flex-start',
  },
  containerUser: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
  },
  avatarBeside: {
    width: 26,
    height: 26,
    marginRight: 4,
    marginLeft: 2,
    marginTop: 2,
  },
  bubble: {
    flex: 1,
    maxWidth: '88%',
    borderRadius: 26,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'relative',
    overflow: 'hidden', // clip child backgrounds to rounded corners
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  bubbleUser: {
    borderTopRightRadius: 12,
  },
  bubbleAssistant: {
    borderTopLeftRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  bubbleSystem: {
    borderTopLeftRadius: 6,
    borderWidth: 1,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  assistantBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  systemBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  content: {
    marginBottom: 12,
    paddingRight: 36,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
    marginVertical: 0,
    color: 'inherit',
  },
  h1: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  h2: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 3,
  },
  h3: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  bold: {
    fontWeight: '600',
  },
  listItem: {
    paddingLeft: 8,
    marginVertical: 1,
  },
  lineBreak: {
    height: 8,
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
    position: 'absolute',
    right: 10,
    bottom: 6,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
    flexWrap: 'wrap',
  },
  actionsUser: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 4,
    justifyContent: 'flex-end',
  },
  actionsUserLeft: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 4,
    justifyContent: 'flex-start',
    marginBottom: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  actionButtonUser: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionTextUser: {
    fontSize: 12,
    fontWeight: '600',
  },
  readMoreButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  attachmentsContainer: {
    marginBottom: 8,
    gap: 8,
  },
  imageAttachment: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  imageAttachmentMultiple: {
    aspectRatio: 1, // Square for multiple images
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  expandIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedImage: {
    width: '90%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  // Follow-up question chips
  followUpContainer: {
    marginTop: 8,
    gap: 6,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  followUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingRight: 56,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  followUpText: {
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  followUpFab: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  capsResultsContainer: {
    marginTop: 12,
    marginBottom: 8,
  }
});
