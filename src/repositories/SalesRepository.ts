import { 
  collection, 
  doc, 
  onSnapshot, 
  runTransaction, 
  query, 
  orderBy, 
  getDocs,
  Unsubscribe
} from 'firebase/firestore';
import { db, sanitizeFirestoreData } from '../lib/firebase';
import { Sale, Product, StockMovement, Customer, CashRegister } from '../types';

const SALES_COLLECTION = 'sales';
const PRODUCTS_COLLECTION = 'products';
const STOCK_MOVEMENTS_COLLECTION = 'stock_movements';
const CUSTOMERS_COLLECTION = 'customers';
const CASH_REGISTERS_COLLECTION = 'cash_registers';

export class SalesRepository {
  /**
   * Suscripción en tiempo real al registro de ventas directamente desde el servidor Firestore.
   */
  static subscribeSales(
    onData: (sales: Sale[], metadata: { fromCache: boolean; hasPendingWrites: boolean }) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, SALES_COLLECTION), orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const sales: Sale[] = [];
        snapshot.forEach((docSnap) => {
          sales.push({ id: docSnap.id, ...docSnap.data() } as Sale);
        });
        onData(sales, {
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });
      },
      (error) => {
        console.error('Error escuchando historial de ventas:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Consulta directa de ventas desde el servidor remoto sin usar caché local en disco.
   */
  static async getSalesFromServer(): Promise<Sale[]> {
    const q = query(collection(db, SALES_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const sales: Sale[] = [];
    snapshot.forEach((docSnap) => {
      sales.push({ id: docSnap.id, ...docSnap.data() } as Sale);
    });
    return sales;
  }

  /**
   * Procesa y liquida una venta utilizando una TRANSACCIÓN ATÓMICA en Firestore.
   * Regla de consistencia: TODAS las LECTURAS se ejecutan antes de cualquier ESCRITURA.
   */
  static async processSale(
    saleData: Omit<Sale, 'id' | 'createdAt' | 'invoiceNumber'>,
    userName = 'Cajero'
  ): Promise<string> {
    return await runTransaction(db, async (transaction) => {
      // 1. PRIMER PASO: LEER EL STOCK DE TODOS LOS PRODUCTOS Y VALIDAR EXISTENCIAS
      const productDocs: { ref: any; currentStock: number; product: Product; requestedQty: number; item: any }[] = [];

      for (const item of saleData.items) {
        const pRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const pSnap = await transaction.get(pRef);

        if (!pSnap.exists()) {
          throw new Error(`El producto "${item.productName}" no fue encontrado en la base de datos.`);
        }

        const product = pSnap.data() as Product;
        if (product.stock < item.quantity) {
          throw new Error(
            `Stock insuficiente para "${product.name}". Disponible en servidor: ${product.stock} ${product.unit}(s), solicitados: ${item.quantity}.`
          );
        }

        productDocs.push({
          ref: pRef,
          currentStock: product.stock,
          product,
          requestedQty: item.quantity,
          item,
        });
      }

      // 2. SEGUNDO PASO: LEER DATOS DEL CLIENTE Y VALIDAR LÍMITE DE CRÉDITO SI APLICA
      let customerRef: any = null;
      let currentCustomer: Customer | null = null;
      if (saleData.customerId) {
        customerRef = doc(db, CUSTOMERS_COLLECTION, saleData.customerId);
        const cSnap = await transaction.get(customerRef);
        if (cSnap.exists()) {
          currentCustomer = cSnap.data() as Customer;
          if (saleData.paymentMethod === 'credit') {
            const newDebt = (currentCustomer.currentDebt || 0) + saleData.total;
            if (currentCustomer.creditLimit > 0 && newDebt > currentCustomer.creditLimit) {
              throw new Error(
                `Límite de crédito excedido para ${currentCustomer.name}. Límite: $${currentCustomer.creditLimit.toFixed(2)}, Deuda proyectada: $${newDebt.toFixed(2)}.`
              );
            }
          }
        }
      }

      // 3. TERCER PASO: LEER LA CAJA ACTIVA PARA REGISTRAR LOS TOTALES
      let cashRegisterRef: any = null;
      let activeRegister: CashRegister | null = null;
      if (saleData.cashRegisterId) {
        cashRegisterRef = doc(db, CASH_REGISTERS_COLLECTION, saleData.cashRegisterId);
        const regSnap = await transaction.get(cashRegisterRef);
        if (regSnap.exists()) {
          activeRegister = regSnap.data() as CashRegister;
        }
      }

      // 4. CUARTO PASO: EJECUTAR TODAS LAS ESCRITURAS DE FORMA ATÓMICA
      const now = Date.now();
      const saleRef = doc(collection(db, SALES_COLLECTION));
      const prefix = saleData.invoiceType === 'tax_credit' ? 'CCF' : saleData.invoiceType === 'ticket' ? 'TIQ' : 'FAC';
      const invoiceNumber = `${prefix}-${now.toString().slice(-6)}`;

      // A) Actualizar existencias de productos y generar movimientos en Kardex
      for (const p of productDocs) {
        const newStock = p.currentStock - p.requestedQty;
        transaction.update(p.ref, {
          stock: newStock,
          updatedAt: now,
        });

        const movementRef = doc(collection(db, STOCK_MOVEMENTS_COLLECTION));
        const movement: StockMovement = {
          id: movementRef.id,
          productId: p.product.id,
          productName: p.product.name,
          type: 'sale',
          quantityChange: -p.requestedQty,
          previousStock: p.currentStock,
          newStock,
          reason: `Venta #${invoiceNumber}`,
          referenceId: saleRef.id,
          createdAt: now,
          createdBy: userName,
        };
        transaction.set(movementRef, movement);
      }

      // B) Actualizar la cuenta corriente del cliente (deuda y compras acumuladas)
      if (customerRef && currentCustomer) {
        const updates: Partial<Customer> = {
          totalPurchases: (currentCustomer.totalPurchases || 0) + saleData.total,
          updatedAt: now,
        };
        if (saleData.paymentMethod === 'credit') {
          updates.currentDebt = (currentCustomer.currentDebt || 0) + saleData.total;
        }
        transaction.update(customerRef, updates);
      }

      // C) Actualizar acumulados de la caja abierta
      if (cashRegisterRef && activeRegister && activeRegister.status === 'open') {
        if (saleData.paymentMethod === 'cash') {
          transaction.update(cashRegisterRef, {
            totalCashSales: (activeRegister.totalCashSales || 0) + saleData.total,
          });
        } else if (saleData.paymentMethod !== 'credit') {
          transaction.update(cashRegisterRef, {
            totalOtherSales: (activeRegister.totalOtherSales || 0) + saleData.total,
          });
        }
      }

      // D) Guardar el documento definitivo de la venta
      const newSale: Sale = {
        ...saleData,
        id: saleRef.id,
        invoiceNumber,
        createdAt: now,
        createdBy: userName,
      };

      transaction.set(saleRef, sanitizeFirestoreData(newSale));
      return saleRef.id;
    });
  }

  /**
   * Anula una venta y restituye atómicamente el inventario, la deuda del cliente y los registros de auditoría.
   */
  static async cancelSale(
    saleId: string, 
    reason: string, 
    userName = 'Admin'
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      // 1. Leer el documento de la venta
      const saleRef = doc(db, SALES_COLLECTION, saleId);
      const saleSnap = await transaction.get(saleRef);

      if (!saleSnap.exists()) {
        throw new Error('La venta no existe.');
      }

      const sale = saleSnap.data() as Sale;
      if (sale.isCancelled) {
        throw new Error('Esta venta ya fue anulada previamente.');
      }

      // 2. Leer todos los productos involucrados antes de escribir
      const productsToRestore: { ref: any; currentStock: number; prod: Product; itemQty: number }[] = [];
      for (const item of sale.items) {
        const pRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const pSnap = await transaction.get(pRef);
        if (pSnap.exists()) {
          productsToRestore.push({
            ref: pRef,
            currentStock: (pSnap.data() as Product).stock,
            prod: pSnap.data() as Product,
            itemQty: item.quantity,
          });
        }
      }

      // 3. Leer el cliente si la venta fue efectuada a crédito
      let customerRef: any = null;
      let currentCustomer: Customer | null = null;
      if (sale.customerId && sale.paymentMethod === 'credit') {
        customerRef = doc(db, CUSTOMERS_COLLECTION, sale.customerId);
        const cSnap = await transaction.get(customerRef);
        if (cSnap.exists()) {
          currentCustomer = cSnap.data() as Customer;
        }
      }

      const now = Date.now();

      // 4. ESCRITURAS: Reintegrar existencias al inventario y asentar en Kardex
      for (const p of productsToRestore) {
        const restoredStock = p.currentStock + p.itemQty;
        transaction.update(p.ref, {
          stock: restoredStock,
          updatedAt: now,
        });

        const movRef = doc(collection(db, STOCK_MOVEMENTS_COLLECTION));
        const movement: StockMovement = {
          id: movRef.id,
          productId: p.prod.id,
          productName: p.prod.name,
          type: 'return',
          quantityChange: p.itemQty,
          previousStock: p.currentStock,
          newStock: restoredStock,
          reason: `Anulación venta #${sale.invoiceNumber}: ${reason}`,
          referenceId: sale.id,
          createdAt: now,
          createdBy: userName,
        };
        transaction.set(movRef, movement);
      }

      // 5. Revertir saldo deudor del cliente si la transacción fue a crédito
      if (customerRef && currentCustomer) {
        const newDebt = Math.max(0, (currentCustomer.currentDebt || 0) - sale.total);
        transaction.update(customerRef, {
          currentDebt: newDebt,
          updatedAt: now,
        });
      }

      // 6. Marcar la venta como anulada
      transaction.update(saleRef, {
        isCancelled: true,
        cancelledAt: now,
        cancellationReason: reason,
        cancelledBy: userName,
      });
    });
  }
}
