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
import { TeamInvitation, Role, Creator } from '../types/firestore';
import EmailService from './EmailService';

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
    organizationName: string,
    projectId?: string // Optional: For adding creators to specific project
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
      expiresAt: Timestamp.fromDate(expiresAt),
      ...(projectId && { projectId }) // Include projectId if provided
    };
    
    await setDoc(inviteRef, inviteData);
    console.log(`✅ Created invitation for ${email}`);
    
    // Send email notification
    try {
      const inviteLink = `${window.location.origin}/invitations/${inviteRef.id}`;
      
      console.log(`📤 Attempting to send invitation email to ${email}...`);
      console.log(`🔗 Invitation link: ${inviteLink}`);
      
      if (role === 'creator' && projectId) {
        // Send creator invitation email
        console.log(`🎨 Sending creator invitation...`);
        const result = await EmailService.sendCreatorInvitation({
          to: email,
          inviterName: invitedByName,
          organizationName: organizationName,
          projectName: organizationName, // You might want to pass actual project name
          inviteLink: inviteLink
        });
        
        if (result.success) {
          console.log(`✅ 📧 Successfully sent creator invitation email to ${email}`);
          console.log(`📬 Email ID: ${result.emailId}`);
        } else {
          console.error(`❌ Failed to send creator invitation email to ${email}`);
          console.error(`Error details:`, result.error || result.message);
          console.error(`Full response:`, result);
        }
      } else {
        // Send team member invitation email
        console.log(`👥 Sending team member invitation (role: ${role})...`);
        const result = await EmailService.sendTeamInvitation({
          to: email,
          inviterName: invitedByName,
          organizationName: organizationName,
          role: role,
          inviteLink: inviteLink
        });
        
        if (result.success) {
          console.log(`✅ 📧 Successfully sent team invitation email to ${email}`);
          console.log(`📬 Email ID: ${result.emailId}`);
        } else {
          console.error(`❌ Failed to send team invitation email to ${email}`);
          console.error(`Error details:`, result.error || result.message);
          console.error(`Full response:`, result);
        }
      }
    } catch (emailError) {
      // Don't fail invitation creation if email fails
      console.error(`🚨 Exception while sending invitation email to ${email}:`);
      console.error(emailError);
      if (emailError instanceof Error) {
        console.error(`Error message: ${emailError.message}`);
        console.error(`Error stack:`, emailError.stack);
      }
    }
    
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
    console.log(`🔍 Attempting to accept invitation:`, { invitationId, orgId, userId, email });
    
    try {
      // Get invitation
      const inviteRef = doc(db, 'organizations', orgId, 'invitations', invitationId);
      const inviteDoc = await getDoc(inviteRef);
      
      console.log(`📧 Invitation doc exists:`, inviteDoc.exists());
      
      if (!inviteDoc.exists()) {
        throw new Error('Invitation not found. It may have already been accepted or deleted.');
      }
      
      const invite = inviteDoc.data() as TeamInvitation;
      console.log(`📋 Invitation status:`, invite.status);
      console.log(`📋 Invitation email:`, invite.email);
      console.log(`📋 Your email:`, email);
      
      if (invite.status !== 'pending') {
        throw new Error(`This invitation is ${invite.status}. Only pending invitations can be accepted.`);
      }
      
      // Verify email matches (case-insensitive)
      if (invite.email.toLowerCase() !== email.toLowerCase()) {
        throw new Error(`This invitation is for ${invite.email}, but you are signed in as ${email}`);
      }
      
      // Check if expired
      const now = new Date();
      if (invite.expiresAt.toDate() < now) {
        const batch = writeBatch(db);
        batch.update(inviteRef, { status: 'expired' });
        await batch.commit();
        throw new Error('This invitation has expired');
      }
      
      // Check if user is already a member
      const existingMemberRef = doc(db, 'organizations', orgId, 'members', userId);
      const existingMemberDoc = await getDoc(existingMemberRef);
      
      if (existingMemberDoc.exists()) {
        const memberData = existingMemberDoc.data();
        if (memberData.status === 'active') {
          console.log(`⚠️ User is already a member of this organization`);
          // Mark invitation as accepted anyway
          await updateDoc(inviteRef, { 
            status: 'accepted',
            acceptedAt: Timestamp.now()
          });
          // Set as default org
          const userRef = doc(db, 'users', userId);
          await setDoc(userRef, { defaultOrgId: orgId }, { merge: true });
          return; // Already a member, just return
        }
      }
      
      // Proceed with accepting invitation
      const batch = writeBatch(db);
      
      // Update invitation status
      batch.update(inviteRef, { 
        status: 'accepted',
        acceptedAt: Timestamp.now()
      });
      
      // Add user as member with email and displayName
      const memberRef = doc(db, 'organizations', orgId, 'members', userId);
      const memberData: any = {
        userId,
        role: invite.role,
        joinedAt: Timestamp.now(),
        status: 'active',
        invitedBy: invite.invitedBy,
        email: email,
        displayName: displayName || email.split('@')[0]
      };
      
      // If this is a creator invitation with a projectId, add them to that project
      if (invite.role === 'creator' && invite.projectId) {
        memberData.creatorProjectIds = [invite.projectId];
        console.log(`🎨 Adding creator to project ${invite.projectId}`);
        
        // Create creator profile in the project
        const creatorRef = doc(db, 'organizations', orgId, 'projects', invite.projectId, 'creators', userId);
        const creatorData: Omit<Creator, 'id'> = {
          orgId,
          projectId: invite.projectId,
          displayName: displayName || email.split('@')[0],
          email: email,
          linkedAccountsCount: 0,
          totalEarnings: 0,
          payoutsEnabled: true,
          createdAt: Timestamp.now(),
        };
        batch.set(creatorRef, creatorData);
        console.log(`✅ Created creator profile in project ${invite.projectId}`);
      }
      
      batch.set(memberRef, memberData);
      
      // Set this as the user's default organization
      const userRef = doc(db, 'users', userId);
      batch.set(userRef, { defaultOrgId: orgId }, { merge: true });
      
      await batch.commit();
      console.log(`✅ User ${userId} accepted invitation to org ${orgId}`);
      console.log(`✅ Set org ${orgId} as default for user ${userId}`);
      
    } catch (error: any) {
      console.error(`❌ Error accepting invitation:`, error);
      console.error(`Error code:`, error?.code);
      console.error(`Error message:`, error?.message);
      
      // Re-throw with better error message
      if (error?.code === 'permission-denied') {
        throw new Error('Permission denied. The invitation may have expired or been deleted. Please ask for a new invitation.');
      }
      
      throw error;
    }
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

