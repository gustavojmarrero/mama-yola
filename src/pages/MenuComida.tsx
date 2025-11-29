import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, where, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import Carousel from '../components/ui/Carousel';
import { RecetaCarouselCard } from '../components/menu/RecetaCarouselCard';
import { ComidaProgramada, TipoComida, CategoriaComida, NivelConsumo, Receta, TiempoComidaId, ComponenteId, TiempoComidaConfig, ComponenteConfig, RecetaHabilitacion, MenuTiempoComida, PlatilloAsignado } from '../types';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

const PACIENTE_ID = 'paciente-principal';

const tiposComida: { value: TipoComida; label: string; hora: string; icon: string }[] = [
  { value: 'desayuno', label: 'Desayuno', hora: '08:00', icon: '🌅' },
  { value: 'colacion1', label: 'Colación AM', hora: '11:00', icon: '🍎' },
  { value: 'comida', label: 'Comida', hora: '14:00', icon: '🍽️' },
  { value: 'colacion2', label: 'Colación PM', hora: '17:00', icon: '🍪' },
  { value: 'cena', label: 'Cena', hora: '20:00', icon: '🌙' }
];

const categoriasComida: { value: CategoriaComida; label: string }[] = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'plato_fuerte', label: 'Plato Fuerte' },
  { value: 'postre', label: 'Postre' },
  { value: 'bebida', label: 'Bebida' },
  { value: 'snack', label: 'Snack' }
];

const nivelesConsumo: { value: NivelConsumo; label: string; porcentaje: number; color: string }[] = [
  { value: 'todo', label: 'Todo', porcentaje: 100, color: 'bg-green-500' },
  { value: 'mayor_parte', label: 'Mayor parte', porcentaje: 75, color: 'bg-green-400' },
  { value: 'mitad', label: 'Mitad', porcentaje: 50, color: 'bg-yellow-500' },
  { value: 'poco', label: 'Poco', porcentaje: 25, color: 'bg-orange-500' },
  { value: 'nada', label: 'Nada', porcentaje: 0, color: 'bg-red-500' }
];

// Componentes disponibles para asignar a los tiempos de comida
const COMPONENTES_DISPONIBLES: { id: ComponenteId; nombre: string; icono: string }[] = [
  { id: 'primer_plato', nombre: 'Primer Plato', icono: '🥗' },
  { id: 'segundo_plato', nombre: 'Segundo Plato', icono: '🍖' },
  { id: 'complemento', nombre: 'Complemento', icono: '🥕' },
  { id: 'postre', nombre: 'Postre', icono: '🍮' },
  { id: 'snack', nombre: 'Snack', icono: '🍪' },
  { id: 'bebida', nombre: 'Bebida', icono: '🥤' },
  { id: 'lactobacilos', nombre: 'Lactobacilos', icono: '🥛' },
];

// Configuración default de tiempos de comida
const TIEMPOS_COMIDA_DEFAULT: TiempoComidaConfig[] = [
  {
    id: 'desayuno',
    nombre: 'Desayuno',
    horaDefault: '08:00',
    icono: '🌅',
    componentes: [
      { id: 'lactobacilos', nombre: 'Lactobacilos', obligatorio: true, orden: 1 },
      { id: 'primer_plato', nombre: 'Primer Plato', obligatorio: false, orden: 2 },
      { id: 'snack', nombre: 'Snack', obligatorio: false, orden: 3 },
      { id: 'bebida', nombre: 'Bebida', obligatorio: true, orden: 4 },
    ],
    orden: 1,
    activo: true,
  },
  {
    id: 'colacion_am',
    nombre: 'Colación AM',
    horaDefault: '11:00',
    icono: '🍎',
    componentes: [
      { id: 'lactobacilos', nombre: 'Lactobacilos', obligatorio: false, orden: 1 },
      { id: 'snack', nombre: 'Snack', obligatorio: false, orden: 2 },
      { id: 'bebida', nombre: 'Bebida', obligatorio: true, orden: 3 },
    ],
    orden: 2,
    activo: true,
  },
  {
    id: 'almuerzo',
    nombre: 'Almuerzo',
    horaDefault: '14:00',
    icono: '🍽️',
    componentes: [
      { id: 'lactobacilos', nombre: 'Lactobacilos', obligatorio: false, orden: 1 },
      { id: 'primer_plato', nombre: 'Primer Plato', obligatorio: false, orden: 2 },
      { id: 'segundo_plato', nombre: 'Segundo Plato', obligatorio: false, orden: 3 },
      { id: 'complemento', nombre: 'Complemento', obligatorio: false, orden: 4 },
      { id: 'bebida', nombre: 'Bebida', obligatorio: true, orden: 5 },
    ],
    orden: 3,
    activo: true,
  },
  {
    id: 'colacion_pm',
    nombre: 'Colación PM',
    horaDefault: '17:00',
    icono: '🍪',
    componentes: [
      { id: 'lactobacilos', nombre: 'Lactobacilos', obligatorio: false, orden: 1 },
      { id: 'snack', nombre: 'Snack', obligatorio: false, orden: 2 },
      { id: 'bebida', nombre: 'Bebida', obligatorio: true, orden: 3 },
    ],
    orden: 4,
    activo: true,
  },
  {
    id: 'cena',
    nombre: 'Cena',
    horaDefault: '20:00',
    icono: '🌙',
    componentes: [
      { id: 'lactobacilos', nombre: 'Lactobacilos', obligatorio: false, orden: 1 },
      { id: 'primer_plato', nombre: 'Primer Plato', obligatorio: false, orden: 2 },
      { id: 'complemento', nombre: 'Complemento', obligatorio: false, orden: 3 },
      { id: 'bebida', nombre: 'Bebida', obligatorio: true, orden: 4 },
    ],
    orden: 5,
    activo: true,
  },
];

