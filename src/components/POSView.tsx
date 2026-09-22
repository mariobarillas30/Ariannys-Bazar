import { useState, useMemo } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  UserCheck, 
  CheckCircle2, 
  AlertCircle, 
  Banknote, 
  CreditCard, 
  ArrowRightLeft, 
  Smartphone, 
  Clock, 
  Tag, 
  Sparkles, 
  Building2, 
  Zap,
  FileText,
  Percent,
  Receipt,
  KeyRound,
  Lock,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, Sale, SaleItem, Customer, CashRegister, PriceType, PaymentMethod, InvoiceType, PinAuthResult } from '../types';
import { SalesRepository } from '../repositories/SalesRepository';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';
import { SALVADORAN_BANKS, COMPANY_INFO_SV } from '../lib/elSalvadorData';
import { PinVerificationModal } from './PinVerificationModal';

interface POSViewProps {
  products: Product[];
  customers: Customer[];
  activeCashRegister: CashRegister | null;
  cashierName: string;
  onSaleSuccess: (sale: Sale) => void;
  onOpenShiftPrompt: () => void;
}

export function POSView({
  products,
  customers,
  activeCashRegister,
  cashierName,
  onSaleSuccess,
  onOpenShiftPrompt,
}: POSViewProps) {
  const { notifyPendingWrite, showSuccessToast } = useSync();
  const { userProfile, role } = useAuth();

  // Estados para Modal de Verificación de PIN en Firestore
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinActionTitle, setPinActionTitle] = useState('Verificación de Seguridad por PIN');
  const [pinActionDesc, setPinActionDesc] = useState('');
  const [pinTargetUid, setPinTargetUid] = useState<string | undefined>(undefined);
  const [pinTargetName, setPinTargetName] = useState<string | undefined>(undefined);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Filtros de búsqueda por texto y categoría de producto
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Selector de tarifa activa (Precio al Detal o Precio al Mayor)
  const [priceMode, setPriceMode] = useState<PriceType>('retail');

  // Tipo de comprobante tributario de El Salvador (Factura Consumidor Final, CCF o Tiquete)
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('consumer_invoice');

  // Estado del carrito de compra y parámetros de facturación
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [selectedBank, setSelectedBank] = useState<string>(SALVADORAN_BANKS[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [applyTax, setApplyTax] = useState<boolean>(true); // IVA 13% en El Salvador
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Estados de control de procesamiento asíncrono y mensajes de error
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Instancia memoizada del cliente seleccionado
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Al cambiar el cliente, se ajusta automáticamente la tarifa (mayoreo/detal) y comprobante sugerido
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const cust = customers.find((c) => c.id === customerId);
    
    if (cust?.customerType === 'wholesale') {
      setPriceMode('wholesale');
      setInvoiceType('tax_credit'); // Asignación automática de Crédito Fiscal para clientes mayoristas
      recalcCartPrices('wholesale', true, customerId);
    } else {
      setPriceMode('retail');
      setInvoiceType('consumer_invoice');
      recalcCartPrices('retail', false, customerId);
    }
  };

  // Función auxiliar para calcular el precio unitario aplicable según volumen (Unidad, Media Docena o Docena), tarifa forzada y tipo de cliente
  const computeItemPricing = (
    product: Product,
    quantity: number,
    currentPriceMode: PriceType,
    isCustomerWholesale: boolean
  ) => {
    const retailPrice = product.sellingPrice;
    
    // Obtener precios de escala con fallbacks consistentes:
    // Media Docena (6-11 unidades): halfDozenPrice o wholesalePrice o 85% de retail
    const halfDozenPrice = product.halfDozenPrice !== undefined && product.halfDozenPrice > 0
      ? product.halfDozenPrice
      : (product.wholesalePrice !== undefined && product.wholesalePrice > 0 
          ? product.wholesalePrice 
          : Number((product.sellingPrice * 0.85).toFixed(2)));
    
    // Docena (12+ unidades): dozenPrice o 90% de halfDozen o 75% de retail
    const dozenPrice = product.dozenPrice !== undefined && product.dozenPrice > 0
      ? product.dozenPrice
      : (product.wholesalePrice !== undefined && product.wholesalePrice > 0 
          ? Number((product.wholesalePrice * 0.90).toFixed(2)) 
          : Number((product.sellingPrice * 0.75).toFixed(2)));

    let unitPrice = retailPrice;
    let appliedType: PriceType = 'retail';

    // Regla de negocio:
    // 1 a 5 unidades: Unidad / Detal
    // 6 a 11 unidades: Media Docena
    // 12 o más unidades: Docena Completa
    if (quantity >= 12 || currentPriceMode === 'dozen') {
      unitPrice = dozenPrice;
      appliedType = 'dozen';
    } else if (quantity >= 6 || currentPriceMode === 'half_dozen' || currentPriceMode === 'wholesale' || isCustomerWholesale) {
      unitPrice = halfDozenPrice;
      appliedType = 'half_dozen';
    } else {
      unitPrice = retailPrice;
      appliedType = 'retail';
    }

    const isWholesale = appliedType === 'half_dozen' || appliedType === 'dozen';

    return {
      unitPrice,
      appliedType,
      retailPrice,
      halfDozenPrice,
      dozenPrice,
      wholesalePrice: dozenPrice,
      isWholesale,
    };
  };

  // Recalcula los precios y subtotales de todos los artículos en el carrito al cambiar modo o cliente
  const recalcCartPrices = (targetMode: PriceType, isWholesaleCust: boolean, custId?: string) => {
    setCart((prev) =>
      prev.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) return item;
        const pricing = computeItemPricing(prod, item.quantity, targetMode, isWholesaleCust);
        return {
          ...item,
          unitPrice: pricing.unitPrice,
          subtotal: pricing.unitPrice * item.quantity,
          appliedPriceType: pricing.appliedType,
          retailPriceSnapshot: pricing.retailPrice,
          wholesalePriceSnapshot: pricing.wholesalePrice,
        };
      })
    );
  };

  // Conmutador manual de modo de precios
  const handleTogglePriceMode = (newMode: PriceType) => {
    setPriceMode(newMode);
    const isWholesaleCust = selectedCustomer?.customerType === 'wholesale';
    recalcCartPrices(newMode, isWholesaleCust);
  };

  // Extracción de categorías únicas de productos
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtrado reactivo de productos por búsqueda y categoría
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false;
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  // Cálculos financieros del carrito bajo normativa de El Salvador (13% IVA y 1% Retención)
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cart]);

  // Cálculo del ahorro total obtenido por compras al mayoreo
  const totalWholesaleSavings = useMemo(() => {
    return cart.reduce((acc, item) => {
      const regularSubtotal = (item.retailPriceSnapshot || item.unitPrice) * item.quantity;
      const actualSubtotal = item.subtotal;
      return acc + Math.max(0, regularSubtotal - actualSubtotal);
    }, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  // Tasa de IVA en El Salvador: 13%
  const taxRate = COMPANY_INFO_SV.ivaRate; // 0.13
  const taxAmount = applyTax ? Number((taxableAmount * taxRate).toFixed(2)) : 0;

  // Total definitivo a pagar en Dólares Estadounidenses ($ USD)
  const total = useMemo(() => {
    if (invoiceType === 'tax_credit') {
      // CCF: Subtotal Gravado + 13% IVA Débito Fiscal
      return Number((taxableAmount + taxAmount).toFixed(2));
    }
    // Factura Consumidor Final o Tiquete de caja: Precio neto regular con IVA integrado
    return Number(taxableAmount.toFixed(2));
  }, [taxableAmount, taxAmount, invoiceType]);

  const numAmountReceived = parseFloat(amountReceived) || 0;
  const changeGiven = paymentMethod === 'cash' && numAmountReceived > total ? numAmountReceived - total : 0;

  // Agrega un producto al carrito de compras validando stock disponible
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      setErrorMessage(`El producto "${product.name}" está agotado en inventario.`);
      return;
    }

    setErrorMessage(null);

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      const isWholesaleCust = selectedCustomer?.customerType === 'wholesale';

      if (existing) {
        if (existing.quantity >= product.stock) {
          setErrorMessage(`No puedes agregar más unidades de "${product.name}". Stock disponible en servidor: ${product.stock}`);
          return prev;
        }
        const newQty = existing.quantity + 1;
        const pricing = computeItemPricing(product, newQty, priceMode, isWholesaleCust);

        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: newQty,
                unitPrice: pricing.unitPrice,
                subtotal: newQty * pricing.unitPrice,
                appliedPriceType: pricing.appliedType,
                retailPriceSnapshot: pricing.retailPrice,
                wholesalePriceSnapshot: pricing.wholesalePrice,
              }
            : item
        );
      } else {
        const pricing = computeItemPricing(product, 1, priceMode, isWholesaleCust);
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unitPrice: pricing.unitPrice,
            costPrice: product.costPrice,
            quantity: 1,
            subtotal: pricing.unitPrice,
            appliedPriceType: pricing.appliedType,
            retailPriceSnapshot: pricing.retailPrice,
            wholesalePriceSnapshot: pricing.wholesalePrice,
          },
        ];
      }
    });
  };

  // Modifica la cantidad de un artículo en el carrito de compras
  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const prod = products.find((p) => p.id === productId);
    if (prod && newQty > prod.stock) {
      setErrorMessage(`Stock máximo disponible para "${prod.name}": ${prod.stock}`);
      return;
    }

    setErrorMessage(null);
    const isWholesaleCust = selectedCustomer?.customerType === 'wholesale';

    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId && prod) {
          const pricing = computeItemPricing(prod, newQty, priceMode, isWholesaleCust);
          return {
            ...item,
            quantity: newQty,
            unitPrice: pricing.unitPrice,
            subtotal: newQty * pricing.unitPrice,
            appliedPriceType: pricing.appliedType,
            retailPriceSnapshot: pricing.retailPrice,
            wholesalePriceSnapshot: pricing.wholesalePrice,
          };
        }
        return item;
      })
    );
  };

  // Remueve un artículo del carrito
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Limpia el carrito y restablece los valores por defecto
  const clearCart = () => {
    setCart([]);
    setSelectedCustomerId('');
    setDiscountPercent(0);
    setAmountReceived('');
    setPaymentReference('');
    setNotes('');
    setErrorMessage(null);
    setPriceMode('retail');
    setInvoiceType('consumer_invoice');
  };

  // Solicita verificación de PIN persistido en Firestore para operaciones sensibles
  const requestPinAuthorization = (
    title: string,
    desc: string,
    onApproved: () => void,
    targetUid?: string,
    targetName?: string
  ) => {
    setPinActionTitle(title);
    setPinActionDesc(desc);
    setPendingAction(() => onApproved);
    setPinTargetUid(targetUid || userProfile?.uid);
    setPinTargetName(targetName || userProfile?.displayName || cashierName);
    setIsPinModalOpen(true);
  };

  // Solicita PIN para vaciar el carrito y cancelar la venta en curso
  const handleRequestClearCart = () => {
    if (cart.length === 0) return;
    requestPinAuthorization(
      'Autorización para Vaciar Carrito',
      `Se requiere ingresar el PIN del cajero asignado o el PIN de Super Administrador para anular la venta y descartar los ${cart.length} productos del carrito.`,
      () => {
        clearCart();
        showSuccessToast('Venta anulada y carrito vaciado con éxito.');
      }
    );
  };

  // Manejador de éxito tras validación en Firestore
  const handlePinAuthSuccess = (authResult: PinAuthResult) => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
    if (authResult.isSuperAdminOverride) {
      showSuccessToast(`Acción autorizada por Super Admin: ${authResult.authorizedUserName}`);
    }
  };

  // Procesa la venta de forma atómica en el servidor Firestore
  const handleProcessSale = async () => {
    if (cart.length === 0) {
      setErrorMessage('El carrito de compras está vacío.');
      return;
    }

    // Validación de requisitos para Comprobante de Crédito Fiscal (CCF)
    if (invoiceType === 'tax_credit') {
      if (!selectedCustomer) {
        setErrorMessage('Para emitir Comprobante de Crédito Fiscal (CCF) es obligatorio seleccionar un cliente con NRC y NIT.');
        return;
      }
      if (!selectedCustomer.nrc && !selectedCustomer.nit) {
        setErrorMessage(`El cliente "${selectedCustomer.name}" no tiene NRC o NIT registrado para emitir Crédito Fiscal.`);
        return;
      }
    }

    if (paymentMethod === 'credit' && !selectedCustomerId) {
      setErrorMessage('Para ventas al crédito/fiado, es obligatorio seleccionar un cliente registrado.');
      return;
    }

    if (paymentMethod === 'cash' && numAmountReceived > 0 && numAmountReceived < total) {
      setErrorMessage(`El monto recibido ($${numAmountReceived.toFixed(2)} USD) es menor al total a pagar ($${total.toFixed(2)} USD).`);
      return;
    }

    const executeSaleSubmission = async () => {
      setIsProcessing(true);
      setErrorMessage(null);
      notifyPendingWrite(true);

      const isWholesaleSale = priceMode === 'dozen' || priceMode === 'half_dozen' || priceMode === 'wholesale' || selectedCustomer?.customerType === 'wholesale' || cart.some(i => i.appliedPriceType === 'dozen' || i.appliedPriceType === 'half_dozen' || i.appliedPriceType === 'wholesale');

      const prefix = invoiceType === 'tax_credit' ? 'CCF' : invoiceType === 'ticket' ? 'TIQ' : 'FAC';
      const invoiceNumber = `${prefix}-${Date.now().toString().slice(-6)}`;

      try {
        const saleId = await SalesRepository.processSale(
          {
            invoiceType,
            items: cart,
            subtotal,
            discount: discountAmount,
            taxRate: 0.13,
            tax: taxAmount,
            retentionApplied: false,
            retentionAmount: 0,
            total,
            saleType: isWholesaleSale ? 'wholesale' : 'retail',
            totalSavings: totalWholesaleSavings,
            paymentMethod,
            paymentStatus: paymentMethod === 'credit' ? 'pending' : 'paid',
            paymentDetails: {
              bankName: paymentMethod === 'bank_transfer' ? selectedBank : undefined,
              referenceNumber: paymentReference.trim() || undefined,
              notes: notes || undefined,
            },
            customerId: selectedCustomerId || undefined,
            customerName: selectedCustomer ? selectedCustomer.name : undefined,
            customerType: selectedCustomer?.customerType,
            customerDocumentType: selectedCustomer?.documentType,
            customerDocumentId: selectedCustomer?.documentId,
            customerNrc: selectedCustomer?.nrc,
            customerNit: selectedCustomer?.nit,
            customerGiro: selectedCustomer?.commercialActivity,
            customerBusinessName: selectedCustomer?.businessName,
            customerDepartment: selectedCustomer?.department,
            customerMunicipality: selectedCustomer?.municipality,
            cashRegisterId: activeCashRegister?.id || undefined,
            amountReceived: numAmountReceived > 0 ? numAmountReceived : total,
            changeGiven,
            notes: notes || undefined,
            createdBy: cashierName,
          },
          cashierName
        );

        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch (e) {
          // Omisión segura si falla el renderizado del confetti
        }

        showSuccessToast(`¡Venta #${invoiceNumber} registrada exitosamente en el servidor!`);

        const completedSale: Sale = {
          id: saleId,
          invoiceNumber,
          invoiceType,
          items: [...cart],
          subtotal,
          discount: discountAmount,
          taxRate: 0.13,
          tax: taxAmount,
          retentionApplied: false,
          retentionAmount: 0,
          total,
          saleType: isWholesaleSale ? 'wholesale' : 'retail',
          totalSavings: totalWholesaleSavings,
          paymentMethod,
          paymentStatus: paymentMethod === 'credit' ? 'pending' : 'paid',
          paymentDetails: {
            bankName: paymentMethod === 'bank_transfer' ? selectedBank : undefined,
            referenceNumber: paymentReference.trim() || undefined,
          },
          customerId: selectedCustomerId || undefined,
          customerName: selectedCustomer ? selectedCustomer.name : undefined,
          customerType: selectedCustomer?.customerType,
          customerDocumentType: selectedCustomer?.documentType,
          customerDocumentId: selectedCustomer?.documentId,
          customerNrc: selectedCustomer?.nrc,
          customerNit: selectedCustomer?.nit,
          customerGiro: selectedCustomer?.commercialActivity,
          customerBusinessName: selectedCustomer?.businessName,
          customerDepartment: selectedCustomer?.department,
          customerMunicipality: selectedCustomer?.municipality,
          cashRegisterId: activeCashRegister?.id || undefined,
          amountReceived: numAmountReceived > 0 ? numAmountReceived : total,
          changeGiven,
          notes: notes || undefined,
          createdAt: Date.now(),
          createdBy: cashierName,
        };

        onSaleSuccess(completedSale);
        clearCart();
      } catch (err: any) {
        console.error('Error procesando venta:', err);
        setErrorMessage(err.message || 'Ocurrió un error al procesar la venta en Firestore.');
      } finally {
        setIsProcessing(false);
        notifyPendingWrite(false);
      }
    };

    // Solicita PIN del Cajero o Super Admin antes de procesar la venta en Firestore
    requestPinAuthorization(
      'Autorización de Cobro y Venta en POS',
      `Ingrese el PIN de cajero para autorizar y procesar la venta por un total de $${total.toFixed(2)} USD (o use el PIN de Super Admin).`,
      executeSaleSubmission
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {/* Barra de Seguridad de Cajero y Turno */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            {userProfile?.displayName?.charAt(0).toUpperCase() || cashierName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs">Cajero en Turno: {userProfile?.displayName || cashierName}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                {role === 'admin' ? 'Super Admin' : 'Cajero POS'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Seguridad protegida por PIN en tiempo real contra Firebase Firestore.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              requestPinAuthorization(
                'Autenticación de Turno / Cajero',
                'Ingrese su PIN personal o el PIN de Super Administrador para validar sus credenciales de sesión en Firestore.',
                () => {
                  showSuccessToast('Credenciales y PIN validados en Firestore');
                }
              );
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5 text-blue-400" />
            <span>Validar / Autenticar PIN</span>
          </button>
        </div>
      </div>

      {/* Banner de advertencia si la caja está cerrada */}
      {!activeCashRegister && (
        <div className="bg-amber-950/80 border border-amber-500/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-200 text-xs shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>Atención:</strong> La caja se encuentra cerrada. Las ventas en efectivo en $ USD no se acumularán a un turno de caja activo.
            </span>
          </div>
          <button
            onClick={onOpenShiftPrompt}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold tracking-tight shadow-md shrink-0 active:scale-95"
          >
            Abrir Turno de Caja
          </button>
        </div>
      )}

      {/* Disposición Principal: Catálogo (Izquierda 7 col) y Carrito (Derecha 5 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* IZQUIERDA: Catálogo de Productos */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Controles de Encabezado: Búsqueda y Selector de Tarifa Detal/Mayoreo */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              
              {/* Barra de búsqueda */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre, código de producto o categoría..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Selector de modo de tarifa (Detal/Auto, ½ Docena, Docena) */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleTogglePriceMode('retail')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    priceMode === 'retail'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Automático por cantidad (1-5 uds: detal, 6-11: ½ docena, 12+: docena)"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Detal (Auto)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePriceMode('half_dozen')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    priceMode === 'half_dozen' || priceMode === 'wholesale'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Forzar tarifa de Media Docena (escala de 6 unidades)"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>½ Docena</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePriceMode('dozen')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    priceMode === 'dozen'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Forzar tarifa de Docena (escala de 12 unidades)"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Docena</span>
                </button>
              </div>
            </div>

            {/* Píldoras de Categorías */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-slate-200 text-slate-900 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-slate-200 text-slate-900 shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Cuadrícula de Tarjetas de Productos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800/80 p-6">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-semibold">No se encontraron productos.</p>
                <p className="text-xs text-slate-500">Prueba con otro término de búsqueda o categoría.</p>
              </div>
            ) : (
              filteredProducts.map((prod) => {
                const isOutOfStock = prod.stock <= 0;
                const isLowStock = prod.stock > 0 && prod.stock <= prod.minStockAlert;
                const halfDozenP = prod.halfDozenPrice !== undefined && prod.halfDozenPrice > 0
                  ? prod.halfDozenPrice
                  : (prod.wholesalePrice !== undefined && prod.wholesalePrice > 0 ? prod.wholesalePrice : Number((prod.sellingPrice * 0.85).toFixed(2)));
                const dozenP = prod.dozenPrice !== undefined && prod.dozenPrice > 0
                  ? prod.dozenPrice
                  : (prod.wholesalePrice !== undefined && prod.wholesalePrice > 0 ? Number((prod.wholesalePrice * 0.9).toFixed(2)) : Number((prod.sellingPrice * 0.75).toFixed(2)));

                return (
                  <div
                    key={prod.id}
                    onClick={() => !isOutOfStock && addToCart(prod)}
                    className={`bg-slate-900 rounded-md p-3 border transition-colors flex flex-col justify-between select-none cursor-pointer ${
                      isOutOfStock
                        ? 'border-slate-800 opacity-40 cursor-not-allowed'
                        : 'border-slate-800 hover:border-blue-500/80 cursor-pointer'
                    }`}
                  >
                    {/* Insignias de encabezado de producto */}
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono text-blue-400 font-bold truncate">
                        {prod.sku}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          isOutOfStock
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                            : isLowStock
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {isOutOfStock ? 'Agotado' : `${prod.stock} ${prod.unit}`}
                      </span>
                    </div>

                    {/* Nombre del Producto */}
                    <h3 className="font-semibold text-white text-xs line-clamp-2 min-h-[32px] mb-2 leading-tight">
                      {prod.name}
                    </h3>

                    {/* Precios: 3 escalas (Unidad, ½ Docena, Docena) */}
                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] text-slate-400">Unidad:</span>
                        <span className="font-bold text-white text-xs font-mono">
                          ${prod.sellingPrice.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-sky-900/40">
                        <span className="text-[9px] text-sky-300 font-medium">
                          ½ Docena:
                        </span>
                        <span className="font-bold text-sky-200 font-mono">
                          ${halfDozenP.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-purple-900/40">
                        <span className="text-[9px] text-purple-300 font-medium">
                          Docena:
                        </span>
                        <span className="font-bold text-purple-200 font-mono">
                          ${dozenP.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* DERECHA: Carrito POS y Proceso de Cobro */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-md p-4 space-y-4">
          
          {/* Encabezado del Carrito */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-white text-sm">
                Carrito de Venta ({cart.reduce((a, b) => a + b.quantity, 0)})
              </h3>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleRequestClearCart}
                title="Vaciar carrito (Requiere PIN de seguridad en Firestore)"
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950 border border-rose-900/60 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Lock className="w-3 h-3 text-rose-400" />
                <span>Vaciar Carrito</span>
              </button>
            )}
          </div>

          {/* Selector de Comprobante Tributario */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-blue-400" /> Tipo de Comprobante
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setInvoiceType('consumer_invoice')}
                className={`py-1.5 px-2 rounded font-semibold flex flex-col items-center gap-1 transition-colors ${
                  invoiceType === 'consumer_invoice'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Factura</span>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceType('tax_credit')}
                className={`py-1.5 px-2 rounded font-semibold flex flex-col items-center gap-1 transition-colors ${
                  invoiceType === 'tax_credit'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Crédito Fiscal</span>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceType('ticket')}
                className={`py-1.5 px-2 rounded font-semibold flex flex-col items-center gap-1 transition-colors ${
                  invoiceType === 'ticket'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Tiquete</span>
              </button>
            </div>
          </div>

          {/* Selector de Cliente con Distintivo de Tipo */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-rose-400" /> Cliente / Contribuyente
              </span>
              {selectedCustomer && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-extrabold uppercase ${
                    selectedCustomer.customerType === 'wholesale'
                      ? 'bg-purple-950 text-purple-300 border border-purple-800'
                      : 'bg-sky-950 text-sky-300 border border-sky-800'
                  }`}
                >
                  {selectedCustomer.customerType === 'wholesale' ? 'Mayorista (NRC/NIT)' : 'Cliente Detal (DUI)'}
                </span>
              )}
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="">Cliente Ocasional / Consumidor Final (Mostrador)</option>
              <optgroup label="🏢 Clientes Mayoristas / Empresas (CCF)">
                {customers
                  .filter((c) => c.customerType === 'wholesale')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName || c.name} &bull; NRC: {c.nrc || 'S/N'} &bull; NIT: {c.nit || c.documentId}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="👤 Clientes al Detal (DUI)">
                {customers
                  .filter((c) => c.customerType !== 'wholesale')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} &bull; DUI: {c.documentId} {c.currentDebt > 0 ? `(Debe $${c.currentDebt.toFixed(2)})` : ''}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Lista de artículos en el carrito */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-8 text-center text-slate-500 space-y-1">
                <ShoppingCart className="w-7 h-7 mx-auto text-slate-700" />
                <p className="text-xs">No hay productos agregados.</p>
                <p className="text-[10px] text-slate-600">Haz clic en los productos para agregarlos al carrito.</p>
              </div>
            ) : (
              cart.map((item) => {
                const prod = products.find((p) => p.id === item.productId);
                const isDozenApplied = item.appliedPriceType === 'dozen';
                const isHalfDozenApplied = item.appliedPriceType === 'half_dozen';
                const isWholesaleApplied = isDozenApplied || isHalfDozenApplied || item.appliedPriceType === 'wholesale';
                
                const halfDozenP = prod?.halfDozenPrice !== undefined && prod.halfDozenPrice > 0
                  ? prod.halfDozenPrice
                  : (prod?.wholesalePrice !== undefined && prod.wholesalePrice > 0 ? prod.wholesalePrice : Number(((prod?.sellingPrice ?? 0) * 0.85).toFixed(2)));
                const dozenP = prod?.dozenPrice !== undefined && prod.dozenPrice > 0
                  ? prod.dozenPrice
                  : (prod?.wholesalePrice !== undefined && prod.wholesalePrice > 0 ? Number((prod.wholesalePrice * 0.9).toFixed(2)) : Number(((prod?.sellingPrice ?? 0) * 0.75).toFixed(2)));

                // Determinar el próximo escalón para sugerir ahorro al cliente
                const nextTier = item.quantity < 6
                  ? { targetQty: 6, label: '½ Docena', price: halfDozenP, diff: 6 - item.quantity }
                  : item.quantity < 12
                  ? { targetQty: 12, label: 'Docena', price: dozenP, diff: 12 - item.quantity }
                  : null;

                const showUpsell = nextTier !== null && prod && prod.stock >= nextTier.targetQty && priceMode === 'retail';

                return (
                  <div
                    key={item.productId}
                    className={`p-2 rounded-xl border transition-colors space-y-1 ${
                      isDozenApplied
                        ? 'bg-purple-950/30 border-purple-900/60'
                        : isHalfDozenApplied
                        ? 'bg-sky-950/30 border-sky-900/60'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-white text-xs truncate">{item.productName}</h4>
                          {isDozenApplied && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-900 text-purple-200 uppercase">
                              Docena
                            </span>
                          )}
                          {isHalfDozenApplied && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-sky-900 text-sky-200 uppercase">
                              ½ Docena
                            </span>
                          )}
                          {!isDozenApplied && !isHalfDozenApplied && item.appliedPriceType === 'wholesale' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-900 text-purple-200 uppercase">
                              Mayor
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                          {isWholesaleApplied && item.retailPriceSnapshot && item.retailPriceSnapshot > item.unitPrice && (
                            <span className="line-through text-slate-600 text-[10px]">
                              ${item.retailPriceSnapshot.toFixed(2)}
                            </span>
                          )}
                          <span className={isDozenApplied ? 'text-purple-300 font-bold' : isHalfDozenApplied ? 'text-sky-300 font-bold' : 'text-slate-300'}>
                            ${item.unitPrice.toFixed(2)} USD
                          </span>
                        </div>
                      </div>

                      {/* Controles de incremento y decremento de cantidad */}
                      <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-xs text-white font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Subtotal del artículo */}
                      <div className="text-right shrink-0 min-w-[55px]">
                        <span className="font-black text-xs text-white font-mono">
                          ${item.subtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {showUpsell && nextTier && (
                      <div className="text-[10px] text-sky-300 bg-sky-950/50 border border-sky-800/60 px-2 py-1 rounded flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <Zap className="w-3 h-3 text-sky-400 shrink-0" />
                          <span className="truncate">
                            ¡Faltan {nextTier.diff} uds para tarifa {nextTier.label} (${nextTier.price.toFixed(2)}/ud)!
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, nextTier.targetQty)}
                          className="shrink-0 px-1.5 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-[9px] transition-colors"
                        >
                          Completar {nextTier.targetQty} uds ({nextTier.label})
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Resumen de ahorro obtenido por compra al mayoreo */}
          {totalWholesaleSavings > 0 && (
            <div className="p-2 rounded-xl bg-gradient-to-r from-purple-950 to-indigo-950 border border-purple-800/80 flex items-center justify-between text-xs">
              <span className="text-purple-200 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Ahorro por Mayoreo:
              </span>
              <span className="font-black text-purple-300 font-mono">
                -${totalWholesaleSavings.toFixed(2)} USD
              </span>
            </div>
          )}

          {/* Selector de Métodos de Pago: Efectivo, Tarjeta, Transferencia */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Método de Pago</label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2.5 px-2 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-850'
                }`}
              >
                <Banknote className="w-5 h-5" />
                <span>Efectivo</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`py-2.5 px-2 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'card'
                    ? 'bg-sky-600 text-white shadow-lg ring-2 ring-sky-400'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-850'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>Tarjeta</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`py-2.5 px-2 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'bank_transfer' || paymentMethod === 'transfer'
                    ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-850'
                }`}
              >
                <ArrowRightLeft className="w-5 h-5" />
                <span>Transferencia</span>
              </button>
            </div>
          </div>

          {/* Selector de Banco en transferencias */}
          {paymentMethod === 'bank_transfer' && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">Banco de Destino</label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                {SALVADORAN_BANKS.map((bank) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>
          )}

          {/* Campo de número de referencia para transferencia o tarjeta */}
          {(paymentMethod === 'bank_transfer' || paymentMethod === 'card') && (
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                {paymentMethod === 'bank_transfer' ? 'Número de Referencia / Comprobante' : 'Código de Aprobación / Referencia (Opcional)'}
              </label>
              <input
                type="text"
                placeholder={paymentMethod === 'bank_transfer' ? "Ej: Transfer365 #198234 o BAC #5541" : "Ej: Aprobación #128945"}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          )}

          {/* Cálculo de efectivo recibido y vuelto */}
          {paymentMethod === 'cash' && (
            <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Monto Recibido ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={total.toFixed(2)}
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-300 mb-1">Cambio a Entregar</span>
                <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 font-mono font-black text-emerald-400 text-sm">
                  ${changeGiven.toFixed(2)} USD
                </div>
              </div>
            </div>
          )}

          {/* Desglose de totales y comprobante */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Sumas Gravadas (Subtotal):</span>
              <span className="font-mono text-white">${subtotal.toFixed(2)} USD</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Descuento adicional ({discountPercent}%):</span>
                <span className="font-mono">-${discountAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Desglose de 13% IVA Débito Fiscal para Comprobante de Crédito Fiscal */}
            {invoiceType === 'tax_credit' && (
              <div className="flex justify-between text-purple-300">
                <span>IVA Débito Fiscal (13%):</span>
                <span className="font-mono font-bold">+${taxAmount.toFixed(2)} USD</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
              <span className="font-bold text-white text-sm">Total a Pagar:</span>
              <span className="font-black text-2xl text-rose-400 font-mono font-['Outfit']">
                ${total.toFixed(2)} <span className="text-xs font-normal text-slate-400">USD</span>
              </span>
            </div>
          </div>

          {/* Notificación visual de errores */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Botón de Ejecución de Venta */}
          <button
            onClick={handleProcessSale}
            disabled={isProcessing || cart.length === 0}
            className={`w-full py-3 rounded-xl font-black text-sm tracking-wide transition-all shadow-xl active:scale-[0.99] flex items-center justify-center gap-2 ${
              isProcessing || cart.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-900/40'
            }`}
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Registrando venta en el servidor...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Cobrar ${total.toFixed(2)} USD</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal de Verificación de PIN */}
      <PinVerificationModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={handlePinAuthSuccess}
        title={pinActionTitle}
        description={pinActionDesc}
        targetUserId={pinTargetUid}
        targetUserName={pinTargetName}
      />
    </div>
  );
}
