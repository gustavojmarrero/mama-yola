import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { format, addDays, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import Layout from '../components/common/Layout';
import {
  ItemInventario,
  MovimientoInventario,
  CategoriaInventario,
  TipoMovimiento,
} from '../types';
import { useAuth } from '../context/AuthContext';

const PACIENTE_ID = 'paciente-principal';

// Tipo para las notificaciones toast
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const categorias: { value: CategoriaInventario; label: string; icon: string }[] = [
  { value: 'medicamento', label: 'Medicamento', icon: '💊' },
  { value: 'material', label: 'Material', icon: '🩹' },
  { value: 'consumible', label: 'Consumible', icon: '📦' },
];

const unidades = ['piezas', 'cajas', 'frascos', 'ml', 'tabletas', 'sobres', 'unidades', 'paquetes'];

export default function Inventarios() {
  const { currentUser, userProfile } = useAuth();
  const [items, setItems] = useState<ItemInventario[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [editando, setEditando] = useState<ItemInventario | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaInventario | 'todos'>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'critico' | 'bajo' | 'por_vencer' | 'ok'>('todos');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Función para mostrar toast
  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    // Auto-remover después de 3 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const [formData, setFormData] = useState({
    nombre: '',
    categoria: 'medicamento' as CategoriaInventario,
    presentacion: '',
    fechaVencimiento: '',
    cantidadMaestro: 0,
    cantidadOperativo: 0,
    unidad: 'piezas',
    nivelMinimoMaestro: 5,
    nivelMinimoOperativo: 5,
    ubicacion: '',
    notas: '',
  });

  const [movimientoForm, setMovimientoForm] = useState({
    itemId: '',
    tipo: 'entrada' as TipoMovimiento,
    cantidad: 0,
    motivo: '',
    notas: '',
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      await Promise.all([cargarItems(), cargarMovimientos()]);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  }

  async function cargarItems() {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'inventario'),
        orderBy('nombre', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const itemsData: ItemInventario[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Compatibilidad con modelo antiguo: convertir cantidad a cantidadMaestro/cantidadOperativo
        const cantidadMaestro = data.cantidadMaestro ?? (data.tipo === 'maestro' ? data.cantidad : 0) ?? 0;
        const cantidadOperativo = data.cantidadOperativo ?? (data.tipo === 'operativo' ? data.cantidad : 0) ?? 0;
        const nivelMinimoMaestro = data.nivelMinimoMaestro ?? data.nivelMinimo ?? 5;
        const nivelMinimoOperativo = data.nivelMinimoOperativo ?? data.nivelMinimo ?? 5;

        itemsData.push({
          id: doc.id,
          pacienteId: data.pacienteId,
          nombre: data.nombre,
          categoria: data.categoria,
          cantidadMaestro,
          cantidadOperativo,
          presentacion: data.presentacion,
          fechaVencimiento: data.fechaVencimiento?.toDate(),
          vinculadoPastillero: data.vinculadoPastillero,
          medicamentoId: data.medicamentoId,
          unidad: data.unidad,
          nivelMinimoMaestro,
          nivelMinimoOperativo,
          ubicacion: data.ubicacion,
          notas: data.notas,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as ItemInventario);
      });

      setItems(itemsData);
    } catch (error) {
      console.error('Error al cargar items:', error);
    }
  }

  async function cargarMovimientos() {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'movimientosInventario'),
        orderBy('fecha', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const movimientosData: MovimientoInventario[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        movimientosData.push({
          id: doc.id,
          ...data,
          fecha: data.fecha?.toDate() || new Date(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
        } as MovimientoInventario);
      });

      setMovimientos(movimientosData);
    } catch (error) {
      console.error('Error al cargar movimientos:', error);
    }
  }

  function abrirModal(item?: ItemInventario) {
    if (item) {
      setEditando(item);
      setFormData({
        nombre: item.nombre,
        categoria: item.categoria,
        presentacion: item.presentacion || '',
        fechaVencimiento: item.fechaVencimiento
          ? format(item.fechaVencimiento, 'yyyy-MM-dd')
          : '',
        cantidadMaestro: item.cantidadMaestro,
        cantidadOperativo: item.cantidadOperativo,
        unidad: item.unidad,
        nivelMinimoMaestro: item.nivelMinimoMaestro,
        nivelMinimoOperativo: item.nivelMinimoOperativo,
        ubicacion: item.ubicacion || '',
        notas: item.notas || '',
      });
    } else {
      setEditando(null);
      setFormData({
        nombre: '',
        categoria: 'medicamento',
        presentacion: '',
        fechaVencimiento: '',
        cantidadMaestro: 0,
        cantidadOperativo: 0,
        unidad: 'piezas',
        nivelMinimoMaestro: 5,
        nivelMinimoOperativo: 5,
        ubicacion: '',
        notas: '',
      });
    }
    setShowModal(true);
  }

  function cerrarModal() {
    setShowModal(false);
    setEditando(null);
  }

  function abrirMovimientoModal(item: ItemInventario, tipo: TipoMovimiento = 'entrada') {
    setMovimientoForm({
      itemId: item.id,
      tipo,
      cantidad: 0,
      motivo: '',
      notas: '',
    });
    setShowMovimientoModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.nombre) {
      showToast('Por favor completa los campos obligatorios', 'warning');
      return;
    }

    try {
      const ahora = Timestamp.now();

      // Construir objeto solo con campos definidos (Firebase no acepta undefined)
      const itemData: Record<string, unknown> = {
        pacienteId: PACIENTE_ID,
        nombre: formData.nombre,
        categoria: formData.categoria,
        cantidadMaestro: formData.cantidadMaestro,
        cantidadOperativo: formData.cantidadOperativo,
        unidad: formData.unidad,
        nivelMinimoMaestro: formData.nivelMinimoMaestro,
        nivelMinimoOperativo: formData.nivelMinimoOperativo,
        actualizadoEn: ahora,
      };

      // Agregar campos opcionales solo si tienen valor
      if (formData.presentacion) itemData.presentacion = formData.presentacion;
      if (formData.fechaVencimiento) {
        itemData.fechaVencimiento = Timestamp.fromDate(new Date(formData.fechaVencimiento));
      }
      if (formData.ubicacion) itemData.ubicacion = formData.ubicacion;
      if (formData.notas) itemData.notas = formData.notas;

      if (editando) {
        await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'inventario', editando.id), itemData);
        showToast('Item actualizado correctamente', 'success');
      } else {
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'inventario'), {
          ...itemData,
          creadoEn: ahora,
        });
        showToast('Item creado correctamente', 'success');
      }

      cerrarModal();
      cargarItems();
    } catch (error) {
      console.error('Error al guardar item:', error);
      showToast('Error al guardar el item', 'error');
    }
  }

  async function handleMovimiento(e: React.FormEvent) {
    e.preventDefault();

    if (!movimientoForm.itemId || movimientoForm.cantidad <= 0) {
      showToast('Por favor ingresa una cantidad válida', 'warning');
      return;
    }

    const item = items.find((i) => i.id === movimientoForm.itemId);
    if (!item) return;

    // Validar stock según tipo de movimiento
    if (movimientoForm.tipo === 'salida' && movimientoForm.cantidad > item.cantidadOperativo) {
      showToast('No hay suficiente stock en el inventario operativo', 'error');
      return;
    }
    if (movimientoForm.tipo === 'transferencia' && movimientoForm.cantidad > item.cantidadMaestro) {
      showToast('No hay suficiente stock en el inventario maestro', 'error');
      return;
    }

    try {
      const ahora = Timestamp.now();

      // Calcular nuevas cantidades según tipo de movimiento
      let nuevaCantidadMaestro = item.cantidadMaestro;
      let nuevaCantidadOperativo = item.cantidadOperativo;

      if (movimientoForm.tipo === 'entrada') {
        // Entrada: suma al maestro
        nuevaCantidadMaestro += movimientoForm.cantidad;
      } else if (movimientoForm.tipo === 'salida') {
        // Salida: resta del operativo
        nuevaCantidadOperativo -= movimientoForm.cantidad;
      } else if (movimientoForm.tipo === 'transferencia') {
        // Transferencia: del maestro al operativo
        nuevaCantidadMaestro -= movimientoForm.cantidad;
        nuevaCantidadOperativo += movimientoForm.cantidad;
      } else if (movimientoForm.tipo === 'ajuste') {
        // Ajuste: se ajusta la cantidad del operativo (principal)
        nuevaCantidadOperativo = movimientoForm.cantidad;
      }

      // Actualizar item con las nuevas cantidades
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'inventario', item.id), {
        cantidadMaestro: nuevaCantidadMaestro,
        cantidadOperativo: nuevaCantidadOperativo,
        actualizadoEn: ahora,
      });

      // Crear registro de movimiento
      const movimientoData: Record<string, unknown> = {
        pacienteId: PACIENTE_ID,
        tipo: movimientoForm.tipo,
        itemId: item.id,
        itemNombre: item.nombre,
        origen: movimientoForm.tipo === 'entrada' ? 'externo' :
                movimientoForm.tipo === 'transferencia' ? 'maestro' : 'operativo',
        destino: movimientoForm.tipo === 'entrada' ? 'maestro' :
                 movimientoForm.tipo === 'transferencia' ? 'operativo' : 'consumido',
        cantidad: movimientoForm.cantidad,
        usuarioId: currentUser?.uid || '',
        usuarioNombre: userProfile?.nombre || 'Usuario',
        fecha: ahora,
        creadoEn: ahora,
      };

      if (movimientoForm.motivo) movimientoData.motivo = movimientoForm.motivo;
      if (movimientoForm.notas) movimientoData.notas = movimientoForm.notas;

      await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'movimientosInventario'), movimientoData);

      showToast('Movimiento registrado correctamente', 'success');
      setShowMovimientoModal(false);
      cargarDatos();
    } catch (error) {
      console.error('Error al registrar movimiento:', error);
      showToast('Error al registrar el movimiento', 'error');
    }
  }

  function getEstadoItem(item: ItemInventario) {
    const hoy = new Date();
    const en30Dias = addDays(hoy, 30);
    const cantidadTotal = item.cantidadMaestro + item.cantidadOperativo;

    if (cantidadTotal === 0) return 'critico';
    if (item.fechaVencimiento && isBefore(item.fechaVencimiento, hoy)) return 'vencido';
    if (item.fechaVencimiento && isBefore(item.fechaVencimiento, en30Dias)) return 'por_vencer';
    // Verificar si alguno de los inventarios está bajo
    if (item.cantidadMaestro <= item.nivelMinimoMaestro || item.cantidadOperativo <= item.nivelMinimoOperativo) return 'bajo';
    return 'ok';
  }

  function getEstadoColor(estado: string) {
    switch (estado) {
      case 'critico':
      case 'vencido':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'por_vencer':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'bajo':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  }

  function getEstadoLabel(estado: string) {
    switch (estado) {
      case 'critico':
        return '🔴 Sin Stock';
      case 'vencido':
        return '🔴 Vencido';
      case 'por_vencer':
        return '🟠 Por Vencer';
      case 'bajo':
        return '🟡 Bajo';
      default:
        return '🟢 OK';
    }
  }

  // Filtrar items
  const itemsFiltrados = items.filter((item) => {
    const matchCategoria = filtroCategoria === 'todos' || item.categoria === filtroCategoria;
    const matchEstado = filtroEstado === 'todos' || getEstadoItem(item) === filtroEstado;
    return matchCategoria && matchEstado;
  });

  // Alertas
  const itemsCriticos = items.filter((i) => getEstadoItem(i) === 'critico' || getEstadoItem(i) === 'vencido');
  const itemsBajos = items.filter((i) => getEstadoItem(i) === 'bajo');
  const itemsPorVencer = items.filter((i) => getEstadoItem(i) === 'por_vencer');

  if (loading) {
    return (
      <Layout>
        <div className="p-8 flex justify-center items-center">
          <p className="text-gray-600">Cargando inventario...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">📦 Control de Inventarios</h1>
            <p className="text-gray-600 mt-2">Gestiona los suministros del paciente</p>
          </div>

          {/* Alertas */}
          {(itemsCriticos.length > 0 || itemsBajos.length > 0 || itemsPorVencer.length > 0) && (
            <div className="mb-6 space-y-3">
              {itemsCriticos.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">
                    🚨 Items Críticos ({itemsCriticos.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {itemsCriticos.slice(0, 5).map((item) => (
                      <span
                        key={item.id}
                        className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm"
                      >
                        {item.nombre}
                      </span>
                    ))}
                    {itemsCriticos.length > 5 && (
                      <span className="text-sm text-red-700">+{itemsCriticos.length - 5} más</span>
                    )}
                  </div>
                </div>
              )}

              {itemsBajos.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">
                    ⚠️ Stock Bajo ({itemsBajos.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {itemsBajos.slice(0, 5).map((item) => (
                      <span
                        key={item.id}
                        className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm"
                      >
                        {item.nombre}: M:{item.cantidadMaestro} O:{item.cantidadOperativo} {item.unidad}
                      </span>
                    ))}
                    {itemsBajos.length > 5 && (
                      <span className="text-sm text-yellow-700">+{itemsBajos.length - 5} más</span>
                    )}
                  </div>
                </div>
              )}

              {itemsPorVencer.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-800 mb-2">
                    📅 Por Vencer (30 días) ({itemsPorVencer.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {itemsPorVencer.slice(0, 5).map((item) => (
                      <span
                        key={item.id}
                        className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm"
                      >
                        {item.nombre} - {item.fechaVencimiento && format(item.fechaVencimiento, 'dd/MM/yyyy')}
                      </span>
                    ))}
                    {itemsPorVencer.length > 5 && (
                      <span className="text-sm text-orange-700">+{itemsPorVencer.length - 5} más</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value as CategoriaInventario | 'todos')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todas</option>
                  {categorias.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todos</option>
                  <option value="critico">🔴 Crítico</option>
                  <option value="bajo">🟡 Bajo</option>
                  <option value="por_vencer">🟠 Por Vencer</option>
                  <option value="ok">🟢 OK</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setShowHistorialModal(true)}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  📜 Ver Movimientos
                </button>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => abrirModal()}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  + Nuevo Item
                </button>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              Mostrando <strong>{itemsFiltrados.length}</strong> items en inventario
            </p>
          </div>

          {/* Lista de items */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    🏪 Maestro
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    📋 Operativo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vencimiento
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {itemsFiltrados.map((item) => {
                  const estado = getEstadoItem(item);
                  const catInfo = categorias.find((c) => c.value === item.categoria);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">{catInfo?.icon}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.nombre}</div>
                            <div className="text-sm text-gray-500">
                              {item.presentacion && `${item.presentacion}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900 font-semibold">
                          {item.cantidadMaestro} {item.unidad}
                        </div>
                        <div className="text-xs text-gray-500">
                          Mín: {item.nivelMinimoMaestro}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900 font-semibold">
                          {item.cantidadOperativo} {item.unidad}
                        </div>
                        <div className="text-xs text-gray-500">
                          Mín: {item.nivelMinimoOperativo}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${getEstadoColor(estado)}`}
                        >
                          {getEstadoLabel(estado)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.fechaVencimiento
                          ? format(item.fechaVencimiento, 'dd/MM/yyyy')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => abrirMovimientoModal(item, 'entrada')}
                            className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs rounded transition-colors"
                            title="Entrada (Compra al Maestro)"
                          >
                            ➕
                          </button>
                          <button
                            onClick={() => abrirMovimientoModal(item, 'transferencia')}
                            className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition-colors"
                            title="Transferir de Maestro a Operativo"
                          >
                            ↔️
                          </button>
                          <button
                            onClick={() => abrirMovimientoModal(item, 'salida')}
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded transition-colors"
                            title="Salida (Consumo del Operativo)"
                          >
                            ➖
                          </button>
                          <button
                            onClick={() => abrirModal(item)}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded transition-colors"
                            title="Editar"
                          >
                            ✏️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {itemsFiltrados.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No hay items en el inventario</p>
                <button
                  onClick={() => abrirModal()}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  + Agregar primer item
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal crear/editar item */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {editando ? 'Editar Item' : 'Nuevo Item'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoría *</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value as CategoriaInventario })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categorias.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Presentación</label>
                  <input
                    type="text"
                    value={formData.presentacion}
                    onChange={(e) => setFormData({ ...formData, presentacion: e.target.value })}
                    placeholder="Ej: 500mg, 100ml"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unidad</label>
                  <select
                    value={formData.unidad}
                    onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {unidades.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sección Maestro */}
                <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-3">🏪 Inventario Maestro</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad Maestro</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.cantidadMaestro}
                        onChange={(e) => setFormData({ ...formData, cantidadMaestro: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nivel Mínimo Maestro</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.nivelMinimoMaestro}
                        onChange={(e) => setFormData({ ...formData, nivelMinimoMaestro: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección Operativo */}
                <div className="md:col-span-2 bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-3">📋 Inventario Operativo</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad Operativo</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.cantidadOperativo}
                        onChange={(e) => setFormData({ ...formData, cantidadOperativo: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nivel Mínimo Operativo</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.nivelMinimoOperativo}
                        onChange={(e) => setFormData({ ...formData, nivelMinimoOperativo: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Vencimiento</label>
                  <input
                    type="date"
                    value={formData.fechaVencimiento}
                    onChange={(e) => setFormData({ ...formData, fechaVencimiento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación</label>
                  <input
                    type="text"
                    value={formData.ubicacion}
                    onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                    placeholder="Ej: Cajón 1, Refrigerador"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
                  <textarea
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  {editando ? 'Actualizar' : 'Crear'} Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal movimiento */}
      {showMovimientoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Registrar Movimiento</h2>
            </div>

            <form onSubmit={handleMovimiento} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item: <strong>{items.find((i) => i.id === movimientoForm.itemId)?.nombre}</strong>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Movimiento</label>
                <select
                  value={movimientoForm.tipo}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, tipo: e.target.value as TipoMovimiento })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="entrada">➕ Entrada (Compra/Recepción)</option>
                  <option value="salida">➖ Salida (Consumo)</option>
                  <option value="transferencia">↔️ Transferencia</option>
                  <option value="ajuste">🔧 Ajuste de inventario</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {movimientoForm.tipo === 'ajuste' ? 'Nueva Cantidad' : 'Cantidad'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={movimientoForm.cantidad}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, cantidad: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Motivo</label>
                <input
                  type="text"
                  value={movimientoForm.motivo}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, motivo: e.target.value })}
                  placeholder="Ej: Compra mensual, Consumo diario"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
                <textarea
                  value={movimientoForm.notas}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, notas: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMovimientoModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] animate-slide-in ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : toast.type === 'error'
                ? 'bg-red-500 text-white'
                : toast.type === 'warning'
                ? 'bg-yellow-500 text-white'
                : 'bg-blue-500 text-white'
            }`}
          >
            <span className="text-lg">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'warning' && '⚠'}
              {toast.type === 'info' && 'ℹ'}
            </span>
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-white/80 hover:text-white"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Modal historial de movimientos */}
      {showHistorialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">📜 Historial de Movimientos</h2>
              <button
                onClick={() => setShowHistorialModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {movimientos.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No hay movimientos registrados</p>
              ) : (
                <div className="space-y-3">
                  {movimientos.slice(0, 50).map((mov) => (
                    <div
                      key={mov.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                mov.tipo === 'entrada'
                                  ? 'bg-green-100 text-green-800'
                                  : mov.tipo === 'salida'
                                  ? 'bg-red-100 text-red-800'
                                  : mov.tipo === 'transferencia'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {mov.tipo.charAt(0).toUpperCase() + mov.tipo.slice(1)}
                            </span>
                            <span className="font-medium text-gray-900">{mov.itemNombre}</span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {mov.tipo === 'entrada' ? '+' : mov.tipo === 'ajuste' ? '=' : '-'}
                            {mov.cantidad} unidades
                            {mov.motivo && ` • ${mov.motivo}`}
                          </p>
                          {mov.notas && (
                            <p className="text-xs text-gray-500 mt-1 italic">{mov.notas}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-900">
                            {format(mov.fecha, 'dd/MM/yyyy HH:mm', { locale: es })}
                          </p>
                          <p className="text-xs text-gray-500">{mov.usuarioNombre}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
