import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import { useTranslation } from 'react-i18n';

// Temporary wrappers to allow className usage without type errors during migration
const V = View as any;
const T = Text as any;
const TO = TouchableOpacity as any;
const SV = ScrollView as any;

interface PricingFeature {
  name: string;
  free: boolean | string;
  parent_starter: boolean | string;
  parent_plus: boolean | string;
  private_teacher: boolean | string;
  pro: boolean | string;
  preschool_pro: boolean | string;
  enterprise: boolean | string;
  category?: 'core' | 'ai' | 'advanced' | 'support';
}

interface PricingPlan {
  id: string;
  name: string;
  price_monthly: string;
  price_annual: string;
  description: string;
  popular?: boolean;
  cta_text: string;
  target_audience: string;
}

const plans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price_monthly: 'R0',
    price_annual: 'R0',
    description: 'Basic tools for individual parents',
    cta_text: 'Get Started',
    target_audience: 'Individual Parents'
  },
  {
    id: 'parent_starter',
    name: 'Parent Starter',
    price_monthly: 'R49',
    price_annual: 'R490',
    description: 'Enhanced features for active parents',
    cta_text: 'Choose Starter',
    target_audience: 'Active Parents'
  },
  {
    id: 'parent_plus',
    name: 'Parent Plus',
    price_monthly: 'R149',
    price_annual: 'R1,490',
    description: 'Complete solution for engaged families',
    popular: true,
    cta_text: 'Choose Plus',
    target_audience: 'Engaged Families'
  },
  {
    id: 'private_teacher',
    name: 'Private Teacher',
    price_monthly: 'R299',
    price_annual: 'R2,990',
    description: 'Professional tools for individual educators',
    cta_text: 'For Teachers',
    target_audience: 'Private Educators'
  },
  {
    id: 'pro',
    name: 'Pro',
    price_monthly: 'R599',
    price_annual: 'R5,990',
    description: 'Advanced features for professional teachers',
    cta_text: 'Go Pro',
    target_audience: 'Professional Teachers'
  },
  {
    id: 'preschool_pro',
    name: 'Preschool Pro',
    price_monthly: 'Custom',
    price_annual: 'Custom',
    description: 'Complete solution for preschool management',
    cta_text: 'Contact Sales',
    target_audience: 'Preschools'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_monthly: 'Custom',
    price_annual: 'Custom',
    description: 'Scalable solution for large organizations',
    cta_text: 'Contact Sales',
    target_audience: 'Large Organizations'
  }
];

