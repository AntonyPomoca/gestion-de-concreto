import { Order } from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  deleteDoc, 
  writeBatch, 
  query, 
  where,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';

export const api = {
  async getOrders(): Promise<Order[]> {
    const q = query(collection(db, 'orders'), orderBy('orderDate', 'desc'), orderBy('scheduledTime', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order));
  },

  async createOrder(order: Order): Promise<void> {
    const orderRef = doc(db, 'orders', order.id);
    
    // Create a clean object without undefined values for Firestore
    const cleanOrder = JSON.parse(JSON.stringify(order));
    
    await setDoc(orderRef, {
      ...cleanOrder,
      createdAt: serverTimestamp()
    });
  },

  async updateOrder(order: Order): Promise<void> {
    const orderRef = doc(db, 'orders', order.id);
    
    // Create a clean object without undefined values for Firestore
    const cleanOrder = JSON.parse(JSON.stringify(order));
    
    await setDoc(orderRef, {
      ...cleanOrder,
      updatedAt: serverTimestamp()
    });
  },

  async deleteOrder(id: string): Promise<void> {
    await deleteDoc(doc(db, 'orders', id));
  },

  async deleteAllOrders(date?: string): Promise<void> {
    const q = date 
      ? query(collection(db, 'orders'), where('orderDate', '==', date))
      : query(collection(db, 'orders'));
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  },

  async importExcel(file: File): Promise<{ message: string }> {
    // This is temporarily a stub because we will move the logic to the client in App.tsx
    throw new Error('Migrando a importación directa... Por favor use la nueva interfaz.');
  }
};
