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
    
    // Create lookup document with FULL invitation details for public access
    // This allows unauthenticated users to view invitation details before signing in
    const lookupRef = doc(db, 'invitationsLookup', inviteRef.id);
    await setDoc(lookupRef, {
      ...inviteData, // Include all invitation data
      invitationId: inviteRef.id
    });
    console.log(`✅ Created public invitation lookup for ${email}`);
    
    // Send email notification
    try {
      // Use production URL for invite links
      const baseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5173' 
        : 'https://viewtrack.app';
      const inviteLink = `${baseUrl}/invitations/${inviteRef.id}`;
      
      // Extract name from email (part before @), capitalize first letter
      const emailUsername = email.split('@')[0];
      const recipientName = emailUsername
        .split(/[._-]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      
      console.log(`📧 Attempting to send invitation email to ${email}...`);
      console.log(`👤 Recipient name: ${recipientName}`);
      console.log(`🔗 Invite link: ${inviteLink}`);
      
      if (role === 'creator' && projectId) {
        // Send creator invitation email
        console.log(`🎨 Sending creator invitation email...`);
        const result = await EmailService.sendCreatorInvitation({
          to: email,
          recipientName: recipientName,
          inviterName: invitedByName,
          organizationName: organizationName,
          projectName: organizationName, // You might want to pass actual project name
          inviteLink: inviteLink
        });
        
        if (result.success) {
          console.log(`✅ Successfully sent creator invitation email to ${email}`);
        } else {
          console.error(`❌ Failed to send creator invitation email:`, result.error);
        }
      } else {
        // Send team member invitation email
        console.log(`👥 Sending team member invitation email...`);
        const result = await EmailService.sendTeamInvitation({
          to: email,
          recipientName: recipientName,
          inviterName: invitedByName,
          organizationName: organizationName,
          role: role,
          inviteLink: inviteLink
        });
        
        if (result.success) {
          console.log(`✅ Successfully sent team invitation email to ${email}`);
        } else {
          console.error(`❌ Failed to send team invitation email:`, result.error);
        }
      }
    } catch (emailError) {
      // Don't fail invitation creation if email fails
      console.error('❌ Error sending invitation email:', emailError);
      console.error('Full error details:', emailError);
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
    
    let invite: TeamInvitation | undefined; // Declare outside try block for catch block access
    
    try {
      // Get invitation from the public lookup first (more reliable)
      console.log(`🔍 Attempting to read invitation from public lookup first`);
      const lookupRef = doc(db, 'invitationsLookup', invitationId);
      let lookupDoc;
      
      try {
        lookupDoc = await getDoc(lookupRef);
        console.log(`📧 Public lookup exists:`, lookupDoc.exists());
        
        if (lookupDoc.exists()) {
          const lookupData = lookupDoc.data();
          console.log(`📋 Public lookup status:`, lookupData.status);
          console.log(`📋 Public lookup email:`, lookupData.email);
          
          // Check status from public lookup
          if (lookupData.status && lookupData.status !== 'pending') {
            throw new Error(`This invitation has already been ${lookupData.status}.`);
          }
        }
      } catch (lookupErr: any) {
        console.warn(`⚠️ Could not read public lookup:`, lookupErr);
      }
      
      // Now get the actual invitation from protected collection
      console.log(`🔍 Attempting to read invitation from protected collection`);
      const inviteRef = doc(db, 'organizations', orgId, 'invitations', invitationId);
      const inviteDoc = await getDoc(inviteRef);
      
      console.log(`📧 Invitation doc exists:`, inviteDoc.exists());
      
      if (!inviteDoc.exists()) {
        throw new Error('Invitation not found. It may have already been accepted or deleted.');
      }
      
      invite = inviteDoc.data() as TeamInvitation;
      console.log(`📋 Invitation status:`, invite.status);
      console.log(`📋 Invitation email:`, invite.email);
      console.log(`📋 Your email:`, email);
      
      if (invite.status !== 'pending') {
        // If already accepted, check if user is already a member
        if (invite.status === 'accepted') {
          const existingMemberRef = doc(db, 'organizations', orgId, 'members', userId);
          const existingMemberDoc = await getDoc(existingMemberRef);
          
          if (existingMemberDoc.exists() && existingMemberDoc.data().status === 'active') {
            console.log(`✅ Invitation already accepted and user is already a member`);
            // Set as default org
            const userRef = doc(db, 'users', userId);
            await setDoc(userRef, { defaultOrgId: orgId }, { merge: true });
            return; // Success - already a member
          }
        }
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
      
      // Check if user is already an active member
      const existingMemberRef = doc(db, 'organizations', orgId, 'members', userId);
      const existingMemberDoc = await getDoc(existingMemberRef);
      
      if (existingMemberDoc.exists()) {
        const memberData = existingMemberDoc.data();
        console.log(`📋 Found existing member document with status: ${memberData.status}`);
        
        if (memberData.status === 'active') {
          console.log(`⚠️ User is already an active member of this organization`);
          // Mark invitation as accepted anyway
          await updateDoc(inviteRef, { 
            status: 'accepted',
            acceptedAt: Timestamp.now()
          });
          
          // Try to update the public lookup (don't fail if it doesn't exist)
          try {
            const lookupRef = doc(db, 'invitationsLookup', invitationId);
            await updateDoc(lookupRef, {
              status: 'accepted',
              acceptedAt: Timestamp.now()
            });
            console.log(`✅ Public lookup updated (already member case)`);
          } catch (err: any) {
            console.warn(`⚠️ Could not update public lookup:`, err.message);
          }
          
          // Set as default org
          const userRef = doc(db, 'users', userId);
          await setDoc(userRef, { defaultOrgId: orgId }, { merge: true });
          return; // Already a member, just return
        } else {
          // Member exists but is not active (was removed/deleted)
          // We'll reactivate them by updating the document below
          console.log(`🔄 Reactivating previously removed member with new role: ${invite.role}`);
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
      
      // This will create a new member doc or overwrite an existing one (reactivation)
      batch.set(memberRef, memberData);
      console.log(`📝 ${existingMemberDoc.exists() ? 'Reactivating' : 'Creating'} member document`);
      
      // Set this as the user's default organization
      const userRef = doc(db, 'users', userId);
      batch.set(userRef, { defaultOrgId: orgId }, { merge: true });
      
      console.log(`💾 Committing batch write...`);
      await batch.commit();
      console.log(`✅ User ${userId} accepted invitation to org ${orgId}`);
      console.log(`✅ Set org ${orgId} as default for user ${userId}`);
      
      // Try to update the public lookup (separately, after batch commit)
      // Don't fail if it doesn't exist (old invitations won't have this)
      try {
        const lookupRef = doc(db, 'invitationsLookup', invitationId);
        await updateDoc(lookupRef, {
          status: 'accepted',
          acceptedAt: Timestamp.now()
        });
        console.log(`✅ Public lookup updated to accepted`);
      } catch (lookupErr: any) {
        console.warn(`⚠️ Could not update public lookup (might be old invitation):`, lookupErr.message);
        // Don't fail - this is non-critical
      }
      
      // Send acceptance notification email to the inviter
      try {
        const accepterName = displayName || email.split('@')[0];
        console.log(`📧 Sending acceptance notification to ${invite.invitedByEmail}...`);
        
        // Call send-test-email API with custom content
        const emailResponse = await fetch('/api/send-test-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: invite.invitedByEmail,
            subject: `${accepterName} accepted your invitation!`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; padding: 30px 20px; background: #f8f9fa; border-bottom: 2px solid #e9ecef;">
                  <img src="https://www.viewtrack.app/blacklogo.png" alt="ViewTrack" style="height: 40px; width: auto;" />
                </div>
                <div style="padding: 30px 20px;">
                <h2 style="color: #f5576c; margin-top: 0;">Invitation Accepted! 🎉</h2>
                <p><strong>${accepterName}</strong> has accepted your invitation to join <strong>${invite.organizationName}</strong>.</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Member:</strong> ${email}</p>
                  <p style="margin: 5px 0;"><strong>Role:</strong> ${invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}</p>
                  <p style="margin: 5px 0;"><strong>Organization:</strong> ${invite.organizationName}</p>
                  ${invite.role === 'creator' && invite.projectId ? `<p style="margin: 5px 0;"><strong>Type:</strong> Creator</p>` : ''}
                </div>
                <p>They can now access the ${invite.role === 'creator' ? 'Creator Portal' : 'dashboard'} and start collaborating with your team.</p>
                <a href="https://www.viewtrack.app" style="display: inline-block; padding: 12px 24px; background: #f5576c; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Dashboard</a>
                </div>
              </div>
            `,
          }),
        });

        if (emailResponse.ok) {
          console.log(`✅ Acceptance notification sent to ${invite.invitedByEmail}`);
        } else {
          const errorData = await emailResponse.json();
          console.error(`❌ Failed to send acceptance notification:`, errorData);
        }
      } catch (emailError) {
        console.error(`❌ Email notification error:`, emailError);
        // Don't fail invitation acceptance if email fails
      }
      
    } catch (error: any) {
      console.error(`❌ Error accepting invitation:`, error);
      console.error(`📊 Error details:`);
      console.error(`  - Code:`, error?.code);
      console.error(`  - Message:`, error?.message);
      console.error(`  - Name:`, error?.name);
      console.error(`  - Stack:`, error?.stack);
      console.error(`📋 Context:`, {
        invitationId,
        orgId,
        userId,
        email,
        inviteRole: invite?.role
      });
      
      // Re-throw with better error message
      if (error?.code === 'permission-denied') {
        throw new Error('Permission denied. The invitation may have expired or been deleted. Please ask for a new invitation.');
      } else if (error?.code === 'not-found') {
        throw new Error('Invitation not found. It may have been cancelled.');
      }
      
      throw error;
    }
  }
  
  /**
   * Decline an invitation
   */
  static async declineInvitation(invitationId: string, orgId: string): Promise<void> {
    console.log(`❌ Declining invitation ${invitationId} in org ${orgId}...`);
    
    const inviteRef = doc(db, 'organizations', orgId, 'invitations', invitationId);
    await updateDoc(inviteRef, {
      status: 'declined',
      declinedAt: Timestamp.now()
    });
    
    // Try to update the public lookup (don't fail if it doesn't exist)
    try {
      const lookupRef = doc(db, 'invitationsLookup', invitationId);
      await updateDoc(lookupRef, {
        status: 'declined',
        declinedAt: Timestamp.now()
      });
      console.log(`✅ Public lookup updated to declined`);
    } catch (err: any) {
      console.warn(`⚠️ Could not update public lookup:`, err.message);
    }
    
    console.log(`✅ Invitation ${invitationId} declined`);
  }
  
  /**
   * Cancel/revoke an invitation
   */
  static async cancelInvitation(invitationId: string, orgId: string): Promise<void> {
    console.log(`🗑️ Cancelling invitation ${invitationId} in org ${orgId}...`);
    
    try {
      // Update main invitation
    const inviteRef = doc(db, 'organizations', orgId, 'invitations', invitationId);
    await updateDoc(inviteRef, {
      status: 'expired'
    });
      console.log(`✅ Main invitation updated to expired`);
    } catch (err) {
      console.error(`❌ Failed to update main invitation:`, err);
      throw err; // Re-throw since this is critical
    }
    
    // Try to update the public lookup (don't fail if it doesn't exist - could be old invitation)
    try {
      const lookupRef = doc(db, 'invitationsLookup', invitationId);
      await updateDoc(lookupRef, {
        status: 'expired'
      });
      console.log(`✅ Public lookup updated to expired`);
    } catch (err: any) {
      // Don't fail the whole operation if lookup doesn't exist (old invitations)
      console.warn(`⚠️ Could not update public lookup (might be old invitation):`, err.message);
    }
    
    console.log(`✅ Invitation ${invitationId} cancelled successfully`);
  }
}

export default TeamInvitationService;

