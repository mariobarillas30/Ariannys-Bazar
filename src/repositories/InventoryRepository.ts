import { 
  collection, 
  doc, 
  deleteDoc,
  onSnapshot, 
  runTransaction, 
  writeBatch, 
  query, 
  orderBy, 
  getDocs, 
  getDoc,
  Unsubscribe
} from 'firebase/firestore';
import { db, sanitizeFirestoreData } from '../lib/firebase';
import { Category, Product, StockMovement } from '../types';

const PRODUCTS_COLLECTION = 'products';
const STOCK_MOVEMENTS_COLLECTION = 'stock_movements';
const CATEGORIES_COLLECTION = 'categories';

export class InventoryRepository {
  /**
   * Suscripción en tiempo real al catálogo de productos directamente desde Firestore.
   * includeMetadataChanges: true permite detectar si los datos provienen del servidor o hay escrituras locales pendientes.
   */
  static subscribeProducts(
    onData: (products: Product[], metadata: { fromCache: boolean; hasPendingWrites: boolean }) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, PRODUCTS_COLLECTION), orderBy('name', 'asc'));
    
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const products: Product[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const retail = data.sellingPrice || 0;
          const halfDozen = data.halfDozenPrice !== undefined 
            ? data.halfDozenPrice 
            : (data.wholesalePrice !== undefined ? data.wholesalePrice : Number((retail * 0.85).toFixed(2)));
          const dozen = data.dozenPrice !== undefined 
            ? data.dozenPrice 
            : (data.wholesalePrice !== undefined ? Number((data.wholesalePrice * 0.95).toFixed(2)) : Number((retail * 0.75).toFixed(2)));

          products.push({
            id: docSnap.id,
            ...data,
            halfDozenPrice: halfDozen,
            dozenPrice: dozen,
            wholesalePrice: dozen,
            wholesaleMinQty: 6,
          } as Product);
        });
        onData(products, {
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });
      },
      (error) => {
        console.error('Error escuchando catálogo de productos:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Suscripción en tiempo real al historial de movimientos de inventario (Kardex).
   */
  static subscribeStockMovements(
    onData: (movements: StockMovement[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, STOCK_MOVEMENTS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const movements: StockMovement[] = [];
        snapshot.forEach((docSnap) => {
          movements.push({ id: docSnap.id, ...docSnap.data() } as StockMovement);
        });
        onData(movements);
      },
      (error) => {
        console.error('Error escuchando movimientos de inventario:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Obtiene la lista de productos forzando una consulta directa al servidor remoto de Firestore.
   */
  static async getProductsFromServer(): Promise<Product[]> {
    const q = query(collection(db, PRODUCTS_COLLECTION), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    const products: Product[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const retail = data.sellingPrice || 0;
      const halfDozen = data.halfDozenPrice !== undefined 
        ? data.halfDozenPrice 
        : (data.wholesalePrice !== undefined ? data.wholesalePrice : Number((retail * 0.85).toFixed(2)));
      const dozen = data.dozenPrice !== undefined 
        ? data.dozenPrice 
        : (data.wholesalePrice !== undefined ? Number((data.wholesalePrice * 0.95).toFixed(2)) : Number((retail * 0.75).toFixed(2)));

      products.push({
        id: docSnap.id,
        ...data,
        halfDozenPrice: halfDozen,
        dozenPrice: dozen,
        wholesalePrice: dozen,
        wholesaleMinQty: 6,
      } as Product);
    });
    return products;
  }

  /**
   * Obtiene los datos de un producto específico directamente desde el servidor.
   */
  static async getProductFromServer(id: string): Promise<Product | null> {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    const retail = data.sellingPrice || 0;
    const halfDozen = data.halfDozenPrice !== undefined 
      ? data.halfDozenPrice 
      : (data.wholesalePrice !== undefined ? data.wholesalePrice : Number((retail * 0.85).toFixed(2)));
    const dozen = data.dozenPrice !== undefined 
      ? data.dozenPrice 
      : (data.wholesalePrice !== undefined ? Number((data.wholesalePrice * 0.95).toFixed(2)) : Number((retail * 0.75).toFixed(2)));

    return {
      id: docSnap.id,
      ...data,
      halfDozenPrice: halfDozen,
      dozenPrice: dozen,
      wholesalePrice: dozen,
      wholesaleMinQty: 6,
    } as Product;
  }

  /**
   * Registra un nuevo producto y genera su correspondiente movimiento de inventario inicial.
   */
  static async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, userName = 'Admin'): Promise<string> {
    const now = Date.now();
    const productRef = doc(collection(db, PRODUCTS_COLLECTION));
    const batch = writeBatch(db);

    const retail = productData.sellingPrice || 0;
    const halfDozen = productData.halfDozenPrice !== undefined 
      ? productData.halfDozenPrice 
      : (productData.wholesalePrice !== undefined ? productData.wholesalePrice : Number((retail * 0.85).toFixed(2)));
    const dozen = productData.dozenPrice !== undefined 
      ? productData.dozenPrice 
      : (productData.wholesalePrice !== undefined ? Number((productData.wholesalePrice * 0.95).toFixed(2)) : Number((retail * 0.75).toFixed(2)));

    const rawProduct: Product = {
      ...productData,
      id: productRef.id,
      description: productData.description ?? '',
      barcode: productData.barcode ?? '',
      sellingPrice: retail,
      halfDozenPrice: halfDozen,
      dozenPrice: dozen,
      wholesalePrice: dozen,
      wholesaleMinQty: 6,
      createdAt: now,
      updatedAt: now,
    };

    const newProduct = sanitizeFirestoreData(rawProduct);

    batch.set(productRef, newProduct);

    if (newProduct.stock > 0) {
      const movementRef = doc(collection(db, STOCK_MOVEMENTS_COLLECTION));
      const movement: StockMovement = {
        id: movementRef.id,
        productId: productRef.id,
        productName: newProduct.name,
        type: 'initial',
        quantityChange: newProduct.stock,
        previousStock: 0,
        newStock: newProduct.stock,
        reason: 'Inventario inicial al crear producto',
        createdAt: now,
        createdBy: userName,
      };
      batch.set(movementRef, movement);
    }

    await batch.commit();
    return productRef.id;
  }

  /**
   * Actualiza los datos descriptivos o precios de un producto, registrando auditoría en el Kardex si cambian precios o mínimos.
   */
  static async updateProduct(
    id: string, 
    updates: Partial<Product>, 
    previousProduct?: Product,
    userName = 'Admin'
  ): Promise<void> {
    const now = Date.now();
    const productRef = doc(db, PRODUCTS_COLLECTION, id);
    const batch = writeBatch(db);

    const rawUpdates = {
      ...updates,
      ...(updates.description !== undefined ? { description: updates.description ?? '' } : {}),
      ...(updates.barcode !== undefined ? { barcode: updates.barcode ?? '' } : {}),
      updatedAt: now,
    };

    batch.update(productRef, sanitizeFirestoreData(rawUpdates));

    // Auditoría de cambios en precios y escalas de mayoreo
    if (previousProduct) {
      const priceOrRuleChanged = 
        (updates.sellingPrice !== undefined && updates.sellingPrice !== previousProduct.sellingPrice) ||
        (updates.halfDozenPrice !== undefined && updates.halfDozenPrice !== previousProduct.halfDozenPrice) ||
        (updates.dozenPrice !== undefined && updates.dozenPrice !== previousProduct.dozenPrice) ||
        (updates.wholesalePrice !== undefined && updates.wholesalePrice !== previousProduct.wholesalePrice) ||
        (updates.costPrice !== undefined && updates.costPrice !== previousProduct.costPrice);

      if (priceOrRuleChanged) {
        const changes: string[] = [];
        if (updates.sellingPrice !== undefined && updates.sellingPrice !== previousProduct.sellingPrice) {
          changes.push(`Unidad: $${previousProduct.sellingPrice.toFixed(2)} → $${Number(updates.sellingPrice).toFixed(2)}`);
        }
        if (updates.halfDozenPrice !== undefined && updates.halfDozenPrice !== previousProduct.halfDozenPrice) {
          const oldH = previousProduct.halfDozenPrice !== undefined ? previousProduct.halfDozenPrice : previousProduct.sellingPrice * 0.85;
          changes.push(`½ Docena: $${oldH.toFixed(2)} → $${Number(updates.halfDozenPrice).toFixed(2)}`);
        }
        if (updates.dozenPrice !== undefined && updates.dozenPrice !== previousProduct.dozenPrice) {
          const oldD = previousProduct.dozenPrice !== undefined ? previousProduct.dozenPrice : (previousProduct.wholesalePrice || previousProduct.sellingPrice * 0.75);
          changes.push(`Docena: $${oldD.toFixed(2)} → $${Number(updates.dozenPrice).toFixed(2)}`);
        }
        if (updates.costPrice !== undefined && updates.costPrice !== previousProduct.costPrice) {
          changes.push(`Costo: $${previousProduct.costPrice.toFixed(2)} → $${Number(updates.costPrice).toFixed(2)}`);
        }

        const movementRef = doc(collection(db, STOCK_MOVEMENTS_COLLECTION));
        const movement: StockMovement = {
          id: movementRef.id,
          productId: id,
          productName: updates.name || previousProduct.name,
          type: 'price_change',
          quantityChange: 0,
          previousStock: previousProduct.stock,
          newStock: previousProduct.stock,
          reason: `Actualización de Precios/Mayoreo: ${changes.join(' | ')}`,
          createdAt: now,
          createdBy: userName,
        };
        batch.set(movementRef, movement);
      }
    }

    await batch.commit();
  }

  /**
   * Ajusta la cantidad de existencias de un producto usando transacciones atómicas para prevenir condiciones de carrera.
   */
  static async adjustStock(
    productId: string,
    newStock: number,
    reason: string,
    userName = 'Cajero'
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      const productRef = doc(db, PRODUCTS_COLLECTION, productId);
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists()) {
        throw new Error('El producto no existe en el catálogo.');
      }

      const product = productSnap.data() as Product;
      const currentStock = product.stock || 0;
      const quantityDiff = newStock - currentStock;

      if (quantityDiff === 0) return;

      const now = Date.now();

      // 1. Actualizar el stock del producto en el servidor
      transaction.update(productRef, {
        stock: newStock,
        updatedAt: now,
      });

      // 2. Registrar el movimiento de auditoría en el Kardex
      const movementRef = doc(collection(db, STOCK_MOVEMENTS_COLLECTION));
      const movement: StockMovement = {
        id: movementRef.id,
        productId,
        productName: product.name,
        type: 'adjustment',
        quantityChange: quantityDiff,
        previousStock: currentStock,
        newStock,
        reason: reason || 'Ajuste manual de inventario',
        createdAt: now,
        createdBy: userName,
      };

      transaction.set(movementRef, movement);
    });
  }

  /**
   * Suscripción en tiempo real a la colección de categorías en Firestore.
   */
  static subscribeCategories(
    onData: (categories: Category[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, CATEGORIES_COLLECTION), orderBy('name', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const categories: Category[] = [];
        snapshot.forEach((docSnap) => {
          categories.push({ id: docSnap.id, ...docSnap.data() } as Category);
        });
        onData(categories);
      },
      (error) => {
        console.error('Error escuchando categorías:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Crea una nueva categoría en la colección 'categories' de Firestore.
   */
  static async createCategory(categoryName: string, description = ''): Promise<string> {
    const categoryRef = doc(collection(db, CATEGORIES_COLLECTION));
    const newCategory: Category = {
      id: categoryRef.id,
      name: categoryName,
      description,
      createdAt: Date.now(),
    };
    const batch = writeBatch(db);
    batch.set(categoryRef, newCategory);
    await batch.commit();
    return categoryRef.id;
  }

  /**
   * Elimina un producto del catálogo en Firestore utilizando deleteDoc.
   */
  static async deleteProduct(productId: string): Promise<void> {
    const productRef = doc(db, PRODUCTS_COLLECTION, productId);
    await deleteDoc(productRef);
  }

  /**
   * Elimina una categoría de la colección de categorías en Firestore utilizando deleteDoc.
   */
  static async deleteCategory(categoryId: string): Promise<void> {
    const categoryRef = doc(db, CATEGORIES_COLLECTION, categoryId);
    try {
      await deleteDoc(categoryRef);
    } catch {
      // Fallback en caso de eliminar por coincidencia de nombre
    }

    // Buscar si existe algún documento registrado por el campo name
    try {
      const q = query(collection(db, CATEGORIES_COLLECTION));
      const snapshot = await getDocs(q);
      snapshot.forEach(async (docSnap) => {
        if (docSnap.id === categoryId || docSnap.data().name === categoryId) {
          await deleteDoc(docSnap.ref);
        }
      });
    } catch (err) {
      console.warn('Eliminación alternativa de categoría:', err);
    }
  }

  /**
   * Carga el catálogo inicial demostrativo de Ariannys Bazar si la base de datos está vacía.
   */
  static async seedSampleData(userName = 'Sistema'): Promise<number> {
    const batch = writeBatch(db);
    const now = Date.now();

    const sampleProducts = [
      { 
        name: 'Brassier de Encaje Dama Copa B/C', 
        sku: 'RID-001', 
        barcode: '7506001001', 
        category: 'Ropa Interior Dama', 
        costPrice: 4.50, 
        sellingPrice: 9.50, 
        wholesalePrice: 7.00, 
        wholesaleMinQty: 6, 
        stock: 35, 
        minStockAlert: 8, 
        unit: 'unidad', 
        isActive: true 
      },
      { 
        name: 'Pack x 3 Pantis Algodón Stretch Dama', 
        sku: 'RID-002', 
        barcode: '7506001002', 
        category: 'Ropa Interior Dama', 
        costPrice: 3.20, 
        sellingPrice: 7.50, 
        wholesalePrice: 5.20, 
        wholesaleMinQty: 3, 
        stock: 40, 
        minStockAlert: 10, 
        unit: 'pack', 
        isActive: true 
      },
      { 
        name: 'Bralette de Encaje y Algodón Premium', 
        sku: 'RID-003', 
        barcode: '7506001003', 
        category: 'Ropa Interior Dama', 
        costPrice: 5.00, 
        sellingPrice: 11.00, 
        wholesalePrice: 8.00, 
        wholesaleMinQty: 4, 
        stock: 25, 
        minStockAlert: 5, 
        unit: 'unidad', 
        isActive: true 
      },
      { 
        name: 'Pack x 3 Boxer Masculino 100% Algodón', 
        sku: 'RIH-001', 
        barcode: '7507001001', 
        category: 'Ropa Interior Hombre', 
        costPrice: 4.80, 
        sellingPrice: 10.50, 
        wholesalePrice: 7.80, 
        wholesaleMinQty: 3, 
        stock: 30, 
        minStockAlert: 6, 
        unit: 'pack', 
        isActive: true 
      },
      { 
        name: 'Camiseta Interior Hombre Cuello V (Blanca)', 
        sku: 'RIH-002', 
        barcode: '7507001002', 
        category: 'Ropa Interior Hombre', 
        costPrice: 3.00, 
        sellingPrice: 6.50, 
        wholesalePrice: 4.80, 
        wholesaleMinQty: 6, 
        stock: 28, 
        minStockAlert: 5, 
        unit: 'unidad', 
        isActive: true 
      },
      { 
        name: 'Pack x 3 Pantis Infantiles Niña Estampadas', 
        sku: 'RII-001', 
        barcode: '7508001001', 
        category: 'Ropa Interior Infantil', 
        costPrice: 3.50, 
        sellingPrice: 7.50, 
        wholesalePrice: 5.20, 
        wholesaleMinQty: 4, 
        stock: 24, 
        minStockAlert: 6, 
        unit: 'pack', 
        isActive: true 
      },
      { 
        name: 'Pack x 3 Boxer Infantil Niño Algodón', 
        sku: 'RII-002', 
        barcode: '7508001002', 
        category: 'Ropa Interior Infantil', 
        costPrice: 3.80, 
        sellingPrice: 8.00, 
        wholesalePrice: 5.80, 
        wholesaleMinQty: 4, 
        stock: 20, 
        minStockAlert: 5, 
        unit: 'pack', 
        isActive: true 
      },
      { 
        name: 'Leggings Térmicos Forro Afelpado Dama', 
        sku: 'LEG-001', 
        barcode: '7509001001', 
        category: 'Leggings', 
        costPrice: 4.20, 
        sellingPrice: 9.50, 
        wholesalePrice: 6.80, 
        wholesaleMinQty: 4, 
        stock: 32, 
        minStockAlert: 8, 
        unit: 'unidad', 
        isActive: true 
      },
      { 
        name: 'Leggings Deportivos Suplex Tiro Alto', 
        sku: 'LEG-002', 
        barcode: '7509001002', 
        category: 'Leggings', 
        costPrice: 5.50, 
        sellingPrice: 12.00, 
        wholesalePrice: 8.80, 
        wholesaleMinQty: 3, 
        stock: 22, 
        minStockAlert: 5, 
        unit: 'unidad', 
        isActive: true 
      },
      { 
        name: 'Vestido Casual Estampado de Verano Dama', 
        sku: 'VES-001', 
        barcode: '7510001001', 
        category: 'Vestidos', 
        costPrice: 8.50, 
        sellingPrice: 18.50, 
        wholesalePrice: 13.50, 
        wholesaleMinQty: 3, 
        stock: 15, 
        minStockAlert: 4, 
        unit: 'unidad', 
        isActive: true 
      },
      { 
        name: 'Vestido Corto de Algodón Casual Dama', 
        sku: 'VES-002', 
        barcode: '7510001002', 
        category: 'Vestidos', 
        costPrice: 9.00, 
        sellingPrice: 19.50, 
        wholesalePrice: 14.20, 
        wholesaleMinQty: 3, 
        stock: 12, 
        minStockAlert: 3, 
        unit: 'unidad', 
        isActive: true 
      },
      { 
        name: 'Pack x 6 Calcetines Tobilleros Deportivos', 
        sku: 'CAL-001', 
        barcode: '7511001001', 
        category: 'Calcetines & Medias', 
        costPrice: 2.50, 
        sellingPrice: 5.50, 
        wholesalePrice: 3.80, 
        wholesaleMinQty: 6, 
        stock: 50, 
        minStockAlert: 10, 
        unit: 'pack', 
        isActive: true 
      },
      { 
        name: 'Medias Panty Translucidas Dama Talla Única', 
        sku: 'CAL-002', 
        barcode: '7511001002', 
        category: 'Calcetines & Medias', 
        costPrice: 1.80, 
        sellingPrice: 4.20, 
        wholesalePrice: 2.90, 
        wholesaleMinQty: 5, 
        stock: 45, 
        minStockAlert: 10, 
        unit: 'unidad', 
        isActive: true 
      }
    ];

    for (const item of sampleProducts) {
      const pRef = doc(collection(db, PRODUCTS_COLLECTION));
      const pData: Product = {
        ...item,
        id: pRef.id,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(pRef, pData);

      const mRef = doc(collection(db, STOCK_MOVEMENTS_COLLECTION));
      const mData: StockMovement = {
        id: mRef.id,
        productId: pRef.id,
        productName: pData.name,
        type: 'initial',
        quantityChange: pData.stock,
        previousStock: 0,
        newStock: pData.stock,
        reason: 'Carga inicial de catálogo demostrativo con tarifas Detal y Mayoreo',
        createdAt: now,
        createdBy: userName,
      };
      batch.set(mRef, mData);
    }

    await batch.commit();
    return sampleProducts.length;
  }
}
