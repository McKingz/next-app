import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  Linking,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin } from '@/lib/roleUtils';

interface WhatsAppConnection {
  id: string;
  school_id: string;
  school_name: string;
  phone_number: string;
  business_account_id?: string;
  status: 'connected' | 'pending' | 'disconnected' | 'error';
  last_sync: string;
  message_count: number;
  webhook_verified: boolean;
  api_key?: string;
  created_at: string;
  updated_at: string;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'marketing' | 'utility' | 'authentication';
  language: string;
  status: 'approved' | 'pending' | 'rejected';
  components: any[];
  created_at: string;
}

interface WhatsAppMetrics {
  total_connections: number;
  active_connections: number;
  messages_sent_today: number;
  messages_sent_month: number;
  delivery_rate: number;
  read_rate: number;
  response_rate: number;
  failed_messages: number;
}

export default function SuperAdminWhatsAppScreen() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [metrics, setMetrics] = useState<WhatsAppMetrics | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  // Configuration form state
  const [configData, setConfigData] = useState({
    webhook_url: '',
    verify_token: '',
    app_id: '',
    app_secret: '',
    business_account_id: '',
    phone_number_id: '',
    access_token: '',
  });

  const fetchWhatsAppData = useCallback(async () => {
    if (!isSuperAdmin(profile?.role)) {
      Alert.alert('Access Denied', 'Super admin privileges required');
      return;
    }

    try {
      setLoading(true);
      
      // Mock WhatsApp connections data
      const mockConnections: WhatsAppConnection[] = [
        {
          id: '1',
          school_id: 'school_1',
          school_name: 'Bright Minds Preschool',
          phone_number: '+27123456789',
          business_account_id: 'ba_123456789',
          status: 'connected',
          last_sync: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          message_count: 1247,
          webhook_verified: true,
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        },
        {
          id: '2',
          school_id: 'school_2',
          school_name: 'Little Learners Academy',
          phone_number: '+27987654321',
          business_account_id: 'ba_987654321',
          status: 'pending',
          last_sync: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          message_count: 0,
          webhook_verified: false,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
      ];

      // Mock templates data
      const mockTemplates: WhatsAppTemplate[] = [
        {
          id: 't_1',
          name: 'welcome_message',
          category: 'utility',
          language: 'en',
          status: 'approved',
          components: [],
          created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 't_2',
          name: 'payment_reminder',
          category: 'utility',
          language: 'en',
          status: 'approved',
          components: [],
          created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 't_3',
          name: 'event_notification',
          category: 'marketing',
          language: 'en',
          status: 'pending',
          components: [],
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      // Mock metrics data
      const mockMetrics: WhatsAppMetrics = {
        total_connections: mockConnections.length,
        active_connections: mockConnections.filter(c => c.status === 'connected').length,
        messages_sent_today: 89,
        messages_sent_month: 2341,
        delivery_rate: 97.2,
        read_rate: 82.5,
        response_rate: 34.8,
        failed_messages: 12,
      };

      setConnections(mockConnections);
      setTemplates(mockTemplates);
      setMetrics(mockMetrics);

    } catch (error) {
      console.error('Failed to fetch WhatsApp data:', error);
      Alert.alert('Error', 'Failed to load WhatsApp data');
    } finally {
      setLoading(false);
    }
  }, [profile?.role]);

  useEffect(() => {
    fetchWhatsAppData();
  }, [fetchWhatsAppData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWhatsAppData();
    setRefreshing(false);
  }, [fetchWhatsAppData]);

  const handleConfigureBusiness = () => {
    Alert.alert(
      'WhatsApp Business Setup',
      'To integrate WhatsApp Business API, you need to:\n\n1. Create a WhatsApp Business Account\n2. Set up a Facebook App\n3. Configure webhooks\n4. Get verification tokens\n\nWould you like to open the Facebook Developer portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Portal',
          onPress: () => {
            Linking.openURL('https://developers.facebook.com/');
            track('superadmin_whatsapp_business_setup_opened');
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'disconnected': return '#6b7280';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'connected': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'disconnected': return 'close-circle';
      case 'error': return 'warning';
      default: return 'help-circle';
    }
  };

  const handleSendTestMessage = (connection: WhatsAppConnection) => {
    Alert.alert(
      'Send Test Message',
      `Send a test message to ${connection.school_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            track('superadmin_whatsapp_test_message_sent', {
              school_id: connection.school_id,
              phone_number: connection.phone_number,
            });
            Alert.alert('Success', 'Test message sent successfully!');
          }
        }
      ]
    );
  };

  if (!profile || !isSuperAdmin(profile.role)) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'WhatsApp Hub', headerShown: false }} />
        <StatusBar style="light" />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'WhatsApp Hub', headerShown: false }} />
      <StatusBar style="light" />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#25d366" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="logo-whatsapp" size={28} color="#25d366" />
            <Text style={styles.title}>WhatsApp Hub</Text>
          </View>
          <TouchableOpacity 
            style={styles.configButton}
            onPress={() => setShowConfigModal(true)}
          >
            <Ionicons name="settings" size={24} color="#25d366" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#25d366" />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#25d366" />
            <Text style={styles.loadingText}>Loading WhatsApp data...</Text>
          </View>
        ) : (
          <>
            {/* Metrics Overview */}
            {metrics && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>WhatsApp Business Metrics</Text>
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{metrics.total_connections}</Text>
                    <Text style={styles.metricLabel}>Total Connections</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{metrics.active_connections}</Text>
                    <Text style={styles.metricLabel}>Active</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{metrics.messages_sent_today}</Text>
                    <Text style={styles.metricLabel}>Messages Today</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{metrics.delivery_rate}%</Text>
                    <Text style={styles.metricLabel}>Delivery Rate</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{metrics.messages_sent_month}</Text>
                    <Text style={styles.metricLabel}>Monthly Messages</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{metrics.read_rate}%</Text>
                    <Text style={styles.metricLabel}>Read Rate</Text>
                  </View>
                </View>
              </View>
            )}

            {/* School Connections */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>School Connections</Text>
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={handleConfigureBusiness}
                >
                  <Ionicons name="add" size={20} color="#25d366" />
                  <Text style={styles.addButtonText}>Connect</Text>
                </TouchableOpacity>
              </View>
              
              {connections.map((connection) => (
                <View key={connection.id} style={styles.connectionCard}>
                  <View style={styles.connectionHeader}>
                    <View style={styles.connectionInfo}>
                      <Text style={styles.connectionName}>{connection.school_name}</Text>
                      <Text style={styles.connectionPhone}>{connection.phone_number}</Text>
                    </View>
                    
                    <View style={styles.connectionMeta}>
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: getStatusColor(connection.status) + '20', borderColor: getStatusColor(connection.status) }
                      ]}>
                        <Ionicons 
                          name={getStatusIcon(connection.status) as any} 
                          size={12} 
                          color={getStatusColor(connection.status)} 
                        />
                        <Text style={[styles.statusText, { color: getStatusColor(connection.status) }]}>
                          {connection.status.charAt(0).toUpperCase() + connection.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.connectionStats}>
                    <Text style={styles.statItem}>
                      <Ionicons name="chatbubble" size={12} color="#6b7280" /> {connection.message_count} messages
                    </Text>
                    <Text style={styles.statItem}>
                      <Ionicons name="time" size={12} color="#6b7280" /> {new Date(connection.last_sync).toLocaleDateString()}
                    </Text>
                    {connection.webhook_verified && (
                      <Text style={styles.statItem}>
                        <Ionicons name="shield-checkmark" size={12} color="#10b981" /> Verified
                      </Text>
                    )}
                  </View>

                  <View style={styles.connectionActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleSendTestMessage(connection)}
                    >
                      <Ionicons name="send" size={16} color="#25d366" />
                      <Text style={styles.actionButtonText}>Test Message</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.actionButton}>
                      <Ionicons name="stats-chart" size={16} color="#6b7280" />
                      <Text style={[styles.actionButtonText, { color: '#6b7280' }]}>Analytics</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              
              {connections.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="logo-whatsapp" size={48} color="#6b7280" />
                  <Text style={styles.emptyText}>No WhatsApp connections</Text>
                  <Text style={styles.emptySubText}>Connect schools to WhatsApp Business API</Text>
                  <TouchableOpacity 
                    style={styles.setupButton}
                    onPress={handleConfigureBusiness}
                  >
                    <Text style={styles.setupButtonText}>Setup WhatsApp Business</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Message Templates */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Message Templates</Text>
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={() => setShowTemplateModal(true)}
                >
                  <Ionicons name="add" size={20} color="#25d366" />
                  <Text style={styles.addButtonText}>Template</Text>
                </TouchableOpacity>
              </View>
              
              {templates.map((template) => (
                <View key={template.id} style={styles.templateCard}>
                  <View style={styles.templateHeader}>
                    <Text style={styles.templateName}>{template.name.replace(/_/g, ' ').toUpperCase()}</Text>
                    <View style={[
                      styles.templateStatus,
                      { 
                        backgroundColor: template.status === 'approved' ? '#10b98120' : 
                                       template.status === 'pending' ? '#f59e0b20' : '#ef444420',
                        borderColor: template.status === 'approved' ? '#10b981' : 
                                   template.status === 'pending' ? '#f59e0b' : '#ef4444'
                      }
                    ]}>
                      <Text style={[
                        styles.templateStatusText,
                        { 
                          color: template.status === 'approved' ? '#10b981' : 
                                template.status === 'pending' ? '#f59e0b' : '#ef4444'
                        }
                      ]}>
                        {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.templateMeta}>
                    {template.category.charAt(0).toUpperCase() + template.category.slice(1)} • {template.language.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Configuration Modal */}
      <Modal
        visible={showConfigModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowConfigModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowConfigModal(false)}>
              <Ionicons name="close" size={24} color="#25d366" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>WhatsApp Configuration</Text>
            <TouchableOpacity>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.configNote}>
              Configure your WhatsApp Business API settings. These settings will be applied globally for all school connections.
            </Text>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Webhook URL</Text>
              <TextInput
                style={styles.formInput}
                value={configData.webhook_url}
                onChangeText={(text) => setConfigData(prev => ({ ...prev, webhook_url: text }))}
                placeholder="https://your-domain.com/webhook"
                placeholderTextColor="#6b7280"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Verify Token</Text>
              <TextInput
                style={styles.formInput}
                value={configData.verify_token}
                onChangeText={(text) => setConfigData(prev => ({ ...prev, verify_token: text }))}
                placeholder="Your webhook verify token"
                placeholderTextColor="#6b7280"
                secureTextEntry
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Facebook App ID</Text>
              <TextInput
                style={styles.formInput}
                value={configData.app_id}
                onChangeText={(text) => setConfigData(prev => ({ ...prev, app_id: text }))}
                placeholder="Your Facebook App ID"
                placeholderTextColor="#6b7280"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>App Secret</Text>
              <TextInput
                style={styles.formInput}
                value={configData.app_secret}
                onChangeText={(text) => setConfigData(prev => ({ ...prev, app_secret: text }))}
                placeholder="Your Facebook App Secret"
                placeholderTextColor="#6b7280"
                secureTextEntry
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  deniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deniedText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#0b1220',
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  configButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25d36620',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#25d366',
    gap: 4,
  },
  addButtonText: {
    color: '#25d366',
    fontSize: 14,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricValue: {
    color: '#25d366',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricLabel: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
  },
  connectionCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  connectionPhone: {
    color: '#9ca3af',
    fontSize: 14,
  },
  connectionMeta: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  connectionStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    color: '#6b7280',
    fontSize: 12,
  },
  connectionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: '#25d366',
    fontSize: 12,
    fontWeight: '600',
  },
  templateCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  templateStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  templateStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  templateMeta: {
    color: '#9ca3af',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 24,
  },
  setupButton: {
    backgroundColor: '#25d366',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  setupButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    color: '#25d366',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 16,
  },
  configNote: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
  },
});