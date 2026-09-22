import { 
  collection, 
  doc, 
  deleteDoc,
  onSnapshot, 
  runTransaction, 
  writeBatch, 
  query, 
  orderBy, 
  getDocsFromServer,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer, CustomerPayment, CashRegister, CashMovement, CustomerType } from '../types';

const CUSTOMERS_COLLECTION = 'customers';
const PAYMENTS_COLLECTION = 'customer_payments';
const CASH_REGISTERS_COLLECTION = 'cash_registers';
const CASH_MOVEMENTS_COLLECTION = 'cash_movements';

export class CustomerRepository {
  /**
   * Suscripción en tiempo real al directorio de clientes directamente desde Firestore.
   */
  static subscribeCustomers(
    onData: (customers: Customer[], metadata: { fromCache: boolean; hasPendingWrites: boolean }) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, CUSTOMERS_COLLECTION), orderBy('name', 'asc'));

    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const customers: Customer[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          customers.push({
            id: d.id,
            ...data,
            customerType: data.customerType || 'retail',
          } as Customer);
        });
        onData(customers, {
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });
      },
      (error) => {
        console.error('Error escuchando clientes:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Suscripción en tiempo real a los comprobantes de abono o pagos de un cliente.
   */
  static subscribeCustomerPayments(
    customerId: string,
    onData: (payments: CustomerPayment[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, PAYMENTS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const payments: CustomerPayment[] = [];
        snapshot.forEach((d) => {
          const item = { id: d.id, ...d.data() } as CustomerPayment;
          if (item.customerId === customerId) {
            payments.push(item);
          }
        });
        onData(payments);
      },
      (error) => {
        console.error('Error escuchando pagos:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Obtención directa de clientes desde el servidor remoto sin caché local.
   */
  static async getCustomersFromServer(): Promise<Customer[]> {
    const q = query(collection(db, CUSTOMERS_COLLECTION), orderBy('name', 'asc'));
    const snapshot = await getDocsFromServer(q);
    const list: Customer[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        ...data,
        customerType: data.customerType || 'retail',
      } as Customer);
    });
    return list;
  }

  /**
   * Registra un nuevo cliente (minorista o mayorista) en Firestore.
   */
  static async createCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'currentDebt' | 'totalPurchases'>): Promise<string> {
    const now = Date.now();
    const ref = doc(collection(db, CUSTOMERS_COLLECTION));
    const newCustomer: Customer = {
      ...data,
      customerType: data.customerType || 'retail',
      id: ref.id,
      currentDebt: 0,
      totalPurchases: 0,
      createdAt: now,
      updatedAt: now,
    };
    const batch = writeBatch(db);
    batch.set(ref, newCustomer);
    await batch.commit();
    return ref.id;
  }

  /**
   * Actualiza el perfil o datos fiscales de un cliente existente.
   */
  static async updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
    const ref = doc(db, CUSTOMERS_COLLECTION, id);
    const batch = writeBatch(db);
    batch.update(ref, {
      ...updates,
      updatedAt: Date.now(),
    });
    await batch.commit();
  }

  /**
   * Elimina un cliente del directorio en Firestore utilizando deleteDoc.
   */
  static async deleteCustomer(customerId: string): Promise<void> {
    const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    await deleteDoc(customerRef);
  }

  /**
   * Registra un abono a cuenta corriente de forma atómica mediante transacción en Firestore.
   * Actualiza la deuda del cliente y, si el pago fue en efectivo, ingresa el movimiento a caja.
   */
  static async registerDebtPayment(
    paymentData: Omit<CustomerPayment, 'id' | 'createdAt' | 'createdBy'>,
    userName = 'Cajero'
  ): Promise<string> {
    return await runTransaction(db, async (transaction) => {
      const customerRef = doc(db, CUSTOMERS_COLLECTION, paymentData.customerId);
      const customerSnap = await transaction.get(customerRef);

      if (!customerSnap.exists()) {
        throw new Error('El cliente no existe.');
      }

      const customer = customerSnap.data() as Customer;
      const currentDebt = customer.currentDebt || 0;

      if (paymentData.amount <= 0) {
        throw new Error('El monto del abono debe ser mayor a 0.');
      }

      const newDebt = Math.max(0, currentDebt - paymentData.amount);
      const now = Date.now();
      const paymentRef = doc(collection(db, PAYMENTS_COLLECTION));

      // 1. Actualizar el saldo de deuda del cliente
      transaction.update(customerRef, {
        currentDebt: newDebt,
        updatedAt: now,
      });

      // 2. Registrar el documento de comprobante de pago
      const record: CustomerPayment = {
        ...paymentData,
        id: paymentRef.id,
        createdAt: now,
        createdBy: userName,
      };
      transaction.set(paymentRef, record);

      // 3. Si el pago fue en efectivo y se especificó caja abierta, registrar el ingreso de dinero
      if (paymentData.paymentMethod === 'cash' && paymentData.cashRegisterId) {
        const regRef = doc(db, CASH_REGISTERS_COLLECTION, paymentData.cashRegisterId);
        const regSnap = await transaction.get(regRef);
        if (regSnap.exists()) {
          const reg = regSnap.data() as CashRegister;
          if (reg.status === 'open') {
            transaction.update(regRef, {
              totalIncomes: (reg.totalIncomes || 0) + paymentData.amount,
            });

            const movRef = doc(collection(db, CASH_MOVEMENTS_COLLECTION));
            const mov: CashMovement = {
              id: movRef.id,
              cashRegisterId: paymentData.cashRegisterId,
              type: 'income',
              amount: paymentData.amount,
              reason: `Abono a cuenta (${customer.customerType === 'wholesale' ? 'Mayorista' : 'Detal'}) - ${customer.name}`,
              createdAt: now,
              createdBy: userName,
            };
            transaction.set(movRef, mov);
          }
        }
      }

      return paymentRef.id;
    });
  }

  /**
   * Carga clientes de demostración salvadoreños (detal y mayoreo) si la base de datos está vacía.
   */
  static async seedSampleCustomers(): Promise<number> {
    const batch = writeBatch(db);
    const now = Date.now();

    const sampleCustomers: Array<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        name: 'Inversiones y Variedades Cuscatlán S.A. de C.V.',
        businessName: 'Distribuidora Cuscatlán El Salvador',
        documentType: 'NIT',
        documentId: '0614-220815-101-9',
        nrc: '284910-3',
        nit: '0614-220815-101-9',
        commercialActivity: 'Comercialización y Distribución de Artículos de Bazar y Novedades al por Mayor',
        customerType: 'wholesale',
        phone: '+503 2289-4455',
        email: 'ventas@distribuidoracuscatlan.sv',
        department: 'San Salvador',
        municipality: 'San Salvador',
        address: 'Zona Industrial Merliot, Calle L-3, Bodega 12',
        isWithholdingAgent: true, // Gran Contribuyente
        creditLimit: 2500.00,
        currentDebt: 450.00,
        totalPurchases: 6850.00,
      },
      {
        name: 'Comercial & Boutique San Miguel S.A. de C.V.',
        businessName: 'Boutique San Miguel Express',
        documentType: 'NIT',
        documentId: '1217-100418-102-1',
        nrc: '194820-4',
        nit: '1217-100418-102-1',
        commercialActivity: 'Venta de Ropa Interior, Vestidos y Leggings',
        customerType: 'wholesale',
        phone: '+503 2661-8890',
        email: 'gerencia@boutiquesanmiguel.com.sv',
        department: 'San Miguel',
        municipality: 'San Miguel',
        address: 'Av. Roosevelt Sur, C.C. Plaza Viva, Local 22',
        isWithholdingAgent: false,
        creditLimit: 1200.00,
        currentDebt: 0.00,
        totalPurchases: 3420.00,
      },
      {
        name: 'María Elena Rodríguez de Palacios',
        documentType: 'DUI',
        documentId: '02845619-3',
        customerType: 'retail',
        phone: '+503 7234-5567',
        email: 'maria.elena.rdz@gmail.com',
        department: 'La Libertad',
        municipality: 'Santa Tecla',
        address: 'Col. Utila, Polígono E, Casa #14',
        creditLimit: 150.00,
        currentDebt: 25.50,
        totalPurchases: 240.00,
      },
      {
        name: 'Carlos Andrés Mendoza Flores',
        documentType: 'DUI',
        documentId: '01589012-7',
        customerType: 'retail',
        phone: '+503 7899-1234',
        email: 'carlos.mendoza.sv@hotmail.com',
        department: 'San Salvador',
        municipality: 'Mejicanos',
        address: 'Residencial San Pedro, Calle Los Cipreses #8',
        creditLimit: 200.00,
        currentDebt: 0.00,
        totalPurchases: 450.00,
      },
      {
        name: 'Valentina Sofía Colmenares',
        documentType: 'DUI',
        documentId: '03412345-6',
        customerType: 'retail',
        phone: '+503 7654-3210',
        email: 'vale.colmenares@gmail.com',
        department: 'Santa Ana',
        municipality: 'Santa Ana',
        address: 'Barrio San Sebastián, 8a Av. Sur #15',
        creditLimit: 100.00,
        currentDebt: 42.00,
        totalPurchases: 185.00,
      },
    ];

    for (const c of sampleCustomers) {
      const ref = doc(collection(db, CUSTOMERS_COLLECTION));
      batch.set(ref, {
        ...c,
        id: ref.id,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
    return sampleCustomers.length;
  }
}
