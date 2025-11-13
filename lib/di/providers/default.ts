// Default providers for DI (non-invasive scaffolding)

import { TOKENS, type OrganizationService, type FeatureFlagService } from '../types';
import { container } from '../container';
import { getOrganizationDisplayName, mapTerm as mapOrgTerm, getDynamicGreeting, getRoleCapabilities } from '../../organization';

class OrganizationServiceImpl implements OrganizationService {
  getDisplayName(type: string): string {
    return getOrganizationDisplayName(type as any);
  }
  mapTerm(term: string, type: string): string {
    return mapOrgTerm(term as any, type as any);
  }
  getGreeting(type: string, role: string, userName?: string): string {
    return getDynamicGreeting(type as any, role, userName);
  }
  getCapabilities(type: string, role: string): string[] {
    return getRoleCapabilities(type as any, role);
  }
}

class FeatureFlagServiceImpl implements FeatureFlagService {
  isEnabled(flag: string): boolean {
    // Minimal default: read boolean-like env, fallback to false
    const val = (process.env?.[flag] ?? process.env?.[`EXPO_PUBLIC_${flag}`]) as string | undefined;
    if (val === undefined) return false;
    return ['1', 'true', 'yes', 'on'].includes(String(val).toLowerCase());
  }
}

// Register defaults (safe: no side effects until resolved)
import { StorageAdapter } from '../adapters/storage';
import { AuthAdapter } from '../adapters/auth';
import { AIProxyAdapter } from '../adapters/ai';
import { EventBusService } from '../../../services/EventBus';
import { MemoryServiceClass } from '../../../services/MemoryService';
import { LessonsService } from '../../../services/LessonsService';
import { SMSService } from '../../../services/SMSService';
import { GoogleCalendarService } from '../../../services/GoogleCalendarService';
import { DashTaskAutomation } from '../../../services/DashTaskAutomation';
import { DashDecisionEngine } from '../../../services/DashDecisionEngine';
import { DashNavigationHandler } from '../../../services/DashNavigationHandler';
import { DashWebSearchService } from '../../../services/DashWebSearchService';
import { SemanticMemoryEngine } from '../../../services/SemanticMemoryEngine';
import { DashProactiveEngine } from '../../../services/DashProactiveEngine';
import { DashDiagnosticEngine } from '../../../services/DashDiagnosticEngine';
import { DashAIAssistant } from '../../../services/dash-ai/DashAICompat';
import { DashWhatsAppIntegration } from '../../../services/DashWhatsAppIntegration';
import { DashContextAnalyzer } from '../../../services/DashContextAnalyzer';
import { DashRealTimeAwareness } from '../../../services/DashRealTimeAwareness';
import { DashAgenticEngine } from '../../../services/DashAgenticEngine';
import { AgentOrchestratorClass } from '../../../services/AgentOrchestrator';

container
  .registerFactory(TOKENS.organization, () => new OrganizationServiceImpl(), { singleton: true })
  .registerFactory(TOKENS.features, () => new FeatureFlagServiceImpl(), { singleton: true })
  .registerFactory(TOKENS.storage, () => new StorageAdapter(), { singleton: true })
  .registerFactory(TOKENS.auth, () => new AuthAdapter(), { singleton: true })
  .registerFactory(TOKENS.ai, () => new AIProxyAdapter(), { singleton: true })
  .registerFactory(TOKENS.eventBus, () => new EventBusService(), { singleton: true })
  .registerFactory(TOKENS.memory, () => new MemoryServiceClass(), { singleton: true })
  .registerFactory(TOKENS.lessons, () => new LessonsService(), { singleton: true })
  .registerFactory(TOKENS.sms, () => new SMSService(), { singleton: true })
  .registerFactory(TOKENS.googleCalendar, () => new GoogleCalendarService(), { singleton: true })
  .registerFactory(TOKENS.dashTaskAutomation, () => new DashTaskAutomation(), { singleton: true })
  .registerFactory(TOKENS.dashDecisionEngine, () => new DashDecisionEngine(), { singleton: true })
  .registerFactory(TOKENS.dashNavigation, () => new DashNavigationHandler(), { singleton: true })
  .registerFactory(TOKENS.dashWebSearch, () => new DashWebSearchService(), { singleton: true })
  .registerFactory(TOKENS.semanticMemory, () => new SemanticMemoryEngine(), { singleton: true })
  .registerFactory(TOKENS.dashProactive, () => new DashProactiveEngine(), { singleton: true })
  .registerFactory(TOKENS.dashDiagnostic, () => new DashDiagnosticEngine(), { singleton: true })
  .registerFactory(TOKENS.dashAI, () => DashAIAssistant.getInstance() as any, { singleton: true })
  .registerFactory(TOKENS.dashWhatsApp, () => new DashWhatsAppIntegration(), { singleton: true })
  .registerFactory(TOKENS.dashContextAnalyzer, () => new DashContextAnalyzer(), { singleton: true })
  .registerFactory(TOKENS.dashRealTimeAwareness, () => new DashRealTimeAwareness(), { singleton: true })
  .registerFactory(TOKENS.dashAgenticEngine, () => new DashAgenticEngine(), { singleton: true })
  .registerFactory(TOKENS.agentOrchestrator, () => new AgentOrchestratorClass(), { singleton: true });

export { container, TOKENS };