export default function MenuComida() {
  const { userProfile } = useAuth();
  const [comidas, setComidas] = useState<ComidaProgramada[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanaActual, setSemanaActual] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date()); // Vista móvil: día actual por defecto
  const [vista, setVista] = useState<'menu' | 'recetas' | 'configuracion'>('menu');

  // Detectar si es móvil
  const [esMovil, setEsMovil] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setEsMovil(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Estado para configuración de tiempos de comida
  const [tiemposComidaConfig, setTiemposComidaConfig] = useState<TiempoComidaConfig[]>(TIEMPOS_COMIDA_DEFAULT);
  const [configInicial, setConfigInicial] = useState<TiempoComidaConfig[] | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  // Estado para menús diarios (nueva estructura)
  const [menusDiarios, setMenusDiarios] = useState<MenuTiempoComida[]>([]);

  // Estado para modal de asignación de platillo
  const [modalAsignar, setModalAsignar] = useState(false);
  const [asignacionActual, setAsignacionActual] = useState<{
    fecha: Date;
    tiempoId: TiempoComidaId;
    componenteId: ComponenteId;
    menuId?: string;
  } | null>(null);
  const [busquedaRecetaAsignar, setBusquedaRecetaAsignar] = useState('');
  const [platilloCustom, setPlatilloCustom] = useState('');
  const [fotoCustom, setFotoCustom] = useState('');
  const [uploadingFotoCustom, setUploadingFotoCustom] = useState(false);

  // Modal de edición de platillo custom
  const [modalEditarPlatillo, setModalEditarPlatillo] = useState(false);
  const [platilloEditando, setPlatilloEditando] = useState<{
    menuId: string;
    platillo: PlatilloAsignado;
  } | null>(null);
  const [editNombreCustom, setEditNombreCustom] = useState('');
  const [editFotoCustom, setEditFotoCustom] = useState('');
  const [uploadingEditFoto, setUploadingEditFoto] = useState(false);

  const [modalComida, setModalComida] = useState(false);
  const [modalConsumo, setModalConsumo] = useState(false);
  const [modalReceta, setModalReceta] = useState(false);
  const [comidaSeleccionada, setComidaSeleccionada] = useState<ComidaProgramada | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null);
  const [tipoComidaSeleccionado, setTipoComidaSeleccionado] = useState<TipoComida>('desayuno');

  const [formComida, setFormComida] = useState({
    platillo: '',
    categoria: 'plato_fuerte' as CategoriaComida,
    ingredientes: [] as string[],
    instrucciones: '',
    calorias: 0,
    horaProgramada: '08:00',
    cantidad: '' as string | number
  });

  const [formConsumo, setFormConsumo] = useState({
    nivelConsumo: 'todo' as NivelConsumo,
    motivoRechazo: '',
    notasConsumo: '',
    satisfaccion: 3
  });

  const [nuevoIngrediente, setNuevoIngrediente] = useState('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');

  // Estados para CRUD de recetas
  const [modalRecetaCRUD, setModalRecetaCRUD] = useState(false);
  const [recetaEditando, setRecetaEditando] = useState<Receta | null>(null);
  const [modalVerReceta, setModalVerReceta] = useState(false);
  const [recetaVisualizando, setRecetaVisualizando] = useState<Receta | null>(null);
  const [imagenExpandida, setImagenExpandida] = useState(false);
  const [busquedaReceta, setBusquedaReceta] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaComida | 'todas'>('todas');
  const [mostrarSoloFavoritas, setMostrarSoloFavoritas] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [nuevoIngredienteReceta, setNuevoIngredienteReceta] = useState('');
  const [nuevaEtiquetaReceta, setNuevaEtiquetaReceta] = useState('');

  const [formReceta, setFormReceta] = useState({
    nombre: '',
    categoria: 'plato_fuerte' as CategoriaComida,
    ingredientes: [] as string[],
    instrucciones: '',
    etiquetas: [] as string[],
    favorita: false,
    foto: '',
    habilitaciones: [] as RecetaHabilitacion[],
  });

  // Hook para detectar cambios sin guardar
  const { isDirty, setIsDirty, markAsSaved, confirmNavigation } = useUnsavedChanges();
  const isInitialLoadComida = useRef(true);
  const isInitialLoadReceta = useRef(true);
  const hoyRef = useRef<HTMLDivElement>(null);

  // Detectar cambios en el formulario de comida
  useEffect(() => {
    if (modalComida && !isInitialLoadComida.current) {
      setIsDirty(true);
    }
  }, [formComida, modalComida]);

  // Detectar cambios en el formulario de receta
  useEffect(() => {
    if (modalRecetaCRUD && !isInitialLoadReceta.current) {
      setIsDirty(true);
    }
  }, [formReceta, modalRecetaCRUD]);

  // Resetear flags cuando se abren/cierran modales
  useEffect(() => {
    if (modalComida) {
      setTimeout(() => { isInitialLoadComida.current = false; }, 100);
    } else {
      isInitialLoadComida.current = true;
      if (!modalRecetaCRUD) setIsDirty(false);
    }
  }, [modalComida]);

  useEffect(() => {
    if (modalRecetaCRUD) {
      setTimeout(() => { isInitialLoadReceta.current = false; }, 100);
    } else {
      isInitialLoadReceta.current = true;
      if (!modalComida) setIsDirty(false);
    }
  }, [modalRecetaCRUD]);

  const inicioSemana = startOfWeek(semanaActual, { weekStartsOn: 1 });
  const finSemana = endOfWeek(semanaActual, { weekStartsOn: 1 });
  const diasSemana = eachDayOfInterval({ start: inicioSemana, end: finSemana });

  // Cargar comidas
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'comidas'),
      orderBy('fecha', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comidasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha?.toDate(),
        horaServida: doc.data().horaServida?.toDate(),
        creadoEn: doc.data().creadoEn?.toDate(),
        actualizadoEn: doc.data().actualizadoEn?.toDate()
      })) as ComidaProgramada[];
      setComidas(comidasData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cargar recetas
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'recetas'),
      orderBy('nombre', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recetasData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          creadoEn: doc.data().creadoEn?.toDate(),
          actualizadoEn: doc.data().actualizadoEn?.toDate()
        }))
        .filter(r => r.activo !== false) as Receta[];
      setRecetas(recetasData);
    });

    return () => unsubscribe();
  }, []);

  // Cargar configuración de tiempos de comida
  useEffect(() => {
    async function cargarConfiguracion() {
      try {
        const configRef = doc(db, 'pacientes', PACIENTE_ID, 'configuracion', 'tiemposComida');
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
          const data = configSnap.data();
          if (data.tiempos && Array.isArray(data.tiempos)) {
            // Combinar configuración guardada con defaults para asegurar que todos los componentes existan
            const tiemposActualizados = TIEMPOS_COMIDA_DEFAULT.map(defaultTiempo => {
              const tiempoGuardado = data.tiempos.find((t: TiempoComidaConfig) => t.id === defaultTiempo.id);
              if (tiempoGuardado && tiempoGuardado.componentes) {
                // Usar los componentes guardados directamente (el usuario puede agregar/quitar)
                // Solo asegurar que los obligatorios del default existan
                const componentesGuardados = [...tiempoGuardado.componentes];

                // Agregar componentes obligatorios del default si no existen
                defaultTiempo.componentes.forEach(defaultComp => {
                  if (defaultComp.obligatorio && !componentesGuardados.some(c => c.id === defaultComp.id)) {
                    componentesGuardados.push(defaultComp);
                  }
                });

                return { ...defaultTiempo, ...tiempoGuardado, componentes: componentesGuardados };
              }
              return defaultTiempo;
            });
            setTiemposComidaConfig(tiemposActualizados);
            setConfigInicial(tiemposActualizados);
          }
        } else {
          // No hay configuración guardada, usar defaults como inicial
          setTiemposComidaConfig(TIEMPOS_COMIDA_DEFAULT);
          setConfigInicial(TIEMPOS_COMIDA_DEFAULT);
        }
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      } finally {
        setLoadingConfig(false);
      }
    }

    cargarConfiguracion();
  }, []);

  // Detectar cambios en la configuración de tiempos de comida
  useEffect(() => {
    if (configInicial === null) return; // Aún no se ha cargado

    const hasChanges = JSON.stringify(tiemposComidaConfig) !== JSON.stringify(configInicial);
    setIsDirty(hasChanges);
  }, [tiemposComidaConfig, configInicial, setIsDirty]);

  // Cargar menús diarios
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'menusDiarios'),
      orderBy('fecha', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const menusData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha?.toDate(),
        creadoEn: doc.data().creadoEn?.toDate(),
        actualizadoEn: doc.data().actualizadoEn?.toDate(),
      })) as MenuTiempoComida[];
      setMenusDiarios(menusData);
    });

    return () => unsubscribe();
  }, []);

  // Comidas del día (legacy)
  function comidasDelDia(fecha: Date): ComidaProgramada[] {
    return comidas.filter(c => c.fecha && isSameDay(c.fecha, fecha));
  }

  // Obtener comida por tipo (legacy)
  function comidaPorTipo(fecha: Date, tipo: TipoComida): ComidaProgramada | undefined {
    return comidasDelDia(fecha).find(c => c.tipoComida === tipo);
  }

  // ========== FUNCIONES PARA NUEVA ESTRUCTURA DE MENÚS ==========

  // Obtener menú por fecha y tiempo de comida
  function getMenu(fecha: Date, tiempoId: TiempoComidaId): MenuTiempoComida | undefined {
    return menusDiarios.find(m =>
      m.tiempoComidaId === tiempoId && isSameDay(m.fecha, fecha)
    );
  }

  // Obtener platillo de un componente específico
  function getPlatillo(menu: MenuTiempoComida | undefined, componenteId: ComponenteId): PlatilloAsignado | undefined {
    if (!menu) return undefined;
    return menu.platillos?.find(p => p.componenteId === componenteId);
  }

  // Abrir modal para asignar platillo
  function abrirModalAsignar(fecha: Date, tiempoId: TiempoComidaId, componenteId: ComponenteId, menuId?: string) {
    setAsignacionActual({ fecha, tiempoId, componenteId, menuId });
    setBusquedaRecetaAsignar('');
    setPlatilloCustom('');
    setModalAsignar(true);
  }

  // Cerrar modal de asignación
  function cerrarModalAsignar() {
    setModalAsignar(false);
    setAsignacionActual(null);
    setBusquedaRecetaAsignar('');
    setPlatilloCustom('');
    setFotoCustom('');
  }

  // Abrir modal para editar platillo custom
  function abrirEditarPlatilloCustom(menuId: string, platillo: PlatilloAsignado) {
    setPlatilloEditando({ menuId, platillo });
    setEditNombreCustom(platillo.nombreCustom || '');
    setEditFotoCustom(platillo.fotoCustom || '');
    setModalEditarPlatillo(true);
  }

  // Cerrar modal de edición
  function cerrarModalEditarPlatillo() {
    setModalEditarPlatillo(false);
    setPlatilloEditando(null);
    setEditNombreCustom('');
    setEditFotoCustom('');
  }

  // Handler para subir foto en edición
  async function handleEditFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingEditFoto(true);
      const storageRef = ref(storage, `platillos-custom/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setEditFotoCustom(url);
    } catch (error) {
      console.error('Error al subir foto:', error);
      alert('Error al subir la foto');
    } finally {
      setUploadingEditFoto(false);
    }
  }

  // Guardar cambios en platillo custom
  async function guardarEditPlatilloCustom() {
    if (!platilloEditando || !editNombreCustom.trim()) return;

    const { menuId, platillo } = platilloEditando;

    try {
      const menuRef = doc(db, 'pacientes', PACIENTE_ID, 'menusDiarios', menuId);
      const menuSnap = await getDoc(menuRef);

      if (menuSnap.exists()) {
        const menuData = menuSnap.data();
        const platillosActuales = menuData.platillos || [];

        // Actualizar el platillo
        const platillosNuevos = platillosActuales.map((p: PlatilloAsignado) => {
          if (p.componenteId === platillo.componenteId && p.nombreCustom) {
            return {
              ...p,
              nombreCustom: editNombreCustom.trim(),
              ...(editFotoCustom ? { fotoCustom: editFotoCustom } : {}),
              ...(!editFotoCustom && p.fotoCustom ? {} : {}), // Mantener o quitar foto
            };
          }
          return p;
        });

        // Si se quitó la foto, eliminar el campo
        const platillosFinal = platillosNuevos.map((p: PlatilloAsignado) => {
          if (p.componenteId === platillo.componenteId && !editFotoCustom) {
            const { fotoCustom: _, ...rest } = p;
            return rest;
          }
          return p;
        });

        await updateDoc(menuRef, {
          platillos: platillosFinal,
          actualizadoEn: Timestamp.now(),
        });
      }

      cerrarModalEditarPlatillo();
    } catch (error) {
      console.error('Error al actualizar platillo:', error);
      alert('Error al guardar los cambios');
    }
  }

  // Asignar platillo a un componente
  async function asignarPlatillo(receta?: Receta, nombreCustom?: string) {
    if (!asignacionActual) return;

    const { fecha, tiempoId, componenteId, menuId } = asignacionActual;
    const tiempoConfig = tiemposComidaConfig.find(t => t.id === tiempoId);

    const nuevoPlatillo: PlatilloAsignado = {
      componenteId,
      ...(receta?.id && { recetaId: receta.id }),
      ...(receta?.nombre && { recetaNombre: receta.nombre }),
      ...(nombreCustom && { nombreCustom }),
      ...(nombreCustom && fotoCustom && { fotoCustom }),
    };

    try {
      if (menuId) {
        // Actualizar menú existente
        const menuRef = doc(db, 'pacientes', PACIENTE_ID, 'menusDiarios', menuId);
        const menuSnap = await getDoc(menuRef);

        if (menuSnap.exists()) {
          const menuData = menuSnap.data();
          const platillosActuales = menuData.platillos || [];

          // Reemplazar o agregar el platillo
          const platillosNuevos = platillosActuales.filter(
            (p: PlatilloAsignado) => p.componenteId !== componenteId
          );
          platillosNuevos.push(nuevoPlatillo);

          await updateDoc(menuRef, {
            platillos: platillosNuevos,
            actualizadoEn: Timestamp.now(),
          });
        }
      } else {
        // Crear nuevo menú
        const fechaStr = format(fecha, 'yyyy-MM-dd');
        const nuevoMenuId = `${fechaStr}_${tiempoId}`;

        await setDoc(doc(db, 'pacientes', PACIENTE_ID, 'menusDiarios', nuevoMenuId), {
          pacienteId: PACIENTE_ID,
          fecha: Timestamp.fromDate(fecha),
          tiempoComidaId: tiempoId,
          horaProgramada: tiempoConfig?.horaDefault || '12:00',
          platillos: [nuevoPlatillo],
          estado: 'pendiente',
          creadoEn: Timestamp.now(),
          actualizadoEn: Timestamp.now(),
        });
      }

      cerrarModalAsignar();
    } catch (error) {
      console.error('Error al asignar platillo:', error);
      alert('Error al asignar el platillo');
    }
  }

  // Quitar platillo de un componente
  async function quitarPlatillo(menuId: string, componenteId: ComponenteId) {
    if (!confirm('¿Quitar este platillo?')) return;

    try {
      const menuRef = doc(db, 'pacientes', PACIENTE_ID, 'menusDiarios', menuId);
      const menuSnap = await getDoc(menuRef);

      if (menuSnap.exists()) {
        const menuData = menuSnap.data();
        const platillosActuales = menuData.platillos || [];
        const platillosNuevos = platillosActuales.filter(
          (p: PlatilloAsignado) => p.componenteId !== componenteId
        );

        if (platillosNuevos.length === 0) {
          // Si no quedan platillos, eliminar el menú
          await deleteDoc(menuRef);
        } else {
          await updateDoc(menuRef, {
            platillos: platillosNuevos,
            actualizadoEn: Timestamp.now(),
          });
        }
      }
    } catch (error) {
      console.error('Error al quitar platillo:', error);
      alert('Error al quitar el platillo');
    }
  }

  // Filtrar recetas por habilitación para un tiempo+componente
  function recetasHabilitadas(tiempoId: TiempoComidaId, componenteId: ComponenteId): Receta[] {
    return recetas.filter(r =>
      r.activo !== false &&
      r.habilitaciones?.some(h =>
        h.tiempoComidaId === tiempoId && h.componenteId === componenteId
      )
    );
  }

  // Crear comida
  async function crearComida() {
    if (!fechaSeleccionada || !formComida.platillo) return;

    const nuevaComida = {
      pacienteId: PACIENTE_ID,
      fecha: Timestamp.fromDate(fechaSeleccionada),
      tipoComida: tipoComidaSeleccionado,
      horaProgramada: formComida.horaProgramada,
      platillo: formComida.platillo,
      categoria: formComida.categoria,
      ingredientes: formComida.ingredientes.length > 0 ? formComida.ingredientes : null,
      instruccionesPreparacion: formComida.instrucciones || null,
      valorNutricional: formComida.calorias > 0 ? { calorias: formComida.calorias, proteinas: 0, carbohidratos: 0, grasas: 0 } : null,
      cantidad: typeof formComida.cantidad === 'number' ? formComida.cantidad : null,
      creadoEn: Timestamp.now(),
      actualizadoEn: Timestamp.now()
    };

    await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'comidas'), nuevaComida);
    markAsSaved();
    cerrarModalComida();
  }

  // Registrar consumo
  async function registrarConsumo() {
    if (!comidaSeleccionada) return;

    const nivel = nivelesConsumo.find(n => n.value === formConsumo.nivelConsumo);

    await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'comidas', comidaSeleccionada.id), {
      nivelConsumo: formConsumo.nivelConsumo,
      porcentajeConsumido: nivel?.porcentaje || 0,
      motivoRechazo: formConsumo.motivoRechazo || null,
      notasConsumo: formConsumo.notasConsumo || null,
      satisfaccion: formConsumo.satisfaccion,
      horaServida: Timestamp.now(),
      preparadoPor: userProfile?.id,
      actualizadoEn: Timestamp.now()
    });

    setModalConsumo(false);
    setComidaSeleccionada(null);
    setFormConsumo({ nivelConsumo: 'todo', motivoRechazo: '', notasConsumo: '', satisfaccion: 3 });
  }

  // Eliminar comida
  async function eliminarComida(comida: ComidaProgramada) {
    if (!confirm('¿Eliminar esta comida?')) return;
    await deleteDoc(doc(db, 'pacientes', PACIENTE_ID, 'comidas', comida.id));
  }

  // Usar receta
  function usarReceta(receta: Receta) {
    setFormComida({
      ...formComida,
      platillo: receta.nombre,
      categoria: receta.categoria,
      ingredientes: receta.ingredientes,
      instrucciones: receta.instrucciones
    });
    setModalReceta(false);
  }

  // Agregar ingrediente
  function agregarIngrediente() {
    if (!nuevoIngrediente.trim()) return;
    setFormComida({
      ...formComida,
      ingredientes: [...formComida.ingredientes, nuevoIngrediente.trim()]
    });
    setNuevoIngrediente('');
  }

  function cerrarModalComida() {
    setModalComida(false);
    setFechaSeleccionada(null);
    setFormComida({
      platillo: '',
      categoria: 'plato_fuerte',
      ingredientes: [],
      instrucciones: '',
      calorias: 0,
      horaProgramada: '08:00',
      cantidad: ''
    });
  }

  // ========== FUNCIONES DE CONFIGURACIÓN ==========

  // Verificar si un componente está habilitado para un tiempo
  function tieneComponente(tiempoId: TiempoComidaId, componenteId: ComponenteId): boolean {
    const tiempo = tiemposComidaConfig.find(t => t.id === tiempoId);
    return tiempo?.componentes.some(c => c.id === componenteId) || false;
  }

  // Toggle de componente para un tiempo de comida
  function toggleComponente(tiempoId: TiempoComidaId, componenteId: ComponenteId) {
    // No permitir desactivar bebida (siempre obligatorio)
    if (componenteId === 'bebida') return;

    setTiemposComidaConfig(prev => prev.map(tiempo => {
      if (tiempo.id !== tiempoId) return tiempo;

      const tieneComp = tiempo.componentes.some(c => c.id === componenteId);

      if (tieneComp) {
        // Quitar componente
        return {
          ...tiempo,
          componentes: tiempo.componentes.filter(c => c.id !== componenteId)
        };
      } else {
        // Agregar componente
        const compInfo = COMPONENTES_DISPONIBLES.find(c => c.id === componenteId);
        const newOrden = tiempo.componentes.length + 1;
        return {
          ...tiempo,
          componentes: [
            ...tiempo.componentes,
            {
              id: componenteId,
              nombre: compInfo?.nombre || componenteId,
              obligatorio: false,
              orden: newOrden
            }
          ].sort((a, b) => {
            // Ordenar: bebida siempre al final
            if (a.id === 'bebida') return 1;
            if (b.id === 'bebida') return -1;
            return a.orden - b.orden;
          })
        };
      }
    }));
  }

  // Guardar configuración en Firestore
  async function guardarConfiguracion() {
    setGuardandoConfig(true);
    try {
      const configRef = doc(db, 'pacientes', PACIENTE_ID, 'configuracion', 'tiemposComida');
      await setDoc(configRef, {
        tiempos: tiemposComidaConfig,
        actualizadoEn: Timestamp.now()
      });
      setConfigInicial(tiemposComidaConfig);
      markAsSaved();
      alert('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      alert('Error al guardar la configuración');
    } finally {
      setGuardandoConfig(false);
    }
  }

  // Restaurar configuración por defecto
  function restaurarConfigDefault() {
    if (confirm('¿Restaurar la configuración por defecto? Se perderán los cambios no guardados.')) {
      setTiemposComidaConfig(TIEMPOS_COMIDA_DEFAULT);
    }
  }

  // ========== FUNCIONES CRUD DE RECETAS ==========

  function verReceta(receta: Receta) {
    setRecetaVisualizando(receta);
    setModalVerReceta(true);
  }

  function cerrarVistaReceta() {
    setModalVerReceta(false);
    setRecetaVisualizando(null);
    setImagenExpandida(false);
  }

  function abrirModalReceta(receta?: Receta) {
    if (receta) {
      setRecetaEditando(receta);
      setFormReceta({
        nombre: receta.nombre,
        categoria: receta.categoria || 'plato_fuerte',
        ingredientes: receta.ingredientes || [],
        instrucciones: receta.instrucciones,
        etiquetas: receta.etiquetas || [],
        favorita: receta.favorita,
        foto: receta.foto || '',
        habilitaciones: receta.habilitaciones || [],
      });
    } else {
      setRecetaEditando(null);
      setFormReceta({
        nombre: '',
        categoria: 'plato_fuerte',
        ingredientes: [],
        instrucciones: '',
        etiquetas: [],
        favorita: false,
        foto: '',
        habilitaciones: [],
      });
    }
    setModalRecetaCRUD(true);
  }

  // Toggle habilitación de receta para un tiempo+componente
  function toggleHabilitacion(tiempoId: TiempoComidaId, componenteId: ComponenteId) {
    setFormReceta(prev => {
      const existe = prev.habilitaciones.some(
        h => h.tiempoComidaId === tiempoId && h.componenteId === componenteId
      );

      if (existe) {
        return {
          ...prev,
          habilitaciones: prev.habilitaciones.filter(
            h => !(h.tiempoComidaId === tiempoId && h.componenteId === componenteId)
          )
        };
      } else {
        return {
          ...prev,
          habilitaciones: [
            ...prev.habilitaciones,
            { tiempoComidaId: tiempoId, componenteId: componenteId }
          ]
        };
      }
    });
  }

  // Verificar si una receta tiene habilitación para tiempo+componente
  function tieneHabilitacion(tiempoId: TiempoComidaId, componenteId: ComponenteId): boolean {
    return formReceta.habilitaciones.some(
      h => h.tiempoComidaId === tiempoId && h.componenteId === componenteId
    );
  }

  function cerrarModalReceta() {
    setModalRecetaCRUD(false);
    setRecetaEditando(null);
    setNuevoIngredienteReceta('');
    setNuevaEtiquetaReceta('');
    setFormReceta({
      nombre: '',
      categoria: 'plato_fuerte',
      ingredientes: [],
      instrucciones: '',
      etiquetas: [],
      favorita: false,
      foto: '',
      habilitaciones: [],
    });
  }

  async function guardarReceta() {
    if (!formReceta.nombre.trim()) {
      alert('El nombre de la receta es obligatorio');
      return;
    }

    try {
      const recetaData: Record<string, unknown> = {
        pacienteId: PACIENTE_ID,
        nombre: formReceta.nombre.trim(),
        categoria: formReceta.categoria,
        ingredientes: formReceta.ingredientes,
        instrucciones: formReceta.instrucciones,
        etiquetas: formReceta.etiquetas,
        favorita: formReceta.favorita,
        habilitaciones: formReceta.habilitaciones,
        activo: true,
        actualizadoEn: Timestamp.now(),
      };

      // Solo incluir foto si tiene valor
      if (formReceta.foto) {
        recetaData.foto = formReceta.foto;
      }

      if (recetaEditando) {
        await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'recetas', recetaEditando.id), recetaData);
      } else {
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'recetas'), {
          ...recetaData,
          creadoEn: Timestamp.now(),
        });
      }

      markAsSaved();
      cerrarModalReceta();
    } catch (error) {
      console.error('Error al guardar receta:', error);
      alert('Error al guardar la receta');
    }
  }

  async function eliminarReceta(receta: Receta) {
    if (!confirm(`¿Eliminar la receta "${receta.nombre}"?`)) return;

    try {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'recetas', receta.id), {
        activo: false,
        actualizadoEn: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al eliminar receta:', error);
      alert('Error al eliminar la receta');
    }
  }

  async function duplicarReceta(receta: Receta) {
    try {
      await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'recetas'), {
        pacienteId: PACIENTE_ID,
        nombre: `${receta.nombre} (copia)`,
        categoria: receta.categoria,
        ingredientes: receta.ingredientes,
        instrucciones: receta.instrucciones,
        etiquetas: receta.etiquetas,
        favorita: false,
        foto: receta.foto,
        activo: true,
        creadoEn: Timestamp.now(),
        actualizadoEn: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al duplicar receta:', error);
      alert('Error al duplicar la receta');
    }
  }

  async function toggleFavoritaReceta(receta: Receta) {
    try {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'recetas', receta.id), {
        favorita: !receta.favorita,
        actualizadoEn: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al cambiar favorita:', error);
    }
  }

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFoto(true);
      const storageRef = ref(storage, `recetas/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormReceta({ ...formReceta, foto: url });
    } catch (error) {
      console.error('Error al subir foto:', error);
      alert('Error al subir la foto');
    } finally {
      setUploadingFoto(false);
    }
  }

  // Handler para subir foto de platillo custom
  async function handleFotoCustomUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFotoCustom(true);
      const storageRef = ref(storage, `platillos-custom/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFotoCustom(url);
    } catch (error) {
      console.error('Error al subir foto:', error);
      alert('Error al subir la foto');
    } finally {
      setUploadingFotoCustom(false);
    }
  }

  // Filtrado de recetas
  const recetasFiltradas = recetas
    .filter(r => filtroCategoria === 'todas' || r.categoria === filtroCategoria)
    .filter(r => !filtroEtiqueta || r.etiquetas?.includes(filtroEtiqueta))
    .filter(r => !mostrarSoloFavoritas || r.favorita)
    .filter(r => !busquedaReceta ||
      r.nombre.toLowerCase().includes(busquedaReceta.toLowerCase()) ||
      r.ingredientes?.some(i => i.toLowerCase().includes(busquedaReceta.toLowerCase()))
    );

  const todasEtiquetas = [...new Set(recetas.flatMap(r => r.etiquetas || []))];

  // Calcular estadísticas de consumo
  function estadisticasSemana() {
    const comidasSemana = comidas.filter(c =>
      c.fecha && c.fecha >= inicioSemana && c.fecha <= finSemana && c.nivelConsumo
    );

    const totalConsumo = comidasSemana.reduce((sum, c) => sum + (c.porcentajeConsumido || 0), 0);
    const promedio = comidasSemana.length > 0 ? Math.round(totalConsumo / comidasSemana.length) : 0;

    const porNivel: Record<string, number> = {};
    comidasSemana.forEach(c => {
      if (c.nivelConsumo) {
        porNivel[c.nivelConsumo] = (porNivel[c.nivelConsumo] || 0) + 1;
      }
    });

    const totalCalorias = comidasSemana.reduce((sum, c) => {
      const cal = c.valorNutricional?.calorias || 0;
      const porc = (c.porcentajeConsumido || 0) / 100;
      return sum + (cal * porc);
    }, 0);

    return {
      registradas: comidasSemana.length,
      promedioConsumo: promedio,
      porNivel,
      totalCalorias: Math.round(totalCalorias)
    };
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex justify-center items-center h-64">
          <div className="text-gray-500">Cargando menú...</div>
        </div>
      </Layout>
    );
  }

  const stats = estadisticasSemana();

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🍽️ Menú de Comidas</h1>
              <p className="text-gray-600">Planificación y registro de alimentación</p>
            </div>
          </div>

          {/* Tabs de navegación */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setVista('menu')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                vista === 'menu'
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📅 Menú Semanal
            </button>
            <button
              onClick={() => setVista('configuracion')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                vista === 'configuracion'
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ⚙️ Configuración
            </button>
            <button
              onClick={() => setVista('recetas')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                vista === 'recetas'
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📖 Recetas
            </button>
          </div>
        </div>

        {vista === 'menu' ? (
          esMovil ? (
            /* ═══════════════════════════════════════════════════════════════
               VISTA MÓVIL - DÍA A DÍA
               ═══════════════════════════════════════════════════════════════ */
            <div className="space-y-4">
              {/* Header con fecha y navegación */}
              <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setDiaSeleccionado(subDays(diaSeleccionado, 1))}
                    className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/30 active:scale-95 transition-all"
                  >
                    ←
                  </button>
                  <div className="text-center">
                    <div className="text-white/80 text-sm font-medium">
                      {format(diaSeleccionado, 'EEEE', { locale: es })}
                    </div>
                    <div className="text-white text-2xl font-bold">
                      {format(diaSeleccionado, "d 'de' MMMM", { locale: es })}
                    </div>
                  </div>
                  <button
                    onClick={() => setDiaSeleccionado(addDays(diaSeleccionado, 1))}
                    className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/30 active:scale-95 transition-all"
                  >
                    →
                  </button>
                </div>

                {/* Selector de días tipo pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                  {Array.from({ length: 7 }, (_, i) => {
                    const fecha = addDays(subDays(new Date(), 3), i);
                    const esHoy = isSameDay(fecha, new Date());
                    const esSeleccionado = isSameDay(fecha, diaSeleccionado);
                    return (
                      <button
                        key={i}
                        onClick={() => setDiaSeleccionado(fecha)}
                        className={`flex-shrink-0 w-12 py-2 rounded-xl text-center transition-all ${
                          esSeleccionado
                            ? 'bg-white text-orange-600 shadow-lg scale-105'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        <div className="text-[10px] font-medium uppercase">
                          {format(fecha, 'EEE', { locale: es })}
                        </div>
                        <div className={`text-lg font-bold ${esHoy && !esSeleccionado ? 'underline' : ''}`}>
                          {format(fecha, 'd')}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Botón ir a hoy */}
                {!isSameDay(diaSeleccionado, new Date()) && (
                  <button
                    onClick={() => setDiaSeleccionado(new Date())}
                    className="mt-3 w-full py-2 bg-white/20 backdrop-blur text-white text-sm font-medium rounded-xl hover:bg-white/30 transition-all"
                  >
                    Ir a hoy
                  </button>
                )}
              </div>

              {/* Cards de tiempos de comida */}
              <div className="space-y-4">
                {tiemposComidaConfig.filter(t => t.activo).map((tiempo, idx) => {
                  const menu = getMenu(diaSeleccionado, tiempo.id);
                  const platillosAsignados = tiempo.componentes.filter(c => getPlatillo(menu, c.id)).length;
                  const totalComponentes = tiempo.componentes.length;

                  return (
                    <div
                      key={tiempo.id}
                      className="bg-white rounded-2xl shadow-md overflow-hidden"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      {/* Header del tiempo de comida */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{tiempo.icono}</span>
                            <div>
                              <div className="font-semibold text-gray-800">{tiempo.nombre}</div>
                              <div className="text-xs text-gray-500">{tiempo.horaDefault}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              platillosAsignados === totalComponentes
                                ? 'bg-green-100 text-green-700'
                                : platillosAsignados > 0
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {platillosAsignados}/{totalComponentes}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Platillos */}
                      <div className="p-3 space-y-2">
                        {tiempo.componentes.map(comp => {
                          const platillo = getPlatillo(menu, comp.id);
                          const compInfo = COMPONENTES_DISPONIBLES.find(c => c.id === comp.id);
                          const esObligatorio = comp.obligatorio;
                          const recetaInfo = platillo?.recetaId ? recetas.find(r => r.id === platillo.recetaId) : null;
                          const fotoUrl = recetaInfo?.foto || platillo?.fotoCustom;

                          return (
                            <div
                              key={comp.id}
                              className={`rounded-xl border-2 transition-all ${
                                platillo
                                  ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200'
                                  : esObligatorio
                                  ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 border-dashed'
                                  : 'bg-gray-50 border-gray-200 border-dashed'
                              }`}
                            >
                              {platillo ? (
                                <div className="flex items-center gap-3 p-3">
                                  {/* Foto o icono */}
                                  {fotoUrl ? (
                                    <img
                                      src={fotoUrl}
                                      alt=""
                                      className="w-14 h-14 object-cover rounded-xl shadow-sm ring-2 ring-white"
                                    />
                                  ) : (
                                    <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">
                                      {compInfo?.icono}
                                    </div>
                                  )}

                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs text-emerald-600 font-medium mb-0.5">
                                      {comp.nombre}
                                    </div>
                                    <div
                                      className={`font-semibold text-gray-800 truncate ${
                                        platillo.nombreCustom ? 'cursor-pointer active:text-amber-600' : ''
                                      }`}
                                      onClick={() => {
                                        if (platillo.nombreCustom && menu) {
                                          abrirEditarPlatilloCustom(menu.id, platillo);
                                        }
                                      }}
                                    >
                                      {platillo.recetaNombre || platillo.nombreCustom}
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => menu && quitarPlatillo(menu.id, comp.id)}
                                    className="w-8 h-8 bg-red-100 text-red-500 rounded-full flex items-center justify-center hover:bg-red-200 active:scale-95 transition-all"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => abrirModalAsignar(diaSeleccionado, tiempo.id, comp.id, menu?.id)}
                                  className="w-full flex items-center gap-3 p-3"
                                >
                                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
                                    esObligatorio ? 'bg-red-100' : 'bg-gray-100'
                                  }`}>
                                    {compInfo?.icono}
                                  </div>
                                  <div className="flex-1 text-left">
                                    <div className={`text-xs font-medium mb-0.5 ${
                                      esObligatorio ? 'text-red-500' : 'text-gray-400'
                                    }`}>
                                      {comp.nombre} {esObligatorio && '*'}
                                    </div>
                                    <div className={`font-medium ${
                                      esObligatorio ? 'text-red-600' : 'text-gray-500'
                                    }`}>
                                      + Agregar platillo
                                    </div>
                                  </div>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
               VISTA DESKTOP - SEMANAL (original)
               ═══════════════════════════════════════════════════════════════ */
            <>
              {/* Estadísticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">{stats.registradas}</div>
                  <div className="text-sm text-gray-500">Comidas registradas</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{stats.promedioConsumo}%</div>
                  <div className="text-sm text-gray-500">Promedio consumo</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <div className="text-3xl font-bold text-orange-600">{stats.totalCalorias}</div>
                  <div className="text-sm text-gray-500">Calorías consumidas</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500 mb-1">Por nivel:</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(stats.porNivel).map(([nivel, count]) => {
                      const config = nivelesConsumo.find(n => n.value === nivel);
                      return (
                        <span key={nivel} className={`text-xs px-2 py-0.5 rounded text-white ${config?.color}`}>
                          {config?.label}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Navegación de semana */}
              <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-lg shadow">
                <button
                  onClick={() => setSemanaActual(subWeeks(semanaActual, 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ← Anterior
                </button>
                <div className="text-center">
                  <h2 className="font-semibold">
                    {format(inicioSemana, "d 'de' MMMM", { locale: es })} - {format(finSemana, "d 'de' MMMM yyyy", { locale: es })}
                  </h2>
                  <button
                    onClick={() => {
                      setSemanaActual(new Date());
                      setTimeout(() => {
                        hoyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Ir a hoy
                  </button>
                </div>
                <button
                  onClick={() => setSemanaActual(addWeeks(semanaActual, 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  Siguiente →
                </button>
              </div>

              {/* Calendario de menú con componentes */}
              <div className="space-y-6">
                {diasSemana.map((dia) => {
                  const esHoy = isSameDay(dia, new Date());
                  return (
                    <div
                      key={dia.toISOString()}
                      ref={esHoy ? hoyRef : null}
                      className={`bg-white rounded-lg shadow ${esHoy ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      {/* Header del día */}
                      <div className={`p-4 border-b ${esHoy ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${esHoy ? 'text-blue-600' : ''}`}>
                            {format(dia, "EEEE d 'de' MMMM", { locale: es })}
                          </span>
                          {esHoy && (
                            <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                              Hoy
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Grid de tiempos de comida */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 divide-y md:divide-y-0 md:divide-x">
                        {tiemposComidaConfig.filter(t => t.activo).map(tiempo => {
                          const menu = getMenu(dia, tiempo.id);

                          return (
                            <div key={tiempo.id} className="p-4">
                              {/* Header del tiempo */}
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                                <span className="text-xl">{tiempo.icono}</span>
                                <div>
                                  <div className="font-semibold text-sm">{tiempo.nombre}</div>
                                  <div className="text-xs text-gray-500">{tiempo.horaDefault}</div>
                                </div>
                              </div>

                              {/* Componentes */}
                              <div className="space-y-2">
                                {tiempo.componentes.map(comp => {
                                  const platillo = getPlatillo(menu, comp.id);
                                  const compInfo = COMPONENTES_DISPONIBLES.find(c => c.id === comp.id);
                                  const esObligatorio = comp.obligatorio;

                                  return (
                                    <div
                                      key={comp.id}
                                      className={`rounded-lg border ${
                                        platillo
                                          ? 'bg-green-50 border-green-200'
                                          : esObligatorio && !platillo
                                          ? 'bg-red-50 border-red-200'
                                          : 'bg-gray-50 border-gray-200'
                                      }`}
                                    >
                                      {/* Label del componente */}
                                      <div className="flex items-center gap-1 px-2 py-1 border-b border-inherit">
                                        <span className="text-sm">{compInfo?.icono}</span>
                                        <span className="text-xs font-medium text-gray-600">{comp.nombre}</span>
                                        {esObligatorio && (
                                          <span className="text-xs text-red-500">*</span>
                                        )}
                                      </div>

                                      {/* Contenido */}
                                      <div className="p-2">
                                        {platillo ? (
                                          <div className="flex items-center justify-between gap-2">
                                            {/* Miniatura de foto si existe */}
                                            {(() => {
                                              const recetaInfo = platillo.recetaId
                                                ? recetas.find(r => r.id === platillo.recetaId)
                                                : null;
                                              const fotoUrl = recetaInfo?.foto || platillo.fotoCustom;
                                              return fotoUrl ? (
                                                <img
                                                  src={fotoUrl}
                                                  alt=""
                                                  className="w-8 h-8 object-cover rounded-lg flex-shrink-0 ring-1 ring-gray-200"
                                                />
                                              ) : null;
                                            })()}
                                            <span
                                              className={`text-sm truncate font-medium flex-1 ${
                                                platillo.nombreCustom ? 'cursor-pointer hover:text-amber-600' : ''
                                              }`}
                                              onClick={() => {
                                                if (platillo.nombreCustom && menu) {
                                                  abrirEditarPlatilloCustom(menu.id, platillo);
                                                }
                                              }}
                                              title={platillo.nombreCustom ? 'Click para editar' : undefined}
                                            >
                                              {platillo.recetaNombre || platillo.nombreCustom}
                                            </span>
                                            <button
                                              onClick={() => menu && quitarPlatillo(menu.id, comp.id)}
                                              className="text-red-500 hover:text-red-700 text-sm flex-shrink-0"
                                              title="Quitar"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => abrirModalAsignar(dia, tiempo.id, comp.id, menu?.id)}
                                            className={`w-full text-xs py-1 rounded ${
                                              esObligatorio
                                                ? 'text-red-600 hover:bg-red-100'
                                                : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                          >
                                            + Agregar
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leyenda */}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-50 border border-green-200"></div>
                  <span>Asignado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-50 border border-red-200"></div>
                  <span>Obligatorio sin asignar</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-500">*</span>
                  <span>Obligatorio</span>
                </div>
              </div>
            </>
          )
        ) : vista === 'configuracion' ? (
          /* Vista de Configuración */
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold">Configuración de Tiempos de Comida</h3>
                <p className="text-sm text-gray-500">
                  Configura qué componentes están disponibles en cada tiempo de comida
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={restaurarConfigDefault}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Restaurar Default
                </button>
                <button
                  onClick={guardarConfiguracion}
                  disabled={guardandoConfig || !isDirty}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {guardandoConfig ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>

            {loadingConfig ? (
              <div className="text-center py-12 text-gray-500">Cargando configuración...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {tiemposComidaConfig.map(tiempo => (
                  <div key={tiempo.id} className="border rounded-lg p-4">
                    {/* Header del tiempo */}
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                      <span className="text-2xl">{tiempo.icono}</span>
                      <div>
                        <h4 className="font-semibold">{tiempo.nombre}</h4>
                        <p className="text-xs text-gray-500">{tiempo.horaDefault}</p>
                      </div>
                    </div>

                    {/* Lista de componentes */}
                    <div className="space-y-2">
                      {COMPONENTES_DISPONIBLES.map(comp => {
                        const estaActivo = tieneComponente(tiempo.id, comp.id);
                        // Buscar si es obligatorio en la configuración del tiempo actual
                        const compEnTiempo = tiempo.componentes.find(c => c.id === comp.id);
                        const esObligatorio = compEnTiempo?.obligatorio || false;

                        return (
                          <label
                            key={comp.id}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                              estaActivo ? 'bg-blue-50' : 'hover:bg-gray-50'
                            } ${esObligatorio ? 'cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={estaActivo}
                              onChange={() => toggleComponente(tiempo.id, comp.id)}
                              disabled={esObligatorio}
                              className="h-4 w-4 rounded text-blue-600 disabled:opacity-50"
                            />
                            <span className="text-lg">{COMPONENTES_DISPONIBLES.find(c => c.id === comp.id)?.icono}</span>
                            <span className={`text-sm ${estaActivo ? 'font-medium' : 'text-gray-600'}`}>
                              {comp.nombre}
                            </span>
                            {esObligatorio && (
                              <span className="text-xs text-gray-400 ml-auto" title="Obligatorio">🔒</span>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {/* Resumen de componentes activos */}
                    <div className="mt-4 pt-3 border-t">
                      <p className="text-xs text-gray-500">
                        {tiempo.componentes.length} componentes activos
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Nota informativa */}
            <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>Nota:</strong> Los componentes con 🔒 son obligatorios y no pueden desactivarse.
                <span className="inline-flex items-center gap-1 ml-1">🥛 Lactobacilos</span> es obligatorio en Desayuno.
              </p>
            </div>
          </div>
        ) : (
          /* Vista de Recetas */
          <div className="bg-white rounded-lg shadow p-6">
            {/* Header con botón nueva receta */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h3 className="text-lg font-semibold">Banco de Recetas</h3>
              <button
                onClick={() => abrirModalReceta()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                + Nueva Receta
              </button>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <input
                type="text"
                value={busquedaReceta}
                onChange={(e) => setBusquedaReceta(e.target.value)}
                placeholder="Buscar receta o ingrediente..."
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value as CategoriaComida | 'todas')}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="todas">Todas las categorías</option>
                {categoriasComida.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <select
                value={filtroEtiqueta}
                onChange={(e) => setFiltroEtiqueta(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todas las etiquetas</option>
                {todasEtiquetas.map(etq => (
                  <option key={etq} value={etq}>{etq}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mostrarSoloFavoritas}
                  onChange={(e) => setMostrarSoloFavoritas(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm">Solo favoritas</span>
              </label>
            </div>

            {/* Contador de resultados */}
            <p className="text-sm text-gray-500 mb-4">
              Mostrando {recetasFiltradas.length} de {recetas.length} recetas
            </p>

            {/* Grid de recetas */}
            {recetasFiltradas.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">No hay recetas</p>
                <p className="text-sm">Crea tu primera receta con el botón "+ Nueva Receta"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recetasFiltradas.map(receta => (
                  <div
                    key={receta.id}
                    className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Foto o placeholder */}
                    {receta.foto ? (
                      <img
                        src={receta.foto}
                        alt={receta.nombre}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-4xl">
                        🍽️
                      </div>
                    )}

                    <div className="p-4">
                      {/* Nombre y favorita */}
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{receta.nombre}</h4>
                        <button
                          onClick={() => toggleFavoritaReceta(receta)}
                          className="text-xl hover:scale-110 transition-transform"
                          title={receta.favorita ? 'Quitar de favoritas' : 'Agregar a favoritas'}
                        >
                          {receta.favorita ? '⭐' : '☆'}
                        </button>
                      </div>

                      {/* Categoría */}
                      <p className="text-sm text-gray-600 mb-2">
                        {categoriasComida.find(c => c.value === receta.categoria)?.label}
                      </p>

                      {/* Etiquetas */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {receta.etiquetas?.slice(0, 3).map(etq => (
                          <span key={etq} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                            {etq}
                          </span>
                        ))}
                        {receta.etiquetas?.length > 3 && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                            +{receta.etiquetas.length - 3}
                          </span>
                        )}
                      </div>


                      {/* Botones de acción */}
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <button
                          onClick={() => verReceta(receta)}
                          className="py-1.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => abrirModalReceta(receta)}
                          className="py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => duplicarReceta(receta)}
                          className="py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Duplicar
                        </button>
                        <button
                          onClick={() => eliminarReceta(receta)}
                          className="py-1.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                        >
                          Eliminar
                        </button>
                      </div>

                      {/* Botón usar en menú */}
                      <button
                        onClick={() => {
                          usarReceta(receta);
                          setModalComida(true);
                        }}
                        className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Usar en menú
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Agregar Comida */}
        {modalComida && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-lg w-full p-6 my-8">
              <h2 className="text-xl font-bold mb-4">
                🍽️ Agregar Comida - {tiposComida.find(t => t.value === tipoComidaSeleccionado)?.label}
              </h2>
              {fechaSeleccionada && (
                <p className="text-sm text-gray-500 mb-4">
                  {format(fechaSeleccionada, "EEEE d 'de' MMMM", { locale: es })}
                </p>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Seleccionar de recetas</label>
                  <button
                    onClick={() => setModalReceta(true)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    📖 Ver recetas
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platillo *</label>
                  <input
                    type="text"
                    value={formComida.platillo}
                    onChange={(e) => setFormComida({ ...formComida, platillo: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Nombre del platillo"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <select
                      value={formComida.categoria}
                      onChange={(e) => setFormComida({ ...formComida, categoria: e.target.value as CategoriaComida })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      {categoriasComida.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                    <input
                      type="number"
                      value={formComida.cantidad}
                      onChange={(e) => setFormComida({ ...formComida, cantidad: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Ej: 1, 0.5"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Calorías</label>
                    <input
                      type="number"
                      value={formComida.calorias || ''}
                      onChange={(e) => setFormComida({ ...formComida, calorias: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="kcal"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ingredientes</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={nuevoIngrediente}
                      onChange={(e) => setNuevoIngrediente(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder="Agregar ingrediente..."
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarIngrediente())}
                    />
                    <button
                      type="button"
                      onClick={agregarIngrediente}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formComida.ingredientes.map((ing, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1">
                        {ing}
                        <button
                          onClick={() => setFormComida({
                            ...formComida,
                            ingredientes: formComida.ingredientes.filter((_, i) => i !== idx)
                          })}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones</label>
                  <textarea
                    value={formComida.instrucciones}
                    onChange={(e) => setFormComida({ ...formComida, instrucciones: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Instrucciones de preparación..."
                  />
                </div>
              </div>

              <div className="flex justify-between items-center mt-6">
                {/* Indicador de cambios sin guardar */}
                {isDirty && (
                  <span className="text-sm text-orange-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                    Sin guardar
                  </span>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={() => confirmNavigation(cerrarModalComida)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={crearComida}
                    disabled={!formComida.platillo}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Agregar al Menú
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Registrar Consumo */}
        {modalConsumo && comidaSeleccionada && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">🍴 Registrar Consumo</h2>

              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <p className="font-medium">{comidaSeleccionada.platillo}</p>
                <p className="text-sm text-gray-600">
                  {tiposComida.find(t => t.value === comidaSeleccionada.tipoComida)?.label} - {comidaSeleccionada.horaProgramada}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Cuánto consumió?
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {nivelesConsumo.map(nivel => (
                      <button
                        key={nivel.value}
                        onClick={() => setFormConsumo({ ...formConsumo, nivelConsumo: nivel.value })}
                        className={`p-2 rounded-lg text-center text-sm ${
                          formConsumo.nivelConsumo === nivel.value
                            ? `${nivel.color} text-white`
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        <div className="font-medium">{nivel.porcentaje}%</div>
                        <div className="text-xs">{nivel.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {(formConsumo.nivelConsumo === 'poco' || formConsumo.nivelConsumo === 'nada') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Motivo del rechazo
                    </label>
                    <input
                      type="text"
                      value={formConsumo.motivoRechazo}
                      onChange={(e) => setFormConsumo({ ...formConsumo, motivoRechazo: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="¿Por qué no comió?"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Satisfacción
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setFormConsumo({ ...formConsumo, satisfaccion: n })}
                        className={`w-10 h-10 rounded-full text-xl ${
                          formConsumo.satisfaccion >= n ? 'bg-yellow-400' : 'bg-gray-200'
                        }`}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={formConsumo.notasConsumo}
                    onChange={(e) => setFormConsumo({ ...formConsumo, notasConsumo: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Observaciones adicionales..."
                  />
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <button
                  onClick={() => {
                    eliminarComida(comidaSeleccionada);
                    setModalConsumo(false);
                    setComidaSeleccionada(null);
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  🗑️ Eliminar
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setModalConsumo(false);
                      setComidaSeleccionada(null);
                      setFormConsumo({ nivelConsumo: 'todo', motivoRechazo: '', notasConsumo: '', satisfaccion: 3 });
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={registrarConsumo}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    ✓ Registrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Seleccionar Receta */}
        {modalReceta && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Seleccionar Receta</h2>
                <button
                  onClick={() => setModalReceta(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recetas.map(receta => (
                  <button
                    key={receta.id}
                    onClick={() => usarReceta(receta)}
                    className="text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300"
                  >
                    <div className="font-medium">{receta.nombre}</div>
                    <div className="text-sm text-gray-500">
                      {categoriasComida.find(c => c.value === receta.categoria)?.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal Ver Receta (solo lectura) */}
        {modalVerReceta && recetaVisualizando && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold">{recetaVisualizando.nombre}</h2>
                    {recetaVisualizando.favorita && <span className="text-xl">⭐</span>}
                  </div>
                  <button
                    onClick={cerrarVistaReceta}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-6 space-y-6">
                {/* Foto */}
                {recetaVisualizando.foto ? (
                  <img
                    src={recetaVisualizando.foto}
                    alt={recetaVisualizando.nombre}
                    className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setImagenExpandida(true)}
                    title="Click para ampliar"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-6xl rounded-lg">
                    🍽️
                  </div>
                )}

                {/* Modal imagen expandida */}
                {imagenExpandida && recetaVisualizando.foto && (
                  <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
                    onClick={() => setImagenExpandida(false)}
                  >
                    <div className="relative max-w-4xl max-h-[85vh]">
                      <img
                        src={recetaVisualizando.foto}
                        alt={recetaVisualizando.nombre}
                        className="max-w-full max-h-[85vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={() => setImagenExpandida(false)}
                        className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full text-gray-700 hover:bg-gray-100 flex items-center justify-center text-xl shadow-lg"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {/* Categoría */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Categoría</h3>
                  <span className="inline-block px-3 py-1 bg-gray-100 rounded-full text-sm">
                    {categoriasComida.find(c => c.value === recetaVisualizando.categoria)?.label || recetaVisualizando.categoria}
                  </span>
                </div>

                {/* Etiquetas */}
                {recetaVisualizando.etiquetas && recetaVisualizando.etiquetas.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Etiquetas</h3>
                    <div className="flex flex-wrap gap-2">
                      {recetaVisualizando.etiquetas.map(etq => (
                        <span key={etq} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {etq}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ingredientes */}
                {recetaVisualizando.ingredientes && recetaVisualizando.ingredientes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Ingredientes</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {recetaVisualizando.ingredientes.map((ing, idx) => (
                        <li key={idx}>{ing}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Instrucciones */}
                {recetaVisualizando.instrucciones && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Instrucciones</h3>
                    <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-gray-700">
                      {recetaVisualizando.instrucciones}
                    </div>
                  </div>
                )}

                {/* Habilitaciones */}
                {recetaVisualizando.habilitaciones && recetaVisualizando.habilitaciones.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Habilitada para</h3>
                    <div className="flex flex-wrap gap-2">
                      {recetaVisualizando.habilitaciones.map((hab, idx) => {
                        const tiempo = tiemposComidaConfig.find(t => t.id === hab.tiempoComidaId);
                        const componente = COMPONENTES_DISPONIBLES.find(c => c.id === hab.componenteId);
                        return (
                          <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                            {tiempo?.icono} {tiempo?.nombre} → {componente?.nombre}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer con botones */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-between gap-3">
                <button
                  onClick={cerrarVistaReceta}
                  className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    cerrarVistaReceta();
                    abrirModalReceta(recetaVisualizando);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Editar receta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Crear/Editar Receta */}
        {modalRecetaCRUD && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
              {/* Header sticky */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">
                    {recetaEditando ? 'Editar Receta' : 'Nueva Receta'}
                  </h2>
                  <button
                    onClick={cerrarModalReceta}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Información básica */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Información Básica</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={formReceta.nombre}
                        onChange={(e) => setFormReceta({ ...formReceta, nombre: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Nombre de la receta"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formReceta.favorita}
                          onChange={(e) => setFormReceta({ ...formReceta, favorita: e.target.checked })}
                          className="h-4 w-4 rounded"
                        />
                        <span className="text-sm">Marcar como favorita</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Habilitaciones - dónde puede usarse esta receta */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Habilitaciones</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Selecciona en qué tiempos y componentes puede usarse esta receta
                  </p>

                  <div className="space-y-4">
                    {tiemposComidaConfig.map(tiempo => (
                      <div key={tiempo.id} className="border rounded-lg p-3 bg-white">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">{tiempo.icono}</span>
                          <span className="font-medium text-sm">{tiempo.nombre}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tiempo.componentes.map(comp => {
                            const isChecked = tieneHabilitacion(tiempo.id, comp.id);
                            const compInfo = COMPONENTES_DISPONIBLES.find(c => c.id === comp.id);
                            return (
                              <label
                                key={comp.id}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                                  isChecked
                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleHabilitacion(tiempo.id, comp.id)}
                                  className="h-3.5 w-3.5 rounded text-blue-600"
                                />
                                <span>{compInfo?.icono}</span>
                                <span>{comp.nombre}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumen de habilitaciones */}
                  {formReceta.habilitaciones.length > 0 && (
                    <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-700">
                        <strong>{formReceta.habilitaciones.length}</strong> combinaciones habilitadas
                      </p>
                    </div>
                  )}
                </div>

                {/* Ingredientes */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Ingredientes</h3>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={nuevoIngredienteReceta}
                      onChange={(e) => setNuevoIngredienteReceta(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && nuevoIngredienteReceta.trim()) {
                          e.preventDefault();
                          setFormReceta({ ...formReceta, ingredientes: [...formReceta.ingredientes, nuevoIngredienteReceta.trim()] });
                          setNuevoIngredienteReceta('');
                        }
                      }}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder="Agregar ingrediente..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (nuevoIngredienteReceta.trim()) {
                          setFormReceta({ ...formReceta, ingredientes: [...formReceta.ingredientes, nuevoIngredienteReceta.trim()] });
                          setNuevoIngredienteReceta('');
                        }
                      }}
                      className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formReceta.ingredientes.map((ing, idx) => (
                      <span key={idx} className="px-3 py-1 bg-white border rounded-full text-sm flex items-center gap-2">
                        {ing}
                        <button
                          onClick={() => setFormReceta({
                            ...formReceta,
                            ingredientes: formReceta.ingredientes.filter((_, i) => i !== idx)
                          })}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Instrucciones */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Instrucciones</h3>
                  <textarea
                    value={formReceta.instrucciones}
                    onChange={(e) => setFormReceta({ ...formReceta, instrucciones: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={4}
                    placeholder="Pasos para preparar la receta..."
                  />
                </div>

                {/* Etiquetas */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Etiquetas</h3>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={nuevaEtiquetaReceta}
                      onChange={(e) => setNuevaEtiquetaReceta(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && nuevaEtiquetaReceta.trim()) {
                          e.preventDefault();
                          setFormReceta({ ...formReceta, etiquetas: [...formReceta.etiquetas, nuevaEtiquetaReceta.trim()] });
                          setNuevaEtiquetaReceta('');
                        }
                      }}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder="Agregar etiqueta (ej: desayuno, proteína)..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (nuevaEtiquetaReceta.trim()) {
                          setFormReceta({ ...formReceta, etiquetas: [...formReceta.etiquetas, nuevaEtiquetaReceta.trim()] });
                          setNuevaEtiquetaReceta('');
                        }
                      }}
                      className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formReceta.etiquetas.map((etq, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                        {etq}
                        <button
                          onClick={() => setFormReceta({
                            ...formReceta,
                            etiquetas: formReceta.etiquetas.filter((_, i) => i !== idx)
                          })}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Foto */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Foto</h3>
                  {formReceta.foto ? (
                    <div className="relative inline-block">
                      <img
                        src={formReceta.foto}
                        alt="Preview"
                        className="w-48 h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => setFormReceta({ ...formReceta, foto: '' })}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFotoUpload}
                        disabled={uploadingFoto}
                        className="block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0
                          file:text-sm file:font-medium
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100"
                      />
                      {uploadingFoto && (
                        <p className="text-sm text-gray-500 mt-2">Subiendo foto...</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Botones */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  {/* Indicador de cambios sin guardar */}
                  {isDirty && (
                    <span className="text-sm text-orange-600 flex items-center gap-1">
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                      Sin guardar
                    </span>
                  )}
                  <div className="flex gap-3 ml-auto">
                    <button
                      onClick={() => confirmNavigation(cerrarModalReceta)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={guardarReceta}
                      disabled={!formReceta.nombre.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {recetaEditando ? 'Actualizar' : 'Crear'} Receta
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Asignar Platillo */}
        {modalAsignar && asignacionActual && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-md w-full my-8 max-h-[85vh] overflow-y-auto shadow-2xl">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold">
                      Agregar {COMPONENTES_DISPONIBLES.find(c => c.id === asignacionActual.componenteId)?.nombre}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {tiemposComidaConfig.find(t => t.id === asignacionActual.tiempoId)?.nombre} - {format(asignacionActual.fecha, "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                  </div>
                  <button
                    onClick={cerrarModalAsignar}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Búsqueda de recetas */}
                <div>
                  <input
                    type="text"
                    value={busquedaRecetaAsignar}
                    onChange={(e) => setBusquedaRecetaAsignar(e.target.value)}
                    placeholder="Buscar receta..."
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                {/* Recetas habilitadas */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Recetas habilitadas para {tiemposComidaConfig.find(t => t.id === asignacionActual.tiempoId)?.nombre} → {COMPONENTES_DISPONIBLES.find(c => c.id === asignacionActual.componenteId)?.nombre}
                  </h3>

                  {(() => {
                    const recetasDisponibles = recetasHabilitadas(asignacionActual.tiempoId, asignacionActual.componenteId)
                      .filter(r => !busquedaRecetaAsignar ||
                        r.nombre.toLowerCase().includes(busquedaRecetaAsignar.toLowerCase())
                      );

                    if (recetasDisponibles.length === 0) {
                      return (
                        <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                          <p className="text-sm">No hay recetas habilitadas para esta combinación</p>
                          <p className="text-xs mt-1">Puedes crear un platillo sin receta abajo</p>
                        </div>
                      );
                    }

                    return (
                      <Carousel
                        items={recetasDisponibles}
                        renderItem={(receta) => (
                          <RecetaCarouselCard
                            receta={receta}
                            onSelect={asignarPlatillo}
                          />
                        )}
                        loop={true}
                        showArrows={true}
                        showDots={recetasDisponibles.length <= 8}
                        showCounter={true}
                        enableSwipe={true}
                        ariaLabel="Carrusel de recetas disponibles"
                      />
                    );
                  })()}
                </div>

                {/* Separador */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white text-gray-500">o crear platillo sin receta</span>
                  </div>
                </div>

                {/* Platillo custom */}
                <div className="space-y-4">
                  {/* Input de nombre */}
                  <input
                    type="text"
                    value={platilloCustom}
                    onChange={(e) => setPlatilloCustom(e.target.value)}
                    placeholder="Nombre del platillo..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                  />

                  {/* Sección de foto - solo visible cuando hay nombre */}
                  {platilloCustom.trim() && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                      <div className="flex items-start gap-4">
                        {/* Preview de foto o placeholder */}
                        <div className="relative flex-shrink-0">
                          {fotoCustom ? (
                            <div className="relative group">
                              <img
                                src={fotoCustom}
                                alt="Preview del platillo"
                                className="w-24 h-24 object-cover rounded-xl shadow-md ring-2 ring-white"
                              />
                              <button
                                onClick={() => setFotoCustom('')}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg hover:bg-red-600 hover:scale-110 transition-all"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <div className="w-24 h-24 bg-white/80 backdrop-blur rounded-xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-amber-200">
                              <span className="text-3xl mb-1">📷</span>
                              <span className="text-[10px] font-medium">Opcional</span>
                            </div>
                          )}
                        </div>

                        {/* Botones de captura */}
                        <div className="flex-1 space-y-2">
                          <p className="text-xs text-amber-800 font-medium mb-3">
                            Agrega una foto del platillo
                          </p>

                          {uploadingFotoCustom ? (
                            <div className="flex items-center gap-2 text-amber-700">
                              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-sm font-medium">Subiendo foto...</span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {/* Botón Tomar Foto */}
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFotoCustomUpload}
                                className="hidden"
                                id="foto-camera-input"
                              />
                              <label
                                htmlFor="foto-camera-input"
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium text-sm cursor-pointer hover:from-amber-600 hover:to-orange-600 active:scale-95 transition-all shadow-md shadow-amber-200"
                              >
                                <span>📸</span>
                                <span>Tomar foto</span>
                              </label>

                              {/* Botón Galería */}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFotoCustomUpload}
                                className="hidden"
                                id="foto-gallery-input"
                              />
                              <label
                                htmlFor="foto-gallery-input"
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-amber-700 rounded-xl font-medium text-sm cursor-pointer hover:bg-amber-50 active:scale-95 transition-all border border-amber-200 shadow-sm"
                              >
                                <span>🖼️</span>
                                <span>Galería</span>
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botón agregar */}
                  <button
                    onClick={() => platilloCustom.trim() && asignarPlatillo(undefined, platilloCustom.trim())}
                    disabled={!platilloCustom.trim() || uploadingFotoCustom}
                    className="w-full px-4 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-xl font-medium hover:from-gray-800 hover:to-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-gray-200 active:scale-[0.98]"
                  >
                    {fotoCustom ? '✓ Agregar platillo con foto' : 'Agregar platillo'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de edición de platillo custom */}
        {modalEditarPlatillo && platilloEditando && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Editar platillo</h3>
                  <button
                    onClick={cerrarModalEditarPlatillo}
                    className="text-white/80 hover:text-white text-2xl font-light"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                {/* Input nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del platillo
                  </label>
                  <input
                    type="text"
                    value={editNombreCustom}
                    onChange={(e) => setEditNombreCustom(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                    placeholder="Nombre del platillo..."
                  />
                </div>

                {/* Sección de foto */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                  <label className="block text-sm font-medium text-amber-800 mb-3">
                    Foto del platillo
                  </label>
                  <div className="flex items-start gap-4">
                    {/* Preview */}
                    <div className="relative flex-shrink-0">
                      {editFotoCustom ? (
                        <div className="relative">
                          <img
                            src={editFotoCustom}
                            alt="Preview"
                            className="w-24 h-24 object-cover rounded-xl shadow-md ring-2 ring-white"
                          />
                          <button
                            onClick={() => setEditFotoCustom('')}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg hover:bg-red-600 hover:scale-110 transition-all"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 bg-white/80 backdrop-blur rounded-xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-amber-200">
                          <span className="text-3xl mb-1">📷</span>
                          <span className="text-[10px] font-medium">Sin foto</span>
                        </div>
                      )}
                    </div>

                    {/* Botones */}
                    <div className="flex-1 space-y-2">
                      {uploadingEditFoto ? (
                        <div className="flex items-center gap-2 text-amber-700">
                          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm font-medium">Subiendo...</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleEditFotoUpload}
                            className="hidden"
                            id="edit-camera-input"
                          />
                          <label
                            htmlFor="edit-camera-input"
                            className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm cursor-pointer hover:from-amber-600 hover:to-orange-600 active:scale-95 transition-all shadow-md"
                          >
                            <span>📸</span>
                            <span>Cámara</span>
                          </label>

                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleEditFotoUpload}
                            className="hidden"
                            id="edit-gallery-input"
                          />
                          <label
                            htmlFor="edit-gallery-input"
                            className="inline-flex items-center gap-2 px-3 py-2 bg-white text-amber-700 rounded-lg font-medium text-sm cursor-pointer hover:bg-amber-50 active:scale-95 transition-all border border-amber-200"
                          >
                            <span>🖼️</span>
                            <span>Galería</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={cerrarModalEditarPlatillo}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarEditPlatilloCustom}
                    disabled={!editNombreCustom.trim() || uploadingEditFoto}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
