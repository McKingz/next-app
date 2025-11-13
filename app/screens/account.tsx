import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from '@expo/vector-icons';
// import { router } from 'expo-router';

// Safe icon component that handles potential undefined icons
const SafeIcon = ({ name, size, color, fallback = "●" }: { 
  name: any; 
  size?: number; 
  color?: string; 
  fallback?: string 
}) => {
  if (Ionicons && typeof Ionicons === 'function') {
    try {
      return <Ionicons name={name} size={size} color={color} />;
    } catch (error) {
      console.warn('Icon rendering error:', error);
    }
  }
  return <Text style={{ fontSize: size, color }}>{fallback}</Text>;
};

import {
  getEnabled as getBiometricsEnabled,
  setEnabled as setBiometricsEnabled,
  isHardwareAvailable,
  isEnrolled,
} from "@/lib/biometrics";
import { BiometricAuthService } from "@/services/BiometricAuthService";
import { assertSupabase } from "@/lib/supabase";
import { signOutAndRedirect } from "@/lib/authActions";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useThemedStyles, themedStyles } from "@/hooks/useThemedStyles";
import { ThemeLanguageSettings } from '@/components/settings/ThemeLanguageSettings';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import ProfileImageService from '@/services/ProfileImageService';

export default function AccountScreen() {
  const { theme, mode } = useTheme();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [school, setSchool] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showThemeSettings, setShowThemeSettings] = useState(false);

  const styles = useThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    settingsButton: {
      padding: 8,
    },
    profileHeader: {
      alignItems: "center",
      paddingVertical: 32,
      paddingHorizontal: 20,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    avatarContainer: {
      position: "relative",
      marginBottom: 16,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      fontSize: 36,
      fontWeight: "600",
      color: theme.onPrimary,
    },
    cameraIconContainer: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: theme.secondary,
      borderRadius: 20,
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: theme.surface,
    },
    loadingIcon: {
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      fontSize: 16,
      color: theme.onSecondary,
    },
    displayName: {
      fontSize: 24,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 4,
    },
    email: {
      fontSize: 16,
      color: theme.textSecondary,
      marginBottom: 12,
    },
    roleBadge: {
      backgroundColor: theme.primaryLight,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    roleText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.onPrimary,
    },
    infoSection: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 16,
    },
    infoCard: themedStyles.card(theme),
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    infoContent: {
      flex: 1,
      marginLeft: 16,
    },
    infoLabel: {
      fontSize: 14,
      color: theme.textTertiary,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 16,
      color: theme.text,
    },
    editButton: {
      padding: 8,
    },
    signOutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 20,
      marginTop: 20,
      paddingVertical: 16,
      backgroundColor: theme.error,
      borderRadius: 12,
      shadowColor: theme.error,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    signOutText: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.onError,
      marginLeft: 8,
      letterSpacing: 0.5,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.modalOverlay,
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.modalBackground,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingBottom: 40,
      maxHeight: "80%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.text,
    },
    settingItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    settingLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    settingText: {
      marginLeft: 16,
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.text,
      marginBottom: 2,
    },
    settingSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    switchContainer: {
      marginLeft: 12,
    },
    setupGuideItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 20,
      backgroundColor: theme.warningLight + "20",
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    setupBadge: {
      backgroundColor: theme.warning,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    setupBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.onWarning,
    },
    editModalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    editModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
      backgroundColor: theme.surface,
    },
    editModalCancel: {
      fontSize: 16,
      color: theme.error,
    },
    editModalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },
    editModalSave: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: "600",
    },
    editModalContent: {
      flex: 1,
    },
    editSection: {
      padding: 20,
    },
    editSectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 20,
    },
    editFieldContainer: {
      marginBottom: 20,
    },
    editFieldLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    editFieldInput: {
      ...themedStyles.input(theme),
    },
    themeSettingsModal: {
      flex: 1,
      backgroundColor: theme.background,
    },
    themeSettingsHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
      backgroundColor: theme.surface,
    },
    themeSettingsTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginLeft: 16,
    },
  }));

  const load = useCallback(async () => {
    const { data } = await assertSupabase().auth.getUser();
    const u = data.user;
    setEmail(u?.email ?? null);

    // Get user metadata
    let r = (u?.user_metadata as any)?.role ?? null;
    let s = (u?.user_metadata as any)?.preschool_id ?? null;
    let fn = (u?.user_metadata as any)?.first_name ?? null;
    let ln = (u?.user_metadata as any)?.last_name ?? null;
    let img = (u?.user_metadata as any)?.avatar_url ?? null;

    if (u?.id) {
      try {
        const { data: p } = await assertSupabase()
          .from("profiles")
          .select("role,preschool_id,first_name,last_name,avatar_url")
          .eq("id", u.id)
          .maybeSingle();
        r = r || (p as any)?.role || null;
        s = s || (p as any)?.preschool_id || null;
        fn = fn || (p as any)?.first_name || null;
        ln = ln || (p as any)?.last_name || null;
        img = img || (p as any)?.avatar_url || null;
      } catch {
        /* noop */
      }
    }

    setRole(r);
    setSchool(s);
    setFirstName(fn);
    setLastName(ln);
    setProfileImage(img);

    // Set edit form values
    setEditFirstName(fn || "");
    setEditLastName(ln || "");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Convert profile image URI to data URI for web compatibility
  useEffect(() => {
    const convertImageUri = async () => {
      if (profileImage) {
        try {
          // Only convert for web platform and local URIs
          if (Platform.OS === 'web' && (profileImage.startsWith('blob:') || profileImage.startsWith('file:'))) {
            const dataUri = await ProfileImageService.convertToDataUri(profileImage);
            setDisplayUri(dataUri);
          } else {
            // For mobile or remote URIs, use the original URI
            setDisplayUri(profileImage);
          }
        } catch (error) {
          console.error('Failed to convert profile image URI:', error);
          setDisplayUri(profileImage); // Fallback to original URI
        }
      } else {
        setDisplayUri(null);
      }
    };
    
    convertImageUri();
  }, [profileImage]);

  useEffect(() => {
    (async () => {
      try {
        const securityInfo = await BiometricAuthService.getSecurityInfo();
        console.log('Biometric security info:', securityInfo);
        setBiometricSupported(securityInfo.capabilities.isAvailable);
        setBiometricEnrolled(securityInfo.capabilities.isEnrolled);
        setBiometricEnabled(securityInfo.isEnabled);
      } catch (error) {
        console.error("Error loading biometric info:", error);
        // Fallback to original method
        try {
          const [supported, enrolled, enabled] = await Promise.all([
            isHardwareAvailable(),
            isEnrolled(),
            getBiometricsEnabled(),
          ]);
          console.log('Biometric fallback check:', { supported, enrolled, enabled });
          setBiometricSupported(supported);
          setBiometricEnrolled(enrolled);
          setBiometricEnabled(enabled);
        } catch (fallbackError) {
          console.error('Biometric fallback error:', fallbackError);
        }
      }
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "We need camera roll permissions to select a profile picture.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Error", "Failed to select image");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "We need camera permissions to take a photo.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const uploadProfileImage = async (uri: string) => {
    try {
      setUploadingImage(true);
      const { data } = await assertSupabase().auth.getUser();
      const user = data.user;

      if (!user?.id) {
        Alert.alert('Error', 'User not found');
        return;
      }

      // Validate image before upload
      const validation = await ProfileImageService.validateImage(uri);
      if (!validation.valid) {
        Alert.alert('Invalid Image', validation.error || 'Please select a valid image');
        return;
      }

      // Upload using ProfileImageService
      const result = await ProfileImageService.uploadProfileImage(user.id, uri, {
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
        format: 'jpeg'
      });

      if (result.success && result.publicUrl) {
        // Update local state
        setProfileImage(result.publicUrl);
        Alert.alert("Success", "Profile picture updated!");
      } else {
        // Provide specific error message for missing bucket
        const errorMessage = result.error?.includes('Bucket not found') || result.error?.includes('not found') 
          ? "Avatar storage is not set up. Please contact support."
          : result.error || "Failed to update profile picture. Please try again.";
        Alert.alert("Upload Failed", errorMessage);
      }
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert(
        "Error",
        "Failed to update profile picture. Please try again.",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      "Update Profile Picture",
      "Choose an option",
      [
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Library", onPress: pickImage },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true },
    );
  };

  const toggleBiometric = async () => {
    if (!biometricEnrolled) {
      Alert.alert(
        "Biometric Setup Required",
        "Please set up fingerprint or face recognition in your device settings first.",
        [{ text: "OK" }],
      );
      return;
    }

    try {
      const { data } = await assertSupabase().auth.getUser();
      const user = data.user;

      if (!user) {
        Alert.alert("Error", "User not found");
        return;
      }

      if (biometricEnabled) {
        // Disable biometric authentication
        await BiometricAuthService.disableBiometric();
        await setBiometricsEnabled(false);
        setBiometricEnabled(false);
        Alert.alert(
          "Biometric Login Disabled",
          "You will need to use your password to sign in.",
        );
      } else {
        // Enable biometric authentication
        const success = await BiometricAuthService.enableBiometric(
          user.id,
          user.email || "",
        );
        if (success) {
          await setBiometricsEnabled(true);
          setBiometricEnabled(true);
          Alert.alert(
            "Biometric Login Enabled",
            "You can now use biometric authentication to sign in quickly.",
          );
        }
      }
    } catch (error) {
      console.error("Error toggling biometric:", error);
      Alert.alert("Error", "Failed to update biometric settings.");
    }

    setShowSettingsMenu(false);
  };

  const saveProfileChanges = async () => {
    try {
      setSavingProfile(true);
      const { data } = await assertSupabase().auth.getUser();
      const user = data.user;

      if (!user?.id) {
        Alert.alert("Error", "User not found");
        return;
      }

      // Update profile in database
      const { error: profileError } = await assertSupabase()
        .from("profiles")
        .update({
          first_name: editFirstName.trim() || null,
          last_name: editLastName.trim() || null,
        })
        .eq("id", user.id);

      if (profileError) {
        console.warn("Profile update error:", profileError);
        Alert.alert(
          "Warning",
          "Profile updated locally but failed to sync to database.",
        );
      }

      // Update local state
      setFirstName(editFirstName.trim() || null);
      setLastName(editLastName.trim() || null);
      setShowEditProfile(false);

      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to save profile changes.");
    } finally {
      setSavingProfile(false);
    }
  };

  const cancelProfileEdit = () => {
    setEditFirstName(firstName || "");
    setEditLastName(lastName || "");
    setShowEditProfile(false);
  };

  const getDisplayName = () => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) return firstName;
    if (lastName) return lastName;
    return email?.split("@")[0] || "User";
  };

  const getInitials = () => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (firstName) return firstName.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return "U";
  };

  return (
    <View style={styles.container}>
      <RoleBasedHeader title={t('navigation.account')} showBackButton onBackPress={() => {
        // Prefer router back when available, fall back to navigation
        try { 
          require('expo-router').router.back(); 
        } catch (error) {
          // Fallback handled by router
          console.log('Router back fallback', error);
        }
      }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={showImageOptions}
            disabled={uploadingImage}
          >
            {displayUri || profileImage ? (
              <Image source={{ uri: (displayUri || profileImage) ?? '' }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
            )}

            <View style={styles.cameraIconContainer}>
              {uploadingImage ? (
                <View style={styles.loadingIcon}>
                  <Text style={styles.loadingText}>⟳</Text>
                </View>
              ) : (
                <SafeIcon name="camera" size={16} color={theme.onSecondary} fallback="📷" />
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.displayName}>{getDisplayName()}</Text>
          <Text style={styles.email}>{email}</Text>

          {role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {role.replace("_", " ").toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Profile Information Cards */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>{t('account.info.title', { defaultValue: 'Account Information' })}</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <SafeIcon name="person-outline" size={20} color={theme.textSecondary} fallback="👤" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('account.info.full_name', { defaultValue: 'Full Name' })}</Text>
                <Text style={styles.infoValue}>
                  {firstName || lastName
                    ? `${firstName || ""} ${lastName || ""}`.trim()
                    : t('common.not_set', { defaultValue: 'Not set' })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setShowEditProfile(true)}
              >
                <SafeIcon name="pencil" size={16} color={theme.primary} fallback="✏️" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.infoCard, { marginTop: 12 }]}>
            <View style={styles.infoRow}>
              <SafeIcon name="mail-outline" size={20} color={theme.textSecondary} fallback="✉️" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('auth.email', { defaultValue: 'Email' })}</Text>
                <Text style={styles.infoValue}>{email || t('common.not_set', { defaultValue: 'Not set' })}</Text>
              </View>
            </View>
          </View>

          {role && (
            <View style={[styles.infoCard, { marginTop: 12 }]}>
              <View style={styles.infoRow}>
                <Ionicons name="briefcase-outline" size={20} color={theme.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('account.info.role', { defaultValue: 'Role' })}</Text>
                  <Text style={styles.infoValue}>{role.replace("_", " ")}</Text>
                </View>
              </View>
            </View>
          )}

          {school && (
            <View style={[styles.infoCard, { marginTop: 12 }]}>
              <View style={styles.infoRow}>
                <Ionicons name="school-outline" size={20} color={theme.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('account.info.school_id', { defaultValue: 'School ID' })}</Text>
                  <Text style={styles.infoValue}>{String(school).slice(0, 8)}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Switch Account and Sign Out Buttons */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>{t('account.account_actions', { defaultValue: 'Account Actions' })}</Text>
          
          <TouchableOpacity
            onPress={() => signOutAndRedirect({ clearBiometrics: false, redirectTo: '/(auth)/sign-in?switch=1' })}
            style={[styles.signOutButton, { 
              backgroundColor: theme.surfaceVariant, 
              borderWidth: 2,
              borderColor: theme.primary,
              shadowColor: theme.primary,
            }]}
            activeOpacity={0.7}
          >
            <SafeIcon name="swap-horizontal" size={22} color={theme.primary} fallback="🔄" />
            <Text style={[styles.signOutText, { color: theme.primary }]}>{t('navigation.switch_account', { defaultValue: 'Switch Account' })}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => signOutAndRedirect({ clearBiometrics: false, redirectTo: '/(auth)/sign-in' })}
            style={styles.signOutButton}
            activeOpacity={0.7}
          >
            <SafeIcon name="log-out-outline" size={22} color={theme.onError} fallback="🚪" />
            <Text style={styles.signOutText}>{t('navigation.logout', { defaultValue: 'Sign Out' })}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSettingsMenu}
        onRequestClose={() => setShowSettingsMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSettingsMenu(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('navigation.settings')}</Text>
              <TouchableOpacity onPress={() => setShowSettingsMenu(false)}>
                <SafeIcon name="close" size={24} color={theme.text} fallback="✖️" />
              </TouchableOpacity>
            </View>

            {/* Biometric Setting */}
            <TouchableOpacity
                style={styles.settingItem}
                onPress={biometricSupported ? toggleBiometric : () => {
                  Alert.alert(
                    t('settings.biometric.title', { defaultValue: 'Biometric Authentication' }),
                    t('settings.biometric.not_available_desc', { defaultValue: 'Biometric authentication is not available on this device. This feature requires fingerprint or face recognition hardware.' }),
                    [{ text: t('common.ok', { defaultValue: 'OK' }) }]
                  );
                }}
              >
                <View style={styles.settingLeft}>
                  <Ionicons
                    name={biometricEnabled ? "finger-print" : "finger-print-outline"}
                    size={24}
                    color={biometricSupported ? (biometricEnabled ? theme.primary : theme.textSecondary) : theme.textDisabled}
                  />
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>
                      {t('settings.biometric.title', { defaultValue: 'Biometric Authentication' })}
                    </Text>
                    <Text style={styles.settingSubtitle}>
                      {!biometricSupported ? t('common.not_available', { defaultValue: 'Not available' }) : biometricEnabled ? t('common.enabled', { defaultValue: 'Enabled' }) : t('common.disabled', { defaultValue: 'Disabled' })}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={!biometricSupported ? "information-circle" : biometricEnabled ? "checkmark-circle" : "chevron-forward"}
                  size={20}
                  color={!biometricSupported ? theme.textDisabled : biometricEnabled ? theme.success : theme.textSecondary}
                />
              </TouchableOpacity>

            {/* Theme & Language Settings */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {
                setShowSettingsMenu(false);
                setShowThemeSettings(true);
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="color-palette" size={24} color={theme.primary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>{t('settings.theme.title')} & {t('settings.language.title')}</Text>
                  <Text style={styles.settingSubtitle}>
                    {mode === 'dark' ? t('settings.theme.dark') : mode === 'light' ? t('settings.theme.light') : t('settings.theme.system')}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Notifications */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() =>
                Alert.alert(
                  t('common.coming_soon', { defaultValue: 'Coming Soon' }),
                  t('settings.notifications_coming_soon_desc', { defaultValue: 'Notification settings will be available in the next update.' }),
                )
              }
            >
              <View style={styles.settingLeft}>
                <Ionicons name="notifications" size={24} color={theme.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>{t('settings.notifications', { defaultValue: 'Notifications' })}</Text>
                  <Text style={styles.settingSubtitle}>{t('settings.manage_alerts', { defaultValue: 'Manage your alerts' })}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Privacy & Security */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() =>
                Alert.alert(
                  "Privacy & Security",
                  "Your data is encrypted and stored securely. Biometric data never leaves your device.",
                )
              }
            >
              <View style={styles.settingLeft}>
                <Ionicons name="lock-closed" size={24} color={theme.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>{t('settings.privacy_security.title', { defaultValue: 'Privacy & Security' })}</Text>
                  <Text style={styles.settingSubtitle}>
                    {t('settings.privacy_security.info', { defaultValue: 'Data protection info' })}
                  </Text>
                </View>
              </View>
              <Ionicons name="information-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Profile Edit Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showEditProfile}
        onRequestClose={cancelProfileEdit}
      >
        <View style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={cancelProfileEdit}>
              <Text style={styles.editModalCancel}>{t('navigation.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>{t('account.edit.title', { defaultValue: 'Edit Profile' })}</Text>
            <TouchableOpacity
              onPress={saveProfileChanges}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color={theme.primary} size="small" />
              ) : (
                <Text style={styles.editModalSave}>{t('navigation.save')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editModalContent}>
            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>{t('account.edit.personal_information', { defaultValue: 'Personal Information' })}</Text>

              <View style={styles.editFieldContainer}>
                <Text style={styles.editFieldLabel}>{t('auth.firstName', { defaultValue: 'First Name' })}</Text>
                <TextInput
                  style={styles.editFieldInput}
                  value={editFirstName}
                  onChangeText={setEditFirstName}
                  placeholder={t('account.placeholders.first_name', { defaultValue: 'Enter your first name' })}
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.editFieldContainer}>
                <Text style={styles.editFieldLabel}>{t('auth.lastName', { defaultValue: 'Last Name' })}</Text>
                <TextInput
                  style={styles.editFieldInput}
                  value={editLastName}
                  onChangeText={setEditLastName}
                  placeholder={t('account.placeholders.last_name', { defaultValue: 'Enter your last name' })}
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="words"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Theme & Language Settings Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showThemeSettings}
        onRequestClose={() => setShowThemeSettings(false)}
      >
        <View style={styles.themeSettingsModal}>
          <View style={styles.themeSettingsHeader}>
            <TouchableOpacity onPress={() => setShowThemeSettings(false)}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.themeSettingsTitle}>
              {t('settings.theme.title')} & {t('settings.language.title')}
            </Text>
          </View>
          <ThemeLanguageSettings />
        </View>
      </Modal>
    </View>
  );
}
