import React, { useState, useEffect } from 'react';
import { SyncProvider, useSync } from './context/SyncContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar, Sidebar, TopHeader, ActiveTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { POSView } from './components/POSView';
import { InventoryView } from './components/InventoryView';
import { CustomersView } from './components/CustomersView';
import { CashRegisterView } from './components/CashRegisterView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { UsersManagementView } from './components/UsersManagementView';
import { LoginView } from './components/LoginView';
import { ReceiptModal } from './components/ReceiptModal';
import { Toast } from './components/SyncStatusBadge';

import { InventoryRepository } from './repositories/InventoryRepository';
import { SalesRepository } from './repositories/SalesRepository';
import { CustomerRepository } from './repositories/CustomerRepository';
import { CashRegisterRepository } from './repositories/CashRegisterRepository';

import { Product, Sale, Customer, CashRegister, CashMovement, StockMovement } from './types';

function MainApp() {
  const { incrementListener, showSuccessToast, notifyPendingWrite } = useSync();
  const { userProfile, role, loading: authLoading, canAccessTab, getDefaultTabForRole } = useAuth();

  // Control de navegación activa protegida por RBAC
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  const cashierName = userProfile?.displayName || userProfile?.email || 'Arianny (Cajero)';

  // Entidades del dominio sincronizadas en tiempo real con Firestore
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeCashRegister, setActiveCashRegister] = useState<CashRegister | null>(null);
  const [allCashRegisters, setAllCashRegisters] = useState<CashRegister[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  // Modales y comprobantes
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Auto-ajustar pestaña activa según los permisos del rol del usuario
  useEffect(() => {
    if (userProfile && !canAccessTab(activeTab)) {
      const defaultTab = getDefaultTabForRole(role);
      setActiveTab(defaultTab);
    }
  }, [role, userProfile, activeTab]);

  // 1. Suscripción en tiempo real a Productos
  useEffect(() => {
    if (!userProfile) return;
    const decr = incrementListener();
    const unsubscribe = InventoryRepository.subscribeProducts(
      (newProducts) => {
        setProducts(newProducts);
        setIsInitialLoading(false);
      },
      (error) => console.error('Error en escucha de productos:', error)
    );
    return () => {
      unsubscribe();
      decr();
    };
  }, [userProfile]);

  // 2. Suscripción en tiempo real a Ventas
  useEffect(() => {
    if (!userProfile) return;
    const decr = incrementListener();
    const unsubscribe = SalesRepository.subscribeSales(
      (newSales) => {
        setSales(newSales);
      },
      (error) => console.error('Error en escucha de ventas:', error)
    );
    return () => {
      unsubscribe();
      decr();
    };
  }, [userProfile]);

  // 3. Suscripción en tiempo real a Clientes
  useEffect(() => {
    if (!userProfile) return;
    const decr = incrementListener();
    const unsubscribe = CustomerRepository.subscribeCustomers(
      (newCustomers) => {
        setCustomers(newCustomers);
      },
      (error) => console.error('Error en escucha de clientes:', error)
    );
    return () => {
      unsubscribe();
      decr();
    };
  }, [userProfile]);

  // 4. Suscripción en tiempo real al Turno de Caja Activo
  useEffect(() => {
    if (!userProfile) return;
    const decr = incrementListener();
    const unsubscribe = CashRegisterRepository.subscribeActiveRegister(
      (reg) => {
        setActiveCashRegister(reg);
      },
      (error) => console.error('Error en escucha de caja activa:', error)
    );
    return () => {
      unsubscribe();
      decr();
    };
  }, [userProfile]);

  // 5. Suscripción en tiempo real al Historial de Cajas
  useEffect(() => {
    if (!userProfile) return;
    const decr = incrementListener();
    const unsubscribe = CashRegisterRepository.subscribeAllRegisters(
      (registers) => {
        setAllCashRegisters(registers);
      },
      (error) => console.error('Error en escucha de historial de cajas:', error)
    );
    return () => {
      unsubscribe();
      decr();
    };
  }, [userProfile]);

  // 6. Suscripción a Movimientos de Caja del turno activo
  useEffect(() => {
    if (!userProfile || !activeCashRegister) {
      setCashMovements([]);
      return;
    }
    const decr = incrementListener();
    const unsubscribe = CashRegisterRepository.subscribeMovements(
      activeCashRegister.id,
      (movs) => {
        setCashMovements(movs);
      },
      (error) => console.error('Error en escucha de movimientos de caja:', error)
    );
    return () => {
      unsubscribe();
      decr();
    };
  }, [userProfile, activeCashRegister?.id]);

  // 7. Suscripción al Kardex de Movimientos de Inventario
  useEffect(() => {
    if (!userProfile) return;
    const decr = incrementListener();
    const unsubscribe = InventoryRepository.subscribeStockMovements(
      (movs) => {
        setStockMovements(movs);
      },
      (error) => console.error('Error en escucha de Kardex:', error)
    );
    return () => {
      unsubscribe();
      decr();
    };
  }, [userProfile]);

  // Carga de catálogo demostrativo inicial
  const handleSeedDemo = async () => {
    notifyPendingWrite(true);
    try {
      const pCount = await InventoryRepository.seedSampleData(cashierName);
      const cCount = await CustomerRepository.seedSampleCustomers();
      showSuccessToast(`¡Catálogo inicial (${pCount} productos) y ${cCount} clientes cargados con éxito!`);
    } catch (err: any) {
      console.error('Error al cargar datos demo:', err);
      alert('Error cargando datos demo: ' + err.message);
    } finally {
      notifyPendingWrite(false);
    }
  };

  const handleSaleSuccess = (sale: Sale) => {
    setSelectedReceiptSale(sale);
  };

  // Pantalla de Carga de Autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-300">Cargando perfil de usuario y permisos RBAC...</p>
      </div>
    );
  }

  // Si no hay perfil activo o sesión iniciada, mostrar vista de Inicio de Sesión
  if (!userProfile) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white font-['Plus_Jakarta_Sans']">
      {/* Encabezado Superior Delgado y Limpio */}
      <TopHeader onToggleSidebar={toggleSidebar} />

      {/* Estructura Principal con Menú Lateral a la Izquierda */}
      <div className="flex-1 flex overflow-hidden">
        {/* Menú Lateral Desplegable/Colapsable a la Izquierda */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          cartCount={0}
        />

        {/* Área de Contenido Principal Protegida Adaptada al Ancho Restante */}
        <main className="flex-1 overflow-y-auto pb-12 min-w-0">
          {isInitialLoading && products.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center space-y-1">
                <h3 className="font-bold text-white text-base">Conectando con Firestore en Vivo...</h3>
                <p className="text-xs text-slate-400">Verificando permisos para el rol: <strong className="text-rose-400 uppercase">{role}</strong></p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && canAccessTab('dashboard') && (
                <DashboardView
                  products={products}
                  sales={sales}
                  customers={customers}
                  activeCashRegister={activeCashRegister}
                  stockMovements={stockMovements}
                  onNavigate={setActiveTab}
                  onSeedDemo={handleSeedDemo}
                />
              )}

              {activeTab === 'pos' && canAccessTab('pos') && (
                <POSView
                  products={products}
                  customers={customers}
                  activeCashRegister={activeCashRegister}
                  cashierName={cashierName}
                  onSaleSuccess={handleSaleSuccess}
                  onOpenShiftPrompt={() => setActiveTab('cash')}
                />
              )}

              {activeTab === 'inventory' && canAccessTab('inventory') && (
                <InventoryView
                  products={products}
                  stockMovements={stockMovements}
                  cashierName={cashierName}
                />
              )}

              {activeTab === 'customers' && canAccessTab('customers') && (
                <CustomersView
                  customers={customers}
                  activeCashRegister={activeCashRegister}
                  cashierName={cashierName}
                />
              )}

              {activeTab === 'cash' && canAccessTab('cash') && (
                <CashRegisterView
                  activeRegister={activeCashRegister}
                  movements={cashMovements}
                  allRegisters={allCashRegisters}
                  cashierName={cashierName}
                />
              )}

              {activeTab === 'sales' && canAccessTab('sales') && (
                <SalesHistoryView
                  sales={sales}
                  cashierName={cashierName}
                  onViewReceipt={(sale) => setSelectedReceiptSale(sale)}
                />
              )}

              {activeTab === 'users' && canAccessTab('users') && (
                <UsersManagementView />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal de Comprobante / Tiquete Imprimible */}
      {selectedReceiptSale && (
        <ReceiptModal
          sale={selectedReceiptSale}
          onClose={() => setSelectedReceiptSale(null)}
        />
      )}

      {/* Notificaciones Toast en Tiempo Real */}
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <SyncProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </SyncProvider>
  );
}
