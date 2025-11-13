import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import ProfileImageService from '@/services/ProfileImageService';

export function Avatar({ name, imageUri, size = 48 }: { name: string; imageUri?: string | null; size?: number }) {
  const [displayUri, setDisplayUri] = useState<string | null>(imageUri || null);
  
  const initials = (name || '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Convert local image URIs to data URIs for web compatibility
  useEffect(() => {
    const convertImageUri = async () => {
      if (imageUri) {
        try {
          // Only convert for web platform and local URIs
          if (Platform.OS === 'web' && (imageUri.startsWith('blob:') || imageUri.startsWith('file:'))) {
            const dataUri = await ProfileImageService.convertToDataUri(imageUri);
            setDisplayUri(dataUri);
          } else {
            // For mobile or remote URIs, use the original URI
            setDisplayUri(imageUri);
          }
        } catch (error) {
          console.error('Failed to convert avatar URI:', error);
          setDisplayUri(null); // Fallback to initials
        }
      } else {
        setDisplayUri(null);
      }
    };
    
    convertImageUri();
  }, [imageUri]);

  if (displayUri) {
    return <Image source={{ uri: displayUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}> 
      <Text style={{ color: '#000', fontWeight: '800', fontSize: Math.max(12, size * 0.4) }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#00f5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

