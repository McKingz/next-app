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

interface ModerationItem {
  id: string;
  type: 'lesson' | 'homework' | 'message' | 'comment' | 'announcement';
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_email: string;
  school_id: string;
  school_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  flags: string[];
  report_count: number;
  created_at: string;
  flagged_at: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  auto_flagged: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
}

interface ModerationFilters {
  type: 'all' | 'lesson' | 'homework' | 'message' | 'comment' | 'announcement';
  status: 'all' | 'pending' | 'approved' | 'rejected' | 'flagged';
  severity: 'all' | 'low' | 'medium' | 'high' | 'critical';
  school: string;
}

export default function SuperAdminModerationScreen() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moderationItems, setModerationItems] = useState<ModerationItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ModerationItem[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [filters, setFilters] = useState<ModerationFilters>({
    type: 'all',
    status: 'pending',
    severity: 'all',
    school: '',
  });

  const fetchModerationItems = useCallback(async () => {
    if (!isSuperAdmin(profile?.role)) {
      Alert.alert('Access Denied', 'Super admin privileges required');
      return;
    }

    try {
      setLoading(true);

      // Fetch real moderation items from the database
      const { data: moderationData, error: moderationError } = await assertSupabase()
        .rpc('get_moderation_items', {
          p_status: filters.status === 'all' ? null : filters.status,
          p_severity: filters.severity === 'all' ? null : filters.severity,
          p_content_type: filters.type === 'all' ? null : filters.type,
          p_limit: 100
        });

      if (moderationError) {
        console.error('Moderation items fetch error:', moderationError);
        throw new Error('Failed to fetch moderation items');
      }

      if (moderationData) {
        // Transform the data to match our interface
        const items: ModerationItem[] = moderationData.map((item: any) => ({
          id: item.id,
          type: item.content_type,
          title: item.title,
          content: item.content,
          author_id: item.author_id,
          author_name: item.author_name,
          author_email: item.author_email,
          school_id: item.school_id,
          school_name: item.school_name,
          status: item.status,
          flags: item.flags || [],
          report_count: item.report_count || 0,
          created_at: item.created_at,
          flagged_at: item.flagged_at,
          severity: item.severity,
          auto_flagged: item.auto_flagged || false,
          reviewed_by: item.reviewed_by,
          reviewed_at: item.reviewed_at,
          review_notes: item.review_notes,
        }));

        setModerationItems(items);
        console.log(`Loaded ${items.length} moderation items from database`);
      } else {
        setModerationItems([]);
        console.log('No moderation items found in database');
      }

    } catch (error) {
      console.error('Failed to fetch moderation items:', error);
      Alert.alert('Error', 'Failed to load moderation items');
      // Set empty array on error to avoid crash
      setModerationItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.role, filters.status, filters.severity, filters.type]);

  useEffect(() => {
    fetchModerationItems();
  }, [fetchModerationItems]);

  useEffect(() => {
    let filtered = moderationItems;

    // Filter by type
    if (filters.type !== 'all') {
      filtered = filtered.filter(item => item.type === filters.type);
    }

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item.status === filters.status);
    }

    // Filter by severity
    if (filters.severity !== 'all') {
      filtered = filtered.filter(item => item.severity === filters.severity);
    }

    // Filter by school
    if (filters.school) {
      filtered = filtered.filter(item => 
        item.school_name.toLowerCase().includes(filters.school.toLowerCase())
      );
    }

    // Sort by severity and date
    filtered.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.flagged_at).getTime() - new Date(a.flagged_at).getTime();
    });

    setFilteredItems(filtered);
  }, [moderationItems, filters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchModerationItems();
    setRefreshing(false);
  }, [fetchModerationItems]);

  const moderateItem = async (item: ModerationItem, action: 'approve' | 'reject' | 'flag') => {
    if (!reviewNotes && action === 'reject') {
      Alert.alert('Review Notes Required', 'Please provide review notes for rejected content');
      return;
    }

    try {
      setProcessing(true);

      // Use the real moderation RPC function
      const { data: moderationResult, error: moderationError } = await assertSupabase()
        .rpc('moderate_content', {
          p_queue_item_id: item.id,
          p_action: action,
          p_notes: reviewNotes || `Content ${action}ed by super admin`
        });

      if (moderationError) {
        console.error('Moderation RPC error:', moderationError);
        throw new Error('Failed to moderate content');
      }

      if (moderationResult?.error) {
        throw new Error(moderationResult.error);
      }

      // Update local state
      const updatedItem: ModerationItem = {
        ...item,
        status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'flagged',
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || `Content ${action}ed by super admin`,
      };

      setModerationItems(prev => prev.map(i => 
        i.id === item.id ? updatedItem : i
      ));

      // Track the moderation action
      track('superadmin_content_moderated', {
        content_id: item.id,
        content_type: item.type,
        action: action,
        severity: item.severity,
        school_id: item.school_id,
        author_id: item.author_id,
      });

      Alert.alert(
        'Success',
        `Content ${action}ed successfully. ${action === 'reject' ? 'Author has been notified.' : ''}`
      );

      setShowDetailModal(false);
      setSelectedItem(null);
      setReviewNotes('');

      // Refresh the moderation queue to get latest data
      await fetchModerationItems();

    } catch (error) {
      console.error('Failed to moderate content:', error);
      Alert.alert('Error', 'Failed to moderate content');
    } finally {
      setProcessing(false);
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#d97706';
      case 'low':
        return '#16a34a';
      default:
        return '#6b7280';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved':
        return '#16a34a';
      case 'rejected':
        return '#dc2626';
      case 'flagged':
        return '#ea580c';
      case 'pending':
        return '#d97706';
      default:
        return '#6b7280';
    }
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'lesson':
        return 'book';
      case 'homework':
        return 'document-text';
      case 'message':
        return 'mail';
      case 'comment':
        return 'chatbubble';
      case 'announcement':
        return 'megaphone';
      default:
        return 'document';
    }
  };

  if (!profile || (!isSuperAdmin(profile.role))) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Content Moderation', headerShown: false }} />
        <StatusBar style="light" />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Content Moderation', headerShown: false }} />
      <StatusBar style="light" />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#00f5ff" />
          </TouchableOpacity>
          <Text style={styles.title}>Content Moderation</Text>
          <View style={styles.placeholder} />
        </View>
        
        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            {filteredItems.length} items • {filteredItems.filter(i => i.status === 'pending').length} pending review
          </Text>
        </View>
      </SafeAreaView>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
          {(['all', 'pending', 'flagged', 'approved', 'rejected'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterTab, filters.status === status && styles.filterTabActive]}
              onPress={() => setFilters(prev => ({ ...prev, status }))}
            >
              <Text style={[styles.filterTabText, filters.status === status && styles.filterTabTextActive]}>
                {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
          {(['all', 'lesson', 'homework', 'message', 'comment', 'announcement'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.filterTab, filters.type === type && styles.filterTabActive]}
              onPress={() => setFilters(prev => ({ ...prev, type }))}
            >
              <Text style={[styles.filterTabText, filters.type === type && styles.filterTabTextActive]}>
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00f5ff" />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00f5ff" />
            <Text style={styles.loadingText}>Loading moderation queue...</Text>
          </View>
        ) : (
          <>
            {filteredItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                onPress={() => {
                  setSelectedItem(item);
                  setReviewNotes(item.review_notes || '');
                  setShowDetailModal(true);
                }}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <View style={styles.typeIcon}>
                      <Ionicons name={getTypeIcon(item.type) as any} size={20} color="#00f5ff" />
                    </View>
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.itemAuthor}>{item.author_name} • {item.school_name}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.itemMeta}>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) + '20', borderColor: getSeverityColor(item.severity) }]}>
                      <Text style={[styles.severityText, { color: getSeverityColor(item.severity) }]}>
                        {item.severity.toUpperCase()}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20', borderColor: getStatusColor(item.status) }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.itemContent} numberOfLines={2}>
                  {item.content}
                </Text>

                <View style={styles.itemFooter}>
                  <View style={styles.itemFlags}>
                    {item.flags.slice(0, 2).map((flag, index) => (
                      <View key={index} style={styles.flagChip}>
                        <Text style={styles.flagChipText}>{flag.replace('_', ' ')}</Text>
                      </View>
                    ))}
                    {item.flags.length > 2 && (
                      <View style={styles.flagChip}>
                        <Text style={styles.flagChipText}>+{item.flags.length - 2} more</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.itemStats}>
                    {item.report_count > 0 && (
                      <Text style={styles.reportCount}>
                        <Ionicons name="flag" size={12} color="#ef4444" /> {item.report_count}
                      </Text>
                    )}
                    <Text style={styles.itemDate}>
                      {new Date(item.flagged_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {filteredItems.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="shield-checkmark" size={48} color="#6b7280" />
                <Text style={styles.emptyText}>No items to moderate</Text>
                <Text style={styles.emptySubText}>All content is currently clean</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowDetailModal(false);
          setSelectedItem(null);
          setReviewNotes('');
        }}
      >
        {selectedItem && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                setShowDetailModal(false);
                setSelectedItem(null);
                setReviewNotes('');
              }}>
                <Ionicons name="close" size={24} color="#00f5ff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Content Review</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Content Details</Text>
                
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Type</Text>
                  <Text style={styles.modalInfoValue}>{selectedItem.type}</Text>
                </View>
                
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Title</Text>
                  <Text style={styles.modalInfoValue}>{selectedItem.title}</Text>
                </View>
                
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Author</Text>
                  <Text style={styles.modalInfoValue}>{selectedItem.author_name}</Text>
                </View>
                
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>School</Text>
                  <Text style={styles.modalInfoValue}>{selectedItem.school_name}</Text>
                </View>
                
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedItem.status) + '20', borderColor: getStatusColor(selectedItem.status) }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(selectedItem.status) }]}>
                      {selectedItem.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Severity</Text>
                  <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(selectedItem.severity) + '20', borderColor: getSeverityColor(selectedItem.severity) }]}>
                    <Text style={[styles.severityText, { color: getSeverityColor(selectedItem.severity) }]}>
                      {selectedItem.severity.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Content</Text>
                <Text style={styles.contentText}>{selectedItem.content}</Text>
              </View>

              {selectedItem.flags.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Flags</Text>
                  <View style={styles.flagsList}>
                    {selectedItem.flags.map((flag, index) => (
                      <View key={index} style={styles.flagItem}>
                        <Text style={styles.flagItemText}>{flag.replace('_', ' ')}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Review Notes</Text>
                <TextInput
                  style={styles.reviewNotesInput}
                  value={reviewNotes}
                  onChangeText={setReviewNotes}
                  placeholder="Add your review notes here..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={4}
                />
              </View>

              {selectedItem.reviewed_by && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Previous Review</Text>
                  <Text style={styles.previousReview}>
                    Reviewed on {new Date(selectedItem.reviewed_at!).toLocaleDateString()}
                  </Text>
                  <Text style={styles.previousReviewNotes}>
                    {selectedItem.review_notes}
                  </Text>
                </View>
              )}
            </ScrollView>

            {selectedItem.status === 'pending' && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.approveButton]}
                  onPress={() => moderateItem(selectedItem, 'approve')}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#16a34a" />
                  ) : (
                    <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                  )}
                  <Text style={[styles.modalActionText, { color: '#16a34a' }]}>Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionButton, styles.rejectButton]}
                  onPress={() => moderateItem(selectedItem, 'reject')}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <Ionicons name="close-circle" size={20} color="#dc2626" />
                  )}
                  <Text style={[styles.modalActionText, { color: '#dc2626' }]}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        )}
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
    backgroundColor: '#0b1220',
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
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  statsContainer: {
    paddingBottom: 16,
  },
  statsText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  filtersContainer: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  filterTabs: {
    marginBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#374151',
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#00f5ff',
  },
  filterTabText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#0b1220',
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
  itemCard: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemAuthor: {
    color: '#9ca3af',
    fontSize: 14,
  },
  itemMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemContent: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemFlags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  flagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  flagChipText: {
    color: '#9ca3af',
    fontSize: 10,
    textTransform: 'capitalize',
  },
  itemStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportCount: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
  itemDate: {
    color: '#6b7280',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
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
  modalContent: {
    flex: 1,
    backgroundColor: '#111827',
  },
  modalSection: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  modalSectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalInfoLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  modalInfoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  contentText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
  flagsList: {
    gap: 8,
  },
  flagItem: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  flagItemText: {
    color: '#ffffff',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  reviewNotesInput: {
    backgroundColor: '#374151',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  previousReview: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 8,
  },
  previousReviewNotes: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  approveButton: {
    borderColor: '#16a34a',
  },
  rejectButton: {
    borderColor: '#dc2626',
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});