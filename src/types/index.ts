export type UserRole = 'admin' | 'cashier' | 'inventory';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  pin?: string; // PIN de seguridad de 4 a 6 dígitos persistido en Firestore
  createdAt: number;
  updatedAt: number;
}

export interface PinAuthResult {
  success: boolean;
  authorizedRole?: UserRole;
  authorizedUserName?: string;
  isSuperAdminOverride?: boolean;
  message?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt?: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  costPrice: number;
  sellingPrice: number; // Precio al detal / unidad (1 - 5 unidades)
  halfDozenPrice?: number; // Precio unitario por media docena (6 - 11 unidades)
  dozenPrice?: number; // Precio unitario por docena (12 o más unidades)
  wholesalePrice?: number; // Compatibilidad con productos previos
  wholesaleMinQty?: number; // Compatibilidad con productos previos
  stock: number;
  minStockAlert: number;
  unit: string; // Unidad de medida: 'unidad', 'paquete', 'docena', 'metro', 'caja', etc.
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export type PriceType = 'retail' | 'half_dozen' | 'dozen' | 'wholesale';

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number; // Precio unitario en USD
  costPrice: number;
  quantity: number;
  subtotal: number;
  appliedPriceType?: PriceType; // Tipo de tarifa aplicada: 'retail' (detal) o 'wholesale' (mayoreo)
  retailPriceSnapshot?: number; // Instantánea del precio detal para calcular ahorro obtenido
  wholesalePriceSnapshot?: number;
}

// Métodos de pago adaptados a El Salvador
export type PaymentMethod = 
  | 'cash'             // Efectivo ($ USD)
  | 'card'             // Tarjeta Débito / Crédito
  | 'bank_transfer'    // Transferencia Bancaria (BAC, Agrícola, Cuscatlán, Davivienda, etc.)
  | 'transfer365'      // Transfer365 / Transfer365 CA
  | 'chivo_wallet'     // Chivo Wallet / Bitcoin (Sats / Lightning)
  | 'tigo_money'       // Tigo Money / Billetera Móvil
  | 'credit'           // Crédito / Fiado (Cuentas por cobrar)
  | 'transfer'         // Compatibilidad
  | 'mobile_pay';      // Compatibilidad

export type CustomerType = 'retail' | 'wholesale';

// Tipos de comprobantes tributarios de El Salvador
export type InvoiceType = 
  | 'consumer_invoice' // Factura de Consumidor Final
  | 'tax_credit'       // Comprobante de Crédito Fiscal (CCF)
  | 'ticket';          // Tiquete de Caja / Recibo Interno

export interface Sale {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType; // Tipo de Comprobante (Factura Consumidor Final, CCF, Tiquete)
  items: SaleItem[];
  subtotal: number; // Sumas netas gravadas (USD)
  discount: number;
  taxRate: number; // 0.13 (13% IVA en El Salvador)
  tax: number; // IVA 13% calculado
  retentionApplied?: boolean; // Gran Contribuyente (1% Retención de IVA)
  retentionAmount?: number; // Monto retenido (1% de subtotal gravado)
  total: number; // Total a pagar en USD
  saleType: PriceType; // 'retail' o 'wholesale'
  totalSavings?: number; // Ahorro total acumulado por precios mayoristas
  paymentMethod: PaymentMethod;
  paymentStatus: 'paid' | 'pending';
  paymentDetails?: {
    bankName?: string;
    referenceNumber?: string;
    btcSats?: number;
    walletAddress?: string;
    notes?: string;
  };
  customerId?: string;
  customerName?: string;
  customerType?: CustomerType;
  customerDocumentType?: 'DUI' | 'NIT' | 'NRC';
  customerDocumentId?: string; // DUI o NIT
  customerNrc?: string; // Número de Registro de Contribuyente (para CCF)
  customerNit?: string; // NIT (para CCF)
  customerGiro?: string; // Giro comercial / Actividad económica
  customerBusinessName?: string; // Razón Social
  customerDepartment?: string; // Departamento de El Salvador
  customerMunicipality?: string; // Municipio
  cashRegisterId?: string;
  notes?: string;
  amountReceived?: number;
  changeGiven?: number;
  isCancelled?: boolean;
  cancelledAt?: number;
  cancellationReason?: string;
  cancelledBy?: string;
  createdAt: number;
  createdBy: string;
}

export interface Customer {
  id: string;
  name: string; // Nombre del contacto o cliente
  businessName?: string; // Razón social / Nombre de negocio (para empresas/mayoristas)
  documentType?: 'DUI' | 'NIT' | 'NRC';
  documentId: string; // DUI (00000000-0) o NIT
  nrc?: string; // Número de Registro de Contribuyente (ej. 298341-7)
  nit?: string; // Número de Identificación Tributaria (ej. 0614-150992-102-4)
  commercialActivity?: string; // Giro Comercial / Actividad Económica (Requerido para CCF / Mayoristas)
  customerType: CustomerType; // 'retail' (Detal) | 'wholesale' (Mayorista)
  phone: string; // Formato +503 XXXX-XXXX
  email?: string;
  department?: string; // Departamento (San Salvador, Santa Ana, San Miguel, etc.)
  municipality?: string; // Municipio
  address?: string; // Dirección detallada en El Salvador
  isWithholdingAgent?: boolean; // Gran Contribuyente / Agente de Retención de IVA (1%)
  creditLimit: number; // En USD
  currentDebt: number; // En USD
  totalPurchases: number; // En USD
  createdAt: number;
  updatedAt: number;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number; // USD
  paymentMethod: PaymentMethod;
  paymentDetails?: {
    bankName?: string;
    referenceNumber?: string;
  };
  notes?: string;
  cashRegisterId?: string;
  createdAt: number;
  createdBy: string;
}

export interface CashRegister {
  id: string;
  status: 'open' | 'closed';
  openedAt: number;
  closedAt?: number;
  openedBy: string;
  closedBy?: string;
  openingBalance: number; // USD
  closingBalance?: number;
  expectedBalance?: number;
  discrepancy?: number;
  totalCashSales: number;
  totalOtherSales: number;
  totalIncomes: number;
  totalExpenses: number;
  notes?: string;
}

export interface CashMovement {
  id: string;
  cashRegisterId: string;
  type: 'income' | 'expense';
  amount: number; // USD
  reason: string;
  createdAt: number;
  createdBy: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'sale' | 'purchase' | 'adjustment' | 'return' | 'initial' | 'price_change';
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceId?: string;
  createdAt: number;
  createdBy: string;
}

export interface SyncStatus {
  isOnline: boolean;
  hasPendingWrites: boolean;
  lastSyncTime: number;
  latencyMs: number;
  activeListenersCount: number;
  serverDirectMode: boolean;
}
