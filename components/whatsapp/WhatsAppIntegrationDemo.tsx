import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import { WhatsAppQuickAction } from './WhatsAppQuickAction'
import { WhatsAppStatusChip } from './WhatsAppStatusChip'
import { WhatsAppOptInModal } from './WhatsAppOptInModal'
import { WhatsAppProfileGuard } from './WhatsAppProfileGuard'
import { useWhatsAppConnection } from '../../hooks/useWhatsAppConnection'
import { useAuth } from '../../contexts/AuthContext'
import { track } from '../../lib/analytics'

interface WhatsAppIntegrationDemoProps {
  onClose?: () => void
}

export const WhatsAppIntegrationDemo: React.FC<WhatsAppIntegrationDemoProps> = ({ onClose }) => {
  const { theme, isDark } = useTheme()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { connectionStatus } = useWhatsAppConnection()
  const [showOptInModal, setShowOptInModal] = useState(false)
  const [showProfileGuard, setShowProfileGuard] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)

  // Check if profile is complete for WhatsApp integration
  const isProfileComplete = () => {
    if (!profile) return false;
    
    const hasRequiredFields = !!
      profile.first_name?.trim() &&
      profile.last_name?.trim() &&
      (profile as any).phone &&
      profile.organization_id;
    
    return hasRequiredFields;
  }

  // Handle WhatsApp connection attempt with profile guard
  const handleWhatsAppConnect = () => {
    if (isProfileComplete()) {
      setShowOptInModal(true);
    } else {
      setShowProfileGuard(true);
      track('edudash.whatsapp.profile_incomplete', {
        user_id: profile?.id,
        missing_fields: [
          !profile?.first_name ? 'first_name' : null,
          !profile?.last_name ? 'last_name' : null,
          !(profile as any)?.phone ? 'phone' : null,
          !profile?.organization_id ? 'organization' : null,
        ].filter(Boolean),
      });
    }
  }

  const handleFeaturePress = (feature: string) => {
    setSelectedFeature(feature)
    track('edudash.whatsapp.feature_viewed', {
      feature_name: feature,
      connection_status: connectionStatus.isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    })
  }

  const features = [
    {
      id: 'instant_messages',
      icon: 'flash' as const,
      title: t('whatsapp.features.instantMessages', { defaultValue: 'Instant Messages' }),
      description: t('whatsapp.features.instantMessagesDesc', { defaultValue: 'Get school updates delivered instantly to WhatsApp' }),
      color: '#25D366',
    },
    {
      id: 'direct_chat',
      icon: 'chatbubbles' as const,
      title: t('whatsapp.features.directChat', { defaultValue: 'Direct Teacher Chat' }),
      description: t('whatsapp.features.directChatDesc', { defaultValue: 'Chat directly with your child\'s teacher via WhatsApp' }),
      color: '#007AFF',
    },
    {
      id: 'homework_reminders',
      icon: 'notifications' as const,
      title: t('whatsapp.features.homeworkReminders', { defaultValue: 'Homework Reminders' }),
      description: t('whatsapp.features.homeworkRemindersDesc', { defaultValue: 'Never miss homework deadlines with WhatsApp reminders' }),
      color: '#FF9500',
    },
    {
      id: 'voice_messages',
      icon: 'mic' as const,
      title: t('whatsapp.features.voiceMessages', { defaultValue: 'Voice Messages' }),
      description: t('whatsapp.features.voiceMessagesDesc', { defaultValue: 'Send voice messages in your preferred language' }),
      color: '#34C759',
    },
    {
      id: 'media_sharing',
      icon: 'image' as const,
      title: t('whatsapp.features.mediaSharing', { defaultValue: 'Photo & Document Sharing' }),
      description: t('whatsapp.features.mediaSharingDesc', { defaultValue: 'Share homework photos and documents easily' }),
      color: '#AF52DE',
    },
    {
      id: 'works_offline',
      icon: 'cloud-offline' as const,
      title: t('whatsapp.features.workOffline', { defaultValue: 'Works Offline' }),
      description: t('whatsapp.features.workOfflineDesc', { defaultValue: 'WhatsApp works even with poor internet connection' }),
      color: '#FF6B6B',
    },
  ]

  const benefits = [
    t('whatsapp.benefits.familyFriendly'),
    t('whatsapp.benefits.instantDelivery'),
    t('whatsapp.benefits.worksOffline'),
    t('whatsapp.benefits.noAppSwitching'),
    t('whatsapp.benefits.voiceSupport'),
    t('whatsapp.benefits.mediaFriendly'),
  ]

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      flex: 1,
      marginLeft: 12,
    },
    closeButton: {
      padding: 4,
    },
    scrollContent: {
      padding: 20,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 16,
    },
    sectionDescription: {
      fontSize: 16,
      color: theme.textSecondary,
      lineHeight: 24,
      marginBottom: 20,
    },
    statusContainer: {
      backgroundColor: isDark ? '#2A2A2A' : '#F8F9FA',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusInfo: {
      flex: 1,
    },
    statusTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    statusSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    quickActionContainer: {
      marginBottom: 24,
    },
    featuresGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    featureCard: {
      width: '48%',
      backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    featureCardSelected: {
      borderColor: '#25D366',
      borderWidth: 2,
      backgroundColor: isDark ? '#1F2A1F' : '#F0FFF4',
    },
    featureIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    featureTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    benefitsList: {
      marginTop: 12,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    benefitText: {
      fontSize: 16,
      color: theme.text,
      lineHeight: 24,
      marginLeft: 8,
    },
    demoActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 24,
    },
    demoButton: {
      flex: 1,
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginHorizontal: 4,
      alignItems: 'center',
    },
    demoButtonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.border,
    },
    demoButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    demoButtonTextSecondary: {
      color: theme.text,
    },
    troubleshootingBox: {
      backgroundColor: isDark ? '#2A2A2A' : '#FFF9E6',
      borderRadius: 8,
      padding: 16,
      marginTop: 20,
      borderLeftWidth: 4,
      borderLeftColor: '#FF9500',
    },
    troubleshootingTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    troubleshootingText: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
        <Text style={styles.headerTitle}>
          {t('whatsapp:title')}
        </Text>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Connection Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          <View style={styles.statusContainer}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {connectionStatus.isConnected ? 'WhatsApp Connected' : 'WhatsApp Not Connected'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {connectionStatus.isConnected 
                  ? 'Receiving school updates via WhatsApp'
                  : 'Connect to receive instant school updates'
                }
              </Text>
            </View>
            <WhatsAppStatusChip onPress={handleWhatsAppConnect} />
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WhatsApp Features</Text>
          <Text style={styles.sectionDescription}>
            Discover how WhatsApp integration enhances your school communication experience.
          </Text>
          <View style={styles.featuresGrid}>
            {features.map((feature) => (
              <TouchableOpacity
                key={feature.id}
                style={[
                  styles.featureCard,
                  selectedFeature === feature.id && styles.featureCardSelected,
                ]}
                onPress={() => handleFeaturePress(feature.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.featureIcon, { backgroundColor: `${feature.color}20` }]}>
                  <Ionicons name={feature.icon} size={20} color={feature.color} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('whatsapp.benefits.title')}
          </Text>
          <View style={styles.benefitsList}>
            {benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#25D366" />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.demoActions}>
            <TouchableOpacity
              style={[styles.demoButton, styles.demoButtonSecondary]}
              onPress={handleWhatsAppConnect}
            >
              <Text style={[styles.demoButtonText, styles.demoButtonTextSecondary]}>
                {connectionStatus.isConnected ? 'Manage Connection' : 'Connect WhatsApp'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Troubleshooting */}
        {connectionStatus.isConnected && (
          <View style={styles.troubleshootingBox}>
            <Text style={styles.troubleshootingTitle}>
              {t('whatsapp.troubleshooting.notReceiving')}
            </Text>
            <Text style={styles.troubleshootingText}>
              {t('whatsapp.troubleshooting.checkConnection')}
              {'\n'}• {t('whatsapp.troubleshooting.updatePhone')}
              {'\n'}• {t('whatsapp.troubleshooting.contactSupport')}
            </Text>
          </View>
        )}
      </ScrollView>

      <WhatsAppProfileGuard
        visible={showProfileGuard}
        onClose={() => setShowProfileGuard(false)}
        onProfileComplete={() => {
          setShowProfileGuard(false);
          setShowOptInModal(true);
        }}
        onNavigateToProfile={() => {
          setShowProfileGuard(false);
          // TODO: Navigate to profile page
          // router.push('/profile');
        }}
      />
      
      <WhatsAppOptInModal
        visible={showOptInModal}
        onClose={() => setShowOptInModal(false)}
        onSuccess={() => {
          setShowOptInModal(false)
          // Show success feedback
        }}
      />
    </View>
  )
}

export default WhatsAppIntegrationDemo