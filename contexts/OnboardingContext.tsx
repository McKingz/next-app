import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OrganizationType } from '@/lib/types/organization';

export interface OnboardingState {
  // Step tracking
  currentStep: 'org_type' | 'role' | 'dob' | 'guardian' | 'complete';
  completedSteps: string[];
  
  // Organization selection
  organizationType?: OrganizationType;
  organizationId?: string;
  
  // Role selection
  role?: 'student' | 'teacher' | 'parent' | 'employee' | 'athlete' | 'member';
  
  // Age capture
  dateOfBirth?: Date;
  ageGroup?: 'child' | 'teen' | 'adult';
  isMinor?: boolean;
  
  // Guardian linkage (for minors)
  guardianEmail?: string;
  guardianPhone?: string;
  guardianProfileId?: string;
  guardianInviteSent?: boolean;
}

interface OnboardingContextValue {
  state: OnboardingState;
  updateState: (updates: Partial<OnboardingState>) => Promise<void>;
  completeStep: (step: string) => Promise<void>;
  nextStep: () => void;
  resetOnboarding: () => Promise<void>;
  isOnboardingComplete: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const STORAGE_KEY = '@edudash:onboarding_state';

const initialState: OnboardingState = {
  currentStep: 'org_type',
  completedSteps: [],
};

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>(initialState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    loadPersistedState();
  }, []);

  const loadPersistedState = async () => {
    try {
      const persisted = await AsyncStorage.getItem(STORAGE_KEY);
      if (persisted) {
        const parsed = JSON.parse(persisted);
        // Restore Date object
        if (parsed.dateOfBirth) {
          parsed.dateOfBirth = new Date(parsed.dateOfBirth);
        }
        setState(parsed);
      }
    } catch (error) {
      console.error('Failed to load onboarding state:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const persistState = async (newState: OnboardingState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.error('Failed to persist onboarding state:', error);
    }
  };

  const updateState = async (updates: Partial<OnboardingState>) => {
    const newState = { ...state, ...updates };
    setState(newState);
    await persistState(newState);
  };

  const completeStep = async (step: string) => {
    const newState = {
      ...state,
      completedSteps: [...state.completedSteps, step],
    };
    setState(newState);
    await persistState(newState);
  };

  // Determine next step based on current state
  const nextStep = async () => {
    let next: OnboardingState['currentStep'] = 'complete';

    if (!state.organizationType) {
      next = 'org_type';
    } else if (!state.role) {
      next = 'role';
    } else if (!state.dateOfBirth) {
      next = 'dob';
    } else if (state.isMinor && !state.guardianInviteSent) {
      next = 'guardian';
    } else {
      next = 'complete';
    }

    await updateState({ currentStep: next });
  };

  const resetOnboarding = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  };

  const isOnboardingComplete = 
    state.currentStep === 'complete' ||
    (!!state.organizationType && 
     !!state.role && 
     !!state.dateOfBirth && 
     (!state.isMinor || !!state.guardianInviteSent));

  if (!isLoaded) {
    return null; // Or a loading indicator
  }

  return (
    <OnboardingContext.Provider
      value={{
        state,
        updateState,
        completeStep,
        nextStep,
        resetOnboarding,
        isOnboardingComplete,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
