import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  ItemSolicitudMaterial,
  UrgenciaMaterial,
  CategoriaInventario,
  ItemInventario,
} from '../../types';

interface NuevaSolicitudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCrear: (datos: {
    items: ItemSolicitudMaterial[];
    urgencia: UrgenciaMaterial;
    motivoGeneral?: string;
    fechaNecesaria?: Date;
  }) => Promise<void>;
}

const PACIENTE_ID = 'paciente-principal';

const CATEGORIAS: { value: CategoriaInventario; label: string; icon: string }[] = [
  { value: 'medicamento', label: 'Medicamento', icon: '💊' },
  { value: 'material', label: 'Material', icon: '🩹' },
  { value: 'consumible', label: 'Consumible', icon: '📦' },
];

const UNIDADES = ['piezas', 'cajas', 'frascos', 'ml', 'tabletas', 'sobres', 'unidades', 'paquetes', 'bolsas', 'rollos'];

const URGENCIA_OPTIONS: { value: UrgenciaMaterial; label: string; icon: string; color: string }[] = [
  { value: 'baja', label: 'Baja', icon: '🔵', color: 'border-gray-300 bg-gray-50' },
  { value: 'normal', label: 'Normal', icon: '🟢', color: 'border-blue-300 bg-blue-50' },
  { value: 'alta', label: 'Alta', icon: '🟠', color: 'border-orange-300 bg-orange-50' },
  { value: 'urgente', label: 'Urgente', icon: '🔴', color: 'border-red-300 bg-red-50' },
];

