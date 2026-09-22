import { 
  collection, 
  doc, 
  onSnapshot, 
  runTransaction, 
  writeBatch,
  query, 
  where,
  orderBy, 
  getDocsFromServer,
  getDocFromServer,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CashRegister, CashMovement } from '../types';

const CASH_REGISTERS_COLLECTION = 'cash_registers';
const CASH_MOVEMENTS_COLLECTION = 'cash_movements';

export class CashRegisterRepository {
  /**
   * Suscripción en tiempo real a la caja activa o turno de caja abierto en Firestore.
   */
  static subscribeActiveRegister(
    onData: (register: CashRegister | null, metadata: { fromCache: boolean; hasPendingWrites: boolean }) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, CASH_REGISTERS_COLLECTION),
      where('status', '==', 'open'),
      orderBy('openedAt', 'desc')
    );

    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.empty) {
          onData(null, {
            fromCache: snapshot.metadata.fromCache,
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
          });
          return;
        }
        const docSnap = snapshot.docs[0];
        onData({ id: docSnap.id, ...docSnap.data() } as CashRegister, {
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });
      },
      (error) => {
        console.error('Error escuchando caja activa:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Suscripción en tiempo real a todos los turnos y cortes de caja históricos.
   */
  static subscribeAllRegisters(
    onData: (registers: CashRegister[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, CASH_REGISTERS_COLLECTION), orderBy('openedAt', 'desc'));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const list: CashRegister[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as CashRegister));
        onData(list);
      },
      (error) => {
        console.error('Error escuchando historial de cajas:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Suscripción en tiempo real a los movimientos de efectivo (entradas y salidas) de un turno de caja.
   */
  static subscribeMovements(
    cashRegisterId: string,
    onData: (movements: CashMovement[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, CASH_MOVEMENTS_COLLECTION),
      where('cashRegisterId', '==', cashRegisterId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const movements: CashMovement[] = [];
        snapshot.forEach((d) => movements.push({ id: d.id, ...d.data() } as CashMovement));
        onData(movements);
      },
      (error) => {
        console.error('Error escuchando movimientos de caja:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Apertura de un nuevo turno de caja de forma atómica.
   * Verifica primero en el servidor que no exista otro turno abierto simultáneamente.
   */
  static async openRegister(openingBalance: number, userName = 'Cajero'): Promise<string> {
    return await runTransaction(db, async (transaction) => {
      // Verificar si ya existe una caja abierta en el sistema
      const q = query(collection(db, CASH_REGISTERS_COLLECTION), where('status', '==', 'open'));
      const snapshot = await getDocsFromServer(q);

      if (!snapshot.empty) {
        throw new Error('Ya existe una caja abierta actualmente. Debe cerrarla antes de abrir una nueva.');
      }

      const now = Date.now();
      const newRef = doc(collection(db, CASH_REGISTERS_COLLECTION));
      const newRegister: CashRegister = {
        id: newRef.id,
        status: 'open',
        openedAt: now,
        openedBy: userName,
        openingBalance,
        totalCashSales: 0,
        totalOtherSales: 0,
        totalIncomes: 0,
        totalExpenses: 0,
      };

      transaction.set(newRef, newRegister);
      return newRef.id;
    });
  }

  /**
   * Realiza el cierre o corte de turno de caja y calcula discrepancias de forma atómica.
   */
  static async closeRegister(
    cashRegisterId: string,
    closingBalance: number,
    notes: string,
    userName = 'Cajero'
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      const regRef = doc(db, CASH_REGISTERS_COLLECTION, cashRegisterId);
      const snap = await transaction.get(regRef);

      if (!snap.exists()) {
        throw new Error('La caja especificada no existe.');
      }

      const reg = snap.data() as CashRegister;
      if (reg.status === 'closed') {
        throw new Error('Esta caja ya está cerrada.');
      }

      const expectedBalance = 
        (reg.openingBalance || 0) + 
        (reg.totalCashSales || 0) + 
        (reg.totalIncomes || 0) - 
        (reg.totalExpenses || 0);

      const discrepancy = closingBalance - expectedBalance;
      const now = Date.now();

      transaction.update(regRef, {
        status: 'closed',
        closedAt: now,
        closedBy: userName,
        closingBalance,
        expectedBalance,
        discrepancy,
        notes: notes || '',
      });
    });
  }

  /**
   * Registra un ingreso o egreso de caja y actualiza los totales acumulados del turno de forma atómica.
   */
  static async addMovement(
    cashRegisterId: string,
    type: 'income' | 'expense',
    amount: number,
    reason: string,
    userName = 'Cajero'
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      const regRef = doc(db, CASH_REGISTERS_COLLECTION, cashRegisterId);
      const snap = await transaction.get(regRef);

      if (!snap.exists()) {
        throw new Error('La caja especificada no existe.');
      }

      const reg = snap.data() as CashRegister;
      if (reg.status !== 'open') {
        throw new Error('No se pueden registrar movimientos en una caja cerrada.');
      }

      const now = Date.now();
      const movRef = doc(collection(db, CASH_MOVEMENTS_COLLECTION));

      const movement: CashMovement = {
        id: movRef.id,
        cashRegisterId,
        type,
        amount,
        reason,
        createdAt: now,
        createdBy: userName,
      };

      transaction.set(movRef, movement);

      if (type === 'income') {
        transaction.update(regRef, {
          totalIncomes: (reg.totalIncomes || 0) + amount,
        });
      } else {
        transaction.update(regRef, {
          totalExpenses: (reg.totalExpenses || 0) + amount,
        });
      }
    });
  }
}
