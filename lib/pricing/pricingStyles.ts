/**
 * Pricing Page Styles
 * Extracted from app/marketing/pricing.tsx
 */

import { StyleSheet, Dimensions } from 'react-native';
import { DesignSystem } from '@/constants/DesignSystem';

const { width } = Dimensions.get('window');
const isDesktop = width >= 1024;

export const pricingStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#00f5ff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 16,
    alignSelf: 'center',
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#00f5ff',
  },
  toggleOptionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleOptionTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  toggleOptionSavings: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  toggleOptionSavingsActive: {
    color: '#000000',
    opacity: 0.7,
  },
  container: {
    flex: 1,
    backgroundColor: DesignSystem.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isDesktop ? 40 : 20,
    marginBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: '#00f5ff',
    marginLeft: 8,
    fontWeight: '600',
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: DesignSystem.colors.text.primary,
  },
  signInButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00f5ff',
  },
  signInText: {
    color: '#00f5ff',
    fontWeight: '600',
  },
  pricingHeader: {
    alignItems: 'center',
    paddingHorizontal: isDesktop ? 40 : 20,
  },
  pricingTitle: {
    fontSize: isDesktop ? 48 : 32,
    fontWeight: '900',
    color: DesignSystem.colors.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  pricingSubtitle: {
    fontSize: isDesktop ? 20 : 16,
    color: DesignSystem.colors.text.secondary,
    textAlign: 'center',
    maxWidth: 600,
  },
  pricingSection: {
    flex: 1,
  },
  pricingSectionGradient: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: isDesktop ? 40 : 20,
  },
  pricingGrid: {
    flexDirection: isDesktop ? 'row' : 'column',
    justifyContent: 'center',
    alignItems: isDesktop ? 'flex-start' : 'center',
    gap: 24,
    marginBottom: 60,
  },
  pricingCard: {
    width: isDesktop ? 320 : '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  pricingCardDesktop: {
    minHeight: 600,
  },
  recommendedCard: {
    transform: isDesktop ? [{ scale: 1.05 }] : [{ scale: 1 }],
  },
  recommendedBadge: {
    position: 'absolute',
    top: -1,
    left: 20,
    right: 20,
    zIndex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  badgeGradient: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  badgeText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
  cardGradient: {
    padding: 24,
    paddingTop: 32,
    minHeight: isDesktop ? 560 : 400,
    justifyContent: 'space-between',
  },
  cardHeader: {
    marginBottom: 24,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '800',
    color: DesignSystem.colors.text.primary,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  price: {
    fontSize: 36,
    fontWeight: '900',
    color: DesignSystem.colors.text.primary,
  },
  period: {
    fontSize: 16,
    color: DesignSystem.colors.text.secondary,
    marginLeft: 4,
  },
  description: {
    fontSize: 14,
    color: DesignSystem.colors.text.secondary,
    lineHeight: 20,
  },
  featuresList: {
    flex: 1,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: DesignSystem.colors.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  ctaButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 24,
  },
  recommendedButton: {},
  ctaGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00f5ff',
  },
  recommendedCtaText: {
    color: '#000000',
  },
  enterpriseSection: {
    marginBottom: 60,
    borderRadius: 20,
    overflow: 'hidden',
  },
  enterpriseGradient: {
    padding: 32,
    alignItems: 'center',
  },
  enterpriseTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: DesignSystem.colors.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  enterpriseText: {
    fontSize: 16,
    color: DesignSystem.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 600,
    lineHeight: 22,
  },
  enterpriseFeatures: {
    marginBottom: 32,
  },
  enterpriseFeature: {
    fontSize: 16,
    color: DesignSystem.colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  enterpriseButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  enterpriseButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  enterpriseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  faqSection: {
    marginBottom: 40,
  },
  faqTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: DesignSystem.colors.text.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  faqList: {
    gap: 16,
  },
  faqItem: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  faqItemGradient: {
    padding: 20,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignSystem.colors.text.primary,
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 14,
    color: DesignSystem.colors.text.secondary,
    marginTop: 12,
    lineHeight: 20,
  },
});
