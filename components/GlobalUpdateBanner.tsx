import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUpdates } from '@/contexts/UpdatesProvider';
import { useTranslation } from 'react-i18next';

export function GlobalUpdateBanner() {
  const { isUpdateDownloaded, updateError, applyUpdate, dismissUpdate, dismissError } = useUpdates();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  
  // Don't render if no update is available and no error
  if (!isUpdateDownloaded && !updateError) {
    return null;
  }

  // Color scheme
  const isDark = colorScheme === 'dark';
  const dynamicStyles = {
    container: {
      backgroundColor: isUpdateDownloaded 
        ? (isDark ? '#0a5f3e' : '#10b981') // Green for update ready
        : (isDark ? '#7f1d1d' : '#ef4444'), // Red for error
    },
    text: {
      color: '#ffffff', // High contrast white text
    },
  };

  // Handle restart confirmation
  const handleRestartPress = () => {
    Alert.alert(
      t('Restart App'),
      t('The app will restart to apply the update. Any unsaved changes will be lost.'),
      [
        {
          text: t('Cancel'),
          style: 'cancel',
        },
        {
          text: t('Restart Now'),
          style: 'default',
          onPress: applyUpdate,
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={[styles.container, dynamicStyles.container]}>
        {isUpdateDownloaded ? (
          // Update downloaded banner
          <>
            <View style={styles.contentContainer}>
              <Ionicons
                name="download-outline"
                size={20}
                color="#ffffff"
                accessibilityHidden={true}
              />
              <View style={styles.textContainer}>
                <Text
                  style={[styles.title, dynamicStyles.text]}
                  accessibilityRole="text"
                  accessibilityLabel={t('App update downloaded')}
                >
                  {t('Update Ready')}
                </Text>
                <Text
                  style={[styles.message, dynamicStyles.text]}
                  accessibilityRole="text"
                >
                  {t('Tap to restart and apply the latest version')}
                </Text>
              </View>
            </View>
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.button, styles.laterButton]}
                onPress={dismissUpdate}
                accessibilityRole="button"
                accessibilityLabel={t('Dismiss update notification')}
                accessibilityHint={t('Hides this notification until the next update')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.buttonText, { color: '#ffffff' }]}>
                  {t('Later')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.restartButton]}
                onPress={handleRestartPress}
                accessibilityRole="button"
                accessibilityLabel={t('Restart app to apply update')}
                accessibilityHint={t('Restarts the app to apply the downloaded update')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color="#10b981"
                  accessibilityHidden={true}
                />
                <Text style={[styles.buttonText, { color: '#10b981', marginLeft: 4 }]}>
                  {t('Restart')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          // Error banner
          <>
            <View style={styles.contentContainer}>
              <Ionicons
                name="warning"
                size={20}
                color="#ffffff"
                accessibilityHidden={true}
              />
              <View style={styles.textContainer}>
                <Text
                  style={[styles.title, dynamicStyles.text]}
                  accessibilityRole="text"
                  accessibilityLabel={t('Update error occurred')}
                >
                  {t('Update Error')}
                </Text>
                <Text
                  style={[styles.message, dynamicStyles.text]}
                  accessibilityRole="text"
                  numberOfLines={2}
                >
                  {updateError || t('Failed to check for updates')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.button, styles.dismissButton]}
              onPress={dismissError}
              accessibilityRole="button"
              accessibilityLabel={t('Dismiss error notification')}
              accessibilityHint={t('Closes this error message')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close"
                size={16}
                color="#ffffff"
                accessibilityHidden={true}
              />
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    opacity: 0.9,
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44, // WCAG touch target size
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  restartButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  dismissButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: 44,
    height: 44,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '500',
  },
});