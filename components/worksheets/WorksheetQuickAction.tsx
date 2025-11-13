/**
 * Worksheet Quick Action Component
 * 
 * A floating action button and integration component that provides
 * easy access to worksheet generation from anywhere in the app.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import WorksheetGenerator from './WorksheetGenerator';
import type { Assignment } from '@/lib/models/Assignment';

// ====================================================================
// TYPES
// ====================================================================

interface WorksheetQuickActionProps {
  assignment?: Assignment;
  position?: 'bottom-right' | 'bottom-left' | 'top-right';
  size?: 'small' | 'medium' | 'large';
  style?: 'floating' | 'inline';
  showLabel?: boolean;
  onPress?: () => void;
}

// ====================================================================
// MAIN COMPONENT
// ====================================================================

export default function WorksheetQuickAction({
  assignment,
  position = 'bottom-right',
  size = 'medium',
  style = 'floating',
  showLabel = true,
  onPress,
}: WorksheetQuickActionProps) {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const styles = React.useMemo(() => createStyles(theme, position, size, style), [theme, position, size, style]);
  
  const [showGenerator, setShowGenerator] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  // Check if user has permission to generate worksheets
  const canGenerateWorksheets = () => {
    return ['teacher', 'principal', 'principal_admin', 'parent'].includes(profile?.role || '');
  };

  if (!canGenerateWorksheets()) {
    return null;
  }

  const handlePress = () => {
    // Animate button press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    if (onPress) {
      onPress();
    } else {
      setShowGenerator(true);
    }
  };

  const renderButton = () => {
    if (style === 'inline') {
      return (
        <TouchableOpacity
          style={styles.inlineButton}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <Ionicons name="document" size={getIconSize()} color="white" />
          {showLabel && (
            <Text style={styles.inlineButtonText}>
              {assignment ? 'Create Worksheet' : 'Generate PDF'}
            </Text>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="document" size={getIconSize()} color="white" />
            {showLabel && size !== 'small' && (
              <Text style={styles.floatingButtonText}>PDF</Text>
            )}
          </View>
          
          {/* Ripple effect */}
          <View style={styles.ripple} />
        </TouchableOpacity>

        {/* Tooltip for small buttons */}
        {size === 'small' && showLabel && (
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>Create Worksheet</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 16;
      case 'medium': return 20;
      case 'large': return 24;
      default: return 20;
    }
  };

  return (
    <>
      {renderButton()}
      
      <WorksheetGenerator
        assignment={assignment}
        mode={assignment ? 'assignment-based' : 'standalone'}
        visible={showGenerator}
        onClose={() => setShowGenerator(false)}
      />
    </>
  );
}

// ====================================================================
// ASSIGNMENT INTEGRATION COMPONENT
// ====================================================================

interface AssignmentWorksheetButtonProps {
  assignment: Assignment;
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
}

export function AssignmentWorksheetButton({ 
  assignment, 
  variant = 'secondary',
  fullWidth = false 
}: AssignmentWorksheetButtonProps) {
  const { theme } = useTheme();
  const [showGenerator, setShowGenerator] = useState(false);

  const buttonStyles = {
    primary: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
      textColor: 'white',
    },
    secondary: {
      backgroundColor: theme.cardBackground,
      borderColor: theme.border,
      textColor: theme.text,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: theme.primary,
      textColor: theme.primary,
    },
  };

  const currentStyle = buttonStyles[variant];

  return (
    <>
      <TouchableOpacity
        style={[
          styles.assignmentButton,
          {
            backgroundColor: currentStyle.backgroundColor,
            borderColor: currentStyle.borderColor,
            width: fullWidth ? '100%' : 'auto',
          }
        ]}
        onPress={() => setShowGenerator(true)}
      >
        <Ionicons name="document-text" size={18} color={currentStyle.textColor} />
        <Text style={[styles.assignmentButtonText, { color: currentStyle.textColor }]}>
          Create Worksheet
        </Text>
      </TouchableOpacity>

      <WorksheetGenerator
        assignment={assignment}
        mode="assignment-based"
        visible={showGenerator}
        onClose={() => setShowGenerator(false)}
      />
    </>
  );
}

// ====================================================================
// TEACHER DASHBOARD WIDGET
// ====================================================================

interface WorksheetQuickWidgetProps {
  recentAssignments?: Assignment[];
  onCreateWorksheet?: (assignment?: Assignment) => void;
}

