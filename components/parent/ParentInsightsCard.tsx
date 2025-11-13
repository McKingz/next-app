import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProactiveInsight } from '@/services/ProactiveInsightsService';

interface ParentInsightsCardProps {
  insight: ProactiveInsight;
  onActionPress?: (actionTitle: string) => void;
}

export function ParentInsightsCard({ insight, onActionPress }: ParentInsightsCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getIconName = () => {
    switch (insight.type) {
      case 'celebration':
        return 'trophy';
      case 'concern':
        return 'alert-circle';
      case 'prediction':
        return 'trending-up';
      case 'suggestion':
        return 'bulb';
      default:
        return 'information-circle';
    }
  };

  const getIconColor = () => {
    switch (insight.priority) {
      case 'high':
        return '#ff6b6b';
      case 'medium':
        return '#ffd93d';
      case 'low':
        return '#00f5ff';
      default:
        return '#9CA3AF';
    }
  };

  const getBorderColor = () => {
    switch (insight.type) {
      case 'celebration':
        return '#4ade80';
      case 'concern':
        return '#ff6b6b';
      case 'prediction':
        return '#fbbf24';
      case 'suggestion':
        return '#00f5ff';
      default:
        return '#2a3442';
    }
  };

  return (
    <View style={[styles.card, { borderLeftColor: getBorderColor() }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={getIconName() as any} size={24} color={getIconColor()} />
        </View>

        <View style={styles.headerContent}>
          <Text style={styles.title}>{insight.title}</Text>
          <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
            {insight.description}
          </Text>
        </View>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#9CA3AF"
        />
      </TouchableOpacity>

      {expanded && insight.action_items && insight.action_items.length > 0 && (
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>What you can do:</Text>
          {insight.action_items.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionItem}
              onPress={() => onActionPress?.(action.title)}
              activeOpacity={0.7}
            >
              <View style={styles.actionBullet} />
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {expanded && insight.caps_topics && insight.caps_topics.length > 0 && (
        <View style={styles.tagsContainer}>
          {insight.caps_topics.map((topic, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{topic}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a2332',
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a3442',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00f5ff',
    marginBottom: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1824',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00f5ff',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  tag: {
    backgroundColor: '#2a3442',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#00f5ff',
    fontWeight: '500',
  },
});
