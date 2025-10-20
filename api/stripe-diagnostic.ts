import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

/**
 * Stripe Integration Diagnostic Tool
 * Checks all environment variables, connections, and configuration
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development',
    checks: {} as Record<string, any>,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };

  // Helper function to add check results
  const addCheck = (name: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any) => {
    diagnostics.checks[name] = { status, message, details };
    diagnostics.summary.total++;
    if (status === 'pass') diagnostics.summary.passed++;
    if (status === 'fail') diagnostics.summary.failed++;
    if (status === 'warning') diagnostics.summary.warnings++;
  };

  // 1. Check Stripe Secret Key
  if (process.env.STRIPE_SECRET_KEY) {
    const key = process.env.STRIPE_SECRET_KEY;
    const isTest = key.startsWith('sk_test_');
    const isLive = key.startsWith('sk_live_');
    
    if (isTest || isLive) {
      addCheck('stripe_secret_key', 'pass', `Stripe ${isTest ? 'Test' : 'Live'} key configured`, {
        keyType: isTest ? 'test' : 'live',
        keyPrefix: key.substring(0, 12) + '...'
      });
      
      // Try to initialize Stripe
      try {
        const stripe = new Stripe(key, { apiVersion: '2024-11-20.acacia' });
        const balance = await stripe.balance.retrieve();
        addCheck('stripe_connection', 'pass', 'Successfully connected to Stripe API', {
          currency: balance.available[0]?.currency || 'N/A'
        });
      } catch (error: any) {
        addCheck('stripe_connection', 'fail', 'Failed to connect to Stripe API', {
          error: error.message
        });
      }
    } else {
      addCheck('stripe_secret_key', 'fail', 'Invalid Stripe secret key format');
    }
  } else {
    addCheck('stripe_secret_key', 'fail', 'STRIPE_SECRET_KEY not set');
  }

  // 2. Check Webhook Secret
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (secret.startsWith('whsec_')) {
      addCheck('webhook_secret', 'pass', 'Webhook secret configured', {
        secretPrefix: secret.substring(0, 12) + '...'
      });
    } else {
      addCheck('webhook_secret', 'warning', 'Webhook secret may be invalid (should start with whsec_)');
    }
  } else {
    addCheck('webhook_secret', 'fail', 'STRIPE_WEBHOOK_SECRET not set');
  }

  // 3. Check Publishable Key
  if (process.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    const key = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (key.startsWith('pk_test_') || key.startsWith('pk_live_')) {
      addCheck('publishable_key', 'pass', 'Publishable key configured');
    } else {
      addCheck('publishable_key', 'fail', 'Invalid publishable key format');
    }
  } else {
    addCheck('publishable_key', 'warning', 'VITE_STRIPE_PUBLISHABLE_KEY not set (needed for frontend)');
  }

  // 4. Check Price IDs
  const plans = ['basic', 'pro', 'ultra'];
  const cycles = ['monthly', 'yearly'];
  const missingPrices: string[] = [];
  const configuredPrices: string[] = [];

  plans.forEach(plan => {
    cycles.forEach(cycle => {
      const envKey = `VITE_STRIPE_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
      const altKey = `STRIPE_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
      
      if (process.env[envKey] || process.env[altKey]) {
        configuredPrices.push(`${plan}_${cycle}`);
      } else {
        missingPrices.push(envKey);
      }
    });
  });

  if (missingPrices.length === 0) {
    addCheck('price_ids', 'pass', 'All price IDs configured', {
      configured: configuredPrices
    });
  } else if (configuredPrices.length > 0) {
    addCheck('price_ids', 'warning', 'Some price IDs missing', {
      configured: configuredPrices,
      missing: missingPrices
    });
  } else {
    addCheck('price_ids', 'fail', 'No price IDs configured', {
      missing: missingPrices
    });
  }

  // 5. Check Base URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  
  if (baseUrl) {
    addCheck('base_url', 'pass', 'Base URL configured', { url: baseUrl });
  } else {
    addCheck('base_url', 'warning', 'No base URL configured (may default to localhost)');
  }

  // 6. Check Firebase Configuration
  const firebaseChecks = {
    projectId: !!process.env.FIREBASE_PROJECT_ID,
    clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: !!process.env.FIREBASE_PRIVATE_KEY
  };

  if (Object.values(firebaseChecks).every(v => v)) {
    addCheck('firebase_config', 'pass', 'Firebase Admin configured');
  } else {
    addCheck('firebase_config', 'fail', 'Firebase Admin incomplete', {
      missing: Object.entries(firebaseChecks)
        .filter(([_, v]) => !v)
        .map(([k]) => k)
    });
  }

  // 7. Test Stripe Products (if connected)
  if (diagnostics.checks.stripe_connection?.status === 'pass' && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' });
      const products = await stripe.products.list({ limit: 10 });
      const prices = await stripe.prices.list({ limit: 20 });
      
      addCheck('stripe_products', 'pass', `Found ${products.data.length} products and ${prices.data.length} prices`, {
        products: products.data.map(p => ({
          id: p.id,
          name: p.name,
          active: p.active
        })),
        prices: prices.data.map(p => ({
          id: p.id,
          product: typeof p.product === 'string' ? p.product : p.product?.name,
          amount: p.unit_amount ? p.unit_amount / 100 : 0,
          currency: p.currency,
          interval: p.recurring?.interval
        }))
      });
    } catch (error: any) {
      addCheck('stripe_products', 'warning', 'Could not fetch Stripe products', {
        error: error.message
      });
    }
  }

  // 8. Test Webhook Endpoint (check if it's accessible)
  if (baseUrl) {
    try {
      const webhookUrl = `${baseUrl}/api/stripe-webhook`;
      addCheck('webhook_endpoint', 'pass', 'Webhook endpoint URL constructed', {
        url: webhookUrl,
        note: 'Configure this URL in Stripe Dashboard'
      });
    } catch (error) {
      addCheck('webhook_endpoint', 'warning', 'Could not construct webhook URL');
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (diagnostics.checks.stripe_secret_key?.status !== 'pass') {
    recommendations.push('🔴 Add STRIPE_SECRET_KEY from https://dashboard.stripe.com/apikeys');
  }
  
  if (diagnostics.checks.webhook_secret?.status !== 'pass') {
    recommendations.push('🔴 Create webhook endpoint in Stripe Dashboard and add STRIPE_WEBHOOK_SECRET');
  }
  
  if (diagnostics.checks.price_ids?.status !== 'pass') {
    recommendations.push('🟡 Create products and prices in Stripe Dashboard, then add price IDs to environment variables');
  }
  
  if (diagnostics.summary.failed === 0 && diagnostics.summary.warnings === 0) {
    recommendations.push('✅ All checks passed! Your Stripe integration is fully configured.');
  }

  // Build response
  return res.status(200).json({
    status: diagnostics.summary.failed > 0 ? 'incomplete' : 
            diagnostics.summary.warnings > 0 ? 'partial' : 'ready',
    diagnostics,
    recommendations,
    nextSteps: [
      '1. Fix any failed checks above',
      '2. Review STRIPE_INTEGRATION_COMPLETE_GUIDE.md for detailed setup',
      '3. Test checkout flow with test card: 4242 4242 4242 4242',
      '4. Verify webhook events are being received',
      '5. Check Firestore for subscription data after test purchase'
    ]
  });
}

