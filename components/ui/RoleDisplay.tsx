/**
 * RoleDisplay Component
 * Displays role names with organization-aware terminology
 */

import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { useRoleLabel } from '@/lib/hooks/useOrganizationTerminology';

interface RoleDisplayProps {
  role: string;
  style?: StyleProp<TextStyle>;
  capitalize?: boolean;
  plural?: boolean;
}

/**
 * Component to display role names using organization-specific terminology
 * 
 * @example
 * ```tsx
 * // Preschool: "Teacher" | Sports Club: "Coach"
 * <RoleDisplay role="teacher" />
 * 
 * // With custom styling
 * <RoleDisplay role="principal" style={{ fontWeight: 'bold' }} />
 * ```
 */
export function RoleDisplay({ 
  role, 
  style, 
  capitalize = false,
  plural = false 
}: RoleDisplayProps) {
  const label = useRoleLabel(role);
  
  const displayText = capitalize 
    ? label.charAt(0).toUpperCase() + label.slice(1)
    : label;
  
  return (
    <Text style={style}>
      {displayText}
    </Text>
  );
}

export default RoleDisplay;
