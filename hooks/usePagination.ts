/**
 * usePagination Hook
 * 
 * A reusable hook for implementing pagination with infinite scroll
 * or load-more functionality for large datasets.
 */

import { useState, useCallback, useMemo } from 'react';

export interface PaginationOptions {
  initialPageSize?: number;
  loadMoreThreshold?: number;
}

export interface PaginationState<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  totalCount?: number;
}

export interface PaginationActions {
  loadMore: () => void;
  reset: () => void;
  setItems: (items: any[], totalCount?: number) => void;
  appendItems: (newItems: any[], hasMore: boolean) => void;
}

export function usePagination<T>(
  options: PaginationOptions = {}
): [PaginationState<T>, PaginationActions] {
  const { 
    initialPageSize = 20 
  } = options;

  const [page, setPage] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);

  const pageSize = initialPageSize;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setPage((prev) => prev + 1);
  }, [hasMore, isLoadingMore]);

  const reset = useCallback(() => {
    setPage(0);
    setItems([]);
    setHasMore(true);
    setIsLoadingMore(false);
    setTotalCount(undefined);
  }, []);

  const setItemsAction = useCallback((newItems: T[], count?: number) => {
    setItems(newItems);
    setTotalCount(count);
    setPage(0);
    setHasMore(count !== undefined ? newItems.length < count : true);
    setIsLoadingMore(false);
  }, []);

  const appendItems = useCallback((newItems: T[], more: boolean) => {
    setItems((prev) => [...prev, ...newItems]);
    setHasMore(more);
    setIsLoadingMore(false);
  }, []);

  const state: PaginationState<T> = useMemo(() => ({
    items,
    page,
    pageSize,
    hasMore,
    isLoadingMore,
    totalCount,
  }), [items, page, pageSize, hasMore, isLoadingMore, totalCount]);

  const actions: PaginationActions = useMemo(() => ({
    loadMore,
    reset,
    setItems: setItemsAction,
    appendItems,
  }), [loadMore, reset, setItemsAction, appendItems]);

  return [state, actions];
}

/**
 * Calculate if we should load more based on scroll position
 */
export function shouldLoadMore(
  distanceFromEnd: number,
  contentHeight: number,
  threshold: number = 0.8
): boolean {
  const triggerDistance = contentHeight * (1 - threshold);
  return distanceFromEnd < triggerDistance;
}

/**
 * Helper for FlatList onEndReached
 */
export function createOnEndReached(
  loadMore: () => void,
  hasMore: boolean,
  isLoadingMore: boolean
) {
  return () => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  };
}
