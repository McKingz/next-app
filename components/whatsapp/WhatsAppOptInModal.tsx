import React, { useState, useEffect, useRef } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useWhatsAppConnection, WhatsAppConnectionStatus } from '../../hooks/useWhatsAppConnection'
import { useTheme } from '../../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import { track } from '../../lib/analytics'
import { useAuth } from '../../contexts/AuthContext'
import { queryClient } from '../../lib/query/queryClient'
import { convertToE164, formatAsUserTypes, validatePhoneNumber, EXAMPLE_PHONE_NUMBERS } from '../../lib/utils/phoneUtils'
import { Vibration } from 'react-native'
import Feedback from '../../lib/feedback'

interface WhatsAppOptInModalProps {
  visible: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const WhatsAppOptInModal: React.FC<WhatsAppOptInModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  const { theme, isDark } = useTheme()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const {
    connectionStatus,
    isLoading,
    isOptingIn,
    isOptingOut,
    optIn,
    optOut,
    hardDisconnect,
    getWhatsAppDeepLink,
    formatPhoneNumber,
    optInError,
    sendTestMessage,
    isSendingTest,
    forceRefresh,
    autoConnectToSchool,
  } = useWhatsAppConnection()

  const [phoneNumber, setPhoneNumber] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)
  const [step, setStep] = useState<'phone' | 'consent' | 'success' | 'connected'>('phone')
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const modalOpenedAtRef = useRef<Date | null>(null)
  const prevVisibleRef = useRef<boolean>(false)

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      // Modal opened - force refresh to get latest data
      forceRefresh()
      
      modalOpenedAtRef.current = new Date()
      track('edudash.whatsapp.modal_opened', {
        current_status: connectionStatus?.isConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      })

      // Reset form when modal opens
      if (connectionStatus?.isConnected) {
        setStep('connected')
        if (connectionStatus?.contact) {
          setPhoneNumber(connectionStatus.contact.phone_e164)
        }
      } else {
        setStep('phone')
        // Auto-fill with school WhatsApp number if available
        if (connectionStatus?.schoolWhatsAppNumber) {
          setPhoneNumber(connectionStatus.schoolWhatsAppNumber)
        } else {
          setPhoneNumber('')
        }
        setConsentGiven(false)
      }
    } else if (!visible && prevVisibleRef.current) {
      // Modal closed
      const openedAt = modalOpenedAtRef.current
      if (openedAt) {
        const sessionDuration = Date.now() - openedAt.getTime()
        track('edudash.whatsapp.modal_closed', {
          final_status: connectionStatus?.isConnected ? 'connected' : 'disconnected',
          session_duration_ms: sessionDuration
        })
      }
      modalOpenedAtRef.current = null
    }

    prevVisibleRef.current = visible
  }, [visible, connectionStatus?.isConnected, connectionStatus?.contact])

  // Use the new phone validation utility
  const validatePhone = (phone: string) => {
    return validatePhoneNumber(phone).isValid;
  }

  // Handle phone number input with auto-formatting
  const handlePhoneChange = (text: string) => {
    const formatted = formatAsUserTypes(text);
    setPhoneNumber(formatted);
  }

  const handlePhoneSubmit = () => {
    const validation = validatePhoneNumber(phoneNumber);
    
    if (!validation.isValid) {
      // Track validation failure
      const digitsOnly = phoneNumber.replace(/\D/g, '')
      let errorType: 'format' | 'length' | 'country' = 'format'
      
      if (digitsOnly.length < 9) {
        errorType = 'length'
      } else if (!digitsOnly.startsWith('0') && !digitsOnly.startsWith('27')) {
        errorType = 'country'
      }
      
      track('edudash.whatsapp.phone_validation_failed', {
        phone_input: phoneNumber.substring(0, 3) + '***', // Partial for privacy
        error_type: errorType
      })
      
      Alert.alert(
        t('dashboard.invalid_phone_number'),
        validation.message || t('dashboard.enter_valid_phone'),
        [{ text: t('common.ok') }]
      )
      return
    }
    
    // Convert to E.164 format for storage
    const e164Result = convertToE164(phoneNumber);
    if (e164Result.isValid && e164Result.e164) {
      setPhoneNumber(e164Result.e164); // Update to E.164 format
    }
    
    setStep('consent')
  }

  const handleOptIn = async () => {
    if (!consentGiven) {
      // Track consent declined
      track('edudash.whatsapp.consent_declined', {
        user_id: user?.id || '',
        step: 'consent',
        timestamp: new Date().toISOString()
      })
      
      Alert.alert(
        t('whatsapp:consentRequired'),
        t('whatsapp:consentRequiredMessage'),
        [{ text: t('common.ok') }]
      )
      return
    }

    // Track consent given
    track('edudash.whatsapp.consent_given', {
      user_id: user?.id || '',
      timestamp: new Date().toISOString()
    })

    try {
      await optIn(phoneNumber, true)
      try { await Feedback.vibrate(30); } catch { /* Intentional: non-fatal */ }
      try { await Feedback.playSuccess(); } catch { /* Intentional: non-fatal */ }
      setStep('success')
      onSuccess?.()
    } catch (error) {
      console.error('WhatsApp opt-in failed:', error)
      Alert.alert(
        t('whatsapp:optInFailed'),
        t('whatsapp:optInFailedMessage'),
        [{ text: t('common.ok') }]
      )
    }
  }

  const handleOptOut = async () => {
    if (isDisconnecting) return // Prevent multiple clicks
    
    Alert.alert(
      'Disconnect WhatsApp',
      'How would you like to disconnect your WhatsApp integration?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Soft Disconnect',
          onPress: async () => {
            setIsDisconnecting(true)
            console.log('Starting soft disconnect...')
            try {
              console.log('Calling optOut function...')
              await optOut()
              console.log('optOut completed successfully')
              setStep('phone')
              setPhoneNumber('')
              setConsentGiven(false)
              // Force refresh to ensure UI updates
              setTimeout(() => {
                forceRefresh()
                // Additional cache clearing to ensure UI updates
                queryClient.invalidateQueries({ queryKey: ['whatsapp'] })
                queryClient.removeQueries({ queryKey: ['whatsapp'] })
                queryClient.invalidateQueries({ queryKey: ['whatsappContacts'] })
                queryClient.removeQueries({ queryKey: ['whatsappContacts'] })
              }, 100)
              Alert.alert(
                'Disconnected Successfully',
                'WhatsApp has been disconnected. You can reconnect anytime. Your preferences have been saved.'
              )
            } catch (error) {
              console.error('WhatsApp opt-out failed:', error)
              const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'
              Alert.alert(
                'Disconnect Failed', 
                `Could not disconnect: ${errorMsg}\n\nTry the "Hard Disconnect" option if this persists.`
              )
            } finally {
              setIsDisconnecting(false)
            }
          }
        },
        {
          text: 'Hard Disconnect',
          style: 'destructive',
          onPress: async () => {
            setIsDisconnecting(true)
            console.log('Starting hard disconnect...')
            try {
              console.log('Calling hardDisconnect function...')
              await hardDisconnect()
              console.log('hardDisconnect completed successfully')
              setStep('phone')
              setPhoneNumber('')
              setConsentGiven(false)
              // Force refresh to ensure UI updates
              setTimeout(() => {
                forceRefresh()
                // Additional cache clearing to ensure UI updates
                queryClient.invalidateQueries({ queryKey: ['whatsapp'] })
                queryClient.removeQueries({ queryKey: ['whatsapp'] })
                queryClient.invalidateQueries({ queryKey: ['whatsappContacts'] })
                queryClient.removeQueries({ queryKey: ['whatsappContacts'] })
              }, 100)
              Alert.alert(
                'Completely Disconnected',
                'WhatsApp has been completely removed from your account. All connection data has been deleted.'
              )
            } catch (error) {
              console.error('WhatsApp hard disconnect failed:', error)
              const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'
              Alert.alert(
                'Hard Disconnect Failed', 
                `Could not remove WhatsApp connection: ${errorMsg}\n\nPlease contact support if this issue persists.`,
                [
                  { text: 'Contact Support', onPress: () => {
                    // Could open support chat or email
                    console.log('User needs support for WhatsApp disconnect')
                  }},
                  { text: 'OK' }
                ]
              )
            } finally {
              setIsDisconnecting(false)
            }
          }
        }
      ]
    )
  }

  const handleOpenWhatsApp = () => {
    const deepLink = getWhatsAppDeepLink()
    if (deepLink) {
      Linking.openURL(deepLink).catch(err => {
        console.error('Failed to open WhatsApp:', err)
        Alert.alert(
          t('whatsapp:openFailed'),
          t('whatsapp:openFailedMessage'),
          [{ text: t('common.ok') }]
        )
      })
    }
  }

  const handleSendTestMessage = async () => {
    if (!connectionStatus?.isConnected || !connectionStatus?.contact) {
      Alert.alert(
        'WhatsApp Not Connected',
        'Please connect WhatsApp first before sending test messages.',
        [{ text: t('common.ok') }]
      )
      return
    }

    try {
      await sendTestMessage()
      try { await Feedback.vibrate(30); } catch { /* Intentional: non-fatal */ }
      try { await Feedback.playSuccess(); } catch { /* Intentional: non-fatal */ }
      Alert.alert(
        t('whatsapp:testMessageSent'),
        t('whatsapp:testMessageSentMessage'),
        [{ text: t('common.ok') }]
      )
    } catch (error) {
      console.error('Test message failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      Alert.alert(
        t('whatsapp:testMessageFailed'),
        `${t('whatsapp:testMessageFailedMessage')}\n\nError: ${errorMessage}`,
        [{ text: t('common.ok') }]
      )
    }
  }

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      backgroundColor: theme.background,
      borderRadius: 0,
      margin: 0,
      width: '100%',
      height: '100%',
      maxWidth: '100%',
      maxHeight: '100%',
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
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      flex: 1,
      marginLeft: 12,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      padding: 20,
    },
    stepIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.border,
      marginHorizontal: 4,
    },
    stepDotActive: {
      backgroundColor: '#25D366',
    },
    stepDotCompleted: {
      backgroundColor: theme.primary,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    description: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 8,
    },
    phoneInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF',
      marginBottom: 20,
    },
    disabledInput: {
      backgroundColor: theme.surfaceVariant || '#F5F5F5',
      opacity: 0.7,
      borderColor: theme.border,
    },
    phoneInputFocused: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    phoneHint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: -16,
      marginBottom: 20,
    },
    consentContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: theme.border,
      borderRadius: 4,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    consentText: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    consentLink: {
      color: theme.primary,
      textDecorationLine: 'underline',
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    button: {
      flex: 1,
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 4,
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.border,
    },
    buttonDestructive: {
      backgroundColor: '#FF4757',
    },
    buttonDisabled: {
      backgroundColor: theme.border,
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    buttonTextSecondary: {
      color: theme.text,
    },
    successContainer: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    successIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#25D366',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    successTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    successDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    connectedInfo: {
      backgroundColor: '#25D366',
      borderRadius: 8,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    connectedText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 12,
      flex: 1,
    },
    phoneDisplay: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 20,
    },
    actionButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 12,
    },
    actionButtonText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    loadingText: {
      marginLeft: 8,
      color: theme.textSecondary,
    },
  })

  const renderPhoneStep = () => (
    <View>
      {/* Header with refresh button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>WhatsApp Setup</Text>
        <TouchableOpacity 
          onPress={() => {
            forceRefresh()
            Alert.alert('Refreshed', 'WhatsApp data refreshed from database')
          }}
          style={{ padding: 8, borderRadius: 6, backgroundColor: theme.surface }}
        >
          <Ionicons name="refresh" size={16} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* School WhatsApp Info */}
      {connectionStatus?.schoolWhatsAppNumber ? (
        <View style={{
          backgroundColor: theme.success + '20',
          borderColor: theme.success,
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
          marginBottom: 16
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="business" size={16} color={theme.success} />
            <Text style={{ 
              color: theme.success, 
              fontWeight: '600', 
              marginLeft: 8,
              fontSize: 14 
            }}>
              School WhatsApp Business
            </Text>
          </View>
          <Text style={{ 
            color: theme.text, 
            fontSize: 16, 
            fontWeight: '700',
            marginBottom: 8
          }}>
            {formatPhoneNumber(connectionStatus?.schoolWhatsAppNumber || '')}
          </Text>
          <Text style={{ 
            color: theme.textSecondary, 
            fontSize: 12,
            marginBottom: 12
          }}>
            This is your school's official WhatsApp Business number. Connect to receive school updates and communicate with parents.
          </Text>
          
          <TouchableOpacity
            style={{
              backgroundColor: theme.success,
              borderRadius: 6,
              paddingVertical: 10,
              paddingHorizontal: 16,
              alignItems: 'center'
            }}
            onPress={async () => {
              try {
                console.log('Starting auto-connect to school WhatsApp...')
                await autoConnectToSchool()
                console.log('Auto-connect successful')
                setStep('success')
                onSuccess?.()
              } catch (error) {
                console.error('Auto-connect failed:', error)
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                Alert.alert(
                  'Connection Failed', 
                  `Could not connect to school WhatsApp: ${errorMessage}\n\nPlease try manual setup below.`
                )
              }
            }}
            disabled={isOptingIn}
          >
            {isOptingIn ? (
              <ActivityIndicator color={theme.onPrimary} size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={16} color={theme.onPrimary} />
                <Text style={{ 
                  color: theme.onPrimary, 
                  fontWeight: '600',
                  marginLeft: 8
                }}>
                  Connect to School WhatsApp
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{
          backgroundColor: theme.warning + '20',
          borderColor: theme.warning,
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
          marginBottom: 16
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="warning" size={16} color={theme.warning} />
            <Text style={{ 
              color: theme.warning, 
              fontWeight: '600', 
              marginLeft: 8,
              fontSize: 14 
            }}>
              School WhatsApp Not Configured
            </Text>
          </View>
          <Text style={{ 
            color: theme.textSecondary, 
            fontSize: 12
          }}>
            Your school hasn't set up WhatsApp Business yet. You can still connect your personal number, but school communications won't work until an admin configures the school's WhatsApp Business account.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Manual Setup</Text>
      <Text style={styles.description}>
        {profile?.role === 'teacher'
          ? 'Connect your school\'s WhatsApp Business number for student communications'
          : 'Enter a WhatsApp number to connect for school communications'
        }
      </Text>
      
      <Text style={styles.inputLabel}>WhatsApp Number</Text>
      <TextInput
        style={[
          styles.phoneInput,
          profile?.role === 'teacher' && styles.disabledInput
        ]}
        value={phoneNumber}
        onChangeText={profile?.role === 'teacher' ? undefined : handlePhoneChange}
        placeholder={connectionStatus?.schoolWhatsAppNumber || EXAMPLE_PHONE_NUMBERS.local}
        placeholderTextColor={theme.textSecondary}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={13} // Allow for formatted input
        editable={profile?.role !== 'teacher'}
        pointerEvents={profile?.role === 'teacher' ? 'none' : 'auto'}
      />
      <Text style={styles.phoneHint}>
        {profile?.role === 'teacher'
          ? 'School WhatsApp number pre-filled and locked for teachers'
          : connectionStatus?.schoolWhatsAppNumber
            ? 'School number pre-filled. You can change it if needed.'
            : 'Include country code (e.g., +27 for South Africa)'
        }
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={onClose}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            Cancel
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.button,
            !validatePhone(phoneNumber) && profile?.role !== 'teacher' && styles.buttonDisabled
          ]}
          onPress={handlePhoneSubmit}
          disabled={!validatePhone(phoneNumber) && profile?.role !== 'teacher'}
        >
          <Text style={styles.buttonText}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderConsentStep = () => (
    <View>
      <Text style={styles.sectionTitle}>{t('whatsapp:consentTitle')}</Text>
      <Text style={styles.description}>
        {t('whatsapp:consentDescription')}
      </Text>

      <TouchableOpacity
        style={styles.consentContainer}
        onPress={() => setConsentGiven(!consentGiven)}
      >
        <View style={[styles.checkbox, consentGiven && styles.checkboxChecked]}>
          {consentGiven && (
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          )}
        </View>
        <Text style={styles.consentText}>
          {t('whatsapp:consentText')}{' '}
          <Text style={styles.consentLink}>
            {t('whatsapp:privacyPolicy')}
          </Text>
        </Text>
      </TouchableOpacity>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => setStep('phone')}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            {t('common.back')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.button,
            (!consentGiven || isOptingIn) && styles.buttonDisabled
          ]}
          onPress={handleOptIn}
          disabled={!consentGiven || isOptingIn}
        >
          {isOptingIn ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={[styles.buttonText, styles.loadingText]}>
                {t('whatsapp:connecting')}
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>
              {t('whatsapp:connect')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderSuccessStep = () => (
    <View>
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={32} color="#FFFFFF" />
        </View>
        <Text style={styles.successTitle}>
          {t('whatsapp:connectionSuccessTitle')}
        </Text>
        <Text style={styles.successDescription}>
          {t('whatsapp:connectionSuccessDescription')}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleOpenWhatsApp}
      >
        <Text style={styles.actionButtonText}>
          {t('whatsapp:openWhatsApp')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleSendTestMessage}
        disabled={isSendingTest}
      >
        {isSendingTest ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.loadingText}>
              {t('whatsapp:sendingTest')}
            </Text>
          </View>
        ) : (
          <Text style={styles.actionButtonText}>
            {t('whatsapp:sendTestMessage')}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={onClose}
      >
        <Text style={styles.buttonText}>
          {t('common.done')}
        </Text>
      </TouchableOpacity>
    </View>
  )

  const renderConnectedStep = () => (
    <View>
      {/* Header with refresh button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.connectedInfo}>
            <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
          </View>
          <Text style={[styles.connectedText, { marginLeft: 8 }]}>
            WhatsApp Connected
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => {
            forceRefresh()
            Alert.alert('Refreshed', 'Connection status refreshed from database')
          }}
          style={{ padding: 8, borderRadius: 6, backgroundColor: theme.surface }}
        >
          <Ionicons name="refresh" size={16} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {connectionStatus?.contact && (
        <View style={{
          backgroundColor: theme.surface,
          borderRadius: 8,
          padding: 12,
          marginBottom: 16
        }}>
          <Text style={{
            color: theme.textSecondary,
            fontSize: 12,
            marginBottom: 4
          }}>
            {profile?.role === 'teacher' ? 'School WhatsApp Number:' : 'Connected WhatsApp Number:'}
          </Text>
          <Text style={{
            color: theme.text,
            fontSize: 16,
            fontWeight: '600'
          }}>
            {formatPhoneNumber(connectionStatus?.contact?.phone_e164 || '')}
          </Text>
          <Text style={{ 
            color: theme.textSecondary, 
            fontSize: 11, 
            marginTop: 4 
          }}>
            Status: {connectionStatus?.contact?.consent_status} • Connected: {connectionStatus?.contact?.created_at ? new Date(connectionStatus.contact.created_at).toLocaleDateString() : 'Unknown'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleOpenWhatsApp}
      >
        <Text style={styles.actionButtonText}>
          {t('whatsapp:openWhatsApp')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleSendTestMessage}
        disabled={isSendingTest}
      >
        {isSendingTest ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.loadingText}>
              {t('whatsapp:sendingTest')}
            </Text>
          </View>
        ) : (
          <Text style={styles.actionButtonText}>
            {t('whatsapp:sendTestMessage')}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button, 
            styles.buttonDestructive,
            (isDisconnecting || isOptingOut) && styles.buttonDisabled
          ]}
          onPress={handleOptOut}
          disabled={isDisconnecting || isOptingOut}
        >
          {isDisconnecting || isOptingOut ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={[styles.buttonText, styles.loadingText]}>
                Disconnecting...
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>
              {t('whatsapp:disconnect')}
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.button}
          onPress={onClose}
        >
          <Text style={styles.buttonText}>
            {t('common.done')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modal}>
          <View style={styles.header}>
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            <Text style={styles.headerTitle}>
              {t('whatsapp:title')}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {isLoading && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                backgroundColor: theme.surfaceVariant,
                marginBottom: 16,
                borderRadius: 8
              }}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={{
                  marginLeft: 8,
                  color: theme.textSecondary,
                  fontSize: 14
                }}>
                  Loading WhatsApp connection status...
                </Text>
              </View>
            )}
            
            {step === 'phone' && renderPhoneStep()}
            {step === 'consent' && renderConsentStep()}
            {step === 'success' && renderSuccessStep()}
            {step === 'connected' && renderConnectedStep()}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export default WhatsAppOptInModal