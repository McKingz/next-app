/**
 * Pricing Page UI Components
 * Extracted from app/marketing/pricing.tsx for better modularity
 */

import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { navigateTo } from '@/lib/navigation/router-utils';
import type { PricingTier } from '@/lib/pricing/pricingUtils';
import { pricingStyles as styles } from '@/lib/pricing/pricingStyles';

const { width } = Dimensions.get('window');
const isDesktop = width >= 1024;

export const Header = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <IconSymbol name="arrow.left" size={24} color="#00f5ff" />
        <Text style={styles.backText}>{t('marketing.pricing.back_to_home', { defaultValue: 'Back to Home' })}</Text>
      </TouchableOpacity>
      
      <View style={styles.logo}>
        <LinearGradient colors={['#00f5ff', '#8000ff']} style={styles.logoGradient}>
          <IconSymbol name="help-circle" size={28} color="#000000" />
        </LinearGradient>
        <Text style={styles.logoText}>{t('app.fullName', { defaultValue: 'EduDash Pro' })}</Text>
      </View>
      
      <TouchableOpacity 
        style={styles.signInButton} 
        onPress={() => router.push('/(auth)/sign-in')}
      >
        <Text style={styles.signInText}>{t('auth.signIn', { defaultValue: 'Sign In' })}</Text>
      </TouchableOpacity>
    </View>
  );
};

export const PricingHeader = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.pricingHeader}>
      <Text style={styles.pricingTitle}>{t('pricing.choose_your_plan', { defaultValue: 'Choose Your Plan' })}</Text>
      <Text style={styles.pricingSubtitle}>
        {t('pricing.subtitle_marketing', { defaultValue: 'Flexible pricing for schools of all sizes. Start free and scale as you grow.' })}
      </Text>
    </View>
  );
};

export const BillingToggle = ({ isAnnual, onToggle }: { isAnnual: boolean; onToggle: (value: boolean) => void }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.billingToggle}>
      <TouchableOpacity 
        style={[styles.toggleOption, !isAnnual && styles.toggleOptionActive]}
        onPress={() => onToggle(false)}
      >
        <Text style={[styles.toggleOptionText, !isAnnual && styles.toggleOptionTextActive]}>{t('pricing.monthly', { defaultValue: 'Monthly' })}</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.toggleOption, isAnnual && styles.toggleOptionActive]}
        onPress={() => onToggle(true)}
      >
        <Text style={[styles.toggleOptionText, isAnnual && styles.toggleOptionTextActive]}>{t('pricing.annual', { defaultValue: 'Annual' })}</Text>
        <Text style={[styles.toggleOptionSavings, isAnnual && styles.toggleOptionSavingsActive]}>{t('pricing.save_percent', { defaultValue: 'Save 10%' })}</Text>
      </TouchableOpacity>
    </View>
  );
};

export const PricingGrid = ({ tiers, onPlanCTA }: { tiers: PricingTier[]; onPlanCTA: (tier: PricingTier) => void }) => (
  <View style={styles.pricingGrid}>
    {tiers.map((tier, index) => (
      <PricingCard key={tier.id} tier={tier} index={index} onPlanCTA={onPlanCTA} />
    ))}
  </View>
);

