/**
 * Creator Signup Form Configuration (admin-only)
 *   GET  /api/creator-signup-config?orgId=...&projectId=...
 *        → returns the form spec + token + share URL (or null if never set)
 *   POST /api/creator-signup-config
 *        body: { orgId, projectId, enabled, fields, welcomeMessage? }
 *        → writes the spec, mints a token on first enable, returns share URL
 *
 * Mirrors the create-creator-share auth pattern: authenticated admin, role
 * gated. The public submission endpoint is /api/creator-signup; this is the
 * admin counterpart that owns the configuration document.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { initializeFirebase } from './_utils/firebase-admin.js';
import { authenticateAndVerifyOrg, setCorsHeaders, handleCorsPreFlight } from './_middleware/auth.js';

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

function buildShareUrl(req: VercelRequest, token: string): string {
  const host = req.headers.host || 'www.viewtrack.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}/creator-signup?t=${token}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req);
  if (handleCorsPreFlight(req, res)) return;

  const orgId = (req.method === 'GET' ? (req.query.orgId as string) : req.body?.orgId) || '';
  const projectId = (req.method === 'GET' ? (req.query.projectId as string) : req.body?.projectId) || '';
  if (!orgId || !projectId) {
    return res.status(400).json({ error: 'orgId and projectId are required' });
  }

  try {
    const { role } = await authenticateAndVerifyOrg(req, orgId);
    if (role === 'creator') {
      return res.status(403).json({ error: 'Creators cannot manage signup forms' });
    }

    const formRef = db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('creatorSignupForms').doc('default');

    if (req.method === 'GET') {
      const snap = await formRef.get();
      if (!snap.exists) {
        return res.status(200).json({
          success: true,
          data: {
            enabled: false,
            fields: DEFAULT_FIELDS,
            welcomeMessage: '',
            token: null,
            shareUrl: null,
            submitCount: 0,
          },
        });
      }
      const d = snap.data()!;
      return res.status(200).json({
        success: true,
        data: {
          enabled: d.enabled === true,
          fields: (d.fields as FormFieldsSpec) || DEFAULT_FIELDS,
          welcomeMessage: d.welcomeMessage || '',
          token: d.token || null,
          shareUrl: d.token ? buildShareUrl(req, d.token) : null,
          submitCount: d.submitCount || 0,
          lastSubmittedAt: d.lastSubmittedAt?.toDate?.()?.toISOString() || null,
        },
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { enabled, fields, welcomeMessage } = req.body || {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled (boolean) is required' });
    }

    const existing = await formRef.get();
    const existingData = existing.exists ? existing.data()! : null;
    let token: string = existingData?.token || '';

    // Mint a fresh token the first time the form is enabled. Re-disabling
    // keeps the token so re-enabling reuses the same URL — admins shouldn't
    // have to re-distribute the link every time they pause and resume.
    if (enabled && !token) {
      token = randomBytes(24).toString('hex');
    }

    const now = Timestamp.now();
    const formPayload: any = {
      orgId,
      projectId,
      enabled,
      fields: fields || existingData?.fields || DEFAULT_FIELDS,
      welcomeMessage: typeof welcomeMessage === 'string' ? welcomeMessage : (existingData?.welcomeMessage || ''),
      updatedAt: now,
      ...(existingData ? {} : { createdAt: now }),
      ...(token ? { token } : {}),
    };

    await formRef.set(formPayload, { merge: true });

    // Top-level lookup doc. Public /api/creator-signup queries this by token
    // to resolve {orgId, projectId, enabled} without a costly collectionGroup.
    if (token) {
      await db.collection('creatorSignupTokens').doc(token).set({
        token,
        orgId,
        projectId,
        enabled,
        updatedAt: now,
      }, { merge: true });
    }

    return res.status(200).json({
      success: true,
      data: {
        enabled,
        fields: formPayload.fields,
        welcomeMessage: formPayload.welcomeMessage,
        token: token || null,
        shareUrl: token ? buildShareUrl(req, token) : null,
        submitCount: existingData?.submitCount || 0,
      },
    });
  } catch (err: any) {
    console.error('❌ creator-signup-config error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
