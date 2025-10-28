/**
 * Apple App Store Service - Handles App Store Server API integration
 * 
 * Integrates with:
 * - App Store Server API for subscription status and transaction history
 * - App Store Server Notifications V2 for real-time updates
 * 
 * Documentation: https://developer.apple.com/documentation/appstoreserverapi
 */

import { RevenueTransaction, AppleSubscription, AppleTransaction } from '../types/revenue';

interface AppleCredentials {
  privateKey: string; // The .p8 key file content (base64 encoded for storage)
  keyId: string; // Key ID from App Store Connect
  issuerId: string; // Issuer ID from App Store Connect
  bundleId: string; // Your app's bundle ID (e.g., com.yourapp.bundle)
}

/**
 * Apple App Store Service for managing subscriptions and transactions
 * All API calls are handled via serverless functions to avoid CORS issues
 */
class AppleAppStoreService {

  /**
   * Test Apple App Store credentials
   */
  static async testConnection(credentials: AppleCredentials, useSandbox = true): Promise<boolean> {
    try {
      // Call serverless function to test connection (avoids CORS issues)
      const response = await fetch('/api/apple-test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          privateKey: credentials.privateKey,
          keyId: credentials.keyId,
          issuerId: credentials.issuerId,
          bundleId: credentials.bundleId,
          useSandbox,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Apple connection test failed:', data.error, data.details);
        return false;
      }

      console.log('✅ Apple connection test successful:', data.message);
      return data.success;
    } catch (error) {
      console.error('❌ Apple connection test failed:', error);
      return false;
    }
  }

  /**
   * Fetch all transactions for a period
   */
  static async fetchTransactions(
    credentials: AppleCredentials,
    startDate: Date,
    endDate: Date,
    useSandbox = false
  ): Promise<AppleTransaction[]> {
    try {
      // Call serverless function to fetch transactions (avoids CORS issues)
      const response = await fetch('/api/apple-fetch-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          privateKey: credentials.privateKey,
          keyId: credentials.keyId,
          issuerId: credentials.issuerId,
          bundleId: credentials.bundleId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          useSandbox,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to fetch transactions');
      }

      const data = await response.json();
      
      if (!data.success || !data.transactions) {
        throw new Error('Invalid response from Apple transactions API');
      }

      console.log(`✅ Received ${data.transactions.length} transactions from Apple`);
      
      // Parse and filter transactions by date range
      const parsedTransactions = await this.parseTransactions(data.transactions, startDate, endDate);
      
      return parsedTransactions;
    } catch (error) {
      console.error('❌ Failed to fetch Apple transactions:', error);
      throw error;
    }
  }

  /**
   * Get active subscriptions
   */
  static async getActiveSubscriptions(
    credentials: AppleCredentials,
    useSandbox = false
  ): Promise<AppleSubscription[]> {
    try {
      // const token = await this.generateJWT(credentials);
      // const baseUrl = useSandbox ? this.SANDBOX_BASE_URL : this.PRODUCTION_BASE_URL;
      
      // This would need to be implemented based on your specific needs
      // You'd typically call /inApps/v1/subscriptions/{transactionId}
      
      console.log('📱 Fetching active Apple subscriptions...', useSandbox ? 'sandbox' : 'production', credentials.bundleId);
      
      // Placeholder - implement based on your app's subscription flow
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch Apple subscriptions:', error);
      throw error;
    }
  }

