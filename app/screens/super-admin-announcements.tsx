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
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin } from '@/lib/roleUtils';
import { useTheme } from '@/contexts/ThemeContext';

interface PlatformAnnouncement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'alert' | 'maintenance' | 'feature';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  target_audience: 'all' | 'principals' | 'teachers' | 'parents' | 'specific_schools';
  target_schools: string[];
  is_active: boolean;
  is_pinned: boolean;
  show_banner: boolean;
  scheduled_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  views_count: number;
  click_count: number;
}

interface AnnouncementForm {
  title: string;
  content: string;
  type: 'info' | 'warning' | 'alert' | 'maintenance' | 'feature';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  target_audience: 'all' | 'principals' | 'teachers' | 'parents' | 'specific_schools';
  target_schools: string[];
  is_active: boolean;
  is_pinned: boolean;
  show_banner: boolean;
  scheduled_at?: string;
  expires_at?: string;
}

export default function SuperAdminAnnouncementsScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<PlatformAnnouncement | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<AnnouncementForm>({
    title: '',
    content: '',
    type: 'info',
    priority: 'medium',
    target_audience: 'all',
    target_schools: [],
    is_active: true,
    is_pinned: false,
    show_banner: false,
  });

  const announcementTypes = ['info', 'warning', 'alert', 'maintenance', 'feature'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const audiences = ['all', 'principals', 'teachers', 'parents', 'specific_schools'];

  const fetchAnnouncements = useCallback(async () => {
    if (!isSuperAdmin(profile?.role)) {
      Alert.alert('Access Denied', 'Super admin privileges required');
      return;
    }

    try {
      setLoading(true);

      // Mock data for platform-wide announcements
      const mockAnnouncements: PlatformAnnouncement[] = [
        {
          id: '1',
          title: 'New AI Features Available',
          content: 'We\'ve just released new AI-powered features including enhanced lesson generation and automated grading. All schools now have access to these tools.',
          type: 'feature',
          priority: 'high',
          target_audience: 'all',
          target_schools: [],
          is_active: true,
          is_pinned: true,
          show_banner: true,
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: profile?.id || 'system',
          views_count: 1247,
          click_count: 89,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '2',
          title: 'Scheduled Maintenance Window',
          content: 'The platform will undergo scheduled maintenance on Sunday, December 17th from 2:00 AM to 6:00 AM UTC. During this time, some features may be temporarily unavailable.',
          type: 'maintenance',
          priority: 'urgent',
          target_audience: 'all',
          target_schools: [],
          is_active: true,
          is_pinned: false,
          show_banner: true,
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: profile?.id || 'system',
          views_count: 892,
          click_count: 23,
          scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '3',
          title: 'Security Update Required',
          content: 'All users are required to update their passwords within the next 30 days as part of our enhanced security measures.',
          type: 'alert',
          priority: 'high',
          target_audience: 'all',
          target_schools: [],
          is_active: true,
          is_pinned: false,
          show_banner: false,
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: profile?.id || 'system',
          views_count: 2156,
          click_count: 445,
          expires_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '4',
          title: 'Holiday Greetings',
          content: 'Wishing all our schools and families a wonderful holiday season! Thank you for being part of the EduDash Pro community.',
          type: 'info',
          priority: 'low',
          target_audience: 'all',
          target_schools: [],
          is_active: false,
          is_pinned: false,
          show_banner: false,
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: profile?.id || 'system',
          views_count: 3421,
          click_count: 156,
          expires_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '5',
          title: 'Beta Testing Program',
          content: 'We\'re looking for select schools to participate in our beta testing program for upcoming features. Contact support if interested.',
          type: 'info',
          priority: 'medium',
          target_audience: 'principals',
          target_schools: [],
          is_active: true,
          is_pinned: false,
          show_banner: false,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: profile?.id || 'system',
          views_count: 234,
          click_count: 34,
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      setAnnouncements(mockAnnouncements);

      // Mock schools data (reserved for future use)
      // const mockSchools = [
      //   { id: 'school1', name: 'Bright Minds Preschool' },
      //   { id: 'school2', name: 'Little Learners Academy' },
      //   { id: 'school3', name: 'Sunny Days Nursery' },
      //   { id: 'school4', name: 'Creative Kids Center' },
      //   { id: 'school5', name: 'Happy Kids Preschool' },
      // ];

    } catch (error) {
      console.error('Failed to fetch announcements:', error);
      Alert.alert('Error', 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.id]);

  // Prefill/compose via route params from Dash
  const routeParams = useLocalSearchParams<{ compose?: string; prefillTitle?: string; prefillContent?: string; priority?: string; type?: string }>();

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    const compose = String(routeParams?.compose || '').toLowerCase();
    if (compose === '1' || compose === 'true') {
      const prefillTitle = (routeParams?.prefillTitle || '').toString();
      const prefillContent = (routeParams?.prefillContent || '').toString();
      const prefillPriority = (routeParams?.priority || '').toString();
      const prefillType = (routeParams?.type || '').toString();
      setFormData(prev => ({
        ...prev,
        title: prefillTitle || prev.title,
        content: prefillContent || prev.content,
        priority: (['low','medium','high','urgent'].includes(prefillPriority) ? prefillPriority : prev.priority) as any,
        type: (['info','warning','alert','maintenance','feature'].includes(prefillType) ? prefillType : prev.type) as any,
      }))
      setShowCreateModal(true);
    }
  }, [routeParams])

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnnouncements();
    setRefreshing(false);
  }, [fetchAnnouncements]);

  const createAnnouncement = async () => {
    if (!formData.title || !formData.content) {
      Alert.alert('Validation Error', 'Please fill in title and content');
      return;
    }

    try {
      setSaving(true);

      const newAnnouncement: PlatformAnnouncement = {
        id: Date.now().toString(),
        ...formData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: profile?.id || 'unknown',
        views_count: 0,
        click_count: 0,
      };

      setAnnouncements(prev => [newAnnouncement, ...prev]);

      // Track the creation
      track('superadmin_announcement_created', {
        announcement_type: formData.type,
        priority: formData.priority,
        target_audience: formData.target_audience,
        has_banner: formData.show_banner,
        is_pinned: formData.is_pinned,
      });

      // Log the action
      const { error: logError } = await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'platform_announcement_created',
          details: {
            announcement_title: formData.title,
            announcement_type: formData.type,
            priority: formData.priority,
            target_audience: formData.target_audience,
            is_active: formData.is_active,
          },
        });

      if (logError) {
        console.error('Failed to log announcement creation:', logError);
      }

      Alert.alert('Success', 'Announcement created successfully');
      setShowCreateModal(false);
      resetForm();

    } catch (error) {
      console.error('Failed to create announcement:', error);
      Alert.alert('Error', 'Failed to create announcement');
    } finally {
      setSaving(false);
    }
  };

  const updateAnnouncement = async () => {
    if (!selectedAnnouncement || !formData.title || !formData.content) {
      Alert.alert('Validation Error', 'Please fill in title and content');
      return;
    }

    try {
      setSaving(true);

      const updatedAnnouncement: PlatformAnnouncement = {
        ...selectedAnnouncement,
        ...formData,
        updated_at: new Date().toISOString(),
      };

      setAnnouncements(prev => prev.map(a => 
        a.id === selectedAnnouncement.id ? updatedAnnouncement : a
      ));

      // Track the update
      track('superadmin_announcement_updated', {
        announcement_id: selectedAnnouncement.id,
        announcement_type: formData.type,
        priority: formData.priority,
      });

      // Log the action
      const { error: logError } = await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'platform_announcement_updated',
          details: {
            announcement_id: selectedAnnouncement.id,
            announcement_title: formData.title,
            changes: formData,
          },
        });

      if (logError) {
        console.error('Failed to log announcement update:', logError);
      }

      Alert.alert('Success', 'Announcement updated successfully');
      setShowEditModal(false);
      setSelectedAnnouncement(null);
      resetForm();

    } catch (error) {
      console.error('Failed to update announcement:', error);
      Alert.alert('Error', 'Failed to update announcement');
    } finally {
      setSaving(false);
    }
  };

  const deleteAnnouncement = async (announcement: PlatformAnnouncement) => {
    Alert.alert(
      'Delete Announcement',
      `Are you sure you want to delete "${announcement.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setAnnouncements(prev => prev.filter(a => a.id !== announcement.id));

              // Track the deletion
              track('superadmin_announcement_deleted', {
                announcement_id: announcement.id,
                announcement_type: announcement.type,
                priority: announcement.priority,
              });

              // Log the action
              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'platform_announcement_deleted',
                  details: {
                    announcement_id: announcement.id,
                    announcement_title: announcement.title,
                    announcement_type: announcement.type,
                  },
                });

              if (logError) {
                console.error('Failed to log announcement deletion:', logError);
              }

              Alert.alert('Success', 'Announcement deleted successfully');

            } catch (error) {
              console.error('Failed to delete announcement:', error);
              Alert.alert('Error', 'Failed to delete announcement');
            }
          }
        }
      ]
    );
  };

  const toggleAnnouncementStatus = async (announcement: PlatformAnnouncement) => {
    const newStatus = !announcement.is_active;
    
    try {
      setAnnouncements(prev => prev.map(a => 
        a.id === announcement.id ? { ...a, is_active: newStatus } : a
      ));

      // Track the toggle
      track('superadmin_announcement_toggled', {
        announcement_id: announcement.id,
        new_status: newStatus,
      });

      // Log the action
      const { error: logError } = await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'platform_announcement_toggled',
          details: {
            announcement_id: announcement.id,
            announcement_title: announcement.title,
            old_status: announcement.is_active,
            new_status: newStatus,
          },
        });

      if (logError) {
        console.error('Failed to log announcement toggle:', logError);
      }

    } catch (error) {
      console.error('Failed to toggle announcement:', error);
      Alert.alert('Error', 'Failed to update announcement status');
      // Revert the change
      setAnnouncements(prev => prev.map(a => 
        a.id === announcement.id ? { ...a, is_active: !newStatus } : a
      ));
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      type: 'info',
      priority: 'medium',
      target_audience: 'all',
      target_schools: [],
      is_active: true,
      is_pinned: false,
      show_banner: false,
    });
  };

  const openEditModal = (announcement: PlatformAnnouncement) => {
    setSelectedAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority,
      target_audience: announcement.target_audience,
      target_schools: [...announcement.target_schools],
      is_active: announcement.is_active,
      is_pinned: announcement.is_pinned,
      show_banner: announcement.show_banner,
      scheduled_at: announcement.scheduled_at,
      expires_at: announcement.expires_at,
    });
    setShowEditModal(true);
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'alert':
        return '#dc2626';
      case 'warning':
        return '#ea580c';
      case 'maintenance':
        return '#7c3aed';
      case 'feature':
        return '#059669';
      case 'info':
      default:
        return '#0ea5e9';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#d97706';
      case 'low':
        return '#059669';
      default:
        return '#6b7280';
    }
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'alert':
        return 'warning';
      case 'warning':
        return 'alert-circle';
      case 'maintenance':
        return 'construct';
      case 'feature':
        return 'sparkles';
      case 'info':
      default:
        return 'information-circle';
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!profile || (!isSuperAdmin(profile.role))) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Platform Announcements', headerShown: false }} />
        <StatusBar style="light" />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Platform Announcements', headerShown: false }} />
      <StatusBar style="light" />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Platform Announcements</Text>
          <TouchableOpacity 
            onPress={() => {
              resetForm();
              setShowCreateModal(true);
            }} 
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            {announcements.length} announcements • {announcements.filter(a => a.is_active).length} active
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading announcements...</Text>
          </View>
        ) : (
          <>
            {announcements.map((announcement) => (
              <View key={announcement.id} style={styles.announcementCard}>
                <View style={styles.announcementHeader}>
                  <View style={styles.announcementInfo}>
                    <View style={[styles.typeIcon, { backgroundColor: getTypeColor(announcement.type) + '20' }]}>
                      <Ionicons name={getTypeIcon(announcement.type) as any} size={20} color={getTypeColor(announcement.type)} />
                    </View>
                    <View style={styles.announcementDetails}>
                      <Text style={styles.announcementTitle} numberOfLines={1}>{announcement.title}</Text>
                      <Text style={styles.announcementMeta}>
                        {announcement.target_audience} • {formatDate(announcement.created_at)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.announcementActions}>
                    <Switch
                      value={announcement.is_active}
                      onValueChange={() => toggleAnnouncementStatus(announcement)}
                      trackColor={{ false: theme.border, true: theme.primary + '40' }}
                      thumbColor={announcement.is_active ? theme.primary : theme.textTertiary}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>
                </View>

                <Text style={styles.announcementContent} numberOfLines={2}>
                  {announcement.content}
                </Text>

                <View style={styles.announcementFooter}>
                  <View style={styles.announcementBadges}>
                    <View style={[styles.typeBadge, { backgroundColor: getTypeColor(announcement.type) + '20', borderColor: getTypeColor(announcement.type) }]}>
                      <Text style={[styles.typeBadgeText, { color: getTypeColor(announcement.type) }]}>
                        {announcement.type.toUpperCase()}
                      </Text>
                    </View>
                    
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(announcement.priority) + '20', borderColor: getPriorityColor(announcement.priority) }]}>
                      <Text style={[styles.priorityBadgeText, { color: getPriorityColor(announcement.priority) }]}>
                        {announcement.priority.toUpperCase()}
                      </Text>
                    </View>

                    {announcement.is_pinned && (
                      <View style={styles.pinnedBadge}>
                        <Ionicons name="pin" size={12} color={theme.warning} />
                        <Text style={styles.pinnedBadgeText}>PINNED</Text>
                      </View>
                    )}

                    {announcement.show_banner && (
                      <View style={styles.bannerBadge}>
                        <Ionicons name="megaphone" size={12} color={theme.accent} />
                        <Text style={styles.bannerBadgeText}>BANNER</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.announcementStats}>
                    <Text style={styles.statsText}>
                      <Ionicons name="eye" size={12} color={theme.textTertiary} />
                    </Text>
                    <Text style={styles.statsText}>
                      <Ionicons name="hand-left" size={12} color={theme.textTertiary} />
                    </Text>
                  </View>
                </View>

                {announcement.expires_at && (
                  <View style={styles.expiryInfo}>
                    <Ionicons name="time" size={12} color={theme.warning} />
                    <Text style={styles.expiryText}>
                      Expires: {formatDate(announcement.expires_at)}
                    </Text>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openEditModal(announcement)}
                  >
                    <Ionicons name="create" size={16} color={theme.primary} />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => deleteAnnouncement(announcement)}
                  >
                    <Ionicons name="trash" size={16} color={theme.error} />
                    <Text style={[styles.actionButtonText, { color: theme.error }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {announcements.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="megaphone-outline" size={48} color={theme.textTertiary} />
                <Text style={styles.emptyText}>No announcements</Text>
                <Text style={styles.emptySubText}>Create your first platform announcement</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateModal || showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedAnnouncement(null);
          resetForm();
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              setSelectedAnnouncement(null);
              resetForm();
            }}>
              <Ionicons name="close" size={24} color={theme.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {showCreateModal ? 'Create Announcement' : 'Edit Announcement'}
            </Text>
            <TouchableOpacity 
              onPress={showCreateModal ? createAnnouncement : updateAnnouncement}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder="Announcement title"
                placeholderTextColor={theme.textTertiary}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Content *</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={formData.content}
                onChangeText={(text) => setFormData(prev => ({ ...prev, content: text }))}
                placeholder="Announcement content..."
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={5}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.optionGrid}>
                {announcementTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionButton,
                      formData.type === type && styles.optionButtonActive,
                      { borderColor: getTypeColor(type) }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, type: type as any }))}
                  >
                    <Ionicons name={getTypeIcon(type) as any} size={16} color={formData.type === type ? getTypeColor(type) : '#9ca3af'} />
                    <Text style={[
                      styles.optionButtonText,
                      formData.type === type && { color: getTypeColor(type) }
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Priority</Text>
              <View style={styles.optionGrid}>
                {priorities.map((priority) => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.optionButton,
                      formData.priority === priority && styles.optionButtonActive,
                      { borderColor: getPriorityColor(priority) }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, priority: priority as any }))}
                  >
                    <Text style={[
                      styles.optionButtonText,
                      formData.priority === priority && { color: getPriorityColor(priority) }
                    ]}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Target Audience</Text>
              <View style={styles.optionGrid}>
                {audiences.map((audience) => (
                  <TouchableOpacity
                    key={audience}
                    style={[
                      styles.optionButton,
                      formData.target_audience === audience && styles.optionButtonActive
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, target_audience: audience as any }))}
                  >
                    <Text style={[
                      styles.optionButtonText,
                      formData.target_audience === audience && styles.optionButtonTextActive
                    ]}>
                      {audience === 'all' ? 'All Users' : audience.charAt(0).toUpperCase() + audience.slice(1).replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Settings</Text>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active</Text>
                <Switch
                  value={formData.is_active}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, is_active: value }))}
                  trackColor={{ false: theme.border, true: theme.primary + '40' }}
                  thumbColor={formData.is_active ? theme.primary : theme.textTertiary}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Pin to top</Text>
                <Switch
                  value={formData.is_pinned}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, is_pinned: value }))}
                  trackColor={{ false: '#374151', true: '#00f5ff40' }}
                  thumbColor={formData.is_pinned ? '#00f5ff' : '#9ca3af'}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Show as banner</Text>
                <Switch
                  value={formData.show_banner}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, show_banner: value }))}
                  trackColor={{ false: '#374151', true: '#00f5ff40' }}
                  thumbColor={formData.show_banner ? '#00f5ff' : '#9ca3af'}
                />
              </View>
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
  addButton: {
    padding: 8,
  },
  statsContainer: {
    paddingBottom: 16,
  },
  statsText: {
    color: '#9ca3af',
    fontSize: 12,
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
  announcementCard: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  announcementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  announcementDetails: {
    flex: 1,
  },
  announcementTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  announcementMeta: {
    color: '#9ca3af',
    fontSize: 12,
  },
  announcementActions: {
    alignItems: 'center',
  },
  announcementContent: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  announcementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  announcementBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#f59e0b20',
    gap: 2,
  },
  pinnedBadgeText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '600',
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#8b5cf620',
    gap: 2,
  },
  bannerBadgeText: {
    color: '#8b5cf6',
    fontSize: 9,
    fontWeight: '600',
  },
  announcementStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expiryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  expiryText: {
    color: '#f59e0b',
    fontSize: 11,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#374151',
    gap: 4,
  },
  deleteButton: {
    backgroundColor: '#7f1d1d20',
  },
  actionButtonText: {
    color: '#00f5ff',
    fontSize: 12,
    fontWeight: '500',
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
  saveButtonText: {
    color: '#00f5ff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#111827',
  },
  formSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  formLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#1f2937',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    gap: 4,
    minWidth: 80,
  },
  optionButtonActive: {
    backgroundColor: 'transparent',
  },
  optionButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  optionButtonTextActive: {
    color: '#00f5ff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});