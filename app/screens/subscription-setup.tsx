import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { createCheckout } from '@/lib/payments';
import { navigateTo } from '@/lib/navigation/router-utils';
import * as WebBrowser from 'expo-web-browser';
import { getReturnUrl, getCancelUrl } from '@/lib/payments/urls';

interface SubscriptionPlan {
  id: string;
  name: string;
  tier: string;
  price_monthly: number;
  price_annual: number;
  max_teachers: number;
  max_students: number;
  features: string[];
  is_active: boolean;
  school_types: string[];
}

interface RouteParams {
  planId?: string;
  billing?: 'monthly' | 'annual';
  schoolType?: 'preschool' | 'k12_school' | 'hybrid';
  auto?: '1';
}

// Helper functions for school type labels
function getSchoolTypeLabel(schoolType: string): string {
  switch (schoolType) {
    case 'preschool': return 'Preschool';
    case 'k12_school': return 'K-12 School';
    case 'hybrid': return 'Hybrid Institution';
    default: return 'School';
  }
}

function getSchoolTypeDescription(schoolType: string): string {
  switch (schoolType) {
    case 'preschool': return 'Plans optimized for early childhood education';
    case 'k12_school': return 'Plans designed for primary and secondary schools';
    case 'hybrid': return 'Comprehensive plans for combined educational institutions';
    default: return 'Educational institution plans';
  }
}

