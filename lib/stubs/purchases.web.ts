/**
 * RevenueCat stub for web platform
 * react-native-purchases is not available on web
 */

// Mock Purchases class
const Purchases = {
  configure: (config: any) => Promise.resolve(),
  logIn: (userId: string) => Promise.resolve({ customerInfo: null }),
  logOut: () => Promise.resolve({ customerInfo: null }),
  getCustomerInfo: () => Promise.resolve(null),
  getOfferings: () => Promise.resolve({ all: {}, current: null }),
  purchaseProduct: () => Promise.reject(new Error('Purchases not available on web')),
  purchasePackage: () => Promise.reject(new Error('Purchases not available on web')),
  restorePurchases: () => Promise.resolve({ customerInfo: null }),
  setLogLevel: (level: string) => {},
  setDebugLogsEnabled: (enabled: boolean) => {},
  addCustomerInfoUpdateListener: (listener: any) => {
    return { remove: () => {} };
  },
  removeCustomerInfoUpdateListener: () => {},
  
  // Log levels
  LOG_LEVEL: {
    VERBOSE: 'VERBOSE',
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
  },
};

// Mock error codes
export const PURCHASES_ERROR_CODE = {
  UNKNOWN_ERROR: 0,
  PURCHASE_CANCELLED_ERROR: 1,
  STORE_PROBLEM_ERROR: 2,
  PURCHASE_NOT_ALLOWED_ERROR: 3,
  PURCHASE_INVALID_ERROR: 4,
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: 5,
  PRODUCT_ALREADY_PURCHASED_ERROR: 6,
  RECEIPT_ALREADY_IN_USE_ERROR: 7,
  INVALID_RECEIPT_ERROR: 8,
  MISSING_RECEIPT_FILE_ERROR: 9,
  NETWORK_ERROR: 10,
  INVALID_CREDENTIALS_ERROR: 11,
  UNEXPECTED_BACKEND_RESPONSE_ERROR: 12,
  INVALID_APP_USER_ID_ERROR: 14,
  OPERATION_ALREADY_IN_PROGRESS_ERROR: 15,
  UNKNOWN_BACKEND_ERROR: 16,
};

// Mock package types
export const PACKAGE_TYPE = {
  UNKNOWN: 'UNKNOWN',
  CUSTOM: 'CUSTOM',
  LIFETIME: 'LIFETIME',
  ANNUAL: 'ANNUAL',
  SIX_MONTH: 'SIX_MONTH',
  THREE_MONTH: 'THREE_MONTH',
  TWO_MONTH: 'TWO_MONTH',
  MONTHLY: 'MONTHLY',
  WEEKLY: 'WEEKLY',
};

// Mock intro eligibility status
export const INTRO_ELIGIBILITY_STATUS = {
  INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
  INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
  INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
};

// Default export
export default Purchases;

// Named exports for compatibility
export { Purchases };
export const PurchasesOfferings = {};
export const CustomerInfo = {};
export const PurchasesStoreProduct = {};
export const PurchasesPackage = {};
