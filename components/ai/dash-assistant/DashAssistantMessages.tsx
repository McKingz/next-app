import React from 'react';
import { Platform, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';

export interface DashAssistantMessagesProps {
  flashListRef: any;
  messages: any[];
  renderMessage: (item: any, index: number) => React.ReactElement | null;
  styles: any;
  theme: any;
  isLoading: boolean;
  isNearBottom: boolean;
  setIsNearBottom: (v: boolean) => void;
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  scrollToBottom: (opts: { animated?: boolean; delay?: number }) => void;
  renderTypingIndicator: () => React.ReactElement | null;
  renderSuggestedActions: () => React.ReactElement | null;
}

export const DashAssistantMessages: React.FC<DashAssistantMessagesProps> = ({
  flashListRef,
  messages,
  renderMessage,
  styles,
  theme,
  isLoading,
  isNearBottom,
  setIsNearBottom,
  setUnreadCount,
  scrollToBottom,
  renderTypingIndicator,
  renderSuggestedActions,
}) => {
  return (
    <FlashList
      ref={flashListRef}
      data={messages}
      keyExtractor={(item: any, index: number) => item.id || `msg-${index}`}
      renderItem={({ item, index }) => renderMessage(item, index)}
      estimatedItemSize={84}
      contentContainerStyle={styles.messagesContent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={Platform.OS === 'android'}
      onScroll={(e: any) => {
        try {
          const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent as any;
          const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
          const near = distanceFromBottom <= 200;
          if (near !== isNearBottom) {
            setIsNearBottom(near);
            if (near) setUnreadCount(0);
          }
        } catch {}
      }}
      scrollEventThrottle={16}
      onContentSizeChange={() => {
        // Auto-scroll when content grows (new messages)
        if (isLoading || isNearBottom) {
          scrollToBottom({ animated: true, delay: 80 });
        }
      }}
      ListFooterComponent={
        <>
          {renderTypingIndicator()}
          {renderSuggestedActions()}
        </>
      }
    />
  );
};

export default DashAssistantMessages;