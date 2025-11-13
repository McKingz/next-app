/**
 * Teacher Dashboard Modals
 * Upgrade Modal, Options Menu, WhatsApp Modal
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { createCheckout } from '@/lib/payments';
import WhatsAppOptInModal from '@/components/whatsapp/WhatsAppOptInModal';
import { getStyles } from './styles';

interface TeacherModalsProps {
  showUpgradeModal: boolean;
  setShowUpgradeModal: (show: boolean) => void;
  showOptionsMenu: boolean;
  setShowOptionsMenu: (show: boolean) => void;
  upgrading: boolean;
  setUpgrading: (val: boolean) => void;
  showWhatsAppModal: boolean;
  setShowWhatsAppModal: (show: boolean) => void;
}

export const TeacherModals: React.FC<TeacherModalsProps> = ({
  showUpgradeModal,
  setShowUpgradeModal,
  showOptionsMenu,
  setShowOptionsMenu,
  upgrading,
  setUpgrading,
  showWhatsAppModal,
  setShowWhatsAppModal,
}) => {
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme, isDark);

  const handleUpgrade = async (planTier: string) => {
    try {
      setUpgrading(true);
      const { data: userRes } = await assertSupabase().auth.getUser();
      const uid = userRes?.user?.id;
      const res = await createCheckout({
        scope: "user",
        userId: uid || undefined,
        planTier: planTier as any,
        billing: "monthly",
        seats: 1,
      });
      if (res?.redirect_url) {
        try {
          await Linking.openURL(res.redirect_url);
        } catch (err) {
          console.warn("Failed to open URL:", err);
        }
      }
      setShowUpgradeModal(false);
    } catch (e: any) {
      Alert.alert("Upgrade failed", e?.message || "Please try again");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <>
      {/* Upgrade Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={showUpgradeModal}
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUpgradeModal(false)}
        >
          <View style={styles.upgradeModalContent}>
            <Text style={styles.optionsMenuTitle}>Upgrade Plan</Text>
            <Text style={{ color: theme.textSecondary, marginBottom: 12 }}>
              Choose a plan to unlock AI tools:
            </Text>
            <TouchableOpacity
              style={[styles.optionItem, { borderColor: "#e5e7eb", borderWidth: 1 }]}
              disabled={upgrading}
              onPress={() => handleUpgrade("basic")}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="sparkles" size={24} color="#4F46E5" />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Basic</Text>
                  <Text style={styles.optionSubtitle}>Great value, core AI tools</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, { borderColor: "#e5e7eb", borderWidth: 1 }]}
              disabled={upgrading}
              onPress={() => handleUpgrade("pro")}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="rocket" size={24} color="#10B981" />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Pro</Text>
                  <Text style={styles.optionSubtitle}>Full AI suite for teachers</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Options Menu Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showOptionsMenu}
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={styles.optionsMenuContent}>
            <View style={styles.optionsMenuHeader}>
              <Text style={styles.optionsMenuTitle}>Menu</Text>
              <TouchableOpacity onPress={() => setShowOptionsMenu(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                router.push("/screens/account");
              }}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="person-outline" size={24} color="#4F46E5" />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>My Profile</Text>
                  <Text style={styles.optionSubtitle}>
                    Account settings, profile picture & biometrics
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                router.push("/screens/teacher-reports");
              }}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="analytics-outline" size={24} color="#059669" />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>My Reports</Text>
                  <Text style={styles.optionSubtitle}>
                    View student progress & class analytics
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                router.push("/screens/teacher-messages");
              }}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="chatbubbles-outline" size={24} color="#7C3AED" />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Messages</Text>
                  <Text style={styles.optionSubtitle}>
                    Communicate with parents & administration
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* WhatsApp Modal */}
      <WhatsAppOptInModal
        visible={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        onSuccess={() => {
          setShowWhatsAppModal(false);
          Alert.alert('WhatsApp Connected!', 'You can now receive school updates via WhatsApp.');
        }}
      />
    </>
  );
};