export const PricingCard = ({ tier, index, onPlanCTA }: { tier: PricingTier; index?: number; onPlanCTA: (tier: PricingTier) => void }) => {
  const { t } = useTranslation();
  return (
    <View style={[
      styles.pricingCard,
      tier.recommended && styles.recommendedCard,
      isDesktop && styles.pricingCardDesktop
    ]}>
      {tier.recommended && (
        <View style={styles.recommendedBadge}>
          <LinearGradient colors={tier.color as [string, string]} style={styles.badgeGradient}>
            <Text style={styles.badgeText}>{t('pricing.most_popular', { defaultValue: 'Most Popular' })}</Text>
          </LinearGradient>
        </View>
      )}
      
      <LinearGradient
        colors={tier.recommended 
          ? ['rgba(128,0,255,0.1)', 'rgba(255,0,128,0.1)'] 
          : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']
        }
        style={styles.cardGradient}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.tierName}>{tier.name}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{tier.price}</Text>
            {tier.period && <Text style={styles.period}>{tier.period}</Text>}
          </View>
          <Text style={styles.description}>{tier.description}</Text>
        </View>
        
        <View style={styles.featuresList}>
          {tier.features.map((feature, idx) => (
            <View key={idx} style={styles.featureItem}>
              <IconSymbol name="checkmark.circle" size={16} color="#00f5ff" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
        
        <TouchableOpacity 
          style={[
            styles.ctaButton,
            tier.recommended && styles.recommendedButton
          ]}
          onPress={() => onPlanCTA(tier)}
        >
          <LinearGradient
            colors={tier.recommended 
              ? tier.color as [string, string] 
              : ['rgba(0,245,255,0.2)', 'rgba(0,128,255,0.2)']
            }
            style={styles.ctaGradient}
          >
            <Text style={[
              styles.ctaText,
              tier.recommended && styles.recommendedCtaText
            ]}>
              {tier.cta}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

export const EnterpriseSection = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.enterpriseSection}>
      <LinearGradient colors={['#0f3460', '#533a71']} style={styles.enterpriseGradient}>
        <Text style={styles.enterpriseTitle}>{t('pricing.need_custom', { defaultValue: 'Need Something Custom?' })}</Text>
        <Text style={styles.enterpriseText}>
          {t('pricing.enterprise_subtitle', { defaultValue: 'Our enterprise solutions are designed for large school districts, government education departments, and multi-national education providers.' })}
        </Text>
        <View style={styles.enterpriseFeatures}>
          <Text style={styles.enterpriseFeature}>🏢 {t('pricing.enterprise.features.multi_tenant', { defaultValue: 'Multi-tenant architecture' })}</Text>
          <Text style={styles.enterpriseFeature}>🔒 {t('pricing.enterprise.features.advanced_security', { defaultValue: 'Advanced security & compliance' })}</Text>
          <Text style={styles.enterpriseFeature}>🔧 {t('pricing.enterprise.features.custom_integrations', { defaultValue: 'Custom integrations & APIs' })}</Text>
          <Text style={styles.enterpriseFeature}>📞 {t('pricing.enterprise.features.dedicated_support', { defaultValue: 'Dedicated support team' })}</Text>
        </View>
        <TouchableOpacity 
          style={styles.enterpriseButton}
          onPress={() => navigateTo.contact()}
        >
          <LinearGradient colors={['#ff8000', '#ff0080']} style={styles.enterpriseButtonGradient}>
            <Text style={styles.enterpriseButtonText}>{t('pricing.schedule_enterprise_demo', { defaultValue: 'Schedule Enterprise Demo' })}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

export const FAQSection = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.faqSection}>
      <Text style={styles.faqTitle}>{t('pricing.faq_title', { defaultValue: 'Frequently Asked Questions' })}</Text>
      <View style={styles.faqList}>
        <FAQItem 
          question={t('pricing.faq.q1', { defaultValue: 'Can I upgrade or downgrade my plan anytime?' })}
          answer={t('pricing.faq.a1', { defaultValue: 'Yes! You can change your plan at any time. Upgrades take effect immediately, and downgrades take effect at the start of your next billing cycle.' })}
        />
        <FAQItem 
          question={t('pricing.faq.q2', { defaultValue: 'Is there a setup fee?' })}
          answer={t('pricing.faq.a2', { defaultValue: 'No setup fees for Starter and Professional plans. Enterprise plans may include implementation services.' })}
        />
        <FAQItem 
          question={t('pricing.faq.q3', { defaultValue: 'What payment methods do you accept?' })}
          answer={t('pricing.faq.a3', { defaultValue: 'We accept all major credit cards, PayFast, and bank transfers for South African customers.' })}
        />
      </View>
    </View>
  );
};

export const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  
  return (
    <TouchableOpacity 
      style={styles.faqItem}
      onPress={() => setIsOpen(!isOpen)}
    >
      <LinearGradient
        colors={isOpen 
          ? ['rgba(0,245,255,0.1)', 'rgba(128,0,255,0.1)']
          : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']
        }
        style={styles.faqItemGradient}
      >
        <View style={styles.faqHeader}>
          <Text style={styles.faqQuestion}>{question}</Text>
          <IconSymbol 
            name={isOpen ? 'chevron.up' : 'chevron.down'} 
            size={20} 
            color="#00f5ff" 
          />
        </View>
        {isOpen && <Text style={styles.faqAnswer}>{answer}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
};
