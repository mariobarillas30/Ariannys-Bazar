import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  ShieldCheck, 
  ShoppingCart, 
  Package, 
  LogIn, 
  AlertCircle,
  KeyRound,
  Delete,
  CheckCircle2,
  UserCheck,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserRole } from '../types';
import { UserRepository } from '../repositories/UserRepository';

export function LoginView() {
  const { loginWithPin } = useAuth();

  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar usuarios en tiempo real desde Firestore
  useEffect(() => {
    UserRepository.ensureDefaultUsersSeeded().catch((err) => console.error(err));

    const unsubscribe = UserRepository.subscribeAllUsers(
      (usersList) => {
        setAvailableUsers(usersList || []);
        setIsLoadingUsers(false);
        // Si había un usuario seleccionado que ya no existe (fue eliminado), deseleccionarlo
        setSelectedUser((prev) => {
          if (!prev) return null;
          return usersList.find((u) => u.uid === prev.uid) || null;
        });
      },
      (err) => {
        console.error('Error al escuchar usuarios para el login:', err);
        setIsLoadingUsers(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Manejo de eventos del teclado físico (0-9, Backspace, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está interactuando con otro input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handlePinKey(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setEnteredPin((prev) => prev.slice(0, -1));
        setErrorMsg(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (enteredPin.length >= 4 && !isLoading) {
          handlePinSubmit();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEnteredPin('');
        setErrorMsg(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enteredPin, isLoading, selectedUser]);

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setEnteredPin('');
    setErrorMsg(null);
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setEnteredPin('');
    setErrorMsg(null);
  };

  const handlePinKey = (digit: string) => {
    if (enteredPin.length >= 6) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    setErrorMsg(null);

    // Auto-verificar cuando se ingresan 4 dígitos
    if (nextPin.length === 4) {
      setTimeout(() => {
        handlePinSubmit(nextPin);
      }, 150);
    }
  };

  const handlePinSubmit = async (pinToVerify?: string) => {
    const pin = (pinToVerify || enteredPin).trim();
    if (pin.length < 4) {
      setErrorMsg('El PIN debe contener al menos 4 dígitos.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (selectedUser) {
        // Validación obligatoria contra el usuario seleccionado
        await loginWithPin(pin, selectedUser.uid);
      } else {
        // Búsqueda inteligente directa por PIN
        await loginWithPin(pin);
      }
    } catch (err: any) {
      console.error('Error de autenticación por PIN:', err);
      setErrorMsg(
        err.message ||
          (selectedUser
            ? `El PIN es incorrecto para ${selectedUser.displayName}. Verifica tus credenciales.`
            : 'PIN no reconocido en el sistema. Selecciona tu usuario o ingresa el PIN correcto.')
      );
      setEnteredPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <ShieldCheck className="w-4 h-4 text-blue-400" />;
      case 'cashier':
        return <ShoppingCart className="w-4 h-4 text-emerald-400" />;
      case 'inventory':
        return <Package className="w-4 h-4 text-amber-400" />;
      default:
        return <UserCheck className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'cashier':
        return 'Cajero POS';
      case 'inventory':
        return 'Almacén / Stock';
      default:
        return 'Personal';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100 selection:bg-blue-600 selection:text-white">
      <div className="max-w-md w-full space-y-5">
        {/* Identidad del Negocio */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 shadow-inner mb-1">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            Ariannys Bazar
          </h1>
          <p className="text-xs text-slate-400">
            Terminal de Punto de Venta &bull; Acceso por PIN de Seguridad
          </p>
        </div>

        {/* Alerta de Error */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

          {/* 1. SELECCIÓN DE PERFIL / CAJERO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              1. Selecciona tu Perfil / Cajero ({availableUsers.length})
            </span>
            {selectedUser && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Cambiar</span>
              </button>
            )}
          </div>

          {isLoadingUsers ? (
            <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>Conectando con la base de datos...</span>
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400 space-y-2">
              <p>No se encontraron perfiles en la base de datos.</p>
              <button
                type="button"
                onClick={() => UserRepository.ensureDefaultUsersSeeded()}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors"
              >
                Inicializar Administrador
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {availableUsers.map((u) => {
                const isSelected = selectedUser?.uid === u.uid;
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                        : 'bg-slate-950 hover:bg-slate-850 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className="p-1 rounded-lg bg-slate-900 border border-slate-800">
                        {getRoleIcon(u.role)}
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white truncate" title={u.displayName}>
                        {u.displayName}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {getRoleLabel(u.role)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. TECLADO NUMÉRICO Y VERIFICACIÓN OBLIGATORIA DE PIN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="text-center space-y-1">
            <div className="inline-flex p-2 rounded-xl bg-blue-500/10 text-blue-400 mb-0.5">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white">
              {selectedUser
                ? `Ingresa el PIN de ${selectedUser.displayName}`
                : 'Ingresa tu PIN de Seguridad'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {selectedUser
                ? 'Ingresa tu código personal de 4 a 6 dígitos para iniciar turno.'
                : 'O escribe tu PIN directo en el teclado numérico para acceder.'}
            </p>
          </div>

          {/* Visualizador de PIN Enmascarado */}
          <div className="flex justify-center items-center gap-2 py-1">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = enteredPin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center text-xl font-bold transition-all select-none ${
                    isFilled
                      ? 'border-blue-500 bg-blue-600/20 text-blue-400 shadow-md scale-105'
                      : 'border-slate-800 bg-slate-950 text-slate-700'
                  }`}
                >
                  {isFilled ? '•' : '—'}
                </div>
              );
            })}
          </div>

          {/* Teclado Numérico Virtual Táctil */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                disabled={isLoading}
                onClick={() => handlePinKey(num)}
                className="py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800 text-white font-bold text-lg transition-all shadow-sm disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              disabled={isLoading || enteredPin.length === 0}
              onClick={() => {
                setEnteredPin('');
                setErrorMsg(null);
              }}
              className="py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800 text-slate-400 font-semibold text-xs transition-all disabled:opacity-40"
            >
              Limpiar
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handlePinKey('0')}
              className="py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800 text-white font-bold text-lg transition-all shadow-sm disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              disabled={isLoading || enteredPin.length === 0}
              onClick={() => {
                setEnteredPin((prev) => prev.slice(0, -1));
                setErrorMsg(null);
              }}
              className="py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800 text-slate-300 flex items-center justify-center transition-all disabled:opacity-40"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Botón de Confirmación */}
          <button
            type="button"
            disabled={isLoading || enteredPin.length < 4}
            onClick={() => handlePinSubmit()}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verificando PIN...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Entrar al Sistema</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
