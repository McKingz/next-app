/**
 * Pricing Utilities
 * Tier configurations, filtering logic, and helper functions
 */

import type { ColorValue } from 'react-native';

export interface PricingTier {
  id: string;
  name: string;
  tier: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  recommended?: boolean;
  cta: string;
  color: readonly ColorValue[];
  isEnterprise: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: string;
  price_monthly: number;
  price_annual: number | null;
  max_teachers: number;
  max_students: number;
  features: any;
  is_active: boolean;
  [key: string]: any;
}

export interface TierConfig {
  description: string;
  descriptionKey: string;
  defaultFeatures: string[];
  recommended: boolean;
  color: readonly ColorValue[];
}

/**
 * Get tier-specific configuration (features, colors, descriptions)
 */
export const getTierConfig = (tier: string, isParent: boolean = false): TierConfig => {
  const tierLower = tier.toLowerCase();
  
  const configs: Record<string, TierConfig> = {
    free: {
      description: isParent ? 'Get started with basic AI help' : 'Perfect for small preschools getting started',
      descriptionKey: 'pricing.tier.free.desc',
      defaultFeatures: isParent 
        ? ['Homework Helper (10/month)', 'Child progress tracking', 'Teacher messaging']
        : ['Basic dashboard', 'Student management', 'Parent communication'],
      recommended: false,
      color: ['#00f5ff', '#0080ff'],
    },
    'parent-starter': {
      description: 'Affordable AI help for families',
      descriptionKey: 'pricing.tier.parent_starter.desc',
      defaultFeatures: [
        'Homework Helper (30/month)',
        'AI Lesson Support',
        'Child-safe explanations',
        'Progress tracking',
        'Email support'
      ],
      recommended: true,
      color: ['#8000ff', '#ff0080'],
    },
    'parent-plus': {
      description: 'Expanded AI support for families',
      descriptionKey: 'pricing.tier.parent_plus.desc',
      defaultFeatures: [
        'Homework Helper (100/month)',
        'Priority processing',
        'Basic analytics',
        'Advanced learning insights',
        'Priority support'
      ],
      recommended: false,
      color: ['#ff0080', '#8000ff'],
    },
    starter: {
      description: 'Essential features for growing schools',
      descriptionKey: 'pricing.tier.starter.desc',
      defaultFeatures: [
        'Up to 5 teachers',
        '150 students',
        'AI-powered insights',
        'Parent portal',
        'WhatsApp notifications',
        'Email support'
      ],
      recommended: true,
      color: ['#8000ff', '#ff0080'],
    },
    premium: {
      description: 'Professional features for established schools',
      descriptionKey: 'pricing.tier.premium.desc',
      defaultFeatures: [
        'Up to 15 teachers',
        '500 students',
        'Advanced reporting',
        'Priority support',
        'Custom branding',
        'API access',
        'Advanced analytics'
      ],
      recommended: false,
      color: ['#ff0080', '#8000ff'],
    },
    enterprise: {
      description: 'Complete solution for large organizations',
      descriptionKey: 'pricing.tier.enterprise.desc',
      defaultFeatures: [
        'Up to 100 teachers',
        'Unlimited students',
        'Dedicated success manager',
        'SLA guarantee',
        'White-label solution',
        'Custom integrations',
        '24/7 priority support'
      ],
      recommended: false,
      color: ['#ff8000', '#ff0080'],
    },
  };
  
  return configs[tierLower] || configs.starter;
};

/**
 * Filter plans by user role (parents vs schools)
 */
export const filterPlansByRole = (plans: SubscriptionPlan[], isParent: boolean): SubscriptionPlan[] => {
  if (!isParent) return plans;
  
  // For parents, only show parent-specific tiers
  return plans.filter((plan) => {
    const tierLower = (plan.tier || '').toLowerCase();
    return tierLower === 'free' || tierLower.includes('parent');
  });
};

/**
 * Parse features from various formats (array, string, JSON)
 */
export const parseFeatures = (features: any): string[] => {
  try {
    if (Array.isArray(features)) {
      return features;
    } else if (typeof features === 'string') {
      return JSON.parse(features);
    } else if (features && typeof features === 'object') {
      return features;
    }
  } catch {
    return [];
  }
  return [];
};

/**
 * Convert database plan to display tier
 */
export const convertToDisplayTier = (
  plan: SubscriptionPlan,
  isAnnual: boolean,
  isParent: boolean,
  t: (key: string, options?: any) => string
): PricingTier => {
  const isEnterprise = plan.tier.toLowerCase() === 'enterprise';
  const price = isAnnual ? (plan.price_annual || plan.price_monthly * 10) : plan.price_monthly;
  
  const tierConfig = getTierConfig(plan.tier, isParent);
  const planFeatures = parseFeatures(plan.features);
  
  return {
    id: plan.id,
    name: plan.name,
    tier: plan.tier,
    price: price === 0 ? 'Free' : (isEnterprise ? 'Custom' : `R${price}`),
    period: price === 0 || isEnterprise ? '' : `/${isAnnual ? 'year' : 'month'}`,
    description: t(tierConfig.descriptionKey, { defaultValue: tierConfig.description }),
    features: planFeatures.length > 0 ? planFeatures : tierConfig.defaultFeatures,
    recommended: tierConfig.recommended,
    cta: isEnterprise 
      ? t('pricing.cta.contact_sales', { defaultValue: 'Contact Sales' }) 
      : (price === 0 
        ? t('pricing.cta.start_free', { defaultValue: 'Start Free' }) 
        : t('pricing.cta.choose_named', { defaultValue: `Choose ${plan.name}`, name: plan.name })),
    color: tierConfig.color,
    isEnterprise,
  };
};