const features: PricingFeature[] = [
  // Core Features
  { name: 'Student Progress Tracking', free: true, parent_starter: true, parent_plus: true, private_teacher: true, pro: true, preschool_pro: true, enterprise: true, category: 'core' },
  { name: 'Basic Dashboard', free: true, parent_starter: true, parent_plus: true, private_teacher: true, pro: true, preschool_pro: true, enterprise: true, category: 'core' },
  { name: 'Assignment Management', free: '5/month', parent_starter: '50/month', parent_plus: 'Unlimited', private_teacher: 'Unlimited', pro: 'Unlimited', preschool_pro: 'Unlimited', enterprise: 'Unlimited', category: 'core' },
  { name: 'Communication Tools', free: 'Basic', parent_starter: 'Enhanced', parent_plus: 'Advanced', private_teacher: 'Advanced', pro: 'Advanced', enterprise: 'Advanced', preschool_pro: 'Advanced', category: 'core' },
  
  // AI Features
  { name: 'AI Homework Helper', free: false, parent_starter: '10/month', parent_plus: '100/month', private_teacher: '200/month', pro: '500/month', preschool_pro: 'Custom', enterprise: 'Custom', category: 'ai' },
  { name: 'AI Lesson Generator', free: false, parent_starter: false, parent_plus: '25/month', private_teacher: '50/month', pro: '200/month', preschool_pro: 'Custom', enterprise: 'Custom', category: 'ai' },
  { name: 'AI Grading Assistant', free: false, parent_starter: false, parent_plus: false, private_teacher: '25/month', pro: '100/month', preschool_pro: 'Custom', enterprise: 'Custom', category: 'ai' },
  { name: 'STEM Activity Generator', free: false, parent_starter: false, parent_plus: false, private_teacher: '25/month', pro: '100/month', preschool_pro: 'Custom', enterprise: 'Custom', category: 'ai' },
  
  // Advanced Features
  { name: 'Analytics & Reports', free: 'Basic', parent_starter: 'Standard', parent_plus: 'Advanced', private_teacher: 'Advanced', pro: 'Professional', preschool_pro: 'Enterprise', enterprise: 'Enterprise', category: 'advanced' },
  { name: 'Multi-language Support', free: false, parent_starter: false, parent_plus: true, private_teacher: true, pro: true, preschool_pro: true, enterprise: true, category: 'advanced' },
  { name: 'API Access', free: false, parent_starter: false, parent_plus: false, private_teacher: false, pro: 'Limited', preschool_pro: 'Full', enterprise: 'Full', category: 'advanced' },
  { name: 'White-label Branding', free: false, parent_starter: false, parent_plus: false, private_teacher: false, pro: false, preschool_pro: true, enterprise: true, category: 'advanced' },
  { name: 'Principal Hub', free: false, parent_starter: false, parent_plus: false, private_teacher: false, pro: false, preschool_pro: true, enterprise: true, category: 'advanced' },
  
  // Support
  { name: 'Email Support', free: false, parent_starter: true, parent_plus: true, private_teacher: true, pro: true, preschool_pro: true, enterprise: true, category: 'support' },
  { name: 'Priority Support', free: false, parent_starter: false, parent_plus: true, private_teacher: true, pro: true, preschool_pro: true, enterprise: true, category: 'support' },
  { name: 'Phone Support', free: false, parent_starter: false, parent_plus: false, private_teacher: false, pro: false, preschool_pro: true, enterprise: true, category: 'support' },
  { name: 'Dedicated Account Manager', free: false, parent_starter: false, parent_plus: false, private_teacher: false, pro: false, preschool_pro: false, enterprise: true, category: 'support' },
];

interface PricingComparisonTableProps {
  isAnnual: boolean;
  onSelectPlan: (planId: string) => void;
  className?: string;
}

const FeatureIcon: React.FC<{ value: boolean | string }> = ({ value }) => {
  if (value === true) {
    return <Ionicons name="checkmark-circle" size={20} color="#10b981" />;
  }
  if (value === false) {
    return <Ionicons name="close-circle" size={20} color="#ef4444" />;
  }
  return <T className="text-sm text-gray-700 font-medium">{value}</T>;
};

