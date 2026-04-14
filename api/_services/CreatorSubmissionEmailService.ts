/**
 * CreatorSubmissionEmailService
 *
 * Sends a notification email to admins/owners when a creator submits
 * a video via their public share-link portal. Called from
 * process-single-video.ts after a video has been fully processed
 * (so we have a thumbnail and metadata).
 *
 * Failure is non-blocking: errors are logged but never thrown so they
 * don't fail the video processing pipeline.
 */

import type { Firestore } from 'firebase-admin/firestore';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_ADDRESS = 'ViewTrack <team@viewtrack.app>';

interface VideoData {
  url: string;
  platform: string;
  thumbnail: string;
  title: string;
  caption: string;
  uploaderHandle: string;
  views: number;
}

/**
 * Notify all active admin/owner members of an org that a creator
 * submitted a video via their share-link portal.
 *
 * Safe to call on any video processing — internally checks whether
 * the video actually came from a share link and short-circuits otherwise.
 */
export async function notifyCreatorShareSubmission(params: {
  db: Firestore;
  orgId: string;
  projectId: string;
  creatorId: string;
  video: VideoData;
}): Promise<void> {
  const { db, orgId, projectId, creatorId, video } = params;

  try {
    console.log(`[submission-email] 🚀 notifyCreatorShareSubmission called for creator=${creatorId}`);

    if (!RESEND_API_KEY) {
      console.warn('[submission-email] ❌ RESEND_API_KEY missing in env — skipping notification');
      return;
    }
    console.log(`[submission-email] ✅ RESEND_API_KEY present (${RESEND_API_KEY.length} chars)`);

    // Look up an active share link for this creator to build the portal URL.
    const linksSnap = await db.collection('creatorShareLinks')
      .where('creatorId', '==', creatorId)
      .limit(5)
      .get();
    console.log(`[submission-email] Found ${linksSnap.size} share link(s) for this creator`);
    const activeLink = linksSnap.docs.find(d => {
      const data = d.data();
      return !data.revoked && data.orgId === orgId && data.projectId === projectId;
    });
    if (!activeLink) {
      console.warn(`[submission-email] ❌ No active share link matching orgId=${orgId}, projectId=${projectId} — skipping`);
      return;
    }
    const token = activeLink.id;
    const portalUrl = `https://www.viewtrack.app/c/${token}`;
    console.log(`[submission-email] ✅ Portal URL: ${portalUrl}`);

    // Fetch creator profile for display name + avatar
    const creatorDoc = await db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('creators').doc(creatorId)
      .get();
    const creator = creatorDoc.exists ? creatorDoc.data()! : {};
    const creatorName = (creator.displayName as string) || 'A creator';
    const creatorAvatar = (creator.photoURL as string) || '';

    // Fetch active admin/owner members for recipient list
    const membersSnap = await db
      .collection('organizations').doc(orgId)
      .collection('members')
      .where('status', '==', 'active')
      .get();

    const adminMembers = membersSnap.docs
      .map(d => d.data())
      .filter(m => m.role === 'admin' || m.role === 'owner')
      .filter(m => m.userId !== creatorId);
    console.log(`[submission-email] Found ${adminMembers.length} admin/owner member(s) in org`);
    for (const m of adminMembers) {
      console.log(`[submission-email]   - ${m.displayName || '(no name)'} <${m.email || '(NO EMAIL)'}> role=${m.role}`);
    }
    const recipients = adminMembers.map(m => m.email as string).filter(Boolean);

    if (recipients.length === 0) {
      console.warn('[submission-email] ❌ No recipients with valid emails — skipping');
      return;
    }
    console.log(`[submission-email] ✅ Sending to ${recipients.length} recipient(s): ${recipients.join(', ')}`);

    // Fetch org name for email context
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const orgName = (orgDoc.data()?.name as string) || 'your organization';

    const subject = `📹 ${creatorName} submitted a new video`;
    const html = buildEmailHtml({
      creatorName,
      creatorAvatar,
      orgName,
      video,
      portalUrl,
    });

    // Send all emails in parallel — log individual failures but don't throw
    const results = await Promise.all(
      recipients.map(to =>
        sendViaResend({ to, subject, html })
          .then(() => ({ to, ok: true as const }))
          .catch(err => ({ to, ok: false as const, error: err?.message || String(err) }))
      )
    );

    const succeeded = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);
    console.log(`[submission-email] Notified ${succeeded}/${recipients.length} admins for ${creatorName}'s submission`);
    if (failed.length > 0) {
      console.warn('[submission-email] Failures:', failed);
    }
  } catch (err: any) {
    console.error('[submission-email] Unexpected error (non-blocking):', err?.message || err);
  }
}

