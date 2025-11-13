import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { createCheckout } from '@/lib/payments';
import { adminUpdateSubscriptionPlan } from '@/lib/supabase/rpc-subscriptions';
import { navigateTo } from '@/lib/navigation/router-utils';
import * as WebBrowser from 'expo-web-browser';
import { getReturnUrl, getCancelUrl } from '@/lib/payments/urls';

const { width } = Dimensions.get('window');

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
  currentTier?: string | string[];
  reason?: string | string[];
  feature?: string | string[];
}

// Utility function to handle array/string params
const takeFirst = (v: string | string[] | undefined): string | undefined => {
  if (Array.isArray(v)) return v[0];
  return v;
};

// Safe color helper function
// Use rgba() to avoid platform-specific hex alpha format issues (#RRGGBBAA vs #AARRGGBB)
const withAlpha = (hex: string, alpha = 0.125): string => {
  try {
    const match = /^#([0-9A-Fa-f]{6})$/.exec(hex);
    if (match) {
      const int = parseInt(match[1], 16);
      const r = (int >> 16) & 255;
      const g = (int >> 8) & 255;
      const b = int & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  } catch {
    // ignore and use fallback
  }
  // Default to a subtle slate background with alpha
  return `rgba(31, 41, 55, ${alpha})`;
};

// Predefined reasons with safe defaults
const UPGRADE_REASONS: Record<string, { icon: string; color: string; title: string; subtitle: string }> = {
  limit_reached: {
    icon: 'warning',
    color: '#f59e0b',
    title: 'Upgrade Required',
    subtitle: 'You\'ve reached your current plan limits'
  },
  feature_needed: {
    icon: 'lock-closed',
    color: '#8b5cf6',
    title: 'Unlock Premium Features',
    subtitle: 'This feature requires a higher tier plan'
  },
  manual_upgrade: {
    icon: 'trending-up',
    color: '#10b981',
    title: 'Upgrade Your Plan',
    subtitle: 'Get access to more features and higher limits'
  }
};

const DEFAULT_REASON = UPGRADE_REASONS.manual_upgrade;

export default function SubscriptionUpgradePostScreen() {
  if (__DEV__) {
    console.log('🔍 SubscriptionUpgradePostScreen: Component initializing...');
  }
  
  const { profile } = useAuth();
  const rawParams = useLocalSearchParams();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [annual, setAnnual] = useState(true); // Default to annual for better savings
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [screenMounted, setScreenMounted] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Safely extract parameters
  const currentTier = (takeFirst(rawParams.currentTier) || 'free').toString();
  const reasonKey = (takeFirst(rawParams.reason) || 'manual_upgrade').toString();
  const feature = takeFirst(rawParams.feature);
  
  // Debug logging for mobile troubleshooting
  if (__DEV__) {
    console.log('🔍 SubscriptionUpgradePostScreen params:', {
      currentTier,
      reasonKey,
      feature,
      rawParams,
      profile: profile ? { id: profile.id, role: profile.role } : null
    });
  }
  
  // Get reason with fallback
  const reason = UPGRADE_REASONS[reasonKey] || DEFAULT_REASON;
  
  // If feature is provided and reason is feature_needed, customize subtitle
  if (feature && reasonKey === 'feature_needed') {
    reason.subtitle = `${feature} requires a higher tier plan`;
  }

  useEffect(() => {
    // Set mounted flag and add small delay for mobile stability
    const initializeScreen = async () => {
      try {
        if (__DEV__) {
          console.log('🔍 SubscriptionUpgradePostScreen: Initializing screen...');
        }
        setScreenMounted(true);
        await new Promise(resolve => setTimeout(resolve, 50));
        await loadPlans();
        trackPageView();
        if (__DEV__) {
          console.log('🔍 SubscriptionUpgradePostScreen: Initialization complete');
        }
      } catch (error: any) {
        console.error('❌ Screen initialization failed:', error);
        setRenderError(error.message || 'Initialization failed');
        setLoading(false);
      }
    };
    
    initializeScreen();
    
    // Cleanup function
    return () => {
      setScreenMounted(false);
    };
  }, []);

  const trackPageView = () => {
    track('upgrade_post_screen_viewed', {
      current_tier: currentTier,
      reason: reasonKey,
      feature: feature,
      user_role: profile?.role,
    });
  };

  const loadPlans = async () => {
    // Replace AbortController usage with a simple timeout guard for RN/Hermes stability
    let timedOut = false;
    const timeoutId = setTimeout(() => { timedOut = true; }, 10000);

    try {
      setLoading(true);
      
      // Add small delay to prevent race conditions on mobile
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { data, error } = await assertSupabase()
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      clearTimeout(timeoutId);

      if (timedOut) {
        // If timeout elapsed, do not apply results
        console.warn('loadPlans timed out');
        return;
      }

      if (error) {
        console.error('Plans fetch error:', error);
        throw new Error(error.message || 'Failed to fetch plans');
      }
      
      // Ensure data is an array
      const plansData = Array.isArray(data) ? data : [];
      
      // Role-aware filtering: parents see parent plans only, schools see school plans
      const isParent = profile?.role === 'parent';
      const currentTierLower = currentTier.toLowerCase();
      
      const filteredPlans = plansData.filter(plan => {
        if (!plan || !plan.tier) return false; // Skip invalid plans
        
        const planTier = plan.tier.toLowerCase();
        
        // Exclude current tier
        if (planTier === currentTierLower) return false;
        
        // Parents only see parent tiers
        if (isParent) {
          return planTier === 'free' || planTier.includes('parent');
        }
        
        // Non-parents don't see parent tiers
        return !planTier.includes('parent');
      });
      
      setPlans(filteredPlans);
      
      // Auto-select next tier up if available
      if (filteredPlans.length > 0) {
        setSelectedPlan(filteredPlans[0].id);
      }
      
      track('upgrade_post_plans_loaded', { 
        plans_count: filteredPlans.length,
        current_tier: currentTier 
      });
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Plans loading failed:', error);
      
      // Set empty array to show empty state UI
      setPlans([]);
      
      track('upgrade_post_load_failed', { 
        error: error?.message || String(error),
        current_tier: currentTier 
      });
      
      // Don't block the UI with an alert, just log the error in dev
      if (__DEV__) {
        console.warn('Failed to load subscription plans:', error?.message || String(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    // Defensive checks
    if (!planId) {
      console.error('❌ handleUpgrade: planId is missing');
      Alert.alert('Error', 'No plan selected');
      return;
    }
    
    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      console.error('❌ handleUpgrade: Plan not found for ID:', planId);
      Alert.alert('Error', 'Selected plan not found');
      return;
    }

    // Check profile availability
    if (!profile) {
      console.error('❌ handleUpgrade: User profile not available');
      Alert.alert('Error', 'User profile not loaded. Please try again.');
      return;
    }

    console.log('🔧 handleUpgrade: Starting upgrade process', {
      planId,
      planTier: plan.tier,
      userId: profile.id,
      organizationId: profile.organization_id,
    });

    const isEnterprise = plan.tier.toLowerCase() === 'enterprise';
    const price = annual ? plan.price_annual : plan.price_monthly;

    // Only update state if component is still mounted
    if (!screenMounted) {
      console.log('⚠️ handleUpgrade: Component unmounted, aborting upgrade');
      return;
    }
    setUpgrading(true);
    
    try {
      if (isEnterprise) {
        // Enterprise tier - redirect to Contact Sales
        Alert.alert(
          'Enterprise Upgrade',
          'Enterprise plans require custom setup. Our sales team will contact you to configure your upgrade.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Contact Sales', 
              onPress: () => {
                track('enterprise_upgrade_contact', {
                  from_tier: currentTier,
                  reason: reasonKey,
                });
                navigateTo.contact();
              }
            },
          ]
        );
        return;
      }

      // If zero-cost target (e.g., Free), perform direct downgrade without payment
      if (price === 0) {
        try {
          track('downgrade_attempt', {
            from_tier: currentTier,
            to_tier: plan.tier,
            billing: annual ? 'annual' : 'monthly',
          });

          // Fetch active subscription for the school
          const { data: sub, error: subErr } = await assertSupabase()
            .from('subscriptions')
            .select('id')
            .eq('school_id', profile.organization_id)
            .eq('status', 'active')
            .maybeSingle();
          if (subErr || !sub?.id) throw new Error('Active subscription not found');

          await adminUpdateSubscriptionPlan(assertSupabase(), {
            subscriptionId: sub.id,
            newPlanId: plan.id,
            billingFrequency: annual ? 'annual' : 'monthly',
            seatsTotal: plan.max_teachers || 1,
            reason: 'Downgrade to Free via upgrade screen',
            metadata: {
              changed_via: 'principal_upgrade_screen',
              payment_required: false,
              downgrade: true,
            },
          });

          Alert.alert('Plan Updated', 'Your subscription has been changed to the Free plan.');
          track('downgrade_succeeded', { to_tier: plan.tier });
          try { router.back(); } catch { router.replace('/screens/principal-dashboard'); }
          return;
        } catch (e: any) {
          track('downgrade_failed', { error: e?.message });
          throw e;
        }
      }

      // Track upgrade attempt
      track('upgrade_attempt', {
        from_tier: currentTier,
        to_tier: plan.tier,
        billing: annual ? 'annual' : 'monthly',
        price: price,
        reason: reasonKey,
      });

      const checkoutInput = {
        scope: 'school' as const,
        schoolId: profile.organization_id,
        userId: profile.id,
        planTier: plan.tier,
        billing: (annual ? 'annual' : 'monthly') as 'annual' | 'monthly',
        seats: plan.max_teachers,
        // PayFast requires http(s) URLs. Use HTTPS bridge pages managed server-side.
        return_url: getReturnUrl(),
        cancel_url: getCancelUrl(),
      };
      
      console.log('💳 handleUpgrade: Creating checkout with:', checkoutInput);
      const result = await createCheckout(checkoutInput);
      console.log('💳 handleUpgrade: Checkout result:', { hasRedirectUrl: !!result.redirect_url, error: result.error });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (!result.redirect_url) {
        throw new Error('No payment URL received');
      }

      // Track checkout redirect
      track('upgrade_checkout_redirected', {
        to_tier: plan.tier,
        billing: annual ? 'annual' : 'monthly',
      });
      
      // Check if WebBrowser is available first
      console.log('🌐 handleUpgrade: Attempting to open browser for:', result.redirect_url);
      
      try {
        // First, try to check if WebBrowser is available
        if (typeof WebBrowser.openBrowserAsync !== 'function') {
          throw new Error('WebBrowser.openBrowserAsync is not available');
        }
        
        console.log('🌐 handleUpgrade: WebBrowser is available, opening...');
        const browserResult = await WebBrowser.openBrowserAsync(result.redirect_url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          showTitle: true,
          toolbarColor: '#0b1220',
        });
        
        console.log('🌐 handleUpgrade: Browser opened successfully:', browserResult.type);
        
        if (browserResult.type === 'dismiss' || browserResult.type === 'cancel') {
          track('upgrade_checkout_cancelled', {
            to_tier: plan.tier,
            browser_result: browserResult.type,
          });
        }
        
      } catch (browserError: any) {
        console.error('❌ handleUpgrade: WebBrowser failed, trying fallback:', browserError);
        
        // Fallback: Try using Linking instead
        try {
          const { Linking } = require('react-native');
          const canOpen = await Linking.canOpenURL(result.redirect_url);
          if (canOpen) {
            console.log('🔗 handleUpgrade: Using Linking fallback');
            await Linking.openURL(result.redirect_url);
            track('upgrade_checkout_opened_via_linking', {
              to_tier: plan.tier,
            });
          } else {
            throw new Error('Cannot open URL with system browser');
          }
        } catch (linkingError: any) {
          console.error('❌ handleUpgrade: Both WebBrowser and Linking failed:', linkingError);
          Alert.alert(
            'Unable to Open Payment', 
            'Cannot open the payment page. Please try again or contact support.',
            [
              { text: 'Copy URL', onPress: () => {
                // Copy URL to clipboard as last resort  
                try {
                  require('@expo/clipboard').setStringAsync(result.redirect_url);
                  Alert.alert('URL Copied', 'Payment URL copied to clipboard');
                } catch {
                  // Fallback alert with URL
                  Alert.alert('Payment URL', result.redirect_url);
                }
              }},
              { text: 'Cancel', style: 'cancel' }
            ]
          );
          return; // Don't throw, just return to avoid crash
        }
      }
      
    } catch (error: any) {
      console.error('❌ handleUpgrade: Upgrade failed:', error);
      const errorMessage = error?.message || String(error) || 'Failed to start upgrade';
      Alert.alert('Upgrade Failed', errorMessage);
      track('upgrade_failed', {
        to_tier: plan.tier,
        error: errorMessage,
        error_type: error?.name || 'unknown',
      });
    } finally {
      console.log('🔄 handleUpgrade: Cleaning up, setting upgrading to false');
      // Only update state if component is still mounted
      if (screenMounted) {
        setUpgrading(false);
      } else {
        console.log('⚠️ handleUpgrade: Component unmounted, skipping state reset');
      }
    }
  };

  // MINIMAL TEST: Start with absolute minimum to isolate crash
  const handleTestUpgrade = async (planId: string) => {
    // Test 1: Just update state - does this crash?
    setUpgrading(true);
    
    // Test 2: Add tiny delay and reset state WITH MOUNT CHECK
    setTimeout(() => {
      // Only update state if component is still mounted
      if (screenMounted) {
        setUpgrading(false);
        if (__DEV__) {
          console.log('🧪 TEST: Timeout completed, state reset');
        }
      } else {
        if (__DEV__) {
          console.log('⚠️ TEST: Component unmounted, skipping state update');
        }
      }
    }, 1000);
    
    // Test 3: If above works, try console log
    if (__DEV__) {
      console.log('🧪 TEST: Button clicked, planId:', planId);
    }
  };

  const getPlanColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'starter': return '#3b82f6';
      case 'premium': return '#8b5cf6';
      case 'enterprise': return '#f59e0b';
      default: return '#00f5ff';
    }
  };


  // Check for render errors first
  if (renderError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Unable to Load Upgrade Screen</Text>
        <Text style={styles.loadingText}>Error: {renderError}</Text>
        <TouchableOpacity
          style={[styles.cancelButton, { marginTop: 20, backgroundColor: '#00f5ff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }]}
          onPress={() => {
            try {
              router.back();
            } catch {
              router.replace('/screens/principal-dashboard');
            }
          }}
        >
          <Text style={[styles.cancelButtonText, { color: '#000', fontWeight: '600' }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Add crash protection for mobile
  if (!screenMounted || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00f5ff" />
        <Text style={styles.loadingText}>Loading upgrade options...</Text>
      </View>
    );
  }

  // Wrap in try-catch to prevent render crashes on mobile
  try {
    const statusBarHeight = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;
    
    return (
      <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Upgrade Plan',
        headerShown: true,
        headerStyle: { 
          backgroundColor: '#0b1220',
          height: 56 + statusBarHeight, // Standard header height + status bar
        },
        headerTitleStyle: { color: '#fff' },
        headerTintColor: '#00f5ff',
        headerBackVisible: true,
        gestureEnabled: true,
        headerTransparent: false,
        headerStatusBarHeight: statusBarHeight,
      }} />
      <StatusBar style="light" backgroundColor="#0b1220" />
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={[styles.reasonIcon, { backgroundColor: withAlpha(reason.color, 0.125) }]}>
              <Ionicons name={(reason.icon || 'trending-up') as any} size={32} color={reason.color} />
            </View>
            <Text style={styles.title}>{reason.title}</Text>
            <Text style={styles.subtitle}>{reason.subtitle}</Text>
          </View>

          {/* Current Tier Info */}
          {currentTier && currentTier !== 'free' && (
            <View style={styles.currentTierCard}>
              <Text style={styles.currentTierLabel}>Your current plan:</Text>
              <Text style={styles.currentTierName}>{currentTier} Plan</Text>
            </View>
          )}

          {/* Billing Toggle */}
          <View style={styles.toggleSection}>
            <Text style={styles.toggleLabel}>Choose billing cycle:</Text>
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
                  Annual
                </Text>
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>Save 17%</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Upgrade Options */}
          <View style={styles.plansSection}>
            <Text style={styles.plansSectionTitle}>Choose your upgrade:</Text>
            
            <View style={styles.plansGrid}>
              {plans.map((plan) => {
                const price = annual ? plan.price_annual : plan.price_monthly;
                const priceInRands = price / 100; // Convert cents to rands
                const monthlyPrice = annual ? Math.round(plan.price_annual / 12) : plan.price_monthly;
                const monthlyPriceInRands = monthlyPrice / 100; // Convert cents to rands
                const savings = annual ? Math.round((plan.price_monthly * 12 - plan.price_annual) / 12) / 100 : 0;
                const isEnterprise = plan.tier.toLowerCase() === 'enterprise';
                const isSelected = selectedPlan === plan.id;
                const planColor = getPlanColor(plan.tier);

                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                      { borderColor: isSelected ? planColor : '#1f2937' }
                    ]}
                    onPress={() => setSelectedPlan(plan.id)}
                    activeOpacity={0.8}
                  >
                    {/* Plan Header */}
                    <View style={styles.planHeader}>
                      <View style={styles.planTitleSection}>
                        <Text style={styles.planName}>{plan.name}</Text>
<View style={[styles.planTierBadge, { backgroundColor: withAlpha(planColor, 0.125) }]} >
                          <Text style={[styles.planTier, { color: planColor }]}>{plan.tier}</Text>
                        </View>
                      </View>
                      
                      {/* Selection Indicator */}
                      <View style={[styles.selectionIndicator, { borderColor: planColor }]}>
                        {isSelected && (
                          <View style={[styles.selectionDot, { backgroundColor: planColor }]} />
                        )}
                      </View>
                    </View>

                    {/* Price Section */}
                    <View style={styles.priceSection}>
                      {isEnterprise ? (
                        <View>
                          <Text style={[styles.customPrice, { color: planColor }]}>Custom</Text>
                          <Text style={styles.contactText}>Contact for pricing</Text>
                        </View>
                      ) : (
                        <View>
                          <View style={styles.priceRow}>
                            <Text style={[styles.price, { color: planColor }]}>R{monthlyPriceInRands.toFixed(2)}</Text>
                            <Text style={styles.pricePeriod}>/month</Text>
                          </View>
                          {annual && (
                            <View>
                              <Text style={styles.annualPrice}>R{priceInRands.toFixed(2)} billed annually</Text>
                              {savings > 0 && (
                                <Text style={styles.savingsAmount}>Save R{savings.toFixed(2)}/month</Text>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Plan Features */}
                    <View style={styles.featuresSection}>
                      <View style={styles.limitsRow}>
                        <View style={styles.limitItem}>
                          <Text style={styles.limitNumber}>
                            {isEnterprise || plan.max_teachers === null || plan.max_teachers === undefined
                              ? '-'
                              : (plan.max_teachers < 0 ? 'Unlimited' : String(plan.max_teachers))}
                          </Text>
                          <Text style={styles.limitLabel}>
                            {plan.tier.toLowerCase().includes('parent') ? 'Parents' : 'Teachers'}
                          </Text>
                        </View>
                        <View style={styles.limitItem}>
                          <Text style={styles.limitNumber}>
                            {isEnterprise || plan.max_students === null || plan.max_students === undefined
                              ? '-'
                              : (plan.max_students < 0 ? 'Unlimited' : String(plan.max_students))}
                          </Text>
                          <Text style={styles.limitLabel}>
                            {plan.tier.toLowerCase().includes('parent') ? 'Children' : 'Students'}
                          </Text>
                        </View>
                      </View>

                      {plan.features && plan.features.length > 0 && (
                        <View style={styles.featuresList}>
                          {((expanded[plan.id] ? plan.features : plan.features.slice(0, 3)) || []).map((feature, index) => (
                            <View key={index} style={styles.featureRow}>
                              <Text style={[styles.featureIcon, { color: planColor }]}>✓</Text>
                              <Text style={styles.featureText}>{feature}</Text>
                            </View>
                          ))}
                          {plan.features.length > 3 && (
                            <TouchableOpacity onPress={() => setExpanded(prev => ({ ...prev, [plan.id]: !prev[plan.id] }))}>
                              <Text style={styles.moreFeatures}>{expanded[plan.id] ? 'Hide features' : `See all features (${plan.features.length})`}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                    {/* Per-plan Upgrade Button */}
                    <TouchableOpacity
                      style={[styles.upgradeButton, { backgroundColor: planColor, marginTop: 12 }]}
                      onPress={() => handleUpgrade(plan.id)}
                    >
                      <Text style={styles.upgradeButtonText}>
                        {isEnterprise ? 'Contact Sales' : (monthlyPriceInRands === 0 ? 'Downgrade' : 'Upgrade')}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* CTA Section - retained for convenience but optional */}
          {selectedPlan && (
            <View style={styles.ctaSection}>
              <TouchableOpacity
                style={[
                  styles.upgradeButton,
                  { 
                    backgroundColor: getPlanColor(plans.find(p => p.id === selectedPlan)?.tier || ''),
                    opacity: upgrading ? 0.7 : 1
                  }
                ]}
                onPress={() => handleUpgrade(selectedPlan!)}
                disabled={upgrading}
              >
                {upgrading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Text style={styles.upgradeButtonText}>
                      {plans.find(p => p.id === selectedPlan)?.tier.toLowerCase() === 'enterprise'
                        ? 'Contact Sales'
                        : (plans.find(p => p.id === selectedPlan)?.price_monthly === 0 ? 'Downgrade Now' : 'Upgrade Now')}
                    </Text>
                    <Text style={styles.upgradeButtonSubtext}>
                      {plans.find(p => p.id === selectedPlan)?.price_monthly === 0 ? 'No payment required' : `Start your ${annual ? 'annual' : 'monthly'} subscription`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  try {
                    router.back();
                  } catch (error) {
                    // Fallback navigation if back() fails
                    console.warn('Back navigation failed, using replace:', error);
                    router.replace('/screens/principal-dashboard');
                  }
                }}
              >
                <Text style={styles.cancelButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          )}

          {plans.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No upgrade options available</Text>
              <Text style={styles.emptyStateSubtext}>
                You're already on our highest tier or there are no upgrade options available.
              </Text>
            </View>
          )}
          
        </ScrollView>
      </View>
    );
  } catch (renderError: any) {
    // Fallback render for crash protection
    console.error('Subscription upgrade screen render error:', renderError);
    return (
      <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.errorTitle}>Unable to Load Upgrade Options</Text>
            <Text style={styles.loadingText}>Please try restarting the app</Text>
            <TouchableOpacity
              style={[styles.cancelButton, { marginTop: 20, backgroundColor: '#00f5ff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }]}
              onPress={() => {
                try {
                  router.back();
                } catch {
                  router.replace('/screens/principal-dashboard');
                }
              }}
            >
              <Text style={[styles.cancelButtonText, { color: '#000', fontWeight: '600' }]}>Go Back</Text>
            </TouchableOpacity>
          </View>
      </View>
    );
  }
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
    gap: 20,
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
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  
  // Header Section
  headerSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  reasonIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },

  // Current Tier
  currentTierCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  currentTierLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 4,
  },
  currentTierName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  // Billing Toggle
  toggleSection: {
    alignItems: 'center',
  },
  toggleLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#111827',
    padding: 4,
    borderRadius: 12,
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    position: 'relative',
  },
  toggleBtnActive: {
    backgroundColor: '#00f5ff',
  },
  toggleBtnText: {
    color: '#9CA3AF',
    fontWeight: '700',
    fontSize: 14,
  },
  toggleBtnTextActive: {
    color: '#000',
  },
  savingsBadge: {
    position: 'absolute',
    top: -8,
    right: -4,
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Plans Section
  plansSection: {
    marginTop: 8,
  },
  plansSectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  plansGrid: {
    gap: 12,
  },
  planCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#1f2937',
  },
  planCardSelected: {
    shadowColor: '#00f5ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planTitleSection: {
    flex: 1,
  },
  planName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  planTierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  planTier: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  
  // Price Section
  priceSection: {
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: '900',
    marginRight: 4,
  },
  pricePeriod: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  annualPrice: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  savingsAmount: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  customPrice: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  // Features Section
  featuresSection: {
    gap: 12,
  },
  limitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
  },
  limitItem: {
    alignItems: 'center',
  },
  limitNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  limitLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  featuresList: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  featureText: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  moreFeatures: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },

  // CTA Section
  ctaSection: {
    gap: 12,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  upgradeButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  upgradeButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
  },
  upgradeButtonSubtext: {
    color: '#000',
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  emptyStateTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

// Error boundary for this screen
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { router } = require('expo-router');
  
  // Optional: Report error to Sentry in production
  if (!__DEV__) {
    try {
      // Sentry.captureException(error);
    } catch {
      // Fail silently if Sentry is not available
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <Ionicons name="warning" size={48} color="#ef4444" style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 18, color: '#fff', textAlign: 'center', marginBottom: 8 }}>
          Something went wrong
        </Text>
        <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 24 }}>
          The upgrade screen encountered an error and couldn't load.
        </Text>
        <TouchableOpacity 
          style={{ backgroundColor: '#00f5ff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginBottom: 12 }}
          onPress={retry}
        >
          <Text style={{ color: '#000', fontWeight: '700' }}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ backgroundColor: '#374151', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}
