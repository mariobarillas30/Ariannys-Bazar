import React, { useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  ShoppingCart, 
  Users, 
  Activity,
  Receipt
} from 'lucide-react';
import { Product, Sale, CashRegister, Customer, StockMovement } from '../types';
import { ActiveTab } from './Navbar';
import { useAuth } from '../context/AuthContext';

interface DashboardViewProps {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  activeCashRegister: CashRegister | null;
  stockMovements: StockMovement[];
  onNavigate: (tab: ActiveTab) => void;
}

export function DashboardView({
  products,
  sales,
  customers,
  activeCashRegister,
  onNavigate,
}: DashboardViewProps) {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todaySales = useMemo(() => {
    return sales.filter((s) => s.createdAt >= todayStart && !s.isCancelled);
  }, [sales, todayStart]);

  const todayRevenue = useMemo(() => {
    return todaySales.reduce((acc, s) => acc + s.total, 0);
  }, [todaySales]);

  const avgTicket = useMemo(() => {
    return todaySales.length > 0 ? todayRevenue / todaySales.length : 0;
  }, [todaySales, todayRevenue]);

  const todayEstimatedProfit = useMemo(() => {
    let profit = 0;
    todaySales.forEach((s) => {
      s.items.forEach((item) => {
        profit += (item.unitPrice - (item.costPrice || 0)) * item.quantity;
      });
      if (s.discount) profit -= s.discount;
    });
    return profit;
  }, [todaySales]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock > 0 && p.stock <= p.minStockAlert);
  }, [products]);

  const outOfStockProducts = useMemo(() => {
    return products.filter((p) => p.stock <= 0);
  }, [products]);

  const totalReceivables = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.currentDebt || 0), 0);
  }, [customers]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5 font-sans">
      {/* Encabezado Sobrio */}
      <div className="bg-slate-900 border border-slate-800 rounded-md p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Panel de Control
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Resumen de ventas, estado de caja e inventario en tiempo real.
          </p>
        </div>

        <button
          onClick={() => onNavigate('pos')}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Abrir Punto de Venta (POS)</span>
        </button>
      </div>

      {/* Cuadrícula de Indicadores Clave (KPIs) Planos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas de Hoy */}
        <div className="bg-slate-900 border border-slate-800 rounded-md p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Ventas de Hoy</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ${todayRevenue.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400">
            {todaySales.length} transacciones registradas
          </p>
        </div>

        {/* Utilidad Estimada (Solo Admin) / Ticket Promedio (Cajeros) */}
        {isAdmin ? (
          <div className="bg-slate-900 border border-slate-800 rounded-md p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Utilidad Estimada</span>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              ${todayEstimatedProfit.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-400">
              Margen bruto del día
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-md p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Ticket Promedio</span>
              <Receipt className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              ${avgTicket.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-400">
              Promedio por venta hoy
            </p>
          </div>
        )}

        {/* Alertas de Stock */}
        <div className="bg-slate-900 border border-slate-800 rounded-md p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Alertas de Stock</span>
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {lowStockProducts.length + outOfStockProducts.length}
          </div>
          <p className="text-[11px] text-slate-400">
            {outOfStockProducts.length} agotados &bull; {lowStockProducts.length} por agotarse
          </p>
        </div>

        {/* Estado de Caja */}
        <div className="bg-slate-900 border border-slate-800 rounded-md p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Estado de Caja</span>
            {activeCashRegister ? <Unlock className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-slate-400" />}
          </div>
          <div className={`text-lg font-bold ${activeCashRegister ? 'text-emerald-400' : 'text-slate-400'}`}>
            {activeCashRegister ? 'Turno Abierto' : 'Caja Cerrada'}
          </div>
          <p className="text-[11px] text-slate-400">
            {activeCashRegister ? (
              <span>Caja activa</span>
            ) : (
              'Sin turno activo'
            )}
          </p>
        </div>
      </div>

      {/* Disposición de Contenidos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Tabla Minimalista de Últimas Ventas */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider">Últimas Ventas</h3>
            </div>
            <button
              onClick={() => onNavigate('sales')}
              className="text-xs font-medium text-blue-400 hover:underline"
            >
              Ver Todas &rarr;
            </button>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {sales.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No hay ventas registradas.
              </div>
            ) : (
              sales.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">{s.invoiceNumber}</span>
                      <span className="text-slate-400 truncate">
                        {s.customerName ? `&bull; ${s.customerName}` : '&bull; Mostrador'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {s.items.length} productos &bull; {s.paymentMethod.toUpperCase()}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-sm text-white">${s.total.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {new Date(s.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel Lateral: Alertas y Cuentas por Cobrar */}
        <div className="lg:col-span-5 space-y-4">
          {/* Stock Crítico */}
          <div className="bg-slate-900 border border-slate-800 rounded-md p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="font-semibold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Stock Bajo / Agotado ({lowStockProducts.length + outOfStockProducts.length})
              </h4>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs font-medium text-blue-400 hover:underline"
              >
                Inventario &rarr;
              </button>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {[...outOfStockProducts, ...lowStockProducts].slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="p-2 rounded bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs"
                >
                  <div className="truncate mr-2">
                    <div className="font-medium text-white truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                    p.stock <= 0 ? 'bg-slate-800 text-rose-400 border border-slate-700' : 'bg-slate-800 text-amber-400 border border-slate-700'
                  }`}>
                    {p.stock <= 0 ? 'Agotado' : `${p.stock} unid.`}
                  </span>
                </div>
              ))}
              {lowStockProducts.length === 0 && outOfStockProducts.length === 0 && (
                <p className="text-xs text-slate-500 py-3 text-center">Stock adecuado en todos los productos.</p>
              )}
            </div>
          </div>

          {/* Cuentas por Cobrar */}
          <div className="bg-slate-900 border border-slate-800 rounded-md p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="font-semibold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Cuentas por Cobrar
              </h4>
              <button
                onClick={() => onNavigate('customers')}
                className="text-xs font-medium text-blue-400 hover:underline"
              >
                Clientes &rarr;
              </button>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-slate-800/60 border border-slate-700/60">
              <span className="text-xs text-slate-400">Total Deuda de Clientes:</span>
              <span className="font-mono font-bold text-white text-base">${totalReceivables.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
