import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Medicamento, RegistroMedicamento, EstadoMedicamento, DosisDelDia, ItemSolicitudReposicion, UrgenciaSolicitud } from '../types';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import ViewToggle from '../components/common/ViewToggle';
import SearchBar from '../components/common/SearchBar';
import FilterPanel, { FilterSelect } from '../components/common/FilterPanel';
import SortDropdown from '../components/common/SortDropdown';
import LoadMoreButton from '../components/common/LoadMoreButton';
import DosisCard from '../components/pastillero/DosisCard';
import HistorialCard from '../components/pastillero/HistorialCard';
import TransitoPanel from '../components/transito/TransitoPanel';
import RellenarPastilleroModal from '../components/pastillero/RellenarPastilleroModal';
import SolicitudReposicionModal from '../components/transito/SolicitudReposicionModal';
import { useTransito } from '../hooks/useTransito';

const PACIENTE_ID = 'paciente-principal';
const ITEMS_PER_PAGE = 10;

// Interfaz para agrupar dosis por horario
interface GrupoHorario {
  horario: string;
  dosis: DosisDelDia[];
  todasPendientes: boolean;
  todasRegistradas: boolean;
  algunaRetrasada: boolean;
  pendientesCount: number;
}

const SORT_OPTIONS_HOY = [
  { value: 'horario_asc', label: 'Horario (temprano primero)' },
  { value: 'horario_desc', label: 'Horario (tarde primero)' },
  { value: 'nombre_asc', label: 'Nombre A-Z' },
  { value: 'estado', label: 'Por estado' },
];

const SORT_OPTIONS_HISTORIAL = [
  { value: 'fecha_desc', label: 'Más recientes' },
  { value: 'fecha_asc', label: 'Más antiguos' },
  { value: 'nombre_asc', label: 'Nombre A-Z' },
  { value: 'estado', label: 'Por estado' },
];

