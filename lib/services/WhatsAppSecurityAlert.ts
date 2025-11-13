/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * WhatsApp Security Alert Service
 * 
 * TEMPORARY replacement for WhatsAppBusinessService to prevent security vulnerability
 * where client-side code exposed API credentials via EXPO_PUBLIC_* environment variables
 * 
 * This service prevents any WhatsApp messaging while we implement server-side Edge Functions
 */

import { track } from '@/lib/analytics';

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  appId: string;
  appSecret: string;
  webhookVerifyToken: string;
  baseUrl: string;
  version: string;
  enableTemplateMessages: boolean;
  enableMediaMessages: boolean;
  enableInteractiveMessages: boolean;
}

export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template' | 'interactive' | 'media';
  text?: { body: string; preview_url?: boolean };
  template?: any;
  interactive?: any;
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  rateLimitRemaining?: number;
}

class WhatsAppSecurityAlert {
  private readonly SECURITY_ERROR = 'WhatsApp integration temporarily disabled due to security vulnerability. Credentials were exposed client-side via EXPO_PUBLIC environment variables. Integration will be restored via secure server-side Edge Functions.';

  constructor() {
    this.logSecurityAlert();
  }

  private logSecurityAlert(): void {
    // Track security event for monitoring
    track('edudash.security.whatsapp_disabled', {
      reason: 'client_credentials_exposed',
      timestamp: new Date().toISOString(),
      mitigation: 'server_side_edge_functions_required'
    });
  }

  // All methods now return security errors instead of executing
  
  async sendTextMessage(to: string, message: string): Promise<WhatsAppResponse> {
    this.logSecurityAlert();
    return {
      success: false,
      error: this.SECURITY_ERROR
    };
  }

  async sendTemplateMessage(
    to: string, 
    templateName: string, 
    languageCode: string = 'en',
    parameters: Array<{ text: string }> = []
  ): Promise<WhatsAppResponse> {
    this.logSecurityAlert();
    return {
      success: false,
      error: this.SECURITY_ERROR
    };
  }

  async sendButtonMessage(
    to: string,
    headerText: string,
    bodyText: string,
    footerText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<WhatsAppResponse> {
    this.logSecurityAlert();
    return {
      success: false,
      error: this.SECURITY_ERROR
    };
  }

  verifyWebhook(signature: string, body: string): boolean {
    this.logSecurityAlert();
    return false; // Always reject during security lockdown
  }

  getStatus() {
    return {
      isConfigured: false,
      securityLockdown: true,
      error: this.SECURITY_ERROR,
      features: {
        templates: false,
        media: false,
        interactive: false,
      },
      phoneNumberId: 'REDACTED_FOR_SECURITY',
      version: 'DISABLED',
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    this.logSecurityAlert();
    return {
      success: false,
      error: this.SECURITY_ERROR
    };
  }
}

// Export singleton instance that blocks all operations
export const whatsAppService = new WhatsAppSecurityAlert();

// Types are defined above; re-export removed to avoid duplicate declarations

export default WhatsAppSecurityAlert;