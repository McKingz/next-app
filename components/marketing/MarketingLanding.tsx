import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { setPageMetadata, landingPageSEO } from '@/lib/webSEO';

// Modern design system imports
import { marketingTokens } from './tokens';
import { useResponsive } from './useResponsive';

// Section components
import { HeroSection } from './sections/HeroSection';
import { TrustBadgesSection } from './sections/TrustBadgesSection';
import { FeaturesSection } from './sections/FeaturesSection';
import { DashAISection } from './sections/DashAISection';
import { RoleBasedBenefitsSection } from './sections/RoleBasedBenefitsSection';
import { TestimonialsSection } from './sections/TestimonialsSection';
import { PricingSection } from './sections/PricingSection';
import { QASection } from './sections/QASection';
import { CTASection } from './sections/CTASection';
import { FooterSection } from './sections/FooterSection';
import { PWAInstallButton } from './PWAInstallButton';

const isWeb = Platform.OS === 'web';

/**
 * Modern marketing landing page with glassmorphism design
 * Dark theme optimized for web and mobile
 * 
 * Architecture: Modular section-based design
 * Each section is a self-contained component in ./sections/
 * 
 * Design System:
 * - Dark minimal theme with glassmorphism
 * - Cyan/blue gradient accents
 * - Mobile-first responsive scaling
 * - Accessibility-friendly (WCAG AA contrast, 44dp touch targets)
 * 
 * @returns Marketing landing page with all sections
 */
export default function MarketingLanding() {
  const [refreshing, setRefreshing] = useState(false);
  const { columns } = useResponsive();

  // Web-only: handle invitation codes and SEO
  useEffect(() => {
    if (isWeb) {
      try {
        const sp = new URLSearchParams(window.location.search);
        const rawCode = sp.get('code') || sp.get('invitationCode');
        if (rawCode) {
          router.replace(`/invite?code=${encodeURIComponent(rawCode)}` as any);
        }
      } catch (e) {
        console.warn('[Landing] Failed to parse query for invite code:', e);
      }
      setPageMetadata(landingPageSEO);
    }
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent />
      
      {/* Background gradient */}
      <LinearGradient
        colors={marketingTokens.gradients.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={marketingTokens.colors.accent.cyan400}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero with headline and CTAs */}
        <HeroSection />
        
        {/* Trust badges row */}
        <TrustBadgesSection />
        
        {/* Feature grid with glass cards */}
        <FeaturesSection columns={columns} />
        
        {/* Dash AI showcase */}
        <DashAISection />
        
        {/* Role-based benefits (Teachers, Parents, Principals) */}
        <RoleBasedBenefitsSection columns={columns} />
        
        {/* Testimonial carousel */}
        <TestimonialsSection columns={columns} />
        
        {/* Pricing tiers */}
        <PricingSection columns={columns} />
        
        {/* FAQ accordion */}
        <QASection />
        
        {/* Final CTA */}
        <CTASection />
        
        {/* Footer */}
        <FooterSection />
      </ScrollView>

      {/* PWA Install Prompt (web only) */}
      <PWAInstallButton />
    </View>
  );
}

/**
 * Styles for container and scroll view only
 * All section styles are co-located in ./sections/ components
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: marketingTokens.colors.bg.base,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
});
