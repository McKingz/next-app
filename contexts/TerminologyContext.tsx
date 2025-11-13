/**
 * Terminology Context
 * 
 * Provides organization-specific terminology throughout the app
 * Wraps useOrganizationTerminology for convenient access without prop drilling
 * 
 * Part of Multi-Organization Dashboard System (Phase 2)
 * See: /home/king/Desktop/MULTI_ORG_DASHBOARD_IMPLEMENTATION_PLAN.md
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useOrganizationTerminology, OrganizationTerminology } from '@/lib/hooks/useOrganizationTerminology';

interface TerminologyContextValue {
  terminology: OrganizationTerminology;
}

const TerminologyContext = createContext<TerminologyContextValue | undefined>(undefined);

interface TermsProviderProps {
  children: ReactNode;
}

/**
 * Provider component that makes terminology available app-wide
 * Should be placed high in component tree, typically in _layout.tsx
 * 
 * @example
 * ```tsx
 * // In app/_layout.tsx
 * <TermsProvider>
 *   <YourApp />
 * </TermsProvider>
 * ```
 */
export function TermsProvider({ children }: TermsProviderProps) {
  const { terminology } = useOrganizationTerminology();
  
  const value = useMemo(() => ({ terminology }), [terminology]);
  
  return (
    <TerminologyContext.Provider value={value}>
      {children}
    </TerminologyContext.Provider>
  );
}

/**
 * Hook to access organization-specific terminology
 * Must be used within a TermsProvider
 * 
 * @returns Terminology for the current organization
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { terminology } = useTerms();
 *   
 *   return (
 *     <View>
 *       <Text>Add a new {terminology.member}</Text>
 *       // Preschool: "Add a new student"
 *       // Sports Club: "Add a new athlete"
 *       // Corporate: "Add a new employee"
 *     </View>
 *   );
 * }
 * ```
 */
export function useTerms(): TerminologyContextValue {
  const context = useContext(TerminologyContext);
  
  if (context === undefined) {
    throw new Error('useTerms must be used within a TermsProvider');
  }
  
  return context;
}

/**
 * Hook to get a specific term without full context
 * Convenience wrapper for quick term access
 * 
 * @param key - The terminology key to retrieve
 * @returns The organization-specific term
 * 
 * @example
 * ```tsx
 * const memberLabel = useTerm('member');
 * const groupLabel = useTerm('group');
 * // Returns: "Student", "Class" for preschool
 * // Returns: "Athlete", "Team" for sports club
 * ```
 */
export function useTerm(key: keyof OrganizationTerminology): string {
  const { terminology } = useTerms();
  return terminology[key];
}
