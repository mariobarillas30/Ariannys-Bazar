import { useState, useMemo, type FormEvent } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign, 
  CreditCard, 
  CheckCircle, 
  AlertCircle,
  X,
  History,
  Building2,
  Tag,
  Sparkles,
  ShieldCheck,
  FileText,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Customer, CustomerPayment, CashRegister, CustomerType, PaymentMethod } from '../types';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';
import { SALVADORAN_DEPARTMENTS, SALVADORAN_BANKS, formatDUI, formatNIT, formatSalvadoranPhone } from '../lib/elSalvadorData';

interface CustomersViewProps {
  customers: Customer[];
  activeCashRegister: CashRegister | null;
  cashierName: string;
}

export function CustomersView({ customers, activeCashRegister, cashierName }: CustomersViewProps) {
  const { notifyPendingWrite, showSuccessToast } = useSync();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'retail' | 'wholesale'>('all');
  const [debtFilter, setDebtFilter] = useState<'all' | 'debtors' | 'cleared'>('all');

  // Modal de eliminación de cliente
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    customer: Customer | null;
  }>({
    isOpen: false,
    customer: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal de gestión de cliente (Creación y edición)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('retail');
  const [documentType, setDocumentType] = useState<'DUI' | 'NIT' | 'NRC'>('DUI');
  const [documentId, setDocumentId] = useState('');
  const [nrc, setNrc] = useState('');
  const [nit, setNit] = useState('');
  const [commercialActivity, setCommercialActivity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('San Salvador');
  const [municipality, setMunicipality] = useState('San Salvador');
  const [address, setAddress] = useState('');
  const [isWithholdingAgent, setIsWithholdingAgent] = useState(false);
  const [creditLimit, setCreditLimit] = useState<number>(150);

  // Modal de abonos y amortización de cuentas corrientes
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [selectedBank, setSelectedBank] = useState<string>(SALVADORAN_BANKS[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Control de estado de guardado y mensajes de error
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Municipios disponibles correspondientes al departamento de El Salvador seleccionado
  const availableMunicipalities = useMemo(() => {
    const dept = SALVADORAN_DEPARTMENTS.find((d) => d.name === department);
    return dept ? dept.municipalities : ['San Salvador'];
  }, [department]);

  // Métricas estadísticas agregadas de clientes al detalle y mayoristas
  const wholesaleCustomers = customers.filter((c) => c.customerType === 'wholesale');
  const retailCustomers = customers.filter((c) => c.customerType !== 'wholesale');

  const wholesaleDebt = wholesaleCustomers.reduce((acc, c) => acc + (c.currentDebt || 0), 0);
  const retailDebt = retailCustomers.reduce((acc, c) => acc + (c.currentDebt || 0), 0);
  const totalDebt = wholesaleDebt + retailDebt;

  // Filtrado reactivo de clientes según texto, clasificación y estado de deuda
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.businessName && c.businessName.toLowerCase().includes(search.toLowerCase())) ||
        c.documentId.toLowerCase().includes(search.toLowerCase()) ||
        (c.nrc && c.nrc.toLowerCase().includes(search.toLowerCase())) ||
        (c.nit && c.nit.toLowerCase().includes(search.toLowerCase())) ||
        (c.commercialActivity && c.commercialActivity.toLowerCase().includes(search.toLowerCase())) ||
        c.phone.toLowerCase().includes(search.toLowerCase());

      const matchType = typeFilter === 'all' || (c.customerType || 'retail') === typeFilter;

      let matchDebt = true;
      if (debtFilter === 'debtors') {
        matchDebt = (c.currentDebt || 0) > 0;
      } else if (debtFilter === 'cleared') {
        matchDebt = (c.currentDebt || 0) === 0;
      }

      return matchSearch && matchType && matchDebt;
    });
  }, [customers, search, typeFilter, debtFilter]);

  const handleOpenNewCustomer = () => {
    setEditingCustomer(null);
    setName('');
    setBusinessName('');
    setCustomerType('retail');
    setDocumentType('DUI');
    setDocumentId('');
    setNrc('');
    setNit('');
    setCommercialActivity('');
    setPhone('');
    setEmail('');
    setDepartment('San Salvador');
    setMunicipality('San Salvador');
    setAddress('');
    setIsWithholdingAgent(false);
    setCreditLimit(150);
    setErrorMsg(null);
    setIsCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setBusinessName(c.businessName || '');
    setCustomerType(c.customerType || 'retail');
    setDocumentType(c.documentType || (c.customerType === 'wholesale' ? 'NIT' : 'DUI'));
    setDocumentId(c.documentId);
    setNrc(c.nrc || '');
    setNit(c.nit || '');
    setCommercialActivity(c.commercialActivity || '');
    setPhone(c.phone);
    setEmail(c.email || '');
    setDepartment(c.department || 'San Salvador');
    setMunicipality(c.municipality || 'San Salvador');
    setAddress(c.address || '');
    setIsWithholdingAgent(!!c.isWithholdingAgent);
    setCreditLimit(c.creditLimit);
    setErrorMsg(null);
    setIsCustomerModalOpen(true);
  };

  const handleOpenPayment = (c: Customer) => {
    setSelectedCustomer(c);
    setPaymentAmount(c.currentDebt || 0);
    setPaymentMethod('cash');
    setSelectedBank(SALVADORAN_BANKS[0]);
    setPaymentReference('');
    setPaymentNotes('Abono a cuenta corriente');
    setErrorMsg(null);
    setIsPaymentModalOpen(true);
  };

  const handleSaveCustomer = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validación específica para clientes mayoristas bajo normativa de El Salvador
    if (customerType === 'wholesale') {
      if (!businessName.trim()) {
        setErrorMsg('Para clientes mayoristas, la Razón Social / Nombre Comercial es obligatoria.');
        return;
      }
      if (!commercialActivity.trim()) {
        setErrorMsg('El Giro Comercial / Actividad Económica es obligatorio para clientes mayoristas según normativa de El Salvador.');
        return;
      }
      if (!nrc.trim()) {
        setErrorMsg('El NRC (Número de Registro de Contribuyente) es obligatorio para mayoristas (emisión de CCF).');
        return;
      }
      if (!nit.trim() && !documentId.trim()) {
        setErrorMsg('El NIT es obligatorio para clientes mayoristas.');
        return;
      }
      if (!address.trim()) {
        setErrorMsg('La dirección en El Salvador es obligatoria para clientes mayoristas.');
        return;
      }
    }

    if (!name.trim() || !documentId.trim() || !phone.trim()) {
      setErrorMsg('Nombre de contacto, Documento Oficial (DUI / NIT) y Teléfono son requeridos.');
      return;
    }

    setIsSaving(true);
    notifyPendingWrite(true);

    try {
      const finalDocumentId = documentType === 'DUI' ? formatDUI(documentId.trim()) : documentId.trim();
      const finalNit = nit.trim() ? formatNIT(nit.trim()) : undefined;
      const finalPhone = formatSalvadoranPhone(phone.trim());

      const customerPayload = {
        name: name.trim(),
        businessName: customerType === 'wholesale' ? businessName.trim() : undefined,
        customerType,
        documentType,
        documentId: finalDocumentId,
        nrc: customerType === 'wholesale' ? nrc.trim() : undefined,
        nit: finalNit,
        commercialActivity: customerType === 'wholesale' ? commercialActivity.trim() : undefined,
        phone: finalPhone,
        email: email.trim() || undefined,
        department,
        municipality,
        address: address.trim() || undefined,
        isWithholdingAgent: customerType === 'wholesale' ? isWithholdingAgent : false,
        creditLimit: Number(creditLimit),
      };

      if (editingCustomer) {
        await CustomerRepository.updateCustomer(editingCustomer.id, customerPayload);
        showSuccessToast(`Cliente "${name}" actualizado exitosamente.`);
      } else {
        await CustomerRepository.createCustomer(customerPayload);
        showSuccessToast(`Cliente "${name}" registrado en El Salvador.`);
      }
      setIsCustomerModalOpen(false);
    } catch (err: any) {
      console.error('Error al guardar cliente:', err);
      setErrorMsg(err.message || 'Error al guardar cliente.');
    } finally {
      setIsSaving(false);
      notifyPendingWrite(false);
    }
  };

  const handleRegisterPayment = async () => {
    if (!selectedCustomer) return;
    if (paymentAmount <= 0) {
      setErrorMsg('El monto a abonar debe ser mayor a $0.00 USD.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    notifyPendingWrite(true);

    try {
      await CustomerRepository.registerDebtPayment(
        {
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          amount: Number(paymentAmount),
          paymentMethod,
          paymentDetails: {
            bankName: paymentMethod === 'bank_transfer' ? selectedBank : undefined,
            referenceNumber: paymentReference.trim() || undefined,
          },
          notes: paymentNotes.trim() || undefined,
          cashRegisterId: activeCashRegister?.id || undefined,
        },
        cashierName
      );

      showSuccessToast(
        `¡Abono de $${paymentAmount.toFixed(2)} USD registrado exitosamente para ${selectedCustomer.name}!`
      );
      setIsPaymentModalOpen(false);
    } catch (err: any) {
      console.error('Error al registrar abono:', err);
      setErrorMsg(err.message || 'Error al registrar el abono.');
    } finally {
      setIsSaving(false);
      notifyPendingWrite(false);
    }
  };

  // Apertura del modal de confirmación de eliminación de cliente con validación de Rol (Administrador)
  const handleOpenDeleteCustomerModal = (c: Customer) => {
    if (role !== 'admin') {
      setErrorMsg('Acceso restringido: Solo los usuarios con rol de Administrador pueden eliminar clientes.');
      return;
    }
    setErrorMsg(null);
    setDeleteModal({
      isOpen: true,
      customer: c,
    });
  };

  // Ejecución de la eliminación de cliente en Firestore tras la confirmación
  const handleConfirmDeleteCustomer = async () => {
    if (!deleteModal.isOpen || !deleteModal.customer) return;

    if (role !== 'admin') {
      setErrorMsg('Acceso denegado: Se requiere rol de Administrador para eliminar clientes.');
      setDeleteModal({ isOpen: false, customer: null });
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);
    notifyPendingWrite(true);

    try {
      await CustomerRepository.deleteCustomer(deleteModal.customer.id);
      showSuccessToast(`Cliente "${deleteModal.customer.name}" eliminado correctamente.`);
      setDeleteModal({ isOpen: false, customer: null });
    } catch (err: any) {
      console.error('Error al eliminar cliente:', err);
      setErrorMsg(err.message || 'Error al eliminar el cliente en la base de datos.');
    } finally {
      setIsDeleting(false);
      notifyPendingWrite(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Encabezado Principal */}
      <div className="bg-slate-900 border border-slate-800 rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Directorio de Clientes
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestión de clientes al detal, empresas mayoristas y cuentas por cobrar.
          </p>
        </div>

        <button
          onClick={handleOpenNewCustomer}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Registrar Cliente</span>
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-md p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400">Clientes al Detal</span>
            <div className="text-2xl font-bold text-white">
              {retailCustomers.length}
            </div>
            <p className="text-[11px] text-slate-500">Deuda: ${retailDebt.toFixed(2)} USD</p>
          </div>
          <div className="p-2.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            <Tag className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-md p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400">Empresas & Mayoristas</span>
            <div className="text-2xl font-bold text-white">
              {wholesaleCustomers.length}
            </div>
            <p className="text-[11px] text-slate-500">Deuda: ${wholesaleDebt.toFixed(2)} USD</p>
          </div>
          <div className="p-2.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            <Building2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-md p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400">Cuentas por Cobrar Total</span>
            <div className="text-2xl font-bold text-white font-mono">
              ${totalDebt.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-500">Total adeudado en cartera</p>
          </div>
          <div className="p-2.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, razón social, DUI, NRC, NIT, giro o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
          >
            <option value="all">Todos los Clientes</option>
            <option value="wholesale">🏢 Solo Mayoristas / Empresas (CCF)</option>
            <option value="retail">👤 Solo Clientes al Detal (DUI)</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={debtFilter}
            onChange={(e) => setDebtFilter(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
          >
            <option value="all">Todos los Saldos</option>
            <option value="debtors">⚠️ Con Saldo Pendiente</option>
            <option value="cleared">✅ Solventes / Al Día</option>
          </select>
        </div>
      </div>

      {/* Tabla del Directorio de Clientes */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Cliente / Razón Social</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3">Identificación Tributaria</th>
                <th className="py-3 px-3">Ubicación & Contacto</th>
                <th className="py-3 px-3 text-right">Límite Crédito</th>
                <th className="py-3 px-3 text-right">Deuda ($ USD)</th>
                <th className="py-3 px-3 text-right">Total Compras</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No se encontraron clientes registrados en El Salvador con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const hasDebt = (c.currentDebt || 0) > 0;
                  const isWholesale = c.customerType === 'wholesale';

                  return (
                    <tr key={c.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-xs flex items-center gap-1.5">
                          {c.businessName || c.name}
                          {c.isWithholdingAgent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Gran Contribuyente (1% Ret)
                            </span>
                          )}
                        </div>
                        {c.businessName && (
                          <div className="text-[10px] text-slate-400">
                            Contacto: {c.name}
                          </div>
                        )}
                        {c.commercialActivity && (
                          <div className="text-[10px] text-purple-300/80 truncate max-w-xs">
                            Giro: {c.commercialActivity}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                            isWholesale
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : 'bg-sky-950 text-sky-300 border border-sky-800'
                          }`}
                        >
                          {isWholesale ? 'Mayorista (CCF)' : 'Detal (DUI)'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px]">
                        {isWholesale ? (
                          <div className="space-y-0.5">
                            {c.nrc && <div><span className="text-slate-400 font-bold">NRC:</span> <span className="font-mono text-white font-bold">{c.nrc}</span></div>}
                            {c.nit && <div><span className="text-slate-400 font-bold">NIT:</span> <span className="font-mono text-slate-300">{c.nit}</span></div>}
                            {!c.nrc && !c.nit && <span className="font-mono text-slate-300">{c.documentId}</span>}
                          </div>
                        ) : (
                          <div>
                            <span className="text-slate-400 font-bold">DUI: </span>
                            <span className="font-mono text-white font-bold">{c.documentId}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300 text-[11px]">
                        <div>{c.phone}</div>
                        {(c.department || c.municipality) && (
                          <div className="text-slate-400 text-[10px] flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-rose-400" />
                            {c.municipality ? `${c.municipality}, ` : ''}{c.department || 'El Salvador'}
                          </div>
                        )}
                        {c.address && (
                          <div className="text-slate-500 text-[10px] truncate max-w-[200px]">
                            {c.address}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        ${c.creditLimit.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={hasDebt ? 'text-rose-400 font-black' : 'text-emerald-400'}>
                          ${(c.currentDebt || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        ${(c.totalPurchases || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasDebt && (
                            <button
                              onClick={() => handleOpenPayment(c)}
                              title="Registrar abono de deuda"
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 active:scale-95"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Abonar</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditCustomer(c)}
                            title="Editar cliente"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 hover:text-sky-300 border border-slate-800 transition-colors"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteCustomerModal(c)}
                            title={isAdmin ? `Eliminar cliente "${c.name}"` : 'Eliminar cliente (Solo Administradores)'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isAdmin 
                                ? 'bg-slate-900 hover:bg-slate-800 text-rose-400 hover:text-rose-300 border-slate-800' 
                                : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Crear / Editar Cliente con Información Tributaria y Regional de El Salvador */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white font-['Outfit']">
                  {editingCustomer ? 'Editar Ficha de Cliente' : 'Registrar Nuevo Cliente (El Salvador)'}
                </h3>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
              
              {/* Selector de Clasificación de Cliente */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">Tipo de Cliente &bull; Clasificación Tributaria *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerType('retail');
                      setDocumentType('DUI');
                    }}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      customerType === 'retail'
                        ? 'bg-sky-600 border-sky-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Cliente al Detal (DUI)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomerType('wholesale');
                      setDocumentType('NIT');
                    }}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      customerType === 'wholesale'
                        ? 'bg-purple-600 border-purple-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Mayorista / Empresa (CCF)</span>
                  </button>
                </div>
              </div>

              {/* Campos obligatorios de Mayorista: Razón Social, Giro Comercial, NRC y NIT */}
              {customerType === 'wholesale' && (
                <div className="space-y-3 p-3.5 rounded-xl bg-purple-950/30 border border-purple-900/60">
                  <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                    <FileText className="w-4 h-4" />
                    <span>Datos Requeridos para Comprobante de Crédito Fiscal (CCF)</span>
                  </div>

                  <div>
                    <label className="block font-bold text-purple-200 mb-1">
                      Nombre de la Empresa / Razón Social *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Distribuidora Cuscatlán S.A. de C.V."
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-purple-700 text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-purple-200 mb-1">
                      Giro Comercial / Actividad Económica *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Venta de Ropa, Calzado y Artículos de Bazar al por Mayor"
                      value={commercialActivity}
                      onChange={(e) => setCommercialActivity(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-purple-700 text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-purple-200 mb-1">
                        NRC (Registro Contribuyente) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 284910-3"
                        value={nrc}
                        onChange={(e) => setNrc(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-purple-700 text-white font-mono focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-purple-200 mb-1">
                        NIT (Identificación Tributaria) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 0614-220815-101-9"
                        value={nit}
                        onChange={(e) => setNit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-purple-700 text-white font-mono focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>

                  {/* Conmutador de Gran Contribuyente (Retención 1% IVA) */}
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/80 border border-purple-800/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isWithholdingAgent}
                      onChange={(e) => setIsWithholdingAgent(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-slate-950 border-slate-700"
                    />
                    <div className="text-[11px] text-slate-300">
                      <strong className="text-white">Gran Contribuyente / Agente de Retención</strong> (Aplica retención del 1% de IVA en ventas)
                    </div>
                  </label>
                </div>
              )}

              {/* Nombre de la Persona de Contacto */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Nombre del Contacto / Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder={customerType === 'wholesale' ? "Ej: Carlos Mendoza (Encargado de Compras)" : "Ej: María Elena Rodríguez"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Documento de identidad para clientes al detalle (DUI / NIT) */}
              {customerType === 'retail' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Documento Oficial de Identidad *
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value as any)}
                        className="px-2 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                      >
                        <option value="DUI">DUI</option>
                        <option value="NIT">NIT</option>
                        <option value="NRC">NRC</option>
                      </select>
                      <input
                        type="text"
                        required
                        placeholder="02845619-3"
                        value={documentId}
                        onChange={(e) => setDocumentId(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Teléfono en El Salvador *</label>
                    <input
                      type="text"
                      required
                      placeholder="+503 7234-5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              {customerType === 'wholesale' && (
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Teléfono Móvil / PBX *</label>
                  <input
                    type="text"
                    required
                    placeholder="+503 2289-4455 / +503 7890-1234"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

              {/* Ubicación Geográfica en El Salvador */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Departamento (El Salvador)</label>
                  <select
                    value={department}
                    onChange={(e) => {
                      const newDept = e.target.value;
                      setDepartment(newDept);
                      const deptObj = SALVADORAN_DEPARTMENTS.find((d) => d.name === newDept);
                      if (deptObj && deptObj.municipalities.length > 0) {
                        setMunicipality(deptObj.municipalities[0]);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                  >
                    {SALVADORAN_DEPARTMENTS.map((dept) => (
                      <option key={dept.name} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Municipio</label>
                  <select
                    value={municipality}
                    onChange={(e) => setMunicipality(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                  >
                    {availableMunicipalities.map((mun) => (
                      <option key={mun} value={mun}>{mun}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Dirección Detallada {customerType === 'wholesale' ? '*' : '(Opcional)'}
                </label>
                <input
                  type="text"
                  required={customerType === 'wholesale'}
                  placeholder="Ej: Calle El Mirador y 87 Av. Norte, Torre Futura, Nivel 4"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="contacto@empresa.com.sv"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Límite de Crédito ($ USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-rose-950/40"
                >
                  {isSaving ? 'Guardando en Servidor...' : editingCustomer ? 'Actualizar Cliente' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Registro de Abono a Cuenta Corriente con Métodos Salvadoreños */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white font-['Outfit']">
                Registrar Abono a Cuenta Corriente ($ USD)
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
              <div className="font-bold text-white">
                {selectedCustomer.businessName || selectedCustomer.name}
              </div>
              <div className="text-slate-400">
                Saldo pendiente en servidor:{' '}
                <strong className="text-rose-400 font-mono text-sm">
                  ${(selectedCustomer.currentDebt || 0).toFixed(2)} USD
                </strong>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Monto del Abono ($ USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedCustomer.currentDebt || undefined}
                  required
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Método de Pago Local *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="cash">💵 Efectivo ($ USD - Entra a Gaveta)</option>
                  <option value="bank_transfer">🏦 Transferencia Bancaria (BAC, Agrícola, Cuscatlán, etc.)</option>
                  <option value="transfer365">⚡ Transfer365 / Transfer365 CA</option>
                  <option value="chivo_wallet">⚡ Chivo Wallet / Bitcoin (Sats / USD)</option>
                  <option value="tigo_money">📱 Tigo Money / Billetera Móvil</option>
                  <option value="card">💳 Tarjeta de Débito / Crédito (POS)</option>
                </select>
              </div>

              {paymentMethod === 'bank_transfer' && (
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Banco Receptor en El Salvador</label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {SALVADORAN_BANKS.map((bank) => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-300 mb-1">Número de Referencia / Comprobante</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ej: Ref Transfer365 #994812 o Comprobante BAC"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Notas / Observaciones</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ej: Pago total de factura anterior"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleRegisterPayment}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40"
              >
                {isSaving ? 'Registrando en Servidor...' : 'Confirmar Abono ($ USD)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmación de Eliminación de Cliente (Solo Administrador) */}
      {deleteModal.isOpen && deleteModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-md max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Confirmar Eliminación de Cliente</span>
              </div>
              <button
                onClick={() => setDeleteModal({ isOpen: false, customer: null })}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                ¿Estás seguro de que deseas eliminar este cliente y su registro de crédito? Esta acción no se puede deshacer.
              </p>

              <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs font-medium">Nombre / Contacto:</span>
                  <span className="font-bold text-white text-xs">{deleteModal.customer.name}</span>
                </div>
                {deleteModal.customer.businessName && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-xs font-medium">Empresa / Razón Social:</span>
                    <span className="text-purple-300 text-xs font-medium">{deleteModal.customer.businessName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs font-medium">Identificación:</span>
                  <span className="font-mono text-slate-300 text-xs">{deleteModal.customer.documentId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs font-medium">Saldo Pendiente (Deuda):</span>
                  <span className={`font-mono font-bold text-xs ${deleteModal.customer.currentDebt ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ${(deleteModal.customer.currentDebt || 0).toFixed(2)} USD
                  </span>
                </div>
              </div>

              {!isAdmin && (
                <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Acceso denegado: Solo los Administradores pueden realizar esta acción.</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, customer: null })}
                className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting || !isAdmin}
                onClick={handleConfirmDeleteCustomer}
                className={`px-4 py-1.5 rounded text-white text-xs font-semibold flex items-center gap-2 transition-colors ${
                  isAdmin
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-slate-700 cursor-not-allowed text-slate-400'
                }`}
              >
                {isDeleting ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