export const PricingComparisonTable: React.FC<PricingComparisonTableProps> = ({
  isAnnual,
  onSelectPlan,
  className = ''
}) => {
  // const { t } = useTranslation(); // TODO: Add i18n support

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'core': return 'Core Features';
      case 'ai': return 'AI-Powered Features';
      case 'advanced': return 'Advanced Features';
      case 'support': return 'Support & Services';
      default: return 'Features';
    }
  };

  const groupedFeatures = features.reduce((acc, feature) => {
    const category = feature.category || 'core';
    if (!acc[category]) acc[category] = [];
    acc[category].push(feature);
    return acc;
  }, {} as Record<string, PricingFeature[]>);

  return (
    <V className={`w-full ${className}`}>
      {/* Mobile: Stacked Cards */}
      <V className="md:hidden">
        <SV horizontal showsHorizontalScrollIndicator={false} className="px-4">
          <V className="flex-row space-x-4 pb-4">
            {plans.map((plan) => (
              <V key={plan.id} className={`w-72 bg-white rounded-xl shadow-sm border ${plan.popular ? 'border-blue-500' : 'border-gray-200'} p-6`}>
                {plan.popular && (
                  <V className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 px-3 py-1 rounded-full">
                    <T className="text-white text-xs font-semibold">Most Popular</T>
                  </V>
                )}
                
                <V className="text-center mb-6">
                  <T className="text-lg font-bold text-gray-900 mb-1">{plan.name}</T>
                  <T className="text-sm text-gray-500 mb-3">{plan.target_audience}</T>
                  <T className="text-3xl font-bold text-gray-900">
                    {isAnnual ? plan.price_annual : plan.price_monthly}
                  </T>
                  {plan.price_monthly !== 'Custom' && isAnnual && (
                    <T className="text-sm text-green-600 font-medium">Save 17%</T>
                  )}
                  <T className="text-sm text-gray-500 mt-2">{plan.description}</T>
                </V>
                
                <TO
                  onPress={() => onSelectPlan(plan.id)}
                  className={`w-full py-3 px-4 rounded-lg mb-6 ${plan.popular ? 'bg-blue-500' : 'bg-gray-900'}`}
                >
                  <T className="text-white text-center font-semibold">{plan.cta_text}</T>
                </TO>
                
                <V className="space-y-3">
                  {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
                    <V key={category}>
                      <T className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">
                        {getCategoryTitle(category)}
                      </T>
                      {categoryFeatures.map((feature) => (
                        <V key={feature.name} className="flex-row items-center justify-between py-1">
                          <T className="text-sm text-gray-600 flex-1">{feature.name}</T>
                          <V className="ml-2">
                            <FeatureIcon value={feature[plan.id as keyof PricingFeature] as boolean | string} />
                          </V>
                        </V>
                      ))}
                    </V>
                  ))}
                </V>
              </V>
            ))}
          </V>
        </SV>
      </V>

      {/* Desktop: Full Comparison Table */}
      <V className="hidden md:block overflow-x-auto">
        <V className="min-w-full border border-gray-200 rounded-lg">
          {/* Header */}
          <V className="bg-gray-50 flex-row">
            <V className="w-64 p-4 border-r border-gray-200">
              <T className="text-sm font-semibold text-gray-700">Features</T>
            </V>
            {plans.map((plan) => (
              <V key={plan.id} className={`flex-1 min-w-32 p-4 border-r border-gray-200 text-center ${plan.popular ? 'bg-blue-50' : ''}`}>
                {plan.popular && (
                  <V className="bg-blue-500 px-2 py-1 rounded text-center mb-2">
                    <T className="text-white text-xs font-semibold">Most Popular</T>
                  </V>
                )}
                <T className="text-lg font-bold text-gray-900">{plan.name}</T>
                <T className="text-2xl font-bold text-gray-900 mt-2">
                  {isAnnual ? plan.price_annual : plan.price_monthly}
                </T>
                {plan.price_monthly !== 'Custom' && isAnnual && (
                  <T className="text-sm text-green-600 font-medium">Save 17%</T>
                )}
                <T className="text-sm text-gray-500 mt-2">{plan.target_audience}</T>
                <TO
                  onPress={() => onSelectPlan(plan.id)}
                  className={`w-full py-2 px-3 rounded-lg mt-3 ${plan.popular ? 'bg-blue-500' : 'bg-gray-900'}`}
                >
                  <T className="text-white text-center text-sm font-semibold">{plan.cta_text}</T>
                </TO>
              </V>
            ))}
          </V>

          {/* Feature Categories */}
          {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
            <V key={category}>
              <V className="bg-gray-100 flex-row">
                <V className="w-64 p-3 border-r border-gray-200">
                  <T className="text-sm font-bold text-gray-800">{getCategoryTitle(category)}</T>
                </V>
                {plans.map((plan) => (
                  <V key={plan.id} className="flex-1 min-w-32 p-3 border-r border-gray-200" />
                ))}
              </V>
              
              {categoryFeatures.map((feature, index) => (
                <V key={feature.name} className={`flex-row ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <V className="w-64 p-3 border-r border-gray-200">
                    <T className="text-sm text-gray-700">{feature.name}</T>
                  </V>
                  {plans.map((plan) => (
                    <V key={plan.id} className="flex-1 min-w-32 p-3 border-r border-gray-200 text-center items-center justify-center">
                      <FeatureIcon value={feature[plan.id as keyof PricingFeature] as boolean | string} />
                    </V>
                  ))}
                </V>
              ))}
            </V>
          ))}
        </V>
      </V>
    </V>
  );
};

export default PricingComparisonTable;
