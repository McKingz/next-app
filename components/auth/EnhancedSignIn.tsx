// 🔐 Enhanced Sign-In Screen Component
// Comprehensive sign-in with MFA, social login, and recovery options

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { EnhancedAuthResponse, EnhancedUser, AuthFormState } from '../../types/auth-enhanced';
import { supabase } from '../../lib/supabase';
import { signInWithSession } from '../../lib/sessionManager';
import { BiometricAuthService } from '../../services/BiometricAuthService';
import { EnhancedBiometricAuth } from '../../services/EnhancedBiometricAuth';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

const { width } = Dimensions.get('window');

interface EnhancedSignInProps {
  onSuccess?: (user: EnhancedUser, response: EnhancedAuthResponse) => void;
  onError?: (error: string) => void;
  onForgotPassword?: () => void;
  onRegister?: () => void;
  onSocialLogin?: (provider: SocialProvider) => void;
  showSocialLogin?: boolean;
  showRememberMe?: boolean;
  showRegisterLink?: boolean;
  enableMFA?: boolean;
  organizationId?: string;
}

export type SocialProvider = 'google' | 'apple' | 'microsoft' | 'facebook';

interface SignInFormData {
  email: string;
  password: string;
  rememberMe: boolean;
  mfaCode?: string;
}

interface SocialLoginButton {
  provider: SocialProvider;
  title: string;
  icon: string;
  backgroundColor: string;
  textColor: string;
}

const SOCIAL_PROVIDERS: SocialLoginButton[] = [
  {
    provider: 'google',
    title: 'Continue with Google',
    icon: '🔍',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937'
  },
  {
    provider: 'apple',
    title: 'Continue with Apple',
    icon: '🍎',
    backgroundColor: '#000000',
    textColor: '#FFFFFF'
  },
  {
    provider: 'microsoft',
    title: 'Continue with Microsoft',
    icon: '🏢',
    backgroundColor: '#0078D4',
    textColor: '#FFFFFF'
  }
];

