// service-monitoring.tsx
// Superadmin dashboard for external service monitoring
// Docs: https://reactnative.dev/docs/0.79/getting-started
//       https://docs.expo.dev/router/introduction/
//       https://tanstack.com/query/v5/docs/framework/react/overview

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useServiceHealthSummary } from "@/hooks/superadmin/useServiceHealthData";
import { ServiceStatusGrid } from "@/components/superadmin/ServiceStatusGrid";
import type { ServiceHealth } from "@/hooks/superadmin/useServiceHealthData";

export default function ServiceMonitoringScreen() {
  const { data: services, summary, isLoading, refetch, isRefetching } = useServiceHealthSummary();
  const [selectedService, setSelectedService] = useState<ServiceHealth | null>(null);

  const handleServicePress = (service: ServiceHealth) => {
    setSelectedService(service);
    // TODO: Open detail modal
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading service status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={["#3b82f6"]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Service Monitoring</Text>
          <Text style={styles.subtitle}>
            Real-time health status of all external services
          </Text>
        </View>

        {/* Summary Stats */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>Total Services</Text>
          </View>

          <View style={[styles.summaryCard, styles.healthyCard]}>
            <Text style={[styles.summaryValue, styles.healthyText]}>
              {summary.healthy}
            </Text>
            <Text style={styles.summaryLabel}>Healthy</Text>
          </View>

          <View style={[styles.summaryCard, styles.degradedCard]}>
            <Text style={[styles.summaryValue, styles.degradedText]}>
              {summary.degraded}
            </Text>
            <Text style={styles.summaryLabel}>Degraded</Text>
          </View>

          <View style={[styles.summaryCard, styles.downCard]}>
            <Text style={[styles.summaryValue, styles.downText]}>
              {summary.down}
            </Text>
            <Text style={styles.summaryLabel}>Down</Text>
          </View>
        </View>

        {/* Service Grid */}
        <View style={styles.gridContainer}>
          <Text style={styles.sectionTitle}>Service Status</Text>
          {services && services.length > 0 ? (
            <ServiceStatusGrid
              services={services}
              onServicePress={handleServicePress}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No services found. Run health checks to populate data.
              </Text>
            </View>
          )}
        </View>

        {/* Cost Overview Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Costs</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              💰 Cost aggregation will be available once the cost-aggregator Edge Function is deployed.
            </Text>
          </View>
        </View>

        {/* API Keys Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Keys Status</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              🔑 API key monitoring will be available once keys are configured in the database.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    padding: 20,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  summaryContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  healthyCard: {
    borderTopWidth: 3,
    borderTopColor: "#10b981",
  },
  degradedCard: {
    borderTopWidth: 3,
    borderTopColor: "#f59e0b",
  },
  downCard: {
    borderTopWidth: 3,
    borderTopColor: "#ef4444",
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  healthyText: {
    color: "#10b981",
  },
  degradedText: {
    color: "#f59e0b",
  },
  downText: {
    color: "#ef4444",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  gridContainer: {
    padding: 16,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  placeholderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  placeholderText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
});