export default function NuevaSolicitudModal({
  isOpen,
  onClose,
  onCrear,
}: NuevaSolicitudModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingInventario, setLoadingInventario] = useState(false);
  const [urgencia, setUrgencia] = useState<UrgenciaMaterial>('normal');
  const [motivoGeneral, setMotivoGeneral] = useState('');
  const [fechaNecesaria, setFechaNecesaria] = useState('');
  const [items, setItems] = useState<ItemSolicitudMaterial[]>([]);
  const [inventarioItems, setInventarioItems] = useState<ItemInventario[]>([]);

  // Estado para agregar item
  const [showAddItem, setShowAddItem] = useState(false);
  const [modoAgregar, setModoAgregar] = useState<'inventario' | 'nuevo'>('inventario');
  const [itemInventarioId, setItemInventarioId] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoCategoria, setNuevoCategoria] = useState<CategoriaInventario>('consumible');
  const [cantidad, setCantidad] = useState(1);
  const [unidad, setUnidad] = useState('piezas');
  const [motivo, setMotivo] = useState('');

  // Cargar items del inventario
  useEffect(() => {
    if (!isOpen) return;

    const cargarInventario = async () => {
      setLoadingInventario(true);
      try {
        const q = query(
          collection(db, 'pacientes', PACIENTE_ID, 'inventario'),
          where('categoria', 'in', ['material', 'consumible'])
        );
        const snapshot = await getDocs(q);
        const lista: ItemInventario[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          lista.push({
            id: doc.id,
            ...data,
            creadoEn: data.creadoEn?.toDate() || new Date(),
            actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
          } as ItemInventario);
        });
        setInventarioItems(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      } catch (error) {
        console.error('Error al cargar inventario:', error);
      } finally {
        setLoadingInventario(false);
      }
    };

    cargarInventario();
  }, [isOpen]);

  // Reset form cuando se cierra
  useEffect(() => {
    if (!isOpen) {
      setUrgencia('normal');
      setMotivoGeneral('');
      setFechaNecesaria('');
      setItems([]);
      setShowAddItem(false);
      resetAddItemForm();
    }
  }, [isOpen]);

  const resetAddItemForm = () => {
    setModoAgregar('inventario');
    setItemInventarioId('');
    setNuevoNombre('');
    setNuevoCategoria('consumible');
    setCantidad(1);
    setUnidad('piezas');
    setMotivo('');
  };

  const handleAgregarItem = () => {
    if (modoAgregar === 'inventario') {
      if (!itemInventarioId) {
        alert('Selecciona un item del inventario');
        return;
      }
      const itemInv = inventarioItems.find((i) => i.id === itemInventarioId);
      if (!itemInv) return;

      // Verificar si ya existe
      if (items.some((i) => i.itemId === itemInventarioId)) {
        alert('Este item ya está en la lista');
        return;
      }

      const nuevoItem: ItemSolicitudMaterial = {
        itemId: itemInv.id,
        nombre: itemInv.nombre,
        categoria: itemInv.categoria,
        cantidad,
        unidad: itemInv.unidad || unidad,
        origenItem: 'inventario',
        motivo: motivo || undefined,
        cantidadActualInventario: itemInv.cantidadMaestro + itemInv.cantidadOperativo,
      };
      setItems([...items, nuevoItem]);
    } else {
      if (!nuevoNombre.trim()) {
        alert('Ingresa el nombre del item');
        return;
      }

      const nuevoItem: ItemSolicitudMaterial = {
        nombre: nuevoNombre.trim(),
        categoria: nuevoCategoria,
        cantidad,
        unidad,
        origenItem: 'nuevo',
        motivo: motivo || undefined,
      };
      setItems([...items, nuevoItem]);
    }

    setShowAddItem(false);
    resetAddItemForm();
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleEnviar = async () => {
    if (items.length === 0) {
      alert('Agrega al menos un item a la solicitud');
      return;
    }

    setLoading(true);
    try {
      await onCrear({
        items,
        urgencia,
        motivoGeneral: motivoGeneral || undefined,
        fechaNecesaria: fechaNecesaria ? new Date(fechaNecesaria) : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      alert('Error al crear la solicitud');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">🛒 Nueva Solicitud</h2>
              <p className="text-sm text-gray-500 mt-1">
                Solicita la compra de materiales o consumibles
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl p-2"
            >
              ×
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Urgencia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nivel de urgencia
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {URGENCIA_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setUrgencia(opt.value)}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    urgencia === opt.value
                      ? opt.color + ' ring-2 ring-offset-1 ring-gray-400'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <div className="text-sm font-medium mt-1">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Items a solicitar ({items.length})
              </label>
              <button
                onClick={() => setShowAddItem(true)}
                className="text-sm text-lavender-600 hover:text-lavender-700 font-medium"
              >
                + Agregar item
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <span className="text-4xl mb-2 block">📦</span>
                <p className="text-gray-500">No hay items agregados</p>
                <button
                  onClick={() => setShowAddItem(true)}
                  className="mt-3 text-sm text-lavender-600 hover:text-lavender-700 font-medium"
                >
                  + Agregar primer item
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {item.origenItem === 'nuevo' && (
                          <span className="text-purple-600 text-xs">✨ Nuevo</span>
                        )}
                        <span className="font-medium text-gray-900 truncate">
                          {item.nombre}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.cantidad} {item.unidad}
                        {item.motivo && ` • ${item.motivo}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="p-1 text-gray-400 hover:text-red-500 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulario agregar item */}
          {showAddItem && (
            <div className="p-4 bg-lavender-50 rounded-lg border border-lavender-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Agregar item</h4>
                <button
                  onClick={() => {
                    setShowAddItem(false);
                    resetAddItemForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setModoAgregar('inventario')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    modoAgregar === 'inventario'
                      ? 'bg-white text-lavender-700 shadow-sm'
                      : 'text-gray-500 hover:bg-white/50'
                  }`}
                >
                  Del inventario
                </button>
                <button
                  onClick={() => setModoAgregar('nuevo')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    modoAgregar === 'nuevo'
                      ? 'bg-white text-lavender-700 shadow-sm'
                      : 'text-gray-500 hover:bg-white/50'
                  }`}
                >
                  ✨ Item nuevo
                </button>
              </div>

              {modoAgregar === 'inventario' ? (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Selecciona del inventario
                  </label>
                  {loadingInventario ? (
                    <div className="text-center py-4 text-gray-500">Cargando...</div>
                  ) : (
                    <select
                      value={itemInventarioId}
                      onChange={(e) => {
                        setItemInventarioId(e.target.value);
                        const item = inventarioItems.find((i) => i.id === e.target.value);
                        if (item) {
                          setUnidad(item.unidad);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lavender-500 text-sm"
                    >
                      <option value="">-- Seleccionar --</option>
                      {inventarioItems.map((item) => {
                        const cat = CATEGORIAS.find((c) => c.value === item.categoria);
                        return (
                          <option key={item.id} value={item.id}>
                            {cat?.icon} {item.nombre} ({item.unidad})
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Nombre del item
                    </label>
                    <input
                      type="text"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      placeholder="Ej: Toallas desechables"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lavender-500 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Categoría</label>
                      <select
                        value={nuevoCategoria}
                        onChange={(e) => setNuevoCategoria(e.target.value as CategoriaInventario)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lavender-500 text-sm"
                      >
                        {CATEGORIAS.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.icon} {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Unidad</label>
                      <select
                        value={unidad}
                        onChange={(e) => setUnidad(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lavender-500 text-sm"
                      >
                        {UNIDADES.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Cantidad común */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={cantidad}
                    onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lavender-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Motivo (opcional)</label>
                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej: Se agotó"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lavender-500 text-sm"
                  />
                </div>
              </div>

              <button
                onClick={handleAgregarItem}
                className="w-full py-2 bg-lavender-600 hover:bg-lavender-700 text-white font-medium rounded-lg transition-colors"
              >
                Agregar a la lista
              </button>
            </div>
          )}

          {/* Motivo general */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo general (opcional)
            </label>
            <textarea
              value={motivoGeneral}
              onChange={(e) => setMotivoGeneral(e.target.value)}
              placeholder="Ej: Reabastecimiento semanal..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lavender-500 text-sm"
            />
          </div>

          {/* Fecha necesaria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha necesaria (opcional)
            </label>
            <input
              type="date"
              value={fechaNecesaria}
              onChange={(e) => setFechaNecesaria(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lavender-500 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 sm:p-6">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleEnviar}
              disabled={items.length === 0 || loading}
              className={`flex-1 px-4 py-3 font-medium rounded-lg transition-colors ${
                items.length > 0 && !loading
                  ? 'bg-lavender-600 hover:bg-lavender-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Enviando...' : `Crear Solicitud (${items.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
