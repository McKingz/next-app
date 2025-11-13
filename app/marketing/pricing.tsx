import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  ColorValue,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { navigateTo } from '@/lib/navigation/router-utils';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { DesignSystem } from '@/constants/DesignSystem';
import { setPageMetadata, pricingSEO } from '@/lib/webSEO';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import {
  type PricingTier,
  type SubscriptionPlan,
  filterPlansByRole,
  convertToDisplayTier,
} from '@/lib/pricing/pricingUtils';
import {
  Header,
  PricingHeader,
  BillingToggle,
  PricingGrid,
  EnterpriseSection,
  FAQSection,
} from '@/components/pricing/PricingPageComponents';
import { pricingStyles as styles } from '@/lib/pricing/pricingStyles';

export default function PricingPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);

  useEffect(() => {
    setPageMetadata(pricingSEO);
    loadPlans();
    
    // Track pricing page view
    track('pricing_viewed', {
      user_authenticated: !!profile,
      user_role: profile?.role || 'guest',
    });
  }, [profile]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      const isParent = profile?.role === 'parent';

      // Fetch plans via public RPC or fallback to direct access
      let { data, error } = await assertSupabase().rpc('public_list_plans');
      
      if (error || !data) {
        const response = await assertSupabase()
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('price_monthly', { ascending: true });
        
        data = response.data;
        error = response.error;
      }
      
      if (error) throw error;
      
      // Filter plans by user role
      const filteredData = filterPlansByRole(data || [], isParent);
      setPlans(filteredData);
      
    } catch (err: any) {
      console.error('Failed to load pricing plans:', err);
      setError(t('pricing.load_error', { defaultValue: 'Unable to load pricing information. Please try again later.' }));
    } finally {
      setLoading(false);
    }
  };

  
  
  const isParent = profile?.role === 'parent';
  const pricingTiers = plans.map((plan) => 
    convertToDisplayTier(plan, isAnnual, isParent, t)
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00f5ff" />
            <Text style={styles.loadingText}>{t('pricing.loading', { defaultValue: 'Loading pricing plans...' })}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
          <View style={styles.errorContainer}>
            <IconSymbol name="exclamationmark.triangle" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>{t('pricing.unable_title', { defaultValue: 'Unable to Load Pricing' })}</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadPlans}>
              <Text style={styles.retryButtonText}>{t('common.try_again', { defaultValue: 'Try Again' })}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const handlePlanCTA = (tier: PricingTier) => {
    // Track the CTA click
    track('plan_cta_clicked', {
      plan_tier: tier.tier,
      plan_name: tier.name,
      is_enterprise: tier.isEnterprise,
      user_authenticated: !!profile,
      user_role: profile?.role || 'guest',
    });

    if (tier.isEnterprise) {
      // Enterprise tier always goes to contact sales
      navigateTo.contact();
    } else {
      // Non-enterprise tiers
      const isPaid = tier.price !== 'Free';
      if (!profile) {
        // Not authenticated - go to sign up with plan context
        navigateTo.signUpWithPlan({
          tier: tier.tier,
          billing: isAnnual ? 'annual' : 'monthly'
        });
      } else if ((profile as any).organization_id) {
        // Authenticated with organization - go to subscription setup
        navigateTo.subscriptionSetup({
          planId: tier.id,
          billing: isAnnual ? 'annual' : 'monthly',
          auto: isPaid
        });
      } else {
        // Authenticated individual user - go to subscription setup
        navigateTo.subscriptionSetup({
          planId: tier.id,
          billing: isAnnual ? 'annual' : 'monthly',
          auto: isPaid
        });
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['#0a0a0f', '#1a0a2e', '#16213e', '#0f3460']}
            style={styles.headerGradient}
          >
            <Header />
            <PricingHeader />
            <BillingToggle isAnnual={isAnnual} onToggle={setIsAnnual} />
          </LinearGradient>
          
          <View style={styles.pricingSection}>
            <LinearGradient
              colors={DesignSystem.gradients.professionalSubtle as [ColorValue, ColorValue]}
              style={styles.pricingSectionGradient}
            >
              <PricingGrid tiers={pricingTiers} onPlanCTA={handlePlanCTA} />
              <EnterpriseSection />
              <FAQSection />
            </LinearGradient>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}


