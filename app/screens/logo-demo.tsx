/**
 * Logo Demo Screen
 * 
 * This screen showcases all EduDash Pro logo variants and sizes.
 * Useful for testing logo rendering and brand consistency.
 * 
 * Navigate to: /screens/logo-demo
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Logo } from '@/components/branding';
import type { LogoVariant, LogoSize } from '@/components/branding';

export default function LogoDemoScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [selectedVariant, setSelectedVariant] = useState<LogoVariant>('horizontal');
  const [selectedSize, setSelectedSize] = useState<LogoSize>('md');
  const [showMonochrome, setShowMonochrome] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const [darkBackground, setDarkBackground] = useState(false);
  
  const variants: LogoVariant[] = ['icon-only', 'text-only', 'horizontal', 'stacked'];
  const sizes: LogoSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  
  const backgroundColor = darkBackground ? '#0a0a0f' : '#ffffff';
  const textColor = darkBackground ? '#ffffff' : '#111827';
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top', 'left', 'right']}>
      <Stack.Screen 
        options={{
          title: 'Logo Demo',
          headerStyle: { backgroundColor },
          headerTintColor: textColor,
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Display Area */}
        <View style={styles.displayArea}>
          <Text style={[styles.displayLabel, { color: textColor }]}>
            Current Preview
          </Text>
          <View style={styles.logoDisplay}>
            <Logo 
              variant={selectedVariant}
              size={selectedSize}
              monochrome={showMonochrome}
              monochromeColor={darkBackground ? '#ffffff' : '#111827'}
              showTagline={showTagline && selectedVariant === 'stacked'}
            />
          </View>
          
          <Text style={[styles.specs, { color: textColor }]}>
            Variant: {selectedVariant} • Size: {selectedSize}
            {showMonochrome && ' • Monochrome'}
            {showTagline && selectedVariant === 'stacked' && ' • With tagline'}
          </Text>
        </View>
        
        {/* Variant Selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Variant</Text>
          <View style={styles.buttonGroup}>
            {variants.map((variant) => (
              <TouchableOpacity
                key={variant}
                style={[
                  styles.button,
                  selectedVariant === variant && styles.buttonActive,
                  { borderColor: darkBackground ? '#ffffff40' : '#11182740' }
                ]}
                onPress={() => setSelectedVariant(variant)}
              >
                <Text style={[
                  styles.buttonText,
                  { color: selectedVariant === variant ? '#ffffff' : textColor },
                  selectedVariant === variant && styles.buttonTextActive
                ]}>
                  {variant}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Size Selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Size</Text>
          <View style={styles.buttonGroup}>
            {sizes.map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.button,
                  styles.buttonSmall,
                  selectedSize === size && styles.buttonActive,
                  { borderColor: darkBackground ? '#ffffff40' : '#11182740' }
                ]}
                onPress={() => setSelectedSize(size)}
              >
                <Text style={[
                  styles.buttonText,
                  { color: selectedSize === size ? '#ffffff' : textColor },
                  selectedSize === size && styles.buttonTextActive
                ]}>
                  {size.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Options */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Options</Text>
          <View style={styles.optionsGroup}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                showMonochrome && styles.optionButtonActive,
                { borderColor: darkBackground ? '#ffffff40' : '#11182740' }
              ]}
              onPress={() => setShowMonochrome(!showMonochrome)}
            >
              <Text style={[
                styles.optionButtonText,
                { color: showMonochrome ? '#ffffff' : textColor },
                showMonochrome && styles.buttonTextActive
              ]}>
                {showMonochrome ? '✓ ' : ''}Monochrome
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.optionButton,
                darkBackground && styles.optionButtonActive,
                { borderColor: darkBackground ? '#ffffff40' : '#11182740' }
              ]}
              onPress={() => setDarkBackground(!darkBackground)}
            >
              <Text style={[
                styles.optionButtonText,
                { color: darkBackground ? '#ffffff' : textColor },
                darkBackground && styles.buttonTextActive
              ]}>
                {darkBackground ? '✓ ' : ''}Dark Background
              </Text>
            </TouchableOpacity>
            
            {selectedVariant === 'stacked' && (
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  showTagline && styles.optionButtonActive,
                  { borderColor: darkBackground ? '#ffffff40' : '#11182740' }
                ]}
                onPress={() => setShowTagline(!showTagline)}
              >
                <Text style={[
                  styles.optionButtonText,
                  { color: showTagline ? '#ffffff' : textColor },
                  showTagline && styles.buttonTextActive
                ]}>
                  {showTagline ? '✓ ' : ''}Show Tagline
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Usage Example */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Usage Example</Text>
          <View style={[styles.codeBlock, { backgroundColor: darkBackground ? '#1a1a1f' : '#f3f4f6' }]}>
            <Text style={[styles.codeText, { color: textColor }]}>
              {'<Logo'}
              {'\n  '}variant="{selectedVariant}"
              {'\n  '}size="{selectedSize}"
              {showMonochrome && '\n  monochrome'}
              {showMonochrome && `\n  monochromeColor="${darkBackground ? '#ffffff' : '#111827'}"`}
              {showTagline && selectedVariant === 'stacked' && '\n  showTagline'}
              {'\n/>'}
            </Text>
          </View>
        </View>
        
        {/* All Sizes Preview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>All Sizes ({selectedVariant})</Text>
          <View style={styles.sizesPreview}>
            {sizes.map((size) => (
              <View key={size} style={styles.sizePreviewItem}>
                <Logo 
                  variant={selectedVariant}
                  size={size}
                  monochrome={showMonochrome}
                  monochromeColor={darkBackground ? '#ffffff' : '#111827'}
                />
                <Text style={[styles.sizeLabel, { color: textColor }]}>{size}</Text>
              </View>
            ))}
          </View>
        </View>
        
        {/* Brand Colors Reference */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Brand Colors</Text>
          <View style={styles.colorsGrid}>
            <ColorSwatch color="#33C3D4" label="Turquoise" dark={darkBackground} />
            <ColorSwatch color="#1E6FBF" label="Blue" dark={darkBackground} />
            <ColorSwatch color="#7B3FF2" label="Purple" dark={darkBackground} />
            <ColorSwatch color="#9B5FF2" label="Purple Light" dark={darkBackground} />
            <ColorSwatch color="#FF4D8F" label="Pink" dark={darkBackground} />
            <ColorSwatch color="#FF8C5F" label="Coral" dark={darkBackground} />
            <ColorSwatch color="#FFD54D" label="Yellow" dark={darkBackground} />
            <ColorSwatch color="#6B7280" label="Gray" dark={darkBackground} />
          </View>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const ColorSwatch = ({ color, label, dark }: { color: string; label: string; dark: boolean }) => (
  <View style={styles.colorSwatch}>
    <View style={[styles.colorBox, { backgroundColor: color }]} />
    <Text style={[styles.colorLabel, { color: dark ? '#ffffff' : '#111827' }]}>{label}</Text>
    <Text style={[styles.colorHex, { color: dark ? '#ffffff80' : '#11182780' }]}>{color}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  displayArea: {
    alignItems: 'center',
    paddingVertical: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 24,
  },
  displayLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  logoDisplay: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  specs: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  buttonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonActive: {
    backgroundColor: '#7B3FF2',
    borderColor: '#7B3FF2',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  buttonTextActive: {
    color: '#ffffff',
  },
  optionsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  optionButtonActive: {
    backgroundColor: '#33C3D4',
    borderColor: '#33C3D4',
  },
  optionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  codeBlock: {
    padding: 16,
    borderRadius: 8,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 20,
  },
  sizesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    justifyContent: 'space-around',
  },
  sizePreviewItem: {
    alignItems: 'center',
    gap: 8,
  },
  sizeLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  colorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorSwatch: {
    alignItems: 'center',
    width: 70,
  },
  colorBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginBottom: 6,
  },
  colorLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  colorHex: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
});
