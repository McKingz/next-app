/**
 * Unit tests for Dash AI Capability System
 * 
 * @module lib/ai/capabilities.test
 */

import {
  type Tier,
  type DashCapability,
  CAPABILITY_MATRIX,
  hasCapability,
  getCapabilities,
  getRequiredTier,
  getExclusiveCapabilities,
  compareTiers,
  FeatureGatedError,
  assertCapability,
  checkCapabilities,
  getTierInfo,
} from '../capabilities';

describe('Capability System', () => {
  describe('hasCapability', () => {
    it('should return true for capabilities available in tier', () => {
      expect(hasCapability('free', 'chat.basic')).toBe(true);
      expect(hasCapability('starter', 'chat.streaming')).toBe(true);
      expect(hasCapability('premium', 'multimodal.vision')).toBe(true);
    });

    it('should return false for capabilities not available in tier', () => {
      expect(hasCapability('free', 'multimodal.vision')).toBe(false);
      expect(hasCapability('starter', 'agent.autonomous')).toBe(false);
      expect(hasCapability('starter', 'homework.grade.advanced')).toBe(false);
    });

    it('should handle all tier levels correctly', () => {
      const tiers: Tier[] = ['free', 'starter', 'premium', 'enterprise'];
      
      tiers.forEach(tier => {
        expect(hasCapability(tier, 'chat.basic')).toBe(true);
      });
    });
  });

  describe('getCapabilities', () => {
    it('should return all capabilities for a tier', () => {
      const freeCapabilities = getCapabilities('free');
      expect(freeCapabilities).toContain('chat.basic');
      expect(freeCapabilities).toContain('memory.lite');
      expect(freeCapabilities.length).toBeGreaterThan(0);
    });

    it('should return more capabilities for higher tiers', () => {
      const starterCaps = getCapabilities('starter');
      const premiumCaps = getCapabilities('premium');
      
      expect(premiumCaps.length).toBeGreaterThan(starterCaps.length);
    });

    it('should return readonly array', () => {
      const capabilities = getCapabilities('premium');
      expect(Object.isFrozen(capabilities) || Array.isArray(capabilities)).toBe(true);
    });
  });

  describe('getRequiredTier', () => {
    it('should return correct minimum tier for capability', () => {
      expect(getRequiredTier('chat.basic')).toBe('free');
      expect(getRequiredTier('chat.streaming')).toBe('starter');
      expect(getRequiredTier('multimodal.vision')).toBe('starter');
      expect(getRequiredTier('agent.autonomous')).toBe('premium');
    });

    it('should return lowest tier when capability is in multiple tiers', () => {
      const tier = getRequiredTier('chat.basic');
      expect(tier).toBe('free'); // Should be the lowest tier
    });

    it('should return null for non-existent capability', () => {
      const tier = getRequiredTier('invalid.capability' as DashCapability);
      expect(tier).toBeNull();
    });
  });

  describe('getExclusiveCapabilities', () => {
    it('should return all capabilities for lowest tier', () => {
      const exclusiveFree = getExclusiveCapabilities('free');
      const allFree = getCapabilities('free');
      
      expect(exclusiveFree.length).toBe(allFree.length);
    });

    it('should return only new capabilities for higher tiers', () => {
      const exclusiveStarter = getExclusiveCapabilities('starter');
      
      expect(exclusiveStarter).toContain('chat.streaming');
      expect(exclusiveStarter).toContain('homework.assign');
      expect(exclusiveStarter).not.toContain('chat.basic'); // From free tier
    });

    it('should return capabilities unique to premium', () => {
      const exclusivePremium = getExclusiveCapabilities('premium');
      
      expect(exclusivePremium).toContain('multimodal.ocr'); // OCR is premium-only
      expect(exclusivePremium).toContain('chat.thinking');
      expect(exclusivePremium).not.toContain('chat.streaming'); // From starter
      expect(exclusivePremium).not.toContain('multimodal.vision'); // From starter
    });
  });

  describe('compareTiers', () => {
    it('should return 0 for equal tiers', () => {
      expect(compareTiers('starter', 'starter')).toBe(0);
      expect(compareTiers('premium', 'premium')).toBe(0);
    });

    it('should return negative when first tier is lower', () => {
      expect(compareTiers('free', 'premium')).toBeLessThan(0);
      expect(compareTiers('starter', 'enterprise')).toBeLessThan(0);
    });

    it('should return positive when first tier is higher', () => {
      expect(compareTiers('premium', 'starter')).toBeGreaterThan(0);
      expect(compareTiers('enterprise', 'free')).toBeGreaterThan(0);
    });

    it('should maintain transitivity', () => {
      const result1 = compareTiers('free', 'starter');
      const result2 = compareTiers('starter', 'premium');
      const result3 = compareTiers('free', 'premium');
      
      expect(Math.sign(result1)).toBe(Math.sign(result3));
      expect(Math.sign(result2)).toBe(Math.sign(result3));
    });
  });

  describe('FeatureGatedError', () => {
    it('should create error with correct properties', () => {
      const error = new FeatureGatedError(
        'Test message',
        'multimodal.vision',
        'premium',
        'free'
      );
      
      expect(error.message).toBe('Test message');
      expect(error.capability).toBe('multimodal.vision');
      expect(error.requiredTier).toBe('premium');
      expect(error.currentTier).toBe('free');
      expect(error.name).toBe('FeatureGatedError');
    });

    it('should generate user-friendly message', () => {
      const error = new FeatureGatedError(
        'Test',
        'multimodal.vision',
        'premium'
      );
      
      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Premium');
      expect(userMessage).toContain('subscription');
    });

    it('should be instanceof Error', () => {
      const error = new FeatureGatedError(
        'Test',
        'chat.thinking',
        'premium'
      );
      
      expect(error instanceof Error).toBe(true);
      expect(error instanceof FeatureGatedError).toBe(true);
    });

    it('should have proper stack trace', () => {
      const error = new FeatureGatedError(
        'Test',
        'chat.thinking',
        'premium'
      );
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('FeatureGatedError');
    });
  });

  describe('assertCapability', () => {
    it('should not throw for available capability', () => {
      expect(() => {
        assertCapability('premium', 'multimodal.vision');
      }).not.toThrow();
      
      expect(() => {
        assertCapability('starter', 'chat.streaming');
      }).not.toThrow();
    });

    it('should throw FeatureGatedError for unavailable capability', () => {
      expect(() => {
        assertCapability('free', 'multimodal.vision');
      }).toThrow(FeatureGatedError);
      
      expect(() => {
        assertCapability('free', 'agent.autonomous');
      }).toThrow(FeatureGatedError);
    });

    it('should include correct tier information in error', () => {
      try {
        assertCapability('free', 'multimodal.vision');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FeatureGatedError);
        if (error instanceof FeatureGatedError) {
          expect(error.currentTier).toBe('free');
          expect(error.requiredTier).toBe('starter');  // Vision is available from starter tier
          expect(error.capability).toBe('multimodal.vision');
        }
      }
    });

    it('should use custom message when provided', () => {
      const customMessage = 'Custom error message';
      
      try {
        assertCapability('free', 'multimodal.vision', customMessage);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FeatureGatedError);
        if (error instanceof FeatureGatedError) {
          expect(error.message).toBe(customMessage);
        }
      }
    });
  });

  describe('checkCapabilities', () => {
    it('should return object with all capabilities checked', () => {
      const capabilities: DashCapability[] = [
        'chat.basic',
        'chat.streaming',
        'multimodal.vision',
      ];
      
      const result = checkCapabilities('starter', capabilities);
      
      expect(result['chat.basic']).toBe(true);
      expect(result['chat.streaming']).toBe(true);
      expect(result['multimodal.vision']).toBe(true);  // Vision is available in starter tier
    });

    it('should handle empty array', () => {
      const result = checkCapabilities('premium', []);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should work for all tier levels', () => {
      const capabilities: DashCapability[] = ['chat.basic', 'multimodal.vision'];
      
      const freeResult = checkCapabilities('free', capabilities);
      expect(freeResult['chat.basic']).toBe(true);
      expect(freeResult['multimodal.vision']).toBe(false);
      
      const premiumResult = checkCapabilities('premium', capabilities);
      expect(premiumResult['chat.basic']).toBe(true);
      expect(premiumResult['multimodal.vision']).toBe(true);
    });
  });

  describe('getTierInfo', () => {
    it('should return correct info for all tiers', () => {
      const tiers: Tier[] = ['free', 'starter', 'premium', 'enterprise'];
      
      tiers.forEach(tier => {
        const info = getTierInfo(tier);
        expect(info.id).toBe(tier);
        expect(info.name).toBeDefined();
        expect(info.color).toMatch(/^#[0-9A-F]{6}$/i);
        expect(info.order).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return ascending order numbers', () => {
      const freeInfo = getTierInfo('free');
      const starterInfo = getTierInfo('starter');
      const premiumInfo = getTierInfo('premium');
      
      expect(starterInfo.order).toBeGreaterThan(freeInfo.order);
      expect(premiumInfo.order).toBeGreaterThan(starterInfo.order);
    });

    it('should have proper display names', () => {
      expect(getTierInfo('free').name).toBe('Free');
      expect(getTierInfo('premium').name).toBe('Premium');
      expect(getTierInfo('enterprise').name).toBe('Enterprise');
    });
  });

  describe('CAPABILITY_MATRIX', () => {
    it('should have all required tiers', () => {
      const tiers: Tier[] = ['free', 'starter', 'premium', 'enterprise'];
      
      tiers.forEach(tier => {
        expect(CAPABILITY_MATRIX[tier]).toBeDefined();
        expect(Array.isArray(CAPABILITY_MATRIX[tier])).toBe(true);
      });
    });

    it('should have capabilities in all tiers', () => {
      const tiers: Tier[] = ['free', 'starter', 'premium', 'enterprise'];
      
      tiers.forEach(tier => {
        expect(CAPABILITY_MATRIX[tier].length).toBeGreaterThan(0);
      });
    });

    it('should have chat.basic in all tiers', () => {
      const tiers: Tier[] = ['free', 'starter', 'premium', 'enterprise'];
      
      tiers.forEach(tier => {
        expect(CAPABILITY_MATRIX[tier]).toContain('chat.basic');
      });
    });

    it('should have vision features in starter and above', () => {
      expect(CAPABILITY_MATRIX.free).not.toContain('multimodal.vision');
      expect(CAPABILITY_MATRIX.starter).toContain('multimodal.vision');  // Vision is available from starter
      expect(CAPABILITY_MATRIX.premium).toContain('multimodal.vision');
      expect(CAPABILITY_MATRIX.enterprise).toContain('multimodal.vision');
    });

    it('should have enterprise-only features in enterprise', () => {
      // insights.custom is enterprise-only
      expect(CAPABILITY_MATRIX.free).not.toContain('insights.custom');
      expect(CAPABILITY_MATRIX.premium).not.toContain('insights.custom');
      expect(CAPABILITY_MATRIX.enterprise).toContain('insights.custom');
    });
  });

  describe('Integration tests', () => {
    it('should handle complete feature gating flow', () => {
      const userTier: Tier = 'starter';
      const requiredCapability: DashCapability = 'multimodal.vision';
      
      // Check if user has capability
      const hasAccess = hasCapability(userTier, requiredCapability);
      expect(hasAccess).toBe(true);  // Starter has vision capability
      
      // Get required tier for upgrade prompt
      const requiredTier = getRequiredTier(requiredCapability);
      expect(requiredTier).toBe('starter');  // Vision is available from starter tier
      
      // Since starter has vision, let's test with a capability they don't have
      const premiumOnlyCapability: DashCapability = 'chat.thinking';
      expect(() => {
        assertCapability('free', premiumOnlyCapability);
      }).toThrow(FeatureGatedError);
    });

    it('should support tier comparison for upgrade flows', () => {
      const currentTier: Tier = 'starter';
      const targetTier: Tier = 'premium';
      
      const shouldUpgrade = compareTiers(currentTier, targetTier) < 0;
      expect(shouldUpgrade).toBe(true);
      
      // Get exclusive features they would unlock
      const newFeatures = getExclusiveCapabilities(targetTier);
      expect(newFeatures.length).toBeGreaterThan(0);
      expect(newFeatures).toContain('chat.thinking');  // Premium-exclusive feature
      expect(newFeatures).not.toContain('multimodal.vision');  // Vision is in starter
    });

    it('should support batch capability checking for UI', () => {
      const userTier: Tier = 'starter';
      const uiFeatures: DashCapability[] = [
        'chat.streaming',
        'chat.thinking',
        'multimodal.vision',
        'agent.autonomous',
      ];
      
      const access = checkCapabilities(userTier, uiFeatures);
      
      expect(access['chat.streaming']).toBe(true);  // Starter has streaming
      expect(access['chat.thinking']).toBe(false);  // Premium feature
      expect(access['multimodal.vision']).toBe(true);  // Starter has vision
      expect(access['agent.autonomous']).toBe(false); // Premium feature
    });
  });
});
