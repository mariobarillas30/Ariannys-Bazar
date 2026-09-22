import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { 
  DollarSign, 
  Lock, 
  Unlock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  TrendingUp, 
  X,
  Receipt,
  KeyRound,
  ShieldCheck
} from 'lucide-react';
import { CashRegister, CashMovement, PinAuthResult } from '../types';
import { CashRegisterRepository } from '../repositories/CashRegisterRepository';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';
import { PinVerificationModal } from './PinVerificationModal';

interface CashRegisterViewProps {
  activeRegister: CashRegister | null;
  movements: CashMovement[];
  allRegisters: CashRegister[];
  cashierName: string;
  hasValidatedPin?: boolean;
  onPinValidated?: () => void;
  autoOpenShift?: boolean;
  onAutoOpenShiftHandled?: () => void;
}

export function CashRegisterView({
  activeRegister,
  movements,
  allRegisters,
  cashierName,
  hasValidatedPin = false,
  onPinValidated,
  autoOpenShift = false,
  onAutoOpenShiftHandled,
}: CashRegisterViewProps) {
  const { notifyPendingWrite, showSuccessToast } = useSync();
  const { userProfile, role } = useAuth();

  // Estados de modales
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);

  // Estados para Modal de Verificación de PIN en Firestore
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinActionTitle, setPinActionTitle] = useState('Verificación de Seguridad por PIN');
  const [pinActionDesc, setPinActionDesc] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => Promise<void> | void) | null>(null);

  // Estado de apertura de turno
  const [openingBalance, setOpeningBalance] = useState<number>(50);

  // Estado de cierre y arqueo de turno
  const [closingBalance, setClosingBalance] = useState<number>(0);
  const [closeNotes, setCloseNotes] = useState('');

  // Estado de movimientos extras (ingresos / retiros)
  const [movementType, setMovementType] = useState<'income' | 'expense'>('expense');
  const [movementAmount, setMovementAmount] = useState<number>(0);
  const [movementReason, setMovementReason] = useState('');

  // Control de guardado y mensajes de error
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Solicita autorización mediante PIN de Firestore
  const requestPinAuth = (title: string, desc: string, action: () => Promise<void> | void) => {
    setPinActionTitle(title);
    setPinActionDesc(desc);
    setPendingAction(() => action);
    setIsPinModalOpen(true);
  };

  const handlePinAuthSuccess = (authResult: PinAuthResult) => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
    if (authResult.isSuperAdminOverride) {
      showSuccessToast(`Acción autorizada por Super Admin: ${authResult.authorizedUserName}`);
    }
  };

  // Cálculo de efectivo esperado en gaveta (Fondo + Ventas Efectivo + Ingresos - Egresos)
  const expectedCashInDrawer = useMemo(() => {
    if (!activeRegister) return 0;
    return (
      (activeRegister.openingBalance || 0) +
      (activeRegister.totalCashSales || 0) +
      (activeRegister.totalIncomes || 0) -
      (activeRegister.totalExpenses || 0)
    );
  }, [activeRegister]);

  // Manejador al hacer clic en Abrir Turno (POS o CashRegisterView)
  const handleOpenShiftClick = () => {
    setErrorMsg(null);
    setIsOpenShiftModalOpen(true);
  };

  useEffect(() => {
    if (autoOpenShift) {
      if (onAutoOpenShiftHandled) onAutoOpenShiftHandled();
      handleOpenShiftClick();
    }
  }, [autoOpenShift]);

  // Apertura de turno de caja (Ya con PIN validado previamente)
  const handleOpenShift = async (e: FormEvent) => {
    e.preventDefault();
    if (openingBalance < 0) {
      setErrorMsg('El monto de apertura no puede ser negativo.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    notifyPendingWrite(true);

    try {
      await CashRegisterRepository.openRegister(Number(openingBalance), cashierName);
      showSuccessToast('¡Turno de caja abierto en tiempo real!');
      setIsOpenShiftModalOpen(false);
    } catch (err: any) {
      console.error('Error al abrir caja:', err);
      setErrorMsg(err.message || 'Error al abrir caja.');
    } finally {
      setIsSaving(false);
      notifyPendingWrite(false);
    }
  };

  // Cierre de turno y registro de arqueo con cálculo de discrepancia
  const handleCloseShift = async () => {
    if (!activeRegister) return;
    if (closingBalance < 0) {
      setErrorMsg('El conteo físico de cierre no puede ser negativo.');
      return;
    }

    requestPinAuth(
      'Autorización para Cierre y Arqueo de Caja',
      `Ingrese el PIN de cajero o PIN de Super Admin para confirmar el cierre de turno y arqueo por $${Number(closingBalance).toFixed(2)} USD.`,
      async () => {
        setIsSaving(true);
        setErrorMsg(null);
        notifyPendingWrite(true);

        try {
          await CashRegisterRepository.closeRegister(
            activeRegister.id,
            Number(closingBalance),
            closeNotes,
            cashierName
          );
          showSuccessToast('¡Turno de caja cerrado exitosamente y registrado en el servidor!');
          setIsCloseShiftModalOpen(false);
        } catch (err: any) {
          console.error('Error al cerrar caja:', err);
          setErrorMsg(err.message || 'Error al cerrar caja.');
        } finally {
          setIsSaving(false);
          notifyPendingWrite(false);
        }
      }
    );
  };

  // Registro de movimiento manual de efectivo (Ingreso / Egreso)
  const handleAddMovement = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeRegister) return;
    if (movementAmount <= 0) {
      setErrorMsg('El monto debe ser mayor a 0.');
      return;
    }
    if (!movementReason.trim()) {
      setErrorMsg('Debes especificar un concepto o motivo.');
      return;
    }

    const executeMovement = async () => {
      setIsSaving(true);
      setErrorMsg(null);
      notifyPendingWrite(true);

      try {
        await CashRegisterRepository.addMovement(
          activeRegister.id,
          movementType,
          Number(movementAmount),
          movementReason.trim(),
          cashierName
        );
        showSuccessToast(
          `Movimiento de ${movementType === 'income' ? 'Ingreso' : 'Egreso'} por $${movementAmount.toFixed(2)} registrado.`
        );
        setIsMovementModalOpen(false);
        setMovementAmount(0);
        setMovementReason('');
      } catch (err: any) {
        console.error('Error al agregar movimiento:', err);
        setErrorMsg(err.message || 'Error al registrar movimiento de caja.');
      } finally {
        setIsSaving(false);
        notifyPendingWrite(false);
      }
    };

    if (movementType === 'expense') {
      requestPinAuth(
        'Autorización de Retiro / Salida de Efectivo',
        `Se requiere PIN de cajero o Super Admin para autorizar el retiro de $${movementAmount.toFixed(2)} USD (Motivo: ${movementReason.trim()}).`,
        executeMovement
      );
    } else {
      await executeMovement();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Encabezado Principal */}
      <div className="bg-slate-900 border border-slate-800 rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-400" />
            Control de Caja y Arqueo
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Seguimiento de flujo de efectivo en tiempo real y conciliación directa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeRegister ? (
            <>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setIsMovementModalOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                <span>Ingreso / Retiro Extra</span>
              </button>
              <button
                onClick={() => {
                  setClosingBalance(expectedCashInDrawer);
                  setErrorMsg(null);
                  setIsCloseShiftModalOpen(true);
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Cerrar Turno</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleOpenShiftClick}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Abrir Nuevo Turno</span>
            </button>
          )}
        </div>
      </div>

      {/* ESTADO DEL TURNO ACTIVO */}
      {activeRegister ? (
        <div className="bg-slate-900 border border-slate-800 rounded-md p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <div>
                <h3 className="font-bold text-sm text-white">Turno de Caja Abierto</h3>
                <p className="text-xs text-slate-400">
                  Apertura: {new Date(activeRegister.openedAt).toLocaleString('es-ES')} por{' '}
                  <strong className="text-slate-200">{activeRegister.openedBy}</strong>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400">Efectivo Estimado en Gaveta:</span>
              <div className="text-2xl font-bold text-white font-mono">
                ${expectedCashInDrawer.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Cuadrícula de Desglose Financiero */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Fondo de Apertura</span>
              <div className="text-lg font-bold text-white font-mono mt-1">
                ${(activeRegister.openingBalance || 0).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" /> Ventas en Efectivo
              </span>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                +${(activeRegister.totalCashSales || 0).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-sky-400 font-medium">Ingresos Extras</span>
              <div className="text-lg font-bold text-sky-400 font-mono mt-1">
                +${(activeRegister.totalIncomes || 0).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> Retiros / Gastos
              </span>
              <div className="text-lg font-bold text-rose-400 font-mono mt-1">
                -${(activeRegister.totalExpenses || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Ventas en Otros Métodos de Pago */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">
              Ventas en otros métodos (Tarjeta, Transferencia, Pago Móvil):
            </span>
            <span className="font-bold text-slate-200 font-mono text-sm">
              ${(activeRegister.totalOtherSales || 0).toFixed(2)}
            </span>
          </div>

          {/* Línea de Tiempo de Movimientos del Turno Actual */}
          <div className="pt-2 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Movimientos del Turno Actual ({movements.length})
            </h4>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {movements.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">
                  No se han registrado ingresos ni retiros manuales durante este turno.
                </p>
              ) : (
                movements.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`p-1 rounded-md ${
                          m.type === 'income' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}
                      >
                        {m.type === 'income' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                      </span>
                      <div>
                        <span className="font-semibold text-white">{m.reason}</span>
                        <span className="text-[10px] text-slate-400 ml-2 font-mono">
                          {new Date(m.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`font-mono font-bold ${
                        m.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {m.type === 'income' ? `+$${m.amount.toFixed(2)}` : `-$${m.amount.toFixed(2)}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-16 text-center bg-slate-950 border border-dashed border-slate-800 rounded-2xl space-y-3">
          <Lock className="w-12 h-12 mx-auto text-slate-600" />
          <h3 className="font-bold text-base text-white">La Caja está Cerrada</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Abre un nuevo turno de caja para registrar el fondo inicial en efectivo y habilitar el arqueo automático.
          </p>
          <button
            onClick={() => {
              setErrorMsg(null);
              setIsOpenShiftModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 inline-flex items-center gap-2"
          >
            <Unlock className="w-4 h-4" />
            <span>Abrir Turno de Caja</span>
          </button>
        </div>
      )}

      {/* HISTORIAL DE TURNOS DE CAJA ANTERIORES */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <History className="w-5 h-5 text-rose-500" />
          <h3 className="font-bold text-sm text-white">Historial de Turnos de Caja Anteriores</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Apertura</th>
                <th className="py-2.5 px-3">Cierre</th>
                <th className="py-2.5 px-3">Cajero</th>
                <th className="py-2.5 px-3 text-right">Fondo Inicial</th>
                <th className="py-2.5 px-3 text-right">Ventas Efectivo</th>
                <th className="py-2.5 px-3 text-right">Esperado</th>
                <th className="py-2.5 px-3 text-right">Real (Arqueo)</th>
                <th className="py-2.5 px-3 text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {allRegisters.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No hay turnos registrados en el historial.
                  </td>
                </tr>
              ) : (
                allRegisters.map((reg) => {
                  const disc = reg.discrepancy || 0;
                  return (
                    <tr key={reg.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            reg.status === 'open'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}
                        >
                          {reg.status === 'open' ? 'Abierto' : 'Cerrado'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                        {new Date(reg.openedAt).toLocaleDateString('es-ES')}{' '}
                        {new Date(reg.openedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {reg.closedAt
                          ? `${new Date(reg.closedAt).toLocaleDateString('es-ES')} ${new Date(reg.closedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                          : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">{reg.openedBy}</td>
                      <td className="py-2.5 px-3 text-right font-mono">${(reg.openingBalance || 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                        +${(reg.totalCashSales || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                        ${reg.expectedBalance !== undefined ? reg.expectedBalance.toFixed(2) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-200">
                        ${reg.closingBalance !== undefined ? reg.closingBalance.toFixed(2) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {reg.status === 'closed' ? (
                          disc === 0 ? (
                            <span className="text-emerald-400">Cuadrado ($0)</span>
                          ) : disc > 0 ? (
                            <span className="text-sky-400">+${disc.toFixed(2)} (Sobrante)</span>
                          ) : (
                            <span className="text-rose-400">-${Math.abs(disc).toFixed(2)} (Faltante)</span>
                          )
                        ) : (
                          <span className="text-slate-500">En curso</span>
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

      {/* MODAL: Apertura de Turno de Caja */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white font-['Outfit']">
                Apertura de Turno de Caja
              </h3>
              <button
                onClick={() => setIsOpenShiftModalOpen(false)}
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

            <form onSubmit={handleOpenShift} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Monto Inicial en Gaveta / Fondo ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-[11px] space-y-1">
                <div>Cajero responsable: <strong className="text-white">{cashierName}</strong></div>
                <div>Fecha y hora: {new Date().toLocaleString('es-ES')}</div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40"
                >
                  {isSaving ? 'Abriendo en Servidor...' : 'Confirmar Apertura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Cierre de Turno y Arqueo */}
      {isCloseShiftModalOpen && activeRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white font-['Outfit']">
                Cierre de Turno & Arqueo de Caja
              </h3>
              <button
                onClick={() => setIsCloseShiftModalOpen(false)}
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

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Efectivo Esperado según Sistema:</span>
                <span className="font-mono font-bold text-white text-sm">${expectedCashInDrawer.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>(Fondo + Ventas Efectivo + Ingresos - Egresos)</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Monto Físico Real Contado en Gaveta ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Indicador reactivo de discrepancia / sobrante / faltante */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">Diferencia de Arqueo:</span>
                <span
                  className={`font-mono font-black text-sm ${
                    closingBalance - expectedCashInDrawer === 0
                      ? 'text-emerald-400'
                      : closingBalance - expectedCashInDrawer > 0
                      ? 'text-sky-400'
                      : 'text-rose-400'
                  }`}
                >
                  {closingBalance - expectedCashInDrawer === 0
                    ? 'Cuadrado exacto ($0.00)'
                    : closingBalance - expectedCashInDrawer > 0
                    ? `+$${(closingBalance - expectedCashInDrawer).toFixed(2)} (Sobrante)`
                    : `-$${Math.abs(closingBalance - expectedCashInDrawer).toFixed(2)} (Faltante)`}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Observaciones / Notas de Cierre</label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ej: Turno finalizado sin novedades"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleCloseShift}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30"
              >
                {isSaving ? 'Guardando Cierre en Servidor...' : 'Confirmar Cierre de Turno'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Movimiento Extra (Ingreso / Egreso) */}
      {isMovementModalOpen && activeRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white font-['Outfit']">
                Registrar Movimiento Extra de Efectivo
              </h3>
              <button
                onClick={() => setIsMovementModalOpen(false)}
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

            <form onSubmit={handleAddMovement} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Tipo de Movimiento *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('expense')}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-colors ${
                      movementType === 'expense'
                        ? 'bg-rose-600 border-rose-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Egreso / Retiro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('income')}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-colors ${
                      movementType === 'income'
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>Ingreso Extra</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Monto ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={movementAmount || ''}
                  onChange={(e) => setMovementAmount(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Concepto o Razón *</label>
                <input
                  type="text"
                  required
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="Ej: Pago de flete, compra de bolsas, cambio menor"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-rose-600/30"
                >
                  {isSaving ? 'Guardando en Servidor...' : 'Registrar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Validación de PIN en Firestore */}
      <PinVerificationModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={handlePinAuthSuccess}
        title={pinActionTitle}
        description={pinActionDesc}
        targetUserId={userProfile?.uid}
        targetUserName={userProfile?.displayName || cashierName}
      />
    </div>
  );
}
