import React, { useState, FormEvent } from 'react';
import { 
  ShoppingBag, 
  ShieldCheck, 
  Package, 
  ShoppingCart, 
  Lock, 
  Mail, 
  UserPlus, 
  LogIn, 
  ArrowRight,
  ShieldAlert,
  KeyRound,
  Delete,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export function LoginView() {
  const { 
    loginWithGoogle, 
    loginWithEmail, 
    registerWithEmail, 
    loginAsDemoRole,
    loginWithPin
  } = useAuth();

  const [mode, setMode] = useState<'pin' | 'demo' | 'login' | 'register'>('pin');
  
  // PIN Login State
  const [enteredPin, setEnteredPin] = useState('');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('cashier');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePinSubmit = async (pinToVerify?: string) => {
    const pin = (pinToVerify || enteredPin).trim();
    if (pin.length < 4) {
      setErrorMsg('El PIN debe contener al menos 4 dígitos numéricos.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await loginWithPin(pin);
    } catch (err: any) {
      console.error('PIN login error:', err);
      setErrorMsg(err.message || 'PIN de seguridad incorrecto o no registrado en el servidor central.');
      setEnteredPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinKey = (val: string) => {
    if (enteredPin.length >= 6) return;
    const next = enteredPin + val;
    setEnteredPin(next);
    setErrorMsg(null);
    if (next.length === 4) {
      // Auto-verificar si tiene 4 dígitos
      setTimeout(() => {
        handlePinSubmit(next);
      }, 200);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Error al iniciar sesión. Verifique sus credenciales.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regPassword || !regName) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await registerWithEmail(regEmail, regPassword, regName, regRole);
    } catch (err: any) {
      console.error('Register error:', err);
      setErrorMsg(err.message || 'Error al registrar usuario en el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google login error:', err);
      setErrorMsg('No se pudo autenticar con Google: ' + (err.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoClick = async (role: UserRole) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await loginAsDemoRole(role);
    } catch (err: any) {
      console.error('Demo login error:', err);
      setErrorMsg('Error al activar perfil demo: ' + (err.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      <div className="max-w-md w-full space-y-5">
        {/* Encabezado */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-blue-600/10 border border-blue-500/20 text-blue-400 mb-1">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white font-['Outfit']">
            Ariannys Bazar POS
          </h1>
          <p className="text-xs text-slate-400">
            Control de Acceso y Punto de Venta en la Nube
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode('pin')}
            className={`flex-1 py-1.5 rounded-lg transition-colors ${
              mode === 'pin'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Acceso por PIN
          </button>
          <button
            type="button"
            onClick={() => setMode('demo')}
            className={`flex-1 py-1.5 rounded-lg transition-colors ${
              mode === 'demo'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Perfiles Rápidos
          </button>
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-1.5 rounded-lg transition-colors ${
              mode === 'login'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Correo
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-1.5 rounded-lg transition-colors ${
              mode === 'register'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Registro
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* MODE 0: ACCESO POR PIN */}
        {mode === 'pin' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="text-center space-y-1">
              <div className="inline-flex p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 mb-1">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">
                Ingrese su PIN de Seguridad
              </h3>
              <p className="text-[11px] text-slate-400">
                Código confidencial verificado en el servidor de seguridad
              </p>
            </div>

            {/* Visualizador de PIN Enmascarado */}
            <div className="flex justify-center items-center gap-2.5 py-2">
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = enteredPin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl font-bold transition-all select-none ${
                      isFilled
                        ? 'border-blue-500 bg-blue-600/20 text-blue-400 shadow-md scale-105'
                        : 'border-slate-700 bg-slate-950 text-slate-600'
                    }`}
                  >
                    {isFilled ? '•' : '—'}
                  </div>
                );
              })}
            </div>

            {/* Teclado Numérico Virtual */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handlePinKey(num)}
                  className="py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-white font-bold text-lg transition-all active:scale-95 shadow-sm"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={isLoading || enteredPin.length === 0}
                onClick={() => setEnteredPin('')}
                className="py-3.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 font-semibold text-xs transition-all active:scale-95"
              >
                Limpiar
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handlePinKey('0')}
                className="py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-white font-bold text-lg transition-all active:scale-95 shadow-sm"
              >
                0
              </button>
              <button
                type="button"
                disabled={isLoading || enteredPin.length === 0}
                onClick={() => setEnteredPin((prev) => prev.slice(0, -1))}
                className="py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-center transition-all active:scale-95"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              disabled={isLoading || enteredPin.length < 4}
              onClick={() => handlePinSubmit()}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verificando en el servidor...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Ingresar al Sistema</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* MODE 1: ACCESO RÁPIDO DEMO */}
        {mode === 'demo' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="text-center pb-2 border-b border-slate-800">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Selecciona un Perfil de Acceso
              </h3>
            </div>

            {/* Admin */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleDemoClick('admin')}
              className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 transition-colors group flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white group-hover:text-blue-400">
                    Administrador
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Acceso Total
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Punto de Venta, Inventario, Clientes, Turnos de Caja, Reportes y Usuarios.
                </p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 self-center" />
            </button>

            {/* Cashier */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleDemoClick('cashier')}
              className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 transition-colors group flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white group-hover:text-blue-400">
                    Cajero Arianny
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Exclusivo POS
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Punto de Venta y Cobro. Módulos administrativos restringidos.
                </p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 self-center" />
            </button>

            {/* Inventory */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleDemoClick('inventory')}
              className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 transition-colors group flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                <Package className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white group-hover:text-blue-400">
                    Almacén / Control de Stock
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Exclusivo Stock
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Catálogo de productos, existencias y movimientos de almacén.
                </p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 self-center" />
            </button>
          </div>
        )}

        {/* MODE 2: INICIAR SESIÓN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Iniciar Sesión</h3>
            
            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Correo Electrónico</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Contraseña</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <LogIn className="w-3.5 h-3.5" />
              {isLoading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-slate-900 px-2 text-slate-500">O continúa con</span>
              </div>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleLogin}
              className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.4 0 15.3s.7 5.6 1.9 8l3.7-2.9c-.4-.7-.6-1.5-.6-2.3z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
              </svg>
              Continuar con Google
            </button>
          </form>
        )}

        {/* MODE 3: CREAR CUENTA */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Crear Cuenta</h3>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Nombre Completo</label>
              <input
                type="text"
                required
                placeholder="Ej. Carlos Mendoza"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Correo Electrónico</label>
              <input
                type="email"
                required
                placeholder="carlos@ariannysbazar.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Contraseña</label>
              <input
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Nivel de Acceso</label>
              <select
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-blue-500 focus:outline-none font-medium"
              >
                <option value="cashier">Cajero (Punto de Venta)</option>
                <option value="inventory">Almacén (Productos & Stock)</option>
                <option value="admin">Administrador (Acceso Total)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 mt-2 shadow-lg shadow-blue-600/20"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {isLoading ? 'Registrando...' : 'Crear Usuario'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
