import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { 
  useMyPOPUploads, 
  POPUpload, 
  useDeletePOPUpload, 
  usePOPFileUrl 
} from '@/hooks/usePOPUploads';
import { formatFileSize, getFileTypeIcon } from '@/lib/popUpload';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

// Filter options
const UPLOAD_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'proof_of_payment', label: 'Proof of Payment' },
  { value: 'picture_of_progress', label: 'Picture of Progress' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'needs_revision', label: 'Needs Revision' },
];

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  currentType: string;
  currentStatus: string;
  onApply: (type: string, status: string) => void;
}

const FilterModal: React.FC<FilterModalProps> = ({ 
  visible, 
  onClose, 
  currentType, 
  currentStatus, 
  onApply 
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState(currentType);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  
  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    content: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginBottom: 8,
    },
    optionActive: {
      backgroundColor: theme.primary + '20',
    },
    optionText: {
      fontSize: 14,
      color: theme.text,
      marginLeft: 12,
    },
    optionTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    buttons: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.textSecondary + '20',
    },
    applyButton: {
      backgroundColor: theme.primary,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: theme.textSecondary,
    },
    applyButtonText: {
      color: theme.onPrimary,
    },
  });
  
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('pop.filterBy')}</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('pop.type')}</Text>
            {UPLOAD_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.option, selectedType === type.value && styles.optionActive]}
                onPress={() => setSelectedType(type.value)}
              >
                <Ionicons 
                  name={selectedType === type.value ? 'radio-button-on' : 'radio-button-off'} 
                  size={20} 
                  color={selectedType === type.value ? theme.primary : theme.textSecondary} 
                />
                <Text style={[styles.optionText, selectedType === type.value && styles.optionTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('pop.status')}</Text>
            {STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status.value}
                style={[styles.option, selectedStatus === status.value && styles.optionActive]}
                onPress={() => setSelectedStatus(status.value)}
              >
                <Ionicons 
                  name={selectedStatus === status.value ? 'radio-button-on' : 'radio-button-off'} 
                  size={20} 
                  color={selectedStatus === status.value ? theme.primary : theme.textSecondary} 
                />
                <Text style={[styles.optionText, selectedStatus === status.value && styles.optionTextActive]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={[styles.buttonText, styles.cancelButtonText]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.applyButton]} 
              onPress={() => {
                onApply(selectedType, selectedStatus);
                onClose();
              }}
            >
              <Text style={[styles.buttonText, styles.applyButtonText]}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Upload item component
interface UploadItemProps {
  upload: POPUpload;
  onPress: () => void;
  onDelete: () => void;
}

const UploadItem: React.FC<UploadItemProps> = ({ upload, onPress, onDelete }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { data: fileUrl } = usePOPFileUrl(upload);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return theme.success;
      case 'rejected': return theme.error;
      case 'needs_revision': return theme.warning;
      default: return theme.textSecondary;
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'needs_revision': return 'warning';
      default: return 'time';
    }
  };
  
  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    typeIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerContent: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    typeLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      textTransform: 'capitalize',
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    content: {
      marginBottom: 12,
    },
    description: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 18,
      marginBottom: 8,
    },
    metadata: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    metadataItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metadataText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    filePreview: {
      marginBottom: 12,
      alignItems: 'center',
    },
    image: {
      width: 100,
      height: 100,
      borderRadius: 8,
      backgroundColor: theme.textSecondary + '20',
    },
    fileIcon: {
      width: 60,
      height: 60,
      borderRadius: 8,
      backgroundColor: theme.textSecondary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reviewSection: {
      backgroundColor: theme.elevated,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    reviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    reviewTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginLeft: 8,
    },
    reviewNotes: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    viewButton: {
      backgroundColor: theme.primary + '20',
    },
    deleteButton: {
      backgroundColor: theme.error + '20',
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    viewButtonText: {
      color: theme.primary,
    },
    deleteButtonText: {
      color: theme.error,
    },
  });
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[
          styles.typeIcon, 
          { backgroundColor: upload.upload_type === 'proof_of_payment' ? theme.warning + '20' : theme.accent + '20' }
        ]}>
          <Ionicons 
            name={upload.upload_type === 'proof_of_payment' ? 'receipt' : 'camera'} 
            size={20} 
            color={upload.upload_type === 'proof_of_payment' ? theme.warning : theme.accent} 
          />
        </View>
        
        <View style={styles.headerContent}>
          <Text style={styles.title} numberOfLines={2}>{upload.title}</Text>
          <Text style={styles.typeLabel}>
            {upload.upload_type === 'proof_of_payment' ? t('pop.proofOfPayment') : t('pop.pictureOfProgress')}
          </Text>
        </View>
        
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(upload.status) + '20' }]}>
            <Ionicons name={getStatusIcon(upload.status)} size={14} color={getStatusColor(upload.status)} />
            <Text style={[styles.statusText, { color: getStatusColor(upload.status) }]}>
              {t(`pop.${upload.status}`)}
            </Text>
          </View>
        </View>
      </View>
      
      {upload.description && (
        <Text style={styles.description} numberOfLines={2}>{upload.description}</Text>
      )}
      
      <View style={styles.metadata}>
        <View style={styles.metadataItem}>
          <Ionicons name="calendar" size={12} color={theme.textSecondary} />
          <Text style={styles.metadataText}>
            {t('pop.uploadedOn')} {new Date(upload.created_at).toLocaleDateString()}
          </Text>
        </View>
        
        {upload.file_size && (
          <View style={styles.metadataItem}>
            <Ionicons name="document" size={12} color={theme.textSecondary} />
            <Text style={styles.metadataText}>{formatFileSize(upload.file_size)}</Text>
          </View>
        )}
        
        {upload.upload_type === 'proof_of_payment' && upload.payment_amount && (
          <View style={styles.metadataItem}>
            <Ionicons name="card" size={12} color={theme.textSecondary} />
            <Text style={styles.metadataText}>R{upload.payment_amount.toLocaleString()}</Text>
          </View>
        )}
        
        {upload.upload_type === 'picture_of_progress' && upload.subject && (
          <View style={styles.metadataItem}>
            <Ionicons name="book" size={12} color={theme.textSecondary} />
            <Text style={[styles.metadataText, { textTransform: 'capitalize' }]}>
              {upload.subject.replace('_', ' ')}
            </Text>
          </View>
        )}
      </View>
      
      {/* File preview for images */}
      {upload.file_type?.startsWith('image/') && fileUrl && (
        <View style={styles.filePreview}>
          <Image source={{ uri: fileUrl }} style={styles.image} />
        </View>
      )}
      
      {/* Review section if reviewed */}
      {upload.status !== 'pending' && upload.review_notes && (
        <View style={styles.reviewSection}>
          <View style={styles.reviewHeader}>
            <Ionicons name="person" size={16} color={theme.textSecondary} />
            <Text style={styles.reviewTitle}>
              {t('pop.reviewedBy')} {upload.reviewer_name || 'Teacher'}
            </Text>
          </View>
          <Text style={styles.reviewNotes}>{upload.review_notes}</Text>
        </View>
      )}
      
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionButton, styles.viewButton]} onPress={onPress}>
          <Ionicons name="eye" size={16} color={theme.primary} />
          <Text style={[styles.actionButtonText, styles.viewButtonText]}>{t('pop.viewFile')}</Text>
        </TouchableOpacity>
        
        {upload.status === 'pending' && (
          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={onDelete}>
            <Ionicons name="trash" size={16} color={theme.error} />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>{t('pop.deleteUpload')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default function POPHistoryScreen() {
  const { type: initialType, status: initialStatus } = useLocalSearchParams<{
    type?: string;
    status?: string;
  }>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const deleteUpload = useDeletePOPUpload();
  
  // Filter state
  const [filterType, setFilterType] = useState(initialType || '');
  const [filterStatus, setFilterStatus] = useState(initialStatus || '');
  const [showFilters, setShowFilters] = useState(false);
  
  // Fetch uploads with filters
  const { data: uploads = [], isLoading, error, refetch } = useMyPOPUploads({
    upload_type: filterType as any,
    status: filterStatus,
  });
  
  const filteredUploads = useMemo(() => {
    return uploads.filter(upload => {
      if (filterType && upload.upload_type !== filterType) return false;
      if (filterStatus && upload.status !== filterStatus) return false;
      return true;
    });
  }, [uploads, filterType, filterStatus]);
  
  const handleDeleteUpload = async (upload: POPUpload) => {
    Alert.alert(
      'Delete Upload',
      `Are you sure you want to delete "${upload.title}"?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUpload.mutateAsync(upload.id);
            } catch (error) {
              Alert.alert(t('common.error'), 'Failed to delete upload');
            }
          },
        },
      ]
    );
  };
  
  const handleViewFile = async (upload: POPUpload) => {
    // Navigate to file viewer or open file
    router.push(`/file-viewer?uploadId=${upload.id}`);
  };
  
  const handleApplyFilters = (type: string, status: string) => {
    setFilterType(type);
    setFilterStatus(status);
  };
  
  const activeFiltersCount = [filterType, filterStatus].filter(Boolean).length;
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filterButtonActive: {
      backgroundColor: theme.primary + '20',
      borderColor: theme.primary,
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    filterButtonTextActive: {
      color: theme.primary,
    },
    badge: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.onPrimary,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
    emptyButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 20,
    },
    emptyButtonText: {
      color: theme.onPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      padding: 16,
    },
  });
  
  if (isLoading) {
    return (
      <View style={styles.container}>
        <RoleBasedHeader title={t('pop.popHistory')} showBackButton />
        <View style={styles.loadingContainer}>
          <SkeletonLoader width="100%" height={120} borderRadius={12} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={120} borderRadius={12} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={120} borderRadius={12} style={{ marginBottom: 12 }} />
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <RoleBasedHeader title={t('pop.popHistory')} showBackButton />
      
      {/* Filter controls */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons 
            name="filter" 
            size={16} 
            color={activeFiltersCount > 0 ? theme.primary : theme.textSecondary} 
          />
          <Text style={[styles.filterButtonText, activeFiltersCount > 0 && styles.filterButtonTextActive]}>
            {t('pop.filterBy')}
          </Text>
          {activeFiltersCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        {filteredUploads.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color={theme.textSecondary} />
            <Text style={styles.emptyTitle}>{t('pop.noUploads')}</Text>
            <Text style={styles.emptySubtitle}>{t('pop.noUploadsDesc')}</Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => router.push('/screens/parent-proof-of-payment')}
            >
              <Text style={styles.emptyButtonText}>{t('pop.uploadFirst')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredUploads.map((upload) => (
            <UploadItem
              key={upload.id}
              upload={upload}
              onPress={() => handleViewFile(upload)}
              onDelete={() => handleDeleteUpload(upload)}
            />
          ))
        )}
      </ScrollView>
      
      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        currentType={filterType}
        currentStatus={filterStatus}
        onApply={handleApplyFilters}
      />
    </View>
  );
}