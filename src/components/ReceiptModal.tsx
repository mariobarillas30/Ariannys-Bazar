import { Printer, CheckCircle, X, ShoppingBag, Building2, Receipt, FileText } from 'lucide-react';
import { Sale } from '../types';
import { COMPANY_INFO_SV } from '../lib/elSalvadorData';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const paymentLabels: Record<string, string> = {
    cash: 'Efectivo ($ USD)',
    card: 'Tarjeta de Débito / Crédito',
    bank_transfer: 'Transferencia Bancaria',
    transfer: 'Transferencia Bancaria',
  };

  const isCCF = sale.invoiceType === 'tax_credit';
  const isWholesale = sale.saleType === 'wholesale' || sale.customerType === 'wholesale';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Encabezado del modal */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <CheckCircle className="w-5 h-5" />
            <span>Comprobante Emitido &bull; El Salvador</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Área imprimible del tiquete/factura */}
        <div className="p-6 overflow-y-auto print:p-0 font-mono text-xs bg-slate-950 text-slate-100 flex-1 space-y-4">
          <div className="text-center pb-3 border-b border-dashed border-slate-700 space-y-1">
            <div className="flex justify-center mb-1">
              <ShoppingBag className="w-6 h-6 text-rose-500" />
            </div>
            <h2 className="text-base font-bold tracking-wider font-sans text-white">
              {COMPANY_INFO_SV.businessName}
            </h2>
            <p className="text-[11px] font-sans text-slate-300 font-bold">{COMPANY_INFO_SV.name}</p>
            <p className="text-[10px] text-slate-400">
              NRC: {COMPANY_INFO_SV.nrc} &bull; NIT: {COMPANY_INFO_SV.nit}
            </p>
            <p className="text-[9px] text-slate-400">
              Giro: {COMPANY_INFO_SV.giro}
            </p>
            <p className="text-[9px] text-slate-400">
              {COMPANY_INFO_SV.address}
            </p>
            <p className="text-[9px] text-slate-400">
              Tel: {COMPANY_INFO_SV.phone}
            </p>

            {/* Distintivo de tipo de documento */}
            <div className="pt-1">
              {isCCF ? (
                <div className="p-1 rounded-lg bg-purple-950/90 border border-purple-800 text-purple-200 text-[10px] font-bold">
                  ★ COMPROBANTE DE CRÉDITO FISCAL (CCF) ★
                </div>
              ) : sale.invoiceType === 'ticket' ? (
                <div className="p-1 rounded-lg bg-emerald-950/90 border border-emerald-800 text-emerald-300 text-[10px] font-bold">
                  TIQUETE DE CAJA / RECIBO INTERNO
                </div>
              ) : (
                <div className="p-1 rounded-lg bg-sky-950/90 border border-sky-800 text-sky-200 text-[10px] font-bold">
                  FACTURA DE CONSUMIDOR FINAL
                </div>
              )}
            </div>

            <p className="text-[9px] text-emerald-400 font-semibold">
              Sincronización en Tiempo Real &bull; Base de Datos Firestore
            </p>
          </div>

          {/* Metadatos del comprobante e información del cliente */}
          <div className="space-y-1 text-slate-300 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">No. Comprobante:</span>
              <span className="font-bold text-white font-mono">{sale.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Fecha / Hora:</span>
              <span>{new Date(sale.createdAt).toLocaleString('es-SV', { timeZone: 'America/El_Salvador' })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cajero / Emisor:</span>
              <span>{sale.createdBy}</span>
            </div>

            {/* Datos fiscales y comerciales del cliente */}
            {sale.customerName && (
              <div className="pt-1 mt-1 border-t border-slate-800/80 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente / Razón Social:</span>
                  <span className="font-bold text-rose-300">{sale.customerBusinessName || sale.customerName}</span>
                </div>
                {sale.customerBusinessName && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Contacto:</span>
                    <span>{sale.customerName}</span>
                  </div>
                )}
                {sale.customerNrc && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">NRC:</span>
                    <span className="font-bold text-white">{sale.customerNrc}</span>
                  </div>
                )}
                {(sale.customerNit || sale.customerDocumentId) && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">{sale.customerDocumentType || (isCCF ? 'NIT' : 'DUI')}:</span>
                    <span className="font-bold text-white">{sale.customerNit || sale.customerDocumentId}</span>
                  </div>
                )}
                {sale.customerGiro && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Giro:</span>
                    <span className="text-right truncate max-w-[200px]">{sale.customerGiro}</span>
                  </div>
                )}
                {(sale.customerDepartment || sale.customerMunicipality) && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Ubicación:</span>
                    <span>{sale.customerMunicipality ? `${sale.customerMunicipality}, ` : ''}{sale.customerDepartment || 'El Salvador'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Detalles del método de pago */}
            <div className="flex justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-500">Método de Pago:</span>
              <span className="font-semibold text-sky-400">{paymentLabels[sale.paymentMethod] || sale.paymentMethod}</span>
            </div>
            {sale.paymentDetails?.bankName && (
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Banco:</span>
                <span>{sale.paymentDetails.bankName}</span>
              </div>
            )}
            {sale.paymentDetails?.referenceNumber && (
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Ref. Transacción:</span>
                <span className="font-mono text-white">{sale.paymentDetails.referenceNumber}</span>
              </div>
            )}
          </div>

          {/* Tabla de artículos adquiridos */}
          <div className="border-t border-b border-dashed border-slate-700 py-3 space-y-2">
            <div className="grid grid-cols-12 font-bold text-slate-400 text-[10px] pb-1 border-b border-slate-800">
              <span className="col-span-6">DESCRIPCIÓN</span>
              <span className="col-span-2 text-center">CANT</span>
              <span className="col-span-2 text-right">P.U. ($)</span>
              <span className="col-span-2 text-right">TOTAL</span>
            </div>
            {sale.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 text-[11px] items-start py-0.5">
                <div className="col-span-6 pr-1">
                  <div className="font-medium text-slate-200 truncate flex items-center gap-1">
                    <span>{item.productName}</span>
                    {item.appliedPriceType === 'dozen' && (
                      <span className="text-[8px] bg-purple-900 text-purple-200 px-1 py-0.2 rounded font-bold">
                        DOC
                      </span>
                    )}
                    {item.appliedPriceType === 'half_dozen' && (
                      <span className="text-[8px] bg-sky-900 text-sky-200 px-1 py-0.2 rounded font-bold">
                        ½ DOC
                      </span>
                    )}
                    {item.appliedPriceType === 'wholesale' && (
                      <span className="text-[8px] bg-purple-900 text-purple-200 px-1 py-0.2 rounded font-bold">
                        MAY
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-500 font-sans">{item.sku}</div>
                </div>
                <span className="col-span-2 text-center text-slate-300">{item.quantity}</span>
                <span className="col-span-2 text-right text-slate-400">${item.unitPrice.toFixed(2)}</span>
                <span className="col-span-2 text-right font-bold text-white">${item.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Resumen de totales según normativa de El Salvador */}
          <div className="space-y-1.5 pt-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Sumas Gravadas (Subtotal):</span>
              <span>${sale.subtotal.toFixed(2)} USD</span>
            </div>
            {sale.totalSavings !== undefined && sale.totalSavings > 0 && (
              <div className="flex justify-between text-slate-300 font-bold">
                <span>Ahorro por Mayoreo:</span>
                <span>-${sale.totalSavings.toFixed(2)} USD</span>
              </div>
            )}
            {sale.discount > 0 && (
              <div className="flex justify-between text-slate-300">
                <span>Descuento aplicado:</span>
                <span>-${sale.discount.toFixed(2)} USD</span>
              </div>
            )}
            {isCCF && (
              <div className="flex justify-between text-slate-300 font-medium">
                <span>13% IVA Débito Fiscal:</span>
                <span>+${sale.tax.toFixed(2)} USD</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-slate-700">
              <span>TOTAL A PAGAR:</span>
              <span className="text-emerald-400 text-base font-black font-mono">
                ${sale.total.toFixed(2)} USD
              </span>
            </div>

            {sale.paymentMethod === 'cash' && sale.amountReceived !== undefined && sale.amountReceived > 0 && (
              <div className="pt-2 border-t border-dashed border-slate-800 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Monto Recibido:</span>
                  <span>${sale.amountReceived.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between font-bold text-amber-300">
                  <span>Cambio / Vuelto:</span>
                  <span>${(sale.changeGiven || 0).toFixed(2)} USD</span>
                </div>
              </div>
            )}
          </div>

          <div className="text-center pt-3 border-t border-dashed border-slate-700 text-[10px] text-slate-400 space-y-0.5">
            <p className="font-semibold text-slate-200">¡Gracias por su compra en Ariannys Bazar El Salvador!</p>
            <p>Operaciones en Dólares Estadounidenses ($ USD) bajo normativa de El Salvador.</p>
          </div>
        </div>

        {/* Acciones de pie de modal */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 shadow-lg shadow-rose-950/50 active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Comprobante</span>
          </button>
        </div>
      </div>
    </div>
  );
}
