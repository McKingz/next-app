import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ComparisonTable } from '../components/pricing/ComparisonTable';
import type { PlanId } from '../components/pricing/ComparisonTable';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/rbac';
import { salesOrPricingPath } from '@/lib/sales';
import { navigateTo } from '@/lib/navigation/router-utils';
import { useTranslation } from 'react-i18next';

export default function PricingScreen() {
  const { t } = useTranslation();
  const [annual, setAnnual] = useState(false);
  const { profile } = useAuth();
  const roleNorm = normalizeRole(String(profile?.role || ''));
  const canRequestEnterprise = roleNorm === 'principal_admin' || roleNorm === 'super_admin';
  const isParent = profile?.role === 'parent';

  const priceStr = (monthly: number): string => {
    if (annual) {
      const yearly = Math.round(monthly * 12 * 0.9);
      return `R${yearly} / year (save 10%)`;
    }
    return `R${monthly} / month`;
  };

  // Role-based plan visibility: parents see parent plans only, teachers see teacher plans, admins see all
  const visiblePlans: PlanId[] | undefined = isParent 
    ? ['free', 'parent-starter', 'parent-plus'] 
    : (canRequestEnterprise ? undefined : ['free','parent-starter','parent-plus','private-teacher','pro']);

  // Cards will be displayed in a responsive grid (no carousel)

  const topPlanItems = [
    {
      key: 'free',
      render: () => (
        <PlanCard
          name="Free"
          price={priceStr(0)}
          description="Get started with basics"
          features={[
            'Mobile app access',
            'Homework Helper (limited)',
            'Lesson generator (limited)',
            'Community support',
          ]}
          ctaText={t('pricing.cta.start_free', { defaultValue: 'Start Free' })}
          onPress={() => navigateTo.signUpWithPlan({ tier: 'free', billing: annual ? 'annual' : 'monthly' })}
        />
      ),
    },
    {
      key: 'parent-starter',
      render: () => (
        <PlanCard
          name="Parent Starter"
          price={priceStr(49.99)}
          description="1 parent - 1 child"
          features={[
            'Homework Helper · 30/mo',
            'Child-safe explanations',
            'Email support',
          ]}
          ctaText={t('pricing.cta.choose_named', { defaultValue: 'Choose Parent Starter', name: 'Parent Starter' })}
          onPress={() => navigateTo.subscriptionSetup({ planId: 'parent-starter', billing: annual ? 'annual' : 'monthly', auto: true })}
        />
      ),
    },
    {
      key: 'parent-plus',
      render: () => (
        <PlanCard
          name="Parent Plus"
          price={priceStr(149.99)}
          description="2 parents - 3 children"
          features={[
            'Homework Helper · 100/mo',
            'Priority processing',
            'Basic analytics',
          ]}
          ctaText={t('pricing.cta.choose_named', { defaultValue: 'Choose Parent Plus', name: 'Parent Plus' })}
          onPress={() => navigateTo.subscriptionSetup({ planId: 'parent-plus', billing: annual ? 'annual' : 'monthly', auto: true })}
        />
      ),
    },
    {
      key: 'private-teacher',
      render: () => (
        <PlanCard
          name="Starter (School)"
          price={priceStr(299)}
          description="For preschools getting started with AI"
          features={[
            'Up to 5 teachers · 150 students',
            'AI insights for classrooms',
            'Parent portal & messaging',
            'WhatsApp notifications',
          ]}
          ctaText={t('pricing.cta.choose_named', { defaultValue: 'Choose Starter', name: 'Starter' })}
          onPress={() => navigateTo.subscriptionSetup({ planId: 'private-teacher', billing: annual ? 'annual' : 'monthly', auto: true })}
        />
      ),
    },
    {
      key: 'pro',
      render: () => (
        <PlanCard
          name="Premium (School)"
          price={priceStr(599)}
          description="Best for schools and organizations"
          highlights={['Best for schools']}
          features={[
            'Up to 15 teachers · 500 students',
            'Advanced reporting & analytics',
            'Priority support',
            'Custom branding & API access',
          ]}
          ctaText={t('subscription.upgradeToPro', { defaultValue: 'Choose Premium' })}
          onPress={() => navigateTo.subscriptionSetup({ planId: 'pro', billing: annual ? 'annual' : 'monthly', auto: true })}
        />
      ),
    },
  ] as const

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#0b1220' }}>
      <Stack.Screen options={{ title: t('pricing.title', { defaultValue: 'Pricing' }), headerStyle: { backgroundColor: '#0b1220' }, headerTitleStyle: { color: '#fff' }, headerTintColor: '#00f5ff' }} />
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text style={styles.title}>{t('pricing.plans_title', { defaultValue: 'Plans & Pricing' })}</Text>
            <Text style={styles.subtitle}>
              {t('pricing.subtitle_app', { defaultValue: 'Flexible options for individuals, preschools and schools.' })}
            </Text>
            
            {/* Current Plan Banner */}
            {String((profile as any)?.plan_tier || 'free').toLowerCase() === 'free' && (
              <View style={styles.currentPlanBanner}>
                <View style={styles.bannerContent}>
                  <View style={styles.bannerLeft}>
                    <Text style={styles.bannerLabel}>Current Plan</Text>
                    <Text style={styles.bannerPlan}>Free</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => navigateTo.subscriptionSetup({ planId: 'pro', billing: annual ? 'annual' : 'monthly', auto: true })} 
                    style={styles.bannerButton}
                  >
                    <Text style={styles.bannerButtonText}>{t('common.upgrade', { defaultValue: 'Upgrade' })}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Billing toggle */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Billing Cycle</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity onPress={() => setAnnual(false)} style={[styles.toggleBtn, !annual && styles.toggleBtnActive]}>
                <Text style={[styles.toggleBtnText, !annual && styles.toggleBtnTextActive]}>
                  {t('pricing.monthly', { defaultValue: 'Monthly' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAnnual(true)} style={[styles.toggleBtn, annual && styles.toggleBtnActive]}>
                <Text style={[styles.toggleBtnText, annual && styles.toggleBtnTextActive]}>
                  {t('pricing.annual', { defaultValue: 'Annual' })}
                </Text>
                {annual && <Text style={styles.saveBadge}>Save 10%</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {/* Plans Grid - show all plans at once */}
          <View style={styles.plansGrid}>
            {topPlanItems.map((item) => (
              <View key={item.key} style={styles.planCol}>
                {item.render()}
              </View>
            ))}

            {canRequestEnterprise && (
              <View style={styles.planCol}>
                <PlanCard
                  name="Preschool Pro"
                  price={annual ? 'Custom (annual)' : 'Custom'}
                  description="For preschools"
                  highlights={['Org allocation available']}
                  features={[
                    'All Pro features',
                    'Org-level AI usage allocation',
                    'Seat-based licensing',
                    'Admin controls',
                  ]}
                  footnote="Org allocation available on Pro (R599) and up for preschools"
                  ctaText={canRequestEnterprise ? 'Contact sales' : 'Admin only'}
                  onPress={() => {
                    if (!canRequestEnterprise) {
                      Alert.alert(t('common.restricted', { defaultValue: 'Restricted' }), t('pricing.restricted_principal_only', { defaultValue: 'Only principals or school admins can request Preschool Pro.' }));
                      return;
                    }
                    router.push('/sales/contact?plan=preschool-pro')
                  }}
                />
              </View>
            )}

            {canRequestEnterprise && (
              <View style={styles.planCol}>
                <PlanCard
                  name="Enterprise (K-12)"
                  price={annual ? 'Special pricing (annual)' : 'Special pricing'}
                  description="For K-12 schools and districts"
                  highlights={['Best for schools']}
                  features={[
                    'All Pro features',
                    'Enterprise-grade security',
                    'Unlimited or pooled AI usage (as contracted)',
                    'Org-level AI usage allocation',
                    'SSO, advanced analytics',
                    'Dedicated support',
                  ]}
                  footnote="Org allocation available only on Enterprise for K-12"
                  ctaText={canRequestEnterprise ? 'Contact sales' : 'Admin only'}
                  onPress={() => {
                    if (!canRequestEnterprise) {
                      Alert.alert(t('common.restricted', { defaultValue: 'Restricted' }), t('pricing.restricted_enterprise_only', { defaultValue: 'Only principals or school admins can request Enterprise.' }));
                      return;
                    }
                    router.push('/sales/contact?plan=enterprise')
                  }}
                />
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>{t('pricing.notes.title', { defaultValue: 'NOTES' })}</Text>
            <Text style={styles.noteItem}>• {t('pricing.notes.quota', { defaultValue: 'AI quotas are monthly and reset at the start of each month.' })}</Text>
            <Text style={styles.noteItem}>• {t('pricing.notes.overages', { defaultValue: 'Overages require prepayment; once paid, access resumes immediately.' })}</Text>
            <Text style={styles.noteItem}>• {t('pricing.notes.model_selection', { defaultValue: 'Model selection affects cost; Opus > Sonnet > Haiku. We recommend Haiku for most classroom use.' })}</Text>
            <Text style={styles.noteItem}>• {t('pricing.notes.enterprise_contact', { defaultValue: 'For K-12 Enterprise pricing, contact sales. We tailor seat counts and AI usage pools to your school size and needs.' })}</Text>
          </View>

          {/* Comparison table - full bleed width */}
          <View style={styles.fullBleed}>
            <ComparisonTable
              annual={annual}
              onSelectPlan={(planId) => {
                if (planId === 'preschool-pro' || planId === 'enterprise') {
                  if (!canRequestEnterprise) {
                    Alert.alert(t('common.restricted', { defaultValue: 'Restricted' }), t('pricing.restricted_submit_only', { defaultValue: 'Only principals or school admins can submit these requests.' }));
                    return;
                  }
                  router.push(`/sales/contact?plan=${planId}` as any)
                  return;
                }
                // All other plans: go to subscription setup
                navigateTo.subscriptionSetup({ planId: planId, billing: annual ? 'annual' : 'monthly' })
              }}
            />
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({ name, price, description, features, ctaText, onPress, footnote, highlights }: {
  name: string;
  price: string;
  description: string;
  features: string[];
  ctaText: string;
  onPress: () => void;
  footnote?: string;
  highlights?: string[];
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{name}</Text>
        {highlights && highlights.length > 0 && (
          <View style={styles.badge}><Text style={styles.badgeText}>{highlights[0]}</Text></View>
        )}
      </View>
      <Text style={styles.cardPrice}>{price}</Text>
      <Text style={styles.cardText}>{description}</Text>
      <View style={styles.featureList}>
        {features.map((f) => (
          <View key={f} style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
      <TouchableOpacity style={styles.cta} onPress={onPress}>
        <Text style={styles.ctaText}>{ctaText}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: 20, 
    gap: 20,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  
  // Header Section
  headerSection: {
    gap: 12,
    marginBottom: 8,
  },
  title: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: { 
    color: '#9CA3AF', 
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  
  // Current Plan Banner
  currentPlanBanner: {
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.3)',
    padding: 16,
    marginTop: 8,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    gap: 4,
  },
  bannerLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bannerPlan: {
    color: '#00f5ff',
    fontSize: 20,
    fontWeight: '800',
  },
  bannerButton: {
    backgroundColor: '#00f5ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#00f5ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
  
  // Toggle Section
  toggleContainer: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  toggleLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toggleRow: { 
    flexDirection: 'row', 
    gap: 0,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  toggleBtn: { 
    paddingVertical: 10, 
    paddingHorizontal: 24, 
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  toggleBtnActive: { 
    backgroundColor: '#00f5ff',
    shadowColor: '#00f5ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleBtnText: { 
    color: '#6B7280', 
    fontWeight: '700',
    fontSize: 14,
  },
  toggleBtnTextActive: { 
    color: '#000',
  },
  saveBadge: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  
  // Plan Cards
  grid: { gap: 16 },
  plansGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  planCol: {
    width: '100%',
  },
  '@media (min-width: 768px)': {
    planCol: {
      width: '48%',
    },
  },
  '@media (min-width: 1024px)': {
    planCol: {
      width: '31%',
    },
  },
  card: { 
    backgroundColor: '#111827', 
    borderRadius: 16, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: { 
    color: '#fff', 
    fontWeight: '800', 
    fontSize: 20,
    letterSpacing: -0.3,
  },
  cardPrice: { 
    color: '#00f5ff', 
    fontWeight: '900', 
    marginBottom: 8, 
    fontSize: 28,
    letterSpacing: -0.5,
  },
  cardText: { 
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  featureList: { 
    marginTop: 12,
    gap: 8,
  },
  featureItem: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 10,
  },
  featureBullet: { 
    color: '#00f5ff',
    fontSize: 18,
    fontWeight: '800',
  },
  featureText: { 
    color: '#d1d5db', 
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  footnote: { 
    color: '#6B7280', 
    marginTop: 12, 
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  cta: { 
    marginTop: 16, 
    backgroundColor: '#00f5ff', 
    paddingVertical: 14, 
    paddingHorizontal: 24, 
    borderRadius: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
    shadowColor: '#00f5ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: { 
    color: '#000', 
    fontWeight: '800',
    fontSize: 16,
  },
  
  // Full bleed section for wide components
  fullBleed: {
    marginHorizontal: -20,
  },
  // Notes Section
  notes: { 
    marginTop: 24, 
    backgroundColor: 'rgba(17, 24, 39, 0.5)', 
    padding: 20, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#1f2937',
  },
  notesTitle: { 
    color: '#00f5ff', 
    fontWeight: '800', 
    marginBottom: 12,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  noteItem: { 
    color: '#9CA3AF', 
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 20,
  },
  
  // Badges
  badge: { 
    backgroundColor: '#00f5ff', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 999,
  },
  badgeText: { 
    color: '#000', 
    fontWeight: '800', 
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Carousel Dots
  dotsRow: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 8, 
    marginTop: 16,
  },
  dot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: '#334155',
  },
  dotActive: { 
    backgroundColor: '#00f5ff',
    width: 24,
    shadowColor: '#00f5ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
});