async function sendViaResend(params: { to: string; subject: string; html: string }): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function platformLabel(p: string): string {
  const map: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    youtube: 'YouTube',
    twitter: 'X',
  };
  return map[(p || '').toLowerCase()] || p || 'Video';
}

function buildEmailHtml(params: {
  creatorName: string;
  creatorAvatar: string;
  orgName: string;
  video: VideoData;
  portalUrl: string;
}): string {
  const { creatorName, creatorAvatar, orgName, video, portalUrl } = params;
  const creatorNameSafe = escapeHtml(creatorName);
  const orgNameSafe = escapeHtml(orgName);
  const platform = platformLabel(video.platform);
  const captionRaw = video.caption || video.title || '';
  const caption = escapeHtml(captionRaw.slice(0, 180) + (captionRaw.length > 180 ? '…' : ''));
  const uploaderHandle = escapeHtml(video.uploaderHandle || '');
  const videoUrl = escapeHtml(video.url || portalUrl);
  const thumbnail = escapeHtml(video.thumbnail || '');

  const avatarBlock = creatorAvatar
    ? `<img src="${escapeHtml(creatorAvatar)}" alt="${creatorNameSafe}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #e5e5e5;" />`
    : `<div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #9333ea); color: white; font-weight: 700; font-size: 18px; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 48px;">${creatorNameSafe.charAt(0).toUpperCase()}</div>`;

  const thumbnailBlock = thumbnail
    ? `<a href="${videoUrl}" target="_blank" style="display: block;"><img src="${thumbnail}" alt="Video thumbnail" style="width: 100%; max-width: 480px; height: auto; border-radius: 12px; display: block;" /></a>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New video submission</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 20px;">
    <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);">

      <!-- Header -->
      <div style="background: #1a1a1a; padding: 32px 28px; text-align: center;">
        <img src="https://www.viewtrack.app/whitelogo.png" alt="ViewTrack" style="height: 36px; width: auto;" />
      </div>

      <!-- Body -->
      <div style="padding: 32px 28px;">

        <!-- Creator + title -->
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 24px;">
          ${avatarBlock}
          <div style="flex: 1;">
            <p style="margin: 0 0 3px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">New submission</p>
            <h1 style="margin: 0; font-size: 20px; color: #1a1a1a; font-weight: 700;">${creatorNameSafe}</h1>
          </div>
        </div>

        <!-- Message -->
        <p style="font-size: 15px; color: #444; margin: 0 0 24px;">
          ${creatorNameSafe} just submitted a new video through their portal in <strong>${orgNameSafe}</strong>.
        </p>

        <!-- Thumbnail -->
        ${thumbnailBlock ? `<div style="margin-bottom: 20px;">${thumbnailBlock}</div>` : ''}

        <!-- Meta -->
        <div style="background: #fafafa; border: 1px solid #eee; border-radius: 10px; padding: 16px 18px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Platform</span>
            <span style="font-size: 13px; color: #1a1a1a; font-weight: 600;">${platform}</span>
          </div>
          ${uploaderHandle ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Handle</span>
            <span style="font-size: 13px; color: #1a1a1a; font-weight: 600;">@${uploaderHandle}</span>
          </div>` : ''}
          ${caption ? `
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 13px; color: #444; line-height: 1.5;">${caption}</p>
          </div>` : ''}
        </div>

        <!-- CTA -->
        <div style="text-align: center; margin: 28px 0 12px;">
          <a href="${escapeHtml(portalUrl)}" target="_blank" style="display: inline-block; background: #f97316; color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">
            View Creator Portal
          </a>
        </div>

        <!-- Secondary link -->
        <div style="text-align: center;">
          <a href="${videoUrl}" target="_blank" style="font-size: 13px; color: #888; text-decoration: none;">
            Or open the video on ${platform} →
          </a>
        </div>

      </div>

      <!-- Footer -->
      <div style="background: #fafafa; padding: 20px 28px; text-align: center; border-top: 1px solid #eee;">
        <p style="margin: 0; font-size: 11px; color: #aaa;">
          Sent by <span style="color: #1a1a1a; font-weight: 600;">ViewTrack</span> · viewtrack.app
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;
}
