import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth, useLogin, useRegister, useLogout } from '../../lib/auth/useAuth';

/**
 * Login Form Component
 * Handles user authentication with email and password
 */
export const LoginForm: React.FC<{
  onLoginSuccess?: () => void;
  onSwitchToRegister?: () => void;
}> = ({ onLoginSuccess, onSwitchToRegister }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useLogin();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('auth_comp.enter_email_password'));
      return;
    }

    const result = await login({ email: email.trim(), password });
    
    if (result.success) {
      Alert.alert(t('common.success'), t('auth_comp.login_successful'));
      onLoginSuccess?.();
    } else {
      Alert.alert(t('auth_comp.login_failed'), result.error || t('common.unexpected_error'));
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.form}>
          <Text style={styles.title}>{t('auth_comp.sign_in_title')}</Text>
          
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={clearError}>
                <Text style={styles.errorDismiss}>{t('auth_comp.dismiss')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth_comp.enter_email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth_comp.enter_password')}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
            )}
          </TouchableOpacity>

          {onSwitchToRegister && (
            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>{t('auth.dont_have_account')} </Text>
              <TouchableOpacity onPress={onSwitchToRegister}>
                <Text style={styles.switchLink}>{t('auth.signUp')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/**
 * Registration Form Component
 * Handles student account creation
 */
export const RegisterForm: React.FC<{
  onRegisterSuccess?: () => void;
  onSwitchToLogin?: () => void;
}> = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { register, isLoading, error, clearError } = useRegister();

  const handleRegister = async () => {
    // Basic validation
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('auth_comp.fill_all_fields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('auth_comp.passwords_no_match'));
      return;
    }

    const result = await register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
    });
    
    if (result.success) {
      const message = result.requiresEmailVerification
        ? t('auth_comp.registration_verify_email')
        : t('auth_comp.registration_success');
      
      Alert.alert(t('common.success'), message);
      onRegisterSuccess?.();
    } else {
      Alert.alert(t('auth_comp.registration_failed'), result.error || t('common.unexpected_error'));
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.form}>
          <Text style={styles.title}>{t('auth_comp.create_account')}</Text>
          <Text style={styles.subtitle}>{t('auth_comp.join_as_student')}</Text>
          
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={clearError}>
                <Text style={styles.errorDismiss}>{t('auth_comp.dismiss')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>{t('auth.firstName')}</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder={t('auth_comp.first_name_placeholder')}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>{t('auth.lastName')}</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder={t('auth_comp.last_name_placeholder')}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth_comp.enter_email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth_comp.create_password')}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <Text style={styles.hint}>
              {t('auth_comp.password_requirements')}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('auth_comp.confirm_password_placeholder')}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('auth_comp.create_account_button')}</Text>
            )}
          </TouchableOpacity>

          {onSwitchToLogin && (
            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>{t('auth_comp.already_have_account')} </Text>
              <TouchableOpacity onPress={onSwitchToLogin}>
                <Text style={styles.switchLink}>{t('auth.signIn')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/**
 * User Profile Component
 * Displays current user information and logout option
 */
export const UserProfile: React.FC = () => {
  const { t } = useTranslation();
  const { profile, user, isAdmin, isInstructor, isStudent } = useAuth();
  const { logout, isLoading } = useLogout();

  const handleLogout = async () => {
    Alert.alert(
      t('auth_comp.logout'),
      t('auth_comp.logout_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth_comp.logout'),
          style: 'destructive',
          onPress: async () => {
            const result = await logout();
            if (result.success) {
              Alert.alert(t('common.success'), t('auth_comp.logout_success'));
            } else {
              Alert.alert(t('common.error'), result.error || t('auth_comp.logout_failed'));
            }
          },
        },
      ]
    );
  };

  if (!profile || !user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('auth_comp.no_profile')}</Text>
      </View>
    );
  }

  const getRoleBadgeColor = () => {
    if (isAdmin) return '#e74c3c';
    if (isInstructor) return '#3498db';
    if (isStudent) return '#2ecc71';
    return '#95a5a6';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileContainer}>
        <Text style={styles.title}>Your Profile</Text>
        
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Text style={styles.profileName}>
              {profile.first_name} {profile.last_name}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor() }]}>
              <Text style={styles.roleBadgeText}>{profile.role?.toUpperCase()}</Text>
            </View>
          </View>
          
          <Text style={styles.profileEmail}>{profile.email}</Text>
          
          <View style={styles.profileDetails}>
            <Text style={styles.detailLabel}>Account Created:</Text>
            <Text style={styles.detailValue}>
              {new Date(profile.created_at).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.profileDetails}>
            <Text style={styles.detailLabel}>User ID:</Text>
            <Text style={styles.detailValue}>{profile.id}</Text>
          </View>

          {profile.capabilities && profile.capabilities.length > 0 && (
            <View style={styles.capabilitiesContainer}>
              <Text style={styles.detailLabel}>Capabilities:</Text>
              <View style={styles.capabilitiesList}>
                {profile.capabilities.map((capability, index) => (
                  <View key={index} style={styles.capabilityTag}>
                    <Text style={styles.capabilityText}>{capability}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, isLoading && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.logoutButtonText}>Logout</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

/**
 * Authentication Guard Component
 * Shows different content based on authentication status
 */
export const AuthGuard: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireRole?: 'admin' | 'instructor' | 'student';
  requireCapability?: string;
}> = ({ children, fallback, requireRole, requireCapability }) => {
  const { authenticated, loading, initialized, profile } = useAuth();

  // Show loading state
  if (!initialized || loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Check authentication
  if (!authenticated) {
    return (
      <View style={styles.centerContainer}>
        {fallback || <Text style={styles.errorText}>Please login to continue</Text>}
      </View>
    );
  }

  // Check role requirement
  if (requireRole && profile?.role !== requireRole) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          Access denied. This feature requires {requireRole} role.
        </Text>
      </View>
    );
  }

  // Check capability requirement
  if (requireCapability && !profile?.capabilities?.includes(requireCapability)) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          Access denied. You don't have permission to access this feature.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  form: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputContainer: {
    marginBottom: 16,
  },
  halfWidth: {
    width: '48%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  switchText: {
    color: '#666',
    fontSize: 14,
  },
  switchLink: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    flex: 1,
  },
  errorDismiss: {
    color: '#c62828',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  profileContainer: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileEmail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  profileDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    textAlign: 'right',
  },
  capabilitiesContainer: {
    marginTop: 16,
  },
  capabilitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  capabilityTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  capabilityText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
});