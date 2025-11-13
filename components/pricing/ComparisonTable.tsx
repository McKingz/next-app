import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

// Enhanced responsive comparison table for React Native
// This table is static marketing UI; values mirror lib/ai/limits.ts DEFAULT_MONTHLY_QUOTAS
// and subscription rules. Avoid importing runtime logic (Supabase, etc.) here.

const { width } = Dimensions.get('window')
const isTablet = width >= 768

export type PlanId =
  | 'free'
  | 'parent-starter'
  | 'parent-plus'
  | 'private-teacher'
  | 'pro'
  | 'preschool-pro'
  | 'enterprise'

interface Feature {
  name: string
  category: 'ai' | 'core' | 'advanced' | 'support'
  description?: string
  icon?: string
}

interface FeatureValue {
  [key: string]: boolean | string | number
}

export function ComparisonTable({
  annual,
  onSelectPlan,
  visiblePlans,
}: {
  annual: boolean
  onSelectPlan?: (planId: PlanId) => void
  visiblePlans?: PlanId[]
}) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['ai', 'core'])
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(isTablet ? 'table' : 'cards')
  const priceStr = (plan: PlanId): string => {
    switch (plan) {
      case 'free':
        return annual ? 'R0 / year' : 'R0 / month'
      case 'parent-starter':
        return annual ? `R${Math.round(49.99 * 12 * 0.9)} / year` : 'R49.99 / month'
      case 'parent-plus':
        return annual ? `R${Math.round(149.99 * 12 * 0.9)} / year` : 'R149.99 / month'
      case 'private-teacher':
        return annual ? `R${Math.round(299 * 12 * 0.9)} / year` : 'R299 / month'
      case 'pro':
        return annual ? `R${Math.round(599 * 12 * 0.9)} / year` : 'R599 / month'
      case 'preschool-pro':
        return annual ? 'Custom (annual)' : 'Custom'
      case 'enterprise':
        return 'Custom pricing'
      default:
        return ''
    }
  }

  // Group plans: Parents, then Schools/Organizations
  const parentPlans: PlanId[] = ['free', 'parent-starter', 'parent-plus'];
  const schoolPlans: PlanId[] = ['free', 'private-teacher', 'pro', 'enterprise'];
  
  const defaultPlans: PlanId[] = [
    'free',
    'parent-starter',
    'parent-plus',
    'private-teacher',
    'pro',
    'preschool-pro',
    'enterprise',
  ]
  const plans: PlanId[] = (visiblePlans && visiblePlans.length > 0)
    ? visiblePlans
    : defaultPlans

  const planName: Record<PlanId, string> = {
    'free': 'Free',
    'parent-starter': 'Parent Starter',
    'parent-plus': 'Parent Plus',
    'private-teacher': 'Starter',
    'pro': 'Premium',
    'preschool-pro': 'Preschool Pro',
    'enterprise': 'Enterprise',
  }

  // Monthly quotas (marketing display) integrated into featureValues below

  const yesNo = (v: boolean) => (v ? '✔' : '—')
  
  // Model selection: available from Pro and Enterprise (and Preschools on Pro-equivalent)
  const modelSelection: Record<PlanId, boolean> = {
    'free': false,
    'parent-starter': false,
    'parent-plus': false,
    'private-teacher': false,
    'pro': true,
    'preschool-pro': true,
    'enterprise': true,
  }

  // Org-level AI allocation availability
  const orgAllocation: Record<PlanId, boolean> = {
    'free': false,
    'parent-starter': false,
    'parent-plus': false,
    'private-teacher': false,
    'pro': false, // Individuals only; preschools require Preschool Pro
    'preschool-pro': true,
    'enterprise': true,
  }

  // Enterprise-only options
  const sso: Record<PlanId, boolean> = {
    'free': false,
    'parent-starter': false,
    'parent-plus': false,
    'private-teacher': false,
    'pro': false,
    'preschool-pro': false,
    'enterprise': true,
  }
  
  const features: Feature[] = [
    // AI Features
    { name: 'AI Lesson Generator', category: 'ai', description: 'Create CAPS-aligned lessons automatically', icon: 'document-text' },
    { name: 'AI Grading Assistant', category: 'ai', description: 'Automated grading with feedback', icon: 'checkmark-circle' },
    { name: 'Homework Helper', category: 'ai', description: 'AI-powered homework assistance', icon: 'school' },
    { name: 'Model Selection', category: 'ai', description: 'Choose AI model (Haiku/Sonnet/Opus)', icon: 'settings' },
    
    // Core Features
    { name: 'Mobile App Access', category: 'core', description: 'Full mobile application', icon: 'phone-portrait' },
    { name: 'Basic Dashboard', category: 'core', description: 'Essential dashboard features', icon: 'grid' },
    { name: 'Progress Tracking', category: 'core', description: 'Student progress monitoring', icon: 'trending-up' },
    { name: 'Communication Tools', category: 'core', description: 'Parent-teacher messaging', icon: 'chatbubbles' },
    
    // Advanced Features
    { name: 'Org-level AI Allocation', category: 'advanced', description: 'Distribute AI usage across organization', icon: 'business' },
    { name: 'Advanced Analytics', category: 'advanced', description: 'Detailed reports and insights', icon: 'analytics' },
    { name: 'SSO Integration', category: 'advanced', description: 'Single sign-on capability', icon: 'key' },
    { name: 'Principal Hub', category: 'advanced', description: 'Administrative management tools', icon: 'person-circle' },
    
    // Support
    { name: 'Email Support', category: 'support', description: 'Email customer support', icon: 'mail' },
    { name: 'Priority Support', category: 'support', description: 'Faster response times', icon: 'flash' },
    { name: 'Phone Support', category: 'support', description: 'Direct phone assistance', icon: 'call' },
    { name: 'Dedicated Manager', category: 'support', description: 'Personal account manager', icon: 'person' },
  ]
  
  const featureValues: Record<string, FeatureValue> = {
    'AI Lesson Generator': { free: 5, 'parent-starter': 0, 'parent-plus': 0, 'private-teacher': 20, pro: 50, 'preschool-pro': 50, enterprise: 5000 },
    'AI Grading Assistant': { free: 5, 'parent-starter': 0, 'parent-plus': 0, 'private-teacher': 20, pro: 100, 'preschool-pro': 100, enterprise: 10000 },
    'Homework Helper': { free: 15, 'parent-starter': 30, 'parent-plus': 100, 'private-teacher': 100, pro: 300, 'preschool-pro': 300, enterprise: 30000 },
    'Model Selection': modelSelection,
    'Mobile App Access': { free: true, 'parent-starter': true, 'parent-plus': true, 'private-teacher': true, pro: true, 'preschool-pro': true, enterprise: true },
    'Basic Dashboard': { free: true, 'parent-starter': true, 'parent-plus': true, 'private-teacher': true, pro: true, 'preschool-pro': true, enterprise: true },
    'Progress Tracking': { free: 'Basic', 'parent-starter': 'Standard', 'parent-plus': 'Advanced', 'private-teacher': 'Advanced', pro: 'Professional', 'preschool-pro': 'Enterprise', enterprise: 'Enterprise' },
    'Communication Tools': { free: 'Basic', 'parent-starter': 'Enhanced', 'parent-plus': 'Advanced', 'private-teacher': 'Advanced', pro: 'Advanced', 'preschool-pro': 'Advanced', enterprise: 'Enterprise' },
    'Org-level AI Allocation': orgAllocation,
    'Advanced Analytics': { free: false, 'parent-starter': false, 'parent-plus': 'Basic', 'private-teacher': 'Standard', pro: 'Advanced', 'preschool-pro': 'Enterprise', enterprise: 'Enterprise' },
    'SSO Integration': sso,
    'Principal Hub': { free: false, 'parent-starter': false, 'parent-plus': false, 'private-teacher': false, pro: false, 'preschool-pro': true, enterprise: true },
    'Email Support': { free: false, 'parent-starter': true, 'parent-plus': true, 'private-teacher': true, pro: true, 'preschool-pro': true, enterprise: true },
    'Priority Support': { free: false, 'parent-starter': false, 'parent-plus': true, 'private-teacher': true, pro: true, 'preschool-pro': true, enterprise: true },
    'Phone Support': { free: false, 'parent-starter': false, 'parent-plus': false, 'private-teacher': false, pro: false, 'preschool-pro': true, enterprise: true },
'Dedicated Manager': { free: false, 'parent-starter': false, 'parent-plus': false, 'private-teacher': false, pro: false, 'preschool-pro': false, enterprise: true },
    'Priority Processing': { free: false, 'parent-starter': false, 'parent-plus': true, 'private-teacher': true, pro: true, 'preschool-pro': true, enterprise: true },
    'Advanced Reports': { free: false, 'parent-starter': false, 'parent-plus': 'Basic', 'private-teacher': 'Standard', pro: 'Advanced', 'preschool-pro': 'Enterprise', enterprise: 'Enterprise' },
    'Model Tokens (per month)': { free: 0, 'parent-starter': 0, 'parent-plus': 100000, 'private-teacher': 300000, pro: 800000, 'preschool-pro': 2000000, enterprise: 10000000 },
  }
  
  const categoryTitles = {
    ai: 'AI-Powered Features',
    core: 'Core Features', 
    advanced: 'Advanced Features',
    support: 'Support & Services'
  }
  
  const formatValue = (value: boolean | string | number): string => {
    if (typeof value === 'boolean') return yesNo(value)
    if (typeof value === 'number') return value > 0 ? value.toString() : '—'
    return value
  }
  
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }


  // Render mobile card view
  const renderMobileCards = () => (
    <View>
      <View style={styles.viewModeToggle}>
        <Text style={styles.tableTitle}>Detailed Comparison</Text>
        <TouchableOpacity
          style={styles.viewToggleButton}
          onPress={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
        >
          <Ionicons 
            name={viewMode === 'cards' ? 'grid-outline' : 'list-outline'} 
            size={16} 
            color="#00f5ff" 
          />
          <Text style={styles.viewToggleText}>
            {viewMode === 'cards' ? 'Table View' : 'Card View'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsContainer}
      >
        {plans.map((planId) => (
          <View key={planId} style={styles.planCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardPlanName}>{planName[planId]}</Text>
              <Text style={styles.cardPrice}>{priceStr(planId)}</Text>
              {onSelectPlan && (
                <TouchableOpacity
                  style={styles.cardCTA}
                  onPress={() => onSelectPlan(planId)}
                >
                  <Text style={styles.cardCTAText}>Choose Plan</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <ScrollView style={styles.cardContent} showsVerticalScrollIndicator={false}>
              {Object.keys(categoryTitles).map(category => (
                <View key={category} style={styles.cardCategory}>
                  <TouchableOpacity
                    style={styles.cardCategoryHeader}
                    onPress={() => toggleCategory(category)}
                  >
                    <Ionicons 
                      name="folder-open" 
                      size={16} 
                      color="#00f5ff" 
                    />
                    <Text style={styles.cardCategoryTitle}>
                      {categoryTitles[category as keyof typeof categoryTitles]}
                    </Text>
                    <Ionicons 
                      name={expandedCategories.includes(category) ? 'chevron-up' : 'chevron-down'} 
                      size={16} 
                      color="#9CA3AF" 
                    />
                  </TouchableOpacity>
                  
                  {expandedCategories.includes(category) && (
                    <View style={styles.cardFeatures}>
                      {features
                        .filter(f => f.category === category)
                        .map(feature => {
                          const value = featureValues[feature.name]?.[planId]
                          return (
                            <View key={feature.name} style={styles.cardFeature}>
                              <View style={styles.cardFeatureLeft}>
                                {feature.icon && (
                                  <Ionicons 
                                    name={feature.icon as any} 
                                    size={14} 
                                    color="#6B7280" 
                                  />
                                )}
                                <Text style={styles.cardFeatureName}>{feature.name}</Text>
                              </View>
                              <Text style={styles.cardFeatureValue}>
                                {formatValue(value)}
                              </Text>
                            </View>
                          )
                        })}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </View>
  )

  // Render desktop table view
  const renderTableView = () => (
    <View>
      <View style={styles.viewModeToggle}>
        <Text style={styles.tableTitle}>Detailed Comparison</Text>
        {!isTablet && (
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
          >
            <Ionicons 
              name={viewMode === 'cards' ? 'grid-outline' : 'list-outline'} 
              size={16} 
              color="#00f5ff" 
            />
            <Text style={styles.viewToggleText}>
              {viewMode === 'cards' ? 'Table View' : 'Card View'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          {/* Header row */}
          <View style={[styles.row, styles.headerRow]}>
            <View style={[styles.cell, styles.featureCol]}>
              <Text style={[styles.headerText, styles.featureText]}>Feature</Text>
            </View>
              {plans.map((p) => (
              <View key={p} style={[styles.cell, styles.planCol]}>
                <Text style={styles.headerText}>{planName[p]}</Text>
                {p === 'parent-starter' && (
                  <View style={styles.badge}><Text style={styles.badgeText}>MOST POPULAR</Text></View>
                )}
                {p === 'pro' && (
                  <View style={styles.badge}><Text style={styles.badgeText}>BEST FOR SCHOOLS</Text></View>
                )}
                <Text style={styles.priceText}>{priceStr(p)}</Text>
              </View>
            ))}
          </View>

          {/* Category sections */}
          {Object.keys(categoryTitles).map(category => (
            <View key={category}>
              <TouchableOpacity
                style={[styles.row, styles.categoryRow]}
                onPress={() => toggleCategory(category)}
              >
                <View style={[styles.cell, styles.featureCol, styles.categoryCell]}>
                  <Ionicons 
                    name={expandedCategories.includes(category) ? 'chevron-down' : 'chevron-forward'} 
                    size={16} 
                    color="#00f5ff" 
                  />
                  <Text style={styles.categoryText}>
                    {categoryTitles[category as keyof typeof categoryTitles]}
                  </Text>
                </View>
                {plans.map((p) => (
                  <View key={p} style={[styles.cell, styles.planCol]} />
                ))}
              </TouchableOpacity>
              
              {expandedCategories.includes(category) && features
                .filter(f => f.category === category)
                .map(feature => (
                  <View key={feature.name} style={styles.row}>
                    <View style={[styles.cell, styles.featureCol]}>
                      <View style={styles.featureNameContainer}>
                        {feature.icon && (
                          <Ionicons 
                            name={feature.icon as any} 
                            size={16} 
                            color="#6B7280" 
                            style={styles.featureIcon} 
                          />
                        )}
                        <Text style={styles.featureText}>{feature.name}</Text>
                      </View>
                      {feature.description && (
                        <Text style={styles.featureDescription}>{feature.description}</Text>
                      )}
                    </View>
                    {plans.map((p) => {
                      const value = featureValues[feature.name]?.[p]
                      return (
                        <View key={p} style={[styles.cell, styles.planCol]}>
                          <Text style={styles.valueText}>{formatValue(value)}</Text>
                        </View>
                      )
                    })}
                  </View>
                ))}
            </View>
          ))}

          {/* CTA row */}
          {onSelectPlan && (
            <View style={[styles.row, styles.ctaRow]}>
              <View style={[styles.cell, styles.featureCol]}>
                <Text style={styles.featureText}>Select plan</Text>
              </View>
              {plans.map((p) => (
                <View key={p} style={[styles.cell, styles.planCol]}>
                  <TouchableOpacity
                    style={styles.cta}
                    onPress={() => onSelectPlan?.(p)}
                  >
                    <Text style={styles.ctaText}>Choose</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )

  return (
    <View style={styles.wrapper}>
      {viewMode === 'cards' && !isTablet ? renderMobileCards() : renderTableView()}
      <Text style={styles.footnote}>
        AI quotas reset monthly. Overages may require prepayment depending on your organization and contract.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 16, gap: 8, width: '100%' },
  
  // Header and controls
  viewModeToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  tableTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.3)',
  },
  viewToggleText: {
    color: '#00f5ff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  
  // Card view styles
  cardsContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  planCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    width: width * 0.8,
    maxWidth: 320,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: '#0f172a',
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  cardPlanName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardPrice: {
    color: '#00f5ff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  cardCTA: {
    backgroundColor: '#00f5ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cardCTAText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
  cardContent: {
    flex: 1,
    maxHeight: 400,
  },
  
  // Card category styles
  cardCategory: {
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  cardCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 245, 255, 0.05)',
  },
  cardCategoryTitle: {
    color: '#00f5ff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
  },
  cardFeatures: {
    paddingHorizontal: 12,
  },
  cardFeature: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(31, 41, 55, 0.3)',
  },
  cardFeatureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardFeatureName: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  cardFeatureValue: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  
  // Table view styles
  table: {
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerRow: {
    backgroundColor: '#0f172a',
  },
  categoryRow: {
    backgroundColor: 'rgba(0, 245, 255, 0.05)',
  },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 140,
  },
  featureCol: {
    minWidth: 200,
    maxWidth: 250,
  },
  planCol: {
    alignItems: 'flex-start',
  },
  categoryCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Text styles
  headerText: { color: '#FFFFFF', fontWeight: '800' },
  featureText: { color: '#9CA3AF', fontWeight: '700' },
  badge: { backgroundColor: '#00f5ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start', marginTop: 6 },
  badgeText: { color: '#000', fontWeight: '800', fontSize: 10 },
  categoryText: {
    color: '#00f5ff',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 8,
  },
  valueText: { color: '#E5E7EB' },
  priceText: { color: '#00f5ff', fontWeight: '800', marginTop: 2 },
  
  // Feature enhancements
  featureNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureIcon: {
    marginRight: 8,
  },
  featureDescription: {
    color: '#6B7280',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 14,
  },
  
  // CTA styles
  ctaRow: { backgroundColor: '#0b1220' },
  cta: {
    backgroundColor: '#00f5ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start'
  },
  ctaText: { color: '#000', fontWeight: '800' },
  
  // Footer
  footnote: {
    color: '#9CA3AF',
    fontSize: 12,
    marginLeft: 4,
    marginTop: 8,
    lineHeight: 16,
  },
})

