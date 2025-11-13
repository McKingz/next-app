/**
 * WhatsApp Business API Service
 * 
 * Real-world implementation for WhatsApp Business API integration
 * Supports both Cloud API and On-Premise solutions
 */

import { track } from '@/lib/analytics';

interface WhatsAppConfig {
  // WhatsApp Business Cloud API configuration
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  appId: string;
  appSecret: string;
  webhookVerifyToken: string;
  
  // API endpoints
  baseUrl: string;
  version: string;
  
  // Features
  enableTemplateMessages: boolean;
  enableMediaMessages: boolean;
  enableInteractiveMessages: boolean;
}

interface WhatsAppMessage {
  to: string; // Phone number in international format
  type: 'text' | 'template' | 'interactive' | 'media';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: 'header' | 'body' | 'footer' | 'button';
      parameters?: Array<{
        type: 'text' | 'currency' | 'date_time';
        text?: string;
        currency?: {
          fallback_value: string;
          code: string;
          amount_1000: number;
        };
        date_time?: {
          fallback_value: string;
        };
      }>;
    }>;
  };
  interactive?: {
    type: 'button' | 'list';
    header?: {
      type: 'text';
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: any;
  };
}

interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  rateLimitRemaining?: number;
}

class WhatsAppBusinessService {
  private config: WhatsAppConfig;
  private isConfigured = false;

  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  private loadConfiguration(): WhatsAppConfig {
    return {
      accessToken: process.env.EXPO_PUBLIC_WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: process.env.EXPO_PUBLIC_WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: process.env.EXPO_PUBLIC_WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      appId: process.env.EXPO_PUBLIC_WHATSAPP_APP_ID || '',
      appSecret: process.env.EXPO_PUBLIC_WHATSAPP_APP_SECRET || '',
      webhookVerifyToken: process.env.EXPO_PUBLIC_WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
      
      // Default to WhatsApp Business Cloud API
      baseUrl: process.env.EXPO_PUBLIC_WHATSAPP_BASE_URL || 'https://graph.facebook.com',
      version: process.env.EXPO_PUBLIC_WHATSAPP_API_VERSION || 'v18.0',
      
      // Feature flags
      enableTemplateMessages: process.env.EXPO_PUBLIC_WHATSAPP_ENABLE_TEMPLATES !== 'false',
      enableMediaMessages: process.env.EXPO_PUBLIC_WHATSAPP_ENABLE_MEDIA !== 'false',
      enableInteractiveMessages: process.env.EXPO_PUBLIC_WHATSAPP_ENABLE_INTERACTIVE !== 'false',
    };
  }

  private validateConfiguration(): void {
    const requiredFields = ['accessToken', 'phoneNumberId', 'businessAccountId'];
    const missingFields = requiredFields.filter(field => !this.config[field as keyof WhatsAppConfig]);
    
    if (missingFields.length > 0) {
      console.warn(`WhatsApp Business API: Missing required configuration fields: ${missingFields.join(', ')}`);
      this.isConfigured = false;
      return;
    }

    this.isConfigured = true;
    console.log('✅ WhatsApp Business API configured successfully');
  }

