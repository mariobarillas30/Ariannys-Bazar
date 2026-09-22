import React, { useState, useEffect, FormEvent } from 'react';
import { 
  Users, 
  ShieldCheck, 
  ShoppingCart, 
  Package, 
  Search, 
  UserPlus, 
  UserCheck, 
  AlertCircle, 
  Mail, 
  CheckCircle2, 
  X, 
  Lock, 
  Unlock, 
  KeyRound, 
  Trash2, 
  RefreshCw, 
  Key, 
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { UserRepository } from '../repositories/UserRepository';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';

export function UsersManagementView() {
  const { showSuccessToast } = useSync();
  const { userProfile: currentUserProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  // Estado de visibilidad de PINs revelados en la lista (por UID)
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  // Modal: Crear Nuevo Usuario
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('cashier');
  const [newUserPin, setNewUserPin] = useState('');
  const [showCreatePin, setShowCreatePin] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal: Asignar / Cambiar PIN
  const [pinModalUser, setPinModalUser] = useState<UserProfile | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [showModalPin, setShowModalPin] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Modal: Confirmar Eliminación de Usuario
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  useEffect(() => {
    const unsubscribe = UserRepository.subscribeAllUsers(
      (data) => {
        setUsers(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error al cargar usuarios:', err);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const togglePinVisibility = (uid: string) => {
    setRevealedPins(prev => ({
      ...prev,
      [uid]: !prev[uid]
    }));
  };

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    setUpdatingUid(uid);
    try {
      await UserRepository.updateUserRole(uid, newRole);
      showSuccessToast(`Nivel de acceso actualizado a ${newRole === 'admin' ? 'Administrador' : newRole === 'cashier' ? 'Cajero POS' : 'Almacén / Stock'}`);
    } catch (err: any) {
      console.error('Error al cambiar rol:', err);
      alert('Error al actualizar permisos: ' + (err.message || ''));
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setModalError('Por favor completa el nombre y el correo electrónico.');
      return;
    }

    if (newUserPin.trim() && !/^\d{4,6}$/.test(newUserPin.trim())) {
      setModalError('El PIN de seguridad debe contener entre 4 y 6 dígitos numéricos.');
      return;
    }

    setIsSavingUser(true);
    setModalError(null);

    try {
      const generatedUid = 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const newProfile: UserProfile = {
        uid: generatedUid,
        email: newUserEmail.trim(),
        displayName: newUserName.trim(),
        role: newUserRole,
        ...(newUserPin.trim() ? { pin: newUserPin.trim() } : {}),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await UserRepository.saveUserProfile(newProfile);
      showSuccessToast(`Usuario "${newUserName.trim()}" registrado exitosamente en el servidor central.`);
      
      // Reset form & close modal
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('cashier');
      setNewUserPin('');
      setShowCreatePin(false);
      setIsCreateModalOpen(false);
    } catch (err: any) {
      console.error('Error al crear usuario:', err);
      setModalError(err.message || 'Error al guardar el usuario en el servidor de seguridad.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const openPinModal = (user: UserProfile) => {
    setPinModalUser(user);
    setPinValue(user.pin || '');
    setShowModalPin(false);
    setPinError(null);
  };

  const handleSavePin = async (e: FormEvent) => {
    e.preventDefault();
    if (!pinModalUser) return;

    const trimmed = pinValue.trim();
    if (!/^\d{4,6}$/.test(trimmed)) {
      setPinError('El PIN debe ser un código numérico de 4 a 6 dígitos.');
      return;
    }

    setIsSavingPin(true);
    setPinError(null);

    try {
      await UserRepository.setUserPin(pinModalUser.uid, trimmed);
      showSuccessToast(`PIN de seguridad actualizado en el servidor central para "${pinModalUser.displayName}"`);
      setPinModalUser(null);
      setPinValue('');
    } catch (err: any) {
      console.error('Error al guardar PIN:', err);
      setPinError(err.message || 'Error al actualizar el PIN en el servidor de seguridad.');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleRemovePin = async (user: UserProfile) => {
    if (!window.confirm(`¿Está seguro de restablecer el PIN de seguridad del usuario "${user.displayName}"? El usuario quedará sin clave de acceso hasta que se le asigne una nueva.`)) {
      return;
    }

    setUpdatingUid(user.uid);
    try {
      await UserRepository.removeUserPin(user.uid);
      showSuccessToast(`PIN de seguridad restablecido en el servidor central para "${user.displayName}"`);
    } catch (err: any) {
      console.error('Error al restablecer PIN:', err);
      alert('Error al restablecer PIN: ' + err.message);
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeletingUser(true);
    try {
      await UserRepository.deleteUser(userToDelete.uid);
      showSuccessToast(`Usuario "${userToDelete.displayName}" eliminado exitosamente del servidor central.`);
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Error al eliminar usuario:', err);
      alert('Error al eliminar usuario del servidor: ' + (err.message || ''));
    } finally {
      setIsDeletingUser(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <ShieldCheck className="w-3.5 h-3.5" /> Administrador
          </span>
        );
      case 'cashier':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <ShoppingCart className="w-3.5 h-3.5" /> Cajero POS
          </span>
        );
      case 'inventory':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Package className="w-3.5 h-3.5" /> Almacén / Stock
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight font-['Outfit'] flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            Gestión de Usuarios y Claves de Seguridad
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Administración centralizada de cuentas, creación, baja de usuarios, niveles de acceso y consulta de PINs protegidos.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por usuario o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Botón Crear Nuevo Usuario */}
          <button
            type="button"
            id="btn-open-create-user-modal"
            onClick={() => {
              setModalError(null);
              setShowCreatePin(false);
              setIsCreateModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-lg shadow-blue-600/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear Usuario</span>
          </button>
        </div>
      </div>

      {/* Role & PIN Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Administradores
            </span>
            <span className="text-lg font-black text-white">
              {users.filter(u => u.role === 'admin').length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Cuentas con autorización total para todas las operaciones y anulaciones.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4" /> Cajeros POS
            </span>
            <span className="text-lg font-black text-white">
              {users.filter(u => u.role === 'cashier').length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Autorizados para apertura, arqueo de turno y cobro de ventas en caja.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" /> PINs de Seguridad Activos
            </span>
            <span className="text-lg font-black text-white">
              {users.filter(u => !!u.pin).length} / {users.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Protegidos y resguardados en el servidor central.
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Directorio de Usuarios ({filteredUsers.length})
          </h3>
          <span className="text-[10px] text-slate-500 font-medium">Sistema sincronizado en tiempo real</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">Cargando directorio de usuarios...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No se encontraron usuarios coincidentes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Correo Electrónico</th>
                  <th className="px-4 py-3">Nivel de Acceso</th>
                  <th className="px-4 py-3">PIN de Seguridad (Admin)</th>
                  <th className="px-4 py-3 text-right">Gestión Administrativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((user) => {
                  const isPinRevealed = !!revealedPins[user.uid];
                  const isCurrentSessionUser = currentUserProfile?.uid === user.uid;

                  return (
                    <tr key={user.uid} className="hover:bg-slate-900/50 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 text-xs font-bold">
                          {user.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1.5">
                            {user.displayName || 'Sin nombre'}
                            {isCurrentSessionUser && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-normal">Tú</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                        {user.email}
                      </td>
                      <td className="px-4 py-3.5">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-4 py-3.5">
                        {user.pin ? (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            {isPinRevealed ? (
                              <span className="font-mono font-bold tracking-widest text-emerald-300 text-xs bg-emerald-900/50 px-1.5 py-0.5 rounded">
                                {user.pin}
                              </span>
                            ) : (
                              <span className="font-mono tracking-widest text-emerald-400 select-none">
                                ••••
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => togglePinVisibility(user.uid)}
                              title={isPinRevealed ? 'Ocultar PIN' : 'Ver PIN (por si el usuario lo olvidó)'}
                              className="p-1 rounded-lg hover:bg-emerald-900/60 text-emerald-400 hover:text-white transition-colors"
                            >
                              {isPinRevealed ? (
                                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-900 text-slate-500 border border-slate-800">
                            <Unlock className="w-3.5 h-3.5 text-slate-500" />
                            <span>Sin PIN</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Selector de Rol */}
                          {updatingUid === user.uid ? (
                            <span className="text-[11px] text-blue-400 animate-pulse font-semibold">Guardando...</span>
                          ) : (
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            >
                              <option value="admin">👑 Administrador</option>
                              <option value="cashier">🛒 Cajero POS</option>
                              <option value="inventory">📦 Almacén / Stock</option>
                            </select>
                          )}

                          {/* Botón Asignar / Cambiar PIN */}
                          <button
                            type="button"
                            onClick={() => openPinModal(user)}
                            title={user.pin ? 'Cambiar clave PIN de seguridad' : 'Asignar nueva clave PIN de seguridad'}
                            className="px-2.5 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                            <span>{user.pin ? 'Cambiar PIN' : 'Asignar PIN'}</span>
                          </button>

                          {/* Botón Restablecer PIN */}
                          {user.pin && (
                            <button
                              type="button"
                              onClick={() => handleRemovePin(user)}
                              title="Restablecer PIN de seguridad"
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 text-xs font-medium flex items-center gap-1 transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Restablecer</span>
                            </button>
                          )}

                          {/* Botón Eliminar Usuario */}
                          <button
                            type="button"
                            onClick={() => setUserToDelete(user)}
                            title="Eliminar usuario definitivamente"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Asignar / Cambiar PIN */}
      {pinModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {pinModalUser.pin ? 'Modificar PIN de Seguridad' : 'Asignar PIN de Seguridad'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Usuario: <strong className="text-white">{pinModalUser.displayName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinModalUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pinError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handleSavePin} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p>
                  El PIN se almacena de forma segura en el <strong>servidor central</strong> y se utiliza para autorizar cobros y turnos de caja.
                </p>
                <p className="text-blue-400 font-mono text-[10px]">
                  • Longitud requerida: de 4 a 6 dígitos numéricos.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-medium">
                    PIN Numérico (4 a 6 dígitos) <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowModalPin(!showModalPin)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {showModalPin ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>Ocultar dígitos</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>Ver dígitos</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showModalPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    placeholder="••••"
                    value={pinValue}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setPinValue(val);
                      setPinError(null);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-center tracking-widest text-lg focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Teclado numérico táctil */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === 'C') setPinValue('');
                      else if (k === '⌫') setPinValue(prev => prev.slice(0, -1));
                      else if (pinValue.length < 6) setPinValue(prev => prev + k);
                      setPinError(null);
                    }}
                    className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-sm border border-slate-700 transition-colors"
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPinModalUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPin || pinValue.length < 4}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-colors"
                >
                  {isSavingPin ? (
                    <span>Guardando en el servidor...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Guardar PIN</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Crear Nuevo Usuario */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <span>Registrar Nuevo Usuario</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Nombre Completo <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Guardado"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Correo Electrónico <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@ariannysbazar.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Nivel de Acceso y Rol <span className="text-rose-400">*</span>
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="cashier">🛒 Cajero POS (Punto de Venta y cobro)</option>
                  <option value="inventory">📦 Almacén / Stock (Control de productos e inventario)</option>
                  <option value="admin">👑 Administrador (Acceso total y gestión de roles)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-medium">
                    PIN de Seguridad Inicial (Opcional, 4 a 6 dígitos)
                  </label>
                  {newUserPin.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCreatePin(!showCreatePin)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      {showCreatePin ? (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Ocultar</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Ver</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type={showCreatePin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="••••"
                    value={newUserPin}
                    onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono tracking-widest placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Se guardará en el servidor central para autorizar turnos de caja y operaciones protegidas.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser || !newUserName.trim() || !newUserEmail.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-colors"
                >
                  {isSavingUser ? (
                    <span>Registrando en el servidor...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Guardar Usuario</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Eliminación de Usuario */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-900/60 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Eliminar Usuario</h3>
                  <p className="text-[11px] text-slate-400">Operación administrativa permanente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="text-slate-400 text-[11px]">Usuario a remover:</div>
                <div className="font-bold text-white text-sm">{userToDelete.displayName}</div>
                <div className="text-slate-400 font-mono text-[11px]">{userToDelete.email}</div>
                <div className="pt-1">{getRoleBadge(userToDelete.role)}</div>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-300 text-[11px] leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>
                  Esta acción eliminará la cuenta y sus credenciales de seguridad del <strong>servidor central</strong>. El usuario ya no podrá iniciar sesión ni autorizar operaciones.
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition-colors"
              >
                {isDeletingUser ? (
                  <span>Eliminando...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Eliminación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

