import { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Eye, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileText,
  X,
  Building2,
  Tag,
  Receipt,
  Sparkles
} from 'lucide-react';
import { Sale } from '../types';
import { SalesRepository } from '../repositories/SalesRepository';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';

interface SalesHistoryViewProps {
  sales: Sale[];
  cashierName: string;
  onViewReceipt: (sale: Sale) => void;
}

export function SalesHistoryView({ sales, cashierName, onViewReceipt }: SalesHistoryViewProps) {
  const { notifyPendingWrite, showSuccessToast } = useSync();
  const { role } = useAuth();

  const [search, setSearch] = useState('');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<'all' | 'consumer_invoice' | 'tax_credit' | 'ticket'>('all');
  const [saleTypeFilter, setSaleTypeFilter] = useState<'all' | 'retail' | 'wholesale'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled'>('all');

  // Estado del modal de anulación
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('Error de digitación o solicitud de cliente');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtrado reactivo de ventas según criterios
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchSearch =
        s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        (s.customerName && s.customerName.toLowerCase().includes(search.toLowerCase())) ||
        (s.customerBusinessName && s.customerBusinessName.toLowerCase().includes(search.toLowerCase())) ||
        (s.customerNrc && s.customerNrc.toLowerCase().includes(search.toLowerCase())) ||
        (s.customerNit && s.customerNit.toLowerCase().includes(search.toLowerCase())) ||
        s.createdBy.toLowerCase().includes(search.toLowerCase());

      const matchInvoiceType =
        invoiceTypeFilter === 'all' || s.invoiceType === invoiceTypeFilter || (!s.invoiceType && invoiceTypeFilter === 'consumer_invoice');

      const matchType = 
        saleTypeFilter === 'all' || 
        (saleTypeFilter === 'wholesale' ? (s.saleType === 'wholesale' || s.customerType === 'wholesale') : (s.saleType !== 'wholesale' && s.customerType !== 'wholesale'));

      const matchMethod = methodFilter === 'all' || s.paymentMethod === methodFilter;

      let matchStatus = true;
      if (statusFilter === 'active') matchStatus = !s.isCancelled;
      if (statusFilter === 'cancelled') matchStatus = !!s.isCancelled;

      return matchSearch && matchInvoiceType && matchType && matchMethod && matchStatus;
    });
  }, [sales, search, invoiceTypeFilter, saleTypeFilter, methodFilter, statusFilter]);

  // Métricas agregadas de facturación y volumen por segmento
  const activeSales = sales.filter((s) => !s.isCancelled);
  const totalVolume = activeSales.reduce((acc, s) => acc + s.total, 0);
  const wholesaleSalesVolume = activeSales.filter(s => s.saleType === 'wholesale' || s.customerType === 'wholesale').reduce((a, b) => a + b.total, 0);
  const retailSalesVolume = totalVolume - wholesaleSalesVolume;

  const handleOpenCancel = (sale: Sale) => {
    setSaleToCancel(sale);
    setCancelReason('Error de digitación / Solicitud de cliente');
    setErrorMsg(null);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!saleToCancel) return;

    setIsProcessing(true);
    setErrorMsg(null);
    notifyPendingWrite(true);

    try {
      await SalesRepository.cancelSale(saleToCancel.id, cancelReason, cashierName);
      showSuccessToast(`Venta #${saleToCancel.invoiceNumber} anulada y stock devuelto atómicamente a inventario.`);
      setIsCancelModalOpen(false);
    } catch (err: any) {
      console.error('Error al anular venta:', err);
      setErrorMsg(err.message || 'Error al anular la venta.');
    } finally {
      setIsProcessing(false);
      notifyPendingWrite(false);
    }
  };

  const paymentLabels: Record<string, string> = {
    cash: 'Efectivo ($ USD)',
    card: 'Tarjeta (POS)',
    bank_transfer: 'Banco Local SV',
    transfer365: 'Transfer365',
    chivo_wallet: 'Chivo / Bitcoin',
    tigo_money: 'Tigo Money',
    credit: 'Crédito',
    transfer: 'Transferencia',
    mobile_pay: 'Pago Móvil',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Encabezado Principal */}
      <div className="bg-slate-900 border border-slate-800 rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-4 h-4 text-blue-400" />
            Historial de Ventas & Facturación
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Registro completo de comprobantes emitidos. Total registros: {sales.length}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1 rounded text-xs">
            <span className="text-slate-400">Detal: </span>
            <strong className="text-white font-mono">${retailSalesVolume.toFixed(2)} USD</strong>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-3 py-1 rounded text-xs">
            <span className="text-slate-400">Mayoreo: </span>
            <strong className="text-white font-mono">${wholesaleSalesVolume.toFixed(2)} USD</strong>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-3 py-1 rounded text-xs">
            <span className="text-slate-400">Total: </span>
            <strong className="font-bold text-white font-mono text-xs">${totalVolume.toFixed(2)} USD</strong>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-md p-3 grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-3 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por #, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={invoiceTypeFilter}
            onChange={(e) => setInvoiceTypeFilter(e.target.value as any)}
            className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todos los Comprobantes</option>
            <option value="tax_credit">Crédito Fiscal (CCF)</option>
            <option value="consumer_invoice">Factura Consumidor</option>
            <option value="ticket">Tiquete de Caja</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <select
            value={saleTypeFilter}
            onChange={(e) => setSaleTypeFilter(e.target.value as any)}
            className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Tarifa: Todas</option>
            <option value="wholesale">🏢 Mayoreo</option>
            <option value="retail">👤 Detal</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
          >
            <option value="all">Método: Todos</option>
            <option value="cash">Efectivo</option>
            <option value="bank_transfer">Banco Local</option>
            <option value="transfer365">Transfer365</option>
            <option value="chivo_wallet">Chivo / BTC</option>
            <option value="tigo_money">Tigo Money</option>
            <option value="card">Tarjeta</option>
            <option value="credit">Crédito</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
          >
            <option value="all">Estado: Todos</option>
            <option value="active">Activas</option>
            <option value="cancelled">Anuladas</option>
          </select>
        </div>
      </div>

      {/* Tabla de Historial de Ventas */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Comprobante</th>
                <th className="py-3 px-3">Tipo Doc</th>
                <th className="py-3 px-3">Fecha & Hora</th>
                <th className="py-3 px-3">Cliente / Razón Social</th>
                <th className="py-3 px-3">Cajero</th>
                <th className="py-3 px-3">Método Pago</th>
                <th className="py-3 px-3 text-center">Ítems</th>
                <th className="py-3 px-3 text-right">Total ($ USD)</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No se encontraron registros de ventas coincidentes.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const isCCF = sale.invoiceType === 'tax_credit';
                  const isWholesale = sale.saleType === 'wholesale' || sale.customerType === 'wholesale';

                  return (
                    <tr
                      key={sale.id}
                      className={`hover:bg-slate-900/60 transition-colors ${
                        sale.isCancelled ? 'opacity-60 bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-white text-sm">
                        {sale.invoiceNumber}
                      </td>
                      <td className="py-3 px-3">
                        {isCCF ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-purple-950 text-purple-300 border border-purple-800">
                            CCF
                          </span>
                        ) : sale.invoiceType === 'ticket' ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            TIQUETE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-sky-950 text-sky-300 border border-sky-800">
                            FACTURA
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                        {new Date(sale.createdAt).toLocaleDateString('es-SV')}{' '}
                        <span className="text-slate-500">
                          {new Date(sale.createdAt).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-300">
                        <div className="font-bold text-white">
                          {sale.customerBusinessName || sale.customerName || <span className="text-slate-500 font-normal">Consumidor Final</span>}
                        </div>
                        {sale.customerNrc && (
                          <div className="text-[10px] text-purple-300 font-mono">NRC: {sale.customerNrc}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{sale.createdBy}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-sky-300 border border-slate-800">
                          {paymentLabels[sale.paymentMethod] || sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {sale.items.reduce((acc, item) => acc + item.quantity, 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-white text-sm">
                        ${sale.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {sale.isCancelled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                            Anulada
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Emitida
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => onViewReceipt(sale)}
                          title="Ver o imprimir comprobante"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-700 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!sale.isCancelled && (
                          role === 'admin' ? (
                            <button
                              onClick={() => handleOpenCancel(sale)}
                              title="Anular venta y revertir inventario (Administrador)"
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-rose-400 hover:text-rose-200 border border-slate-700 hover:border-rose-700 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              disabled
                              title="Solo el Administrador tiene permiso para anular ventas"
                              className="p-1.5 rounded-lg bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Sale Modal */}
      {isCancelModalOpen && saleToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <span>Anular Venta #{saleToCancel.invoiceNumber}</span>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Esta acción restaurará automáticamente el stock de{' '}
                <strong>{saleToCancel.items.reduce((a, b) => a + b.quantity, 0)} productos</strong> en la base de datos Firestore y anulará la deuda del cliente si fue una venta al crédito.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Motivo de Anulación</label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
                  placeholder="Describe la razón de la anulación..."
                />
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs">
                  {errorMsg}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 shadow-lg shadow-rose-950/50"
              >
                {isProcessing ? 'Anulando en Servidor...' : 'Confirmar Anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
