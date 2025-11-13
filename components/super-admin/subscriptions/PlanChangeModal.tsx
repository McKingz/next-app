import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  Vibration,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { adminUpdateSubscriptionPlan, listActivePlans, type SubscriptionPlan } from '@/lib/supabase/rpc-subscriptions';
import { createCheckout } from '@/lib/payments';
import { track } from '@/lib/analytics';
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';

interface Subscription {
  id: string;
  plan_id: string;
  billing_frequency: string;
  seats_total: number;
  school_id: string;
  status?: string;
}

interface School {
  id: string;
  name: string;
}

interface PlanChangeModalProps {
  visible: boolean;
  onClose: () => void;
  subscription: Subscription | null;
  school: School | null;
  onSuccess: () => void;
}

export default function PlanChangeModal({
  visible,
  onClose,
  subscription,
  school,
  onSuccess,
}: PlanChangeModalProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  
  // Button state management
  const [buttonState, setButtonState] = useState<'default' | 'success' | 'error'>('default');
  const [buttonMessage, setButtonMessage] = useState<string>('');
  
  // Form state
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [billingFrequency, setBillingFrequency] = useState<'monthly' | 'annual'>('monthly');
  const [seatsTotal, setSeatsTotal] = useState<string>('1');
  const [reason, setReason] = useState<string>('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Initialize form when subscription changes
  useEffect(() => {
    if (subscription && visible) {
      setSelectedPlanId(subscription.plan_id);
      setBillingFrequency(subscription.billing_frequency as 'monthly' | 'annual');
      setSeatsTotal(String(subscription.seats_total));
      setReason('');
      
      // Reset button state
      setButtonState('default');
      setButtonMessage('');
      
      // Track modal opened
      track('sa_subs_upgrade_modal_opened', {
        subscription_id: subscription.id,
        school_id: subscription.school_id,
      });
    }
    
    // Reset button state when modal closes
    if (!visible) {
      setButtonState('default');
      setButtonMessage('');
    }
  }, [subscription, visible]);

  // Fetch plans on modal open
  useEffect(() => {
    if (visible) {
      fetchPlans();
    }
  }, [visible]);

  const fetchPlans = async () => {
    try {
      setPlansLoading(true);
      const plansData = await listActivePlans(assertSupabase());
      
      // Sort plans from lowest to highest (Free → Starter → Basic → Premium → Pro → Enterprise)
      const sortedPlans = plansData.sort((a, b) => {
        // Define tier hierarchy
        const tierOrder: Record<string, number> = {
          'free': 0,
          'starter': 1, 
          'basic': 2,
          'premium': 3,
          'pro': 4,
          'enterprise': 5
        };
        
        const aTierLower = (a.tier || '').toLowerCase();
        const bTierLower = (b.tier || '').toLowerCase();
        
        const aOrder = tierOrder[aTierLower] ?? 999;
        const bOrder = tierOrder[bTierLower] ?? 999;
        
        // Primary sort by tier hierarchy
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        
        // Secondary sort by monthly price
        return (a.price_monthly || 0) - (b.price_monthly || 0);
      });
      
      setPlans(sortedPlans);
    } catch (error: any) {
      console.error('Failed to fetch plans:', error);
      Alert.alert('Error', 'Failed to load subscription plans');
    } finally {
      setPlansLoading(false);
    }
  };

  const getCurrentPlan = () => {
    return plans.find(p => p.id === subscription?.plan_id || p.tier === subscription?.plan_id);
  };

  const getSelectedPlan = () => {
    return plans.find(p => p.id === selectedPlanId || p.tier === selectedPlanId);
  };

  const isPaymentRequired = () => {
    const currentPlan = getCurrentPlan();
    const newPlan = getSelectedPlan();
    
    if (!currentPlan || !newPlan) return false;
    
    const currentPrice = billingFrequency === 'annual' ? currentPlan.price_annual : currentPlan.price_monthly;
    const newPrice = billingFrequency === 'annual' ? newPlan.price_annual : newPlan.price_monthly;
    
    // Payment required if moving to a paid plan or changing between paid plans
    return newPrice > 0 || (currentPrice > 0 && newPrice !== currentPrice);
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    const oldPlan = getCurrentPlan();
    // Always store the plan UUID as the selected plan id for updates
    setSelectedPlanId(plan.id);
    setSeatsTotal(String(plan.max_teachers || 1));
    
    // Track plan selection
    track('sa_subs_upgrade_plan_selected', {
      subscription_id: subscription?.id,
      old_plan: oldPlan?.tier || oldPlan?.id,
      new_plan: plan.tier || plan.id,
      freq: billingFrequency,
    });
  };

  const handleConfirm = async () => {
    if (!subscription || !school) return;
    
    const currentPlan = getCurrentPlan();
    const newPlan = getSelectedPlan();
    
    if (!currentPlan || !newPlan) {
      Alert.alert('Error', 'Please select a valid plan');
      return;
    }

    // On web, React Native Alert doesn't support multi-button confirm properly.
    // Bypass the dialog and proceed directly.
    if (Platform.OS === 'web') {
      track('sa_subs_upgrade_confirmed', {
        subscription_id: subscription.id,
        target_plan: newPlan.tier || newPlan.id,
        freq: billingFrequency,
        seats: parseInt(seatsTotal) || 1,
      });
      if (isPaymentRequired()) {
        await handlePaymentFlow();
      } else {
        await handleDirectUpdate();
      }
      return;
    }

    // Native: show confirmation dialog
    const currentPlanName = currentPlan.name;
    const newPlanName = newPlan.name;
    const paymentNote = isPaymentRequired() 
      ? '\n\nThis change may redirect you to PayFast for payment confirmation.'
      : '';

    Alert.alert(
      'Confirm Plan Change',
      `Change plan for ${school.name} from "${currentPlanName}" to "${newPlanName}"?${paymentNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            track('sa_subs_upgrade_confirmed', {
              subscription_id: subscription.id,
              target_plan: newPlan.tier || newPlan.id,
              freq: billingFrequency,
              seats: parseInt(seatsTotal) || 1,
            });
            
            if (isPaymentRequired()) {
              await handlePaymentFlow();
            } else {
              await handleDirectUpdate();
            }
          }
        }
      ]
    );
  };

  const handleDirectUpdate = async () => {
    if (!subscription) return;
    
    try {
      setLoading(true);
      setButtonState('default');
      
      await adminUpdateSubscriptionPlan(assertSupabase(), {
        subscriptionId: subscription.id,
        newPlanId: selectedPlanId,
        billingFrequency,
        seatsTotal: parseInt(seatsTotal) || 1,
        reason: reason || 'Plan changed by SuperAdmin',
        metadata: {
          changed_via: 'superadmin_dashboard',
          payment_required: false,
        }
      });

      track('sa_subs_upgrade_succeeded', {
        subscription_id: subscription.id,
        new_plan: selectedPlanId,
        freq: billingFrequency,
      });

      // Show success state with haptic feedback
      setButtonState('success');
      setButtonMessage('Plan updated successfully!');
      
      // Haptic feedback for success
      if (Platform.OS !== 'web') {
        try {
          Vibration.vibrate([100, 50, 100]); // Short success pattern
        } catch (e) {
          console.debug('Vibration not available');
        }
      }
      
      // Wait a moment for user to see success, then close
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000); // Slightly longer to show success
      
    } catch (error: any) {
      console.error('Failed to update subscription:', error);
      
      track('sa_subs_upgrade_failed', {
        subscription_id: subscription.id,
        error: error.message,
      });
      
      // Show error state with haptic feedback
      setButtonState('error');
      setButtonMessage(error.message || 'Failed to update subscription');
      
      // Haptic feedback for error
      if (Platform.OS !== 'web') {
        try {
          Vibration.vibrate([200, 100, 200]); // Longer error pattern
        } catch (e) {
          console.debug('Vibration not available');
        }
      }
      
      // Reset to default after showing error
      setTimeout(() => {
        setButtonState('default');
        setButtonMessage('');
      }, 4000); // Slightly longer for error messages
      
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentFlow = async () => {
    if (!subscription || !school) return;
    
    try {
      setLoading(true);
      setButtonState('default');
      
      track('sa_subs_upgrade_payment_notification_sent', {
        subscription_id: subscription.id,
        plan: selectedPlanId,
        freq: billingFrequency,
        school_id: school.id,
      });

      // Calculate the new plan amount for notification
      const newPlan = getSelectedPlan();
      const amount = billingFrequency === 'annual' ? (newPlan?.price_annual || 0) : (newPlan?.price_monthly || 0);
      
      // First update the subscription to pending_payment status
      await adminUpdateSubscriptionPlan(assertSupabase(), {
        subscriptionId: subscription.id,
        newPlanId: selectedPlanId,
        billingFrequency,
        seatsTotal: parseInt(seatsTotal) || 1,
        reason: reason || 'Plan change by SuperAdmin - requires payment confirmation',
        metadata: {
          changed_via: 'superadmin_dashboard',
          payment_required: true,
          previous_status: subscription.status,
          payment_amount: amount,
        }
      });
      
      // Send payment notification to school
      try {
        const { notifyPaymentRequired } = await import('@/lib/notify');
        await notifyPaymentRequired(school.id, subscription.id, selectedPlanId, amount);
      } catch (notificationError) {
        console.warn('Failed to send payment notification:', notificationError);
      }

      // Show success state
      setButtonState('success');
      setButtonMessage('✅ School notified to complete payment');
      
      // Haptic feedback for success
      if (Platform.OS !== 'web') {
        try {
          Vibration.vibrate([100, 50, 100]); // Success pattern
        } catch (e) {
          console.debug('Vibration not available');
        }
      }
      
      track('sa_subs_upgrade_notification_sent', {
        subscription_id: subscription.id,
        new_plan: selectedPlanId,
        freq: billingFrequency,
        amount: amount,
      });
      
      // Wait longer to show the success message
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);
      
    } catch (error: any) {
      console.error('Payment notification error:', error);
      
      track('sa_subs_upgrade_failed', {
        subscription_id: subscription.id,
        error: `Notification error: ${error.message}`,
      });
      
      // Show error state with haptic feedback
      setButtonState('error');
      setButtonMessage(error.message || 'Failed to notify school for payment');
      
      // Haptic feedback for error
      if (Platform.OS !== 'web') {
        try {
          Vibration.vibrate([200, 100, 200]); // Error pattern
        } catch (e) {
          console.debug('Vibration not available');
        }
      }
      
      // Reset after showing error
      setTimeout(() => {
        setButtonState('default');
        setButtonMessage('');
      }, 4000);
      
    } finally {
      setLoading(false);
    }
  };

  const getTierDisplayInfo = (tier: string) => {
    const tierLower = (tier || '').toLowerCase();
    const tierInfo: Record<string, { emoji: string; level: string; color: string }> = {
      'free': { emoji: '🆓', level: 'Free Tier', color: '#6b7280' },
      'starter': { emoji: '🚀', level: 'Starter', color: '#3b82f6' },
      'basic': { emoji: '📊', level: 'Basic', color: '#06b6d4' },
      'premium': { emoji: '⭐', level: 'Premium', color: '#8b5cf6' },
      'pro': { emoji: '💎', level: 'Pro', color: '#f59e0b' },
      'enterprise': { emoji: '🏢', level: 'Enterprise', color: '#ef4444' }
    };
    return tierInfo[tierLower] || { emoji: '📦', level: tier, color: '#6b7280' };
  };

  const renderPlanOption = (plan: SubscriptionPlan) => {
    const isSelected = selectedPlanId === plan.tier || selectedPlanId === plan.id;
    const isCurrent = subscription?.plan_id === plan.tier || subscription?.plan_id === plan.id;
    const price = billingFrequency === 'annual' ? plan.price_annual : plan.price_monthly;
    const tierInfo = getTierDisplayInfo(plan.tier);
    
    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planOption,
          { borderColor: theme.border },
          isSelected && { borderColor: theme.primary, backgroundColor: `${theme.primary}11` },
          isCurrent && { borderColor: '#10b981', backgroundColor: '#10b98111' }
        ]}
        onPress={() => handlePlanSelect(plan)}
      >
        <View style={styles.planHeader}>
          <View style={styles.planTitleRow}>
            <Text style={[styles.planEmoji]}>{tierInfo.emoji}</Text>
            <View style={styles.planTitleText}>
              <Text style={[styles.planName, { color: theme.text }]}>
                {plan.name}
              </Text>
              <Text style={[styles.planTierLabel, { color: tierInfo.color }]}>
                {tierInfo.level} {isCurrent && '• Current Plan'}
              </Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.planPrice, { color: theme.primary }]}>
              {price === 0 ? 'FREE' : `R${price}`}
            </Text>
            {price > 0 && (
              <Text style={[styles.priceFrequency, { color: theme.textTertiary }]}>
                /{billingFrequency === 'annual' ? 'year' : 'month'}
              </Text>
            )}
          </View>
        </View>
        <Text style={[styles.planDetails, { color: theme.textSecondary }]}>
          Up to {plan.max_teachers} teachers • {plan.max_students} students
        </Text>
      </TouchableOpacity>
    );
  };

  if (!visible || !subscription || !school) return null;

  const currentPlan = getCurrentPlan();
  const newPlan = getSelectedPlan();
  const currentPrice = currentPlan ? (billingFrequency === 'annual' ? currentPlan.price_annual : currentPlan.price_monthly) : 0;
  const newPrice = newPlan ? (billingFrequency === 'annual' ? newPlan.price_annual : newPlan.price_monthly) : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
<Text style={[styles.backButtonText, { color: theme.onPrimary }]}>{t('navigation.back', { defaultValue: 'Back' })}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
{t('subscription.changePlanFor', { name: school?.name, defaultValue: 'Change Plan - {{name}}' })}
          </Text>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.surface }]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: theme.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Current Plan Summary */}
          {currentPlan && (
            <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
<Text style={[styles.summaryTitle, { color: theme.text }]}>{t('subscription.currentPlan', { defaultValue: 'Current Plan' })}</Text>
              <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                {currentPlan.name} • {subscription.billing_frequency} • {subscription.seats_total} seats
              </Text>
              <Text style={[styles.summaryPrice, { color: theme.textSecondary }]}>
R{currentPrice}/{subscription.billing_frequency === 'annual' ? t('time.year', { defaultValue: 'year' }) : t('time.month', { defaultValue: 'month' })}
              </Text>
            </View>
          )}

          {/* Plan Selection */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
{t('subscription.selectNewPlan', { count: plans.length, defaultValue: 'Select New Plan ({{count}} available)' })}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textTertiary }]}>
            {t('subscription.planOrderHint', { defaultValue: 'Plans are ordered from lowest to highest tier' })}
          </Text>
          
          {plansLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t('pricing.loading', { defaultValue: 'Loading pricing plans...' })}</Text>
            </View>
          ) : (
            <>
              {plans.map(renderPlanOption)}
            </>
          )}

          {/* Billing Frequency */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('subscription.billingFrequency', { defaultValue: 'Billing Frequency' })}</Text>
          <View style={styles.billingRow}>
            {(['monthly', 'annual'] as const).map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[
                  styles.billingOption,
                  { borderColor: theme.border },
                  billingFrequency === freq && { borderColor: theme.primary, backgroundColor: `${theme.primary}22` }
                ]}
                onPress={() => setBillingFrequency(freq)}
              >
                <Text style={[
                  styles.billingOptionText,
                  { color: theme.textSecondary },
                  billingFrequency === freq && { color: theme.primary, fontWeight: '700' }
                ]}>
                  {t(`subscription.billing_${freq}`, { defaultValue: freq.charAt(0).toUpperCase() + freq.slice(1) })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Seats */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('subscription.numberOfSeats', { defaultValue: 'Number of Seats' })}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={seatsTotal}
            onChangeText={setSeatsTotal}
            keyboardType="numeric"
            placeholder={t('subscription.enterSeats', { defaultValue: 'Enter number of seats' })}
            placeholderTextColor={theme.textTertiary}
          />

          {/* Reason (Optional) */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('subscription.reasonOptional', { defaultValue: 'Reason (Optional)' })}</Text>
          <TextInput
            style={[styles.reasonInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={reason}
            onChangeText={setReason}
            placeholder={t('subscription.reasonPlaceholder', { defaultValue: 'Reason for plan change...' })}
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={3}
          />

          {/* Change Summary */}
          {newPlan && (
            <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
              <View style={styles.summaryHeader}>
                <Text style={[styles.summaryTitle, { color: theme.text }]}>{t('subscription.changeSummary', { defaultValue: 'Change Summary' })}</Text>
                {newPrice > currentPrice && (
                  <View style={[styles.upgradeBadge, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.upgradeBadgeText, { color: theme.primary }]}>{t('subscription.upgrade', { defaultValue: 'UPGRADE' })}</Text>
                  </View>
                )}
                {newPrice < currentPrice && (
                  <View style={[styles.downgradeBadge, { backgroundColor: '#ef4444' + '20' }]}>
                    <Text style={[styles.downgradeBadgeText, { color: '#ef4444' }]}>{t('subscription.downgrade', { defaultValue: 'DOWNGRADE' })}</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.changeRow}>
                <Text style={[styles.changeLabel, { color: theme.textTertiary }]}>{t('subscription.plan', { defaultValue: 'Plan' })}</Text>
                <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                  {currentPlan?.name || 'Unknown'} → {newPlan.name}
                </Text>
              </View>
              
              <View style={styles.changeRow}>
                <Text style={[styles.changeLabel, { color: theme.textTertiary }]}>{t('subscription.billing', { defaultValue: 'Billing' })}</Text>
                <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                  {subscription.billing_frequency} → {billingFrequency}
                </Text>
              </View>
              
              <View style={styles.changeRow}>
                <Text style={[styles.changeLabel, { color: theme.textTertiary }]}>{t('subscription.seatsLabel', { defaultValue: 'Seats' })}</Text>
                <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                  {subscription.seats_total} → {seatsTotal} seats
                </Text>
              </View>
              
              <View style={[styles.priceRow, { borderTopColor: theme.border }]}>
                <Text style={[styles.summaryPrice, { color: theme.primary }]}>
                  R{currentPrice} → R{newPrice}/{billingFrequency === 'annual' ? t('time.year', { defaultValue: 'year' }) : t('time.month', { defaultValue: 'month' })}
                </Text>
                {newPrice > currentPrice && (
                  <Text style={[styles.priceIncrease, { color: theme.primary }]}>
                    +R{newPrice - currentPrice}
                  </Text>
                )}
              </View>
              
              {isPaymentRequired() && (
                <View style={[styles.paymentNotice, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
                  <Text style={[styles.paymentIcon, { color: theme.primary }]}>💳</Text>
                  <Text style={[styles.billingNote, { color: theme.primary, flex: 1 }]}>
                    {t('subscription.paymentRequiredNotice', { defaultValue: 'Payment required - The school principal will be notified via email and push notification to complete payment via PayFast.' })}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.border }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>{t('common.cancel', { defaultValue: 'Cancel' })}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.confirmButton,
              { backgroundColor: theme.primary },
              (loading || !selectedPlanId) && { backgroundColor: theme.border, opacity: 0.6 },
              buttonState === 'success' && { 
                backgroundColor: '#10b981',
                shadowColor: '#10b981',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4
              },
              buttonState === 'error' && { 
                backgroundColor: '#ef4444',
                shadowColor: '#ef4444',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4
              }
            ]}
            onPress={handleConfirm}
            disabled={loading || !selectedPlanId || buttonState === 'success'}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color={theme.onPrimary} style={{ marginRight: 8 }} />
                <Text style={[styles.confirmButtonText, { color: theme.onPrimary }]}>{t('common.processing', { defaultValue: 'Processing...' })}</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                {buttonState === 'success' && (
                  <View style={styles.successIcon}>
                    <Text style={styles.buttonIcon}>✓</Text>
                  </View>
                )}
                {buttonState === 'error' && (
                  <View style={styles.errorIcon}>
                    <Text style={styles.buttonIcon}>⚠️</Text>
                  </View>
                )}
                {buttonState === 'default' && (
                  <Text style={[styles.buttonIcon, { opacity: 0.8 }]}>
                    {isPaymentRequired() ? '💳' : '✨'}
                  </Text>
                )}
                <Text style={[styles.confirmButtonText, { color: theme.onPrimary }]}>
{buttonMessage || (isPaymentRequired() ? t('subscription.notifySchoolToPay', { defaultValue: 'Notify School to Pay' }) : t('subscription.confirmChange', { defaultValue: 'Confirm Change' }))}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryPrice: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  billingNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 16,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  planOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  planEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  planTitleText: {
    flex: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  planTierLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  priceFrequency: {
    fontSize: 12,
    marginTop: -2,
  },
  planDetails: {
    fontSize: 14,
    marginBottom: 4,
  },
  planId: {
    fontSize: 12,
  },
  billingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  billingOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  billingOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#ffffff',
  },
  successIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 4,
    marginRight: 8,
  },
  errorIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 4,
    marginRight: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  upgradeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  downgradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  downgradeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  changeLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 60,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 8,
  },
  priceIncrease: {
    fontSize: 14,
    fontWeight: '700',
  },
  paymentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  paymentIcon: {
    fontSize: 16,
    marginRight: 8,
  },
});
