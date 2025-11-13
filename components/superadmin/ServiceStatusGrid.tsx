// ServiceStatusGrid.tsx
// Grid of service health status cards with color-coded indicators
// Docs: https://reactnative.dev/docs/0.79/getting-started
//       https://shopify.github.io/flash-list/docs/

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import type { ServiceHealth } from "../hooks/useServiceHealthData";

interface ServiceStatusGridProps {
  services: ServiceHealth[];
  onServicePress: (service: ServiceHealth) => void;
}

const STATUS_COLORS = {
  healthy: "#10b981",
  degraded: "#f59e0b",
  down: "#ef4444",
  maintenance: "#3b82f6",
  unknown: "#6b7280",
};

const CATEGORY_ICONS: Record<string, string> = {
  infrastructure: "🏗️",
  ai: "🤖",
  voice: "🎤",
  payment: "💳",
  communication: "💬",
  monitoring: "📊",
  development: "🛠️",
};

export function ServiceStatusGrid({
  services,
  onServicePress,
}: ServiceStatusGridProps) {
  const renderServiceCard = ({ item }: { item: ServiceHealth }) => {
    const statusColor = STATUS_COLORS[item.status];
    const categoryIcon = CATEGORY_ICONS[item.service_category] || "📦";
    const lastChecked = new Date(item.last_checked_at);
    const minutesAgo = Math.floor(
      (Date.now() - lastChecked.getTime()) / 60000
    );

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: statusColor }]}
        onPress={() => onServicePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.categoryIcon}>{categoryIcon}</Text>
          <View
            style={[styles.statusIndicator, { backgroundColor: statusColor }]}
          />
        </View>

        <Text style={styles.serviceName} numberOfLines={2}>
          {item.service_name}
        </Text>

        {item.response_time_ms !== null && (
          <Text style={styles.responseTime}>
            {item.response_time_ms < 1000
              ? `${item.response_time_ms}ms`
              : `${(item.response_time_ms / 1000).toFixed(1)}s`}
          </Text>
        )}

        <Text style={styles.lastChecked}>
          {minutesAgo === 0 ? "Just now" : `${minutesAgo}m ago`}
        </Text>

        {item.consecutive_failures > 0 && (
          <View style={styles.failureBadge}>
            <Text style={styles.failureText}>
              {item.consecutive_failures} failures
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlashList
        data={services}
        renderItem={renderServiceCard}
        estimatedItemSize={140}
        numColumns={3}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 400,
  },
  listContent: {
    padding: 8,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    margin: 4,
    borderLeftWidth: 4,
    minHeight: 130,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryIcon: {
    fontSize: 24,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
    minHeight: 36,
  },
  responseTime: {
    fontSize: 20,
    fontWeight: "700",
    color: "#059669",
    marginBottom: 4,
  },
  lastChecked: {
    fontSize: 11,
    color: "#6b7280",
  },
  failureBadge: {
    marginTop: 4,
    backgroundColor: "#fef2f2",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  failureText: {
    fontSize: 10,
    color: "#dc2626",
    fontWeight: "500",
  },
});