export function WorksheetQuickWidget({ 
  recentAssignments = [],
  onCreateWorksheet 
}: WorksheetQuickWidgetProps) {
  const { theme } = useTheme();
  const [showGenerator, setShowGenerator] = useState(false);

  return (
    <>
      <View style={[styles.widget, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.widgetHeader}>
          <View style={styles.widgetTitleContainer}>
            <Ionicons name="document" size={20} color={theme.primary} />
            <Text style={[styles.widgetTitle, { color: theme.text }]}>
              Quick Worksheets
            </Text>
          </View>
          <TouchableOpacity
            style={styles.widgetAction}
            onPress={() => setShowGenerator(true)}
          >
            <Ionicons name="add" size={18} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.widgetDescription, { color: theme.textSecondary }]}>
          Generate printable worksheets for your students
        </Text>

        <View style={styles.widgetActions}>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: theme.primary + '15' }]}
            onPress={() => setShowGenerator(true)}
          >
            <Text style={[styles.quickActionText, { color: theme.primary }]}>
              📊 Math Practice
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: theme.success + '15' }]}
            onPress={() => setShowGenerator(true)}
          >
            <Text style={[styles.quickActionText, { color: theme.success }]}>
              📖 Reading
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: theme.accent + '15' }]}
            onPress={() => setShowGenerator(true)}
          >
            <Text style={[styles.quickActionText, { color: theme.accent }]}>
              🎨 Activities
            </Text>
          </TouchableOpacity>
        </View>

        {recentAssignments.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={[styles.recentTitle, { color: theme.text }]}>
              From Recent Assignments:
            </Text>
            {recentAssignments.slice(0, 2).map((assignment) => (
              <TouchableOpacity
                key={assignment.id}
                style={styles.recentItem}
                onPress={() => onCreateWorksheet?.(assignment)}
              >
                <Ionicons name="document-text" size={14} color={theme.textSecondary} />
                <Text style={[styles.recentItemText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {assignment.title}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <WorksheetGenerator
        visible={showGenerator}
        onClose={() => setShowGenerator(false)}
      />
    </>
  );
}

// ====================================================================
// STYLES
// ====================================================================

const createStyles = (theme: any, position: string, size: string, style: string) => {
  const buttonSizes: Record<string, { width: number; height: number }> = {
    small: { width: 44, height: 44 },
    medium: { width: 56, height: 56 },
    large: { width: 64, height: 64 },
  };

  const positions: Record<string, { bottom?: number; right?: number; left?: number; top?: number }> = {
    'bottom-right': { bottom: 20, right: 20 },
    'bottom-left': { bottom: 20, left: 20 },
    'top-right': { top: 20, right: 20 },
  };

  return StyleSheet.create({
    container: {
      position: style === 'floating' ? 'absolute' : 'relative',
      ...(positions[position] || positions['bottom-right']),
      zIndex: 1000,
    },
    floatingButton: {
      ...(buttonSizes[size] || buttonSizes['medium']),
      backgroundColor: theme.primary,
      borderRadius: (buttonSizes[size] || buttonSizes['medium']).width / 2,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    buttonContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    floatingButtonText: {
      color: 'white',
      fontSize: 10,
      fontWeight: '600',
      marginTop: 2,
    },
    ripple: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: (buttonSizes[size] || buttonSizes['medium']).width / 2,
      backgroundColor: 'rgba(255,255,255,0.2)',
      opacity: 0,
    },
    tooltip: {
      position: 'absolute',
      bottom: '100%',
      right: 0,
      backgroundColor: theme.text,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginBottom: 8,
    },
    tooltipText: {
      color: theme.background,
      fontSize: 12,
      fontWeight: '500',
      // whiteSpace: 'nowrap', // Not supported in React Native
    },
    inlineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 8,
    },
    inlineButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    assignmentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      gap: 8,
    },
    assignmentButtonText: {
      fontSize: 16,
      fontWeight: '500',
    },
    widget: {
      borderRadius: 16,
      padding: 20,
      margin: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    widgetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    widgetTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    widgetTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    widgetAction: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    widgetDescription: {
      fontSize: 14,
      marginBottom: 16,
      lineHeight: 20,
    },
    widgetActions: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    quickActionButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    quickActionText: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    recentSection: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 16,
    },
    recentTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    recentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 8,
    },
    recentItemText: {
      flex: 1,
      fontSize: 14,
    },
  });
};

// ====================================================================
// STYLES FALLBACK
// ====================================================================

const styles = StyleSheet.create({
  assignmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  assignmentButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  widget: {
    borderRadius: 16,
    padding: 20,
    margin: 16,
    borderWidth: 1,
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  widgetTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  widgetTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  widgetAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  widgetActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  recentSection: {
    paddingTop: 16,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  recentItemText: {
    flex: 1,
    fontSize: 14,
  },
});