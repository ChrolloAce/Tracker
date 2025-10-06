import { db } from './firebase';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, orderBy, Timestamp, getDocs, deleteDoc } from 'firebase/firestore';

export interface TrackingJob {
  id: string;
  orgId: string;
  projectId: string;
  userId: string;
  username: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  accountType: 'my' | 'competitor';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  accountId?: string;
  error?: string;
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  retryCount: number;
}

/**
 * TrackingJobService
 * 
 * Manages background tracking jobs for accounts
 * Jobs are processed by serverless functions
 */
class TrackingJobService {
  
  /**
   * Create a new tracking job
   * This queues the account to be tracked in the background
   */
  static async createJob(
    orgId: string,
    projectId: string,
    userId: string,
    username: string,
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
    accountType: 'my' | 'competitor' = 'my'
  ): Promise<string> {
    try {
      const jobData = {
        orgId,
        projectId,
        userId,
        username,
        platform,
        accountType,
        status: 'pending' as const,
        progress: 0,
        message: 'Waiting to start...',
        createdAt: Timestamp.now(),
        retryCount: 0
      };

      const jobRef = await addDoc(collection(db, 'trackingJobs'), jobData);
      
      console.log(`✅ Created tracking job ${jobRef.id} for @${username}`);
      
      // Trigger the processor immediately (don't wait for cron)
      this.triggerProcessor().catch(err => {
        console.warn('Failed to trigger processor immediately:', err);
      });

      return jobRef.id;
    } catch (error) {
      console.error('Failed to create tracking job:', error);
      throw error;
    }
  }

  /**
   * Get a specific job by ID
   */
  static async getJob(jobId: string): Promise<TrackingJob | null> {
    try {
      const jobDoc = await getDocs(
        query(collection(db, 'trackingJobs'), where('__name__', '==', jobId))
      );

      if (jobDoc.empty) return null;

      const data = jobDoc.docs[0].data();
      return {
        id: jobDoc.docs[0].id,
        ...data
      } as TrackingJob;
    } catch (error) {
      console.error('Failed to get job:', error);
      return null;
    }
  }

  /**
   * Get all jobs for a project
   */
  static async getProjectJobs(
    orgId: string,
    projectId: string
  ): Promise<TrackingJob[]> {
    try {
      const jobsQuery = query(
        collection(db, 'trackingJobs'),
        where('orgId', '==', orgId),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(jobsQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrackingJob[];
    } catch (error) {
      console.error('Failed to get project jobs:', error);
      return [];
    }
  }

  /**
   * Listen to real-time updates for a specific job
   */
  static watchJob(
    jobId: string,
    onUpdate: (job: TrackingJob) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const jobRef = doc(db, 'trackingJobs', jobId);
      
      const unsubscribe = onSnapshot(
        jobRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const job = {
              id: snapshot.id,
              ...snapshot.data()
            } as TrackingJob;
            onUpdate(job);
          }
        },
        (error) => {
          console.error('Error watching job:', error);
          onError?.(error);
        }
      );

      return unsubscribe;
    } catch (error: any) {
      console.error('Failed to watch job:', error);
      onError?.(error);
      return () => {};
    }
  }

  /**
   * Listen to all jobs for a project in real-time
   */
  static watchProjectJobs(
    orgId: string,
    projectId: string,
    onUpdate: (jobs: TrackingJob[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const jobsQuery = query(
        collection(db, 'trackingJobs'),
        where('orgId', '==', orgId),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        jobsQuery,
        (snapshot) => {
          const jobs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as TrackingJob[];
          onUpdate(jobs);
        },
        (error) => {
          console.error('Error watching project jobs:', error);
          onError?.(error);
        }
      );

      return unsubscribe;
    } catch (error: any) {
      console.error('Failed to watch project jobs:', error);
      onError?.(error);
      return () => {};
    }
  }

  /**
   * Cancel a pending job
   */
  static async cancelJob(jobId: string): Promise<void> {
    try {
      const jobRef = doc(db, 'trackingJobs', jobId);
      await updateDoc(jobRef, {
        status: 'failed',
        message: 'Cancelled by user',
        completedAt: Timestamp.now()
      });
      
      console.log(`✅ Cancelled job ${jobId}`);
    } catch (error) {
      console.error('Failed to cancel job:', error);
      throw error;
    }
  }

  /**
   * Retry a failed job
   */
  static async retryJob(jobId: string): Promise<void> {
    try {
      const jobRef = doc(db, 'trackingJobs', jobId);
      await updateDoc(jobRef, {
        status: 'pending',
        progress: 0,
        message: 'Retrying...',
        error: null,
        retryCount: 0
      });
      
      console.log(`✅ Retrying job ${jobId}`);
      
      // Trigger processor
      await this.triggerProcessor();
    } catch (error) {
      console.error('Failed to retry job:', error);
      throw error;
    }
  }

  /**
   * Manually trigger the job processor
   * This calls the serverless function to process pending jobs
   */
  static async triggerProcessor(): Promise<void> {
    try {
      const response = await fetch('/api/trigger-tracking-processor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: process.env.VITE_CRON_SECRET
        })
      });

      if (!response.ok) {
        console.warn('Failed to trigger processor:', await response.text());
      }
    } catch (error) {
      console.warn('Failed to trigger processor:', error);
      // Don't throw - this is a best-effort call
    }
  }

  /**
   * Clean up old completed/failed jobs (admin function)
   */
  static async cleanupOldJobs(daysOld: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      const oldJobsQuery = query(
        collection(db, 'trackingJobs'),
        where('status', 'in', ['completed', 'failed']),
        where('completedAt', '<', cutoffTimestamp)
      );

      const snapshot = await getDocs(oldJobsQuery);
      
      const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);

      console.log(`✅ Cleaned up ${snapshot.size} old jobs`);
      return snapshot.size;
    } catch (error) {
      console.error('Failed to cleanup old jobs:', error);
      return 0;
    }
  }
}

export default TrackingJobService;
