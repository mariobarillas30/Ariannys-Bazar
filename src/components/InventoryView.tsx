import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  SlidersHorizontal, 
  AlertTriangle, 
  TrendingUp, 
  History, 
  Sparkles, 
  CheckCircle, 
  X,
  Building2,
  Tag,
  FolderPlus,
  Layers,
  RefreshCw
} from 'lucide-react';
import { Category, Product, StockMovement } from '../types';
import { InventoryRepository } from '../repositories/InventoryRepository';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';

interface InventoryViewProps {
  products: Product[];
  stockMovements: StockMovement[];
  cashierName: string;
}

export function InventoryView({ products, stockMovements, cashierName }: InventoryViewProps) {
  const { notifyPendingWrite, showSuccessToast } = useSync();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  // Pestaña de vista activa: Catálogo de Productos o Historial de Movimientos Kardex
  const [activeTab, setActiveTab] = useState<'products' | 'movements'>('products');

  // Filtros de búsqueda, categoría y existencias
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Categorías guardadas en Firestore
  const [firestoreCategories, setFirestoreCategories] = useState<Category[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Estado de Modal de Confirmación de Eliminación (Producto y Categoría)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'product' | 'category';
    id: string;
    name: string;
  }>({
    isOpen: false,
    type: 'product',
    id: '',
    name: '',
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado de modales (Creación/edición y ajuste de stock)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustNewStock, setAdjustNewStock] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Recuento físico periódico');

  // Estado del formulario de producto
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState('Ropa Interior Dama');
  const [formCostPrice, setFormCostPrice] = useState<number>(0);
  const [formSellingPrice, setFormSellingPrice] = useState<number>(0); // Unidad
  const [formHalfDozenPrice, setFormHalfDozenPrice] = useState<number>(0); // Media Docena (≥6 uds)
  const [formDozenPrice, setFormDozenPrice] = useState<number>(0); // Docena (≥12 uds)
  const [formStock, setFormStock] = useState<number>(0);
  const [formMinStockAlert, setFormMinStockAlert] = useState<number>(5);
  const [formUnit, setFormUnit] = useState('unidad');
  const [formDescription, setFormDescription] = useState('');

  // Control de estado de guardado y mensajes de error
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Suscripción a categorías en Firestore
  useEffect(() => {
    const unsubscribe = InventoryRepository.subscribeCategories(
      (cats) => setFirestoreCategories(cats),
      (err) => console.error('Error escuchando categorías:', err)
    );
    return () => unsubscribe();
  }, []);

  // Lista consolidada de categorías disponibles
  const categories = useMemo(() => {
    const defaultCats = [
      'Ropa Interior Dama',
      'Ropa Interior Hombre',
      'Ropa Interior Infantil',
      'Leggings',
      'Vestidos',
      'Calcetines & Medias'
    ];
    const dynamicCats = new Set<string>(defaultCats);
    products.forEach((p) => {
      if (p.category) dynamicCats.add(p.category);
    });
    firestoreCategories.forEach((c) => {
      if (c.name) dynamicCats.add(c.name);
    });
    return Array.from(dynamicCats);
  }, [products, firestoreCategories]);

  // Helper para generar el siguiente código correlativo de producto en automático
  const generateNextProductCode = (existingProducts: Product[]) => {
    let maxNum = 0;
    existingProducts.forEach((p) => {
      const match = p.sku.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum > 0 ? maxNum + 1 : existingProducts.length + 1;
    return `ART-${String(nextNum).padStart(3, '0')}`;
  };

  // Filtrado reactivo de productos según texto, categoría y nivel de existencias
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());

      let matchStock = true;
      if (stockFilter === 'low') {
        matchStock = p.stock > 0 && p.stock <= p.minStockAlert;
      } else if (stockFilter === 'out') {
        matchStock = p.stock <= 0;
      }

      return matchCat && matchSearch && matchStock;
    });
  }, [products, selectedCategory, search, stockFilter]);

  // Apertura del modal para crear un nuevo producto con código automático y presets
  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setFormName('');
    const autoCode = generateNextProductCode(products);
    setFormSku(autoCode);
    setFormBarcode('');
    setFormCategory('Ropa Interior Dama');
    setFormCostPrice(0);
    setFormSellingPrice(0);
    setFormHalfDozenPrice(0);
    setFormDozenPrice(0);
    setFormStock(12); // Predeterminado: 12 unidades (1 Docena)
    setFormMinStockAlert(5);
    setFormUnit('unidad');
    setFormDescription('');
    setErrorMsg(null);
    setIsProductModalOpen(true);
  };

  // Apertura del modal para edición de producto y precios por escala
  const handleOpenEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormSku(product.sku);
    setFormBarcode('');
    setFormCategory(product.category);
    setFormCostPrice(product.costPrice);
    setFormSellingPrice(product.sellingPrice);
    const halfD = product.halfDozenPrice !== undefined 
      ? product.halfDozenPrice 
      : (product.wholesalePrice !== undefined ? product.wholesalePrice : Number((product.sellingPrice * 0.85).toFixed(2)));
    const doz = product.dozenPrice !== undefined 
      ? product.dozenPrice 
      : (product.wholesalePrice !== undefined ? Number((product.wholesalePrice * 0.95).toFixed(2)) : Number((product.sellingPrice * 0.75).toFixed(2)));
    setFormHalfDozenPrice(halfD);
    setFormDozenPrice(doz);
    setFormStock(product.stock);
    setFormMinStockAlert(product.minStockAlert);
    setFormUnit(product.unit);
    setFormDescription(product.description || '');
    setErrorMsg(null);
    setIsProductModalOpen(true);
  };

  // Sugerencia automática de tarifas al modificar precio de venta al detal
  const handleRetailPriceChange = (val: number) => {
    setFormSellingPrice(val);
    if (!editingProduct) {
      setFormHalfDozenPrice(Number((val * 0.85).toFixed(2)));
      setFormDozenPrice(Number((val * 0.75).toFixed(2)));
    }
  };

  // Apertura del modal de ajuste atómico de existencias físicas
  const handleOpenAdjust = (product: Product) => {
    setAdjustingProduct(product);
    setAdjustNewStock(product.stock);
    setAdjustReason('Recuento físico');
    setErrorMsg(null);
    setIsAdjustModalOpen(true);
  };

  // Guardado o actualización de producto en Firestore con registro de auditoría de precios
  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSku.trim()) {
      setErrorMsg('El nombre y el código de producto (SKU) son obligatorios.');
      return;
    }

    if (formSellingPrice <= 0) {
      setErrorMsg('El precio de venta al detal debe ser mayor a 0.');
      return;
    }

    const halfD = formHalfDozenPrice > 0 ? formHalfDozenPrice : Number((formSellingPrice * 0.85).toFixed(2));
    const doz = formDozenPrice > 0 ? formDozenPrice : Number((formSellingPrice * 0.75).toFixed(2));

    setIsSaving(true);
    setErrorMsg(null);
    notifyPendingWrite(true);

    try {
      if (editingProduct) {
        await InventoryRepository.updateProduct(
          editingProduct.id, 
          {
            name: formName.trim(),
            sku: formSku.trim(),
            category: formCategory,
            costPrice: Number(formCostPrice),
            sellingPrice: Number(formSellingPrice),
            halfDozenPrice: Number(halfD),
            dozenPrice: Number(doz),
            wholesalePrice: Number(doz),
            wholesaleMinQty: 6,
            minStockAlert: Number(formMinStockAlert),
            unit: formUnit,
            description: formDescription.trim(),
          },
          editingProduct,
          cashierName
        );
        showSuccessToast(`Producto "${formName}" y tarifas actualizados en Firestore`);
      } else {
        await InventoryRepository.createProduct(
          {
            name: formName.trim(),
            sku: formSku.trim(),
            category: formCategory,
            costPrice: Number(formCostPrice),
            sellingPrice: Number(formSellingPrice),
            halfDozenPrice: Number(halfD),
            dozenPrice: Number(doz),
            wholesalePrice: Number(doz),
            wholesaleMinQty: 6,
            stock: Number(formStock),
            minStockAlert: Number(formMinStockAlert),
            unit: formUnit,
            description: formDescription.trim(),
            isActive: true,
          },
          cashierName
        );
        showSuccessToast(`Nuevo producto "${formName}" creado con código ${formSku}`);
      }
      setIsProductModalOpen(false);
    } catch (err: any) {
      console.error('Error al guardar producto:', err);
      setErrorMsg(err.message || 'Error al guardar el producto en el servidor.');
    } finally {
      setIsSaving(false);
      notifyPendingWrite(false);
    }
  };

  // Ejecución de ajuste atómico de existencias con registro en el Kardex
  const handleSaveAdjustment = async () => {
    if (!adjustingProduct) return;
    if (adjustNewStock < 0) {
      setErrorMsg('El stock no puede ser negativo.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    notifyPendingWrite(true);

    try {
      await InventoryRepository.adjustStock(
        adjustingProduct.id,
        adjustNewStock,
        adjustReason,
        cashierName
      );
      showSuccessToast(`Stock de "${adjustingProduct.name}" actualizado atómicamente a ${adjustNewStock}`);
      setIsAdjustModalOpen(false);
    } catch (err: any) {
      console.error('Error al ajustar stock:', err);
      setErrorMsg(err.message || 'Error al actualizar el stock en el servidor.');
    } finally {
      setIsSaving(false);
      notifyPendingWrite(false);
    }
  };

  // Apertura del modal de eliminación para producto con validación de Rol (Administrador)
  const handleOpenDeleteProductModal = (product: Product) => {
    if (role !== 'admin') {
      setErrorMsg('Acceso restringido: Solo los usuarios con rol de Administrador pueden eliminar productos.');
      return;
    }
    setErrorMsg(null);
    setDeleteModal({
      isOpen: true,
      type: 'product',
      id: product.id,
      name: product.name,
    });
  };

  // Apertura del modal de eliminación para categoría con validación de Rol (Administrador)
  const handleOpenDeleteCategoryModal = (categoryName: string) => {
    if (role !== 'admin') {
      setErrorMsg('Acceso restringido: Solo los usuarios con rol de Administrador pueden eliminar categorías.');
      return;
    }
    setErrorMsg(null);
    setDeleteModal({
      isOpen: true,
      type: 'category',
      id: categoryName,
      name: categoryName,
    });
  };

  // Ejecución de la eliminación de Producto o Categoría en Firestore tras la confirmación en el Modal
  const handleConfirmDelete = async () => {
    if (!deleteModal.isOpen || !deleteModal.id) return;

    if (role !== 'admin') {
      setErrorMsg('Acceso denegado: Se requiere rol de Administrador para realizar eliminaciones.');
      setDeleteModal({ ...deleteModal, isOpen: false });
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);
    notifyPendingWrite(true);

    try {
      if (deleteModal.type === 'product') {
        await InventoryRepository.deleteProduct(deleteModal.id);
        showSuccessToast(`Producto "${deleteModal.name}" eliminado correctamente.`);
      } else {
        await InventoryRepository.deleteCategory(deleteModal.id);
        showSuccessToast(`Categoría "${deleteModal.name}" eliminada correctamente.`);
        if (selectedCategory === deleteModal.name) {
          setSelectedCategory('all');
        }
      }
      setDeleteModal({ isOpen: false, type: 'product', id: '', name: '' });
    } catch (err: any) {
      console.error('Error al eliminar:', err);
      setErrorMsg(err.message || 'Error al eliminar el elemento en el servidor.');
    } finally {
      setIsDeleting(false);
      notifyPendingWrite(false);
    }
  };

  // Creación de nueva categoría en la colección 'categories' de Firestore
  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    if (role !== 'admin') {
      setErrorMsg('Acceso restringido: Solo Administradores pueden crear categorías.');
      return;
    }

    notifyPendingWrite(true);
    try {
      await InventoryRepository.createCategory(newCategoryName.trim());
      showSuccessToast(`Categoría "${newCategoryName.trim()}" creada con éxito.`);
      setNewCategoryName('');
    } catch (err: any) {
      console.error('Error al crear categoría:', err);
      setErrorMsg(err.message || 'Error al guardar la categoría.');
    } finally {
      notifyPendingWrite(false);
    }
  };

  // Carga inicial de catálogo demostrativo para pruebas
  const handleSeedData = async () => {
    if (!confirm('¿Deseas cargar el catálogo demostrativo inicial de Ariannys Bazar con precios detal y mayoreo?')) return;
    notifyPendingWrite(true);
    try {
      const count = await InventoryRepository.seedSampleData(cashierName);
      showSuccessToast(`¡Se cargaron ${count} productos con tarifas duales en tiempo real!`);
    } catch (err: any) {
      console.error('Error al cargar datos demostrativos:', err);
      alert('Error cargando demo: ' + err.message);
    } finally {
      notifyPendingWrite(false);
    }
  };

  // Cálculo de margen comercial para ventas al detal, media docena y docena
  const retailMargin = formCostPrice > 0 && formSellingPrice > formCostPrice
    ? (((formSellingPrice - formCostPrice) / formSellingPrice) * 100).toFixed(1)
    : '0';

  const halfDozenMargin = formCostPrice > 0 && formHalfDozenPrice > formCostPrice
    ? (((formHalfDozenPrice - formCostPrice) / formHalfDozenPrice) * 100).toFixed(1)
    : '0';

  const dozenMargin = formCostPrice > 0 && formDozenPrice > formCostPrice
    ? (((formDozenPrice - formCostPrice) / formDozenPrice) * 100).toFixed(1)
    : '0';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Encabezado y Acciones */}
      <div className="bg-slate-900 border border-slate-800 rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-400" />
            Gestión de Inventario & Stock
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Control de productos, precios al detalle/mayoreo y auditoría Kardex.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-blue-400" />
            <span>+ Nueva Categoría</span>
          </button>
          <button
            onClick={handleOpenNewProduct}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Selector de Pestañas: Catálogo vs Historial Kardex */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'products'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Productos Activos ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'movements'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Kardex / Historial ({stockMovements.length})</span>
        </button>
      </div>

      {activeTab === 'products' ? (
        <>
          {/* Barra de Filtros */}
          <div className="bg-slate-900 border border-slate-800 rounded-md p-3 grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por nombre, SKU o código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4 flex items-center gap-1.5">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Todas las Categorías ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {selectedCategory !== 'all' && (
                <button
                  onClick={() => handleOpenDeleteCategoryModal(selectedCategory)}
                  title={isAdmin ? `Eliminar categoría "${selectedCategory}"` : 'Eliminar categoría (Solo Administradores)'}
                  className={`p-1.5 rounded border transition-colors ${
                    isAdmin 
                      ? 'bg-slate-800 hover:bg-slate-700 text-rose-400 border-slate-700' 
                      : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => setIsCategoryManagerOpen(true)}
                title="Gestionar Categorías"
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors shrink-0"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="sm:col-span-3">
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Todo el Inventario</option>
                <option value="low">Stock Bajo</option>
                <option value="out">Agotados (0 stock)</option>
              </select>
            </div>
          </div>

          {/* Tabla de Productos Tipo Hoja de Cálculo */}
          <div className="bg-slate-900 border border-slate-800 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/90 text-slate-300 font-semibold border-b border-slate-700 text-xs">
                  <tr>
                    <th className="py-2.5 px-3">Producto / Código</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    {isAdmin && <th className="py-2.5 px-3 text-right">Costo</th>}
                    <th className="py-2.5 px-3 text-right">Precio Unidad</th>
                    <th className="py-2.5 px-3 text-right">½ Docena</th>
                    <th className="py-2.5 px-3 text-right">Docena</th>
                    <th className="py-2.5 px-3 text-center">Stock</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-slate-500">
                        No se encontraron productos registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isOutOfStock = p.stock <= 0;
                      const isLowStock = p.stock > 0 && p.stock <= p.minStockAlert;
                      const halfDozenP = p.halfDozenPrice !== undefined 
                        ? p.halfDozenPrice 
                        : (p.wholesalePrice !== undefined ? p.wholesalePrice : Number((p.sellingPrice * 0.85).toFixed(2)));
                      const dozenP = p.dozenPrice !== undefined 
                        ? p.dozenPrice 
                        : (p.wholesalePrice !== undefined ? Number((p.wholesalePrice * 0.95).toFixed(2)) : Number((p.sellingPrice * 0.75).toFixed(2)));

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-white">{p.name}</div>
                            <div className="text-[10px] font-mono text-blue-400 font-bold">
                              {p.sku}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                              {p.category}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                              ${p.costPrice.toFixed(2)}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right">
                            <div className="font-mono font-bold text-white">
                              ${p.sellingPrice.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-sans">
                              1-5 uds
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="font-mono font-bold text-sky-400">
                              ${halfDozenP.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-sans">
                              ${(halfDozenP * 6).toFixed(2)} (pack 6)
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="font-mono font-bold text-purple-300">
                              ${dozenP.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-sans">
                              ${(dozenP * 12).toFixed(2)} (pack 12)
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                isOutOfStock
                                  ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                                  : isLowStock
                                  ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {p.stock} {p.unit}s
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenAdjust(p)}
                                title="Ajuste de existencias"
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditProduct(p)}
                                title="Editar producto y tarifas"
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenDeleteProductModal(p)}
                                title={isAdmin ? "Eliminar producto" : "Eliminar producto (Solo Administradores)"}
                                className={`p-1 rounded border transition-colors ${
                                  isAdmin 
                                    ? 'bg-slate-800 hover:bg-slate-700 text-rose-400 border-slate-700' 
                                    : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* TABLA KARDEX DE AUDITORÍA DE MOVIMIENTOS */
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-sm text-white">Registro de Auditoría de Movimientos & Precios</h3>
            <span className="text-xs text-slate-400">Total eventos registrados: {stockMovements.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Fecha & Hora</th>
                  <th className="py-3 px-3">Producto</th>
                  <th className="py-3 px-3">Tipo de Evento</th>
                  <th className="py-3 px-3 text-center">Cambio Cantidad</th>
                  <th className="py-3 px-3 text-center">Stock Anterior</th>
                  <th className="py-3 px-3 text-center">Nuevo Stock</th>
                  <th className="py-3 px-3">Detalle / Motivo / Factura</th>
                  <th className="py-3 px-4 text-right">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {stockMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No hay movimientos de stock o cambios de precios registrados.
                    </td>
                  </tr>
                ) : (
                  stockMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {new Date(m.createdAt).toLocaleDateString('es-ES')}{' '}
                        {new Date(m.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">{m.productName}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            m.type === 'sale'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : m.type === 'return'
                              ? 'bg-sky-950 text-sky-300 border border-sky-800'
                              : m.type === 'initial'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : m.type === 'price_change'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {m.type === 'sale' 
                            ? 'Venta' 
                            : m.type === 'return' 
                            ? 'Devolución' 
                            : m.type === 'initial' 
                            ? 'Inicial' 
                            : m.type === 'price_change'
                            ? 'Cambio Precios'
                            : 'Ajuste'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        {m.type === 'price_change' ? (
                          <span className="text-slate-500">-</span>
                        ) : (
                          <span className={m.quantityChange > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-400">{m.previousStock}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-white">{m.newStock}</td>
                      <td className="py-3 px-3 text-slate-300 text-[11px] font-mono">{m.reason}</td>
                      <td className="py-3 px-4 text-right text-slate-400">{m.createdBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Registro y Edición de Producto con Tarifas Duales y Mayoreo */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white font-['Outfit'] flex items-center gap-2">
                <Package className="w-5 h-5 text-rose-500" />
                {editingProduct ? 'Editar Producto & Tarifas' : 'Registrar Nuevo Producto'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
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

            <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Bóxer de Algodón Dama / Brasier con Encaje"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Código de Producto Generado en Automático */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-300">Código de Producto (SKU) *</label>
                    {!editingProduct && (
                      <button
                        type="button"
                        onClick={() => setFormSku(generateNextProductCode(products))}
                        className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono"
                        title="Re-generar código correlativo"
                      >
                        <RefreshCw className="w-3 h-3" /> Auto
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                    placeholder="Ej: ART-001"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-blue-400 font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Generado en automático sin necesidad de código de barras.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-300">Categoría</label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryManagerOpen(true)}
                      className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                    >
                      <FolderPlus className="w-3 h-3" /> + Nueva Categoría
                    </button>
                  </div>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="">Seleccione una categoría...</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Unidad de Medida</label>
                <select
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="unidad">Unidad (pza)</option>
                  <option value="docena">Docena</option>
                  <option value="paquete">Paquete</option>
                  <option value="caja">Caja</option>
                  <option value="set">Set / Kit</option>
                  <option value="par">Par</option>
                  <option value="metro">Metro</option>
                </select>
              </div>

              {/* Panel de Configuración de Tarifas: Unidad, Media Docena y Docena */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="block font-bold text-white text-xs">
                    Tarifas por Escala (Unidad, Media Docena y Docena):
                  </span>
                  <span className="text-[10px] text-purple-400 font-semibold">
                    Precios Especiales de Venta
                  </span>
                </div>

                <div className={`grid ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} gap-2.5`}>
                  {isAdmin && (
                    <div>
                      <label className="block font-bold text-slate-400 text-[11px] mb-1">Costo Compra ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formCostPrice || ''}
                        onChange={(e) => setFormCostPrice(Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-rose-500 text-xs"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-rose-400 text-[11px] mb-1">Unidad / Detal ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formSellingPrice || ''}
                      onChange={(e) => handleRetailPriceChange(Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-rose-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-sky-400 text-[11px] mb-1">½ Docena ($/ud) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formHalfDozenPrice || ''}
                      onChange={(e) => setFormHalfDozenPrice(Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-sky-600/70 text-sky-200 font-mono font-bold focus:outline-none focus:border-sky-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-purple-300 text-[11px] mb-1">Docena ($/ud) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formDozenPrice || ''}
                      onChange={(e) => setFormDozenPrice(Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-purple-600/70 text-purple-200 font-mono font-bold focus:outline-none focus:border-purple-500 text-xs"
                    />
                  </div>
                </div>

                {/* Resumen Calculado de Paquetes y Ahorro */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-sky-900/50">
                    <div className="text-slate-400 text-[10px] font-medium">Paquete Media Docena (6 uds):</div>
                    <div className="font-mono text-sm font-bold text-sky-300">
                      ${(formHalfDozenPrice * 6).toFixed(2)} USD
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">
                      Ahorro cliente: ${(Math.max(0, (formSellingPrice - formHalfDozenPrice) * 6)).toFixed(2)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-purple-900/50">
                    <div className="text-slate-400 text-[10px] font-medium">Paquete Docena Completa (12 uds):</div>
                    <div className="font-mono text-sm font-bold text-purple-300">
                      ${(formDozenPrice * 12).toFixed(2)} USD
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">
                      Ahorro cliente: ${(Math.max(0, (formSellingPrice - formDozenPrice) * 12)).toFixed(2)}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex justify-between items-center text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
                    <span>Margen Detal: <strong className="text-rose-400 font-mono">{retailMargin}%</strong></span>
                    <span>Margen ½ Docena: <strong className="text-sky-400 font-mono">{halfDozenMargin}%</strong></span>
                    <span>Margen Docena: <strong className="text-purple-300 font-mono">{dozenMargin}%</strong></span>
                  </div>
                )}
              </div>

              {!editingProduct && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Stock Inicial *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formStock}
                      onChange={(e) => setFormStock(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Alerta Stock Mínimo</label>
                    <input
                      type="number"
                      min="1"
                      value={formMinStockAlert}
                      onChange={(e) => setFormMinStockAlert(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-rose-950/40"
                >
                  {isSaving ? 'Guardando en Servidor...' : editingProduct ? 'Actualizar Producto & Precios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Ajuste Atómico de Existencias Físicas */}
      {isAdjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white font-['Outfit']">
                Ajuste Atómico de Stock
              </h3>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
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

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="font-bold text-white">{adjustingProduct.name}</div>
                <div className="text-slate-400">Stock actual en servidor: <strong className="text-emerald-400 font-mono">{adjustingProduct.stock} {adjustingProduct.unit}s</strong></div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Nuevo Stock Físico *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={adjustNewStock}
                  onChange={(e) => setAdjustNewStock(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Motivo del Ajuste *</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ej: Recuento físico, merma, reposición rápida"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAdjustment}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-950/40"
              >
                {isSaving ? 'Actualizando Servidor...' : 'Aplicar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Confirmación de Eliminación (Producto y Categoría) */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-md max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Confirmar Eliminación ({deleteModal.type === 'product' ? 'Producto' : 'Categoría'})</span>
              </div>
              <button
                onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                {deleteModal.type === 'product'
                  ? '¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.'
                  : '¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer.'}
              </p>

              <div className="p-3 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 text-xs font-medium">Elemento a eliminar:</span>
                <span className="font-bold text-white text-xs">{deleteModal.name}</span>
              </div>

              {!isAdmin && (
                <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Acceso denegado: Solo los Administradores pueden realizar esta acción.</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting || !isAdmin}
                onClick={handleConfirmDelete}
                className={`px-4 py-1.5 rounded text-white text-xs font-semibold flex items-center gap-2 transition-colors ${
                  isAdmin
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-slate-700 cursor-not-allowed text-slate-400'
                }`}
              >
                {isDeleting ? 'Eliminando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Gestión e Inventario de Categorías */}
      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-md max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Gestión de Categorías ({categories.length})</span>
              </div>
              <button
                onClick={() => setIsCategoryManagerOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isAdmin && (
              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nueva categoría..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newCategoryName.trim()}
                  className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Agregar</span>
                </button>
              </form>
            )}

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {categories.map((catName) => (
                <div
                  key={catName}
                  className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-slate-200">{catName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryManagerOpen(false);
                      handleOpenDeleteCategoryModal(catName);
                    }}
                    title={isAdmin ? `Eliminar categoría "${catName}"` : 'Solo Administradores'}
                    className={`p-1 rounded border transition-colors ${
                      isAdmin
                        ? 'bg-slate-800 hover:bg-slate-700 text-rose-400 border-slate-700'
                        : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCategoryManagerOpen(false)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
