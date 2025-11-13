import React, { useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useAuth } from '@/contexts/AuthContext';
import { useAgeGroup } from '@/lib/hooks/useAgeGroup';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlags';
import { DashboardRegistry } from './registry/DashboardRegistry';
import { DASHBOARD_CARDS } from './cards';
import type { OrganizationType } from '@/lib/types/organization';

interface DashboardRouterProps {
  /** Hub type to render (learner, guardian, instructor, admin, financial) */
  hubType: 'learner' | 'guardian' | 'instructor' | 'admin' | 'financial';
  /** Optional organization type override (defaults to user's org) */
  organizationType?: OrganizationType;
  /** Enable debug mode to show widget metadata */
  debug?: boolean;
}

/**
 * DashboardRouter dynamically renders dashboard widgets based on:
 * - User role and hub type
 * - Organization type
 * - User age group (child/teen/adult)
 * - Feature flags (environment + database)
 * 
 * @example
 * ```tsx
 * <DashboardRouter hubType="learner" />
 * ```
 */
export function DashboardRouter({
  hubType,
  organizationType,
  debug = false,
}: DashboardRouterProps) {
  const { profile } = useAuth();
  const { data: ageData, isLoading: ageLoading } = useAgeGroup(profile?.id);
  const { data: featureFlags, isLoading: flagsLoading } = useFeatureFlags();

  const isLoading = ageLoading || flagsLoading;

  // Determine effective organization type
  const effectiveOrgType = organizationType || profile?.preschool?.organization_type || 'preschool';

  // Get applicable widgets from registry
  const applicableWidgets = useMemo(() => {
    if (!profile || !ageData || !featureFlags) return [];

    const widgets = DashboardRegistry.getWidgetsForHub(
      hubType,
      effectiveOrgType as OrganizationType,
      ageData.ageGroup
    );

    // Filter by feature flags
    return widgets.filter(widget => {
      // If no feature key, always show
      if (!widget.featureKey) return true;
      
      // Check if feature is enabled
      return featureFlags[widget.featureKey] === true;
    });
  }, [profile, ageData, featureFlags, hubType, effectiveOrgType]);

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // Render empty state
  if (applicableWidgets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No dashboard widgets available</Text>
        {debug && (
          <Text style={styles.debugText}>
            Hub: {hubType} | Org: {effectiveOrgType} | Age: {ageData?.ageGroup}
          </Text>
        )}
      </View>
    );
  }

  // Render widgets
  return (
    <View style={styles.container}>
      <FlashList
        data={applicableWidgets}
        renderItem={({ item }) => {
          const WidgetComponent = DASHBOARD_CARDS[item.component];
          
          if (!WidgetComponent) {
            console.warn(`Widget component not found: ${item.component}`);
            return null;
          }

          return (
            <View style={styles.widgetContainer}>
              <WidgetComponent />
              {debug && (
                <View style={styles.debugBadge}>
                  <Text style={styles.debugBadgeText}>
                    {item.name} | Order: {item.displayOrder} | Feature: {item.featureKey || 'none'}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
        estimatedItemSize={200}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  widgetContainer: {
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  debugText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  debugBadge: {
    marginTop: 4,
    padding: 4,
    backgroundColor: '#ffeb3b',
    borderRadius: 4,
  },
  debugBadgeText: {
    fontSize: 10,
    color: '#000',
    fontFamily: 'monospace',
  },
});
