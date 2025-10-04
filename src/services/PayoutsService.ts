import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  getDoc,
  updateDoc,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from './firebase';
import { Payout, PayoutStatus } from '../types/firestore';

/**
 * PayoutsService
 * Manages creator payouts and earnings
 */
class PayoutsService {
  /**
   * Create a new payout record
   */
  static async createPayout(
    orgId: string,
    creatorId: string,
    payoutData: {
      periodStart: Date;
      periodEnd: Date;
      accountIds: string[];
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares?: number;
      eligibleMetric: number;
      amount: number;
      currency: string;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
      rateDescription?: string;
    },
    createdBy: string
  ): Promise<string> {
    const payoutsRef = collection(
      db, 
      'organizations', 
      orgId, 
      'creators', 
      creatorId, 
      'payouts'
    );

    const payout: Omit<Payout, 'id'> = {
      orgId,
      creatorId,
      periodStart: Timestamp.fromDate(payoutData.periodStart),
      periodEnd: Timestamp.fromDate(payoutData.periodEnd),
      accountIds: payoutData.accountIds,
      totalViews: payoutData.totalViews,
      totalLikes: payoutData.totalLikes,
      totalComments: payoutData.totalComments,
      totalShares: payoutData.totalShares,
      eligibleMetric: payoutData.eligibleMetric,
      amount: payoutData.amount,
      currency: payoutData.currency,
      status: 'pending',
      paymentMethod: payoutData.paymentMethod,
      reference: payoutData.reference,
      notes: payoutData.notes,
      rateDescription: payoutData.rateDescription,
      createdAt: Timestamp.now(),
      createdBy,
    };

    const docRef = await addDoc(payoutsRef, payout);

    // Update creator's total earnings (if status is paid)
    // For now, earnings will be updated when payout is marked as paid

    return docRef.id;
  }

