/**
 * Biometric Test Screen
 * 
 * A debugging screen to test biometric authentication functionality
 * and help diagnose issues with devices like OppoA40.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import BiometricAuthService from '../services/BiometricAuthService';
import BiometricDebugger from '../utils/biometricDebug';

export default function BiometricTestScreen() {
  const { t } = useTranslation(); // Translation hook for future i18n support
  // Translation hook loaded for i18n support
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDebugInfo();
  }, []);

  const loadDebugInfo = async () => {
    try {
      const info = await BiometricDebugger.getDebugInfo();
      setDebugInfo(info);
    } catch (error) {
      console.error('Error loading debug info:', error);
    }
  };

  const runAuthenticationTest = async () => {
    setLoading(true);
    try {
      const result = await BiometricAuthService.authenticate('Test biometric authentication');
      Alert.alert(
        'Test Result',
        result.success ? 'Authentication successful!' : `Authentication failed: ${result.error}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Test Error', `Error during test: ${error}`, [{ text: 'OK' }]);
    }
    setLoading(false);
  };

  const runComprehensiveTests = async () => {
    setLoading(true);
    try {
      const results = await BiometricDebugger.testAuthentication();
      setTestResults(results);
      Alert.alert('Tests Complete', 'Check the results below', [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Test Error', `Error during comprehensive tests: ${error}`, [{ text: 'OK' }]);
    }
    setLoading(false);
  };

  const shareDebugReport = async () => {
    try {
      const report = await BiometricDebugger.generateReport();
      await Share.share({
        message: report,
        title: 'Biometric Debug Report',
      });
    } catch (error) {
      Alert.alert('Share Error', `Could not share report: ${error}`, [{ text: 'OK' }]);
    }
  };

  const getStatusColor = (available: boolean, enrolled: boolean) => {
    if (available && enrolled) return '#4CAF50'; // Green
    if (available && !enrolled) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getStatusText = (available: boolean, enrolled: boolean) => {
    if (available && enrolled) return 'Available & Enrolled';
    if (available && !enrolled) return 'Available but Not Enrolled';
    return 'Not Available';
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Biometric Test',
          headerShown: true,
        }}
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Device Information */}
        {debugInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Brand:</Text>
              <Text style={styles.value}>{debugInfo.deviceInfo.brand || 'Unknown'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Model:</Text>
              <Text style={styles.value}>{debugInfo.deviceInfo.modelName || 'Unknown'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>OS:</Text>
              <Text style={styles.value}>
                {debugInfo.deviceInfo.osName} {debugInfo.deviceInfo.osVersion}
              </Text>
            </View>
          </View>
        )}

        {/* Biometric Status */}
        {debugInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Biometric Status</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusIndicator,
                  {
                    backgroundColor: getStatusColor(
                      debugInfo.capabilities.hasHardware,
                      debugInfo.capabilities.isEnrolled
                    ),
                  },
                ]}
              />
              <Text style={styles.statusText}>
                {getStatusText(
                  debugInfo.capabilities.hasHardware,
                  debugInfo.capabilities.isEnrolled
                )}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Hardware:</Text>
              <Text style={styles.value}>
                {debugInfo.capabilities.hasHardware ? 'Available' : 'Not Available'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Enrolled:</Text>
              <Text style={styles.value}>
                {debugInfo.capabilities.isEnrolled ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Security Level:</Text>
              <Text style={styles.value}>
                {debugInfo.capabilities.securityLevel || 'Unknown'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Supported Types:</Text>
              <Text style={styles.value}>
                {Object.values(debugInfo.detailedTypes).join(', ') || 'None'}
              </Text>
            </View>
          </View>
        )}

        {/* Issues and Recommendations */}
        {debugInfo && debugInfo.potentialIssues.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Potential Issues</Text>
            {debugInfo.potentialIssues.map((issue: string, index: number) => (
              <View key={index} style={styles.issueRow}>
                <Ionicons name="warning" size={16} color="#FF9800" />
                <Text style={styles.issueText}>{issue}</Text>
              </View>
            ))}
          </View>
        )}

        {debugInfo && debugInfo.recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {debugInfo.recommendations.map((rec: string, index: number) => (
              <View key={index} style={styles.recommendationRow}>
                <Ionicons name="bulb" size={16} color="#4CAF50" />
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Test Results */}
        {testResults && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test Results</Text>
            {testResults.tests.map((test: any, index: number) => (
              <View key={index} style={styles.testResult}>
                <View style={styles.testHeader}>
                  <Text style={styles.testName}>{test.name}</Text>
                  <Ionicons
                    name={test.success ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={test.success ? '#4CAF50' : '#F44336'}
                  />
                </View>
                {test.error && (
                  <Text style={styles.testError}>Error: {test.error}</Text>
                )}
                {test.warning && (
                  <Text style={styles.testWarning}>Warning: {test.warning}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={runAuthenticationTest}
            disabled={loading}
          >
            <Ionicons name="finger-print" size={20} color="white" />
            <Text style={styles.buttonText}>Test Authentication</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={runComprehensiveTests}
            disabled={loading}
          >
            <Ionicons name="code" size={20} color="white" />
            <Text style={styles.buttonText}>Run Comprehensive Tests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.tertiaryButton]}
            onPress={shareDebugReport}
          >
            <Ionicons name="share" size={20} color="white" />
            <Text style={styles.buttonText}>Share Debug Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.refreshButton]}
            onPress={loadDebugInfo}
          >
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.buttonText}>Refresh Info</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  issueText: {
    fontSize: 14,
    color: '#FF9800',
    marginLeft: 8,
    flex: 1,
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 8,
    flex: 1,
  },
  testResult: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  testName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  testError: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
  },
  testWarning: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 4,
  },
  actionSection: {
    marginTop: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#4CAF50',
  },
  tertiaryButton: {
    backgroundColor: '#FF9800',
  },
  refreshButton: {
    backgroundColor: '#9C27B0',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});