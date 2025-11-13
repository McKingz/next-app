import React from 'react';
import Purchases, { CustomerInfo, PurchasesEntitlementInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

// RevenueCat Configuration
export const REVENUECAT_CONFIG = {
  // Replace these with your actual RevenueCat API keys
  API_KEY_IOS: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '',
  API_KEY_ANDROID: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '',
  
  // Product IDs - these should match your App Store/Play Store product IDs
  PRODUCT_IDS: {
    STARTER_MONTHLY: 'edudash_starter_monthly',
    STARTER_ANNUAL: 'edudash_starter_annual',
    BASIC_MONTHLY: 'edudash_basic_monthly',
    BASIC_ANNUAL: 'edudash_basic_annual',
    PREMIUM_MONTHLY: 'edudash_premium_monthly',
    PREMIUM_ANNUAL: 'edudash_premium_annual',
    PRO_MONTHLY: 'edudash_pro_monthly',
    PRO_ANNUAL: 'edudash_pro_annual',
  },
  
  // Entitlement IDs
  ENTITLEMENTS: {
    STARTER: 'starter_features',
    BASIC: 'basic_features',
    PREMIUM: 'premium_features',
    PRO: 'pro_features',
  }
};

/**
 * Initialize RevenueCat SDK
 * Should be called early in the app lifecycle
 */
export async function initializeRevenueCat(): Promise<void> {
  try {
    const apiKey = Platform.select({
      ios: REVENUECAT_CONFIG.API_KEY_IOS,
      android: REVENUECAT_CONFIG.API_KEY_ANDROID,
      default: REVENUECAT_CONFIG.API_KEY_ANDROID,
    });

    if (!apiKey) {
      console.warn('RevenueCat API key not configured');
      return;
    }

    await Purchases.configure({
      apiKey,
    });

    // Enable debug logs in development
    if (__DEV__) {
      await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    }

    console.log('RevenueCat initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
  }
}

/**
 * Set user ID for RevenueCat
 * Format: "user_${userId}" or "school_${preschoolId}_${userId}"
 */
export async function identifyRevenueCatUser(
  userId: string,
  preschoolId?: string
): Promise<void> {
  try {
    const appUserId = preschoolId 
      ? `school_${preschoolId}_${userId}`
      : `user_${userId}`;
    
    await Purchases.logIn(appUserId);
    console.log('RevenueCat user identified:', appUserId);
  } catch (error) {
    console.error('Failed to identify RevenueCat user:', error);
  }
}

/**
 * Log out the current user from RevenueCat
 */
export async function logoutRevenueCatUser(): Promise<void> {
  try {
    await Purchases.logOut();
    console.log('RevenueCat user logged out');
  } catch (error) {
    console.error('Failed to logout RevenueCat user:', error);
  }
}

/**
 * Get current customer info and entitlements
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Failed to get customer info:', error);
    return null;
  }
}

/**
 * Check if user has access to a specific feature tier
 */
export async function hasFeatureAccess(tier: 'starter' | 'basic' | 'premium' | 'pro'): Promise<boolean> {
  try {
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) return false;

    const entitlementId = REVENUECAT_CONFIG.ENTITLEMENTS[tier.toUpperCase() as keyof typeof REVENUECAT_CONFIG.ENTITLEMENTS];
    const entitlement = customerInfo.entitlements.active[entitlementId];
    
    return entitlement?.isActive === true;
  } catch (error) {
    console.error('Failed to check feature access:', error);
    return false;
  }
}

/**
 * Get the user's highest active subscription tier
 */
export async function getActiveSubscriptionTier(): Promise<string> {
  try {
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) return 'free';

    // Check entitlements in order of priority
    const entitlements = customerInfo.entitlements.active;
    
    if (entitlements[REVENUECAT_CONFIG.ENTITLEMENTS.PRO]?.isActive) return 'pro';
    if (entitlements[REVENUECAT_CONFIG.ENTITLEMENTS.PREMIUM]?.isActive) return 'premium';
    if (entitlements[REVENUECAT_CONFIG.ENTITLEMENTS.BASIC]?.isActive) return 'basic';
    if (entitlements[REVENUECAT_CONFIG.ENTITLEMENTS.STARTER]?.isActive) return 'starter';
    
    return 'free';
  } catch (error) {
    console.error('Failed to get active subscription tier:', error);
    return 'free';
  }
}

/**
 * Get available products for purchase
 */
export async function getAvailableProducts() {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.error('Failed to get available products:', error);
    return null;
  }
}

/**
 * Purchase a product
 */
export async function purchaseProduct(productId: string): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  try {
    const { customerInfo } = await Purchases.purchaseProduct(productId);
    return {
      success: true,
      customerInfo,
    };
  } catch (error: any) {
    console.error('Purchase failed:', error);
    
    // Handle different error types
    if (error.userCancelled) {
      return {
        success: false,
        error: 'Purchase cancelled by user',
      };
    }
    
    return {
      success: false,
      error: error.message || 'Purchase failed',
    };
  }
}

/**
 * Restore purchases
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return {
      success: true,
      customerInfo,
    };
  } catch (error: any) {
    console.error('Restore purchases failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to restore purchases',
    };
  }
}

/**
 * Map subscription tier to product IDs
 */
export function getProductIdsForTier(tier: string, billing: 'monthly' | 'annual'): string[] {
  const suffix = billing === 'annual' ? '_annual' : '_monthly';
  const prefix = `edudash_${tier}`;
  return [`${prefix}${suffix}`];
}

/**
 * Hook to get RevenueCat customer info with caching
 */
export function useRevenueCatCustomerInfo() {
  const [customerInfo, setCustomerInfo] = React.useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    const fetchCustomerInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const info = await getCustomerInfo();
        
        if (isMounted) {
          setCustomerInfo(info);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch customer info');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCustomerInfo();

    // Set up listener for customer info updates
    Purchases.addCustomerInfoUpdateListener((info) => {
      if (isMounted) {
        setCustomerInfo(info);
      }
    });

    return () => {
      isMounted = false;
      // No explicit unsubscribe available in this SDK wrapper
    };
  }, []);

  return { customerInfo, isLoading, error, refetch: () => getCustomerInfo() };
}