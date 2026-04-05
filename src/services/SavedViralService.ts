import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ViralVideo } from '../types/viralContent';

export interface SavedFolder {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface SavedViralVideo {
  id: string; // doc ID = viralVideoId
  videoId: string;
  folderId: string; // 'default' for unsorted
  savedAt: Timestamp;
  video: ViralVideo; // snapshot of the video data at save time
}

const FOLDERS_COLLECTION = 'savedViralFolders';
const SAVED_COLLECTION = 'savedViralContent';

function orgBase(orgId: string) {
  return `organizations/${orgId}`;
}

class SavedViralService {
  // ── Folders ───────────────────────────────────────────

  static async getFolders(orgId: string): Promise<SavedFolder[]> {
    const q = query(
      collection(db, orgBase(orgId), FOLDERS_COLLECTION),
      orderBy('createdAt', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedFolder));
  }

  static async createFolder(orgId: string, name: string): Promise<string> {
    const ref = doc(collection(db, orgBase(orgId), FOLDERS_COLLECTION));
    await setDoc(ref, { name, createdAt: serverTimestamp() });
    return ref.id;
  }

  static async renameFolder(orgId: string, folderId: string, name: string): Promise<void> {
    await updateDoc(doc(db, orgBase(orgId), FOLDERS_COLLECTION, folderId), { name });
  }

  static async deleteFolder(orgId: string, folderId: string): Promise<void> {
    // Move all videos in this folder to 'default'
    const q = query(
      collection(db, orgBase(orgId), SAVED_COLLECTION),
      where('folderId', '==', folderId),
    );
    const snap = await getDocs(q);
    const moves = snap.docs.map((d) =>
      updateDoc(doc(db, orgBase(orgId), SAVED_COLLECTION, d.id), { folderId: 'default' }),
    );
    await Promise.all(moves);
    await deleteDoc(doc(db, orgBase(orgId), FOLDERS_COLLECTION, folderId));
  }

  // ── Saved Videos ──────────────────────────────────────

  static async saveVideo(orgId: string, video: ViralVideo, folderId = 'default'): Promise<void> {
    const ref = doc(db, orgBase(orgId), SAVED_COLLECTION, video.id);
    await setDoc(ref, {
      videoId: video.id,
      folderId,
      savedAt: serverTimestamp(),
      video: { ...video },
    });
  }

  static async unsaveVideo(orgId: string, videoId: string): Promise<void> {
    await deleteDoc(doc(db, orgBase(orgId), SAVED_COLLECTION, videoId));
  }

  static async isVideoSaved(orgId: string, videoId: string): Promise<boolean> {
    const snap = await getDoc(doc(db, orgBase(orgId), SAVED_COLLECTION, videoId));
    return snap.exists();
  }

  static async getSavedVideos(orgId: string, folderId?: string): Promise<SavedViralVideo[]> {
    const constraints = folderId && folderId !== 'all'
      ? [where('folderId', '==', folderId)]
      : [];
    const q = query(
      collection(db, orgBase(orgId), SAVED_COLLECTION),
      ...constraints,
      orderBy('savedAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedViralVideo));
  }

  static async moveToFolder(orgId: string, videoId: string, folderId: string): Promise<void> {
    await updateDoc(doc(db, orgBase(orgId), SAVED_COLLECTION, videoId), { folderId });
  }

  /** Get all saved video IDs for quick lookup */
  static async getSavedVideoIds(orgId: string): Promise<Set<string>> {
    const q = query(collection(db, orgBase(orgId), SAVED_COLLECTION));
    const snap = await getDocs(q);
    return new Set(snap.docs.map((d) => d.id));
  }
}

export default SavedViralService;
