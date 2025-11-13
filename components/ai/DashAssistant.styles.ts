import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dashAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  tierBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: screenWidth < 400 ? 32 : 36,
    height: screenWidth < 400 ? 32 : 36,
    borderRadius: screenWidth < 400 ? 16 : 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: screenWidth < 400 ? 2 : 4,
    minWidth: 32, // Ensure minimum touch target
    minHeight: 32,
  },
  closeButton: {
    width: screenWidth < 400 ? 32 : 36,
    height: screenWidth < 400 ? 32 : 36,
    borderRadius: screenWidth < 400 ? 16 : 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: screenWidth < 400 ? 2 : 4,
    minWidth: 32, // Ensure minimum touch target
    minHeight: 32,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
    paddingHorizontal: 0, // No horizontal padding for better layout
  },
  userMessage: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4, // Close to screen edge
    marginRight: 8,
    marginTop: 4,
    flexShrink: 0,
    // Subtle shadow for avatar
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
    } : {
      elevation: 2,
    }),
  },
  messageBubble: {
    maxWidth: screenWidth < 400 ? screenWidth * 0.75 : screenWidth * 0.72,
    padding: screenWidth < 400 ? 14 : 16,
    minHeight: 48,
    flex: 1,
  },
  // Modern bubble styles with smooth rounded corners
  userBubble: {
    borderRadius: 20,
    borderBottomRightRadius: 6, // Subtle tail effect
  },
  assistantBubble: {
    borderRadius: 20,
    borderBottomLeftRadius: 6, // Subtle tail effect
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    flexWrap: 'wrap',
    letterSpacing: 0.3,
  },
  messageContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  inlineBubbleRetryButton: {
    padding: 4,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  bubbleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  inlineAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  voiceNoteIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  voiceNoteDuration: {
    fontSize: 10,
    marginLeft: 4,
  },
  messageAttachmentsContainer: {
    marginTop: 8,
    gap: 6,
  },
  messageAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  messageAttachmentName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  messageAttachmentSize: {
    fontSize: 10,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 0,
    alignSelf: 'flex-end',
  },
  // Follow-up question chips within assistant messages
  followUpContainer: {
    marginTop: 8,
    gap: 6,
  },
  followUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingRight: 56, // space for FAB overlay
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(0,0,0,0.03)',
    gap: 8,
    width: '100%',
    position: 'relative',
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    } : {
      elevation: 1,
    }),
  },
  followUpFab: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    } : {
      elevation: 3,
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
  followUpSendIcon: {
    width: 22,
    height: 22,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speakButton: {
    width: screenWidth < 400 ? 30 : 32,
    height: screenWidth < 400 ? 30 : 32,
    borderRadius: screenWidth < 400 ? 15 : 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: screenWidth < 400 ? 6 : 8,
    minWidth: 30, // Ensure minimum touch target size
    minHeight: 30,
  },
  retryButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  typingBubble: {
    padding: 12,
    borderRadius: 18,
    marginLeft: 28,
  },
  typingContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  typingDots: {
    flexDirection: 'row',
    marginLeft: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
  suggestedActionsContainer: {
    marginTop: 8,
    marginBottom: 8,
    width: screenWidth,
    marginLeft: -16, // Offset messages container padding
  },
  suggestedActionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  suggestedActionsScrollContent: {
    paddingLeft: 16, // Start from left edge
    paddingRight: 16,
    gap: 8,
  },
  suggestedAction: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    marginRight: 0, // Gap handles spacing
  },
  suggestedActionText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'none',
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  cameraButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    position: 'relative',
    minHeight: 40,
  },
  inputLeftIcon: {
    position: 'absolute',
    left: 10,
    zIndex: 1,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    borderWidth: 0, // No border, wrapper has border
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachBadgeSmall: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachBadgeSmallText: {
    fontSize: 8,
    fontWeight: '600',
  },
  messageBubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  inlineSpeakButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  attachmentChipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 120,
  },
  attachmentChip: {
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 200,
    maxWidth: 250,
    overflow: 'hidden',
  },
  attachmentChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  attachmentChipText: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
  },
  attachmentChipName: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  attachmentChipSize: {
    fontSize: 11,
  },
  attachmentChipRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentProgressContainer: {
    marginRight: 8,
  },
  attachmentProgressBar: {
    height: 2,
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: 1,
  },
  attachmentProgressFill: {
    height: '100%',
    borderRadius: 1,
  },
  scrollToBottomFab: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    } : {}),
  },
  scrollToBottomBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffffff',
  },
  scrollToBottomBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    position: 'relative',
  },
  attachBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
