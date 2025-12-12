import { useState, useMemo } from 'react';
import Layout from '../components/common/Layout';
import SearchBar from '../components/common/SearchBar';
import FilterPanel, { FilterSelect } from '../components/common/FilterPanel';
import SortDropdown from '../components/common/SortDropdown';
import LoadMoreButton from '../components/common/LoadMoreButton';
import { useAuth } from '../context/AuthContext';
import { useSolicitudesMateriales } from '../hooks/useSolicitudesMateriales';
import SolicitudMaterialCard from '../components/solicitudes/SolicitudMaterialCard';
import NuevaSolicitudModal from '../components/solicitudes/NuevaSolicitudModal';
import DetalleSolicitudModal from '../components/solicitudes/DetalleSolicitudModal';
import {
  SolicitudMaterial,
  EstadoSolicitudMaterial,
  UrgenciaMaterial,
} from '../types';

const ITEMS_PER_PAGE = 10;

const SORT_OPTIONS = [
  { value: 'reciente', label: 'Más recientes' },
  { value: 'antiguo', label: 'Más antiguos' },
  { value: 'urgencia', label: 'Por urgencia' },
  { value: 'estado', label: 'Por estado' },
];

const ESTADOS_OPCIONES = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'aprobada', label: 'Aprobadas' },
  { value: 'comprada', label: 'Compradas' },
  { value: 'entregada', label: 'Entregadas' },
  { value: 'rechazada', label: 'Rechazadas' },
];

const URGENCIA_OPCIONES = [
  { value: 'todos', label: 'Todas las urgencias' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'alta', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'baja', label: 'Baja' },
];

