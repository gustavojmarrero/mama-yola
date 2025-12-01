import { useState, useEffect, useMemo } from 'react';
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
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import Layout from '../components/common/Layout';
import SearchBar from '../components/common/SearchBar';
import FilterPanel, { FilterSelect, FilterCheckbox } from '../components/common/FilterPanel';
import SortDropdown from '../components/common/SortDropdown';
import LoadMoreButton from '../components/common/LoadMoreButton';
import {
  ItemInventario,
  MovimientoInventario,
  CategoriaInventario,
  TipoMovimiento,
  TipoInventarioAfectado,
} from '../types';
import { useAuth } from '../context/AuthContext';
import InventarioItemCard from '../components/inventarios/InventarioItemCard';
import ReporteDiferenciaModal from '../components/inventarios/ReporteDiferenciaModal';
import ReportesPendientesList from '../components/inventarios/ReportesPendientesList';
import { useReportesDiferencia } from '../hooks/useReportesDiferencia';

const PACIENTE_ID = 'paciente-principal';
const DIAS_ALERTA_VENCIMIENTO = 3;
const ITEMS_PER_PAGE = 10;

const SORT_OPTIONS = [
  { value: 'nombre_asc', label: 'Nombre A-Z' },
  { value: 'nombre_desc', label: 'Nombre Z-A' },
  { value: 'estado', label: 'Por estado' },
  { value: 'categoria', label: 'Por categoría' },
  { value: 'reciente', label: 'Más recientes' },
];

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
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'critico' | 'bajo' | 'ok'>('todos');
  const [filtroTipoConsumible, setFiltroTipoConsumible] = useState<'todos' | 'existencias' | 'duracion'>('todos');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Estados de búsqueda, filtros colapsables, ordenamiento y paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState('nombre_asc');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Control de permisos por rol
  const puedeEditar = userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor';
  const esCuidador = userProfile?.rol === 'cuidador';
  const puedeVerMaestro = !esCuidador; // Cuidadores NO pueden ver el inventario maestro
  const puedeResolverReportes = puedeEditar; // Solo familiar/supervisor pueden resolver

  // Hook de reportes de diferencias
  const {
    reportesPendientes,
    contadorPendientes,
    crearReporte,
    aprobarReporte,
    rechazarReporte,
  } = useReportesDiferencia();

  // Estados para reportes de diferencias
  const [showReporteDiferenciaModal, setShowReporteDiferenciaModal] = useState(false);
  const [showReportesPendientes, setShowReportesPendientes] = useState(false);
  const [itemParaReporte, setItemParaReporte] = useState<ItemInventario | null>(null);

  // Tipos de inventario permitidos según rol
  const tiposInventarioPermitidos: TipoInventarioAfectado[] = esCuidador
    ? ['transito', 'operativo']
    : ['maestro', 'transito', 'operativo'];

  // Función para mostrar toast
  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    // Auto-remover después de 3 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Funciones para cálculo de vida útil
  function calcularDiasRestantes(item: ItemInventario): number {
    if (!item.porcentajeDiario || item.porcentajeDiario === 0 || item.cantidadOperativo <= 0) return 0;
    // cantidadOperativo es el % restante (0-100), porcentajeDiario es los puntos % que se pierden cada día
    // Ej: 60% restante / 2.22% diario = ~27 días restantes
    return Math.ceil(item.cantidadOperativo / item.porcentajeDiario);
  }

  function calcularPorcentajeRestante(item: ItemInventario): number {
    if (!item.vidaUtilDias || !item.fechaInicioConsumo) return 100;
    const fechaInicio = item.fechaInicioConsumo instanceof Date
      ? item.fechaInicioConsumo
      : (item.fechaInicioConsumo as unknown as Timestamp).toDate();
    const diasTranscurridos = differenceInDays(new Date(), fechaInicio);
    const porcentaje = Math.max(0, 100 - (diasTranscurridos / item.vidaUtilDias * 100));
    return Math.round(porcentaje);
  }

  function itemPorAgotarse(item: ItemInventario): boolean {
    if (!item.tieneVidaUtil || !item.fechaInicioConsumo || item.cantidadOperativo <= 0) {
      return false;
    }
    const diasRestantes = calcularDiasRestantes(item);
    return diasRestantes <= DIAS_ALERTA_VENCIMIENTO && diasRestantes > 0;
  }

  // Items con alerta de vencimiento
  const itemsConAlerta = items.filter(itemPorAgotarse);

  const [formData, setFormData] = useState({
    nombre: '',
    categoria: 'medicamento' as CategoriaInventario,
    presentacion: '',
    cantidadMaestro: '' as string | number,
    cantidadTransito: '' as string | number,
    cantidadOperativo: '' as string | number,
    unidad: 'piezas',
    nivelMinimoMaestro: '' as string | number,
    nivelMinimoTransito: '' as string | number,
    nivelMinimoOperativo: '' as string | number,
    ubicacion: '',
    notas: '',
    // Vida útil
    tieneVidaUtil: false,
    vidaUtilDias: 0,
    // Vinculado a pastillero
    vinculadoPastillero: false,
  });

  const [movimientoForm, setMovimientoForm] = useState({
    itemId: '',
    tipo: 'entrada' as TipoMovimiento,
    destinoTransferencia: 'operativo' as 'transito' | 'operativo', // Para items con tránsito
    origenTransferencia: 'maestro' as 'maestro' | 'transito', // Origen de la transferencia
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
        const cantidadTransito = data.cantidadTransito ?? 0;
        const cantidadOperativo = data.cantidadOperativo ?? (data.tipo === 'operativo' ? data.cantidad : 0) ?? 0;
        const nivelMinimoMaestro = data.nivelMinimoMaestro ?? data.nivelMinimo ?? 5;
        const nivelMinimoTransito = data.nivelMinimoTransito ?? 7;
        const nivelMinimoOperativo = data.nivelMinimoOperativo ?? data.nivelMinimo ?? 5;

        itemsData.push({
          id: doc.id,
          pacienteId: data.pacienteId,
          nombre: data.nombre,
          categoria: data.categoria,
          cantidadMaestro,
          cantidadTransito,
          cantidadOperativo,
          presentacion: data.presentacion,
          vinculadoPastillero: data.vinculadoPastillero,
          medicamentoId: data.medicamentoId,
          // Vida útil
          tieneVidaUtil: data.tieneVidaUtil || false,
          vidaUtilDias: data.vidaUtilDias || 0,
          fechaInicioConsumo: data.fechaInicioConsumo?.toDate(),
          porcentajeDiario: data.porcentajeDiario || 0,
          unidad: data.unidad,
          nivelMinimoMaestro,
          nivelMinimoTransito,
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
    // Helper: convertir 0 a vacío para mejor UX en inputs numéricos
    const zeroToEmpty = (val: number | undefined) => (val === 0 || val === undefined) ? '' : val;

    if (item) {
      setEditando(item);
      setFormData({
        nombre: item.nombre,
        categoria: item.categoria,
        presentacion: item.presentacion || '',
        cantidadMaestro: zeroToEmpty(item.cantidadMaestro),
        cantidadTransito: zeroToEmpty(item.cantidadTransito),
        cantidadOperativo: zeroToEmpty(item.cantidadOperativo),
        unidad: item.unidad,
        nivelMinimoMaestro: zeroToEmpty(item.nivelMinimoMaestro),
        nivelMinimoTransito: zeroToEmpty(item.nivelMinimoTransito),
        nivelMinimoOperativo: zeroToEmpty(item.nivelMinimoOperativo),
        ubicacion: item.ubicacion || '',
        notas: item.notas || '',
        tieneVidaUtil: item.tieneVidaUtil || false,
        vidaUtilDias: zeroToEmpty(item.vidaUtilDias),
        vinculadoPastillero: item.vinculadoPastillero || false,
      });
    } else {
      setEditando(null);
      setFormData({
        nombre: '',
        categoria: 'medicamento',
        presentacion: '',
        cantidadMaestro: '',
        cantidadTransito: '',
        cantidadOperativo: '',
        unidad: 'piezas',
        nivelMinimoMaestro: '',
        nivelMinimoTransito: '',
        nivelMinimoOperativo: '',
        ubicacion: '',
        notas: '',
        tieneVidaUtil: false,
        vidaUtilDias: 0,
        vinculadoPastillero: false,
      });
    }
    setShowModal(true);
  }

  function cerrarModal() {
    setShowModal(false);
    setEditando(null);
  }

  function abrirMovimientoModal(item: ItemInventario, tipo: TipoMovimiento = 'entrada', destino: 'transito' | 'operativo' = 'operativo', origen: 'maestro' | 'transito' = 'maestro') {
    setMovimientoForm({
      itemId: item.id,
      tipo,
      destinoTransferencia: destino,
      origenTransferencia: origen,
      cantidad: 0,
      motivo: '',
      notas: '',
    });
    setShowMovimientoModal(true);
  }

  // Funciones para reportes de diferencias
  function abrirReporteDiferencia(item: ItemInventario) {
    setItemParaReporte(item);
    setShowReporteDiferenciaModal(true);
  }

  async function handleEnviarReporte(
    tipoInventario: TipoInventarioAfectado,
    cantidadReal: number,
    motivo: string
  ) {
    if (!itemParaReporte || !currentUser || !userProfile) return;

    await crearReporte(
      itemParaReporte,
      tipoInventario,
      cantidadReal,
      motivo,
      currentUser.uid,
      userProfile.nombre || currentUser.email || 'Usuario',
      userProfile.rol
    );

    showToast('Reporte de diferencia enviado correctamente', 'success');
    setShowReporteDiferenciaModal(false);
    setItemParaReporte(null);
  }

  async function handleAprobarReporte(
    reporteId: string,
    notas: string,
    ajustarInventario: boolean
  ) {
    if (!currentUser || !userProfile) return;

    await aprobarReporte(
      reporteId,
      notas,
      ajustarInventario,
      currentUser.uid,
      userProfile.nombre || currentUser.email || 'Usuario'
    );

    showToast(
      ajustarInventario
        ? 'Reporte aprobado y el inventario ha sido ajustado'
        : 'Reporte aprobado sin ajuste de inventario',
      'success'
    );
  }

  async function handleRechazarReporte(reporteId: string, notas: string) {
    if (!currentUser || !userProfile) return;

    await rechazarReporte(
      reporteId,
      notas,
      currentUser.uid,
      userProfile.nombre || currentUser.email || 'Usuario'
    );

    showToast('Reporte rechazado', 'info');
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
        cantidadMaestro: typeof formData.cantidadMaestro === 'number' ? formData.cantidadMaestro : 0,
        cantidadTransito: typeof formData.cantidadTransito === 'number' ? formData.cantidadTransito : 0,
        cantidadOperativo: typeof formData.cantidadOperativo === 'number' ? formData.cantidadOperativo : 0,
        unidad: formData.unidad,
        nivelMinimoMaestro: typeof formData.nivelMinimoMaestro === 'number' ? formData.nivelMinimoMaestro : 0,
        nivelMinimoTransito: typeof formData.nivelMinimoTransito === 'number' ? formData.nivelMinimoTransito : 7,
        nivelMinimoOperativo: typeof formData.nivelMinimoOperativo === 'number' ? formData.nivelMinimoOperativo : 0,
        vinculadoPastillero: formData.vinculadoPastillero,
        actualizadoEn: ahora,
      };

      // Agregar campos opcionales solo si tienen valor
      if (formData.presentacion) itemData.presentacion = formData.presentacion;
      if (formData.ubicacion) itemData.ubicacion = formData.ubicacion;
      if (formData.notas) itemData.notas = formData.notas;

      // Campos de vida útil
      itemData.tieneVidaUtil = formData.tieneVidaUtil;
      if (formData.tieneVidaUtil && formData.vidaUtilDias > 0) {
        itemData.vidaUtilDias = formData.vidaUtilDias;
        itemData.porcentajeDiario = 100 / formData.vidaUtilDias;

        // Si tiene vida útil y % operativo > 0, iniciar el conteo automáticamente
        const cantidadOp = typeof formData.cantidadOperativo === 'number' ? formData.cantidadOperativo : 0;
        if (cantidadOp > 0 && (!editando || !editando.fechaInicioConsumo)) {
          itemData.fechaInicioConsumo = ahora;
        }
      } else {
        itemData.vidaUtilDias = 0;
        itemData.porcentajeDiario = 0;
      }

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

    // Validar stock según tipo de movimiento y origen
    if (movimientoForm.tipo === 'salida' && movimientoForm.cantidad > item.cantidadOperativo) {
      showToast('No hay suficiente stock en el inventario operativo', 'error');
      return;
    }
    if (movimientoForm.tipo === 'transferencia') {
      if (movimientoForm.origenTransferencia === 'maestro' && movimientoForm.cantidad > item.cantidadMaestro) {
        showToast('No hay suficiente stock en el inventario maestro', 'error');
        return;
      }
      if (movimientoForm.origenTransferencia === 'transito' && movimientoForm.cantidad > item.cantidadTransito) {
        showToast('No hay suficiente stock en el inventario de tránsito', 'error');
        return;
      }
    }

    try {
      const ahora = Timestamp.now();

      // Calcular nuevas cantidades según tipo de movimiento
      let nuevaCantidadMaestro = item.cantidadMaestro;
      let nuevaCantidadTransito = item.cantidadTransito;
      let nuevaCantidadOperativo = item.cantidadOperativo;

      // Determinar origen y destino reales
      let origenReal = 'externo';
      let destinoReal = 'maestro';

      if (movimientoForm.tipo === 'entrada') {
        // Entrada: suma al maestro
        nuevaCantidadMaestro += movimientoForm.cantidad;
        origenReal = 'externo';
        destinoReal = 'maestro';
      } else if (movimientoForm.tipo === 'salida') {
        // Salida: resta del operativo
        nuevaCantidadOperativo -= movimientoForm.cantidad;
        origenReal = 'operativo';
        destinoReal = 'consumido';
      } else if (movimientoForm.tipo === 'transferencia') {
        // Transferencia con soporte para tránsito
        origenReal = movimientoForm.origenTransferencia;
        destinoReal = movimientoForm.destinoTransferencia;

        if (movimientoForm.origenTransferencia === 'maestro') {
          nuevaCantidadMaestro -= movimientoForm.cantidad;
          if (movimientoForm.destinoTransferencia === 'transito') {
            // Maestro → Tránsito
            nuevaCantidadTransito += movimientoForm.cantidad;
          } else {
            // Maestro → Operativo (comportamiento original para items sin tránsito)
            if (item.tieneVidaUtil) {
              nuevaCantidadOperativo = 100; // 100% al transferir
            } else {
              nuevaCantidadOperativo += movimientoForm.cantidad;
            }
          }
        } else if (movimientoForm.origenTransferencia === 'transito') {
          // Tránsito → Operativo
          nuevaCantidadTransito -= movimientoForm.cantidad;
          if (item.tieneVidaUtil) {
            nuevaCantidadOperativo = 100; // 100% al transferir
          } else {
            nuevaCantidadOperativo += movimientoForm.cantidad;
          }
        }
      } else if (movimientoForm.tipo === 'ajuste') {
        // Ajuste: se ajusta la cantidad del operativo (principal)
        nuevaCantidadOperativo = movimientoForm.cantidad;
        origenReal = 'operativo';
        destinoReal = 'operativo';
      }

      // Preparar actualización del item
      const updateData: Record<string, unknown> = {
        cantidadMaestro: nuevaCantidadMaestro,
        cantidadTransito: nuevaCantidadTransito,
        cantidadOperativo: nuevaCantidadOperativo,
        actualizadoEn: ahora,
      };

      // Si es transferencia al operativo y el item tiene vida útil, establecer fecha de inicio de consumo
      if (movimientoForm.tipo === 'transferencia' &&
          movimientoForm.destinoTransferencia === 'operativo' &&
          item.tieneVidaUtil && !item.fechaInicioConsumo) {
        updateData.fechaInicioConsumo = ahora;
      }

      // Actualizar item con las nuevas cantidades
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'inventario', item.id), updateData);

      // Crear registro de movimiento
      const movimientoData: Record<string, unknown> = {
        pacienteId: PACIENTE_ID,
        tipo: movimientoForm.tipo,
        itemId: item.id,
        itemNombre: item.nombre,
        origen: origenReal,
        destino: destinoReal,
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
    const cantidadTotal = item.cantidadMaestro + (item.cantidadTransito || 0) + item.cantidadOperativo;

    if (cantidadTotal === 0) return 'critico';
    // Verificar si alguno de los inventarios está bajo
    if (item.cantidadMaestro <= item.nivelMinimoMaestro || item.cantidadOperativo <= item.nivelMinimoOperativo) return 'bajo';
    // Verificar tránsito solo para items vinculados al pastillero
    if (item.vinculadoPastillero && (item.cantidadTransito || 0) <= (item.nivelMinimoTransito || 0)) return 'bajo';
    return 'ok';
  }

  function getEstadoColor(estado: string) {
    switch (estado) {
      case 'critico':
        return 'bg-red-100 text-red-800 border-red-200';
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
      case 'bajo':
        return '🟡 Bajo';
      default:
        return '🟢 OK';
    }
  }

  // Filtrar, buscar y ordenar items con useMemo
  const itemsFiltrados = useMemo(() => {
    let resultado = [...items];

    // Búsqueda por nombre
    if (searchTerm) {
      const termLower = searchTerm.toLowerCase();
      resultado = resultado.filter(
        (item) =>
          item.nombre.toLowerCase().includes(termLower) ||
          (item.presentacion && item.presentacion.toLowerCase().includes(termLower))
      );
    }

    // Filtro por categoría
    if (filtroCategoria !== 'todos') {
      resultado = resultado.filter((item) => item.categoria === filtroCategoria);
    }

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter((item) => getEstadoItem(item) === filtroEstado);
    }

    // Filtro por tipo de consumible (solo cuando categoría = consumible)
    if (filtroCategoria === 'consumible' && filtroTipoConsumible !== 'todos') {
      if (filtroTipoConsumible === 'existencias') {
        resultado = resultado.filter((item) => !item.tieneVidaUtil);
      } else if (filtroTipoConsumible === 'duracion') {
        resultado = resultado.filter((item) => item.tieneVidaUtil);
      }
    }

    // Ordenamiento
    resultado.sort((a, b) => {
      switch (sortBy) {
        case 'nombre_asc':
          return a.nombre.localeCompare(b.nombre);
        case 'nombre_desc':
          return b.nombre.localeCompare(a.nombre);
        case 'estado':
          const estadoOrder = { critico: 0, bajo: 1, ok: 2 };
          return (estadoOrder[getEstadoItem(a)] || 2) - (estadoOrder[getEstadoItem(b)] || 2);
        case 'categoria':
          return a.categoria.localeCompare(b.categoria);
        case 'reciente':
          return b.creadoEn.getTime() - a.creadoEn.getTime();
        default:
          return a.nombre.localeCompare(b.nombre);
      }
    });

    return resultado;
  }, [items, searchTerm, filtroCategoria, filtroEstado, filtroTipoConsumible, sortBy]);

  // Items visibles con paginación
  const itemsVisibles = itemsFiltrados.slice(0, visibleCount);
  const hasMore = visibleCount < itemsFiltrados.length;

  // Contar filtros activos
  const activeFiltersCount = [
    filtroCategoria !== 'todos',
    filtroEstado !== 'todos',
    filtroTipoConsumible !== 'todos',
  ].filter(Boolean).length;

  // Resetear paginación cuando cambian filtros
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchTerm, filtroCategoria, filtroEstado, filtroTipoConsumible, sortBy]);

  function handleLoadMore() {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  }

  function handleClearFilters() {
    setFiltroCategoria('todos');
    setFiltroEstado('todos');
    setFiltroTipoConsumible('todos');
  }

  // Alertas
  const itemsCriticos = items.filter((i) => getEstadoItem(i) === 'critico');
  const itemsBajos = items.filter((i) => getEstadoItem(i) === 'bajo');

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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">📦 Control de Inventarios</h1>
              {!puedeEditar && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  👁️ Modo lectura
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-2">Gestiona los suministros del paciente</p>
          </div>

          {/* Alertas */}
          {(itemsCriticos.length > 0 || itemsBajos.length > 0) && (
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
                        {item.nombre}: {puedeVerMaestro && `M:${item.cantidadMaestro} `}O:{item.tieneVidaUtil ? `${Math.round(item.cantidadOperativo)}%` : `${item.cantidadOperativo} ${item.unidad}`}
                      </span>
                    ))}
                    {itemsBajos.length > 5 && (
                      <span className="text-sm text-yellow-700">+{itemsBajos.length - 5} más</span>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Barra de herramientas: Búsqueda, Filtros, Ordenamiento */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por nombre o presentación..."
              className="flex-1 max-w-md"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <FilterPanel
                isOpen={filtersOpen}
                onToggle={() => setFiltersOpen(!filtersOpen)}
                activeFiltersCount={activeFiltersCount}
                onClear={handleClearFilters}
              >
                <FilterSelect
                  label="Categoría"
                  value={filtroCategoria}
                  onChange={(v) => setFiltroCategoria(v as CategoriaInventario | 'todos')}
                  options={[
                    { value: 'todos', label: 'Todas' },
                    ...categorias.map((cat) => ({ value: cat.value, label: `${cat.icon} ${cat.label}` })),
                  ]}
                />
                <FilterSelect
                  label="Estado"
                  value={filtroEstado}
                  onChange={(v) => setFiltroEstado(v as 'todos' | 'critico' | 'bajo' | 'ok')}
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'critico', label: 'Crítico' },
                    { value: 'bajo', label: 'Bajo' },
                    { value: 'ok', label: 'OK' },
                  ]}
                />
                {filtroCategoria === 'consumible' && (
                  <FilterSelect
                    label="Tipo"
                    value={filtroTipoConsumible}
                    onChange={(v) => setFiltroTipoConsumible(v as 'todos' | 'existencias' | 'duracion')}
                    options={[
                      { value: 'todos', label: 'Todos' },
                      { value: 'existencias', label: 'Por existencias' },
                      { value: 'duracion', label: 'Por duración' },
                    ]}
                  />
                )}
              </FilterPanel>
              <SortDropdown value={sortBy} options={SORT_OPTIONS} onChange={setSortBy} />
              <button
                onClick={() => setShowHistorialModal(true)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                Movimientos
              </button>
              <button
                onClick={() => setShowReportesPendientes(true)}
                className="relative px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 text-sm font-medium rounded-lg transition-colors"
              >
                Reportes
                {contadorPendientes > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {contadorPendientes}
                  </span>
                )}
              </button>
              {puedeEditar && (
                <button
                  onClick={() => abrirModal()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  + Nuevo
                </button>
              )}
            </div>
          </div>

          {/* Alerta de items por agotarse (vida útil) */}
          {itemsConAlerta.length > 0 && (
            <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <h3 className="font-medium text-orange-800 flex items-center gap-2">
                <span>⚠️</span>
                {itemsConAlerta.length} item(s) por agotarse en los próximos {DIAS_ALERTA_VENCIMIENTO} días
              </h3>
              <ul className="mt-2 space-y-1">
                {itemsConAlerta.map(item => (
                  <li key={item.id} className="text-sm text-orange-700">
                    • {item.nombre}: {calcularDiasRestantes(item)} días restantes
                    ({Math.round(item.cantidadOperativo)}% restante)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Vista móvil - Cards */}
          <div className="md:hidden space-y-4">
            {itemsVisibles.map((item) => (
              <InventarioItemCard
                key={item.id}
                item={item}
                puedeEditar={puedeEditar}
                puedeVerMaestro={puedeVerMaestro}
                categorias={categorias}
                onMovimiento={abrirMovimientoModal}
                onEditar={abrirModal}
                onReportarDiferencia={abrirReporteDiferencia}
                getEstadoItem={getEstadoItem}
                getEstadoColor={getEstadoColor}
                getEstadoLabel={getEstadoLabel}
                calcularDiasRestantes={calcularDiasRestantes}
                itemPorAgotarse={itemPorAgotarse}
              />
            ))}
            {itemsFiltrados.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-500 text-lg">No hay items en el inventario</p>
                {puedeEditar && (
                  <button
                    onClick={() => abrirModal()}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    + Agregar primer item
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Vista desktop - Tabla */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  {puedeVerMaestro && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      🏪 Maestro
                    </th>
                  )}
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    📦 Tránsito
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    💊 Operativo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {itemsVisibles.map((item) => {
                  const estado = getEstadoItem(item);
                  const catInfo = categorias.find((c) => c.value === item.categoria);
                  const porAgotarse = itemPorAgotarse(item);
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 ${porAgotarse ? 'bg-orange-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">{catInfo?.icon}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {item.nombre}
                              {item.tieneVidaUtil && item.vidaUtilDias && (
                                <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                                  {item.vidaUtilDias}d
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {item.presentacion && `${item.presentacion}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      {puedeVerMaestro && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm text-gray-900 font-semibold">
                            {item.cantidadMaestro} {item.unidad}
                          </div>
                          <div className="text-xs text-gray-500">
                            Mín: {item.nivelMinimoMaestro}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {item.vinculadoPastillero ? (
                          <div>
                            <div className={`text-sm font-semibold ${(item.cantidadTransito || 0) <= (item.nivelMinimoTransito || 0) ? 'text-orange-600' : 'text-blue-600'}`}>
                              {item.cantidadTransito || 0} {item.unidad}
                            </div>
                            <div className="text-xs text-gray-500">
                              Mín: {item.nivelMinimoTransito || 7}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {item.tieneVidaUtil ? (
                          <div>
                            <div className={`text-lg font-bold ${itemPorAgotarse(item) ? 'text-orange-600' : 'text-purple-600'}`}>
                              {Math.round(item.cantidadOperativo)}%
                            </div>
                            <div className="mt-1">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${itemPorAgotarse(item) ? 'bg-orange-500' : 'bg-purple-600'}`}
                                  style={{ width: `${Math.min(100, item.cantidadOperativo)}%` }}
                                ></div>
                              </div>
                            </div>
                            {item.fechaInicioConsumo ? (
                              <div className={`text-xs mt-1 ${itemPorAgotarse(item) ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                                {calcularDiasRestantes(item)} días restantes
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 italic mt-1">
                                Sin iniciar
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm text-gray-900 font-semibold">
                              {item.cantidadOperativo} {item.unidad}
                            </div>
                            <div className="text-xs text-gray-500">
                              Mín: {item.nivelMinimoOperativo}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${getEstadoColor(estado)}`}
                        >
                          {getEstadoLabel(estado)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium group">
                        {puedeEditar ? (
                          <div className="flex justify-end gap-1 flex-wrap items-center">
                            {/* Entrada - Solo si puede ver maestro */}
                            {puedeVerMaestro && (
                              <button
                                onClick={() => abrirMovimientoModal(item, 'entrada')}
                                className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs rounded transition-colors"
                                title="Entrada (Compra al Maestro)"
                              >
                                ➕
                              </button>
                            )}
                            {item.vinculadoPastillero ? (
                              <>
                                {/* M→T - Solo si puede ver maestro */}
                                {puedeVerMaestro && (
                                  <button
                                    onClick={() => abrirMovimientoModal(item, 'transferencia', 'transito', 'maestro')}
                                    className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition-colors"
                                    title="Maestro → Tránsito"
                                  >
                                    M→T
                                  </button>
                                )}
                                {/* T→O - Visible para todos */}
                                <button
                                  onClick={() => abrirMovimientoModal(item, 'transferencia', 'operativo', 'transito')}
                                  className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs rounded transition-colors"
                                  title="Tránsito → Operativo (Cargar Pastillero)"
                                >
                                  T→O
                                </button>
                              </>
                            ) : (
                              /* Transferir M→O - Solo si puede ver maestro */
                              puedeVerMaestro && (
                                <button
                                  onClick={() => abrirMovimientoModal(item, 'transferencia', 'operativo', 'maestro')}
                                  className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition-colors"
                                  title="Transferir de Maestro a Operativo"
                                >
                                  ↔️
                                </button>
                              )
                            )}
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
                            <button
                              onClick={() => abrirReporteDiferencia(item)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs rounded"
                              title="Reportar diferencia de inventario"
                            >
                              Diferencia
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 items-center">
                            <span className="text-gray-400 text-xs italic">Solo lectura</span>
                            <button
                              onClick={() => abrirReporteDiferencia(item)}
                              className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs rounded transition-colors"
                              title="Reportar diferencia de inventario"
                            >
                              Diferencia
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {itemsFiltrados.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No hay items en el inventario</p>
                {puedeEditar && (
                  <button
                    onClick={() => abrirModal()}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    + Agregar primer item
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Paginación Load More */}
          {!loading && itemsFiltrados.length > 0 && (
            <LoadMoreButton
              onClick={handleLoadMore}
              hasMore={hasMore}
              loadedCount={itemsVisibles.length}
              totalCount={itemsFiltrados.length}
              itemsPerLoad={ITEMS_PER_PAGE}
            />
          )}
        </div>
      </div>

      {/* Modal crear/editar item */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-lg rounded-t-2xl shadow-xl max-h-[92vh] sm:max-h-[85vh] flex flex-col animate-slide-up sm:animate-scale-in">
            {/* Handle móvil */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10 rounded-t-2xl sm:rounded-t-lg">
              <h2 className="text-2xl font-bold text-gray-900">
                {editando ? 'Editar Item' : 'Nuevo Item'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
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
                        step="0.01"
                        value={formData.cantidadMaestro}
                        onChange={(e) => setFormData({ ...formData, cantidadMaestro: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: 10"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nivel Mínimo Maestro</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.nivelMinimoMaestro}
                        onChange={(e) => setFormData({ ...formData, nivelMinimoMaestro: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: 5"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección Tránsito - Solo si está vinculado al pastillero */}
                {formData.vinculadoPastillero && (
                  <div className="md:col-span-2 bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-medium text-orange-800 mb-3">📦 Inventario Tránsito (Cuidadora)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad Tránsito</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={formData.cantidadTransito}
                          onChange={(e) => setFormData({ ...formData, cantidadTransito: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="Ej: 14"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nivel Mínimo Tránsito</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={formData.nivelMinimoTransito}
                          onChange={(e) => setFormData({ ...formData, nivelMinimoTransito: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="Ej: 7"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-orange-600 mt-2">
                      Stock disponible para la cuidadora. Nivel mínimo típico: 1 semana de dosis.
                    </p>
                  </div>
                )}

                {/* Sección Operativo */}
                <div className={`md:col-span-2 p-4 rounded-lg ${formData.categoria === 'consumible' && formData.tieneVidaUtil ? 'bg-purple-50' : 'bg-green-50'}`}>
                  <h4 className={`font-medium mb-3 ${formData.categoria === 'consumible' && formData.tieneVidaUtil ? 'text-purple-800' : 'text-green-800'}`}>
                    {formData.categoria === 'consumible' && formData.tieneVidaUtil ? '⏳ Consumo por Vida Útil' : '📋 Inventario Operativo'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {formData.categoria === 'consumible' && formData.tieneVidaUtil ? '% Restante' : 'Cantidad Operativo'}
                      </label>
                      {formData.categoria === 'consumible' && formData.tieneVidaUtil ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={formData.cantidadOperativo}
                            onChange={(e) => setFormData({ ...formData, cantidadOperativo: e.target.value === '' ? '' : Math.min(100, Math.max(0, parseFloat(e.target.value))) })}
                            className="w-24 px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-center font-bold text-purple-700"
                            placeholder="100"
                          />
                          <span className="text-purple-700 font-medium">%</span>
                          {typeof formData.cantidadOperativo === 'number' && formData.cantidadOperativo > 0 && (
                            <div className="flex-1 ml-2">
                              <div className="w-full bg-purple-200 rounded-full h-3">
                                <div
                                  className="bg-purple-600 h-3 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, formData.cantidadOperativo)}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.cantidadOperativo}
                          onChange={(e) => setFormData({ ...formData, cantidadOperativo: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: 5"
                        />
                      )}
                    </div>
                    {!(formData.categoria === 'consumible' && formData.tieneVidaUtil) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nivel Mínimo Operativo</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.nivelMinimoOperativo}
                          onChange={(e) => setFormData({ ...formData, nivelMinimoOperativo: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: 3"
                        />
                      </div>
                    )}
                  </div>
                  {formData.categoria === 'consumible' && formData.tieneVidaUtil && (
                    <p className="text-xs text-purple-600 mt-2">
                      Ingresa el porcentaje restante del producto (0-100%). Al transferir de maestro, inicia en 100%.
                    </p>
                  )}
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

                {/* Vida Útil - Solo para consumibles */}
                {formData.categoria === 'consumible' && (
                  <div className="md:col-span-2 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="checkbox"
                        id="tieneVidaUtil"
                        checked={formData.tieneVidaUtil}
                        onChange={(e) => setFormData({ ...formData, tieneVidaUtil: e.target.checked })}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <label htmlFor="tieneVidaUtil" className="text-sm font-medium text-purple-900">
                        Tiene vida útil (se consume automáticamente con el tiempo)
                      </label>
                    </div>

                    {formData.tieneVidaUtil && (
                      <div className="ml-7 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-purple-800 mb-1">
                            Duración en días
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formData.vidaUtilDias || ''}
                            onChange={(e) => setFormData({ ...formData, vidaUtilDias: parseInt(e.target.value) || 0 })}
                            placeholder="Ej: 45"
                            className="w-32 px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        {formData.vidaUtilDias > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm text-purple-700">
                              Se descontará <strong>{(100 / formData.vidaUtilDias).toFixed(2)}%</strong> diario
                              del inventario operativo.
                            </p>
                            {typeof formData.cantidadOperativo === 'number' && formData.cantidadOperativo > 0 && (
                              <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200">
                                <h4 className="text-sm font-medium text-purple-800 mb-2">📊 Info de Consumo Actual</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-purple-600">Descuento diario:</span>
                                    <span className="ml-1 font-medium">
                                      {(100 / formData.vidaUtilDias).toFixed(2)}%
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-purple-600">Días restantes:</span>
                                    <span className="ml-1 font-medium">~{Math.ceil(formData.cantidadOperativo / (100 / formData.vidaUtilDias))}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
      {showMovimientoModal && (() => {
        const itemActual = items.find((i) => i.id === movimientoForm.itemId);
        const esTransferencia = movimientoForm.tipo === 'transferencia';
        const flujoTexto = esTransferencia
          ? `${movimientoForm.origenTransferencia === 'maestro' ? '🏪 Maestro' : '📦 Tránsito'} → ${movimientoForm.destinoTransferencia === 'transito' ? '📦 Tránsito' : '💊 Operativo'}`
          : '';

        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Registrar Movimiento</h2>
              {esTransferencia && (
                <p className="text-sm text-blue-600 mt-1 font-medium">{flujoTexto}</p>
              )}
            </div>

            <form onSubmit={handleMovimiento} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item: <strong>{itemActual?.nombre}</strong>
                </label>
                {itemActual && esTransferencia && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <div className={`grid ${puedeVerMaestro ? 'grid-cols-3' : (itemActual.vinculadoPastillero ? 'grid-cols-2' : 'grid-cols-1')} gap-2 text-center`}>
                      {puedeVerMaestro && (
                        <div>
                          <div className="text-xs text-gray-500">🏪 Maestro</div>
                          <div className="font-semibold">{itemActual.cantidadMaestro}</div>
                        </div>
                      )}
                      {itemActual.vinculadoPastillero && (
                        <div>
                          <div className="text-xs text-gray-500">📦 Tránsito</div>
                          <div className="font-semibold text-blue-600">{itemActual.cantidadTransito || 0}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-gray-500">💊 Operativo</div>
                        <div className="font-semibold">{itemActual.cantidadOperativo}</div>
                      </div>
                    </div>
                  </div>
                )}
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
                  <option value="transferencia">↔️ Transferencia {flujoTexto}</option>
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
                  step="0.01"
                  value={movimientoForm.cantidad || ''}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, cantidad: parseFloat(e.target.value) || 0 })}
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
        );
      })()}

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
                                  : mov.tipo === 'consumo_automatico'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {mov.tipo === 'consumo_automatico' ? '⏳ Auto' : mov.tipo.charAt(0).toUpperCase() + mov.tipo.slice(1)}
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

      {/* Modal de Reporte de Diferencia */}
      {showReporteDiferenciaModal && itemParaReporte && (
        <ReporteDiferenciaModal
          isOpen={showReporteDiferenciaModal}
          onClose={() => {
            setShowReporteDiferenciaModal(false);
            setItemParaReporte(null);
          }}
          item={itemParaReporte}
          tiposPermitidos={tiposInventarioPermitidos}
          onEnviar={handleEnviarReporte}
        />
      )}

      {/* Modal de Reportes Pendientes */}
      {showReportesPendientes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Reportes de Diferencias Pendientes
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {contadorPendientes} reporte(s) requieren revisión
                  </p>
                </div>
                <button
                  onClick={() => setShowReportesPendientes(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6">
              <ReportesPendientesList
                reportes={reportesPendientes}
                puedeResolver={puedeResolverReportes}
                onAprobar={handleAprobarReporte}
                onRechazar={handleRechazarReporte}
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
