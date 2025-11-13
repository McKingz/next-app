/**
 * EduDashPro Loading Components Usage Examples
 * 
 * This file demonstrates all the ways to use the new branded loading components
 */

import React from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { Text } from './Text';
import { LoadingState } from './LoadingState';
import EduDashProLoader, { 
  EduDashProSplashLoader, 
  EduDashProInlineLoader 
} from './EduDashProLoader';
import AppSplashScreen from './AppSplashScreen';

export function LoadingExamples() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h1" style={styles.title}>EduDashPro Loading Components</Text>
      
      {/* 1. Default LoadingState (now branded) */}
      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>1. Default LoadingState (Branded)</Text>
        <Text variant="body" style={styles.description}>
          The default LoadingState now uses EduDashPro branding by default:
        </Text>
        <View style={styles.example}>
          <LoadingState message="Loading your dashboard..." />
        </View>
      </View>

      {/* 2. Simple LoadingState */}
      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>2. Simple LoadingState</Text>
        <Text variant="body" style={styles.description}>
          For when you need a simple spinner without branding:
        </Text>
        <View style={styles.example}>
          <LoadingState 
            variant="simple" 
            message="Loading..." 
            color="#00f5ff" 
          />
        </View>
      </View>

      {/* 3. Inline Branded Loader */}
      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>3. Inline Branded Loader</Text>
        <Text variant="body" style={styles.description}>
          Perfect for loading states within components:
        </Text>
        <View style={styles.example}>
          <EduDashProInlineLoader 
            message="Loading student data..." 
            iconSize={60}
            showSpinner={true}
          />
        </View>
      </View>

      {/* 4. Full Screen Loader */}
      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>4. Full Screen Loader</Text>
        <Text variant="body" style={styles.description}>
          For overlay loading states:
        </Text>
        <View style={styles.exampleCode}>
          <Text variant="code" style={styles.codeText}>
{`// Full screen overlay
<EduDashProLoader 
  message="Processing your request..." 
  variant="default"
  fullScreen={true}
  iconSize={100}
/>`}
          </Text>
        </View>
      </View>

      {/* 5. Splash Screen */}
      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>5. App Splash Screen</Text>
        <Text variant="body" style={styles.description}>
          Beautiful branded splash screen for app initialization:
        </Text>
        <View style={styles.exampleCode}>
          <Text variant="code" style={styles.codeText}>
{`// App splash screen
<AppSplashScreen
  isLoading={isAppLoading}
  onLoadingComplete={() => setShowSplash(false)}
  minimumDisplayTime={2000}
  message="Initializing Neural Network..."
/>`}
          </Text>
        </View>
      </View>

      {/* Usage Patterns */}
      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>Common Usage Patterns</Text>
        
        <Text variant="h3" style={styles.subsectionTitle}>In React Components:</Text>
        <View style={styles.exampleCode}>
          <Text variant="code" style={styles.codeText}>
{`import { LoadingState } from '@/components/ui/LoadingState';
import { EduDashProInlineLoader } from '@/components/ui/EduDashProLoader';

function MyComponent() {
  const [loading, setLoading] = useState(true);
  
  if (loading) {
    return (
      <LoadingState 
        message="Loading dashboard data..." 
        variant="branded" 
      />
    );
  }
  
  return <div>Your content here</div>;
}`}
          </Text>
        </View>

        <Text variant="h3" style={styles.subsectionTitle}>In Mobile Apps:</Text>
        <View style={styles.exampleCode}>
          <Text variant="code" style={styles.codeText}>
{`// Show splash on app startup
if (showSplash && Platform.OS !== 'web') {
  return (
    <AppSplashScreen
      isLoading={isAppLoading}
      onLoadingComplete={() => setShowSplash(false)}
      message="Initializing EduDash Pro..."
    />
  );
}`}
          </Text>
        </View>

        <Text variant="h3" style={styles.subsectionTitle}>For Data Loading:</Text>
        <View style={styles.exampleCode}>
          <Text variant="code" style={styles.codeText}>
{`// Inside list components
{dataLoading ? (
  <EduDashProInlineLoader 
    message="Loading students..." 
    iconSize={50}
    showIcon={true}
  />
) : (
  <StudentList data={students} />
)}`}
          </Text>
        </View>
      </View>

      {/* Customization */}
      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>Customization Options</Text>
        
        <View style={styles.feature}>
          <Text variant="h3" style={styles.featureTitle}>Icon Size</Text>
          <Text variant="body">Control the size of the EduDashPro icon: iconSize={"{60, 80, 120, 160}"}</Text>
        </View>

        <View style={styles.feature}>
          <Text variant="h3" style={styles.featureTitle}>Variants</Text>
          <Text variant="body">Choose from: 'default', 'splash', 'inline'</Text>
        </View>

        <View style={styles.feature}>
          <Text variant="h3" style={styles.featureTitle}>Messages</Text>
          <Text variant="body">Custom loading messages for better UX</Text>
        </View>

        <View style={styles.feature}>
          <Text variant="h3" style={styles.featureTitle}>Animations</Text>
          <Text variant="body">Smooth fade-in, scaling, and pulsing animations</Text>
        </View>
      </View>

      {/* Benefits */}
      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>Benefits</Text>
        
        <View style={styles.benefitsList}>
          <View style={styles.benefit}>
            <Text variant="body" style={styles.benefitText}>
              ✅ <Text style={styles.bold}>Consistent Branding</Text> - Your custom EduDashPro icon throughout
            </Text>
          </View>
          <View style={styles.benefit}>
            <Text variant="body" style={styles.benefitText}>
              ✅ <Text style={styles.bold}>Professional Appearance</Text> - Beautiful animations and effects
            </Text>
          </View>
          <View style={styles.benefit}>
            <Text variant="body" style={styles.benefitText}>
              ✅ <Text style={styles.bold}>Cross-platform</Text> - Works on web, iOS, and Android
            </Text>
          </View>
          <View style={styles.benefit}>
            <Text variant="body" style={styles.benefitText}>
              ✅ <Text style={styles.bold}>Optimized Performance</Text> - Efficient animations using native drivers
            </Text>
          </View>
          <View style={styles.benefit}>
            <Text variant="body" style={styles.benefitText}>
              ✅ <Text style={styles.bold}>Easy to Use</Text> - Drop-in replacement for existing loading states
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
    color: '#00f5ff',
  },
  section: {
    marginBottom: 40,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00f5ff',
  },
  sectionTitle: {
    marginBottom: 12,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  subsectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    marginBottom: 16,
    color: '#4b5563',
    lineHeight: 22,
  },
  example: {
    height: 120,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  exampleCode: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  codeText: {
    color: '#e5e7eb',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier New',
    fontSize: 12,
    lineHeight: 18,
  },
  feature: {
    marginBottom: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#00f5ff',
  },
  featureTitle: {
    marginBottom: 4,
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  benefitsList: {
    marginTop: 12,
  },
  benefit: {
    marginBottom: 12,
  },
  benefitText: {
    color: '#4b5563',
    lineHeight: 22,
  },
  bold: {
    fontWeight: 'bold',
    color: '#1f2937',
  },
});

export default LoadingExamples;