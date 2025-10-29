import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Test endpoint to check Stripe configuration
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const envVars = {
    hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
    hasFirebaseClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasFirebasePrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    
    priceIds: {
      basicMonthly: process.env.VITE_STRIPE_BASIC_MONTHLY || process.env.STRIPE_BASIC_MONTHLY || 'NOT SET',
      basicYearly: process.env.VITE_STRIPE_BASIC_YEARLY || process.env.STRIPE_BASIC_YEARLY || 'NOT SET',
      proMonthly: process.env.VITE_STRIPE_PRO_MONTHLY || process.env.STRIPE_PRO_MONTHLY || 'NOT SET',
      proYearly: process.env.VITE_STRIPE_PRO_YEARLY || process.env.STRIPE_PRO_YEARLY || 'NOT SET',
      ultraMonthly: process.env.VITE_STRIPE_ULTRA_MONTHLY || process.env.STRIPE_ULTRA_MONTHLY || 'NOT SET',
      ultraYearly: process.env.VITE_STRIPE_ULTRA_YEARLY || process.env.STRIPE_ULTRA_YEARLY || 'NOT SET',
    }
  };

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: envVars,
    webhookUrl: `${req.headers.host}/api/stripe-webhook`,
    message: 'Stripe configuration check'
  });
}