  /**
   * Send a simple text message
   */
  async sendTextMessage(to: string, message: string): Promise<WhatsAppResponse> {
    if (!this.isConfigured) {
      return { success: false, error: 'WhatsApp API not configured' };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(to);
      
      const messageData: WhatsAppMessage = {
        to: formattedPhone,
        type: 'text',
        text: {
          body: message,
          preview_url: true,
        },
      };

      const response = await this.sendMessage(messageData);
      
      track('edudash.whatsapp.text_message_sent', {
        success: response.success,
        messageLength: message.length,
        recipientCountryCode: this.getCountryCode(formattedPhone),
      });

      return response;
    } catch (error) {
      console.error('Error sending WhatsApp text message:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send a template message (pre-approved by WhatsApp)
   */
  async sendTemplateMessage(
    to: string, 
    templateName: string, 
    languageCode: string = 'en',
    parameters: Array<{ text: string }> = []
  ): Promise<WhatsAppResponse> {
    if (!this.isConfigured) {
      return { success: false, error: 'WhatsApp API not configured' };
    }

    if (!this.config.enableTemplateMessages) {
      return { success: false, error: 'Template messages are disabled' };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(to);
      
      const messageData: WhatsAppMessage = {
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
          components: parameters.length > 0 ? [{
            type: 'body',
            parameters: parameters.map(param => ({
              type: 'text',
              text: param.text,
            })),
          }] : undefined,
        },
      };

      const response = await this.sendMessage(messageData);
      
      track('edudash.whatsapp.template_message_sent', {
        success: response.success,
        templateName,
        languageCode,
        parametersCount: parameters.length,
      });

      return response;
    } catch (error) {
      console.error('Error sending WhatsApp template message:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send an interactive button message
   */
  async sendButtonMessage(
    to: string,
    headerText: string,
    bodyText: string,
    footerText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<WhatsAppResponse> {
    if (!this.isConfigured || !this.config.enableInteractiveMessages) {
      return { success: false, error: 'Interactive messages not available' };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(to);
      
      const messageData: WhatsAppMessage = {
        to: formattedPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          header: {
            type: 'text',
            text: headerText,
          },
          body: {
            text: bodyText,
          },
          footer: {
            text: footerText,
          },
          action: {
            buttons: buttons.map(btn => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title,
              },
            })),
          },
        },
      };

      const response = await this.sendMessage(messageData);
      
      track('edudash.whatsapp.button_message_sent', {
        success: response.success,
        buttonsCount: buttons.length,
      });

      return response;
    } catch (error) {
      console.error('Error sending WhatsApp button message:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Core method to send messages via WhatsApp Business API
   */
  private async sendMessage(messageData: WhatsAppMessage): Promise<WhatsAppResponse> {
    const url = `${this.config.baseUrl}/${this.config.version}/${this.config.phoneNumberId}/messages`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('WhatsApp API Error:', data);
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        rateLimitRemaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
      };
    } catch (error) {
      console.error('Network error sending WhatsApp message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Format phone number to international format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If it starts with 0, assume it's a local South African number
    if (cleaned.startsWith('0')) {
      cleaned = '27' + cleaned.substring(1);
    }
    
    // If it doesn't start with country code, assume South Africa
    if (!cleaned.startsWith('27') && cleaned.length === 9) {
      cleaned = '27' + cleaned;
    }

    return cleaned;
  }

  /**
   * Extract country code from phone number
   */
  private getCountryCode(phone: string): string {
    if (phone.startsWith('27')) return 'ZA';
    if (phone.startsWith('1')) return 'US';
    if (phone.startsWith('44')) return 'GB';
    return 'UNKNOWN';
  }

  /**
   * Verify webhook signature (for incoming messages)
   */
  verifyWebhook(signature: string, body: string): boolean {
    if (!this.config.appSecret) {
      console.warn('WhatsApp webhook verification failed: No app secret configured');
      return false;
    }

    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.config.appSecret)
        .update(body)
        .digest('hex');

      return signature === `sha256=${expectedSignature}`;
    } catch (error) {
      console.error('Webhook verification error:', error);
      return false;
    }
  }

  /**
   * Get service status and configuration info
   */
  getStatus() {
    return {
      isConfigured: this.isConfigured,
      features: {
        templates: this.config.enableTemplateMessages,
        media: this.config.enableMediaMessages,
        interactive: this.config.enableInteractiveMessages,
      },
      phoneNumberId: this.config.phoneNumberId,
      version: this.config.version,
    };
  }

  /**
   * Test the WhatsApp Business API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      return { success: false, error: 'Service not configured' };
    }

    try {
      const url = `${this.config.baseUrl}/${this.config.version}/${this.config.phoneNumberId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('WhatsApp Business API test successful:', data);
        return { success: true };
      } else {
        const errorData = await response.json();
        return { 
          success: false, 
          error: errorData.error?.message || `HTTP ${response.status}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }
}

// Export singleton instance
export const whatsAppService = new WhatsAppBusinessService();

// Export types for external use
export type { WhatsAppConfig, WhatsAppMessage, WhatsAppResponse };

export default WhatsAppBusinessService;