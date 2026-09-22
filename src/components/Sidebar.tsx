import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  DollarSign, 
  History, 
  UserCog,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth, ActiveTab } from '../context/AuthContext';

export interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  cartCount?: number;
}

export function Sidebar({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  cartCount = 0
}: SidebarProps) {
  const { canAccessTab } = useAuth();

  const navItems: { id: ActiveTab; label: string; icon: any; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'Punto de Venta (POS)', icon: ShoppingCart, badge: cartCount },
    { id: 'inventory', label: 'Inventario & Stock', icon: Package },
    { id: 'customers', label: 'Clientes & Créditos', icon: Users },
    { id: 'cash', label: 'Control de Caja', icon: DollarSign },
    { id: 'sales', label: 'Historial de Ventas', icon: History },
    { id: 'users', label: 'Gestión de Usuarios', icon: UserCog },
  ];

  const allowedNavItems = navItems.filter((item) => canAccessTab(item.id));

  return (
    <aside
      className={`bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out flex flex-col shrink-0 select-none z-30 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Botón de Colapso / Expansión del Menú Lateral */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        {!isCollapsed && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">
            Navegación
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          className={`p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${
            isCollapsed ? 'mx-auto' : ''
          }`}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Lista de Ítems del Menú */}
      <nav className="flex-1 p-2 space-y-1.5 overflow-y-auto">
        {allowedNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-sidebar-${item.id}`}
              type="button"
              onClick={() => onTabChange(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />

              {!isCollapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}

              {/* Badge numérico para POS */}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-white text-blue-600'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}

              {/* Tooltip flotante en estado colapsado */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity border border-slate-700">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Pie del Menú Lateral (Indicador de versión / información) */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
          <p className="font-semibold text-slate-400">Ariannys Bazar v2.0</p>
          <p className="text-[9px] text-slate-500">Sistema POS & Inventario</p>
        </div>
      )}
    </aside>
  );
}
