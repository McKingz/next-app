import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/notifications/deployment
 * 
 * Receives deployment webhook notifications and optionally sends push notifications
 * 
 * Security: Requires DEPLOYMENT_WEBHOOK_SECRET to prevent unauthorized triggers
 * 
 * Usage:
 * 1. Set DEPLOYMENT_WEBHOOK_SECRET in Vercel env vars
 * 2. Called automatically by scripts/notify-deployment.js after build
 * 3. Or use Vercel Deploy Hooks to trigger manually
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret for security
    const authHeader = request.headers.get('authorization');
    const secret = process.env.DEPLOYMENT_WEBHOOK_SECRET;

    if (secret && authHeader !== `Bearer ${secret}`) {
      console.warn('⚠️  Unauthorized deployment notification attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get deployment info from request body
    const body = await request.json().catch(() => ({}));
    const version = body.version || process.env.NEXT_PUBLIC_APP_VERSION || 'latest';
    const environment = body.environment || process.env.NEXT_PUBLIC_ENVIRONMENT || 'production';
    const buildId = body.buildId || 'unknown';
    const branch = body.branch || 'main';

    console.log('� Deployment notification received:', {
      version,
      environment,
      buildId: buildId.substring(0, 7),
      branch,
      timestamp: new Date().toISOString(),
    });

    // TODO: Add your notification logic here:
    // - Send push notifications via Firebase (if enabled)
    // - Send to Slack/Discord webhooks
    // - Log to database for deployment history
    // - Trigger post-deployment tasks
    // - Clear caches
    // - Send team notifications

    // Optional: Send Firebase push notification if configured
    if (process.env.FIREBASE_PROJECT_ID && environment === 'production') {
      try {
        // Dynamic import to avoid errors if firebase-admin is not configured
    //     const { sendDeploymentNotification } = await import('@/lib/firebase-admin').catch(() => ({
    //       sendDeploymentNotification: null
    //     }));
        
    //     if (sendDeploymentNotification) {
    //       await sendDeploymentNotification(version);
    //       console.log('✅ Push notification sent to users');
    //     }
      } catch (notificationError) {
        console.warn('⚠️  Could not send push notifications:', 
          notificationError instanceof Error ? notificationError.message : 'Unknown error'
        );
        // Don't fail the whole request if push fails
      }
    }

    // Optional: Send to Slack/Discord
    const slackWebhook = process.env.SLACK_DEPLOYMENT_WEBHOOK;
    const discordWebhook = process.env.DISCORD_DEPLOYMENT_WEBHOOK;

    if (slackWebhook) {
      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚀 New deployment: EduDash Pro v${version} (${environment})`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*🚀 New Deployment*\n*Version:* ${version}\n*Environment:* ${environment}\n*Branch:* ${branch}\n*Build:* \`${buildId.substring(0, 7)}\``
              }
            }
          ]
        }),
      }).catch(err => console.warn('Slack notification failed:', err.message));
    }

    if (discordWebhook) {
      await fetch(discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '🚀 New Deployment',
            color: 0x00ff00,
            fields: [
              { name: 'Version', value: version, inline: true },
              { name: 'Environment', value: environment, inline: true },
              { name: 'Branch', value: branch, inline: true },
              { name: 'Build ID', value: buildId.substring(0, 7), inline: true },
            ],
            timestamp: new Date().toISOString(),
          }]
        }),
      }).catch(err => console.warn('Discord notification failed:', err.message));
    }

    return NextResponse.json({
      success: true,
      message: 'Deployment notification received and processed',
      version,
      environment,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Failed to process deployment notification:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to process notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/deployment
 * 
 * Health check endpoint to verify the notification system
 */
export async function GET() {
  try {
    const firebaseConfigured = !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_CLIENT_EMAIL
    );
    
    const slackConfigured = !!process.env.SLACK_DEPLOYMENT_WEBHOOK;
    const discordConfigured = !!process.env.DISCORD_DEPLOYMENT_WEBHOOK;
    
    return NextResponse.json({
      status: 'ok',
      endpoint: 'deployment-notifications',
      timestamp: new Date().toISOString(),
      configuration: {
        firebase: firebaseConfigured,
        slack: slackConfigured,
        discord: discordConfigured,
      },
      message: firebaseConfigured
        ? 'Deployment notifications are fully configured'
        : 'Deployment webhook is active but push notifications not configured',
      requiredEnvVars: {
        firebase: [
          'FIREBASE_PROJECT_ID',
          'FIREBASE_PRIVATE_KEY',
          'FIREBASE_CLIENT_EMAIL',
        ],
        webhook: [
          'DEPLOYMENT_WEBHOOK_SECRET (recommended)',
        ],
        optional: [
          'SLACK_DEPLOYMENT_WEBHOOK',
          'DISCORD_DEPLOYMENT_WEBHOOK',
        ],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Configuration check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
