/**
 * Public Creator Signup API
 *   GET  /api/creator-signup?token=xxx          → returns the form spec
 *   POST /api/creator-signup?token=xxx          → creates a creator profile,
 *                                                 adds tracked accounts for any
 *                                                 handles supplied, links them
 *
 * No auth — the token IS the credential. Mirrors the public-creator-share
 * pattern (token doc lives in a top-level collection, looked up directly).
 *
 * Token is generated when the admin first enables the form for a project
 * (see api/creator-signup-config.ts). Disabled forms return 410 here.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { initializeFirebase } from './_utils/firebase-admin.js';

initializeFirebase();
const db = getFirestore();

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'twitter';

interface FormFieldsSpec {
  name: { required: boolean };
  email: { required: boolean };
  phone: { required: boolean };
  notes: { required: boolean };
  handles: Record<Platform, { enabled: boolean; required: boolean }>;
}

interface SubmitBody {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  handles?: Partial<Record<Platform, string>>;
}

const DEFAULT_FIELDS: FormFieldsSpec = {
  name: { required: true },
  email: { required: false },
  phone: { required: false },
  notes: { required: false },
  handles: {
    instagram: { enabled: true, required: false },
    tiktok: { enabled: true, required: false },
    youtube: { enabled: true, required: false },
    twitter: { enabled: false, required: false },
  },
};

// Strip @ and any platform URL prefix the creator might paste so we always
// store a clean username in TrackedAccount docs.
function cleanHandle(raw: string, platform: Platform): string {
  let h = (raw || '').trim();
  if (!h) return '';
  // Pull the last path segment if it looks like a URL.
  if (h.includes('/')) {
    const segs = h.split('/').filter(Boolean);
    h = segs[segs.length - 1] || h;
  }
  if (h.startsWith('@')) h = h.slice(1);
  // Platform-specific cleanups (e.g. youtube channel handles keep the @ prefix
  // visually but we store without).
  if (platform === 'youtube' && h.startsWith('@')) h = h.slice(1);
  return h.replace(/[^a-zA-Z0-9._-]/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (req.query.token || (req.body as any)?.token) as string | undefined;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing signup token' });
  }

  try {
    // Token lookup — top-level collection mirrors creatorShareLinks pattern.
    const tokenDoc = await db.collection('creatorSignupTokens').doc(token).get();
    if (!tokenDoc.exists) {
      return res.status(404).json({ error: 'Signup form not found' });
    }
    const tokenData = tokenDoc.data()!;
    if (tokenData.enabled === false) {
      return res.status(410).json({ error: 'This signup form is disabled' });
    }

    const { orgId, projectId } = tokenData;
    if (!orgId || !projectId) {
      return res.status(500).json({ error: 'Invalid signup token' });
    }

    const projectRef = db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId);

    const [projectDoc, formDoc] = await Promise.all([
      projectRef.get(),
      projectRef.collection('creatorSignupForms').doc('default').get(),
    ]);

    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data()!;
    const form = formDoc.exists ? formDoc.data()! : { fields: DEFAULT_FIELDS };
    const fields: FormFieldsSpec = (form.fields as FormFieldsSpec) || DEFAULT_FIELDS;

    // ─── GET: return form spec ───────────────────────────────────────
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        data: {
          project: {
            name: project.name || 'Project',
            icon: project.icon || '',
            color: project.color || '',
          },
          welcomeMessage: form.welcomeMessage || '',
          fields,
        },
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ─── POST: create the creator + linked accounts ──────────────────
    const body = (req.body || {}) as SubmitBody;

    const name = (body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const email = (body.email || '').trim();
    const phone = (body.phone || '').trim();
    const notes = (body.notes || '').trim();
    const handles = body.handles || {};

    // Field-level required checks against the project's spec.
    if (fields.email.required && !email) return res.status(400).json({ error: 'Email is required' });
    if (fields.phone.required && !phone) return res.status(400).json({ error: 'Phone is required' });
    if (fields.notes.required && !notes) return res.status(400).json({ error: 'Notes are required' });

    const handleEntries: Array<[Platform, string]> = [];
    for (const p of ['instagram', 'tiktok', 'youtube', 'twitter'] as Platform[]) {
      const cfg = fields.handles[p];
      if (!cfg?.enabled) continue;
      const cleaned = cleanHandle((handles as any)[p] || '', p);
      if (cfg.required && !cleaned) {
        return res.status(400).json({ error: `${p[0].toUpperCase() + p.slice(1)} handle is required` });
      }
      if (cleaned) handleEntries.push([p, cleaned]);
    }

    // Create the creator profile (member doc + project creator doc) via the
    // same shape CreatorLinksService.addCreatorProfile uses. Inlined here so
    // we don't need to ship a duplicate service into the API bundle.
    const now = Timestamp.now();
    const memberRef = db.collection('organizations').doc(orgId).collection('members').doc();
    const creatorId = memberRef.id;
    const creatorRef = projectRef.collection('creators').doc(creatorId);

    const batch = db.batch();
    batch.set(memberRef, {
      userId: creatorId,
      role: 'creator',
      joinedAt: now,
      status: 'active',
      invitedBy: 'creator-signup-form',
      displayName: name,
      ...(email && { email }),
      creatorProjectIds: [projectId],
    });
    batch.set(creatorRef, {
      orgId,
      projectId,
      displayName: name,
      ...(email && { email }),
      ...(phone && { phone }),
      ...(notes && { notes }),
      linkedAccountsCount: 0,
      totalEarnings: 0,
      payoutsEnabled: true,
      addedWithoutInvite: true,
      createdAt: now,
      createdViaSignupForm: true,
    });
    await batch.commit();

    // Create tracked accounts for each handle the creator supplied. Reuses
    // the deterministic doc-id pattern used by VideoStorageService so future
    // syncs land in the same doc.
    const linkedAccountIds: string[] = [];
    for (const [platform, username] of handleEntries) {
      try {
        const accountRef = projectRef.collection('trackedAccounts').doc();
        await accountRef.set({
          username,
          platform,
          accountType: 'my',
          displayName: username,
          isActive: true,
          maxVideos: 50,
          creatorType: 'automatic',
          orgId,
          projectId,
          dateAdded: now,
          addedBy: creatorId,
          ...(platform === 'youtube' ? { youtubeVideoType: 'shorts' } : {}),
        });
        linkedAccountIds.push(accountRef.id);
      } catch (e) {
        console.error(`Signup: failed to create tracked account for @${username} (${platform})`, e);
      }
    }

    // Link those accounts to the new creator. Each link doc lives at
    // /organizations/{orgId}/projects/{projectId}/creatorLinks/{linkId} and
    // is what the dashboard joins on to attribute videos to a creator.
    if (linkedAccountIds.length > 0) {
      const linkBatch = db.batch();
      for (const accountId of linkedAccountIds) {
        const linkRef = projectRef.collection('creatorLinks').doc();
        linkBatch.set(linkRef, {
          orgId,
          projectId,
          creatorId,
          accountId,
          createdAt: now,
          linkedBy: creatorId,
        });
      }
      // Reflect the count on the creator doc.
      linkBatch.update(creatorRef, { linkedAccountsCount: linkedAccountIds.length });
      await linkBatch.commit();
    }

    // Bump the form's submission counter — surfaced in the admin modal so
    // they can see "37 creators signed up via this form" at a glance.
    await formDoc.ref.set({
      submitCount: FieldValue.increment(1),
      lastSubmittedAt: now,
    }, { merge: true });

    // Auto-mint a creator share link. The signup form is a public surface
    // by definition (anyone with the URL can submit) so issuing a portal
    // link is consistent with that trust level. Lets the success screen
    // hand the creator a working dashboard URL on the spot.
    const portalToken = randomBytes(24).toString('hex');
    await db.collection('creatorShareLinks').doc(portalToken).set({
      token: portalToken,
      orgId,
      projectId,
      creatorId,
      createdAt: now,
      createdBy: 'creator-signup-form',
      revoked: false,
      acceptSubmissions: true,
      submitCount: 0,
      submitCountHour: 0,
      submitCountHourBucket: '',
      submitCountToday: 0,
      submitCountDayBucket: '',
    });
    await creatorRef.set({ externalShareToken: portalToken }, { merge: true });

    const host = req.headers.host || 'www.viewtrack.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const portalUrl = `${protocol}://${host}/c/${portalToken}`;

    return res.status(200).json({
      success: true,
      data: {
        creatorId,
        linkedAccountsCount: linkedAccountIds.length,
        portalToken,
        portalUrl,
      },
    });
  } catch (err: any) {
    console.error('❌ creator-signup error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
