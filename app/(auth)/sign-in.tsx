import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, ActivityIndicator, ScrollView, KeyboardAvoidingView } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { storage } from '@/lib/storage';
import { secureStore } from '@/lib/secure-store';
import { signInWithSession } from '@/lib/sessionManager';
import { LinearGradient } from 'expo-linear-gradient';
import { marketingTokens } from '@/components/marketing/tokens';
import { GlassCard } from '@/components/marketing/GlassCard';
import { GradientButton } from '@/components/marketing/GradientButton';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

export default function SignIn() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { session, loading: authLoading } = useAuth();
  const searchParams = useLocalSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);

console.log('[SignIn] Component rendering, theme:', theme);

  // Removed auth guard to allow users to explicitly access sign-in page
  // even if they have a stale session. This fixes the issue where
  // clicking "Sign In" from landing page redirects to onboarding instead.

  // Web-only: Prevent back navigation to this page after sign-out
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const w = globalThis as any;
    const onPopState = () => {
      console.log('[SignIn] Browser back detected, re-enforcing sign-in page');
      router.replace('/(auth)/sign-in');
    };
    
    w?.addEventListener?.('popstate', onPopState);
    return () => w?.removeEventListener?.('popstate', onPopState);
  }, []);

  useEffect(() => {
    console.log('[SignIn] Mounted');
    return () => console.log('[SignIn] Unmounted');
  }, []);

  const onContainerLayout = (e: any) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    console.log('[SignIn] Container layout:', { x, y, width, height });
  };
  const onCardLayout = (e: any) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    console.log('[SignIn] Card layout:', { x, y, width, height });
  };

  // Check for verification success message
  useEffect(() => {
    if (searchParams.verified === 'true') {
      setSuccessMessage(t('auth.email_verified', { defaultValue: 'Email verified successfully! You can now sign in.' }));
      // Auto-dismiss after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  }, [searchParams, t]);

  // Load saved credentials (web platform - no biometrics)
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        // Load saved email from remember me
        const savedRememberMe = await storage.getItem('rememberMe');
        const savedEmail = await storage.getItem('savedEmail');
        if (savedRememberMe === 'true' && savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
          
          // Try to load saved password from secure store (sanitize email for secure store key)
          const sanitizedKey = `password_${savedEmail.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const savedPassword = await secureStore.getItem(sanitizedKey);
          if (savedPassword) {
            setPassword(savedPassword);
          }
        }
      } catch (error) {
        console.error('Failed to load saved credentials:', error);
      }
    };
    loadSavedCredentials();
  }, []);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('auth.sign_in.enter_email_password', { defaultValue: 'Please enter email and password' }));
      return;
    }

    setLoading(true);
    let signInSuccess = false;
    
    try {
      // Use centralized session manager to avoid throwing on network/storage quirks
      const res = await signInWithSession(email.trim(), password);
      if (res.error) {
        Alert.alert(t('auth.sign_in.failed', { defaultValue: 'Sign In Failed' }), res.error);
        setLoading(false);
        return;
      }

      console.log('Sign in successful:', email.trim());
      signInSuccess = true;

      // Save remember me preference and credentials (best-effort; do not block sign-in)
      try {
        if (rememberMe) {
          await storage.setItem('rememberMe', 'true');
          await storage.setItem('savedEmail', email.trim());
          const sanitizedKey = `password_${email.trim().replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          await secureStore.setItem(sanitizedKey, password);
        } else {
          await storage.removeItem('rememberMe');
          await storage.removeItem('savedEmail');
          const sanitizedKey = `password_${email.trim().replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          try { await secureStore.deleteItem(sanitizedKey); } catch { /* Intentional: non-fatal */ }
        }
      } catch (credErr) {
        console.warn('Remember me save failed:', credErr);
      }

      // AuthContext will handle routing via auth state change listener
      // No fallback timeout needed - this was causing double navigation
      console.log('[Sign-In] Sign-in complete, AuthContext will handle routing');
      
      // Keep loading true - AuthContext will handle routing and the screen will unmount
      // Don't set loading false when sign-in succeeds
    } catch (_error: any) {
      // Enhanced debug logging to trace error source
      console.error('=== SIGN IN ERROR DEBUG ===');
      console.error('Error object:', _error);
      console.error('Error name:', _error?.name);
      console.error('Error message:', _error?.message);
      console.error('Error stack:', _error?.stack);
      console.error('Error cause:', _error?.cause);
      console.error('Error keys:', Object.keys(_error || {}));
      console.error('========================');
      
      const msg = _error?.message || t('common.unexpected_error', { defaultValue: 'An unexpected error occurred' });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), msg);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const supabase = await assertSupabase();
      
      // Get redirect URL
      const redirectTo = Platform.select({
        web: typeof window !== 'undefined' ? `${window.location.origin}/auth-callback` : 'http://localhost:8081/auth-callback',
        default: makeRedirectUri({
          scheme: 'edudashpro',
          path: 'auth-callback'
        })
      });

      console.log('[SignIn] Google OAuth redirect URL:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;

      // On web, the page will redirect automatically
      // On mobile, open the OAuth URL in browser
      if (Platform.OS !== 'web' && data?.url) {
        console.log('[SignIn] Opening OAuth URL in browser');
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );
        
        console.log('[SignIn] Browser result:', result.type);
        
        if (result.type === 'success') {
          // The callback will be handled by the auth-callback page
          router.push('/auth-callback' as any);
        } else if (result.type === 'cancel') {
          setGoogleLoading(false);
        }
      }
    } catch (error: any) {
      console.error('[SignIn] Google Sign-In Error:', error);
      Alert.alert(
        t('auth.sign_in.failed', { defaultValue: 'Sign In Failed' }),
        error.message || t('auth.oauth.config_error', { defaultValue: 'Failed to sign in with Google. Please try again.' })
      );
      setGoogleLoading(false);
    }
  };


  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      ...(Platform.OS === 'web' && {
        minHeight: '100vh',
        justifyContent: 'center',
        alignItems: 'center',
      }),
    },
    keyboardView: {
      flex: 1,
      ...(Platform.OS === 'web' && {
        width: '100%',
        maxWidth: '100%',
        alignSelf: 'center',
      }),
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 24,
      paddingTop: 20,
      ...(Platform.OS === 'web' && {
        paddingTop: 0,
      }),
    },
    logoCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      borderWidth: 2,
      borderColor: theme.border,
    },
    logoText: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 4,
    },
    logoSubtext: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    scrollView: {
      flex: 1,
      ...(Platform.OS === 'web' && {
        width: '100%',
      }),
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: Platform.OS === 'ios' ? 20 : 40,
      ...(Platform.OS === 'web' && {
        minHeight: '100vh',
        justifyContent: 'center',
        paddingVertical: 40,
      }),
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 20,
      justifyContent: 'center',
      width: '100%',
      ...(Platform.OS === 'web' && {
        flex: 0,
        paddingVertical: 0,
        paddingHorizontal: 40,
      }),
    },
    card: {
      width: '100%',
      alignSelf: 'center',
      ...(Platform.OS === 'web' && { 
        marginVertical: 20,
        maxWidth: '100%',
      }),
    },
    header: {
      marginBottom: 20,
      alignItems: 'center',
      gap: 4,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: marketingTokens.colors.fg.primary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 13,
      color: marketingTokens.colors.fg.secondary,
      textAlign: 'center',
    },
    form: {
      marginTop: 16,
      gap: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      padding: 14,
      color: theme.inputText,
      backgroundColor: theme.inputBackground,
    },
    button: {
      flex: 1,
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    buttonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    buttonDisabled: {
      backgroundColor: theme.textSecondary,
    },
    passwordContainer: {
      position: 'relative',
    },
    passwordInput: {
      paddingRight: 48,
    },
    eyeButton: {
      position: 'absolute',
      right: 12,
      top: 14,
      padding: 4,
    },
    rememberForgotContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      marginBottom: 4,
    },
    rememberMeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.border,
      marginRight: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.inputBackground,
    },
    checkboxChecked: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    rememberMeText: {
      fontSize: 14,
      color: theme.text,
    },
    forgotPasswordText: {
      fontSize: 14,
      color: marketingTokens.colors.accent.cyan400,
      fontWeight: '600',
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      marginVertical: 8,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.border,
    },
    dividerText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginHorizontal: 12,
    },
    signupPrompt: {
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    signupOptions: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
      ...(Platform.OS === 'web' && {
        flexDirection: 'row',
      }),
    },
    signupButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'rgba(99, 102, 241, 0.3)',
      minHeight: 56,
    },
    signupButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: marketingTokens.colors.fg.primary,
    },
    schoolSignupLink: {
      alignItems: 'center',
      padding: 14,
      marginTop: 4,
    },
    schoolSignupText: {
      fontSize: 14,
      color: marketingTokens.colors.fg.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    schoolSignupLinkText: {
      color: marketingTokens.colors.accent.cyan400,
      fontWeight: '700',
      textDecorationLine: 'underline',
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: '#4285F4', // Google Blue
      borderRadius: 10,
      minHeight: 48,
      marginTop: 8,
    },
    googleButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    homeButtonContainer: {
      position: 'absolute',
      top: Platform.OS === 'web' ? 16 : 8,
      right: 16,
      zIndex: 10,
    },
    homeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: 'rgba(14, 165, 233, 0.1)',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(14, 165, 233, 0.3)',
      minHeight: 44,
      minWidth: 44,
    },
    homeButtonText: {
      color: marketingTokens.colors.accent.cyan400,
      fontSize: 14,
      fontWeight: '600',
    },
  });

return (
<SafeAreaView style={styles.container} edges={['top', 'left', 'right']} onLayout={onContainerLayout}>
      {/* Background gradient */}
      <LinearGradient
        colors={marketingTokens.gradients.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Go to Home button */}
      <View style={styles.homeButtonContainer}>
        <Link href="/" asChild>
          <TouchableOpacity 
            style={styles.homeButton}
            activeOpacity={0.7}
          >
            <Ionicons name="home-outline" size={20} color={marketingTokens.colors.accent.cyan400} />
            <Text style={styles.homeButtonText}>{t('auth.go_to_home', { defaultValue: 'Go to Home' })}</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Logo Section */}
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="school" size={32} color={theme.primary} />
              </View>
              <Text style={styles.logoText}>{t('app.fullName', { defaultValue: 'EduDash Pro' })}</Text>
              <Text style={styles.logoSubtext}>{t('app.tagline', { defaultValue: 'Empowering Education Through AI' })}</Text>
            </View>

            <GlassCard style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('auth.sign_in.welcome_back', { defaultValue: 'Welcome Back' })}</Text>
                <Text style={styles.subtitle}>{t('auth.sign_in.sign_in_to_account', { defaultValue: 'Sign in to your account' })}</Text>
              </View>

              {successMessage && (
                <View style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Text style={{ fontSize: 16 }}>?</Text>
                  <Text style={{ 
                    color: '#6ee7b7', 
                    fontSize: 14, 
                    flex: 1,
                    fontWeight: '500'
                  }}>
                    {successMessage}
                  </Text>
                </View>
              )}

              <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder={t('auth.email', { defaultValue: 'Email' })}
              placeholderTextColor={theme.inputPlaceholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              blurOnSubmit={false}
            />

            <View style={styles.passwordContainer}>
              <TextInput
                ref={passwordInputRef}
                style={[styles.input, styles.passwordInput]}
                placeholder={t('auth.password', { defaultValue: 'Password' })}
                placeholderTextColor={theme.inputPlaceholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleSignIn}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.rememberForgotContainer}>
              <TouchableOpacity
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && (
                    <Ionicons name="checkmark" size={14} color={theme.onPrimary} />
                  )}
                </View>
                <Text style={styles.rememberMeText}>{t('auth.remember_me', { defaultValue: 'Remember me' })}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => router.push('/(auth)/forgot-password')}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>{t('auth.forgot_password', { defaultValue: 'Forgot Password?' })}</Text>
              </TouchableOpacity>
            </View>

            <GradientButton
              label={loading ? t('auth.sign_in.signing_in', { defaultValue: 'Signing In...' }) : t('auth.sign_in.cta', { defaultValue: 'Sign In' })}
              onPress={() => { if (!loading) handleSignIn(); }}
              variant="indigo"
              size="lg"
            />

            {/* Google Sign-In */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.or', { defaultValue: 'or' })}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={googleLoading || loading}
              activeOpacity={0.7}
            >
              {googleLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#fff" />
                  <Text style={styles.googleButtonText}>
                    {t('auth.continue_with_google', { defaultValue: 'Continue with Google' })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign-up options for parents and teachers */}
          <View style={styles.signupPrompt}>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.dont_have_account', { defaultValue: "Don't have an account?" })}</Text>
              <View style={styles.dividerLine} />
            </View>
            
            <View style={styles.signupOptions}>
              <TouchableOpacity
                style={styles.signupButton}
                onPress={() => router.push('/screens/parent-registration' as any)}
              >
                <Ionicons name="people" size={20} color={theme.primary} />
                <Text style={styles.signupButtonText}>{t('auth.sign_up_parent', { defaultValue: 'Sign up as Parent' })}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.signupButton}
                onPress={() => router.push('/screens/teacher-registration' as any)}
              >
                <Ionicons name="school" size={20} color={theme.primary} />
                <Text style={styles.signupButtonText}>{t('auth.sign_up_teacher', { defaultValue: 'Sign up as Teacher' })}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.schoolSignupLink}
              onPress={() => router.push('/screens/principal-onboarding' as any)}
            >
              <Text style={styles.schoolSignupText}>
                {t('auth.school_register_q', { defaultValue: 'Looking to register a school?' })} <Text style={styles.schoolSignupLinkText}>{t('common.click_here', { defaultValue: 'Click here' })}</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.schoolSignupLink}
              onPress={() => router.push('/screens/org-onboarding' as any)}
            >
              <Text style={styles.schoolSignupText}>
                {t('auth.org_onboard_q', { defaultValue: 'Looking to onboard an organization?' })} <Text style={styles.schoolSignupLinkText}>{t('common.click_here', { defaultValue: 'Click here' })}</Text>
              </Text>
            </TouchableOpacity>
          </View>
          </GlassCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