// Tipo para las notificaciones toast
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export default function SolicitudesMateriales() {
  const { currentUser, userProfile } = useAuth();
  const {
    solicitudes,
    solicitudesPendientes,
    contadorPendientes,
    contadorUrgentes,
    loading,
    crearSolicitud,
    aprobarSolicitud,
    rechazarSolicitud,
    marcarComoComprada,
    marcarComoEntregada,
    cancelarSolicitud,
    editarSolicitud,
    recargarDatos,
  } = useSolicitudesMateriales();

  // Estados de UI
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState('reciente');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [filtroEstado, setFiltroEstado] = useState<EstadoSolicitudMaterial | 'todos'>('todos');
  const [filtroUrgencia, setFiltroUrgencia] = useState<UrgenciaMaterial | 'todos'>('todos');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Estados de modales
  const [showNuevaModal, setShowNuevaModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<SolicitudMaterial | null>(null);
  const [solicitudEditar, setSolicitudEditar] = useState<SolicitudMaterial | null>(null);
  const [modoDetalle, setModoDetalle] = useState<'ver' | 'aprobar' | 'rechazar' | 'comprar' | 'entregar'>('ver');

  // Control de permisos
  const puedeAprobar = userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor';
  const esCuidador = userProfile?.rol === 'cuidador';

  // Función para mostrar toast
  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Filtrar solicitudes según rol y filtros
  const solicitudesFiltradas = useMemo(() => {
    let lista = [...solicitudes];

    // Cuidadores solo ven sus propias solicitudes
    if (esCuidador && currentUser) {
      lista = lista.filter((s) => s.solicitadoPor === currentUser.uid);
    }

    // Filtro por búsqueda
    if (searchTerm) {
      const termLower = searchTerm.toLowerCase();
      lista = lista.filter(
        (s) =>
          s.items.some((i) => i.nombre.toLowerCase().includes(termLower)) ||
          s.solicitadoPorNombre.toLowerCase().includes(termLower) ||
          (s.motivoGeneral && s.motivoGeneral.toLowerCase().includes(termLower))
      );
    }

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      lista = lista.filter((s) => s.estado === filtroEstado);
    }

    // Filtro por urgencia
    if (filtroUrgencia !== 'todos') {
      lista = lista.filter((s) => s.urgencia === filtroUrgencia);
    }

    // Ordenamiento
    lista.sort((a, b) => {
      switch (sortBy) {
        case 'reciente':
          return new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime();
        case 'antiguo':
          return new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime();
        case 'urgencia': {
          const urgenciaOrden = { urgente: 0, alta: 1, normal: 2, baja: 3 };
          return urgenciaOrden[a.urgencia] - urgenciaOrden[b.urgencia];
        }
        case 'estado': {
          const estadoOrden = { pendiente: 0, aprobada: 1, comprada: 2, entregada: 3, rechazada: 4 };
          return estadoOrden[a.estado] - estadoOrden[b.estado];
        }
        default:
          return 0;
      }
    });

    return lista;
  }, [solicitudes, searchTerm, filtroEstado, filtroUrgencia, sortBy, esCuidador, currentUser]);

  // Solicitudes visibles (paginadas)
  const solicitudesVisibles = solicitudesFiltradas.slice(0, visibleCount);
  const hayMas = solicitudesFiltradas.length > visibleCount;

  // Handlers
  const handleVerDetalle = (solicitud: SolicitudMaterial) => {
    setSolicitudSeleccionada(solicitud);
    setModoDetalle('ver');
    setShowDetalleModal(true);
  };

  const handleAprobar = (solicitud: SolicitudMaterial) => {
    setSolicitudSeleccionada(solicitud);
    setModoDetalle('aprobar');
    setShowDetalleModal(true);
  };

  const handleRechazar = (solicitud: SolicitudMaterial) => {
    setSolicitudSeleccionada(solicitud);
    setModoDetalle('rechazar');
    setShowDetalleModal(true);
  };

  const handleMarcarComprada = (solicitud: SolicitudMaterial) => {
    setSolicitudSeleccionada(solicitud);
    setModoDetalle('comprar');
    setShowDetalleModal(true);
  };

  const handleMarcarEntregada = (solicitud: SolicitudMaterial) => {
    setSolicitudSeleccionada(solicitud);
    setModoDetalle('entregar');
    setShowDetalleModal(true);
  };

  const handleCancelar = async (solicitud: SolicitudMaterial) => {
    if (!window.confirm('¿Estás seguro de cancelar esta solicitud?')) return;
    try {
      await cancelarSolicitud(solicitud.id);
      showToast('Solicitud cancelada', 'success');
    } catch (error) {
      showToast('Error al cancelar solicitud', 'error');
    }
  };

  const handleEditar = (solicitud: SolicitudMaterial) => {
    setSolicitudEditar(solicitud);
    setShowNuevaModal(true);
  };

  const handleConfirmarAccion = async (datos: {
    accion: 'aprobar' | 'rechazar' | 'comprar' | 'entregar';
    notas?: string;
    motivoRechazo?: string;
    costoTotal?: number;
  }) => {
    if (!solicitudSeleccionada || !currentUser || !userProfile) return;

    try {
      switch (datos.accion) {
        case 'aprobar':
          await aprobarSolicitud(
            solicitudSeleccionada.id,
            currentUser.uid,
            userProfile.nombre,
            datos.notas
          );
          showToast('Solicitud aprobada', 'success');
          break;
        case 'rechazar':
          if (!datos.motivoRechazo) {
            showToast('Debes indicar un motivo de rechazo', 'warning');
            return;
          }
          await rechazarSolicitud(
            solicitudSeleccionada.id,
            datos.motivoRechazo,
            currentUser.uid,
            userProfile.nombre
          );
          showToast('Solicitud rechazada', 'success');
          break;
        case 'comprar':
          await marcarComoComprada(
            solicitudSeleccionada.id,
            currentUser.uid,
            userProfile.nombre,
            datos.notas,
            datos.costoTotal
          );
          showToast('Solicitud marcada como comprada', 'success');
          break;
        case 'entregar':
          await marcarComoEntregada(
            solicitudSeleccionada.id,
            currentUser.uid,
            userProfile.nombre,
            datos.notas
          );
          showToast('Solicitud marcada como entregada', 'success');
          break;
      }
      setShowDetalleModal(false);
      setSolicitudSeleccionada(null);
    } catch (error) {
      showToast('Error al procesar la acción', 'error');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Toasts */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-slide-in ${
                toast.type === 'success'
                  ? 'bg-green-500'
                  : toast.type === 'error'
                  ? 'bg-red-500'
                  : toast.type === 'warning'
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Materiales</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gestiona las solicitudes de compra de materiales y consumibles
            </p>
          </div>
          <button
            onClick={() => setShowNuevaModal(true)}
            className="px-4 py-2 bg-lavender-600 hover:bg-lavender-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span>+</span>
            <span>Nueva Solicitud</span>
          </button>
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{solicitudes.length}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
            <div className="text-2xl font-bold text-yellow-700">{contadorPendientes}</div>
            <div className="text-sm text-yellow-600">Pendientes</div>
          </div>
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
            <div className="text-2xl font-bold text-orange-700">{contadorUrgentes}</div>
            <div className="text-sm text-orange-600">Urgentes</div>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4">
            <div className="text-2xl font-bold text-green-700">
              {solicitudes.filter((s) => s.estado === 'entregada').length}
            </div>
            <div className="text-sm text-green-600">Completadas</div>
          </div>
        </div>

        {/* Alerta de urgentes */}
        {contadorUrgentes > 0 && puedeAprobar && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-orange-800">
                {contadorUrgentes} {contadorUrgentes === 1 ? 'solicitud urgente' : 'solicitudes urgentes'} pendientes
              </h3>
              <p className="text-sm text-orange-700 mt-1">
                Hay solicitudes marcadas como urgentes o de alta prioridad esperando aprobación.
              </p>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por item, solicitante..."
            />
          </div>
          <div className="flex gap-2">
            <FilterPanel isOpen={filtersOpen} onToggle={() => setFiltersOpen(!filtersOpen)}>
              <FilterSelect
                label="Estado"
                value={filtroEstado}
                onChange={(v) => setFiltroEstado(v as EstadoSolicitudMaterial | 'todos')}
                options={ESTADOS_OPCIONES}
              />
              <FilterSelect
                label="Urgencia"
                value={filtroUrgencia}
                onChange={(v) => setFiltroUrgencia(v as UrgenciaMaterial | 'todos')}
                options={URGENCIA_OPCIONES}
              />
            </FilterPanel>
            <SortDropdown value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
          </div>
        </div>

        {/* Lista de solicitudes */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lavender-600" />
          </div>
        ) : solicitudesVisibles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || filtroEstado !== 'todos' || filtroUrgencia !== 'todos'
                ? 'No se encontraron solicitudes'
                : 'No hay solicitudes'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || filtroEstado !== 'todos' || filtroUrgencia !== 'todos'
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Crea una nueva solicitud para comenzar'}
            </p>
            <button
              onClick={() => setShowNuevaModal(true)}
              className="px-4 py-2 bg-lavender-600 hover:bg-lavender-700 text-white font-medium rounded-lg transition-colors"
            >
              + Nueva Solicitud
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {solicitudesVisibles.map((solicitud) => (
              <SolicitudMaterialCard
                key={solicitud.id}
                solicitud={solicitud}
                usuarioRol={userProfile?.rol || 'cuidador'}
                usuarioId={currentUser?.uid || ''}
                onVerDetalle={handleVerDetalle}
                onAprobar={puedeAprobar ? handleAprobar : undefined}
                onRechazar={puedeAprobar ? handleRechazar : undefined}
                onMarcarComprada={puedeAprobar ? handleMarcarComprada : undefined}
                onMarcarEntregada={puedeAprobar ? handleMarcarEntregada : undefined}
                onCancelar={handleCancelar}
                onEditar={handleEditar}
              />
            ))}
          </div>
        )}

        {/* Botón cargar más */}
        {hayMas && (
          <LoadMoreButton
            onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
            remaining={solicitudesFiltradas.length - visibleCount}
          />
        )}
      </div>

      {/* Modal Nueva/Editar Solicitud */}
      <NuevaSolicitudModal
        isOpen={showNuevaModal}
        onClose={() => {
          setShowNuevaModal(false);
          setSolicitudEditar(null);
        }}
        solicitudEditar={solicitudEditar}
        onCrear={async (datos) => {
          if (!currentUser || !userProfile) return;
          try {
            await crearSolicitud({
              ...datos,
              solicitadoPor: currentUser.uid,
              solicitadoPorNombre: userProfile.nombre,
              solicitadoPorRol: userProfile.rol,
            });
            showToast('Solicitud creada exitosamente', 'success');
            setShowNuevaModal(false);
          } catch (error) {
            showToast('Error al crear solicitud', 'error');
          }
        }}
        onEditar={async (datos) => {
          if (!solicitudEditar) return;
          try {
            await editarSolicitud(solicitudEditar.id, datos);
            showToast('Solicitud actualizada exitosamente', 'success');
            setShowNuevaModal(false);
            setSolicitudEditar(null);
          } catch (error) {
            showToast('Error al editar solicitud', 'error');
          }
        }}
      />

      {/* Modal Detalle */}
      <DetalleSolicitudModal
        isOpen={showDetalleModal}
        onClose={() => {
          setShowDetalleModal(false);
          setSolicitudSeleccionada(null);
        }}
        solicitud={solicitudSeleccionada}
        modo={modoDetalle}
        puedeAprobar={puedeAprobar}
        onConfirmar={handleConfirmarAccion}
      />
    </Layout>
  );
}
