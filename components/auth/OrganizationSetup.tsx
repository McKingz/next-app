// 🔐 Organization Setup Component
// Principal-specific organization creation form

import React from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { OrganizationType, Address, ValidationResult } from '../../types/auth-enhanced';
import { AuthValidation } from '../../lib/auth/AuthValidation';

interface OrganizationSetupProps {
  initialData?: Partial<OrganizationData>;
  onComplete: (organizationData: OrganizationData) => void;
  onBack?: () => void;
  loading?: boolean;
}

export interface OrganizationData {
  name: string;
  type: OrganizationType;
  address: Address;
  phone: string;
  website?: string;
  description?: string;
  studentCapacity?: number;
  establishedYear?: number;
}

const ORGANIZATION_TYPES: Array<{ value: OrganizationType; label: string; description: string }> = [
  {
    value: 'elementary_school',
    label: 'Elementary School',
    description: 'Grades K-5 or equivalent'
  },
  {
    value: 'middle_school',
    label: 'Middle School',
    description: 'Grades 6-8 or equivalent'
  },
  {
    value: 'high_school',
    label: 'High School',
    description: 'Grades 9-12 or equivalent'
  },
  {
    value: 'k12_school',
    label: 'K-12 School',
    description: 'All grades from Kindergarten to Grade 12'
  },
  {
    value: 'university',
    label: 'University/College',
    description: 'Higher education institution'
  },
  {
    value: 'training_center',
    label: 'Training Center',
    description: 'Professional or vocational training'
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other type of educational institution'
  }
];

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

