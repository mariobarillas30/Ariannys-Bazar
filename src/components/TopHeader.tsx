import React from 'react';
import { 
  Menu, 
  ShoppingBag, 
  UserCheck, 
  ShieldCheck, 
  ShoppingCart, 
  Package, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SyncStatusBadge } from './SyncStatusBadge';
import { UserRole } from '../types';

interface TopHeaderProps {
  onToggleSidebar: () => void;
}

export function TopHeader({ onToggleSidebar }: TopHeaderProps) {
  const { userProfile, role, logout } = useAuth();

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-400 border border-blue-800/60">
            <ShieldCheck className="w-3 h-3 text-blue-400" /> Admin
          </span>
        );
      case 'cashier':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <ShoppingCart className="w-3 h-3 text-slate-400" /> Cajero
          </span>
        );
      case 'inventory':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <Package className="w-3 h-3 text-slate-400" /> Almacén
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 h-14 px-4 flex items-center justify-between font-sans shadow-sm select-none">
      {/* Lado Izquierdo: Botón Hamburguesa e Identidad de Marca */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          id="btn-hamburger-sidebar"
          onClick={onToggleSidebar}
          title="Alternar Menú Lateral"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-center"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-white font-sans">
              Ariannys Bazar
            </h1>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
              POS
            </span>
          </div>
        </div>
      </div>

      {/* Lado Derecho: Perfil de Usuario, Indicador En Línea y Salir */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Perfil del Usuario Activo */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/80 text-xs text-slate-300">
          <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-semibold text-white max-w-[110px] sm:max-w-none truncate">
            {userProfile?.displayName || 'Mario Barillas'}
          </span>
          {getRoleBadge(role)}
        </div>

        {/* Indicador de Conexión En Línea */}
        <SyncStatusBadge />

        {/* Botón Salir / Logout */}
        <button
          type="button"
          id="btn-logout"
          onClick={logout}
          title="Cerrar Sesión"
          className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 transition-colors text-xs font-medium flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}
