// 🔐 Enhanced Registration Form Component
// Multi-step registration form with role-specific flows

import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  EnhancedUserRole,
  AuthFlowStep,
  EnhancedRegistration,
  PrincipalRegistration,
  TeacherRegistration,
  ParentRegistration,
  StudentRegistration,
  PasswordValidation
} from '../../types/auth-enhanced';
import { AuthValidation } from '../../lib/auth/AuthValidation';
// import { passwordPolicyEnforcer } from '../../lib/auth/PasswordPolicy';
import { AuthProgressIndicator, AuthProgressSummary } from './AuthProgressIndicator';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { OrganizationSetup, OrganizationData } from './OrganizationSetup';

interface EnhancedRegistrationFormProps {
  role: EnhancedUserRole;
  invitationToken?: string;
  organizationId?: string;
  onSuccess: (registration: EnhancedRegistration) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
}

interface FormState {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // Security
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  marketingConsent: boolean;
  
  // Role-specific
  // Principal
  jobTitle?: string;
  yearsExperience?: number;
  organization?: OrganizationData;
  
  // Teacher
  subjects?: string[];
  gradeLevel?: string[];
  qualifications?: string[];
  bio?: string;
  
  // Parent
  invitationCode?: string;
  children?: Array<{
    firstName: string;
    lastName: string;
    grade?: string;
    studentId?: string;
  }>;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // Student
  grade?: string;
  dateOfBirth?: Date;
  parentEmail?: string;
  schoolCode?: string;
  interests?: string[];
}

const GRADE_LEVELS = [
  'Pre-K', 'Kindergarten',
  '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade',
  '6th Grade', '7th Grade', '8th Grade',
  '9th Grade', '10th Grade', '11th Grade', '12th Grade',
  'College/University'
];

const SUBJECTS = [
  'Mathematics', 'Science', 'English', 'History', 'Geography',
  'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Art',
  'Music', 'Physical Education', 'Foreign Language', 'Social Studies'
];