export const OrganizationSetup: React.FC<OrganizationSetupProps> = ({
  initialData,
  onComplete,
  onBack,
  loading = false
}) => {
  const { theme } = useTheme();

  const [formData, setFormData] = React.useState<OrganizationData>({
    name: initialData?.name || '',
    type: initialData?.type || 'k12_school',
    address: {
      street: initialData?.address?.street || '',
      city: initialData?.address?.city || '',
      state: initialData?.address?.state || '',
      zipCode: initialData?.address?.zipCode || '',
      country: initialData?.address?.country || 'United States'
    },
    phone: initialData?.phone || '',
    website: initialData?.website || '',
    description: initialData?.description || '',
    studentCapacity: initialData?.studentCapacity || undefined,
    establishedYear: initialData?.establishedYear || undefined
  });

  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const validateField = (fieldName: string, value: any): ValidationResult => {
    switch (fieldName) {
      case 'name':
        return AuthValidation.validateName(value, 'Organization name');
      case 'phone':
        return value ? AuthValidation.validatePhone(value) : { isValid: true, errors: [] };
      case 'address.street':
        return value ? { isValid: true, errors: [] } : { isValid: false, errors: ['Street address is required'] };
      case 'address.city':
        return value ? { isValid: true, errors: [] } : { isValid: false, errors: ['City is required'] };
      case 'address.state':
        return value ? { isValid: true, errors: [] } : { isValid: false, errors: ['State is required'] };
      case 'address.zipCode': {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        return zipRegex.test(value) 
          ? { isValid: true, errors: [] } 
          : { isValid: false, errors: ['Please enter a valid ZIP code'] };
      }
      case 'website': {
        if (!value) return { isValid: true, errors: [] };
        // eslint-disable-next-line no-useless-escape
        const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        return urlRegex.test(value)
          ? { isValid: true, errors: [] }
          : { isValid: false, errors: ['Please enter a valid website URL'] };
      }
      case 'studentCapacity': {
        if (!value) return { isValid: true, errors: [] };
        const capacity = parseInt(value);
        return capacity > 0 && capacity < 100000
          ? { isValid: true, errors: [] }
          : { isValid: false, errors: ['Please enter a valid student capacity'] };
      }
      case 'establishedYear': {
        if (!value) return { isValid: true, errors: [] };
        const year = parseInt(value);
        const currentYear = new Date().getFullYear();
        return year > 1800 && year <= currentYear
          ? { isValid: true, errors: [] }
          : { isValid: false, errors: ['Please enter a valid established year'] };
      }
      default:
        return { isValid: true, errors: [] };
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    // Handle nested address fields
    if (fieldName.startsWith('address.')) {
      const addressField = fieldName.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [fieldName]: value
      }));
    }

    // Real-time validation
    const validation = validateField(fieldName, value);
    setErrors(prev => ({
      ...prev,
      [fieldName]: validation.errors
    }));
  };

  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
  };

  const validateForm = (): boolean => {
    const validationResults: Record<string, ValidationResult> = {
      name: validateField('name', formData.name),
      phone: validateField('phone', formData.phone),
      'address.street': validateField('address.street', formData.address.street),
      'address.city': validateField('address.city', formData.address.city),
      'address.state': validateField('address.state', formData.address.state),
      'address.zipCode': validateField('address.zipCode', formData.address.zipCode),
      website: validateField('website', formData.website),
      studentCapacity: validateField('studentCapacity', formData.studentCapacity?.toString()),
      establishedYear: validateField('establishedYear', formData.establishedYear?.toString())
    };

    const newErrors: Record<string, string[]> = {};
    let hasErrors = false;

    Object.entries(validationResults).forEach(([field, result]) => {
      if (!result.isValid) {
        newErrors[field] = result.errors;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    setTouched(Object.keys(validationResults).reduce((acc, field) => ({
      ...acc,
      [field]: true
    }), {}));

    return !hasErrors;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onComplete(formData);
    } else {
      Alert.alert(
        'Validation Error',
        'Please correct the errors in the form before continuing.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderField = (
    fieldName: string,
    label: string,
    placeholder: string,
    options: {
      required?: boolean;
      multiline?: boolean;
      keyboardType?: string;
      maxLength?: number;
    } = {}
  ) => {
    const { required = false, multiline = false, keyboardType = 'default', maxLength } = options;
    const fieldErrors = errors[fieldName] || [];
    const hasErrors = fieldErrors.length > 0 && touched[fieldName];
    
    let value: string;
    if (fieldName.startsWith('address.')) {
      const addressField = fieldName.split('.')[1] as keyof Address;
      value = formData.address[addressField] || '';
    } else {
      value = (formData as any)[fieldName]?.toString() || '';
    }

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
            multiline && styles.textInputMultiline,
            {
              backgroundColor: theme.colors.surface,
              borderColor: hasErrors ? theme.colors.error : theme.colors.outline,
              color: theme.colors.onSurface
            }
          ]}
          value={value}
          onChangeText={(text) => handleFieldChange(fieldName, text)}
          onBlur={() => handleFieldBlur(fieldName)}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          keyboardType={keyboardType as any}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          maxLength={maxLength}
          editable={!loading}
        />

        {hasErrors && (
          <View style={styles.errorContainer}>
            {fieldErrors.map((error, index) => (
              <Text
                key={index}
                style={[
                  styles.errorText,
                  { 
                    color: theme.colors.error,
                    fontSize: theme.typography.caption.fontSize
                  }
                ]}
              >
                • {error}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderTypeSelector = () => {
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
          Organization Type *
        </Text>
        
        <View style={styles.typeGrid}>
          {ORGANIZATION_TYPES.map((orgType) => (
            <TouchableOpacity
              key={orgType.value}
              style={[
                styles.typeOption,
                {
                  backgroundColor: formData.type === orgType.value 
                    ? theme.colors.primaryContainer 
                    : theme.colors.surface,
                  borderColor: formData.type === orgType.value 
                    ? theme.colors.primary 
                    : theme.colors.outline
                }
              ]}
              onPress={() => handleFieldChange('type', orgType.value)}
              disabled={loading}
            >
              <Text style={[
                styles.typeLabel,
                { 
                  color: formData.type === orgType.value 
                    ? theme.colors.onPrimaryContainer 
                    : theme.colors.onSurface,
                  fontSize: theme.typography.body2.fontSize,
                  fontWeight: '600'
                }
              ]}>
                {orgType.label}
              </Text>
              <Text style={[
                styles.typeDescription,
                { 
                  color: formData.type === orgType.value 
                    ? theme.colors.onPrimaryContainer 
                    : theme.colors.onSurfaceVariant,
                  fontSize: theme.typography.caption.fontSize
                }
              ]}>
                {orgType.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderStateSelector = () => {
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
          State *
        </Text>
        
        <ScrollView 
          style={[
            styles.stateSelector,
            { 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline
            }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {US_STATES.map((state) => (
            <TouchableOpacity
              key={state}
              style={[
                styles.stateOption,
                formData.address.state === state && {
                  backgroundColor: theme.colors.primaryContainer
                }
              ]}
              onPress={() => handleFieldChange('address.state', state)}
              disabled={loading}
            >
              <Text style={[
                styles.stateText,
                { 
                  color: formData.address.state === state 
                    ? theme.colors.onPrimaryContainer 
                    : theme.colors.onSurface,
                  fontSize: theme.typography.body2.fontSize
                }
              ]}>
                {state}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[
            styles.title,
            { 
              color: theme.colors.onBackground,
              fontSize: theme.typography.headlineSmall.fontSize,
              fontWeight: theme.typography.headlineSmall.fontWeight as any
            }
          ]}>
            Organization Setup
          </Text>
          
          <Text style={[
            styles.subtitle,
            { 
              color: theme.colors.onSurfaceVariant,
              fontSize: theme.typography.body1.fontSize
            }
          ]}>
            Tell us about your educational institution
          </Text>
        </View>

        <View style={styles.form}>
          {renderField('name', 'Organization Name', 'Enter your school/institution name', { required: true, maxLength: 100 })}
          
          {renderTypeSelector()}
          
          <View style={styles.sectionHeader}>
            <Text style={[
              styles.sectionTitle,
              { 
                color: theme.colors.onSurface,
                fontSize: theme.typography.titleMedium.fontSize,
                fontWeight: theme.typography.titleMedium.fontWeight as any
              }
            ]}>
              Address Information
            </Text>
          </View>

          {renderField('address.street', 'Street Address', 'Enter street address', { required: true, maxLength: 200 })}
          
          <View style={styles.row}>
            <View style={[styles.column, { flex: 2 }]}>
              {renderField('address.city', 'City', 'Enter city', { required: true, maxLength: 50 })}
            </View>
            <View style={[styles.column, { flex: 1 }]}>
              {renderField('address.zipCode', 'ZIP Code', '12345', { required: true, keyboardType: 'numeric', maxLength: 10 })}
            </View>
          </View>

          {renderStateSelector()}

          <View style={styles.sectionHeader}>
            <Text style={[
              styles.sectionTitle,
              { 
                color: theme.colors.onSurface,
                fontSize: theme.typography.titleMedium.fontSize,
                fontWeight: theme.typography.titleMedium.fontWeight as any
              }
            ]}>
              Additional Information
            </Text>
          </View>

          {renderField('phone', 'Phone Number', '(555) 123-4567', { required: true, keyboardType: 'phone-pad', maxLength: 20 })}
          {renderField('website', 'Website', 'https://www.yourschool.edu', { maxLength: 200 })}
          {renderField('description', 'Description', 'Brief description of your institution', { multiline: true, maxLength: 500 })}
          
          <View style={styles.row}>
            <View style={[styles.column, { flex: 1 }]}>
              {renderField('studentCapacity', 'Student Capacity', '500', { keyboardType: 'numeric', maxLength: 6 })}
            </View>
            <View style={[styles.column, { flex: 1 }]}>
              {renderField('establishedYear', 'Established Year', '2020', { keyboardType: 'numeric', maxLength: 4 })}
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          {onBack && (
            <TouchableOpacity
              style={[
                styles.button,
                styles.backButton,
                { borderColor: theme.colors.outline }
              ]}
              onPress={onBack}
              disabled={loading}
            >
              <Text style={[
                styles.backButtonText,
                { color: theme.colors.onSurface }
              ]}>
                Back
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.button,
              styles.submitButton,
              { 
                backgroundColor: loading ? theme.colors.surfaceVariant : theme.colors.primary,
                flex: onBack ? 1 : undefined
              }
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={[
              styles.submitButtonText,
              { 
                color: loading ? theme.colors.onSurfaceVariant : theme.colors.onPrimary,
                fontSize: theme.typography.labelLarge.fontSize,
                fontWeight: theme.typography.labelLarge.fontWeight as any
              }
            ]}>
              {loading ? 'Setting up...' : 'Complete Setup'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    gap: 20,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  fieldContainer: {
    gap: 8,
  },
  fieldLabel: {
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textInputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorContainer: {
    gap: 2,
  },
  errorText: {
    marginLeft: 4,
  },
  typeGrid: {
    gap: 12,
  },
  typeOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  typeLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  typeDescription: {
    lineHeight: 16,
  },
  stateSelector: {
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: 12,
  },
  stateOption: {
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  stateText: {
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    flex: 1,
    borderWidth: 2,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OrganizationSetup;