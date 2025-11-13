/**
 * Cache Status Indicator Component
 * 
 * Shows users when data is loaded from cache vs. fresh from server
 * Provides visual feedback about offline capabilities and data freshness
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface CacheIndicatorProps {
  isLoadingFromCache?: boolean;
  isOnline?: boolean;
  lastUpdated?: Date;
  onRefresh?: () => void;
  compact?: boolean;
}

export const CacheIndicator: React.FC<CacheIndicatorProps> = ({
  isLoadingFromCache = false,
  isOnline = true,
  lastUpdated,
  onRefresh,
  compact = false,
}) => {
  const opacity = React.useRef(new Animated.Value(1)).current;

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getStatusInfo = () => {
    if (isLoadingFromCache) {
      return {
        icon: 'phone-portrait-outline' as const,
        text: compact ? 'Cached' : 'Loaded from cache',
        color: '#EA580C',
        backgroundColor: '#FEF3C7',
      };
    } else if (!isOnline) {
      return {
        icon: 'wifi-outline' as const,
        text: compact ? 'Offline' : 'Offline mode',
        color: '#DC2626',
        backgroundColor: '#FEE2E2',
      };
    } else {
      return {
        icon: 'cloud-done-outline' as const,
        text: compact ? 'Live' : 'Live data',
        color: '#059669',
        backgroundColor: '#D1FAE5',
      };
    }
  };

  // Animate opacity when loading from cache
  React.useEffect(() => {
    if (isLoadingFromCache) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoadingFromCache, opacity]);

  const status = getStatusInfo();

  if (compact) {
    return (
      <Animated.View style={[styles.compactContainer, { opacity }]}>
        <View style={[styles.compactBadge, { backgroundColor: status.backgroundColor }]}>
          <Ionicons name={status.icon} size={12} color={status.color} />
          <Text 
            style={[styles.compactText, { color: status.color }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {status.text}
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={[styles.indicator, { backgroundColor: status.backgroundColor }]}>
        <View style={styles.statusRow}>
          <Ionicons name={status.icon} size={16} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.text}
          </Text>
          {lastUpdated && (
            <Text style={styles.timeText}>
              • {formatTimeAgo(lastUpdated)}
            </Text>
          )}
        </View>
        
        {onRefresh && (
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={onRefresh}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh" size={16} color={status.color} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  compactContainer: {
    alignSelf: 'flex-start',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    maxWidth: 80,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  compactText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  timeText: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  refreshButton: {
    padding: 4,
  },
});
