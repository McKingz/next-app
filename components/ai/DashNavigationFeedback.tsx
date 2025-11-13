/**
 * DashNavigationFeedback - Visual feedback when Dash opens screens
 * 
 * Shows a small modal at the bottom of the screen when Dash
 * navigates to a new screen programmatically
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface NavigationFeedbackProps {
  visible: boolean;
  screenName: string;
  onHide: () => void;
}

const ANIMATION_DURATION = 300;
const DISPLAY_DURATION = 2000;

export const DashNavigationFeedback: React.FC<NavigationFeedbackProps> = ({
  visible,
  screenName,
  onHide
}) => {
  const [slideAnim] = useState(new Animated.Value(100));
  const [opacityAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      // Slide up and fade in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide after display duration
      const hideTimer = setTimeout(() => {
        hideModal();
      }, DISPLAY_DURATION);

      return () => clearTimeout(hideTimer);
    }
  }, [visible]);

  const hideModal = () => {
    // Slide down and fade out
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.modalContent}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons 
              name="robot-happy" 
              size={24} 
              color="#4A90E2" 
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Dash is navigating</Text>
            <Text style={styles.screenName}>{screenName}</Text>
          </View>
          <Animated.View 
            style={[
              styles.progressBar,
              {
                opacity: opacityAnim,
              }
            ]}
          >
            <View style={styles.progressFill} />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 9999,
    elevation: 10,
  },
  modalContent: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  screenName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressFill: {
    height: 2,
    backgroundColor: '#4A90E2',
    width: '100%',
  },
});

export default DashNavigationFeedback;