export default function SubscriptionSetupScreen() {
  const { profile } = useAuth();
  const params = useLocalSearchParams() as Partial<RouteParams>;
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [allPlans, setAllPlans] = useState<SubscriptionPlan[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [annual, setAnnual] = useState(params.billing === 'annual');
  const [creating, setCreating] = useState(false);
  const [existingSubscription, setExistingSubscription] = useState<any>(null);
  const autoStartedRef = React.useRef(false);

  // Resolve the active school (preschool) id from profile with robust fallbacks
  const getSchoolId = async (): Promise<string | null> => {
    const direct = (profile as any)?.organization_id || (profile as any)?.preschool_id;
    if (direct) return direct;
    try {
      if (profile?.id) {
        const { data } = await assertSupabase()
          .from('profiles')
          .select('preschool_id')
          .eq('id', profile.id)
          .maybeSingle();
        return (data as any)?.preschool_id ?? null;
      }
    } catch { /* Intentional: non-fatal */ }
    return null;
  };

  useEffect(() => {
    loadPlans();
    loadSchoolInfo();
    checkExistingSubscription();
  }, [profile]);
  
  // Handle preselected plan from route params
  useEffect(() => {
    if (params.planId && plans.length > 0) {
      // Find and preselect the plan
      const matchingPlan = plans.find(p => p.id === params.planId || p.tier === params.planId);
      if (matchingPlan) {
        setSelectedPlan(matchingPlan.id);
        
        track('subscription_setup_preselected', {
          plan_id: matchingPlan.tier,
          billing: params.billing || 'monthly',
        });
      }
    }
  }, [params.planId, plans]);

  // Auto-start checkout if requested via params (for paid plans only)
  useEffect(() => {
    if (params.auto === '1' && selectedPlan && !creating && !autoStartedRef.current) {
      const plan = plans.find(p => p.id === selectedPlan || p.tier === selectedPlan);
      if (!plan) return;
      const isFree = (plan.tier || '').toLowerCase() === 'free';
      const price = (annual ? plan.price_annual : plan.price_monthly) || 0;
      if (isFree || price <= 0) return; // don't auto-run for free plans

      autoStartedRef.current = true;
      // Fire and forget; UI already handles loading state
      createSubscription(selectedPlan);
    }
  }, [params.auto, selectedPlan, creating, annual, plans]);

  async function loadPlans() {
    try {
      const { data, error } = await assertSupabase()
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      setAllPlans(data || []);
      // Initial filter - will be updated when school info loads
      setPlans(data || []);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load subscription plans');
      track('subscription_setup_load_failed', { error: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function loadSchoolInfo() {
    try {
      const schoolId = await getSchoolId();
      if (schoolId) {
        const { data, error } = await assertSupabase()
          .from('preschools')
          .select('school_type, name')
          .eq('id', schoolId)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        setSchoolInfo(data);
      }
    } catch (error) {
      console.error('Error loading school info:', error);
    }
  }

  // Filter plans based on school type
  useEffect(() => {
    if (allPlans.length > 0) {
      const schoolType = params.schoolType || schoolInfo?.school_type || 'preschool';
      
      const filteredPlans = allPlans.filter(plan => {
        // If plan doesn't have school_types specified, show to all
        if (!plan.school_types || plan.school_types.length === 0) {
          return true;
        }
        // Check if plan supports this school type or 'hybrid' (which supports all)
        return plan.school_types.includes(schoolType) || plan.school_types.includes('hybrid');
      });
      
      setPlans(filteredPlans);
      
      // Track the filtering
      track('subscription_plans_filtered', {
        school_type: schoolType,
        total_plans: allPlans.length,
        filtered_plans: filteredPlans.length
      });
    }
  }, [allPlans, schoolInfo, params.schoolType]);

  async function checkExistingSubscription() {
    try {
      const schoolId = await getSchoolId();
      if (!schoolId) return;

      const { data, error } = await assertSupabase()
        .from('subscriptions')
        .select('*')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setExistingSubscription(data);
    } catch (error) {
      console.error('Error checking existing subscription:', error);
    }
  }

  async function createSubscription(planId: string) {
    const plan = plans.find(p => p.id === planId);
    
    if (!plan) {
      Alert.alert('Error', 'Selected plan not found');
      return;
    }
    
    const isEnterprise = plan.tier.toLowerCase() === 'enterprise';
    const isFree = plan.tier.toLowerCase() === 'free';
    const price = annual ? plan.price_annual : plan.price_monthly;

    setCreating(true);
    
    try {
      if (isEnterprise) {
        // Enterprise tier - redirect to Contact Sales
        Alert.alert(
          'Enterprise Plan',
          'Enterprise plans require custom setup. Our sales team will contact you to configure your solution.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Contact Sales', 
              onPress: () => {
                track('enterprise_redirect_from_setup', {
                  plan_tier: plan.tier,
                  user_role: profile?.role,
                });
                navigateTo.contact();
              }
            },
          ]
        );
        return;
      }
      
      if (isFree) {
        // Free plan - ensure a free subscription exists for the school
        const schoolId = await getSchoolId();
        if (!schoolId) {
          Alert.alert('Error', 'School information not found for free plan setup');
          return;
        }

        // Try RPC if it exists; fall back to direct insertion
        let rpcError: any | null = null;
        try {
          const { error } = await assertSupabase().rpc('ensure_school_free_subscription', {
            p_school_id: schoolId,
            p_seats: plan.max_teachers || 1,
          });
          rpcError = error || null;
        } catch (e: any) {
          rpcError = e;
        }

        if (rpcError) {
          // Fallback: direct insert/upsert using the new schema
          try {
            // Resolve the free plan id
            const { data: planRow, error: planErr } = await assertSupabase()
              .from('subscription_plans')
              .select('id')
              .eq('tier', 'free')
              .maybeSingle();
            if (planErr || !planRow?.id) throw planErr || new Error('Free plan not found');

            // Upsert an active subscription for this school
            const { error: upsertErr } = await assertSupabase()
              .from('subscriptions')
              .insert({
                school_id: schoolId,
                plan_id: planRow.id,
                status: 'active',
                billing_frequency: 'monthly',
                seats_total: plan.max_teachers || 1,
                seats_used: 0,
              })
              .select('id')
              .single();
            if (upsertErr && !String(upsertErr.message || '').includes('duplicate')) throw upsertErr;
          } catch (fallbackErr: any) {
            throw fallbackErr;
          }
        }

        // Non-blocking attempt to tag school with tier if column exists
        try {
          await assertSupabase()
            .from('preschools')
            .update({ subscription_tier: plan.tier as any })
            .eq('id', schoolId);
        } catch { /* Intentional: non-fatal */ }

        track('subscription_created', {
          plan_id: plan.tier,
          billing_cycle: 'free',
          school_id: schoolId
        });

        Alert.alert(
          'Success!', 
          `Your ${plan.name} subscription has been created. You can now manage teacher seats.`,
          [
            {
              text: 'Continue',
              onPress: () => router.push('/screens/principal-seat-management')
            }
          ]
        );
        return;
      }
      
      // Paid plans - use checkout flow
      const schoolId = await getSchoolId();
      track('checkout_started', {
        plan_tier: plan.tier,
        plan_name: plan.name,
        billing: annual ? 'annual' : 'monthly',
        price: price,
        user_role: profile?.role,
        school_id: schoolId,
      });
      
      const checkoutInput = {
        scope: schoolId ? 'school' as const : 'user' as const,
        schoolId: schoolId || undefined,
        userId: profile?.id,
        planTier: plan.tier,
        billing: (annual ? 'annual' : 'monthly') as 'annual' | 'monthly',
        seats: plan.max_teachers,
        // PayFast requires http(s) URLs. Use HTTPS bridge pages managed server-side.
        return_url: getReturnUrl(),
        cancel_url: getCancelUrl(),
      };
      
      const result = await createCheckout(checkoutInput);
      
      if (result.error) {
        if (result.error.includes('contact_sales_required')) {
          Alert.alert(
            'Contact Required',
            'This plan requires sales contact for setup.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Contact Sales', onPress: () => navigateTo.contact() },
            ]
          );
          return;
        }
        
        throw new Error(result.error);
      }
      
      if (!result.redirect_url) {
        throw new Error('No payment URL received');
      }
      
      // Track checkout redirect
      track('checkout_redirected', {
        plan_tier: plan.tier,
        billing: annual ? 'annual' : 'monthly',
      });
      
      // Open payment URL
      const browserResult = await WebBrowser.openBrowserAsync(result.redirect_url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        showTitle: true,
        toolbarColor: '#0b1220',
      });
      
      // Handle browser result if needed
      if (browserResult.type === 'dismiss' || browserResult.type === 'cancel') {
        track('checkout_cancelled', {
          plan_tier: plan.tier,
          browser_result: browserResult.type,
        });
      }
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start checkout');
      track('checkout_failed', {
        plan_tier: plan.tier,
        error: error.message,
      });
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00f5ff" />
        <Text style={styles.loadingText}>Loading subscription plans...</Text>
      </View>
    );
  }

  if (existingSubscription) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <Stack.Screen options={{ 
          title: 'Subscription Active',
          headerStyle: { backgroundColor: '#0b1220' },
          headerTitleStyle: { color: '#fff' },
          headerTintColor: '#00f5ff'
        }} />
        <StatusBar style="light" backgroundColor="#0b1220" />
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.existingSubscriptionCard}>
              <Text style={styles.title}>Active Subscription</Text>
              <Text style={styles.subtitle}>Your school already has an active subscription</Text>
              
              <View style={styles.subscriptionInfo}>
                <Text style={styles.infoLabel}>Plan:</Text>
                <Text style={styles.infoValue}>{existingSubscription.plan_id}</Text>
              </View>
              
              <View style={styles.subscriptionInfo}>
                <Text style={styles.infoLabel}>Status:</Text>
                <Text style={styles.infoValue}>{existingSubscription.status}</Text>
              </View>
              
              <View style={styles.subscriptionInfo}>
                <Text style={styles.infoLabel}>Seats:</Text>
                <Text style={styles.infoValue}>{existingSubscription.seats_used} / {existingSubscription.seats_total}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => router.push('/screens/principal-seat-management')}
              >
                <Text style={styles.buttonText}>Manage Teacher Seats</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <Stack.Screen options={{ 
        title: 'Setup Subscription',
        headerStyle: { backgroundColor: '#0b1220' },
        headerTitleStyle: { color: '#fff' },
        headerTintColor: '#00f5ff'
      }} />
      <StatusBar style="light" backgroundColor="#0b1220" />
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>Choose Your Subscription Plan</Text>
          <Text style={styles.subtitle}>
            {schoolInfo ? (
              `Select a plan for ${schoolInfo.name} (${getSchoolTypeLabel(schoolInfo.school_type)})`
            ) : (
              'Select a plan to enable teacher seat management for your school'
            )}
          </Text>
          
          {schoolInfo?.school_type && (
            <View style={styles.schoolTypeInfo}>
              <Text style={styles.schoolTypeLabel}>School Type: {getSchoolTypeLabel(schoolInfo.school_type)}</Text>
              <Text style={styles.schoolTypeDescription}>
                {getSchoolTypeDescription(schoolInfo.school_type)}
              </Text>
            </View>
          )}

          {/* Billing toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity 
              onPress={() => setAnnual(false)} 
              style={[styles.toggleBtn, !annual && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleBtnText, !annual && styles.toggleBtnTextActive]}>
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setAnnual(true)} 
              style={[styles.toggleBtn, annual && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleBtnText, annual && styles.toggleBtnTextActive]}>
                Annual (Save 10%)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Plans */}
          <View style={styles.plansContainer}>
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                annual={annual}
                selected={selectedPlan === plan.id}
                onSelect={() => {
                  setSelectedPlan(plan.id);
                }}
                onSubscribe={() => {
                  createSubscription(plan.id);
                }}
                creating={creating}
                schoolType={schoolInfo?.school_type || params.schoolType}
              />
            ))}
          </View>

          {plans.length === 0 && (
            <View style={styles.noPlansCard}>
              <Text style={styles.noPlansText}>No subscription plans available</Text>
              <Text style={styles.noPlansSubtext}>
                Contact support to set up subscription plans for your school
              </Text>
            </View>
          )}
        </ScrollView>
    </SafeAreaView>
  );
}

