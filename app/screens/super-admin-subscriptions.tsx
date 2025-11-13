import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Linking } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useTheme } from '@/contexts/ThemeContext';
import PlanChangeModal from '@/components/super-admin/subscriptions/PlanChangeModal';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';

interface School {
  id: string;
  name: string;
  tenant_slug: string | null;
  subscription_tier: string | null;
  email: string | null;
}

interface Subscription {
  id: string;
  school_id: string;
  plan_id: string;
  status: string;
  seats_total: number;
  seats_used: number;
  billing_frequency: string;
  start_date: string;
  end_date: string;
  created_at: string;
  metadata?: Record<string, any>;
  school?: School;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  tier: string;
  price_monthly: number;
  price_annual?: number;
  max_teachers: number;
  max_students: number;
}

export default function SuperAdminSubscriptionsScreen() {
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    school_id: '',
    plan_tier: 'basic', // human-readable tier for UI only
    plan_id: '',        // actual plan id to store on subscriptions
    billing_frequency: 'monthly',
    seats_total: '10',
  });
  
  // Plan change modal state
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [selectedSubscriptionForChange, setSelectedSubscriptionForChange] = useState<Subscription | null>(null);
  const [selectedSchoolForChange, setSelectedSchoolForChange] = useState<School | null>(null);
  
  // Debug form state changes
  React.useEffect(() => {
    console.log('Form state updated:', createForm);
  }, [createForm]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch subscriptions with school data
      let subQuery = assertSupabase()
        .from('subscriptions')
        .select(`
          *,
          preschools!subscriptions_school_id_fkey (
            id,
            name,
            tenant_slug,
            subscription_tier,
            email
          )
        `)
        .eq('owner_type', 'school')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        subQuery = subQuery.eq('status', filter);
      }

      const { data: subsData, error: subsError } = await subQuery;
      if (subsError) throw subsError;

      // Transform the data
      const transformedSubs = (subsData || []).map(sub => ({
        ...sub,
        school: Array.isArray(sub.preschools) ? sub.preschools[0] : sub.preschools
      }));

      setSubscriptions(transformedSubs);

      // Fetch schools for creation via secure RPC (bypasses RLS safely and returns minimal columns)
      let schoolsData: any[] = [];
      try {
        const { data, error } = await assertSupabase().rpc('public_list_schools');
        if (error) throw error;
        schoolsData = data || [];
      } catch (schoolErr: any) {
        console.error('School RPC error:', schoolErr?.message || schoolErr);
        schoolsData = [];
      }

      setSchools(schoolsData || []);
      console.log('Available schools for subscription creation:', schoolsData?.map((s: any) => ({ id: String(s.id).substring(0, 8) + '...', name: s.name })));

  // Fetch available subscription plans via secure RPC (no hardcoding)
      let plansData: any[] = [];
      try {
        const { data, error } = await assertSupabase().rpc('public_list_plans');
        if (error) throw error;
        plansData = (data || []).map((p: any) => {
          // Normalize names (e.g., "Pro Plan" -> "Pro Plus")
          const normalizedName = p.name === 'Pro Plan' ? 'Pro Plus' : p.name;
          return { ...p, name: normalizedName };
        });
        // Order tiers from free to highest
        const order: Record<string, number> = { free: 0, starter: 1, basic: 2, premium: 3, pro: 4, enterprise: 5 };
        plansData.sort((a: any, b: any) => {
          const at = (a.tier || '').toLowerCase();
          const bt = (b.tier || '').toLowerCase();
          const ao = order[at] ?? 999;
          const bo = order[bt] ?? 999;
          if (ao !== bo) return ao - bo;
          // fallback by price
          return (a.price_monthly ?? 0) - (b.price_monthly ?? 0);
        });
      } catch (planErr: any) {
        console.error('Plan RPC error:', planErr?.message || planErr);
        plansData = [];
      }

      console.log('Loaded subscription plans:', plansData?.length || 0);
      console.log('Plans structure check:', plansData?.map((p: any) => ({ id: p.id, name: p.name, tier: p.tier, seats: p.max_teachers, price: p.price_monthly })));
      setPlans(plansData || []);

    } catch (e) {
      console.error('Failed to fetch subscription data:', e);
      Alert.alert('Error', 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const updateSubscriptionStatus = async (id: string, status: 'active' | 'cancelled' | 'expired') => {
    try {
      const { error } = await assertSupabase()
        .from('subscriptions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      track('subscription_status_updated', { subscription_id: id, status });
      setSubscriptions(prev =>
        prev.map(sub => (sub.id === id ? { ...sub, status } : sub))
      );
      Alert.alert('Success', `Subscription ${status}`);
    } catch (e: any) {
      console.error('Failed to update subscription status:', e);
      Alert.alert('Error', e.message || 'Failed to update subscription');
    }
  };

  const createSubscription = async () => {
    console.log('createSubscription called with form:', createForm);
    
    if (!createForm.school_id || !createForm.plan_tier) {
      console.log('Missing school or plan:', { school_id: createForm.school_id, plan_tier: createForm.plan_tier });
      Alert.alert('Error', 'Please select a school and plan');
      return;
    }
    
    // Validate that the selected school exists in our schools array
    const selectedSchool = schools.find(s => s.id === createForm.school_id);
    if (!selectedSchool) {
      console.error('Selected school not found in schools array:', {
        selectedId: createForm.school_id,
        availableSchools: schools.map(s => ({ id: s.id.substring(0, 8) + '...', name: s.name }))
      });
      Alert.alert('Error', 'Selected school is invalid. Please refresh and try again.');
      return;
    }
    console.log('Selected school validated:', { id: selectedSchool.id.substring(0, 8) + '...', name: selectedSchool.name });

    setCreating(true);
    try {
      console.log('Available plans:', plans);
      const selectedPlan = plans.find(p => {
        const key = (p.tier || p.id || p.name?.toLowerCase()?.replace(/\s+/g, '_'));
        return key === createForm.plan_tier || p.id === createForm.plan_id;
      });
      console.log('Selected plan:', selectedPlan);
      console.log('Looking for plan with tier:', createForm.plan_tier);
      
      if (!selectedPlan) {
        console.log('Plan not found for tier:', createForm.plan_tier);
        Alert.alert('Error', 'Selected plan not found');
        return;
      }

      const seatsTotal = parseInt(createForm.seats_total) || selectedPlan.max_teachers || 10;
      const startDate = new Date();
      const endDate = new Date(startDate);
      
      if (createForm.billing_frequency === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      // CRITICAL: Determine initial status based on plan pricing
      const isPaidPlan = (selectedPlan.price_monthly || 0) > 0 || (selectedPlan.price_annual || 0) > 0;
      const initialStatus = isPaidPlan ? 'pending_payment' : 'active';
      
      const subscriptionData = {
        school_id: createForm.school_id,
        plan_id: selectedPlan.id, // Always use the UUID from selectedPlan
        status: initialStatus, // Only free plans are immediately active
        owner_type: 'school' as const,
        billing_frequency: createForm.billing_frequency,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        next_billing_date: endDate.toISOString(),
        seats_total: seatsTotal,
        seats_used: 0,
        metadata: {
          plan_name: selectedPlan.name,
          created_by: 'superadmin',
          requires_payment: isPaidPlan,
        }
      };
      
      console.log('Creating subscription with data:', subscriptionData);

      // Create subscription via secure RPC (enforces role checks and bypasses RLS safely)
      const startTrial = (selectedPlan.tier || '').toLowerCase() === 'free';
      const { data: newId, error } = await assertSupabase().rpc('admin_create_school_subscription', {
        p_school_id: subscriptionData.school_id,
        p_plan_id: subscriptionData.plan_id,
        p_billing_frequency: subscriptionData.billing_frequency,
        p_seats_total: subscriptionData.seats_total,
        p_start_trial: startTrial,
      });

      console.log('RPC create response:', { id: newId, error });

      if (error) {
        console.error('Subscription RPC error:', error);
        throw error;
      }

      const data = { id: newId } as any;

      // Update school subscription metadata to match (safe fields only)
      // Use secure RPC to bypass RLS policies safely
      const { data: updateResult, error: updateError } = await assertSupabase()
        .rpc('update_preschool_subscription', {
          p_preschool_id: createForm.school_id,
          p_subscription_tier: createForm.plan_tier,
          p_subscription_status: 'active',
          p_subscription_plan_id: subscriptionData.plan_id
        });
      
      if (updateError) {
        console.error('Failed to update preschool subscription metadata:', updateError);
        // Don't fail the whole process for this, just log it
      }

      track('subscription_created_by_admin', {
        subscription_id: data.id,
        school_id: createForm.school_id,
        plan_tier: createForm.plan_tier,
        seats_total: seatsTotal
      });
      try {
        const { notifySubscriptionCreated } = await import('@/lib/notify');
        await notifySubscriptionCreated(createForm.school_id, createForm.plan_tier);
      } catch (error) {
        console.warn('Failed to send notification:', error);
      }

      // Handle messaging based on plan type and payment requirement
      if (isPaidPlan) {
        // Calculate amount for notification
        const amount = createForm.billing_frequency === 'annual' 
          ? selectedPlan.price_annual || 0 
          : selectedPlan.price_monthly || 0;
        
        // Send notification to school principal for payment
        try {
          const { notifyPaymentRequired, notifySubscriptionPendingPayment } = await import('@/lib/notify');
          await notifyPaymentRequired(createForm.school_id, data.id, createForm.plan_tier, amount);
          await notifySubscriptionPendingPayment(createForm.school_id, data.id, selectedPlan.name);
        } catch (error) {
          console.warn('Failed to send payment notifications:', error);
        }
        
        Alert.alert(
          'Paid Subscription Created',
          `Subscription created with status 'pending_payment'.\n\n✅ The school principal has been notified via email and push notification to complete payment.\n\n💡 The school will have limited access until payment is confirmed via PayFast.`,
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Manual Override', 
              style: 'destructive',
              onPress: () => {
                Alert.alert(
                  'Manual Activation',
                  'You can manually activate this subscription from the subscriptions list if needed for exceptional circumstances.',
                  [{ text: 'Understood', style: 'default' }]
                );
              }
            }
          ]
        );
      } else {
        Alert.alert('Success', 'Free subscription created and activated successfully!');
      }

      setShowCreateModal(false);
      setCreateForm({
        school_id: '',
        plan_tier: '',
        plan_id: '',
        billing_frequency: 'monthly',
        seats_total: '1',
      });
      await fetchData();

    } catch (e: any) {
      console.error('Failed to create subscription:', e);
      Alert.alert('Error', e.message || 'Failed to create subscription');
    } finally {
      setCreating(false);
    }
  };

  const openPlanChangeModal = (subscription: Subscription) => {
    setSelectedSubscriptionForChange(subscription);
    setSelectedSchoolForChange(subscription.school || null);
    setShowPlanChangeModal(true);
  };

  const closePlanChangeModal = () => {
    setShowPlanChangeModal(false);
    setSelectedSubscriptionForChange(null);
    setSelectedSchoolForChange(null);
  };

  const handlePlanChangeSuccess = async () => {
    // Refetch data after successful plan change
    await fetchData();
  };

  const handleManualActivation = async (subscription: Subscription) => {
    Alert.alert(
      'Manually Activate Subscription',
      `Are you sure you want to activate the subscription for ${subscription.school?.name || 'Unknown School'} without payment confirmation?\n\nThis should only be used in exceptional circumstances and will be logged for audit purposes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          style: 'default',
          onPress: async () => {
            try {
              const { error } = await assertSupabase()
                .from('subscriptions')
                .update({ 
                  status: 'active',
                  metadata: {
                    ...subscription.metadata,
                    manual_activation: true,
                    manual_activation_by: 'superadmin',
                    manual_activation_at: new Date().toISOString(),
                    manual_activation_reason: 'SuperAdmin override - no payment confirmation'
                  }
                })
                .eq('id', subscription.id);

              if (error) throw error;

              // Track the manual activation for audit
              track('subscription_manually_activated', {
                subscription_id: subscription.id,
                school_id: subscription.school_id,
                original_status: subscription.status,
                reason: 'superadmin_override'
              });

              Alert.alert('Success', 'Subscription activated manually. This action has been logged.');
              await fetchData();
            } catch (e: any) {
              console.error('Failed to manually activate subscription:', e);
              Alert.alert('Error', e.message || 'Failed to activate subscription');
            }
          }
        }
      ]
    );
  };

  const deleteSubscription = async (id: string, schoolName: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete the subscription for ${schoolName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await assertSupabase()
                .from('subscriptions')
                .delete()
                .eq('id', id);

              if (error) throw error;

              track('subscription_deleted_by_admin', { subscription_id: id });
              Alert.alert('Success', 'Subscription deleted');
              await fetchData();
            } catch (e: any) {
              console.error('Failed to delete subscription:', e);
              Alert.alert('Error', e.message || 'Failed to delete subscription');
            }
          }
        }
      ]
    );
  };

  const availableSchools = schools.filter(school => 
    !subscriptions.some(sub => sub.school_id === school.id && sub.status === 'active')
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen 
        options={{ 
          title: 'Manage Subscriptions',
          headerBackVisible: true,
          headerShown: true,
          headerStyle: { backgroundColor: '#0b1220' },
          headerTitleStyle: { color: '#ffffff', fontWeight: '700' },
          headerTintColor: '#00f5ff',
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                try {
                  if (Platform.OS === 'web') {
                    // Use browser history if available; otherwise fall back to dashboard
                    // @ts-ignore
                    if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
                      // @ts-ignore
                      window.history.back();
                      return;
                    }
                    router.replace('/screens/super-admin-dashboard' as any);
                    return;
                  }
                  router.back();
                } catch {
                  router.replace('/screens/super-admin-dashboard' as any);
                }
              }}
              accessibilityLabel="Go back"
              style={{ paddingHorizontal: 8 }}
            >
              <Ionicons name="arrow-back" size={22} color="#00f5ff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar style="light" backgroundColor="#0b1220" />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0b1220' }}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          style={{ backgroundColor: '#0b1220' }}
        >
          {/* Header Actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => {
                console.log('Create Subscription button clicked');
                setShowCreateModal(true);
              }}
            >
              <Text style={styles.createButtonText}>+ Create Subscription</Text>
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={styles.filtersRow}>
            {['all', 'active', 'pending_payment', 'cancelled', 'expired'].map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => setFilter(status)}
                style={[styles.filterChip, filter === status && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, filter === status && styles.filterChipTextActive]}>
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && <Text style={styles.loading}>Loading subscriptions...</Text>}

          {/* Subscriptions List */}
          {subscriptions.map((subscription) => (
            <View key={subscription.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.schoolName}>
                  {subscription.school?.name || 'Unknown School'}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(subscription.status) }]}>
                  <Text style={styles.statusText}>{subscription.status}</Text>
                </View>
              </View>

              <Text style={styles.cardDetail}>
                Tenant: {subscription.school?.tenant_slug || 'N/A'}
              </Text>
              <Text style={styles.cardDetail}>
                Plan: {subscription.plan_id} • {subscription.billing_frequency}
              </Text>
              <Text style={styles.cardDetail}>
                Seats: {subscription.seats_used}/{subscription.seats_total}
              </Text>
              <Text style={styles.cardDetail}>
                Period: {new Date(subscription.start_date).toLocaleDateString()} - {new Date(subscription.end_date).toLocaleDateString()}
              </Text>

              {/* Actions */}
              <View style={styles.actionsRow}>
                {/* Upgrade/Change Plan Button - Available for active subscriptions */}
                {subscription.status === 'active' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.upgradeButton]}
                    onPress={() => openPlanChangeModal(subscription)}
                  >
                    <Text style={styles.upgradeButtonText}>Upgrade Plan</Text>
                  </TouchableOpacity>
                )}

                {subscription.status === 'active' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => updateSubscriptionStatus(subscription.id, 'cancelled')}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}
                
                {subscription.status === 'cancelled' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.activateButton]}
                    onPress={() => updateSubscriptionStatus(subscription.id, 'active')}
                  >
                    <Text style={styles.activateButtonText}>Reactivate</Text>
                  </TouchableOpacity>
                )}
                
                {/* Manual activation for pending payments */}
                {subscription.status === 'pending_payment' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.activateButton]}
                    onPress={() => handleManualActivation(subscription)}
                  >
                    <Text style={styles.activateButtonText}>Activate Manually</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => deleteSubscription(subscription.id, subscription.school?.name || 'Unknown School')}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {!loading && subscriptions.length === 0 && (
            <View style={[styles.card, { borderColor: '#2563eb' }]}>
              <Text style={{ color: '#93c5fd', fontWeight: '800', marginBottom: 6 }}>No school-owned subscriptions</Text>
              <Text style={{ color: '#9CA3AF', marginBottom: 8 }}>
                Legacy user-owned subscriptions do not appear here. Create a school-owned subscription or seed a free plan for a school.
              </Text>
              {/* Quick actions */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity 
                  style={[styles.createButton, { flex: 1 }]} 
                  onPress={() => setShowCreateModal(true)}
                >
                  <Text style={styles.createButtonText}>+ Create Subscription</Text>
                </TouchableOpacity>
              </View>

              {/* Seed free plan helper */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.cardDetail, { marginBottom: 6 }]}>Seed a free plan for a school</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {availableSchools.map((school) => (
                    <TouchableOpacity
                      key={school.id}
                      style={[styles.schoolChip, { marginRight: 8 }]}
                      onPress={async () => {
                        try {
                          // Prefer a dedicated RPC if available
                          const { error: ensureErr } = await assertSupabase().rpc('ensure_school_free_subscription', {
                            p_school_id: school.id,
                            p_seats: 3,
                          });
                          if (ensureErr) {
                            // Fallback: use admin_create_school_subscription with a free plan id
                            const freePlan = plans.find(p => (p.tier || '').toLowerCase() === 'free');
                            if (!freePlan) {
                              throw new Error('No free plan available. Please create plans first.');
                            }
                            const { error: createErr } = await assertSupabase().rpc('admin_create_school_subscription', {
                              p_school_id: school.id,
                              p_plan_id: freePlan.id,
                              p_billing_frequency: 'monthly',
                              p_seats_total: 3,
                            });
                            if (createErr) throw createErr;
                          }
                          Alert.alert('Success', `Seeded free plan for ${school.name}`);
                          await fetchData();
                        } catch (e: any) {
                          Alert.alert('Error', e?.message || 'Failed to seed free plan');
                        }
                      }}
                    >
                      <Text style={styles.schoolChipText}>{school.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Create Subscription Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <ScreenHeader
            title="Create Subscription"
            onBackPress={() => setShowCreateModal(false)}
            rightAction={
              <TouchableOpacity onPress={() => setShowCreateModal(false)} accessibilityLabel="Close modal">
                <Ionicons name="close" size={24} color={theme?.text || '#ffffff'} />
              </TouchableOpacity>
            }
          />

          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
            {/* School Selection */}
            <Text style={styles.formLabel}>Select School</Text>
            <ScrollView horizontal style={styles.schoolsScroll}>
              {availableSchools.map((school) => (
                <TouchableOpacity
                  key={school.id}
                  style={[
                    styles.schoolChip,
                    createForm.school_id === school.id && styles.schoolChipSelected
                  ]}
                  onPress={() => setCreateForm({ ...createForm, school_id: school.id })}
                >
                  <Text style={[
                    styles.schoolChipText,
                    createForm.school_id === school.id && styles.schoolChipTextSelected
                  ]}>
                    {school.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Plan Selection */}
            <Text style={styles.formLabel}>Select Plan ({plans.length} plans loaded)</Text>
            <Text style={[styles.formLabel, { fontSize: 12, color: '#666' }]}>Current: {createForm.plan_tier || 'None selected'}</Text>
            {/* Plan tier order: free → starter → basic → premium → pro → enterprise */}
            {plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planOption,
                  createForm.plan_tier === (plan.tier || plan.id || plan.name?.toLowerCase()?.replace(/\s+/g, '_')) && styles.planOptionSelected
                ]}
                onPress={() => {
                  console.log('Plan selected:', {
                    planId: plan.id,
                    planTier: plan.tier,
                    planName: plan.name,
                    maxTeachers: plan.max_teachers,
                    fullPlan: plan
                  });
                  // Use tier for display and id for DB
                  const planTier = plan.tier || plan.name?.toLowerCase()?.replace(/\s+/g, '_') || 'custom';
                  const defaultSeats = plan.max_teachers || 1;
                  setCreateForm({ ...createForm, plan_tier: planTier, plan_id: plan.id, seats_total: String(defaultSeats) });
                }}
              >
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDetails}>
                  R{plan.price_monthly}/mo • Up to {plan.max_teachers || 1} teachers
                </Text>
                <Text style={[styles.planDetails, { fontSize: 10, color: '#999' }]}>
                  ID: {plan.id} | Tier: {plan.tier || 'NO TIER'}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Billing Frequency */}
            <Text style={styles.formLabel}>Billing Frequency</Text>
            <View style={styles.billingRow}>
              {['monthly', 'annual'].map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.billingOption,
                    createForm.billing_frequency === freq && styles.billingOptionSelected
                  ]}
                  onPress={() => setCreateForm({ ...createForm, billing_frequency: freq })}
                >
                  <Text style={[
                    styles.billingOptionText,
                    createForm.billing_frequency === freq && styles.billingOptionTextSelected
                  ]}>
                    {freq}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Seats */}
            <Text style={styles.formLabel}>Number of Seats</Text>
            <TextInput
              style={styles.input}
              value={createForm.seats_total}
              onChangeText={(value) => setCreateForm({ ...createForm, seats_total: value })}
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity
              style={[styles.createModalButton, creating && styles.createModalButtonDisabled]}
              onPress={() => {
                console.log('Create Subscription button pressed!');
                if (!creating) {
                  createSubscription();
                }
              }}
              disabled={creating}
            >
              <Text style={styles.createModalButtonText}>
                {creating ? 'Creating...' : 'Create Subscription'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Plan Change Modal */}
      <PlanChangeModal
        visible={showPlanChangeModal}
        onClose={closePlanChangeModal}
        subscription={selectedSubscriptionForChange}
        school={selectedSchoolForChange}
        onSuccess={handlePlanChangeSuccess}
      />
    </View>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return '#10b981';
    case 'pending_payment':
      return '#f59e0b'; // Orange for pending payment
    case 'cancelled':
      return '#ef4444';
    case 'expired':
      return '#6b7280';
    default:
      return '#6b7280';
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    backgroundColor: '#0b1220',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  createButton: {
    backgroundColor: '#00f5ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: '#00f5ff22',
    borderColor: '#00f5ff',
  },
  filterChipText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#00f5ff',
    fontWeight: '700',
  },
  loading: {
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  schoolName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardDetail: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  cancelButton: {
    borderColor: '#ef4444',
    backgroundColor: '#ef444422',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  activateButton: {
    borderColor: '#10b981',
    backgroundColor: '#10b98122',
  },
  activateButtonText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    borderColor: '#6b7280',
    backgroundColor: '#6b728022',
  },
  deleteButtonText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
  },
  upgradeButton: {
    borderColor: '#00f5ff',
    backgroundColor: '#00f5ff22',
  },
  upgradeButtonText: {
    color: '#00f5ff',
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    backgroundColor: '#0f172a',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  modalClose: {
    color: '#9CA3AF',
    fontSize: 18,
  },
  backButton: {
    backgroundColor: '#00f5ff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#00f5ff',
    minWidth: 80,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  closeButton: {
    width: 40,
    height: 40,
    backgroundColor: '#374151',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  closeButtonText: {
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  schoolsScroll: {
    marginBottom: 8,
  },
  schoolChip: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  schoolChipSelected: {
    borderColor: '#00f5ff',
    backgroundColor: '#00f5ff22',
  },
  schoolChipText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  schoolChipTextSelected: {
    color: '#00f5ff',
    fontWeight: '700',
  },
  planOption: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  planOptionSelected: {
    borderColor: '#00f5ff',
    backgroundColor: '#00f5ff11',
  },
  planName: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
  },
  planDetails: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  billingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  billingOption: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  billingOptionSelected: {
    borderColor: '#00f5ff',
    backgroundColor: '#00f5ff22',
  },
  billingOptionText: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  billingOptionTextSelected: {
    color: '#00f5ff',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#111827',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  createModalButton: {
    backgroundColor: '#00f5ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  createModalButtonDisabled: {
    backgroundColor: '#00f5ff66',
    opacity: 0.6,
  },
  createModalButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
});