// 🔐 Password Strength Indicator Component
// Visual password strength indicator with real-time feedback

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PasswordValidation } from '../../types/auth-enhanced';
import { passwordPolicyEnforcer } from '../../lib/auth/PasswordPolicy';

interface PasswordStrengthIndicatorProps {
  password: string;
  userInfo?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    phone?: string;
  };
  showDetails?: boolean;
  onStrengthChange?: (validation: PasswordValidation) => void;
}

interface StrengthConfig {
  color: string;
  backgroundColor: string;
  text: string;
  width: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  userInfo,
  showDetails = true,
  onStrengthChange
}) => {
  const { theme } = useTheme();
  
  // Store callback in ref to avoid dependency issues
  const onStrengthChangeRef = React.useRef(onStrengthChange);
  React.useEffect(() => {
    onStrengthChangeRef.current = onStrengthChange;
  }, [onStrengthChange]);
  
  // Get password validation results
  const validation = React.useMemo(() => {
    if (!password) {
      return {
        isValid: false,
        errors: [],
        strength: 'weak' as const,
        score: 0,
        requirements: {
          minLength: false,
          hasUppercase: false,
          hasLowercase: false,
          hasNumbers: false,
          hasSpecialChars: false,
          notCommon: true,
          noUserInfo: true
        },
        feedback: []
      };
    }
    
    return passwordPolicyEnforcer.validatePassword(password, userInfo);
  }, [password, userInfo]);

  // Notify parent of strength changes (using ref to avoid infinite loop)
  React.useEffect(() => {
    onStrengthChangeRef.current?.(validation);
  }, [validation]);

  // Get strength configuration
  const getStrengthConfig = (strength: PasswordValidation['strength']): StrengthConfig => {
    switch (strength) {
      case 'excellent':
        return {
          color: theme.success,
          backgroundColor: theme.success + '20',
          text: 'Excellent',
          width: '100%'
        };
      case 'strong':
        return {
          color: theme.success,
          backgroundColor: theme.success + '20',
          text: 'Strong',
          width: '80%'
        };
      case 'good':
        return {
          color: theme.warning,
          backgroundColor: theme.warning + '20',
          text: 'Good',
          width: '60%'
        };
      case 'fair':
        return {
          color: theme.warning,
          backgroundColor: theme.warning + '20',
          text: 'Fair',
          width: '40%'
        };
      case 'weak':
      default:
        return {
          color: theme.error,
          backgroundColor: theme.error + '20',
          text: 'Weak',
          width: '20%'
        };
    }
  };

  const strengthConfig = getStrengthConfig(validation.strength);

  if (!password) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Strength Bar */}
      <View style={styles.strengthBarContainer}>
        <View style={[
          styles.strengthBarBackground,
          { backgroundColor: theme.surfaceVariant }
        ]}>
          <View style={[
            styles.strengthBarFill,
              {
              backgroundColor: strengthConfig.color,
              width: strengthConfig.width as any
            }
          ]} />
        </View>
        <Text style={[
          styles.strengthText,
          { 
            color: strengthConfig.color,
            fontSize: 14,
            fontWeight: '600'
          }
        ]}>
          {strengthConfig.text} ({validation.score}/100)
        </Text>
      </View>

      {showDetails && (
        <>
          {/* Requirements Checklist */}
          <View style={styles.requirementsContainer}>
            <Text style={[
              styles.sectionTitle,
              { 
                color: theme.text,
                fontSize: 12,
                fontWeight: '600'
              }
            ]}>
              Password Requirements:
            </Text>
            
            <View style={styles.requirementsList}>
              <RequirementItem
                met={validation.requirements.minLength}
                text="At least 8 characters"
                theme={theme}
              />
              <RequirementItem
                met={validation.requirements.hasUppercase}
                text="Uppercase letter (A-Z)"
                theme={theme}
              />
              <RequirementItem
                met={validation.requirements.hasLowercase}
                text="Lowercase letter (a-z)"
                theme={theme}
              />
              <RequirementItem
                met={validation.requirements.hasNumbers}
                text="Number (0-9)"
                theme={theme}
              />
              <RequirementItem
                met={validation.requirements.hasSpecialChars}
                text="Special character (!@#$%...)"
                theme={theme}
              />
              <RequirementItem
                met={validation.requirements.notCommon}
                text="Not a common password"
                theme={theme}
              />
              <RequirementItem
                met={validation.requirements.noUserInfo}
                text="No personal information"
                theme={theme}
              />
            </View>
          </View>

          {/* Feedback Messages */}
          {validation.feedback.length > 0 && (
            <View style={styles.feedbackContainer}>
              <Text style={[
                styles.sectionTitle,
                { 
                  color: theme.text,
                  fontSize: 12,
                  fontWeight: '600'
                }
              ]}>
                Suggestions:
              </Text>
              {validation.feedback.map((feedback, index) => (
                <Text
                  key={index}
                  style={[
                    styles.feedbackText,
                    { 
                      color: theme.textSecondary,
                      fontSize: 12
                    }
                  ]}
                >
                  • {feedback}
                </Text>
              ))}
            </View>
          )}

          {/* Error Messages */}
          {validation.errors.length > 0 && (
            <View style={styles.errorsContainer}>
              <Text style={[
                styles.sectionTitle,
                { 
                  color: theme.error,
                  fontSize: 12,
                  fontWeight: '600'
                }
              ]}>
                Issues:
              </Text>
              {validation.errors.map((error, index) => (
                <Text
                  key={index}
                  style={[
                    styles.errorText,
                    { 
                      color: theme.error,
                      fontSize: 12
                    }
                  ]}
                >
                  • {error}
                </Text>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
};

// Individual requirement item component
interface RequirementItemProps {
  met: boolean;
  text: string;
  theme: any;
}

const RequirementItem: React.FC<RequirementItemProps> = ({ met, text, theme }) => (
  <View style={styles.requirementItem}>
    <View style={[
      styles.requirementIcon,
      {
        backgroundColor: met ? theme.success : theme.surfaceVariant,
        borderColor: met ? theme.success : theme.border
      }
    ]}>
      <Text style={[
        styles.requirementIconText,
        { color: met ? theme.onPrimary : theme.textSecondary }
      ]}>
        {met ? '✓' : '○'}
      </Text>
    </View>
    <Text style={[
      styles.requirementText,
      { 
        color: met ? theme.text : theme.textSecondary,
        fontSize: 12
      }
    ]}>
      {text}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
  },
  strengthBarContainer: {
    marginBottom: 12,
  },
  strengthBarBackground: {
    height: 6,
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  requirementsContainer: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  requirementsList: {
    gap: 6,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requirementIconText: {
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  requirementText: {
    flex: 1,
  },
  feedbackContainer: {
    marginBottom: 12,
  },
  feedbackText: {
    marginLeft: 4,
    marginBottom: 2,
  },
  errorsContainer: {
    marginBottom: 8,
  },
  errorText: {
    marginLeft: 4,
    marginBottom: 2,
  },
});

export default PasswordStrengthIndicator;