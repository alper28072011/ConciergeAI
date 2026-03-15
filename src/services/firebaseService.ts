import { doc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

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
