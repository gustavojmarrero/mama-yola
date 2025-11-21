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
  TipoInventario,
  CategoriaInventario,
  TipoMovimiento,
} from '../types';
import { useAuth } from '../context/AuthContext';

const PACIENTE_ID = 'paciente-principal';

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
  const [tabActivo, setTabActivo] = useState<TipoInventario>('operativo');
  const [showModal, setShowModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [editando, setEditando] = useState<ItemInventario | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaInventario | 'todos'>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'critico' | 'bajo' | 'por_vencer' | 'ok'>('todos');

  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'operativo' as TipoInventario,
    categoria: 'medicamento' as CategoriaInventario,
    presentacion: '',
    fechaVencimiento: '',
    lote: '',
    cantidad: 0,
    unidad: 'piezas',
    nivelMinimo: 5,
    ubicacion: '',
    costo: 0,
    proveedor: '',
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
        itemsData.push({
          id: doc.id,
          ...data,
          fechaVencimiento: data.fechaVencimiento?.toDate(),
          ultimaRevision: data.ultimaRevision?.toDate(),
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
        tipo: item.tipo,
        categoria: item.categoria,
        presentacion: item.presentacion || '',
        fechaVencimiento: item.fechaVencimiento
          ? format(item.fechaVencimiento, 'yyyy-MM-dd')
          : '',
        lote: item.lote || '',
        cantidad: item.cantidad,
        unidad: item.unidad,
        nivelMinimo: item.nivelMinimo,
        ubicacion: item.ubicacion || '',
        costo: item.costo || 0,
        proveedor: item.proveedor || '',
        notas: item.notas || '',
      });
    } else {
      setEditando(null);
      setFormData({
        nombre: '',
        tipo: tabActivo,
        categoria: 'medicamento',
        presentacion: '',
        fechaVencimiento: '',
        lote: '',
        cantidad: 0,
        unidad: 'piezas',
        nivelMinimo: 5,
        ubicacion: '',
        costo: 0,
        proveedor: '',
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

    if (!formData.nombre || formData.cantidad < 0) {
      alert('Por favor completa los campos obligatorios');
      return;
    }

    try {
      const ahora = Timestamp.now();

      const itemData = {
        pacienteId: PACIENTE_ID,
        nombre: formData.nombre,
        tipo: formData.tipo,
        categoria: formData.categoria,
        presentacion: formData.presentacion || undefined,
        fechaVencimiento: formData.fechaVencimiento
          ? Timestamp.fromDate(new Date(formData.fechaVencimiento))
          : undefined,
        lote: formData.lote || undefined,
        cantidad: formData.cantidad,
        unidad: formData.unidad,
        nivelMinimo: formData.nivelMinimo,
        ubicacion: formData.ubicacion || undefined,
        costo: formData.costo || undefined,
        proveedor: formData.proveedor || undefined,
        notas: formData.notas || undefined,
        actualizadoEn: ahora,
      };

      if (editando) {
        await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'inventario', editando.id), itemData);
        alert('Item actualizado correctamente');
      } else {
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'inventario'), {
          ...itemData,
          creadoEn: ahora,
        });
        alert('Item creado correctamente');
      }

      cerrarModal();
      cargarItems();
    } catch (error) {
      console.error('Error al guardar item:', error);
      alert('Error al guardar el item');
    }
  }

  async function handleMovimiento(e: React.FormEvent) {
    e.preventDefault();

    if (!movimientoForm.itemId || movimientoForm.cantidad <= 0) {
      alert('Por favor ingresa una cantidad válida');
      return;
    }

    const item = items.find((i) => i.id === movimientoForm.itemId);
    if (!item) return;

    // Validar que hay suficiente stock para salidas/transferencias
    if (
      (movimientoForm.tipo === 'salida' || movimientoForm.tipo === 'transferencia') &&
      movimientoForm.cantidad > item.cantidad
    ) {
      alert('No hay suficiente stock disponible');
      return;
    }

    try {
      const ahora = Timestamp.now();

      // Calcular nueva cantidad
      let nuevaCantidad = item.cantidad;
      if (movimientoForm.tipo === 'entrada') {
        nuevaCantidad += movimientoForm.cantidad;
      } else if (movimientoForm.tipo === 'salida' || movimientoForm.tipo === 'transferencia') {
        nuevaCantidad -= movimientoForm.cantidad;
      } else if (movimientoForm.tipo === 'ajuste') {
        nuevaCantidad = movimientoForm.cantidad;
      }

      // Actualizar item
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'inventario', item.id), {
        cantidad: nuevaCantidad,
        actualizadoEn: ahora,
      });

      // Crear registro de movimiento
      await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'movimientosInventario'), {
        pacienteId: PACIENTE_ID,
        tipo: movimientoForm.tipo,
        itemId: item.id,
        itemNombre: item.nombre,
        origen: item.tipo,
        destino: movimientoForm.tipo === 'transferencia'
          ? (item.tipo === 'maestro' ? 'operativo' : 'maestro')
          : movimientoForm.tipo === 'salida' ? 'consumido' : 'externo',
        cantidad: movimientoForm.cantidad,
        motivo: movimientoForm.motivo || undefined,
        usuarioId: currentUser?.uid || '',
        usuarioNombre: userProfile?.nombre || 'Usuario',
        fecha: ahora,
        notas: movimientoForm.notas || undefined,
        creadoEn: ahora,
      });

      // Si es transferencia, crear item en el otro inventario
      if (movimientoForm.tipo === 'transferencia') {
        const nuevoTipo = item.tipo === 'maestro' ? 'operativo' : 'maestro';

        // Buscar si ya existe el item en el otro inventario
        const itemExistente = items.find(
          (i) => i.nombre === item.nombre && i.tipo === nuevoTipo
        );

        if (itemExistente) {
          await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'inventario', itemExistente.id), {
            cantidad: itemExistente.cantidad + movimientoForm.cantidad,
            actualizadoEn: ahora,
          });
        } else {
          await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'inventario'), {
            ...item,
            id: undefined,
            tipo: nuevoTipo,
            cantidad: movimientoForm.cantidad,
            creadoEn: ahora,
            actualizadoEn: ahora,
          });
        }
      }

      alert('Movimiento registrado correctamente');
      setShowMovimientoModal(false);
      cargarDatos();
    } catch (error) {
      console.error('Error al registrar movimiento:', error);
      alert('Error al registrar el movimiento');
    }
  }

  function getEstadoItem(item: ItemInventario) {
    const hoy = new Date();
    const en30Dias = addDays(hoy, 30);

    if (item.cantidad === 0) return 'critico';
    if (item.fechaVencimiento && isBefore(item.fechaVencimiento, hoy)) return 'vencido';
    if (item.fechaVencimiento && isBefore(item.fechaVencimiento, en30Dias)) return 'por_vencer';
    if (item.cantidad <= item.nivelMinimo) return 'bajo';
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
    const matchTipo = item.tipo === tabActivo;
    const matchCategoria = filtroCategoria === 'todos' || item.categoria === filtroCategoria;
    const matchEstado = filtroEstado === 'todos' || getEstadoItem(item) === filtroEstado;
    return matchTipo && matchCategoria && matchEstado;
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
                        {item.nombre}: {item.cantidad} {item.unidad}
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

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setTabActivo('operativo')}
                className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                  tabActivo === 'operativo'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                📋 Inventario Operativo
                <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full">
                  {items.filter((i) => i.tipo === 'operativo').length}
                </span>
              </button>
              <button
                onClick={() => setTabActivo('maestro')}
                className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                  tabActivo === 'maestro'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                🏪 Inventario Maestro
                <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full">
                  {items.filter((i) => i.tipo === 'maestro').length}
                </span>
              </button>
            </div>
          </div>

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
              Mostrando <strong>{itemsFiltrados.length}</strong> items en inventario{' '}
              <strong>{tabActivo}</strong>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cantidad
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
                              {item.presentacion && `${item.presentacion} • `}
                              {item.lote && `Lote: ${item.lote}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-semibold">
                          {item.cantidad} {item.unidad}
                        </div>
                        <div className="text-xs text-gray-500">
                          Mín: {item.nivelMinimo}
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
                            title="Entrada"
                          >
                            ➕
                          </button>
                          <button
                            onClick={() => abrirMovimientoModal(item, 'salida')}
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded transition-colors"
                            title="Salida"
                          >
                            ➖
                          </button>
                          <button
                            onClick={() => abrirMovimientoModal(item, 'transferencia')}
                            className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition-colors"
                            title={`Transferir a ${item.tipo === 'maestro' ? 'Operativo' : 'Maestro'}`}
                          >
                            ↔️
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
                <p className="text-gray-500 text-lg">No hay items en este inventario</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoInventario })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="operativo">Operativo</option>
                    <option value="maestro">Maestro</option>
                  </select>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lote</label>
                  <input
                    type="text"
                    value={formData.lote}
                    onChange={(e) => setFormData({ ...formData, lote: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.cantidad}
                    onChange={(e) => setFormData({ ...formData, cantidad: parseInt(e.target.value) || 0 })}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nivel Mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.nivelMinimo}
                    onChange={(e) => setFormData({ ...formData, nivelMinimo: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Costo</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.costo}
                    onChange={(e) => setFormData({ ...formData, costo: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Proveedor</label>
                  <input
                    type="text"
                    value={formData.proveedor}
                    onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
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