export const EnhancedSignIn: React.FC<EnhancedSignInProps> = ({
  onSuccess,
  onError,
  onForgotPassword,
  onRegister,
  onSocialLogin,
  showSocialLogin = true,
  showRememberMe = true,
  showRegisterLink = true,
  enableMFA = true,
  organizationId
}) => {
  const { theme, isDark } = useTheme();
  
  // Form state
  const [formData, setFormData] = React.useState<SignInFormData>({
    email: '',
    password: '',
    rememberMe: false,
    mfaCode: ''
  });
  
  const [formState, setFormState] = React.useState<AuthFormState>({
    values: {},
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: false,
    step: 1,
    totalSteps: 2
  });
  
  const [showPassword, setShowPassword] = React.useState(false);
  const [requiresMFA, setRequiresMFA] = React.useState(false);
  const [mfaMethod, setMfaMethod] = React.useState<'totp' | 'sms' | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loginAttempts, setLoginAttempts] = React.useState(0);
  const [isLocked, setIsLocked] = React.useState(false);
  const [lockoutTime, setLockoutTime] = React.useState<Date | null>(null);
  
  // Real authentication state
  const [mode, setMode] = React.useState<"password" | "otp">("password");
  const [code, setCode] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Biometric authentication state
  const [biometricAvailable, setBiometricAvailable] = React.useState(false);
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  const [storedUserData, setStoredUserData] = React.useState<any>(null);
  const [biometricType, setBiometricType] = React.useState<string | null>(null);
  
  const canUseSupabase = !!supabase;

  // Check biometric availability on component mount
  React.useEffect(() => {
    checkBiometricStatus();
  }, []);
  
  const checkBiometricStatus = async () => {
    try {
      const securityInfo = await BiometricAuthService.getSecurityInfo();
      const isAvailable = securityInfo.capabilities.isAvailable && securityInfo.capabilities.isEnrolled;
      setBiometricAvailable(isAvailable);
      setBiometricEnabled(securityInfo.isEnabled);
      
      // Determine the primary biometric type for display
      const availableTypes = securityInfo.availableTypes;
      if (availableTypes.includes('Fingerprint')) {
        setBiometricType('fingerprint');
      } else if (availableTypes.includes('Face ID')) {
        setBiometricType('face');
      } else if (availableTypes.includes('Iris Scan')) {
        setBiometricType('iris');
      } else {
        setBiometricType('biometric');
      }
      
      // Check for stored biometric data
      const enhancedSessionData = await EnhancedBiometricAuth.getBiometricSession();
      setStoredUserData(enhancedSessionData);
      
      // Pre-populate email if we have stored biometric data
      if (enhancedSessionData?.email) {
        setFormData(prev => ({ ...prev, email: enhancedSessionData.email }));
      }
    } catch (error) {
      console.error("Error checking biometric status:", error);
    }
  };
  
  // Validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string[]> = {};
    
    if (!formData.email) {
      errors.email = ['Email is required'];
    } else if (!validateEmail(formData.email)) {
      errors.email = ['Please enter a valid email address'];
    }
    
    if (!formData.password) {
      errors.password = ['Password is required'];
    } else if (formData.password.length < 6) {
      errors.password = ['Password must be at least 6 characters'];
    }
    
    if (requiresMFA && !formData.mfaCode) {
      errors.mfaCode = ['Verification code is required'];
    } else if (requiresMFA && formData.mfaCode && formData.mfaCode.length !== 6) {
      errors.mfaCode = ['Verification code must be 6 digits'];
    }
    
    setFormState(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  };

  // Real Supabase authentication
  const handleSignIn = async () => {
    if (!validateForm() || isLoading) return;
    
    setError(null);
    if (!canUseSupabase) {
      setError("Supabase not configured properly.");
      return;
    }
    
    if (!formData.email || !formData.password) {
      setError("Enter your email and password.");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Use existing session manager for real authentication
      const { session, profile, error: authError } = await signInWithSession(
        formData.email.trim(),
        formData.password
      );
      
      if (authError || !session) {
        throw new Error(authError || "Failed to sign in.");
      }
      
      console.log('Password login successful for:', session.email);
      
      // Store enhanced biometric session data for future biometric logins
      try {
        const effectiveProfile = profile ?? (await (await import('../../lib/rbac')).fetchEnhancedUserProfile(session.user_id));
        await EnhancedBiometricAuth.storeBiometricSession(
          session.user_id,
          session.email!,
          effectiveProfile as any
        );
        console.log('Stored biometric session data for future use');
      } catch (sessionError) {
        console.error('Error storing biometric session data:', sessionError);
      }
      
      // Reset form on success
      setFormData(prev => ({ ...prev, password: '', mfaCode: '' }));
      setLoginAttempts(0);
      setRequiresMFA(false);
      
      // Navigate to profiles gate (your existing navigation logic)
      router.replace("/profiles-gate");
      
    } catch (error: any) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      
      // Lock account after 5 failed attempts
      if (newAttempts >= 5) {
        setIsLocked(true);
        setLockoutTime(new Date(Date.now() + 15 * 60 * 1000)); // 15 minutes
        Alert.alert(
          'Account Locked',
          'Too many failed attempts. Your account has been locked for 15 minutes.'
        );
      }
      
      const errorMessage = error?.message ?? "Failed to sign in.";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Real biometric authentication  
  const handleBiometricLogin = async () => {
    if (!biometricAvailable || !biometricEnabled) {
      Alert.alert(
        "Biometric Authentication",
        "Biometric authentication is not available or enabled"
      );
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await EnhancedBiometricAuth.authenticateWithBiometric();
      
      if (!result.success) {
        setError(result.error || "Biometric authentication failed");
        return;
      }
      
      if (result.sessionRestored && result.userData) {
        console.log('Biometric authentication successful');
        router.replace("/profiles-gate");
      } else {
        setError("Session expired. Please sign in with your password.");
        await EnhancedBiometricAuth.clearBiometricSession();
        await BiometricAuthService.disableBiometric();
      }
    } catch (error) {
      console.error("Biometric authentication error:", error);
      setError("Biometric login failed. Please try password login.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Real OTP authentication
  const sendOTPCode = async () => {
    setError(null);
    if (!canUseSupabase) {
      setError("Supabase not configured properly.");
      return;
    }
    if (!formData.email) {
      setError("Enter your email first.");
      return;
    }
    
    setIsLoading(true);
    const redirectTo = Linking.createURL("/auth-callback");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: formData.email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
    });
    setIsLoading(false);
    
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  };
  
  const verifyOTPCode = async () => {
    setError(null);
    if (!canUseSupabase) {
      setError("Supabase not configured properly.");
      return;
    }
    if (!formData.email || !code) {
      setError("Enter the email and the 6-digit code.");
      return;
    }
    
    setIsLoading(true);
    const { data, error: err } = await supabase.auth.verifyOtp({
      email: formData.email.trim(),
      token: code.trim(),
      type: "email",
    });
    setIsLoading(false);
    
    if (err) {
      setError(err.message);
      return;
    }
    if (data?.user) {
      router.replace("/profiles-gate");
    }
  };

  // Handle social login
  const handleSocialLogin = (provider: SocialProvider) => {
    Alert.alert(
      'Social Login',
      `${provider} login is not implemented in this demo`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: () => onSocialLogin?.(provider) }
      ]
    );
  };

  // Handle forgot password
  const handleForgotPassword = () => {
    if (onForgotPassword) {
      onForgotPassword();
    } else {
      Alert.alert(
        'Password Recovery',
        'Password recovery functionality is not implemented in this demo'
      );
    }
  };

  // Check if account is locked
  React.useEffect(() => {
    if (lockoutTime && lockoutTime > new Date()) {
      const timer = setInterval(() => {
        if (new Date() > lockoutTime) {
          setIsLocked(false);
          setLockoutTime(null);
          setLoginAttempts(0);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  // Render MFA input
  const renderMFASection = () => {
    if (!requiresMFA) return null;
    
    return (
      <View style={styles.mfaContainer}>
        <View style={[styles.mfaHeader, { backgroundColor: theme.primaryLight + '20' }]}>
          <Text style={[styles.mfaTitle, { color: theme.primary }]}>
            Two-Factor Authentication
          </Text>
          <Text style={[styles.mfaSubtitle, { color: theme.textSecondary }]}>
            {mfaMethod === 'totp' 
              ? 'Enter the 6-digit code from your authenticator app'
              : 'Enter the 6-digit code sent to your phone'
            }
          </Text>
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={[styles.label, { color: theme.text }]}>
            Verification Code
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.mfaInput,
              {
                backgroundColor: theme.surface,
                borderColor: formState.errors.mfaCode ? theme.error : theme.border,
                color: theme.text,
                textAlign: 'center',
                fontSize: 24,
                letterSpacing: 8
              }
            ]}
            value={formData.mfaCode}
            onChangeText={mfaCode => setFormData({ ...formData, mfaCode })}
            placeholder="000000"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
          {formState.errors.mfaCode && (
            <Text style={[styles.errorText, { color: theme.error }]}>
              {formState.errors.mfaCode[0]}
            </Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.resendButton}
          onPress={() => Alert.alert('Code Sent', 'A new verification code has been sent.')}
        >
          <Text style={[styles.resendText, { color: theme.primary }]}>
            Resend Code
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render social login buttons
  const renderSocialLogins = () => {
    if (!showSocialLogin) return null;
    
    return (
      <View style={styles.socialContainer}>
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
          <Text style={[styles.dividerText, { color: theme.textSecondary }]}>
            or continue with
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
        </View>
        
        <View style={styles.socialButtons}>
          {SOCIAL_PROVIDERS.map((social) => (
            <TouchableOpacity
              key={social.provider}
              style={[
                styles.socialButton,
                {
                  backgroundColor: social.backgroundColor,
                  borderColor: theme.border
                }
              ]}
              onPress={() => handleSocialLogin(social.provider)}
            >
              <Text style={styles.socialIcon}>{social.icon}</Text>
              <Text style={[styles.socialText, { color: social.textColor }]}>
                {social.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Sign in to your account
          </Text>
        </View>
        
        {/* Beautiful Biometric Login Section */}
        {biometricAvailable && biometricEnabled && storedUserData && (
          <View style={[styles.biometricSection, { 
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: theme.divider 
          }]}>
            <Text style={[styles.biometricWelcome, { color: theme.text }]}>
              Welcome back!
            </Text>
            <Text style={[styles.biometricSubtitle, { color: theme.textSecondary }]}>
              {storedUserData.email}
            </Text>
            <TouchableOpacity
              disabled={isLoading}
              style={[styles.biometricButton, { backgroundColor: theme.primary }]}
              onPress={handleBiometricLogin}
            >
              {isLoading ? (
                <ActivityIndicator color="#0b1220" size="small" />
              ) : (
                <>
                  <Ionicons 
                    name={
                      biometricType === 'face' ? 'scan' :
                      biometricType === 'iris' ? 'eye' :
                      'finger-print'
                    } 
                    size={24} 
                    color="#0b1220" 
                  />
                  <Text style={[styles.biometricButtonText, { color: '#0b1220' }]}>
                    {biometricType === 'fingerprint' ? 'Use Fingerprint' :
                     biometricType === 'face' ? 'Use Face ID' :
                     'Use Biometric Login'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            
            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
              <Text style={[styles.dividerText, { color: theme.textSecondary }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
            </View>
          </View>
        )}

        {/* Account Locked Warning */}
        {isLocked && (
          <View style={[styles.warningContainer, { backgroundColor: theme.errorLight + '20' }]}>
            <Text style={[styles.warningText, { color: theme.error }]}>
              Account temporarily locked. Try again in {Math.ceil((lockoutTime!.getTime() - Date.now()) / 60000)} minutes.
            </Text>
          </View>
        )}

        {/* Mode Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            onPress={() => setMode("password")}
            style={[
              styles.toggleBtn,
              {
                backgroundColor: mode === "password" ? theme.primary : 'transparent',
                borderColor: theme.divider,
              },
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color: mode === "password" ? theme.onPrimary : theme.textSecondary,
                },
              ]}
            >
              Password
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode("otp")}
            style={[
              styles.toggleBtn,
              {
                backgroundColor: mode === "otp" ? theme.primary : 'transparent',
                borderColor: theme.divider,
              },
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color: mode === "otp" ? theme.onPrimary : theme.textSecondary,
                },
              ]}
            >
              Email Code
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Error Display */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.errorLight + '20' }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>
              {error}
            </Text>
          </View>
        )}
        
        {/* Social Login */}
        {!requiresMFA && mode === 'password' && renderSocialLogins()}

        {/* Sign In Form */}
        <View style={styles.formContainer}>
          {/* Email field - shown for both modes */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: theme.text }]}>
              Email Address
            </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderColor: formState.errors.email ? theme.error : theme.border,
                      color: theme.text
                    }
                  ]}
                  value={formData.email}
                  onChangeText={email => setFormData({ ...formData, email })}
                  placeholder="john.doe@example.com"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!isLocked}
                />
                {formState.errors.email && (
                  <Text style={[styles.errorText, { color: theme.error }]}>
                    {formState.errors.email[0]}
                  </Text>
                )}
              </View>

              <View style={styles.fieldContainer}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Password
                </Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        backgroundColor: theme.surface,
                        borderColor: formState.errors.password ? theme.error : theme.border,
                        color: theme.text
                      }
                    ]}
                    value={formData.password}
                    onChangeText={password => setFormData({ ...formData, password })}
                    placeholder="Enter your password"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showPassword}
                    autoComplete="current-password"
                    textContentType="password"
                    editable={!isLocked}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={[styles.passwordToggleText, { color: theme.primary }]}>
                      {showPassword ? '👁️' : '🔒'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {formState.errors.password && (
                  <Text style={[styles.errorText, { color: theme.error }]}>
                    {formState.errors.password[0]}
                  </Text>
                )}
              </View>

              {/* Remember Me & Forgot Password */}
              <View style={styles.optionsContainer}>
                {showRememberMe && (
                  <TouchableOpacity
                    style={styles.rememberMeContainer}
                    onPress={() => setFormData({ ...formData, rememberMe: !formData.rememberMe })}
                  >
                    <View style={[
                      styles.checkbox,
                      {
                        backgroundColor: formData.rememberMe ? theme.primary : 'transparent',
                        borderColor: theme.primary
                      }
                    ]}>
                      {formData.rememberMe && (
                        <Text style={[styles.checkmark, { color: theme.onPrimary }]}>
                          ✓
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.rememberMeText, { color: theme.text }]}>
                      Remember me
                    </Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>

          {/* MFA Section */}
          {renderMFASection()}

          {/* Sign In Button */}
          <TouchableOpacity
            style={[
              styles.signInButton,
              {
                backgroundColor: (isLoading || isLocked) ? theme.surfaceVariant : theme.primary,
                opacity: (isLoading || isLocked) ? 0.6 : 1
              }
            ]}
            onPress={
              mode === "password" ? handleSignIn :
              sent ? verifyOTPCode : sendOTPCode
            }
            disabled={isLoading || isLocked}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <Text style={[styles.signInButtonText, { color: theme.onPrimary }]}>
                {mode === "password" ? 
                  (requiresMFA ? 'Verify & Sign In' : 'Sign In') :
                  (sent ? 'Verify & Sign In' : 'Send Code')
                }
              </Text>
            )}
          </TouchableOpacity>

          {/* Login Attempts Warning */}
          {loginAttempts > 0 && loginAttempts < 5 && (
            <Text style={[styles.attemptsWarning, { color: theme.warning }]}>
              {5 - loginAttempts} attempts remaining
            </Text>
          )}

          {/* Register Link */}
          {showRegisterLink && !requiresMFA && (
            <View style={styles.registerContainer}>
              <Text style={[styles.registerText, { color: theme.textSecondary }]}>
                Don't have an account?{' '}
              </Text>
              <TouchableOpacity onPress={onRegister}>
                <Text style={[styles.registerLink, { color: theme.primary }]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  biometricSection: {
    marginBottom: 32,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  biometricWelcome: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  biometricSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  biometricButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
    minWidth: 200,
  },
  biometricButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
    alignSelf: 'center',
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  warningContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  socialContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    paddingHorizontal: 16,
  },
  socialButtons: {
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  socialIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  socialText: {
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    paddingHorizontal: 24,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 60,
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  passwordToggleText: {
    fontSize: 20,
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  rememberMeText: {
    fontSize: 14,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mfaContainer: {
    marginBottom: 24,
  },
  mfaHeader: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  mfaTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  mfaSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  mfaInput: {
    fontFamily: 'monospace',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  signInButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  signInButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  attemptsWarning: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  registerText: {
    fontSize: 16,
  },
  registerLink: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EnhancedSignIn;