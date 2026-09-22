import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Delete,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserRepository } from '../repositories/UserRepository';
import { PinAuthResult, UserRole } from '../types';

interface PinVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (authResult: PinAuthResult) => void;
  title?: string;
  actionDescription?: string;
  description?: string;
  targetUid?: string;
  targetUserId?: string;
  targetUserName?: string;
  allowAdminOverride?: boolean;
}

export function PinVerificationModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Verificación de Seguridad por PIN',
  actionDescription,
  description,
  targetUid,
  targetUserId,
  targetUserName,
  allowAdminOverride = true,
}: PinVerificationModalProps) {
  const effectiveDescription = description || actionDescription || 'Ingrese el PIN de seguridad de 4 a 6 dígitos para autorizar esta operación.';
  const effectiveTargetUid = targetUserId || targetUid;
  const [pin, setPin] = useState('');
  const [showDigits, setShowDigits] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<PinAuthResult | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMessage(null);
      setSuccessInfo(null);
      setIsVerifying(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 6 && !isVerifying) {
      const newPin = pin + num;
      setPin(newPin);
      setErrorMessage(null);
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !isVerifying) {
      setPin(pin.slice(0, -1));
      setErrorMessage(null);
    }
  };

  const handleClear = () => {
    if (!isVerifying) {
      setPin('');
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length < 4 || pin.length > 6) {
      setErrorMessage('El PIN debe contener entre 4 y 6 dígitos numéricos.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      // Verificación segura en el servidor central
      const result = await UserRepository.verifyPin(pin, effectiveTargetUid);

      if (result.success) {
        setSuccessInfo(result);
        setTimeout(() => {
          onSuccess(result);
          onClose();
        }, 600);
      } else {
        setErrorMessage(result.message || 'PIN inválido. Verifique su clave o solicite la autorización del Administrador.');
        setIsVerifying(false);
      }
    } catch (err: any) {
      console.error('Error al autenticar PIN:', err);
      setErrorMessage('Error al comunicarse con el servidor de seguridad. Intente nuevamente.');
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-white relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-400">Servidor de seguridad activo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isVerifying}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Detalle de la Acción a Autorizar */}
        <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Operación:</span>
            {targetUserName && (
              <span className="font-semibold text-slate-300">Usuario: {targetUserName}</span>
            )}
          </div>
          <p className="text-slate-200 font-medium text-[11px] leading-relaxed">
            {effectiveDescription}
          </p>
          {allowAdminOverride && (
            <div className="pt-1 text-[10px] text-blue-400 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>La clave de Administrador también autoriza esta acción.</span>
            </div>
          )}
        </div>

        {/* Visualizador de PIN Enmascarado (Estrictamente con puntos de privacidad) */}
        <div className="space-y-2">
          {/* Input protegido para recibir teclado físico */}
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPin(val);
                setErrorMessage(null);
              }}
              className="opacity-0 absolute -top-10 left-0 w-1 h-1 pointer-events-none"
              autoFocus
            />
          </form>

          <div 
            onClick={() => inputRef.current?.focus()}
            className="flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors"
          >
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const hasDigit = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`w-9 h-11 rounded-xl flex items-center justify-center text-xl font-bold font-mono transition-all select-none ${
                    hasDigit
                      ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400 shadow-sm shadow-blue-500/20'
                      : 'bg-slate-900 border border-slate-800 text-slate-600'
                  }`}
                >
                  {hasDigit ? (showDigits ? pin[idx] : '•') : ''}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <button
              type="button"
              onClick={() => setShowDigits(!showDigits)}
              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors p-1 -ml-1 rounded-lg hover:bg-slate-800/60"
            >
              {showDigits ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-blue-400" />
                  <span>Ocultar dígitos</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mostrar dígitos</span>
                </>
              )}
            </button>
            <span className="font-mono text-[10px] text-slate-500">
              {pin.length} / 6 dígitos
            </span>
          </div>
        </div>

        {/* Mensaje de Error o Éxito */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">{errorMessage}</span>
          </div>
        )}

        {successInfo && (
          <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="text-[11px] font-semibold">{successInfo.message}</span>
          </div>
        )}

        {/* Teclado Numérico Táctil */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              disabled={isVerifying}
              className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-white font-bold text-base border border-slate-700/80 transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            disabled={isVerifying || pin.length === 0}
            className="py-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white font-semibold text-xs border border-slate-800 transition-colors disabled:opacity-40"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            disabled={isVerifying}
            className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-white font-bold text-base border border-slate-700/80 transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isVerifying || pin.length === 0}
            className="py-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors flex items-center justify-center disabled:opacity-40"
            title="Borrar dígito"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        {/* Botón de Confirmación */}
        <div className="pt-2 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isVerifying}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isVerifying || pin.length < 4}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-colors"
          >
            {isVerifying ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Autorizar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