  /**
   * Convert Apple transactions to RevenueTransaction format
   */
  static convertToRevenueTransactions(
    appleTransactions: AppleTransaction[],
    orgId: string,
    projectId: string
  ): RevenueTransaction[] {
    return appleTransactions.map(transaction => {
      const isRenewal = transaction.type === 'auto-renewable-subscription';
      const isTrial = transaction.offerType === 'introductory';
      
      let type: RevenueTransaction['type'] = 'purchase';
      if (isRenewal) type = 'renewal';
      if (isTrial) type = 'trial';
      if (transaction.revocationDate) type = 'refund';
      
      let status: RevenueTransaction['status'] = 'active';
      if (transaction.revocationDate) status = 'refunded';
      else if (transaction.expiresDate && transaction.expiresDate < new Date()) status = 'expired';

      return {
        id: transaction.transactionId,
        organizationId: orgId,
        projectId,
        provider: 'apple',
        platform: 'ios',
        transactionId: transaction.transactionId,
        customerId: transaction.originalTransactionId,
        amount: transaction.price ? Math.round(transaction.price * 100) : 0,
        currency: transaction.currency || 'USD',
        netAmount: transaction.price ? Math.round(transaction.price * 0.7 * 100) : 0, // ~70% after Apple's cut
        productId: transaction.productId,
        productName: transaction.productId,
        purchaseDate: transaction.purchaseDate,
        expirationDate: transaction.expiresDate,
        refundDate: transaction.revocationDate,
        type,
        status,
        isRenewal,
        isTrial,
        metadata: {
          webOrderLineItemId: transaction.webOrderLineItemId,
          subscriptionGroupId: transaction.subscriptionGroupId,
          offerType: transaction.offerType,
          isUpgraded: transaction.isUpgraded
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
  }

  /**
   * Parse transactions from Apple API response
   */
  private static async parseTransactions(
    rawTransactions: any[],
    startDate: Date,
    endDate: Date
  ): Promise<AppleTransaction[]> {
    const transactions: AppleTransaction[] = [];

    for (const rawTx of rawTransactions) {
      try {
        // Decode the signed transaction (JWS format)
        // In production, verify the signature
        const decoded = this.decodeJWS(rawTx);
        
        const purchaseDate = new Date(decoded.purchaseDate);
        
        // Filter by date range
        if (purchaseDate >= startDate && purchaseDate <= endDate) {
          transactions.push({
            transactionId: decoded.transactionId,
            originalTransactionId: decoded.originalTransactionId,
            productId: decoded.productId,
            purchaseDate,
            expiresDate: decoded.expiresDate ? new Date(decoded.expiresDate) : undefined,
            quantity: decoded.quantity || 1,
            type: decoded.type,
            price: decoded.price,
            currency: decoded.currency,
            subscriptionGroupId: decoded.subscriptionGroupIdentifier,
            webOrderLineItemId: decoded.webOrderLineItemId,
            isUpgraded: decoded.isUpgraded,
            revocationDate: decoded.revocationDate ? new Date(decoded.revocationDate) : undefined,
            revocationReason: decoded.revocationReason,
            offerType: decoded.offerType
          });
        }
      } catch (error) {
        console.error('Failed to parse transaction:', error);
      }
    }

    return transactions;
  }

  /**
   * Decode JWS (JSON Web Signature) from Apple
   * Note: In production, you must verify the signature
   */
  private static decodeJWS(jws: string): any {
    try {
      // JWS format: header.payload.signature
      const parts = jws.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWS format');
      }

      // Decode the payload (base64url)
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Failed to decode JWS:', error);
      throw error;
    }
  }

  /**
   * Verify webhook notification from Apple
   */
  static async verifyNotification(signedPayload: string): Promise<boolean> {
    // In production, verify the signature using Apple's root certificate
    // Documentation: https://developer.apple.com/documentation/appstoreservernotifications/jwsdecodedheader
    
    console.warn('⚠️ Apple notification verification should be implemented for production');
    
    try {
      const decoded = this.decodeJWS(signedPayload);
      return !!decoded;
    } catch {
      return false;
    }
  }

  /**
   * Parse Apple Server Notification
   */
  static parseNotification(signedPayload: string): any {
    try {
      return this.decodeJWS(signedPayload);
    } catch (error) {
      console.error('Failed to parse Apple notification:', error);
      throw error;
    }
  }
}

export default AppleAppStoreService;