export default function PastilleroDiario() {
  const { currentUser: usuario, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  // Hook de tránsito
  const {
    itemsTransito,
    loading: loadingTransito,
    crearSolicitudReposicion,
    registrarCargaPastillero,
    recargarDatos: recargarTransito,
  } = useTransito();

  // Estados para modales de tránsito
  const [showRellenarModal, setShowRellenarModal] = useState(false);
  const [showSolicitudModal, setShowSolicitudModal] = useState(false);

  /**
   * Descuenta 1 unidad del inventario operativo cuando se toma un medicamento
   */
  async function descontarInventarioMedicamento(
    medicamentoId: string,
    medicamentoNombre: string
  ): Promise<void> {
    try {
      // Buscar item de inventario vinculado a este medicamento
      const qInventario = query(
        collection(db, 'pacientes', PACIENTE_ID, 'inventario'),
        where('medicamentoId', '==', medicamentoId)
      );
      const snapshot = await getDocs(qInventario);

      if (snapshot.empty) {
        console.log(`No hay item de inventario vinculado al medicamento ${medicamentoNombre}`);
        return;
      }

      const itemDoc = snapshot.docs[0];
      const item = itemDoc.data();
      const nuevaCantidadOperativo = Math.max(0, (item.cantidadOperativo || 0) - 1);
      const ahora = Timestamp.now();

      // Actualizar cantidad en inventario
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'inventario', itemDoc.id), {
        cantidadOperativo: nuevaCantidadOperativo,
        actualizadoEn: ahora,
      });

      // Registrar movimiento de salida
      await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'movimientosInventario'), {
        pacienteId: PACIENTE_ID,
        tipo: 'salida',
        itemId: itemDoc.id,
        itemNombre: item.nombre,
        origen: 'operativo',
        destino: 'consumido',
        cantidad: 1,
        motivo: 'Consumo pastillero diario',
        usuarioId: usuario?.uid || '',
        usuarioNombre: userProfile?.nombre || 'Usuario',
        fecha: ahora,
        creadoEn: ahora,
      });

      console.log(`Descontado 1 unidad de ${item.nombre} del inventario operativo`);
    } catch (error) {
      console.error('Error al descontar inventario:', error);
    }
  }
  const [dosisDelDia, setDosisDelDia] = useState<DosisDelDia[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [dosisSeleccionada, setDosisSeleccionada] = useState<DosisDelDia | null>(null);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<EstadoMedicamento>('tomado');
  const [notas, setNotas] = useState('');
  const [vistaActual, setVistaActual] = useState<'hoy' | 'historial'>('hoy');
  const [historialRegistros, setHistorialRegistros] = useState<RegistroMedicamento[]>([]);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [filtroMedicamento, setFiltroMedicamento] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [vista, setVista] = useState<'grid' | 'list'>('list');

  // Estados de búsqueda, filtros colapsables, ordenamiento y paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersOpenHoy, setFiltersOpenHoy] = useState(false);
  const [filtersOpenHistorial, setFiltersOpenHistorial] = useState(false);
  const [sortByHoy, setSortByHoy] = useState('estado');
  const [sortByHistorial, setSortByHistorial] = useState('fecha_desc');
  const [filtroEstadoHoy, setFiltroEstadoHoy] = useState<string>('todos');
  const [visibleCountHoy, setVisibleCountHoy] = useState(ITEMS_PER_PAGE);
  const [visibleCountHistorial, setVisibleCountHistorial] = useState(ITEMS_PER_PAGE);

  // Estados para registro masivo por horario
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<GrupoHorario | null>(null);
  const [modalGrupoAbierto, setModalGrupoAbierto] = useState(false);

  useEffect(() => {
    cargarDosisDelDia();
  }, []);

  async function cargarDosisDelDia() {
    try {
      setLoading(true);

      // Obtener medicamentos activos
      const qMeds = query(
        collection(db, 'pacientes', PACIENTE_ID, 'medicamentos'),
        where('activo', '==', true)
      );
      const medSnapshot = await getDocs(qMeds);
      const medicamentosActivos: Medicamento[] = [];

      medSnapshot.forEach((doc) => {
        const data = doc.data();
        medicamentosActivos.push({
          id: doc.id,
          ...data,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Medicamento);
      });

      setMedicamentos(medicamentosActivos);

      // Obtener registros del día
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      const qRegs = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', hoy),
        where('fechaHoraProgramada', '<', manana)
      );
      const regSnapshot = await getDocs(qRegs);
      const registrosMap = new Map<string, RegistroMedicamento>();

      regSnapshot.forEach((doc) => {
        const data = doc.data();
        const registro: RegistroMedicamento = {
          id: doc.id,
          ...data,
          fechaHoraProgramada: data.fechaHoraProgramada?.toDate() || new Date(),
          fechaHoraReal: data.fechaHoraReal?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
        } as RegistroMedicamento;
        const key = `${registro.medicamentoId}-${data.horario}`;
        registrosMap.set(key, registro);
      });

      // Generar dosis del día
      const dosis: DosisDelDia[] = [];
      const ahora = new Date();

      for (const med of medicamentosActivos) {
        // Verificar si hoy es un día válido para este medicamento
        const diaHoy = hoy.getDay();
        // Si tiene días específicos configurados (array no vacío), verificar si hoy es uno de esos días
        // Si diasSemana está vacío o undefined, significa "todos los días"
        if (
          med.frecuencia.tipo === 'dias_especificos' &&
          med.frecuencia.diasSemana &&
          med.frecuencia.diasSemana.length > 0 &&
          !med.frecuencia.diasSemana.includes(diaHoy)
        ) {
          continue;
        }

        for (const horario of med.horarios) {
          const [hora, minuto] = horario.split(':').map(Number);
          const fechaHoraProgramada = new Date(hoy);
          fechaHoraProgramada.setHours(hora, minuto, 0, 0);

          const key = `${med.id}-${horario}`;
          const registro = registrosMap.get(key);

          // Calcular retraso si es necesario
          let retrasoMinutos: number | undefined;
          if (!registro && ahora > fechaHoraProgramada) {
            retrasoMinutos = Math.floor((ahora.getTime() - fechaHoraProgramada.getTime()) / 60000);
          }

          dosis.push({
            medicamento: med,
            horario,
            registro,
            retrasoMinutos,
          });
        }
      }

      // Ordenar por horario
      dosis.sort((a, b) => a.horario.localeCompare(b.horario));
      setDosisDelDia(dosis);
    } catch (error) {
      console.error('Error cargando dosis del día:', error);
      alert('Error al cargar medicamentos del día');
    } finally {
      setLoading(false);
    }
  }

  async function cargarHistorial() {
    try {
      setLoading(true);

      // Obtener registros de los últimos 30 días
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      hace30Dias.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', hace30Dias),
        orderBy('fechaHoraProgramada', 'desc')
      );

      const snapshot = await getDocs(q);
      const registros: RegistroMedicamento[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        registros.push({
          id: doc.id,
          ...data,
          fechaHoraProgramada: data.fechaHoraProgramada?.toDate() || new Date(),
          fechaHoraReal: data.fechaHoraReal?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
        } as RegistroMedicamento);
      });

      setHistorialRegistros(registros);
    } catch (error) {
      console.error('Error cargando historial:', error);
      alert('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }

  async function abrirModal(dosis: DosisDelDia) {
    setDosisSeleccionada(dosis);
    setEstadoSeleccionado('tomado');
    setNotas('');
    setModalAbierto(true);
  }

  // Abrir modal para registro masivo de un grupo
  function abrirModalGrupo(grupo: GrupoHorario) {
    setGrupoSeleccionado(grupo);
    setEstadoSeleccionado('tomado');
    setNotas('');
    setModalGrupoAbierto(true);
  }

  // Registrar todas las dosis pendientes de un grupo
  async function registrarGrupoHorario() {
    if (!grupoSeleccionado || !usuario) return;

    const dosisPendientes = grupoSeleccionado.dosis.filter(d => !d.registro);
    if (dosisPendientes.length === 0) return;

    try {
      setLoading(true);
      const ahora = new Date();

      for (const dosis of dosisPendientes) {
        const [hora, minuto] = dosis.horario.split(':').map(Number);
        const fechaHoraProgramada = new Date();
        fechaHoraProgramada.setHours(hora, minuto, 0, 0);

        const registroData: Record<string, unknown> = {
          pacienteId: PACIENTE_ID,
          medicamentoId: dosis.medicamento.id,
          medicamentoNombre: dosis.medicamento.nombre,
          fechaHoraProgramada,
          estado: estadoSeleccionado,
          administradoPor: usuario.uid,
          horario: dosis.horario,
          creadoEn: ahora,
        };

        if (estadoSeleccionado === 'tomado') {
          registroData.fechaHoraReal = ahora;
          registroData.retrasoMinutos = Math.floor(
            (ahora.getTime() - fechaHoraProgramada.getTime()) / 60000
          );
        }
        if (notas) {
          registroData.notas = notas;
        }

        await addDoc(
          collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
          registroData
        );

        // Descontar del inventario si fue tomado
        if (estadoSeleccionado === 'tomado') {
          await descontarInventarioMedicamento(dosis.medicamento.id, dosis.medicamento.nombre);
        }
      }

      alert(`${dosisPendientes.length} medicamentos registrados exitosamente`);
      setModalGrupoAbierto(false);
      setGrupoSeleccionado(null);
      setNotas('');
      cargarDosisDelDia();
    } catch (error) {
      console.error('Error registrando grupo:', error);
      alert('Error al registrar medicamentos');
    } finally {
      setLoading(false);
    }
  }

  async function registrarAdministracion() {
    if (!dosisSeleccionada || !usuario) return;

    try {
      setLoading(true);

      const ahora = new Date();
      const [hora, minuto] = dosisSeleccionada.horario.split(':').map(Number);
      const fechaHoraProgramada = new Date();
      fechaHoraProgramada.setHours(hora, minuto, 0, 0);

      // Construir objeto sin valores undefined (Firebase no los acepta)
      const registroData: Record<string, unknown> = {
        pacienteId: PACIENTE_ID,
        medicamentoId: dosisSeleccionada.medicamento.id,
        medicamentoNombre: dosisSeleccionada.medicamento.nombre,
        fechaHoraProgramada,
        estado: estadoSeleccionado,
        administradoPor: usuario.uid,
        horario: dosisSeleccionada.horario,
        creadoEn: ahora,
      };

      // Solo agregar campos opcionales si tienen valor
      if (estadoSeleccionado === 'tomado') {
        registroData.fechaHoraReal = ahora;
        registroData.retrasoMinutos = Math.floor((ahora.getTime() - fechaHoraProgramada.getTime()) / 60000);
      }
      if (notas) {
        registroData.notas = notas;
      }

      if (dosisSeleccionada.registro) {
        // Actualizar registro existente
        const regRef = doc(
          db,
          'pacientes',
          PACIENTE_ID,
          'registroMedicamentos',
          dosisSeleccionada.registro.id
        );
        await updateDoc(regRef, {
          ...registroData,
          actualizadoEn: ahora,
        });
      } else {
        // Crear nuevo registro
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'), registroData);
      }

      // Descontar del inventario si el medicamento fue tomado
      if (estadoSeleccionado === 'tomado') {
        await descontarInventarioMedicamento(
          dosisSeleccionada.medicamento.id,
          dosisSeleccionada.medicamento.nombre
        );
      }

      alert('Administración registrada exitosamente');
      setModalAbierto(false);
      setDosisSeleccionada(null);
      setNotas('');
      cargarDosisDelDia();
    } catch (error) {
      console.error('Error registrando administración:', error);
      alert('Error al registrar administración');
    } finally {
      setLoading(false);
    }
  }

  // Handler para rellenar pastillero
  async function handleRellenarPastillero(items: Array<{ itemId: string; cantidad: number }>) {
    if (!usuario) return;
    await registrarCargaPastillero(items, usuario.uid, userProfile?.nombre || 'Usuario');
  }

  // Handler para solicitar reposición
  async function handleSolicitarReposicion(
    items: ItemSolicitudReposicion[],
    notas: string,
    urgencia: UrgenciaSolicitud
  ) {
    if (!usuario) return;
    await crearSolicitudReposicion(items, notas, urgencia, usuario.uid, userProfile?.nombre || 'Usuario');
  }

  // Lógica de filtrado y ordenamiento para Vista Hoy
  const dosisFiltradas = useMemo(() => {
    let resultado = [...dosisDelDia];

    // Búsqueda por nombre de medicamento
    if (searchTerm) {
      const termLower = searchTerm.toLowerCase();
      resultado = resultado.filter(
        (dosis) =>
          dosis.medicamento.nombre.toLowerCase().includes(termLower) ||
          dosis.medicamento.dosis.toLowerCase().includes(termLower)
      );
    }

    // Filtro por estado
    if (filtroEstadoHoy !== 'todos') {
      resultado = resultado.filter((dosis) => {
        if (filtroEstadoHoy === 'pendiente') return !dosis.registro;
        if (filtroEstadoHoy === 'tomado') return dosis.registro?.estado === 'tomado';
        if (filtroEstadoHoy === 'rechazado') return dosis.registro?.estado === 'rechazado';
        if (filtroEstadoHoy === 'omitido') return dosis.registro?.estado === 'omitido';
        return true;
      });
    }

    // Ordenamiento
    resultado.sort((a, b) => {
      switch (sortByHoy) {
        case 'horario_asc':
          return a.horario.localeCompare(b.horario);
        case 'horario_desc':
          return b.horario.localeCompare(a.horario);
        case 'nombre_asc':
          return a.medicamento.nombre.localeCompare(b.medicamento.nombre);
        case 'estado': {
          // Pendientes primero (sin registro = 0), registrados después (1)
          const getEstadoOrder = (d: DosisDelDia) => (!d.registro ? 0 : 1);
          const estadoA = getEstadoOrder(a);
          const estadoB = getEstadoOrder(b);
          if (estadoA !== estadoB) return estadoA - estadoB;
          // Dentro del mismo grupo, ordenar por horario (más antiguo primero)
          return a.horario.localeCompare(b.horario);
        }
        default:
          return a.horario.localeCompare(b.horario);
      }
    });

    return resultado;
  }, [dosisDelDia, searchTerm, filtroEstadoHoy, sortByHoy]);

  // Agrupar dosis por horario
  const dosisAgrupadasPorHorario = useMemo((): GrupoHorario[] => {
    const grupos = new Map<string, DosisDelDia[]>();

    for (const dosis of dosisFiltradas) {
      const existing = grupos.get(dosis.horario) || [];
      existing.push(dosis);
      grupos.set(dosis.horario, existing);
    }

    // Convertir a array ordenado por horario
    return Array.from(grupos.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([horario, dosis]) => {
        const pendientesCount = dosis.filter(d => !d.registro).length;
        return {
          horario,
          dosis,
          todasPendientes: dosis.every(d => !d.registro),
          todasRegistradas: dosis.every(d => d.registro),
          algunaRetrasada: dosis.some(d => d.retrasoMinutos && d.retrasoMinutos > 0),
          pendientesCount,
        };
      });
  }, [dosisFiltradas]);

  // Lógica de filtrado y ordenamiento para Historial
  const historialFiltrado = useMemo(() => {
    let resultado = [...historialRegistros];

    // Búsqueda por nombre de medicamento
    if (searchTerm) {
      const termLower = searchTerm.toLowerCase();
      resultado = resultado.filter((reg) =>
        reg.medicamentoNombre.toLowerCase().includes(termLower)
      );
    }

    // Filtro por medicamento
    if (filtroMedicamento !== 'todos') {
      resultado = resultado.filter((reg) => reg.medicamentoId === filtroMedicamento);
    }

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter((reg) => reg.estado === filtroEstado);
    }

    // Ordenamiento
    resultado.sort((a, b) => {
      switch (sortByHistorial) {
        case 'fecha_desc':
          return b.fechaHoraProgramada.getTime() - a.fechaHoraProgramada.getTime();
        case 'fecha_asc':
          return a.fechaHoraProgramada.getTime() - b.fechaHoraProgramada.getTime();
        case 'nombre_asc':
          return a.medicamentoNombre.localeCompare(b.medicamentoNombre);
        case 'estado':
          return a.estado.localeCompare(b.estado);
        default:
          return b.fechaHoraProgramada.getTime() - a.fechaHoraProgramada.getTime();
      }
    });

    return resultado;
  }, [historialRegistros, searchTerm, filtroMedicamento, filtroEstado, sortByHistorial]);

  // Items visibles con paginación
  const dosisVisibles = dosisFiltradas.slice(0, visibleCountHoy);
  const historialVisible = historialFiltrado.slice(0, visibleCountHistorial);
  const hasMoreHoy = visibleCountHoy < dosisFiltradas.length;
  const hasMoreHistorial = visibleCountHistorial < historialFiltrado.length;

  // Contar filtros activos
  const activeFiltersCountHoy = [filtroEstadoHoy !== 'todos'].filter(Boolean).length;
  const activeFiltersCountHistorial = [
    filtroMedicamento !== 'todos',
    filtroEstado !== 'todos',
  ].filter(Boolean).length;

  // Resetear paginación cuando cambian filtros
  useEffect(() => {
    setVisibleCountHoy(ITEMS_PER_PAGE);
  }, [searchTerm, filtroEstadoHoy, sortByHoy]);

  useEffect(() => {
    setVisibleCountHistorial(ITEMS_PER_PAGE);
  }, [searchTerm, filtroMedicamento, filtroEstado, sortByHistorial]);

  // Resetear búsqueda y paginación al cambiar de vista
  useEffect(() => {
    setSearchTerm('');
    setVisibleCountHoy(ITEMS_PER_PAGE);
    setVisibleCountHistorial(ITEMS_PER_PAGE);
  }, [vistaActual]);

  function handleLoadMoreHoy() {
    setVisibleCountHoy((prev) => prev + ITEMS_PER_PAGE);
  }

  function handleLoadMoreHistorial() {
    setVisibleCountHistorial((prev) => prev + ITEMS_PER_PAGE);
  }

  function handleClearFiltersHoy() {
    setFiltroEstadoHoy('todos');
  }

  function handleClearFiltersHistorial() {
    setFiltroMedicamento('todos');
    setFiltroEstado('todos');
  }

  function renderVistaDia() {
    return (
      <div className="space-y-6">
        {/* Barra de herramientas */}
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar medicamento..."
            className="flex-1 max-w-md"
          />
          <div className="flex items-center gap-3">
            <FilterPanel
              isOpen={filtersOpenHoy}
              onToggle={() => setFiltersOpenHoy(!filtersOpenHoy)}
              activeFiltersCount={activeFiltersCountHoy}
              onClear={handleClearFiltersHoy}
            >
              <FilterSelect
                label="Estado"
                value={filtroEstadoHoy}
                onChange={setFiltroEstadoHoy}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'pendiente', label: 'Pendiente' },
                  { value: 'tomado', label: 'Tomado' },
                  { value: 'rechazado', label: 'Rechazado' },
                  { value: 'omitido', label: 'Omitido' },
                ]}
              />
            </FilterPanel>
            <SortDropdown value={sortByHoy} options={SORT_OPTIONS_HOY} onChange={setSortByHoy} />
          </div>
        </div>

        {/* Lista de dosis agrupadas por horario */}
        {dosisDelDia.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            <p className="text-gray-500 text-lg">No hay medicamentos programados para hoy</p>
          </div>
        ) : dosisAgrupadasPorHorario.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center shadow-sm">
            <p className="text-gray-500">No se encontraron dosis que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dosisAgrupadasPorHorario.map((grupo) => (
              <div
                key={grupo.horario}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
              >
                {/* Header del grupo con horario */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-lg font-semibold text-gray-900">{grupo.horario}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        ({grupo.dosis.length} medicamento{grupo.dosis.length > 1 ? 's' : ''})
                      </span>
                    </div>
                    {grupo.algunaRetrasada && !grupo.todasRegistradas && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                        Retrasado
                      </span>
                    )}
                  </div>

                  {/* Botón registro masivo - solo si hay pendientes */}
                  <div className="flex items-center gap-2">
                    {grupo.pendientesCount > 0 && grupo.dosis.length > 1 && (
                      <button
                        onClick={() => abrirModalGrupo(grupo)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Registrar todas
                      </button>
                    )}
                    {grupo.todasRegistradas && (
                      <span className="px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-full flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Completado
                      </span>
                    )}
                  </div>
                </div>

                {/* Lista de medicamentos del grupo */}
                <div className="divide-y divide-gray-100">
                  {grupo.dosis.map((dosis, idx) => (
                    <DosisCard
                      key={`${dosis.medicamento.id}-${grupo.horario}-${idx}`}
                      dosis={dosis}
                      viewMode="list"
                      onRegistrar={abrirModal}
                      compact
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderHistorial() {
    return (
      <div className="space-y-6">
        {/* Barra de herramientas */}
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar medicamento..."
            className="flex-1 max-w-md"
          />
          <div className="flex items-center gap-3">
            <FilterPanel
              isOpen={filtersOpenHistorial}
              onToggle={() => setFiltersOpenHistorial(!filtersOpenHistorial)}
              activeFiltersCount={activeFiltersCountHistorial}
              onClear={handleClearFiltersHistorial}
            >
              <FilterSelect
                label="Medicamento"
                value={filtroMedicamento}
                onChange={setFiltroMedicamento}
                options={[
                  { value: 'todos', label: 'Todos' },
                  ...medicamentos.map((med) => ({ value: med.id, label: med.nombre })),
                ]}
              />
              <FilterSelect
                label="Estado"
                value={filtroEstado}
                onChange={setFiltroEstado}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'tomado', label: 'Tomado' },
                  { value: 'rechazado', label: 'Rechazado' },
                  { value: 'omitido', label: 'Omitido' },
                  { value: 'pendiente', label: 'Pendiente' },
                ]}
              />
            </FilterPanel>
            <SortDropdown value={sortByHistorial} options={SORT_OPTIONS_HISTORIAL} onChange={setSortByHistorial} />
          </div>
        </div>

        {/* Lista/Grid */}
        {historialRegistros.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-gray-500 text-lg">No hay registros en el historial</p>
          </div>
        ) : historialFiltrado.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center shadow-sm">
            <p className="text-gray-500">No se encontraron registros que coincidan con los filtros</p>
          </div>
        ) : (
          <>
            <div
              className={
                vista === 'grid'
                  ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                  : 'space-y-4'
              }
            >
              {historialVisible.map((reg) => (
                <HistorialCard key={reg.id} registro={reg} viewMode={vista} />
              ))}
            </div>
            <LoadMoreButton
              onClick={handleLoadMoreHistorial}
              hasMore={hasMoreHistorial}
              loadedCount={historialVisible.length}
              totalCount={historialFiltrado.length}
              itemsPerLoad={ITEMS_PER_PAGE}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pastillero Diario</h1>
            <p className="text-gray-600 mt-1">Control de administración de medicamentos</p>
          </div>
          <div className="flex items-center gap-3">
            <ViewToggle view={vista} onChange={setVista} />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setVistaActual('hoy');
                  cargarDosisDelDia();
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  vistaActual === 'hoy'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => {
                  setVistaActual('historial');
                  cargarHistorial();
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  vistaActual === 'historial'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Historial
              </button>
            </div>
          </div>
        </div>

        {/* Panel de Tránsito */}
        <TransitoPanel
          items={itemsTransito}
          loading={loadingTransito}
          onSolicitarReposicion={() => setShowSolicitudModal(true)}
          onRellenarPastillero={() => setShowRellenarModal(true)}
        />

        {/* Contenido */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Cargando...</p>
          </div>
        ) : vistaActual === 'hoy' ? (
          renderVistaDia()
        ) : (
          renderHistorial()
        )}

        {/* Modal de Registro */}
        {modalAbierto && dosisSeleccionada && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Registrar Administración</h2>

              <div className="mb-4">
                <p className="text-lg font-semibold text-gray-900">
                  {dosisSeleccionada.medicamento.nombre}
                </p>
                <p className="text-gray-600">
                  {dosisSeleccionada.medicamento.dosis} - {dosisSeleccionada.horario}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado *</label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setEstadoSeleccionado('tomado')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'tomado'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Tomado
                  </button>
                  <button
                    onClick={() => setEstadoSeleccionado('rechazado')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'rechazado'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Rechazado
                  </button>
                  <button
                    onClick={() => setEstadoSeleccionado('omitido')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'omitido'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Omitido
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Observaciones o motivo..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={registrarAdministracion}
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => {
                    setModalAbierto(false);
                    setDosisSeleccionada(null);
                  }}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Registro Masivo por Horario */}
        {modalGrupoAbierto && grupoSeleccionado && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Registrar medicamentos
              </h2>
              <p className="text-gray-600 mb-4">
                Horario: <span className="font-semibold">{grupoSeleccionado.horario}</span>
              </p>

              {/* Lista de medicamentos pendientes */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Medicamentos a registrar ({grupoSeleccionado.pendientesCount}):
                </p>
                <div className="bg-gray-50 rounded-lg divide-y divide-gray-200 border border-gray-200">
                  {grupoSeleccionado.dosis
                    .filter(d => !d.registro)
                    .map((dosis, idx) => (
                      <div key={idx} className="px-4 py-3 flex items-center gap-3">
                        {dosis.medicamento.foto ? (
                          <img
                            src={dosis.medicamento.foto}
                            alt={dosis.medicamento.nombre}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{dosis.medicamento.nombre}</p>
                          <p className="text-sm text-gray-500">{dosis.medicamento.dosis}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Selector de estado */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado para todos *
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setEstadoSeleccionado('tomado')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'tomado'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Tomado
                  </button>
                  <button
                    onClick={() => setEstadoSeleccionado('rechazado')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'rechazado'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Rechazado
                  </button>
                  <button
                    onClick={() => setEstadoSeleccionado('omitido')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'omitido'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Omitido
                  </button>
                </div>
              </div>

              {/* Notas */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional, se aplica a todos)
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Observaciones..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={registrarGrupoHorario}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'Guardando...'
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Registrar {grupoSeleccionado.pendientesCount} medicamentos
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setModalGrupoAbierto(false);
                    setGrupoSeleccionado(null);
                    setNotas('');
                  }}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Rellenar Pastillero */}
        <RellenarPastilleroModal
          isOpen={showRellenarModal}
          onClose={() => setShowRellenarModal(false)}
          items={itemsTransito}
          onConfirmar={handleRellenarPastillero}
        />

        {/* Modal de Solicitud de Reposición */}
        <SolicitudReposicionModal
          isOpen={showSolicitudModal}
          onClose={() => setShowSolicitudModal(false)}
          items={itemsTransito}
          onEnviar={handleSolicitarReposicion}
        />
      </div>
    </Layout>
  );
}
