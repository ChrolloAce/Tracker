import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  updateDoc,
  collectionGroup
} from 'firebase/firestore';
import { db } from './firebase';
import { TeamInvitation, Role } from '../types/firestore';

/**
 * TeamInvitationService - Manages team invitations
 */
class TeamInvitationService {
  
  /**
   * Create a new invitation
   */
  static async createInvitation(
    orgId: string,
    email: string,
    role: Role,
    invitedBy: string,
    invitedByName: string,
    invitedByEmail: string,
    organizationName: string
  ): Promise<string> {
    // Check if user is already a member
    const existingMembers = await getDocs(
      collection(db, 'organizations', orgId, 'members')
    );
    
    for (const memberDoc of existingMembers.docs) {
      const memberData = memberDoc.data();
      if (memberData.email?.toLowerCase() === email.toLowerCase() && memberData.status === 'active') {
        throw new Error('This user is already a member of the organization');
      }
    }
    
    // Check if there's already a pending invitation
    const existingInvites = await getDocs(
      query(
        collection(db, 'organizations', orgId, 'invitations'),
        where('email', '==', email.toLowerCase()),
        where('status', '==', 'pending')
      )
    );
    
    if (!existingInvites.empty) {
      throw new Error('An invitation has already been sent to this email');
    }
    
    // Create invitation
    const inviteRef = doc(collection(db, 'organizations', orgId, 'invitations'));
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
    
    const inviteData: TeamInvitation = {
      id: inviteRef.id,
      orgId,
      email: email.toLowerCase(),
      role,
      status: 'pending',
      invitedBy,
      invitedByName,
      invitedByEmail,
      organizationName,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt)
    };
    
    await setDoc(inviteRef, inviteData);
    console.log(`✅ Created invitation for ${email}`);
    return inviteRef.id;
  }
  
  /**
   * Get pending invitations for an organization
   */
  static async getOrgInvitations(orgId: string): Promise<TeamInvitation[]> {
    const invitesSnapshot = await getDocs(
      query(
        collection(db, 'organizations', orgId, 'invitations'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      )
    );
    
    return invitesSnapshot.docs.map(doc => doc.data() as TeamInvitation);
  }
  
  /**
   * Get pending invitations for a user (by email)
   */
  static async getUserInvitations(email: string): Promise<TeamInvitation[]> {
    const normalizedEmail = email.toLowerCase();
    
    // Use collection group query to search across all organizations
    const invitesQuery = query(
      collectionGroup(db, 'invitations'),
      where('email', '==', normalizedEmail),
      where('status', '==', 'pending')
    );
    
    const invitesSnapshot = await getDocs(invitesQuery);
    const userInvitations: TeamInvitation[] = [];
    
    for (const inviteDoc of invitesSnapshot.docs) {
      const invite = inviteDoc.data() as TeamInvitation;
      
      // Check if invitation has expired
      const now = new Date();
      const expiresAt = invite.expiresAt.toDate();
      
      if (expiresAt < now) {
        // Mark as expired
        await updateDoc(inviteDoc.ref, {
          status: 'expired'
        });
      } else {
        userInvitations.push(invite);
      }
    }
    
    return userInvitations;
  }
  
  /**
   * Accept an invitation
   */
  static async acceptInvitation(
    invitationId: string, 
    orgId: string, 
    userId: string,
    email: string,
    displayName?: string
  ): Promise<void> {
    const batch = writeBatch(db);
    
    // Get invitation
    const inviteRef = doc(db, 'organizations', orgId, 'invitations', invitationId);
    const inviteDoc = await getDoc(inviteRef);
    
    if (!inviteDoc.exists()) {
      throw new Error('Invitation not found');
    }
    
    const invite = inviteDoc.data() as TeamInvitation;
    
    if (invite.status !== 'pending') {
      throw new Error('This invitation is no longer valid');
    }
    
    // Check if expired
    const now = new Date();
    if (invite.expiresAt.toDate() < now) {
      batch.update(inviteRef, { status: 'expired' });
      await batch.commit();
      throw new Error('This invitation has expired');
    }
    
    // Update invitation status
    batch.update(inviteRef, { 
      status: 'accepted',
      acceptedAt: Timestamp.now()
    });
    
    // Add user as member with email and displayName
    const memberRef = doc(db, 'organizations', orgId, 'members', userId);
    batch.set(memberRef, {
      userId,
      role: invite.role,
      joinedAt: Timestamp.now(),
      status: 'active',
      invitedBy: invite.invitedBy,
      email: email,
      displayName: displayName || email.split('@')[0]
    });
    
    // Set this org as the user's default org (switch to it)
    const userRef = doc(db, 'users', userId);
    batch.update(userRef, { defaultOrgId: orgId });
    
    await batch.commit();
    console.log(`✅ User ${userId} accepted invitation to org ${orgId} and set as default`);
  }
  
  /**
   * Decline an invitation
   */
  static async declineInvitation(invitationId: string, orgId: string): Promise<void> {
    const inviteRef = doc(db, 'organizations', orgId, 'invitations', invitationId);
    await updateDoc(inviteRef, {
      status: 'declined',
      declinedAt: Timestamp.now()
    });
    console.log(`✅ Invitation ${invitationId} declined`);
  }
  
  /**
   * Cancel/revoke an invitation
   */
  static async cancelInvitation(invitationId: string, orgId: string): Promise<void> {
    const inviteRef = doc(db, 'organizations', orgId, 'invitations', invitationId);
    await updateDoc(inviteRef, {
      status: 'expired'
    });
    console.log(`✅ Invitation ${invitationId} cancelled`);
  }
}

export default TeamInvitationService;

