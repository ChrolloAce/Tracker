import { PlanTier } from '../types/subscription';

/**
 * Stripe service for handling payments
 */
class StripeService {
  
  /**
   * Create a checkout session and redirect to Stripe
   */
  static async createCheckoutSession(
    orgId: string,
    planTier: PlanTier,
    billingCycle: 'monthly' | 'yearly'
  ): Promise<void> {
    try {
      // Call your API to create a checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId,
          planTier,
          billingCycle,
        }),
      });

      const data = await response.json();

      // Check if the response was successful
      if (!response.ok) {
        console.error('API Error Response:', data);
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a portal session for managing subscription
   */
  static async createPortalSession(orgId: string): Promise<void> {
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orgId }),
      });

      const data = await response.json();

      // Check if the response was successful
      if (!response.ok) {
        console.error('API Error Response:', data);
        throw new Error(data.error || `Server error: ${response.status}`);
      }
      
      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
  }
}

export default StripeService;

