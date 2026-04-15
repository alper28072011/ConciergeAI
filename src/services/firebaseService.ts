import { doc, deleteDoc, collection, query, where, getDocs, writeBatch, addDoc, updateDoc, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { CaseTracker, CaseAction } from '../types';

export const createCase = async (caseData: Omit<CaseTracker, 'id' | 'actions' | 'createdAt'>) => {
  const casesRef = collection(db, 'cases');
  const newCase = {
    ...caseData,
    actions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timestamp: serverTimestamp() // for sorting
  };
  const docRef = await addDoc(casesRef, newCase);
  return docRef.id;
};

export const updateCaseStatus = async (caseId: string, status: 'open' | 'resolved') => {
  const caseRef = doc(db, 'cases', caseId);
  await updateDoc(caseRef, { 
    status,
    updatedAt: new Date().toISOString()
  });
};

export const addCaseAction = async (caseId: string, action: Omit<CaseAction, 'id'>, currentActions: CaseAction[]) => {
  const caseRef = doc(db, 'cases', caseId);
  const newAction: CaseAction = {
    ...action,
    id: crypto.randomUUID()
  };
  await updateDoc(caseRef, {
    actions: [...currentActions, newAction],
    updatedAt: new Date().toISOString()
  });
};

export const listenToCases = (callback: (cases: CaseTracker[]) => void) => {
  const q = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const cases: CaseTracker[] = [];
    snapshot.forEach((doc) => {
      cases.push({ id: doc.id, ...doc.data() } as CaseTracker);
    });
    callback(cases);
  });
};

export const deleteCommentData = async (commentId: string) => {
  const batch = writeBatch(db);

  // 1. Delete comment_analytics
  const analyticsRef = doc(db, 'comment_analytics', String(commentId));
  batch.delete(analyticsRef);

  // 2. Delete agenda_notes
  const agendaRef = doc(db, 'agenda_notes', String(commentId));
  batch.delete(agendaRef);

  // 3. Delete comment_actions
  const actionsRef = collection(db, 'comment_actions');
  const q = query(actionsRef, where('commentId', '==', String(commentId)));
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  await batch.commit();
};
