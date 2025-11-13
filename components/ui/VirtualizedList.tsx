/**
 * Ultra-fast virtualized list components for EduDash
 * 
 * Uses FlashList for maximum performance with intelligent rendering
 * and memory optimization for Dash's agentic interfaces.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { ViewStyle, RefreshControl, StyleProp } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { ListRenderItem } from '@shopify/flash-list';
import { measureRender } from '@/lib/perf';
import { logger } from '@/lib/logger';

interface VirtualizedListProps<T> {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  estimatedItemSize?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
  EmptyComponent?: React.ComponentType;
  HeaderComponent?: React.ComponentType;
  FooterComponent?: React.ComponentType;
  numColumns?: number;
  horizontal?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  maxToRenderPerBatch?: number;
  windowSize?: number;
  removeClippedSubviews?: boolean;
}

/**
 * Ultra-optimized FlashList component for large datasets
 * Perfect for Dash's chat history, lesson lists, and user interfaces
 */
export const UltraFastList = memo(<T extends { id: string | number }>(
  props: VirtualizedListProps<T>
) => {
  const {
    data,
    renderItem,
    keyExtractor,
    estimatedItemSize = 60,
    refreshing = false,
    onRefresh,
    onEndReached,
    onEndReachedThreshold = 0.8,
    style,
    contentContainerStyle,
    testID,
    EmptyComponent,
    HeaderComponent,
    FooterComponent,
    numColumns = 1,
    horizontal = false,
    showsVerticalScrollIndicator = false,
    showsHorizontalScrollIndicator = false,
    maxToRenderPerBatch = 5,
    windowSize = 10,
    removeClippedSubviews = true,
  } = props;

  // Memoized render item for performance
  const memoizedRenderItem = useCallback<ListRenderItem<T>>((info) => {
    try {
      return renderItem(info);
    } catch (error) {
      logger.warn('VirtualizedList: Error in renderItem', { error, item: info.item });
      return null;
    }
  }, [renderItem]);

  // Stable key extractor
  const stableKeyExtractor = useCallback(
    (item: T, index: number) => {
      try {
        return keyExtractor(item, index);
      } catch (error) {
        logger.warn('VirtualizedList: Error in keyExtractor', { error, item, index });
        return `item-${index}`;
      }
    },
    [keyExtractor]
  );

  // Optimized refresh control
  const refreshControl = useMemo(
    () => onRefresh ? (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor="#00f5ff"
        colors={['#00f5ff', '#0080ff']}
      />
    ) : undefined,
    [refreshing, onRefresh]
  );

  // Performance tracking for end reached
  const handleEndReached = useCallback(() => {
    if (!onEndReached) return;
    
    try {
      import('@/lib/perf').then(({ mark }) => {
        mark('list_pagination_start');
      });
      
      onEndReached();
      
      import('@/lib/perf').then(({ measure }) => {
        const { duration } = measure('list_pagination_start');
        if (__DEV__ && duration > 100) {
          logger.debug(`List pagination took ${duration}ms`);
        }
      });
    } catch (error) {
      logger.warn('VirtualizedList: Error in onEndReached', error);
    }
  }, [onEndReached]);

  return (
    <FlashList
      data={data}
      renderItem={memoizedRenderItem}
      keyExtractor={stableKeyExtractor}
      estimatedItemSize={estimatedItemSize}
      refreshControl={refreshControl}
      onEndReached={handleEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      style={style}
      contentContainerStyle={contentContainerStyle as any}
      testID={testID}
      ListEmptyComponent={EmptyComponent}
      ListHeaderComponent={HeaderComponent}
      ListFooterComponent={FooterComponent}
      numColumns={numColumns}
      horizontal={horizontal}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
      // maxToRenderPerBatch not supported by FlashList
      // windowSize not supported by FlashList
      // removeClippedSubviews not supported by FlashList
      // FlashList specific optimizations
      estimatedFirstItemOffset={0}
      drawDistance={windowSize * estimatedItemSize}
      overrideItemLayout={(layout, item, index) => {
        // Override for known fixed heights to improve performance
        if (typeof item === 'object' && item && 'height' in item) {
          layout.size = (item as any).height;
        }
      }}
    />
  );
}) as <T extends { id: string | number }>(props: VirtualizedListProps<T>) => React.ReactElement;
;(UltraFastList as any).displayName = 'UltraFastList';

/**
 * Chat list component optimized for Dash conversations
 */
export const DashChatList = memo(<T extends { id: string | number; timestamp?: number }>(
  props: Omit<VirtualizedListProps<T>, 'estimatedItemSize'> & { 
    inverted?: boolean;
    maintainVisibleContentPosition?: boolean;
  }
) => {
  const { inverted = true, maintainVisibleContentPosition = true, ...restProps } = props;

  return (
    <UltraFastList
      {...restProps}
      estimatedItemSize={80} // Optimized for chat messages
      style={[{ transform: inverted ? [{ scaleY: -1 }] : [] }, restProps.style]}
      // Chat-specific optimizations
      windowSize={15}
      maxToRenderPerBatch={3}
      removeClippedSubviews={true}
      showsVerticalScrollIndicator={false}
    />
  );
}) as <T extends { id: string | number; timestamp?: number }>(
  props: Omit<VirtualizedListProps<T>, 'estimatedItemSize'> & { 
    inverted?: boolean;
    maintainVisibleContentPosition?: boolean;
  }
) => React.ReactElement;
;(DashChatList as any).displayName = 'DashChatList';

/**
 * Lesson grid for Dash's educational content
 */
export const DashLessonGrid = memo(<T extends { id: string | number }>(
  props: Omit<VirtualizedListProps<T>, 'estimatedItemSize' | 'numColumns'>
) => {
  return (
    <UltraFastList
      {...props}
      numColumns={2}
      estimatedItemSize={160} // Optimized for lesson cards
      windowSize={8}
      maxToRenderPerBatch={4}
      contentContainerStyle={[{ padding: 16 }, props.contentContainerStyle]}
    />
  );
}) as <T extends { id: string | number }>(
  props: Omit<VirtualizedListProps<T>, 'estimatedItemSize' | 'numColumns'>
) => React.ReactElement;
;(DashLessonGrid as any).displayName = 'DashLessonGrid';

export default measureRender(UltraFastList, 'UltraFastList');