  /**
   * Get all payouts for a creator
   */
  static async getCreatorPayouts(
    orgId: string,
    creatorId: string,
    limitCount?: number
  ): Promise<Payout[]> {
    const payoutsRef = collection(
      db, 
      'organizations', 
      orgId, 
      'creators', 
      creatorId, 
      'payouts'
    );

    let q = query(payoutsRef, orderBy('periodEnd', 'desc'));
    
    if (limitCount) {
      q = query(q, firestoreLimit(limitCount));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Payout[];
  }

  /**
   * Get payouts by status
   */
  static async getPayoutsByStatus(
    orgId: string,
    creatorId: string,
    status: PayoutStatus
  ): Promise<Payout[]> {
    const payoutsRef = collection(
      db, 
      'organizations', 
      orgId, 
      'creators', 
      creatorId, 
      'payouts'
    );

    const q = query(
      payoutsRef,
      where('status', '==', status),
      orderBy('periodEnd', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Payout[];
  }

  /**
   * Update payout status
   */
  static async updatePayoutStatus(
    orgId: string,
    creatorId: string,
    payoutId: string,
    status: PayoutStatus,
    reference?: string
  ): Promise<void> {
    const payoutRef = doc(
      db, 
      'organizations', 
      orgId, 
      'creators', 
      creatorId, 
      'payouts', 
      payoutId
    );

    const updates: any = { status };

    if (status === 'paid') {
      updates.paidAt = Timestamp.now();
      
      if (reference) {
        updates.reference = reference;
      }

      // Update creator's total earnings and last payout date
      const payoutDoc = await getDoc(payoutRef);
      if (payoutDoc.exists()) {
        const payoutData = payoutDoc.data() as Payout;
        const creatorRef = doc(db, 'organizations', orgId, 'creators', creatorId);
        const creatorDoc = await getDoc(creatorRef);
        
        if (creatorDoc.exists()) {
          const currentEarnings = creatorDoc.data().totalEarnings || 0;
          await updateDoc(creatorRef, {
            totalEarnings: currentEarnings + payoutData.amount,
            lastPayoutAt: Timestamp.now(),
          });
        }
      }
    }

    await updateDoc(payoutRef, updates);
  }

  /**
   * Get a specific payout
   */
  static async getPayout(
    orgId: string,
    creatorId: string,
    payoutId: string
  ): Promise<Payout | null> {
    const payoutRef = doc(
      db, 
      'organizations', 
      orgId, 
      'creators', 
      creatorId, 
      'payouts', 
      payoutId
    );

    const payoutDoc = await getDoc(payoutRef);
    
    if (!payoutDoc.exists()) {
      return null;
    }

    return {
      id: payoutDoc.id,
      ...payoutDoc.data(),
    } as Payout;
  }

  /**
   * Get all pending payouts for an organization (admin view)
   */
  static async getAllPendingPayouts(orgId: string): Promise<Array<Payout & { creatorName: string }>> {
    // This requires a collection group query
    // For simplicity, we'll need to query each creator's payouts
    // In production, consider using a collection group query or aggregation

    const creatorsRef = collection(db, 'organizations', orgId, 'creators');
    const creatorsSnapshot = await getDocs(creatorsRef);
    
    const allPayouts: Array<Payout & { creatorName: string }> = [];

    for (const creatorDoc of creatorsSnapshot.docs) {
      const creatorData = creatorDoc.data();
      const payoutsRef = collection(
        db, 
        'organizations', 
        orgId, 
        'creators', 
        creatorDoc.id, 
        'payouts'
      );

      const q = query(
        payoutsRef,
        where('status', '==', 'pending'),
        orderBy('periodEnd', 'desc')
      );

      const payoutsSnapshot = await getDocs(q);
      
      payoutsSnapshot.docs.forEach(payoutDoc => {
        allPayouts.push({
          id: payoutDoc.id,
          ...payoutDoc.data(),
          creatorName: creatorData.displayName || creatorData.email,
        } as Payout & { creatorName: string });
      });
    }

    return allPayouts.sort((a, b) => 
      b.periodEnd.toMillis() - a.periodEnd.toMillis()
    );
  }

  /**
   * Get payout summary for a creator
   */
  static async getPayoutSummary(
    orgId: string,
    creatorId: string
  ): Promise<{
    totalPaid: number;
    totalPending: number;
    payoutCount: number;
    lastPayoutDate?: Date;
  }> {
    const payoutsRef = collection(
      db, 
      'organizations', 
      orgId, 
      'creators', 
      creatorId, 
      'payouts'
    );

    const snapshot = await getDocs(payoutsRef);
    const payouts = snapshot.docs.map(doc => doc.data() as Payout);

    const totalPaid = payouts
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPending = payouts
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);

    const paidPayouts = payouts.filter(p => p.status === 'paid');
    const lastPayoutDate = paidPayouts.length > 0
      ? paidPayouts.sort((a, b) => b.paidAt!.toMillis() - a.paidAt!.toMillis())[0].paidAt?.toDate()
      : undefined;

    return {
      totalPaid,
      totalPending,
      payoutCount: payouts.length,
      lastPayoutDate,
    };
  }

  /**
   * Update payout details
   */
  static async updatePayout(
    orgId: string,
    creatorId: string,
    payoutId: string,
    updates: Partial<Pick<Payout, 'amount' | 'notes' | 'reference' | 'paymentMethod' | 'rateDescription'>>
  ): Promise<void> {
    const payoutRef = doc(
      db, 
      'organizations', 
      orgId, 
      'creators', 
      creatorId, 
      'payouts', 
      payoutId
    );

    await updateDoc(payoutRef, updates);
  }

  /**
   * Delete a payout (only if pending)
   */
  static async deletePayout(
    orgId: string,
    creatorId: string,
    payoutId: string
  ): Promise<void> {
    const payoutRef = doc(
      db, 
      'organizations', 
      orgId, 
      'creators', 
      creatorId, 
      'payouts', 
      payoutId
    );

    const payoutDoc = await getDoc(payoutRef);
    
    if (!payoutDoc.exists()) {
      throw new Error('Payout not found');
    }

    const payout = payoutDoc.data() as Payout;
    
    if (payout.status !== 'pending') {
      throw new Error('Can only delete pending payouts');
    }

    await updateDoc(payoutRef, { status: 'failed' as PayoutStatus });
  }
}

export default PayoutsService;

