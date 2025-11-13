/**
 * Ultra-Smart Image System for Dash
 * 
 * Advanced image loading with intelligent caching, lazy loading,
 * and agentic optimization for maximum performance
 */

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ViewStyle, StyleSheet, Dimensions, StyleProp } from 'react-native';
import { Image, ImageSource, ImageContentFit, ImageTransition, ImageDecodeFormat } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ultraMemo, useSmartMemo, useStableStyles } from '@/lib/smart-memo';
import { mark, measure } from '@/lib/perf';
import { logger } from '@/lib/logger';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SmartImageProps {
  source: ImageSource | string;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  placeholder?: ImageSource | string;
  placeholderContentFit?: ImageContentFit;
  transition?: ImageTransition;
  priority?: 'low' | 'normal' | 'high';
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  allowDownscaling?: boolean;
  decodeFormat?: ImageDecodeFormat;
  recyclingKey?: string;
  onLoad?: () => void;
  onError?: (error: any) => void;
  onLoadStart?: () => void;
  lazy?: boolean;
  blurhash?: string;
  aspectRatio?: number;
  maxWidth?: number;
  maxHeight?: number;
  testID?: string;
}

/**
 * Ultra-optimized image component with intelligent loading
 */
export const SmartImage = ultraMemo<SmartImageProps>(({
  source,
  style,
  contentFit = 'cover',
  placeholder,
  placeholderContentFit = 'cover',
  transition = { duration: 200 },
  priority = 'normal',
  cachePolicy = 'memory-disk',
  allowDownscaling = true,
  decodeFormat,
  recyclingKey,
  onLoad,
  onError,
  onLoadStart,
  lazy = false,
  blurhash,
  aspectRatio,
  maxWidth,
  maxHeight,
  testID,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const loadStartTime = useRef<number | null>(null);

  // Intelligent size optimization
  const optimizedSource = useSmartMemo(() => {
    if (typeof source === 'string') {
      return optimizeImageUrl(source, { maxWidth, maxHeight, allowDownscaling });
    }
    return source;
  }, [source, maxWidth, maxHeight, allowDownscaling], 'image_source_optimization');

  // Stable styles with aspect ratio handling
  const stableStyles = useStableStyles(() => {
    const baseStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
    
    if (aspectRatio && !baseStyle?.height && !baseStyle?.width) {
      const widthNum = typeof baseStyle?.width === 'number' ? baseStyle.width : (maxWidth || screenWidth * 0.8);
      return [
        { width: widthNum, height: (widthNum as number) / (aspectRatio as number) },
        baseStyle,
      ] as any;
    }
    
    return (baseStyle || {}) as any;
  }, [style, aspectRatio, maxWidth]);

  // Performance-tracked load handlers
  const handleLoadStart = useCallback(() => {
    loadStartTime.current = performance.now();
    setIsLoading(true);
    setHasError(false);
    mark('image_load_start');
    onLoadStart?.();
  }, [onLoadStart]);

  const handleLoad = useCallback(() => {
    const duration = loadStartTime.current 
      ? performance.now() - loadStartTime.current 
      : 0;
    
    setIsLoading(false);
    setHasError(false);
    
    if (__DEV__ && duration > 0) {
      logger.debug(`📸 Image loaded in ${duration.toFixed(1)}ms`, { source });
      
      // Agentic optimization suggestions
      if (duration > 1000) {
        logger.warn('🤖 Dash AI: Slow image load detected. Consider:');
        logger.warn('  • Using smaller image dimensions');
        logger.warn('  • Implementing progressive loading');
        logger.warn('  • Pre-caching critical images');
      }
    }
    
    onLoad?.();
  }, [onLoad, source]);

  const handleError = useCallback((error: any) => {
    const duration = loadStartTime.current 
      ? performance.now() - loadStartTime.current 
      : 0;
    
    setIsLoading(false);
    setHasError(true);
    
    logger.warn('Image load failed', { source, error, duration });
    onError?.(error);
  }, [onError, source]);

  // BlurHash placeholder component
  const BlurHashPlaceholder = useSmartMemo(() => {
    if (!blurhash || !isLoading) return null;
    
    return (
      <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
        <LinearGradient
          colors={['#f0f0f0', '#e0e0e0', '#f0f0f0']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </View>
    );
  }, [blurhash, isLoading]);

  return (
    <View style={stableStyles as any} testID={testID}>
      <Image
        source={optimizedSource}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        placeholder={placeholder}
        placeholderContentFit={placeholderContentFit}
        transition={transition}
        priority={priority}
        cachePolicy={cachePolicy}
        allowDownscaling={allowDownscaling}
        decodeFormat={decodeFormat}
        recyclingKey={recyclingKey}
        onLoad={handleLoad}
        onError={handleError}
        onLoadStart={handleLoadStart}
      />
      
      {BlurHashPlaceholder}
      
      {hasError && (
        <View style={[StyleSheet.absoluteFill, styles.errorState]}>
          <LinearGradient
            colors={['#ff6b6b', '#ee5a52']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
    </View>
  );
}, (prev, next) => {
  // Smart comparison for image props
  return (
    prev.source === next.source &&
    prev.style === next.style &&
    prev.contentFit === next.contentFit &&
    prev.blurhash === next.blurhash &&
    prev.aspectRatio === next.aspectRatio &&
    prev.maxWidth === next.maxWidth &&
    prev.maxHeight === next.maxHeight
  );
}, 'SmartImage');

/**
 * Avatar component optimized for user profiles
 */
export const SmartAvatar = ultraMemo<{
  uri?: string;
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  priority?: 'low' | 'normal' | 'high';
  testID?: string;
}>(({
  uri,
  name = '?',
  size = 40,
  style,
  priority = 'high', // Avatars are usually important
  testID,
}) => {
  const avatarStyles = useStableStyles(() => ([
    styles.avatar,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
    style as any,
  ]), [size, style]);

  const fallbackStyles = useStableStyles<ViewStyle>(() => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: getAvatarColor(name),
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle), [size, name]);

  const initials = name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (!uri) {
    return (
      <View style={fallbackStyles} testID={testID}>
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <SmartImage
      source={{ uri }}
      style={avatarStyles}
      contentFit="cover"
      priority={priority}
      cachePolicy="memory-disk"
      maxWidth={size * 2} // 2x for high DPI
      maxHeight={size * 2}
      testID={testID}
    />
  );
}, (prev, next) => (
  prev.uri === next.uri &&
  prev.name === next.name &&
  prev.size === next.size &&
  prev.style === next.style
), 'SmartAvatar');

/**
 * Lesson thumbnail optimized for educational content
 */
export const LessonThumbnail = ultraMemo<{
  uri: string;
  title: string;
  aspectRatio?: number;
  style?: ViewStyle;
  priority?: 'low' | 'normal' | 'high';
  onPress?: () => void;
  testID?: string;
}>(({
  uri,
  title,
  aspectRatio = 16 / 9,
  style,
  priority = 'normal',
  onPress,
  testID,
}) => {
  return (
    <SmartImage
      source={{ uri }}
      style={style}
      contentFit="cover"
      aspectRatio={aspectRatio}
      priority={priority}
      cachePolicy="memory-disk"
      transition={{ duration: 150 }}
      placeholder={require('@/assets/lesson-placeholder.png')}
      maxWidth={400} // Reasonable max for lesson thumbnails
      testID={testID}
    />
  );
}, (prev, next) => (
  prev.uri === next.uri &&
  prev.title === next.title &&
  prev.aspectRatio === next.aspectRatio &&
  prev.style === next.style
), 'LessonThumbnail');

/**
 * Image optimization utilities
 */
function optimizeImageUrl(
  url: string, 
  options: { maxWidth?: number; maxHeight?: number; allowDownscaling?: boolean }
): string {
  const { maxWidth, maxHeight, allowDownscaling } = options;
  
  if (!allowDownscaling || (!maxWidth && !maxHeight)) {
    return url;
  }

  // Add image optimization parameters (adjust based on your CDN/service)
  const separator = url.includes('?') ? '&' : '?';
  const params = [];
  
  if (maxWidth) params.push(`w=${Math.round(maxWidth)}`);
  if (maxHeight) params.push(`h=${Math.round(maxHeight)}`);
  params.push('f=auto'); // Auto format
  params.push('q=80'); // 80% quality
  
  return `${url}${separator}${params.join('&')}`;
}

/**
 * Generate consistent avatar colors based on name
 */
function getAvatarColor(name: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  ];
  
  const hash = name
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return colors[hash % colors.length];
}

/**
 * Pre-load critical images for better UX
 */
export class ImagePreloader {
  private static preloadedImages = new Set<string>();
  
  static async preloadImages(urls: string[]): Promise<void> {
    const newUrls = urls.filter(url => !this.preloadedImages.has(url));
    
    if (newUrls.length === 0) return;
    
    mark('image_preload_batch');
    
    try {
      await Promise.allSettled(
        newUrls.map(async (url) => {
          await Image.prefetch(url);
          this.preloadedImages.add(url);
        })
      );
      
      const { duration } = measure('image_preload_batch');
      
      if (__DEV__) {
        logger.debug(`📸 Preloaded ${newUrls.length} images in ${duration.toFixed(1)}ms`);
      }
    } catch (error) {
      logger.warn('Image preload batch failed', error);
    }
  }
  
  static async preloadCriticalAssets(): Promise<void> {
    const criticalAssets = [
      require('@/assets/icon.png'),
      require('@/assets/splash-icon.png'),
      require('@/assets/lesson-placeholder.png'),
      // Add your critical app images here
    ];
    
    await this.preloadImages(criticalAssets.map(asset => asset.uri || asset));
  }
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorState: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ff6b6b',
  },
  avatar: {
    backgroundColor: '#e0e0e0',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SmartImage;