interface PlanCardProps {
  plan: SubscriptionPlan;
  annual: boolean;
  selected: boolean;
  onSelect: () => void;
  onSubscribe: () => void;
  creating: boolean;
  schoolType?: string;
}

function PlanCard({ plan, annual, selected, onSelect, onSubscribe, creating, schoolType }: PlanCardProps) {
  const price = annual ? plan.price_annual : plan.price_monthly;
  const priceInRands = price / 100; // Convert cents to rands
  const savings = annual ? Math.round((plan.price_monthly * 12 - plan.price_annual) / 12) / 100 : 0;
  const isFree = price === 0;
  const isEnterprise = plan.tier.toLowerCase() === 'enterprise';
  
  // Check if this plan is specifically optimized for the school type
  const isRecommended = schoolType && plan.school_types && 
    (plan.school_types.includes(schoolType) && plan.school_types.length === 1);

  // Get plan tier color
  const getPlanColor = () => {
    switch (plan.tier.toLowerCase()) {
      case 'free': return '#6b7280';
      case 'starter': return '#3b82f6';
      case 'premium': return '#8b5cf6';
      case 'enterprise': return '#f59e0b';
      default: return '#00f5ff';
    }
  };

  const planColor = getPlanColor();

  return (
    <View style={[styles.planCard, selected && styles.planCardSelected]}>
      <TouchableOpacity 
        style={styles.planCardTouchable}
        onPress={onSelect}
        activeOpacity={0.8}
      >
        {/* Plan Header */}
        <View style={styles.planHeader}>
          <View style={styles.planTitleRow}>
            <View style={styles.planTitleContainer}>
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={[styles.planTierBadge, { backgroundColor: planColor + '20' }]}>
                <Text style={[styles.planTier, { color: planColor }]}>{plan.tier}</Text>
              </View>
            </View>
            {isRecommended && (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>Recommended</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Price Section */}
        <View style={styles.priceSection}>
          <View style={styles.priceContainer}>
            {isFree ? (
              <Text style={styles.freePrice}>Free</Text>
            ) : isEnterprise ? (
              <Text style={styles.customPrice}>Custom</Text>
            ) : (
              <>
                <Text style={[styles.price, { color: planColor }]}>R{priceInRands.toFixed(2)}</Text>
                <Text style={styles.pricePeriod}>/ {annual ? 'year' : 'month'}</Text>
              </>
            )}
          </View>
          {savings > 0 && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savings}>Save R{savings.toFixed(2)}/mo</Text>
            </View>
          )}
        </View>

        {/* Plan Details */}
        <View style={styles.planDetailsSection}>
          <View style={styles.limitsContainer}>
            <View style={styles.limitRow}>
              <Text style={styles.limitIcon}>👥</Text>
              <Text style={styles.limitItem}>Up to {plan.max_teachers} teachers</Text>
            </View>
            <View style={styles.limitRow}>
              <Text style={styles.limitIcon}>🎓</Text>
              <Text style={styles.limitItem}>Up to {plan.max_students} students</Text>
            </View>
          </View>

          {plan.features && plan.features.length > 0 && (
            <View style={styles.featuresContainer}>
              <Text style={styles.featuresTitle}>Features included:</Text>
              {plan.features.slice(0, 4).map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Text style={styles.featureIcon}>✓</Text>
                  <Text style={styles.featureItem}>{feature}</Text>
                </View>
              ))}
              {plan.features.length > 4 && (
                <Text style={styles.moreFeatures}>+{plan.features.length - 4} more features</Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* CTA Section - Now below the content */}
      <View style={styles.ctaSection}>
        {selected ? (
          <TouchableOpacity 
            style={[styles.subscribeButton, { backgroundColor: planColor }, creating && styles.subscribeButtonDisabled]}
            onPress={onSubscribe}
            disabled={creating}
            testID={`subscribe-${plan.id}`}
          >
            {creating ? (
              <Text style={styles.subscribeButtonText}>Creating...</Text>
            ) : (
              <>
                <Text style={styles.subscribeButtonText}>
                  {isFree ? 'Get Started Free' : isEnterprise ? 'Contact Sales' : 'Subscribe Now'}
                </Text>
                {!isFree && !isEnterprise && (
                  <Text style={styles.subscribeButtonSubtext}>
                    Start your {annual ? 'annual' : 'monthly'} plan
                  </Text>
                )}
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.selectPrompt}>
            <Text style={[styles.selectPromptText, { color: planColor }]}>Tap to select this plan</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  scrollContainer: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  toggleBtnActive: {
    backgroundColor: '#00f5ff',
    borderColor: '#00f5ff',
  },
  toggleBtnText: {
    color: '#9CA3AF',
    fontWeight: '700',
  },
  toggleBtnTextActive: {
    color: '#000',
  },
  plansContainer: {
    gap: 12,
  },
  planCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#1f2937',
  },
  planCardSelected: {
    borderColor: '#00f5ff',
  },
  planHeader: {
    marginBottom: 12,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  planName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  planTier: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 12,
  },
  price: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00f5ff',
  },
  pricePeriod: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  savings: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    marginLeft: 8,
  },
  limitsContainer: {
    marginBottom: 12,
  },
  limitItem: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  featuresContainer: {
    marginBottom: 16,
  },
  featureItem: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
  },
  subscribeButton: {
    backgroundColor: '#00f5ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  subscribeButtonDisabled: {
    opacity: 0.5,
  },
  subscribeButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
  noPlansCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  noPlansText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  noPlansSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  existingSubscriptionCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  subscriptionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#00f5ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
  // School type info styles
  schoolTypeInfo: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  schoolTypeLabel: {
    color: '#00f5ff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  schoolTypeDescription: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 16,
  },
  // Recommendation badge styles
  recommendedBadge: {
    backgroundColor: '#10b981',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  // New redesigned plan card styles
  planCardTouchable: {
    flex: 1,
  },
  planTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  planTierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  priceSection: {
    marginBottom: 16,
  },
  freePrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#10b981',
  },
  customPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#f59e0b',
  },
  savingsBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  planDetailsSection: {
    marginBottom: 16,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  limitIcon: {
    fontSize: 14,
  },
  featuresTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  featureIcon: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  moreFeatures: {
    color: '#9CA3AF',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  ctaSection: {
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingTop: 16,
    marginTop: 8,
  },
  subscribeButtonSubtext: {
    color: '#000',
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  selectPrompt: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  selectPromptText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
});
