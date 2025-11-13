import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Avatar } from '@/components/ui/Avatar';
import { testimonialsContent } from '@/constants/marketing';
import { marketingTokens } from '../tokens';
import { Section } from '../Section';
import { SectionHeader } from '../SectionHeader';
import { GlassCard } from '../GlassCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TestimonialsSectionProps {
  columns: number;
}

export function TestimonialsSection({ columns }: TestimonialsSectionProps) {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  // Auto-advance carousel
  useEffect(() => {
    if (columns === 1) {
      const interval = setInterval(() => {
        const nextIndex = (activeTestimonial + 1) % testimonialsContent.length;
        setActiveTestimonial(nextIndex);
        
        // Scroll to next card
        scrollViewRef.current?.scrollTo({
          x: nextIndex * SCREEN_WIDTH,
          animated: true,
        });
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTestimonial, columns]);

  // Handle scroll position
  const handleScroll = (event: any) => {
    if (columns === 1) {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index !== activeTestimonial) {
        setActiveTestimonial(index);
      }
    }
  };

  return (
    <Section style={styles.section}>
      <SectionHeader
        overline="Testimonials"
        title="Loved by Educators"
        subtitle="Trusted by preschools across South Africa"
      />

      {/* Mobile: Horizontal scroll */}
      {columns === 1 ? (
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH}
          snapToAlignment="center"
        >
          {testimonialsContent.map((testimonial, index) => (
            <View key={testimonial.name || index} style={{ width: SCREEN_WIDTH, paddingHorizontal: 16 }}>
              <TestimonialCard
                testimonial={testimonial}
                width="100%"
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        /* Desktop: Grid layout */
        <View style={[styles.grid, { gap: columns > 1 ? 20 : 16 }]}>
          {testimonialsContent.slice(0, 3).map((testimonial, index) => (
            <TestimonialCard
              key={testimonial.name || index}
              testimonial={testimonial}
              width={columns === 2 ? '48%' : '31%'}
            />
          ))}
        </View>
      )}

      {/* Dots for mobile carousel */}
      {columns === 1 && (
        <View style={styles.dots}>
          {testimonialsContent.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => setActiveTestimonial(index)}
              style={[
                styles.dot,
                index === activeTestimonial && styles.activeDot,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`View testimonial ${index + 1}`}
            />
          ))}
        </View>
      )}
    </Section>
  );
}

interface TestimonialCardProps {
  testimonial: typeof testimonialsContent[0];
  width: string;
}

function TestimonialCard({ testimonial, width }: TestimonialCardProps) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(scale.value, { duration: 120 }) }],
  }));

  return (
    <Animated.View style={[styles.cardWrapper, { width }, animatedStyle]}>
      <Pressable
        onPressIn={() => { scale.value = 0.98; }}
        onPressOut={() => { scale.value = 1; }}
      >
        <GlassCard intensity="medium" style={styles.card}>
          {/* Quote icon */}
          <IconSymbol 
            name="quote.opening" 
            size={32} 
            color={marketingTokens.colors.accent.cyan400}
            style={styles.quoteIcon}
          />

          {/* Message */}
          <Text style={styles.message}>"{testimonial.message}"</Text>

          {/* Author info */}
          <View style={styles.author}>
            <Avatar 
              name={testimonial.name}
              imageUri={testimonial.imageUri}
              size={44}
            />
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{testimonial.name}</Text>
              <Text style={styles.authorRole}>{testimonial.role}</Text>
              <Text style={styles.authorOrg}>{testimonial.org}</Text>
            </View>
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: marketingTokens.colors.bg.elevated,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardWrapper: {
    marginBottom: marketingTokens.spacing.lg,
  },
  card: {
    minHeight: 200,
  },
  quoteIcon: {
    marginBottom: marketingTokens.spacing.md,
    opacity: 0.6,
  },
  message: {
    ...marketingTokens.typography.body,
    color: marketingTokens.colors.fg.primary,
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: marketingTokens.spacing.xl,
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: marketingTokens.spacing.md,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    ...marketingTokens.typography.body,
    fontWeight: '700',
    color: marketingTokens.colors.fg.primary,
    marginBottom: 2,
  },
  authorRole: {
    ...marketingTokens.typography.caption,
    color: marketingTokens.colors.accent.cyan400,
    fontWeight: '600',
    marginBottom: 2,
  },
  authorOrg: {
    ...marketingTokens.typography.caption,
    fontSize: 12,
    color: marketingTokens.colors.fg.tertiary,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: marketingTokens.spacing.sm,
    marginTop: marketingTokens.spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: marketingTokens.colors.stroke.medium,
  },
  activeDot: {
    backgroundColor: marketingTokens.colors.accent.cyan400,
    width: 24,
  },
});
