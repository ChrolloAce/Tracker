import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import { CreatorLabel } from '../types/firestore';

/**
 * CreatorLabelService — PROJECT SCOPED
 *
 * Manages tags / labels for creators (UGC, Influencer, Faceless, or any custom
 * tag the admin defines). Each project keeps its own taxonomy.
 *
 * Path: /organizations/{orgId}/projects/{projectId}/creatorLabels/{labelId}
 */

const DEFAULT_LABELS: Array<Pick<CreatorLabel, 'name' | 'color'>> = [
  { name: 'UGC', color: 'orange' },
  { name: 'Influencer', color: 'violet' },
  { name: 'Faceless', color: 'slate' },
];

class CreatorLabelService {
  /** List all labels in a project, seeding the default UGC/Influencer/Faceless
   *  triplet on first read so the UI has something to show out of the box. */
  static async listLabels(
    orgId: string,
    projectId: string,
    seedingUserId?: string
  ): Promise<CreatorLabel[]> {
    const labelsRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLabels');
    const snapshot = await getDocs(labelsRef);

    if (snapshot.empty && seedingUserId) {
      await this.seedDefaultsIfEmpty(orgId, projectId, seedingUserId);
      const reread = await getDocs(labelsRef);
      return reread.docs.map(d => ({ id: d.id, ...d.data() }) as CreatorLabel);
    }

    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as CreatorLabel);
  }

  static async createLabel(
    orgId: string,
    projectId: string,
    createdBy: string,
    data: { name: string; color: string; isDefault?: boolean }
  ): Promise<string> {
    const labelsRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLabels');
    const labelRef = doc(labelsRef);
    const payload: Omit<CreatorLabel, 'id'> = {
      orgId,
      projectId,
      name: data.name.trim(),
      color: data.color,
      ...(data.isDefault && { isDefault: true }),
      createdAt: Timestamp.now(),
      createdBy,
    };
    await setDoc(labelRef, payload);
    return labelRef.id;
  }

  static async updateLabel(
    orgId: string,
    projectId: string,
    labelId: string,
    updates: Partial<Pick<CreatorLabel, 'name' | 'color'>>
  ): Promise<void> {
    const labelRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creatorLabels', labelId);
    await updateDoc(labelRef, updates);
  }

  /** Delete a label. Also strips the labelId from every creator that had it
   *  assigned so we don't leave dangling references. */
  static async deleteLabel(
    orgId: string,
    projectId: string,
    labelId: string
  ): Promise<void> {
    const creatorsRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creators');
    const creatorsSnap = await getDocs(creatorsRef);

    const batch = writeBatch(db);
    creatorsSnap.docs.forEach(d => {
      const data = d.data() as { labelIds?: string[] };
      if (data.labelIds?.includes(labelId)) {
        batch.update(d.ref, { labelIds: arrayRemove(labelId) });
      }
    });

    const labelRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creatorLabels', labelId);
    batch.delete(labelRef);
    await batch.commit();
  }

  /** Replace the full set of labels assigned to a creator. */
  static async setCreatorLabels(
    orgId: string,
    projectId: string,
    creatorId: string,
    labelIds: string[]
  ): Promise<void> {
    const creatorRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creators', creatorId);
    await updateDoc(creatorRef, { labelIds });
  }

  /** Add a single label to a creator without clobbering existing labels. */
  static async addLabelToCreator(
    orgId: string,
    projectId: string,
    creatorId: string,
    labelId: string
  ): Promise<void> {
    const creatorRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creators', creatorId);
    await updateDoc(creatorRef, { labelIds: arrayUnion(labelId) });
  }

  static async removeLabelFromCreator(
    orgId: string,
    projectId: string,
    creatorId: string,
    labelId: string
  ): Promise<void> {
    const creatorRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creators', creatorId);
    await updateDoc(creatorRef, { labelIds: arrayRemove(labelId) });
  }

  /** Seed UGC / Influencer / Faceless on first read so admins see something useful
   *  immediately. Idempotent — checks emptiness before writing. */
  static async seedDefaultsIfEmpty(
    orgId: string,
    projectId: string,
    createdBy: string
  ): Promise<void> {
    const labelsRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLabels');
    const existing = await getDocs(labelsRef);
    if (!existing.empty) return;

    const batch = writeBatch(db);
    const now = Timestamp.now();
    DEFAULT_LABELS.forEach(({ name, color }) => {
      const ref = doc(labelsRef);
      batch.set(ref, {
        orgId,
        projectId,
        name,
        color,
        isDefault: true,
        createdAt: now,
        createdBy,
      });
    });
    await batch.commit();
  }

  static async getLabel(
    orgId: string,
    projectId: string,
    labelId: string
  ): Promise<CreatorLabel | null> {
    const labelRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creatorLabels', labelId);
    const snap = await getDoc(labelRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as CreatorLabel;
  }
}

export default CreatorLabelService;