export const EnhancedRegistrationForm: React.FC<EnhancedRegistrationFormProps> = ({
  role,
  invitationToken,
  organizationId,
  onSuccess,
  onCancel,
  onError
}) => {
  const { theme } = useTheme();
  
  // Form state management
  const [formState, setFormState] = React.useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    marketingConsent: false
  });
  
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(false);
  const [passwordValidation, setPasswordValidation] = React.useState<PasswordValidation | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  
  // Multi-step flow management
  const [currentStep, setCurrentStep] = React.useState<AuthFlowStep>('personal_info');
  const [completedSteps, setCompletedSteps] = React.useState<AuthFlowStep[]>([]);
  
  // Memoize userInfo object to prevent infinite re-renders
  const userInfo = React.useMemo(() => ({
    email: formState.email,
    firstName: formState.firstName,
    lastName: formState.lastName
  }), [formState.email, formState.firstName, formState.lastName]);
  
  // Get available steps based on role
  const getAvailableSteps = (): AuthFlowStep[] => {
    const baseSteps: AuthFlowStep[] = ['personal_info', 'security_setup'];
    
    switch (role) {
      case 'principal':
        return ['personal_info', 'organization_setup', 'security_setup'];
      case 'teacher':
        return invitationToken 
          ? baseSteps
          : ['personal_info', 'security_setup'];
      case 'parent':
        return ['personal_info', 'security_setup'];
      case 'student':
        return baseSteps;
      default:
        return baseSteps;
    }
  };
  
  const availableSteps = getAvailableSteps();
  const currentStepIndex = availableSteps.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === availableSteps.length - 1;
  
  // Field validation
  const validateField = (fieldName: string, value: any): string[] => {
    const fieldErrors: string[] = [];
    
    switch (fieldName) {
      case 'firstName': {
        const firstNameValidation = AuthValidation.validateName(value, 'First name');
        if (!firstNameValidation.isValid) {
          fieldErrors.push(...firstNameValidation.errors);
        }
        break;
      }
        
      case 'lastName': {
        const lastNameValidation = AuthValidation.validateName(value, 'Last name');
        if (!lastNameValidation.isValid) {
          fieldErrors.push(...lastNameValidation.errors);
        }
        break;
      }
        
      case 'email': {
        const emailValidation = AuthValidation.validateEmail(value);
        if (!emailValidation.isValid) {
          fieldErrors.push(...emailValidation.errors);
        }
        break;
      }
        
      case 'phone':
        if (value) {
          const phoneValidation = AuthValidation.validatePhone(value);
          if (!phoneValidation.isValid) {
            fieldErrors.push(...phoneValidation.errors);
          }
        }
        break;
        
      case 'password':
        // Password validation is handled by PasswordStrengthIndicator
        break;
        
      case 'confirmPassword': {
        const confirmValidation = AuthValidation.validateConfirmPassword(
          formState.password,
          value
        );
        if (!confirmValidation.isValid) {
          fieldErrors.push(...confirmValidation.errors);
        }
        break;
      }
        
      case 'acceptTerms':
        if (!value) {
          fieldErrors.push('You must accept the terms and conditions');
        }
        break;
    }
    
    return fieldErrors;
  };
  
  // Handle field changes
  const handleFieldChange = (fieldName: keyof FormState, value: any) => {
    setFormState(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Real-time validation
    if (touched[fieldName]) {
      const fieldErrors = validateField(fieldName, value);
      setErrors(prev => ({
        ...prev,
        [fieldName]: fieldErrors
      }));
    }
  };
  
  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    const fieldErrors = validateField(fieldName, (formState as any)[fieldName]);
    setErrors(prev => ({
      ...prev,
      [fieldName]: fieldErrors
    }));
  };
  
  // Validate current step
  const validateCurrentStep = (): boolean => {
    const stepErrors: Record<string, string[]> = {};
    let isValid = true;
    
    switch (currentStep) {
      case 'personal_info': {
        const personalFields = ['firstName', 'lastName', 'email', 'phone'];
        personalFields.forEach(field => {
          const fieldErrors = validateField(field, (formState as any)[field]);
          if (fieldErrors.length > 0) {
            stepErrors[field] = fieldErrors;
            isValid = false;
          }
        });
        
        // Role-specific validation
        if (role === 'principal' && formState.jobTitle === undefined) {
          stepErrors.jobTitle = ['Job title is required'];
          isValid = false;
        }
        break;
      }
        
      case 'organization_setup':
        // Organization validation is handled by OrganizationSetup component
        if (!formState.organization) {
          isValid = false;
        }
        break;
        
      case 'security_setup': {
        // Password validation
        if (!passwordValidation?.isValid) {
          stepErrors.password = passwordValidation?.errors || ['Invalid password'];
          isValid = false;
        }
        
        // Confirm password
        const confirmErrors = validateField('confirmPassword', formState.confirmPassword);
        if (confirmErrors.length > 0) {
          stepErrors.confirmPassword = confirmErrors;
          isValid = false;
        }
        
        // Terms acceptance
        if (!formState.acceptTerms) {
          stepErrors.acceptTerms = ['You must accept the terms and conditions'];
          isValid = false;
        }
        break;
      }
    }
    
    setErrors(stepErrors);
    
    // Mark all fields in this step as touched
    Object.keys(stepErrors).forEach(field => {
      setTouched(prev => ({ ...prev, [field]: true }));
    });
    
    return isValid;
  };
  
  // Navigate between steps
  const handleNextStep = async () => {
    if (!validateCurrentStep()) {
      Alert.alert(
        'Validation Error',
        'Please correct the errors before continuing.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Mark current step as completed
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }
    
    if (isLastStep) {
      // Submit registration
      await handleSubmit();
    } else {
      // Move to next step
      const nextIndex = currentStepIndex + 1;
      setCurrentStep(availableSteps[nextIndex]);
    }
  };
  
  const handlePreviousStep = () => {
    if (!isFirstStep) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStep(availableSteps[prevIndex]);
    }
  };
  
  const handleStepChange = (step: AuthFlowStep) => {
    const stepIndex = availableSteps.indexOf(step);
    if (stepIndex >= 0 && completedSteps.includes(step)) {
      setCurrentStep(step);
    }
  };
  
  // Submit registration
  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      // Build registration object based on role
      let registration: EnhancedRegistration;
      
      const baseRegistration = {
        email: formState.email,
        password: formState.password,
        confirmPassword: formState.confirmPassword,
        firstName: formState.firstName,
        lastName: formState.lastName,
        phone: formState.phone,
        acceptTerms: formState.acceptTerms,
        marketingConsent: formState.marketingConsent
      };
      
      switch (role) {
        case 'principal':
          registration = {
            ...baseRegistration,
            role: 'principal',
            organization: {
              name: formState.organization!.name,
              type: formState.organization!.type,
              address: formState.organization!.address,
              phone: formState.organization!.phone
            },
            jobTitle: formState.jobTitle || 'Principal',
            yearsExperience: formState.yearsExperience
          } as PrincipalRegistration;
          break;
          
        case 'teacher':
          registration = {
            ...baseRegistration,
            role: 'teacher',
            organizationId,
            invitationToken,
            subjects: formState.subjects || [],
            gradeLevel: formState.gradeLevel || [],
            qualifications: formState.qualifications,
            bio: formState.bio
          } as TeacherRegistration;
          break;
          
        case 'parent':
          registration = {
            ...baseRegistration,
            role: 'parent',
            invitationToken: invitationToken || formState.invitationCode,
            children: formState.children || [],
            emergencyContact: formState.emergencyContact
          } as ParentRegistration;
          break;
          
        case 'student':
        default:
          registration = {
            ...baseRegistration,
            role: 'student',
            grade: formState.grade,
            dateOfBirth: formState.dateOfBirth,
            parentEmail: formState.parentEmail,
            schoolCode: formState.schoolCode,
            interests: formState.interests
          } as StudentRegistration;
          break;
      }
      
      // Call success handler
      onSuccess(registration);
      
    } catch (error) {
      console.error('Registration submission error:', error);
      onError?.(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };
  
  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'personal_info':
        return renderPersonalInfoStep();
      case 'organization_setup':
        return renderOrganizationSetupStep();
      case 'security_setup':
        return renderSecuritySetupStep();
      default:
        return null;
    }
  };
  
  const renderPersonalInfoStep = () => (
    <View style={styles.stepContent}>
      <Text style={[
        styles.stepTitle,
        { 
          color: theme.colors.onBackground,
          fontSize: theme.typography.titleLarge.fontSize,
          fontWeight: theme.typography.titleLarge.fontWeight as any
        }
      ]}>
        Personal Information
      </Text>
      
      <Text style={[
        styles.stepDescription,
        { 
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.typography.body1.fontSize
        }
      ]}>
        Let's start with your basic information
      </Text>
      
      <View style={styles.fieldsContainer}>
        <View style={styles.row}>
          <View style={styles.column}>
            {renderTextField('firstName', 'First Name', 'John', true)}
          </View>
          <View style={styles.column}>
            {renderTextField('lastName', 'Last Name', 'Doe', true)}
          </View>
        </View>
        
        {renderTextField('email', 'Email Address', 'john.doe@example.com', true, 'email-address')}
        {renderTextField('phone', 'Phone Number', '(555) 123-4567', false, 'phone-pad')}
        
        {role === 'parent' && !invitationToken && (
          <View style={{ marginTop: 8 }}>
            <Text style={[
              styles.label,
              { 
                color: theme.colors.onBackground,
                fontSize: theme.typography.body2.fontSize,
                marginBottom: 4
              }
            ]}>
              School Invitation Code (Optional)
            </Text>
            <Text style={[
              styles.helperText,
              { 
                color: theme.colors.onSurfaceVariant,
                fontSize: theme.typography.caption.fontSize,
                marginBottom: 8
              }
            ]}>
              If your school provided an invitation code, enter it here to link your account
            </Text>
            {renderTextField('invitationCode', 'Invitation Code', 'ABC12345', false, 'default')}
          </View>
        )}
        
        {role === 'principal' && (
          <>
            {renderTextField('jobTitle', 'Job Title', 'Principal', true)}
            {renderTextField('yearsExperience', 'Years of Experience', '10', false, 'numeric')}
          </>
        )}
        
        {role === 'teacher' && !invitationToken && (
          <>
            {renderMultiSelect('subjects', 'Subjects', SUBJECTS)}
            {renderMultiSelect('gradeLevel', 'Grade Levels', GRADE_LEVELS)}
            {renderTextArea('bio', 'Professional Bio', 'Tell us about your teaching experience...')}
          </>
        )}
        
        {role === 'student' && (
          <>
            {renderSelect('grade', 'Grade Level', GRADE_LEVELS)}
            {renderTextField('parentEmail', 'Parent/Guardian Email', 'parent@example.com', false, 'email-address')}
            {renderTextField('schoolCode', 'School Code (if provided)', 'SCH123', false)}
          </>
        )}
      </View>
    </View>
  );
  
  const renderOrganizationSetupStep = () => (
    <OrganizationSetup
      initialData={formState.organization}
      onComplete={(orgData) => {
        setFormState(prev => ({ ...prev, organization: orgData }));
        handleNextStep();
      }}
      onBack={handlePreviousStep}
      loading={loading}
    />
  );
  
  const renderSecuritySetupStep = () => (
    <View style={styles.stepContent}>
      <Text style={[
        styles.stepTitle,
        { 
          color: theme.colors.onBackground,
          fontSize: theme.typography.titleLarge.fontSize,
          fontWeight: theme.typography.titleLarge.fontWeight as any
        }
      ]}>
        Secure Your Account
      </Text>
      
      <Text style={[
        styles.stepDescription,
        { 
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.typography.body1.fontSize
        }
      ]}>
        Create a strong password to protect your account
      </Text>
      
      <View style={styles.fieldsContainer}>
        {renderPasswordField('password', 'Password', true)}
        
        {formState.password && (
          <PasswordStrengthIndicator
            password={formState.password}
            userInfo={userInfo}
            onStrengthChange={setPasswordValidation}
          />
        )}
        
        {renderPasswordField('confirmPassword', 'Confirm Password', true)}
        
        <View style={styles.termsContainer}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => handleFieldChange('acceptTerms', !formState.acceptTerms)}
          >
            <View style={[
              styles.checkbox,
              {
                backgroundColor: formState.acceptTerms ? theme.colors.primary : theme.colors.surface,
                borderColor: formState.acceptTerms ? theme.colors.primary : theme.colors.outline
              }
            ]}>
              {formState.acceptTerms && (
                <Text style={[styles.checkmark, { color: theme.colors.onPrimary }]}>✓</Text>
              )}
            </View>
            <Text style={[
              styles.termsText,
              { color: theme.colors.onSurface, fontSize: theme.typography.body2.fontSize }
            ]}>
              I accept the{' '}
              <Text style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>
                Terms and Conditions
              </Text>
              {' '}and{' '}
              <Text style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>
          
          {errors.acceptTerms && touched.acceptTerms && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {errors.acceptTerms[0]}
            </Text>
          )}
        </View>
        
        <View style={styles.termsContainer}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => handleFieldChange('marketingConsent', !formState.marketingConsent)}
          >
            <View style={[
              styles.checkbox,
              {
                backgroundColor: formState.marketingConsent ? theme.colors.primary : theme.colors.surface,
                borderColor: formState.marketingConsent ? theme.colors.primary : theme.colors.outline
              }
            ]}>
              {formState.marketingConsent && (
                <Text style={[styles.checkmark, { color: theme.colors.onPrimary }]}>✓</Text>
              )}
            </View>
            <Text style={[
              styles.termsText,
              { color: theme.colors.onSurface, fontSize: theme.typography.body2.fontSize }
            ]}>
              Send me updates about new features and educational content (optional)
            </Text>
          </TouchableOpacity>
        </View>
        
        {!formState.acceptTerms && (
          <View style={{ marginTop: 16, padding: 12, backgroundColor: theme.colors.errorContainer || theme.colors.surfaceVariant, borderRadius: 8 }}>
            <Text style={{ color: theme.colors.error, fontSize: 13, textAlign: 'center' }}>
              ⚠️ Please accept the Terms and Conditions to continue
            </Text>
          </View>
        )}
      </View>
    </View>
  );
  
  // Field rendering helpers
  const renderTextField = (
    fieldName: keyof FormState,
    label: string,
    placeholder: string,
    required: boolean = false,
    keyboardType: any = 'default'
  ) => {
    const fieldErrors = errors[fieldName] || [];
    const hasError = fieldErrors.length > 0 && touched[fieldName];
    const value = formState[fieldName] as string || '';
    
    return (
      <View style={styles.fieldContainer}>
        <Text style={[
          styles.fieldLabel,
          { 
            color: theme.colors.onSurface,
            fontSize: theme.typography.body2.fontSize,
            fontWeight: theme.typography.subtitle2.fontWeight as any
          }
        ]}>
          {label}
          {required && <Text style={{ color: theme.colors.error }}> *</Text>}
        </Text>
        
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.colors.surface,
              borderColor: hasError ? theme.colors.error : theme.colors.outline,
              color: theme.colors.onSurface
            }
          ]}
          value={value}
          onChangeText={(text) => handleFieldChange(fieldName, text)}
          onBlur={() => handleFieldBlur(fieldName)}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        
        {hasError && (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {fieldErrors[0]}
          </Text>
        )}
      </View>
    );
  };
  
  const renderPasswordField = (
    fieldName: 'password' | 'confirmPassword',
    label: string,
    required: boolean = false
  ) => {
    const fieldErrors = errors[fieldName] || [];
    const hasError = fieldErrors.length > 0 && touched[fieldName];
    const value = formState[fieldName];
    const isPasswordField = fieldName === 'password';
    const isVisible = isPasswordField ? showPassword : showConfirmPassword;
    const toggleVisibility = () => {
      if (isPasswordField) {
        setShowPassword(!showPassword);
      } else {
        setShowConfirmPassword(!showConfirmPassword);
      }
    };
    
    return (
      <View style={styles.fieldContainer}>
        <Text style={[
          styles.fieldLabel,
          { 
            color: theme.colors.onSurface,
            fontSize: theme.typography.body2.fontSize,
            fontWeight: theme.typography.subtitle2.fontWeight as any
          }
        ]}>
          {label}
          {required && <Text style={{ color: theme.colors.error }}> *</Text>}
        </Text>
        
        <View style={{ position: 'relative' }}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: hasError ? theme.colors.error : theme.colors.outline,
                color: theme.colors.onSurface,
                paddingRight: 50
              }
            ]}
            value={value}
            onChangeText={(text) => handleFieldChange(fieldName, text)}
            onBlur={() => handleFieldBlur(fieldName)}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            secureTextEntry={!isVisible}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          
          <TouchableOpacity
            onPress={toggleVisibility}
            style={{
              position: 'absolute',
              right: 12,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              paddingHorizontal: 8
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={{ fontSize: 18, color: theme.colors.primary, fontWeight: '600' }}>
              {isVisible ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {hasError && (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {fieldErrors[0]}
          </Text>
        )}
      </View>
    );
  };
  
  const renderTextArea = (
    fieldName: keyof FormState,
    label: string,
    placeholder: string,
    required: boolean = false
  ) => {
    const fieldErrors = errors[fieldName] || [];
    const hasError = fieldErrors.length > 0 && touched[fieldName];
    const value = formState[fieldName] as string || '';
    
    return (
      <View style={styles.fieldContainer}>
        <Text style={[
          styles.fieldLabel,
          { 
            color: theme.colors.onSurface,
            fontSize: theme.typography.body2.fontSize,
            fontWeight: theme.typography.subtitle2.fontWeight as any
          }
        ]}>
          {label}
          {required && <Text style={{ color: theme.colors.error }}> *</Text>}
        </Text>
        
        <TextInput
          style={[
            styles.textInput,
            styles.textArea,
            {
              backgroundColor: theme.colors.surface,
              borderColor: hasError ? theme.colors.error : theme.colors.outline,
              color: theme.colors.onSurface
            }
          ]}
          value={value}
          onChangeText={(text) => handleFieldChange(fieldName, text)}
          onBlur={() => handleFieldBlur(fieldName)}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!loading}
        />
        
        {hasError && (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {fieldErrors[0]}
          </Text>
        )}
      </View>
    );
  };
  
  const renderSelect = (
    fieldName: keyof FormState,
    label: string,
    options: string[],
    required: boolean = false
  ) => {
    const value = formState[fieldName] as string || '';
    
    return (
      <View style={styles.fieldContainer}>
        <Text style={[
          styles.fieldLabel,
          { 
            color: theme.colors.onSurface,
            fontSize: theme.typography.body2.fontSize,
            fontWeight: theme.typography.subtitle2.fontWeight as any
          }
        ]}>
          {label}
          {required && <Text style={{ color: theme.colors.error }}> *</Text>}
        </Text>
        
        <ScrollView 
          style={[
            styles.selectContainer,
            { 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline
            }
          ]}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {options.map(option => (
            <TouchableOpacity
              key={option}
              style={[
                styles.selectOption,
                {
                  backgroundColor: value === option 
                    ? theme.colors.primaryContainer 
                    : theme.colors.surface,
                  borderColor: value === option 
                    ? theme.colors.primary 
                    : theme.colors.outline
                }
              ]}
              onPress={() => handleFieldChange(fieldName, option)}
              disabled={loading}
            >
              <Text style={[
                styles.selectOptionText,
                { 
                  color: value === option 
                    ? theme.colors.onPrimaryContainer 
                    : theme.colors.onSurface
                }
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };
  
  const renderMultiSelect = (
    fieldName: keyof FormState,
    label: string,
    options: string[],
    required: boolean = false
  ) => {
    const values = (formState[fieldName] as string[]) || [];
    
    const toggleOption = (option: string) => {
      const currentValues = [...values];
      const index = currentValues.indexOf(option);
      
      if (index > -1) {
        currentValues.splice(index, 1);
      } else {
        currentValues.push(option);
      }
      
      handleFieldChange(fieldName, currentValues);
    };
    
    return (
      <View style={styles.fieldContainer}>
        <Text style={[
          styles.fieldLabel,
          { 
            color: theme.colors.onSurface,
            fontSize: theme.typography.body2.fontSize,
            fontWeight: theme.typography.subtitle2.fontWeight as any
          }
        ]}>
          {label}
          {required && <Text style={{ color: theme.colors.error }}> *</Text>}
        </Text>
        
        <View style={styles.multiSelectContainer}>
          {options.map(option => (
            <TouchableOpacity
              key={option}
              style={[
                styles.multiSelectOption,
                {
                  backgroundColor: values.includes(option) 
                    ? theme.colors.primaryContainer 
                    : theme.colors.surface,
                  borderColor: values.includes(option) 
                    ? theme.colors.primary 
                    : theme.colors.outline
                }
              ]}
              onPress={() => toggleOption(option)}
              disabled={loading}
            >
              <Text style={[
                styles.multiSelectOptionText,
                { 
                  color: values.includes(option) 
                    ? theme.colors.onPrimaryContainer 
                    : theme.colors.onSurface
                }
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };
  
  // Don't render organization setup separately since it has its own navigation
  if (currentStep === 'organization_setup') {
    return renderOrganizationSetupStep();
  }
  
  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Progress Indicator */}
          <AuthProgressSummary
            currentStep={currentStep}
            completedSteps={completedSteps}
            totalSteps={availableSteps.length}
          />
          
          <AuthProgressIndicator
            currentStep={currentStep}
            completedSteps={completedSteps}
            availableSteps={availableSteps}
            onStepPress={handleStepChange}
            allowNavigation={true}
            showDescriptions={false}
            compact={true}
          />
          
          {/* Step Content */}
          {renderStepContent()}
          
          {/* Navigation Buttons */}
          <View style={styles.navigationContainer}>
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.backButton,
                { 
                  borderColor: isFirstStep ? theme.colors.surfaceVariant : theme.colors.outline,
                  opacity: isFirstStep ? 0.5 : 1
                }
              ]}
              onPress={isFirstStep ? onCancel : handlePreviousStep}
              disabled={loading}
            >
              <Text style={[
                styles.navButtonText,
                { color: theme.colors.onSurface }
              ]}>
                {isFirstStep ? 'Cancel' : 'Back'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.nextButton,
                { 
                  backgroundColor: (loading || (currentStep === 'security_setup' && !formState.acceptTerms))
                    ? theme.colors.surfaceVariant 
                    : theme.colors.primary,
                  opacity: (loading || (currentStep === 'security_setup' && !formState.acceptTerms)) ? 0.5 : 1
                }
              ]}
              onPress={handleNextStep}
              disabled={loading || (currentStep === 'security_setup' && !formState.acceptTerms)}
            >
              {loading ? (
                <ActivityIndicator size="small" color={theme.colors.onPrimary} />
              ) : (
                <Text style={[
                  styles.navButtonText,
                  { 
                    color: theme.colors.onPrimary,
                    fontWeight: '600'
                  }
                ]}>
                  {isLastStep ? 'Complete Registration' : 'Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepContent: {
    marginVertical: 24,
  },
  stepTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  fieldsContainer: {
    gap: 20,
  },
  fieldContainer: {
    gap: 8,
  },
  fieldLabel: {
    fontWeight: '600',
  },
  label: {
    fontWeight: '600',
  },
  helperText: {
    lineHeight: 18,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  selectContainer: {
    maxHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 4,
    marginVertical: 6,
    borderWidth: 1,
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  multiSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  multiSelectOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  multiSelectOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  termsContainer: {
    marginVertical: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    lineHeight: 20,
  },
  navigationContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  navButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    borderWidth: 2,
  },
  nextButton: {
    flex: 2,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default EnhancedRegistrationForm;