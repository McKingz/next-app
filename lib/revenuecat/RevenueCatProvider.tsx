import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { useAuth } from '../../contexts/AuthContext';
import { initializeRevenueCat, identifyRevenueCatUser, logoutRevenueCatUser, getCustomerInfo } from './config';

interface RevenueCatContextType {
  customerInfo: CustomerInfo | null;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  refreshCustomerInfo: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

interface RevenueCatProviderProps {
  children: ReactNode;
}

export function RevenueCatProvider({ children }: RevenueCatProviderProps) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  const { user, profile } = useAuth();
  const preschoolId = (profile as any)?.preschool_id || (profile as any)?.organization_id;

  // Initialize RevenueCat
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        await initializeRevenueCat();
        setInitialized(true);
        
        console.log('RevenueCat Provider: Initialized successfully');
      } catch (err: any) {
        console.error('RevenueCat Provider: Failed to initialize:', err);
        setError(err.message || 'Failed to initialize RevenueCat');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // Handle user login/logout
  useEffect(() => {
    if (!initialized) return;

    const handleUserAuth = async () => {
      try {
        if (user?.id) {
          // User is logged in - identify them with RevenueCat
          await identifyRevenueCatUser(user.id, preschoolId);
          
          // Fetch customer info
          const info = await getCustomerInfo();
          setCustomerInfo(info);
        } else {
          // User is logged out - logout from RevenueCat
          await logoutRevenueCatUser();
          setCustomerInfo(null);
        }
      } catch (err: any) {
        console.error('RevenueCat Provider: Auth handling error:', err);
        setError(err.message || 'Auth handling error');
      }
    };

    handleUserAuth();
  }, [initialized, user?.id, preschoolId]);

  // Set up customer info listener
  useEffect(() => {
    if (!initialized) return;

    Purchases.addCustomerInfoUpdateListener((info) => {
      console.log('RevenueCat Provider: Customer info updated');
      setCustomerInfo(info);
    });

    return () => {
      // SDK does not provide an unsubscribe function in this wrapper
    };
  }, [initialized]);

  const refreshCustomerInfo = async () => {
    try {
      setError(null);
      const info = await getCustomerInfo();
      setCustomerInfo(info);
    } catch (err: any) {
      console.error('RevenueCat Provider: Failed to refresh customer info:', err);
      setError(err.message || 'Failed to refresh customer info');
    }
  };

  const value: RevenueCatContextType = {
    customerInfo,
    isLoading,
    error,
    initialized,
    refreshCustomerInfo,
  };

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat(): RevenueCatContextType {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
}